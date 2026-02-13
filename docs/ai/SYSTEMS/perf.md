# SYSTEM: Performance

## Где искать

- Mobile/fps caps: `src/perf/mobileMode.js`
- Pooling: `src/perf/objectPool.js`
- Profiling: `src/perf/profiler.js`
- Runtime quality switch: `game.js` (`loop`)

## Что править

- Лимиты FX и caps — в mobileMode + quality-ветках loop.
- Часто создаваемые объекты — переводить на object pool.
- Локальные замеры — через profiler.

## Риски

- Не повышать лимиты без регресс-проверок.
- Не добавлять тяжёлый DOM/I/O в кадр.

## Мини-проверка

- `node Test/pack4/perf_stress.test.js`
- `node Test/pack5/perf_regression.test.js`
