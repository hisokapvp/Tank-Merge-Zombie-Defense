# SYSTEM: Render

## Purpose

Отвечает за отрисовку игрового кадра на canvas, визуальные эффекты и адаптацию качества под производительность.

## Быстрый ответ (куда идти)

- Основной рендер: `game.js` → `draw()` и `draw*` функции.
- Цикл и тайминг: `game.js` → `loop(now)`.
- Resize/DPR: `game.js` `resizeCanvas()` и `src/render/canvasRoot.js`.

## Key files

- `game.js`
- `src/render/canvasRoot.js`
- `src/render/layout/hangarLayout.js`
- `src/render/tankPortrait.js`
- `src/perf/mobileMode.js`
- `style.css` (layout контейнера canvas)

## Entrypoints

- `boot()` запускает `requestAnimationFrame(loop)`.
- `loop(now)` вызывает `draw()` каждый кадр.
- `draw()` вызывает `drawBackground`, `drawBoard`, `drawZombies`, `drawProjectiles`, `drawParticles`, ...

## Data & config

- Баланс и визуальные параметры в `BAL` внутри `game.js`.
- Геометрия ангара/треков считается через `Game.HangarLayout.computeHangarTrackLayout`.
- Для safe-zone используется `BAL.hangarMarginRatio` (доля от меньшей стороны canvas).
- Лимиты качества (`maxParticles`, `maxDecals`) вычисляются в `loop()` по FPS/mobile mode.
- Mobile настройки: `Game.MobileMode` (`getFpsCap`, `getFxLevel`, `getFxScale`).

## Common edits

1. **Изменить порядок слоёв отрисовки**
   - Редактировать `draw()` и порядок вызовов `draw*`.

2. **Добавить новый визуальный слой (например погодный эффект)**
   - Добавить `drawWeather()` и вызывать из `draw()`.
   - Обновить лимиты/качество (при необходимости) в `loop()`.

3. **Подправить масштаб/адаптив canvas**
   - Редактировать `resizeCanvas()` в `game.js`.
   - Если нужен общий helper — синхронизировать с `src/render/canvasRoot.js`.
   - Геометрию ангара и радиусов треков менять в `src/render/layout/hangarLayout.js`.

4. **Клип и скругление ангара**
   - Основной helper пути: `rr()` в `game.js`.
   - Для clip используется `clipRoundedRect()` (имеет fallback через `arcTo`, если `rr` недоступен).

5. **Снизить нагрузку на слабых устройствах**
   - Изменять `src/perf/mobileMode.js` и ветку quality в `loop()`.

## Don’t touch / risks

- Не добавляй сохранение/сеть/бизнес-логику в `draw()`.
- Не создавай массивы/объекты в горячем цикле без необходимости.
- Не меняй резко порядок update/draw без проверки регрессов UI и hit-test.

## Checks

- Ручной сценарий: 3–5 минут игры, проверить FPS, артефакты, видимость UI.
- Тесты: `node Test/pack4/perf_stress.test.js`, `node Test/pack5/perf_regression.test.js`.
- Smoke: resize окна, verify корректный scale и hitboxes.
