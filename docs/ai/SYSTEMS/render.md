# SYSTEM: Render

## Где искать

- Основной рендер и цикл: `game.js` (`draw`, `loop`, `resizeCanvas`).
- Тюнинг зазоров layout: `src/config/layoutTuning.js`.
- Геометрия ангара/треков: `src/render/layout/hangarLayout.js`.
- Геометрия сегментов забора: `src/render/fenceLayout.js`.
- Генерация и раскладка земли: `src/render/groundGen.js`, `src/render/groundLayer.js`.
- Canvas helpers: `src/render/canvasRoot.js`.
- Лимиты качества: `src/perf/mobileMode.js`.

## Что править

- Порядок слоёв и `draw*` — в `draw()`.
- Текущий порядок объектов: `drawZombieFence()` рисуется раньше `drawDecors()`, поэтому decor всегда поверх fence.
- FPS/FX-лимиты — через `Game.MobileMode` и quality-ветки в `loop()`.
- Centerline / road-fence gap — `initBoard`, `drawTankTrack`, `drawZombieFence`.
- Фон-земля через atlas: `drawBackground()` + `rebuildGroundLayer()` в `game.js`.

## Ground layer (atlas tile 16x16)

- Source config: `assets/ground.json`.
- Modes:
	- `mode: manual` — выбор тайла из `manual.grid` (anchor фиксирован как `center`).
	- `mode: procedural` — детерминированный выбор по `seed` через `hash2(seed,x,y)`.
- Fill:
	- `fillMode: repeat` — отрисовка тайлов 1:1.
	- `fillMode: stretch` — integer scale по X/Y до полного покрытия viewport (без дыр/blur).
- Pixel-perfect:
	- `ctx.imageSmoothingEnabled = false` на основном и offscreen canvas.
	- Поворот `rotationDeg` применяется вокруг центра клетки (clockwise).
- Fallback:
	- Если `ground_atlas.png` или `ground.json` не загрузились, используется старый procedural gradient-фон.

### Ground stamps (`assets/ground.json`)

- Pipeline: `assets/ground.json` → `GroundSprites.load()` (`src/render/spriteLoaders.js`) → `groundLayer.rebuild()` (`src/render/groundLayer.js`).
- Stamps рисуются отдельным draw-list после tile draw-list, поэтому всегда поверх ground-тайлов.
- Placement: единая проверка non-overlap по sprite-rect каждого stamp-item (включая composite).
- Coverage rule: рассчитывается `placedTotal / requestedTotal` по всем stamp-set’ам суммарно, целевой порог `>= 0.8`.
- При недоборе `< 0.8` движок не пишет новые `console.*`, а просто рисует успешно размещённые stamps.

### Decor placement (`assets/decor.json`)

- Декор размещается в `initDecors()` (`game.js`) вне fence-radius, с поэтапным расширением области поиска до краёв карты.
- На каждом этапе используется `placementMaxAttempts` попыток (default `40`, см. `assets/decor.json`).
- Placement строгий: соблюдаются `noSpawnZones`, запрет overlap между decor-объектами и запрет захода внутрь fence.
- Runtime доводит размещение до требуемого `count` (из JSON или BAL override) через стадийный annulus + grid/bruteforce fallback с конечными лимитами.

## Layout tuning

- `src/config/layoutTuning.js`:
	- `trackToHangarGapPx = 5` (по умолчанию)
	- `trackToFenceGapPx = 5` (по умолчанию)
- `computeHangarTrackLayout(input)` держит инварианты:
	- `gapHangarToTrack = (tankOrbitRadius - tankTrackWidth/2) - (halfDiag + hangarPad)`
	- `gapTrackToFence = (fenceRadius - fenceWidth/2) - (tankOrbitRadius + tankTrackWidth/2)`
- При нехватке места на маленьком viewport применяется безопасный clamp (без пересечений; приоритет safety над точным `5px`).

## Fence/track и zombie bounds

- Рендер трека использует layout-радиусы напрямую (без отдельного clip по `roadFenceGap`).
- Ограничение зомби привязано к визуальной геометрии забора:
	- `zombieFenceLimit = (fenceRadius + fenceWidth/2)/denom + zombieRadius`
	- эффект: нет «воздушной стены», зомби доходят до визуального забора и скользят вдоль него.
	- Дополнительная тонкая настройка стороны: `LayoutTuning.zombieFenceOffsetPxBySide.{top,right,bottom,left}` (в px, масштабируется через `balScale`).

## Fence sprites layout

