# SYSTEM: Render

## Где искать

- Основной рендер и цикл: `game.js` (`draw`, `loop`, `resizeCanvas`).
- Геометрия ангара/треков: `src/render/layout/hangarLayout.js`.
- Canvas helpers: `src/render/canvasRoot.js`.
- Лимиты качества: `src/perf/mobileMode.js`.

## Что править

- Порядок слоёв и `draw*` — в `draw()`.
- FPS/FX-лимиты — через `Game.MobileMode` и quality-ветки в `loop()`.
- Centerline / road-fence gap — `initBoard`, `drawTankTrack`, `drawZombieFence`.

## Риски

- Не добавлять бизнес-логику в `draw()`.
- Не создавать лишние объекты в hot path.

## Мини-проверка

- `node Test/pack4/perf_stress.test.js`
- `node Test/pack5/perf_regression.test.js`
- Ручной smoke: resize + 3 минуты боя без артефактов.
