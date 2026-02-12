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
- `src/ui/mergePopup.js`
- `src/ui/offlineModal.js`
- `src/ui/continueFlow.js`
- `src/ui/lessonProgress.js`
- `src/ui/shopUI.js`
- `src/accessibility/a11y.js`
- `src/i18n/index.js`, `src/i18n/ru.json`, `src/i18n/en.json`

## Entrypoints

- В `boot()` (`game.js`) навешиваются обработчики кнопок/модалок.
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

5. **Обновить состояние кнопки покупки**
   - `src/ui/shopUI.js` + проверка с `Game.Garage.hasFreeCell`.

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
