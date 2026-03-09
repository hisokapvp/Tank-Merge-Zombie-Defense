# hangarChipsUI.js — карта файла

> Агент-ориентировано. Обновлён: 2026-03-09.
> Файл большой (3456 строк): используйте этот map перед чтением исходника.

## Что это
`src/ui/hangarChipsUI.js` — единый runtime/UI-контроллер ангара: сетка ячеек, butterfly-SVG слоты, инвентарь чипов/фрагментов, workshop sub-tabs, tech unlock, chip craft, drag-drop и сохранение клиентского состояния.

## Быстрый старт для агента
- Хочешь править вкладки ангара → [switchHangarTab()](../../src/ui/hangarChipsUI.js#L602-L632), [switchWorkshopSubTab()](../../src/ui/hangarChipsUI.js#L634-L662).
- Хочешь править полные названия чипов/фрагментов и safe-wrap только по ` + ` → [_renderChipNameHtml()](../../src/ui/hangarChipsUI.js#L2231-L2248), [_showTechAccelModal()](../../src/ui/hangarChipsUI.js#L1864-L1939), [renderChipCraftPanel()](../../src/ui/hangarChipsUI.js#L2350-L2598).
- Хочешь править карточный шаблон craft-слотов / игровую кнопку удаления → [_renderCraftSlotCard()](../../src/ui/hangarChipsUI.js#L2249-L2264), [_renderCraftRemoveButton()](../../src/ui/hangarChipsUI.js#L2265-L2274).
- Хочешь править rates, dust planner и итоговый summary ускорения технологий → [_getTechAccelRates()](../../src/ui/hangarChipsUI.js#L770-L785), [_getTechAccelSelectionState()](../../src/ui/hangarChipsUI.js#L1824-L1840), [_showTechAccelModal()](../../src/ui/hangarChipsUI.js#L1864-L1941), [_formatTechAccelDustCount()](../../src/ui/hangarChipsUI.js#L1949-L1951), [_updateAccelPercentage()](../../src/ui/hangarChipsUI.js#L1953-L1997), [_applyTechAcceleration()](../../src/ui/hangarChipsUI.js#L1999-L2064).
- Хочешь править craft preview / future-chip frame → [renderChipCraftPanel()](../../src/ui/hangarChipsUI.js#L2350-L2598).
- Хочешь править drag-drop и клики craft panel → [_attachCraftPanelEvents()](../../src/ui/hangarChipsUI.js#L2600-L2767).
- Хочешь править overlay wiring / tooltips / slot-drag → [init()](../../src/ui/hangarChipsUI.js#L2935-L3315).

## Инварианты этого модуля ⚠️
- Вкладки переключаются только через [switchHangarTab()](../../src/ui/hangarChipsUI.js#L602-L632) и [switchWorkshopSubTab()](../../src/ui/hangarChipsUI.js#L634-L662): они синхронизируют `hidden`, `active` и `aria-selected`.
- В assemble-режиме `_canAddFragment()` запрещает тройку одинаковых фрагментов и больше одного special-мода: [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2077-L2101).
- `chipCraftModeRow` рендерится всегда над drop-zone, а `#chipCraftActionBtn` всегда существует под ней и только переключается между disabled/enabled по `_detectCraftMode()`: [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2350-L2598).
- `_getTechAccelRates()` — канонический источник accel-ставок: для 2ч технологий `dust/chip/fragment = 2/20/6`, для 5ч — `1/10/1`; кремниевая пыль, целые чипы и фрагменты делят общий remaining budget до cap `95%`, а `_formatTechAccelDustCount()` обязан показывать строку `доступно / выбрано`: [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L770-L785), [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L1824-L1951).
- `_updateAccelPercentage()` — единственный источник live-summary `{pct}/{total}/{left}`, disabled-state для `+/-` и badge `Лимит`; `_applyTechAcceleration()` обязан сжигать тот же `_techAccelDustSelected`, который показывался в модалке: [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L1953-L2064).
- `_renderChipNameHtml()` — канонический helper для полных названий чипов/фрагментов: он создаёт wrap-points только по ` + ` и переиспользуется в upgrade grid, tech accel modal, craft inventory и result cards; mid-word wrap запрещён. Карточный размер держится CSS vars `--chipLabelCardWidth/Height`: [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L1864-L1939), [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2209-L2248), [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2350-L2598), [style.css](../../style.css#L4104-L4327), [style.css](../../style.css#L4410-L4568), [style.css](../../style.css#L4904-L4915).
- Occupied craft slots и future-preview используют общий карточный паттерн `chipCraftSlotCard`: квадратная карточка, footer-title снизу, badge уровня для целых чипов; remove-контрол — sibling `chipCraftSlotRemove` в game-styled исполнении. Во вкладке `Разобрать` он не должен клиппиться и остаётся в том же углу, что у эталонного preview `Создать чип`: [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2249-L2274), [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2532-L2544), [style.css](../../style.css#L4599-L4652).
- «Будущий» чип в craft preview — это отдельный контейнер `.chipCraftResultChip--future`, а не смена палитры самого SVG: [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2532-L2544), [style.css](../../style.css#L4887-L4904).
- Авто-переключение craft-mode при клике/drag из инвентаря живёт только в `_addItemToSlot()`; не дублировать это ветвление в pointer handlers: [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2276-L2348), [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2600-L2679).

## Оглавление файла

### Блок: geometry / базовый render ангара
| Функция / блок | Строки | Назначение |
|---|---|---|
| `hc()`, `getGappedPoints()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L16-L67) | Lazy-доступ к `Game.HangarChips`, геометрия треугольников |
| `chipSvgComposed()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L133-L177) | SVG целого чипа из трёх подтреугольников |
| `_fragmentSvgUp()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L186-L201) | SVG фрагмента |
| `renderGrid()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L214-L246) | 4×4 grid ячеек ангара |
| `renderButterfly()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L260-L408) | SVG слоты, installed chips, rotate button, match-анимации |
| `_wouldChipCreateMatch()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L438-L480) | Предикат зелёной подсветки кандидата в match |
| `renderActiveMods()`, `renderChipsList()`, `render()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L484-L600) | Правый detail-panel и общий repaint |

### Блок: routing вкладок + tech study
| Функция / блок | Строки | Назначение |
|---|---|---|
| `switchHangarTab()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L602-L632) | Переключает `cells/workshop/techUnlock` |
| `switchWorkshopSubTab()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L634-L662) | Переключает `chipUpgrade/chipCraft` |
| `getTechStudying()`, `setTechStudying()`, `_startTechStudyTimer()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L674-L730) | Runtime таймера изучения технологий |
| `_getTechAccelRates()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L770-L785) | Data-driven ставки ускорения для dust/chip/fragment |
| `renderTechUnlockPanel()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L796-L915) | Главная панель tech unlock |
| `feedChipsForTech()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L917-L974) | Прогресс кормления/изучения |

### Блок: инвентарь, merge и tooltips
| Функция / блок | Строки | Назначение |
|---|---|---|
| `ensurePlayerChips()`, `ensurePlayerFragments()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L975-L1032) | Локальные inventory-массивы |
| `addPlayerChip()`, `removePlayerChipOne()`, `mergeChips()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L1035-L1108) | CRUD инвентаря и merge уровней |
| `renderChipUpgradeGrid()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L1118-L1184) | Workshop grid для merge |
| Tooltip helpers | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L1186-L1517) | Unified tooltips для inventory / craft / slot preview |
| `installChipAction()`, `removeChipAction()`, `handleOverlayClick()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L1520-L1779) | Установка/снятие чипов и click-routing overlay |

### Блок: tech modals + chip craft
| Функция / блок | Строки | Назначение |
|---|---|---|
| `_ensureTechModal()`, resource helpers, `_showTechCancelConfirm()`, `_showTechAccelModal()`, `_updateAccelPercentage()`, `_applyTechAcceleration()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L1785-L2064) | Модалки tech cancel/acceleration; общий budget для dust/chip/fragment, строка `доступно / выбрано`, summary `{pct}/{total}/{left}` и cap badges |
| `_resetCraftSlots()`, `_canAddFragment()`, `_previewAssembleResult()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2066-L2207) | Валидация craft state и live-preview |
| `_getChipDisplayName()`, `_renderChipNameHtml()`, `_truncateCraftCardLabel()`, `_renderCraftSlotCard()`, `_renderCraftRemoveButton()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2209-L2274) | Канонический display-name pipeline и общий карточный шаблон craft UI |
| `_addItemToSlot()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2276-L2348) | Авто-переключение mode и добавление item в craft slots |
| `renderChipCraftPanel()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2350-L2598) | Весь DOM chip craft: inventory, drop zone, result preview, reagent row |
| `_attachCraftPanelEvents()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2600-L2767) | Клики, dust mode, pointer-drag из inventory |
| `_executeDust()`, `_executeCraftAction()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2769-L2933) | Распыление и создание/разборка чипов |

