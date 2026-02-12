# SYSTEM: Input

## Purpose

Обрабатывает pointer-ввод по canvas: drag-drop танков, merge, постановка на трек, взаимодействие с модалками и crate.

## Быстрый ответ (куда идти)

- Основные обработчики: `game.js` (`pointerdown`, `pointermove`, `pointerup`).
- Нормализация координат: `getPointerPos` в `game.js`, helper `Game.Input.getCanvasPoint` в `src/render/input.js`.

## Key files

- `game.js`
- `src/render/input.js`
- `src/mechanics/trackQuery.js`
- `src/ui/offlineModal.js`

## Entrypoints

- `canvas.addEventListener('pointerdown' | 'pointermove' | 'pointerup')` в `game.js`.
- В `pointerdown`: ранний перехват `OfflineModal.handleInput` и `crateHitTest`.

## Data & config

- `state.dragging`, `state.selectedHangarCellIndex`, `state.isDismantleMode`.
- Связанные координаты: `viewSize` и canvas bounding rect.

## Common edits

1. **Поменять порог drag vs click**
   - Изменить `Math.hypot(dx,dy) > 6` в `pointermove`.

2. **Добавить новое действие на тап по объекту на сцене**
   - Добавить hit-test в начало `pointerdown` перед drag логикой.

3. **Изменить логику merge/drop**
   - Редактировать ветку `pointerup` и вызовы `mergeCells(from.i, target.i)`.

4. **Поддержать новый тип pointer-события во вспомогательном модуле**
   - Обновить `attachInput` в `src/render/input.js`.

## Don’t touch / risks

- Не ломай ранние `return` в `pointerdown` (offline/crate перехваты).
- Изменения в `pointerup` легко ломают merge и onTrack флоу.
- После изменения координат обязательно проверить hit-test на разных DPI/resize.

## Checks

- Ручной сценарий: drag tank → merge → onTrack toggle → dismantle select.
- Тесты: `node Test/pack1/fireLogic.test.js`, `node Test/pack6/mergePopupPreview.test.js` (смежные регрессы ввода/сценариев).
