# Система: Assets

> Обновлено: 2026-03-29.

## Основные источники
- `assets/tanks.json`, `assets/zombies.json`, `assets/bullet.json`
- `assets/ground.json`, `assets/decor.json`, `assets/fence.json`
- `assets/supercomputer.json`, `assets/bonusbox.json`, `assets/boost_icons.json`
- `assets/credits.json` (данные для модалки `Credits/Создатели` в big menu)
- `assets/chips.json` (спрайты, эффекты и звуки чип-модификаторов ангара)
- `assets/levelreward.json` (data-driven настройки наград за повышение уровня суперкомпьютера)
- `assets/balance/talentTree_v2.json` (PACK 1 baseline для data-driven дерева талантов v2)
- `assets/ui/icons/talents/*.png`, `assets/ui/icons/status/*.png` (stable icon keys; placeholder допустим)
- Для больших loader-contract файлов см. `docs/ai/SPRITE_LOADERS_MAP.md`

## Правила
- Новые игровые параметры добавлять в JSON, не хардкодить в JS.
- Сохранять обратную совместимость полей для загрузки старых сейвов.
- Для визуальных изменений проверять соответствующий loader/renderer в `src/render/*`.
- Для `assets/credits.json` учитываются поля элемента: `name`, `role_ru`, `role_en`.

