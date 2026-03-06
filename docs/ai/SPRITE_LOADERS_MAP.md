# spriteLoaders.js — карта файла

> Агент-ориентировано. Обновлён: 2026-03-06.
> Файл большой (1289 строк); этот map покрывает реально прочитанные и grep-проверенные блоки.

## Что это
`src/render/spriteLoaders.js` — единая точка нормализации JSON-спрайтов и загрузки atlas image для gameplay/render runtime. Здесь данные превращаются в безопасные runtime-конфиги для зомби, танков, суперкомпьютера, дронов, бонусов и пуль.

## Быстрый старт для агента
- Нужен контракт `assets/supercomputer.json` → [normalizeAnimationClip()](../../src/render/spriteLoaders.js#L45-L80), [SupercomputerSprites.load()](../../src/render/spriteLoaders.js#L823-L943).
- Нужен alias `storage` → `storageCell` → [normalizeSupercomputerPart()](../../src/render/spriteLoaders.js#L83-L116), [getPartConfig()](../../src/render/spriteLoaders.js#L965-L969).
- Нужен corpse/death config зомби → [ZombieSprites.load()](../../src/render/spriteLoaders.js#L179-L320).

## Инварианты этого модуля ⚠️
- Все runtime-конфиги проходят через normalizer'ы этого файла; render code не должен парсить raw JSON заново.
- Для суперкомпьютера legacy `storage` остаётся допустимым alias для `storageCell`: [src/render/spriteLoaders.js](../../src/render/spriteLoaders.js#L861-L879), [src/render/spriteLoaders.js](../../src/render/spriteLoaders.js#L951-L968).
- Если atlas части совпадает с главным atlas, loader переиспользует одно и то же `Image`, не создавая дубль: [src/render/spriteLoaders.js](../../src/render/spriteLoaders.js#L873-L879).

## Оглавление файла

### Блок: shared normalizers
| Функция / блок | Строки | Назначение |
|---|---|---|
| `loadImage()` | [src/render/spriteLoaders.js](../../src/render/spriteLoaders.js#L4-L11) | Promise-обёртка для image load |
| `createSpriteLoaders()` | [src/render/spriteLoaders.js](../../src/render/spriteLoaders.js#L13-L1289) | Фабрика всех loader-объектов |
| `toPositiveNumber()`, `clamp01()` | [src/render/spriteLoaders.js](../../src/render/spriteLoaders.js#L18-L27) | Базовые sanitizers |
| `normalizeAnimConfig()`, `normalizeAttackConfig()` | [src/render/spriteLoaders.js](../../src/render/spriteLoaders.js#L29-L43) | Нормализация simple config blocks |
| `normalizeAnimationClip()` | [src/render/spriteLoaders.js](../../src/render/spriteLoaders.js#L45-L80) | Clip + `scale` + `effects[]` для supercomputer/runtime sprites |
| `normalizeSupercomputerPart()` | [src/render/spriteLoaders.js](../../src/render/spriteLoaders.js#L83-L116) | Нормализация `conveyor` / `storageCell` part config |
| `collectAnimationFrameIds()`, `parseTankLevelKey()`, `normalizeSpriteBlock()` | [src/render/spriteLoaders.js](../../src/render/spriteLoaders.js#L118-L177) | Frame-id recovery и normalizer sprite blocks |

### Блок: ZombieSprites (прочитан)
| Функция / блок | Строки | Назначение |
|---|---|---|
| `ZombieSprites.load()` | [src/render/spriteLoaders.js](../../src/render/spriteLoaders.js#L179-L320) | Читает `assets/zombies.json`, normalizes deathCommon, spawn, corpse timing |

### Блок: SupercomputerSprites (подробно прочитан)
| Функция / блок | Строки | Назначение |
|---|---|---|
| `SupercomputerSprites.load()` | [src/render/spriteLoaders.js](../../src/render/spriteLoaders.js#L823-L943) | Загружает root atlas, part atlases, hpBar, glitch, `animations.*`, `conveyor`, `storageCell` |
| `getAnimation()` | [src/render/spriteLoaders.js](../../src/render/spriteLoaders.js#L944-L957) | Возвращает clip для root/conveyor/storage |
| `getAtlasImage()` | [src/render/spriteLoaders.js](../../src/render/spriteLoaders.js#L959-L963) | Отдаёт конкретный atlas image по части |
| `getPartConfig()` | [src/render/spriteLoaders.js](../../src/render/spriteLoaders.js#L965-L969) | Отдаёт normalized config части |

### Блок: хвост файла (исследован только по line-start)
| Блок | Строки | Статус |
|---|---|---|
| Внутренние normalizer'ы frame-list animation | [src/render/spriteLoaders.js](../../src/render/spriteLoaders.js#L989-L1208) | line-start'ы проверены grep'ом, детали перечитывать перед точечной правкой |
| Финальные loader-экспорты (`getAnimation(name)` для других atlas-driven loaders) | [src/render/spriteLoaders.js](../../src/render/spriteLoaders.js#L1166-L1289) | частично исследовано, открыть при правке бонусов/пуль/дронов |

## Hotspots
- [src/render/spriteLoaders.js](../../src/render/spriteLoaders.js#L45-L116) — все новые animation contracts проходят здесь.
- [src/render/spriteLoaders.js](../../src/render/spriteLoaders.js#L823-L969) — суперкомпьютер, production line, per-state effects.

## Зависимости
- Использует: `assets/zombies.json`, `assets/supercomputer.json` и другие sprite JSON.
- Используется в: `game.js`, `src/render/productionLineRender.js`, `src/ui/supercomputerMenu.js`.

## Известные ограничения / TODO
- Средняя часть файла (`TankSprites`, `FenceSprites`, `DronSprites`, `BulletSprites`) не размечена столь же подробно; при точечной задаче дочитать целевой loader.
