# CHANGELOG (A2DP)

## 2026-02-12

- PACK 1 (UI parity): добавлен единый behavior-layer для всех UI-кнопок.
	- `src/ui/buttonBehavior.js`: авто-декорирование `button` (+ динамические через MutationObserver), touch/pointer pressed (`.is-pressed`);
	- `style.css`: `.uiButtonBehavior` с общими состояниями `hover` (pointer-only), `pressed`, `focus-visible`, `disabled`.
	- `index.html`: подключён `src/ui/buttonBehavior.js`.
- PACK 1 (Talents badge): `style.css`
	- `.talentNode` переведён в `overflow:visible`;
	- `.talentNodeRank` смещён в bottom-right с выступом `right:-2px`, `bottom:-2px`.
- PACK 1 (Centerline + fence gap): `game.js`
	- движение танков по centerline (`getTankOrbitRadius()` возвращает `BAL.tankOrbitRadius`);
	- добавлен `BAL.roadFenceGap` (world-scale clamp 6–12px);
	- `initBoard()` считает `fencePad` с учётом дорожного зазора;
	- `drawTankTrack()` клипуется внутри fence с отступом;
	- порядок `draw()` изменён: `drawTankTrack()` перед `drawZombieFence()`.

- Обновлены docs: `docs/ai/INDEX.md`, `docs/ai/SYSTEMS/ui.md`, `docs/ai/SYSTEMS/render.md`, `docs/ai/SYSTEMS/assets.md`.

- PACK 1 (T1): спавн зомби переведён в data-driven режим через `assets/zombies.json.spawn`.
	- добавлены поля `targetAlive`, `sideCount`, `perSideTarget`, `perSideTolerance`;
	- `game.js` читает spawn-конфиг в `ZombieSprites.load()` и применяет в `BAL`;
	- `ensureZombieCount()` балансирует слоты по сторонам (для 240: около 60 на сторону, допуск ±5).
- PACK 1 (T2): offline modal в `src/ui/offlineModal.js` приведена к визуальному паттерну settings modal.
	- сохранены и проверены правила: `Money/Деньги`, `$` и `⭐`, центр накопительного блока, кнопка claim внизу панели;
	- RU/EN-ключи офлайн-модалки оставлены синхронными в `src/i18n/ru.json` и `src/i18n/en.json`.
- PACK 1 (T3): talent tile UI обновлён.
	- иконка таланта теперь заполняет плитку;
	- счётчик ранга показан оверлеем в правом нижнем углу (readable badge).
- PACK 1 (T4): исправлен риск пропадания shot SFX после длинной сессии/серии level-up.
	- `playSfx()` переведён с `new Audio()` на переиспользуемые пулы (`SFX_POOLS`),
	- добавлена синхронизация громкости для уже созданных SFX-плееров.

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
