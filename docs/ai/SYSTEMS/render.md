# SYSTEM: Render

## Где искать

- Основной рендер и цикл: `game.js` (`draw`, `loop`, `resizeCanvas`).
- Тюнинг зазоров layout: `src/config/layoutTuning.js`.
- Геометрия ангара/треков: `src/render/layout/hangarLayout.js`.
- Геометрия сегментов забора: `src/render/fenceLayout.js`.
- Canvas helpers: `src/render/canvasRoot.js`.
- Лимиты качества: `src/perf/mobileMode.js`.

## Что править

- Порядок слоёв и `draw*` — в `draw()`.
- FPS/FX-лимиты — через `Game.MobileMode` и quality-ветки в `loop()`.
- Centerline / road-fence gap — `initBoard`, `drawTankTrack`, `drawZombieFence`.

## Layout tuning (PACK 1)

- `src/config/layoutTuning.js`:
	- `trackToHangarGapPx = 5` (по умолчанию)
	- `trackToFenceGapPx = 5` (по умолчанию)
- `computeHangarTrackLayout(input)` держит инварианты:
	- `gapHangarToTrack = (tankOrbitRadius - tankTrackWidth/2) - (halfDiag + hangarPad)`
	- `gapTrackToFence = (fenceRadius - fenceWidth/2) - (tankOrbitRadius + tankTrackWidth/2)`
- При нехватке места на маленьком viewport применяется безопасный clamp (без пересечений; приоритет safety над точным `5px`).

## Fence/track и zombie bounds (PACK 1)

- Рендер трека использует layout-радиусы напрямую (без отдельного clip по `roadFenceGap`).
- Ограничение зомби привязано к визуальной геометрии забора:
	- `zombieFenceLimit = (fenceRadius + fenceWidth/2)/denom + zombieRadius`
	- эффект: нет «воздушной стены», зомби доходят до визуального забора и скользят вдоль него.
	- Дополнительная тонкая настройка стороны: `LayoutTuning.zombieFenceOffsetPxBySide.{top,right,bottom,left}` (в px, масштабируется через `balScale`).

## Fence sprites layout

- `drawZombieFence()` строит сегменты через `Game.FenceLayout.buildSquareFenceSegments({...})`.
- Базовые формулы шага/инсета: `step=max(6, fenceWidth*1.15)`, `cornerInset=max(4, fenceWidth*0.65)`.
- Для scale-aware раскладки обе формулы умножаются на `frame.scale` (side/corner); крайние side-сегменты всегда упираются в угловые inset-границы.
- Если в `assets/fence.json` задан `cornerInsetPx`, он переопределяет автозначение inset.
- При отрисовке учитывается `frame.rotationDeg` (градусы, default `0`).

## Риски

- Не добавлять бизнес-логику в `draw()`.
- Не создавать лишние объекты в hot path.

## Мини-проверка

- `node Test/pack4/perf_stress.test.js`
- `node Test/pack5/perf_regression.test.js`
- Ручной smoke: resize + 3 минуты боя без артефактов.

## Checklist (PACK 1)

- Resize: маленькое / среднее / большое окно — визуально `~5px` ангар↔трек и трек↔забор, без пересечений.
- Zombie fence: нижняя грань / боковая грань / угол — нет пустоты перед забором, нет выхода за забор.

## Изменённые файлы (PACK 1)

- `src/config/layoutTuning.js` (новый)
- `src/render/layout/hangarLayout.js`
- `game.js`

## Команды проверки (факт)

- `node Test/tests.js` → PASS (`76 passed, 0 failed`)
- `bash ci/check_style.sh` → FAIL в текущей среде (`/bin/bash` недоступен)
- `bash ci/run_tests.sh` → FAIL в текущей среде (`/bin/bash` недоступен)
