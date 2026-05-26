# Talents v2 (Data-Driven Contract)

Этот документ фиксирует data-контракт PACK 1 для дерева талантов v2. По нему можно добавить новый талант без чтения runtime-кода.

## Файл

- Путь: `assets/balance/talentTree_v2.json`
- Назначение: единый источник правды для структуры веток, талантов, параметров эффектов и caps.

## Верхний уровень JSON

- `version: number` — версия формата (для v2: `2`).
- `tierUnlockSpent: number[]` — пороги открытия tier по потраченным очкам (`[0,5,10,20,30]`).
- `branches: Array<{ id, nameKey }>` — список веток UI.
  - Канонические `id`: `offense`, `defense`, `economy`.
- `talents: Talent[]` — полный список талантов (для дефолта v2: 51).
- `caps: Record<string, number>` — глобальные капы/ограничения параметров.

## Обязательные поля таланта

Каждый объект в `talents` обязан содержать:

- `id: string` — стабильный канонический идентификатор.
- `branch: "offense" | "defense" | "economy"`.
- `tier: 1 | 2 | 3 | 4 | 5`.
- `maxRank: number`.
- `costPerRank: number` (в v2 дефолт: `1`).
- `requires: string[]` — зависимости по `id` (может быть `[]`).
- `ui: { nameKey: string, descKey: string, icon: string }`.
- `effects: Effect[]`.

## Семантика `effects`

### 1) `stat_add`

```json
{ "type": "stat_add", "stat": "wallArmorFlat", "perRank": 2 }
```

- Аддитивный прирост статистики за каждый ранг.

### 2) `stat_mul`

```json
{ "type": "stat_mul", "stat": "damageMul", "perRank": 0.07 }
```

- Мультипликативный прирост статистики за каждый ранг.
- `perRank = 0.07` означает `+7%` за ранг.

### 3) `unlock`

```json
{ "type": "unlock", "key": "offenseActive" }
```

- Включает фичу/механику по ключу.

### 4) `param`

```json
{ "type": "param", "key": "doubleShotChance", "base": 0, "perRank": 0.04, "max": 0.45 }
```

или

```json
{ "type": "param", "key": "pulseAoeEveryN", "base": 8, "perRank": -1, "min": 3 }
```

или

```json
{ "type": "param", "key": "offenseActiveDurationMs", "value": 10000 }
```

- Поддерживаемые поля параметризации:
  - `value` — фиксированное значение.
  - `base` + `perRank` — линейная формула по рангу.
  - `min` / `max` — локальные границы.
  - `fromRank` — начало действия параметра с указанного ранга.

## Канонический список `id` (дефолт v2)

### Offense (17)

`off_caliber`, `off_fire_rate`, `off_range`, `off_aoe`, `off_multishot`, `off_orbit_speed`, `off_acid_dot`, `off_mark`, `off_armor_piercing_proc`, `off_impulse_proc`, `off_execute`, `off_cc_micro`, `off_ramp_up`, `off_pulse_aoe`, `off_convert_to_dot`, `off_ricochet`, `off_active_barrage`.

### Defense (17)

`def_wall_hp`, `def_armor_flat`, `def_repair_cost`, `def_resists`, `def_regen`, `def_shield`, `def_slow_field`, `def_thorns`, `def_barrier_trigger`, `def_stun_on_hit`, `def_second_wind`, `def_broken_dr`, `def_auto_repair`, `def_repair_efficiency`, `def_repair_discount_timer`, `def_immunity_proc`, `def_active_dome`.

### Economy (17)

`eco_buy_discount`, `eco_upgrade_discount`, `eco_repair_discount`, `eco_coins_kill_bonus`, `eco_coins_shot_bonus`, `eco_xp_bonus`, `eco_double_reward`, `eco_interest`, `eco_tax_relief`, `eco_voucher`, `eco_lottery`, `eco_clean_defense`, `eco_grey_to_damage_points`, `eco_crit_kill_bonus`, `eco_bulk_buy`, `eco_century_contract`, `eco_active_golden_hour`.

## Описания узлов: канонический `{current}`-template (solo-pipeline-yandex-vk#1, 2026-05-18)

Описания узлов в `src/i18n/{ru,en}.json` используют единый канон «Калибра»:

> «Постоянно [увеличивает/снижает] [параметр] на X% за ранг. Текущая прибавка [параметра] - `{current}`%»

Renderer `getTalentNodeDescriptionV2(node, rank)` (game.js, L12475+):

- вычисляет `effectiveRank = appliedRank + pendingRank` (т.е. показывает «pending» применение в hangar до commit);
- если у узла есть `effects[*].perRank` в `assets/balance/talentTree_v2.json`, `currentDisplay = round(perRank * 100 * effectiveRank)`;
- иначе fallback: regex парсит `X%` из шаблона описания (поддерживает форматы «6% за ранг» / «+6% к ...»);
- финально подставляется через `descText.replaceAll('{current}', String(currentDisplay))`.

При `rank=0` подставляется `{current}=0` — это корректное поведение, отражающее «не вложено в этот узел».

Узлы с обновлёнными описаниями (`{current}`-template): `off_fire_rate`, `off_range`, `off_aoe` (расширенное описание с crowd-бонусом), `off_orbit_speed`, `def_wall_hp`, `def_armor_flat`, `def_repair_cost`, `eco_buy_discount`, `eco_upgrade_discount`, `eco_repair_discount`.

