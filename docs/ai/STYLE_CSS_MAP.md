# style.css — карта файла

> Агент-ориентировано. Обновлён: 2026-03-06.
> `style.css` — CSS-монолит проекта (4787 строк) и один из главных hotspot-файлов.

## Что это
Файл содержит почти весь визуальный контракт проекта: HUD, кнопки, menu/big menu, модалки, supercomputer overlays, talents, debug UI, hangar chips, craft panel и storage modal production line.

## Быстрый старт для агента
- HUD / supercomputer HUD button → [style.css](../../style.css#L1-L267), [style.css](../../style.css#L1443-L1547).
- SC overlays / root tiles / modal scroll contract → [style.css](../../style.css#L1195-L1204), [style.css](../../style.css#L1528-L1574), [style.css](../../style.css#L2061-L2124).
- Hangar chips / workshop / tech unlock → [style.css](../../style.css#L3063-L4087).
- Chip craft / future chip / storage modal → [style.css](../../style.css#L4088-L4787).

## Инварианты этого модуля ⚠️
- `.supercomputerHudBtn` позиционируется только через `transform`; анимации по `transform` для runtime-перемещения запрещены: [style.css](../../style.css#L1443-L1547).
- В supercomputer/talents overlays pressed/hover behavior не должен создавать layout shift и второй scrollbar: [style.css](../../style.css#L2061-L2124).
- Игровые close-кнопки используют общий визуальный язык wasteland UI: `.levelModal__close` и craft-slot remove `chipCraftSlotRemove` не должны превращаться в plain red circles: [style.css](../../style.css#L1301-L1339), [style.css](../../style.css#L4332-L4385).
- `chipCraftSlot` / `chipCraftSlotRow--withResult` обязаны оставлять headroom для внешнего `chipCraftSlotRemove`, чтобы крестик во вкладке `Разобрать` не клиппился и совпадал по позиции с future-preview эталоном: [style.css](../../style.css#L4217-L4254), [style.css](../../style.css#L4332-L4385), [style.css](../../style.css#L4611-L4625).
- Craft slots и future-preview используют квадратный карточный shell `chipCraftSlotCard`, визуально согласованный с inventory-карточками: [style.css](../../style.css#L4268-L4385).
- «Будущий» чип получает dashed-рамку на `.chipCraftResultChip--future`, placeholder — на `.chipCraftSlot--resultSlot`, а не через перекраску SVG: [style.css](../../style.css#L4617-L4639).

## Оглавление файла
| Блок | Строки | Назначение |
|---|---|---|
| Theme vars / body / HUD / stage shell | [style.css](../../style.css#L1-L267) | CSS-переменные, safe-area, stage layout, terminal panel |
| Buttons / menus / save views / forms | [style.css](../../style.css#L268-L1187) | HUD buttons, big menu, small menu, menu inputs, sliders |
| Overlay / modal base / critical / close controls / supercomputer HUD / root tiles | [style.css](../../style.css#L1188-L1700) | Общие модалки, `.btn`, `.scButton`, `.levelModal__close`, `.supercomputerHudBtn`, `.scRootTiles` |
| Talent modal / SC modal / tabs / tables / stage abilities | [style.css](../../style.css#L1701-L2665) | Talents, `.scModal__body`, table layout, stage active slots, debug panel start |
| Unified button behavior / merge popup / lesson progress / hangar core / workshop / tech unlock | [style.css](../../style.css#L2666-L4087) | Shared behavior layer, merge popup, hangar chips base, workshop, tech unlock |
| Chip craft / reagent row / production line storage modal | [style.css](../../style.css#L4088-L4787) | Inventory, slots, result preview, future chip frame, storage modal |

## Hotspots
- [style.css](../../style.css#L1301-L1339) — game-styled `levelModal__close`.
- [style.css](../../style.css#L1443-L1547) — runtime контракт `.supercomputerHudBtn`.
- [style.css](../../style.css#L2061-L2124) — `.scModal__body` и scroll/pressed behavior.
- [style.css](../../style.css#L3063-L4087) — Hangar/Workshop/Tech Unlock.
- [style.css](../../style.css#L4217-L4385) — craft slot row, `chipCraftSlotCard`, `chipCraftSlotRemove`.
- [style.css](../../style.css#L4416-L4664) — bottom bar, dust states, future chip frame, reagent row.
- [style.css](../../style.css#L4711-L4787) — production line storage modal.

## Зависимости
- Используется практически всеми UI runtime-модулями (`game.js`, `src/ui/*`).
- Особенно связан с: [HANGAR_CHIPS_UI_MAP.md](HANGAR_CHIPS_UI_MAP.md), [SUPERCOMPUTER_MENU_MAP.md](SUPERCOMPUTER_MENU_MAP.md), [PRODUCTION_LINE_RENDER_MAP.md](PRODUCTION_LINE_RENDER_MAP.md).

## Известные ограничения / TODO
- CSS-монолит ещё не разбит на секции по файлам; этот map — навигация, а не замена рефакторинга.
- Между блоками есть исторические переопределения; при правке всегда проверяй более поздние селекторы в хвосте файла.
