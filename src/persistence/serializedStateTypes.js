/**
 * Canonical JSDoc typedefs for `serializeState()` payload shape.
 *
 * Используется в `src/persistence/storage.js` как `@type {import('./serializedStateTypes').SerializedState}`.
 * Вторая авторитетная поверхность — Payload Contract Map в `docs/ai/SYSTEMS/save.md`;
 * при добавлении нового поля в `serializeState()` обязательно синхронизировать обе.
 *
 * Правила:
 * - schema = persisted subset, не полный runtime state. Runtime-only поля (zombie queues, projectile pools,
 *   drones runtime state без repair-meta) НЕ включаются сюда (P4.6).
 * - неизвестные ключи при deserialize дропаются (preserve-unknown NOT supported) (P4.7).
 * - Legacy сейвы могут содержать undefined поля; restore path подставляет defaults (P4.8).
 * - В payload не пишется PII / user-identifiable data; save кладётся в localStorage только локально (P4.9).
 *
 * Поле `version` (numeric) — canonical schema version. Текущее значение `2`
 * (`SAVE_VERSION` в storage.js). Миграция идёт через явные upgrade-пути в `loadGame()` / `restoreFullState()`.
 *
 * @module src/persistence/serializedStateTypes
 */

(function (global) {
  'use strict';

  /**
   * @typedef {Object} SerializedFenceState
   * @property {number|null} segmentsPerSide — сколько сегментов на каждой из 3 боевых сторон; null для legacy.
   * @property {Object.<string, number>} hpById — карта `segmentId -> текущее HP (>=0)`.
   */

  /**
   * @typedef {Object} SerializedTank
   * @property {string} id — sprite id (tank_lvl1, tank_lvl2, ...).
   * @property {number} level — 1..MAX_TANK_LEVEL.
   * @property {boolean} onTrack — находится ли танк на дорожке (мобильный режим).
   * @property {*} powerTier — snapshot power tier для повторного применения talent-эффектов.
   */

  /**
   * @typedef {Object} SerializedCell
   * @property {number} i — индекс ячейки (0..TOTAL_CELLS-1).
   * @property {number} orbitPhase — фаза орбитальной анимации в момент save.
   * @property {SerializedTank|null} tank — танк в ячейке или null.
   */

  /**
   * @typedef {Object} SerializedCrate
   * @property {number} cellIndex — ячейка, где стоит ящик.
   * @property {number} rewardLevel — уровень награды при открытии.
   */

  /**
   * @typedef {Object} SerializedMapSeeds
   * @property {number} stampsSeed — детерминированный seed для stamps layer.
   * @property {number} decorSeed — детерминированный seed для decor layer.
   */

  /**
   * @typedef {Object} SerializedStats
   * @property {number} tanksMergedCount — суммарное число merge-ов (canonical, не `achievements.totalMerges`).
   * @property {number} tanksBoughtCount — суммарное число покупок танков.
   * @property {number} manualFenceRepairsCount — ручные починки забора.
   * @property {number} modifierTechUnlocksCount — разблокированные модификаторы.
   * @property {number} droneAcquisitionsCount — приобретённые дроны.
   * @property {number} noRepairAttackWaveStreakCount — стрик волн без ручного ремонта.
   * @property {number} currentWaveCount — per-run счётчик завершённых волн атаки для HUD «Текущая волна: X».
   *   Инкремент только через `game.js` `incrementCurrentWaveCounter()` на finalize волны.
   *   Не входит в progress snapshot, поэтому partial reset («Перезагрузка симуляции») и New Game начинают с 0.
   */

  /**
   * @typedef {Object} SerializedDroneRepair
   * @property {number} startHp
   * @property {number} maxHp
   * @property {number} totalCostCoins
   * @property {number} repairDurationSec
   * @property {number} repairStartTimeSec
   * @property {number} coinsSpentPrev
   */

  /**
   * @typedef {Object} SerializedDrone
   * @property {string} id
   * @property {number} level
   * @property {string} mode — `patrol | repair | dismantle | idle`.
   * @property {string} substate
   * @property {number|null} slotIndex
   * @property {{x:number,y:number}} pos
   * @property {{x:number,y:number}} basePos
   * @property {*} targetSegmentId
   * @property {*} reservedSegmentId
   * @property {SerializedDroneRepair|null} repair
   * @property {number} patrolSeed
   */

  /**
   * @typedef {Object} SerializedState
   *
   * Canonical payload shape для `serializeState()` в `src/persistence/storage.js`.
   * Версия схемы обязана mirror'иться в Payload Contract Map (`docs/ai/SYSTEMS/save.md`).
   *
   * @property {number} version — schema_version. Текущее значение `2` (SAVE_VERSION). При bump'е обязана миграция.
   * @property {number} coins — текущие монеты игрока; writer — `game.js`.
   * @property {number} kills — суммарное число убийств; writer — combat flow в `game.js`.
   * @property {Object|null} tutorial — snapshot state туториала (шаги, флаги), canonical — tutorialRuntime.
   * @property {number} totalDamageDealtRaw — суммарный raw damage (для offline).
   * @property {number} zombieWaveAtkMult — текущий множитель атаки волн, `>=0`.
   * @property {number} damagePointsSpent — потрачено damage points на таланты.
   * @property {number} fenceLevel — текущий уровень забора (>=1).
   * @property {number} fenceRepairCount — суммарное число repair-ов за сессию (cleared on reset).
   * @property {SerializedCell[]} cells — массив ячеек ангара (фиксированная длина = TOTAL_CELLS).
   * @property {Object} supercomputer — supercomputer progression (computerLevel, xp, ...).
   * @property {Object} player — progression-слой игрока (cannonUpgradesApplied, damagePoints и т.п.).
   * @property {Object} buyCounts — per-level purchase counter.
   * @property {Object} buyPrices — per-level текущая цена (subject to reset на partial reset).
   * @property {SerializedCrate|null} crate — текущий ящик на поле или null.
   * @property {number} nextCrateAt — timestamp следующего спавна ящика.
   * @property {number|null} attackWaveRemainingSec — сколько sim-секунд осталось
   *   до следующей волны атаки на момент save. Относительная величина (абсолютный
   *   `worldEventsState.attackStartAt` не персистится). Reader — `restoreFullState()`
   *   через `applyLoadedAttackWaveSnapshot()`; `null` у legacy-сейвов и при
   *   выключенном/принудительном attack mode.
   * @property {boolean} attackWaveActive — `true`, если игрок сохранился ВНУТРИ
   *   волны атаки. Без этого флага загрузка выключала волну и заново отсчитывала
   *   полный `attackEverySec`.
   * @property {number} attackWaveRemainingActiveSec — сколько sim-секунд осталось
   *   текущей активной волне (`attackEndAt − now`). Значимо только при
   *   `attackWaveActive === true`; clamped `[0, attackDurationSec]`.
   * @property {number} maxTankLevelAchieved — максимальный достигнутый уровень танка.
   * @property {number} boostUntil — timestamp окончания буста.
   * @property {Array} activeEffects — список активных временных эффектов.
   * @property {Object|null} timedEffectsRemainingSec — переносимые ОСТАТКИ (сек)
   *   timed-эффектов: `{ boostSec, attackSec (Шквал), defenseSec (Купол),
   *   economySec (Золотое время) }`. `boostUntil` / `activeEffects.*Until` —
   *   absolute в домене `nowSec()`, который перезапускается с ~0 на каждой
   *   загрузке страницы, поэтому персистятся только относительные остатки;
   *   legacy-поля reader трактует как остатки и клампит до полной длительности
   *   (`restoreTimedEffectsFromSave()` в game.js). `null` = live seam недоступен.
   * @property {SerializedFenceState} fenceState — snapshot HP каждого fence-сегмента.
   * @property {Object} achievements — объект достижений (rewarded, totals, completedModifierTechs).
   * @property {SerializedStats} stats — canonical counters (см. SerializedStats).
   * @property {SerializedMapSeeds|null} mapSeeds — сиды для детерминированных декораций.
   * @property {SerializedDrone[]} drones — прогрессия и slot-assignments дронов.
   * @property {boolean} forceFenceRuntimeResetOnLoad — однократный reset-флаг для fence runtime на load.
   * @property {Array} playerChips — инвентарь чипов игрока; canonical writer `Game.State.setPlayerChips(...)`
   *   (через `src/ui/hangarChipsUI.js`). Hangar UI — derived view, не owner.
   * @property {Array} playerChips — инвентарь целых чипов игрока. Внимание: документально canonical
   *   writer — `Game.State.setPlayerChips(...)`, НО этот namespace отсутствует в кодовой базе, поэтому
   *   `_canonicalPlayerChipsApi()` в `src/ui/hangarChipsUI.js` всегда возвращает `null` и вся мутация идёт
   *   в module-owned `_playerChipsFallback`; `state.playerChips` остаётся `[]`. Writer — `storage.js`
   *   `serializePlayerChips()` (live-first, fallback `state.playerChips`); reader — `restoreFullState` /
   *   `applySavedProgress` через `Game.HangarChipsUI.setPlayerChips(payload.slice(), {reason:'restore'})`
   *   (безусловно, с fallback `[]`; `.slice()` передаёт ownership массива).
   * @property {Array} playerFragments — chip-shard inventory (`{ fragmentId, count }`). Owner — module-owned
   *   состояние `src/ui/hangarChipsUI.js` (`getPlayerFragments()`), НЕ `state`. Writer — `storage.js`
   *   `serializePlayerFragments()` (live-first, fallback `state.playerFragments`); reader — `restoreFullState` /
   *   `applySavedProgress` через `Game.HangarChipsUI.setPlayerFragments()` (безусловно, с fallback `[]`).
   * @property {number} siliconDust — баланс «Кремниевой пыли». Owner — module-owned
   *   `src/ui/hangarChipsUI.js` (`getSiliconDust()`), НЕ `state`. Writer — `storage.js`
   *   `serializeSiliconDust()` (live-first, fallback `state.siliconDust`); reader — `restoreFullState` /
   *   `applySavedProgress` через `Game.HangarChipsUI.setSiliconDust()` (безусловно, с fallback `0`;
   *   нейтральная запись — НЕ инкрементит `dustEarnedLifetime`).
   * @property {{modId:number, elapsed:number, duration:number, acceleratedPct:number}|null} techStudying —
   *   незавершённое таймерное изучение технологии. Owner — module-owned `src/ui/hangarChipsUI.js`
   *   (`getTechStudying()`). Writer — `storage.js` `serializeTechStudying()` (live-first, fallback
   *   `state.techStudying`); reader — `restoreFullState` / `applySavedProgress` через
   *   `Game.HangarChipsUI.setTechStudying()` (безусловно, с fallback `null`), что перезапускает таймер.
   * @property {Object<string, number>} techFeedProgress — per-tech fed-chip counters (instant-unlock path).
   *   Owner — module-owned `src/ui/hangarChipsUI.js` (`getTechFeedProgress()`). Writer — `storage.js`
   *   `serializeTechFeedProgress()` (live-first, fallback `state.techFeedProgress`); reader —
   *   `restoreFullState` / `applySavedProgress` через `Game.HangarChipsUI.setTechFeedProgress()`
   *   (безусловно, с fallback `{}`).
   * @property {Array|null} hangarCells — persisted subset module-owned grid установленных чипов
   *   (`Game.HangarChipsUI.getCells()`); формат `[{ id, redSlots, yellowSlots }]`, каждый slot —
   *   `{ chipId, modIds, sourceComboKey, rotation, level }`. Derived-поля (`activeModifiers`, `uiState`)
   *   НЕ сохраняются и пересчитываются в `Game.HangarChipsUI.setCells()` на load.
   * @property {Object|null} productionLine — snapshot production line (serialize/deserialize в productionLine.js).
   * @property {number} [lastSeenAt] — opt; ставится `saveGame()` поверх payload для offline расчёта.
   */

  if (global && global.Game) {
    /**
     * Экспортируем пустой маркер для tooling/import — JSDoc @typedef хватает IDE.
     * Модуль зарегистрирован как `Game._serializedStateTypes = true` для диагностики.
     */
    global.Game._serializedStateTypes = true;
  }
}(typeof window !== 'undefined' ? window : this));