## Display rename: `off_orbit_speed` → «Реактивное топливо» (solo-pipeline-yandex-vk#1, 2026-05-18)

Узел с runtime `id = off_orbit_speed` теперь отображается как:

- RU: «Реактивное топливо» (бывш. «Разгон орбиты»);
- EN: «Reactive Fuel» (formerly «Orbit Acceleration»).

Runtime `id` не меняется — это сохраняет совместимость с сейвами и `MIGRATE_V1_TO_V2`. См. также [docs/migration_talents_v1_to_v2.md](migration_talents_v1_to_v2.md).

## Дефолтное распределение `tier` / `maxRank`

- Tier-мэппинг и `maxRank` зафиксированы в `assets/balance/talentTree_v2.json` как baseline v2.
- `maxRank = 1` для: `off_armor_piercing_proc`, `off_impulse_proc`, `off_active_barrage`, `def_barrier_trigger`, `def_second_wind`, `def_dome` (rebrand `def_active_dome` → `def_dome`, 2026-05-24, см. fence-upgrades-rework), `eco_bulk_buy`, `eco_century_contract`, `eco_active_golden_hour`.
- Для остальных дефолт `maxRank = 5`.

## `ui.icon` ключи и ассеты

- Иконки талантов: `assets/ui/icons/talents/<icon>.png`
- Иконки статусов: `assets/ui/icons/status/<status>.png`
- В PACK 1 допустим placeholder (одна и та же PNG), но имя файла должно быть стабильным.

### Canonical `ui.icon` keys (talents)

`bullet`, `firerate`, `range`, `aoe`, `multishot`, `orbit`, `armorPiercing`, `impulse`, `acid`, `mark`, `execute`, `cc`, `ramp`, `pulse`, `convert`, `ricochet`, `activeOff`, `wallHp`, `armor`, `repair`, `resists`, `regen`, `shield`, `barrier`, `thorns`, `slowField`, `stun`, `secondWind`, `broken`, `autoRepair`, `repairEff`, `explosive`, `immunity`, `activeDef`, `buy`, `bulk`, `contract`, `upgrade`, `coinsKill`, `coinsShot`, `xp`, `doubleReward`, `crit`, `interest`, `tax`, `clean`, `voucher`, `lottery`, `grey`, `activeEco`.

> Rebrand 2026-05-24 (fence-upgrades-rework, batch `solo-pipeline-yandex-vk#1`): иконка `repairDiscount` заменена на `explosive` после перевода таланта `def_repair_discount_timer` → `def_explosive_base` («Взрывное основание»). Display name `immunityProc` → «Случайная неразрушимость»; `def_active_dome` → `def_dome` («Купол»). Runtime `id` талантов остаются стабильными для save-compat через `MIGRATE_V1_TO_V2`.

### Canonical status keys

`status_armorPiercing`, `status_impulse`, `status_killBounty`, `status_ramp`, `status_activeOff`, `status_acid`, `status_convert`, `status_mark`.

## TalentsV2 runtime API (PACK 4)

Runtime модуль: `src/systems/talents/talentsV2.js`.

Публичный контракт: `Game.TalentsV2.*`

- `init({ loadSaveFn, saveFn, assetLoader, nowMsFn }) => Promise<TreeMeta>`
  - грузит `assets/balance/talentTree_v2.json`, валидирует, нормализует, подтягивает ранги/очки из save.
- `loadTree() => Promise<TreeNormalized>`
  - отдельная перезагрузка дерева талантов.
- `getTreeMeta() => { version, branches, tierUnlockSpent, caps }`
- `getTalentUi(talentId) => { nameKey, descKey, icon } | null`
- `getRanks() => Record<talentId, rank>`
- `setRanks(ranksById)`
  - внутренний setter (используется при load/save интеграции).
- `getFreePoints() => number`
- `setFreePoints(value)`
  - вызывается из achievement grant-path'ов (`achievementRewards.js`, `achievements.js`, `game.js → grantAchievementReward`) для синхронизации runtime при выдаче `upgradePoints` наград.
- `syncFromSave(payload)`
  - пост-restore синхронизация runtime из save payload: обновляет `ranksById/freePoints`, очищает pending-выбор и инвалидирует кеш модификаторов.
- `getBranchSpent(branchId) => number`
- `getUnlockedTier(branchId) => 1..5`
- `canBuy(talentId) => { ok: boolean, reason?: 'no_points'|'tier_locked'|'requires'|'max_rank'|'unknown' }`
- `buyRank(talentId) => { ok, rank?, freePoints?, reason? }`
- `refundAll()` / `respec()`
- `getMods() => Mods`
  - ленивый пересчёт, кеш + `modsDirty`.
- `computeModsFromTalents(tree, ranksById) => Mods`
  - pure data-driven агрегация эффектов из JSON.
- Боевые hook API:
  - `onShotFired({ tank, timeMs, rng? }) => RampState | null`
  - `onHit({ tank, zombie, timeMs, damage, isCrit, source, isAoe, aoeVictimsCount, zombies?, getZombiePos?, rng? }) => { damage, extraHits? }`
  - `onKill({ tank, zombie, timeMs, source? })`
- Прочие hooks/runtime API:
  - `onWaveStart`, `onWaveEnd`, `onRepair`, `onBuyTank`, `onPurchase`, `renderStatusIcons`.

### Hook contracts (боёвка PACK 4)

#### `onShotFired(ctx)`

