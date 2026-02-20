# Архитектура (кратко)

## Слои
- Вход: `index.html`, `game.js` (~9500 строк), `src/core/bootstrap.js`
- Ядро: `src/core/runtimeTasks.js` (timer/RAF suspend/resume), `src/core/worldReset.js`
- Домен: `src/mechanics/*` (cannonUpgrades, combat, drones, economy, garage, levelFlow, progression, supercomputer, targeting, zombieSpawn и др.), `src/systems/*`, `src/persistence/*` (initialState, storage, offlineProgress)
- Рендер/ввод: `src/render/*`, `src/ui/*`, `src/audio/*`
- Конфиг: `src/config/*` (audioUi, criticalAudioPolicy, criticalModalTuning, layoutTuning, worldEvents)
- Поддержка: `src/analytics/*`, `src/telemetry/*`, `src/flags/*`, `src/experiments/*`

## Контракты
- В `src/*` использовать IIFE + `'use strict'` + `global.Game.*`.
- Не раздувать `game.js`: новая логика должна жить в `src/*`.
- Горячий путь (`loop`/`draw`/`step*`) без лишних аллокаций; `draw()` только рисует.
- game.js содержит inline fallback для ключевых модулей (InitialState, Progression, ZombieSpawn, CannonUpgrades); модули — canonical source, fallback — safety net.
