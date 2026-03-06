# hangarChipsUI.js — карта файла

> Агент-ориентировано. Обновлён: 2026-03-06.
> Файл большой (3249 строк): используйте этот map перед чтением исходника.

## Что это
`src/ui/hangarChipsUI.js` — единый runtime/UI-контроллер ангара: сетка ячеек, butterfly-SVG слоты, инвентарь чипов/фрагментов, workshop sub-tabs, tech unlock, chip craft, drag-drop и сохранение клиентского состояния.

## Быстрый старт для агента
- Хочешь править вкладки ангара → [switchHangarTab()](../../src/ui/hangarChipsUI.js#L602-L632), [switchWorkshopSubTab()](../../src/ui/hangarChipsUI.js#L634-L662).
- Хочешь править craft preview / «будущий» чип → [renderChipCraftPanel()](../../src/ui/hangarChipsUI.js#L2171-L2407).
- Хочешь править drag-drop и клики craft panel → [_attachCraftPanelEvents()](../../src/ui/hangarChipsUI.js#L2408-L2576).
- Хочешь править overlay wiring / tooltips / slot-drag → [init()](../../src/ui/hangarChipsUI.js#L2743-L3249).

## Инварианты этого модуля ⚠️
- Вкладки переключаются только через [switchHangarTab()](../../src/ui/hangarChipsUI.js#L602-L632) и [switchWorkshopSubTab()](../../src/ui/hangarChipsUI.js#L634-L662): они синхронизируют `hidden`, `active` и `aria-selected`.
- В assemble-режиме `_canAddFragment()` запрещает тройку одинаковых фрагментов и больше одного special-мода: [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L1956-L1984).
- «Будущий» чип в craft preview — это отдельный контейнер `.chipCraftResultChip--future`, а не смена палитры самого SVG: [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2334-L2354), [style.css](../../style.css#L4487-L4513).

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
| `_ensureTechModal()`, `_showTechCancelConfirm()`, `_showTechAccelModal()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L1726-L1870) | Модалки tech cancel/acceleration |
| `_resetCraftSlots()`, `_canAddFragment()`, `_previewAssembleResult()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L1950-L1997) | Валидация craft state |
| `_addItemToSlot()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2097-L2170) | Авто-переключение mode и добавление item в craft slots |
| `renderChipCraftPanel()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2171-L2407) | Весь DOM chip craft: inventory, drop zone, result preview, reagent row |
| `_attachCraftPanelEvents()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2408-L2576) | Клики, dust mode, pointer-drag из inventory |
| `_executeDust()`, `_executeCraftAction()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2577-L2713) | Распыление и создание/разборка чипов |

### Блок: init / drag-drop / persistence API
| Функция / блок | Строки | Назначение |
|---|---|---|
| `init()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2743-L3123) | Главная инициализация overlay, hover-tooltips, slot-drag, chip merge drag |
| `getCells()`, `setCells()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L3124-L3141) | Persisted hangar cells |
| `show()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L3142-L3147) | Safe-open overlay |
| Debug/public API export | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L3149-L3249) | Экспорт в `Game.HangarChipsUI` |

## Hotspots
- [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2171-L2407) — craft panel layout и future-chip preview.
- [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2408-L2713) — pointer events, dust mode, execute flow.
- [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2743-L3123) — overlay-level drag-drop/tooltips.

## Зависимости
- Использует: `Game.HangarChips`, `Game.Toast`, `Game.I18n`.
- Используется из: `src/ui/supercomputerMenu.js` через `showHangarMods()`.

## Известные ограничения / TODO
- Отдельного map для `assets/chips.json` пока нет; мод-описания читаются из runtime/tooltip-кода.
- Точный internal layout некоторых hover-tooltip веток не размечен отдельно; вход через `init()`.
