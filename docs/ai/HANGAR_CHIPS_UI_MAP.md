# hangarChipsUI.js — карта файла

> Агент-ориентировано. Обновлён: 2026-03-07.
> Файл большой (3326 строк): используйте этот map перед чтением исходника.

## Что это
`src/ui/hangarChipsUI.js` — единый runtime/UI-контроллер ангара: сетка ячеек, butterfly-SVG слоты, инвентарь чипов/фрагментов, workshop sub-tabs, tech unlock, chip craft, drag-drop и сохранение клиентского состояния.

## Быстрый старт для агента
- Хочешь править вкладки ангара → [switchHangarTab()](../../src/ui/hangarChipsUI.js#L602-L632), [switchWorkshopSubTab()](../../src/ui/hangarChipsUI.js#L634-L662).
- Хочешь править полные названия чипов/фрагментов и safe-wrap только по ` + ` → [_renderChipNameHtml()](../../src/ui/hangarChipsUI.js#L2116-L2126), [_showTechAccelModal()](../../src/ui/hangarChipsUI.js#L1760-L1801), [renderChipCraftPanel()](../../src/ui/hangarChipsUI.js#L2235-L2429).
- Хочешь править карточный шаблон craft-слотов / игровую кнопку удаления → [_renderCraftSlotCard()](../../src/ui/hangarChipsUI.js#L2134-L2148), [_renderCraftRemoveButton()](../../src/ui/hangarChipsUI.js#L2150-L2159).
- Хочешь править craft preview / future-chip frame → [renderChipCraftPanel()](../../src/ui/hangarChipsUI.js#L2235-L2483).
- Хочешь править drag-drop и клики craft panel → [_attachCraftPanelEvents()](../../src/ui/hangarChipsUI.js#L2485-L2652).
- Хочешь править overlay wiring / tooltips / slot-drag → [init()](../../src/ui/hangarChipsUI.js#L2820-L3200).

## Инварианты этого модуля ⚠️
- Вкладки переключаются только через [switchHangarTab()](../../src/ui/hangarChipsUI.js#L602-L632) и [switchWorkshopSubTab()](../../src/ui/hangarChipsUI.js#L634-L662): они синхронизируют `hidden`, `active` и `aria-selected`.
- В assemble-режиме `_canAddFragment()` запрещает тройку одинаковых фрагментов и больше одного special-мода: [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L1962-L1986).
- `chipCraftModeRow` рендерится всегда над drop-zone, а `#chipCraftActionBtn` всегда существует под ней и только переключается между disabled/enabled по `_detectCraftMode()`: [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2235-L2483).
- `_renderChipNameHtml()` — канонический helper для полных названий чипов/фрагментов: он создаёт wrap-points только по ` + ` и переиспользуется в upgrade grid, tech accel modal, craft inventory и result cards; mid-word wrap запрещён. Карточный размер держится CSS vars `--chipLabelCardWidth/Height`: [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L1760-L1801), [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2116-L2126), [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2235-L2429), [style.css](../../style.css#L4063-L4139), [style.css](../../style.css#L4224-L4398), [style.css](../../style.css#L4692-L4719).
- Occupied craft slots и future-preview используют общий карточный паттерн `chipCraftSlotCard`: квадратная карточка, footer-title снизу, badge уровня для целых чипов; remove-контрол — sibling `chipCraftSlotRemove` в game-styled исполнении. Во вкладке `Разобрать` он не должен клиппиться и остаётся в том же углу, что у эталонного preview `Создать чип`: [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2134-L2159), [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2369-L2429), [style.css](../../style.css#L4288-L4466).
- «Будущий» чип в craft preview — это отдельный контейнер `.chipCraftResultChip--future`, а не смена палитры самого SVG: [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2417-L2429), [style.css](../../style.css#L4701-L4719).
- Авто-переключение craft-mode при клике/drag из инвентаря живёт только в `_addItemToSlot()`; не дублировать это ветвление в pointer handlers: [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2161-L2233), [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2547-L2598).

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
| `renderTechUnlockPanel()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L781-L895) | Главная панель tech unlock |
| `feedChipsForTech()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L896-L953) | Прогресс кормления/изучения |

### Блок: инвентарь, merge и tooltips
| Функция / блок | Строки | Назначение |
|---|---|---|
| `ensurePlayerChips()`, `ensurePlayerFragments()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L954-L1009) | Локальные inventory-массивы |
| `addPlayerChip()`, `removePlayerChipOne()`, `mergeChips()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L1014-L1087) | CRUD инвентаря и merge уровней |
| `renderChipUpgradeGrid()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L1097-L1163) | Workshop grid для merge |
| Tooltip helpers | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L1164-L1418) | Unified tooltips для inventory / craft / slot preview |
| `installChipAction()`, `removeChipAction()`, `handleOverlayClick()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L1426-L1725) | Установка/снятие чипов и click-routing overlay |

### Блок: tech modals + chip craft
| Функция / блок | Строки | Назначение |
|---|---|---|
| `_ensureTechModal()`, `_showTechCancelConfirm()`, `_showTechAccelModal()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L1726-L1948) | Модалки tech cancel/acceleration; accel-grid показывает полные названия чипов/фрагментов через `_renderChipNameHtml()` |
| `_resetCraftSlots()`, `_canAddFragment()`, `_previewAssembleResult()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L1950-L2091) | Валидация craft state и live-preview |
| `_getChipDisplayName()`, `_renderChipNameHtml()`, `_truncateCraftCardLabel()`, `_renderCraftSlotCard()`, `_renderCraftRemoveButton()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2094-L2159) | Канонический display-name pipeline и общий карточный шаблон craft UI |
| `_addItemToSlot()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2161-L2233) | Авто-переключение mode и добавление item в craft slots |
| `renderChipCraftPanel()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2235-L2483) | Весь DOM chip craft: inventory, drop zone, result preview, reagent row |
| `_attachCraftPanelEvents()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2485-L2652) | Клики, dust mode, pointer-drag из inventory |
| `_executeDust()`, `_executeCraftAction()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2654-L2818) | Распыление и создание/разборка чипов |

### Блок: init / drag-drop / persistence API
| Функция / блок | Строки | Назначение |
|---|---|---|
| `init()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2820-L3200) | Главная инициализация overlay, hover-tooltips, slot-drag, chip merge drag |
| `getCells()`, `setCells()`, `show()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L3201-L3285) | Persisted hangar cells + safe-open overlay |
| Debug/public API export | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L3287-L3326) | Экспорт в `Game.HangarChipsUI` |

## Hotspots
- [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L1760-L1801) — tech accel modal и full-name labels.
- [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2094-L2483) — chip-name pipeline, craft cards, result preview и future-chip frame.
- [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2485-L2798) — pointer events, dust mode, execute flow.
- [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2820-L3200) — overlay-level drag-drop/tooltips.
- [style.css](../../style.css#L4224-L4398) — inventory / slot labels и `chipCraftSlotCard` shell.
- [style.css](../../style.css#L4692-L4719) — future-frame и result label эталонного preview.

## Зависимости
- Использует: `Game.HangarChips`, `Game.Toast`, `Game.I18n`.
- Используется из: `src/ui/supercomputerMenu.js` через `showHangarMods()`.

## Известные ограничения / TODO
- Отдельного map для `assets/chips.json` пока нет; мод-описания читаются из runtime/tooltip-кода.
- Точный internal layout некоторых hover-tooltip веток не размечен отдельно; вход через `init()`.
