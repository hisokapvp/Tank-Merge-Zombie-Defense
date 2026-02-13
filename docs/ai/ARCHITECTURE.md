# ARCHITECTURE — коротко

## Слои

1. Presentation: `index.html`, `style.css`
2. Orchestration: `game.js` (`boot`, `loop`, `draw`)
3. Domain: `src/mechanics`, `src/persistence`, `src/ui`, `src/render`, `src/perf`, `src/telemetry`
4. Content: `assets/*.json` + спрайты
5. Validation/Ops: `Test/*`, `ci/*`, `ops/*`

## Ключевые потоки

- Startup: `index.html` → модули `src/*` → `game.js` → `boot()`
- Frame: `loop()` → sim/updateUI → `draw()` → `requestAnimationFrame`
- Input: pointer `down/move/up` в `game.js` + helpers в `src/render/input.js`
- Save/offline: autosave в loop + `ContinueFlow`/`OfflineProgress`/`OfflineModal`

## Ownership

- Новые правила игры добавлять в `src/mechanics/*`, а не в UI.
- Save/offline логика — только `src/persistence/*`.
- UI-поведение — `src/ui/*`, а тексты — `src/i18n/*`.
- Рендер/загрузчики/геометрия — `src/render/*`.

## Ограничения

- Не редактировать `dist/release/staging/*`.
- При переносе модулей обновлять `docs/ai/INDEX.md` и соответствующий `SYSTEMS/*.md`.
