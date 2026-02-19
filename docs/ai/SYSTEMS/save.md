# Система: Save / Offline

## Где править
- Хранилище: `src/persistence/storage.js`, `src/persistence/initialState.js`
- Офлайн-прогресс: `src/persistence/offlineProgress.js`, `src/persistence/offlineRewardModel.js`
- UI потока: `src/ui/offlineModal.js`, `src/ui/continueFlow.js`
- Partial runtime reset: `src/core/worldReset.js` + `game.js` (`resetWorldRuntimeState`, `restartSimulationPartial`)

## Правила
- Новые ключи `localStorage` добавлять только в разрешённых модулях.
- При изменении формата сейва обеспечить миграцию и fallback.
- Для офлайн-наград сохранять цепочку `offlineProgress -> offlineModal -> continueFlow`.
- Для partial reset сохранять snapshot только прогресса: achievements, upgrades tree, modifications, supercomputer progression.
- Контракт reset: runtime-мир очищается как при старте уровня, snapshot прогресса восстанавливается после reset.
