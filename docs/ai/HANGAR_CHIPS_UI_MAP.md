# hangarChipsUI.js — карта файла

> Агент-ориентировано. Обновлён: 2026-03-23.
> Файл большой (~4460 строк): используйте этот map перед чтением исходника.

## Что это
`src/ui/hangarChipsUI.js` — единый runtime/UI-контроллер ангара: сетка ячеек, butterfly-SVG слоты, инвентарь чипов/фрагментов, workshop sub-tabs, tech unlock, chip craft, drag-drop и сохранение клиентского состояния.

## Быстрый старт для агента
- Хочешь править вкладки ангара → [switchHangarTab()](../../src/ui/hangarChipsUI.js#L845), [switchWorkshopSubTab()](../../src/ui/hangarChipsUI.js#L886), [switchChipRecycleSubTab()](../../src/ui/hangarChipsUI.js#L937).
- Хочешь править сброс временного состояния мастерской при выходе из вкладок/окна → [switchHangarTab()](../../src/ui/hangarChipsUI.js#L845), [switchWorkshopSubTab()](../../src/ui/hangarChipsUI.js#L886), [switchChipRecycleSubTab()](../../src/ui/hangarChipsUI.js#L937), [resetTransientUiState()](../../src/ui/hangarChipsUI.js#L2652).
- Хочешь править полные названия чипов/фрагментов и safe-wrap только по ` + ` → [_renderChipNameHtml()](../../src/ui/hangarChipsUI.js#L2311-L2320), [_showTechAccelModal()](../../src/ui/hangarChipsUI.js#L1934-L2012), [renderChipCraftPanel()](../../src/ui/hangarChipsUI.js#L2609-L2878).
- Хочешь править карточный шаблон craft-слотов / силовые линии / результатные модалки → [_renderCraftSlotCard()](../../src/ui/hangarChipsUI.js#L2333-L2348), [_renderCraftRemoveButton()](../../src/ui/hangarChipsUI.js#L2350-L2355), [_renderCraftEnergyLines()](../../src/ui/hangarChipsUI.js#L2363-L2376), [_showCraftOutcomeModal()](../../src/ui/hangarChipsUI.js#L2484-L2506), [_showCraftRiskConfirmModal()](../../src/ui/hangarChipsUI.js#L2508-L2528).
- Хочешь править completion unlock технологий и achievements sync → [_completeTechStudy()](../../src/ui/hangarChipsUI.js#L1011), [feedChipsForTech()](../../src/ui/hangarChipsUI.js#L1203), [game.js](../../game.js#L9348-L9373).
- Хочешь править rates, dust planner и итоговый summary ускорения технологий → [_getTechAccelRates()](../../src/ui/hangarChipsUI.js#L1074), [_getTechAccelSelectionState()](../../src/ui/hangarChipsUI.js#L2240), [_showTechAccelModal()](../../src/ui/hangarChipsUI.js#L2296), [_updateAccelPercentage()](../../src/ui/hangarChipsUI.js#L2386), [_applyTechAcceleration()](../../src/ui/hangarChipsUI.js#L2432).
- Хочешь править split между assemble-panel и recycle-panel → [renderChipCraftPanel()](../../src/ui/hangarChipsUI.js#L2410-L2677), [_attachCraftPanelEvents()](../../src/ui/hangarChipsUI.js#L2679-L2789).
- Хочешь править overlay wiring / tooltips / slot-drag → [init()](../../src/ui/hangarChipsUI.js#L3966-L4358).

## Инварианты этого модуля ⚠️
- Вкладки переключаются только через [switchHangarTab()](../../src/ui/hangarChipsUI.js#L845-L884), [switchWorkshopSubTab()](../../src/ui/hangarChipsUI.js#L886-L935) и [switchChipRecycleSubTab()](../../src/ui/hangarChipsUI.js#L937-L960): именно они синхронизируют `hidden`, `active`, `tabindex` и `aria-selected`.
- Успешное завершение изучения технологии обязано вызвать `Game.onModifierTechnologyUnlocked(modId)` и в timer-path, и в direct feed-path, но только после `h.unlockTechnology(...).ok`; иначе achievements runtime, `completedModifierTechs` и persistence counters разойдутся с фактическим unlock-состоянием ангара: [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L1011-L1029), [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L1203-L1247), [game.js](../../game.js#L9348-L9373).
- Top-level `workshopPanelChipCraft` — assemble-only panel, а `workshopPanelChipRecycle` управляет nested recycle-tabs `dust/disassemble/reprogram`; `_dustMode`, `_craftMode` и transient-state перепрограммирования должны вытекать из текущей под-вкладки, а не из отдельного UX-toggle: [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L661-L716), [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2800-L2800).
- В assemble-режиме `_canAddFragment()` запрещает тройку одинаковых фрагментов и больше одного special-мода: [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2077-L2101).
- Dust-view recycle-panel обязан скрывать preview/right-column и переводить layout в single-column через `.chipCraftLayout--singleCol`; disassemble-view сохраняет preview/action-column и работает только с целыми чипами: [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2418-L2668), [style.css](../../style.css#L4471-L4474).
- При уходе из `Создание чипов`, `Распылить`, `Разобрать`, `Перепрограммировать` или при закрытии окна ангара временное состояние (`_dustSelected`, `_craftSlots`, reagent dust, `_reprogramSourceFragmentId`, `_reprogramTargetFragmentId`) обязано очищаться через `resetTransientUiState()`, иначе recycle-flow можно эксплуатировать после изменения инвентаря: [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L604-L716), [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2244-L2249), [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L1392-L1411) _(строки приблизительные, проверить после 2026-03-10)_ .
- Во вкладке `Распылить` фрагменты больше не группируются по `fragmentId`: UI рендерит каждую единицу отдельной карточкой с собственным `data-dust-key`, тогда как остальные вкладки по-прежнему показывают агрегированный стек: [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2449-L2508) _(строки приблизительные, проверить после 2026-03-10)_ .
- `_getTechAccelRates()` — канонический источник accel-ставок: для 2ч технологий `dust/chip/fragment = 2/20/6`, для 5ч — `1/10/1`; hard cap задаётся `TECH_ACCEL_MAX_PCT = 96`, поэтому кремниевая пыль, целые чипы и фрагменты делят общий remaining budget до `96%`, а `_formatTechAccelDustCount()` обязан показывать строку `доступно / выбрано`: [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L12-L14), [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L1074-L1084), [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2296-L2404).
- `_updateAccelPercentage()` — единственный источник live-summary `{pct}/{total}/{left}`, disabled-state для `+/-` и badge `Лимит`; `_applyTechAcceleration()` обязан сжигать тот же `_techAccelDustSelected`, который показывался в модалке. Summary располагается под dust-row в footer того же modal-state: [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2382-L2454).
- `_renderChipNameHtml()` — канонический helper для полных названий чипов/фрагментов: он создаёт wrap-points только по ` + ` и переиспользуется в upgrade grid, tech accel modal, craft inventory и result cards; mid-word wrap запрещён. Карточный размер держится CSS vars `--chipLabelCardWidth/Height`: [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L1864-L1939), [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2209-L2248), [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2350-L2598), [style.css](../../style.css#L4104-L4327), [style.css](../../style.css#L4410-L4568), [style.css](../../style.css#L4904-L4915).
- Occupied craft slots и future-preview используют общий карточный паттерн `chipCraftSlotCard`: квадратная карточка, footer-title снизу, badge уровня для целых чипов; remove-контрол — sibling `chipCraftSlotRemove` в game-styled исполнении. Во вкладке `Разобрать` он не должен клиппиться и остаётся в том же углу, что у эталонного preview `Создать чип`: [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2249-L2274), [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2532-L2544), [style.css](../../style.css#L4599-L4652).
- «Будущий» чип в craft preview — это отдельный контейнер `.chipCraftResultChip--future`, а не смена палитры самого SVG: [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2532-L2544), [style.css](../../style.css#L4887-L4904).
- Assemble preview всегда рендерит 3 ingredient-slots, отдельную колонку силовых линий и result-card; зелёная стрелка больше не используется. Пустые линии статичны, заполненные получают `chipCraftEnergyLine--filled`, а блок `chipCraftReagentRow` закреплён внизу drop-zone через `margin-top:auto`: [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2363-L2397), [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2758-L2850), [style.css](../../style.css#L4814-L4879), [style.css](../../style.css#L5344-L5408).
- Assemble craft перед шансом < 100% обязан показывать confirm modal, а после любого roll — result modal. При провале сжигается только один случайный выбранный фрагмент и reagent dust, если он был добавлен; остальные выбранные фрагменты остаются в инвентаре: [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L1746-L1758), [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2484-L2528), [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L3102-L3194), [style.css](../../style.css#L4310-L4379).
- Авто-переключение craft-mode при клике/drag из инвентаря живёт только в `_addItemToSlot()`; reprogram-flow — единственное исключение, где fragment-click не должен переключать панель обратно в assemble, а должен только заполнить `_reprogramSourceFragmentId`: [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2680-L2694).

## Оглавление файла

### Блок: geometry / базовый render ангара
| Функция / блок | Строки | Назначение |
|---|---|---|
| `hc()`, `getGappedPoints()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L16-L67) | Lazy-доступ к `Game.HangarChips`, геометрия треугольников |
| `chipSvgComposed()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L133-L177) | SVG целого чипа из трёх подтреугольников |
| `_fragmentSvgUp()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L186-L201) | SVG фрагмента |
| `renderGrid()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L214-L246) | 4×4 grid ячеек ангара |
| `renderButterfly()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L260-L408) | SVG слоты, installed chips, 3 action buttons (rotateCCW/CW/remove), match-анимации. State: `_activeSlotActions` |
| `_wouldChipCreateMatch()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L438-L480) | Предикат зелёной подсветки кандидата в match |
| `renderActiveMods()`, `renderChipsList()`, `render()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L484-L600) | Правый detail-panel и общий repaint |

### Блок: routing вкладок + tech study
| Функция / блок | Строки | Назначение |
|---|---|---|
| `switchHangarTab()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L845-L884) | Переключает `cells/workshop/techUnlock`, при входе в workshop ререндерит активную под-вкладку |
| `switchWorkshopSubTab()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L886-L935) | Переключает `chipUpgrade/chipCraft/chipRecycle` |
| `switchChipRecycleSubTab()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L937-L960) | Переключает nested recycle-tabs `dust/disassemble/reprogram` |
| `getTechStudying()`, `setTechStudying()`, `_startTechStudyTimer()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L976-L1009) | Runtime таймера изучения технологий |
| `_completeTechStudy()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L1011-L1029) | Завершает timer-path unlock и шлёт `Game.onModifierTechnologyUnlocked(modId)` |
| `_getTechAccelRates()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L1074-L1084) | Data-driven ставки ускорения для dust/chip/fragment |
| `renderTechUnlockPanel()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L1100-L1190) | Главная панель tech unlock |
| `feedChipsForTech()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L1203-L1247) | Feed-путь изучения/instant unlock с тем же callback в achievements runtime |

### Блок: инвентарь, merge и tooltips
| Функция / блок | Строки | Назначение |
|---|---|---|
| `ensurePlayerChips()`, `ensurePlayerFragments()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L975-L1032) | Локальные inventory-массивы |
| `addPlayerChip()`, `removePlayerChipOne()`, `mergeChips()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L1035-L1108) | CRUD инвентаря и merge уровней |
| `renderChipUpgradeGrid()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L1118-L1184) | Workshop grid для merge |
| Tooltip helpers | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L1186-L1517) | Unified tooltips для inventory / craft / slot preview |
| `installChipAction()`, `removeChipAction()`, `handleOverlayClick()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L1520-L1779) | Установка/снятие чипов и click-routing overlay. Клик по занятому слоту toggles `_activeSlotActions` (3 кнопки), крестик — единственный путь убрать чип |

### Блок: tech modals + chip craft
| Функция / блок | Строки | Назначение |
|---|---|---|
| `_ensureTechModal()`, resource helpers, `_showTechCancelConfirm()`, `_showTechAccelModal()`, `_updateAccelPercentage()`, `_applyTechAcceleration()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L1844-L2121) | Модалки tech cancel/acceleration и общий modal-host для craft confirm/result |
| `_resetCraftSlots()`, `_resetReprogramState()`, `_getReprogramState()`, `_canAddFragment()`, `_previewAssembleResult()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2144-L2287) | Валидация craft/reprogram state и live-preview |
| `_getChipDisplayName()`, `_renderChipNameHtml()`, `_truncateCraftCardLabel()`, `_renderCraftSlotCard()`, `_renderCraftRemoveButton()`, `_renderCraftEnergyLines()`, `_collectAssembleCraftPayload()`, `_showCraftOutcomeModal()`, `_showCraftRiskConfirmModal()`, `_showDisassembleConfirmModal()`, `_executeReprogram()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2357-L2678) | Канонический display-name pipeline, assemble energy-lines, disassemble confirm modal и reprogram exchange |
| `_addItemToSlot()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2680-L2759) | Общее добавление item в craft slots; reprogram fragment selection routed отдельно от assemble/disassemble |
| `renderChipCraftPanel()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2761-L3133) | Split DOM для assemble-only panel и recycle panel: dust/disassemble/reprogram, empty overlays, dropdown-select и craft-style preview |
| `_attachCraftPanelEvents()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L3135-L3360) | Клики nested recycle-tabs, dust confirm/cancel, local drop-zone drag-drop, reprogram select |
| `_executeDust()`, `_executeCraftAction()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L3362-L3492) | Распыление и создание/разборка чипов; confirm-before-disassemble, confirm-before-risk и reprogram dispatch |

### Блок: init / drag-drop / persistence API
| Функция / блок | Строки | Назначение |
|---|---|---|
| `init()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L3966-L4358) | Главная инициализация overlay, hover-tooltips, slot-drag, chip merge drag |
| `getCells()`, `setCells()`, `show()` | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L3316-L3339) | Persisted hangar cells + safe-open overlay |
| Debug/public API export | [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L3341-L3441) | Экспорт в `Game.HangarChipsUI` |

## Hotspots
- [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L639-L699) — routing workshop/recycle tabs и derived UI-state `_workshopSubTab/_chipRecycleSubTab`.
- [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2296-L2432) — tech accel modal, dust planner, total-summary и apply flow.
- [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2227-L2878) — chip-name pipeline, craft cards, силовые линии assemble-stage и result/confirm modal helpers.
- [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L2880-L3194) — nested recycle-tab events, reagent footer, craft confirm/result flow и loss-policy.
- [src/ui/hangarChipsUI.js](../../src/ui/hangarChipsUI.js#L3966-L4358) — overlay-level drag-drop/tooltips.
- [style.css](../../style.css#L3749-L3756) — nested recycle subtabs.
- [style.css](../../style.css#L4302-L4379) — tech modal shell + craft confirm/result modal skin.
- [style.css](../../style.css#L4754-L4879) — assemble-stage, energy lines и ingredient/result spacing.
- [style.css](../../style.css#L5344-L5408) — pinned reagent footer и craft energy animations.

## Зависимости
- Использует: `Game.HangarChips`, `Game.Toast`, `Game.I18n`.
- Используется из: `src/ui/supercomputerMenu.js` через `showHangarMods()`.

## Известные ограничения / TODO
- Отдельного map для `assets/chips.json` пока нет; мод-описания читаются из runtime/tooltip-кода.
- Точный internal layout некоторых hover-tooltip веток не размечен отдельно; вход через `init()`.
