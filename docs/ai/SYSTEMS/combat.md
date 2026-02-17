# SYSTEM: Combat

## Где искать

- Формулы боя: `src/mechanics/combat.js`
- Профили снарядов и весы уровней: `src/mechanics/combatProfiles.js`
- Выбор целей: `src/mechanics/targeting.js`
- Деспаун трупов: `src/mechanics/corpseDespawn.js`
- Спавн и распределение зомби по сторонам: `src/mechanics/zombieSpawn.js`
- Экономика покупок/дропа монет: `src/mechanics/economy.js`
- Прогрессия и XP-кривая: `src/mechanics/progression.js`
- Правила занятости ячеек гаража: `src/mechanics/garage.js`
- Level-up flow и награды: `src/mechanics/levelFlow.js`
- Supercomputer state machine/урон/броня: `src/mechanics/supercomputer.js` + интеграция в `game.js`
- Dron repair mechanic: `src/mechanics/drones.js` + интеграция в `game.js`
- Интеграция в цикл: `game.js`

## Что править

- Урон/дальность/снаряды — в `combat.js`.
- Профиль пули (`ap/he/toxic/tesla`) и AOE/chain — в `combatProfiles.js`.
- Burst/multi-target — в `targeting.js`.
- Баланс alive-per-side и выбор слота спавна — в `zombieSpawn.js`.
- Цена покупки и buy-level формула — в `economy.js`.
- XP до уровня и награда золота — в `progression.js`.
- Источник уровня для UI/баланса — `state.supercomputer.computerLevel`.
- Проверки занятости/покупки — через `garage.js` + `economy.js`.
- Тайминги death/despawn — в `corpseDespawn.js`.
- UX level-up (open/close/reward queue) — в `levelFlow.js`.

## Dron repair flow (fence)

- Режимы: `standby` / `repair`; substates: `patrol`, `flyToTarget`, `repairing`, `returnToBase`.
- Выбор цели: самый повреждённый незарезервированный сегмент (`min hp/maxHp`, tie-break по `segmentId`).
- Резерв: `segment.reservedByDroneId` ставится сразу при выборе и снимается при cancel/invalid/completed/no-coins.
- Формулы:
	- `totalCostCoins = ceil(baseCost * missingRatio * costMult(level))`
	- `repairDurationSec = baseRepairSec / repairSpeedMult(level)`
- Ремонт детерминирован по времени (`round` HP, `floor` spend), монеты никогда не уходят ниже `0`.

## Computer progression (playerLevel → computerLevel)

- Прогрессия уровня использует `state.supercomputer.computerLevel`.
- Формулы XP (`xpNeededForLevel`) и источники XP не меняются.
- При level-up supercomputer пересчитывает `maxHp` и `armorFlat` из data-driven конфига.
- HP сохраняет процент: `hp = round(newMaxHp * (oldHp / oldMaxHp))`, затем clamp `0..newMaxHp`.

## Supercomputer damage / animation states

- Формула урона: `finalDamage = max(0, baseDamage - armorFlat)`.
- Обновление HP: `hp = max(0, hp - finalDamage)`.
- При `hp==0`: состояние `destroy` → `destroyed` без game over и без паузы симуляции.
- State machine: `idle/work`, `glitch`, `buildTank`, `destroy/destroyed`.
- `glitch` использует `chancePerSecond`, `minLoops/maxLoops`, `cooldownSec`.
- Во время `glitch` запрос `buildTank` ставится в pending и запускается после завершения loops.

## Урон забору в attackMode

- Урон сегментам забора применяется только при активном `attackMode`.
- Базовый входящий урон: `incomingDamage = zombieType.attackDamage * attackMode.damageMult`.
- Финальный урон сегменту: `finalDamage = max(0, incomingDamage - armorFlat)`.
- `armorFlat` берётся из текущего уровня fence (`assets/fence.json.levels[]`, fallback `0`).
- Урон по уже сломанному сегменту не применяется.
- Конфиг типа зомби: `assets/zombies.json -> types[].attackDamage`.
- Если `attackDamage` отсутствует — используется fallback (без падения игры).

## Zombie attack state machine

- Состояния: `walk -> attack -> cooldown`.
- `walk`:
	- зомби двигается,
	- играет `walk` анимацию,
	- при наличии цели в `attackRangePx` переходит в `attack`.
- `attack`:
	- движение отключено (`speed=0`, no movement integration),
	- играет `attack` анимация,
	- урон наносится ровно 1 раз в момент `attackHitAt * attackAnimDuration`,
	- перед нанесением урона цель повторно валидируется через тот же selector.
- `cooldown`:
	- зомби снова двигается и играет `walk`,
	- таймер `attackCooldownSec` стартует от конца `attack` анимации,
	- по завершении: если цель в range — снова `attack`, иначе `walk`.

Edge-cases:

- если цель уничтожена до hit-момента — урон пропускается;
- attack-анимация доигрывается полностью;
- затем всегда переход в `cooldown`.

## Приоритет цели: supercomputer > fence

- До брича зомби остаются в цели `fence`.
- Стратегический курс к `supercomputer` через `anchorTheta` включается только у группы стороны, где есть сломанный fence-сегмент.
- В атаке приоритет цели: `supercomputer` (если `hp > 0` и в `attackRangePx`) → иначе `fence`.
- Если `fence` блокирует путь, зомби продолжают ломать сегменты через текущий selector и после брича продвигаются глубже внутрь к цели.
- Нанесение урона по `supercomputer` выполняется через `applySupercomputerDamage(...)`.

## Выбор цели fence

- Единый selector используется в двух местах:
	- для решения "можно ли начать attack";
	- для фактического hit в `attackHitAt`.
- Метрика: `distance(zombieCenter, segmentAabb)`.
- Расстояние считается как `distancePointAabb(point, aabb)`:
	- `0`, если центр внутри `AABB`;
	- иначе минимальная дистанция до прямоугольника.
- Кандидаты: все живые `side + corner` сегменты с `holeAabb`.
- Фильтр: `distance <= attackRangePx`.
- Tie-break (стабильный):
	1. меньший `distance`;
	2. при равенстве — `isCorner=true`;
	3. при равенстве — меньший `id/index`.

Это устраняет кейс "зомби атакует у corner, но corner не получает урон".

## Прорыв (breach)

- Сломанный сегмент открывает проход только в своей области.
- При первом проходе зомби помечается `breached=true`.
- После прорыва лимит держится по внешнему краю танкового трека (зомби не уходят в ангар).

## Риски

- Сохранять детерминизм `pickDeathAnim`.
- Изменения боя влияют на экономику и offline модель.
- Не менять формулы `xpNeededForLevel`/`getTankBaseCost` без баланс-регрессии.
- Не разрывать связку `zombieSpawn` ↔ `BAL.zombie*` в `game.js`.

## Мини-проверка

- `node Test/pack1/fireLogic.test.js`
- `node Test/pack2/fireLogicRegression.test.js`
- `node Test/pack6/burstTargeting.test.js`
- `node Test/pack8/offlineProgress.test.js`
