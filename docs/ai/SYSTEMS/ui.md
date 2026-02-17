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
- Offline modal: эталон — settings modal; текст `Money/Деньги` и суммы с `$`/`⭐`.

## Supercomputer menu flow

- Основной вход в таланты: `#supercomputerBtn` (HUD) и canvas hit-test по supercomputer в `game.js`.
- Root overlay: `#supercomputerMenuOverlay` (3 пункта: `Модификации ангара`, `Модификации танков и стен`, `Древо талантов`).
- Child overlays: `#modsHangarOverlay`, `#modsTankWallOverlay`, плюс существующий `#talentOverlay` как child-ветка.
- Правило `Esc`: в root — закрыть supercomputer UI и снять его pause-lock; в child — шаг назад в root, pause-lock сохраняется.
- Реализация: `index.html` (разметка), `src/ui/supercomputerMenu.js` (modal routing), `src/accessibility/a11y.js` (focus trap + Esc), `src/systems/pauseManager.js` + `game.js` (единый menu pause lock между settings/supercomputer).

### Вкладка «Стены» (минимально функциональная)

- Показывает текущие статы fence: `Уровень стен`, `HP сегмента`, `Броня`.
- Кнопка `Улучшить`:
	- disabled на последнем уровне,
	- disabled при нехватке `damagePoints`,
	- при успехе сразу обновляет видимые статы и доступные очки (без кадр-поллинга).
- Данные и бизнес-логика приходят коллбэками из `game.js` (`getFenceStats`, `upgradeFence`).

## Фактические UI-подсистемы в рантайме

- Rewarded ads: `src/ui/adService.js` (заглушка Promise API для crate/boost/offline claim).
- Lesson Progress panel: `src/ui/lessonProgress.js` + блок `#lessonProgressPanel` в `index.html`.
- SRS календарь/планировщик: `src/scheduler/srs.js` + `src/ui/calendar/*` (ленивая загрузка из `lessonProgress.js`).
- Anki: `src/tools/anki/importer.js`, `src/tools/anki/anki_export.js`, кнопка `#export-anki`.
- Feedback widget: `src/feedback/widget.js` (floating button, локальный storage, telemetry hooks).
- Debug UI-панели: `src/ui/adminFlags.js`, `src/ui/analyticsPanel.js`, `src/ui/funnelPanel.js`, `src/ui/experimentsPanel.js`, `src/ui/bugTriage.js`.

## Shop bulk-buy

- Основная реализация: `game.js` (`getBulkBuyPlan`, `tryBuyBulk`, `updateUI`).
- Кнопка bulk-покупки видима всегда.
- Количество для bulk: `X = min(5, freeSlots)`, отображаемое значение ограничено диапазоном `2..5`.
- Если `freeSlots < 2`, кнопка disabled и клик не выполняет покупку.
- Перед покупкой проверяется бюджет на ровно `X` танков; частичная bulk-покупка не допускается.

## Debug/Dev-only правила

- Большинство debug-панелей активируются только при `?debug=1`.
- `AdminFlags` дополнительно ограничен dev-host/file (`localhost`, `127.0.0.1`, `file:`).
- Для новых debug-виджетов держать strict guard в `init()` до создания DOM.

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
- `node Test/pack9/offlineModal_ui_i18n.test.js`
