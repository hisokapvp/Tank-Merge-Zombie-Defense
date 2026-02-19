# Система: UI

## Где править
- Разметка: `index.html`
- Логика UI: `src/ui/*`
- Инициализация: `src/core/bootstrap.js`
- Critical modal: `src/ui/criticalModal.js`
- Restart simulation flow: `game.js` (`restartSimulationPartial`) + `src/core/worldReset.js`

## Правила
- Не добавлять тексты мимо `src/i18n/ru.json` и `src/i18n/en.json`.
- Не переносить доменную логику в слой UI.
- Debug-панели и admin-кнопки оставлять за `?debug=1`.
- Для critical modal: вход/выход должен включать/снимать hard pause через `PauseManager`, skip-кнопка видна только во время typing.
- Кнопка `Перезапустить симуляцию` должна вызывать partial reset runtime мира без запуска второго main loop.

## Меню и confirm выхода
- Small menu confirm выхода живёт в `menuExitConfirmView` (`index.html`), обработчики — `src/core/bootstrap.js`.
- Кнопка `Выход` в confirm должна переиспользовать существующий session-exit flow (`stopAndResetSessionToBigMenu`), без дублирования reset-логики.
- Открытие/закрытие confirm-экрана внутри small menu не должно трогать pause/unpause; меняется только активный `menuView`.

## Состояние подсветки кнопок меню
- Big menu и small menu хранят last-click состояние раздельно (без shared state между меню).
- На первом показе меню selected-подсветки нет; selected появляется только после клика.
- Hover остаётся CSS-driven (`:hover`) и не зависит от selected.
- При новом клике в пределах одного меню selected переносится на новую кнопку и снимается с предыдущей.

## Мини-проверка
- Кнопки работают мышью и touch.
- Фокус и закрытие модалок проходят через `Game.A11y`.
- UI не ломает паузу/возобновление и сохранение.
- В critical modal по `Skip` текст допечатывается мгновенно, затем показываются финальные действия.
- Повторные нажатия `Перезапустить симуляцию` не создают дубли таймеров/спавна.
