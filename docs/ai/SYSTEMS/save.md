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
- Для partial reset сохранять snapshot только прогресса: achievements, upgrades tree, modifications, supercomputer progression, drones progression.
- Контракт reset: runtime-мир очищается как при старте уровня, snapshot прогресса восстанавливается после reset, затем в `onAfterRestore` выполняется обязательное доведение runtime.

## Partial reset: post-restore контракт
- Оркестратор snapshot/restore: `src/core/worldReset.js` (`takeProgressSnapshot`, `restoreProgressSnapshot`).
- `drones` входят в progress snapshot, но их позиции не считаются сохранёнными: после restore в `game.js` выполняется телепорт к `supercomputer` с фиксированным offset-паттерном.
- Если `supercomputer` не найден или координаты невалидны, используется fallback позиция `(0, 0)` без прерывания сценария.
- В `onAfterRestore` обязательно сбрасывать zombie runtime к дефолту из `assets/zombies.json` (`spawn.targetAlive`) и пересинхронизировать живую популяцию.
- В `onAfterRestore` обязательно сбрасывать `attackMode` к состоянию off/default: таймеры, ramp-мультипликатор `targetAlive`, погодные/event runtime флаги и связанные эффекты.

## Слоты и ключи localStorage (v1)
- Метаданные слотов: `saveSlotsMeta_v1`.
- Данные слотов: `saveSlot_v1_0 ... saveSlot_v1_9` (индексы `0..9`, UI слоты `1..10`).
- Формат meta: `{ slots: Array<{ name: string, lastSavedAt: number|null }> }`, всегда нормализуется до 10 элементов.
- Формат payload слота: сериализованное состояние игры + `payload.version = 1`.
- Слот `10` (`index = 9`) зарезервирован под Auto (`save before retry`):
	- в UI `Load` он отображается по i18n-ключу `save.autoRetryName` (meta.name игнорируется),
	- в UI `Save` он недоступен для сохранения/rename/delete,
	- логика авто-слота определяется через `slot.isAuto` из `Storage.listSlots()`.

## Backend-абстракция слотов
- Реализация в `src/persistence/storage.js` разделена на backend-контракт и текущий LocalStorage backend.
- Контракт backend (минимум):
	- `listSlots()`
	- `saveSlot(index, payload)`
	- `loadSlot(index)`
	- `deleteSlot(index?)` (опционально)
- UI (`src/core/bootstrap.js`, big/small menu) работает через `Game.Storage.*slot*` API и не зависит от деталей LocalStorage ключей.
- Для будущего online backend используйте `Game.Storage.setSlotsBackend(customBackend)` без изменений UI-слоя.

## Миграция legacy `progress` -> слот 1
- При первом доступе к слотам, если `saveSlotsMeta_v1` ещё не инициализирован и отсутствуют `saveSlot_v1_*`, выполняется миграция.
- Источник миграции: legacy key `progress`.
- Результат миграции: содержимое `progress` копируется в `saveSlot_v1_0` (слот 1), в meta для слота 1 выставляется `lastSavedAt`.
- Legacy key `progress` не удаляется принудительно; continue-flow остаётся совместимым.
- Битые/старые данные не должны падать: parse-ошибки обрабатываются fail-safe с fallback.

## Обработка ошибок storage
- Все операции чтения/записи/парсинга выполняются через safe-wrapper (`try/catch`).
- На quota/parse/доступ-ошибках система возвращает `{ ok: false, error }` и пишет warning в log, без crash.
- UI может показать toast (`menu.save.toast.error`, `menu.load.toast.error`), но игра обязана продолжать работу.

## Save/Load и Auto-trigger
- Manual Save (`small menu -> Save`) пишет payload в выбранный слот `1..9`.
- Load (`big menu Load` и `small menu Load`) использует тот же список 10 статичных слотов, пустые слоты disabled.
- `saveSlot()` обновляет meta только полем `lastSavedAt` (без передачи `name`), чтобы обычное сохранение не перетирало пользовательский rename.
- Autosave `pre-retry` в слот `10` (`index 9`) выполняется на входе в critical-режим **один раз за critical-эпизод**.
	- После выхода из critical-фазы флаг эпизода сбрасывается; при следующем входе autosave снова выполняется.
	- Payload pre-retry: runtime сброшен (2 танка L1, стены L1, монеты 120), meta-прогресс сохранён (achievements, mods, talents, drones, damage points, cannon/fence upgrades).
	- Ошибка autosave (quota/parse/доступ) не ломает critical flow: ставится runtime-флаг `preRetrySaveFailed`, показывается warning/toast.

## Critical modal и save/load сценарии
- `Перезапустить симуляцию`:
	- использует только Auto-slot (`index 9`),
	- если autosave неуспешен или слот пуст/битый — кнопка restart disabled,
	- при успехе применяется тот же load/start path, что и big menu `Load` (`startFromBigMenu({ kind: 'load-slot' ... })`) без запуска второго main loop.
- `Сохранить прогресс и выйти`:
	- открывает save-view в small menu только для manual-слотов `1..9` (`index 0..8`),
	- после успешного сохранения выполняется штатный выход в меню.
- `×`:
	- без дополнительных действий завершает critical-сценарий и возвращает в меню.

## Как воспроизвести и проверить
1. Переименовать manual-слот, сохранить в него, перезагрузить страницу: имя слота не сбрасывается на `Слот X`.
2. Довести HP supercomputer до порога critical (≤ 5%): проверить, что autosave в auto-slot происходит ровно один раз за вход.
3. Выйти из critical и снова войти: autosave снова выполняется один раз.
4. В critical modal нажать restart: если auto-slot валиден, загрузка идёт через общий load-flow и стартовое состояние соответствует pre-retry reset.
5. Вызвать ошибку autosave (например, quota): убедиться, что modal не падает, restart disabled.

## Cannon upgrades state
- Постоянное состояние апгрейдов орудий хранится в `state.player.cannonUpgradesApplied`.
- Формат: массив длиной `60`, индекс `i` соответствует уровню танка `L=i+1`, значение — число применённых улучшений (`>=0`).
- Поле сериализуется в слотовый payload через `player` и восстанавливается при `loadSlot`/`restoreFullState`.
- Backward compatibility:
	- для старых save без поля выполняется fallback на `Array(60).fill(0)`;
	- игра не падает при отсутствии поля, улучшения считаются нулевыми.
- `pending`-улучшения **не сохраняются**: это только UI-состояние внутри открытого `supercomputerMenu`.

## Damage Points в save state
- Runtime-источник доступных очков: `state.totalDamageDealtRaw` и `state.damagePointsSpent`.
- Явное поле в `player`: `state.player.damagePoints` (нормализованное `>=0`, синхронизируется при расчёте доступных очков).
- Слоты сохраняют/восстанавливают `state.player.damagePoints` в составе `player` через `src/persistence/storage.js` (`serializeState -> player`) и `restoreFullState`.
- Debug-изменения очков (`+Add/-Add`) меняют игровое состояние и попадают в slot payload без новых ключей `localStorage`.
