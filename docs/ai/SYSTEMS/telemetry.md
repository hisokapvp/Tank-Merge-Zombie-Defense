# SYSTEM: Telemetry / Analytics / Flags

## Где искать

- Базовая телеметрия: `src/utils/telemetry.js`
- Event bridge: `src/utils/eventTelemetry.js`
- Лог/экспорт: `src/telemetry/telemetry.js`
- Агрегация и экспорт summary: `src/analytics/collector.js`
- Funnel: `src/analytics/funnel.js`
- Flags/experiments: `src/flags/flags.js`, `src/experiments/experiments.js`
- Debug-панели для анализа: `src/ui/analyticsPanel.js`, `src/ui/funnelPanel.js`, `src/ui/experimentsPanel.js`, `src/ui/adminFlags.js`
- Bug triage: `src/ui/bugTriage.js`
- Feedback telemetry hooks: `src/feedback/widget.js`

## Что править

- Новая метрика: добавить emit в runtime и при необходимости в logger/export.
- Новый flag/experiment: `DEFAULT_FLAGS` или `DEFAULT_EXPERIMENTS` + чтение через API.
- Новый funnel step: добавить в `STEPS`, track в runtime (`boot/merge/upgrade/...`).
- Новый debug export: добавлять в панели, не ломая JSON/CSV формат export.
- Для экспериментов: `getVariant()` в gameplay-коде + `attachTelemetry()` для auto `exp` payload.

## Риски

- Не ломать форматы export.
- Не удалять существующие storage-ключи без миграции.
- Не писать тяжёлые логи в каждом кадре.
- Не забывать debug-gate (`?debug=1`) у debug-панелей.
- Не создавать дублирующиеся события (`TelemetryLogger` + `AnalyticsCollector`) без необходимости.

## Мини-проверка

- `node Test/pack2/telemetryExport.test.js`
- `node Test/pack6/flags.test.js`
- Ручной smoke: `?debug=1` → экспорт analytics/funnel/triage JSON работает.
