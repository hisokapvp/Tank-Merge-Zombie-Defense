# SYSTEM: UI

## Где искать

- Разметка: `index.html`
- Стили: `style.css`
- UI-логика: `src/ui/*`
- A11y: `src/accessibility/a11y.js`
- Тексты: `src/i18n/ru.json`, `src/i18n/en.json`

## Что править

- Новая кнопка/панель: HTML + CSS + `src/ui/*`.
- Новая модалка: обязательно через `Game.A11y` (focus trap, Escape).
- Поведение кнопок: `src/ui/buttonBehavior.js` + `.uiButtonBehavior`.
- Offline modal отключена в runtime и не участвует в UI-loop/hit-test.

## Main menu: Continue gating

- Перед первым запуском игры показывается отдельный стартовый `#bigMenuOverlay`.
- Пока открыт big menu, `boot()`/`loop()` не запускаются.
- `boot()` стартует только после выбора `Новая игра` (`#bigMenuNew`) или `Загрузить` (`#bigMenuLoad`).
- После `await boot()` in-session меню принудительно закрывается через `setMenuOpen(false)`, чтобы сессия начиналась сразу в игре.
- Big menu и in-session menu — разные контуры UI: `#bigMenuOverlay` для старта, `#menuOverlay` (gear/ESC) для паузы в ходе сессии.

- Кнопка `Продолжить` в `#menuOverlay` активна для любого валидного сохранения.
- Если сохранения нет, кнопка `Продолжить` остаётся disabled.
- Проверка выполняется в runtime при `updateMenuState()` на основе `getSavedProgress()`.

### Big menu: Загрузить

- Источник сохранения: `localStorage['progress']` (через `getSavedProgress()`/Storage API).
- Если сохранения нет: `#bigMenuLoad` disabled, подсказка и `title` содержат ровно текст `Нет сохранения`.
- Если сохранение есть: `#bigMenuLoad` enabled, подсказка скрыта.

## Main menu: Feedback entrypoint

- Кнопка `#menuFeedback` находится в `#menuOverlay` рядом с `Continue/New game`.
- Клик по `#menuFeedback` вызывает `Game.FeedbackWidget.open()` (привязка в `src/core/bootstrap.js`).
- `#menuFeedback` находится в списке действий small menu выше `#menuExit`.
- Кнопка доступна только в main menu (отдельной HUD/floating кнопки нет).

## In-session small menu: Save/Exit

- Языковой переключатель удалён из `#menuOverlay` (язык остаётся только в big menu `#bigMenuOverlay`).
- Новые пункты in-session меню: `#menuSave` и `#menuExit`.
- `#menuExit` должен оставаться последней кнопкой списка действий (ниже `#menuFeedback`).

### `#menuSave` states

- `SaveSlotsList`: список из 10 слотов (`1..10`).
- `SaveSlotEdit(i)`: input имени + кнопки `Сохранить / Назад / Закрыть`.
- Пустой слот визуально отмечается только opacity текста (`.menuSaveSlotNameEmpty`), без дополнительных иконок.
- Keyboard в edit-view:
	- `Enter` → сохранить имя,
	- `Esc` → назад к списку.

### `#menuExit` state

- Открывает confirm-view с текстом `Выйти без сохранения?` и кнопками `Выйти / Отмена`.
- `Отмена` возвращает в main-view small menu.
- `Выйти` переводит пользователя в big menu без page reload и вызывает runtime reset (подробно в `SYSTEMS/save.md`).

## Crate reward: spawn в crate-slot

- Выдача crate-награды выполняется в `game.js` (`claimCrateReward` → `grantCrateTank`).
- На момент начала claim фиксируется `crateSlotId` (слот, где стоял crate).
- После успешного reward: crate удаляется, затем наградной танк создаётся строго в `crateSlotId`.
- Fallback-ветка «найти любой свободный слот» запрещена и не используется.
- При race/двойном вызове (crate уже удалён/заменён, невалидный или занятый слот) происходит `console.warn` и безопасный return без краша.

## Supercomputer menu flow

