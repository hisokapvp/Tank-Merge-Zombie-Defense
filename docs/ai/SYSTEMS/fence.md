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
	- знание о проломе ограничено `WorldEvents.attackMode.fenceBreachAwarenessRadiusPx` (радиус в px вокруг бреши, scaled через `balScale`).
	- если на текущей стороне зомби есть хотя бы один пролом, он считается «известным» приоритетно (без radius-gate) и зомби не должны выбирать целые сегменты этой стороны как attack-target.
	- вне awareness-радиуса зомби ведут себя как обычно (не получают глобальный redirect на пролом).
	- при локальном знании пролома и до состояния `breached` зомби не выбирают целые fence-сегменты как attack-target.
	- проход внутрь периметра допускается только через активные проломы (сломанную геометрию fence).
	- при разрушении одной side-секции каскадно ломаются ещё две смежные секции на той же стороне (`sideIndex-1` и `sideIndex+1`, если валидны).
	- при разрушении corner-секции каскадно ломается по одной прилегающей side-секции с каждой стороны этого угла.
