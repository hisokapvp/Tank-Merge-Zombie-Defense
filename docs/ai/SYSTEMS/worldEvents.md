# Система: World Events

## Где править
- Конфиг: `src/config/worldEvents.js`
- Логика: `src/systems/*`, `src/mechanics/levelFlow.js`
- Runtime weather/attack: `src/systems/worldEventsRuntime.js`

## Интеграция
- `game.js` использует `ensureWorldEventsRuntimeController()` и делегирует в `Game.WorldEventsRuntime` функции weather/attack (`updateWorldEvents`, `drawWeather`, lightning/ramp helpers).
- При отсутствии runtime-модуля остаётся fallback-логика в `game.js`.

## Правила
- Параметры `attackMode`, `targetAlive`, ramp и force-сценарии менять как единый набор.
- Избегать эксплойтов: резких скачков сложности и бесконечных циклов наград.
- Debug-forcing оставлять только для debug-режима.
- Start эпизода attackMode определяется переходом `isZombieAttackModeActive()` из `false -> true` (включая `forceAttackMode`), а не только auto-schedule.
- На старте эпизода фиксируются `attackSpawnDirA/B/C` (8-направлений), при этом `dirA` защищён от повтора более чем 2 эпизода подряд через `attackSpawnPrevPrimaryDir` + `attackSpawnPrimaryStreak`.
- В partial reset (`restartSimulationPartial`) после restore обязательно переводить `attackMode` runtime в off/default: сброс таймеров, weather/evening runtime флагов, `aliveMultCurrent`/ramp и накопленных wave-эффектов.
- После такого сброса `targetAlive` должен рассчитываться от дефолта `assets/zombies.json` без наследования предыдущего attack-mode множителя.
