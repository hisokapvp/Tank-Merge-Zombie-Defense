# Система: Fence

## Где править
- Конфиг: `assets/fence.json`
- Механика: `src/mechanics/fenceSides.js`, `src/mechanics/drones.js`
- Стоимость ремонта: `src/mechanics/fenceRepair.js` (`Game.FenceRepair`)
- Рендер/геометрия: `src/render/fenceLayout.js`

## Fence repair cost module (`Game.FenceRepair`)
- Новый модуль `src/mechanics/fenceRepair.js` (подключён в `index.html` L602) экспортирует `Game.FenceRepair`: [src/mechanics/fenceRepair.js](../../../src/mechanics/fenceRepair.js#L1-L122).
- `loadTankPrices()` заменяет sync XMLHttpRequest на async `fetch('assets/tanks.json')` и строит `Game.TankPrices[]`.
- `computeRepairCost(fenceLevel, repairCount)`: `baseCost = buyTankCost(level) + repairCount × max(1, ceil(baseCost × 0.01))`; cumulative 1% surcharge за каждый предыдущий ремонт.
- `getFenceRepairCostCoins(fenceLevel, repairCount)` — public getter, вызывается из `game.js` (`tryRepairFenceSegmentAt()`).
- `init({ getFenceConfig })` — инъекция конфиг-провайдера из `game.js`.
- `fenceRepairCount` живёт в `state`, seed'ится в `initialState.js` (L58), сериализуется в `storage.js` (L468), инкрементируется при ремонте (`game.js` L7523), сбрасывается при partial/full reset (`game.js` L2418).

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

## Corner / side seam geometry
- `src/render/fenceLayout.js` владеет visual seam-contract между corner и side sprite slots: `resolveSeamOverlapPx()` возвращает базовый overlap `1px`, а при viewport `< 1400px` пропорционально добавляет перекрытие, чтобы на узких экранах не открывались gap'ы между углом и первой/последней side-секцией: [src/render/fenceLayout.js](../../../src/render/fenceLayout.js#L74-L86).
- `buildSquareFenceSegments()` должен применять этот seam один раз на layout stage и сдвигать старт/конец side span, а не чинить gap поздними draw-time offset'ами. Если нужна правка cornerInset, проверять и standard no-gap path, и responsive overlap path: [src/render/fenceLayout.js](../../../src/render/fenceLayout.js#L90-L204).
- Regression coverage: `FCS-2` подтверждает overlap при negative inset, а `FCS-3` закрепляет усиление overlap below `1400px` через сравнение `1400 / 1000 / 800` viewport widths: [Test/pack7/fenceCornerSlots.test.js](../../../Test/pack7/fenceCornerSlots.test.js#L104-L197).
