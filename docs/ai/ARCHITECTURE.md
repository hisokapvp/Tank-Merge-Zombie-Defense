# Архитектура (кратко)

> Обновлено: 2026-03-30.
> Главная навигация: `docs/ai/PROJECT_MAP.md` → нужный `SYSTEMS/*.md` → `*_MAP.md` для больших файлов.

## Документационные entrypoints
- Главная карта: `docs/ai/PROJECT_MAP.md`
- Монолиты: `docs/ai/GAME_JS_MAP.md`, `docs/ai/STYLE_CSS_MAP.md`
- Большие runtime-файлы: `docs/ai/HANGAR_CHIPS_UI_MAP.md`, `docs/ai/SUPERCOMPUTER_MENU_MAP.md`, `docs/ai/SPRITE_LOADERS_MAP.md`, `docs/ai/PRODUCTION_LINE_RENDER_MAP.md`, `docs/ai/CHIP_EFFECTS_MAP.md`, `docs/ai/TALENTS_V2_MAP.md`

## Слои
- Вход: `index.html`, `game.js` (~11.9k строк), `src/core/bootstrap.js`
- Ядро: `src/core/runtimeTasks.js`, `src/core/worldReset.js`
- Домен: `src/mechanics/*`, `src/systems/*`, `src/persistence/*`
- i18n / pluralize: `src/i18n/*` (включая `pluralize.js` — `Game.I18n.pluralize`)
- Рендер/ввод: `src/render/*`, `src/ui/*`, `src/audio/*`
- Конфиг: `src/config/*`, `assets/*.json`
- Поддержка: `src/analytics/*`, `src/telemetry/*`, `src/flags/*`, `src/experiments/*`
- Phaser 3 runtime: `src/phaser/*` (adapters, bridges, layers, scenes, rollout)

## Ключевые runtime-швы
- `game.js` связывает `SupercomputerSprites` с `Game.ProductionLineRender`: `setSpriteSource(...)` выполняется в [game.js](../../game.js#L1869-L1875).
- Геометрия production line пересчитывается из позиции/размера суперкомпьютера в [initBoard()](../../game.js#L2244-L2334).
- `Game.ProductionLine.step()` считает только kill-driven progress/storage коробок, а root-state `buildTank` поднимается отдельным таймером покупки танка: [performTankPurchaseOnce()](../../game.js#L3289-L3307) → [Game.SupercomputerBuildTankFx.start()](../../src/ui/supercomputerBuildTankFx.js#L41-L53) → [setSupercomputerWantsBuildTank()](../../game.js#L11374-L11382); renderer только читает итоговый state.
- World render разделён на: root supercomputer (`drawSupercomputer()`), conveyor/storage (`Game.ProductionLineRender.draw(...)`), board/cells и финальный HP overlay суперкомпьютера: [game.js](../../game.js#L9339-L9398), [game.js](../../game.js#L9699-L9794).
- UI суперкомпьютера разделён на root/router (`src/ui/supercomputerMenu.js`), hangar workshop (`src/ui/hangarChipsUI.js`) и CSS-контракт (`style.css`).
- Kill side-effect идёт не через render, а через combat cleanup hook, но он запускает только conveyor `work`, а не root `buildTank`: [game.js](../../game.js#L5902-L5917) → [src/render/productionLineRender.js](../../src/render/productionLineRender.js#L219-L227).

## Извлечённые runtime-блоки из `game.js`
- Audio/SFX pool runtime: `src/audio/sfxPoolRuntime.js` (`Game.SfxPoolRuntime`)
- Weather/attack world events runtime: `src/systems/worldEventsRuntime.js` (`Game.WorldEventsRuntime`)
- Zombie render runtime: `src/render/zombieRender.js` (`Game.ZombieRender`)
- Crate runtime: `src/mechanics/crateRuntime.js` (`Game.CrateRuntime`)
- Big menu runtime: `src/ui/bigMenuRuntime.js` (`Game.BigMenuRuntime`)
- В `game.js` используются `ensure*RuntimeController()` с fallback на встроенную реализацию

## Phaser 3 миграция
- Полная документация: `docs/ai/SYSTEMS/phaser.md`, master spec: `docs/migration/PHASER_MIGRATION.md`
- Feature flag `usePhaser` (default off), 4-phase rollout: off → shadow → overlay → phaser
- 14 adapters/bridges в `src/phaser/`, 12 layer modules в `src/phaser/layers/`, 16 scenes в `src/phaser/scenes/`
- `Game.RolloutController` — управление прогрессией; `Game.ParityGate` — автоматический gate
- `game.js` wiring в `initEngineAdapterPhase1()` — всё инициализируется между EngineAdapter и PhaserBridge

## Контракты
- В `src/*` использовать IIFE + `'use strict'` + `global.Game.*`
- Новая логика не должна раздувать `game.js`; монолит сохраняет bootstrap/fallback wiring
- Горячий путь (`loop` / `draw` / `step*`) — без лишних аллокаций; `draw()` только рисует
- Master UI scale контракт общий для hybrid seam: `resizeCanvas()` в `game.js` вычисляет `--ui-scale = max(0.4, min(displayW / 1920, displayH / 1080))`, `readMasterUiScale()` читает token обратно, а `syncHybridUiScale()` синхронизирует DOM shells, HUD, tutorial, canvas previews и Phaser overlay adapters. Root CSS token block держит shared narrow-shell widths для `level/sc/storage/talent`, единые header offsets с 50px top clearance и terminal collapse-gap path; `<1200px` override только ужимает terminal shell, снимает button `min-width` и форсирует 10px font contract без отдельного scale-path. Close/help controls сохраняют минимум `44×44`, font floor остаётся `10px`, drag threshold остаётся `6px`: [game.js](../../game.js#L2374-L2430), [style.css](../../style.css#L21-L30), [style.css](../../style.css#L73-L82), [style.css](../../style.css#L8166-L8318), [src/ui/fontFloor.js](../../src/ui/fontFloor.js#L23-L133).
- JSON-конфиги с runtime-логикой (`assets/supercomputer.json`, `assets/chips.json`, `assets/tanks.json`, `assets/zombies.json`) считаются частью кода и проходят через loader/runtime normalizers
