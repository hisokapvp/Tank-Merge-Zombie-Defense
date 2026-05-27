# talentsV2.js — карта файла

> Агент-ориентировано. Обновлён: 2026-05-26.
> Монолит runtime талантов v2 (3463 строки). Линии ниже собраны по реально прочитанным блокам и grep line-start'ам.

## Что это
`src/systems/talents/talentsV2.js` — data-driven runtime талантов v2: загрузка и валидация дерева, миграция save v1→v2, вычисление модификаторов, buy/apply/respec flow, world hooks, активные способности, статус-иконки и debug overlay.

## solo-pipeline-yandex-vk#1 — eco talents rework (2026-05-26)
- `eco_interest` («Танк-Банк»): tick 30 с, без per-tick cap, остановка во время паузы. Описание берётся verbatim из `src/i18n/{ru,en}.json` ключ `talent_eco_interest_desc`. См. `eco_interest` ветку в [onUpdate()](../../src/systems/talents/talentsV2.js#L2891-L3088).
- `eco_voucher` («Скидочный купон»): база 1000 убийств, −100/ранг, минимум 100, кап 10, скидка ×0.80. `onBuyTank` теперь split на quote/commit: купон не сжигается при провале affordability, при bulk-buy скидка применяется только к первым N танкам (N = текущее количество купонов). HUD-бэдж с количеством купонов рисуется слева сверху от кнопок `buy` / `buyBulk` через классы `.is-coupon-ready` + `.couponBadge`. После batch1 2026-05-27 HUD одиночной покупки (`updateUI`) вызывает `onBuyTank` quote с `vouchersOverride`, поэтому подпись «Создать 1 танк» сразу показывает discounted цену. См. [onBuyTank()](../../src/systems/talents/talentsV2.js#L3897-L3949) и в `game.js` `calculateAffordableBuyCount` + `performTankPurchaseOnce` + HUD updater.
- `eco_tax_relief` rebrand 2026-05-27 → «Гениальный инженер»: эффект `param mergeExtraLevelChance`, base 0 / perRank 0.002, max rank 5. Старая логика `taxReliefCostMul`/`taxReliefUntilMs`/`taxReliefDurationMs` удалена из всех hot paths (`onBuyTank`, `calculateAffordableBuyCount`, HUD). Новый эффект применяется в `game.js._applyMergeLevelBonus()` на merge sites (`performMerge`, `_performUndergroundMerge`, `_performCrossHangarMerge`) с clamp по `MAX_TANK_LEVEL`. `mergeExtraLevel` добавлен в unlocks-блок BASE_MODS_TEMPLATE и автоматически попадает в `MODS_WHITELIST_SET`.
- `eco_grey_to_damage_points` rebrand 2026-05-27 → «Безотходное накопление»: контракт (`greyToDamagePoints`, `greyToDamageBonus`) не изменился, обновлено только описание в `src/i18n/{ru,en}.json` (`talent_eco_grey_to_damage_points_desc`).
- `eco_lottery` («Лотерея»): три независимых roll'а при каждой удачной покупке танка, без ICD и без per-run лимита: same-level 0.5%/ранг, +5 level 0.25%/ранг, drone L1 0.1%/ранг. Roll'ы выполняются только в commit-pass; spawn-failures (оба ангара заполнены) деградируют молча. См. lottery-блок в [onBuyTank()](../../src/systems/talents/talentsV2.js#L3924-L3938) и `_grantLotteryBonusTank` в `game.js`.

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
