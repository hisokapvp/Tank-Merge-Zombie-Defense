# Индекс документации для агента

## Порядок чтения
1. `docs/ai/STYLE.md`
2. `docs/ai/PROJECT_MAP.md`
3. `docs/ai/ARCHITECTURE.md`
4. Целевой файл из `docs/ai/SYSTEMS/*.md`
5. Если целевой файл большой — соответствующий `docs/ai/*_MAP.md`
6. Для типовой задачи — нужный `docs/ai/PLAYBOOKS/*.md`

## Главные карты
- `docs/ai/PROJECT_MAP.md` — главная карта проекта и инварианты.
- `docs/ai/GAME_JS_MAP.md` — актуальная карта монолита `game.js` [HOT].
- `docs/ai/STYLE_CSS_MAP.md` — карта CSS-монолита `style.css` [HOT].
- `docs/ai/HANGAR_CHIPS_UI_MAP.md` — большой UI-runtime ангара [HOT].
- `docs/ai/SUPERCOMPUTER_MENU_MAP.md` — root/tank-wall/hangar overlays суперкомпьютера [HOT].
- `docs/ai/SPRITE_LOADERS_MAP.md` — normalizer'ы и sprite-loader contracts [HOT].
- `docs/ai/PRODUCTION_LINE_RENDER_MAP.md` — atlas-driven conveyor/storage/box render рядом с суперкомпьютером.
- `docs/ai/CHIP_EFFECTS_MAP.md` — боевой runtime чип-модификаторов.
- `docs/ai/TALENTS_V2_MAP.md` — монолит talents v2.

## Карта систем
- UI: `docs/ai/SYSTEMS/ui.md`
- Render/Canvas: `docs/ai/SYSTEMS/render.md`
- Assets/JSON: `docs/ai/SYSTEMS/assets.md`
- Combat: `docs/ai/SYSTEMS/combat.md`
- Save/Offline: `docs/ai/SYSTEMS/save.md`
- Achievements: `docs/ai/SYSTEMS/achievements.md`
- World Events: `docs/ai/SYSTEMS/worldEvents.md`
- Fence: `docs/ai/SYSTEMS/fence.md`
- Audio: `docs/ai/SYSTEMS/audio.md`
- Telemetry/Flags: `docs/ai/SYSTEMS/telemetry.md`
- Input: `docs/ai/SYSTEMS/input.md`
- Performance: `docs/ai/SYSTEMS/perf.md`
- Talents v2 runtime: `docs/talents_v2.md`
- Talents v2 UI: `docs/ui_talents_v2.md`

## Фокус документации на 2026-03-07
- `index.html` подключает `src/ui/fontFloor.js`: `Game.FontFloor` глобально поднимает floor `12px` для DOM/canvas-текста и разрешает opt-out только через skip-список / `data-font-floor-ignore="true"`.
- `New game` поднимает `productionLine.firstNewGameBoxGuaranteedPending`; первая коробка конвейера гарантированно резолвится в `one_big_chip`, пока флаг не будет погашен через `openBox()`.
- Модалка ускорения технологий использует `_getTechAccelRates()`: для 2ч технологий `dust/chip/fragment = 2/20/6`, для 5ч — `1/10/1`; кремниевая пыль встроена в тот же accel-grid и делит общий cap `95%`.
- `techAccelChip--disabled` и summary line показывают остаток бюджета / badge `Лимит`; fallback i18n для accel UI синхронизирован между `ru.json`, `en.json`, `fallbackStrings.js`.
- Close-кнопки `productionLineStorage` / supercomputer root / hangar / tank-wall / talent tree унифицированы через 44×44 `scModal__close`; для `talentOverlay` класс навешивается runtime из `applySharedTalentModalClass()`.
- `_renderChipNameHtml()` остаётся каноническим helper'ом для полных названий чипов/фрагментов: перенос разрешён только по ` + `; им пользуются workshop grid, tech accel modal, craft inventory и result cards.
- Для этих правок читать в порядке: `docs/ai/SYSTEMS/save.md` → `docs/ai/SYSTEMS/render.md` → `docs/ai/SYSTEMS/ui.md` → `docs/ai/HANGAR_CHIPS_UI_MAP.md` → `docs/ai/SUPERCOMPUTER_MENU_MAP.md` → `docs/ai/STYLE_CSS_MAP.md`.

## Hotspot summary
- Кодовые hotspot-файлы: `game.js`, `index.html`, `style.css`, `src/ui/supercomputerMenu.js`, `src/ui/hangarChipsUI.js`, `src/render/spriteLoaders.js`, `src/persistence/storage.js`.
- Документационные hotspot-файлы: `docs/ai/INDEX.md`, `docs/ai/SYSTEMS/ui.md`, `docs/ai/SYSTEMS/render.md`, `docs/ai/SYSTEMS/assets.md`, `docs/ai/CHANGELOG.md`.
