# Система: Render

> Обновлено: 2026-03-06.
> Для больших файлов сначала откройте: `docs/ai/GAME_JS_MAP.md`, `docs/ai/SPRITE_LOADERS_MAP.md`, `docs/ai/PRODUCTION_LINE_RENDER_MAP.md`, `docs/ai/STYLE_CSS_MAP.md`.

## Где править
- Canvas root и layout: `src/render/canvasRoot.js`, `src/render/groundLayer.js`, `src/render/fenceLayout.js`
- Спрайты и JSON-normalization: `src/render/spriteLoaders.js`
- Production line render: `src/render/productionLineRender.js`
- Production line mechanics/state: `src/mechanics/productionLine.js`
- Zombie render runtime: `src/render/zombieRender.js`
- World render orchestration: `game.js`

## Ключевые точки входа
- `draw()` — основной render-orchestrator: [game.js](../../../game.js#L9339-L9398)
- `drawSupercomputerSpriteClip()` / `drawSupercomputerHpBarOverlay()` — root sprite + верхний HP overlay: [game.js](../../../game.js#L9699-L9755)
- `Game.ProductionLine.step()` / `syncSupercomputerBuildTankState()` — progress, storage-full pause и root-state `buildTank`: [src/mechanics/productionLine.js](../../../src/mechanics/productionLine.js#L97-L154)
- `Game.ProductionLineRender.updateLayout()` / `.syncState()` / `.draw()` — runtime conveyor/storage/box: [src/render/productionLineRender.js](../../../src/render/productionLineRender.js#L230-L311), [src/render/productionLineRender.js](../../../src/render/productionLineRender.js#L517-L524)
- `SupercomputerSprites.load()` — loader root/parts/effects: [src/render/spriteLoaders.js](../../../src/render/spriteLoaders.js#L853-L1030)

## Инварианты render-пайплайна ⚠️
- `draw()` только рисует; состояние меняется вне render-step.
- Конвейер `work` запускается не из `draw()`, а из kill-hook: [game.js](../../../game.js#L5908-L5913).
- Повторный kill не должен перезапускать conveyor, пока текущий `work`-цикл не закончился: [src/render/productionLineRender.js](../../../src/render/productionLineRender.js#L219-L227), [src/render/productionLineRender.js](../../../src/render/productionLineRender.js#L301-L306).
- Root-анимация `buildTank` активируется только механикой production line, пока есть room в storage и `0 < progress < 1`: [src/mechanics/productionLine.js](../../../src/mechanics/productionLine.js#L97-L154).
- Печать коробки идёт снизу вверх через reveal-clip и переключение `printLow` / `printHigh`: [src/render/productionLineRender.js](../../../src/render/productionLineRender.js#L329-L444), [assets/supercomputer.json](../../../assets/supercomputer.json#L154-L208).
- Fence HP bars остаются над зомби/трупами, а HP bar суперкомпьютера — финальным world overlay: [game.js](../../../game.js#L9339-L9398), [game.js](../../../game.js#L9750-L9755).

## Supercomputer / production line
- `SupercomputerSprites` нормализует root sprite и части `conveyor` / `conveyorBox` / `storageCell`, включая отдельный atlas `conveyor_box_atlas.png`: [src/render/spriteLoaders.js](../../../src/render/spriteLoaders.js#L118-L145), [src/render/spriteLoaders.js](../../../src/render/spriteLoaders.js#L853-L1030).
- `initBoard()` рассчитывает world-геометрию суперкомпьютера и сразу прокидывает её в production line layout: [game.js](../../../game.js#L2244-L2334).
- `effects[]` из `assets/supercomputer.json` применяются во время draw как трансформации root sprite и частей (float/sway/vibration/pulse и т. п.): [game.js](../../../game.js#L9699-L9724), [src/render/productionLineRender.js](../../../src/render/productionLineRender.js#L146-L375), [assets/supercomputer.json](../../../assets/supercomputer.json#L20-L237).
- `Game.ProductionLineRender.draw()` рисуется сразу после `drawSupercomputer()`, но до `drawBoard()`: [game.js](../../../game.js#L9339-L9354).
- Для большого render-модуля production line сначала открывайте [docs/ai/PRODUCTION_LINE_RENDER_MAP.md](../PRODUCTION_LINE_RENDER_MAP.md).

## Спрайты зомби: deathCommon
- `ZombieSprites.deathCommon` — массив вариантов общей анимации смерти: [src/render/spriteLoaders.js](../../../src/render/spriteLoaders.js#L179-L259).
- В `assets/zombies.json` разрешены legacy-object и array; loader приводит к массиву.

## Fallback-контракт
- Если atlas или part-config недоступен, рендер остаётся на legacy geometry и vector fallback без падения runtime: [src/render/productionLineRender.js](../../../src/render/productionLineRender.js#L377-L515).
