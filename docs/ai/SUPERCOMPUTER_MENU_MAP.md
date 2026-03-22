# supercomputerMenu.js — карта файла

> Агент-ориентировано. Обновлён: 2026-03-22.
> Файл большой (1759 строк): перед правками модалок суперкомпьютера открой этот map.

## Что это
`src/ui/supercomputerMenu.js` — контроллер трёх связанных overlay: root supercomputer menu, hangar mods и tank/wall mods. Здесь живут scroll-lock, root tiles, таблицы апгрейдов оружия/дронов/стен и маршрутизация между дочерними окнами.

С начала файла также живёт shared help-shell API для SC-family overlays: общий `techModal__dialog--help` теперь открывается не только из talents/tank-wall flow, но и переиспользуется underground hangar и production storage modal; accordion-toggle для help sections тоже централизован здесь через `Game.SupercomputerMenu.showSharedHelpModal()` и `syncHelpButtonCopy()`.

## Быстрый старт для агента
- Shared help modal / accordion / help-button copy sync → [toggleSharedHelpSection()](../../src/ui/supercomputerMenu.js#L52-L60), [showSharedHelpModal()](../../src/ui/supercomputerMenu.js#L159-L185), [syncSharedHelpButtonCopy()](../../src/ui/supercomputerMenu.js#L150-L157), export в [global.Game.SupercomputerMenu](../../src/ui/supercomputerMenu.js#L1755-L1759).
- Root-плитки и общая геометрия → [openRoot()](../../src/ui/supercomputerMenu.js#L1581-L1602), [normalizeRootTilesSize()](../../src/ui/supercomputerMenu.js#L887-L922).
- Таблица оружий → [ensureGunsPanelUI()](../../src/ui/supercomputerMenu.js#L923-L1120).
- Таблица стен → [ensureWallsPanelUI()](../../src/ui/supercomputerMenu.js#L1339-L1579).
- Вход в ангарные моды → [showHangarMods()](../../src/ui/supercomputerMenu.js#L1604-L1617).

## Инварианты этого модуля ⚠️
- Scroll-lock модалок суперкомпьютера централизован в `setBodyScrollLock()`: [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L362-L367), [style.css](../../style.css#L1195-L1204).
- Shared help modal shell (`showSharedHelpModal` / `hideSharedHelpModal` / `syncSharedHelpButtonCopy`) — это public SC-family contract, а не talents-only helper: его переиспользуют talents shell, tank-wall help, underground hangar и production storage help, поэтому copy/DOM shell и accordion-toggle нельзя разносить по отдельным модалкам. См. [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L52-L185), export в [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L1755-L1759), consumer в [src/ui/productionLineUI.js](../../src/ui/productionLineUI.js#L90-L116).
- `applySharedTalentModalClass()` обязан навешивать на `talentOverlay` не только `.scModal`, но и `scModal__close` + `data-font-floor-ignore="true"` на `.modalClose`, чтобы крестик дерева улучшений был визуально и по hit-area идентичен supercomputer modal: [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L386-L407), [style.css](../../style.css#L1828-L1920).
- Pending upgrade state (`pendingUpgradesByLevel`, `pendingDronUpgradesByLevel`, `pendingFenceUpgradesByLevel`) живёт только пока открыт контроллер: [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L304-L360), [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L1581-L1685).
- Root routing keeps `rootOverlay` owner for embedded talents view: `showTalents()` оставляет root overlay открытым, переключает root panel в `scModal--talentsView` и отдаёт фактический tree-shell в `openTalents({ embedded:true, skipSupercomputerRouting:true })`; закрытие/возврат всегда идут через `backFromChild()` / `closeAll()`, а не через отдельный overlay-state: [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L420-L457), [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L1640-L1685).
- Размер root tiles и icon scale приходят из `LayoutTuning` в CSS variables: [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L368-L385), [style.css](../../style.css#L1528-L1574).

## Оглавление файла

### Блок: controller bootstrap
| Функция / блок | Строки | Назначение |
|---|---|---|
| `setOverlayOpen()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L187-L198) | Унифицированное open/close поведение overlay |
| `ensureSharedHelpModal()`, `showSharedHelpModal()`, `syncSharedHelpButtonCopy()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L109-L185) | Общий SC-style help dialog, accordion sections и tooltip/a11y copy для talents / tank-wall / underground hangar / production storage |
| `createController()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L200-L360) | Сборка зависимостей, DOM refs, локального state |
| `setBodyScrollLock()`, `applyLayoutTuningVars()`, `applySharedTalentModalClass()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L362-L407) | Body-lock, CSS vars, shared modal class и talent close-skin |

### Блок: tab state + pending counters
| Функция / блок | Строки | Назначение |
|---|---|---|
| `setTankWallTab()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L460-L493) | Переключение `weapons/drones/walls` |
| `updateDamagePointsLabel()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L495-L519) | Общие labels damage points / reserve |
| Pending/reserve helpers | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L521-L740) | Подсчёт уровней, pending cost, reserved points для оружий/дронов/стен |

### Блок: sprite-preview / root tiles
| Функция / блок | Строки | Назначение |
|---|---|---|
| `getSpriteImageForSrc()`, `drawGunsSpriteCanvas()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L742-L809) | Canvas-preview оружия/дронов/стен |
| `tickGunsIconSprites()`, `startGunsIconTicker()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L810-L876) | Shared ticker для icon-animations |
| `normalizeRootTilesSize()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L887-L922) | Нормализация высоты root cards |
| `getTankLevelViewData()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L905-L922) | View-model строки оружия |

### Блок: таблицы апгрейдов
| Функция / блок | Строки | Назначение |
|---|---|---|
| `ensureGunsPanelUI()`, `renderGunsPanel()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L923-L1120) | Таблица `Орудия` |
| `ensureDronsPanelUI()`, `renderDronsPanel()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L1121-L1338) | Таблица `Дроны` |
| `ensureWallsPanelUI()`, `renderWallsPanel()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L1339-L1579) | Таблица `Стены`, preview frame lookup из `assets/fence.json` |

### Блок: modal routing
| Функция / блок | Строки | Назначение |
|---|---|---|
| `updateFenceStatsUI()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L1577-L1579) | Refresh root stats |
| `openRoot()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L1581-L1602) | Открывает root overlay |
| `showHangarMods()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L1604-L1617) | Делегирует в `Game.HangarChipsUI` |
| `showTankWallMods()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L1618-L1638) | Открывает таблицы tank/wall mods |
| `showTalents()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L1640-L1659) | Переход в embedded talents overlay |
| `backFromChild()`, `closeAll()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L1661-L1732) | Возврат/полное закрытие контроллера |

## Hotspots
- [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L52-L185) — shared help modal, accordion toggle и public help-shell contract.
- [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L386-L407) — shared talent modal class и close-skin tree overlay.
- [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L887-L922) — геометрия root tiles.
- [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L923-L1120) — оружейная таблица.
- [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L1339-L1579) — стены, preview icon lookup.
- [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L1581-L1732) — open/close routing.

## Зависимости
- Использует: `LayoutTuning`, `Game.HangarChipsUI`, `Game.NumberFormat`, upgrade getter/apply callbacks из `game.js`.
- Используется из: `game.js` через `ensureSupercomputerMenuController()`.

## Известные ограничения / TODO
- Root и table layout опираются на CSS-монолит [STYLE_CSS_MAP.md](STYLE_CSS_MAP.md); без него читать правки неудобно.
- Внутренние DOM id панелей (`modsTankWallPanel*`) не задокументированы отдельно вне этого map.
