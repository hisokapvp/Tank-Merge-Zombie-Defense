# PLAYBOOK: Изменить баланс боя

## Шаги

1. Выбрать слой: `combat.js` / `targeting.js` / `BAL` в `game.js`.
2. Менять по одной формуле за раз.
3. Проверить влияние на offline модель.
4. Обновить `docs/ai/SYSTEMS/combat.md` при изменении контракта.

## Проверка

- `node Test/pack1/fireLogic.test.js`
- `node Test/pack2/fireLogicRegression.test.js`
- `node Test/pack6/burstTargeting.test.js`
