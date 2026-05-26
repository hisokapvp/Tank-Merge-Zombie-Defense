assets/fence.json

Схема и правила для `assets/fence.json` (версия для разработчиков)

Обновлено: 2026-04-02.

Описание:
- `atlas`: (строка) глобальный путь к изображению-атласу по умолчанию (например `fence_atlas.png`).
- `cornerInsetPx`: (число|null) override для inset при рисовании углов.
- `segmentsPerSide`: (число) количество сегментов на сторону (по умолчанию 8 в проекте).
- `levels`: массив из 60 объектов (индексы 0..59 соответствуют уровням 1..60). Каждый элемент уровня содержит:
  - `segmentMaxHp` (число): базовое HP сегмента для этого уровня. Используется как `base` при расчёте текущего HP с учётом шагов апгрейда.
  - `armorFlat` (число): базовое плоское значение брони для этого уровня.
  - `upgradeCostDamagePoints` (число): стартовая стоимость одного шага апгрейда для этого уровня (см. единая формула стоимости).
  - `atlas` (строка): OPTIONAL — имя атласа для конкретного уровня (например `fence_lvl10.png`). Если отсутствует, движок использует глобальный `atlas`.
  - `spriteKeys` (object, optional): позволяет переопределить id-ы кадров для ключевых частей забора на данном уровне. Ключи: `cornerTL`, `cornerTR`, `cornerBR`, `cornerBL`, `sideTop`, `sideRight`, `sideBottom`, `sideLeft`. Если указаны — движок валидирует что такие id есть в `frames`; при несовпадении происходит fallback на дефолт.

- `frames`: глобальный список rect-ов (как раньше). Это единый список кадров — вне зависимости от `atlas`-а. Переопределение `atlas` меняет только картинку, а `frames` остаются глобальными именами и прямоугольниками.

Repair pricing runtime contract:
- Top-level `repair.costCoinsByLevel` — canonical карта базовой стоимости ремонта по уровням fence (`1..60`). Именно её первой читает `Game.FenceRepair.getConfiguredRepairBaseCost(level)`.
- Если у уровня нет записи в `repair.costCoinsByLevel`, runtime fallback'ится к `levels[level-1].repairCostCoins`, затем к `levels[level-1].repair.costCoins`, и только потом — к legacy `buyTankCost(level)` из `assets/tanks.json`.
- Top-level `repair.costCoins` допустим как legacy-поле данных, но текущий runtime не использует его как primary source of truth. Менять только это поле недостаточно, чтобы поменять фактическую цену ремонта.
- Финальная цена ремонта считается как `baseCost + repairCount * max(1, ceil(baseCost * 0.01))`, где `baseCost` берётся из описанного выше config-first resolution order, а `repairCount` хранится в runtime/save state.

Smoke overlay (опционально):
- Поле `smoke` в `assets/fence.json` (если присутствует) — конфиг для эффекта дыма, который рисуется поверх сломанных (`broken`) сегментов.
  - `frames`: массив `id`-ов кадров (строки) — порядок кадров анимации дыма. Если пуст или отсутствует — smoke выключён.
  - `fps`: частота смены кадров (число) — если `fps <= 0` smoke не рисуется.
  - `offset`: { x, y } — смещение от центра сегмента (пиксели в координатах мира).
  - `scale`: множитель масштаба (по умолчанию 1).

Формулы и поведение (runtime):
- `state.fenceLevel` всегда синхронизируется с `state.maxTankLevelAchieved` (clamp 1..60). При изменении этого поля движок сбрасывает/пересоздаёт `state.fenceSegments` и вызывает `FenceSprites.ensureLevel(level)` чтобы подгрузить per-level atlas и обновить рендер.
- Стены имеют "unlimited" шаги апгрейдов внутри одного уровня. Для каждого уровня хранится массив `player.fenceUpgradesApplied[level-1]` (целые >=0). По умолчанию в `player` создаётся массив длины 60 заполненный нулями.
- Базовые статы (HP/armor) для текущего уровня берутся из `levels[level-1].segmentMaxHp` и `levels[level-1].armorFlat`. Текущие значения рассчитываются как round(base * mul^applied), где `mul` — константы `FENCE_HP_MUL` и `FENCE_ARMOR_MUL`.
- Единая формула стоимости шага апгрейда (используется для стен и пушек): `getUpgradeStepCost(level, appliedIndex)`.
  - Начальная стоимость (`base`) берётся из `levels[level-1].upgradeCostDamagePoints` (если задано) или из таблицы апгрейдов пушек как fallback.
  - Стоимость шага `k` для уже применённого `appliedIndex` вычисляется как `ceil(base * multiplier^appliedIndex)` (движок использует безопасный рост и защиту от переполнения).
  - Если вычисление привело к > Number.MAX_SAFE_INTEGER — апгрейд считается недоступным (и в UI можно показать блокировку).

