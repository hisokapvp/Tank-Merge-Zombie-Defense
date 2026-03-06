# chipEffects.js — карта файла

> Агент-ориентировано. Обновлён: 2026-03-06.
> Большой gameplay-runtime (1078 строк) для боевых чип-модификаторов.

## Что это
`src/mechanics/chipEffects.js` — runtime-пайплайн модификаторов ангарных чипов. Файл преобразует active modifiers ячейки в `shotMods`, управляет каскадными снарядами, impact-эффектами, decal/runtime DOT и временными сущностями (электроузлы, лазерные метки).

## Быстрый старт для агента
- Shot pipeline → [applyShotModifiers()](../../src/mechanics/chipEffects.js#L327-L431).
- Cascade spawn rules → [_findCascadeTargets()](../../src/mechanics/chipEffects.js#L432-L492), [_spawnCascadeProjectiles()](../../src/mechanics/chipEffects.js#L512-L668).
- Impact-side эффекты → [applyImpactEffects()](../../src/mechanics/chipEffects.js#L669-L1035).
- Runtime ticks / cleanup → [stepChipEffects()](../../src/mechanics/chipEffects.js#L1036-L1131), [reset()](../../src/mechanics/chipEffects.js#L1131-L1142).

## Инварианты этого модуля ⚠️
- Порядок срабатывания модификаторов приходит извне (`order` из hangar chips runtime); `chipEffects.js` не должен переизобретать source-order.
- Жёлтые моды (`pendingYellowMods`) срабатывают только после финального cascade-step: [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js#L512-L668).
- Runtime-сущности (`_electroNodes`, `_laserMarks`, combo/nuke cooldowns) обязаны сбрасываться через `reset()` на world reset: [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js#L1131-L1142).

## Оглавление файла
| Функция / блок | Строки | Назначение |
|---|---|---|
| `loadChipsCfg()`, `getChipsCfg()`, `getModCfg()` | [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js#L64-L66) | Доступ к data-конфигу модификаторов |
| `getActiveChipMods()`, `hasChipMod()`, `getActiveModIds()` | [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js#L83-L111) | Читает active modifiers ячейки |
| `_buildEmptyResult()` | [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js#L113-L148) | Базовый `shotMods` объект |
| `_applyModToResult()` | [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js#L149-L326) | Применение одного modId к `shotMods` |
| `applyShotModifiers()` | [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js#L327-L431) | Shot-time pipeline, split `pendingCascadeMods`/`pendingYellowMods` |
| `_findCascadeTargets()` | [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js#L432-L492) | Поиск целей каскадных снарядов |
| `_getCascadeProjectileCount()` | [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js#L493-L511) | Сколько child projectile спавнить для modId |
| `_spawnCascadeProjectiles()` | [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js#L512-L668) | Реальный спавн cascade-child projectile |
| `applyImpactEffects()` | [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js#L669-L787) | Entry point impact-side эффектов |
| `_applyChainJumps()`, `_spawnMatryoshkaChild()` | [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js#L788-L931) | Chain / matryoshka child-runtime |
| `_applyPushPull()`, `_applyVacuum()`, `_applyCalming()` | [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js#L932-L1035) | AoE displacement / calming |
| `stepChipEffects()` + internal tickers | [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js#L1036-L1087) | Электроузлы и лазерные метки |
| `checkLaserMarkBoost()` | [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js#L1087-L1108) | Проверка laser mark bonus |
| `stepChipDecal()` | [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js#L1109-L1130) | Tick DOT/slow decals |
| `reset()`, `getElectroNodes()`, `getLaserMarks()` | [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js#L1131-L1142) | Сброс и debug/introspection |

## Зависимости
- Использует: `assets/chips.json`, active modifiers из `HangarChips`.
- Используется в: `game.js` (`fireTankProjectile`, `impactAt`, step-пайплайн боя).

## Известные ограничения / TODO
- В этом map не перечислены все 30 modId поштучно; семантика модов описана в [SYSTEMS/combat.md](SYSTEMS/combat.md).
