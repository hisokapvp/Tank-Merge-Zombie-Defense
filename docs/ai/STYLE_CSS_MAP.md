# style.css — карта файла

> Агент-ориентировано. Обновлён: 2026-03-09.
> `style.css` — CSS-монолит проекта (5175 строк) и один из главных hotspot-файлов.

## Что это
Файл содержит почти весь визуальный контракт проекта: HUD, кнопки, menu/big menu, модалки, supercomputer overlays, talents, debug UI, hangar chips, craft panel и storage modal production line.

## Быстрый старт для агента
- HUD / supercomputer HUD button → [style.css](../../style.css#L1-L316), [style.css](../../style.css#L1498-L1595).
- SC overlays / root tiles / modal scroll contract → [style.css](../../style.css#L1195-L1204), [style.css](../../style.css#L1528-L1574), [style.css](../../style.css#L2061-L2124).
- Hangar chips / workshop / tech unlock → [style.css](../../style.css#L3063-L4435).
- Chip craft / future chip / storage modal → [style.css](../../style.css#L4335-L5175).

## Инварианты этого модуля ⚠️
- `.supercomputerHudBtn` позиционируется только через `transform`; анимации по `transform` для runtime-перемещения запрещены: [style.css](../../style.css#L1443-L1547).
- В supercomputer/talents overlays pressed/hover behavior не должен создавать layout shift и второй scrollbar: [style.css](../../style.css#L2061-L2124).
- `body.pl-storage-open::before` входит в общий CRT/grain overlay семейства menu/scmodal/critical; storage modal не должен визуально выпадать из этой группы: [style.css](../../style.css#L40-L68).
- Игровые close-кнопки используют общий визуальный язык wasteland UI: orange-ветка `.crateModal__close`, `.levelModal__close`, `.modalClose`, `.lessonProgress__close` держит один 44×44 pseudo-element X-pattern, green-ветка `scModal__close`, `#talentOverlay .modalClose`, `.modalClose.scModal__close` переиспользует ту же геометрию с SC-skin; `Game.FontFloor` обязан пропускать эти селекторы и `chipCraftSlotRemove`, иначе крестики ломаются: [style.css](../../style.css#L1042-L1091), [style.css](../../style.css#L1337-L1423), [style.css](../../style.css#L1859-L1951), [style.css](../../style.css#L3116-L3164), [style.css](../../style.css#L4698-L4751), [src/ui/fontFloor.js](../../src/ui/fontFloor.js#L5-L11).
- Stage active slots держат `activeOff/activeDef/activeEco` только как CSS fallback; runtime branch-icon приходит через inline `--talentAbilityIcon`: [style.css](../../style.css#L2384-L2406).
- `techModal__rateLine`, `techModal__selectionInfo`, `techModal__dustRow`, `techModal__dustValue`, `techAccelChip--disabled::after` и `techAccelDustControls*` — CSS-контракт accel-модалки: он обязан одновременно показывать ставки `dust/chip/fragment`, выбранное ускорение, итог после применения, остаток до cap `95%`, нижнюю строку `доступно / выбрано` для кремниевой пыли, badge `Лимит` и `+/-` stepper: [style.css](../../style.css#L4206-L4422).
- `techAccelChip__label`, `chipCraftInvLabel`, `chipCraftSlotCard__name` и `chipCraftResultLabel` должны переносить полные названия только по ` + `; размер карточек задаётся общими vars `--chipLabelCardWidth/Height`: [style.css](../../style.css#L4104-L4327), [style.css](../../style.css#L4410-L4568), [style.css](../../style.css#L4904-L4915).
- `chipCraftSlot` / `chipCraftSlotRow--withResult` обязаны оставлять headroom для внешнего `chipCraftSlotRemove`, чтобы крестик во вкладке `Разобрать` не клиппился и совпадал по позиции с future-preview эталоном: [style.css](../../style.css#L4480-L4652), [style.css](../../style.css#L4887-L4904).
- Craft slots и future-preview используют квадратный карточный shell `chipCraftSlotCard`, визуально согласованный с inventory-карточками: [style.css](../../style.css#L4520-L4652).
- «Будущий» чип получает dashed-рамку на `.chipCraftResultChip--future`, placeholder — на `.chipCraftSlot--resultSlot`, а не через перекраску SVG: [style.css](../../style.css#L4887-L4904).

## Оглавление файла
| Блок | Строки | Назначение |
|---|---|---|
| Theme vars / body / HUD / stage shell | [style.css](../../style.css#L1-L267) | CSS-переменные, safe-area, stage layout, terminal panel |
| Buttons / menus / save views / forms | [style.css](../../style.css#L268-L1187) | HUD buttons, big menu, small menu, menu inputs, sliders |
| Overlay / modal base / critical / close controls / supercomputer HUD / root tiles | [style.css](../../style.css#L1188-L1700) | Общие модалки, `.btn`, `.scButton`, `.levelModal__close`, `.supercomputerHudBtn`, `.scRootTiles` |
| Talent modal / SC modal / tabs / tables / stage abilities | [style.css](../../style.css#L1701-L2665) | Talents, `.scModal__body`, table layout, stage active slots, debug panel start |
| Unified button behavior / merge popup / lesson progress / hangar core / workshop / tech unlock | [style.css](../../style.css#L2666-L4435) | Shared behavior layer, merge popup, hangar chips base, workshop, tech unlock |
| Chip craft / reagent row / production line storage modal | [style.css](../../style.css#L4335-L5175) | Inventory, slots, result preview, future chip frame, storage modal |

## Hotspots
- [style.css](../../style.css#L54-L68) — CRT/grain overlay и `body.pl-storage-open`.
- [style.css](../../style.css#L1042-L1091) — `crateModal__close` как базовый orange X-pattern.
- [style.css](../../style.css#L1337-L1423) — `levelModal__close` + `scModal__close`.
- [style.css](../../style.css#L1859-L1951) — базовый `modalClose` и talent-tree / SC-вариант того же close-pattern.
- [style.css](../../style.css#L3116-L3164) — `lessonProgress__close`.
- [style.css](../../style.css#L1443-L1547) — runtime контракт `.supercomputerHudBtn`.
- [style.css](../../style.css#L2061-L2124) — `.scModal__body` и scroll/pressed behavior.
- [style.css](../../style.css#L2395-L2406) — fallback icons `activeOff/activeDef/activeEco` для stage HUD.
- [style.css](../../style.css#L4206-L4422) — tech accel summary row, limit badges и dust controls.
- [style.css](../../style.css#L4410-L4652) — craft inventory / slot-card labels / `chipCraftSlotRemove`.
- [style.css](../../style.css#L4683-L4712) — bottom bar и dust action buttons.
- [style.css](../../style.css#L4887-L4915) — future chip frame и result label.
- [style.css](../../style.css#L4982-L5076) — production line storage modal.

## Зависимости
- Используется практически всеми UI runtime-модулями (`game.js`, `src/ui/*`).
- Особенно связан с: [HANGAR_CHIPS_UI_MAP.md](HANGAR_CHIPS_UI_MAP.md), [SUPERCOMPUTER_MENU_MAP.md](SUPERCOMPUTER_MENU_MAP.md), [PRODUCTION_LINE_RENDER_MAP.md](PRODUCTION_LINE_RENDER_MAP.md).

## Известные ограничения / TODO
- CSS-монолит ещё не разбит на секции по файлам; этот map — навигация, а не замена рефакторинга.
- Между блоками есть исторические переопределения; при правке всегда проверяй более поздние селекторы в хвосте файла.
