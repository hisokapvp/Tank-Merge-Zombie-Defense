# INDEX — быстрый роутинг для агента

## Стартовая точка

- `index.html` — порядок подключения модулей.
- `game.js` — `boot`, `loop`, `draw` и orchestration.

## Куда идти по задаче

- Рендер/Canvas/FPS → `docs/ai/SYSTEMS/render.md`
- Тюнинг зазоров ангара/трека/забора → `src/config/layoutTuning.js` + `docs/ai/SYSTEMS/render.md`
- Input/drag-drop/hit-test → `docs/ai/SYSTEMS/input.md`
- UI/modals/i18n/a11y → `docs/ai/SYSTEMS/ui.md`
- Баланс боя/снаряды/targeting → `docs/ai/SYSTEMS/combat.md`
- Save/offline/continue flow → `docs/ai/SYSTEMS/save.md`
- Ассеты/JSON/спрайты → `docs/ai/SYSTEMS/assets.md`
- Telemetry/analytics/flags/experiments → `docs/ai/SYSTEMS/telemetry.md`
- Производительность/mobile/object pool → `docs/ai/SYSTEMS/perf.md`

## Карта кода

- `src/mechanics/` — игровые правила.
- `src/persistence/` — save/load/offline.
- `src/render/` — canvas и загрузчики.
- `src/ui/` — UI-модули, модалки, панели.
- `src/perf/` — профилирование и лимиты.
- `src/i18n/` — RU/EN строки.
- `assets/` — JSON-конфиги и изображения.
- `Test/` — регрессионные пакеты.

## Куда идти за процедурой

- Типовые изменения: `docs/ai/PLAYBOOKS/*`
- Правила и DoD: `docs/ai/STYLE.md`
- Машинный индекс: `docs/ai/index.yaml`
