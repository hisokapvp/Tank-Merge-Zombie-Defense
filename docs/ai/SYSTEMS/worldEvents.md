# Система: World Events

## Где править
- Конфиг: `src/config/worldEvents.js`
- Логика: `src/systems/*`, `src/mechanics/levelFlow.js`

## Правила
- Параметры `attackMode`, `targetAlive`, ramp и force-сценарии менять как единый набор.
- Избегать эксплойтов: резких скачков сложности и бесконечных циклов наград.
- Debug-forcing оставлять только для debug-режима.
- В partial reset (`restartSimulationPartial`) после restore обязательно переводить `attackMode` runtime в off/default: сброс таймеров, weather/evening runtime флагов, `aliveMultCurrent`/ramp и накопленных wave-эффектов.
- После такого сброса `targetAlive` должен рассчитываться от дефолта `assets/zombies.json` без наследования предыдущего attack-mode множителя.
