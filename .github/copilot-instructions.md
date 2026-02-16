# Project Guidelines (Operational)

## Start Here
- Прочитай `docs/ai/INDEX.md` → затем целевой `docs/ai/SYSTEMS/*.md`.
- Точки входа: `index.html`, `game.js`, `src/core/bootstrap.js`.

## Core Rules
- В `src/*`: только IIFE + `'use strict'` + `global.Game.*`; без `import/export`.
- Новую логику клади в `src/*`, не раздувай `game.js`.
- Hot path (`loop`/`draw`/`step*`): без лишних аллокаций; `draw()` только рисует.
- Пользовательские тексты меняй синхронно в `src/i18n/ru.json` и `src/i18n/en.json`.
- Контент держи в `assets/*.json`, не хардкодь в UI.

## Storage & Security
- Не добавляй localStorage-ключи вне: `src/persistence/storage.js`, `src/flags/flags.js`, `src/telemetry/telemetry.js`, `src/experiments/experiments.js`.
- Для офлайн-наград проверяй цепочку: `src/persistence/offlineProgress.js` → `src/ui/offlineModal.js` → `src/ui/continueFlow.js`.
- Debug/admin-функции оставляй за debug-режимом (`src/ui/adminFlags.js`, `?debug=1`).
- Не редактируй `dist/release/staging/*` вручную.

## Validate
- `node Test/tests.js`
- `bash ci/check_style.sh`
- `bash ci/run_tests.sh`

## Docs Update (Required)
- При функциональных правках обновляй `docs/ai/INDEX.md` + затронутый `docs/ai/SYSTEMS/*`.
- Новый повторяемый workflow документируй в `docs/ai/PLAYBOOKS/*`.

## Integration Points
- Analytics/telemetry/funnel/experiments связаны через `Game.*` API (`src/analytics/*`, `src/telemetry/*`, `src/experiments/experiments.js`, `src/flags/flags.js`).
- Offline rewards flow: `src/persistence/offlineProgress.js` → `src/ui/offlineModal.js` → `src/ui/continueFlow.js`.
- Audio/SFX управляется модулем `src/audio/settingsAudio.js` и UI-слайдерами из `index.html`.
- Release/ops интеграции: `ops/monitoring/*`, `ops/release/*`; pre-commit hook запускает style+tests (`hooks/pre-commit`).

## Security
- Проверять любые изменения, которые затрагивают localStorage-ключи и retention (`src/persistence/storage.js`, `src/telemetry/telemetry.js`, `ops/monitoring/telemetry_retention.js`).
- Для релизных изменений учитывать проверку целостности (`ops/release/check_release_integrity.sh`, `Test/pack7/release_integrity.test.js`).
- Debug/admin-функции должны оставаться ограниченными debug-режимом (`src/ui/adminFlags.js`, запуск с `?debug=1`).
- В репозитории нет runtime-секретов; не вводить секреты в код или документацию.