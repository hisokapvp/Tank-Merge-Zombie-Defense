# Project Guidelines

## Автотриггер: когда обязательно запускать навигацию через `bibliotekar`

Считай запрос **"запросом на правки"** и запускай `bibliotekar`, если пользователь просит:
- **изменить/добавить/удалить/пофиксить/переделать** что-то в игре или проекте;
- поменять **баланс/значения** (урон, HP, скорость, цены, проценты, спавн, тайминги и т.п.);
- правки в **UI/текстах/локализации/ассетах/конфигах/таблицах/тестах/документации**;
- рефакторинг, оптимизацию, исправление багов, “сделай как раньше/по-другому”.


### Обязательный pipeline для "запроса на правки"
0) **Нормализуй ТЗ в список пунктов `items[]`:**
   - если запрос однофразный — это `items[0]`;
   - если много пунктов/список — вынеси каждый пункт отдельной строкой (без перефразирования смысла).
1) **СНАЧАЛА используй skill `bibliotekar`** и передай ему:
   - исходный текст пользователя как `rawText`;
   - `items[]` (если удалось выделить пункты);
   - `repo.localPath` = корень текущего workspace (если не уверен — `"."`), либо `repo.url`.
2) `bibliotekar` возвращает **ТОЛЬКО JSON** с `targets` (file/anchor/hints/conf).
3) Сразу после ответа `bibliotekar`:
   - сгруппируй `targets` по пунктам ТЗ (см. префиксы **P1/P2/...** в `anchor`/`hints`);
   - выпиши короткий **Working set**: *пункт → файлы/якоря/поисковые подсказки*.
4) **Открой** файлы/доки из `targets` (приоритет: `conf` выше), найди места по `anchor` и `hints`.
5) Только после чтения нужных мест — **вноси правки** и обновляй тесты/доки по конвенциям проекта.

---

## Navigation (обязательно перед любыми правками)
- **Сначала используй skill `bibliotekar`**, чтобы определить, **какие документы/файлы** нужно открыть для каждого пункта ТЗ.
- `bibliotekar` возвращает **ТОЛЬКО JSON** с `targets` (file/anchor/hints/conf). Дальше:
  1) Открой файлы/доки из `targets` (приоритет: `conf` выше).
  2) Используй `anchor` + `hints` как поисковые запросы по коду.
  3) После чтения нужных мест — переходи к реализации.

- В `repo` можно указывать:
  - `repo.localPath` (локально, например `D:\Tank-Merge-Zombie-Defense`)
  - или `repo.url` (remote)
- **Важно:** `bibliotekar` **не задаёт уточняющих вопросов** — всегда best-guess.

### Fallback (если skill недоступен/не подхватился)
- Тогда используй старый порядок:
  1) `docs/ai/INDEX.md`
  2) `docs/ai/ARCHITECTURE.md`
  3) профильный `docs/ai/SYSTEMS/*.md`
  4) и `docs/ai/PLAYBOOKS/*` для типовых задач.

---

## Code Style
- В `src/*` используй только IIFE + `'use strict'` + `global.Game.*`; без `import/export`.
- Новую логику добавляй в `src/*`, не раздувай `game.js`; точки входа: `index.html`, `game.js`, `src/core/bootstrap.js`.
- На hot path (`loop`/`draw`/`step*`) избегай лишних аллокаций; `draw()` должен только рисовать.
- Пользовательские строки меняй синхронно в `src/i18n/ru.json` и `src/i18n/en.json`.
- Контент/баланс держи в `assets/*.json`, не хардкодь данные в UI.

## Architecture
- Слои: домен (`src/mechanics/*`, `src/systems/*`, `src/persistence/*`), рендер/ввод (`src/render/*`, `src/ui/*`, `src/audio/*`), поддержка (`src/analytics/*`, `src/telemetry/*`, `src/flags/*`, `src/experiments/*`).
- `src/core/bootstrap.js` связывает DOM и runtime через `Game.*` API (continue flow, UI-события, audio sliders).
- Поток офлайн-наград: `src/persistence/offlineProgress.js` → `src/ui/offlineModal.js` → `src/ui/continueFlow.js`.
- Для системной ориентации используй `docs/ai/ARCHITECTURE.md` и целевые файлы в `docs/ai/SYSTEMS/*`.
- Для быстрого исследования `game.js` см. карту файла: `docs/ai/GAME_JS_MAP.md` — в ней перечислены ключевые функции и примерные диапазоны строк, где они находятся.

## Build and Test
- Основные проверки: `node Test/tests.js`, `bash ci/check_style.sh`, `bash ci/run_tests.sh`.
- Полный локальный прогон: `bash hooks/pre-commit` (style + все test packs).
- Релизные проверки: `bash ci/release_checklist.sh`, `bash ops/release/build_release.sh`, `bash ops/release/post_release_checks.sh`, `bash ops/release/check_release_integrity.sh <zip_path>`.
- Ops-мониторинг: `node ops/monitoring/health_check.js --root .`, `node ops/monitoring/telemetry_retention.js --self-test`.
- На Windows для `bash`-скриптов используй Git Bash/WSL; `node ...` команды кроссплатформенные.
- Если в WSL ошибка `execvpe(/bin/bash) failed`, проверь наличие bash в дистро или используй:
  `& "C:\Program Files\Git\bin\bash.exe" -lc "./ci/run_tests.sh"` в PowerShell.
- При написании новых тестов в `Test/*` всегда мокай глобалы (`window`, `Game`, `BAL`, `center`) для Node-окружения.

## Project Conventions
- При функциональных изменениях обновляй `docs/ai/INDEX.md` и затронутый `docs/ai/SYSTEMS/*`.
- Новый повторяемый workflow документируй в `docs/ai/PLAYBOOKS/*`.
- Новые `localStorage`-ключи добавляй только в: `src/persistence/storage.js`, `src/flags/flags.js`, `src/telemetry/telemetry.js`, `src/experiments/experiments.js`.
- Debug/admin-функции оставляй только в debug-режиме (`src/ui/adminFlags.js`, `?debug=1`).
- Не редактируй вручную `dist/release/staging/*`.

## Integration Points
- Analytics/Funnel/Telemetry/Experiments интегрируются через `Game.*` API: `src/analytics/*`, `src/telemetry/*`, `src/experiments/experiments.js`, `src/flags/flags.js`.
- Audio/SFX централизованы в `src/audio/settingsAudio.js`; UI-контролы находятся в `index.html` и wiring в `src/core/bootstrap.js`.
- Offline progress интегрируется с continue flow через `src/persistence/offlineProgress.js` и `src/ui/*`.
- Ops/release контур: `ops/monitoring/*`, `ops/release/*`, плюс автопроверки в `Test/pack7/*`.

## Security
- Любыe изменения, затрагивающие storage/retention, считаются чувствительными: проверяй `src/persistence/storage.js`, `src/telemetry/telemetry.js`, `ops/monitoring/telemetry_retention.js`.
- Для релизных изменений обязательно сохраняй `ops/release/check_release_integrity.sh` и `Test/pack7/release_integrity.test.js` зелёными.
- Не ослабляй debug gating для admin/debug UI (`src/ui/adminFlags.js`, запуск с `?debug=1`).
- Не добавляй runtime-секреты в код, ассеты или документацию.