### Блок: init / drag-drop / persistence API
| Функция / блок | Строки | Назначение |
|---|---|---|
| `init()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2935-L3315) | Главная инициализация overlay, hover-tooltips, slot-drag, chip merge drag |
| `getCells()`, `setCells()`, `show()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L3316-L3339) | Persisted hangar cells + safe-open overlay |
| Debug/public API export | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L3341-L3441) | Экспорт в `Game.HangarChipsUI` |

## Hotspots
- [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L1824-L2064) — tech accel modal, dust planner, total-summary и apply flow.
- [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2209-L2598) — chip-name pipeline, craft cards, result preview и future-chip frame.
- [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2600-L2933) — pointer events, dust mode, execute flow.
- [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2935-L3315) — overlay-level drag-drop/tooltips.
- [style.css](../../style.css#L4206-L4422) — tech accel summary row, dust row, disabled state и dust controls.
- [style.css](../../style.css#L4410-L4652) — inventory / slot labels и `chipCraftSlotCard` shell.
- [style.css](../../style.css#L4887-L4915) — future-frame и result label эталонного preview.

## Зависимости
- Использует: `Game.HangarChips`, `Game.Toast`, `Game.I18n`.
- Используется из: `src/ui/supercomputerMenu.js` через `showHangarMods()`.

## Известные ограничения / TODO
- Отдельного map для `assets/chips.json` пока нет; мод-описания читаются из runtime/tooltip-кода.
- Точный internal layout некоторых hover-tooltip веток не размечен отдельно; вход через `init()`.
