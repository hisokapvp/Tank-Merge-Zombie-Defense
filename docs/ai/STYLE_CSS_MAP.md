# style.css — карта файла

> Агент-ориентировано. Обновлён: 2026-03-23.
> `style.css` — CSS-монолит проекта (~7.1k строк) и один из главных hotspot-файлов.

## Что это
Файл содержит почти весь визуальный контракт проекта: HUD, кнопки, menu/big menu, модалки, supercomputer overlays, talents, debug UI, hangar chips, craft panel и storage modal production line.

## Быстрый старт для агента
- HUD / supercomputer HUD button → [style.css](../../style.css#L1-L316), [style.css](../../style.css#L1498-L1595).
- SC overlays / root tiles / modal scroll contract → [style.css](../../style.css#L1195-L1204), [style.css](../../style.css#L1528-L1574), [style.css](../../style.css#L2061-L2124).
- Hangar chips / workshop / tech unlock → [style.css](../../style.css#L3063-L4435).
- Chip craft / future chip / storage modal → [style.css](../../style.css#L4335-L7090).

## Инварианты этого модуля ⚠️
- `.supercomputerHudBtn` позиционируется только через `transform`; анимации по `transform` для runtime-перемещения запрещены: [style.css](../../style.css#L1443-L1547).
- В supercomputer/talents overlays pressed/hover behavior не должен создавать layout shift и второй scrollbar: [style.css](../../style.css#L2061-L2124).
- `body.pl-storage-open::before` входит в общий CRT/grain overlay семейства menu/scmodal/critical; storage modal не должен визуально выпадать из этой группы: [style.css](../../style.css#L40-L68).
- Игровые close-кнопки используют общий визуальный язык wasteland UI: orange-ветка `.crateModal__close`, `.levelModal__close`, `.modalClose`, `.lessonProgress__close` держит один 44×44 pseudo-element X-pattern, green-ветка `scModal__close`, `#talentOverlay .modalClose`, `.modalClose.scModal__close` переиспользует ту же геометрию с SC-skin. Hover/active больше не имеют transform-сдвигов: крестик центрируется через `top/left:50% + translate(-50%, -50%)`, а pressed-состояние меняет только visual chrome, не hit-area: [style.css](../../style.css#L1042-L1095), [style.css](../../style.css#L1340-L1426), [style.css](../../style.css#L1863-L1957), [style.css](../../style.css#L3121-L3172), [src/ui/fontFloor.js](../../src/ui/fontFloor.js#L5-L11).
  **⚠️ ОБЯЗАТЕЛЬНО для каждой close-кнопки:** `:hover`-правило ДОЛЖНО содержать `transform:none !important`. Причина: `src/ui/buttonBehavior.js` → `decorateTree()` добавляет класс `uiButtonBehavior` ко ВСЕМ `<button>` в DOM. Hover-правило `uiButtonBehavior` применяет `transform: translateY(-2px) scale(1.01)`. Все close-кнопки имеют `overflow:hidden` + pseudo-element X через `::before`+`::after` — без `transform:none !important` transform из `uiButtonBehavior` режет псевдоэлементный X, создавая видимый разрыв. Забыть этот override = потерять X на наведении.
- Talent tree visual contract держится в `style.css`: `talentTreeContainer` задаёт `--talent-node-icon-size: 40px`, уменьшенный `--talent-row-gap`, базовые рёбра остаются явно серыми, а anchor линий считается от центра `.talentNodeIcon`; renderer рисует прямые center-to-center рёбра через `buildEdgePath()` без elbow fallback. Green glow/pulse разрешён только для `ready/active` edges от уже прокачанных талантов, travelling dash/particle flow не возвращается, а `applyEdgeMotion()` пишет per-edge `--talent-edge-wobble-duration`, чтобы ready-active и upgraded связи wobble/shake заметнее базового ready-state. Locked node остаётся читаемым и получает нейтральный overlay через `.talentNode.locked::before`, applied-node в `#talentOverlay` остаётся зелёным, а `maxed` добавляет orange overlay только на внутренний icon-shell: [style.css](../../style.css#L2076-L2108), [style.css](../../style.css#L2134-L2179), [style.css](../../style.css#L2181-L2241), [style.css](../../style.css#L2263-L2350), [src/ui/talentOverlayRenderer.js](../../src/ui/talentOverlayRenderer.js#L19-L64), [src/ui/talentOverlayRenderer.js](../../src/ui/talentOverlayRenderer.js#L91-L151), [src/ui/talentOverlayRenderer.js](../../src/ui/talentOverlayRenderer.js#L239-L239).
- Stage active slots держат `activeOff/activeDef/activeEco` только как CSS fallback; runtime branch-icon приходит через inline `--talentAbilityIcon`: [style.css](../../style.css#L2384-L2406).
- `#resetTalentsModal` и `#talentResetCooldownModal` делят один modal-shell contract: symmetric horizontal padding на `.levelModal__contentWrap`, равномерный `menuInlineActions`, green `scModal__close` и ad-style CTA `.talentResetCooldownAdBtn*` для refresh-stub. Если менять один из диалогов, надо держать оба визуально синхронными: [style.css](../../style.css#L2377-L2469).
- `.workshopSubTabs--nested` / `.workshopSubTab--nested` — отдельный слой стилей для recycle-only subtabs внутри Мастерской; не смешивать их с top-level workshop tabs через одноразовые inline tweaks: [style.css](../../style.css#L3749-L3756).
- `techModal__rateLine`, `techModal__selectionInfo`, `techModal__dustRow`, `techModal__dustValue`, `techAccelGridWrap`, `techAccelChip--disabled::after` и `techAccelDustControls*` — CSS-контракт accel-модалки: он обязан одновременно показывать ставки `dust/chip/fragment`, выбранное ускорение, итог после применения, остаток до cap `95%`, bordered-wrap со scrollable grid, нижнюю строку `доступно / выбрано` для кремниевой пыли, badge `Лимит` и `+/-` stepper: [style.css](../../style.css#L4222-L4315).
- `.techModal__btns` находится **вне** `.techModal__footer` в DOM-дереве, поэтому `gap` footer-flex-контейнера на него не действует. Отступ между `techModal__selectionInfo` и кнопками задаётся исключительно `margin-top` на `.techModal__btns`. `techAccelGridWrap` имеет `overflow-x:hidden` — горизонтальный скролл запрещён.
- `chipCraftBottomBar` (включая `chipCraftDustResource`) рендерится **только** когда `isDustView === true`. В вкладках `Создание чипов` и `Разобрать` этот блок полностью отсутствует. Инвентарная сетка в non-dust видах принудительно ограничена одним столбцом через `.chipCraftLayout:not(.chipCraftLayout--singleCol) .chipCraftInvGrid { grid-template-columns:1fr }`.
- `techAccelChip__label`, `chipCraftInvLabel`, `chipCraftSlotCard__name` и `chipCraftResultLabel` должны переносить полные названия только по ` + `; размер карточек задаётся общими vars `--chipLabelCardWidth/Height`: [style.css](../../style.css#L4104-L4327), [style.css](../../style.css#L4410-L4568), [style.css](../../style.css#L4904-L4915).
- Underground hangar modal держит отдельный visual contract: `.ughPanel > .levelModal__title` центрирует заголовок внутри panel shell, `.ughDroneClusterLabel` скрыт и не должен возвращаться в DOM как видимый заголовок, `.ughCell__emptyMark/.ughDroneCell__emptyMark` выключены без изменения размеров ячеек, `.ughCell__levelBadge/.ughDroneCell__levelBadge` остаются plain text у нижней кромки по центру, а `transferAll` теперь живёт в отдельной центрированной `.ughTransferLane` между верхним и подземным блоками как icon-only CTA `44×44` с зелёной стрелкой `#4af626`: [style.css](../../style.css#L4079-L4183), [style.css](../../style.css#L4321-L4406).
- `chipCraftSlot` / `chipCraftSlotRow--withResult` обязаны оставлять headroom для внешнего `chipCraftSlotRemove`, чтобы крестик во вкладке `Разобрать` не клиппился и совпадал по позиции с future-preview эталоном: [style.css](../../style.css#L4480-L4652), [style.css](../../style.css#L4887-L4904).
- Craft slots и future-preview используют квадратный карточный shell `chipCraftSlotCard`, визуально согласованный с inventory-карточками: [style.css](../../style.css#L4520-L4652).
- «Будущий» чип получает dashed-рамку на `.chipCraftResultChip--future`, placeholder — на `.chipCraftSlot--resultSlot`, а не через перекраску SVG: [style.css](../../style.css#L4887-L4904).
- Storage modal использует отдельный header-shell `.plStorage__header` с right-side wrapper `.plStorage__headerActions`: help и close собраны в одной action-группе справа, title остаётся по центру и получает дополнительный top padding, а grid ячеек по-прежнему centred; filled-cell level badge — plain text у нижней кромки, empty slots не получают placeholder glyph, drag preview живёт отдельным fixed-layer `.plStorage__dragPreview` поверх body: [style.css](../../style.css#L7001-L7114).

## Оглавление файла
| Блок | Строки | Назначение |
|---|---|---|
| Theme vars / body / HUD / stage shell | [style.css](../../style.css#L1-L267) | CSS-переменные, safe-area, stage layout, terminal panel |
| Buttons / menus / save views / forms | [style.css](../../style.css#L268-L1187) | HUD buttons, big menu, small menu, menu inputs, sliders |
| Overlay / modal base / critical / close controls / supercomputer HUD / root tiles | [style.css](../../style.css#L1188-L1700) | Общие модалки, `.btn`, `.scButton`, `.levelModal__close`, `.supercomputerHudBtn`, `.scRootTiles` |
| Talent modal / SC modal / tabs / tables / stage abilities | [style.css](../../style.css#L1701-L2665) | Talents, `.scModal__body`, table layout, stage active slots, debug panel start |
| Unified button behavior / merge popup / lesson progress / hangar core / workshop / tech unlock | [style.css](../../style.css#L2666-L4435) | Shared behavior layer, merge popup, hangar chips base, workshop, nested recycle subtabs, tech unlock |
| Chip craft / reagent row / recycle single-column layout / production line storage modal | [style.css](../../style.css#L4335-L7090) | Inventory, slots, result preview, dust-only layout, future chip frame, storage header/help/grid/drag preview |

## Hotspots
- [style.css](../../style.css#L54-L68) — CRT/grain overlay и `body.pl-storage-open`.
- [style.css](../../style.css#L1042-L1095) — `crateModal__close` как базовый orange X-pattern без hover/active layout shift.
- [style.css](../../style.css#L1340-L1426) — `levelModal__close` + `scModal__close`.
- [style.css](../../style.css#L1863-L1957) — базовый `modalClose` и talent-tree / SC-вариант того же close-pattern.
- [style.css](../../style.css#L3121-L3172) — `lessonProgress__close`.
- [style.css](../../style.css#L1443-L1547) — runtime контракт `.supercomputerHudBtn`.
- [style.css](../../style.css#L2061-L2124) — `.scModal__body` и scroll/pressed behavior.
- [style.css](../../style.css#L2076-L2108) — talent tree container vars, grey base edges и постоянный SVG-layer.
- [style.css](../../style.css#L2134-L2179) — ready/active edge pulse + stronger shake/wobble contract без travelling dash flow.
- [style.css](../../style.css#L2377-L2469) — reset talents confirm + cooldown modal shell, symmetric padding и ad-style refresh CTA.
- [style.css](../../style.css#L2181-L2241) — talent tree grid row-gap и центрированный icon-shell, от которого считаются anchors линий.
- [style.css](../../style.css#L2263-L2274) — locked-node neutral overlay без unreadable alpha-dim.
- [style.css](../../style.css#L2275-L2307) — applied/pending/maxed shell states на talent node.
- [style.css](../../style.css#L2325-L2350) — зелёный applied-state и orange overlay maxed-state на внутреннем icon-shell.
- [style.css](../../style.css#L2395-L2406) — fallback icons `activeOff/activeDef/activeEco` для stage HUD.
- [style.css](../../style.css#L3749-L3756) — nested recycle subtabs.
- [style.css](../../style.css#L4079-L4183) — underground hangar modal title/empty-state/level-badge contract.
- [style.css](../../style.css#L4321-L4406) — underground hangar centered transfer lane + icon-only CTA.
- [style.css](../../style.css#L4222-L4315) — tech accel summary row, bordered grid wrapper, limit badges и dust controls.
- [style.css](../../style.css#L4410-L4652) — craft inventory / slot-card labels / `chipCraftSlotRemove`.
- [style.css](../../style.css#L4471-L4474) — single-column dust layout.
- [style.css](../../style.css#L4683-L4712) — bottom bar и dust action buttons.
- [style.css](../../style.css#L4887-L4915) — future chip frame и result label.
- [style.css](../../style.css#L7001-L7058) — production line storage cells, level badge и drag preview.
- [style.css](../../style.css#L7069-L7114) — production line storage header right-actions wrapper, help/close grouping и title padding.

## Зависимости
- Используется практически всеми UI runtime-модулями (`game.js`, `src/ui/*`).
- Особенно связан с: [HANGAR_CHIPS_UI_MAP.md](HANGAR_CHIPS_UI_MAP.md), [SUPERCOMPUTER_MENU_MAP.md](SUPERCOMPUTER_MENU_MAP.md), [PRODUCTION_LINE_RENDER_MAP.md](PRODUCTION_LINE_RENDER_MAP.md).

## Известные ограничения / TODO
- CSS-монолит ещё не разбит на секции по файлам; этот map — навигация, а не замена рефакторинга.
- Между блоками есть исторические переопределения; при правке всегда проверяй более поздние селекторы в хвосте файла.