- Основной вход в дерево улучшений: icon-only `#supercomputerBtn` и canvas hit-test по supercomputer в `game.js`.
- `#supercomputerBtn` вынесена из правого HUD-списка и позиционируется в screen-space справа от спрайта supercomputer через `transform: translate3d(...)`.
- Для icon-only `#supercomputerBtn` локализованный `aria-label`/`title` берётся из ключа `supercomputerBtn`.
- Root overlay: `#supercomputerMenuOverlay` (3 пункта: `Модификации ангара`, `Модификации танков и стен`, `Древо улучшений`).
- Root-пункты оформлены как tile (`иконка сверху + текст снизу`) всегда в один ряд без wrap; `id` остаются прежними: `supercomputerOpenHangarMods`, `supercomputerOpenTankWallMods`, `supercomputerOpenTalents`.
- Иконки root-tiles задаются через CSS background-image и файлы `assets/computer_icons/*.png` (`hangar_mods_template.png`, `tank_wall_mods_template.png`, `talent_tree_template.png`).
- Child overlays: `#modsHangarOverlay`, `#modsTankWallOverlay`, плюс существующий `#talentOverlay` как child-ветка.
- Единый стиль кнопок supercomputer: класс `.scButton` применяется в root-меню и в релевантных action/tab кнопках child overlays (без изменения layout-контейнеров).
- Единый контейнер supercomputer-модалок: класс `.scModal` у `#modsTankWallOverlay` и у modal-панели `#talentOverlay` (через `src/ui/supercomputerMenu.js`), чтобы размер модалки `Модификации танков и стен` соответствовал `Древу талантов`.
- Правило `Esc`: в root — закрыть supercomputer UI и снять его pause-lock; в child — шаг назад в root, pause-lock сохраняется.
- Реализация: `index.html` (разметка), `src/ui/supercomputerMenu.js` (modal routing), `src/accessibility/a11y.js` (focus trap + Esc), `src/systems/pauseManager.js` + `game.js` (единый menu pause lock между settings/supercomputer).
- Детальные CSS-правила/чеклист: `docs/supercomputer-ui.md`.

## Critical modal flow

- Overlay: `#criticalOverlay` в `index.html`, контроллер: `src/ui/criticalModal.js`.
- API контроллера: `open({ hasDrones, onSaveExit, onRestart })`, `close()`, `isOpen()`.
- При open модалка регистрируется в A11y-стеке через `Game.A11y.openModal(...)`, поэтому Tab/Esc работают как для остальных модалок.
- Typewriter:
	- скорость/паузы берутся из `src/config/criticalModalTuning.js` (`charsPerSec`, `linePauseMs`, `afterFinishPauseMs`),
	- `Пропустить` мгновенно допечатывает лог, скрывается, затем показываются финальные кнопки,
	- контейнер лога автоскроллится вниз после каждого append.
- Кнопки:
	- `×` и `Сохранить прогресс и выйти` → повторный save attempt и `location.reload()`,
	- `Перезапустить симуляцию` → partial reset и продолжение сессии.

### Tabs в «Модификации танков и стен»

- Разметка: `tablist` + `tab` + `tabpanel` для 3 вкладок в порядке слева направо: `Орудия`, `Базы`, `Стены`.
- Дефолт при каждом открытии `#modsTankWallOverlay`: активна `Орудия` (`weapons`) вне зависимости от выбора в прошлом открытии.
- Состояние вкладки не сохраняется между открытиями (без localStorage/state carry-over).
- Для `.scTab` запрещены любые тени (`box-shadow`, `filter/drop-shadow`, псевдо-эффекты тени); визуальный hover/active сигнал остаётся фоновым (`background`).
- Tab-кнопки остаются focusable (button + `role="tab"`, `aria-selected`, `tabindex`), `Esc`/back/focus trap работают по прежним правилам supercomputer child overlay.

### Root tiles layout

- Контейнер root tiles (`.scRootTiles`) работает в `flex-wrap: nowrap`; элементы (`.scRootTile`) сжимаются через `flex: 1 1 0` и `min-width: 0`.
- Лейблы (`.scRootTile__label`) без переносов (`white-space: nowrap`) и с fallback `overflow: hidden; text-overflow: ellipsis;`.
- Шрифт лейблов допускает только авто-уменьшение до минимума через `clamp(min, vw, base)`; увеличение выше базового размера запрещено.

## Boost UI возле supercomputer

