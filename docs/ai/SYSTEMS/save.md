# SYSTEM: Save / Offline

## Purpose

Сохраняет прогресс, восстанавливает состояние после перезапуска и рассчитывает офлайн-награду.

## Быстрый ответ (куда идти)

- Save/load: `src/persistence/storage.js`.
- Offline reward model: `src/persistence/offlineRewardModel.js`.
- Runtime offline calc: `src/persistence/offlineProgress.js`.
- UX флоу: `src/ui/continueFlow.js` + `src/ui/offlineModal.js`.

## Key files

- `src/persistence/storage.js`
- `src/persistence/offlineRewardModel.js`
- `src/persistence/offlineProgress.js`
- `src/ui/continueFlow.js`
- `src/ui/offlineModal.js`
- `game.js`

## Entrypoints

- `Game.Storage.loadGame()` и `Game.Storage.saveGame(state, meta)`.
- `Game.OfflineProgress.computeOfflineRewards(state, elapsedMs)`.
- `ContinueFlow.onContinueClick(...)`.
- Autosave в `loop()` (`game.js`) примерно раз в 7 секунд.

## Data & config

- Основной ключ прогресса: `progress`.
- Save version: `SAVE_VERSION = 2`.
- Offline cap: `OFFLINE_CAP_MS` (12 часов по умолчанию).
- `meta.lastSeenAt` обновляется на `visibilitychange/pagehide`.

## Common edits

1. **Добавить новое поле в сохраняемое состояние**
   - Добавить в `serializeState` и восстановление в `game.js`.

2. **Изменить формулу офлайн-награды**
   - Предпочтительно в `offlineRewardModel.js` (чистая модель).
   - Runtime hooks в `offlineProgress.js`.

3. **Изменить порог показа offline modal**
   - `OFFLINE_THRESHOLD_MS` в `src/ui/continueFlow.js`.

4. **Обновить текст/рендер offline modal**
   - `src/ui/offlineModal.js` + i18n ключи.
   - Визуальный reference брать из settings modal (`menuPanel/menuSettings`).
   - Тексты править только парой RU/EN (`Деньги/Money`), иконки `$`/`⭐` держать рядом с числами.

## Don’t touch / risks

- Не ломай backward-совместимость load legacy progress.
- Не меняй save ключи без миграции.
- Не добавляй медленные операции в autosave ветку loop.

## Checks

- `node Test/pack8/offlineProgress.test.js`
- `node Test/pack9/offlineModal_ui_i18n.test.js`
- Ручной сценарий: свернуть вкладку > 5 мин, вернуться, получить офлайн-награду.
- UI-check offline modal: накопительный блок по центру, кнопка claim снизу.
