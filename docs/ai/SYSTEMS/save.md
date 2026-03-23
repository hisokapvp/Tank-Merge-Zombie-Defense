# Система: Save / Offline

> Обновлено: 2026-03-23.

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

## Achievement persistence contract
- `createInitialState()` обязан seed'ить `achievements.rewarded`, `achievements.totalManualFenceRepairs`, `achievements.totalModifierTechUnlocks`, `achievements.totalDroneAcquisitions`, `achievements.totalNoRepairAttackWaveStreak`, `achievements.completedModifierTechs` и mirrored `stats.manualFenceRepairsCount/modifierTechUnlocksCount/droneAcquisitionsCount/noRepairAttackWaveStreakCount`; эти поля не должны появляться лениво уже после первого gameplay-события: [src/persistence/initialState.js](../../../src/persistence/initialState.js)
- `serializeState()` сохраняет `stats.manualFenceRepairsCount/modifierTechUnlocksCount/droneAcquisitionsCount/noRepairAttackWaveStreakCount` в нормализованном виде с fallback на legacy achievement totals и одновременно пишет весь объект `achievements`, чтобы slot payload держал counters, `rewarded` и `completedModifierTechs` как связанный контракт: [src/persistence/storage.js](../../../src/persistence/storage.js)
- `restoreFullState()` и `applySavedProgress()` обязаны восстановить `rewarded`, `totalManualFenceRepairs`, `totalModifierTechUnlocks`, `totalDroneAcquisitions`, `totalNoRepairAttackWaveStreak`, `completedModifierTechs`, а затем вызвать `reconcileAchievementRewardsForUnlocked()`; это позволяет добрать unlock-награды без повторной выдачи уже помеченных reward modes: [game.js](../../../game.js#L5150-L5200), [game.js](../../../game.js#L5376-L5412)
- Перед restore/apply runtime обязан сбрасывать transient state no-repair episode tracker, чтобы streak progress брался только из save payload, а не из stale in-memory episode state: [game.js](../../../game.js)
- Gameplay поднимает счётчики из `tryRepairFenceSegmentAt()`, `addDron(level)` и attack-mode episode tracker; achievements runtime зеркалит их в `state.stats`, а persistence должна считать `stats.*Count` canonical при наличии и использовать `achievements.total*` только как fallback: [game.js](../../../game.js), [src/mechanics/achievements.js](../../../src/mechanics/achievements.js)
- Текущий regression pack отдельно проверяет сохранение `rewarded` map, drone acquisition totals, no-repair streak restore и retroactive recalc/reward dedupe после load/apply через `TUT-8R..TUT-8W`: [Test/pack4/tutorial_first_run_runtime.test.js](../../../Test/pack4/tutorial_first_run_runtime.test.js)

## New Game baseline (не partial reset)
- `New game` идёт отдельным UI-path: `src/core/bootstrap.js` очищает legacy `progress` и вызывает `resetGameState({ reason: 'new_game' })`, не используя snapshot partial restart: [src/core/bootstrap.js](../../../src/core/bootstrap.js#L557-L563), [game.js](../../../game.js#L7875-L7952).
- Baseline стартового состояния задаётся `createInitialState()` и дополнительно фиксируется веткой `reason === 'new_game'`: `player.talentPoints = 0`, `player.damagePoints = 0`, `talentsV2.freePoints = 0`, `freeTalentPointsV2 = 0`, `supercomputer.computerLevel = 0`, `xp = 0`, `xpToNext = 50`, а `productionLine.firstNewGameBoxGuaranteedPending = true`, чтобы первая коробка конвейера гарантированно дала `one_big_chip`; при открытии этот guarantee-path идёт через `makeGuaranteedNewGameBigChip()` и выдаёт канонический red чип L1 (`chipId > 0`, `sourceComboKey` = sorted `modIds`, `3` уникальных base `modIds` из `1..9`): [src/persistence/initialState.js](../../../src/persistence/initialState.js#L4-L133), [game.js](../../../game.js#L454-L501), [src/mechanics/productionLine.js](../../../src/mechanics/productionLine.js#L105-L122), [src/mechanics/productionLine.js](../../../src/mechanics/productionLine.js#L192-L205), [src/mechanics/productionLine.js](../../../src/mechanics/productionLine.js#L212-L246).
- `xpNeededForLevel(0) = 50`, а fallback world-reset для суперкомпьютера тоже считает `50` валидным первым порогом; уровень `0` — штатный save/runtime-сценарий: [src/mechanics/progression.js](../../../src/mechanics/progression.js#L16-L21), [src/core/worldReset.js](../../../src/core/worldReset.js#L26-L33), [src/core/worldReset.js](../../../src/core/worldReset.js#L68-L70), [src/core/worldReset.js](../../../src/core/worldReset.js#L130-L132).
- Partial restart продолжает сохранять текущие `damagePoints`, `damagePointsSpent`, `computerLevel`, `xp` и `xpToNext` через progress snapshot; эти значения не должны теряться из-за новой baseline логики: [src/core/worldReset.js](../../../src/core/worldReset.js#L33-L79), [src/core/worldReset.js](../../../src/core/worldReset.js#L81-L142).
- Флаг `productionLine.firstNewGameBoxGuaranteedPending` сериализуется через `Game.ProductionLine.serialize()/deserialize()`, поэтому ручное сохранение/загрузка до открытия первой коробки не теряет ни саму гарантию, ни семантику выдачи canonical red chip после открытия: [src/mechanics/productionLine.js](../../../src/mechanics/productionLine.js#L301-L322), [src/mechanics/productionLine.js](../../../src/mechanics/productionLine.js#L212-L246).

## Partial reset: post-restore контракт
- Оркестратор snapshot/restore: `src/core/worldReset.js` (`takeProgressSnapshot`, `restoreProgressSnapshot`).
- `drones` входят в progress snapshot, но их позиции не считаются сохранёнными: после restore в `game.js` выполняется телепорт к `supercomputer` с фиксированным offset-паттерном.
- Если `supercomputer` не найден или координаты невалидны, используется fallback позиция `(0, 0)` без прерывания сценария.
- В `onAfterRestore` обязательно сбрасывать zombie runtime к дефолту из `assets/zombies.json` (`spawn.targetAlive`) и пересинхронизировать живую популяцию.
- В `onAfterRestore` обязательно сбрасывать `attackMode` к состоянию off/default: таймеры, ramp-мультипликатор `targetAlive`, погодные/event runtime флаги и связанные эффекты.
- В `onAfterRestore` для partial restart обязательно фиксировать стены в base tier (`state.fenceLevel = 1`) с reinit fence-сегментов tier1.
- В `onAfterRestore` обязательно сбрасывать накопленную инфляцию покупок в абсолютный старт (`buyCounts = {}`, `buyPrices = {}`), не затрагивая базовые формулы цены.

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

## Player Chips (инвентарь чипов мастерской)
- Runtime-источник: `Game.HangarChipsUI.getPlayerChips()` / `.setPlayerChips(arr)`.
- Формат: массив `{ chipId, chipColor, modIds, sourceComboKey, level, count }`.
- Сериализуется в `serializeState()` как `playerChips` (fallback `[]`).
- Восстанавливается в `restoreFullState` и `applySavedProgress` с синхронизацией `HangarChipsUI.setPlayerChips`.
- Backward compatibility: старые save без `playerChips` → пустой массив, игра не падает.
- Используется в `getChipLevelDmgMul(cellIndex)` для расчёта бонуса урона (+10% за каждый уровень чипа).
- Гарантированная награда первой `new_game` коробки не вводит отдельный save-shape: в инвентарь попадает тот же объект `{ chipId, chipColor, modIds, sourceComboKey, level, count }`, что и для обычных больших чипов: [src/mechanics/productionLine.js](../../../src/mechanics/productionLine.js#L88-L122), [src/mechanics/productionLine.js](../../../src/mechanics/productionLine.js#L241-L246).

## Tech Studying (процесс изучения технологий)
- Runtime-источник: `Game.HangarChipsUI.getTechStudying()` / `.setTechStudying(obj)`.
- Формат: `{ techId: string, remaining: number, total: number }` или `null`.
- Сериализуется в `serializeState()` как `techStudying` (fallback `null`).
- Восстанавливается в `restoreFullState` и `applySavedProgress` через `HangarChipsUI.setTechStudying(saved.techStudying)`, что автоматически перезапускает таймер обратного отсчёта.
- Backward compatibility: старые save без `techStudying` → `null`, процесс изучения не активен.
- `timer` (id `setInterval`) не сериализуется — пересоздаётся при восстановлении.

## V1 talents save fields (deprecated)
- Поля `talentsPending` и `activeCooldowns` больше не сохраняются и не восстанавливаются.
- Поле `talentsApplied` сохранено для совместимости миграции V1→V2 в `talentsV2.js`.

## Cannon upgrades state
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

## TalentsV2 (PACK 7, save shape + migration)
- Runtime API: `Game.TalentsV2` (`src/systems/talents/talentsV2.js`).
- Save-структура после миграции:
	- `player.talentsVersion` (может отсутствовать);
	- `player.talentsV2 = { ranksById: {...}, freePoints: number }`;
	- `player.freeTalentPointsV2` (дублирует `talentsV2.freePoints` для совместимости UI).
- Триггер миграции v1 -> v2:
	- если `talentsVersion` отсутствует или `< 2`, `TalentsV2` выполняет миграцию legacy-данных и сразу сохраняет patch (`talentsVersion=2`, `talentsV2`, `freeTalentPointsV2`);
	- если `talentsVersion >= 2`, миграция не выполняется (идемпотентно).
- Политика unknown/refund/clamp:
	- неизвестные v1-имена не ломают загрузку и возвращаются в `freePoints` как refund;
	- ранги v2 всегда clamp по `maxRank` из дерева.
