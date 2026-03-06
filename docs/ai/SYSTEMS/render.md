# Система: Render

> Обновлено: 2026-03-06.
> Для больших файлов сначала откройте: `docs/ai/GAME_JS_MAP.md`, `docs/ai/SPRITE_LOADERS_MAP.md`, `docs/ai/STYLE_CSS_MAP.md`.

## Где править
- Canvas root и layout: `src/render/canvasRoot.js`, `src/render/groundLayer.js`, `src/render/fenceLayout.js`
- Спрайты и JSON-normalization: `src/render/spriteLoaders.js`
- Production line: `src/render/productionLineRender.js`
- Zombie render runtime: `src/render/zombieRender.js`
- World render orchestration: `game.js`

## Ключевые точки входа
- `draw()` — основной render-orchestrator: [game.js](../../../game.js#L9339-L9398)
- `drawSupercomputerSpriteClip()` / `drawSupercomputerHpBarOverlay()` — root sprite + верхний HP overlay: [game.js](../../../game.js#L9699-L9755)
- `Game.ProductionLineRender.updateLayout()` / `.syncState()` / `.draw()` — runtime conveyor/storage: [src/render/productionLineRender.js](../../../src/render/productionLineRender.js#L138-L199), [src/render/productionLineRender.js](../../../src/render/productionLineRender.js#L385-L402)
- `SupercomputerSprites.load()` — loader root/parts/effects: [src/render/spriteLoaders.js](../../../src/render/spriteLoaders.js#L823-L969)

## Инварианты render-пайплайна ⚠️
- `draw()` только рисует; состояние меняется вне render-step.
- Конвейер `work` запускается не из `draw()`, а из kill-hook: [game.js](../../../game.js#L5908-L5913).
- Повторный kill не должен перезапускать conveyor, пока текущий `work`-цикл не закончился: [src/render/productionLineRender.js](../../../src/render/productionLineRender.js#L127-L136).
- Fence HP bars остаются над зомби/трупами, а HP bar суперкомпьютера — финальным world overlay: [game.js](../../../game.js#L9339-L9398), [game.js](../../../game.js#L9750-L9755).

## Supercomputer / production line
- `SupercomputerSprites` теперь нормализует не только root sprite, но и части `conveyor`/`storageCell`: [src/render/spriteLoaders.js](../../../src/render/spriteLoaders.js#L823-L969).
- `initBoard()` рассчитывает world-геометрию суперкомпьютера и сразу прокидывает её в production line layout: [game.js](../../../game.js#L2244-L2334).
- `effects[]` из `assets/supercomputer.json` применяются во время draw как трансформации root sprite (float/sway/vibration/pulse и т. п.): [game.js](../../../game.js#L9699-L9724), [assets/supercomputer.json](../../../assets/supercomputer.json#L22-L128).
- `Game.ProductionLineRender.draw()` рисуется сразу после `drawSupercomputer()`, но до `drawBoard()`: [game.js](../../../game.js#L9339-L9354).

## Спрайты зомби: deathCommon
- `ZombieSprites.deathCommon` — массив вариантов общей анимации смерти: [src/render/spriteLoaders.js](../../../src/render/spriteLoaders.js#L179-L259).
- В `assets/zombies.json` разрешены legacy-object и array; loader приводит к массиву.

## Fallback-контракт
- Если atlas или part-config недоступен, рендер остаётся на legacy geometry и vector fallback без падения runtime: [src/render/productionLineRender.js](../../../src/render/productionLineRender.js#L215-L383).
