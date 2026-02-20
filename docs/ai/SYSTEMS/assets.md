# Система: Assets

## Основные источники
- `assets/tanks.json`, `assets/zombies.json`, `assets/bullet.json`
- `assets/ground.json`, `assets/decor.json`, `assets/fence.json`
- `assets/supercomputer.json`, `assets/bonusbox.json`, `assets/boost_icons.json`
- `assets/credits.json` (данные для модалки `Credits/Создатели` в big menu)

## Правила
- Новые игровые параметры добавлять в JSON, не хардкодить в JS.
- Сохранять обратную совместимость полей для загрузки старых сейвов.
- Для визуальных изменений проверять соответствующий loader/renderer в `src/render/*`.
- Для `assets/credits.json` учитываются поля элемента: `name`, `role_ru`, `role_en`.

## `assets/tanks.json` (UI-параметры)
- Раздел `ui` хранит UI-тюнинг, используемый рендером и HUD.
- Ключ `ui.onTrackIconOpacity`:
	- диапазон: `0..1`;
	- default: `0.45`;
	- назначение: dim-непрозрачность иконки танка в слоте при `onTrack=true`.
- Нормализация: `src/render/spriteLoaders.js` (`TankSprites.config.ui.onTrackIconOpacity`, clamp `0..1`).
- Fallback: при отсутствии или невалидном значении runtime использует `0.45`.

## `assets/balance/cannonUpgrades.json`
- Формат: массив из **60** строк по уровням танка `1..60`.
- Формат строки: `[tankLevel, costBase, costStep, damageMulPerUpgrade, attackSpeedMulPerUpgrade]`.
- Ограничения валидации runtime:
	- длина массива строго `60`;
	- `tankLevel` строго по порядку `1..60`;
	- все значения числовые (`Number.isFinite`), без `NaN`;
	- при ошибке чтения/валидации используется fallback-конфиг и лог `using fallback CannonUpgrades`.
- Формула стоимости шага улучшения уровня `L`:
	- пусть `u0` — уже применённые улучшения на уровне,
	- стоимость шага `k` (где `k` начинается с `1`) равна:
		- `cost(k) = costBase(L) + costStep(L) * (u0 + k - 1)`.
- Формула общей стоимости применения `pending` шагов:
	- `total = Σ cost(k), k=1..pending`.
- Формула эффекта в боёвке для уровня `L`:
	- `attackDamageMul_final = attackDamageMul_base * (1 + applied(L) * damageMulPerUpgrade(L))`;
	- `attackSpeedMul_final = attackSpeedMul_base * (1 + applied(L) * attackSpeedMulPerUpgrade(L))`.
