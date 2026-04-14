# chipEffects.js — карта файла

> Агент-ориентировано. Обновлён: 2026-04-06.
> Большой gameplay-runtime (~1385 строк) для боевых чип-модификаторов.

## Что это
`src/mechanics/chipEffects.js` — runtime-пайплайн модификаторов ангарных чипов. Файл преобразует active modifiers ячейки в `shotMods`, управляет каскадными снарядами, impact-эффектами, decal/runtime DOT и временными сущностями (электроузлы, лазерные метки).

## Быстрый старт для агента
- Shot pipeline → [applyShotModifiers()](../../src/mechanics/chipEffects.js#L597-L701).
- Bullet/impact override merge → [mergeBulletCfgOverride()](../../src/mechanics/chipEffects.js#L271-L281).
- Cascade spawn rules → [_resolveCascadeMod()](../../src/mechanics/chipEffects.js#L773-L786), [_spawnCascadeProjectiles()](../../src/mechanics/chipEffects.js#L810-L976).
- Impact-side эффекты → [applyImpactEffects()](../../src/mechanics/chipEffects.js#L978-L1112).
- Runtime ticks / cleanup → [stepChipEffects()](../../src/mechanics/chipEffects.js#L1262-L1356), [reset()](../../src/mechanics/chipEffects.js#L1357-L1385).

## Инварианты этого модуля ⚠️
- Порядок срабатывания модификаторов приходит извне (`order` из hangar chips runtime); `chipEffects.js` не должен переизобретать source-order.
- `Аркадный хаос` (mod 7) больше не short-circuit'ит весь shot-time pipeline: order-0 arcade сначала попадает в deferred cascade queue, а random roll происходит уже в `_resolveCascadeMod()` перед child spawn. При этом roll теперь поднимается до latest unlocked tech tier через `Game.HangarChips.resolveLatestTechModId()`, а combo-выпадение через Arcade сразу идёт в direct burst вместо accumulator-path: [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js#L773-L840).
- Active modifiers в hangar runtime должны приходить уже tech-resolved: `calculateActiveModifiers()` теперь поднимает stale slot vertices до latest unlocked tier до match-проверок и до выдачи `activeModifiers`, поэтому Matryoshka/Calming не застревают на tier I, если installed slot ещё хранит базовый `modId`: [src/mechanics/hangarChips.js](../../src/mechanics/hangarChips.js).
- Child projectile visuals больше нельзя брать «как есть» из родительского `b.bulletCfg`: runtime хранит `bulletCfgBase`, а `mergeBulletCfgOverride()` пересобирает projectile/impact sprite по фактическому `shotMods.activeModIds`. Это особенно важно для Arcade-resolved `6/8/25/26/27/28`, чтобы combo/nuke child shots не наследовали atlas самого Arcade: [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js#L271-L281), [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js#L896-L942), [../../game.js](../../game.js#L8508-L8533).
- Жёлтые моды (`pendingYellowMods`) срабатывают только после финального cascade-step: [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js#L719-L875).
- Chain / Matryoshka descendants продолжают lingering/cascade contract через `_buildChildImpactShotMods()`: helper переносит active mods `10..14` и remaining pending queues, поэтому `impactAt()` больше не должен считать `isMatryoshkaChild` достаточным поводом для skip-path: [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js#L380-L414), [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js#L935-L1171), [../../game.js](../../game.js#L8602-L8694).
- Для lingering mods `10..14` `effect.enabled` отключает только fallback code visual. `applyImpactEffects()` всё равно создаёт gameplay-объект и сохраняет `effectSprite`; `game.js` читает `codeVisualEnabled` на decal/node/mark render, а не пропускает сам gameplay path: [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js#L876-L1015), [../../game.js](../../game.js#L8799-L8812), [../../game.js](../../game.js#L14151-L14186).
- Calming (9/29/30) больше не использует глобальный one-shot per-wave guard. `_applyCalming()` считает успешные попадания отдельно по каждому зомби, применяет ровно 0.5 / 0.75 / 1.0 sec suppression и после каждых 10 успешных calming-hit'ов выдаёт именно этому зомби 30-sec immunity window: [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js).
- Calming contract теперь двусторонний: `chipEffects.js` отвечает за duration/immunity timestamps, а `game.js` — за runtime seam после suppression. Дебафф больше не навешивается на walking-зомби, которые ещё не атакуют: `_applyCalming()` принимает только текущие `attack/cooldown` цели, поэтому модификатор не создаёт «отложенный» pacify на будущий подход к fence/supercomputer. Дополнительно один и тот же зомби не может принять новый calming-hit, пока не нанесёт следующий реальный удар после recovery: это разрывает spam-chain и оставляет `0.5 / 0.75 / 1.0 sec` как одно interrupted window на один attack-cycle. Пока suppression активен, runtime ещё и удерживает зомби на месте, чтобы во время `walk`-pause он не успел физически уйти из attack range; после `calmUntil` при валидной цели runtime возвращает цель в сохранённый attack/cooldown progress вместо лишнего повторного старта цикла: [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js), [../../game.js](../../game.js#L7826-L7997).
- Runtime-сущности (`_electroNodes`, `_laserMarks`, combo/nuke cooldowns) обязаны сбрасываться через `reset()` на world reset: [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js#L1357-L1385).

## Оглавление файла
| Функция / блок | Строки | Назначение |
|---|---|---|
| `getModEffectConfig()`, `getChipsCfg()`, `getModCfg()` | [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js#L110-L148) | Доступ к data-конфигу модификаторов и effect-config |
| `getActiveChipMods()`, `hasChipMod()`, `getActiveModIds()` | [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js#L299-L328) | Читает active modifiers ячейки |
| `_buildEmptyResult()`, `_buildChildImpactShotMods()` | [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js#L329-L423) | Базовый `shotMods` объект и carryover-helper для child impacts |
| `_applyModToResult()` | [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js#L424-L596) | Применение одного modId к `shotMods` |
| `applyShotModifiers()` | [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js#L597-L701) | Shot-time pipeline, split `pendingCascadeMods`/`pendingYellowMods`, arcade order-0 defer |
| `_findCascadeTargets()`, `_getCascadeProjectileCount()`, `_resolveCascadeMod()`, `_applyForcedComboBurst()` | [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js#L707-L806) | Поиск целей, projectile count, tech-aware arcade roll и Arcade combo burst forcing |
| `_spawnCascadeProjectiles()` | [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js#L810-L976) | Реальный спавн cascade-child projectile с `bulletCfgBase` carryover |
| `applyImpactEffects()` | [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js#L978-L1112) | Entry point impact-side эффектов; lingering mods `10..14` всегда создают gameplay state |
| `_applyChainJumps()`, `_spawnMatryoshkaChild()` | [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js#L1115-L1219) | Chain / matryoshka child-runtime с carryover pending queues и `bulletCfgBase` |
| `_applyPushPull()`, `_applyVacuum()`, `_applyCalming()` | [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js#L1221-L1301) | AoE displacement / calming |
| `stepChipEffects()` + `checkLaserMarkBoost()` | [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js#L1302-L1374) | Электроузлы, лазерные метки и consume-path |
| `stepChipDecal()` | [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js#L1375-L1396) | Tick DOT/slow decals |
| `reset()`, `getElectroNodes()`, `getLaserMarks()` | [src/mechanics/chipEffects.js](../../src/mechanics/chipEffects.js#L1397-L1425) | Сброс и debug/introspection |

## Зависимости
- Использует: `assets/chips.json`, active modifiers из `HangarChips`.
- Используется в: `game.js` (`fireTankProjectile`, `impactAt`, `stepDecals`, `drawDecals`); lingering visual gate дополнительно зависит от `addDecal()` / `drawDecals()` render-contract: [../../game.js](../../game.js#L8799-L8812), [../../game.js](../../game.js#L14151-L14186).

## Известные ограничения / TODO
- В этом map не перечислены все 30 modId поштучно; семантика модов описана в [SYSTEMS/combat.md](SYSTEMS/combat.md).
