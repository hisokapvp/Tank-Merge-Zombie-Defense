# UI Guidelines

## Modal padding standard

- Единый отступ модалок задаётся через CSS-переменную `--uiModalPad` в `style.css`:
  - `--uiModalPad: clamp(16px, 4vw, 50px);`
- Базовые контейнеры, использующие стандарт:
  - `.levelModal__panel`
  - `.modalHeader`
  - `.modalBody`
  - `.levelModal__panel.scModal`
  - `.levelModal__panel_boost .levelModal__contentWrap`
  - `#modsTankWallOverlay .levelModal__panel.scModal` через `--mods-sc-pad-x: var(--uiModalPad)`

## Поведение на узких экранах

- Благодаря `clamp(16px, 4vw, 50px)` отступ уменьшается примерно до диапазона `16–24px` на узких экранах.
- Это уменьшает риск горизонтального переполнения контента в модалках без отдельных media-query.

## Стены (вкладка Supercomputer -> Walls)

- Для превью-иконки уровня стены поддерживаются 2 формата в `assets/fence.json -> levels[]`:
  1. Через id общего фрейма:
     - `uiFrameId: "sideTop"` (fallback-совместимость)
  2. Через отдельную UI-конфигурацию уровня:
     - `uiIcon: { atlas: "...", frameId: "..." }`
     - `uiIcon: { atlas: "...", frame: { x, y, w, h } }`
- При наличии `uiIcon.frame` используются прямые координаты кадра.
- Если `uiIcon.frame` отсутствует, используется `uiIcon.frameId` / `uiFrameId` / fallback `sideTop`.
