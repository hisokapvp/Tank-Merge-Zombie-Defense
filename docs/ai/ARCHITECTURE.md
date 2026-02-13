# ARCHITECTURE — слои и потоки

## Purpose

Показать, как проходит сигнал от DOM/canvas до логики, рендера, сохранения и телеметрии.

## Слои

1. **Presentation**
   - `index.html`, `style.css`
   - DOM-кнопки, модалки, canvas, layout

2. **Orchestration/Core**
   - `game.js`
   - `boot()` делегирует инициализацию в `src/core/bootstrap.js`
   - `loop(now)` обновляет состояние и рисует кадр

3. **Domain systems (`src/*`)**
   - mechanics: бой, экономика, гараж, targeting
   - audio: управление громкостью, SFX playback/pooling
   - i18n: runtime перевод + fallback-словарь
   - persistence: save/load/offline
   - ui: модалки/панели
   - render/perf/telemetry/analytics/i18n/flags

4. **Content/config**
   - `assets/*.json` + sprite atlas

5. **Verification/ops**
   - `Test/*`, `ci/*.sh`, `ops/*`

## Главные потоки

### A) Startup

`index.html` → загрузка `src/*` → загрузка `game.js` → `boot()`

В `boot()`:
- i18n и язык
- load save (`Game.Storage`)
- init flags/experiments/funnel/mobile/admin/debug
- bind UI events
- загрузка спрайтов (`ZombieSprites`, `TankSprites`, fence/decor)
- `requestAnimationFrame(loop)`

### B) Frame loop

`loop(now)`:
- fps cap/mobile quality
- периодический autosave
- update gauges/telemetry
- simulation steps (`stepZombies`, `stepTanks`, `stepProjectiles`, ...)
- `updateUI()`
- `draw()`
- следующий `requestAnimationFrame(loop)`

### C) Input flow

Canvas pointer events:
- `pointerdown`: выбор ячейки/танка, crate/offline modal hit-test
- `pointermove`: drag state
- `pointerup`: drop/merge/onTrack toggle

### D) Save/offline flow

- autosave в loop (каждые ~7s)
- `visibilitychange/pagehide` сохраняют `meta.lastSeenAt`
- return flow: `ContinueFlow` + `OfflineProgress` + `OfflineModal`

## Ownership

- `game.js`: orchestration и жизненный цикл; доменные вычисления постепенно выносятся в `src/*`.
- `src/mechanics/*`: чистые правила и вычисления.
- `src/mechanics/progression.js`: формулы progression (`computePowerTier`, `xpNeededForLevel`, `levelGoldReward`).
- `src/mechanics/combatProfiles.js`: профили снарядов и веса уровней зомби (`projectileProfile`, `zombieLevelWeights`, `pickZombieLevel`).
- `src/mechanics/levelFlow.js`: level-up цикл (`grantXP`, очередь наград, level modal, power-moment события).
- `src/mechanics/zombieSpawn.js`: логика балансного распределения spawn-слотов по сторонам.
- `src/ui/*`: модальные окна, панели, интерактив UI.
- `src/ui/debugPanel.js`: изолированная инициализация debug-panel (`?debug=1`) через DI-параметры.
- `src/ui/modals.js`: централизованное открытие/закрытие основных игровых модалок (boost/reset/crate/dismantle/level/menu).
- `src/ui/mergePopup/mergePopupSeenLevels.js`: хранение и сброс seen-levels merge popup.
- `src/ui/mergePopup/mergePopupStats.js`: расчёт и HTML-рендер строк характеристик merge popup.
- `src/audio/settingsAudio.js`: аудио-настройки, применение громкости и SFX-пул.
- `src/i18n/fallbackStrings.js`: fallback-словарь при недоступном JSON i18n.
- `src/persistence/*`: долговременное состояние и офлайн-модель.
- `src/persistence/initialState.js`: фабрика стартового состояния `createInitialState()`.
- `src/perf/*`: ограничители производительности.
- `src/render/spriteLoaders.js`: загрузка sprite atlas + JSON для zombie/tank/fence/decor и публикация bundle загрузчиков.
- `src/core/bootstrap.js`: startup flow (bind UI events, restore/save/offline hooks, system init, sprite boot, first frame).
- `src/analytics/*`, `src/telemetry/*`: метрики и экспорт.
- `src/utils/eventTelemetry.js`: единая точка отправки UI-событий в `TelemetryLogger` и `AnalyticsCollector`.

## Не редактировать напрямую

- `dist/release/staging/*` — релизный снимок.
- Автогенерируемые release-артефакты из `ops/release/*`.