- Обязательные поля: `tank`, `timeMs`.
- Что делает:
  - инкрементирует `tank._talentRt.counters.shots`;
  - обновляет ramp runtime через `_onShotCounterAndRamp(...)`;
  - роллит per-shot procs для **этого же танка**: `armorPiercing`, `impulse`, `killBounty`.
- Правила procs:
  - roll/ICD/duration полностью data-driven из `mods`;
  - refresh/no-stack: повторный прок только перезаписывает `untilMs`;
  - `killBounty` баф активируется на `onShotFired` и влияет только на убийства этого танка.

#### `onHit(ctx)`

- Обязательные поля: `tank`, `zombie`, `timeMs`, `damage`.
- Рекомендуемые поля интеграции: `source`, `isAoe`, `aoeVictimsCount`, `zombies`, `getZombiePos`.
- Возвращает:
  - `damage` — прямой урон после всех модификаторов и `convertToDot`;
  - `extraHits` — опциональный список доп. попаданий для рикошета.

Точный порядок применения модификаторов (фиксированный):

1. Глобальные пассивы: `d *= mods.damageMul`.
2. Временные per-tank бафы:
   - `armorPiercing` активен → `d *= mods.armorPiercingProcDamageMul`;
   - `offenseActive` активен → `d *= mods.offenseActiveDamageMul`.
3. Ramp stacks: **не** модифицируют `d` в `onHit` (влияют только на fire-rate).
4. Mark по цели: если цель помечена (`markUntilMs > timeMs`) → `d *= mods.markDamageTakenMul`.
5. Execute: если `zombie.hp / zombie.maxHp <= mods.executeHpThreshold` → `d *= (1 + mods.executeDamageMul)`.
6. Pulse every N shots: если `shots % N === 0` (`N = pulseEveryNShots|pulseAoeEveryN`) → `d *= pulseDamageMul|pulseAoeDamageMul`.
7. Crowd bonus: только для AOE-hit, если `isAoe===true` и `aoeVictimsCount >= mods.crowdMinCount` → `d *= mods.crowdAoeDamageMul`.
8. `finalDamage = d`.
9. Post-hit статусы/проки (в этом порядке): `acid DOT`, `mark`, `ccMicro`, `ricochet`, `convertToDot`.

`source='ricochet'` ограничение:

- ricochet-hit считается «только урон»: без вторичных проков (`acid/mark/cc/convert/ricochet`).

#### `onKill(ctx)`

- В PACK 4 контракт оставлен для интеграции экономики/атрибуции в следующих пакетах.
- DOT-kill не обязан иметь `killerTank` и в PACK 4 не должен эмулироваться как tank-kill.

## Save integration (PACK 7, с миграцией v1 -> v2)

- Модуль поддерживает оба входа:
  - `save.talentsV2 = { ranksById, freePoints }`;
  - `save.player.talentsV2 = { ranksById, freePoints }`.
- Поддерживаются поля очков:
  - `save.freeTalentPointsV2` или `save.player.freeTalentPointsV2`.
- Если `talentsV2` отсутствует: инициализация в пустое состояние (`{}` + `0`), загрузка не ломается.
- Для сценариев полного restore state (`Load`/start-from-save/restart через big menu) после `restoreFullState(...)` обязателен post-restore шаг синхронизации TalentsV2 runtime через `syncFromSave(payload)` (в проекте вызывается через единый `postRestoreSync`).

### Контракт миграции v1 -> v2

- Триггер: если `talentsVersion` отсутствует или `< 2`, в `init() -> loadFromSave()` вызывается `migrateTalentsV1toV2(...)`.
- После миграции сразу сохраняется patch:
  - `talentsVersion: 2`
  - `talentsV2: { ranksById, freePoints }`
  - `freeTalentPointsV2: freePoints`
- Повторный запуск при `talentsVersion >= 2` не выполняется (идемпотентно).

### Extract adapter для legacy v1

- `extractV1Talents(save) -> Array<{ name, rank, bought }>`.
- `extractV1Points(save) -> { spent, free }`.
- Fail-soft правила:
  - если v1 хранит rank -> используется rank;
  - если v1 хранит bool bought -> `rank=1`;
  - если имя есть, но rank невалиден -> `rank=1`;
  - неизвестные имена не угадываются и идут в refund.

### Refund / unknown / clamp

- Для unknown-имён и неперенесённых legacy-рангов считается `refund`.
- Для каждого v2 таланта применяется clamp по `maxRank` из дерева.
- `freePoints` после миграции считается как:
  - `max(0, (spent + free) - spentV2) + refund`.

### Каноническая map-таблица

- Источник правды: `MIGRATE_V1_TO_V2` в `src/systems/talents/talentsV2.js`.
- Поддерживаемые legacy-имена перечислены в `docs/migration_talents_v1_to_v2.md`.
- Для расширения миграции добавляется только новая запись в map (алгоритм не меняется).

## Mods contract

`getMods()` всегда возвращает полный объект с гарантированными ключами:

