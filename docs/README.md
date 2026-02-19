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
- Supercomputer UI flow: `index.html` (`#supercomputerBtn`, overlays) + `src/ui/supercomputerMenu.js` + `game.js` (canvas hit-test, pause lock integration)
- `src/lessons` + `src/scheduler` + `src/tools/anki` — контур обучения (уроки, SRS, export)
- `src/feedback/widget.js` — in-game feedback с локальным хранением
- `assets/` — конфиги и спрайты
- `Test/` — регрессионные тесты

## Damage Points

- Счётчик сырого урона: `state.totalDamageDealtRaw` (int, default `0`).
- Формула UI-значения: `damagePoints = max(0, floor(totalDamageDealtRaw / 10000) - damagePointsSpent)`.
- Источник учёта: только applied damage по зомби от источника `tank` (без overkill).
- Хранение: `totalDamageDealtRaw`, `damagePointsSpent`, `fenceLevel` в save payload (`progress`), backward-compatible загрузка старых сейвов.

## Настройки звука

- Хранилище: `localStorage['settings']`.
- Поля: `settings.sfxVolume`, `settings.musicVolume` (нативный формат `0..1`).
- UI-формат в меню: `0..100%`.
- Применение изменения: live на `input`, затем persist в тот же `settings`.

## Fence levels

- Текущий уровень стен: `state.fenceLevel` (default `1`).
- Конфиг уровней: `assets/fence.json -> levels[]`.
- Fallback: если `levels[]` отсутствует/пуст, используется legacy `segmentMaxHp` как уровень 1 с `armorFlat=0`, без апгрейда.
- Урон забору: `finalDamage = max(0, incomingDamage - armorFlat)`.

## Debug

- Запуск с `?debug=1`
- Горячие клавиши preview: `P`, `A/←`, `D/→`, `V`
