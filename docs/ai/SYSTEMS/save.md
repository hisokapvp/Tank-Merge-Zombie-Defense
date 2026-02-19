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

## Save slots meta (`saveSlotsMeta_v1`)
- Метаданные слотов хранятся в `src/persistence/storage.js` в том же ключе `saveSlotsMeta_v1` (без новых ключей).
- Нормализованный формат на слот: `{ name: string, lastSavedAt: number|null }`.
- `lastSavedAt` хранится как timestamp в миллисекундах (`Date.now()`), для пустого значения используется `null`.
- API обновления имени: `setSlotName(slotIndex, name)` (sanitize + fallback на default slot name).
- API обновления даты: `markSlotSaved(slotIndex, timestampMs)` — загружает meta, обновляет `lastSavedAt`, сохраняет обратно в `saveSlotsMeta_v1`.
- API проверки наличия сейвов: `hasAnySaves()` — возвращает `true`, если хотя бы у одного слота `lastSavedAt != null`.
- Big menu `Load` обязан использовать именно этот критерий (`lastSavedAt`), а не имя слота/другие эвристики.
