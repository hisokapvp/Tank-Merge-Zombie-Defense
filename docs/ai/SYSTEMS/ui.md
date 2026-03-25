# Система: UI

> Обновлено: 2026-03-25.

## Где править
- Разметка: `index.html`
- Логика UI: `src/ui/*`
- Runtime floor для шрифта/Canvas текста: `src/ui/fontFloor.js`
- UI склада коробок production line: `src/ui/productionLineUI.js`
- Tutorial runtime ordering / overlay: `docs/ai/SYSTEMS/tutorial-runtime.md`
- Talents v2 redraw/update orchestration: `src/ui/talentOverlayUi.js`
- Большие карты: `docs/ai/HANGAR_CHIPS_UI_MAP.md`, `docs/ai/SUPERCOMPUTER_MENU_MAP.md`, `docs/ai/STYLE_CSS_MAP.md`
- Big menu runtime: `src/ui/bigMenuRuntime.js`
- Инициализация: `src/core/bootstrap.js`
- Critical modal: `src/ui/criticalModal.js`
- Restart simulation flow: `game.js` (`restartSimulationPartial`) + `src/core/worldReset.js`
- Talents v2 UI (overlay + HUD активок): `game.js` (`ensureTalentUI`, `updateTalentUI`, `updateStageAbilitySlots`) + контракт в `docs/ui_talents_v2.md`.
	- Overlay Talents v2: одновременно рендерятся все 3 ветки (`offense/defense/economy`) в отдельных колонках.
	- Stage HUD active slots для v2 резолвят branch-иконку через [getTalentV2ActiveIconByBranch()](../../../game.js#L3759-L3772) → [getTalentV2ActiveIconUrlByBranch()](../../../game.js#L3800-L3802) и применяют её в [updateTalentAbilitySlotsV2()](../../../game.js#L8688-L8752); canonical source — `assets/ui/icons/talents/*`, а не legacy `assets/active_*.png`.
	- CSS-идентификаторы `#stageActive0/1/2` и классы `.talentAbilitySlot_attack/.talentAbilitySlot_defense/.talentAbilitySlot_economy` держат `activeOff/activeDef/activeEco` только как fallback background при отсутствии runtime `--talentAbilityIcon`: [style.css](../../../style.css#L2384-L2406).
	- Stage HUD active slots (v2) обязаны показывать: корректный hover-tooltip (имя/описание/заряды/перезарядка), бейдж зарядов в правом верхнем углу, секундный countdown перезарядки всегда при идущем recharge (даже если есть оставшиеся заряды), и секторную cooldown-заливку по часовой стрелке от центра (`rgba(20,20,20,0.62)` при `charges>0`, `rgba(255,255,255,0.58)` при `charges=0`).
	- Бейдж зарядов на stage active slots должен оставаться читаемым при стандартном масштабе HUD (увеличенный размер цифры/плашки).
	- Tooltip для talent nodes и stage active slots рендерится через unified DOM-tooltip (`#settingsTooltip` + `data-ui-tooltip`), не через нативный `title` браузера.
	- Stage active cooldown-sector стартует сверху (12 o'clock / north) и заполняется по часовой стрелке.
	- Бейдж зарядов на stage active slots не должен смещаться на hover: для слотов и бейджа в hover/pressed состоянии `transform:none`, позиция стабильно в правом верхнем углу.
	- Для каждой ветки есть локальная кнопка `Сбросить выбор` (сбрасывает только pending-выбор этой ветки).
	- В footer есть кнопка `Применить`, которая фиксирует pending-выбор и только после этого включает модификаторы талантов.
	- Кнопка `Сбросить улучшения` сбрасывает и pending, и уже применённые ранги, плюс очищает runtime-эффекты талантов (active/status/defense runtime).
	- Label footer-кнопки `Сбросить улучшения` больше не меняется на countdown-text: `buildTalentResetButtonModel()` всегда возвращает `talentResetAll`, cooldown уходит в tooltip/отдельную modal, а клик по active cooldown открывает `#talentResetCooldownModal`, не ломая layout action-row: [game.js](../../../game.js#L1112-L1121), [game.js](../../../game.js#L4629-L4689).
	- Геометрия дерева и SVG-связи берутся из `Game.TalentsV2.getTalentsByBranch(...).layout` (`row/slot/parents`) с fallback на legacy-layout (`3-3-3-3-2-2-1`).
	- Базовые SVG-связи дерева (`.talentEdge`) должны быть визуально заметны даже до первой покупки таланта и оставаться явно серыми в base-state: [style.css](../../../style.css#L2076-L2108).
	- Talent overlay visual contract: `talentTreeContainer` держит icon-shell через `--talent-node-icon-size: 40px`, уменьшенный вертикальный шаг рядов через `--talent-row-gap: clamp(14px, 2.8vh, 18px)`, а якорь линии считается от центра `.talentNodeIcon` к центру `.talentNodeIcon`; `buildEdgePath()` рисует прямой `M → L`, поэтому branch-edges остаются straight center-to-center без elbow/curve fallback: [style.css](../../../style.css#L2076-L2098), [style.css](../../../style.css#L2181-L2241), [src/ui/talentOverlayRenderer.js](../../../src/ui/talentOverlayRenderer.js#L19-L42).
	- Зелёный glow/pulse остаётся только на outgoing edges от прокачанных талантов; travelling dash/particle flow не возвращается, а `applyEdgeMotion()` теперь задаёт per-edge `--talent-edge-wobble-duration`, чтобы upgraded/ready-active связи wobble/shake заметнее базового ready-state и читались как более «заряженные» ветки: [src/ui/talentOverlayRenderer.js](../../../src/ui/talentOverlayRenderer.js#L45-L64), [style.css](../../../style.css#L2134-L2179).
	- Locked-node contract: renderer ставит `locked` только для узла без доступной покупки и без ранга, а CSS добавляет нейтральный overlay через `.talentNode.locked::before` вместо общего alpha-dim, чтобы иконка/ранг оставались читаемыми даже в locked-state: [src/ui/talentOverlayRenderer.js](../../../src/ui/talentOverlayRenderer.js#L239-L239), [style.css](../../../style.css#L2263-L2274).
	- Applied-state у talent node обязан явно подсвечивать и внешний node shell, и внутренний icon-shell одним и тем же зелёным `#4af626`; partial applied state не должен получать orange tint, а `maxed` добавляет отдельный orange overlay именно на icon-shell: [style.css](../../../style.css#L2275-L2307), [style.css](../../../style.css#L2325-L2350).
	- Unlock-gating рядов в V2: row1..row6 открываются только при spent `5/10/15/20/25/30` в текущей ветке + минимум `1` rank в таланте из предыдущего ряда (row0 доступен сразу).
	- V2 nodes не должны пересоздаваться каждый UI-tick: ререндер дерева допускается только при изменении signature (ranks/freePoints/canBuy/lang), иначе это провоцирует hover-SFX spam и потерю click-событий.
- Tutorial runtime вынесен в отдельную карту `docs/ai/SYSTEMS/tutorial-runtime.md`; canonical ordering rule остаётся прежним: pending step выбирается как first available incomplete tutorial step. Здесь держим только краткие UI-ссылки, а ordering/activation/completion/pause не дублируем как основной источник.
- `src/ui/talentOverlayUi.js` — canonical orchestration layer для Talents v2 redraw/update: модуль обновляет summary, ветки, SVG-связи и active slots, а `game.js` оставляет bootstrap/fallback glue.

## Интеграция
- Big menu функции (`setBigMenuOpen`, `openBigMenuLoadView`, `renderBigMenuTexts`, `startFromBigMenu`, `initBigMainMenu`) в `game.js` делегируются в `Game.BigMenuRuntime` через `ensureBigMenuRuntimeController()`.
- Для загрузки save через small/big menu действует единый контракт: `restoreFullState(payload)` должен завершаться post-restore синхронизацией (`postRestoreSync`) для runtime-систем (в т.ч. TalentsV2), чтобы ранги/очки и UI состояния были согласованы сразу после старта.
- Runtime crate-логика вынесена в `src/mechanics/crateRuntime.js`; в `game.js` crate entrypoints делегируются через `ensureCrateRuntimeController()`.
- Crate timer reset: `state.nextCrateAt` сбрасывается в `claimCrateReward()` (при claim), а не в `spawnCrate()` — это гарантирует, что таймер следующего ящика стартует только после фактического открытия: [game.js](../../../game.js#L10646-L10680), [src/mechanics/crateRuntime.js](../../../src/mechanics/crateRuntime.js#L28-L44), [src/mechanics/crateRuntime.js](../../../src/mechanics/crateRuntime.js#L94-L100).

## Runtime font floor
- `index.html` подключает [src/ui/fontFloor.js](../../../src/ui/fontFloor.js#L1-L133) как отдельный runtime-слой: [index.html](../../../index.html#L538).
- `Game.FontFloor` патчит и `CanvasRenderingContext2D.font`, и DOM через `MutationObserver`, поднимая всё ниже `12px` до `12px`: [src/ui/fontFloor.js](../../../src/ui/fontFloor.js#L22-L133).
- Исключения разрешены только для явных контролов из `SKIP_SELECTOR` (`.levelModal__close`, `.crateModal__close`, `.modalClose`, `.chipCraftSlotRemove`, `.lessonProgress__close`, `[data-font-floor-ignore="true"]`): [src/ui/fontFloor.js](../../../src/ui/fontFloor.js#L5-L11), [src/ui/fontFloor.js](../../../src/ui/fontFloor.js#L47-L48).

## Close controls / X-pattern
- Обычные close-кнопки `.crateModal__close`, `.levelModal__close`, `.modalClose`, `.lessonProgress__close` используют единый 44×44 close-skin с одним glyph-элементом `✕`; `scModal__close`, `#talentOverlay .modalClose` и `.modalClose.scModal__close` — ту же геометрию в green SC-варианте: [style.css](../../../style.css#L1042-L1095), [style.css](../../../style.css#L1340-L1435), [style.css](../../../style.css#L1869-L1965), [style.css](../../../style.css#L3129-L3210) _(строки приблизительные, проверить после 2026-03-10)_ .
- Второй pseudo-element у close-кнопок отключён (`::after { content:none; }`), hover/active возвращают только лёгкое движение кнопки/glyph без изменения hit-area 44×44: [style.css](../../../style.css#L3183-L3255) _(строки приблизительные, проверить после 2026-03-10)_ .
- Level up, achievements list и achievement popup теперь явно используют `scModal__close`, то есть тот же SC-skin, что и supercomputer modal: [index.html](../../../index.html#L163-L166), [index.html](../../../index.html#L195-L206).
- `fontFloor` обязан пропускать все эти close-селекторы и `chipCraftSlotRemove`, иначе ломаются крестик, hit-area и визуальная унификация модалок/lesson popup/craft preview: [src/ui/fontFloor.js](../../../src/ui/fontFloor.js#L5-L11), [style.css](../../../style.css#L4698-L4751).

## Reset talents modal
- Fallback shell `#resetTalentsModal` в [index.html](../../../index.html#L393-L400) обязан совпадать с runtime-контрактом платного сброса талантов: заголовок говорит про списание `500$`, close использует green `scModal__close`, а symmetric horizontal padding приходит из общего `.levelModal__contentWrap` contract, чтобы confirm-shell не выглядел перекошенным после инжекта action-row: [style.css](../../../style.css#L2377-L2421).
- Каноническая логика живёт в [src/ui/modals.js](../../../src/ui/modals.js#L20-L129): `ensureResetTalentsModalControls()` реиспользует существующий confirm-button из HTML, переносит его в `menuInlineActions`, а при отсутствии инжектит secondary cancel-кнопку `resetTalentsModalCancel` с copy `Нет`; `openResetTalentsModal()` затем переопределяет текст/label через i18n и даёт фокус confirm/cancel-контролу.
- Cooldown UX вынесен в отдельную modal `#talentResetCooldownModal`: footer-кнопка в дереве остаётся `Сбросить улучшения`, `requestResetAllTalents()` открывает отдельный timer-dialog при `cooldownActive`, `refreshTalentResetCooldownModalState()` обновляет copy каждые `250ms`, а modal держит `Закрыть` + ad-style refresh-stub CTA с отдельным icon-shell и tooltip-заглушкой до подключения рекламы: [game.js](../../../game.js#L4629-L4708), [index.html](../../../index.html#L403-L416), [src/ui/modals.js](../../../src/ui/modals.js#L96-L131), [style.css](../../../style.css#L2392-L2469).

## Underground hangar canvas button
- FSM состояния: `idle → hover_start → hover_idle → hover_end → idle`; `click` и `close` — one-shot с возвратом в `idle`: [src/mechanics/undergroundHangar.js](../../../src/mechanics/undergroundHangar.js#L13-L17).
- `_isClosing` guard: при dismiss модалки `handleModalClose()` ставит `_isClosing=true` и запускает `close` анимацию; `handlePointerLeave()` не переключает на `hover_end` пока `_isClosing` активен: [src/mechanics/undergroundHangar.js](../../../src/mechanics/undergroundHangar.js#L260-L277).
- `draw()` применяет rounded rect clip (`arcTo`) перед `drawImage`, чтобы углы sprite не выступали за ячейку; после sprite рисуется black 2px `#000` border по тому же rounded rect (отдельный `ctx.save/restore`); badge рисуется после border, вне clip: [src/mechanics/undergroundHangar.js](../../../src/mechanics/undergroundHangar.js#L149-L190).

## Escape / menu priority
- Глобальный Escape-routing живёт в `game.js`: `hasHigherPriorityEscapeLock()` резервирует приоритет за `supercomputer / achievements / productionStorage / undergroundHangar / critical / bigMenu`, поэтому Escape не должен открывать или закрывать small menu поверх этих overlay. Отдельный fast-path сначала закрывает underground hangar, затем small menu закрывается только если нет более высокого lock, а из чистого gameplay Escape открывает small menu: [game.js](../../../game.js#L7994-L8001), [game.js](../../../game.js#L10307-L10327).

## Production line storage modal
- Разметка `#productionLineStorageModal` использует header `plStorage__header`: title остаётся центрированным, но help и close теперь собраны в правый wrapper `.plStorage__headerActions`; help-button `#plStorageHelp` сидит рядом с `#plStorageClose`, а заголовок получает увеличенный `padding-top`, чтобы визуально не съезжать под action-row. Не возвращать старую схему с отдельной left-help кнопкой: [index.html](../../../index.html#L227-L232), [style.css](../../../style.css#L7069-L7114).
- Help-shell склада переиспользует общий SC-family modal: `Game.ProductionLineUI._openHelpModal()` зовёт `Game.SupercomputerMenu.showSharedHelpModal(...)` с intro + accordion секциями `Коробка Ур. 1..4`, а раскрытие/сворачивание управляется централизованно через `toggleSharedHelpSection()`. Не дублировать отдельный storage-only help DOM: [src/ui/productionLineUI.js](../../../src/ui/productionLineUI.js#L90-L116), [src/ui/supercomputerMenu.js](../../../src/ui/supercomputerMenu.js#L52-L60), [src/ui/supercomputerMenu.js](../../../src/ui/supercomputerMenu.js#L150-L185).
- Заголовок и help-copy склада считаются частью runtime-контракта: `plStorageTitle`, `plStorageHelpButton`, `plStorageHelpIntro`, `plStorageHelpLevel{1..4}{Title,Items}` должны обновляться синхронно в `ru/en/fallback`, потому что `init()` и `setTranslator()` переустанавливают `aria-label`/`data-ui-tooltip` ещё до асинхронной загрузки JSON: [src/ui/productionLineUI.js](../../../src/ui/productionLineUI.js#L19-L40), [src/ui/productionLineUI.js](../../../src/ui/productionLineUI.js#L94-L100), [src/ui/productionLineUI.js](../../../src/ui/productionLineUI.js#L348-L352), [src/i18n/ru.json](../../../src/i18n/ru.json#L524-L534), [src/i18n/en.json](../../../src/i18n/en.json#L524-L534), [src/i18n/fallbackStrings.js](../../../src/i18n/fallbackStrings.js#L354-L364), [src/i18n/fallbackStrings.js](../../../src/i18n/fallbackStrings.js#L753-L763).
- `Game.ProductionLineUI.open()` / `.close()` переключают `body.pl-storage-open`; этот class участвует в общем CRT/grain overlay `body::before`, поэтому склад визуально остаётся в одной семье с SC-модалками: [src/ui/productionLineUI.js](../../../src/ui/productionLineUI.js#L44-L61), [style.css](../../../style.css#L40-L68).
- `Game.ProductionLineUI.open()` / `.close()` обязаны также прокидывать `onPauseLockChange(true/false)` в общий `PauseManager` через `game.js -> setMenuPauseSource('productionStorage', ...)`, чтобы склад паузил симуляцию тем же контрактом, что и supercomputer modal.
- Второй шаг tutorial для склада должен таргетить первый фактически заполненный слот через runtime-резолвер в `src/ui/tutorialRuntime.js`, а не через жёсткую привязку к визуальному индексу.
- Сетка ячеек склада центрируется внутри панели (`width:min(100%, 420px)`, `justify-items:center`), чтобы справа не оставалось «пустого хвоста» относительно help/title/close header: [style.css](../../../style.css#L6993-L7000).
- Storage drag использует тот же порог `6px`, что и основной gameplay drag: после threshold UI клонирует исходную filled-cell в body-level `.plStorage__dragPreview`, оставляет source slot в состоянии `--dragging`, а merge target подсвечивает отдельным glow. Preview обязан быть `pointer-events:none`, без inherited `uiButtonBehavior` pressed/hover классов и без placeholder-state: [src/ui/productionLineUI.js](../../../src/ui/productionLineUI.js#L150-L176), [src/ui/productionLineUI.js](../../../src/ui/productionLineUI.js#L208-L257), [style.css](../../../style.css#L7001-L7090).
- Empty storage cells больше не рендерят placeholder glyph/text внутри grid: они остаются disabled blank-shell (`textContent = ''`), а filled-cells показывают bottom-centered plain-text `plStorage__levelBadge` без pill/background chrome: [src/ui/productionLineUI.js](../../../src/ui/productionLineUI.js#L265-L300), [style.css](../../../style.css#L7030-L7075).
- Confirm dialog `#plConfirmOverlay` использует `#plConfirmYes` с `talentResetCooldownAdBtn` shell: nested `<span class="talentResetCooldownAdBtn__label" data-i18n="plConfirmYes_label">` держит локализованный текст («Открыть» / «Open»), ad-icon span `talentResetCooldownAdBtn__icon`; `_showConfirm()` целится в nested label, а не в `textContent` кнопки: [index.html](../../../index.html#L250-L253), [src/ui/productionLineUI.js](../../../src/ui/productionLineUI.js#L307-L320), [src/i18n/ru.json](../../../src/i18n/ru.json#L647), [src/i18n/en.json](../../../src/i18n/en.json), [src/i18n/fallbackStrings.js](../../../src/i18n/fallbackStrings.js).
- Не возвращать storage modal к plain `levelModal__close`: `scModal__close` — это тот же 44×44 close-pattern с крупным крестом, только в green SC-skin; hover/active/focus у него должны совпадать с supercomputer/talent tree close controls: [style.css](../../../style.css#L1340-L1426), [style.css](../../../style.css#L1863-L1957).

## Cache-bust contract
- После merged achievements/crate-aid update `index.html` держит новую query-группу `?v=20260323-branch3-achievements-crate-aid`: её одновременно используют `style.css`, `src/ui/adService.js`, `src/i18n/fallbackStrings.js` и `src/ui/modals.js`. Параллельно `src/ui/talentOverlayRenderer.js` остаётся на `?v=20260322-branch1-talents-storage-v2`, а `src/ui/supercomputerMenu.js` и `src/ui/productionLineUI.js` — на `?v=20260322-ui-postmerge`; если менять DOM/CSS/i18n/ad-gate shell для crate/achievement flow, bump-ать нужно именно branch3-группу, не задевая старые post-merge tokens: [index.html](../../../index.html#L10-L10), [index.html](../../../index.html#L593-L626).
- `src/mechanics/achievementRewards.js` не подключается напрямую из `index.html`: `game.js` lazy-load'ит его через `ACHIEVEMENT_REWARDS_SCRIPT_SRC`, поэтому wiring этой награды живёт в runtime-loader, а не в index-level cache-bust группе: [game.js](../../../game.js#L462-L462), [game.js](../../../game.js#L9271-L9299).

## Military aid / crate modal
- Fallback DOM `#crateModal` теперь оформлен как модалка `Военная помощь`: shell переиспользует `levelModal`-семейство, title живёт в `#crateTitle`, текст — в `#crateText`, а action-row держит dismiss + claim CTA `#crateGet`. Это canonical HTML shell для crate reward flow: [index.html](../../../index.html#L179-L191).
- `openCrateModal()` / `closeCrateModal()` в `game.js` делегируют в `Game.UIModals.openCrateModal()` / `.closeCrateModal()`; модальный контроллер синхронизирует copy, `aria-label`, `body.crate-open` и icon render, но не выдаёт награду сам по себе: [game.js](../../../game.js#L10108-L10140), [src/ui/modals.js](../../../src/ui/modals.js#L155-L195).
- Rewarded-ad gate живёт в `src/ui/adService.js`: capture-listener на `#crateGet` блокирует исходный click, вызывает `requestRewardedAd()`, а при `success === true` разрешает ровно один программный повторный click. Только этот повторный click доходит до `claimCrateReward()` в `game.js`, который после `1200ms` переносит награду в слот и закрывает модалку: [src/ui/adService.js](../../../src/ui/adService.js#L8-L70), [game.js](../../../game.js#L10168-L10197).

## Underground hangar modal
- Modal contract lives in [src/ui/undergroundHangarUI.js](../../../src/ui/undergroundHangarUI.js), runtime state shaping in [src/mechanics/undergroundHangar.js](../../../src/mechanics/undergroundHangar.js), move/buy wiring in [game.js](../../../game.js), and layout/states in [style.css](../../../style.css).
- Подземный ангар рендерит спрайты и для танков, и для дронов: underground storage cells теперь поддерживают mixed state (`tank` или `drone`), а UI рисует tank/drone canvas в зависимости от фактической сущности в ячейке.
- Дроновые слоты в модалке всегда видимы, даже если пусты; canonical раскладка повторяет игровое поле: `3` сверху, `3` слева, `3` справа. UI должен читать дронов по `slotIndex`, а не по позиции в массиве `_stateRef.drones`.
- Перенос поддерживается двусторонне: танки можно двигать между `main` и `underground`, дроны — между `drone` slots и `underground`; пустая underground-ячейка считается свободной только если в ней нет ни `tank`, ни `drone`.
- Merge-логика в UI теперь допускает пары `drone ↔ underground` и `underground ↔ underground`, если в underground cell лежит именно дрон; см. [canMergeSelection()](../../../src/ui/undergroundHangarUI.js#L77-L86), [renderUndergroundCell()](../../../src/ui/undergroundHangarUI.js#L129-L148), [renderDroneCell()](../../../src/ui/undergroundHangarUI.js#L153-L170) и runtime-dispatch в [onMerge](../../../game.js#L12817-L12844).
- Auto-merge в модалке подземного ангара использует отдельный runtime путь: [getUndergroundHangarAutoMergeButtonModel()](../../../game.js#L3950-L3970) и [runUndergroundHangarAutoMergeClick()](../../../game.js#L3981-L3995) собирают все доступные пары танков одновременно из `state.cells` и `state.undergroundHangar.cells`, не трогают дронов и держат `cooldownMs = 0`, то есть underground-кнопка не ждёт общий `isAutoMergeBusy/cooldown` и объединяет всё за один клик.
- `transferAll` больше не живёт в правой колонке: CTA рендерится отдельной центрированной lane между верхним и подземным блоками, остаётся icon-only `44×44`, использует green up-arrow и сохраняет `aria-label` / `title` / `data-ui-tooltip` с copy `ughTransferToUpper`; runtime по-прежнему вызывает `onTransferAllToUpperHangar`, а disabled-state остаётся допустимым, если сверху нет свободного места: [src/ui/undergroundHangarUI.js](../../../src/ui/undergroundHangarUI.js#L450-L487), [style.css](../../../style.css#L4321-L4406).
- Underground auto-merge больше не делает безусловный merge-all для achievement-tier `merge2/mergeX`: кнопка и runtime сначала режут пары через `collectUndergroundHangarAutoMergePairs(maxPairs)`, поэтому `merge2` объединяет ровно `2` танка, `mergeX` — максимум `10` танков (`5` пар), а label `autoMergeDynamicShort` отражает именно текущий capped объём.
- Disabled auto-merge в underground modal обязан оставаться видимым как inactive CTA и показывать одинаковый hover/click feedback `ughAutoMergeUnavailableDetailed = Нет доступных танков для объединения, либо они ещё не создались.` через `data-ui-tooltip` и `data-ugh-disabled-message`; этот текст не дублируется inline в DOM вне i18n.
- Правая колонка действий в модалке центрируется по вертикали; canonical bulk-buy и auto-merge кнопки показываются только через runtime-модели unlock/visibility из [game.js](../../../game.js), а не через локальные ad-hoc флаги UI. Для bulk-buy label canonical source — [getUndergroundHangarBulkBuyButtonModel()](../../../game.js#L1079-L1097), который берёт `plan.label/plan.totalCost` из [getBulkBuyPlanByMode()](../../../game.js#L3338-L3387), поэтому в underground modal и supercomputer HUD текст всегда inflation-aware: `Создать X танков - Y$`.
- Sidebar underground hangar больше не рендерит dismantle-action: в правой колонке остаются buy / bulk-buy / auto-merge, а help-кнопка `?` инжектится через [ensureHelpButton()](../../../src/ui/undergroundHangarUI.js#L51-L75) и открывает общий SC-style help dialog через [Game.SupercomputerMenu.showSharedHelpModal()](../../../src/ui/supercomputerMenu.js#L44-L68) с ключами `ughHelpButton` / `ughHelpText`.
- User-visible copy underground hangar синхронизирована с runtime-моделями: single-buy использует `ughBuyTank = Создать танк {level} уровня - {cost}$` в [src/ui/undergroundHangarUI.js](../../../src/ui/undergroundHangarUI.js#L489-L498), bulk-buy показывает уже готовый `bulkModel.label` с общей стоимостью пачки, а dynamic auto-merge copy переиспользует `autoMergeDynamicShort = Объединить {count} танков` и тем самым совпадает с supercomputer terminal.
- Underground modal deliberately bypasses main-screen printing flow: public callbacks [game.js](../../../game.js#L12838-L12843) вызывают `tryBuyTank({ instant:true })` / `tryBuyBulk({ instant:true })`, а [performTankPurchaseOnce()](../../../game.js#L3389-L3448) в instant-режиме создаёт танк без `SupercomputerBuildTankFx.start()` и без stamp-анимации; этот fast path действует только для modal callbacks и не меняет обычную покупку на главном экране.
- Visual shell модалки: заголовок центрируется через `.ughPanel > .levelModal__title`, текстовый лейбл `Дроны` скрыт, секция нижнего блока переименована в `Подземный ангар`, пустые маркеры `.ughCell__emptyMark/.ughDroneCell__emptyMark` отключены, индексы слотов в tank/drone cells не рендерятся вовсе ([renderTankCell()](../../../src/ui/undergroundHangarUI.js#L165-L179), [renderUndergroundCell()](../../../src/ui/undergroundHangarUI.js#L182-L201), [renderDroneCell()](../../../src/ui/undergroundHangarUI.js#L204-L218)), а `Ур.X` остаётся plain text у нижнего края ячейки без подложки; см. [style.css](../../../style.css#L4079-L4183).
- Canvas-кнопка подземного ангара на поле теперь может показывать badge количества техники: [drawBoard()](../../../game.js#L11254-L11271) передаёт в [Game.UndergroundHangar.draw()](../../../src/mechanics/undergroundHangar.js#L132-L168) число танков только из `state.undergroundHangar.cells`, а badge скрыт при `0`.

## Мастерская (Workshop) — под-вкладки в модификациях ангара
- Расположение: `#modsHangarOverlay` → три основные вкладки: «Улучшение ячеек» (`hangarTabCells`), «Мастерская» (`hangarTabWorkshop`), «Открытие технологий» (`hangarTabTechUnlock`).
- Под-вкладки Мастерской: «Улучшение чипов» (`workshopTabChipUpgrade`, панель `workshopPanelChipUpgrade`), «Создание чипов» (`workshopTabChipCraft`, панель `workshopPanelChipCraft`) и «Переработка чипов» (`workshopTabChipRecycle`, панель `workshopPanelChipRecycle`): [index.html](../../../index.html#L286-L301).
- Переключение основных вкладок: `Game.HangarChipsUI.switchHangarTab(tabId)` — DOM-переключение active/hidden, aria-selected. Принимает `'cells'`, `'workshop'`, `'techUnlock'`. При возврате в workshop ререндерит именно активную под-вкладку по `_workshopSubTab`, а не всегда `chipUpgrade`: [src/ui/hangarChipsUI.js](../../../src/ui/hangarChipsUI.js#L604-L636).
- Переключение под-вкладок: `Game.HangarChipsUI.switchWorkshopSubTab(tabId)` — canonical routing для `chipUpgrade/chipCraft/chipRecycle`; он синхронизирует `hidden`, `tabindex`, `aria-selected`, active-class и при входе в recycle делегирует в `switchChipRecycleSubTab()`: [src/ui/hangarChipsUI.js](../../../src/ui/hangarChipsUI.js#L639-L699).
- «Улучшение чипов»: сетка `#chipUpgradeGrid` с карточками чипов из инвентаря `playerChips`. Каждая карточка показывает SVG-иконку, имя, уровень («Ур. N»), счётчик копий. Кнопка «Объединить» удалена — merge выполняется исключительно через drag-and-drop. Высота `.chipUpgradeCard` задаётся через `calc(var(--chipLabelCardHeight, 130px) + 40px)`, а `.chipUpgradeCard__name` max-height `60px` вмещает до 3 строк названия модификатора: [style.css](../../../style.css#L5160-L5205).
- Drag-and-drop merge: пользователь зажимает карточку чипа (pointerdown) и перетаскивает на другую карточку того же `chipId` и `level`. При наведении на валидную цель карточка подсвечивается (`chipUpgradeCard--dropTarget`). При отпускании выполняется `mergeChips(chipId, level)`. Drag доступен только при `count >= 2`. Паттерн pointer events аналогичен merge танков.
- Логика merge: `mergeChips(chipId, level)` — забирает 2 копии, создаёт 1 копию `level+1`. Бонус: `level * 10`% к урону.
- Бонус урона интегрирован в `fireTankProjectile` через `getChipLevelDmgMul(cellIndex)`.

### Создание чипов (Chip Craft) — вкладка Мастерской
- Панель `workshopPanelChipCraft`, рендер: [src/ui/hangarChipsUI.js](../../../src/ui/hangarChipsUI.js#L2410-L2677), стили: [style.css](../../../style.css#L4471-L5076).
- **Лейаут панели**: `chipCraftLayout` делится на `chipCraftLeftCol` (инвентарь + `chipCraftBottomBar`) и `chipCraftPreview` (drop-zone + action button). Для top-level вкладки `Создание чипов` panel теперь assemble-only: mode-row убран из UX, а `switchWorkshopSubTab('chipCraft')` принудительно ставит `_craftMode = 'assemble'`, `_dustMode = false` и при переходе из disassemble сбрасывает слоты: [src/ui/hangarChipsUI.js](../../../src/ui/hangarChipsUI.js#L661-L695), [src/ui/hangarChipsUI.js](../../../src/ui/hangarChipsUI.js#L2418-L2441).
- **Инвентарь вкладки**: в `Создании чипов` показываются только фрагменты; большие чипы больше не смешиваются с assemble-flow: [src/ui/hangarChipsUI.js](../../../src/ui/hangarChipsUI.js#L2449-L2503).
- **Drag-drop из инвентаря**: pointer-based drag-drop сохранён, но для assemble-panel канонический expected-mode всегда `assemble`; `_addItemToSlot()` остаётся общей точкой наполнения слотов, а `_detectCraftMode()` проверяет валидность action-кнопки: [src/ui/hangarChipsUI.js](../../../src/ui/hangarChipsUI.js#L2276-L2348), [src/ui/hangarChipsUI.js](../../../src/ui/hangarChipsUI.js#L2597-L2668).
- **Карточный паттерн craft-слотов**: занятые assemble/disassemble-слоты и preview результата рендерятся через общий helper [_renderCraftSlotCard()](../../../src/ui/hangarChipsUI.js#L2249-L2264). Это квадратные inventory-style карточки: крупная иконка сверху, footer-title снизу, чипы получают badge уровня, фрагменты — dashed-вариант карточки. Remove-контрол [chipCraftSlotRemove](../../../style.css#L4599-L4652) сделан в игровом wasteland-стиле, рендерится sibling'ом карточки и не должен клиппиться: во вкладке `Разобрать` он обязан сидеть в том же углу, что и эталонный close-контрол preview `Создать чип`: [src/ui/hangarChipsUI.js](../../../src/ui/hangarChipsUI.js#L2249-L2274), [src/ui/hangarChipsUI.js](../../../src/ui/hangarChipsUI.js#L2532-L2544), [style.css](../../../style.css#L4480-L4652).
- **Полные названия без mid-word wrap**: `_renderChipNameHtml()` — единый helper для workshop grid, tech accel modal, craft inventory и result cards; безопасный перенос разрешён только по ` + `, а размер карточек фиксируется общими CSS vars `--chipLabelCardWidth/Height`. `_truncateCraftCardLabel()` остаётся только compact-helper'ом для тесных assemble ingredient cards: [src/ui/hangarChipsUI.js](../../../src/ui/hangarChipsUI.js#L1864-L1939), [src/ui/hangarChipsUI.js](../../../src/ui/hangarChipsUI.js#L2209-L2264), [src/ui/hangarChipsUI.js](../../../src/ui/hangarChipsUI.js#L2350-L2598), [style.css](../../../style.css#L4104-L4327), [style.css](../../../style.css#L4410-L4568), [style.css](../../../style.css#L4904-L4915).
- **Создать чип (assemble)**: игрок кладёт 3 фрагмента в фиксированные слоты → получает целый чип.
	- **Валидация фрагментов**: `_canAddFragment(fragId)` запрещает тройки одинаковых фрагментов и больше одного спецмода (id ≥ 10): [src/ui/hangarChipsUI.js](../../../src/ui/hangarChipsUI.js#L2077-L2101). Фрагменты в инвентаре подсвечиваются зелёным (`.chipCraftInvItem--canAdd`) если можно добавить, красным (`.chipCraftInvItem--cantAdd`) если нельзя: [style.css](../../../style.css#L4856-L4860).
	- **Превью результата**: `_previewAssembleResult()` и `renderChipCraftPanel()` теперь рендерят `chipCraftAssemblyStage`: 3 ingredient-слота слева, отдельную колонку `chipCraftEnergyRail` посередине и result-card справа. Зелёная стрелка больше не используется: [src/ui/hangarChipsUI.js](../../../src/ui/hangarChipsUI.js#L2363-L2376), [src/ui/hangarChipsUI.js](../../../src/ui/hangarChipsUI.js#L2780-L2850), [style.css](../../../style.css#L4814-L4879).
	- **Силовые линии**: `_renderCraftEnergyLines()` всегда рисует 3 линии к result-card; пустые линии статичны, заполненные получают `chipCraftEnergyLine--filled` и CSS-анимации `chipCraftEnergyShake/chipCraftEnergyFlow/chipCraftEnergyPulse`: [src/ui/hangarChipsUI.js](../../../src/ui/hangarChipsUI.js#L2363-L2376), [style.css](../../../style.css#L4840-L4879), [style.css](../../../style.css#L5409-L5421).
	- **Future chip frame**: «будущий» чип получает отдельную зелёную dashed-рамку контейнера `.chipCraftResultChip--future`; placeholder остаётся отдельным muted-состоянием `.chipCraftSlot--resultSlot`: [src/ui/hangarChipsUI.js](../../../src/ui/hangarChipsUI.js#L2532-L2544), [style.css](../../../style.css#L4887-L4904).
	- **Reagent footer**: строка `chipCraftReagentRow` закреплена у нижней кромки assemble drop-zone через `margin-top:auto`, поэтому блок `Кремниевая пыль` больше не плавает по высоте и держит постоянный отступ от нижнего края: [src/ui/hangarChipsUI.js](../../../src/ui/hangarChipsUI.js#L2382-L2397), [src/ui/hangarChipsUI.js](../../../src/ui/hangarChipsUI.js#L2848-L2850), [style.css](../../../style.css#L5344-L5408).
	- **Подтверждение риска и modal result**: `_showCraftRiskConfirmModal()` открывается перед assemble-roll если шанс `< 100%`; `_showCraftOutcomeModal()` показывается всегда после roll и использует тот же `techModal__dialog` shell + `modalClose scModal__close`: [src/ui/hangarChipsUI.js](../../../src/ui/hangarChipsUI.js#L2484-L2528), [src/ui/hangarChipsUI.js](../../../src/ui/hangarChipsUI.js#L3144-L3194), [style.css](../../../style.css#L4302-L4379).
	- **Потери при провале**: `_executeCraftAction(skipRiskConfirm)` больше не сжигает все 3 фрагмента. На fail удаляется только один случайный выбранный фрагмент; reagent dust сжигается только если был добавлен. Success по-прежнему удаляет все 3 фрагмента и создаёт chip L1: [src/ui/hangarChipsUI.js](../../../src/ui/hangarChipsUI.js#L3102-L3194).
- **Фрагменты SVG**: иконки фрагментов в инвентаре рендерятся с размером `22px` (через `_fragmentSvgUp`).
- **Кремниевая пыль** (`_siliconDust`): ресурс, отображаемый в `chipCraftBottomBar` (**только когда `isDustView === true`** — в assemble/disassemble видах весь `chipCraftBottomBar` отсутствует), в строке реагента `chipCraftReagentRow` и в модалке ускорения технологий. В accel modal пыль выбирается через `+/-` stepper, нижняя строка показывает `доступно / выбрано`, summary live-обновляет `{pct}/{total}/{left}`, а `_applyTechAcceleration()` сжигает тот же `_techAccelDustSelected`, который виден пользователю: [src/ui/hangarChipsUI.js](../../../src/ui/hangarChipsUI.js#L1753-L1770), [src/ui/hangarChipsUI.js](../../../src/ui/hangarChipsUI.js#L1824-L2050), [style.css](../../../style.css#L4206-L4422), [style.css](../../../style.css#L4962-L4969).

### Переработка чипов (Chip Recycling) — отдельная под-вкладка Мастерской
- Панель `workshopPanelChipRecycle` рендерит тот же `renderChipCraftPanel()`, но в режиме recycle-panel. Внутри неё теперь три nested sub-tabs: `chipRecycleTabDust` / `chipRecycleTabDisassemble` / `chipRecycleTabReprogram`; canonical state хранится в `_chipRecycleSubTab`: [src/ui/hangarChipsUI.js](../../../src/ui/hangarChipsUI.js#L693-L716), [src/ui/hangarChipsUI.js](../../../src/ui/hangarChipsUI.js#L2797-L2800), [src/ui/hangarChipsUI.js](../../../src/ui/hangarChipsUI.js#L3151-L3165).
- **Распылить (Pulverize / Dust view)**: recycle-tab `dust` делает layout одноколоночным (`chipCraftLayout--singleCol`), скрывает preview/right-column и показывает инвентарь одновременно для больших чипов и фрагментов. Нижняя панель содержит только `Подтвердить`, `Отменить` и live-summary по пыли: [src/ui/hangarChipsUI.js](../../../src/ui/hangarChipsUI.js#L2418-L2529), [style.css](../../../style.css#L3749-L3756), [style.css](../../../style.css#L4471-L4474), [style.css](../../../style.css#L4683-L4712).
	- Большой чип = 10 ед. кремниевой пыли (`DUST_PER_CHIP`), фрагмент = 3 ед. (`DUST_PER_FRAGMENT`).
	- В `dust`-виде фрагменты рендерятся по одной единице, а не агрегированным стеком, чтобы игрок мог распылить ровно один фрагмент; в остальных вкладках инвентарь фрагментов остаётся сгруппированным: [src/ui/hangarChipsUI.js](../../../src/ui/hangarChipsUI.js#L2449-L2508) _(строки приблизительные, проверить после 2026-03-10)_ .
	- Клик по любой области карточки в dust view переключает чекбокс выбора; двойной toggle от клика по самому checkbox блокируется через `closest('.chipCraftDustCheck')`: [src/ui/hangarChipsUI.js](../../../src/ui/hangarChipsUI.js#L2140-L2163), [src/ui/hangarChipsUI.js](../../../src/ui/hangarChipsUI.js#L2718-L2789).
	- `Отменить` внутри dust view очищает только `_dustSelected` и оставляет пользователя в той же recycle-подвкладке, но уход из `dust/disassemble/assemble` или закрытие окна ангара обязаны вызывать общий `resetTransientUiState()` для сброса `_dustSelected`, `_craftSlots` и reagent dust: [src/ui/hangarChipsUI.js](../../../src/ui/hangarChipsUI.js#L604-L697), [src/ui/hangarChipsUI.js](../../../src/ui/hangarChipsUI.js#L2170-L2174), [src/ui/supercomputerMenu.js](../../../src/ui/supercomputerMenu.js#L1392-L1411) _(строки приблизительные, проверить после 2026-03-10)_ .
- **Разобрать (Disassemble view)**: recycle-tab `disassemble` показывает только целые чипы, сохраняет preview/action-column и использует динамический массив `_craftSlots` для массовой разборки; drop по preview-zone добавляет чип в первую свободную позицию слева направо, а `Разобрать` сначала открывает confirm modal в том же `techModal__dialog` shell, что и assemble-risk confirm: [src/ui/hangarChipsUI.js](../../../src/ui/hangarChipsUI.js#L2638-L2655), [src/ui/hangarChipsUI.js](../../../src/ui/hangarChipsUI.js#L2920-L2962), [src/ui/hangarChipsUI.js](../../../src/ui/hangarChipsUI.js#L3414-L3455).
	- Пустое состояние `Разобрать` теперь использует тот же серый overlay-паттерн, что и assemble-panel: поверх drop-zone показывается centred `chipCraftPlaceholderSvg` + текст `Перетащите сюда чип`, overlay исчезает сразу после добавления первого чипа и возвращается при очистке всех слотов: [src/ui/hangarChipsUI.js](../../../src/ui/hangarChipsUI.js#L2950-L2962), [style.css](../../../style.css#L4810-L4847).
- **Перепрограммировать (Reprogram view)**: recycle-tab `reprogram` показывает только фрагменты, держит отдельный transient-state выбора (`_reprogramSourceFragmentId`, `_reprogramTargetFragmentId`) и рендерит craft-style preview: исходный фрагмент слева, dropdown `chipCraftReprogramSelect` по центру, будущий фрагмент справа. В dropdown попадают только свойства, доступные по текущему прогрессу unlock-цепочек (берётся highest unlocked mod в каждой ветке `TECH_TREE`); выполнение стоит ровно `2` ед. кремниевой пыли и обменивает один фрагмент на другой: [src/ui/hangarChipsUI.js](../../../src/ui/hangarChipsUI.js#L2180-L2236), [src/ui/hangarChipsUI.js](../../../src/ui/hangarChipsUI.js#L2657-L2678), [src/ui/hangarChipsUI.js](../../../src/ui/hangarChipsUI.js#L3039-L3098), [style.css](../../../style.css#L4868-L4926).
- Nested-style recycle tabs используют отдельный CSS-layer `.workshopSubTabs--nested` / `.workshopSubTab--nested`; править их рядом с базовыми workshop subtabs, а не через ad-hoc inline styles: [style.css](../../../style.css#L3749-L3756).

### Открытие технологий — процесс изучения
- Все кнопки «Скормить x» удалены. Вместо них — кнопка «Начать процесс изучения» с таймером.
- Длительность изучения: 2 часа (7200 сек) для открытых технологий, 5 часов (18000 сек) для технологий под замком. Константы: `TECH_STUDY_DURATION_OPEN`, `TECH_STUDY_DURATION_LOCKED`.
- Одновременно можно изучать только одну технологию; при попытке начать вторую — auto-отказ.
- Состояние изучения: `_techStudying = { techId, remaining, total, timer }`, хранится в `HangarChipsUI`.
- Таймер: `setInterval(1000)` декрементирует `remaining`; при `remaining <= 0` технология разблокируется, таймер останавливается.
- Кнопка «Отменить»: показывает модальное окно подтверждения (`_showTechCancelConfirm`). При подтверждении прогресс изучения теряется полностью.
- Кнопка «Ускорить процесс открытия»: показывает модальное окно (`_showTechAccelModal`) с единым grid для кремниевой пыли, больших чипов и фрагментов. Ставки считаются через `_getTechAccelRates(modId)`: для 2ч технологий `dust/chip/fragment = 2/20/6`, для 5ч — `1/10/1`; общий hard cap задаётся `TECH_ACCEL_MAX_PCT = 96`, а элементы, не влезающие в остаток, получают `techAccelChip--disabled` + badge `Лимит`. Grid ресурсов теперь оборачивается в `techAccelGridWrap` (rounded border + scrollbar skin), а summary строка живёт под dust-row, а не над списком ресурсов. Пыль выбирается отдельным `+/-` stepper, нижняя строка всегда показывает `доступно / выбрано`, а `apply` использует тот же selection-state без отдельного скрытого пересчёта: [src/ui/hangarChipsUI.js](../../../src/ui/hangarChipsUI.js#L12-L14), [src/ui/hangarChipsUI.js](../../../src/ui/hangarChipsUI.js#L1074-L1084), [src/ui/hangarChipsUI.js](../../../src/ui/hangarChipsUI.js#L2296-L2454), [style.css](../../../style.css#L4222-L4315).
- Сериализация: `techStudying: { techId, remaining, total }` сохраняется в save payload; при восстановлении таймер автоматически перезапускается через `setTechStudying()`.

## Правила
- Не добавлять тексты мимо `src/i18n/ru.json` и `src/i18n/en.json`.
- `src/i18n/fallbackStrings.js` — синхронный fallback, применяется до загрузки JSON; при добавлении нового i18n-ключа его нужно добавлять **одновременно** в `ru.json`, `en.json` **и** `fallbackStrings.js` (иначе до async-загрузки ключ отображается как literal-строка).
- Для talent reset UX синхронно поддерживать `talentResetAll`, `talentResetCooldownLabel`, `talentResetCooldownBlocked`, `talentResetModalText`, `talentResetCooldownModalText`, `talentResetCooldownRefreshNow` и `talentResetCooldownRefreshStub` в `ru.json`, `en.json` и `fallbackStrings.js`, потому что reset button model, confirm modal и cooldown modal читают эти ключи до и после загрузки JSON из разных entrypoints: [src/i18n/ru.json](../../../src/i18n/ru.json#L187-L195), [src/i18n/en.json](../../../src/i18n/en.json#L185-L193), [src/i18n/fallbackStrings.js](../../../src/i18n/fallbackStrings.js#L147-L154), [src/i18n/fallbackStrings.js](../../../src/i18n/fallbackStrings.js#L536-L544).
- Для underground hangar синхронно поддерживать `ughBuyTank`, `ughHelpButton`, `ughHelpText`, `buyBulkBuy` и dynamic auto-merge copy `autoMergeDynamicShort` в `ru.json`, `en.json` и `fallbackStrings.js`: [src/i18n/ru.json](../../../src/i18n/ru.json#L168-L176), [src/i18n/ru.json](../../../src/i18n/ru.json#L565-L573), [src/i18n/en.json](../../../src/i18n/en.json#L166-L176), [src/i18n/en.json](../../../src/i18n/en.json#L565-L573), [src/i18n/fallbackStrings.js](../../../src/i18n/fallbackStrings.js#L66-L74), [src/i18n/fallbackStrings.js](../../../src/i18n/fallbackStrings.js#L438-L446), [src/i18n/fallbackStrings.js](../../../src/i18n/fallbackStrings.js#L506-L512), [src/i18n/fallbackStrings.js](../../../src/i18n/fallbackStrings.js#L735-L742).
- Для underground hangar и main dismantle CTA синхронно поддерживать также `ughTransferToUpper`, `ughAutoMergeUnavailableDetailed` и `dismantleBtn` в `ru.json`, `en.json` и `fallbackStrings.js`; disabled-feedback текст и rename `Разбор танков` считаются частью user-visible contract, а не локальным UI-исключением.
- Для UI-правок мастерской и production storage синхронно поддерживать ключи `workshopTabChipRecycle`, `workshopTabChipReprogram`, `chipCraftDisassembleOverlayHint`, `chipRecycleConfirm*`, `chipReprogram*`, `plStorageTitle`, `plStorageHelpButton`, `plStorageHelpIntro` и `plStorageHelpLevel*` в `ru.json`, `en.json` и `fallbackStrings.js`: [src/i18n/ru.json](../../../src/i18n/ru.json#L420-L534), [src/i18n/en.json](../../../src/i18n/en.json#L420-L534), [src/i18n/fallbackStrings.js](../../../src/i18n/fallbackStrings.js#L264-L364), [src/i18n/fallbackStrings.js](../../../src/i18n/fallbackStrings.js#L560-L763).
- Для craft confirm/result modal новые ключи `chipCraftContinue`, `chipCraftRisk*`, `chipCraftResult*` тоже должны обновляться синхронно в `ru.json`, `en.json` и `fallbackStrings.js`: [src/i18n/ru.json](../../../src/i18n/ru.json#L418-L430), [src/i18n/en.json](../../../src/i18n/en.json#L418-L430), [src/i18n/fallbackStrings.js](../../../src/i18n/fallbackStrings.js#L247-L255), [src/i18n/fallbackStrings.js](../../../src/i18n/fallbackStrings.js#L555-L563).
- Для accel modal строки `techAccelRateSummary`, `techAccelSelectedSummary`, `techAccelDustMeta` должны обновляться синхронно в `ru.json`, `en.json` и `fallbackStrings.js`: [src/i18n/ru.json](../../../src/i18n/ru.json#L452-L461), [src/i18n/en.json](../../../src/i18n/en.json#L452-L461), [src/i18n/fallbackStrings.js](../../../src/i18n/fallbackStrings.js#L264-L273), [src/i18n/fallbackStrings.js](../../../src/i18n/fallbackStrings.js#L562-L571).
- Не переносить доменную логику в слой UI.
- Тени UI-элементов (кнопки/панели/модалки/уведомления/debug) должны оставаться тонкими: baseline `box-shadow` с Y-offset не более `3px`.
- Debug-панели и admin-кнопки оставлять за `?debug=1`.
- Для critical modal: вход/выход должен включать/снимать hard pause через `PauseManager`, skip-кнопка видна только во время typing.
- Кнопка `Перезапустить симуляцию` должна вызывать partial reset runtime мира без запуска второго main loop.
- Для `Перезапустить симуляцию` в `restartSimulationPartial(..., { onAfterRestore })` обязательно выполнять post-restore доведение: телепорт дронов к `supercomputer` (с fallback `(0,0)`), сброс zombie target к дефолту из `assets/zombies.json`, сброс `attackMode` runtime к off/default.
- Critical flow активируется при пороге HP supercomputer `<= 5%`; `Перезапустить симуляцию` в этом сценарии обязан сохранять прогресс-апгрейды из snapshot (talents/mods/cannon/fence/drones/achievements), сбрасывая только runtime-состояние мира.
- Для critical restart post-restore fence runtime сначала принудительно ставится в L1 (`runtimeMaxTankLevelAchieved/currentFenceTierApplied/fenceLevel = 1`), после чего выполняется `syncFenceTierWithMaxTankLevel(..., { force:true })` — итоговый tier пересчитывается по сохранённому `maxTankLevelAchieved`.
- Зомби — это runtime-состояние, не сохраняемое в payload. При любом `restoreFullState` в конце вызывается явный `state.zombies.length = 0` (сброс зомби).
- `restoreFullState` при `Object.assign(getComputerState(), saved.supercomputer)` сохраняет предыдущие валидные координаты `x/y` суперкомпьютера, если в `saved.supercomputer` они нулевые/невалидные (pre-retry payload использует `createInitialState` как базу и не хранит real-координаты).
- Количество стартовых танков при новой игре/рестарте симуляции: **1 танк 1-го уровня**. Точки спавна: `spawnInitialTanksLvl1(state, 1)` (в `resetGameState`) и цикл с `seeded < 1` (в `applyPreRetryRuntimeReset`).

## Меню и confirm выхода
- Small menu confirm выхода живёт в `menuExitConfirmView` (`index.html`), обработчики — `src/core/bootstrap.js`.
- Small menu confirm для `New` живёт в `menuNewConfirmView` (`index.html`): `Продолжить` сначала очищает legacy `localStorage.progress`, затем вызывает `resetGameState({ reason: 'new_game' })`; `Назад` возвращает в root small menu: [src/core/bootstrap.js](../../../src/core/bootstrap.js#L557-L563), [game.js](../../../game.js#L7875-L7952).
- `New game` — отдельный reset-path, а не partial restart: baseline после него — `player.talentPoints = 0`, `talentsV2.freePoints = 0`, `freeTalentPointsV2 = 0`, `supercomputer.computerLevel = 0`, `xpToNext = 50`: [game.js](../../../game.js#L454-L501), [src/persistence/initialState.js](../../../src/persistence/initialState.js#L4-L106), [src/mechanics/progression.js](../../../src/mechanics/progression.js#L16-L21).
- В small menu больше нет пункта для отправки отзывов; действия: `Continue`, `New`, `Save`, `Load`, `Exit`.
- Кнопка `Выход` в confirm должна переиспользовать существующий session-exit flow (`stopAndResetSessionToBigMenu`), без дублирования reset-логики.
- `stopAndResetSessionToBigMenu` приводит приложение к состоянию первого запуска через перезагрузку страницы (`window.location.reload`) после очистки transient `progress` (слотовые сохранения не затрагиваются).
- Открытие/закрытие confirm-экрана внутри small menu не должно трогать pause/unpause; меняется только активный `menuView`.
- Лейаут `#menuExitConfirmView .menuInlineActions` и `#menuNewConfirmView .menuInlineActions`: `display:flex`, `justify-content:center`, `align-items:center`, `flex-wrap:nowrap`, `gap:12px`; кнопки одинаковой ширины через `clamp(...)` с mobile-override.
- При открытии confirm (`openExitConfirmView`, `openNewConfirmView`) в `src/core/bootstrap.js` обязательно сбрасывать `lastActiveButtonIdSmallMenu = null` и вызывать `applySmallMenuSelectedState()` — чтобы ни одна кнопка main menu не светилась как selected пока открыт confirm.
- На экране confirm ни одна кнопка не имеет default selected-подсветки; selected появляется только после клика пользователя.
- Для `menuExitConfirmView`/`menuNewConfirmView` default-state: `selected = none` (первый рендер без `menuActionSelected`/`btnPrimary` на кнопках confirm).
- Явный выбор для confirm считается только после пользовательского действия: `pointerdown/click`, фокус и подтверждение с клавиатуры (`Enter`/`Space`) или навигация стрелками (`ArrowLeft/Right/Up/Down`).
- Пока `sessionStartGate=locked`, `Continue` в small menu недоступен; в сессию можно войти только через big menu `New` или успешный `Load(slot)`.

## Sound menu: track loop control
- Слайдер `sound.trackLoop` удалён из small menu и big menu.
- Громкость езды танка (`trackLoop`) настраивается только в коде: `src/config/audioUi.js` → `AudioUi.TANK_DRIVE_VOLUME_MULT`.

## Auto pause toggle
- В small menu есть checkbox `menuAutoPause` (`Автопауза при неактивной вкладке`).
- В big menu есть два синхронных checkbox той же настройки: в sound subpanel (`bigMenuAutoPause`) и в root-view (`bigMenuRootAutoPause`).
- Настройка хранится в `settings.autoPauseOnInactive` (default `false`).
- `PauseManager` учитывает флаг через `isAutoPauseEnabled`; при `false` причина `tabInactive` принудительно очищается.

## Small menu Save/Load views
- Save-view — подрежим small menu: `#smallMenuSaveView` в `index.html`, логика в `src/core/bootstrap.js`.
- Load-view — соседний подрежим small menu: `#smallMenuLoadView` в `index.html`, использует тот же table-layout (`smallMenuSaveTable__*`) и тот же renderer в `src/core/bootstrap.js`.
- При входе в Save/Load view скрывается root small menu (`#smallMenuRootView.is-hidden`), показывается только активный subview (`.smallMenuSaveView.is-active`), pause остаётся через обычный menu lock (`setMenuOpen(true)` + `PauseManager.setMenuOpen`).
- Таблица слотов всегда рендерит 10 строк (`1..10`) с колонками: `№`, `Имя`, `Дата`, `Сохранить/Загрузить`.
- Inline edit имени включается по `pointerdown` по строке (кроме кнопки `Сохранить`) только для слотов `1..9`; Enter/blur = commit, Esc = cancel; commit идёт через `Game.Storage.setSlotName`.
- Кнопка `Сохранить` вызывает `Game.Storage.saveSlot(index, state)`; слот `10` (Auto) в Save view read-only (кнопка disabled).
- Кнопка `Загрузить` вызывает `Game.Storage.loadSlot(index)`; пустой слот остаётся disabled.
- Кнопка `Назад` в save/load-view возвращает в root small menu без отдельного снятия паузы; правила pause определяются состоянием открытия small menu в целом.

## Состояние подсветки кнопок меню
- Big menu и small menu хранят last-click состояние раздельно (без shared state между меню).
- На первом показе меню selected-подсветки нет; selected появляется только после клика.
- Hover остаётся CSS-driven (`:hover`) и не зависит от selected.
- При новом клике в пределах одного меню selected переносится на новую кнопку и снимается с предыдущей.
- При открытии sub-view (confirm, save, load) из small menu — `lastActiveButtonIdSmallMenu` сбрасывается в `null`, чтобы кнопка основного меню не оставалась подсвеченной.

## Big menu: Language + Credits
- Кнопка `Язык/Language` открывает подпанель из двух подкнопок (`Русский`, `Английский`) прямо под кнопкой через локальный wrapper в DOM (`bigMenuLanguageWrap`), а не через глобальное позиционирование.
- Активность подкнопок языка вычисляется только от текущей локали (`getCurrentLang`) и использует тот же selected-стиль (`menuActionSelected` + `btnPrimary/btnSecondary`), что и старая подсветка кнопки меню.
- Подпанель языка закрывается при выборе языка и по outside click; outside-listener снимается при закрытии.
- В big menu больше нет пункта для отправки отзывов; действия: `New`, `Load`, `Sound`, `Language`, `Credits`.
- Пункт `Credits/Создатели` открывает `creditsModal` (закрытие по `×` и `Esc`) и рендерит список участников из `assets/credits.json`.
- Для `Load` в big menu нет постоянного текста «Нет сохранений». Доступность отражает `Game.Storage.hasAnySaves()` по фактическому наличию payload в слотах: при отсутствии сейвов ставятся `aria-disabled="true"` и `data-disabled-reason="noSaves"`, при наличии — атрибут reason убирается.
- Big menu `Load` открывает отдельный subview `bigMenuLoadView` внутри big menu: таблица слотов всегда 10 строк (`1..10`), колонки `№/Имя/Дата/Загрузить`, `Назад` возвращает в root big menu.
- `Load(slot)` в big menu вызывает `Game.Storage.loadSlot(index)`; при успехе закрывает big menu, снимает gate (`sessionStartGate=unlocked`) и запускает сессию.
- `Back` в `bigMenuLoadView` не закрывает big menu и не снимает menu lock; возвращает только на root big menu.
- При открытом big menu gameplay всегда заблокирован (input + симуляция) через menu lock (`PauseManager` / `setMenuOpen`-источник big menu).

## HUD: supercomputer button
- `#supercomputerBtn` позиционируется runtime-логикой через `transform: translate3d(...)`; не применять к нему layout-сдвиги (`top/left`) на active/pressed.
- Press/hover-эффекты должны быть визуальными (яркость/scale иконки), не менять якорную позицию кнопки.
- При изменениях в unified button behavior (`.uiButtonBehavior`) обязательно сохранять исключение для HUD-кнопки суперкомпьютера.
- `.supercomputerHudBtn` по умолчанию скрыта (`visibility:hidden`) и показывается только после первого успешного расчёта позиции в `updateSupercomputerHudButtonPosition()`; это исключает появление в `(0,0)`.
- При `resetGameState` (до `initBoard`) обязательно: `supercomputerHudRuntime.button.lastVisible = false`, `supercomputerHudRuntime.button.lastTransform = ''`, `ui.supercomputerBtn.style.visibility = 'hidden'`. Это предотвращает однокадровый flash HUD-кнопки в (0,0) до пересчёта layout.
- Для `.supercomputerHudBtn` и `.supercomputerHudBtn.uiButtonBehavior` запрещён `transition` по `transform` и запрещён `transition: all`; допускаются только визуальные свойства (`box-shadow/filter/background-color/border-color/opacity`), чтобы убрать визуальный «полёт» при обновлении координат.

## HUD: XP bar
- Fill `#xpBar.xpFill` фиксирован: `background: #14a13d` (без gradient).
- Empty-часть (`.xpBar`) должна оставаться серой в общем HUD-стиле (используем штатный нейтральный серый фон, без случайных цветов).
- Анимация прогресса только через CSS transition `width` у fill-элемента в диапазоне `200–300ms`.
- JS-обновление должно менять именно `xpBar.style.width = 'NN%'` и писать значение только при фактическом изменении процента (чтобы не перезапускать transition на каждом тике).

## Supercomputer: root tiles
- Контейнер плиток: равномерная grid-сетка `3` колонки (`.scRootTiles`), без ручного расчёта фиксированной ширины карточки.
- Иконка `.scRootTile__icon` рендерится как полноразмерный фон карточки (`position:absolute; inset:0; background-size:cover`), а текстовый label (`.scRootTile__label`) идёт поверх.
- Label `.scRootTile__label`: перенос строк разрешён (`white-space:normal`, `overflow-wrap:anywhere`), чтобы длинные названия не обрезались в root-плитках.
- Label `.scRootTile__label` фиксируется у нижней кромки плитки (`margin-top:auto`), чтобы подписи root-плашек визуально располагались внизу.
- Высота root-карточек нормализуется по самой высокой карточке через `--scRootTileUniformHeight` + runtime-нормализацию (`normalizeRootTilesSize()` при `openRoot()`).
- Для root-сетки сохраняется запас по краям (`overflow:visible` у контейнера), при этом сама карточка может использовать `overflow:hidden` для корректного клипа полноразмерного фонового изображения по радиусу.

## Supercomputer: modal layout
- `supercomputer` модалки (`#supercomputerMenuOverlay`, `#modsHangarOverlay`, `#modsTankWallOverlay`) оформляются как `large modal` по паттерну дерева улучшений: panel с классом `.scModal`.
- `talentOverlay` получает тот же close-skin, что и supercomputer modal: `applySharedTalentModalClass()` добавляет `.scModal` на panel и `.scModal__close` + `data-font-floor-ignore="true"` на `.modalClose`, поэтому крестик дерева визуально и по hit-area совпадает с SC modal: [src/ui/supercomputerMenu.js](../../../src/ui/supercomputerMenu.js#L193-L203), [style.css](../../../style.css#L1828-L1920).
- Размеры модалки должны быть адаптивными и ограниченными viewport: паттерн `width:min(96vw, 1060px)` и `max-height:min(90vh, 920px)`.
- Для `#modsTankWallOverlay` размер панели выровнен с окном дерева талантов: `width:min(980px,95vw)`, `max-height:86vh`.
- Внешний overlay не скроллится (`overflow:hidden`), скролл разрешён только внутри `.scModal__body` (`overflow-y:auto; overflow-x:hidden`, `min-height:0`, `flex:1`).
- `.levelModal__panel.scModal` должен иметь `box-sizing:border-box` — чтобы padding не ломал расчёт ширины.
- Кастомный scrollbar для `.scModal__body`: эталон — audio slider (`.menuSlider input[type=range]`); применяется через `scrollbar-width:thin; scrollbar-color: rgba(255,140,90,.55) rgba(18,12,9,.7)` (Firefox) + webkit: ширина `7px`, thumb — `linear-gradient(140deg,#ffd39e,#ff8c5a)`, `border-radius:999px`.
- При открытой SC-модалке добавлять `body.scmodal-open { overflow:hidden; touch-action:none }`: `openRoot()` добавляет класс, `closeAll()` снимает. Это предотвращает появление второго скроллбара страницы при pressed-анимации кнопок внутри модалки.
- Кнопки `.scButton:active:not(:disabled)` — pressed-эффект только через `transform:translateY(2px) scale(0.99)`, без изменений layout (`margin`, `padding`, `height`), чтобы не провоцировать системный scrollbar.
- Для SC/Talents модалок (`#supercomputerMenuOverlay/#modsHangarOverlay/#modsTankWallOverlay/#talentOverlay`) pressed-состояние `uiButtonBehavior` и `scButton` принудительно `transform:none`, чтобы полностью убрать transient scrollbar при удержании.
- Для SC/Talents модалок у кнопок нельзя клиппить наружные тени (`overflow:visible` для `.btn` в пределах этих overlay).
- Для SC/Talents overlay shimmer-псевдоэлемент `.btn::after` отключён, чтобы hover не давал белый прямоугольник на кнопках.
- Для `.scButton` обязателен `box-sizing:border-box`; на active/pressed запрещено менять `border-width`, `padding`, `height`, `margin`, `line-height`.
- Правило overflow: одновременно скроллится только один контейнер (`.scModal__body`), а `overlay/panel/body` страницы не должны получать параллельный scroll.
- Для `modsTankWall` табы и крестик остаются доступными, а длинный контент (`таблицы/списки`) прокручивается внутри внутреннего scroll-контейнера, без внешнего page/overlay scroll. **Кнопка «Закрыть» (`modsTankWallBack`) должна быть прямым дочерним элементом `.levelModal__panel.scModal`, а НЕ внутри `.scModal__body`** — это предотвращает появление второго скроллбара на вкладке «Дроны», где таблица занимает всю высоту body.
- Для root/hangar модалок SC body-скролл отключён; для `modsTankWall` скролл оставлен только у `#modsTankWallOverlay .scModal__body`.

### Диагностика: второй scrollbar в supercomputer modal
- Как воспроизвести: открыть `Supercomputer -> Модификации -> Назад`, зажать кнопку `Назад` (или другую `.scButton`) и удерживать.
- Ожидаемо: кнопка визуально «прижимается» только через `transform`, но layout не меняется; активен только внутренний scrollbar `.scModal__body`.
- Запрещённые изменения: любые pressed-стили, меняющие box-model, и любые правки, из-за которых `body` начинает прокручиваться параллельно с `.scModal__body`.

## On-track dim (иконка в слоте)
- Источник параметра: `assets/tanks.json` → `ui.onTrackIconOpacity`.
- Диапазон: `0..1`; default: `0.45`.
- Применение: `src/render/spriteLoaders.js` нормализует в `TankSprites.config.ui.onTrackIconOpacity`, а `game.js` использует значение в `drawTankIconTo(...)` вместо хардкода.
- Fallback: при отсутствии/невалидном значении используется `0.45`, итоговое значение всегда clamp `0..1`.

## Unified button behavior и UI SFX
- Hover/click UI SFX централизованы в `src/ui/buttonBehavior.js`; не дублировать обработчики по модалкам/экранам.
- Hover SFX запускается только для `mouse` (`pointerover`, capture) и с глобальным cooldown.
- Защита от повторов на дочерних элементах: если `relatedTarget` остаётся внутри той же `.uiButtonBehavior`, hover SFX не проигрывается.
- Hover SFX не запускается для disabled и hidden-элементов.
- Click SFX запускается на `pointerdown` (capture), с разными id для enabled/disabled состояния.
- Для disabled-кнопок воспроизводится только disabled-click SFX; `is-pressed` не проставляется.
- Изменения в unified button behavior не должны ломать HUD supercomputer (позиция остаётся под runtime `transform`).
- Disabled toast правило: если у кнопки `data-disabled-reason="noSaves"`, показывается «Нет сохранений/No saves», иначе «Недоступно/Unavailable». Сообщение показывается через единый helper `src/ui/toast.js` (один DOM, таймер перезапускается, без бесконечного stacking).

## Supercomputer: вкладка "Стены"
- Вкладка "Стены" (`walls`) в supercomputerMenu рендерит таблицу L1..L60 аналогично вкладке "Орудия".
- В `modsTankWall` доступны только вкладки `Орудия` и `Стены`; вкладка `Базы` полностью удалена из DOM/runtime/i18n.
- В `modsTankWall` таблицы `Орудия` и `Стены` должны показывать минимум 4 строки сразу (без дополнительного скролла на первом экране).
- Состояние pending/reserved для стен (`pendingFenceUpgradesByLevel`, `getReservedFenceDamagePoints`) полностью независимо от состояния пушек.
- При смене вкладок внутри модалки (Орудия <-> Стены) pending state не сбрасывается. Сброс происходит только при полном закрытии модалки.
- Стоимость шага улучшения стены вычисляется через `getCannonUpgradeStepCost` (которая внутри вызывает общую `getUpgradeStepCost`).
- Суммарная стоимость pending шагов для уровня вычисляется как сумма стоимостей каждого шага: `sum_{i=0..k-1} getUpgradeStepCost(level, applied+i)`.
- Overflow-блокировки: если стоимость следующего шага превышает `Number.MAX_SAFE_INTEGER` или уходит в бесконечность, кнопка `+` блокируется.
- Preview стены рисуется в canvas через `drawGunsSpriteCanvas`.
- Источник превью кадра (по приоритету): `levels[].uiIcon.frame.id` -> `levels[].uiIcon.frame (x/y/w/h)` -> `levels[].uiIcon.frameId` -> `levels[].uiFrameId` -> `sideTop`.
- Источник превью atlas (по приоритету): `levels[].uiIcon.atlas` -> `levels[].uiAtlas` -> `levels[].atlas` -> `fence.json.atlas`.

## Modal padding standard
- Единый отступ модалок задаётся через `:root { --uiModalPad: clamp(16px, 4vw, 50px) }`.
- Применяется к ключевым контейнерам: `.levelModal__panel`, `.modalHeader`, `.modalBody`, `.levelModal__panel.scModal`.
- Для `#modsTankWallOverlay` внутренние боковые отступы табов/контента также завязаны на `--uiModalPad` через `--mods-sc-pad-x`.

## Debug panel tabs
- Реализация: `src/ui/debugPanel.js`.
- Текущий состав вкладок: `Tanks`, `Effects`, `Updates`, `Logs&Tools`.
- Из панели удалены вкладки и связанный runtime UI-код: `Zombies`, `Roads/Hangar`, `Actives`, `Talents`.
- В `Effects` удалены preview-VFX кнопки (`Burst center`, `Particle burst`, `Impact ring`, `Decal pool`) и служебные кнопки `Stop all preview VFX` / `Clear debug statuses` вместе с их обработчиками.
- В `Logs&Tools` удалены кнопки `Reset (statuses + VFX)`, `Clear log`, `Lesson Progress`; раздел оставляет только mount для telemetry/debug-виджетов.

## Hangar slot stamp reveal
- Визуал слота ангара: появление нового/купленного танка идёт через stamp-reveal анимацию (`10` горизонтальных полос).
- Реализация: `game.js` — `makeTank(..., options)` + `drawTankIconWithStampReveal(...)` / `getTankStampProgress(...)`.
- Длительность печати берётся из `assets/tanks.json -> tankPrintDurationSec` (fallback `1.5s` при отсутствии/невалидном значении).
- Этот же `tankPrintDurationSec` переиспользует `Game.SupercomputerBuildTankFx.start()`: кнопка `Создать танк X уровня` держит root-анимацию `buildTank` у суперкомпьютера ровно на окно печати, синхронное со stamp-reveal в слоте: [game.js](../../../game.js#L3289-L3307), [src/ui/supercomputerBuildTankFx.js](../../../src/ui/supercomputerBuildTankFx.js#L22-L53), [game.js](../../../game.js#L11374-L11382).
- Пока танк в состоянии печати (`isTankPrinting`) он не участвует в пользовательских и авто-действиях: drag/перемещение, merge, auto-merge и отправка на трассу блокируются.
- В ангарной отрисовке слота тень корпуса танка отключена (`showShadow:false`).
- В preview иконок в dismantle confirm modal (`fillDismantleConfirmModal`) тень также отключена (`drawTankIconTo(..., { showShadow:false })`).
- Контракт restore: при `restoreFullState(...)` штамп отключается (`makeTank(..., { enableStamp:false })`), чтобы загруженные сейвы не проигрывали spawn-анимацию.

## Debug panel: Updates
- Раздел `Updates` содержит два действия: `Talent points (+)` и `Damage points (+)`.
- UX: `input type="number"` + кнопка `Окей`; значение парсится как `Math.floor(Number(value))`, невалидный ввод даёт `0`, начисление выполняется только для `>0`.
- Начисление talent points идёт через `game.js -> debugAdjustTalentPoints(...)` (с синхронизацией `state.player.talentsV2.freePoints` и `freeTalentPointsV2`, а также `TalentsV2.setFreePoints(...)` при активном v2 runtime).
- Начисление damage points идёт через `game.js -> debugAdjustDamagePoints(...)`, что корректно обновляет доступные очки и refresh supercomputer UI.

## Tank onTrack toggle
- User-action переключения `tank.onTrack` выполняются из `canvas` pointer handlers в `game.js`, но само изменение состояния делается через единый entrypoint `setTankOnTrackState(...)` -> `Game.Garage.setTankOnTrack(...)`.
- Прямые присваивания `tank.onTrack = ...` для UI-toggle не использовать.
- По user-action использовать `cause: 'user'` (SFX включены), по системным сценариям (`reset`, `restore`) использовать `playSfx: false`/соответствующий cause.
- В reset-пути (`resetGameState`) перед очисткой состояния применяется подавление track-SFX, чтобы при программных изменениях звуки не воспроизводились.

## Supercomputer tabs divider
- Разделитель под вкладками `Орудия/Стены` в `#modsTankWallOverlay` — это нижняя граница `.scTabs`.
- Правило вёрстки: линия должна доходить до внутренних краёв рамки окна без боковых отступов; для `#modsTankWallOverlay` это делается через нулевые боковые padding у panel и явные `margin-left/right` для прямых дочерних блоков (`title`, `scTabPanels`, footer-actions), без negative margin у `.scTabs`.
- Проверка: открыть `Модификации танков и стен`, убедиться, что у divider нет видимых зазоров слева/справа относительно внутренней рамки.

## Supercomputer: таб `Орудия`
- Реализация: `src/ui/supercomputerMenu.js`, панель `#modsTankWallPanelGuns`.
- Таблица рендерит 60 строк (`1..60`) и 7 колонок:
	- sprite `cannon.src` (по уровню танка, fallback-текст при отсутствии),
	- уровень `L`,
	- `attackSpeed` (базовое / текущее),
	- `baseDamage` (базовое / текущее),
	- уровень улучшения (`applied` и `+pending`),
	- стоимость только текущего шага (`nextStepCost`),
	- действия `+`, `-`, `Улучшить` (кнопки `+/-` собраны в вертикальный стек `.scGunsActionStepper`).
- `pendingUpgradesByLevel` — локальное UI-состояние (живет только пока открыт supercomputer menu, сбрасывается при полном закрытии).
- `reservedDamagePoints` считается как сумма стоимости всех pending-шагов по всем уровням с учётом текущего `applied`.
- Расчёт стоимости для уровня `L`:
	- `applied = state.player.cannonUpgradesApplied[L]`;
	- `pending = pendingByLevel[L]`;
	- `u0 = applied + pending`;
	- `nextStepCost = getCannonUpgradeStepCost(level, applied + pending)`.
- Обновление значений: при `+/-` и после `Улучшить` пересчитывается только `nextStepCost` и состояние pending/applied.
- Кнопка `+` увеличивает pending только если `availableDamagePoints - reservedDamagePoints >= nextStepCost`.
- Кнопка `-` уменьшает pending до нуля и освобождает reserve.
- Кнопка `Улучшить`:
	- disabled при `pending=0`;
	- при `pending>0` повторно валидирует доступные очки,
	- списывает очки, применяет апгрейд в state и сбрасывает pending для выбранного уровня.
- Формат отображения статов: целые значения показываются без суффикса `.00` (для `attackSpeed`, `damage`, `HP`, `armor`).
- Иконки орудий:
	- источник кадра — текущий `cannon` spritesheet (`TankSprites.pickCannon(level)`);
	- source-кадр для UI принудительно берётся как `128x128` (через `Game.Config.LayoutTuning.weaponIconSpriteFrameW/H`), независимо от display-size canvas;
	- число кадров берётся из `Game.Config.LayoutTuning.weaponIconAnimFramesByLevel[L-1]` (fallback `iconFrames` из баланса, далее `1`), при `1` анимации нет;
	- FPS берётся из `Game.Config.LayoutTuning.weaponIconAnimFpsByLevel[L-1]` (fallback `8`);
	- ширина `canvas` задаётся через `Game.Config.LayoutTuning.weaponIconW`; ширина sprite-колонки в CSS должна быть согласована с этим значением;
	- строки таблицы и все ячейки центрируются по вертикали/горизонтали; высота строки должна гарантированно вмещать текущий sprite-размер без наезда на соседние строки;
	- используется один shared ticker (`setInterval`) на весь таб `Орудия`, без 60 отдельных `requestAnimationFrame`/таймеров;
	- ticker активен только пока открыт `Supercomputer -> Орудия`, и останавливается при закрытии/переключении таба.
	- поворот иконок задаётся единой константой `WEAPON_ICON_ROT_DEG` в `src/ui/supercomputerMenu.js` и применяется в `drawGunsSpriteCanvas(...)` через `ctx.translate(center)` + `ctx.rotate(...)`; `imageSmoothingEnabled` остаётся `false`.
- Иконки дронов:
	- масштаб задаётся через `Game.Config.LayoutTuning.droneIconScale` (default `1.0`); применяется к `weaponIconW`/`weaponIconH` как множитель, итоговые размеры `dronIconW = round(iconW * droneIconScale)`, `dronIconH = round(iconH * droneIconScale)`;
	- атрибут `data-icon-scale` проставляется на canvas дронов и считывается в `drawGunsSpriteCanvas` для применения масштаба, изолированно от орудий/стен;
	- анимация дронов берётся из `DronSprites.getAnimation('fly')`, `frames` — массив frame ID, геометрия кадра через `DronSprites.pickFrame(frameId)`;
	- `data-rot-deg="0"` для дронов (без поворота).

## Stage actions: boost button
- Кнопка `#boost` и модалка `#boostModal` удалены; не добавлять обработчики `openBoostModal/closeBoostModal` обратно в runtime/UI.

## Zombie extra VFX policy
- Дополнительные ауры/свечения/кольца для зомби отключены в коде рендера (`src/render/zombieRender.js`) через флаг `DISABLE_ZOMBIE_AURAS = true`.
- Отключаются только zombie-ветки overlay VFX (endgame glow + level ring), базовый спрайт/анимация/тени/логика боя не изменяются.
- `assets/zombies.json` для этого не используется и не должен редактироваться.

## Merge popup (новый уровень танка)
- Точка входа pop-up: `src/ui/mergePopup.js` (`Game.MergePopup.show(level)`), preview/render: `src/ui/mergePreview/mergePreviewModel.js` + `src/ui/mergePreview/mergePreviewRenderer.js`.
- Локальное условие удаления FX: `PREVIEW_UPDATE_OPTS = { disableRightHullShotFx: true }` и `PREVIEW_RENDER_OPTS = { showRightHullShotFx: false }` в `src/ui/mergePopup.js`; опции передаются только в preview model/renderer из merge popup.
- Правило: отключён только right-side hull shot FX (`tankIndex === 1`) в preview-рендере pop-up; пушечная стрельба/SFX и остальные loop FX pop-up не меняются.

### QA (ручной)
- Открыть pop-up нового уровня танка и проверить, что справа нет боковой shot-вспышки/трассера от правого корпуса.
- Убедиться, что остальные эффекты pop-up (основной fire/SFX и loop-анимации) визуально/аудио работают как раньше.

## Мини-проверка
- Кнопки работают мышью и touch.
- Фокус и закрытие модалок проходят через `Game.A11y`.
- UI не ломает паузу/возобновление и сохранение.
- В critical modal по `Skip` текст допечатывается мгновенно, затем показываются финальные действия.
- Повторные нажатия `Перезапустить симуляцию` не создают дубли таймеров/спавна.

## Треугольные чипы ангара (Hangar Chips)

### Где править
- Механики: `src/mechanics/hangarChips.js` (`Game.HangarChips`)
- UI контроллер: `src/ui/hangarChipsUI.js` (`Game.HangarChipsUI`)
- Разметка: `index.html` → `#modsHangarOverlay`
- Стили: `style.css` → `.hangarChipsModal`, `.hangarLayout`, `.hangarGrid`, `.hangarSlotView`, `.hangarActiveMods`, `.hangarChipBtn`
- Состояние: `src/persistence/initialState.js` → `state.hangarCells`
- i18n: ключи `hangarChips*` в `src/i18n/ru.json`, `src/i18n/en.json`
- Debug: `src/ui/debugPanel.js` → вкладка `Chips` с секцией `#debugSectionChips`

### Архитектура
- Каждая ячейка ангара (0–15) имеет «бабочку» из 6 равносторонних треугольных слотов одинакового размера (сторона ≈120px в viewBox 400×300):
  - 2 красных центральных (red-0 top, red-1 bottom) — образуют ромб с общей стороной A–B.
  - 4 жёлтых угловых (yellow-0..3) — примыкают к красным по рёбрам.
- SVG-геометрия: TC(200,90), BC(200,210), CL(96,150), CR(304,150), TL(96,30), TR(304,30), BL(96,270), BR(304,270).
- **Визуализация чипов (composed SVG)**: функция `chipSvgComposed(w, h, borderColor, modIds, cssClass, strokeW)` рисует чип как 3 вложенных мини-треугольника внутри большого контура. Каждый мини-треугольник окрашен цветом модификатора. Используется повсюду: инвентарь, грид улучшений, craft panel, tech modal.
- **Фрагмент SVG**: `_fragmentSvgUp(modId, size, strokeColor)` — маленький треугольник «вершиной вверх», окрашенный по модификатору.
- Чип — неупорядоченная тройка модификаторов {1..14}, max 1 «спецмод» (10–14), тройки вида (a,a,a) запрещены.
- Пул: 156 красных + 225 жёлтых = 381 уникальный чип.

### Правила размещения
- **Установка через выбор слота**: нажать на слот (треугольник) в SVG, затем на чип в списке.
- **Drag-and-drop в слоты (Task 7)**: зажать чип в инвентаре (pointerdown на `[data-chip-id]`), перетащить на SVG-слот бабочки. Подсветка слота при наведении (`brightness(1.5)`, утолщённая обводка). При отпускании: проверка цвета слота ↔ чипа, если слот занят — старый чип возвращается в инвентарь, новый устанавливается. Реализовано через `_slotDragging` state в `init()`.
- **Зелёная подсветка совпадений (Task 5)**: чипы в инвентаре, которые при установке создадут match с уже установленным красным чипом, подсвечиваются зелёным (`hangarChipBtn--canMatch`). Функция `_wouldChipCreateMatch(cell, chipEntry, h)` проверяет все 3 ротации.
- **Список чипов для установки**: во вкладке «Улучшение ячеек» отображаются только чипы из инвентаря игрока (`ensurePlayerChips()`), а не все чипы в игре. Если для выбранной ячейки чип может дать match, он поднимается в начало списка, при этом порядок внутри групп `canMatch/non-canMatch` остаётся стабильным. Каждая кнопка чипа содержит бейдж уровня (`.hangarChipBtn__lvl`) и бейдж количества (`.hangarChipBtn__cnt`).
- При установке чипа он удаляется из инвентаря (`removePlayerChipOne`). При снятии чипа он возвращается в инвентарь (`addPlayerChip`).
- Выбранный слот подсвечивается: утолщённая обводка (strokeW=4) + CSS-анимация пульсации (`.hangarSlotPoly--selected`, `@keyframes slotPulse`).
- Красный чип: mods сортируются → A ≤ B ≤ C; A и B — внутренние вершины (смежные со 2-м красным), C — внешняя.
- Жёлтый чип: mods с id ≥ 10 ставится в вершину X (не смежную с красными); оставшиеся 2 → innerA/innerB.
- Match двух красных чипов: `p1.A === p2.A && p1.B === p2.B` → активны A + B + C₁ + C₂; иначе **оба красных чипа не работают** (ни один модификатор не активен).
- Жёлтый чип: если установлен, активен только X-мод (внешний угол).
- Жёлтый слот: можно установить только 1 жёлтый чип на ячейку. При установке второго предыдущий снимается.
- **Вращение чипов**: при наведении курсора на слот с установленным чипом появляется кнопка ↻. Клик по ней вращает чип на 120° по часовой стрелке, изменяя привязку модификаторов к вершинам (A, B, C / innerA, innerB, X). Вращение влияет на match красных чипов.

### Интеграция
- `SupercomputerMenu.showHangarMods()` вызывает `Game.HangarChipsUI.init()` + `.show()`.
- Состояние хранится в `state.hangarCells` (массив из 16 объектов с `.slots` и `.activeMods`).
- Создаётся лениво при первом обращении через `Game.HangarChips.createHangarCellsState()`.

### Debug
- Вкладка `Chips` в debug panel (`?debug=1`): выбор ячейки, слота, ввод chip key (формат `a-b-c`), кнопки Install/Remove/Clear.
- API: `Game.HangarChipsUI.debugInstallByKey(cellIdx, slotType, slotId, 'a-b-c')`, `debugRemoveChip(cellIdx, slotType, slotId)`, `debugClearCell(cellIdx)`.

### QA (ручной)
- Суперкомпьютер → Модификации ангара: открываются 3 основные вкладки: «Улучшение ячеек», «Мастерская», «Открытие технологий».
- «Мастерская» содержит 2 под-вкладки: «Улучшение чипов» и «Создание чипов».
- Выбор ячейки в сетке 4×4: бабочка SVG обновляется, список чипов фильтруется по типу выбранного слота.
- Иконки чипов отображаются как composed SVG (3 мини-треугольника), фрагменты — как маленькие треугольники вершиной вверх.
- Чипы, создающие match при установке, подсвечиваются зелёным в списке инвентаря.
- Drag-and-drop из инвентаря в слот бабочки: зажать чип → перетащить на слот → при совпадении цвета устанавливается (с заменой).
- Установка красного чипа в оба red-слота: проверить match A+B, отображение «Совпадение!» или «Нет совпадения». Без совпадения оба чипа неактивны.
- Установка жёлтого чипа: проверить, что при установке 2-го жёлтого 1-й снимается автоматически.
- «Улучшение чипов»: merge через drag-and-drop (зажать чип и перетащить на одноименный).
- «Создание чипов»: два toggle-кнопки «Разобрать»/«Создать чип». В режиме «Разобрать» можно добавлять несколько чипов (пакетная разборка), в «Создать чип» — только фрагменты с валидацией (нет троек одинаковых, макс 1 спецмод) и лайв-превью результата.
- «Распылить»: нажать → появляются чекбоксы → выбрать элементы → «Подтвердить» → кремниевая пыль добавляется, элементы удаляются.
- «Открытие технологий»: кнопки «Скормить» удалены; вместо них — «Начать процесс изучения» с таймером, «Отменить» с подтверждением, «Ускорить» с выбором чипов.
- Debug panel: установить чип по ключу, убедиться, что SVG обновляется.
