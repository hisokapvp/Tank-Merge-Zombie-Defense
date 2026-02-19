# Стиль изменений (обязательно)

## Код
- В `src/*`: только IIFE, `'use strict'`, `global.Game.*`; без `import/export`.
- Исправлять причину проблемы, не симптом.
- Не менять публичные API и формат данных без необходимости.

## UI/i18n
- Пользовательские строки менять синхронно: `src/i18n/ru.json` и `src/i18n/en.json`.
- Контент хранить в `assets/*.json`, не хардкодить в UI.

## Хранилище и безопасность
- Новые `localStorage`-ключи только через: `src/persistence/storage.js`, `src/flags/flags.js`, `src/telemetry/telemetry.js`, `src/experiments/experiments.js`.
- Debug/admin-функции  только в debug-режиме (`?debug=1`).

## Проверки
- `node Test/tests.js`
- `bash ci/check_style.sh`
- `bash ci/run_tests.sh`
