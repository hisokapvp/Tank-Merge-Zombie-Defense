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
- Интеграция в цикл: `game.js`

## Что править

- Урон/дальность/снаряды — в `combat.js`.
- Профиль пули (`ap/he/toxic/tesla`) и AOE/chain — в `combatProfiles.js`.
- Burst/multi-target — в `targeting.js`.
- Баланс alive-per-side и выбор слота спавна — в `zombieSpawn.js`.
- Цена покупки и buy-level формула — в `economy.js`.
- XP до уровня и награда золота — в `progression.js`.
- Проверки занятости/покупки — через `garage.js` + `economy.js`.
- Тайминги death/despawn — в `corpseDespawn.js`.
- UX level-up (open/close/reward queue) — в `levelFlow.js`.

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
