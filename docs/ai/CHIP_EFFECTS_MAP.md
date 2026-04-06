# chipEffects.js — карта файла

> Агент-ориентировано. Обновлён: 2026-04-06.
> Большой gameplay-runtime (~1385 строк) для боевых чип-модификаторов.

## Что это
`src/mechanics/chipEffects.js` — runtime-пайплайн модификаторов ангарных чипов. Файл преобразует active modifiers ячейки в `shotMods`, управляет каскадными снарядами, impact-эффектами, decal/runtime DOT и временными сущностями (электроузлы, лазерные метки).

## Быстрый старт для агента
- Shot pipeline → [applyShotModifiers()](../../src/mechanics/chipEffects.js#L534-L638).
- Cascade spawn rules → [_findCascadeTargets()](../../src/mechanics/chipEffects.js#L639-L699), [_spawnCascadeProjectiles()](../../src/mechanics/chipEffects.js#L719-L875).
- Impact-side эффекты → [applyImpactEffects()](../../src/mechanics/chipEffects.js#L876-L1261).
- Runtime ticks / cleanup → [stepChipEffects()](../../src/mechanics/chipEffects.js#L1262-L1356), [reset()](../../src/mechanics/chipEffects.js#L1357-L1385).

## Инварианты этого модуля ⚠️
- Порядок срабатывания модификаторов приходит извне (`order` из hangar chips runtime); `chipEffects.js` не должен переизобретать source-order.
- Жёлтые моды (`pendingYellowMods`) срабатывают только после финального cascade-step: [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js#L719-L875).
- Для lingering mods `10..14` `effect.enabled` отключает только fallback code visual. `applyImpactEffects()` всё равно создаёт gameplay-объект и сохраняет `effectSprite`; `game.js` читает `codeVisualEnabled` на decal/node/mark render, а не пропускает сам gameplay path: [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js#L876-L1015), [../../game.js](../../game.js#L8799-L8812), [../../game.js](../../game.js#L14151-L14186).
- Runtime-сущности (`_electroNodes`, `_laserMarks`, combo/nuke cooldowns) обязаны сбрасываться через `reset()` на world reset: [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js#L1357-L1385).

## Оглавление файла
| Функция / блок | Строки | Назначение |
|---|---|---|
| `getModEffectConfig()`, `getChipsCfg()`, `getModCfg()` | [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js#L110-L148) | Доступ к data-конфигу модификаторов и effect-config |
| `getActiveChipMods()`, `hasChipMod()`, `getActiveModIds()` | [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js#L290-L319) | Читает active modifiers ячейки |
| `_buildEmptyResult()` | [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js#L320-L355) | Базовый `shotMods` объект |
| `_applyModToResult()` | [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js#L356-L533) | Применение одного modId к `shotMods` |
| `applyShotModifiers()` | [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js#L534-L638) | Shot-time pipeline, split `pendingCascadeMods`/`pendingYellowMods` |
| `_findCascadeTargets()` | [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js#L639-L699) | Поиск целей каскадных снарядов |
| `_getCascadeProjectileCount()` | [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js#L700-L718) | Сколько child projectile спавнить для modId |
| `_spawnCascadeProjectiles()` | [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js#L719-L875) | Реальный спавн cascade-child projectile |
| `applyImpactEffects()` | [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js#L876-L1013) | Entry point impact-side эффектов; lingering mods `10..14` всегда создают gameplay state |
| `_applyChainJumps()`, `_spawnMatryoshkaChild()` | [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js#L1014-L1157) | Chain / matryoshka child-runtime |
| `_applyPushPull()`, `_applyVacuum()`, `_applyCalming()` | [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js#L1158-L1261) | AoE displacement / calming |
| `stepChipEffects()` + `checkLaserMarkBoost()` | [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js#L1262-L1334) | Электроузлы, лазерные метки и consume-path |
| `stepChipDecal()` | [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js#L1335-L1356) | Tick DOT/slow decals |
| `reset()`, `getElectroNodes()`, `getLaserMarks()` | [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js#L1357-L1385) | Сброс и debug/introspection |

## Зависимости
- Использует: `assets/chips.json`, active modifiers из `HangarChips`.
- Используется в: `game.js` (`fireTankProjectile`, `impactAt`, `stepDecals`, `drawDecals`); lingering visual gate дополнительно зависит от `addDecal()` / `drawDecals()` render-contract: [../../game.js](../../game.js#L8799-L8812), [../../game.js](../../game.js#L14151-L14186).

## Известные ограничения / TODO
- В этом map не перечислены все 30 modId поштучно; семантика модов описана в [SYSTEMS/combat.md](SYSTEMS/combat.md).
