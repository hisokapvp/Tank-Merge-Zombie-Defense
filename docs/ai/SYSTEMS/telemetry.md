# Система: Telemetry / Analytics / Flags

## Где править
- Сбор: `src/analytics/collector.js`, `src/analytics/funnel.js`
- Телеметрия: `src/telemetry/*`
- Флаги/эксперименты: `src/flags/flags.js`, `src/experiments/experiments.js`

## Правила
- Новые события именовать стабильно и документировать в PR.
- Retention и очистку согласовывать с `ops/monitoring/telemetry_retention.js`.
- Debug-события не смешивать с production-потоком.
