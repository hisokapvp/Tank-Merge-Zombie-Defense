# Copilot Instructions — Tank Merge Zombie Defense

## Область действия

Этот файл применяется только к работе внутри `D:\Tank-Merge-Zombie-Defense`.
Держи инструкции сфокусированными на игровом репозитории, его runtime, его документации и минимальном агентском workflow, необходимом для безопасной поставки изменений здесь.

Не подтягивай несвязанные операционные детали из `c:\Users\hisok\.agents\`, `D:\agent-logs`, dashboards, backups, DuckDB, ChromaDB или другой внешней инфраструктуры, если только задача явно не нацелена на эти системы.

## Обзор проекта

Браузерная 2D HTML5 Canvas-игра с механиками tower-defense и merge.

- Нет build step
- Нет npm
- Нет bundler
- Точка входа: `index.html` загружает scripts, `game.js` владеет bootstrap/game loop/fallback wiring

Не добавляй `package.json`, build pipeline или framework tooling.

## Структура проекта

| Область | Каноническое расположение |
|---|---|
| Entry / bootstrap | `index.html`, `game.js`, `src/core/bootstrap.js` |
| Runtime core | `src/core/runtimeTasks.js`, `src/core/worldReset.js` |
| Mechanics | `src/mechanics/*`, `src/systems/*` |
| Render / input / UI | `src/render/*`, `src/ui/*`, `src/audio/*` |
| Persistence | `src/persistence/*` |
| Config / layout | `src/config/*`, `assets/*.json`, `assets/balance/*.json` |
| Localization | `src/i18n/ru.json`, `src/i18n/en.json` |
| Tests | `Test/*`, `ci/*` |

## Базовые архитектурные правила

- `window.Game.*` — это глобальный runtime API.
- Новая логика должна идти в `src/*`, а не напрямую в `game.js`.
- `game.js` отвечает за bootstrap/fallback wiring; если существует модуль в `src/*`, именно он является каноническим.
- Новые модули следуют существующему паттерну: IIFE + `'use strict'` + export через `global.Game.*`.
- JSON configs в `assets/*.json` являются частью runtime contract, а не пассивными данными.

## Непереговорные инварианты

- Hot-path функции, такие как `loop`, `draw` и `step*`, должны избегать heap allocations.
- `draw()` только рисует; никакой мутации state внутри render functions.
- Все строки, видимые пользователю, должны обновляться одновременно в `src/i18n/ru.json` и `src/i18n/en.json`.
- Используй semantic HTML для DOM UI: интерактивные элементы должны быть `<button>`, dialogs требуют `role="dialog"` и `aria-modal="true"`.
- Порядок рендера сохраняется: `fenceBase → zombies/corpses → fenceHpBars → projectiles/effects`.
- Порог Canvas drag остаётся `6 px` на `pointermove`, чтобы отделять tap от drag.
- Partial reset сохраняет talents, upgrades, drones и achievements; при этом он сбрасывает walls, tank prices и runtime attackMode.
- Spawn в AttackMode использует 3 фиксированных episode directions с распределением `50/25/25%`.
- `dist/release/staging/` — это release mirror, и его нельзя редактировать вручную.

## Что читать перед правкой

Читай в таком порядке:

1. `docs/ai/INDEX.md`
2. `docs/ai/PROJECT_MAP.md`
3. `docs/ai/ARCHITECTURE.md`
4. Релевантный `docs/ai/SYSTEMS/*.md`
5. Если целевой файл большой — соответствующий `docs/ai/*_MAP.md`
6. Релевантный playbook из `docs/ai/PLAYBOOKS/*.md`, если он существует

Высокоприоритетные ссылки:

- `docs/ai/GAME_JS_MAP.md`
- `docs/ai/STYLE_CSS_MAP.md`
- `docs/ai/HANGAR_CHIPS_UI_MAP.md`
- `docs/ai/SUPERCOMPUTER_MENU_MAP.md`
- `docs/ai/SPRITE_LOADERS_MAP.md`
- `docs/ai/PRODUCTION_LINE_RENDER_MAP.md`
- `docs/ai/TALENTS_V2_MAP.md`
- `docs/talents_v2.md`
- `docs/ui_talents_v2.md`

## Сборка и тесты

Используй только существующие repo scripts:

```bash
bash ci/check_style.sh
bash ci/run_tests.sh
bash ci/release_checklist.sh
node Test/tests.js
```

## Минимальный агентский workflow

Сохраняй только операционный минимум, относящийся к этому игровому репозиторию:

- Для нетривиальных задач начинай с `Orchestrator`.
- Игровой код и проектно-специфичную реализацию маршрутизируй через `Programmer` → `tmzd-developer`.
- После изменений кода, документации или config в full-task mode требуется ровно одно обновление `project-docs`.
- В branch mode не запускай shared docs post-processing внутри ветки; вместо этого передай handoff, чтобы он выполнился один раз после merge.
- После завершения задачи используй `Log-Writer` / `session-logger`.

Не включай сюда dashboard operations, storage layouts, backup procedures, database maintenance или инструкции по RAG reindex.

## Чеклист задачи

- Держи изменения в пределах игрового репозитория.
- Предпочитай исправления root cause поверхностным патчам.
- Сохраняй существующее поведение, если задача явно не требует его изменить.
- Не раздувай `game.js`, если изменение должно жить в `src/*`.
- Обновляй docs, когда меняется project contract.
- Перед завершением проверяй результат самым узким релевантным тестом или diagnostic.

# context-mode — MANDATORY routing rules

You have context-mode MCP tools available. These rules are NOT optional — they protect your context window from flooding. A single unrouted command can dump 56 KB into context and waste the entire session.

## BLOCKED commands — do NOT attempt these

### curl / wget — BLOCKED
Any terminal command containing `curl` or `wget` will be intercepted and blocked. Do NOT retry.
Instead use:
- `ctx_fetch_and_index(url, source)` to fetch and index web pages
- `ctx_execute(language: "javascript", code: "const r = await fetch(...)")` to run HTTP calls in sandbox

### Inline HTTP — BLOCKED
Any terminal command containing `fetch('http`, `requests.get(`, `requests.post(`, `http.get(`, or `http.request(` will be intercepted and blocked. Do NOT retry with terminal.
Instead use:
- `ctx_execute(language, code)` to run HTTP calls in sandbox — only stdout enters context

### WebFetch / fetch — BLOCKED
Direct web fetching tools are blocked. Use the sandbox equivalent.
Instead use:
- `ctx_fetch_and_index(url, source)` then `ctx_search(queries)` to query the indexed content

## REDIRECTED tools — use sandbox equivalents

### Terminal / run_in_terminal (>20 lines output)
Terminal is ONLY for: `git`, `mkdir`, `rm`, `mv`, `cd`, `ls`, `npm install`, `pip install`, and other short-output commands.
For everything else, use:
- `ctx_batch_execute(commands, queries)` — run multiple commands + search in ONE call
- `ctx_execute(language: "shell", code: "...")` — run in sandbox, only stdout enters context

### read_file (for analysis)
If you are reading a file to **edit** it → read_file is correct (edit needs content in context).
If you are reading to **analyze, explore, or summarize** → use `ctx_execute_file(path, language, code)` instead. Only your printed summary enters context.

### grep / search (large results)
Search results can flood context. Use `ctx_execute(language: "shell", code: "grep ...")` to run searches in sandbox. Only your printed summary enters context.

## Tool selection hierarchy

1. **GATHER**: `ctx_batch_execute(commands, queries)` — Primary tool. Runs all commands, auto-indexes output, returns search results. ONE call replaces 30+ individual calls.
2. **FOLLOW-UP**: `ctx_search(queries: ["q1", "q2", ...])` — Query indexed content. Pass ALL questions as array in ONE call.
3. **PROCESSING**: `ctx_execute(language, code)` | `ctx_execute_file(path, language, code)` — Sandbox execution. Only stdout enters context.
4. **WEB**: `ctx_fetch_and_index(url, source)` then `ctx_search(queries)` — Fetch, chunk, index, query. Raw HTML never enters context.
5. **INDEX**: `ctx_index(content, source)` — Store content in FTS5 knowledge base for later search.

## Output constraints

- Keep responses under 500 words.
- Write artifacts (code, configs, PRDs) to FILES — never return them as inline text. Return only: file path + 1-line description.
- When indexing content, use descriptive source labels so others can `ctx_search(source: "label")` later.

## ctx commands

| Command | Action |
|---------|--------|
| `ctx stats` | Call the `ctx_stats` MCP tool and display the full output verbatim |
| `ctx doctor` | Call the `ctx_doctor` MCP tool, run the returned shell command, display as checklist |
| `ctx upgrade` | Call the `ctx_upgrade` MCP tool, run the returned shell command, display as checklist |
