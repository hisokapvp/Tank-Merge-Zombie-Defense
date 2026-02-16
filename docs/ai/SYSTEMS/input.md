# SYSTEM: Input

## Где искать

- Pointer handlers: `game.js` (`pointerdown`, `pointermove`, `pointerup`).
- Нормализация координат: `src/render/input.js`.
- Логика трека/hit-test: `src/mechanics/trackQuery.js`.

## Что править

- Drag threshold и tap/drag разделение — `pointermove`.
- Merge/drop/onTrack — `pointerup`.
- Ранние перехваты modal/crate — начало `pointerdown`.

## Ремонт сегмента забора кликом

- Ремонт обрабатывается в `game.js` внутри `pointerdown`.
- Порядок важен:
	1. ранние return модалок/offline/crate/track,
	2. проверка dismantle-режима,
	3. hit-test по fence-сегментам и ремонт,
	4. только затем старт drag танка.
- Ремонт работает только при отсутствии blocking modal и только по повреждённому сегменту (`hp < maxHp`).
- За клик чинится один сегмент; списание монет идёт из `FenceSprites.config.repair.costCoins` (fallback `100`).

## Риски

- Не ломать ранние `return` в `pointerdown`.
- Проверять hit-test после изменений DPI/resize.

## Мини-проверка

- Ручной сценарий: tap, drag, merge, onTrack.
- Смежные тесты: `node Test/pack1/fireLogic.test.js`.
