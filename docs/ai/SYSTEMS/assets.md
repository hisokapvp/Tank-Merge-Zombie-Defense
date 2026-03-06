# Система: Assets

## Основные источники
- `assets/tanks.json`, `assets/zombies.json`, `assets/bullet.json`
- `assets/ground.json`, `assets/decor.json`, `assets/fence.json`
- `assets/supercomputer.json`, `assets/bonusbox.json`, `assets/boost_icons.json`
- `assets/credits.json` (данные для модалки `Credits/Создатели` в big menu)
- `assets/chips.json` (спрайты, эффекты и звуки чип-модификаторов ангара)
- `assets/balance/talentTree_v2.json` (PACK 1 baseline для data-driven дерева талантов v2)
- `assets/ui/icons/talents/*.png`, `assets/ui/icons/status/*.png` (stable icon keys; placeholder допустим)
- Для больших loader-contract файлов см. `docs/ai/SPRITE_LOADERS_MAP.md`

## Правила
- Новые игровые параметры добавлять в JSON, не хардкодить в JS.
- Сохранять обратную совместимость полей для загрузки старых сейвов.
- Для визуальных изменений проверять соответствующий loader/renderer в `src/render/*`.
- Для `assets/credits.json` учитываются поля элемента: `name`, `role_ru`, `role_en`.

## `assets/zombies.json` (corpse lifecycle)
- `corpseDespawnSec`: время существования трупа **после** завершения death-анимации.
- `corpseFadeOutSec`: длительность fade-out в конце life-time трупа.
- Нормализация runtime:
	- оба поля приводятся к `Number` и clamp к `>= 0`;
	- `corpseFadeOutSec` дополнительно clamp'ится до `corpseDespawnSec`.
- Edge-case: при `corpseDespawnSec = 0` труп удаляется сразу после завершения death-анимации.

## `assets/tanks.json` (UI-параметры)
- Раздел `ui` хранит UI-тюнинг, используемый рендером и HUD.
- Ключ `ui.onTrackIconOpacity`:
	- диапазон: `0..1`;
	- default: `0.45`;
	- назначение: dim-непрозрачность иконки танка в слоте при `onTrack=true`.
- Нормализация: `src/render/spriteLoaders.js` (`TankSprites.config.ui.onTrackIconOpacity`, clamp `0..1`).
- Fallback: при отсутствии или невалидном значении runtime использует `0.45`.

## `assets/supercomputer.json` (боевой рендер + production line)
- Верхний уровень по-прежнему описывает основной спрайт суперкомпьютера: `atlas`, `offsetY`, `anchor`, `renderScale`, `hpBar`, `boostIcons`, `glitch`, `stats`, `animations`.
- Для `animations.{idle,work,glitch,buildTank,destroy}` сохранены legacy-поля клипа (`x/y/w/h/frames/frameRateFps/loop`) и добавлены:
	- `scale` — дополнительный множитель масштаба конкретной анимации; применяется поверх root `renderScale`.
	- `effects` — массив описателей эффекта. Допустимы:
		- строка-пресет (например `"float"`),
		- объект с `preset`/`type` и override-полями `amplitudeX`, `amplitudeY`, `angleDeg`, `scaleMul`, `frequencyHz`, `phase`, `offsetX`, `offsetY`.
- Важно: `float` больше не «один на весь суперкомпьютер» — у каждого состояния можно задать свой preset/override в `animations.<state>.effects[]`. Например `idle.float` и `work.float` могут отличаться по `amplitudeY`, `frequencyHz`, `phase`.
- Поддерживаемые preset-id в runtime: `vibration`, `vibrationStrong`, `sway`, `wobble`, `float`, `pulse`.
- Новые optional-блоки `conveyor` и `storageCell` описывают части production line рядом с суперкомпьютером:
	- поля части: `atlas`, `offset`, `anchor`, `animations`;
	- canonical-состояния: для `conveyor` — `idle`/`work`, для `storageCell` — `idle`/`hover`.
- Backward compatibility:
	- отсутствие `scale` или `effects` нормализуется в `1` и `[]`;
	- отсутствие `conveyor`/`storageCell` оставляет legacy layout и fallback-отрисовку в `src/render/productionLineRender.js`;
	- alias `storage` при загрузке принимается как legacy-синоним `storageCell`.
- Loader-контракт:
	- нормализация выполняется в `src/render/spriteLoaders.js`;
	- runtime-логика чтения анимаций и их длительностей — в `src/mechanics/supercomputer.js`;
	- если `conveyor.atlas`/`storageCell.atlas` совпадают с root `atlas`, loader переиспользует уже загруженное изображение без отдельной копии.
	- root `hpBar` остаётся частью data-contract, но рисуется отдельным финальным overlay в `game.js`, а не вместе с root sprite.

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
