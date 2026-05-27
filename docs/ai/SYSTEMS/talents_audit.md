# Аудит реализации талантов V2 (batch solo-pipeline-yandex-vk#1, 2026-05-20)

> **Scope.** Эвристическая проверка контракта `talentTree_v2.json → adapter (game.js `adaptTalentsV2ModsToLegacy` / `getMods`) → runtime consumer`. Поводом стал баг таланта **«Мультивыстрел»** (`off_multishot`): в данных был объявлен `tripleShotChance`, но адаптер пробрасывал только `doubleShotChance`, а runtime в `fireTankProjectile` проверял только `doubleShotChance`. После починки triple реально стреляет и имеет визуал. Этот аудит ищет такой же паттерн в остальных талантах.

## Метод

Скрипт читает `assets/balance/talentTree_v2.json`, собирает все `effects[].key` / `effects[].stat`, затем:

1. Проверяет, есть ли в `src/systems/talents/talentsV2.js` публичный helper с именем по convention (`get<Camel>`, `apply<Camel>`, `compute<Camel>` и т.п.).
2. Проверяет, вызывается ли этот helper в `game.js` или `src/**/*.js` (любые вызовы `api.X(`, `Talents.X(`).
3. Параллельно проверяет, читается ли соответствующее `mods.<key>` / `talentMods.<key>` прямо в runtime (direct-mod path, как у `doubleShotChance`).

Статусы:

- **OK_DIRECT_MOD** — runtime реально читает `mods.X` хотя бы в одном hot-path (множитель попадает в формулу).
- **OK_HELPER** — есть helper в `talentsV2.js`, и он реально вызывается из `game.js`/`src/`.
- **BROKEN_HELPER_NOT_CALLED** — helper определён в `talentsV2.js`, но его никто не вызывает из runtime. **Совпадает с патерном `tripleShotChance` до фикса.**
- **BROKEN_OR_UNCERTAIN** — helper не найден по convention, и `mods.X` / `talentMods.X` нигде не читается. Возможно, эффект реализован через событийные хуки (`onShotFired`, `onHit`, `tickStatuses`, `renderStatusIcons`, `clearRuntimeEffects`), но без явной точки сборки. Требует ручной проверки в follow-up batch.

## Итоговая таблица