- **Multipliers** (нейтральное значение `1`):
  - `damageMul`, `fireRateMul`, `rangeMul`, `aoeMul`, `orbitSpeedMul`,
  - `coinsKillMul`, `coinsShotMul`, `xpMul`,
  - `wallHpMul`, `tankBuyCostMul`, `repairCostMul`,
  - `upgradeCostMul_guns`, `upgradeCostMul_sc`, `upgradeCostMul_wall`,
  - `taxReliefCostMul`, `voucherDiscountMul`,
  - `brokenSegmentDamageMul`, `markDamageTakenMul`,
  - `acidDotDpsMul`, `pulseAoeDamageMul`, `pulseAoeMul`, `ricochetDamageMul`,
  - `impulseProcFireRateMul`, `repairEfficiencyMul`, `repairDiscountTimerCostMul` (legacy, оставлен после rebrand 2026-05-24 для backward-compat сохранений; новый `def_explosive_base` его не использует),
  - `defenseActiveDamageTakenMul`, `killBountyCoinsMul`,
  - `economyActiveCoinsMul`, `economyActiveXpMul`, `crowdAoeDamageMul`,
  - `offenseActiveDamageMul`, `offenseActiveFireRateMul`, `offenseActiveOrbitMul`, `offenseActiveAoeMul`.
- **Additive / chances / percents** (нейтральное значение `0`):
  - все `*Chance`, `*Pct`, `*Flat`, `*Threshold`, `*Radius`, `*EveryN`, `*Max`, `*Need`, `*Cap`, `*Bonus*`, `*Bounces*`;
  - `executeDamageMul` (в `onHit` применяется как `1 + executeDamageMul`).
  - Numeric params `def_explosive_base` (rebrand 2026-05-24): `explosiveBaseDamagePerRank` (default `100000`, additive per rank), `explosiveBaseRadiusPx` (default `300`, world-pixels AoE radius), `explosiveBaseDamageCapPerFrame` (default `600000`, безопасный потолок суммарного урона за один тик детонации). Все три читаются helper-ом `applyExplosiveBaseDetonation` в `src/systems/talents/talentsV2.js` L3347+; вызывается из `game.js` в fragment-destroyed seams L3347 / L4484 / L8902-8938.
- **Durations / timers** (нейтральное значение `0`):
  - все `*DurationMs`, `*PeriodMs`, `*IcdMs`, `*RechargeMs`, `*DelayMs`, `*TickMs`, `*GraceMs`.
- **Modes**:
  - `ccMicroMode`, `convertToDotStackMode` (нейтральное значение `null`).
- **Unlock flags** (нейтральное значение `false`):
  - `offenseActive`, `defenseActive`, `economyActive`,
  - `acidDot`, `armorPiercingProc`, `impulseProc`, `mark`, `execute`, `ccMicro`, `rampUp`, `pulseAoe`, `convertToDot`, `ricochet`,
  - `wallShield`, `slowField`, `thorns`, `wallBarrier`, `stunOnWallHit`, `secondWind`, `autoRepair`, `explosiveBase` (rebrand 2026-05-24, был `repairDiscountTimer`; runtime id таланта `def_explosive_base`), `immunityProc` (display «Случайная неразрушимость»),
  - `bulkBuy`, `centuryContract`, `cleanDefense`, `greyToDamagePoints`, `interest`, `taxRelief`, `voucher`, `lottery`, `killBounty`.

## Effect application rules (PACK 2)

- `stat_add`: `mods[stat] += perRank * rank`.
- `stat_mul`: единая семантика по всем ключам
  - `mods[stat] *= (1 + perRank * rank)`
  - (при нейтральном старте `1`).
- `unlock`: `mods[key] = (rank > 0)`.
- `param`:
  - если задан `value`: при `rank > 0` присвоить `mods[key] = value`;
  - иначе формула `base + perRank * rank`;
  - `fromRank`: если `rank < fromRank` — параметр не применяется;
  - `min/max`: clamp результата;
  - коллизии по `key`: детерминированно **last wins**, в dev режиме `console.warn`.

## Caps rules

- Точечные caps:
  - `doubleShotChance`, `tripleShotChance`, `ricochetChance`;
  - `doubleRewardChance` применяется к `doubleRewardChanceKill` и `doubleRewardChanceShot`;
  - `resistPct` применяется к `resistAcidPct`, `resistExplosionPct`, `resistFirePct`.

### Multishot ladder (батч 2026-05-20)

Талант `off_multishot` объявляет два независимых параметра, но runtime применяет их по **взаимоисключающей лестнице** (rank 4+ открывает triple):

- сначала бросается `tripleShotChance`;
- при провале — `doubleShotChance`;
- двойной и тройной залп не могут сработать в одном выстреле.

Тир сохраняется в локальную переменную `_multishotTier ∈ {1, 2, 3}` и используется для:

- количества дополнительных `spawnBurst()` вызовов (1 → нет добора, 2 → +1, 3 → +2). **Экстра-залпы планируются через `setTimeout` с задержкой `[80ms, 160ms]`** (паттерн тот же, что у комбо-чипа `chipShotMods.comboShots`), чтобы игрок видел и слышал танк, стреляющий 2/3 раза подряд, а не один залп-«ёжик»;
- усиления burst-VFX через `_multishotScale` (1 / 1.4 / 1.8) и `burstColor` (белый / тёплый жёлтый `rgba(255,225,140,*)` / оранжевый `rgba(255,170,80,*)`). **Для каждого отложенного залпа дополнительно рисуется burst + проигрывается тот же shoot-клип** — синхронно с задержкой spawnBurst, чтобы вспышка и звук совпадали со стартом снаряда;
- частицы по-прежнему берутся из общего pool с clamp на `MAX_BURST_PARTICLES`; setTimeout-closure создаётся только когда multishot реально срабатывает, а не на каждом выстреле.

