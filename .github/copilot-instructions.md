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
