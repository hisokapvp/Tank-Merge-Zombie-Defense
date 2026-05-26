# Система: Render

> Обновлено: 2026-05-22.

## Post-merge update (2026-05-22, batch solo-pipeline-yandex-vk#1)
- Тряска экрана теперь привязана к порогам HP, без слепых триггеров:
	- **Fence**: `Game.ScreenEffects.triggerFenceThresholdShake(seg, prevRatio, curRatio)` срабатывает только при down-crossing 50% → 25% → 10% → 0% HP сегмента. Несколько сегментов на одном кадре сливаются per-frame coalescer-ом (`flushFenceThresholdShakeFrame()`). Конфиг — `screenShake` в [assets/fence.json](../../../assets/fence.json) (enabled, thresholds[at,amplitude,duration]). Reset на репаре через `resetSegmentPrevRatio(seg)`.
	- **Supercomputer**: `Game.ScreenEffects.triggerSupercomputerThresholdShake(prevRatio, curRatio)` срабатывает при пересечении любого порога каждые 5% потерянного HP (0.95, 0.90, ..., 0.05). Амплитуда/длительность растут от 5.5 px/0.22 с до 9.0 px/0.36 с по мере падения HP — тряска заметно ощутимее fence-тряски. Вызывается из `applySupercomputerDamage()` в [game.js](../../../game.js) c реальными prevRatio/curRatio до и после применения урона.
	- **Critical state**: `Game.ScreenEffects.triggerCriticalStateShake()` — самая сильная и продолжительная тряска (amplitude 14, duration 5 секунд), вызывается ровно один раз при показе модалки «Критическое состояние» в clamp-ветке `applySupercomputerDamage()`.
	- Все остальные ранее существовавшие callsite `ScreenEffects.triggerShake()` удалены (включая boss-death). В репо `triggerShake(` встречается только внутри `src/render/screenEffects.js` (defin/flush/heavy-pick).
- Banner «Атака началась» теперь читает строки через `t()`:
	- Заголовок — ключ `attackBannerTitle`, подзаголовок — `attackBannerSubtitle` с `{wave}`-подстановкой. Russian/English: [src/i18n/ru.json](../../../src/i18n/ru.json), [src/i18n/en.json](../../../src/i18n/en.json). Стиль `.wave-alert-subtitle` в [style.css](../../../style.css) расширен (`clamp` font-size, `max-width`, `text-wrap: balance`) чтобы вместить длинную русскую подсказку без поломки `zoomText` анимации.
- Self-heal стен после «Перезагрузки симуляции»:
	- Новый helper `recomputeMaxTankLevelFromCells(stateRef)` в [game.js](../../../game.js) пересчитывает `runtimeMaxTankLevelAchieved`/`maxTankLevelAchieved` из реальных `state.cells[i].tank.level` после restore. Helper никогда не понижает уже сохранённый максимум (`Math.max`).
	- Вызывается из `finalizePartialRestartPostRestore()` (обе ветки: `resetPurchaseProgress` и `forceFenceRuntimeReset`) и из `forceFenceRuntimeResetOnLoad()`. После recompute идёт `getFenceTierForTankLevel(...)` + `syncFenceTierWithMaxTankLevel(targetState, {force:true})` + `FenceSprites.ensureLevel(...)`, поэтому level 60 танков сразу даёт нужный fence-tier, а не «всегда tier 1».

## Post-merge update (2026-04-28, rework #1 — corner tower non-interrupt anim)
- `Game.CornerTowers.notifyZombieKill()` больше **не перезапускает** `work` анимацию, если она уже играет: текущий цикл всегда доигрывает до конца, после чего вышка возвращается в `idle` (через `animations.work.returnTo`). Mid-play kills по умолчанию игнорируются.
- Новый флаг [assets/fence.json](../../../assets/fence.json) `cornerTowers.queueRetrigger` (default `false`): если выставить `true`, вышка запоминает ровно одно убийство, прилетевшее во время `work`, и автоматически проигрывает `work` ещё раз сразу после завершения текущего цикла. Несколько mid-play kills сворачиваются в один queued retrigger (флаг очищается на retrigger / на возврат в idle / на `reset()`). При `false` поведение строго non-interrupt без накопления.
- Реализация: per-tower поле `pendingKill` (preallocated, без heap allocations в hot path), early-return в `notifyZombieKill` при `animState === 'work'`, ветка завершения non-loop анимации в `update()` использует `pendingKill` только при `_config.queueRetrigger === true`. Файл: [src/render/cornerTowers.js](../../../src/render/cornerTowers.js).

