# Supercomputer UI

Краткие правила UI для меню суперкомпьютера и связанных элементов in-session меню.

## Чеклист

- Tabs `Орудия/Базы/Стены` — без теней (`box-shadow/filter/drop-shadow`), при этом подсветка `hover/active` остаётся через фон.
- Tiles root-экрана (`Модификации ангара`, `Модификации танков и стен`, `Древо улучшений`) — всегда в один ряд без wrap; текст сжимается через `clamp()` и, при необходимости, режется через `ellipsis`.
- Кнопка `Обратная связь` (`#menuFeedback`) в in-session меню (`#menuOverlay`) всегда последняя строка.

## Где смотреть в коде

- Стили tabs и tiles: `style.css` (`.scTabs`, `.scTab`, `.scRootTiles`, `.scRootTile`, `.scRootTile__label`).
- Разметка и IDs supercomputer-меню: `index.html`.
- Логика supercomputer overlays: `src/ui/supercomputerMenu.js`.
- Гарантия порядка `#menuFeedback`: `src/core/bootstrap.js`.

## Notes

- Для fallback по длинным лейблам используется связка: `white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`.
- Верхний предел `font-size` в `clamp()` равен базовому размеру, чтобы текст не увеличивался сверх исходного дизайна.
