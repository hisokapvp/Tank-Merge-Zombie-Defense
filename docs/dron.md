# Дрон-ремонтник (`dron`)

Документ описывает полную реализацию дрона-ремонтника: ассеты, state/persist, выбор целей, резервы, режимы, детерминированный ремонт и edge cases.

## 1) Asset-схема: `assets/dron.json`

Обязательные поля:

- `atlas` / `png` — путь к atlas/png (runtime использует файл из JSON, без хардкода в коде).
- `frames[]` — список кадров с `id`, `x`, `y`, `w`, `h`.
- `animations` — минимум:
  - `idle`
  - `fly`
  - `repair`
- `levels` — уровни `1..N`, где `N >= 10`, каждый уровень содержит:
  - `moveSpeedPxSec`
  - `repairSpeedMult`
  - `costMult`
- UI-геометрия:
  - `iconSize: { w, h }`
  - `iconsOffsetY`
- `baseRepairSec` — базовая длительность ремонта, default `5.0`.

Поддерживаемый runtime-паттерн:

- `animations.<name>.frames` — массив `frame.id`.
- `animations.<name>.frameRateFps` — fps анимации.
- `animations.<name>.loop` — цикличность.

## 2) State и структура дрона

В root state:

- `state.drones` — массив дронов (default `[]`).

Структура одного дрона:

- `id: string` (уникальный)
- `level: number`
- `mode: 'standby' | 'repair'`
- `substate: 'patrol' | 'flyToTarget' | 'repairing' | 'returnToBase'`
- `pos: { x, y }`
- `basePos: { x, y }` (синхронизируется с `state.supercomputer`)
- `targetSegmentId: number|string|null`
- `reservedSegmentId: number|string|null`
- `repair: null | {`
  - `startHp`
  - `maxHp`
  - `totalCostCoins`
  - `repairDurationSec`
  - `repairStartTimeSec`
  - `coinsSpentPrev`
  - `}`

## 3) Save/Load и консистентность

Сериализация:

- `drones` пишется в save payload (`src/persistence/storage.js`).
- Сохраняются минимум: `id/level/mode/substate/pos/basePos` (+ служебные поля).

Десериализация:

- При `restore` вызывается восстановление `state.drones`.
- Анти-"залипание" резервов:
  - на load все `segment.reservedByDroneId` сбрасываются,
  - дроны из repair-середины цикла переводятся в безопасный re-acquire (без старых резервов),
  - цель выбирается заново по текущему состоянию fence.

New game:

- `state.drones` очищается (`[]`) через общий reset flow.

## 4) Цели и tie-break

Кандидат в цель:

- `segment.hp < segment.maxHp`
- сегмент не зарезервирован другим дроном

Метрика выбора:

1. минимальный `hp/maxHp` (самый повреждённый)
2. tie-break: минимальный `segmentId` (лексикографически), затем индекс

Сложность:

- `O(Nsegments)` на одного дрона в одном выборе.

## 5) Резервы

Поле резерва:

- `segment.reservedByDroneId`

Правила:

- Резерв ставится сразу при выборе цели.
- Резерв снимается при:
  - `repair -> standby` (в любой момент)
  - невалидной цели (в т.ч. сегмент уже `hp==maxHp` или занят другим)
  - завершении ремонта
  - прерывании из-за `coins==0`

## 6) Режимы и substates

### `standby / patrol`

- Дрон удерживает `basePos` (центр supercomputer) и курсирует в простом локальном дрейфе/орбите.

### `repair`

- `flyToTarget`:
  - полёт к сегменту со скоростью `moveSpeedPxSec(level)`.
  - при достижении порога близости переход в `repairing`.
- `repairing`:
  - детерминированное восстановление HP + списание монет по времени.
- `returnToBase`:
  - полёт к `basePos`.
  - по прибытии переход в `standby/patrol`.

## 7) Формулы

- `baseCost = assets/fence.json.repair.costCoins`
- `missingRatio = (maxHp - hp) / maxHp`
- `totalCostCoins = ceil(baseCost * missingRatio * costMult(level))`
- `repairDurationSec = baseRepairSec / repairSpeedMult(level)`

## 8) Детерминированный per-frame ремонт

На старте ремонта фиксируются:

- `startHp`, `maxHp`, `totalCostCoins`, `repairDurationSec`, `repairStartTimeSec`, `coinsSpentPrev=0`.

На каждом апдейте:

1. `t = clamp((nowSec - repairStartTimeSec) / repairDurationSec, 0..1)`
2. `hpTarget = round(startHp + (maxHp - startHp) * t)`
3. `coinsSpentTarget = floor(totalCostCoins * t)`
4. `deltaCoins = coinsSpentTarget - coinsSpentPrev`
5. Списание `deltaCoins` из `state.coins` с защитой от ухода в `< 0`:
   - если `state.coins < deltaCoins`, списывается всё до `0`, ремонт прерывается
6. Обновляются `coinsSpentPrev` и `segment.hp`

Завершение:

- Если `hp == maxHp`:
  - резерв снимается,
  - выбирается следующий сегмент,
  - при нехватке монет на полный ремонт следующего: `returnToBase -> standby`.
- Если `state.coins == 0` и `hp < maxHp`:
  - резерв снимается,
  - `returnToBase -> standby`.

## 9) UI иконок

Над каждым дроном рисуются 2 world-space иконки:

- `⏳` — standby
- `🔧` — repair

Правила UI:

- активный режим подсвечен
- hitbox клика строго соответствует `iconSize`
- вертикальная позиция учитывает `iconsOffsetY`
- `🔧` disabled, если:
  - нет валидных сегментов, или
  - не хватает монет на полный ремонт целевого «самого повреждённого доступного» сегмента

## 10) Edge cases

### A) Нехватка монет до старта repair

- Клик по `🔧` не меняет режим (`standby` остаётся).

### B) Нехватка монет в процессе repair

- Монеты не уходят в минус.
- При достижении `coins == 0`:
  - ремонт останавливается,
  - резерв снимается,
  - дрон уходит `returnToBase`, затем `standby`.

### C) Отмена игроком

- Повторный клик по активному `🔧` или переключение на `⏳`:
  - немедленный выход из repair,
  - снятие резерва,
  - переход в standby.

### D) Невалидная цель

- Если цель стала невалидной (восстановлена/занята/исчезла),
  - резерв снимается,
  - дрон завершает repair-flow безопасно через возврат к базе.

## 11) Debug

В `src/ui/debugPanel.js`:

- добавлен единственный новый контрол:
  - селект уровня (`1..N`)
  - кнопка `Add Dron`
- реализация через callback `addDron(level)`.
- другие debug-инструменты для дронов не добавляются.

## 12) Контроль готовности

Минимальный runtime-checklist:

1. New game: `state.drones.length === 0`.
2. Save/load: у дронов сохраняются `id/level/mode/pos`.
3. После load резервы не «залипают».
4. `🔧` корректно disabled при no-target / no-coins.
5. Два дрона не берут один сегмент одновременно.
6. Ремонт до `maxHp` за `repairDurationSec` при достаточных монетах.
7. Суммарное списание при полном ремонте равно `totalCostCoins`.
8. При исчерпании монет в процессе дрон корректно прекращает repair и возвращается на базу.
