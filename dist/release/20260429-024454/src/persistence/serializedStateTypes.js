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
   * @property {number} maxTankLevelAchieved — максимальный достигнутый уровень танка.
   * @property {number} boostUntil — timestamp окончания буста.
   * @property {Array} activeEffects — список активных временных эффектов.
   * @property {SerializedFenceState} fenceState — snapshot HP каждого fence-сегмента.
   * @property {Object} achievements — объект достижений (rewarded, totals, completedModifierTechs).
   * @property {SerializedStats} stats — canonical counters (см. SerializedStats).
   * @property {SerializedMapSeeds|null} mapSeeds — сиды для детерминированных декораций.
   * @property {SerializedDrone[]} drones — прогрессия и slot-assignments дронов.
   * @property {boolean} forceFenceRuntimeResetOnLoad — однократный reset-флаг для fence runtime на load.
   * @property {Array} playerChips — инвентарь чипов игрока; canonical writer `Game.State.setPlayerChips(...)`
   *   (через `src/ui/hangarChipsUI.js`). Hangar UI — derived view, не owner.
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
