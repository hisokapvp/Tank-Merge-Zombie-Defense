# Система: Render

> Обновлено: 2026-03-31.
> Для больших файлов сначала откройте: `docs/ai/GAME_JS_MAP.md`, `docs/ai/SPRITE_LOADERS_MAP.md`, `docs/ai/PRODUCTION_LINE_RENDER_MAP.md`, `docs/ai/STYLE_CSS_MAP.md`.
> Для Phaser layer/render migration: `docs/ai/SYSTEMS/phaser.md`.

## Post-merge update (2026-03-31)
- `drawProjectiles()` теперь clampит source rect (`sx+sw`, `sy+sh`) к atlas bounds (`naturalWidth`, `naturalHeight`); если frame полностью за пределами atlas, rendер fallbackится на circle. Это defensive fix для `assets/bullet.json` frame h `36→34`: [game.js](../../../game.js#L13635-L13670), [assets/bullet.json](../../../assets/bullet.json#L12).
- `resolveTankAuraVisual(cellIndex, level)` по-прежнему использует `getInstalledChipCountForCell(cellIndex)` для подсчёта реально занятых red/yellow слотов, а `drawTankAuraSprite()` теперь даёт variant-specific runtime glow/ring treatment для `aura1/aura2/aura3`; `computeAuraBand()` сохраняется как fallback-path, если named variant недоступен. Это deliberate render contract поверх существующего chip-count routing, а не возврат к level-only visual gate: [game.js](../../../game.js#L13267-L13548).
- `drawTank()` по-прежнему принимает `cellIndex` параметр для aura routing и вызывает sprite path раньше fallback band path: [game.js](../../../game.js#L13533-L13548).
- Zombie unstick mechanism: `stepZombies()` теперь держит per-zombie `_unstickTimer`/`_unstickCheckR`; если зомби не продвинулся ближе к центру на ≥2px за 4 сек, scalar nudge подталкивает его к fence: [game.js](../../../game.js#L7820-L7840).

## Post-merge update (2026-03-30)
- `resolveTankAuraVisual(cellIndex, level)` теперь документируется как реальный visual gate танковой ауры: runtime использует `getInstalledChipCountForCell(cellIndex)` для подсчёта реально занятых red/yellow слотов, активирует `aura1/aura2/aura3` по count `1..3`, а `computeAuraBand()` остаётся только fallback-path, если sprite-вариант не найден. В `src/render/spriteLoaders.js` `auraVariantLevels` продолжает быть asset-lookup mapping на `tank_lvl10/20/30`, а не high-level trigger сам по себе: [game.js](../../../game.js#L13267-L13310), [src/render/spriteLoaders.js](../../../src/render/spriteLoaders.js#L441-L444), [src/render/spriteLoaders.js](../../../src/render/spriteLoaders.js#L591-L610).
- `src/render/fenceLayout.js` вводит responsive seam overlap below `1400px`: `resolveSeamOverlapPx()` на узких viewports двигает первые/последние side-сегменты ближе к углам, чтобы не открывались gap'ы между corner и side slot geometry. Это deliberate render contract, а не локальный test hack; regression закреплён в `Test/pack7/fenceCornerSlots.test.js`: [src/render/fenceLayout.js](../../../src/render/fenceLayout.js#L74-L86), [src/render/fenceLayout.js](../../../src/render/fenceLayout.js#L90-L204), [Test/pack7/fenceCornerSlots.test.js](../../../Test/pack7/fenceCornerSlots.test.js#L144-L197).

## Где править
- Canvas root и layout: `src/render/canvasRoot.js`, `src/render/groundLayer.js`, `src/render/fenceLayout.js`
- Спрайты и JSON-normalization: `src/render/spriteLoaders.js`
- Production line render: `src/render/productionLineRender.js`
- Production line mechanics/state: `src/mechanics/productionLine.js`
- Zombie render runtime: `src/render/zombieRender.js`
- World render orchestration: `game.js`

## Ключевые точки входа
- `draw()` — основной render-orchestrator: [game.js](../../../game.js#L11127-L11200)
- `drawSupercomputerSpriteClip()` / `drawSupercomputerHpBarOverlay()` — root sprite + верхний HP overlay: [game.js](../../../game.js#L9699-L9755)
- `Game.ProductionLine.step()` — kill-driven progress, storage-full pause и одноразовый `guaranteedLootId` для первой коробки после `new_game`: [src/mechanics/productionLine.js](../../../src/mechanics/productionLine.js#L141-L205)
- `Game.ProductionLine.openBox()` — guaranteed `one_big_chip` после `new_game` идёт через `makeGuaranteedNewGameBigChip()` и выдаёт канонический red reward-chip L1; обычные коробки продолжают использовать общий loot/chip pool: [src/mechanics/productionLine.js](../../../src/mechanics/productionLine.js#L105-L122), [src/mechanics/productionLine.js](../../../src/mechanics/productionLine.js#L212-L276)
- `Game.SupercomputerBuildTankFx.start()` / `setSupercomputerWantsBuildTank()` — explicit window root-анимации `buildTank` на время печати танка: [src/ui/supercomputerBuildTankFx.js](../../../src/ui/supercomputerBuildTankFx.js#L41-L53), [game.js](../../../game.js#L3289-L3307), [game.js](../../../game.js#L11374-L11382)
- `Game.ProductionLineRender.updateLayout()` / `.syncState()` / `.draw()` — runtime conveyor/storage/box: [src/render/productionLineRender.js](../../../src/render/productionLineRender.js#L230-L311), [src/render/productionLineRender.js](../../../src/render/productionLineRender.js#L517-L524)
- `SupercomputerSprites.load()` — loader root/parts/effects: [src/render/spriteLoaders.js](../../../src/render/spriteLoaders.js#L853-L1030)

## Инварианты render-пайплайна ⚠️
- `draw()` только рисует; состояние меняется вне render-step.
- Конвейер `work` запускается не из `draw()`, а из kill-hook: [game.js](../../../game.js#L5902-L5917).
- Повторный kill не должен перезапускать conveyor, пока текущий `work`-цикл не закончился: [src/render/productionLineRender.js](../../../src/render/productionLineRender.js#L219-L227), [src/render/productionLineRender.js](../../../src/render/productionLineRender.js#L301-L306).
- Root-анимация `buildTank` не является kill-driven: её включает только покупка танка, а длительность обязана совпадать с `assets/tanks.json -> tankPrintDurationSec`: [assets/tanks.json](../../../assets/tanks.json#L1-L6), [src/render/spriteLoaders.js](../../../src/render/spriteLoaders.js#L381-L393), [game.js](../../../game.js#L2744-L2756), [src/ui/supercomputerBuildTankFx.js](../../../src/ui/supercomputerBuildTankFx.js#L41-L53).
- Печать коробки идёт снизу вверх через reveal-clip и переключение `printLow` / `printHigh`: [src/render/productionLineRender.js](../../../src/render/productionLineRender.js#L329-L444), [assets/supercomputer.json](../../../assets/supercomputer.json#L154-L208).
- Z-order `draw()`: background → tankTrack → fenceBase → **board** → orbitingTanks → supercomputer → productionLine → zombies/corpses → fenceHpBars → talents status icons → projectiles/effects → drones → crate → weather → SC boost icons → SC HP bar overlay: [game.js](../../../game.js#L11127-L11200), [game.js](../../../game.js#L11650-L11655).

## Supercomputer / production line
- `SupercomputerSprites` нормализует root sprite и части `conveyor` / `conveyorBox` / `storageCell`, включая отдельный atlas `conveyor_box_atlas.png`: [src/render/spriteLoaders.js](../../../src/render/spriteLoaders.js#L118-L145), [src/render/spriteLoaders.js](../../../src/render/spriteLoaders.js#L853-L1030).
- `initBoard()` рассчитывает world-геометрию суперкомпьютера и сразу прокидывает её в production line layout: [game.js](../../../game.js#L2244-L2334).
- `conveyorBox.offset.x/y` из `assets/supercomputer.json` напрямую смещает центр коробки поверх belt-plane; это authoring-контракт, а не место для новых хардкодов в renderer: [assets/supercomputer.json](../../../assets/supercomputer.json#L160-L166), [src/render/productionLineRender.js](../../../src/render/productionLineRender.js#L417-L445).
- `tankPrintDurationSec` из `assets/tanks.json` нормализуется loader'ом один раз и переиспользуется и для stamp-reveal в слоте, и для root `buildTank` animation window: [assets/tanks.json](../../../assets/tanks.json#L1-L6), [src/render/spriteLoaders.js](../../../src/render/spriteLoaders.js#L381-L393), [game.js](../../../game.js#L2744-L2756), [src/ui/supercomputerBuildTankFx.js](../../../src/ui/supercomputerBuildTankFx.js#L22-L53).
- `New game` поднимает `productionLine.firstNewGameBoxGuaranteedPending`; первая изготовленная коробка кладётся с `guaranteedLootId='one_big_chip'`, а `openBox()` один раз резолвит эту гарантию в рабочий red чип L1 (`chipId > 0`, `sourceComboKey` = sorted `modIds`, `3` уникальных base `modIds` из `1..9`) и затем возвращается к обычной weight-table: [src/persistence/initialState.js](../../../src/persistence/initialState.js#L123-L130), [src/mechanics/productionLine.js](../../../src/mechanics/productionLine.js#L105-L122), [src/mechanics/productionLine.js](../../../src/mechanics/productionLine.js#L192-L205), [src/mechanics/productionLine.js](../../../src/mechanics/productionLine.js#L212-L276).
- `effects[]` из `assets/supercomputer.json` применяются во время draw как трансформации root sprite и частей (float/sway/vibration/pulse и т. п.): [game.js](../../../game.js#L9699-L9724), [src/render/productionLineRender.js](../../../src/render/productionLineRender.js#L146-L375), [assets/supercomputer.json](../../../assets/supercomputer.json#L20-L237).
- `Game.ProductionLineRender.draw()` рисуется сразу после `drawSupercomputer()`, **после `drawBoard()`** (доска теперь ниже SC/conveyor/storage в z-order): [game.js](../../../game.js#L11127-L11145).
- Для большого render-модуля production line сначала открывайте [docs/ai/PRODUCTION_LINE_RENDER_MAP.md](../PRODUCTION_LINE_RENDER_MAP.md).

## Спрайты зомби: per-zombie atlas + deathCommon scale/shadow
- `assets/zombies.json` authoring contract теперь делит shared `atlas` / `deathCommon` и `atlasesById` per type; loader нормализует каждую запись в `type.atlasPath`, preload'ит atlas map и сохраняет общий fallback atlas, если конкретный PNG не загрузился: [assets/zombies.json](../../../assets/zombies.json#L1-L101), [src/render/spriteLoaders.js](../../../src/render/spriteLoaders.js#L222-L380).
- `ZombieSprites.getAtlasImage(type, preferSharedAtlas)` — canonical bridge между asset config и render path: при `preferSharedAtlas=true` используется общий atlas, иначе возвращается image для `type.atlasPath` с fallback на shared atlas: [src/render/spriteLoaders.js](../../../src/render/spriteLoaders.js#L416-L426).
- `src/render/zombieRender.js` использует shared atlas только для `deathCommon` / `deathUsesCommonAtlas`; `resolveZombieAtlasImage()` и `drawZombieEntity()` передают type-specific image в `drawZombieSprite()` для walk/attack/default render, не ломая corpse fade contract: [src/render/zombieRender.js](../../../src/render/zombieRender.js#L9-L29), [src/render/zombieRender.js](../../../src/render/zombieRender.js#L60-L170).
- `ZombieSprites.deathCommon` по-прежнему принимает legacy-object и array, loader всегда приводит его к массиву и нормализует для каждого варианта positive `scale`; render затем считает `getZombieDeathScale()` как `deathAnim.scale * type.scale`, так что corpse/death frames могут иметь свой size contract без мутации live sprite path: [src/render/spriteLoaders.js](../../../src/render/spriteLoaders.js#L283-L300), [src/render/zombieRender.js](../../../src/render/zombieRender.js#L48-L56), [src/render/zombieRender.js](../../../src/render/zombieRender.js#L123-L131).
- `getZombieShadowScale()` читает `types[].shadowScale` отдельно от body scale и кормит им обе ветки shadow render: atlas sprite path (`ctx.ellipse(...)` перед `drawImage`) и vector fallback path. Это deliberate split между размером зомби и footprint тени: [src/render/zombieRender.js](../../../src/render/zombieRender.js#L58-L60), [src/render/zombieRender.js](../../../src/render/zombieRender.js#L123-L166), [src/render/zombieRender.js](../../../src/render/zombieRender.js#L211-L239).

## Phaser render layer modules
- Все 18 draw-слоёв в `draw()` gated через `Game.RenderRegistry` (mode: legacy/phaser/both)
- 12 Phaser layer modules в `src/phaser/layers/` управляются через `Game.PhaserLayerManager`
- В hybrid mode каждый слой делегирует legacy draw functions через ctx callback
- Подробности: `docs/ai/SYSTEMS/phaser.md`

## Fallback-контракт
- Если atlas или part-config недоступен, рендер остаётся на legacy geometry и vector fallback без падения runtime: [src/render/productionLineRender.js](../../../src/render/productionLineRender.js#L377-L515).
