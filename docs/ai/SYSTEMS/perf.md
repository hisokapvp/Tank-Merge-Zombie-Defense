# SYSTEM: Performance

## Purpose

Поддерживать стабильный FPS и контролируемое потребление памяти на desktop/mobile.

## Быстрый ответ (куда идти)

- Mobile limits/fps caps: `src/perf/mobileMode.js`.
- Object pooling helper: `src/perf/objectPool.js`.
- Профилирование: `src/perf/profiler.js`.
- Runtime quality switch: `game.js` внутри `loop(now)`.

## Key files

- `src/perf/mobileMode.js`
- `src/perf/objectPool.js`
- `src/perf/profiler.js`
- `game.js`

## Entrypoints

- `Game.MobileMode.init()` в `boot()`.
- `loop()` читает `getFpsCap/getFxLevel`.
- `Game.Profiler.measure/wrap` для локальных замеров.

## Data & config

- Mobile settings key: `mobile_mode_settings_v1`.
- Лимиты эффектов в `loop()`:
  - normal: частицы/декали выше
  - low/fx-lite: частицы/декали ниже

## Common edits

1. **Уменьшить нагрузку FX**
   - Корректировать ветки quality в `loop()`.

2. **Добавить пул для churn-объектов**
   - Использовать `Game.ObjectPool.create({ max, create, reset })`.

3. **Измерить узкое место**
   - Обернуть участок через `Game.Profiler.measure('name', fn)`.

4. **Изменить mobile auto-detect**
   - Редактировать `detectMobile()` в `mobileMode.js`.

## Don’t touch / risks

- Не повышай `maxParticles/maxDecals` без регресс-проверки.
- Не добавляй тяжелые вычисления/DOM операции в кадр без guard.
- Не отключай cap/quality fallback на mobile.

## Checks

- `node Test/pack4/perf_stress.test.js`
- `node Test/pack5/perf_regression.test.js`
- Ручной: длительная сессия 5+ минут, мониторить лаги/утечки.
