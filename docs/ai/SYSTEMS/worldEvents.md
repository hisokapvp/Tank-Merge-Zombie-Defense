# Система: World Events

## Где править
- Конфиг: `src/config/worldEvents.js`
- Логика: `src/systems/*`, `src/mechanics/levelFlow.js`
- Runtime weather/attack: `src/systems/worldEventsRuntime.js`
- Idle pressure between full waves: `src/config/worldEvents.js` → `attackMode.idleWave`, runtime в `src/systems/worldEventsRuntime.js`

## Интеграция
- `game.js` использует `ensureWorldEventsRuntimeController()` и делегирует в `Game.WorldEventsRuntime` функции weather/attack (`updateWorldEvents`, `drawWeather`, lightning/ramp helpers).
- При отсутствии runtime-модуля остаётся fallback-логика в `game.js`.

## Правила
- Параметры `attackMode`, `targetAlive`, ramp и force-сценарии менять как единый набор.
- Лёгкое давление зомби между full-wave эпизодами настраивается через `attackMode.idleWave`: `attackDamageMul`, `betweenWavesSec`, `attackDurationSec`, `wanderDurationSec`, `retreatDistanceMinPx`, `retreatDistanceMaxPx`.
- Радиус осведомлённости зомби о проломах настраивается в `src/config/worldEvents.js` как `attackMode.fenceBreachAwarenessRadiusPx` (в px, до масштабирования `balScale`).
- Избегать эксплойтов: резких скачков сложности и бесконечных циклов наград.
- Debug-forcing оставлять только для debug-режима.
- Start эпизода attackMode определяется переходом `isZombieAttackModeActive()` из `false -> true` (включая `forceAttackMode`), а не только auto-schedule.
- На старте эпизода фиксируются `attackSpawnDirA/B/C` (8-направлений), при этом `dirA` защищён от повтора более чем 2 эпизода подряд через `attackSpawnPrevPrimaryDir` + `attackSpawnPrimaryStreak`.
- Idle-wave фаза не заменяет full attack mode: runtime должен возвращать `suppressed`, пока идёт основной attack эпизод, и только после него возобновлять цикл `between -> attack -> wander`.
- В partial reset (`restartSimulationPartial`) после restore обязательно переводить `attackMode` runtime в off/default: сброс таймеров, weather/evening runtime флагов, `aliveMultCurrent`/ramp и накопленных wave-эффектов.
- После такого сброса `targetAlive` должен рассчитываться от дефолта `assets/zombies.json` без наследования предыдущего attack-mode множителя.
- Runtime safe-wave scaling теперь держит два независимых накопителя: `zombieWaveAttackMul` и `zombieWaveHpMult`. Каждый новый full-wave повышает и урон, и HP зомби на `+5%`; HP-множитель применяется только к новым спавнам, без ретро-лечения уже созданных зомби, и тоже обязан сбрасываться при partial reset / restore.

## L60 endgame (`attackMode60` + +50% wave buff)
- Конфиг `src/config/worldEvents.js` экспортирует два mutually-exclusive блока: общий `attackMode` и отдельный `attackMode60`. Оба имеют идентичный shape (timings, idleWave, multipliers), значения у `attackMode60` интенциально жёстче — короче `attackEverySec`, длиннее `attackDurationSec`, выше `speedMult`/`damageMult`/`targetAliveMult`, `safeWaves: 0`.
- `getWorldEventsAttackCfg()` в `src/systems/worldEventsRuntime.js` выбирает `attackMode60`, как только `state.maxTankLevelAchieved >= 60` и `attackMode60.enabled !== false`. Это тот же gate, что включает endgame wave buff — поэтому переход attackMode → attackMode60 происходит ровно в момент появления L60-зомби.
- В endgame ветке (`maxTankLevelAchieved >= 60`) каждая новая wave **заменяет** текущие `state.zombieWaveAtkMult`/`state.zombieWaveHpMult` значением `1 + 0.50 * endgameWaveCount` (wave1=1.50, wave2=2.00, wave3=2.50, ...). Это replacement, не compounding. Banner percent (`deps.onEndgameWaveStart`) использует `50 * endgameWaveCount`.
- Не-L60 ветка `else if (worldEventsState.waveNumber > attackCfg.safeWaves)` сохраняет существующее compounding ×1.05 — её правила менять только если меняется общая wave-scaling политика.
- Базовые HP всех зомби в `assets/zombies.json` (поле `types[].Health`) удвоены — это ребалансировка solo-pipeline-yandex-vk#2 / item 8. Поле `hpMul` (per-type relative) не трогалось.

