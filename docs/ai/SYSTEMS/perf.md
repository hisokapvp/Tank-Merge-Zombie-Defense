# Система: Performance

## Где править
- Профилирование: `src/perf/profiler.js`
- Пулы: `src/perf/objectPool.js`
- Мобайл-режим: `src/perf/mobileMode.js`
- Hot-path в `game.js`: `loop`, `draw`, `stepTanks`, `stepZombies`, `stepProjectiles`, `stepParticles`, `impactAt`, `selectZombieFenceTarget`, `selectZombieAttackTargetForZombie`, `pickFenceSegmentByPoint`.

## Правила
- Любые изменения в `loop`/`draw`/`step*` делать без мусора в куче.
- Проверять CPU/GPU-нагрузку и частоту кадров на слабых устройствах.

## Канон hot-path zero-alloc (solo-pipeline-yandex-vk#3 / 2026-04-28)

Сохраняй invariant «нет heap allocations в hot path» при любых правках:

- **Не** создавай `[]`/`{}`/`new Map()` каждый кадр в step*/draw/select* функциях. Заводи module-scope scratch (`_stepTanksTargetPool`, `_projectileZmap`) и переиспользуй через `length = 0` или `.clear()`.
- **Не** используй `.sort()`/`.map()`/`.filter()`/`.reduce()` на массивах per-frame в stepTanks/stepZombies/stepProjectiles. Заменяй на single-pass tracking inline-переменными.
- **Не** вызывай `Math.hypot(dx, dy)` для skip-проверок типа `d > range`. Используй `dx*dx + dy*dy > range*range`. `Math.sqrt` — только когда точное расстояние нужно для дальнейших вычислений (например falloff).
- **Не** вызывай `zombiePos(z)` в горячем цикле, если `{x,y}` allocation можно избежать inline-расчётом `center.x + Math.cos(z.theta) * z.r`.
- При выборе best-target держи 3-4 inline переменных (`bestZ`, `bestForward`, `bestSideSq`) и обновляй их в одном проходе, а не строй массив candidates с последующей сортировкой.
- При rebuild-стиле (`const next = []; ... state.x = next`) предпочитай in-place write-index compaction (`arr[w++] = item; arr.length = w`).
- Для regex-замен в hot path (`'rgba(R,G,B,A)'` alpha swap) предпочитай `lastIndexOf(',')` + substring concat — компилятор не пересоздаёт RegExp objects.

## Уже применённые оптимизации hot-path (для авторов будущих правок)

| Функция | Было | Стало | Экономия |
|---|---|---|---|
| `stepTanks` | per-tank `candidates=[]` + `.sort()` + `.map()` + `Math.hypot` | scratch + single-pass best | ~N_tanks × N_zombies объектов/кадр |
| `stepProjectiles` | `new Map(state.zombies.map(...))` | module-scope reused Map + for-loop | 1 Map + N inner pairs/кадр |
| `stepProjectiles` | `regex.replace(/,\s*[\d.]+\)\s*$/, ...)` | `lastIndexOf(',')` + substring | regex compile/exec per projectile/кадр |
| `impactAt` aoe-count | `state.zombies.reduce(...)` + Math.hypot | for-loop + squared distance + inlined pos | reduce closure + N hypot + N {x,y}/impact |
| `impactAt` damage | `Math.hypot` для skip | squared-distance early-skip | (N_zombies - N_victims) hypot/impact |
| `stepParticles` | `const next = []` + push | write-index in-place compaction | до ~1600 push на новый array/кадр |
| `selectZombieFenceTarget` | `const candidate = {seg, index, distance, isCorner}` per seg | inline 4 best-vars, allocate only return | ~N_zombies × N_segments объектов/кадр в attack mode |
| `selectZombieAttackTargetForZombie` | `const p = zombiePos(z)` | inline cos/sin | N_zombies {x,y}/кадр в attack mode |
| `pickFenceSegmentByPoint` | `Math.hypot(dx, dy)` per seg | squared distance | N_segments hypot per breached zombie/кадр |

## Известные follow-up (не сделано в этом батче)

- Spatial hash / uniform grid для projectile-zombie и tank-zombie пар при очень больших N. Текущие single-pass O(N×M) циклы лучше allocating-versions в 5-20×, но для 500+ zombies может потребоваться индексация.
- Sprite atlas frame ref caching — каждый `draw*` делает lookup по spritesheet objects. Cache `frameRef` на init спрайта.
- Audio context: убедиться что муззл-flash и hit SFX используют pooled buffer source, не `new Audio()`.
- DOM HUD: проверить, что `updateUI` обновляет только diff-fields, а не set всех каждый кадр.
- localStorage write throttling — уже есть `lastProgressSave` каждые 7 секунд; проверить, что нет более частых writes из других путей.

## Канон perf-deep top-3 (solo-pipeline-yandex-vk#4 / 2026-04-28)

Применены top-3 highest-impact оптимизации поверх zero-alloc canon. User-confirmed визуально 1:1.

### 1. Off-screen culling

- **Где**: `drawDecorZombieLayer` (`renderZombiesAndCorpses`), `drawScaledZombieDebuffOverlays`.
- **Контракт**: zombies с `zombiePos(z)` за пределами `[viewport ± 96px]` не push-ятся в items[] и не передаются `drawZombieEntity` / `drawImage`.
- **Margin 96px**: покрывает половину типичного спрайта зомби + полный ряд debuff-иконок (5 × 16px step). Не уменьшать без визуального теста на edge spawn.
- **Ограничения**: применять ТОЛЬКО к zombies (live + dying). Decor — фиксированные позиции, обычно всегда в кадре, culling не даёт win. НЕ применять к UI overlays/HUD — они уже в screen-space.

