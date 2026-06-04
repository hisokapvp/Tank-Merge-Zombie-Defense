# Система: Save / Offline

> Обновлено: 2026-04-24.

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

## Offline combat snapshot contract
- `Game.OfflineProgress` теперь в первую очередь читает `TankSprites.getTank(level).stats.baseDamage/attackSpeed` и `ZombieSprites.types[level-1].health|Health`. Legacy формулы `FIRE_RATE_BASE/FIRE_RATE_ADD_PER_LEVEL/DMG_MULT_PER_LEVEL/ZOMBIE_HP_*` остаются только fallback-path, если asset loader ещё не поднят. Это держит offline rewards в паритете с repaired `assets/tanks.json` / `assets/zombies.json`, а не со старыми runtime-кривыми: [src/persistence/offlineProgress.js](../../../src/persistence/offlineProgress.js#L1-L150), [assets/tanks.json](../../../assets/tanks.json#L1-L220), [assets/zombies.json](../../../assets/zombies.json#L1-L220).
- Merge popup stats и showcase fire-loop зеркалят тот же asset snapshot: `mergePopupStats.js` и `mergePopup.js` больше не выводят damage/fire rate из legacy BAL curve, а берут `baseDamage/attackSpeed` прямо из `TankSprites`. Это важно для пользовательской parity между offline modal, merge preview и live combat: [src/ui/mergePopup/mergePopupStats.js](../../../src/ui/mergePopup/mergePopupStats.js#L9-L22), [src/ui/mergePopup.js](../../../src/ui/mergePopup.js#L256-L307).

## Payload Contract Map

> Эта карта — **design intent**, а не автодамп `serializeState()`. При добавлении нового поля в `serializeState()` / `createInitialState()` / `restoreFullState()` / `applySavedProgress()` обязательно обновить таблицу ДО merge. Автодамп runtime-полей запрещён: если поле `runtime-derived`, оно не попадает ни в save payload, ни в эту таблицу.

### Ownership tags

- `core` — базовые валюты, прогрессия игрока, счётчики, которые определяют identity сейва.
- `hangar` — инвентарь чипов/фрагментов мастерской, технологии, прогресс ангара.
- `progression` — достижения, апгрейды, talents v2, supercomputer, drones, cannon/fence upgrades.
- `economy` — purchase tracking (`buyCounts`, `buyPrices`) и связанные инфляционные счётчики.
- `world` — состояние мира, мапы, сиды, fence runtime, attack-mode runtime.
- `runtime-derived` — не сохраняется; восстанавливается из других полей или пересоздаётся.

### Таблица полей `serializeState()` → payload v1

Все ссылки даны на canonical источники записи и чтения. Если писатель добавляется в новом модуле, его путь тоже должен быть задокументирован здесь.

| Поле payload | Owner tag | Canonical writer | Writer источник | Load fallback / нормализация |
|---|---|---|---|---|
| `coins` | core | `state.coins` | [game.js](../../../game.js), покупки/награды | `0` если не Number.isFinite |
| `kills` | core | `state.kills` | [game.js](../../../game.js), combat flow | `0` |
| `totalDamageDealtRaw` | core | `state.totalDamageDealtRaw` | [game.js](../../../game.js) | `0`, normalize через `normalizeTotalDamageDealtRaw` |
| `damagePointsSpent` | core | `state.damagePointsSpent` | [game.js](../../../game.js) | `0`, normalize через `normalizeDamagePointsSpent` |
| `player` | progression | `state.player` | [src/persistence/initialState.js](../../../src/persistence/initialState.js), [game.js](../../../game.js) (`cannonUpgradesApplied`, `damagePoints`) | object merge с `createInitialState().player` |
| `cells` | core | `state.cells` | [game.js](../../../game.js) hangar cells | массив фиксированной длины |
| `productionLine` | hangar | `state.productionLine` | [src/mechanics/productionLine.js](../../../src/mechanics/productionLine.js) `serialize()`/`deserialize()` | `null` → `createInitialState().productionLine` |
| `playerChips` | hangar | `state.playerChips` (canonical owner) | [game.js](../../../game.js) `Game.State.setPlayerChips()` + [src/persistence/storage.js](../../../src/persistence/storage.js#L485) | `[]` если отсутствует или не массив; HangarChipsUI — derived view |
| `playerFragments` | hangar | `Game.HangarChipsUI.getPlayerFragments()` | [src/ui/hangarChipsUI.js](../../../src/ui/hangarChipsUI.js) | `[]` + `normalizeFragmentsInventory()` |
| `techStudying` | hangar | `Game.HangarChipsUI.getTechStudying()` | [src/ui/hangarChipsUI.js](../../../src/ui/hangarChipsUI.js) | `null`, таймер пересоздаётся |
| `drones` | progression | `state.drones` | [src/mechanics/drones.js](../../../src/mechanics/drones.js), [src/persistence/dronesPersist.js](../../../src/persistence/dronesPersist.js) | `[]` через `DronesApi.restoreSavedDrones` |
| `achievements` | progression | `state.achievements` | [src/mechanics/achievements.js](../../../src/mechanics/achievements.js), [game.js](../../../game.js) | merge с `createInitialState().achievements`; `rewarded`, `totalManualFenceRepairs`, `totalModifierTechUnlocks`, `totalDroneAcquisitions`, `totalNoRepairAttackWaveStreak`, `completedModifierTechs` seed'ятся |
| `stats` | progression | `state.stats` | [game.js](../../../game.js) (`manualFenceRepairsCount`, `modifierTechUnlocksCount`, `droneAcquisitionsCount`, `noRepairAttackWaveStreakCount`) | `stats.*Count` canonical, `achievements.total*` — legacy fallback |
| `talentsV2` / `talentsApplied` | progression | V2 — собственный store; legacy `talentsApplied` только для migration V1→V2 | [src/systems/talents/talentsV2.js](../../../src/systems/talents/talentsV2.js) | V1 `talentsPending` / `activeCooldowns` deprecated, больше не сохраняются |
| `supercomputer` | progression | `state.supercomputer` | [game.js](../../../game.js) supercomputer flow | `computerLevel = 0` baseline для new game |
| `boostUntil`, `activeEffects` | world | `state.boostUntil`, `state.activeEffects` | [game.js](../../../game.js) | `0` / `[]` |
| `fenceState` | world | `state.savedFenceState` | [game.js](../../../game.js) restore path | `{ segmentsPerSide: null, hpById: {} }` |
| `fenceRepairCount` | progression | `state.fenceRepairCount` | [game.js](../../../game.js) `tryRepairFenceSegmentAt()` | `0`; сбрасывается на partial/full reset |
| `nextCrateAt`, `boostUntil`, `mapSeeds` | world | `state.*` | [game.js](../../../game.js), world init | сохраняются если присутствуют |
| `maxTankLevelAchieved` | progression | `state.maxTankLevelAchieved` | [game.js](../../../game.js) | `1` baseline |
| `zombieWaveAtkMult`, `zombieWaveHpMult` | world | `state.zombieWave*` | [game.js](../../../game.js) | `normalizeZombieWaveMultiplier()` |
| `forceFenceRuntimeResetOnLoad` | runtime-derived | transient flag в payload для cross-session triggers | [game.js](../../../game.js) | `false` |
| `payload.version` | meta | `serializeState()` обёртка | [src/persistence/storage.js](../../../src/persistence/storage.js) | `SAVE_VERSION = 2` (текущая версия save shape; см. [src/persistence/storage.js](../../../src/persistence/storage.js#L8)) |

### Канонический schema typedef

- Канонический JSDoc для payload — `@typedef SerializedState` в [src/persistence/serializedStateTypes.js](../../../src/persistence/serializedStateTypes.js). `serializeState()` помечен `@returns {import('./serializedStateTypes').SerializedState}` (см. [src/persistence/storage.js](../../../src/persistence/storage.js#L370)). Любое новое поле сначала добавляется в typedef, затем в эту таблицу, затем в writer.
- Schema-version поле — `payload.version` (= `SAVE_VERSION`); отдельного `schema_version` нет. `preserve-unknown = false` для unknown top-level keys: на restore они игнорируются и логируются через `Game.Diagnostics.reportUnknownPayloadKeys` (dev-only diagnostic, runtime safe).
- Save payload не содержит PII / persona-specific identifiers; всё, что в нём лежит — gameplay state.

### Rubric: type / default / restore-reset / reset-scope

Для каждой строки таблицы payload выше канонический rubric:

- **type** — JS shape поля (определён в `SerializedState` typedef): `number`, `string`, `boolean`, `Array<...>`, `Object<...>`, `null`.
- **default** — значение, которое writer кладёт в payload, если runtime не задал ничего (источник — `createInitialState()` либо normalize-функция в `restoreFullState`/`applySavedProgress`).
- **restore-reset** — что делает loader, если поле отсутствует или невалидно: `default-on-missing` (берёт seed из `createInitialState()`), `normalized` (прогоняет через normalize-функцию), `null-allowed` (legitimate `null`), `legacy-fallback` (пробует устаревший alias из старых save).
- **reset-scope** — поведение поля при `restartSimulationPartial()`:
	- `partial-preserve` — поле сохраняется через `takeProgressSnapshot()` и восстанавливается в `restoreProgressSnapshot()` (talents, upgrades, drones, achievements, supercomputer progression, damage points, cannon/fence upgrades, mods, playerChips, playerFragments, techStudying);
	- `partial-reset` — поле обнуляется до `createInitialState()` baseline (walls L1, `buyCounts={}`, `buyPrices={}`, `maxTankLevelAchieved=1`, `attackMode` off, `fenceRepairCount=0`, `boostUntil=0`, `activeEffects=[]`, `nextCrateAt`, `mapSeeds`, `cells`, `coins=40`, `kills`, `zombieWave*` mults);
	- `partial-reseed` — поле получает специальный baseline (например, 1 стартовый танк L1 в hangar `cells`).
- **last-modified** — write-side источник: вписывайте дату коммита (ISO `YYYY-MM-DD`), который последним менял writer / shape поля. Используется review-агентом для поиска просроченных записей.

Правила заполнения:

1. Новое поле обязано иметь **все** rubric-значения **до** merge — partial rubric блокирует review.
2. Если поле не сериализуется (`runtime-derived`), оно остаётся в таблице как `runtime-derived` без `reset-scope` (runtime сам пересоздаст).
3. Поле с `reset-scope = partial-preserve` должно появиться в `takeProgressSnapshot()`/`restoreProgressSnapshot()` в [src/core/worldReset.js](../../../src/core/worldReset.js); противоречие между этой таблицей и `worldReset.js` — failure-visible баг.
4. Поле с `reset-scope = partial-reset` должно явно очищаться в `onAfterRestore` либо по контракту `createInitialState()`. Тихая утечка в partial-restart — баг.

### TUT-8R..TUT-8W — regression pack anchor

Полный регрессионный набор для save/restore/partial-reset инвариантов лежит в:

- [Test/pack4/tutorial_first_run_runtime.test.js](../../../Test/pack4/tutorial_first_run_runtime.test.js) — кейсы `TUT-8R` (rewarded map persistence), `TUT-8S` (drone acquisition totals), `TUT-8T` (no-repair streak restore), `TUT-8U` (retroactive recalc), `TUT-8V` (reward dedup after load), `TUT-8W` (apply-after-load reconcile).

При добавлении нового поля с нетривиальным `restore-reset`/`reset-scope` обязательно добавлять кейс в этот pack под следующим свободным `TUT-8X` slot. PR без regression case на новое поле — failure-visible.

### Deprecation policy

Поле помечается deprecated при следующих условиях:

1. Writer удалён (или явно превратился в no-op);
2. Loader продолжает читать поле как `legacy-fallback` минимум один SAVE_VERSION-цикл, чтобы старые save не теряли данные;
3. Срок жизни fallback фиксируется в подсекции `## V1 talents save fields (deprecated)` (или аналогичной для нового поля) с явным указанием версии bump'а, в которой fallback будет удалён;
4. После удаления fallback соответствующая строка таблицы либо удаляется, либо переезжает в подсекцию `Removed fields` с last-modified датой удаления.

Запрещено: тихо удалять поле из writer без записи в таблицу; оставлять deprecated-поле без явного fallback-окна; реюзать освободившийся ключ под новую семантику.

### Migration policy

- **`playerChips`**: слот без поля `playerChips` или с не-массивом → нормализуется в `[]` на load (см. `storage.js` L485 и restore paths в `game.js`). Это уже реализованный контракт — фиксируем, чтобы новые fields следовали тому же шаблону.
- **Новое hangar-поле**: добавить seed в `createInitialState()` с пустым дефолтом → добавить писателя в `serializeState()` → добавить нормализацию в `restoreFullState()` и `applySavedProgress()` → добавить строку в эту таблицу с owner tag `hangar`.
- **Runtime-derived поля** (таймеры `setInterval`, кешированные производные): не сериализовать. Восстанавливать из canonical writer'а через post-restore hooks, а не из payload.

### Контракт "не автодамп"

Запрещено:
- генерировать таблицу из `Object.keys(serializeState())` — это reflection runtime, не design intent;
- добавлять поле в `serializeState()` без соответствующей строки в таблице и owner tag;
- использовать эту карту как runtime API — она только документация для merge review.


## Achievement persistence contract
- `createInitialState()` обязан seed'ить `achievements.rewarded`, `achievements.totalManualFenceRepairs`, `achievements.totalModifierTechUnlocks`, `achievements.totalDroneAcquisitions`, `achievements.totalNoRepairAttackWaveStreak`, `achievements.completedModifierTechs` и mirrored `stats.manualFenceRepairsCount/modifierTechUnlocksCount/droneAcquisitionsCount/noRepairAttackWaveStreakCount`; эти поля не должны появляться лениво уже после первого gameplay-события: [src/persistence/initialState.js](../../../src/persistence/initialState.js)
- `serializeState()` сохраняет `stats.manualFenceRepairsCount/modifierTechUnlocksCount/droneAcquisitionsCount/noRepairAttackWaveStreakCount` в нормализованном виде с fallback на legacy achievement totals и одновременно пишет весь объект `achievements`, чтобы slot payload держал counters, `rewarded` и `completedModifierTechs` как связанный контракт: [src/persistence/storage.js](../../../src/persistence/storage.js)
- `restoreFullState()` и `applySavedProgress()` обязаны восстановить `rewarded`, `totalManualFenceRepairs`, `totalModifierTechUnlocks`, `totalDroneAcquisitions`, `totalNoRepairAttackWaveStreak`, `completedModifierTechs`, а затем вызвать `reconcileAchievementRewardsForUnlocked()`; это позволяет добрать unlock-награды без повторной выдачи уже помеченных reward modes: [game.js](../../../game.js#L5150-L5200), [game.js](../../../game.js#L5376-L5412)
- `achievements.totalSimulationResets` принадлежит critical-entry seam, а не кнопкам внутри modal: как только supercomputer входит в critical state, game.js инкрементит canonical counter до `savePreRetryPayloadToAutoSlot()`, поэтому и `Перезапустить симуляцию`, и `Сохранить прогресс и выйти` используют одно и то же уже обновлённое значение. UI (`simResetsText`) читает только это canonical поле и не должен заводить display-only mirrors: [game.js](../../../game.js), [src/core/worldReset.js](../../../src/core/worldReset.js)
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
- `fenceRepairCount` сериализуется через `serializeState()` в `storage.js` (L468), восстанавливается при load, seed'ится как `0` в `initialState.js` (L58) и сбрасывается на `0` при partial/full reset (`game.js` L2418); runtime инкремент через `tryRepairFenceSegmentAt()` (`game.js` L7523).

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
	- Payload pre-retry: runtime сброшен (1 стартовый танк L1 в ангаре, стены L1, монеты 40), meta-прогресс сохранён (achievements, mods, talents, drones, damage points, cannon/fence upgrades), а purchase-economy возвращена к baseline (`buyCounts = {}`, `buyPrices = {}`, `maxTankLevelAchieved = 1`).
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
- **Canonical owner**: `state.playerChips` в [game.js](../../../game.js) (инициализация около `let state = createInitialState();`, API `window.Game.State.getPlayerChips()` / `.setPlayerChips(arr)`).
- **Derived view**: `Game.HangarChipsUI.getPlayerChips()` / `.setPlayerChips(arr)` делегируют в canonical owner; внутренний кеш в `HangarChipsUI` удалён. Читатели всегда получают актуальный массив из `state.playerChips`, writers всегда пишут в `state.playerChips`. Двунаправленная синхронизация запрещена (см. postmortem solo-pipeline-yandex-vk#1 / avoid).
- **Bootstrap fallback**: `_playerChipsFallback` в `hangarChipsUI.js` используется только если `window.Game.State.getPlayerChips` ещё не определён на момент обращения (защитный bootstrap). При первом успешном `setPlayerChips` через canonical API fallback обнуляется.
- Формат: массив `{ chipId, chipColor, modIds, sourceComboKey, level, count }`.
- Сериализуется в `serializeState()` как `playerChips` (fallback `[]`): [src/persistence/storage.js](../../../src/persistence/storage.js#L485).
- Восстанавливается в `restoreFullState` и `applySavedProgress`: `state.playerChips = saved.playerChips;` + `HangarChipsUI.setPlayerChips(saved.playerChips)` (оба writer'а теперь идут в canonical owner; вызов HangarChipsUI — идемпотентный sync).
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
## Shop (state.shop payload block)

> Добавлено: 2026-05-04 (`solo-pipeline-yandex-vk` batch #7 / item 20). Контракт магазина в целом — [docs/ai/SYSTEMS/shop.md](./shop.md); как добавить SKU — [docs/ai/PLAYBOOKS/shop-add-bundle.md](../PLAYBOOKS/shop-add-bundle.md); user-facing мануал — [docs/SHOP_GUIDE_RU.md](../../SHOP_GUIDE_RU.md).

- Runtime-источник: `state.shop`. Default-инициализация в [src/persistence/initialState.js](../../../src/persistence/initialState.js#L205-L220) (добавлено в batch #2 / item 6).
- Save-структура (поля payload):
	- `state.shop.entitlements` — `{ [purchaseToken: string]: { productId, grantedAt, deliveredAt|null, contentsSnapshot, signature } }`. Источник истины для «уже оплачено и (опционально) выдано». Idempotency-ключ для `applyBundle`.
	- `state.shop.pendingDeliveries` — `string[]`, очередь tokens, которые `recordPurchase` положил в очередь, но `markDelivered` ещё не зафиксировал. Bootstrap replay (см. ниже) обязан реплеить **объединение** этой очереди и `Game.YandexPayments.getPurchases()`.
	- `state.shop.pendingExports` — `Array<{ type, purchaseToken, productId, ts, payload? }>`. Аналитический seam `ShopLedger.exportEvent` (только если `Game.Config.Shop.ledgerExport.enabled === true`).
	- `state.shop.lastSync` — `number` (unix-ms), timestamp последнего успешного `Game.CloudSave.pullShop`.
- Сериализация: `state.shop` целиком пишется в slot payload через стандартный `serializeState()` ([src/persistence/storage.js](../../../src/persistence/storage.js)) и зеркалится в [assets/saveSchema.json](../../../assets/saveSchema.json) (добавлено в batch #3 / item 7). Backwards-compat: старые save без `shop` → seed-объект из `createInitialState()`.
- Owner tag для Payload Contract Map: `economy` (entitlements + pending очереди), отдельная category за пределами `core/hangar/progression/world`.

### Cloud-save policy «cloud wins for entitlements only»

`Game.CloudSave` ([src/persistence/cloudSave.js](../../../src/persistence/cloudSave.js)) — отдельный adapter поверх Yandex `player.setData/getData`, который пишет **только** `state.shop` под ключом `tmzd_shop_v1` (host KV ≤ 200 KiB, throttle 1/5s). Локальный slot-based `localStorage` save и cloud KV — **разные namespace'ы**, они не пересекаются.

Контракт мерджа на `pullShop()`:

- **Cloud wins для entitlements**: если cloud-side `entitlements[token]` существует, а локальный — нет (или старее по `grantedAt`), берётся cloud-версия. Это защищает от пропавших entitlement'ов после очистки cookies или смены устройства.
- **Local wins для `deliveredAt`**: даже если cloud показывает entitlement как уже выданный, локальный `deliveredAt == null` означает, что текущая инсталляция ещё не получила контент → bootstrap replay сделает повторный `applyBundle` (idempotent по token). Аналогично, если local уже выставил `deliveredAt = T`, cloud не может «откатить» это в `null`.
- **`pendingDeliveries`** не мерджится с cloud напрямую — это локальная очередь текущей сессии. Bootstrap replay вычитывает union `getPurchases() ∪ pendingDeliveries` (см. [docs/ai/PLAYBOOKS/shop-add-bundle.md#union-replay-контракт-getpurchases--stateshoppendingdeliveries](../PLAYBOOKS/shop-add-bundle.md)).
- **`lastSync`** — последняя успешная попытка `pullShop`; при offline/`scopes:false` reject `pullShop` молча резолвит `null` и `lastSync` не меняется.

Kill-switch `Game.Config.Shop.cloudSave.enabled = false` ([src/config/shop.js](../../../src/config/shop.js#L30-L34)) делает `Game.CloudSave.*` целиком no-op; локальный save продолжает работать без изменений.

### Reset-scope для `state.shop`

- `partial-restart`: `state.shop` входит в `takeProgressSnapshot()`/`restoreProgressSnapshot()` ([src/core/worldReset.js](../../../src/core/worldReset.js)) как `partial-preserve` — entitlements не должны теряться при retry-сценариях.
- `new game` (`reason: 'new_game'`): `state.shop` пересоздаётся через `createInitialState()` (пустые объекты/массивы); cloud-side `tmzd_shop_v1` остаётся нетронутым, и при следующем boot `pullShop()` вернёт entitlements обратно — это desired behaviour для платных бандлов (компенсация за случайный «New game»).