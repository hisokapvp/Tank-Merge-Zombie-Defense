# Система: Input

> Обновлено: 2026-03-30.

## Где править
- Canvas gameplay drag / tap split: `game.js`
- Hybrid drag-threshold helper: `src/phaser/inputAdapter.js`
- Storage drag-drop: `src/ui/productionLineUI.js`
- Hangar/workshop chip drag-drop: `src/ui/hangarChipsUI.js`

## Правила
- Поддерживать мышь + touch без рассинхронизации состояния.
- Проверять hitbox/target-логику после изменения координат и масштаба Canvas.
- Не создавать лишние аллокации в обработчиках частых событий.

## Инварианты ⚠️
- Touch `preventDefault()` вызывается только для cancelable touch pointer events. Не переводить mouse/pen path на тот же unconditional `preventDefault`, иначе сломается desktop pointer-flow и а11y: [game.js](../../../game.js#L11319-L11340), [src/ui/productionLineUI.js](../../../src/ui/productionLineUI.js#L175-L207), [src/ui/hangarChipsUI.js](../../../src/ui/hangarChipsUI.js#L4074-L4090).
- Drag threshold остаётся `6px` на всех user-facing surfaces: canvas tank drag использует `InputAdapter.isDragExceeded(...)` с fallback `Math.hypot(dx, dy) > 6`, storage box drag ждёт тот же threshold до ghost/merge-target updates, а hangar chip drags маркируют `moved` только после превышения порога. Не вводить отдельные thresholds по surface: [game.js](../../../game.js#L11383-L11396), [src/ui/productionLineUI.js](../../../src/ui/productionLineUI.js#L238-L274), [src/ui/hangarChipsUI.js](../../../src/ui/hangarChipsUI.js#L4215-L4252).
- Pointer capture обязан сниматься на `pointerup/pointercancel` и в teardown-path: canvas вызывает `releaseCanvasPointer()`, storage — `_releaseDragPointerCapture()`, hangar — `_releaseChipDragPointerCapture()`. Не оставлять висящий capture между modal transitions: [game.js](../../../game.js#L11324-L11345), [src/ui/productionLineUI.js](../../../src/ui/productionLineUI.js#L175-L233), [src/ui/hangarChipsUI.js](../../../src/ui/hangarChipsUI.js#L4065-L4108).
- До превышения threshold нельзя обновлять drag-state координаты, ghost preview и drop-target affordances. Это root-cause защита от ложных drag'ов на touch, чтобы tap по canvas/storage/workshop не превращался в move: [game.js](../../../game.js#L11383-L11396), [src/ui/productionLineUI.js](../../../src/ui/productionLineUI.js#L238-L288), [src/ui/hangarChipsUI.js](../../../src/ui/hangarChipsUI.js#L4215-L4278).
