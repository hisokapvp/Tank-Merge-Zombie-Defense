# Система: Input

> Обновлено: 2026-04-02.

## Где править
- Browser context-menu suppression / legacy canvas entry: `game.js`
- Phaser-side right-click suppression: `src/phaser/phaserBootstrap.js`
- Canvas gameplay drag / tap split: `game.js`
- Hybrid drag-threshold helper: `src/phaser/inputAdapter.js`
- Storage drag-drop: `src/ui/productionLineUI.js`
- Hangar/workshop chip drag-drop: `src/ui/hangarChipsUI.js`
- Underground hangar modal drag-drop: `src/ui/undergroundHangarUI.js`
- Touch-action / `-webkit-touch-callout` guards: `style.css`

## Правила
- Поддерживать мышь + touch без рассинхронизации состояния.
- Проверять hitbox/target-логику после изменения координат и масштаба Canvas.
- Не создавать лишние аллокации в обработчиках частых событий.

## Инварианты ⚠️
- Native browser context menu подавляется намеренно и симметрично: legacy path ставит one-shot document-level `contextmenu` guard в `game.js`, а Phaser bootstrap держит `disableContextMenu:true`. Нельзя возвращать browser menu только на одном из runtime-путей, иначе A/B parity input снова расходится между canvas и Phaser: [game.js](../../../game.js#L11153-L11157), [src/phaser/phaserBootstrap.js](../../../src/phaser/phaserBootstrap.js#L106-L116).
- Touch `preventDefault()` вызывается только для cancelable touch pointer events. Не переводить mouse/pen path на тот же unconditional `preventDefault`, иначе сломается desktop pointer-flow и а11y; underground hangar touch-path разрешённо вызывает `preventDefault()` уже на `pointerdown`, чтобы long-press/gesture takeover не перехватывались браузером: [game.js](../../../game.js#L11319-L11340), [src/ui/productionLineUI.js](../../../src/ui/productionLineUI.js#L175-L207), [src/ui/hangarChipsUI.js](../../../src/ui/hangarChipsUI.js#L4074-L4090), [src/ui/undergroundHangarUI.js](../../../src/ui/undergroundHangarUI.js#L418).
- Drag threshold остаётся `6px` на всех user-facing surfaces: canvas tank drag использует `InputAdapter.isDragExceeded(...)` с fallback `Math.hypot(dx, dy) > 6`, storage box drag ждёт тот же threshold до ghost/merge-target updates, hangar chip drags маркируют `moved` только после превышения порога, а underground hangar modal обновляет drag state только после того же threshold. Не вводить отдельные thresholds по surface: [game.js](../../../game.js#L11383-L11396), [src/ui/productionLineUI.js](../../../src/ui/productionLineUI.js#L238-L274), [src/ui/hangarChipsUI.js](../../../src/ui/hangarChipsUI.js#L4215-L4252), [src/ui/undergroundHangarUI.js](../../../src/ui/undergroundHangarUI.js#L411-L476).
- Pointer capture обязан сниматься на `pointerup/pointercancel` и в teardown-path: canvas вызывает `releaseCanvasPointer()`, storage — `_releaseDragPointerCapture()`, hangar — `_releaseChipDragPointerCapture()`, underground modal — `clearDragState()` / cleanup listener path. Не оставлять висящий capture между modal transitions: [game.js](../../../game.js#L11324-L11345), [src/ui/productionLineUI.js](../../../src/ui/productionLineUI.js#L175-L233), [src/ui/hangarChipsUI.js](../../../src/ui/hangarChipsUI.js#L4065-L4108), [src/ui/undergroundHangarUI.js](../../../src/ui/undergroundHangarUI.js#L411-L476).
- `touch-action:none` и `-webkit-touch-callout:none` на `#c`, `.ughCell__surface/.ughDroneCell__surface` и `.ughCell__spriteCanvas/.ughDroneCell__spriteCanvas` — часть input-контракта, а не cosmetic CSS. Если убрать эти guard'ы, long-press/touch drag снова уедут в браузерные жесты и сломают mobile parity: [style.css](../../../style.css#L1115-L1124), [style.css](../../../style.css#L4744-L4760).
- До превышения threshold нельзя обновлять drag-state координаты, ghost preview и drop-target affordances. Это root-cause защита от ложных drag'ов на touch, чтобы tap по canvas/storage/workshop/underground modal не превращался в move: [game.js](../../../game.js#L11383-L11396), [src/ui/productionLineUI.js](../../../src/ui/productionLineUI.js#L238-L288), [src/ui/hangarChipsUI.js](../../../src/ui/hangarChipsUI.js#L4215-L4278), [src/ui/undergroundHangarUI.js](../../../src/ui/undergroundHangarUI.js#L411-L476).
