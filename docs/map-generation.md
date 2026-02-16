# Map Generation

## Определения

- **stamps** — дополнительные спрайты из `assets/ground.json`, рисуемые поверх базовых ground tiles.
- **decor** — декоративные объекты из `assets/decor.json`, размещаемые в world-space и участвующие в запрете overlap.
- **noSpawnZones** — запретные зоны для decor-генератора (`circle`/`rect`), проверяются при каждом placement-кандидате.

## Где настраивается

- Stamps: `assets/ground.json` → `stamps[]`.
- Decor: `assets/decor.json` → `count`, `spriteIds`, `noSpawnZones`, `placementMaxAttempts`.
- Runtime:
  - загрузка конфигов: `src/render/spriteLoaders.js`
  - stamps placement/draw: `src/render/groundLayer.js`
  - decor placement: `game.js` (`initDecors`)

## Seed-поля

- `assets/ground.json.seed` — seed только для **stamps placement**; не влияет на выбор базовых ground-tiles из `procedural.seed`.
- `assets/decor.json.seed` — seed только для **decor placement**.
- `assets/ground.json.procedural.seed` — seed для procedural ground tile pattern (отдельный контур, не placement stamps/decor).
- В `stamps[]` дополнительно поддерживаются диапазоны:
  - `rotationDegMin`, `rotationDegMax`
  - `scaleMin`, `scaleMax`
  - `placementMaxAttempts` (опционально, alias для per-set лимита попыток).

## Правила stamps

- Stamps проходят pipeline: JSON → placement → stamp draw-list.
- Отрисовка stamps идёт **после** ground tile draw-list, поэтому stamps всегда поверх ground tiles.
- Placement выполняется детерминированно от `ground.json.seed`.
- Алгоритм:
  1. Собираются `requests` (экземпляры по `count`).
  2. `requests` перемешиваются seeded `shuffle` (чтобы не было «строя»).
  3. Для каждого request seeded-образом выбираются: позиция, `rotationDeg`, `scale`.
  4. Collision проверяется по **AABB после rotation/scale** (strict non-overlap по AABB).
  5. Soft fallback: при серии фейлов scale уменьшается шагами до `scaleMin` без смены seed.
- Считается суммарное покрытие по всем set’ам:
  - `requestedTotal` — сумма требуемых экземпляров (`count`) по всем stamp-set’ам;
  - `placedTotal` — фактически размещённые экземпляры;
  - цель: `placedTotal / requestedTotal >= 0.8`.
- Если coverage < 0.8:
  - новых `console.log/warn` не добавляется;
  - движок рисует только успешно размещённые stamps.
- Невалидные диапазоны (`min > max`) нормализуются swap/clamp без падения.

## Правила decor

- Итоговая цель — разместить ровно `count` объектов без overlap.
- Placement детерминирован от `decor.json.seed`.
- Ограничения placement-кандидата:
  - не попадать в `noSpawnZones`;
  - не пересекаться с уже размещёнными decor (по их block radius);
  - не попадать внутрь fence-зоны (спавн снаружи fence).
- Стратегия поиска:
  1. Пошаговое расширение annulus-области (снаружи fence) к краям карты.
  2. На каждом шаге — ограниченное число попыток.
  3. Если не найдено место — grid fallback по карте.
  4. Если всё ещё не найдено — bounded bruteforce fallback.
- Все fallback-этапы конечные (без бесконечного цикла).

## `placementMaxAttempts`

- Файл: `assets/decor.json`
- Поле: `placementMaxAttempts`
- Тип: `int`
- Default: `40`
- Значение: число попыток размещения **на стадию/область** для каждого decor-объекта.

## Save/load seeds

- В runtime-state хранится `mapSeeds`:
  - `state.mapSeeds.stampsSeed`
  - `state.mapSeeds.decorSeed`
- В save payload (`src/persistence/storage.js`, `serializeState(state)`) сериализуется `mapSeeds`.
- При load, если `mapSeeds` есть в сейве, placement использует seed из сейва и не перетирается значениями из `assets/*.json`.
- Детерминизм `save → load` гарантируется при неизменных входных конфигах (`assets/ground.json`, `assets/decor.json`).

## Почему возможен/невозможен недобор

- Для stamps допустим частичный недобор при плотной геометрии/ограниченной области placement; это контролируется coverage-правилом 80%.
- Для decor используется строгая стратегия с расширением области и fallback’ами, поэтому при валидном `count` и геометрии карта должна достигать требуемого количества.
- Если нужен больший шанс размещения в плотных сценах, увеличивайте `placementMaxAttempts`.

## Мини-чеклист детерминизма

- Зафиксировать `assets/ground.json.seed`, перезапустить игру 2+ раза: stamps визуально/по координатам совпадают.
- Зафиксировать `assets/decor.json.seed`, перезапустить игру 2+ раза: decor визуально/по координатам совпадают.
- Выполнить `save → reload`: раскладка stamps/decor не меняется.
- Проверить кейс с `rotationDegMin > rotationDegMax` или `scaleMin > scaleMax`: падений нет, placement продолжается.
