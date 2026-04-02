# supercomputerMenu.js — карта файла

> Агент-ориентировано. Обновлён: 2026-04-02.
> Файл большой (~1.9k строк): перед правками модалок суперкомпьютера открой этот map.

## Что это
`src/ui/supercomputerMenu.js` — контроллер трёх связанных overlay: root supercomputer menu, hangar mods и vehicle/wall mods. Здесь живут scroll-lock, root tiles, shared help shell, а также общий contract для expandable таблиц апгрейдов оружия/дронов/стен: summary row раскрывает stat-specific controls, damage points резервируются по pending шагам, а повторный клик по раскрытой строке применяет pending per-stat upgrades через runtime callbacks.

С начала файла также живёт shared help-shell API и SC-family shell ownership: общий `techModal__dialog--help` открывается не только из talents/tank-wall flow, но и переиспользуется underground hangar и production storage modal; `shouldUseFullscreenShell()` остаётся canonical fullscreen helper именно для talents/hangar/tank-wall, а `applySharedTalentModalClass()` владеет talents header-action row и видимыми `help -> close` контролами для embedded talents view. Production storage deliberately остаётся вне этого fullscreen routing и живёт в собственном centered responsive shell contract через `src/ui/productionLineUI.js` + `style.css`.

## Быстрый старт для агента
- Shared help modal / accordion / help-button copy sync → [toggleSharedHelpSection()](../../src/ui/supercomputerMenu.js#L52-L60), [showSharedHelpModal()](../../src/ui/supercomputerMenu.js#L159-L185), [syncSharedHelpButtonCopy()](../../src/ui/supercomputerMenu.js#L150-L157), export в [global.Game.SupercomputerMenu](../../src/ui/supercomputerMenu.js#L2182-L2184).
- Focus-safe overlay close / hide routing → [hideSharedHelpModal()](../../src/ui/supercomputerMenu.js#L143-L149), [resolveOverlayHideFocusTarget()](../../src/ui/supercomputerMenu.js#L219-L233), [moveFocusOutsideOverlay()](../../src/ui/supercomputerMenu.js#L235-L247), [setOverlayOpen()](../../src/ui/supercomputerMenu.js#L249-L260).
- Responsive shell routing + talents close/help ownership → [shouldUseFullscreenShell()](../../src/ui/supercomputerMenu.js#L422-L469), [syncResponsiveShellState()](../../src/ui/supercomputerMenu.js#L461-L469), [ensureTalentsHeaderActions() / ensureTalentsShellCloseButton() / ensureTalentsShellHelpButton()](../../src/ui/supercomputerMenu.js#L553-L636), [applySharedTalentModalClass()](../../src/ui/supercomputerMenu.js#L620-L690).
- Per-stat pending/reserve/apply seam → [CANNON_STAT_KEYS / DRON_STAT_KEYS / FENCE_STAT_KEYS + state](../../src/ui/supercomputerMenu.js#L319-L339), [pending helpers](../../src/ui/supercomputerMenu.js#L578-L739), [expanded row / stat-control / applyPendingStats](../../src/ui/supercomputerMenu.js#L755-L839).
- Root-плитки и общая геометрия → [openRoot()](../../src/ui/supercomputerMenu.js#L1713-L1736), [normalizeRootTilesSize()](../../src/ui/supercomputerMenu.js#L1002-L1019), [refreshRootTilesLayout()](../../src/ui/supercomputerMenu.js#L1020-L1025).
- Таблицы modifiers modal → [ensureGunsPanelUI()](../../src/ui/supercomputerMenu.js#L1044-L1132), [renderGunsPanel()](../../src/ui/supercomputerMenu.js#L1134-L1256), [ensureDronsPanelUI()](../../src/ui/supercomputerMenu.js#L1258-L1347), [renderDronsPanel()](../../src/ui/supercomputerMenu.js#L1349-L1480), [ensureWallsPanelUI()](../../src/ui/supercomputerMenu.js#L1482-L1570), [renderWallsPanel()](../../src/ui/supercomputerMenu.js#L1572-L1708).
- Вход в tank/drone/wall mods → [showTankWallMods()](../../src/ui/supercomputerMenu.js#L1753-L1769).

## Инварианты этого модуля ⚠️
- Scroll-lock модалок суперкомпьютера централизован в `setBodyScrollLock()`: [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L362-L367), [style.css](../../style.css#L1195-L1204).
- Shared help modal shell (`showSharedHelpModal` / `hideSharedHelpModal` / `syncSharedHelpButtonCopy`) — это public SC-family contract, а не talents-only helper: его переиспользуют talents shell, tank-wall help, underground hangar и production storage help, поэтому copy/DOM shell и accordion-toggle нельзя разносить по отдельным модалкам. См. [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L52-L185), export в [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L2182-L2184), consumer в [src/ui/productionLineUI.js](../../src/ui/productionLineUI.js#L134-L153).
- Закрытие shared help и root/tank-wall overlay должно оставаться focus-safe: перед `setOverlayOpen(false)` runtime обязан вычислить внешний target через `resolveOverlayHideFocusTarget()` и увести фокус наружу через `moveFocusOutsideOverlay()`, иначе после hide activeElement может остаться внутри скрытого shell'а. Этот путь обязателен и для shared help modal, и для остальных SC-family overlay routes: [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L143-L149), [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L219-L260).
- `shouldUseFullscreenShell()` — canonical gate для SC-family fullscreen shell under coarse-pointer / `< 1280px`; именно этот runtime ставит `levelModal--fullscreenShell`, `scModal--fullscreenShell` и `talentTreeModal--fullscreenShell` только для talents/hangar/tank-wall, а CSS уже реализует scroll/size contract. Для talents deliberate outer `scModal` / mount path держится в `overflow:hidden`, а реальный scroll живёт в `#supercomputerTalentsView` / `.talentTreeBody`; production storage сюда не входит и остаётся на отдельном centered bounded shell path. Не дублировать локальные mobile решения на уровнях отдельных overlays: [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L422-L469), [style.css](../../style.css#L7995-L8210).
- `applySharedTalentModalClass()` обязан держать shared right-side header-actions contract для talents shell: wrapper `#supercomputerTalentsHeaderActions` создаётся/реиспользуется как `scModal__headerActions`, а видимые help/close контролы принадлежат именно этому wrapper'у через `ensureTalentsShellHelpButton()` и `ensureTalentsShellCloseButton()`. Embedded `.modalClose` сохраняется как skin/hit-area parity слой, но ownership user-visible controls остаётся у header row `help -> close`: [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L553-L636), [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L620-L690), [style.css](../../style.css#L2682-L2720).
- `applySharedTalentModalClass()` обязан навешивать на `talentOverlay` не только `.scModal`, но и `scModal__close` + `data-font-floor-ignore="true"` на `.modalClose`, чтобы крестик дерева улучшений был визуально и по hit-area идентичен supercomputer modal, даже когда реальный close ownership смещён в header-actions wrapper: [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L620-L690), [style.css](../../style.css#L1863-L1957).
- Pending upgrade state живёт только пока открыт контроллер, но теперь он строго per-stat: `pendingUpgradesByLevel`, `pendingDronUpgradesByLevel`, `pendingFenceUpgradesByLevel` нормализуются как массивы entry-object'ов по `CANNON_STAT_KEYS` / `DRON_STAT_KEYS` / `FENCE_STAT_KEYS`, а `expandedTankWallRows` хранит ровно одну раскрытую строку на таб. Это не flat pending-counter на уровень: [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L319-L339), [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L578-L739), [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L781-L839).
- Summary row в weapons/drones/walls остаётся read-only preview, а реальное изменение pending идёт только через detail cards `scGunsStatControl`; row-level `Upgrade` и per-card `Apply` коммитят один и тот же pending batch строки через `applyPendingStats(...)`, не меняя ownership apply-логики. Для viewports `< 1200px` row-level `Upgrade` уезжает в нижнюю центрированную action lane строки, header action-cell скрывается, а сама CTA ограничена `width:min(100%, 220px)`, чтобы кнопка не клипалась. Tutorial-target для первого damage-step поэтому по-прежнему должен целиться в `data-guns-action="toggle"`, а не в plus/minus/apply: [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L796-L839), [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L1044-L1708), [style.css](../../style.css#L2872-L3085), [src/config/tutorialSteps.js](../../src/config/tutorialSteps.js#L249-L279).
- Canonical owner/source-of-truth для per-stat cost growth не живёт в DOM: `src/config/tankWallStatCatalog.js` держит stat-key order, action attrs и selector contract; base per-stat costs приходят из `assets/tanks.json`, `assets/dron.json`, `assets/fence.json`, а `game.js` через `load*StatUpgradeCosts()`, `get*UpgradeCostBase()` и `getProgressiveUpgradeStepCost(baseCost, appliedIndex)` считает прогрессивный шаг `ceil(base * 1.2^appliedIndex)`. `src/ui/supercomputerMenu.js` только читает `get*UpgradeStepCost()` и рендерит affordances: [src/config/tankWallStatCatalog.js](../../src/config/tankWallStatCatalog.js), [game.js](../../game.js#L734-L845), [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L578-L839).
- Root routing keeps `rootOverlay` owner for embedded talents view: `showTalents()` оставляет root overlay открытым, переключает root panel в `scModal--talentsView` и отдаёт фактический tree-shell в `openTalents({ embedded:true, skipSupercomputerRouting:true })`; закрытие/возврат всегда идут через `backFromChild()` / `closeAll()`, а не через отдельный overlay-state: [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L420-L457), [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L1640-L1685).
- Размер root tiles и icon scale приходят из `LayoutTuning` в CSS variables, а root-view обязан заново применять эти vars и uniform-height на глобальном `resize` через `refreshRootTilesLayout()`; refresh не должен затрагивать дочерние overlay, пока контроллер не в `view === 'root'`: [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L368-L385), [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L908-L911), [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L1737-L1737), [style.css](../../style.css#L1-L37), [style.css](../../style.css#L1771-L1833).

## Оглавление файла

### Блок: controller bootstrap
| Функция / блок | Строки | Назначение |
|---|---|---|
| `setOverlayOpen()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L249-L260) | Унифицированное open/close поведение overlay; close-path предполагает focus-safe handoff через `resolveOverlayHideFocusTarget()` / `moveFocusOutsideOverlay()` |
| `ensureSharedHelpModal()`, `showSharedHelpModal()`, `syncSharedHelpButtonCopy()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L121-L185) | Общий SC-style help dialog, accordion sections и tooltip/a11y copy для talents / tank-wall / underground hangar / production storage |
| `createController()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L200-L339) | Сборка зависимостей, DOM refs и per-tab local state |
| `shouldUseFullscreenShell()`, `syncResponsiveShellState()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L422-L469) | Канонический responsive/fullscreen routing для talents / hangar / tank-wall overlays |
| `setBodyScrollLock()`, `applyLayoutTuningVars()`, `applySharedTalentModalClass()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L479-L503), [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L620-L690) | Body-lock, CSS vars, shared modal class и talents header-action ownership |

### Блок: tab state + pending counters
| Функция / блок | Строки | Назначение |
|---|---|---|
| `setTankWallTab()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L490-L523) | Переключение `weapons/drones/walls` и tab-local redraw |
| `updateDamagePointsLabel()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L525-L550) | Общие labels damage points / reserve |
| Pending/reserve helpers | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L578-L739) | Нормализация size, per-stat cost sum и reserved points для оружий/дронов/стен |
| `formatAppliedPendingSummary()`, `getExpandedRow()`, `setExpandedRow()`, `buildStatControlHtml()`, `applyPendingStats()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L755-L839) | Expand/collapse rows, stat-control cards и commit pending per-stat upgrades |

### Блок: sprite-preview / root tiles
| Функция / блок | Строки | Назначение |
|---|---|---|
| `getSpriteImageForSrc()`, `drawGunsSpriteCanvas()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L857-L923) | Canvas-preview оружия/дронов/стен |
| `tickGunsIconSprites()`, `startGunsIconTicker()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L925-L1001) | Shared ticker для icon-animations |
| `normalizeRootTilesSize()`, `refreshRootTilesLayout()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L1002-L1025) | Нормализация высоты root cards и scale-aware refresh на resize |
| `getTankLevelViewData()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L1026-L1042) | View-model строки оружия |

### Блок: таблицы апгрейдов
| Функция / блок | Строки | Назначение |
|---|---|---|
| `ensureGunsPanelUI()`, `renderGunsPanel()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L1044-L1256) | Таблица `Орудия`: summary row + expandable per-stat controls для `attackSpeed/baseDamage` |
| `ensureDronsPanelUI()`, `renderDronsPanel()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L1258-L1480) | Таблица `Дроны`: shared expand/apply contract для `moveSpeedPxSec/repairSpeedMult/costMult` |
| `ensureWallsPanelUI()`, `renderWallsPanel()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L1482-L1708) | Таблица `Стены`: expandable `segmentMaxHp/armorFlat`, preview frame lookup из `assets/fence.json` |

### Блок: modal routing
| Функция / блок | Строки | Назначение |
|---|---|---|
| `updateFenceStatsUI()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L1709-L1711) | Refresh root stats |
| `openRoot()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L1713-L1736) | Открывает root overlay |
| `showHangarMods()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L1738-L1751) | Делегирует в `Game.HangarChipsUI` |
| `showTankWallMods()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L1753-L1769) | Открывает overlay техники/стен и готовит все три таблицы |
| `showTalents()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L1776-L1795) | Переход в embedded talents overlay |
| `backFromChild()`, `closeAll()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L1797-L1850) | Возврат/полное закрытие контроллера |

## Hotspots
- [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L52-L185) — shared help modal, accordion toggle и public help-shell contract.
- [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L422-L469) — fullscreen shell routing для coarse-pointer / `< 1280px`.
- [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L553-L690) — talents header-action ownership, shared modal class и help/close order.
- [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L578-L839) — per-stat pending/reserved/apply helpers и expanded row state.
- [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L1002-L1025) — геометрия root tiles и resize-safe refresh.
- [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L1044-L1708) — weapons/drones/walls tables, expandable controls и preview/icon lookup.
- [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L1753-L1850) — open/close routing.

## Зависимости
- Использует: `LayoutTuning`, `Game.HangarChipsUI`, `Game.NumberFormat`, upgrade getter/apply callbacks из `game.js`.
- Используется из: `game.js` через `ensureSupercomputerMenuController()`.

## Известные ограничения / TODO
- Root и table layout опираются на CSS-монолит [STYLE_CSS_MAP.md](STYLE_CSS_MAP.md); expandable stat cards, detail rows и footer action wrappers документированы там же.
- Внутренние DOM id панелей (`modsTankWallPanel*`) не задокументированы отдельно вне этого map.