В балансовом sim `tools/balance-shared.js` это отражено формулой
`avgProjectiles = 1 + double*(1 - triple) + triple*2` — exclusive-ladder вместо прежнего independent-стека (1 + double + triple\*2).

Адаптер (`game.js → adaptTalentsV2ModsToLegacy`) теперь:

- явно прокидывает `tripleShotChance` с clamp `[0, 0.5]`;
- добавляет в конце generic numeric-passthrough loop по всем `param`-effects, чтобы любые новые числовые ключи (`*Chance`, `*Pct`, `*Mul`, `*Ms` и т.д.) пробрасывались без отдельной правки адаптера.

UI tooltip-template таланта поддерживает `ui.currentVars: { currentDouble, currentTriple }`, и i18n-строки `talent_off_multishot_desc` в `ru.json`/`en.json` используют `{currentDouble}` / `{currentTriple}` с пометкой «залпы взаимоисключающие».
- Generic caps:
  - `caps.someKey` → верхняя граница `mods.someKey` (если ключ числовой);
  - `caps.someKeyMin` → нижняя граница `mods.someKey`.

## Runtime state on entities (PACK 3)

TalentsV2 runtime хранится на боевых сущностях и создаётся лениво при первом доступе через `ensure*`-helpers.

- `ensureTankRt(tank)`
- `ensureZombieRt(zombie)`
- `ensureSegRt(seg)`

### Tank runtime

```js
tank._talentRt = {
  buffs: {
    armorPiercing: { untilMs: 0 },
    impulse: { untilMs: 0 },
    killBounty: { untilMs: 0 },
    offenseActive: { untilMs: 0 }
  },
  icdUntil: {
    armorPiercing: 0,
    impulse: 0,
    killBounty: 0
  },
  counters: { shots: 0 },
  ramp: {
    stacks: 0,
    lastShotAtMs: 0,
    nextTickAtMs: 0
  }
};
```

### Zombie runtime

```js
zombie._statusRt = {
  dots: {
    acid: { untilMs: 0, dps: 0, nextTickMs: 0 },
    converted: { untilMs: 0, dps: 0, nextTickMs: 0 }
  },
  markUntilMs: 0,
  cc: {
    slowUntilMs: 0,
    stunUntilMs: 0,
    icdUntilMs: 0
  }
};
```

### Wall segment runtime

```js
seg._defRt = {
  shieldHp: 0,
  barrierUntilMs: 0,
  barrierIcdUntilMs: 0,
  lastDamageAtMs: 0,
  // batch solo-pipeline-yandex-vk#1 (wall-upgrades rebrand, 2026-05-23):
  // secondWind перешёл с one-shot flag на per-segment serialized cooldown.
  // Cooldown timestamp хранится на `seg.secondWindReadyAtMs` (НЕ внутри _defRt),
  // чтобы пережить save/load: см. talentsV2.js → `getSecondWindReadyAt(seg)`.
  immunityUntilMs: 0,
  immunityIcdUntilMs: 0,
  stunIcdUntilMs: 0,
  thornsIcdUntilMs: 0,
  nextShieldAtMs: 0,
  nextAutoRepairAtMs: 0,
  // protectAhead phase scheduler (item 3 batch solo-pipeline-yandex-vk#1).
  // Две non-overlapping фазы: analyze [now..analyzeUntilMs] → buff [analyzeUntilMs..buffUntilMs].
  // По истечении buff фазы стартует новый analyze. Армор-бонус читается damage-path,
  // только когда `protectAheadBuffUntilMs > timeMs`.
  protectAheadAnalyzeUntilMs: 0,
  protectAheadBuffUntilMs: 0
};
// На самом seg (вне _defRt), save-surviving:
seg.secondWindReadyAtMs = 0;
```

### Run runtime (global per run, PACK 5)

```js
TalentsV2._runRt = {
  wave: { damageToWalls: false },
  eco: {
    vouchers: 0,
    voucherKills: 0,
    lotteryUsed: 0,
    lotteryIcdUntilMs: 0,
    interestNextAtMs: 0,
    taxReliefUntilMs: 0,
    greyDamage: 0,
    repairDiscountReady: false, // legacy, оставлен после rebrand `def_repair_discount_timer` → `def_explosive_base` (2026-05-24); новый AoE-талант их не пишет и не читает, поля сохранены ради save-compat и потенциального возврата старой механики
    nextRepairDiscountAtMs: 0 // legacy, см. комментарий выше
  },
  actives: {
    defense: { untilMs: 0, charges: 0, nextRechargeAtMs: 0 },
    economy: { untilMs: 0, charges: 0, nextRechargeAtMs: 0 }
  }
};
```

- Это runtime-данные текущего ранa (глобальные, не на сущностях).
- Поля `_talentRt/_statusRt/_defRt` и `_runRt` не включаются в save payload TalentsV2 по умолчанию.
- Следствие: при перезапуске приложения `vouchers/lotteryUsed/greyDamage` сбрасываются (ожидаемое поведение без отдельного run-save контура).

## Timing helpers (refresh / no-stack / ICD)

TalentsV2 предоставляет утилиты тайминга (используются в PACK 4/5):

- `isActive(untilMs, nowMs)` → true если `untilMs > nowMs`.
- `refreshUntil(nowMs, durationMs)` → `nowMs + durationMs`.
- `canProc(nowMs, icdUntilMs)` → true если `nowMs >= icdUntilMs`.
- `startIcd(nowMs, icdMs)` → `nowMs + icdMs`.
- `rollChance(rng, chance)` → ролл шанса с clamp `chance` в `[0..1]`.