Fallback-правила:
- Если per-level `atlas` отсутствует или файл не загрузился — используется глобальный `atlas`.
- Если `levels[level-1].spriteKeys` указан, но какие-то id отсутствуют в `frames` — движок откатывается к стандартному поиску `cornerTL` / `sideTop` и т.д., либо к `BAL.fenceSpriteIds`.
- Если `smoke.frames` пустой/нет — smoke не рисуется.

Пример минимального изменения для добавления нового уровня:
- Добавить объект в `levels` с нужными полями (`segmentMaxHp`, `armorFlat`, `upgradeCostDamagePoints`, опционально `atlas` и `spriteKeys`).
- Если нужен smoke — добавить `smoke.frames` в `assets/fence.json` с id-ами, которые присутствуют в `frames`.

Этого достаточно, чтобы движок автоматически подобрал атлас (если он задан) и начал корректно работать с апгрейдами и отрисовкой smoke.

## Обновление 2026-04-21 — shields.png overlay (solo-pipeline-yandex-vk#1)

- В `assets/fence.json` добавлен корневой объект `shields`: `atlas`, `frames[]`, `frameRate`, `scale`, `anchor{x,y}`, `visibleWhile: "defenseActive"`.
- Рантайм: `ShieldSprites` (в `game.js`) грузит атлас в boot после `GroundSprites.load()`. Рендер выполняется в `renderFenceBase` поверх целого сегмента забора, только пока `TalentsV2.isDomeActive(nowMs)` возвращает true.
- Sprite порядок сохранён: `fenceBase → zombies/corpses → fenceHpBars → projectiles/effects`. Shields рисуется внутри fenceBase-фазы, после основного кадра сегмента, но до HP-баров.
- Анимация выбирается по `floor(now / (1000/frameRate)) % frames.length`; размер — через `BAL.fenceWidth` с scale из конфига.

## Обновление 2026-05-24 — procShields overlay + explosionShake (fence-upgrades-rework)

Batch `solo-pipeline-yandex-vk#1`, items 1–3 (fence-upgrades-rework).

### `procShields` root-block

- В `assets/fence.json` добавлен корневой объект `procShields`, параллельный `shields` (не пересекается с активкой «Купол»).
- Контракт полей:
  - `atlas` (строка) — имя файла атласа (placeholder в `assets/fence/proc_shields.png`, art-pass pending; runtime-копия со `shields.png`).
  - `grid` / `frames[]` — порядок кадров анимации, аналогично `shields`.
  - `frameRate` (число) — частота смены кадров.
  - `scale` (число) — множитель размера относительно `BAL.fenceWidth`.
  - `anchor` (`{x,y}`) — точка привязки оверлея к центру сегмента.
  - `visibleWhile` (строка, ожидаемое значение `"immunityActive"`) — runtime-флаг, отличает proc-шилд от dome-шилда.
- Рантайм-гейт: оверлей рисуется на сегменте только пока `segRt.immunityUntilMs > nowMs`. `immunityUntilMs` пишется в `game.js` L2411/L2434 (segRt allocation/reset) и обновляется в `onWallDamage` L3083-3096 при срабатывании `immunityProc` (chance `1%/rank`, длительность `2s`, ICD `15s`).
- Рендер-сим: в `game.js` зеркалит `shields`-путь — отдельный loader `ProcShieldSprites` (preload в boot после `ShieldSprites.load()`), отдельный `drawFenceProcShields()`-проход внутри `renderFenceBase` после основного кадра сегмента, но до HP-баров. Sprite порядок не нарушается: `fenceBase → zombies/corpses → fenceHpBars → projectiles/effects`.
- Cull: рисуется per-segment, без allocations на hot-path; анимация выбирается тем же `floor(now / (1000/frameRate)) % frames.length`.

### `explosionShake` (под `screenShake`)

- В `assets/fence.json` под существующим `screenShake`-блоком добавлено поле `explosionShake` — конфиг для шейка от детонации `def_explosive_base` («Взрывное основание»).
- Семантика: shake-событие от взрыва не добавляется отдельной волной поверх обычного `thresholdShake` от пробоя сегмента, а **сливается** с уже активным screen-shake через max-merge по амплитуде / длительности (предотвращает компаундирование джиттера, когда фрагмент сначала ломается, а затем сразу же детонирует AoE-помеха).
- Поле читается в `game.js` AoE detonation seam (L8902-8938), где helper `applyExplosiveBaseDetonation` уже вернул `hits > 0` и есть подтверждённый взрыв.
- Контракт минимальных значений (placeholder, art-pass pending): `amplitudePx`, `durationMs`, `frequencyHz` — формат идентичен `thresholdShake`, чтобы merge выполнялся компонент-wise.
