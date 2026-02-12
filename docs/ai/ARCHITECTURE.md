# ARCHITECTURE — слои и потоки

## Purpose

Показать, как проходит сигнал от DOM/canvas до логики, рендера, сохранения и телеметрии.

## Слои

1. **Presentation**
   - `index.html`, `style.css`
   - DOM-кнопки, модалки, canvas, layout

2. **Orchestration/Core**
   - `game.js`
   - `boot()` инициализирует системы
   - `loop(now)` обновляет состояние и рисует кадр

3. **Domain systems (`src/*`)**
   - mechanics: бой, экономика, гараж, targeting
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

- `game.js`: orchestration, жизненный цикл, большинство runtime связок.
- `src/mechanics/*`: чистые правила и вычисления.
- `src/ui/*`: модальные окна, панели, интерактив UI.
- `src/persistence/*`: долговременное состояние и офлайн-модель.
- `src/perf/*`: ограничители производительности.
- `src/analytics/*`, `src/telemetry/*`: метрики и экспорт.

## Не редактировать напрямую

- `dist/release/staging/*` — релизный снимок.
- Автогенерируемые release-артефакты из `ops/release/*`.
