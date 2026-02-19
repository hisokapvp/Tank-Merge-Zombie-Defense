/**
 * Обёртка над локальным хранилищем: load/save состояния и метаданных (lastSeenAt, версия).
 */
(function (global) {
  'use strict';

  var SAVE_KEY = 'progress';
  var SAVE_VERSION = 2;
  var SAVE_SLOTS_META_KEY = 'saveSlotsMeta_v1';
  var SAVE_SLOTS_COUNT = 10;
  var SAVE_SLOT_NAME_MAX_LEN = 20;

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

  function getDefaultSlotName(index) {
    return 'Слот ' + (index + 1);
  }

  function sanitizeSlotName(index, name) {
    var text = typeof name === 'string' ? name : '';
    text = text.trim();
    if (text.length > SAVE_SLOT_NAME_MAX_LEN) {
      text = text.slice(0, SAVE_SLOT_NAME_MAX_LEN);
    }
    if (!text.length) return getDefaultSlotName(index);
    return text;
  }

  function sanitizeLastSavedAt(value) {
    var num = Number(value);
    if (!Number.isFinite(num)) return null;
    var ts = Math.floor(num);
    if (ts <= 0) return null;
    return ts;
  }

  function createDefaultSaveSlotsMeta() {
    var slots = [];
    for (var i = 0; i < SAVE_SLOTS_COUNT; i++) {
      slots.push({ name: getDefaultSlotName(i), lastSavedAt: null });
    }
    return { slots: slots };
  }

  function normalizeSaveSlotsMeta(payload) {
    var normalized = createDefaultSaveSlotsMeta();
    if (!payload || typeof payload !== 'object' || !Array.isArray(payload.slots)) return normalized;
    for (var i = 0; i < SAVE_SLOTS_COUNT; i++) {
      var src = payload.slots[i];
      var name = src && typeof src === 'object' ? src.name : '';
      var lastSavedAt = src && typeof src === 'object' ? src.lastSavedAt : null;
      normalized.slots[i].name = sanitizeSlotName(i, name);
      normalized.slots[i].lastSavedAt = sanitizeLastSavedAt(lastSavedAt);
    }
    return normalized;
  }

  function saveSaveSlotsMeta(meta) {
    if (!global.localStorage) return;
    global.localStorage.setItem(SAVE_SLOTS_META_KEY, JSON.stringify(meta));
  }

  function loadSaveSlotsMeta() {
    var raw = null;
    try {
      raw = global.localStorage && global.localStorage.getItem(SAVE_SLOTS_META_KEY);
    } catch (e) {
      raw = null;
    }
    var parsed = safeParse(raw, null);
    var normalized = normalizeSaveSlotsMeta(parsed);
    try {
      saveSaveSlotsMeta(normalized);
    } catch (e2) {}
    return normalized;
  }

  function setSlotName(index, name) {
    var slotIndex = Number(index);
    if (!Number.isFinite(slotIndex)) return loadSaveSlotsMeta();
    slotIndex = Math.floor(slotIndex);
    if (slotIndex < 0 || slotIndex >= SAVE_SLOTS_COUNT) return loadSaveSlotsMeta();
    var meta = loadSaveSlotsMeta();
    meta.slots[slotIndex].name = sanitizeSlotName(slotIndex, name);
    try {
      saveSaveSlotsMeta(meta);
    } catch (e) {}
    return meta;
  }

  function markSlotSaved(index, timestampMs) {
    var slotIndex = Number(index);
    if (!Number.isFinite(slotIndex)) return loadSaveSlotsMeta();
    slotIndex = Math.floor(slotIndex);
    if (slotIndex < 0 || slotIndex >= SAVE_SLOTS_COUNT) return loadSaveSlotsMeta();
    var meta = loadSaveSlotsMeta();
    meta.slots[slotIndex].lastSavedAt = sanitizeLastSavedAt(timestampMs);
    try {
      saveSaveSlotsMeta(meta);
    } catch (e) {}
    return meta;
  }

  function hasAnySaves() {
    var meta = loadSaveSlotsMeta();
    var slots = Array.isArray(meta && meta.slots) ? meta.slots : [];
    for (var i = 0; i < slots.length; i++) {
      var slot = slots[i];
      if (!slot || typeof slot !== 'object') continue;
      if (sanitizeLastSavedAt(slot.lastSavedAt) != null) return true;
    }
    return false;
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
      zombieWaveAtkMult: Number.isFinite(state.zombieWaveAtkMult) ? Math.max(0, state.zombieWaveAtkMult) : 1,
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
    SAVE_SLOTS_META_KEY: SAVE_SLOTS_META_KEY,
    SAVE_SLOTS_COUNT: SAVE_SLOTS_COUNT,
    SAVE_SLOT_NAME_MAX_LEN: SAVE_SLOT_NAME_MAX_LEN,
    loadGame: loadGame,
    saveGame: saveGame,
    loadSaveSlotsMeta: loadSaveSlotsMeta,
    setSlotName: setSlotName,
    markSlotSaved: markSlotSaved,
    hasAnySaves: hasAnySaves,
    getDefaultSlotName: getDefaultSlotName,
    safeParse: safeParse,
  };
})(typeof window !== 'undefined' ? window : this);
