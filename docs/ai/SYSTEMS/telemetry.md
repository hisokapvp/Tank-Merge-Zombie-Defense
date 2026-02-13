# SYSTEM: Telemetry / Analytics / Flags

## Где искать

- Базовая телеметрия: `src/utils/telemetry.js`
- Лог/экспорт: `src/telemetry/telemetry.js`
- Funnel: `src/analytics/funnel.js`
- Flags/experiments: `src/flags/flags.js`, `src/experiments/experiments.js`

## Что править

- Новая метрика: добавить emit в runtime и при необходимости в logger/export.
- Новый flag/experiment: `DEFAULT_FLAGS` или `DEFAULT_EXPERIMENTS` + чтение через API.

## Риски

- Не ломать форматы export.
- Не удалять существующие storage-ключи без миграции.
- Не писать тяжёлые логи в каждом кадре.

## Мини-проверка

- `node Test/pack2/telemetryExport.test.js`
- `node Test/pack6/flags.test.js`
