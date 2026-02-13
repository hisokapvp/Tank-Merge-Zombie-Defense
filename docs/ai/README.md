# AI-Agent Doc Pack

Краткий пакет документации для ИИ-агентов. Цель: минимум токенов, максимум навигации.

## Порядок чтения

1. `docs/ai/INDEX.md` — куда идти по задаче.
2. `docs/ai/SYSTEMS/<system>.md` — точные файлы и риски.
3. `docs/ai/PLAYBOOKS/<task>.md` — пошаговый шаблон изменения.
4. `docs/ai/STYLE.md` — ограничения и DoD.

## Что важно помнить

- Runtime entry: `index.html` → `game.js` (`boot`, `loop`, `draw`).
- Доменная логика в `src/*`; `game.js` — orchestration.
- UI-тексты менять синхронно в `src/i18n/ru.json` и `src/i18n/en.json`.
- `dist/release/staging/*` не редактируется вручную.

## Где что лежит

- Карта: `docs/ai/INDEX.md`
- Архитектура: `docs/ai/ARCHITECTURE.md`
- Системы: `docs/ai/SYSTEMS/*`
- Типовые операции: `docs/ai/PLAYBOOKS/*`
- Машинный индекс: `docs/ai/index.yaml`
