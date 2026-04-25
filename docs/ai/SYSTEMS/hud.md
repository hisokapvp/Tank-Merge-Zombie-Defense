# Система: HUD render

> Обновлено: 2026-04-24.

## Где править
- Канонический рендер HUD: `game.js` (`draw()`, `renderFenceHpBars`, talents `renderStatusIcons` call site, `drawScaledZombieDebuffOverlays`).
- Scratch-pool модуль: [src/render/hudScratch.js](../../../src/render/hudScratch.js).
- Phaser overlay parity: [src/render/phaserOverlayBridge.js](../../../src/render/phaserOverlayBridge.js) (если включён `usePhaser`).

## Базовые правила
- `draw()` только рисует. Никакой mutation `state.*`, чипов, talents-стора, productionLine и achievements внутри render-веток. Любой step/update идёт в `step*()` / `tick*()` ветках.
- Порядок рендера сохраняется: `fenceBase → zombies/corpses → fenceHpBars → projectiles/effects → UI/HUD overlays`. Не переставлять без обновления этой страницы и `docs/ai/ARCHITECTURE.md`.
- Hot-path функции (`loop`, `draw`, `step*`, `renderFenceHpBars`, `talentsApi.renderStatusIcons`, `drawScaledZombieDebuffOverlays`) обязаны избегать heap-аллокаций (no `[]`, no `{}`, no `.map`/`.filter` создающих временные массивы, no closures возвращающих новые объекты per frame). Используйте scratch-pool либо module-level cached буферы.

## HUD scratch pool (`__hudScratch`)

Канонический контракт временных HUD-объектов на кадр.

### Лежит в
- Модуль: [src/render/hudScratch.js](../../../src/render/hudScratch.js) — экспортирует `Game.HudScratch.create({ capacityPerOwner })`.
- Хранилище инстанса: `ctx.__hudScratch` (lazy init в `draw()` через `Game.HudScratch.create({ capacityPerOwner: 128 })`).

### API

- `beginFrame()` — вызывается ровно один раз в начале `draw()` после `clearRect`. Поднимает frame epoch, сбрасывает per-frame metrics. Без него `acquire()` валиден, но повторное чтение между кадрами может вернуть данные предыдущего кадра.
- `acquire(ownerTag, subSlot, shape)` — возвращает persistent slot-объект для пары `(ownerTag, subSlot)`. `shape` либо `null` (пустой объект для произвольной mutation), либо канонический литерал-prototype для shape-stability check (dev-warn при drift). Slot живёт между кадрами; writer обязан перезаписать **все** свои поля каждый кадр.
- `getMetrics()` — возвращает `{ acquireCount, overflow, byOwner: { [tag]: count } }` для текущего кадра. Используется test-writer и FailDetector verification.
- `onDevicePixelRatioChanged()` — invalidate scaled cache. Должен вызываться из единственного DPR-listener (см. `src/core/runtimeTasks.js`).
- `OWNER_TAGS` — exported tuple `['healthBar', 'debuffIcon', 'fenceHp', 'drone', 'misc']`. Расширение списка требует обновления этой страницы.

### Контракт читателя

- HUD reader (talents `renderStatusIcons`, Phaser overlay bridge) обязан читать слот **дважды**: один раз для legacy Canvas, один раз — для Phaser overlay. Между чтениями slot не должен мутироваться. Это даёт parity между двумя render-выходами.
- Reader не имеет права хранить ссылку на slot между кадрами — slot принадлежит pool, не reader-у. Хранить можно только скаляры (после копии).

### Контракт writer-а

- Per-frame writer обязан заполнить **все** объявленные shape-поля (zero-init не подразумевается).
- Для `healthBar` writer обязан clamp'ать значения HP к `>= 0` до записи; pool делает это второй защитной линией, но это writer responsibility.
- `acquire()` дважды для одной и той же `(ownerTag, subSlot)` пары в одном кадре возвращает один и тот же slot — это by design (idempotent). Не создавать обёрток, ломающих эту инвариантную проверку.

### Capacity и overflow

- Дефолтный budget: `capacityPerOwner = 128`. Превышение не падает: pool логирует через `Game.Diagnostics.reportHudScratchOverflow(ownerTag, count)` (если present), иначе один раз `console.warn` за runtime.
- Если бюджет недостаточен (например, для `debuffIcon` при массовой волне), повышается `capacityPerOwner` целиком; per-tag overrides не вводятся, чтобы не плодить асимметрию.

### DPR invalidation

- Pool хранит производные значения (например, scaled rect dimensions) только если writer положил их в slot. На DPR change `onDevicePixelRatioChanged()` поднимает internal generation, и следующий `beginFrame()` помечает все slots как stale (writer обязан перезаписать).

### Что нельзя

- Использовать scratch slot для мутаций game state (talents, чипов, productionLine, achievements). Если меняется state — это уже не HUD render, а step.
- Передавать slot за границы `draw()` через замыкания / event payload. Эмиттер `Game.Events` обязан копировать данные, если они нужны вне кадра.
- Обходить `beginFrame()` через прямое чтение `ctx.__hudScratch.<internal>`: API — это `acquire`/`getMetrics`/`OWNER_TAGS`/`onDevicePixelRatioChanged`/`beginFrame`. Внутренние поля приватны.

## Текущие call-sites

- `draw()` в [game.js](../../../game.js) — lazy init `ctx.__hudScratch` + `beginFrame()` после `ctx.clearRect`.
- `renderFenceHpBars(ctx)` в [game.js](../../../game.js) — per-segment `acquire('fenceHp', seg.id || index, null)` для rect mutation; primitive `fillRect` path преcerved.
- Talent status icons (`talentsApi.renderStatusIcons`) и `drawScaledZombieDebuffOverlays` — owner tag `debuffIcon` зарезервирован; per-frame `tanksOnTrack` array остаётся локальным module-level cached буфером (см. P2.5 disjoint sub-slice / P2.6 no mixed layout): scratch pool API возвращает object slots, а не arrays, поэтому для коллекций `tank.onTrack` рекомендуется отдельный module-level `_tanksOnTrackBuffer.length = 0` reuse-pattern; миграция этого site под scratch pool требует расширения API `acquireArray()` и не является частью текущего контракта.

## Phaser parity

- При `usePhaser = true` HUD overlays идут через Phaser scene; scratch pool инстанцируется отдельно для Phaser-side ctx, но контракт идентичен.
- `RolloutController` гарантирует, что только один runtime активен на кадр; double-write в обе системы невозможен.

## Как воспроизвести и проверить

1. Открыть игру с открытой DevTools, поставить breakpoint в `Game.HudScratch.create` — убедиться, что вызывается ровно один раз на canvas.
2. Включить `Game.Diagnostics.reportHudScratchOverflow = (tag, n) => console.log('overflow', tag, n)` и провоцировать массовую волну зомби с debuff icons — проверить, что overflow либо отсутствует, либо логируется без crash.
3. Изменить DPR (zoom браузера) — убедиться, что health bars и fence HP bars не "залипают" на старом scale: следующий кадр должен перерисовать их.
4. Профилировать `draw()` через Performance tab — heap-allocations-per-frame по HUD-ветке должны стремиться к нулю (только scratch slot reuse).
