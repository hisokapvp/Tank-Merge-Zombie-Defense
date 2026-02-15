# SYSTEM: Save / Offline

## Где искать

- Save/load: `src/persistence/storage.js`
- Initial defaults/state shape: `src/persistence/initialState.js`
- Offline модель: `src/persistence/offlineRewardModel.js`, `src/persistence/offlineProgress.js`
- UX: `src/ui/continueFlow.js`, `src/ui/offlineModal.js`
- Boot integration: `src/core/bootstrap.js`

## Что править

- Новые поля прогресса: сериализация + восстановление.
- Offline формулы: сначала модель, потом runtime hooks.
- Порог показа offline modal: `OFFLINE_THRESHOLD_MS`.
- Любые изменения схемы: синхронно `initialState` + `storage` + restore path в boot.

## Риски

- Сохранять backward compatibility save.
- Не менять ключи сохранения без миграции.
- Не ломать ветку `legacyProgress` при загрузке старых сейвов.

## Мини-проверка

- `node Test/pack8/offlineProgress.test.js`
- `node Test/pack9/offlineModal_ui_i18n.test.js`
- Ручной сценарий: пауза > 5 мин и возврат.
