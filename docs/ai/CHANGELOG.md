# CHANGELOG (A2DP)

## 2026-02-13

- Fix: debug-panel spawn tank восстановлен после выноса в модуль.
	- усилены guard-проверки в `src/ui/debugPanel.js` (инициализация board при пустых cells, проверка `makeTank`);
	- добавлен принудительный `updateUI()` после spawn для мгновенного отображения.

- Decomposition: из `game.js` вынесены дополнительные крупные блоки.
	- добавлен `src/core/bootstrap.js` (`Game.Bootstrap.runBoot`) и `boot()` в `game.js` переведён на делегирование;
	- добавлен `src/mechanics/levelFlow.js` (`Game.LevelFlow.createLevelFlow`) и вынесены `update/open/close level modal`, `queue/accept reward`, `grantXP`, level-up VFX/events.

- Decomposition: из `game.js` вынесены sprite-loaders и debug-panel.
	- добавлен `src/render/spriteLoaders.js` (`Game.SpriteLoaders.createSpriteLoaders`) для `ZombieSprites/TankSprites/FenceSprites/DecorSprites`;
	- добавлен `src/ui/debugPanel.js` (`Game.DebugPanel.initDebugPanel`) для инициализации debug UI через dependency injection;
	- `game.js` упрощён: inline-блоки заменены вызовами модулей;
	- `index.html` обновлён: добавлены `src/render/spriteLoaders.js` и `src/ui/debugPanel.js` перед `game.js`.

- Decomposition: вынесены дополнительные блоки из `game.js` в `src/*` без изменения runtime-поведения.
	- добавлен `src/mechanics/progression.js` (`Game.Progression`) с формулами `computePowerTier`, `xpNeededForLevel`, `levelGoldReward`;
	- добавлен `src/mechanics/combatProfiles.js` (`Game.CombatProfiles`) с `PROJECTILE_KINDS`, `projectileProfile`, `tankLevelCounts`, `zombieLevelWeights`, `pickZombieLevel`;
	- добавлен `src/persistence/initialState.js` (`Game.InitialState.createInitialState`) для фабрики стартового state;
	- `game.js` переключён на вызовы API модулей через безопасные fallback-ветки;
	- `index.html` обновлён: подключены новые модули до `game.js`.

- Refactor: удалено дублирование отправки событий в UI-модулях через общий helper.
	- добавлен `src/utils/eventTelemetry.js` (`Game.EventTelemetry.emit`) — единая отправка в `TelemetryLogger` + `AnalyticsCollector`;
	- `src/ui/mergePopup.js` и `src/ui/lessonProgress.js` переведены на helper с fallback для изолированной загрузки модулей в тестах.
- Decomposition: вынесены части `MergePopup` в отдельные файлы без изменения публичного API.
	- `src/ui/mergePopup/mergePopupSeenLevels.js` — load/save/reset флагов `seenMergeLevels`;
	- `src/ui/mergePopup/mergePopupStats.js` — вычисление и сборка строк характеристик popup.
- Runtime wiring:
	- `index.html` обновлён: подключены `src/utils/eventTelemetry.js`, `src/ui/mergePopup/mergePopupSeenLevels.js`, `src/ui/mergePopup/mergePopupStats.js` до `src/ui/mergePopup.js`.
- Validation:
	- пройдены тесты `Test/pack1/mergePopup.test.js`, `Test/pack2/mergeAnimRegression.test.js`, `Test/pack2/telemetryExport.test.js`.

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
