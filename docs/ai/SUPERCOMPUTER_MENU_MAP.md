# supercomputerMenu.js — карта файла

> Агент-ориентировано. Обновлён: 2026-03-07.
> Файл большой (1473 строки): перед правками модалок суперкомпьютера открой этот map.

## Что это
`src/ui/supercomputerMenu.js` — контроллер трёх связанных overlay: root supercomputer menu, hangar mods и tank/wall mods. Здесь живут scroll-lock, root tiles, таблицы апгрейдов оружия/дронов/стен и маршрутизация между дочерними окнами.

## Быстрый старт для агента
- Root-плитки и общая геометрия → [openRoot()](../../src/ui/supercomputerMenu.js#L1327-L1348), [normalizeRootTilesSize()](../../src/ui/supercomputerMenu.js#L633-L650).
- Таблица оружий → [renderGunsPanel()](../../src/ui/supercomputerMenu.js#L765-L866).
- Таблица стен → [renderWallsPanel()](../../src/ui/supercomputerMenu.js#L1181-L1321).
- Вход в ангарные моды → [showHangarMods()](../../src/ui/supercomputerMenu.js#L1349-L1362).

## Инварианты этого модуля ⚠️
- Scroll-lock модалок суперкомпьютера централизован в `setBodyScrollLock()`: [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L169-L173), [style.css](../../style.css#L1195-L1204).
- `applySharedTalentModalClass()` обязан навешивать на `talentOverlay` не только `.scModal`, но и `scModal__close` + `data-font-floor-ignore="true"` на `.modalClose`, чтобы крестик дерева улучшений был визуально и по hit-area идентичен supercomputer modal: [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L193-L203), [style.css](../../style.css#L1828-L1920).
- Pending upgrade state (`pendingUpgradesByLevel`, `pendingDronUpgradesByLevel`, `pendingFenceUpgradesByLevel`) живёт только пока открыт контроллер: [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L124-L167), [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L1327-L1408).
- Размер root tiles и icon scale приходят из `LayoutTuning` в CSS variables: [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L175-L191), [style.css](../../style.css#L1528-L1574).

## Оглавление файла

### Блок: controller bootstrap
| Функция / блок | Строки | Назначение |
|---|---|---|
| `setOverlayOpen()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L6-L16) | Унифицированное open/close поведение overlay |
| `createController()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L18-L168) | Сборка зависимостей, DOM refs, локального state |
| `setBodyScrollLock()`, `applyLayoutTuningVars()`, `applySharedTalentModalClass()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L169-L203) | Body-lock, CSS vars, shared modal class и talent close-skin |

### Блок: tab state + pending counters
| Функция / блок | Строки | Назначение |
|---|---|---|
| `setTankWallTab()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L206-L239) | Переключение `weapons/drones/walls` |
| `updateDamagePointsLabel()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L241-L265) | Общие labels damage points / reserve |
| Pending/reserve helpers | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L267-L479) | Подсчёт уровней, pending cost, reserved points для оружий/дронов/стен |

### Блок: sprite-preview / root tiles
| Функция / блок | Строки | Назначение |
|---|---|---|
| `getSpriteImageForSrc()`, `drawGunsSpriteCanvas()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L488-L553) | Canvas-preview оружия/дронов/стен |
| `tickGunsIconSprites()`, `startGunsIconTicker()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L556-L622) | Shared ticker для icon-animations |
| `normalizeRootTilesSize()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L633-L650) | Нормализация высоты root cards |
| `getTankLevelViewData()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L651-L668) | View-model строки оружия |

### Блок: таблицы апгрейдов
| Функция / блок | Строки | Назначение |
|---|---|---|
| `ensureGunsPanelUI()`, `renderGunsPanel()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L669-L866) | Таблица `Орудия` |
| `ensureDronsPanelUI()`, `renderDronsPanel()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L867-L1084) | Таблица `Дроны` |
| `ensureWallsPanelUI()`, `renderWallsPanel()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L1085-L1321) | Таблица `Стены`, preview frame lookup из `assets/fence.json` |

### Блок: modal routing
| Функция / блок | Строки | Назначение |
|---|---|---|
| `updateFenceStatsUI()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L1323-L1326) | Refresh root stats |
| `openRoot()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L1327-L1348) | Открывает root overlay |
| `showHangarMods()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L1349-L1362) | Делегирует в `Game.HangarChipsUI` |
| `showTankWallMods()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L1363-L1383) | Открывает таблицы tank/wall mods |
| `showTalents()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L1384-L1392) | Переход в talents overlay |
| `backFromChild()`, `closeAll()` | [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L1393-L1473) | Возврат/полное закрытие контроллера |

## Hotspots
- [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L193-L203) — shared talent modal class и close-skin tree overlay.
- [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L633-L650) — геометрия root tiles.
- [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L765-L866) — оружейная таблица.
- [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L1181-L1321) — стены, preview icon lookup.
- [src/ui/supercomputerMenu.js](../../src/ui/supercomputerMenu.js#L1327-L1473) — open/close routing.

## Зависимости
- Использует: `LayoutTuning`, `Game.HangarChipsUI`, `Game.NumberFormat`, upgrade getter/apply callbacks из `game.js`.
- Используется из: `game.js` через `ensureSupercomputerMenuController()`.

## Известные ограничения / TODO
- Root и table layout опираются на CSS-монолит [STYLE_CSS_MAP.md](STYLE_CSS_MAP.md); без него читать правки неудобно.
- Внутренние DOM id панелей (`modsTankWallPanel*`) не задокументированы отдельно вне этого map.