- HUD-окно `Boost` удалено: активные бусты отображаются рядом со спрайтом supercomputer в screen-space.
- Источник ассетов: `assets/boost_icons.json` + `assets/boost_icons_atlas.png`; загрузчик `BoostIconsSprites` в `src/render/spriteLoaders.js`.
- Layout группы берётся из `assets/supercomputer.json.boostIcons` (`anchor/offsetX/offsetY/maxPerRow/gapX/gapY`).
- Каждый активный буст рисуется как `icon + ceil(remainingSec)`, иконки раскладываются по рядам (`maxPerRow`) с центрированием каждого ряда и всей группы относительно спрайта.
- Overlay-кадр cooldown выбирается как `idx = floor(clamp(1 - remainingSec/secondsTotal, 0..1) * (K-1))`.
- Если `cooldownOverlayFrames` отсутствует/невалиден (`K < 2`) — UI продолжает рисовать иконку и таймер без overlay.
- Лимит на количество одновременно активных boost-иконок отсутствует.
- Повторный boost того же `boostId` не создаёт второй элемент: обновляется `remainingSec` текущего.
- Для floating-кнопки supercomputer есть safeguard: при пересечении с bbox boost-группы кнопка сдвигается вниз на `iconH + gapY`.

## Термины UI/i18n

- RU: `Древо улучшений`, `Очки улучшений`, `Сбросить улучшения`.
- EN: `Upgrade Tree`, `Upgrade points`, `Reset upgrades`.
- Ключи: `talentsBtn`, `supercomputerTalentsBtn`, `talentTreeTitle`, `talentPoints`, `levelModalTalent`, `talentResetAll`, `talentResetModalText`.

### Вкладка «Стены» (минимально функциональная)

- Показывает текущие статы fence: `Уровень стен`, `HP сегмента`, `Броня`.
- Кнопка `Улучшить`:
	- disabled на последнем уровне,
	- disabled при нехватке `damagePoints`,
	- при успехе сразу обновляет видимые статы и доступные очки (без кадр-поллинга).
- Данные и бизнес-логика приходят коллбэками из `game.js` (`getFenceStats`, `upgradeFence`).

## Фактические UI-подсистемы в рантайме

- Rewarded ads: `src/ui/adService.js` (заглушка Promise API для crate/boost).
- Lesson Progress panel: `src/ui/lessonProgress.js` + блок `#lessonProgressPanel` в `index.html`.
- SRS календарь/планировщик: `src/scheduler/srs.js` + `src/ui/calendar/*` (ленивая загрузка из `lessonProgress.js`).
- Anki: `src/tools/anki/importer.js`, `src/tools/anki/anki_export.js`, кнопка `#export-anki`.
- Feedback widget: `src/feedback/widget.js` (programmatic modal `open()`/`showModal()`, локальный storage, telemetry hooks).

### Feedback i18n keys

- Main menu button: `menuFeedback`.
- Modal texts: `feedbackTitle`, `feedbackCategoryLabel`, `feedbackRatingLabel`, `feedbackMessagePlaceholder`, `feedbackCancel`, `feedbackSend`, `feedbackValidationMessageRequired`, `feedbackSuccess`.
- Category names: `feedbackCategoryGeneral`, `feedbackCategoryBug`, `feedbackCategoryBalance`, `feedbackCategoryUi`.
- Debug UI-панели: `src/ui/adminFlags.js`, `src/ui/analyticsPanel.js`, `src/ui/funnelPanel.js`, `src/ui/experimentsPanel.js`, `src/ui/bugTriage.js`.

## Shop bulk-buy

- Основная реализация: `game.js` (`getBulkBuyPlan`, `tryBuyBulk`, `updateUI`).
- Кнопка bulk-покупки видима всегда.
- Количество для bulk: `X = min(5, freeSlots)`, отображаемое значение ограничено диапазоном `2..5`.
- Если `freeSlots < 2`, кнопка disabled и клик не выполняет покупку.
- Перед покупкой проверяется бюджет на ровно `X` танков; частичная bulk-покупка не допускается.

## Achievement unlock UX

- Pipeline: `Game.Achievements.addProgress(state, progressType, delta)` возвращает `unlockedNow` (массив id) → `game.js/processAchievementProgress` делает enqueue событий в `state.achievements.popupQueue` в формате `{ type:'achievement_unlock', id, ts }`.
- Очередь хранит только события; логика показа не выполняется в местах начисления прогресса.
- Потребление очереди выполняется в `game.js/updateAchievementToastState`.
- Правило consume: очередь читается только когда `pause.reasons.menuOpen === false` и `pause.reasons.tabInactive === false`.
- Показ реализован non-modal toast (`#achievementToast`, `role="status"`, `aria-live="polite"`), без focus trap и без перехвата `Esc`.

### Achievements modal list (collapse)