## `assets/zombies.json` (spawn, corpse lifecycle, atlas routing, explicit Health)
- Top-level `atlas` остаётся shared fallback/shared-death atlas, а `atlasesById` мапит `types[].id` на отдельные atlas PNG (`assets/zombie_lvl{1..60}_atlas.png` в текущем наборе данных). Loader также понимает optional `types[].atlas` override, поэтому `id` становится authoring key не только для pick-by-level, но и для atlas routing: [assets/zombies.json](../../../assets/zombies.json#L1-L63), [src/render/spriteLoaders.js](../../../src/render/spriteLoaders.js#L222-L267), [src/render/spriteLoaders.js](../../../src/render/spriteLoaders.js#L333-L339).
- Top-level `spawn` — часть runtime-контракта, а не просто баланс-данные: `ZombieSprites.load()` нормализует `targetAlive/sideCount/perSideTarget/perSideTolerance` в `ZombieSprites.spawnConfig`, а `game.js` читает этот объект в `getDefaultZombieTargetAlive()` и в spawn-planner'е attack-mode/alive-target логики: [assets/zombies.json](../../../assets/zombies.json#L91-L101), [src/render/spriteLoaders.js](../../../src/render/spriteLoaders.js#L270-L278), [game.js](../../../game.js#L2173-L2190), [game.js](../../../game.js#L5608-L5626).
- `ZombieSprites.load()` нормализует для каждого типа `atlas` / `atlasPath`, preload'ит per-type images в `atlasImages` и сохраняет fallback на shared `assets/zombie_atlas.png`, если mapping отсутствует или конкретный atlas не загрузился. Render-path обязан брать image через `getAtlasImage(...)`, а не строить URL заново в draw code: [src/render/spriteLoaders.js](../../../src/render/spriteLoaders.js#L243-L380), [src/render/spriteLoaders.js](../../../src/render/spriteLoaders.js#L416-L426), [src/render/zombieRender.js](../../../src/render/zombieRender.js#L22-L29).
- `corpseDespawnSec`: время существования трупа **после** завершения death-анимации.
- `corpseFadeOutSec`: длительность fade-out в конце life-time трупа.
- Нормализация runtime:
	- оба поля приводятся к `Number` и clamp к `>= 0`;
	- `corpseFadeOutSec` дополнительно clamp'ится до `corpseDespawnSec`.
- Edge-case: при `corpseDespawnSec = 0` труп удаляется сразу после завершения death-анимации.
- `types[].Health` — canonical поле явного HP для конкретного типа зомби; legacy `health` остаётся допустимым alias только на входе normalizer'а. `ZombieSprites.load()` сначала читает `Health`, потом fallback'ится к `health`, записывает результат в `type.health`, а `makeZombie()` использует этот explicit HP раньше общей формулы `BAL.zombieHpBase * zombieHpMultiplier(...) * hpMul`: [assets/zombies.json](../../../assets/zombies.json#L101-L2939) _(строки приблизительные, повторяющийся `types[]` block)_, [src/render/spriteLoaders.js](../../../src/render/spriteLoaders.js#L296-L305), [game.js](../../../game.js#L5676-L5687).

## `assets/tanks.json` (UI-параметры + печать танка)
- Top-level `tankPrintDurationSec`:
	- диапазон: `> 0`;
	- default/fallback: `1.5` сек;
	- назначение: единая длительность stamp-reveal в слоте и root-анимации `buildTank` у суперкомпьютера;
	- нормализация: `src/render/spriteLoaders.js` (`TankSprites.config.tankPrintDurationSec`), затем чтение из `game.js` / `src/ui/supercomputerBuildTankFx.js`: [assets/tanks.json](../../../assets/tanks.json#L1-L6), [src/render/spriteLoaders.js](../../../src/render/spriteLoaders.js#L381-L393), [game.js](../../../game.js#L2744-L2756), [src/ui/supercomputerBuildTankFx.js](../../../src/ui/supercomputerBuildTankFx.js#L22-L53).
- Раздел `ui` хранит UI-тюнинг, используемый рендером и HUD.
- Каждый `tank_lvlN` теперь также считается частью modifiers-modal контракта: `upgradeDamagePointsCosts.{baseDamage,attackSpeed}` задаёт canonical стоимость stat-specific шага для expandable row в `Supercomputer -> Орудия`, а `game.js` суммирует эти шаги через `getCannonUpgradeTotalCost()` / `applyCannonUpgrade()`, не через CSS/DOM-derived числа: [assets/tanks.json](../../../assets/tanks.json#L117-L170), [game.js](../../../game.js#L878-L910), [src/ui/supercomputerMenu.js](../../../src/ui/supercomputerMenu.js#L1044-L1256).
- Ключ `ui.onTrackIconOpacity`:
	- диапазон: `0..1`;
	- default: `0.45`;
	- назначение: dim-непрозрачность иконки танка в слоте при `onTrack=true`.
- Нормализация: `src/render/spriteLoaders.js` (`TankSprites.config.ui.onTrackIconOpacity`, clamp `0..1`).
- Fallback: при отсутствии или невалидном значении runtime использует `0.45`.

## `assets/dron.json` (runtime уровни дронов + per-stat upgrade costs)
- `levels.{1..N}` — это не только runtime base stats, но и canonical contract для modifiers modal `Дроны`: `moveSpeedPxSec`, `repairSpeedMult`, `costMult` показываются в summary row, а `upgradeDamagePointsCosts` задаёт стоимость stat-specific шага для detail cards. UI не должен выводить «примерную» стоимость без чтения этого JSON: [assets/dron.json](../../../assets/dron.json#L63-L110), [src/ui/supercomputerMenu.js](../../../src/ui/supercomputerMenu.js#L1258-L1480).
- `game.js` применяет pending upgrades per stat через `getDronUpgradeTotalCost()` / `applyDronUpgrade()`, поэтому изменения ключей `upgradeDamagePointsCosts` должны рассматриваться как runtime-code change, а не косметика конфига: [game.js](../../../game.js#L3282-L3313).

## `assets/fence.json` (tier config + wall modifiers modal)
- `levels[]` по-прежнему описывают base tier fence (`segmentMaxHp`, `armorFlat`, `upgradeCostDamagePoints`, atlas/uiIcon), но для модалки `Стены` появился отдельный stat-level contract `upgradeDamagePointsCosts.{segmentMaxHp,armorFlat}`. Это canonical источник стоимости detail-card stepper'ов в `Supercomputer -> Стены`: [assets/fence.json](../../../assets/fence.json#L1-L120), [src/ui/supercomputerMenu.js](../../../src/ui/supercomputerMenu.js#L1482-L1708).
- `upgradeCostDamagePoints` и `upgradeDamagePointsCosts` не эквивалентны: первое описывает tier-level fence progression, второе — stat-specific modifiers modal; `game.js` использует второе через `getFenceUpgradeTotalCost()` / `applyFenceUpgrade()`, включая clamp текущих segment HP после апгрейда `segmentMaxHp`: [game.js](../../../game.js#L912-L945).
- Для UI preview стены приоритет `uiIcon` остаётся data-driven (`atlas`, `frame.id` или inline frame), поэтому docs/renderer рассматривают этот JSON как кодовый контракт, а не просто atlas listing: [assets/fence.json](../../../assets/fence.json#L10-L77), [src/ui/supercomputerMenu.js](../../../src/ui/supercomputerMenu.js#L1600-L1708).

## `assets/supercomputer.json` (боевой рендер + production line)
- Root-конфиг суперкомпьютера: [assets/supercomputer.json](../../../assets/supercomputer.json#L1-L123).
- Для `animations.{idle,work,glitch,buildTank,destroy}` сохранены legacy-поля клипа (`x/y/w/h/frames/frameRateFps/loop`) и добавлены:
	- `scale` — дополнительный множитель масштаба конкретной анимации; применяется поверх root `renderScale`.
	- `effects` — массив описателей эффекта. Допустимы строка-пресет или объект с `preset`/`type` и override-полями `amplitudeX`, `amplitudeY`, `angleDeg`, `scaleMul`, `frequencyHz`, `phase`, `offsetX`, `offsetY`.
- `buildTank` — не просто data-ключ: root-state реально включается только explicit helper'ом покупки танка и живёт одно окно `tankPrintDurationSec`: [assets/supercomputer.json](../../../assets/supercomputer.json#L81-L101), [game.js](../../../game.js#L3289-L3307), [src/ui/supercomputerBuildTankFx.js](../../../src/ui/supercomputerBuildTankFx.js#L41-L53).
- Поддерживаемые preset-id в runtime: `vibration`, `vibrationStrong`, `sway`, `wobble`, `float`, `pulse`.
- `conveyor` описывает ленту рядом с суперкомпьютером: [assets/supercomputer.json](../../../assets/supercomputer.json#L125-L152).
	- canonical-состояния: `idle` / `work`.
	- atlas может отличаться от root atlas.
- `conveyorBox` описывает печатаемую коробку на конвейере: [assets/supercomputer.json](../../../assets/supercomputer.json#L154-L208).
	- `offset.x` и `offset.y` напрямую смещают центр коробки относительно belt-layout в renderer; через них коробку сажают «на ленту» без правок JS: [assets/supercomputer.json](../../../assets/supercomputer.json#L160-L166), [src/render/productionLineRender.js](../../../src/render/productionLineRender.js#L417-L445).
	- используется отдельный atlas `conveyor_box_atlas.png`;
	- canonical-состояния: `printLow` / `printHigh`;
	- loader также понимает alias-ключи `buildLow`, `buildHigh`, `under50`, `over50`, `lessThanHalf`, `moreThanHalf`;
	- renderer делает reveal снизу вверх по `progress`: [src/render/productionLineRender.js](../../../src/render/productionLineRender.js#L329-L444).
- `storageCell` описывает ячейку-склад: [assets/supercomputer.json](../../../assets/supercomputer.json#L209-L237).
	- canonical-состояния: `idle` / `hover`.
- Backward compatibility:
	- отсутствие `scale` или `effects` нормализуется в `1` и `[]`;
	- отсутствие `conveyor`/`conveyorBox`/`storageCell` оставляет legacy layout и fallback-отрисовку в `src/render/productionLineRender.js`;
	- alias `storage` при загрузке принимается как legacy-синоним `storageCell`.
- Loader-контракт:
	- нормализация выполняется в [src/render/spriteLoaders.js](../../../src/render/spriteLoaders.js#L45-L145) и [src/render/spriteLoaders.js](../../../src/render/spriteLoaders.js#L853-L1030);
	- если atlas части совпадает с root atlas, loader переиспользует уже загруженное изображение без отдельной копии: [src/render/spriteLoaders.js](../../../src/render/spriteLoaders.js#L914-L928);
	- root `hpBar` остаётся частью data-contract, но рисуется отдельным финальным overlay в `game.js`, а не вместе с root sprite.

## `assets/underground_hangar.json` (canvas shell кнопки ангара)
- Конфиг кнопки/ячейки подземного ангара теперь опирается на существующий atlas `slot_warehouse_atlas.png`, а не на отсутствующий `underground_hangar_atlas.png`: [assets/underground_hangar.json](../../../assets/underground_hangar.json#L1-L12), [src/mechanics/undergroundHangar.js](../../../src/mechanics/undergroundHangar.js#L40-L57).
- Runtime loader в [src/mechanics/undergroundHangar.js](../../../src/mechanics/undergroundHangar.js#L40-L57) держит тот же fallback atlas `slot_warehouse_atlas.png`, поэтому отсутствие поля `atlas` в JSON больше не возвращает 404 на несуществующий файл.
- `animations.{idle,hover_start,hover_idle,hover_end,click,close}` для этой кнопки читаются как обычный sprite-sheet contract; `hover_idle` — looping state между `hover_start` и `hover_end`, обеспечивает плавный idle пока курсор остаётся над ячейкой: [assets/underground_hangar.json](../../../assets/underground_hangar.json#L8), [src/mechanics/undergroundHangar.js](../../../src/mechanics/undergroundHangar.js#L13-L24).
- Фактический badge количества техники дорисовывается поверх atlas уже в runtime, а не хранится в JSON: [src/mechanics/undergroundHangar.js](../../../src/mechanics/undergroundHangar.js#L170-L195).
- `_isClosing` guard предотвращает запуск `hover_end` во время проигрывания `close` анимации после dismiss модалки: [src/mechanics/undergroundHangar.js](../../../src/mechanics/undergroundHangar.js#L17), [src/mechanics/undergroundHangar.js](../../../src/mechanics/undergroundHangar.js#L260).
- `draw()` применяет rounded rect clip перед отрисовкой sprite, чтобы углы atlas не выступали за ячейку; badge рисуется **после** restore, вне clip: [src/mechanics/undergroundHangar.js](../../../src/mechanics/undergroundHangar.js#L149-L168).

## `assets/levelreward.json` (награды за повышение уровня)
- Загружается в `boot()` через `fetch('assets/levelreward.json')` → `LevelRewardConfig`: [game.js](../../../game.js#L13697-L13702).
- Передаётся в `ProgressionApi.levelGoldReward(level, BAL, LevelRewardConfig)` и `createLevelFlow({ levelRewardConfig })`.
- Структура:
	- `gold.formula`: `"tankCost"` (default, `50 * 2^(level-1)`) или `"fixed"` (legacy линейная из BAL);
	- `gold.perLevel`: объект `{ "level": amount }` для per-level override (приоритет над формулой);
	- `upgradePoints.basePerLevel`: базовые upgrade points за каждый уровень (default `1`);
	- `upgradePoints.milestones`: объект `{ "level": bonusPoints }` для дополнительных upgrade points на milestone-уровнях;
	- `damagePoints`: объект `{ "level": points }` для damage point rewards (default `{ "2": 5 }`).
- Resolver-функции в [src/mechanics/levelFlow.js](../../../src/mechanics/levelFlow.js#L17-L65): `resolveMilestones()`, `resolveDamagePointRewards()`, `resolveBaseUpgradePoints()` валидируют и нормализуют config, возвращая fallback при отсутствии или невалидных значениях.
- При отсутствии `levelreward.json` или ошибке fetch все resolvers возвращают hardcoded fallback, поведение полностью backward-compatible.

## `assets/balance/cannonUpgrades.json`
- Формат: массив из **60** строк по уровням танка `1..60`.
- Формат строки (backward compatible):
	- старый: `[tankLevel, costBase, costStep, damageMulPerUpgrade, attackSpeedMulPerUpgrade]`;
	- новый: `[tankLevel, costBase, costStep, damageMulPerUpgrade, attackSpeedMulPerUpgrade, iconFrames]`.
- Ограничения валидации runtime:
	- длина массива строго `60`;
	- `tankLevel` строго по порядку `1..60`;
	- длина строки: только `5` или `6`;
	- все значения числовые (`Number.isFinite`), без `NaN`;
	- `iconFrames`: если `Number.isFinite(x) && x >= 1`, то берётся `Math.floor(x)`, иначе fallback `1`;
	- при ошибке чтения/валидации используется fallback-конфиг и лог `using fallback CannonUpgrades`.
- Поведение совместимости:
	- при старом формате (5 полей) `iconFrames` автоматически считается равным `1`;
	- при невалидном `iconFrames` конфиг не валится, применяется безопасный `1`.
- Формула стоимости шага улучшения уровня `L`:
	- пусть `u0` — уже применённые улучшения на уровне,
	- стоимость шага `k` (где `k` начинается с `1`) равна:
		- `cost(k) = costBase(L) + costStep(L) * (u0 + k - 1)`.
- Формула общей стоимости применения `pending` шагов:
	- `total = Σ cost(k), k=1..pending`.
- Формула эффекта в боёвке для уровня `L`:
	- `attackDamageMul_final = attackDamageMul_base * (1 + applied(L) * damageMulPerUpgrade(L))`;
	- `attackSpeedMul_final = attackSpeedMul_base * (1 + applied(L) * attackSpeedMulPerUpgrade(L))`.
