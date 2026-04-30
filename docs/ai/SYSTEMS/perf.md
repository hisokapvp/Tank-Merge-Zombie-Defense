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

## Канон solo-pipeline-yandex-vk#3 (B2/B3/B4 — 2026-04-30)

Batch 3 of `solo-pipeline-yandex-vk` (items 9, 10, 11) добавил render+stability+CI слой поверх предыдущих perf passes:

### B2 — Render-side micro-optimisations (`game.js`)

- **DPR cap mobileUltraLite (resizeCanvas, ~L2806)**: default cap = `min(devicePixelRatio, 2)`; при `getMobileMode().getFxLevel() >= 2` (mobileUltraLite mode) cap снижается до 1. Wrapped в try/catch — boot ordering safe. Хард-инвариант: НЕ снижать cap ниже 1 и НЕ менять default `2` без явного UX обоснования.
- **Off-screen culling в draw-stages**: `drawDamageNumbers`, `drawParticles` теперь cull-ят entries вне `[viewport ± 32px]` до начала `ctx.fill` / `ctx.fillText`. Margin **32px** канонический (меньше чем zombie-cull 96px — у частиц/чисел нет визуального хвоста). Не уменьшать ниже 32 без визуального теста на edge-spawn.
- **Batched ctx state**: `drawDamageNumbers` и `drawParticles` теперь делают **один** `ctx.save()` на весь pass, кешируют `lastFill` и font/textAlign до цикла, переключают `fillStyle` только при смене цвета. Per-particle `ctx.save/restore` устранены. Хард-инвариант: при добавлении новых per-particle state assignments (rotation, transform, shadowColor) добавлять `ctx.save/restore` ТОЛЬКО для конкретной ветки, не возвращать blanket save/restore вокруг всего цикла.
- **Sprite atlas pre-warm в boot()**: после `GroundSprites.load()` / `ShieldSprites.load()` создаётся off-screen 4×4 canvas и `drawImage(atlas, 0, 0, 1, 1)` для каждого known atlas (`ZombieSprites.atlasImg`, `TankSprites.atlasImg`, `GroundSprites.atlasImg`, плюс `ZombieSprites.getAllAtlasImages()` если экспортирован). Цель — устранить 100-200ms hitch при первом draw нового zombie-type. Wrapped в try/catch — boot-safe.
- **Auto-suspend wiring**: `boot()` вызывает `Game.RuntimeTasks.installAutoSuspend()` если доступен (см. B3).

### B3 — Stability hardening

- **`src/core/runtimeTasks.js` — auto-suspend RAF/timers**: новая функция `installAutoSuspend()` (idempotent) вешает **только `document.visibilitychange`** → `suspendAll()` / `resumeAll()`. `window.blur` / `window.focus` намеренно НЕ используются: на Windows `blur` срабатывает на transient OS focus shifts (resize handle drag, taskbar peek, IME picker), что приводило к ложным паузам игры. Canonical signal — `document.hidden` / `visibilitychange`. `suspendAll()` дополнительно отменяет in-flight rafIds через `rafIds Map` + replay через `pendingRafCallbacks` на resume. Экспонировано как `Game.RuntimeTasks.installAutoSuspend()` и `Game.RuntimeTasks.isSuspended()`. Не вызывать установщик повторно — функция сама проверяет idempotency. Хард-инвариант: НЕ возвращать `window.blur` listener без явного user-confirmed обоснования.
- **`src/core/worldReset.js` — pool cleanup в reset path**: после `opts.resetWorldRuntime()` обнуляется `length` у `state.particles`, `decals`, `impacts`, `damageNumbers`, `projectiles` — gc-friendly partial reset, не ломает talents/upgrades/drones (они вне state). Wrapped в try/catch — additive, никогда не throws в reset.
- **`tools/saveSchemaValidator.js` — fail-soft schema load**: `loadSchemaSync()` теперь возвращает `null` + `console.warn` при I/O / parse error (вместо throw). Новая функция `safeValidate(payload, schema)`: если schema null → возвращает `{valid: true, errors: []}` (fail-open для CI без блокировки). `main()` exit-code 3 если schema unavailable. Хард-инвариант: НЕ менять CI exit-code из 3 — pipelines уже его ожидают.
- **`game.js` qualityLow hysteresis (loop)**: вместо single-line `state.qualityLow = fpsAvg < 45 || fxLevel >= 1` теперь:
  - Drop trigger: `fpsAvg < 45` ИЛИ `fxLevel >= 1` (instant — нельзя пропустить деградацию).
  - Recover trigger: `fpsAvg >= 55` И `fxLevel < 1` И накопленный `qualityLowRecoveryAccum >= 5s` непрерывно.
  - Константы: `QUALITY_LOW_DROP_FPS=45`, `QUALITY_LOW_RECOVER_FPS=55`, `QUALITY_LOW_RECOVER_HOLD_SEC=5`. Hysteresis-окно **10 fps** между drop и recover — обязательное (`>= 8`), иначе будут визуальные мерцания между low/high quality на пограничных fps.
