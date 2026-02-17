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
