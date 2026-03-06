# talentsV2.js — карта файла

> Агент-ориентировано. Обновлён: 2026-03-06.
> Монолит runtime талантов v2 (3463 строки). Линии ниже собраны по реально прочитанным блокам и grep line-start'ам.

## Что это
`src/systems/talents/talentsV2.js` — data-driven runtime талантов v2: загрузка и валидация дерева, миграция save v1→v2, вычисление модификаторов, buy/apply/respec flow, world hooks, активные способности, статус-иконки и debug overlay.

## Быстрый старт для агента
- Tree validation / normalize → [collectTreeValidationIssues()](../../src/systems/talents/talentsV2.js#L693-L965), [normalizeTree()](../../src/systems/talents/talentsV2.js#L986-L1036).
- Save/migration → [migrateTalentsV1toV2()](../../src/systems/talents/talentsV2.js#L1204-L1278), [loadFromSave()](../../src/systems/talents/talentsV2.js#L1324-L1348).
- Buy gating → [getTalentsByBranch()](../../src/systems/talents/talentsV2.js#L1660-L1722), [canBuy()](../../src/systems/talents/talentsV2.js#L1829-L1886).
- Runtime hooks → [onShotFired()](../../src/systems/talents/talentsV2.js#L2506-L2540), [onHit()](../../src/systems/talents/talentsV2.js#L2541-L2709), [onUpdate()](../../src/systems/talents/talentsV2.js#L2891-L3088).

## Инварианты этого модуля ⚠️
- Row gating фиксирован legacy-layout `3-3-3-3-2-2-1`, unlock thresholds `0/5/10/15/20/25/30` и prereq из предыдущего ряда: [src/systems/talents/talentsV2.js](../../src/systems/talents/talentsV2.js#L1660-L1838).
- Runtime catch-up loops должны оставаться ограниченными debug/config guard'ами: [src/systems/talents/talentsV2.js](../../src/systems/talents/talentsV2.js#L468-L569).
- World status icons рендерятся из этого модуля и вызываются только world-render'ом `game.js`, а не UI overlays: [src/systems/talents/talentsV2.js](../../src/systems/talents/talentsV2.js#L3465-L3572), [src/systems/talents/talentsV2.js](../../src/systems/talents/talentsV2.js#L3573-L3752).

## Оглавление файла
| Блок | Строки | Назначение |
|---|---|---|
| Utility / debug / time helpers | [src/systems/talents/talentsV2.js](../../src/systems/talents/talentsV2.js#L371-L689) | Числовые helpers, debug config, chance forcing, run runtime |
| Tree validation + normalize | [src/systems/talents/talentsV2.js](../../src/systems/talents/talentsV2.js#L693-L1037) | Validation report, normalize tree payload |
| Legacy migration + save IO | [src/systems/talents/talentsV2.js](../../src/systems/talents/talentsV2.js#L1052-L1348) | V1 extraction, migration, persistence hooks |
| Mods computation / contract validation | [src/systems/talents/talentsV2.js](../../src/systems/talents/talentsV2.js#L1383-L1544) | Применение param effects, caps, validate(mods) |
| Public tree state API | [src/systems/talents/talentsV2.js](../../src/systems/talents/talentsV2.js#L1577-L2045) | `getTalentsByBranch`, `canBuy`, `queueRank`, `applyPending`, `respec`, `getMods` |
| Entity runtime helpers | [src/systems/talents/talentsV2.js](../../src/systems/talents/talentsV2.js#L2062-L2490) | Tank/Zombie/Segment RT, DOT state, ricochet helpers, status ticks |
| Offense hooks | [src/systems/talents/talentsV2.js](../../src/systems/talents/talentsV2.js#L2506-L2709) | `onShotFired`, `onHit` |
| Defense + economy hooks | [src/systems/talents/talentsV2.js](../../src/systems/talents/talentsV2.js#L2710-L3292) | `onWallDamage`, `onUpdate`, `onKill`, `onShotReward`, `onWave*`, `onBuyTank`, `onPurchase` |
| Actives / status icons / debug overlay | [src/systems/talents/talentsV2.js](../../src/systems/talents/talentsV2.js#L3293-L3752) | Active state, activation API, icon rendering, debug dump |

## Hotspots
- [src/systems/talents/talentsV2.js](../../src/systems/talents/talentsV2.js#L693-L1037) — tree payload contracts.
- [src/systems/talents/talentsV2.js](../../src/systems/talents/talentsV2.js#L1660-L2045) — UI-facing gating and buy/apply API.
- [src/systems/talents/talentsV2.js](../../src/systems/talents/talentsV2.js#L2891-L3292) — long-running defense/economy hooks.
- [src/systems/talents/talentsV2.js](../../src/systems/talents/talentsV2.js#L3293-L3752) — actives/status/debug render.

## Зависимости
- Использует: `assets/balance/talentTree_v2.json`, save payload, world entities из `game.js`.
- Используется в: `game.js`, `docs/talents_v2.md`, `docs/ui_talents_v2.md`.

## Известные ограничения / TODO
- Детальные line-by-line ranges внутри каждого hook не размечены; при правке конкретного эффекта открывай точечную функцию.
