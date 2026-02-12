# PLAYBOOK: Диагностика лагов (Debug lag)

## Когда использовать

FPS проседает, появляются микрофризы или рост времени кадра.

## Шаги

1. Локализуй симптом:
   - постоянный low FPS
   - редкие spike
   - лаг только на mobile
2. Проверить mobile/FX параметры (`Game.MobileMode.getFpsCap/getFxLevel`).
3. Обернуть подозрительные блоки через `Game.Profiler.measure`.
4. Проверить churn-коллекции (`particles`, `impacts`, `decals`) и лимиты в `loop()`.
5. При необходимости вынести hot-path объекты в `Game.ObjectPool`.

## Какие файлы обычно править

- `game.js`
- `src/perf/mobileMode.js`
- `src/perf/profiler.js`
- `src/perf/objectPool.js`

## Проверки

- `node Test/pack4/perf_stress.test.js`
- `node Test/pack5/perf_regression.test.js`
- Ручной профиль: 3–5 минут боя на насыщенной сцене.

## Типовые ловушки

- Оптимизация только desktop-пути без mobile guard.
- Добавление новых эффектов без quality fallback.