Правило per-tank buff refresh/no-stack:

- повторный прок активного бафа **не** добавляет стаки;
- обновляется только `untilMs = nowMs + durationMs`;
- helper: `refreshTankBuff({ tank, buffKey, nowMs, durationMs })`.

## DOT tick engine (FPS-independent)

Публичный апдейтер: `tickStatuses({ timeMs, dtMs, zombies })`.

- Фиксированный шаг DOT: `200ms`.
- Для каждого `zombie._statusRt.dots[acid|converted]`:
  - если `timeMs >= untilMs` — DOT неактивен, `nextTickMs` сбрасывается в `0`;
  - если активен и `nextTickMs === 0` — инициализация `nextTickMs = timeMs + 200`;
  - далее догоняющий цикл `while (timeMs >= nextTickMs)`.
- На каждом тике:
  - `dotDamage = dps * (200 / 1000)`;
  - вызов универсального хука `_applyDotDamage({ zombie, source, damage, timeMs })`;
  - `nextTickMs += 200`.

`_applyDotDamage` в PACK 4:

- снимает `zombie.hp` на `damage`;
- при `hp <= 0` оставляет `zombie.hp = 0` и не назначает `killerTank`;
- не вызывает tank-attributed `onKill` (DOT-kill без attribution в этой версии).

## Ramp runtime (state only)

Helper: `_onShotCounterAndRamp({ tank, timeMs, mods })`.

- Инкрементирует `tank._talentRt.counters.shots`.
- Поддерживает runtime-состояние ramp в `tank._talentRt.ramp`:
  - при паузе `timeMs - lastShotAtMs > rampGraceMs` → reset `stacks=0`, `nextTickAtMs=0`;
  - обновляет `lastShotAtMs = timeMs`;
  - если `rampTickMs > 0`: инициализирует `nextTickAtMs`, затем делает catch-up через `while`;
  - стаки ограничиваются `rampStackMax`.

В PACK 3 это только состояние (без применения `fireRateMul` от стаков). Эффект подключается отдельно в PACK 4.

## Save boundary

Runtime-поля сущностей (`_talentRt`, `_statusRt`, `_defRt`) не включаются в save payload TalentsV2.
Сохраняются только `talentsVersion`, `talentsV2.{ranksById, freePoints}` и `freeTalentPointsV2`.

## Runtime hooks PACK 5 (Defense + Economy)

### Defense hooks

- `onWallDamage({ seg, zombie, damage, damageType, timeMs, hitPos, zombies?, getZombiePos?, applyDamage?, rng? })`
  - Возвращает: `{ damageToHp, absorbedByShield, prevented }`.
  - Детерминированный pipeline урона по стене:
    1) `immunity` (active/proc+ICD) →
    2) `armor flat` (`wallArmorFlat`) + `resists` (`fire|acid|explosion`) →
    3) `barrier` (threshold/duration/ICD) →
    4) `defense active dome` DR →
    5) `wallDrPct` →
    6) `shield absorb` →
    7) `secondWind` (один раз на сегмент).
  - Side effects:
    - `wave.damageToWalls = true`;
    - stun по атакующему зомби (`stunOnWallHitChance` + ICD);
    - thorns reflect по радиусу (`thornsPct/thornsRadius/thornsIcdMs`), без kill attribution.

- `onRepair({ seg, baseCost, baseHeal, timeMs }) -> { cost, heal, discountUsed }`
  - Применяет `repairCostMul`, `repairEfficiencyMul`.
  - Поддерживает купон по таймеру (`repairDiscount*`): выдача по периоду, одноразовое списание на ближайший repair.

- `onUpdate({ timeMs, dtMs, segments|segs, wallZombies|wallAttackers, state?|getCoins/setCoins? })`
  - Периодики (FPS-independent):
    - regen: после `regenDelayMs`/`wallRegenDelayMs`;
    - shield tick: `wallShieldPeriodMs`, пополнение `wallShieldPct`, cap `wallShieldCapPct`;
    - auto-repair: `autoRepairPeriodMs/autoRepairPct`;
    - defense active auto-repair: `defenseActiveAutoRepairPctPerSec * dt`;
    - slow field refresh у зомби у стены (`slowUntilMs = now+250`, `slowPct`).

### Economy hooks

- `onKill({ tank, zombie, baseCoins, baseXp, timeMs, isCrit, rng? }) -> { coins, xp }`
  - Применяет `coinsKillMul/xpMul`, `killBounty` баф танка, `doubleRewardChanceKill` (удваивает только coins), crit-бонусы, economy active множители.
  - Ведёт runtime voucher progress: `voucherKills`, выдача ваучера по `voucherKillsNeed`, cap `voucherCap`.

- `onShotReward({ tank, baseCoins, baseXp, timeMs, rng? }) -> { coins, xp }`
  - Применяет `coinsShotMul`, `doubleRewardChanceShot`, economy active.

- `onBuyTank({ tankTypeId, baseCost, timeMs, confirmed?, rng? }) -> { cost, applyFreeDuplicate, vouchersLeft }`
  - Цена: `tankBuyCostMul` + `taxReliefCostMul` (если active) + voucher discount.
  - Lottery: шанс/ICD/лимит (`lotteryChance/lotteryIcdMs/lotteryLimitPerRun`) -> `applyFreeDuplicate=true`.
  - При `confirmed=true` обновляет tax-relief окно: `taxReliefUntilMs = now + taxReliefDurationMs` (refresh, без stack).

