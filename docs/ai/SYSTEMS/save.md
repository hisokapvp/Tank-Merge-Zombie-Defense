# Система: Save / Offline

## Где править
- Хранилище: `src/persistence/storage.js`, `src/persistence/initialState.js`
- Офлайн-прогресс: `src/persistence/offlineProgress.js`, `src/persistence/offlineRewardModel.js`
- UI потока: `src/ui/offlineModal.js`, `src/ui/continueFlow.js`

## Правила
- Новые ключи `localStorage` добавлять только в разрешённых модулях.
- При изменении формата сейва обеспечить миграцию и fallback.
- Для офлайн-наград сохранять цепочку `offlineProgress -> offlineModal -> continueFlow`.
