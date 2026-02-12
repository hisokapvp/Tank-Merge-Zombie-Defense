# PLAYBOOK: Изменить управление (input)

## Когда использовать

Нужно изменить drag-drop/тап/обработку pointer в игровом canvas.

## Шаги

1. Найди обработчик в `game.js` (`pointerdown/move/up`).
2. Проверь ранние перехваты (`OfflineModal.handleInput`, crate hit-test).
3. Измени логику только в нужной ветке:
   - tap
   - drag threshold
   - drop/merge
4. Если требуется общая нормализация координат — синхронизируй `src/render/input.js`.
5. Проверь, что `state.dragging` корректно очищается на `pointerup`.

## Какие файлы обычно править

- `game.js`
- `src/render/input.js` (опционально)

## Проверки

- Тап по танку: onTrack toggle.
- Drag на другой танк: merge.
- Drag на пустую ячейку: перенос.
- Tap по offline modal кнопке при видимой модалке.

## Типовые ловушки

- Сломаны ранние `return`, из-за чего клик проходит сквозь модалку.
- Неправильный resize/DPI расчёт координат ломает hit-test.
