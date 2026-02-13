# INDEX — карта проекта для агента

## Быстрый ответ (куда идти сначала)

- Точка входа: `index.html` → скрипты → `game.js`.
- Инициализация: `game.js` функция `boot()`.
- Главный цикл: `game.js` функция `loop(now)`.
- Рендер кадра: `game.js` функция `draw()` + helpers `draw*`.
- Ввод pointer: `game.js` обработчики `pointerdown/move/up` + `src/render/input.js`.

## Маршруты поиска (INDEX → SYSTEM → FILE)

### render, canvas, fps

1. `docs/ai/SYSTEMS/render.md`
2. `game.js` (`draw`, `loop`, `resizeCanvas`)
3. `src/render/canvasRoot.js`, `src/render/layout/hangarLayout.js`, `src/perf/mobileMode.js`
4. Centerline + road↔fence gap: `game.js` (`getTankOrbitRadius`, `tankOrbitState`, `initBoard`, `drawTankTrack`, `drawZombieFence`)

### input, drag-drop, управление

1. `docs/ai/SYSTEMS/input.md`
2. `game.js` (pointer handlers)
3. `src/render/input.js`, `src/mechanics/trackQuery.js`

### ui, modals, overlays

1. `docs/ai/SYSTEMS/ui.md`
2. `index.html`, `style.css`
3. `src/ui/*`, `src/accessibility/a11y.js`
4. Для offline modal визуальный эталон: settings modal (`menuPanel`/`menuSettings` в `index.html` + `style.css`)
5. Единый button behavior: `src/ui/buttonBehavior.js` + `.uiButtonBehavior` в `style.css`
6. Talent badge: `style.css` (`.talentNode`, `.talentNodeRank`) + `game.js` (`ensureTalentUI`)

### combat, damage, projectiles

1. `docs/ai/SYSTEMS/combat.md`
2. `src/mechanics/combat.js`, `src/mechanics/targeting.js`
3. `game.js` (`stepTanks`, `spawnProjectile`, `stepProjectiles`)

### save, offline, progression restore

1. `docs/ai/SYSTEMS/save.md`
2. `src/persistence/storage.js`, `src/persistence/offlineProgress.js`
3. `src/ui/continueFlow.js`, `src/ui/offlineModal.js`
4. Любой текст offline modal синхронно править в `src/i18n/ru.json` и `src/i18n/en.json`

### assets, sprites, json configs

1. `docs/ai/SYSTEMS/assets.md`
2. `assets/tanks.json`, `assets/zombies.json`, `assets/fence.json`, `assets/decor.json`
3. `game.js` (`TankSprites.load`, `ZombieSprites.load`, `FenceSprites.load`, `DecorSprites.load`)

### telemetry, analytics, flags/experiments

1. `docs/ai/SYSTEMS/telemetry.md`
2. `src/utils/telemetry.js`, `src/telemetry/telemetry.js`
3. `src/analytics/*`, `src/flags/flags.js`, `src/experiments/experiments.js`

### perf, object pooling, mobile limits

1. `docs/ai/SYSTEMS/perf.md`
2. `src/perf/mobileMode.js`, `src/perf/objectPool.js`, `src/perf/profiler.js`
3. `Test/pack4/perf_stress.test.js`, `Test/pack5/perf_regression.test.js`

## Карта папок (боевой код)

- `game.js` — core loop + orchestration + часть UI/render/input.
- `src/mechanics/` — доменная логика боя/экономики/гаража/targeting.
- `src/persistence/` — save/load + offline reward модель.
- `src/render/` — утилиты canvas/input/portrait.
- `src/ui/` — модалки, панели, debug/admin UI.
- `src/perf/` — mobile mode, profiler, object pool.
- `src/analytics/`, `src/telemetry/`, `src/utils/telemetry.js` — метрики и экспорт.
- `src/i18n/` — локализация RU/EN.
- `assets/` — конфиги и спрайты.
- `Test/` — пакеты регресса.

## Теги

- `render` `input` `ui` `assets` `combat` `save` `offline` `telemetry` `analytics` `flags` `experiments` `perf` `i18n` `a11y` `tests`
