# INDEX — быстрый роутинг для агента

## Стартовая точка

- `index.html` — порядок подключения модулей.
- `game.js` — `boot`, `loop`, `draw` и orchestration.

## Куда идти по задаче

- Рендер/Canvas/FPS → `docs/ai/SYSTEMS/render.md`
- Тюнинг зазоров ангара/трека/забора → `src/config/layoutTuning.js` + `docs/ai/SYSTEMS/render.md`
- Input/drag-drop/hit-test → `docs/ai/SYSTEMS/input.md`
- UI/modals/i18n/a11y → `docs/ai/SYSTEMS/ui.md`
- Баланс боя/спавн/экономика/прогресс → `docs/ai/SYSTEMS/combat.md`
- Zombie AI state machine / target selector → `docs/zombie-ai.md` + `docs/ai/SYSTEMS/combat.md`
- Save/offline/continue flow → `docs/ai/SYSTEMS/save.md`
- Save/offline reward-claim resilience (ad fail-safe) → `docs/ai/SYSTEMS/save.md`
- Ассеты/JSON/спрайты → `docs/ai/SYSTEMS/assets.md`
- Генерация карты (ground stamps + decor placement) → `docs/map-generation.md` + `docs/ai/SYSTEMS/render.md`
- Стыковка corner/side у забора и ручная подстройка `cornerInsetPx` → `docs/fence-layout.md` + `docs/ai/SYSTEMS/render.md`
- Удаление щелей на стыках corner↔side (snap + overlap) → `src/render/fenceLayout.js` + `docs/ai/SYSTEMS/render.md`
- Audio/SFX/pause-resume → `docs/ai/SYSTEMS/audio.md`
- Telemetry/analytics/flags/experiments/funnel → `docs/ai/SYSTEMS/telemetry.md`
- World events/weather/attackMode → `docs/ai/SYSTEMS/worldEvents.md`
- World events (product doc) → `docs/world-events.md`
- Shop bulk-buy UX (product doc) → `docs/ui-shop.md`
- Производительность/mobile/object pool → `docs/ai/SYSTEMS/perf.md`
- Lesson Progress/SRS/Anki/feedback/debug-panels → `docs/ai/SYSTEMS/ui.md`
- Runtime debug overlay (`?debug=1`, hotkeys) → `docs/debug-overlay.md`

## Карта кода

- `src/mechanics/` — игровые правила.
- `src/lessons/`, `src/scheduler/`, `src/tools/anki/` — контур обучения (catalog + SRS + export).
- `src/persistence/` — save/load/offline.
- `src/render/` — canvas и загрузчики.
- `src/render/fenceLayout.js` — геометрия сегментов квадратного забора (scale-aware шаг/инсеты).
- `src/ui/` — UI-модули, модалки, панели.
- `src/feedback/` — in-game feedback widget.
- `src/perf/` — профилирование и лимиты.
- `src/i18n/` — RU/EN строки.
- `assets/` — JSON-конфиги и изображения.
- `Test/` — регрессионные пакеты.

## Куда идти за процедурой

- Типовые изменения: `docs/ai/PLAYBOOKS/*`
- Правила и DoD: `docs/ai/STYLE.md`
- Машинный индекс: `docs/ai/index.yaml`
