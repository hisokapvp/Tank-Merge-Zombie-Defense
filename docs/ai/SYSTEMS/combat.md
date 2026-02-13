# SYSTEM: Combat

## Где искать

- Формулы боя: `src/mechanics/combat.js`
- Выбор целей: `src/mechanics/targeting.js`
- Деспаун трупов: `src/mechanics/corpseDespawn.js`
- Интеграция в цикл: `game.js`

## Что править

- Урон/дальность/снаряды — в `combat.js`.
- Burst/multi-target — в `targeting.js`.
- Тайминги death/despawn — в `corpseDespawn.js`.

## Риски

- Сохранять детерминизм `pickDeathAnim`.
- Изменения боя влияют на экономику и offline модель.

## Мини-проверка

- `node Test/pack1/fireLogic.test.js`
- `node Test/pack2/fireLogicRegression.test.js`
- `node Test/pack6/burstTargeting.test.js`
