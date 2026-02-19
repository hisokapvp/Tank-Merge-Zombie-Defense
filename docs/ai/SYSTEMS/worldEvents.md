# Система: World Events

## Где править
- Конфиг: `src/config/worldEvents.js`
- Логика: `src/systems/*`, `src/mechanics/levelFlow.js`

## Правила
- Параметры `attackMode`, `targetAlive`, ramp и force-сценарии менять как единый набор.
- Избегать эксплойтов: резких скачков сложности и бесконечных циклов наград.
- Debug-forcing оставлять только для debug-режима.