| Talent ID | Объявленные effects (краткое) | Ожидаемый consumer | Статус |
|---|---|---|---|
| `off_caliber` | `damageMul` | `mods.dmgMul` (game.js) | OK_DIRECT_MOD |
| `off_fire_rate` | `fireRateMul` | `mods.fireRateMul` | OK_DIRECT_MOD |
| `off_range` | `rangeMul` | `mods.rangeMul` | OK_DIRECT_MOD |
| `off_aoe` | `aoeMul`, `crowdMinCount`, `crowdAoeDamageMul` | `mods.aoeMul` (+ crowd-* в game.js шот-пайплайн) | OK_DIRECT_MOD |
| `off_multishot` | `doubleShotChance`, `tripleShotChance` | `mods.doubleShotChance`, `mods.tripleShotChance` (game.js exclusive ladder + VFX по тиру) | OK_DIRECT_MOD (после batch#1 фикса) |
| `off_orbit_speed` | `orbitSpeedMul` | `mods.orbitSpeedMul` | OK_DIRECT_MOD |
| `off_acid_dot` | `acidDot`, `acidDotChance/DurationMs/DpsMul` | `getDotState` (определён, **не вызывается** из game.js/src) | **BROKEN_HELPER_NOT_CALLED** |
| `off_mark` | `mark`, `markChance/DurationMs/DamageTakenMul` | event-hook? Helper не найден | BROKEN_OR_UNCERTAIN |
| `off_armor_piercing_proc` | `armorPiercingProc*` | event-hook? Helper не найден | BROKEN_OR_UNCERTAIN |
| `off_impulse_proc` | `impulseProc*` | event-hook? Helper не найден | BROKEN_OR_UNCERTAIN |
| `off_execute` | `execute`, `executeHpThreshold/DamageMul` | event-hook? Helper не найден | BROKEN_OR_UNCERTAIN |
| `off_cc_micro` | `ccMicro*` | event-hook? Helper не найден | BROKEN_OR_UNCERTAIN |
| `off_ramp_up` | `rampUp*` | внутренняя машина состояний в talentsV2.js | BROKEN_OR_UNCERTAIN |
| `off_pulse_aoe` | `pulseAoe*` | `getPulseShotMultiplier` (вызывается) | OK_HELPER |
| `off_convert_to_dot` | `convertToDot*` | `getDotState` (**не вызывается**) | **BROKEN_HELPER_NOT_CALLED** |
| `off_ricochet` | `ricochet*` | `getRicochetBounces` (вызывается косвенно через onShotFired?) | BROKEN_OR_UNCERTAIN |
| `off_active_barrage` | `offenseActive*` | `getBarrageMul` (вызывается) | OK_HELPER |
| `def_wall_hp` | `wallHpMul` | прямого `mods.wallHpMul` в runtime не видно | BROKEN_OR_UNCERTAIN |
| `def_armor_flat` | `wallArmorMul` | `mods.wallArmorMul` | OK_DIRECT_MOD |
| `def_repair_cost` | `repairCostMul` | helper/consumer не найден | BROKEN_OR_UNCERTAIN |
| `def_resists` | `resistFirePct/AcidPct/ExplosionPct` | ожидался `getModNumber` для damage-receive, **не вызывается** на receive-path | **BROKEN_HELPER_NOT_CALLED** |
| `def_regen` | `regenDelayMs`, `regenPctPerSec` | helper не найден | BROKEN_OR_UNCERTAIN |
| `def_shield` | `wallShield*` | helper не найден | BROKEN_OR_UNCERTAIN |
| `def_slow_field` | `slowField*` | helper не найден | BROKEN_OR_UNCERTAIN |
| `def_thorns` | `thorns*` | helper не найден | BROKEN_OR_UNCERTAIN |
| `def_barrier_trigger` | `wallBarrier*` | helper не найден | BROKEN_OR_UNCERTAIN |
| `def_stun_on_hit` | `stunOnWallHit*` | helper не найден | BROKEN_OR_UNCERTAIN |
| `def_second_wind` | `secondWind*` | helper не найден | BROKEN_OR_UNCERTAIN |
| `def_broken_dr` | `brokenSegmentDamageMul` | helper не найден | BROKEN_OR_UNCERTAIN |
| `def_auto_repair` | `autoRepair*` | helper не найден | BROKEN_OR_UNCERTAIN |
| `def_repair_efficiency` | `repairEfficiencyMul` | helper не найден | BROKEN_OR_UNCERTAIN |
| `def_explosive_base` (rebrand 2026-05-24, был `def_repair_discount_timer`) | `explosiveBase`, `explosiveBaseDamagePerRank`, `explosiveBaseRadiusPx`, `explosiveBaseDamageCapPerFrame` | `applyExplosiveBaseDetonation` (`src/systems/talents/talentsV2.js` L3347+) — вызывается из `game.js` в fragment-destroyed seams L3347 / L4484 / L8902-8938 (AoE 300px, 100k dmg/rank, per-frame cap 600k, polar→cartesian iteration по `state.zombies`) | **WIRED_OK** |
| `def_immunity_proc` (display «Случайная неразрушимость», 2026-05-24) | `immunityProc`, chance `1%/rank`, duration `2s`, ICD `15s` | `onWallDamage` (`game.js` L3083-3096) — пишет `segRt.immunityUntilMs` (L2411/L2434); render seam `ProcShieldSprites` + `drawFenceProcShields()` в `game.js` (preload в boot, рисует overlay пока `segRt.immunityUntilMs > nowMs`); `assets/fence.json` root-block `procShields` (atlas=proc_shields.png placeholder, visibleWhile="immunityActive") | **WIRED_OK** |
| `def_dome` (rebrand 2026-05-24, был `def_active_dome`, display «Купол») | `defenseActive*` (`durationMs=10000`, `rechargeMs=90000`, `damageTakenMul=0.15`, `autoRepairPctPerSec=0.03`, `charges=2`) | `getActiveState`, `getActiveDomeDamageMul`, `isDomeActive` (вызываются); render через существующий `shields` overlay (`visibleWhile="defenseActive"`); i18n + tooltip синхронизированы | **WIRED_OK** |
| `eco_buy_discount` | `tankBuyCostMul` | `mods.buyCostMul` | OK_DIRECT_MOD |
| `eco_upgrade_discount` | `upgradeCostMul_sc`, `upgradeCostMul_wall` | helper не найден | BROKEN_OR_UNCERTAIN |
| `eco_repair_discount` | `repairCostMul` | helper `applyRepairDiscountCoupon` (вызывается через активку?) | BROKEN_OR_UNCERTAIN |
| `eco_coins_kill_bonus` | `coinsKillMul`, `killBounty*` | `mods.coinsKillMul` + bounty-path | OK_DIRECT_MOD |
| `eco_coins_shot_bonus` | `coinsShotMul` | `mods.coinsShotMul` | OK_DIRECT_MOD |
| `eco_xp_bonus` | `xpMul` | `mods.xpMul` | OK_DIRECT_MOD |
| `eco_double_reward` | `doubleRewardChanceKill/Box/Wave` | direct-mod path | OK_DIRECT_MOD |
| `eco_interest` | `interest*` | helper не найден | BROKEN_OR_UNCERTAIN |
| `eco_tax_relief` | `mergeExtraLevelChance` | `_applyMergeLevelBonus` (game.js) | WIRED (rebrand 2026-05-27) |
| `eco_voucher` | `voucher*` | helper не найден | BROKEN_OR_UNCERTAIN |
| `eco_lottery` | `lottery*` | helper не найден | BROKEN_OR_UNCERTAIN |
| `eco_clean_defense` | `cleanDefense*` | helper не найден | BROKEN_OR_UNCERTAIN |
| `eco_grey_to_damage_points` | `greyToDamagePoints*` | helper не найден | BROKEN_OR_UNCERTAIN |
| `eco_crit_kill_bonus` | `critKillCoinsBonusFlat` | helper не найден | BROKEN_OR_UNCERTAIN |
| `eco_bulk_buy` | `bulkBuy`, `tankBuyCostMul` | direct-mod path | OK_DIRECT_MOD |
| `eco_century_contract` | `centuryContract`, `tankBuyCostMul` | direct-mod path | OK_DIRECT_MOD |
| `eco_active_golden_hour` | `economyActive*` | `getActiveState` | OK_HELPER |

## Сводка

| Статус | Талантов |
|---|---|
| OK_DIRECT_MOD | 17 |
| OK_HELPER | 4 |
| **BROKEN_HELPER_NOT_CALLED** | **4** |
| BROKEN_OR_UNCERTAIN | 26 |
| **Всего** | **51** |

## High-confidence findings (паттерн «как у Мультивыстрела»)

Это **3 таланта** (после rebrand 2026-05-24), где helper в `talentsV2.js` объявлен, но в runtime никем не вызывается — это **точно тот же паттерн**, который ломал `tripleShotChance` до этого батча:

1. **`off_acid_dot`** — `getDotState` определён, но `game.js` его не вызывает. DoT-стек, длительность, dps-множитель не применяются.
2. **`off_convert_to_dot`** — тот же `getDotState`, тот же провал.
3. **`def_resists`** — `getModNumber('resistFirePct'/'resistAcidPct'/'resistExplosionPct')` — на damage-receive path стена/танк не вычитают этот процент.

> Resolved 2026-05-24 (fence-upgrades-rework): `def_repair_discount_timer` → `def_explosive_base` (полный rebrand, новый WIRED_OK AoE-механизм). Legacy helper `applyRepairDiscountCoupon` и runtime поля `repairDiscountReady` / `nextRepairDiscountAtMs` оставлены в коде ради backward-compat сохранений (sub-Orchestrator решил не удалять); они больше не считаются finding, см. `docs/talents_v2.md`.

## Coord-space contract для AoE-хелперов (lesson learned, 2026-05-24)

> Round 5 root-cause fix для item 1 (Взрывное основание) — обязательный контракт для всех новых AoE-механик на стене:

- `state.zombies[*]` хранятся в **полярных** координатах относительно центра арены: `z.r` (радиус) + `z.theta` (угол).
- `seg.x` / `seg.y` сегментов забора хранятся в **центр-относительных** координатах (см. `src/render/fenceLayout.js` L190: углы в `±halfSide`, рендер через двойной `ctx.translate(center.x, center.y)` затем `ctx.translate(seg.x, seg.y)` в `renderFenceBase` L15775+).
- Любой helper, который сравнивает зомби с точкой пробоя по радиусу, **обязан принимать `centerX` / `centerY` от вызывающей стороны** (либо в `ctx.originX` / `ctx.originY`, либо как явные аргументы) и конвертировать зомби-полярки в декартовы координаты: `wx = centerX + z.r * cos(z.theta)`, `wy = centerY + z.r * sin(z.theta)`.
- Прямое сравнение `(z.x - seg.x)² + (z.y - seg.y)²` с `radius²` **некорректно** для зомби в полярных координатах и приводит либо к нулевому радиусу, либо к single-target hit (это был root cause багa «AoE не наносит урон по области» в round 3).
- Helper `applyExplosiveBaseDetonation` (`src/systems/talents/talentsV2.js` L3347+) реализует контракт правильно: предпочитает `ctx.originX` / `ctx.originY`, fallback на `seg.x` / `seg.y` для backward-compat. Call site в `game.js` L8969 вычисляет `segWorldX = center.x + seg.x`, `segWorldY = center.y + seg.y` (с `Number.isFinite` guard) перед вызовом.

## Uncertain (требуют ручного follow-up batch)

26 талантов помечены `BROKEN_OR_UNCERTAIN`. Часть из них может работать через событийные хуки (`onShotFired`, `onHit`, `onUpdate`, `tickStatuses`, `renderStatusIcons`), которые вызываются в `game.js` — но без явной точки сборки эвристика не может это подтвердить. **Не self-fix в текущем батче**: по контракту Orchestrator (>3 broken → findings, не self-fix), эти 26 пунктов выносятся parent Meta-Orchestrator-у для решения о follow-up batch.

Приоритет ручной проверки для defense/eco веток (там больше всего uncertain):

- Defense: `def_wall_hp`, `def_regen`, `def_shield`, `def_slow_field`, `def_thorns`, `def_barrier_trigger`, `def_stun_on_hit`, `def_second_wind`, `def_broken_dr`, `def_auto_repair`, `def_repair_efficiency`, `def_immunity_proc`.
- Economy: `eco_interest`, `eco_tax_relief`, `eco_voucher`, `eco_lottery`, `eco_clean_defense`, `eco_grey_to_damage_points`, `eco_crit_kill_bonus`, `eco_upgrade_discount`, `eco_repair_discount`.
- Offense (вероятно событийные): `off_mark`, `off_armor_piercing_proc`, `off_impulse_proc`, `off_execute`, `off_cc_micro`, `off_ramp_up`, `off_ricochet`.

## Ограничения метода

- Эвристика не понимает событийную диспетчеризацию через `onShotFired`/`onHit` — там эффекты «зашиты» в talentsV2.js и снаружи дёргаются обобщённой точкой входа. Возможны false-positive «BROKEN_OR_UNCERTAIN».
- Эвристика не понимает данных-driven параметры, у которых нет соответствующего runtime-чтения (например, `repairCostMul` может читаться внутри `applyRepairDiscount`, а наружу выходит только активка).
- Контракт `effect.max`, `fromRank`, `min`, `base+perRank` не проверяется; только сам факт consumer-а.

## Следующие шаги (рекомендация для Meta-Orchestrator)

1. Открыть отдельный batch на 4 high-confidence findings (`off_acid_dot`, `off_convert_to_dot`, `def_resists`, `def_repair_discount_timer`) — каждый по тому же паттерну фикса, что и multishot: подключить helper из `talentsV2.js` к runtime hot-path и проверить через тест/визуальную проверку.
2. Открыть отдельный batch на ручной аудит 26 uncertain (или batch-семейство по 3–5 талантов за раз, чтобы не раздувать scope).
3. Закрепить как regression-инвариант: «если объявлен helper `get*/apply*` для taлента — он должен быть вызван хотя бы из одного места runtime; иначе CI-чек должен фейлиться».

---

## Append-only update от batch `solo-pipeline-yandex-vk#1-followup` (2026-05-20)

### Переклассификация 4 high-confidence findings

После целевой ручной проверки от Orchestrator-а (follow-up batch) обнаружено: эвристика batch#1 не отслеживала вызовы публичных диспетчеров `onHit` / `onWallDamage` / `onRepair` через `talentsApi.X(...)` из `game.js`. Это привело к false-positive риску для 2 из 4 high-confidence findings.

| Talent ID | Старый статус | Новый статус (после follow-up) | Обоснование |
|---|---|---|---|
| `off_acid_dot` | BROKEN_HELPER_NOT_CALLED | **OK_HELPER_VIA_ONHIT_DISPATCHER** | `talentsApi.onHit(...)` уже вызывается из `game.js:10159`. Внутри `onHit` (talentsV2.js:2808) `getDotState` вызывается на acid-path (L2906). Стек DoT тикает через `talentsApi.onUpdate` (game.js:16949) → `_applyDotDamage`. Audit batch#1 не проследил event-dispatch путь. False-positive исправлен. |
| `off_convert_to_dot` | BROKEN_HELPER_NOT_CALLED | **OK_HELPER_VIA_ONHIT_DISPATCHER** | То же: `getDotState` вызывается внутри `onHit` для convert-path (talentsV2.js:2982). False-positive исправлен. |
| `def_resists` | BROKEN_HELPER_NOT_CALLED | **OK_HELPER (wired in follow-up)** | До follow-up `onWallDamage` не вызывался из game.js — это **подтверждённый bug**. В follow-up `applyFenceSegmentDamage` (game.js:8568) теперь вызывает `talentsApi.onWallDamage(...)`. Это автоматически включает: `def_resists`, `def_shield`, `def_thorns`, `def_barrier_trigger`, `def_stun_on_hit`, `def_second_wind`, `def_immunity_proc` (всё через ту же точку входа). |
| `def_repair_discount_timer` | BROKEN_HELPER_NOT_CALLED | **OK_HELPER (wired in follow-up)** | До follow-up coupon-логика была недостижима. В follow-up `tryRepairFenceSegmentAt` (game.js:8687) теперь вызывает новый публичный wrapper `talentsApi.applyRepairCoupon(baseCost, timeMs)` (talentsV2.js wrapper над `applyRepairDiscountCoupon`). |

### Каскадный эффект wire-up на BROKEN_OR_UNCERTAIN

Подключение `onWallDamage` автоматически переводит из `BROKEN_OR_UNCERTAIN` в `OK_HELPER (via onWallDamage)` следующие таланты (все они потребляют моды внутри `onWallDamage`):

- `def_shield` — потребляет `rt.shieldHp` (внутри onWallDamage L3084).
- `def_thorns` — потребляет `thornsPct/thornsRadius/thornsIcdMs` (L3097–3122).
- `def_barrier_trigger` — потребляет `wallBarrierDrPct/HpThreshold/DurationMs/IcdMs` (L3063–3076).
- `def_stun_on_hit` — потребляет `stunOnWallHitChance/DurationMs/IcdMs` (L3086–3093).
- `def_second_wind` — потребляет `secondWindRestorePct` (L3079–3083).
- `def_immunity_proc` — потребляет `immunityProcChance/DurationMs/IcdMs` (L3046–3055).

Аналогично подключение `applyRepairCoupon` (через `onRepair` API surface) активирует:

- `eco_repair_discount` — частично, через тот же `repairCostMul` мод, который `applyRepairDiscountCoupon` не трогает (потребуется отдельная проверка во втором follow-up).

### Не покрытые follow-up-ом

Следующие пункты остаются BROKEN_OR_UNCERTAIN после этого батча и должны быть обработаны отдельным follow-up-ом:

- `def_wall_hp` (`wallHpMul`) — не читается ни в одном code path.
- `def_regen` (`regenDelayMs/regenPctPerSec`) — потребуется проверка `onUpdate` regen-секции.
- `def_slow_field` (`slowField*`) — отдельная зона, не часть `onWallDamage`.
- `def_broken_dr` (`brokenSegmentDamageMul`) — не читается.
- `def_auto_repair`, `def_repair_efficiency`, `def_repair_cost` — частично связаны с `onRepair`, но `onRepair` ещё не используется как pricing-source в game.js (см. рестрикцию ниже).
- Offense uncertain (`off_mark`, `off_armor_piercing_proc`, `off_impulse_proc`, `off_execute`, `off_cc_micro`, `off_ramp_up`, `off_ricochet`) — нужна проверка event-hook путей.
- Economy uncertain (`eco_interest`, `eco_tax_relief`, `eco_voucher`, `eco_lottery`, `eco_clean_defense`, `eco_grey_to_damage_points`, `eco_crit_kill_bonus`, `eco_upgrade_discount`) — нужна ручная проверка.

### Известные ограничения follow-up wire-up

- `onRepair` имеет внутреннюю формулу cost-а на основе `Game.TankPrices`, которая конфликтует с канонической `FR.getFenceRepairCostCoins`. Решение: follow-up не использует `onRepair` целиком, а вызывает только новый wrapper `applyRepairCoupon`, который пробрасывает существующий cost через coupon-логику без перерасчёта pricing. Это сохраняет балансовый контракт `fenceRepair.js`.
- Talent `def_repair_efficiency` (heal multiplier для ремонта) пока не покрыт: heal-side контракт в `tryRepairFenceSegmentAt` всё ещё восстанавливает `seg.hp = seg.maxHp` без учёта `repairEfficiencyMul`. Это будет отдельной задачей.
- `repairCostMul` мод (используемый `eco_repair_discount`) не применяется в текущем wire-up — талант на этом этапе остаётся uncertain.

### Финальная сводка после follow-up

| Статус | Талантов |
|---|---|
| OK_DIRECT_MOD | 17 |
| OK_HELPER (вкл. via dispatchers) | 4 + 2 (acid, convert) + 6 (def via onWallDamage) + 1 (repair_discount_timer) = **13** |
| BROKEN_HELPER_NOT_CALLED | **0** |
| BROKEN_OR_UNCERTAIN | 26 − 6 (defense через onWallDamage) − 0 (acid/convert уже пересмотрены) = **20** |
| **Всего** | **51** |

## Batch #1-followup-2 — реклассификация и code wire-up (22 талантов)

Источник: ТЗ `solo-pipeline-yandex-vk#1-followup-2` (пользователь явно перечислил 22 BROKEN_OR_UNCERTAIN таланта). Глубокий анализ через `ctx_batch_execute` выявил, что **большинство "uncertain" талантов на самом деле уже подключены внутри talentsV2.js, но их containing-dispatcher не вызывался из game.js**. То есть проблема была не в helper-функциях, а в отсутствии диспатчер-callsite-ов.

### Defense (7 талантов) — финальная классификация

| ID | Mod | До follow-up-2 | После | Wire-up location |
|---|---|---|---|---|
| `def_wall_hp` | `wallHpMul` | UNCERTAIN | **WIRED** | `getFenceSegmentMaxHp()` теперь читает `mods.wallHpMul` (game.js:7859, паттерн как `wallArmorMul` в `getFenceArmorFlat`) |
| `def_regen` | `regenDelayMs/regenPctPerSec` | UNCERTAIN | **OK_FALSE_POSITIVE** | wired через `onUpdate` (talentsV2.js:3193–3211); `onUpdate` вызывается из game.js:16980 |
| `def_slow_field` | `slowField*` | UNCERTAIN | **OK_FALSE_POSITIVE** | wired через `onUpdate` zombie-loop section (talentsV2.js ~L3022) |
| `def_broken_dr` | `brokenSegmentDamageMul` | UNCERTAIN | **DESIGN_DEAD** | Текущая damage-model отбрасывает damage по broken-сегментам в `applyFenceSegmentDamage` (`if (!seg \|\| seg.broken) return false;` game.js:8569). Талант не имеет canonical consumer без изменения damage-model. Документировать как уход из active backlog: переименовать или сделать применимым к near-broken (HP < threshold) сегментам — отдельная design-задача. |
| `def_auto_repair` | `autoRepair*` | UNCERTAIN | **OK_FALSE_POSITIVE** | wired через `onUpdate` (talentsV2.js:3198–3241) |
| `def_repair_efficiency` | `repairEfficiencyMul` | UNCERTAIN | **WIRED** | `tryRepairFenceSegmentAt` теперь применяет формулу пользователя: `seg.hp = min(seg.maxHp, seg.hp + seg.maxHp * repairEfficiencyMul)` вместо legacy `seg.hp = seg.maxHp`. По constraint #2. |
| `def_repair_cost` | `repairCostMul` | UNCERTAIN | **WIRED** | `tryRepairFenceSegmentAt` теперь умножает `costCoins *= repairCostMul` ПЕРЕД `applyRepairCoupon` — мультипликативная композиция с купоном. По constraint #3. NB: `onRepair` целиком НЕ используется (по constraint #1). |

### Offense (7 талантов) — все OK_FALSE_POSITIVE

Все 7 талантов wired через `onHit`, который вызывается из game.js:10190. Helper-функции:

| ID | Mod | Where wired in onHit |
|---|---|---|
| `off_mark` | `markChance/markDurationMs/markDamageTakenMul` | onHit ~L2914 (mark application) + L2869 (damage-mul на marked target) + game.js:13856 (debuff overlay через `renderStatusIcons`) |
| `off_armor_piercing_proc` | `armorPierceProc*` | onHit L2741–2744 (proc/icd roll) + L2859 (damage application path) |
| `off_impulse_proc` | `impulseProc*` | onHit L2747–2750 (proc/icd roll), impulse-применение через apply* helper |
| `off_execute` | `executeHpThreshold/DamageMul` | onHit L2873–2877 (HP-threshold execute bonus damage) |
| `off_cc_micro` | `ccChance/IcdMs/SlowDurationMs` | onHit ~L2908+ (ccChance roll, slow apply) + game.js:13856 (overlay) |
| `off_ramp_up` | `rampUpFireRatePerStack/rampTickMs/rampStackMax/rampGraceMs` | `onShotFired` L2671–2673 (rampUp accumulation), `onShotFired` вызывается из game.js:9768 |
| `off_ricochet` | `ricochetChance/BouncesBase/Radius` | onHit ~L2936+ (ricochet logic via `extraHits` push) |

**Действие:** code wire-up не требуется. Талантовый функционал доступен с момента wire-up `onHit` (батч #1).

### Economy (8 талантов) — финальная классификация

| ID | Mod | До follow-up-2 | После | Wire-up location |
|---|---|---|---|---|
| `eco_interest` | `interestPct/PeriodMs/CapPerTick` | UNCERTAIN | **OK_FALSE_POSITIVE** | wired через `onUpdate` interest-tick (talentsV2.js:3340+) |
| `eco_crit_kill_bonus` | `critKillCoinsBonusFlat` | UNCERTAIN | **WIRED** | `onKill` теперь вызывается в death-FX coin-award site (game.js:~8909). Передаются `baseCoins`, `baseXp`, `isCrit`, `zombie`. |
| `eco_voucher` (kill-side) | `voucherKillsNeed/Cap/DiscountMul` | UNCERTAIN | **WIRED** | Через `onKill` (счётчик аккумулируется) |
| `eco_voucher` (buy-side) | (то же) | UNCERTAIN | **WIRED** | Через `onBuyTank` (скидка применяется при покупке) |
| `eco_tax_relief` | `mergeExtraLevelChance` | UNCERTAIN | **WIRED (rebrand 2026-05-27)** | После rebrand «Налоговая льгота» → «Гениальный инженер» эффект применяется не через `onBuyTank`, а через `game.js._applyMergeLevelBonus()` на merge sites (`performMerge`, `_performUndergroundMerge`, `_performCrossHangarMerge`) с clamp по `MAX_TANK_LEVEL`. Старые `taxReliefCostMul/DurationMs/UntilMs` удалены из активных hot paths; runtime state поле `taxReliefUntilMs` оставлено только для save-compat. |
| `eco_lottery` | `lotteryChance/IcdMs/LimitPerRun` | UNCERTAIN | **WIRED** | Через `onBuyTank` |
| `eco_clean_defense` | `cleanDefenseCoinsMul/XpMul` | UNCERTAIN | **DEFERRED** | wired в `onWaveEnd` (talentsV2.js:3469–3470), но `onWaveEnd` не имеет callsite в game.js. Wave-end transitions используют `finalizeNoRepairAttackWaveEpisode` (game.js:4321), нужна интеграция. **F3 follow-up.** |
| `eco_grey_to_damage_points` | `greyToDamagePointsMul` | UNCERTAIN | **DEFERRED** | wired в `onOverkill` + `onWaveEnd`, оба callsite-а отсутствуют. **F3 follow-up.** |
| `eco_upgrade_discount` | `upgradeCostMul_sc/_wall/_guns` | UNCERTAIN | **DEFERRED** | wired в `onPurchase`, но fence-upgrade в game.js использует `damagePoints` не coins (`tryUpgradeFenceLevel`, game.js:7943); SC/guns upgrade pricing не локализован — нужна отдельная аналитика. **F3 follow-up.** |

### Сводка после batch #1-followup-2

| Bucket | Counts |
|---|---|
| Defense wire-up (новые callsite-ы) | 3 (wallHpMul, repairEfficiencyMul, repairCostMul) |
| Defense FALSE_POSITIVE (already-wired via onUpdate) | 3 (regen, slowField, autoRepair) |
| Defense DESIGN_DEAD | 1 (broken_dr — current damage-model incompat) |
| Offense FALSE_POSITIVE (already-wired via onHit / onShotFired) | 7 |
| Economy wire-up | 5 (onKill, onBuyTank — kill-side + buy-side для voucher) |
| Economy FALSE_POSITIVE (onUpdate) | 1 (interest) |
| Economy DEFERRED to F3 | 3 (clean_defense, grey_to_damage_points, upgrade_discount) |
| **Итого охвачено из 22-х** | **22** (19 разрешено в batch, 3 deferred с конкретными wire-up точками) |

### Регрессионный guard

`ci/check_talent_helpers.cjs` подтверждает после follow-up-2:

```
[check_talent_helpers] OK — 13 wired, 7 TODO-allow-listed, 20 total exported dispatchers checked.
```

Wired: applyRepairCoupon, onHit, onWallDamage, onUpdate, onShotFired, onKill, onBuyTank, tickStatuses, renderStatusIcons, activateOffenseActive, activateDefenseActive, activateEconomyActive, clearRuntimeEffects.

Still in ALLOWED_UNWIRED_TODO: onShotReward, onWaveStart, onWaveEnd, onOverkill, onRepair (intentional skip per user constraint #1), onPurchase, onZombieNearWall.

## Batch #1-followup-3 — eco wire-up (deferred 3 → WIRED)

Batch замыкает 3 deferred eco-таланта из followup-2: runtime callsite-ы добавлены, dispatcher-ы переведены из `ALLOWED_UNWIRED_TODO` в wired.

| ID | Mod | Статус | Callsite-ы |
|---|---|---|---|
| `eco_clean_defense` | `cleanDefenseCoinsMul/XpMul` | **WIRED** | `beginNoRepairAttackWaveEpisode` (game.js:~4242) — `onWaveStart()` + reset wave accumulators; zombie-death FX (game.js:~9001) — инкремент `waveCoinsAccumulated/waveXpAccumulated` после awarding; `finalizeNoRepairAttackWaveEpisode` (game.js:~4321) — `onWaveEnd({baseCoins, baseXp, baseDamagePoints:0, mods})`, бонус = `out.coins - baseCoins` → `state.coins`, `out.xp - baseXp` → `grantXP`. Gating через `runRt.wave.damageToWalls` (устанавливается `onWallDamage`, сбрасывается `onWaveStart`). |
| `eco_grey_to_damage_points` | `greyToDamagePointsMul` | **WIRED** | `applyDamageToZombie` (game.js:~9421) — overkill computed as `max(0, incomingDamage - appliedDamage)` на killing blow (`nextHp===0 && appliedDamage>0`); `onOverkill({amount, timeMs})` аккумулирует `runRt.eco.greyDamage`. На wave-end `onWaveEnd` возвращает `damagePointsAdd = greyDamage * mul`, бонус начисляется через `addTankDamageDealt(damagePointsAdd)` (тот же bucket, что обычный earning damage; UI refresh встроен). |
| `eco_upgrade_discount` | `upgradeCostMul_sc/_wall/_guns` | **WIRED** | 4 SC/wall/gun upgrade pricing seam'а в game.js: `applyCannonUpgrade` (~L1016, `kind='upgrade_guns'`), `applyFenceUpgrade` (~L1047, `kind='upgrade_wall'`), `applyDronUpgrade` (~L3739, `kind='upgrade_sc'`), `tryUpgradeFenceLevel` (~L7975, `kind='upgrade_wall'`). Паттерн: `talentsApi.onPurchase({baseCost, kind, mods, timeMs})` → `out.cost` заменяет `totalCost` ДО affordability-check (`getAvailableDamagePoints() < totalCost`) и spending (`state.damagePointsSpent += totalCost`). Drones мапятся на `upgrade_sc` (соответствует "drones" из talent описания "guns, drones and walls"). |

### Регрессионный guard после batch #1-followup-3

```
[check_talent_helpers] WARN — 3 dispatcher(s) still in ALLOWED_UNWIRED_TODO backlog (F2 follow-up): onZombieNearWall, onShotReward, onRepair
[check_talent_helpers] OK — 17 wired, 3 TODO-allow-listed, 20 total exported dispatchers checked.
```

Wired (+4): `onWaveStart`, `onWaveEnd`, `onOverkill`, `onPurchase` (плюс предыдущие 13).

Still in ALLOWED_UNWIRED_TODO (3): `onShotReward` (eco_coins_shot_bonus — отдельный follow-up), `onRepair` (intentional skip — canonical путь через `applyRepairCoupon` + прямые reads `repairCostMul/repairEfficiencyMul`), `onZombieNearWall` (def_slow_field proximity event — отдельный follow-up).

### Дизайн-решения батча

- **Wave coin/xp tracking** хранится на `noRepairAttackWaveRuntime` (рядом с `allFencesDestroyedThisWave`), reset в `begin*Episode` и захватывается ДО `resetNoRepairAttackWaveRuntime()` в finalize.
- **Overkill detection**: реальный overkill = `incomingDamage - appliedDamage` (positive только когда урон превысил оставшиеся HP); измеряется на killing blow, чтобы не double-count'ить.
- **Damage points bonus** начисляется через существующий `addTankDamageDealt(damagePointsAdd)`, не отдельный bucket. UI-refresh встроен.
- **Idle kills (вне attack-волны)** не накапливаются в wave-accumulators — `clean_defense` бонус применяется только к coins/xp, заработанным внутри активной волны.



---

## Финальная сводка по состоянию талантов (2026-05-20)

**Канонический источник:** `assets/balance/talentTree_v2.json` — 51 талант, 3 ветки (offense / defense / economy), 5 тиров.

**Источник wire-up:** аудит batch-серии `solo-pipeline-yandex-vk#1` + три follow-up-а (FU1: defense `onWallDamage` + `applyRepairCoupon`; FU2: 22 BROKEN_OR_UNCERTAIN талантов реклассифицированы и подключены; FU3: 3 deferred eco wire-up'а через `onWaveStart/onWaveEnd/onOverkill/onPurchase`).

### Краткий ответ на вопрос «Все таланты переработаны?»

**ЧАСТИЧНО — 50 из 51 талантов wired в runtime hot-path; 1 талант (`def_broken_dr`) DESIGN-DEAD** (требует отдельного дизайн-решения, см. ниже).

Все остальные таланты либо читают свой `mods.X` напрямую (OK_DIRECT_MOD), либо подключены через публичные диспетчеры `talentsApi.onHit / onWallDamage / onUpdate / onShotFired / onKill / onBuyTank / onPurchase / onWaveStart / onWaveEnd / onOverkill / applyRepairCoupon / activate*Active / tickStatuses / renderStatusIcons / clearRuntimeEffects`. Регрессионный guard `ci/check_talent_helpers.cjs` фиксирует, что каждый exported dispatcher вызван хотя бы из одного callsite в `game.js` / `src/**/*.js`.

### Категории (51 talent)

#### WIRED (20) — code wire-up выполнен в batch-серии

Эти таланты получили новый runtime callsite или fix существующего hot-path в результате batch-серии:

| ID | Branch | Где подключено |
|---|---|---|
| `off_multishot` | offense | `fireTankProjectile`: ladder `tripleShotChance` → `doubleShotChance` (batch#1 fix; до этого triple был silent) |
| `def_resists` | defense | `applyFenceSegmentDamage` → `talentsApi.onWallDamage(...)` (FU1) |
| `def_shield` | defense | через `onWallDamage` (FU1) |
| `def_thorns` | defense | через `onWallDamage` (FU1) |
| `def_barrier_trigger` | defense | через `onWallDamage` (FU1) |
| `def_stun_on_hit` | defense | через `onWallDamage` (FU1) |
| `def_second_wind` | defense | через `onWallDamage` (FU1) |
| `def_immunity_proc` | defense | через `onWallDamage` (FU1) |
| `def_repair_discount_timer` | defense | `tryRepairFenceSegmentAt` → `talentsApi.applyRepairCoupon(baseCost, timeMs)` (FU1) |
| `def_wall_hp` | defense | `getFenceSegmentMaxHp` читает `mods.wallHpMul` (FU2) |
| `def_repair_efficiency` | defense | `tryRepairFenceSegmentAt`: `seg.hp += seg.maxHp * repairEfficiencyMul` (FU2) |
| `def_repair_cost` | defense | `tryRepairFenceSegmentAt`: `costCoins *= repairCostMul` перед `applyRepairCoupon` (FU2) |
| `eco_repair_discount` | economy | тот же `repairCostMul` read в `tryRepairFenceSegmentAt` (FU2, shared mod) |
| `eco_crit_kill_bonus` | economy | death-FX coin-award site → `talentsApi.onKill(...)` с `isCrit` (FU2) |
| `eco_tax_relief` | economy | `performMerge` / `_performUndergroundMerge` / `_performCrossHangarMerge` → `_applyMergeLevelBonus(level)` (game.js, rebrand 2026-05-27 «Гениальный инженер») |
| `eco_voucher` | economy | через `onKill` (kill-side counter) + `onBuyTank` (buy-side discount apply) (FU2) |
| `eco_lottery` | economy | через `onBuyTank` (FU2) |
| `eco_clean_defense` | economy | `beginNoRepairAttackWaveEpisode` (`onWaveStart`) + zombie-death FX (accumulators) + `finalizeNoRepairAttackWaveEpisode` (`onWaveEnd`) (FU3) |
| `eco_grey_to_damage_points` | economy | `applyDamageToZombie` (`onOverkill` на killing blow с overkill amount) + `onWaveEnd` (выплата через `addTankDamageDealt`) (FU3) |
| `eco_upgrade_discount` | economy | 4 callsite-а: `applyCannonUpgrade` (`upgrade_guns`), `applyFenceUpgrade` + `tryUpgradeFenceLevel` (`upgrade_wall`), `applyDronUpgrade` (`upgrade_sc`) → `talentsApi.onPurchase({baseCost, kind, mods, timeMs})` (FU3) |

#### FALSE-POSITIVE (13) — уже работали через event hook до batch-серии, аудит batch#1 их пропустил

Эти таланты были помечены `BROKEN_OR_UNCERTAIN` в первом аудите, потому что эвристика не отслеживала диспетчеризацию через `talentsApi.onHit` / `onShotFired` / `onUpdate`. Деep-аналитика FU2 подтвердила: они полностью wired:

| ID | Branch | Точка входа в runtime |
|---|---|---|
| `off_acid_dot` | offense | `onHit` → `getDotState` (acid-path); тиктает через `onUpdate._applyDotDamage` |
| `off_convert_to_dot` | offense | `onHit` → `getDotState` (convert-path) |
| `off_mark` | offense | `onHit` (mark apply + damage-mul на marked target) + `renderStatusIcons` (debuff overlay) |
| `off_armor_piercing_proc` | offense | `onHit` (proc roll + damage application path) |
| `off_impulse_proc` | offense | `onHit` (proc roll + apply via fireRate buff) |
| `off_execute` | offense | `onHit` (HP-threshold execute bonus damage) |
| `off_cc_micro` | offense | `onHit` (ccChance roll, slow apply) + `renderStatusIcons` |
| `off_ramp_up` | offense | `onShotFired` (stack accumulation + fireRate bonus) |
| `off_ricochet` | offense | `onHit` (extraHits push via ricochet target search) |
| `def_regen` | defense | `onUpdate` (regen tick на сегментах с задержкой `regenDelayMs`) |
| `def_slow_field` | defense | `onUpdate` zombie-loop section (slow apply на пешеходов в радиусе) |
| `def_auto_repair` | defense | `onUpdate` (периодический heal через `autoRepairPeriodMs`) |
| `eco_interest` | economy | `onUpdate` (interest tick через `interestPeriodMs`) |

#### OK_DIRECT_MOD baseline (13) — читаются runtime'ом напрямую как `mods.X`

Эти таланты wired с момента появления адаптера `adaptTalentsV2ModsToLegacy` — у них нет helper-функции, runtime читает их через `mods.<key>` или `talentMods.<key>` в hot-path:

`off_caliber` (damageMul), `off_fire_rate` (fireRateMul), `off_range` (rangeMul), `off_aoe` (aoeMul + crowd-*), `off_orbit_speed` (orbitSpeedMul), `def_armor_flat` (wallArmorMul), `eco_buy_discount` (tankBuyCostMul), `eco_coins_kill_bonus` (coinsKillMul + killBounty), `eco_coins_shot_bonus` (coinsShotMul), `eco_xp_bonus` (xpMul), `eco_double_reward` (doubleRewardChanceKill/Shot), `eco_bulk_buy` (bulkBuy + tankBuyCostMul=0.75), `eco_century_contract` (centuryContract + tankBuyCostMul=0.65).

#### OK_HELPER baseline (4) — активки и pulse / barrage, wired с baseline

`off_pulse_aoe` (`getPulseShotMultiplier` вызывается из shot pipeline), `off_active_barrage` (`activateOffenseActive` + `getBarrageMul`), `def_active_dome` (`activateDefenseActive` + `getActiveDomeDamageMul`), `eco_active_golden_hour` (`activateEconomyActive` + `getActiveState`).

#### DESIGN-DEAD (1) — заявлен в JSON, но runtime-архитектура его обнуляет

| ID | Branch | Mod | Архитектурный конфликт |
|---|---|---|---|
| `def_broken_dr` | defense | `brokenSegmentDamageMul` (base 1, perRank −0.06: «снижение урона по сломанным сегментам») | `applyFenceSegmentDamage` (`game.js:8569`) выполняет ранний `return false` для любого сегмента с `seg.broken === true` (`if (!seg || seg.broken) return false;`). Это означает: сломанные сегменты вообще не получают входящий урон в текущей damage-model. Талант, который должен снижать урон по broken-сегментам, фактически не имеет surface для действия. |

**Требуется отдельное design-решение от автора:**
- **Вариант A.** Удалить талант из `talentTree_v2.json` и из i18n-файлов (`ru.json` / `en.json`), а UP-стоимость перебалансировать на других слотах defense-3 тира.
- **Вариант B.** Изменить семантику таланта на «снижение урона по NEAR-broken сегментам» (например, HP ниже порога `wallBarrierHpThreshold = 0.5`) и подключить новый mod-read внутри `applyFenceSegmentDamage` ДО `if (seg.broken) return false`.
- **Вариант C.** Изменить damage-model: разрешить partial damage по `broken` сегментам (например, через offline накапливаемый damage, который применится при repair). Это самое инвазивное изменение, затрагивает balance-контракт.

**Текущий статус:** талант объявлен в JSON, в UI отображается с описанием и расчётом, игрок может вкладывать UP в него, но игровое поведение остаётся идентичным при rank 0 и rank 5. Это **скрытый бесполезный slot**, который желательно либо чинить, либо удалять.

#### UNCERTAIN / UNVERIFIED (0)

Нет талантов без подтверждения. Все 51 таланта пройдены через wire-up audit или классифицированы как DESIGN-DEAD.

#### NOT-IMPLEMENTED (0)

Нет талантов, объявленных в JSON, но полностью игнорируемых runtime'ом. Все используют либо direct-mod path, либо event dispatcher.

### Итоговая таблица по статусам

| Категория | Талантов | % |
|---|---|---|
| WIRED (новое подключение в batch-серии) | 20 | 39.2% |
| OK_DIRECT_MOD baseline | 13 | 25.5% |
| OK_HELPER baseline (активки + pulse) | 4 | 7.8% |
| FALSE-POSITIVE (уже работали через events) | 13 | 25.5% |
| **DESIGN-DEAD** | **1** | **2.0%** |
| UNCERTAIN / NOT-IMPLEMENTED | 0 | 0% |
| **Итого** | **51** | **100%** |

**Effective wire-up coverage: 50/51 = 98.0%.** Один талант (`def_broken_dr`) требует design-decision: либо удалить из JSON, либо переинтерпретировать семантику.

### Регрессионная защита

`ci/check_talent_helpers.cjs` (запускается через style-check pipeline) проверяет инвариант:

> Если в `var api = { ... }` блоке `src/systems/talents/talentsV2.js` экспортирован публичный диспетчер из канонического набора (`onHit`, `onWallDamage`, `onUpdate`, `onShotFired`, `onKill`, `onBuyTank`, `onPurchase`, `onWaveStart`, `onWaveEnd`, `onOverkill`, `applyRepairCoupon`, `tickStatuses`, `renderStatusIcons`, `activateOffenseActive`, `activateDefenseActive`, `activateEconomyActive`, `clearRuntimeEffects`), то хотя бы один callsite `<ident>.<dispatcherName>(` должен присутствовать в `game.js` или `src/**/*.js`.

Текущий статус guard:

```
[check_talent_helpers] OK — 17 wired, 3 TODO-allow-listed, 20 total exported dispatchers checked.
```

В `ALLOWED_UNWIRED_TODO` остаются три имени:

- `onShotReward` — отдельный shot-reward event path (eco_coins_shot_bonus сейчас wired через direct-mod `coinsShotMul`; event-вариант не используется).
- `onRepair` — **intentional skip**: канонический путь идёт через `applyRepairCoupon` + прямые reads `repairCostMul` / `repairEfficiencyMul` в `tryRepairFenceSegmentAt`; полный `onRepair` дублирует pricing и конфликтует с `FR.getFenceRepairCostCoins`.
- `onZombieNearWall` — proximity event (def_slow_field core wired через `onUpdate`; proximity-variant отложен).

Если позже один из них получит callsite в runtime, имя должно быть удалено из `ALLOWED_UNWIRED_TODO` чтобы invariant зафиксировал новый wire-up.

### Резюме одной строкой

**50 из 51 талантов реально работают в текущем runtime. Единственный не-wired талант — `def_broken_dr` — является DESIGN-DEAD (несовместим с текущей damage-model для broken сегментов), и его судьба — отдельный design-вопрос: удалить, переинтерпретировать на near-broken сегменты, либо изменить damage-model.**


---

## Append-only update от batch `solo-pipeline-yandex-vk#1` (wall-upgrades rebrand, 2026-05-23)

Пять defense-талантов rebranded в этом батче. Runtime `id` сохранён, обновлены display names + behaviour. Это меняет статусы из предыдущих итераций аудита.

### Реклассификация

| Runtime id | Новое имя (RU) | Старая запись аудита | Новая запись |
|---|---|---|---|
| `def_stun_on_hit` | Стены под напряжением | WIRED via `onWallDamage` (FU1) | **WIRED via `onWallDamage` + `stepZombies` consume gate** — write `cc.stunUntilMs = Math.max(prev, nowMs+500)` в `talentsV2.js:3215`, consume в `game.js → stepZombies` через `Date.now()` перед `shouldMove` и перед dispatch attack. До этого батча stun писался, но движение/атака зомби его не читали (movement+attack gate отсутствовал). |
| `def_second_wind` | Экстренное восстановление | WIRED via `onWallDamage` (FU1, secondWindUsed flag) | **WIRED via per-segment serialized cooldown** — флаг `seg._defRt.secondWindUsed = true` заменён на `seg.secondWindReadyAtMs` (на самом `seg`, не внутри `_defRt`). Cooldown 3 мин, восстанавливает 20% HP. Save-surviving: хранится прямо на segment, переживает save/load. |
| `def_broken_dr` | Повреждения во благо | **DESIGN-DEAD** (брак: damage-model отбрасывает damage по `seg.broken`) | **WIRED** (репурпос: tiered non-stacking armor bonus). Damage-path читает `mods.damageBlessingTiers` (Array<{hpThreshold, armorMul}>). Резолюшн — наивысший подходящий tier по живому `seg.hp/seg.maxHp` (не аддитивный стек). 5 рангов: +6/12/18/24/30% брони при HP < 75/50/25/15/7%. **Талант больше не DESIGN-DEAD.** |
| `def_auto_repair` | Защита на опережение | FALSE-POSITIVE via `onUpdate` (autoRepairPeriodMs heal-tick) | **WIRED via `onUpdate` phase scheduler** — старый periodic HP heal заменён на armor-phase scheduler. Две non-overlapping фазы: analyze 8s ↔ buff (armor +3% per rank) 8s, переключаемые через `segRt.protectAheadAnalyzeUntilMs` / `segRt.protectAheadBuffUntilMs`. Damage-path читает `mods.protectAheadArmorPerRank` ТОЛЬКО когда `protectAheadBuffUntilMs > timeMs`. Армор-бонус **additive** с `damageBlessingTiers` и `wallArmorFlat`. |
| `def_repair_efficiency` | Адаптация под дронов | WIRED via `tryRepairFenceSegmentAt` (heal multiplier, FU2) | **WIRED via `droneTalentSpeedBonus` в `src/mechanics/drones.js`** — старый `repairEfficiencyMul` heal-multiplier удалён из `tryRepairFenceSegmentAt`. Новый mod `droneTalentSpeedBonus` snapshot'ится в `finalRepairMult` (drones.js), tap = full HP сохраняется. Теперь талант ускоряет drone repair speed (per-rank +2%), а не меняет heal-amount cost-based ремонта. |

### Side-effect: ранее DESIGN-DEAD класс пуст

После этого батча `def_broken_dr` переведён из DESIGN-DEAD в WIRED. **DESIGN-DEAD категория теперь содержит 0 талантов** из 51. Effective wire-up coverage = **51/51 = 100%**.

### Mod schema additions

В `getMods()` шаблоне зарезервированы новые нейтральные ключи (используются rebranded талантами):

- `damageBlessingTiers: Array<{hpThreshold:number, armorMul:number}> | null` — список лестничных tier-ов, отсортированных по убыванию `armorMul`. Damage-path выбирает наивысший подходящий по живому `seg.hp/seg.maxHp` (non-stacking).
- `protectAheadAnalyzeMs: number` (по умолчанию 0) — длительность analyze фазы.
- `protectAheadBuffMs: number` (по умолчанию 0) — длительность buff фазы.
- `protectAheadArmorPerRank: number` (по умолчанию 0) — armor-бонус, применяемый damage-path внутри buff фазы.
- `droneTalentSpeedBonus: number` (по умолчанию 0) — additive bonus к скорости ремонта дронами (snapshot в `finalRepairMult`).
- `protectAhead: boolean` (по умолчанию false) — unlock flag.

### Save-surface change

- `seg.secondWindReadyAtMs` теперь сериализуется как часть segment state. `seg._defRt.secondWindUsed` удалён. Backward-compat: legacy сейвы без поля корректно начинают с 0 (готово к выдаче).

### Регрессионный guard после батча

`ci/check_talent_helpers.cjs` не меняет статус: все 5 талантов всё ещё доступны через канонические dispatcher-ы (`onWallDamage`, `onUpdate`). Wire-up matrix остаётся прежней.
