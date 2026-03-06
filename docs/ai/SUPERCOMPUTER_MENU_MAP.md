# supercomputerMenu.js — карта файла

> Агент-ориентировано. Обновлён: 2026-03-06.
> Файл большой (1468 строк): перед правками модалок суперкомпьютера открой этот map.

## Что это
`src/ui/supercomputerMenu.js` — контроллер трёх связанных overlay: root supercomputer menu, hangar mods и tank/wall mods. Здесь живут scroll-lock, root tiles, таблицы апгрейдов оружия/дронов/стен и маршрутизация между дочерними окнами.

## Быстрый старт для агента
- Root-плитки и общая геометрия → [openRoot()](../../src/ui/supercomputerMenu.js#L1322-L1343), [normalizeRootTilesSize()](../../src/ui/supercomputerMenu.js#L628-L645).
- Таблица оружий → [renderGunsPanel()](../../src/ui/supercomputerMenu.js#L760-L861).
- Таблица стен → [renderWallsPanel()](../../src/ui/supercomputerMenu.js#L1176-L1318).
- Вход в ангарные моды → [showHangarMods()](../../src/ui/supercomputerMenu.js#L1344-L1357).

## Инварианты этого модуля ⚠️
- Scroll-lock модалок суперкомпьютера централизован в `setBodyScrollLock()`: [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L169-L173), [style.css](../../style.css#L1195-L1204).
- Pending upgrade state (`pendingUpgradesByLevel`, `pendingDronUpgradesByLevel`, `pendingFenceUpgradesByLevel`) живёт только пока открыт контроллер: [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L124-L167), [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L1322-L1394).
- Размер root tiles и icon scale приходят из `LayoutTuning` в CSS variables: [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L175-L191), [style.css](../../style.css#L1528-L1574).

## Оглавление файла

### Блок: controller bootstrap
| Функция / блок | Строки | Назначение |
|---|---|---|
| `setOverlayOpen()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L6-L16) | Унифицированное open/close поведение overlay |
| `createController()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L18-L168) | Сборка зависимостей, DOM refs, локального state |
| `setBodyScrollLock()`, `applyLayoutTuningVars()`, `applySharedTalentModalClass()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L169-L200) | Body-lock, CSS vars, shared modal class |

### Блок: tab state + pending counters
| Функция / блок | Строки | Назначение |
|---|---|---|
| `setTankWallTab()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L201-L234) | Переключение `weapons/drones/walls` |
| `updateDamagePointsLabel()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L236-L260) | Общие labels damage points / reserve |
| Pending/reserve helpers | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L262-L474) | Подсчёт уровней, pending cost, reserved points для оружий/дронов/стен |

### Блок: sprite-preview / root tiles
| Функция / блок | Строки | Назначение |
|---|---|---|
| `getSpriteImageForSrc()`, `drawGunsSpriteCanvas()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L483-L550) | Canvas-preview оружия/дронов/стен |
| `tickGunsIconSprites()`, `startGunsIconTicker()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L551-L617) | Shared ticker для icon-animations |
| `normalizeRootTilesSize()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L628-L645) | Нормализация высоты root cards |
| `getTankLevelViewData()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L646-L663) | View-model строки оружия |

### Блок: таблицы апгрейдов
| Функция / блок | Строки | Назначение |
|---|---|---|
| `ensureGunsPanelUI()`, `renderGunsPanel()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L664-L861) | Таблица `Орудия` |
| `ensureDronsPanelUI()`, `renderDronsPanel()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L862-L1079) | Таблица `Дроны` |
| `ensureWallsPanelUI()`, `renderWallsPanel()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L1080-L1318) | Таблица `Стены`, preview frame lookup из `assets/fence.json` |

### Блок: modal routing
| Функция / блок | Строки | Назначение |
|---|---|---|
| `updateFenceStatsUI()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L1318-L1321) | Refresh root stats |
| `openRoot()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L1322-L1343) | Открывает root overlay |
| `showHangarMods()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L1344-L1357) | Делегирует в `Game.HangarChipsUI` |
| `showTankWallMods()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L1358-L1378) | Открывает таблицы tank/wall mods |
| `showTalents()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L1379-L1387) | Переход в talents overlay |
| `backFromChild()`, `closeAll()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L1388-L1468) | Возврат/полное закрытие контроллера |

## Hotspots
- [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L628-L645) — геометрия root tiles.
- [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L760-L861) — оружейная таблица.
- [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L1176-L1318) — стены, preview icon lookup.
- [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L1322-L1468) — open/close routing.

## Зависимости
- Использует: `LayoutTuning`, `Game.HangarChipsUI`, `Game.NumberFormat`, upgrade getter/apply callbacks из `game.js`.
- Используется из: `game.js` через `ensureSupercomputerMenuController()`.

## Известные ограничения / TODO
- Root и table layout опираются на CSS-монолит [STYLE_CSS_MAP.md](STYLE_CSS_MAP.md); без него читать правки неудобно.
- Внутренние DOM id панелей (`modsTankWallPanel*`) не задокументированы отдельно вне этого map.
