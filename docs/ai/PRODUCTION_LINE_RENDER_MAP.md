# productionLineRender.js — карта файла

> Агент-ориентировано. Обновлён: 2026-03-06.
> Файл большой (551 строка): сначала открой этот map, потом исходник.

## Что это
`src/render/productionLineRender.js` — renderer production line рядом с суперкомпьютером. Здесь живут layout conveyor/storage, двухстадийная печать коробки, bottom-up reveal, hover-hitbox склада и векторные fallback'и на случай отсутствия atlas-конфига.

## Быстрый старт для агента
- Нужен layout относительно суперкомпьютера → [updateLayout()](../../src/render/productionLineRender.js#L230-L258).
- Нужна синхронизация runtime-state conveyor/box → [syncState()](../../src/render/productionLineRender.js#L265-L311).
- Нужна логика bottom-up печати коробки → [drawSpriteClip()](../../src/render/productionLineRender.js#L329-L375), [drawBoxOnConveyor()](../../src/render/productionLineRender.js#L417-L444).
- Нужен hover/click склада → [drawStorageCell()](../../src/render/productionLineRender.js#L462-L515), [hitTestStorage()](../../src/render/productionLineRender.js#L527-L531).

## Инварианты этого модуля ⚠️
- `work` для conveyor не перезапускается, пока активный цикл ещё идёт: [src/render/productionLineRender.js](../../src/render/productionLineRender.js#L219-L227), [src/render/productionLineRender.js](../../src/render/productionLineRender.js#L301-L306).
- Root-состояние `buildTank` приходит из механики production line, а не вычисляется самим renderer'ом: [src/mechanics/productionLine.js](../../src/mechanics/productionLine.js#L97-L154).
- Печать коробки всегда открывается снизу вверх через clip по прогрессу; это касается и sprite-atlas, и fallback box: [src/render/productionLineRender.js](../../src/render/productionLineRender.js#L329-L375), [src/render/productionLineRender.js](../../src/render/productionLineRender.js#L417-L444).
- Если atlas части недоступен, renderer обязан сохранить legacy geometry и vector fallback без runtime-crash: [src/render/productionLineRender.js](../../src/render/productionLineRender.js#L377-L515).

## Оглавление файла

### Блок: module state + part resolvers
| Функция / блок | Строки | Назначение |
|---|---|---|
| Module state / constants | [src/render/productionLineRender.js](../../src/render/productionLineRender.js#L4-L61) | Глобальный runtime-state, fallback colors, bounds |
| `getSpriteSource()`, `getPartConfig()`, `getPartAnimation()`, `getPartImage()` | [src/render/productionLineRender.js](../../src/render/productionLineRender.js#L63-L95) | Доступ к нормализованным part-config и atlas image |
| `getClipScale()`, `getClipDuration()`, `getFrameIndex()` | [src/render/productionLineRender.js](../../src/render/productionLineRender.js#L97-L118) | Базовая математика клипов |
| `fillPartBounds()`, `refreshBounds()`, `computeDisplaySignature()`, `getBoxStateName()` | [src/render/productionLineRender.js](../../src/render/productionLineRender.js#L120-L144) | Пересчёт bounds и выбор стадии печати |

### Блок: effect pipeline
| Функция / блок | Строки | Назначение |
|---|---|---|
| `resolveEffectEntry()`, `mergeEffectPreset()`, `buildEffectTransform()` | [src/render/productionLineRender.js](../../src/render/productionLineRender.js#L146-L217) | Применение `effects[]` из atlas-конфига частей |

### Блок: layout + state sync
| Функция / блок | Строки | Назначение |
|---|---|---|
| `triggerConveyorWork()` | [src/render/productionLineRender.js](../../src/render/productionLineRender.js#L219-L227) | Стартует полный цикл `work` без mid-cycle restart |
| `updateLayout()` | [src/render/productionLineRender.js](../../src/render/productionLineRender.js#L230-L258) | Позиционирует conveyor/storage по offsets или legacy fallback |
| `setSpriteSource()`, `setConveyorAtlas()`, `setBoxAtlas()`, `setStorageAtlas()` | [src/render/productionLineRender.js](../../src/render/productionLineRender.js#L260-L263) | Инъекция loader-runtime |
| `syncState()` | [src/render/productionLineRender.js](../../src/render/productionLineRender.js#L265-L311) | Синхронизация progress, conveyor work-cycle и box-state |
| `syncHoverAt()`, `clearHover()` | [src/render/productionLineRender.js](../../src/render/productionLineRender.js#L313-L327) | Hover-state storage cell |

### Блок: draw pipeline + fallback
| Функция / блок | Строки | Назначение |
|---|---|---|
| `drawSpriteClip()` | [src/render/productionLineRender.js](../../src/render/productionLineRender.js#L329-L375) | Общий draw sprite clip с `effects[]` и optional bottom-up reveal |
| `drawConveyor()`, `_drawConveyorFallback()` | [src/render/productionLineRender.js](../../src/render/productionLineRender.js#L377-L414) | Conveyor sprite/fallback belt |
| `drawBoxOnConveyor()`, `_drawBoxFallback()` | [src/render/productionLineRender.js](../../src/render/productionLineRender.js#L417-L460) | Двухстадийная печать коробки и fallback-ящик |
| `drawStorageCell()`, `_drawStorageOverlay()`, `_drawStorageFallback()` | [src/render/productionLineRender.js](../../src/render/productionLineRender.js#L462-L515) | Склад, badge количества и hover-state |

### Блок: entrypoints
| Функция / блок | Строки | Назначение |
|---|---|---|
| `draw()` | [src/render/productionLineRender.js](../../src/render/productionLineRender.js#L517-L524) | Рисует conveyor, box и storage по `state.productionLine` |
| `hitTestStorage()` | [src/render/productionLineRender.js](../../src/render/productionLineRender.js#L527-L531) | Canvas hit-test склада |
| Public API export | [src/render/productionLineRender.js](../../src/render/productionLineRender.js#L533-L551) | Экспорт `Game.ProductionLineRender` |

## Hotspots
- [src/render/productionLineRender.js](../../src/render/productionLineRender.js#L146-L375) — `effects[]`, reveal-clip и atlas-driven draw.
- [src/render/productionLineRender.js](../../src/render/productionLineRender.js#L417-L444) — двухстадийная печать коробки `printLow` / `printHigh`.
- [src/render/productionLineRender.js](../../src/render/productionLineRender.js#L462-L531) — storage hover, badge и hit-test.

## Зависимости
- Использует: `Game.SupercomputerSprites` через `setSpriteSource()`, `state.productionLine`, `assets/supercomputer.json`.
- Используется из: `game.js` (draw/layout wiring) и UI суперкомпьютера для hover/click склада.

## Известные ограничения / TODO
- Модуль не решает механику печати сам: прогресс и `buildTank` state приходят из `src/mechanics/productionLine.js`.
- Legacy setter'ы `setConveyorAtlas()` / `setBoxAtlas()` / `setStorageAtlas()` сохранены для совместимости, но canonical source теперь `setSpriteSource()`.