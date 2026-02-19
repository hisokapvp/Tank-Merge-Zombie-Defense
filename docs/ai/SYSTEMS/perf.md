# Система: Performance

## Где править
- Профилирование: `src/perf/profiler.js`
- Пулы: `src/perf/objectPool.js`
- Мобайл-режим: `src/perf/mobileMode.js`

## Правила
- Любые изменения в `loop`/`draw`/`step*` делать без мусора в куче.
- Проверять CPU/GPU-нагрузку и частоту кадров на слабых устройствах.
