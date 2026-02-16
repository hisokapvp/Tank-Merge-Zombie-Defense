# World Events: Attack Mode и цель спавна

## Что влияет на desired targetAlive

- `targetAliveMult` влияет только на `desired targetAlive`.
- Базовое значение берётся как `baseTargetAlive` (значение без world-events множителя).
- Формула:
  - `desiredTargetAlive = round(baseTargetAlive * aliveMultCurrent)`
- `desiredTargetAlive` дополнительно ограничивается в безопасный диапазон (`>= 0`).

## Как работает ramp (`targetAliveRampSec`)

- В рантайме хранится состояние `aliveMultCurrent`.
- Целевое значение множителя:
  - `aliveMultTarget = attackModeActive ? targetAliveMult : 1`
- На каждом тике множитель двигается к target:
  - если `targetAliveRampSec <= 0`: мгновенно `aliveMultCurrent = aliveMultTarget`
  - иначе: линейное приближение с ограничением шага, без перескока target
- При быстрых переключениях attackMode движение продолжается от текущего значения к новому target без сброса в `1`.

## Что не меняется этой логикой

- Формула `desired targetAlive` не использует `speedMult` и `damageMult`.
- Изменения скорости/урона attackMode работают отдельно от расчёта desired количества живых зомби.
