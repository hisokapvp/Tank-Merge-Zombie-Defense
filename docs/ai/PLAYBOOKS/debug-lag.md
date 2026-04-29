# Плейбук: Диагностика лагов

## Шаги
1. Определить тип лага: постоянный FPS или спайки.
2. Проверить mobile caps и FX-уровень.
3. Профилировать узкие места через `Game.Profiler.measure`.
4. Снизить churn (pooling, лимиты частиц и декалей).

## Perf инструменты (solo-pipeline-yandex-vk#1)

- `Game.Profiler.setBudgets({stepProjectiles: 2.5, impactAt: 1.5, drawZombies: 3.0, drawTank: 2.0, chipEffectsSpawn: 1.0})` — миллисекунды на фазу. Превышение бюджета эмитит `perf.budget.exceeded` через `Game.Events`.
- `Game.Events.on('perf.budget.exceeded', ({phase, ms, budget, count}) => console.warn(phase, ms, '>', budget))` — подписка на регрессии.
- Markers (`Game.Profiler.start/end`) активны только при `Game.DEBUG === true`. В release/staging/dist всё выключено и оверхед нулевой.
- `Game.Sprites.bumpAtlasVersion(reason)` — вручную инвалидировать spriteRefCache (например, после hot-reload атласа). `worldReset` partial вызывает это автоматически.
- `Game.ChipEffects.shouldSpawnEffect(type, x, y, nowSec)` — visual-only spatial dedup для chip-эффектов; damage/duration активного эффекта остаётся за authoritative tick'ом.
- `assets/balance.json` → `perf.gridBucketWarmup` (default 16, hardcoded cap 32) — warm-up zombie-grid bucket pool на старте, гасит alloc-spike первой большой волны.

## Проверка
- `node Test/pack4/perf_stress.test.js`
- `node Test/pack5/perf_regression.test.js`
- Ручной бой 35 минут.
