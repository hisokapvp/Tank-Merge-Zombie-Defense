# style.css — карта файла

> Агент-ориентировано. Обновлён: 2026-03-06.
> `style.css` — CSS-монолит проекта (4671 строка) и один из главных hotspot-файлов.

## Что это
Файл содержит почти весь визуальный контракт проекта: HUD, кнопки, menu/big menu, модалки, supercomputer overlays, talents, debug UI, hangar chips, craft panel и storage modal production line.

## Быстрый старт для агента
- HUD / supercomputer HUD button → [style.css](../../style.css#L1-L262), [style.css](../../style.css#L1425-L1527).
- SC overlays / root tiles / modal scroll contract → [style.css](../../style.css#L1195-L1204), [style.css](../../style.css#L1528-L1574), [style.css](../../style.css#L2043-L2124).
- Hangar chips / workshop / tech unlock → [style.css](../../style.css#L3052-L4127).
- Chip craft / future chip dashed frame → [style.css](../../style.css#L4128-L4671).

## Инварианты этого модуля ⚠️
- `.supercomputerHudBtn` позиционируется только через `transform`; анимации по `transform` для runtime-перемещения запрещены: [style.css](../../style.css#L1425-L1527).
- В supercomputer/talents overlays pressed/hover behavior не должен создавать layout shift и второй scrollbar: [style.css](../../style.css#L2043-L2124).
- «Будущий» чип получает dashed-рамку на `.chipCraftResultChip--future`, placeholder — на `.chipCraftSlot--resultSlot`, а не через перекраску SVG: [style.css](../../style.css#L4487-L4513).

## Оглавление файла
| Блок | Строки | Назначение |
|---|---|---|
| Theme vars / body / HUD / stage shell | [style.css](../../style.css#L1-L262) | CSS-переменные, safe-area, stage layout, terminal panel |
| Buttons / menus / save views / forms | [style.css](../../style.css#L263-L1010) | HUD buttons, big menu, small menu, menu inputs, sliders |
| Overlay / modal base / critical / supercomputer HUD / root tiles | [style.css](../../style.css#L1188-L1700) | Общие модалки, `.btn`, `.scButton`, `.supercomputerHudBtn`, `.scRootTiles` |
| Talent modal / SC modal / tabs / tables / stage abilities | [style.css](../../style.css#L1700-L2629) | Talents, `.scModal__body`, table layout, stage active slots, debug panel start |
| Unified button behavior / merge popup / lesson progress / hangar core / workshop / tech unlock | [style.css](../../style.css#L2630-L4127) | Shared behavior layer, merge popup, hangar chips base, workshop, tech unlock |
| Chip craft / reagent row / production line storage modal | [style.css](../../style.css#L4128-L4671) | Inventory, slots, result preview, future chip frame, storage modal |

## Hotspots
- [style.css](../../style.css#L268-L283) — HUD button shell + `#settingsBtn`.
- [style.css](../../style.css#L1425-L1527) — runtime контракт `.supercomputerHudBtn`.
- [style.css](../../style.css#L2043-L2124) — `.scModal__body` и scroll/pressed behavior.
- [style.css](../../style.css#L3052-L4127) — Hangar/Workshop/Tech Unlock.
- [style.css](../../style.css#L4467-L4513) — chip craft highlights + future chip preview.
- [style.css](../../style.css#L4589-L4671) — production line storage modal.

## Зависимости
- Используется практически всеми UI runtime-модулями (`game.js`, `src/ui/*`).
- Особенно связан с: [HANGAR_CHIPS_UI_MAP.md](HANGAR_CHIPS_UI_MAP.md), [SUPERCOMPUTER_MENU_MAP.md](SUPERCOMPUTER_MENU_MAP.md).

## Известные ограничения / TODO
- CSS-монолит ещё не разбит на секции по файлам; этот map — навигация, а не замена рефакторинга.
- Между блоками есть исторические переопределения; при правке всегда проверяй более поздние селекторы в хвосте файла.
