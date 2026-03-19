# copilot-instructions.md (копия)

Оригинал находится в `.github/copilot-instructions.md` и должен оставаться на месте для tooling.

Краткая выжимка актуального контракта:

- Область действия ограничена `D:\Tank-Merge-Zombie-Defense`.
- Не подтягивать несвязанную инфраструктуру из `.agents`, `D:\agent-logs`, dashboard, backup, DuckDB, ChromaDB и других внешних систем, если задача явно не про них.
- Проект — браузерная 2D HTML5 Canvas-игра без build step, npm и bundler.
- Точки входа: `index.html`, `game.js`, `src/core/bootstrap.js`.
- Канонические зоны кода: runtime core — `src/core/*`, mechanics — `src/mechanics/*` и `src/systems/*`, render/input/UI — `src/render/*`, `src/ui/*`, `src/audio/*`, persistence — `src/persistence/*`, config/data — `src/config/*` и `assets/*.json`.
- `window.Game.*` остаётся глобальным runtime API.
- Новую логику добавлять в `src/*`, а не напрямую в `game.js`; сам `game.js` остаётся bootstrap/fallback wiring.
- Новые модули следуют паттерну IIFE + `'use strict'` + export через `global.Game.*`.
- Hot-path функции `loop`, `draw`, `step*` не должны делать лишние heap allocations.
- `draw()` только рисует и не мутирует state.
- Все пользовательские строки обновлять одновременно в `src/i18n/ru.json` и `src/i18n/en.json`.
- DOM UI должен сохранять semantic HTML: интерактивные элементы — `<button>`, dialogs — с `role="dialog"` и `aria-modal="true"`.
- Инварианты runtime: render order `fenceBase → zombies/corpses → fenceHpBars → projectiles/effects`, drag threshold `6 px`, partial reset сохраняет talents/upgrades/drones/achievements, AttackMode spawn использует фиксированное распределение `50/25/25%`.
- `dist/release/staging/*` — release mirror; вручную не редактируется.
- Перед правкой сначала читать `docs/ai/INDEX.md`, затем `docs/ai/PROJECT_MAP.md`, `docs/ai/ARCHITECTURE.md`, после этого релевантные `docs/ai/SYSTEMS/*.md`, map-файлы и playbooks.
- Для нетривиальных задач workflow остаётся минимальным: `Orchestrator` → `Programmer` → `tmzd-developer`; после изменений кода, документации или config в full-task mode нужен ровно один `project-docs` update, а в branch mode shared docs pass делается только после merge.
