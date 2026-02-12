# CHANGELOG (A2DP)

## 2026-02-12

- Создан базовый пакет `docs/ai/*` для навигации агента.
- Добавлены карты: `README.md`, `INDEX.md`, `ARCHITECTURE.md`, `STYLE.md`.
- Добавлены системные страницы (`SYSTEMS/*`): render/input/ui/assets/combat/save/telemetry/perf.
- Добавлены playbooks (`PLAYBOOKS/*`) для типовых изменений.
- Добавлен машинно-читаемый индекс `docs/ai/index.yaml`.
- Обновлены `INDEX.md`, `SYSTEMS/ui.md`, `SYSTEMS/save.md`:
	- для offline modal добавлен reference на settings modal как UI-эталон;
	- зафиксировано правило RU/EN always для UI-текстов;
	- добавлены проверки для `Money/Деньги`, иконок `$` и `⭐`, и layout (центр блока + кнопка снизу).
- PACK 2: добавлен `src/render/layout/hangarLayout.js` для track-safe расчёта радиусов ангара/треков с `marginRatio` от canvas.
- PACK 2: `drawFence()` использует `clipRoundedRect()` с fallback clip скруглённого прямоугольника.
- PACK 2: в `assets/fence.json` добавлено поле `frames[].scale` (включая `0.75` для side-кадров), scale применяется в рендере без clamp.
- PACK 2: учёт fence scale добавлен в `zombieFenceLimit()`, сегменты забора пересобираются при изменении геометрии.

## Формат записей

- Дата
- Что добавлено/перенесено
- Какие SYSTEM/PLAYBOOK обновлены
- Что deprecated (если есть)
