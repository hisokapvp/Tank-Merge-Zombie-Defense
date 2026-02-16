/**
 * Обёртка над локальным хранилищем: load/save состояния и метаданных (lastSeenAt, версия).
 */
(function (global) {
  'use strict';

  var SAVE_KEY = 'progress';
  var SAVE_VERSION = 2;

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
    return {
      version: SAVE_VERSION,
      coins: state.coins,
      kills: state.kills,
      cells: cells,
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
