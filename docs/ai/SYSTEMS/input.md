# SYSTEM: Input

## Где искать

- Pointer handlers: `game.js` (`pointerdown`, `pointermove`, `pointerup`).
- Нормализация координат: `src/render/input.js`.
- Логика трека/hit-test: `src/mechanics/trackQuery.js`.

## Что править

- Drag threshold и tap/drag разделение — `pointermove`.
- Merge/drop/onTrack — `pointerup`.
- Ранние перехваты modal/crate — начало `pointerdown`.

## Риски

- Не ломать ранние `return` в `pointerdown`.
- Проверять hit-test после изменений DPI/resize.

## Мини-проверка

- Ручной сценарий: tap, drag, merge, onTrack.
- Смежные тесты: `node Test/pack1/fireLogic.test.js`.