- `drawZombieFence()` строит сегменты через `Game.FenceLayout.buildSquareFenceSegments({...})`.
- Базовые формулы шага/инсета: `step=max(6, fenceWidth*1.15)`, `cornerInset=max(4, fenceWidth*0.65)`.
- Для scale-aware раскладки обе формулы умножаются на `frame.scale` (side/corner); side-сегменты ставятся по центрам интервалов между inset-границами (без постановки в точные start/end).
- В каждом углу рисуется ровно один `corner` сегмент; `side` сегменты распределяются между углами без наложения на corner-точки.
- Если в `assets/fence.json` задан `cornerInsetPx`, он переопределяет автозначение inset.
- При отрисовке учитывается `rotation -> rotationDeg -> 0` (градусы).

## Dynamic fence size / segmentsPerSide

- Конфиг: `assets/fence.json`.
	- `segmentsPerSide` — фиксированное число side-сегментов на сторону (углы отдельно).
	- `segmentMaxHp`, `healthBar`, `repair`, `*Broken` frame ids.
- `FenceSprites.config` сохраняется в `src/render/spriteLoaders.js` и используется рантаймом.
- `initBoard()` вычисляет `minFenceRadius` из `segmentsPerSide` + размерности fence-спрайтов и передаёт его в `computeHangarTrackLayout`.
- `computeHangarTrackLayout` держит постоянный `trackToFenceGapPx`; если внешний радиус не помещается в canvas — пишет warning и даёт максимально возможную геометрию.
- Генерация сегментов (`src/render/fenceLayout.js`) создаёт:
	- 4 corner-сегмента,
	- ровно `segmentsPerSide` side-сегментов на каждую сторону,
	- метаданные `id/kind/sideKey/sideIndex/spanStart/spanEnd/holeAabb`.

## Fence durability visuals

- Сегменты хранят `hp/maxHp/broken` в runtime (`state.fenceSegments`).
- При `hp < maxHp` рисуется полоска фиксированного размера:
	- зелёная часть = `round(barW * hp/maxHp)`,
	- оставшаяся часть — серая.
- При `hp <= 0` используется `*Broken` sprite; если broken-frame отсутствует — fallback на intact + warning.

## World Events / Weather

- Конфиг: `src/config/worldEvents.js`.
- По умолчанию всё выключено (`enabled:false`).
- Поддержка погоды: `rain` + `lightning` + `thunder` SFX.
- `weather.lightning.intervalMinSec` / `weather.lightning.intervalMaxSec`: рандомный интервал между вспышками/громом (в секундах, выбирается заново каждый цикл).
- Если `intervalMinSec/intervalMaxSec` не заданы, используется legacy-ветка `chancePerSec`.
- Thunder source поддерживает массив форматов (пример: `['assets/sfx/thunder.ogg','assets/sfx/thunder.wav']`) с fallback по поддержке браузера и последующим fallback при ошибке загрузки файла.
- Rain loop SFX (`rainLoop`) запускается при активной погоде и `rain.enabled !== false`, играет по кругу, останавливается при выключении погоды/дождя; отсутствие файла не ломает игру.
- Атак-цикл зомби:
	- `attackEverySec`, `attackDurationSec`
	- `weatherLeadInSec`: за это время до атаки включается погода
	- `weatherLeadOutSec`: за это время до конца атаки погода выключается
	- Множители на фазе атаки: `targetAliveMult`, `speedMult`, `damageMult`

## Риски

- Не добавлять бизнес-логику в `draw()`.
- Не создавать лишние объекты в hot path.

## Depth sorting (zombies vs decor)

- Для взаимного порядка `zombies` и `decor` используется y-sort: объект с большим `y` рисуется поверх.
- Область применения ограничена только парой `zombies`/`decor` (танки и другие слои не переупорядочиваются этим правилом).
- Для устранения мерцания используется стабильный tie-breaker (`renderOrder` / `id`).

## AttackMode evening dim

- В `attackMode` поверх сцены рисуется лёгкое «вечернее» затемнение.
- Сила затемнения задаётся конфигом `WorldEvents.attackMode.eveningDimAlpha` в диапазоне `0..1`.
- Затемнение активно только когда реально активен `attackMode` (включая debug force attackMode).

## Мини-проверка

- `node Test/pack4/perf_stress.test.js`
- `node Test/pack5/perf_regression.test.js`
- Ручной smoke: resize + 3 минуты боя без артефактов.

## Мини-проверка (Weather/SFX)

- Включить `enabled:true`, `weather.enabled:true` в `src/config/worldEvents.js`: дождь/молнии визуально появляются в бою.
- Для lightning задать `intervalMinSec: 8`, `intervalMaxSec: 20`: вспышки/гром происходят через случайные интервалы в этих границах.
- Для thunder оставить массив `ogg/wav`: в браузерах с поддержкой ogg грузится `ogg`, иначе fallback на `wav`; при отсутствии файла игра продолжает работать.
- Проверить rain loop: при старте погоды звук запускается и лупится; при отключении погоды/дождя звук останавливается.
