# Система: Fence

## Где править
- Конфиг: `assets/fence.json`
- Механика: `src/mechanics/fenceSides.js`, `src/mechanics/drones.js`
- Рендер/геометрия: `src/render/fenceLayout.js`

## Правила
- Изменения HP/repair проверять вместе с дронами и zombie targeting.
- Не ломать совместимость сейва и восстановление состояния стен.
- Tier стен синхронизируется от runtime max внутри текущей симуляции, но для `partial restart` и `new game/reset` принудительно возвращается к L1 (`max/runtime/currentTier/fenceLevel = 1` + `FenceSprites.ensureLevel(1)`).
- Применение tier делается one-shot на изменение уровня (`currentFenceTierApplied` guard):
	- обновляется `state.fenceLevel`,
	- сбрасывается кэш сегментов для одноразовой перестройки,
	- вызывается `FenceSprites.ensureLevel(...)` для hot-refresh атласа.
- Проломы fence:
	- hit-test дыры должен учитывать padding от радиуса зомби, чтобы проход не зависел от пиксельно-точного попадания в AABB.
	- поиск ближайшего пролома должен иметь fallback по всем сторонам (важно для угловых сегментов/corner breaches).
