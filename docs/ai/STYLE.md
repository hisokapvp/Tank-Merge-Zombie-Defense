# STYLE — обязательные правила

## Код

- Новую логику добавлять в `src/*`; `game.js` не раздувать.
- `draw()` только рисует; бизнес-логика и I/O вне рендера.
- Hot path (`loop`, `draw`, `step*`) без лишних аллокаций; использовать pooling.
- Доступ к `localStorage` через системные модули (`Storage`, `Flags`, `Telemetry`, `Experiments`).

## UI/i18n/a11y

- Все пользовательские строки: `src/i18n/ru.json` + `src/i18n/en.json` синхронно.
- Интерактивные элементы — `button`, модалки — `role="dialog"` + `aria-modal="true"`.
- Новая модалка обязательно интегрируется с `Game.A11y`.

## Доки и проверки

- Любая функциональная правка обновляет `docs/ai/INDEX.md` и затронутый `SYSTEMS/*.md`.
- Перед merge: `bash ci/check_style.sh` и `bash ci/run_tests.sh`.

## DoD

- Код, тесты и документация синхронизированы.
- Нет устаревших путей в `docs/ai/*`.
