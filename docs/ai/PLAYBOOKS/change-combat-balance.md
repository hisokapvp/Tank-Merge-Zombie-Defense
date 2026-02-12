# PLAYBOOK: Изменить баланс боя

## Когда использовать

Нужно изменить урон, скорострельность, количество снарядов, выбор целей или death-анимации.

## Шаги

1. Определи слой правки:
   - чистое правило: `src/mechanics/combat.js`
   - targeting: `src/mechanics/targeting.js`
   - runtime tuning: `BAL` в `game.js`
2. Внеси минимальные изменения в одну формулу за раз.
3. Проверь влияние на офлайн-модель (`src/persistence/offlineProgress.js`).
4. Обнови SYSTEM-доку (`docs/ai/SYSTEMS/combat.md`) при изменении контракта.

## Какие файлы обычно править

- `src/mechanics/combat.js`
- `src/mechanics/targeting.js`
- `game.js`
- `src/persistence/offlineProgress.js` (если требуется)

## Проверки

- `node Test/pack1/fireLogic.test.js`
- `node Test/pack2/fireLogicRegression.test.js`
- `node Test/pack6/burstTargeting.test.js`
- `node Test/pack6/projectileAimFallback.test.js`

## Типовые ловушки

- Нарушен детерминизм `pickDeathAnim`.
- Баланс изменён только в runtime, но не в offline модели.
