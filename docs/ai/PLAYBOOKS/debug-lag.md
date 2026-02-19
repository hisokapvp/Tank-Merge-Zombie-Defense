# Плейбук: Диагностика лагов

## Шаги
1. Определить тип лага: постоянный FPS или спайки.
2. Проверить mobile caps и FX-уровень.
3. Профилировать узкие места через `Game.Profiler.measure`.
4. Снизить churn (pooling, лимиты частиц и декалей).

## Проверка
- `node Test/pack4/perf_stress.test.js`
- `node Test/pack5/perf_regression.test.js`
- Ручной бой 35 минут.