## Post-merge update (2026-04-28)
- Добавлен модуль `src/render/cornerTowers.js` (`Game.CornerTowers`): 4 предварительно аллоцированные башни в углах забора, atlas-driven анимации `idle`/`work`, kill-radius проигрывание `work` при смерти зомби рядом. Hot-path без heap allocations (scratch rect, squared-distance), graceful no-render при отсутствии атласа. Z-order: между drone slots и `zombiesCorpses`. Конфиг — секция `cornerTowers` в [assets/fence.json](../../../assets/fence.json) (atlas, scale, anchor, killRadiusPx, killTriggerCooldownSec, frame, animations.idle/work, offsets/anchors per угол tl/tr/bl/br). Wiring в `game.js`: `_CT.init()` после FenceRepair, `_CT.update(dt)` после `stepZombies`, `_CT.draw(ctx,{translateToCenter:true})` в render-цепочке, `_CT.notifyZombieKill(p.x-center.x, p.y-center.y)` после `burst()` в zombie-kill handler. Скрипт подключён в [index.html](../../../index.html).
- Production line: добавлены `production.featureFlags` (`conveyorEnabled`, `movingBoxEnabled`, `storageProgressBarEnabled`) и `production.storageProgressBar` (geometry/colors/label) в [assets/balance.json](../../../assets/balance.json). `Game.ProductionLineRender.setProductionConfig(production)` гейтит `drawConveyor`/`drawBoxOnConveyor` и `triggerConveyorWork()` по флагам, и рисует новый `drawStorageProgressBar(ctx, pl)` поверх storage cell, читая прогресс из `state.productionLine.progress` (kills/killCostForBox). Helper `drawRoundedRect()` без аллокаций. i18n keys `productionStorageProgressLabel`/`productionStorageProgressTooltip` добавлены в `src/i18n/{ru,en}.json`.

## Post-merge update (2026-04-25)
> Для больших файлов сначала откройте: `docs/ai/GAME_JS_MAP.md`, `docs/ai/SPRITE_LOADERS_MAP.md`, `docs/ai/PRODUCTION_LINE_RENDER_MAP.md`, `docs/ai/STYLE_CSS_MAP.md`.
> Для Phaser layer/render migration: `docs/ai/SYSTEMS/phaser.md`.

## Post-merge update (2026-04-26)
- `drawTank()` в `game.js`: chip-based aura sprites (`resolveTankAuraVisual` / `drawTankAuraSprite`) восстановлены. При `cellIndex != null` и наличии установленных чипов рендерится соответствующий спрайт `aura1/aura2/aura3` из `assets/tanks.json`. Orb-эффект (`computeAuraBand` / `drawTankAura`) сохранён для высоких уровней и вызывается после chip-aura путём: [game.js](../../../game.js#L14379-L14388).

## Post-merge update (2026-04-25)
- `drawTankAura()` читает procedural orb params из live cached `TankSprites.config.auraOrbs`, который нормализуется в `src/render/spriteLoaders.js`. Freshness идёт через explicit `TankSprites.refreshConfig()` / `reloadConfig()` вне render hot path; `drawTankAura()` не fetch'ит JSON, не нормализует raw config и не мутирует state. Некорректные `auraOrbs` значения откатываются к safe defaults в loader'е: [src/render/spriteLoaders.js](../../../src/render/spriteLoaders.js#L233-L258), [src/render/spriteLoaders.js](../../../src/render/spriteLoaders.js#L617-L644), [game.js](../../../game.js#L14199-L14297).

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
- Позиция тени/aura/ring учитывает `types[].anchor` (дельта от default {0.5, 0.75}) плюс `types[].anchorShadow` (ручное смещение в sprite-пикселях, JSON-ключ `anchor_shadow`). `anchorShadow` масштабируется текущим scale зомби. Оба значения суммируются: автоматическое anchor-смещение + ручная подгонка. Нормализация `anchor_shadow` с fallback `{x:0,y:0}` в [src/render/spriteLoaders.js](../../../src/render/spriteLoaders.js#L351-L353), применение в [src/render/zombieRender.js](../../../src/render/zombieRender.js#L138-L141).

## Phaser render layer modules
- Все 18 draw-слоёв в `draw()` gated через `Game.RenderRegistry` (mode: legacy/phaser/both)
- 12 Phaser layer modules в `src/phaser/layers/` управляются через `Game.PhaserLayerManager`
- В hybrid mode каждый слой делегирует legacy draw functions через ctx callback
- Подробности: `docs/ai/SYSTEMS/phaser.md`

## Fallback-контракт
- Если atlas или part-config недоступен, рендер остаётся на legacy geometry и vector fallback без падения runtime: [src/render/productionLineRender.js](../../../src/render/productionLineRender.js#L377-L515).
