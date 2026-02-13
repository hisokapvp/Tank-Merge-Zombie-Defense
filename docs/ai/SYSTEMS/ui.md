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

## Риски

- Не хранить пользовательские строки в JS.
- Не ломать порядок `<script>` в `index.html`.

## Мини-проверка

- Открытие/закрытие модалок, Escape, Tab-cycle.
- Переключение RU/EN.
- `node Test/pack1/mergePopup.test.js`
- `node Test/pack9/offlineModal_ui_i18n.test.js`
