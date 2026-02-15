# Tank Merge: Zombie Defense

Merge + tower defense на canvas.

## Быстрый старт

1. Открыть `index.html` в браузере
2. Или `npx serve .` и открыть `http://localhost:3000`

## Для ИИ-агентов

- Главная карта: `docs/ai/INDEX.md`
- Правила правок: `docs/ai/STYLE.md`
- Системные доки: `docs/ai/SYSTEMS/*`
- Шаблоны задач: `docs/ai/PLAYBOOKS/*`

## Для разработчиков

- Вклад в проект: `docs/CONTRIBUTING.md`
- Код-стайл: `docs/CODE_STYLE.md`
- Релизные операции: `ops/release/README.md`

## Основные команды

```bash
node Test/tests.js
bash ci/check_style.sh
bash ci/run_tests.sh
bash ci/release_checklist.sh
```

## Короткая карта проекта

- `game.js` — orchestration (`boot`, `loop`, `draw`)
- `src/` — доменные модули (mechanics/ui/persistence/render/perf/...)
- `src/lessons` + `src/scheduler` + `src/tools/anki` — контур обучения (уроки, SRS, export)
- `src/feedback/widget.js` — in-game feedback с локальным хранением
- `assets/` — конфиги и спрайты
- `Test/` — регрессионные тесты

## Debug

- Запуск с `?debug=1`
- Горячие клавиши preview: `P`, `A/←`, `D/→`, `V`
