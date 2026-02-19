# Вклад в проект

## Перед PR
- Прогонить: `bash ci/check_style.sh`
- Прогонить: `bash ci/run_tests.sh`
- При релизных изменениях: `bash ci/release_checklist.sh`

## Обязательные правила
- Новую логику добавлять в `src/*`, не раздувать `game.js`.
- Пользовательские тексты менять синхронно в `src/i18n/ru.json` и `src/i18n/en.json`.
- Не редактировать `dist/release/staging/*` вручную.

## Документация для обновления
- `docs/ai/INDEX.md`
- Затронутый файл в `docs/ai/SYSTEMS/*`
- Для типовой новой операции  файл в `docs/ai/PLAYBOOKS/*`
