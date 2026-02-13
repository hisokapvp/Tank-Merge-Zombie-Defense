# SYSTEM: UI

## Purpose

Управляет визуальными интерфейсами: HUD, модалки, панель меню, debug/admin панели и вспомогательные виджеты.

## Быстрый ответ (куда идти)

- Базовая разметка: `index.html`.
- Стили и layout: `style.css`.
- Логика UI: `src/ui/*` + часть связки в `game.js`.

## Key files

- `index.html`
- `style.css`
- `src/ui/buttonBehavior.js`
- `src/ui/mergePopup.js`
- `src/ui/offlineModal.js`
- `src/ui/continueFlow.js`
- `src/ui/debugPanel.js`
- `src/ui/lessonProgress.js`
- `src/ui/shopUI.js`
- `src/accessibility/a11y.js`
- `src/i18n/index.js`, `src/i18n/ru.json`, `src/i18n/en.json`

## Entrypoints

- В `boot()` (`game.js`) навешиваются обработчики кнопок/модалок.
- Debug UI инициализируется через `Game.DebugPanel.initDebugPanel(...)` из `src/ui/debugPanel.js`.
- `Game.MergePopup.init()`, `Game.LessonProgress.init()`, `Game.ZombieAnimPreview.init()` вызываются при старте.
- `Game.A11y.openModal/closeModal` — обязательный фокус-контур для модалок.

## Data & config

- UI-флаги в `state.ui`.
- Язык через `Game.I18n` + `localStorage('lang')`.
- Отдельные localStorage ключи у систем (`seenMergeLevels`, `feedback_reports_v1`, ...).

## Common edits

1. **Добавить кнопку в HUD/меню**
   - Разметка: `index.html`.
   - Стили: `style.css`.
   - Поведение (hover/pressed/focus/disabled): `src/ui/buttonBehavior.js` + `.uiButtonBehavior` в `style.css`.
   - Обработчик: `boot()` в `game.js` или отдельный `src/ui/*.js` модуль.

2. **Добавить новую модалку**
   - HTML + CSS + `src/ui/newModal.js`.
   - Подключить скрипт в `index.html` перед `game.js`.
   - Зарегистрировать modal в `Game.A11y`.

3. **Изменить тексты UI**
   - Править `src/i18n/ru.json` и `src/i18n/en.json` синхронно.
   - Для offline modal обязательно поддерживать пару RU/EN (правило RU/EN always).

4. **Привести offline modal к текущему UI-стилю**
   - Эталон: settings modal (`menuPanel`, `menuSettings`, `menuRow`).
   - Проверить структуру offline modal в `src/ui/offlineModal.js`: центрированный блок накоплений и кнопка claim снизу.
   - Для EN использовать `Money` (правило Money everywhere), суммы форматировать с `$` и `⭐` рядом с числом.

5. **Обновить состояние кнопки покупки**
   - `src/ui/shopUI.js` + проверка с `Game.Garage.hasFreeCell`.

6. **Обновить плитку таланта (talent tree)**
   - Разметка узла в `game.js` (`ensureTalentUI`) + стили в `style.css`.
   - Иконка должна заполнять tile, счётчик ранга — overlay в правом нижнем углу.
    - Для badge использовать bottom-right c offset `right:-2px`, `bottom:-2px` (допустим 1–2px), `overflow:visible` у `.talentNode`.
   - Проверить читаемость счётчика для locked/applied/pending/maxed состояний.

## Unified button behavior (PACK 1)

- Базовый behavior-layer: `src/ui/buttonBehavior.js`.
   - Авто-декорирует все `button` и динамически добавленные кнопки (через `MutationObserver`) классом `.uiButtonBehavior`.
   - Добавляет touch/pointer pressed-класс `.is-pressed` на `pointerdown` и снимает на `pointerup/pointercancel`.
- Базовые стили состояний: `style.css` (`.uiButtonBehavior`).
   - `hover` применяется только для pointer-устройств (`@media (hover: hover) and (pointer: fine)`).
   - `pressed` обязателен для touch и pointer (`:active` + `.is-pressed`).
   - `focus-visible` имеет явный outline.
   - `disabled` блокирует hover/pressed-transform.
- Правило: **скины кнопок могут отличаться (цвет/фон/иконка), но поведение и анимация одинаковые**.

## Overlay/popup map

- Main menu overlay: `index.html` (`#menuOverlay`), управление в `game.js` (`setMenuOpen`).
- Level-up modal: `index.html` (`#levelModal`), управление в `game.js` (`showLevelModal`, `acceptLevelReward`).
- Boost modal: `index.html` (`#boostModal`), управление в `game.js`.
- Dismantle modal: `index.html` (`#dismantleModal`), управление в `game.js`.
- Reset talents modal: `index.html` (`#resetTalentsModal`), управление в `game.js`.
- Crate modal: `index.html` (`#crateModal`), управление в `game.js`.
- Talent tree overlay/modal: создаётся в `game.js` (`ensureTalentUI`).
- Merge popup modal: `index.html` + логика в `src/ui/mergePopup.js`.
- Offline rewards modal: `src/ui/offlineModal.js`.
- Lesson progress panel (dialog-like): `index.html` + `src/ui/lessonProgress.js`.

## Don’t touch / risks

- Не оставляй модалки без A11y trap/focus restore.
- Не добавляй строки в JS, если для них есть i18n путь.
- Не ломай порядок скриптов в `index.html` (global.Game зависимости).

## Checks

- Ручной: открыть/закрыть все модалки, проверить Escape/Tab.
- Локализация: переключение RU/EN обновляет текст.
- Тесты: `node Test/pack1/mergePopup.test.js`, `node Test/pack9/offlineModal_ui_i18n.test.js`.
- Для offline modal дополнительно проверить:
   - стиль панели соответствует settings modal палитре/рамке;
   - тексты `Money/Деньги`, иконки `$` и `⭐` рядом с числами;
   - кнопка claim расположена в нижней части панели.
- Для talent tree дополнительно проверить:
   - icon fill действительно заполняет tile;
   - rank badge расположен bottom-right с выступом 1–2px и остаётся читаемым на всех состояниях узла.

### PACK 1 visual checklist

- [ ] Все кнопки в HUD/меню и в overlay/popup имеют одинаковые transition/состояния.
- [ ] На desktop hover есть только на pointer-устройствах.
- [ ] На touch есть явный pressed-отклик без hover.
- [ ] `focus-visible` у кнопок видим и читаем.
- [ ] `disabled` не получает hover/pressed-эффекты.
- [ ] Talent rank badge выступает на 1–2px (bottom-right).
- [ ] Значения `0/1`, `0/5`, `10/10` не обрезаются в talent badge.
