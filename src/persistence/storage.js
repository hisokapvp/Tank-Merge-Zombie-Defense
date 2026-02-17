/**
 * Обёртка над локальным хранилищем: load/save состояния и метаданных (lastSeenAt, версия).
 */
(function (global) {
  'use strict';

  var SAVE_KEY = 'progress';
  var SAVE_VERSION = 2;

  function normalizeTotalDamageDealtRaw(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.floor(value));
  }

  function normalizeDamagePointsSpent(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.floor(value));
  }

  function normalizeSafeCounter(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(value)));
  }

  function safeParse(raw, fallback) {
    try {
      if (raw == null || raw === '') return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  /**
   * Сериализуем только то, что нужно для восстановления и офлайн-расчёта.
   * @param {object} state
   * @returns {object}
   */
  function serializeState(state) {
    if (!state) return {};
    var fenceHpById = {};
    if (Array.isArray(state.fenceSegments)) {
      for (var si = 0; si < state.fenceSegments.length; si++) {
        var seg = state.fenceSegments[si];
        if (!seg || !seg.id || !Number.isFinite(seg.hp)) continue;
        fenceHpById[seg.id] = Math.max(0, seg.hp);
      }
    }
    var fenceState = {
      segmentsPerSide: Number.isFinite(state.fenceSegmentsMeta && state.fenceSegmentsMeta.segmentsPerSide)
        ? state.fenceSegmentsMeta.segmentsPerSide
        : null,
      hpById: fenceHpById,
    };
    var cells = [];
    if (Array.isArray(state.cells)) {
      for (var i = 0; i < state.cells.length; i++) {
        var c = state.cells[i];
        var tank = null;
        if (c.tank) {
          tank = {
            id: c.tank.id,
            level: c.tank.level,
            onTrack: !!c.tank.onTrack,
            powerTier: c.tank.powerTier,
          };
        }
        cells.push({ i: c.i, orbitPhase: c.orbitPhase, tank: tank });
      }
    }
    var crate = null;
    if (state.crate) {
      crate = { cellIndex: state.crate.cellIndex, rewardLevel: state.crate.rewardLevel };
    }
    var mapSeeds = null;
    if (state.mapSeeds && typeof state.mapSeeds === 'object') {
      mapSeeds = {
        stampsSeed: state.mapSeeds.stampsSeed,
        decorSeed: state.mapSeeds.decorSeed,
      };
    }
    var stats = {
      tanksMergedCount: normalizeSafeCounter(state.stats && state.stats.tanksMergedCount),
      tanksBoughtCount: normalizeSafeCounter(state.stats && state.stats.tanksBoughtCount),
    };
    var drones = [];
    if (Array.isArray(state.drones)) {
      for (var di = 0; di < state.drones.length; di++) {
        var d = state.drones[di];
        if (!d || typeof d !== 'object') continue;
        var repair = null;
        if (d.repair && typeof d.repair === 'object') {
          repair = {
            startHp: Number.isFinite(d.repair.startHp) ? Math.max(0, Math.floor(d.repair.startHp)) : 0,
            maxHp: Number.isFinite(d.repair.maxHp) ? Math.max(1, Math.floor(d.repair.maxHp)) : 1,
            totalCostCoins: Number.isFinite(d.repair.totalCostCoins) ? Math.max(0, Math.floor(d.repair.totalCostCoins)) : 0,
            repairDurationSec: Number.isFinite(d.repair.repairDurationSec) ? Math.max(0.01, d.repair.repairDurationSec) : 0.01,
            repairStartTimeSec: Number.isFinite(d.repair.repairStartTimeSec) ? d.repair.repairStartTimeSec : 0,
            coinsSpentPrev: Number.isFinite(d.repair.coinsSpentPrev) ? Math.max(0, Math.floor(d.repair.coinsSpentPrev)) : 0,
          };
        }
        drones.push({
          id: d.id,
          level: Number.isFinite(d.level) ? Math.max(1, Math.floor(d.level)) : 1,
          mode: d.mode,
          substate: d.substate,
          pos: {
            x: Number.isFinite(d.pos && d.pos.x) ? d.pos.x : 0,
            y: Number.isFinite(d.pos && d.pos.y) ? d.pos.y : 0,
          },
          basePos: {
            x: Number.isFinite(d.basePos && d.basePos.x) ? d.basePos.x : 0,
            y: Number.isFinite(d.basePos && d.basePos.y) ? d.basePos.y : 0,
          },
          targetSegmentId: d.targetSegmentId != null ? d.targetSegmentId : null,
          reservedSegmentId: d.reservedSegmentId != null ? d.reservedSegmentId : null,
          repair: repair,
          patrolSeed: Number.isFinite(d.patrolSeed) ? d.patrolSeed : 0,
        });
      }
    }
    return {
      version: SAVE_VERSION,
      coins: state.coins,
      kills: state.kills,
      totalDamageDealtRaw: normalizeTotalDamageDealtRaw(state.totalDamageDealtRaw),
      damagePointsSpent: normalizeDamagePointsSpent(state.damagePointsSpent),
      fenceLevel: Number.isFinite(state.fenceLevel) ? Math.max(1, Math.floor(state.fenceLevel)) : 1,
      cells: cells,
      supercomputer: state.supercomputer,
      player: state.player,
      buyCounts: state.buyCounts,
      buyPrices: state.buyPrices,
      crate: crate,
      nextCrateAt: state.nextCrateAt,
      maxTankLevelAchieved: state.maxTankLevelAchieved,
      boostUntil: state.boostUntil,
      activeEffects: state.activeEffects,
      fenceState: fenceState,
      achievements: state.achievements,
      stats: stats,
      mapSeeds: mapSeeds,
      drones: drones,
    };
  }

  /**
   * Загрузить игру. Безопасный парс; при ошибке — null.
   * Новый формат: объект с .cells, .coins, .player и т.д. Старый: только .level, .xp (progress).
   * @returns {{ state: object | null, meta: { lastSeenAt?: number, version?: number }, legacyProgress?: object } | null}
   */
  function loadGame() {
    try {
      var raw = global.localStorage && global.localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      var data = safeParse(raw, null);
      if (!data || typeof data !== 'object') return null;
      if (Array.isArray(data.cells)) {
        data.totalDamageDealtRaw = normalizeTotalDamageDealtRaw(data.totalDamageDealtRaw);
        return { state: data, meta: { lastSeenAt: data.lastSeenAt, version: data.version } };
      }
      return { state: null, meta: {}, legacyProgress: data };
    } catch (e) {
      return null;
    }
  }

  /**
   * Сохранить игру. meta.lastSeenAt обновляется снаружи при visibilitychange.
   * @param {object} state
   * @param {{ lastSeenAt?: number }} meta
   */
  function saveGame(state, meta) {
    try {
      var payload = serializeState(state);
      payload.lastSeenAt = meta && meta.lastSeenAt != null ? meta.lastSeenAt : payload.lastSeenAt;
      payload.version = SAVE_VERSION;
      if (global.localStorage) global.localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    } catch (e) {}
    // Persist telemetry lifetime together with game save
    if (global.Game && global.Game.Telemetry && global.Game.Telemetry.saveLifetime) {
      try { global.Game.Telemetry.saveLifetime(); } catch (_) {}
    }
  }

  global.Game = global.Game || {};
  global.Game.Storage = {
    SAVE_KEY: SAVE_KEY,
    SAVE_VERSION: SAVE_VERSION,
    loadGame: loadGame,
    saveGame: saveGame,
    safeParse: safeParse,
  };
})(typeof window !== 'undefined' ? window : this);
