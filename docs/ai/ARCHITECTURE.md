# Архитектура (кратко)

> Обновлено: 2026-03-06.
> Главная навигация: `docs/ai/PROJECT_MAP.md` → нужный `SYSTEMS/*.md` → `*_MAP.md` для больших файлов.

## Документационные entrypoints
- Главная карта: `docs/ai/PROJECT_MAP.md`
- Монолиты: `docs/ai/GAME_JS_MAP.md`, `docs/ai/STYLE_CSS_MAP.md`
- Большие runtime-файлы: `docs/ai/HANGAR_CHIPS_UI_MAP.md`, `docs/ai/SUPERCOMPUTER_MENU_MAP.md`, `docs/ai/SPRITE_LOADERS_MAP.md`, `docs/ai/CHIP_EFFECTS_MAP.md`, `docs/ai/TALENTS_V2_MAP.md`

## Слои
- Вход: `index.html`, `game.js` (~11.9k строк), `src/core/bootstrap.js`
- Ядро: `src/core/runtimeTasks.js`, `src/core/worldReset.js`
- Домен: `src/mechanics/*`, `src/systems/*`, `src/persistence/*`
- Рендер/ввод: `src/render/*`, `src/ui/*`, `src/audio/*`
- Конфиг: `src/config/*`, `assets/*.json`
- Поддержка: `src/analytics/*`, `src/telemetry/*`, `src/flags/*`, `src/experiments/*`

## Ключевые runtime-швы
- `game.js` связывает `SupercomputerSprites` с `Game.ProductionLineRender`: `setSpriteSource(...)` выполняется в [game.js](../../game.js#L1869-L1875).
- Геометрия production line пересчитывается из позиции/размера суперкомпьютера в [initBoard()](../../game.js#L2244-L2334).
- World render разделён на: root supercomputer (`drawSupercomputer()`), conveyor/storage (`Game.ProductionLineRender.draw(...)`), board/cells и финальный HP overlay суперкомпьютера: [game.js](../../game.js#L9339-L9398), [game.js](../../game.js#L9699-L9794).
- UI суперкомпьютера разделён на root/router (`src/ui/supercomputerMenu.js`), hangar workshop (`src/ui/hangarChipsUI.js`) и CSS-контракт (`style.css`).
- Kill side-effect идёт не через render, а через combat cleanup hook: [game.js](../../game.js#L5908-L5913) → [src/render/productionLineRender.js](../../src/render/productionLineRender.js#L127-L136).

## Извлечённые runtime-блоки из `game.js`
- Audio/SFX pool runtime: `src/audio/sfxPoolRuntime.js` (`Game.SfxPoolRuntime`)
- Weather/attack world events runtime: `src/systems/worldEventsRuntime.js` (`Game.WorldEventsRuntime`)
- Zombie render runtime: `src/render/zombieRender.js` (`Game.ZombieRender`)
- Crate runtime: `src/mechanics/crateRuntime.js` (`Game.CrateRuntime`)
- Big menu runtime: `src/ui/bigMenuRuntime.js` (`Game.BigMenuRuntime`)
- В `game.js` используются `ensure*RuntimeController()` с fallback на встроенную реализацию

## Контракты
- В `src/*` использовать IIFE + `'use strict'` + `global.Game.*`
- Новая логика не должна раздувать `game.js`; монолит сохраняет bootstrap/fallback wiring
- Горячий путь (`loop` / `draw` / `step*`) — без лишних аллокаций; `draw()` только рисует
- JSON-конфиги с runtime-логикой (`assets/supercomputer.json`, `assets/chips.json`, `assets/tanks.json`, `assets/zombies.json`) считаются частью кода и проходят через loader/runtime normalizers