### 2. Spatial hash для AOE collision

- **Где**: `rebuildZombieCollisionGrid` (раз/кадр в начале `stepProjectiles`), `queryZombieIndicesInRadius`, `impactAt` (оба цикла).
- **Структура**: `_zombieCollisionGrid: Map<int, number[]>`, integer key `gy*100003+gx`, cell 96px, bucket pool для zero-alloc reuse.
- **Snapshot contract**: `_impactAoeIndices` копируется из query scratch в начале `impactAt` — защита от re-entrant query из `talentsApi.onHit` / chip onHit callbacks (если они тоже захотят grid query).
- **Order preservation**: `queryZombieIndicesInRadius` сортирует ascending → итерация эквивалентна `for (z of state.zombies)`. Talents side-effects (onHit, mark, slow propagation) порядок-чувствительны → НЕ менять sort на bucket-order.
- **Dying zombies**: остаются в grid до следующего rebuild; consumers (`if (z.state === 'dying') continue`) фильтруют — behavior 1:1.
- **Cell size tuning**: 96px = типичный AOE radius. Если средний AOE → 200px, поднимать до 128-150 (меньше cells per query, меньше false positives после squared-distance check).

### 3. DOM HUD diff-update

- **Где**: `updateUI`, `refreshAutoMergeButton`, `updateDismantleButton`.
- **Helper**: `_setHudText(el, value)` — `el.__lastHudText === value` ⇒ no-op; иначе cache + assign.
- **Coverage**: coins, zcount, buyTank label, buyCost, autoMerge label, dismantle label, buyBulk label. Boolean `disabled` тоже diff-checked перед assign.
- **Не оборачивать**: `classList.add/remove` уже идемпотентны в DOM. `style.display` обёрнут только там где writes в hot loop; для модалок (open/close events) — не нужно.
- **Не покрывает**: `_hud.updateText` (HudAdapter path) — у него внутри своя логика; не дублировать.

## Известные follow-up perf-deep (не сделано в batch #4)

- **Chip effect spatial dedup**: user feedback (Step 3.55 freetext) — когда player вставил по 3 чипа в каждую ячейку, spawn-ятся chip effects плотно друг в друге (разница 5-7px). Оба render-ятся, но визуально неотличимы. Предложение: при spawn нового chip effect проверить, есть ли уже активный того же type в радиусе ε (≈12-16px) и тогда либо skip spawn, либо merge в один с увеличенным intensity. Требует осторожной балансировки — нельзя ломать damage / fx output (только visual + cpu cost render).
- **Tank↔zombie spatial hash**: те же grid + query можно переиспользовать в `selectZombieAttackTargetForZombie` / `stepZombies` для tank-targeting. Сейчас итерация по `state.cells` — это малое N (≤16), win незначительный, но если cells вырастет — есть запас.
- **Audio pool reuse**: всё ещё актуально — sfx hit-events на attack wave могут давать spike GC из-за `new Audio()`.
- **localStorage write throttling unification**: разрозненные save-paths могут писать чаще 7s; нужен audit.

## Decor AABB culling (solo-pipeline-yandex-vk#2 / 2026-04-28)

- **Где**: `drawDecorZombieLayer` (`game.js`, тот же блок где живёт zombie cull).
- **Контракт**: декоры чьи `(d.x, d.y)` лежат вне `[viewport ± 96px]` не push-ятся в `items[]` и не доходят до `drawDecorSpriteAt`. Margin = тот же `_camCullMargin = 96`, что у зомби — общий hard invariant `>= 96px`.
- **Стабильность сортировки**: `d.renderOrder` присваивается **до** cull-skip. Это удерживает depth-sort стабильным при возврате декора в кадр (иначе при scroll обратно order сместился бы и слои прыгали бы).
- **Зачем сейчас**: postmortem #5 — текущие декоры почти всегда в кадре, win небольшой; но семантика готова к параллаксу / удалённым постройкам, где AABB cull станет обязательным. Это future-proof guard, а не оптимизация под конкретный сценарий.
- **Не делать**: не уменьшать margin ниже 96px без визуального теста; не пропускать `renderOrder` assignment до skip; не применять cull к HUD/UI слоям.

## Snapshot contract (updated — solo-pipeline-yandex-vk#2 / 2026-04-28)

- **Per-impact local AoE buffer**: внутри `impactAt` массив индексов жертв AOE — это **per-call local** копия (`_aoeCandidates.slice(0, _aoeCount)`), а не reused module-scope buffer. Снимок изолирован от любых re-entrant grid-query из `talentsApi.onHit` / chip onHit callbacks **и** корректен под будущие async/parallelized impactAt-варианты (web worker), где shared module-scope буфер сразу бы поломался.
- **Что НЕ делать**: не возвращать old pattern `const _impactAoeIndices = []` в module scope; не строить full per-impact AoE pool с reuse-инфраструктурой, пока `impactAt` остаётся sync (postmortem item 12 — преждевременная оптимизация без runtime-выгоды). Lightweight slice — каноничный путь.
- **Order preservation**: `queryZombieIndicesInRadius` сортирует ascending; `slice` сохраняет порядок 1:1. Менять sort на bucket-order запрещено (talents side-effects порядок-чувствительны — hard invariant).
