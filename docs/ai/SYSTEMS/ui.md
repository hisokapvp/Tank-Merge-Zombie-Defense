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

## Level-up modal (PACK 1)

- Файлы:
	- `index.html` — добавлена кнопка `✕` (`#levelModalClose`) в правом верхнем углу level-up модалки.
	- `game.js` — подключён `ui.levelClose` и обработчик закрытия через `closeLevelModal()`.
	- `src/mechanics/levelFlow.js` — убран auto-dismiss level-награды.
- Поведение:
	- Модалка level-up **не закрывается автоматически**.
	- Закрытие только вручную: `Принять` или `✕`.
	- Escape не закрывает level-up (onClose для a11y — no-op).
	- Клики/инпут по игре под модалкой блокируются, пока level-up открыт.

## Checklist (PACK 1)

- Level-up сценарии:
	- не закрывается сама;
	- закрывается по `Принять`;
	- закрывается по `✕`;
	- клики по игре под модалкой не проходят;
	- Chrome desktop.
- Cross-check с render:
	- resize 3 размера;
	- бой с зомби у нижней/боковой/угловой части забора.

## Изменённые файлы (PACK 1)

- `index.html`
- `game.js`
- `src/mechanics/levelFlow.js`

## Команды проверки (факт)

- `node Test/tests.js` → PASS (`76 passed, 0 failed`)
- `bash ci/check_style.sh` → FAIL в текущей среде (`/bin/bash` недоступен)
- `bash ci/run_tests.sh` → FAIL в текущей среде (`/bin/bash` недоступен)

## Риски

- Не хранить пользовательские строки в JS.
- Не ломать порядок `<script>` в `index.html`.

## Мини-проверка

- Открытие/закрытие модалок, Escape, Tab-cycle.
- Переключение RU/EN.
- `node Test/pack1/mergePopup.test.js`
- `node Test/pack9/offlineModal_ui_i18n.test.js`
