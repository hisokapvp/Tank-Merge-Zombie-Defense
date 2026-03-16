# Индекс документации для агента

> Обновлено: 2026-03-09.

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

## Фокус документации на 2026-03-09
- Tutorial runtime выбирает first available incomplete tutorial step: нельзя перескакивать на более поздний доступный шаг, пока ранний незавершённый шаг ещё валиден по цепочке. Для этой темы читать `docs/ai/SYSTEMS/ui.md` и `src/ui/tutorialRuntime.js`.
- `index.html` подключает `src/ui/fontFloor.js`: `Game.FontFloor` глобально поднимает floor `12px` для DOM/canvas-текста, но skip-список обязан исключать все close/remove-варианты (`.levelModal__close`, `.crateModal__close`, `.modalClose`, `.chipCraftSlotRemove`, `.lessonProgress__close`, `[data-font-floor-ignore="true"]`).
- `New game` поднимает `productionLine.firstNewGameBoxGuaranteedPending`; первая коробка конвейера гарантированно резолвится в рабочий red `one_big_chip` уровня 1 с валидным `chipId`, отсортированным `sourceComboKey` и 3 уникальными base `modIds` (`1..9`).
- Модалка ускорения технологий использует `_getTechAccelRates()`: для 2ч технологий `dust/chip/fragment = 2/20/6`, для 5ч — `1/10/1`; кремниевая пыль встроена в тот же accel-grid и делит общий cap `95%`.
- Нижняя строка accel modal показывает кремниевую пыль как `доступно / выбрано`; `+/-` меняют `_techAccelDustSelected`, live-обновляют summary `{pct}/{total}/{left}` и `apply` сжигает тот же планируемый выбор.
- `techAccelChip--disabled` и fallback i18n для accel UI синхронизированы между `ru.json`, `en.json`, `fallbackStrings.js`, чтобы summary/limit/dust-строки не расходились до загрузки JSON.
- Close-кнопки `crate/level/modal/lesson` и SC/talent-варианты используют общий 44×44 pseudo-element X-pattern; `scModal__close` и `#talentOverlay .modalClose` — зелёная ветка того же контракта.
- Для этих правок читать в порядке: `docs/ai/SYSTEMS/save.md` → `docs/ai/SYSTEMS/render.md` → `docs/ai/SYSTEMS/ui.md` → `docs/ai/HANGAR_CHIPS_UI_MAP.md` → `docs/ai/STYLE_CSS_MAP.md`.

## Hotspot summary
- Кодовые hotspot-файлы: `game.js`, `index.html`, `style.css`, `src/ui/supercomputerMenu.js`, `src/ui/hangarChipsUI.js`, `src/render/spriteLoaders.js`, `src/persistence/storage.js`.
- Документационные hotspot-файлы: `docs/ai/INDEX.md`, `docs/ai/SYSTEMS/ui.md`, `docs/ai/SYSTEMS/render.md`, `docs/ai/SYSTEMS/assets.md`, `docs/ai/CHANGELOG.md`.
