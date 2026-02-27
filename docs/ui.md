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

## Дроны (вкладка Supercomputer -> Drones)

- В `modsTankWall` добавлена вкладка `Дроны` после `Орудия`.
- Таблица следует тому же паттерну, что `Орудия`/`Стены`: sprite-колонка, уровни, статы, `+/-`, `Apply`.
- Статы по уровням берутся из `assets/dron.json` (`levels[level].moveSpeedPxSec`, `repairSpeedMult`).
- Иконки дронов в строках используют repair-анимацию из `assets/dron.json -> animations.repair` (fallback: `animations.idle`, если `repair` отсутствует).

## Wasteland UI (Fallout Style)

С 26.02.2026 интерфейс переведён на ретро-футуристический стиль.

### Цветовая палитра
- **Фон (Panel):** `#1a1a1a` / `#1e231e`
- **Текст (Phosphor):** `#4af626`
- **Акценты:** `#00ff00`
- **Тени:** Глубокие чёрные, 2px смещение для кнопок.

### Визуальные эффекты (CRT)
- **Scanlines:** Реализованы через `body::before` и псевдоэлементы панелей (`repeating-linear-gradient`).
- **Свечение:** Для текста и кнопок используется `text-shadow` и `box-shadow` в цвете фосфора.
- **Фильтр иконок:** `grayscale(1) invert(1) sepia(1) saturate(5) hue-rotate(70deg)` (окрашивание в зелёный).

### Кнопки
- Прямоугольные (`border-radius: 0`).
- Граница: `3px double` или `solid` цвета ржавого металла/темного оливкового.
- Минимум 1px сдвиг при `:active`.

### Шрифты
- Строго моноширинные: `'Courier New', Courier, monospace`.
