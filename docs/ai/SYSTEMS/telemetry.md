# SYSTEM: Telemetry / Analytics / Flags

## Purpose

Собирает локальные метрики, журнал событий, funnel/analytics, а также управляет фичами через flags и experiments.

## Быстрый ответ (куда идти)

- Базовая телеметрия с debug widget: `src/utils/telemetry.js`.
- Event log/export: `src/telemetry/telemetry.js`.
- Funnel и агрегация: `src/analytics/funnel.js`, `src/analytics/collector.js`.
- Rollout/AB: `src/flags/flags.js`, `src/experiments/experiments.js`.

## Key files

- `src/utils/telemetry.js`
- `src/telemetry/telemetry.js`
- `src/analytics/funnel.js`
- `src/analytics/collector.js`
- `src/flags/flags.js`
- `src/experiments/experiments.js`
- `ops/monitoring/telemetry_retention.js`

## Entrypoints

- В `boot()` вызываются `Flags.init`, `Experiments.init`, `Funnel.init`, `TelemetryLogger.init`.
- В `loop()` обновляются gauges (`coins`, `kills`, `fps`, ...).
- Эксперименты патчат `TelemetryLogger.log` через `attachTelemetry()`.

## Data & config

- localStorage ключи:
  - `telemetry_lifetime`
  - `telemetry_log`
  - `analytics_summary_v1`
  - `funnel_progress_v1`
  - `feature_flag_overrides`
  - `experiments_assignments_v1`

## Common edits

1. **Добавить новую бизнес-метрику**
   - `Telemetry.event/gauge/max` в нужном runtime месте.
   - При необходимости продублировать в `TelemetryLogger.log`.

2. **Добавить новый funnel step**
   - `STEPS` + вызов `trackStep` в нужном событии.

3. **Добавить feature flag**
   - `DEFAULT_FLAGS` в `flags.js`.
   - Проверка через `Game.Flags.get(flagName)` в логике.

4. **Добавить A/B эксперимент**
   - `DEFAULT_EXPERIMENTS` в `experiments.js`.
   - Использовать `Game.Experiments.getVariant(id)`.

## Don’t touch / risks

- Не ломай форматы export (`json/csv`) без обновления потребителей.
- Не удаляй существующие localStorage ключи без миграции.
- Не включай high-frequency heavy logs в hot loop.

## Checks

- `node Test/pack2/telemetryExport.test.js`
- `node Test/pack7/analytics_aggregation.test.js`
- `node Test/pack6/flags.test.js`
- `node Test/pack6/telemetryRetention.test.js`
