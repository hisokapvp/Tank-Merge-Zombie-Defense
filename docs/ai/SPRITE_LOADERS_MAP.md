# spriteLoaders.js — карта файла

> Агент-ориентировано. Обновлён: 2026-03-23.
> Файл большой (1350 строк); этот map покрывает реально прочитанные и grep-проверенные блоки.

## Что это
`src/render/spriteLoaders.js` — единая точка нормализации JSON-спрайтов и загрузки atlas image для gameplay/render runtime. Здесь данные превращаются в безопасные runtime-конфиги для зомби, танков, суперкомпьютера, дронов, бонусов и пуль.

## Быстрый старт для агента
- Нужен контракт `assets/supercomputer.json` → [normalizeAnimationClip()](../../src/render/spriteLoaders.js#L45-L80), [normalizeSupercomputerPart()](../../src/render/spriteLoaders.js#L83-L116), [normalizeSupercomputerBoxPart()](../../src/render/spriteLoaders.js#L118-L145), [SupercomputerSprites.load()](../../src/render/spriteLoaders.js#L853-L994).
- Нужны alias `storage` → `storageCell` и `box` → `conveyorBox` → [getAnimation()](../../src/render/spriteLoaders.js#L995-L1016), [getPartConfig()](../../src/render/spriteLoaders.js#L1025-L1030).
- Нужен spawn/corpse/explicit `Health` contract зомби → [ZombieSprites.load()](../../src/render/spriteLoaders.js#L179-L346).

## Инварианты этого модуля ⚠️
- Все runtime-конфиги проходят через normalizer'ы этого файла; render code не должен парсить raw JSON заново.
- `ZombieSprites.load()` — canonical normalizer для `assets/zombies.json`: он приводит top-level `spawn.*`, corpse timing и per-type `Health/health` к безопасному runtime shape; downstream gameplay должен читать `ZombieSprites.spawnConfig` и `type.health`, а не raw JSON: [src/render/spriteLoaders.js](../../src/render/spriteLoaders.js#L232-L305).
- Для суперкомпьютера legacy `storage` остаётся допустимым alias для `storageCell`, а `box` — для `conveyorBox`: [src/render/spriteLoaders.js](../../src/render/spriteLoaders.js#L903-L928), [src/render/spriteLoaders.js](../../src/render/spriteLoaders.js#L995-L1030).
- `conveyorBox` нормализует две стадии печати `printLow` / `printHigh` и понимает legacy alias-имена (`buildLow`, `buildHigh`, `under50`, `over50`, `lessThanHalf`, `moreThanHalf`): [src/render/spriteLoaders.js](../../src/render/spriteLoaders.js#L118-L145).
- Если atlas части совпадает с главным atlas, loader переиспользует одно и то же `Image`, не создавая дубль: [src/render/spriteLoaders.js](../../src/render/spriteLoaders.js#L914-L928).

## Оглавление файла

### Блок: shared normalizers
| Функция / блок | Строки | Назначение |
|---|---|---|
| `loadImage()` | [src/render/spriteLoaders.js](../../src/render/spriteLoaders.js#L4-L11) | Promise-обёртка для image load |
| `createSpriteLoaders()` | [src/render/spriteLoaders.js](../../src/render/spriteLoaders.js#L13-L1350) | Фабрика всех loader-объектов |
| `toPositiveNumber()`, `clamp01()` | [src/render/spriteLoaders.js](../../src/render/spriteLoaders.js#L18-L27) | Базовые sanitizers |
| `normalizeAnimConfig()`, `normalizeAttackConfig()` | [src/render/spriteLoaders.js](../../src/render/spriteLoaders.js#L29-L43) | Нормализация simple config blocks |
| `normalizeAnimationClip()` | [src/render/spriteLoaders.js](../../src/render/spriteLoaders.js#L45-L80) | Clip + `scale` + `effects[]` для supercomputer/runtime sprites |
| `normalizeSupercomputerPart()` | [src/render/spriteLoaders.js](../../src/render/spriteLoaders.js#L83-L116) | Нормализация `conveyor` / `storageCell` part config |
| `normalizeSupercomputerBoxPart()` | [src/render/spriteLoaders.js](../../src/render/spriteLoaders.js#L118-L145) | Нормализация `conveyorBox` с двухстадийной печатью |
| `collectAnimationFrameIds()`, `parseTankLevelKey()`, `normalizeSpriteBlock()` | [src/render/spriteLoaders.js](../../src/render/spriteLoaders.js#L147-L177) | Frame-id recovery и normalizer sprite blocks |

### Блок: ZombieSprites (прочитан)
| Функция / блок | Строки | Назначение |
|---|---|---|
| `ZombieSprites.load()` | [src/render/spriteLoaders.js](../../src/render/spriteLoaders.js#L179-L346) | Читает `assets/zombies.json`, normalizes `deathCommon`, `spawn`, corpse timing и per-type `Health/health -> health` |

### Блок: SupercomputerSprites (подробно прочитан)
| Функция / блок | Строки | Назначение |
|---|---|---|
| `SupercomputerSprites.load()` | [src/render/spriteLoaders.js](../../src/render/spriteLoaders.js#L853-L994) | Загружает root atlas, part atlases, hpBar, glitch, `animations.*`, `conveyor`, `conveyorBox`, `storageCell` |
| `getAnimation()` | [src/render/spriteLoaders.js](../../src/render/spriteLoaders.js#L995-L1016) | Возвращает clip для root/conveyor/box/storage |
| `getAtlasImage()` | [src/render/spriteLoaders.js](../../src/render/spriteLoaders.js#L1018-L1023) | Отдаёт конкретный atlas image по части |
| `getPartConfig()` | [src/render/spriteLoaders.js](../../src/render/spriteLoaders.js#L1025-L1030) | Отдаёт normalized config части |

### Блок: хвост файла (исследован только по line-start)
| Блок | Строки | Статус |
|---|---|---|
| Внутренние normalizer'ы frame-list animation | [src/render/spriteLoaders.js](../../src/render/spriteLoaders.js#L1032-L1208) | line-start'ы проверены grep'ом, детали перечитывать перед точечной правкой |
| Финальные loader-экспорты (`getAnimation(name)` для других atlas-driven loaders) | [src/render/spriteLoaders.js](../../src/render/spriteLoaders.js#L1209-L1350) | частично исследовано, открыть при правке бонусов/пуль/дронов |

## Hotspots
- [src/render/spriteLoaders.js](../../src/render/spriteLoaders.js#L232-L305) — zombie spawn config, corpse timing и explicit `Health` normalizer.
- [src/render/spriteLoaders.js](../../src/render/spriteLoaders.js#L45-L145) — все новые animation contracts проходят здесь.
- [src/render/spriteLoaders.js](../../src/render/spriteLoaders.js#L853-L1030) — суперкомпьютер, production line, `conveyorBox`, per-state effects.

## Зависимости
- Использует: `assets/zombies.json`, `assets/supercomputer.json` и другие sprite JSON.
- Используется в: `game.js`, `src/render/productionLineRender.js`, `src/ui/supercomputerMenu.js`.

## Известные ограничения / TODO
- Средняя часть файла (`TankSprites`, `FenceSprites`, `DronSprites`, `BulletSprites`) не размечена столь же подробно; при точечной задаче дочитать целевой loader.
