# Система: Fence

## Где править
- Конфиг: `assets/fence.json`
- Механика: `src/mechanics/fenceSides.js`, `src/mechanics/drones.js`
- Рендер/геометрия: `src/render/fenceLayout.js`

## Правила
- Изменения HP/repair проверять вместе с дронами и zombie targeting.
- Не ломать совместимость сейва и восстановление состояния стен.
- Tier стен синхронизируется от `maxTankLevelAchieved`/runtime max внутри текущей симуляции.
- Применение tier делается one-shot на изменение уровня (`currentFenceTierApplied` guard):
	- обновляется `state.fenceLevel`,
	- сбрасывается кэш сегментов для одноразовой перестройки,
	- вызывается `FenceSprites.ensureLevel(...)` для hot-refresh атласа.
