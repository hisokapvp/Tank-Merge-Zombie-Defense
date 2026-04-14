# Система: Combat

> Обновлено: 2026-04-06.

## Где править
- Бой и урон: `src/mechanics/combat.js`, `src/mechanics/combatProfiles.js`
- Наведение/цели: `src/mechanics/targeting.js`
- Спавн зомби: `src/mechanics/zombieSpawn.js`
- **Чип-эффекты**: `src/mechanics/chipEffects.js` (`Game.ChipEffects`)
- **Конфиг чип-спрайтов**: `assets/chips.json`

## Правила
- Баланс брать из `global.BAL` и конфигов, а не из магических чисел.
- Изменения DPS/скорострельности валидировать на низких и высоких уровнях.
- Не ломать интеграцию с `worldEvents`, `supercomputer`, `fence`.
- Чип-модификаторы: эффекты реализованы в `chipEffects.js`, визуал/звуки настраиваются через `assets/chips.json`.

## Asset-driven combat stats
- `tankStats()` теперь читает `stats.baseDamage`, `stats.attackSpeed` и optional `stats.projectileCount` из `assets/tanks.json`, а `fireTankProjectile()` использует этот per-tank barrel-count раньше legacy fallback `Combat.getProjectileCount(level)`. Это делает количество базовых снарядов authoring knob'ом конкретного `tank_lvlN`, при этом урон по-прежнему делится по базовому count и не переопределяет chip extra-projectile contract: [game.js](../../../game.js#L5047-L5089), [game.js](../../../game.js#L8284-L8303), [src/render/spriteLoaders.js](../../../src/render/spriteLoaders.js#L498-L530), [assets/tanks.json](../../../assets/tanks.json#L1-L3).
- Balance Lab shared kernel и editor analytics fallback используют тот же cadence-contract: `getTankStats()` и `getTankShotsPerMinute()` читают `stats.attackSpeed`, а explicit zombie `Health` остаётся каноническим HP surface для живой балансировки: [tools/balance-shared.js](../../../tools/balance-shared.js#L459-L487), [tools/balance-editor.html](../../../tools/balance-editor.html#L503-L513), [assets/zombies.json](../../../assets/zombies.json#L1-L220).

## Lingering chip visual gate
- Для lingering чипов `10..14` флаг `effect.enabled` больше не отключает gameplay. `applyImpactEffects()` всегда создаёт pool/node/mark runtime-object, если effect config существует; при этом `codeVisualEnabled` лишь гасит code-drawn fallback в `drawDecals()`, а `effectSprite` продолжает рендериться как отдельный visual path: [src/mechanics/chipEffects.js](../../../src/mechanics/chipEffects.js#L876-L1015), [game.js](../../../game.js#L8799-L8812), [game.js](../../../game.js#L14151-L14186).
- Chain / Matryoshka / Cascade descendants больше не теряют lingering-contract: `_buildChildImpactShotMods()` переносит active lingering flags `10..14` и remaining `pendingCascadeMods`/`pendingYellowMods` в child projectiles, а `impactAt()` больше не отбрасывает `chipShotMods` только из-за `isMatryoshkaChild`. Дополнительно child shots теперь несут `bulletCfgBase`, а `spawnProjectile()` пересобирает projectile/impact overrides через `mergeBulletCfgOverride()` по фактическому `shotMods.activeModIds`, поэтому Arcade-resolved children больше не наследуют чужой sprite atlas: [src/mechanics/chipEffects.js](../../../src/mechanics/chipEffects.js#L271), [src/mechanics/chipEffects.js](../../../src/mechanics/chipEffects.js#L810), [game.js](../../../game.js#L8508-L8533).

## Zombie unstick mechanism
- `stepZombies()` держит per-zombie `_unstickTimer` / `_unstickCheckR`: если зомби не продвинулся ≥ 2px к центру за 4 сек, scalar nudge `min(8, max(1, (r - fenceR)*0.15))` подталкивает его к fence. Не срабатывает для dying/breached зомби: [game.js](../../../game.js#L7820-L7840).
- Поверх обычного unstick-path есть hard fail-safe: `maybeTeleportZombieNearFence()` срабатывает только если зомби минимум 25 секунд почти не меняет координаты (допуск ±5 px по осям) и всё это время остаётся в пределах 20 px от decor-blocker'а. Телепорт по-прежнему одноразовый и приземляет его на внешней стороне ограды с 20–30 px отступом без посадки внутрь decor: [game.js](../../../game.js#L6734-L6778), [game.js](../../../game.js#L7826-L7997).
- Breached-зомби у суперкомпьютера больше не замирают в `attack/cooldown`: в attack windows (`shouldAttackTargets=true`) они делают короткий left/right strafe у stand-off radius, а в rest windows отходят чуть дальше и качаются шире. Anchor для этого поведения теперь берётся из runtime-hitbox суперкомпьютера, который можно подстроить через прямоугольный `assets/supercomputer.json.hitbox`, а не из raw `sc.x/sc.y` на дороге: [game.js](../../../game.js#L7826-L7997), [assets/supercomputer.json](../../../assets/supercomputer.json#L1-L20).

## Мини-проверка
- Урон, cooldown и target selection предсказуемы.
- Нет регрессий в critical/attack режимах.
- Чип-модификаторы корректно применяются к снарядам в зависимости от `activeModifiers` ячейки.

## Чип-модификаторы (Chip Effects)

### Pipeline
1. `stepTanks` передаёт `cellIndex` в `fireTankProjectile`.
2. `fireTankProjectile` вызывает `ChipEffects.applyShotModifiers(cellIndex)` — получает `shotMods`.
3. **Каскадная система**: модификаторы разделяются по `order` (задаётся в `hangarChips.calculateActiveModifiers`):
   - `order: 0` (первый красный мод) — применяется при выстреле, кроме `Аркадного хаоса` (mod 7), который теперь откладывается как первый cascade-step, чтобы не перебивать primary/secondary ordering.
   - `order: 1` (второй красный мод при совпадении) — откладывается в `pendingCascadeMods`; срабатывает при попадании снарядов уровня 0 → из точки взрыва вылетают новые снаряды к целям за 100–250px.
   - `order: 2` (жёлтый мод) — применяется **только** на ПОСЛЕДНЕМ каскадном уровне. Если каскадных модов нет — срабатывает на первом попадании.
4. `shotMods` определяют количество снарядов, урон, AoE, спец-поля (matryoshka, nuke, combo и т.д.).
5. `shotMods` сохраняются на объекте снаряда (`b.chipShotMods`), включая `pendingCascadeMods` и `pendingYellowMods`.
6. При попадании (`impactAt`) вызывается `ChipEffects.applyImpactEffects(...)` — mod-специфичные эффекты + каскадный spawning.
7. `stepChipEffects(dt)` тикает электро-ноды и лазерные метки.
8. `stepDecals` обрабатывает чип-пулы (огонь, кислота, лёд) — DOT и замедление; накапливает DOT-урон и показывает плавающее число каждые 0.5 сек.

### Каскадная система (Cascade)

Каскад — механизм, при котором модификаторы высших порядков срабатывают из точки попадания предыдущих снарядов, порождая новые снаряды.

**Пример: Двойной снаряд (A) + Двойной снаряд (B) + Огненная лужа (жёлтый)**
1. Танк стреляет 2 снаряда (мод A, order 0: `extraProjectiles=1`).
2. Каждый из 2 снарядов попадает → из точки взрыва вылетают ещё 2 каскадных снаряда (мод B, order 1: `extraProjectiles=1`), целящихся в зомби на расстоянии 100–250px.
3. Каскадные снаряды попадают → срабатывает жёлтый мод (Огненная лужа) в точке их попадания.

**Правила каскада:**
- Каскадные снаряды имеют флаг `isCascadeChild = true`.
- Каскадные снаряды НЕ блокируются проверкой `isMatryoshkaChild` — они запускают свои эффекты при попадании.
- Chain- и Matryoshka-child projectiles тоже продолжают lingering/cascade queue, если родитель уже нёс `pendingCascadeMods`, `pendingYellowMods` или active mods `10..14`; это позволяет secondary modifiers доезжать до каждого релевантного взрыва, а не только до base impact.
- Количество каскадных снарядов зависит от модификатора: Двойной (mod 1) = 2, Тройной (mod 15) = 3, Гекса (mod 16) = 6, Комбо (mod 6/25/26) = 3–4 (если сработал).
- **Combo cascade (revised):** если комбо-мод является cascade-модом и `_comboFired=false` (выстрелы 1–3), спавнится **1 нормальный** каскадный снаряд (×1.0 урон). На 4-м выстреле (`_comboFired=true`) спавнится burst: `_comboShots` снарядов с множителем `_comboDmgMul` (Small ×1.25, Medium ×1.5, Large ×2.0). Если комбо выпал через `Аркадный хаос`, accumulator-path не используется: Arcade-resolved combo сразу создаёт combo burst и не требует ещё трёх «накопительных» взрывов: [src/mechanics/chipEffects.js](../../../src/mechanics/chipEffects.js#L788-L840).
- Урон каскадных снарядов = урон родителя × множители мода (Матрёшка ×2, Ядерный ×3) / количество снарядов.
- Таргетинг каскадных снарядов: приоритет — зомби в 100–250px от точки взрыва; fallback ≥50px, затем любой живой.
- У каскадных снарядов `cascadeLevel` увеличивается на 1 с каждым уровнем.
- `pendingCascadeMods` уменьшается на 1 с каждым каскадом; при опустошении жёлтый мод добавляется к `shotMods`.

**Ключевые функции каскада (chipEffects.js):**
- `_buildEmptyResult()` — пустой shotMods с defaults (включая `pushRadius: 0`).
- `_applyModToResult(result, modId, cellIndex)` — применяет один мод к результату.
- `_findCascadeTargets(x, y, count, opts)` — поиск целей для каскадных снарядов.
- `_getCascadeProjectileCount(modId, result)` — кол-во снарядов для каскада.
- `_spawnCascadeProjectiles(x, y, b, nextMod, remaining, yellowMods, opts)` — создание каскадных снарядов.

### Модификаторы (1–14)
| ID | Код          | Эффект при выстреле / попадании                                          |
|----|--------------|--------------------------------------------------------------------------|
| 1  | Двойной      | +1 снаряд на дуло; цели выбираются через `pickBurstTargetsBySide` (как у многоствольных танков); полный урон на каждый снаряд |
| 2  | Цепная молния| Снаряд летит к новой цели (≥12px), до 2 отскоков, полный урон             |
| 3  | Матрёшка     | ×1.25 визуальный размер, ×2 dmg; child летит к другой цели (≥12px)       |
| 4  | Толкание     | AoE-отталкивание (`pushRadius=40`): все зомби в радиусе отталкиваются от забора; falloff `max(0.3, 1 − d/pushRadius)`; push всегда увеличивает `z.r`; + 0.5× бонус-урон |
| 5  | Притягивание | Все зомби в радиусе `pullDistance` от взрыва сильно притягиваются к центру (85 % расстояния за одно попадание) + 0.5× бонус    |
| 6  | Комбо        | Каждый 4-й выстрел → burst из 3 снарядов (×1.25 dmg); выстрелы 1–3 — спавнится 1 обычный каскадный снаряд (×1.0 dmg). Счётчик pre-increment при выстреле, pre-computed `_comboFired/_comboShots/_comboDmgMul` сохраняются на mod-объекте; каскадный/жёлтый путь НЕ вызывает `_applyModToResult` повторно для combo-модов (иначе double-increment) |
| 7  | Аркадный хаос| Deferred arcade-step: в точке взрыва выбирает случайный mod из группы A (`1,2,3,4,5,6,8,9`), затем поднимает его до latest unlocked tech tier через `HangarChips.resolveLatestTechModId()`. Combo, выпавший через Arcade, сразу создаёт combo burst; child projectile visuals и impact sprites пересобираются по фактически выбранному modId, а не по atlas-override самого Arcade |
| 8  | Ядерный      | ×3 урон, 100px AoE, кулдаун 30 сек; bullet override `bullet_nuke.png` теперь остаётся на всех выстрелах, а impact-path по-прежнему делится на normal-vs-nuclear. Через Arcade может резолвиться в tech tiers `27/28`, если они изучены |
| 9  | Успокоение   | Зомби в радиусе `calmRadius` (из `CALM_RADIUS_BY_LEVEL`) подавляют атаку ровно на tier duration `0.5 / 0.75 / 1.0 sec`, но только если цель уже находится в `attack/cooldown` state; walking-зомби не получают «отложенный» pacify на будущее. Новый calming-hit принимается только после того, как эта же цель реально нанесла следующий удар и закрыла предыдущий interrupted attack-cycle, поэтому один и тот же зомби нельзя держать в непрерывном pacify простым spam-fire. После каждых 10 успешных interrupted debuff-hit'ов конкретный зомби получает 30-sec immunity window. Во время suppression runtime принудительно держит walk-state и удерживает цель на месте, чтобы та не успевала физически уйти из точки контакта, а после `calmUntil` при валидной цели возвращает зомби в тот attack/cooldown progress, на котором дебафф его остановил: [src/mechanics/chipEffects.js](../../../src/mechanics/chipEffects.js), [game.js](../../../game.js#L7826-L7997) |
| 10 | Огонь        | Пул огня (DOT: 5 dmg/сек, 3 сек); урон отображается числом каждые 0.5с  |
| 11 | Лёд          | Пул льда (slow ×0.4, 3 сек)                                             |
| 12 | Электро нода | Электро-узел (zap 10 dmg каждые 0.8 сек, 4 сек, радиус 64px)            |
| 13 | Лазерная метка| Метка на земле (4 сек); следующее попадание по метке: ×2 урон, ×2 AoE   |
| 14 | Кислота      | Пул кислоты (DOT: 3 dmg/сек + slow ×0.6, 4 сек); урон отображается числом каждые 0.5с |

### Расширенные модификаторы (15+)
| ID | Код              | Эффект                                                                 |
|----|------------------|------------------------------------------------------------------------|
| 15 | Тройной          | +2 снаряда (каскад: 3 снаряда)                                         |
| 16 | Гекса            | +5 снарядов (каскад: 6 снарядов)                                       |
| 21 | Усиленное толкание| AoE-отталкивание (`pushRadius=60`), falloff `max(0.3, 1 − d/pushRadius)`; push всегда увеличивает `z.r` |
| 22 | Мощное толкание  | AoE-отталкивание (`pushRadius=80`), falloff `max(0.3, 1 − d/pushRadius)`; push всегда увеличивает `z.r` |
| 25 | Комбо II         | Каждый 4-й → burst 3 снаряда ×1.5 dmg; выстрелы 1–3 → 1 обычный снаряд ×1.0 |
| 26 | Комбо III        | Каждый 4-й → burst 4 снаряда ×2.0 dmg; выстрелы 1–3 → 1 обычный снаряд ×1.0 |

### Push/Pull механика
- `_applyPushPull(x, y, b, mods)` — обрабатывает толкание (mod 4/21/22) и притягивание (mod 5).
- Толкание использует `pushRadius` из `shotMods` (не `b.aoe`): mod 4 = 40, mod 21 = 60, mod 22 = 80.
- Distance falloff формула: `max(0.3, 1 − d / effectRadius)` — минимальная сила отталкивания 30% даже на границе радиуса.
- Push всегда увеличивает `z.r` (отталкивает **от забора**, а не от точки взрыва).

### Анимация смерти зомби
- `pickDeathAnim(common, personal, rand01)` выбирает анимацию смерти: если есть `personal` — берёт её, иначе берёт из `common`.
- `common` (`ZombieSprites.deathCommon`) — **массив** вариантов анимации смерти (backward-compatible: если в `zombies.json` указан один объект, при парсинге он оборачивается в массив).
- При выборе из массива `common` используется `rand01` для случайного pick варианта.
- Проверка `isCommonDeathAnim` в `game.js` сравнивает текущую анимацию со **всеми** элементами массива `deathCommon`.

### Сброс
`ChipEffects.reset()` вызывается при `resetGameState` — сбрасывает combo-счётчики, nuke-кулдауны, calmed-зомби, ноды, метки.