- **`game.js` saveProgress try/catch (loop)**: вызов `saveProgress()` в game-over hook теперь обёрнут в try/catch с throttled (≥30s) Toast-предупреждением + `console.warn`. `lastSaveErrorAt` хранится в module scope. Не уменьшать throttle ниже 30s.

### B4 — Tests + CI

- **`Test/pack10/fxDensityRender.test.js` (новый pack)**: parametrized `[0, 25, 50, 100]` density values + off-screen cull contract probes. Если `src/perf/fxDensity.js` не загружен (batch 1 ещё не merged) — соответствующие assertions помечаются `skip` и pack всё равно зелёный. Pure-Node, no DOM.
- **`Test/pack8/fxDensityGameplayParity.test.js` (новый)** — gates parity: при `density=0` gameplay-критичные spawn-paths остаются работоспособными (см. whitelist ниже).
- **`Test/pack8/runtimeTasksAutoSuspend.test.js` (новый)** — installAutoSuspend idempotency + regression `blur/focus do NOT suspend` (закрепляет «visibilitychange ONLY» контракт B3).
- **`Test/pack5/perf_regression.test.js` — P5-DRAW-1..3**: per-stage budget tests с mock ctx. Бюджеты: drawParticles ≤8ms (1500 частиц), drawDamageNumbers ≤4ms (200 чисел), сумма ≤16ms (frame budget @ 60fps).
- **`ci/run_tests.sh`**: добавлена строка `run_test "Pack 10 (FX density render parity)" "Test/pack10/fxDensityRender.test.js"` сразу после Pack 9.
- **`ci/release_checklist.sh`**: добавлен manual smoke item — FX density slider 0/50/100% с проверкой weather + парности под `?usePhaser=1`.

### Что НЕ делать в этом контуре

- НЕ возвращать `ctx.save/restore` вокруг каждой частицы / damage number — экономия per-call существенная.
- НЕ снижать cull margin ниже 32px в particle/damage-number без визуального теста под high-FX storm wave.
- НЕ убирать try/catch в `installAutoSuspend` / pre-warm / saveProgress / pool cleanup — все эти пути must-be-additive и не должны throw в boot/loop/reset.
- НЕ заменять fail-soft schema validator на throwing version — CI получит false-positive failures если `assets/saveSchema.json` временно отсутствует.
- НЕ возвращать `window.blur` / `window.focus` в `installAutoSuspend()` — Windows resize handle, taskbar peek и IME picker отдают ложные blur events; canonical signal = `document.visibilitychange` only.

## FX density user setting (batch 1+2 / item A1+A3 — 2026-04-30)

- **Owner module**: `src/perf/fxDensity.js` экспонирует `Game.FxDensity` (cached scalar reads, hot-path no-alloc) и `Game.Settings.{getFxDensity,getFxDensityRaw,setFxDensity,isFxDensityInitialized}` facade. Persistence piggy-back'ится на существующий `localStorage['settings']` blob (audio + autoPause), shallow-merge сохраняет чужие поля.
- **Public API**: `getDensity() -> 0..1`, `getRaw() -> 0..100`, `shouldSpawn(weight=1) -> bool` (Xorshift32, no allocation), `shouldSpawnFor(zombieKey, weight) -> bool` (per-zombie deterministic gate для quantity-scaled debuff icons), `scaleCount(n)`, `scaleCap(n, floor)`. На init модуль сначала ставит **noop-safe shim** (100% density, всё `true`) — если основной IIFE падает, call sites не получат `undefined.shouldSpawn()` и игра не зависнет.
- **First-run default**: `loadSettings()` в `game.js` (~L1493–L1510) при `fxDensityInitialized !== true` берёт mobile=60, desktop=100 через `Game.MobileMode`, потом фиксирует `fxDensityInitialized=true`.
- **UI**: слайдер живёт в `index.html` `#bigMenuSoundPanel` и smallMenu row; wiring — `src/ui/bigMenuRuntime.js` + `src/core/bootstrap.js` (smallMenu); i18n keys `bigMenuFxDensity`, `bigMenuFxDensityHint`, `bigMenuFxDensityWeatherNote` синхронизированы между `ru.json`, `en.json`, `fallbackStrings.js`.
- **Gates (canonical hot-path callers)**:
  - `src/render/zombieRender.js`, `src/render/cornerTowers.js`, `src/render/tankHangarAnimation.js` — visual decorative effects.
  - `src/ui/supercomputerBuildTankFx.js` — buildTank ambient particles.
  - `src/mechanics/chipEffects.js` — `codeVisualEnabled` gating через FxDensity для lingering mods 10..14.
  - `game.js` — `drawParticles`, `drawDamageNumbers`, `drawImpacts`, `drawTankAura`, `drawScaledZombieDebuffOverlays`, `drawTankTrack`, `drawDecals` cull/skip per FxDensity.
