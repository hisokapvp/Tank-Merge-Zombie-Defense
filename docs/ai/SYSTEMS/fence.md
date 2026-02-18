# SYSTEM: Fence

## Где искать

- Runtime fence logic: `game.js`
- Геометрия сегментов: `src/render/fenceLayout.js`
- Конфиг: `assets/fence.json`
- Save/load сегментов: `src/persistence/storage.js`
- UI модалки стен: `src/ui/supercomputerMenu.js` + `index.html`

## Глоссарий

- `fenceLevel` — текущий уровень стен (`state.fenceLevel`, default `1`).
- `armorFlat` — плоское снижение входящего урона по fence-сегменту.
- `damagePointsSpent` — сколько damage points уже потрачено на апгрейды стен.

## Конфиг `assets/fence.json`

- Приоритет: `levels[]` выше legacy `segmentMaxHp`.
- Формат `levels[]`:
  - `segmentMaxHp` (int >= 1)
  - `armorFlat` (int >= 0)
  - `upgradeCostDamagePoints` (int >= 0, для последнего уровня может быть `0` или отсутствовать)
- Fallback: если `levels[]` отсутствует/пуст/невалиден, используется один уровень из legacy `segmentMaxHp`, `armorFlat=0`, апгрейд недоступен.

## Урон и ремонт

- Урон списывается в одной точке: `applyFenceSegmentDamage(seg, amount)`.
- Формула: `finalDamage = max(0, incomingDamage - armorFlat)`.
- Если `incomingDamage <= armorFlat`, HP сегмента не меняется.
- HP всегда в диапазоне `0..maxHp`.
- Ремонт (`tryRepairFenceSegmentAt`) восстанавливает выбранный сегмент до текущего `maxHp`.

## Апгрейд стен

- UI-кнопка в модалке «Модификации танков и стен» → вкладка «Стены».
- Стоимость апгрейда берётся из текущего уровня: `levels[levelIndex].upgradeCostDamagePoints`.
- Доступные очки:
  - `availableDamagePoints = max(0, floor(totalDamageDealtRaw / 10000) - damagePointsSpent)`.
- При успешном апгрейде:
  - `fenceLevel++`
  - `damagePointsSpent += cost`
  - выполняется clamp всех сегментов к новому `segmentMaxHp`.

## Save/load и совместимость

- Сохраняются: `fenceLevel`, `damagePointsSpent`, `fenceState` (`hpById`).
- Старые сейвы без `fenceLevel`/`damagePointsSpent` загружаются с default (`1`/`0`) без ошибок.

## Быстрая проверка

- Удар по fence при `incomingDamage <= armorFlat` не должен менять HP.
- На последнем уровне кнопка апгрейда недоступна.
- После апгрейда HP сегментов не превышает новый `segmentMaxHp`.
- При удалении `levels[]` в `assets/fence.json` fence работает через legacy `segmentMaxHp`.

## Side by position

- Для runtime-определения стороны используется `getSideByPosition(x, y)` относительно центра базы/layout.
- Возвращаемые значения: `top | right | bottom | left`.
- Правило квадранта: сравнение `abs(dy)` и `abs(dx)` от центра; при доминировании `dy` выбирается `top/bottom`, иначе `left/right`.
- В `stepZombies` сторона зомби обновляется каждый тик: `z.side = getSideByPosition(zWorldX, zWorldY)`.

## Breach registry by side

- Runtime-структура: `breachesBySide` (эквивалент `{ top: [], right: [], bottom: [], left: [] }`) с доступом O(1) по стороне.
- Элемент брича хранит минимум: `{ segmentId, holeAabb, center }`.
- Обновление структуры выполняется при смене состояния сегмента fence:
  - на разрушении сегмента (`broken = true`) сегмент регистрируется как breach на стороне сегмента;
  - на восстановлении/ремонте (`broken = false`) breach удаляется.
- При полном rebuild fence-layout структура `breachesBySide` пересобирается из текущих `state.fenceSegments`.

## Zombie side-knowledge behavior

- Базовое правило: зомби используют только брич своей текущей стороны (`z.side`); бричи других сторон игнорируются.
- Если `breachesBySide[z.side]` не пуст:
  - зомби выбирает ближайший breach по `center` на своей стороне;
  - использует центр брича как промежуточную цель входа.
- После входа внутрь базы (breach crossed / `z.breached=true`) зомби продолжает маршрут к `supercomputer`.
- Если на своей стороне бричей нет, поведение остаётся прежним: зомби атакует fence-сегменты.

## Collision rule in breach hole

- Fence-block/collision отключается только внутри `holeAabb` активного брича на стороне текущего зомби.
- Исключение не глобальное: зомби с другой стороны не получает проход через чужой `holeAabb`.
- Визуальный проход и коллизия должны совпадать с геометрией из `src/render/fenceLayout.js` (`holeAabb` сегмента).

## Точки интеграции в коде

- Геометрия/границы отверстия: `src/render/fenceLayout.js` (`holeAabb`).
- Runtime fence + breach registry + side-aware AI: `game.js`.
- Пошаговый AI/движение зомби: `stepZombies` и `zombieFenceLimit` в `game.js`.
- Изменение состояния сегмента при ремонте дронами: `src/mechanics/drones.js` (sync callback в runtime).