- `onPurchase({ kind, baseCost, timeMs }) -> { cost }`
  - `kind: 'upgrade_sc'|'upgrade_wall'|'upgrade_guns'|'repair'`.
  - Применяет соответствующий `upgradeCostMul_*` или `repairCostMul` (+ repair coupon для repair).

- `onOverkill({ amount, timeMs }) -> { greyDamage }`
  - Копит серый overkill в `_runRt.eco.greyDamage`.

- `onWaveStart()`
  - Сбрасывает clean-defense флаг: `wave.damageToWalls=false`.

- `onWaveEnd({ baseCoins, baseXp, baseDamagePoints, state? })`
  - Clean defense: если по стенам не было урона — применяет `cleanDefenseCoinsMul/cleanDefenseXpMul`.
  - Grey conversion: `damagePointsAdd = greyDamage * greyToDamagePointsMul`, затем `greyDamage=0`.

### Actives runtime API (без UI)

- `activateDefenseActive(timeMs)` / `activateEconomyActive(timeMs)`
  - Если `charges>0`: `charges--`, `untilMs=now+duration`, запускается recharge таймер.
- Recharge выполняется в `onUpdate` через догоняющий `while`:
  - пока `timeMs >= nextRechargeAtMs` и `charges < max` -> `charges++`, `nextRechargeAtMs += rechargeMs`.

## Integration notes (PACK 5)

- Все тайминги реализованы в `ms` и не зависят от FPS (`dt` и/или catch-up `while`).
- Для `greyDamage` интеграции боёвка должна вызывать `onOverkill({ amount })`, где `amount = max(0, damage - hpBefore)`.
- Thorns/slow-field рекомендуется вызывать только в уже существующих точках «зомби у стены», чтобы не сканировать всех зомби каждый кадр.

## UI/Render contract (PACK 6)

### 1) Причины disabled в UI покупки

- `canBuy(talentId)` возвращает `{ ok:false, reason }` и для `requires` также `missingRequires[]`.
- Поддерживаемые reason-коды:
  - `tier_locked` -> `talentCantBuy_tierLocked`
  - `no_points` -> `talentCantBuy_noPoints`
  - `requires` -> `talentCantBuy_requires`
  - `max_rank` -> `talentCantBuy_maxRank`
- Для `requires` UI может показать список `missingRequires[].id` через `getTalentUi(id).nameKey`.

### 2) Контракт active UI

- `getActiveState(branchId|branchIndex, nowMs)` ->
  `{ unlocked, charges, chargesMax, nextRechargeAtMs, rechargeMs, untilMs, durationMs, isActive }`
- `branchId`: `offense|defense|economy` (или индекс `0|1|2`).
- Disabled-правило для кнопки активки:
  - `unlocked === false` ИЛИ `charges <= 0`.
- Таймер до следующего заряда:
  - `timeToNextChargeSec = max(0, ceil((nextRechargeAtMs - nowMs)/1000))`.

### 3) Активация active

- `activateOffenseActive(timeMs, { tank? })`
- `activateDefenseActive(timeMs)`
- `activateEconomyActive(timeMs)`
- Успешная активация:
  - списывает `charges`;
  - ставит `untilMs = now + durationMs`;
  - если recharge ещё не запущен — инициализирует `nextRechargeAtMs`.

### 4) Status icons (world-space only)

- `renderStatusIcons(renderCtx)` принимает минимум:
  - `{ canvasCtx, timeMs, camera, tanks, zombies }`
  - опционально `getTankPos(entity)` / `getZombiePos(entity)`.
- Рендер выполняется только в world-render боя (не в ангар/UI-списках).
- Приоритет и лимит:
  - `stun > slow > mark > dot > buffs`
  - максимум `3` иконки на entity.
- Канонический маппинг:
  - tank: `status_armorPiercing`, `status_impulse`, `status_killBounty`, `status_activeOff`, `status_ramp` (+ число stacks)
  - zombie: `status_stun`, `status_slow`, `status_mark`, `status_acid`, `status_convert`

## Validation & Debug flags (PACK 8)

### `TalentsV2.validate()`

- Новый метод: `Game.TalentsV2.validate(payload?) -> Issue[]`.
- Возвращает единый массив `errors/warnings`:
  - `level: 'error' | 'warning'`
  - `code` (машинный код)
  - `message`
  - `details` (включая `talentId/effectIndex/key` где применимо)
- Проверяет:
  - `tierUnlockSpent` (монотонность)
  - `caps.*Chance` в диапазоне `[0..1]`
  - `effects.type` только `stat_add/stat_mul/unlock/param`
  - `param/unlock/stat` ключи только из whitelist `mods`
  - `param`: `min<=max`, `*DurationMs/*IcdMs/*PeriodMs/*RechargeMs/*DelayMs/*TickMs/*GraceMs >= 0`, `*EveryN >= 1`
  - контракт `mods` после `computeModsFromTalents`:
    - все ожидаемые ключи присутствуют
    - неожиданные ключи помечаются warning

### Dev flags (`localStorage`)

