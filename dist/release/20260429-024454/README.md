# Tank Merge Zombie Defense

## AttackMode supplemental zombies
- `baseDesiredAlive` вычисляется как целевой alive без attackMode-множителя (`desiredAliveMult = 1`).
- `attackDesiredAlive` вычисляется текущей логикой с attackMode (`desiredAliveMult = attack runtime mult`).
- Пока `alive < baseDesiredAlive`, спавн идёт по прежней sideCount/slot-логике без 8-направлений.
- Только добор между `baseDesiredAlive` и `attackDesiredAlive` считается attackMode-добавкой и использует эпизод из 3 направлений (`dirA/dirB/dirC`) с распределением `50% / 25% / 25%`.

## Перезапустить симуляцию (partial reset)
- Сохраняет прогресс: talents/mods/drones/achievements/upgrades и связанный meta-прогресс.
- Сбрасывает runtime-мир как при reset и дополнительно фиксирует:
  - стены в базовый tier (`state.fenceLevel = 1`) и reinit fence-сегментов как tier1;
  - инфляцию цен покупки танков в абсолютный старт (`buyCounts = {}`, `buyPrices = {}`);
  - attackMode/runtime-хвосты через единый force-off reset.

## Critical modal
- При открытии critical modal attackMode force-off применяется немедленно.
- Force-off сбрасывает attack runtime (окна/таймеры/множители/эпизодные направления) и останавливает loop-sfx attack/weather, чтобы они не продолжали играть в паузе.
