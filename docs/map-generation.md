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

## Правила stamps

- Stamps проходят pipeline: JSON → placement → stamp draw-list.
- Отрисовка stamps идёт **после** ground tile draw-list, поэтому stamps всегда поверх ground tiles.
- Placement выполняется с единым non-overlap правилом по stamp sprite-rect.
- Считается суммарное покрытие по всем set’ам:
  - `requestedTotal` — сумма требуемых экземпляров (`count`) по всем stamp-set’ам;
  - `placedTotal` — фактически размещённые экземпляры;
  - цель: `placedTotal / requestedTotal >= 0.8`.
- Если coverage < 0.8:
  - новых `console.log/warn` не добавляется;
  - движок рисует только успешно размещённые stamps.

## Правила decor

- Итоговая цель — разместить ровно `count` объектов без overlap.
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

## Почему возможен/невозможен недобор

- Для stamps допустим частичный недобор при плотной геометрии/ограниченной области placement; это контролируется coverage-правилом 80%.
- Для decor используется строгая стратегия с расширением области и fallback’ами, поэтому при валидном `count` и геометрии карта должна достигать требуемого количества.
- Если нужен больший шанс размещения в плотных сценах, увеличивайте `placementMaxAttempts`.