- Контейнер: `#achievementsList` в `index.html`; UI-контроллер: `src/ui/achievementsModal.js`.
- По умолчанию отображается только `title` достижения; блок описания (`progress/status/reward`) скрыт.
- У каждой строки есть кнопка `+` справа (`button[type="button"]`) с `aria-expanded` и `aria-controls="achievementDesc_<id>"`.
- Блок описания имеет `id="achievementDesc_<id>"` и переключает `aria-hidden` + CSS-класс `is-collapsed`.
- Single-open правило: одновременно раскрыт только один элемент; повторный клик по открытому элементу сворачивает его.
- Обработчик кликов один на контейнере списка (event delegation), без подписки на каждую строку.

### Mapping unlock → UI

| Achievement id | Toast | Highlight/pulse |
|---|---|---|
| `engineer_novice`, `engineer_pro`, `engineer_expert` | `achievementToastUnlocked` + `achievementEngineer*` | auto-merge button (`#autoMergeBtn`, `state.ui.unlockFx.autoMergeUntilMs`) |
| `creator_novice`, `creator_pro`, `creator_expert` | `achievementToastUnlocked` + `achievementCreator*` | bulk-buy button (`#buyBulk`, `state.ui.unlockFx.bulkBuyUntilMs`) |

### Auto-merge hard gating

- Источник модели: `Game.AutoMerge.getAutoMergeButtonModel(state)`.
- Если `model.visible === false`, кнопка auto-merge не рендерится в HUD: элемент удаляется из `.stageActions` (`game.js/unmountAutoMergeButton`), поэтому нет DOM/hitbox/слота.
- Если `model.visible === true`, кнопка монтируется обратно (`game.js/mountAutoMergeButton`) и рендерится стандартно с `disabled = !model.enabled`.

## Debug/Dev-only правила

- Большинство debug-панелей активируются только при `?debug=1`.
- `AdminFlags` дополнительно ограничен dev-host/file (`localhost`, `127.0.0.1`, `file:`).
- Для новых debug-виджетов держать strict guard в `init()` до создания DOM.

## Dron world-space icons

- Над каждым дроном рисуются world-space иконки режимов: `⏳` (standby) и `🔧` (repair).
- Hit-test выполняется по world-space прямоугольникам, размер строго из `assets/dron.json.iconSize`, смещение по Y из `iconsOffsetY`.
- `🔧` не блокируется отсутствием целей/монет: режим repair можно включить всегда.
- Проверка/списание монет выполняются только в фактическом `repair_work` тике, когда реально растёт `hp` сегмента.
- При нехватке монет в `repair_work`: тик ремонта не применяется, дрон остаётся в `repair_work` и повторяет попытку на следующих тиках (без UI/SFX спама).
- State machine repair-режима: `repair_patrol` → `repair_moveToTarget` → `repair_work`.
- В `repair_patrol` дрон идёт по периметру fence со скоростью `0.5x` от `moveSpeedPxSec(level)` и сканирует повреждения строго раз в `0.5s`.
- Таргетинг: выбирается сегмент с максимальным `missingHp` (`maxHp-hp`), tie-break — меньшая дистанция до дрона.
- Анти-дубль между дронами: цель claim'ится по `segmentId` в `state.fence.repairClaims`; сегменты с чужим claim пропускаются.
- Точки входа: `src/mechanics/drones.js` (`handlePointerDown`, `stepRepairWork`, `pickBestRepairTarget`, claim helpers), `game.js` (`canvas.pointerdown` с `DronesApi.handlePointerDown`).

## Debug: Add Dron

- В `src/ui/debugPanel.js` добавлен только один контрол для дронов:
	- `Dron level (1..N)`
	- `Add Dron`
- Кнопка вызывает callback `addDron(level)` из `game.js`.

## Level-up modal

- Разметка: `#levelModal`, `#levelAccept`, `#levelModalClose` в `index.html`.
- Runtime: `src/mechanics/levelFlow.js` + вызовы в `game.js`.
- Поведение: автозакрытия нет; закрытие только `Принять` или `✕`; клики по игре под модалкой блокируются.

## Риски

- Не хранить пользовательские строки в JS.
- Не ломать порядок `<script>` в `index.html`.

## Мини-проверка

- Открытие/закрытие модалок, Escape, Tab-cycle.
- Переключение RU/EN.
- Проверка `?debug=1`: видны analytics/funnel/experiments/triage панели.
- Проверка Lesson Progress: repeat/export/import schedule, preview/export Anki.
- Проверка level-up: модалка не закрывается сама и закрывается только вручную.
- `node Test/pack1/mergePopup.test.js`