- **Gameplay-critical whitelist** (всегда spawn'ятся, даже при `density=0`): `popText` UI hints, tutorial bubbles, projectiles, drones, fence HP bars, Aura1/Aura2/Aura3 sprite-варианты. Этот whitelist — gameplay parity invariant; нарушение ломает feedback loops и tutorial. Тест-гарантия: `Test/pack8/fxDensityGameplayParity.test.js`.
- **Quantity-scaled debuff icons**: `drawScaledZombieDebuffOverlays()` в `game.js` использует `FxDensity.shouldSpawnFor(zombieId, ...)` per-zombie deterministic gate, чтобы при density 50% примерно половина зомби показывали debuff overlays (а не половина каждого зомби — это бы flicker'ило). Per-zombie key обязателен — НЕ переходить на global `shouldSpawn()` для debuff overlays.
- **Phaser parity**: helper readers render-engine agnostic; обе ветки (legacy Canvas draw* + Phaser scenes) подписаны через `Game.RenderRegistry` shared-check hook → значение всегда в lockstep.

## Render-side micro-optimisations (batch 3 / item B2 — 2026-04-30)

Дополнительно к FX density gates batch 3 закрепил следующий канон в `game.js`:

- **DPR cap mobileUltraLite** (`resizeCanvas`, ~L2806): default cap = `min(devicePixelRatio, 2)`, при `getMobileMode().getFxLevel() >= 2` cap снижается до 1. Wrapped в try/catch — boot ordering safe.
- **Sprite atlas pre-warm в `boot()`** (~L11714+ после `GroundSprites.load()` / `ShieldSprites.load()`): off-screen 4×4 canvas + `drawImage(atlas, 0, 0, 1, 1)` для `ZombieSprites.atlasImg`, `TankSprites.atlasImg`, `GroundSprites.atlasImg`, `ZombieSprites.getAllAtlasImages()`. Цель — устранить 100–200ms hitch при первом draw нового zombie-type.
- **`qualityLow` hysteresis в `loop()`** (~L11460+): drop @ `fpsAvg < 45 || fxLevel >= 1` (instant), recover требует `fpsAvg >= 55 && fxLevel < 1` непрерывно ≥ `5s`. Hysteresis-окно 10 fps между drop/recover обязательно (`>= 8`), иначе мерцание low/high quality.
- **`saveProgress()` try/catch + 30s toast**: вызов в game-over hook обёрнут try/catch с throttled (≥30s) Toast + `console.warn`. `lastSaveErrorAt` — module scope. НЕ снижать throttle ниже 30s.
- **Pool length=0 cleanup в `src/core/worldReset.js`**: после `opts.resetWorldRuntime()` обнуляются `length` у `state.particles`, `decals`, `impacts`, `damageNumbers`, `projectiles`. Wrapped в try/catch — additive.
- **`tools/saveSchemaValidator.js` fail-soft**: `loadSchemaSync()` возвращает `null` + `console.warn` при I/O / parse error; `safeValidate(payload, schema)` при null schema → `{valid:true, errors:[]}` (fail-open для CI). `main()` exit-code 3 если schema unavailable. Хард-инвариант: НЕ менять exit-code 3.

## Snapshot contract (updated — solo-pipeline-yandex-vk#2 / 2026-04-28)

- **Per-impact local AoE buffer**: внутри `impactAt` массив индексов жертв AOE — это **per-call local** копия (`_aoeCandidates.slice(0, _aoeCount)`), а не reused module-scope buffer. Снимок изолирован от любых re-entrant grid-query из `talentsApi.onHit` / chip onHit callbacks **и** корректен под будущие async/parallelized impactAt-варианты (web worker), где shared module-scope буфер сразу бы поломался.
- **Что НЕ делать**: не возвращать old pattern `const _impactAoeIndices = []` в module scope; не строить full per-impact AoE pool с reuse-инфраструктурой, пока `impactAt` остаётся sync (postmortem item 12 — преждевременная оптимизация без runtime-выгоды). Lightweight slice — каноничный путь.
- **Order preservation**: `queryZombieIndicesInRadius` сортирует ascending; `slice` сохраняет порядок 1:1. Менять sort на bucket-order запрещено (talents side-effects порядок-чувствительны — hard invariant).