- `debug_dtScale` — масштаб dt для симуляции «медленного FPS» (`4` => внутренняя симуляция времени х4).
- `debug_fixedDtMs` — фиксированный dt в ms (например `200`).
- `talents_debug_forceChance=1` — форс всех шансов в `1.0`.
- `talents_debug_forceChanceKey=<key>` — форс конкретного шанса (`acid`, `mark`, `ricochet`, `impulse`, `armorpiercing`, `killbounty`, `stun`, `immunity`, `lottery`, `doublerewardkill`, `doublerewardshot`).
- `talents_debug_showIcons=0` — скрыть status icons (для дебага без визуального шума).
- `talents_debug_dump=1` — включает hotkey `F8` для `Game.TalentsV2.debugDump()`.

### `debugDump()`

- `Game.TalentsV2.debugDump(payload?)` печатает компактный snapshot:
  - `ranksById`, `mods`, `runActives`, `migration`, `counters`, `lastValidationIssues`
  - runtime первого tank/zombie (из payload или последних seen entity)

## FPS independence guarantees (PACK 8)

- Catch-up `while` циклы защищены guard-лимитом `maxStepsPerFrame` (по умолчанию `120`) в:
  - `tickStatuses` (DOT)
  - ramp stacks (`_onShotCounterAndRamp`)
  - `onUpdate` (`shield`, `autoRepair`, active recharge, `interest`)
- При превышении лимита:
  - цикл мягко клампится к «почти текущему времени»
  - пишется `console.warn` (с cooldown, без spam)
- Цель guard’ов: защита от freeze при экстремальных лаг-скачках, без изменения поведения на нормальном `dt`.

## QA методика

- Основной чеклист вынесен в `docs/qa_talents_v2.md`.
- Прогон обязателен по секциям:
  - UI / Offense / Defense / Economy / Migration / FPS
- Критичные расхождения фиксируются в `Known Issues` с явной пометкой зоны ответственности (TalentsV2 vs интеграция боёвки).


## Обновление 2026-04-21 (solo-pipeline-yandex-vk#1)

- `wallArmorFlat` → `wallArmorMul` для таланта "Композитная броня": теперь 2% за ранг (`stat_mul`, perRank:0.02). Итоговая броня в `getFenceArmorFlat` (`game.js`): `Math.round(base * wallArmorMul)`. Зеркалит `tools/balance-shared.js` L548.
- Купол: применение множителя урона `defActiveDamageTakenMul` перенесено в единую точку `applyFenceSegmentDamage` (`game.js` L7716) через `window.Game.TalentsV2.getActiveDomeDamageMul(nowMs)`. Иммунно к "обновлению" зомби.
- `getTalentNodeDescriptionV2` (`game.js` L10946): резолвит rank через `api.getRanks()+api.getPendingRanks()` если caller передал 0/undefined; поддерживает `ui.currentFormat = 'percent'|'flat'`. Это чинит "ТЕКУЩАЯ ПРИБАВКА - 0%" в модалке "Древо улучшений".


## Обновление 2026-05-23 (solo-pipeline-yandex-vk#1, wall-upgrades rebrand)

Пять defense-талантов получили новые отображаемые имена + переработанное поведение. Runtime `id` сохранён ради совместимости с сейвами и `MIGRATE_V1_TO_V2`.

| Runtime id | Новое имя (RU) | Новое поведение |
|---|---|---|
| `def_stun_on_hit` | Стены под напряжением | Stun атакующего зомби 0.5s, ICD 2s. Write: `cc.stunUntilMs = Math.max(prev, nowMs+500)`; consume в `stepZombies` через `Date.now()` гейт перед `shouldMove` и перед dispatch attack. |
| `def_second_wind` | Экстренное восстановление | Per-segment serialized cooldown 3 мин (вместо one-shot flag). Готовность хранится на `seg.secondWindReadyAtMs` (вне `_defRt`), переживает save/load. Восстанавливает 20% HP. |
| `def_broken_dr` | Повреждения во благо | Tiered non-stacking armor bonus: ранги 1–5 дают +6/12/18/24/30% брони фрагментам с HP <75/50/25/15/7%. Резолвится в damage-path через `mods.damageBlessingTiers` (наивысший подходящий tier, без аддитивного стека). Талант больше **не** DESIGN-DEAD. |
| `def_auto_repair` | Защита на опережение | Phase scheduler: фаза анализа 8s ↔ фаза действия брони 8s (`protectAheadAnalyzeUntilMs` / `protectAheadBuffUntilMs` в `seg._defRt`). Армор-бонус +3% за ранг применяется в damage-path только когда `protectAheadBuffUntilMs > timeMs`. Фазы не overlap'аются. Бонус **additive** с `damageBlessing` и с `wallArmorFlat`. |
| `def_repair_efficiency` | Адаптация под дронов | +2% за ранг к скорости ремонта дронами (`droneTalentSpeedBonus` mod). Snapshot'ится в `finalRepairMult` в `src/mechanics/drones.js`; tap = full HP сохраняется (бонус не аннулирует instant tap-repair). Не heal-multiplier для cost-based ремонта. |

Mod-ключи добавлены в шаблон mods: `damageBlessingTiers` (Array<{hpThreshold:number, armorMul:number}>), `protectAheadAnalyzeMs`, `protectAheadBuffMs`, `protectAheadArmorPerRank`, `droneTalentSpeedBonus`, `protectAhead` (unlock flag). UI таланта 3 («Повреждения во благо») использует `ui.currentVars` для рендера 5-уровневой лестницы вместо single `{current}` placeholder.
