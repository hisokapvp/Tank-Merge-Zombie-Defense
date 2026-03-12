/**
 * Обёртка над локальным хранилищем: load/save состояния и метаданных (lastSeenAt, версия).
 */
(function (global) {
  'use strict';

  var SAVE_KEY = 'progress';
  var SAVE_VERSION = 2;
  var SAVE_SLOTS_META_KEY = 'saveSlotsMeta_v1';
  var SAVE_SLOT_KEY_PREFIX = 'saveSlot_v1_';
  var SAVE_SLOTS_COUNT = 10;
  var SAVE_SLOT_NAME_MAX_LEN = 20;
  var AUTO_SLOT_INDEX = 9;
  var AUTO_SLOT_NAME = 'Auto';

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
    if (index === AUTO_SLOT_INDEX) return AUTO_SLOT_NAME;
    return 'Слот ' + (index + 1);
  }

  function getSlotName(slotMeta, index) {
    var name = slotMeta && typeof slotMeta === 'object' ? slotMeta.name : '';
    return sanitizeSlotName(index, name);
  }

  function sanitizeSlotName(index, name) {
    if (index === AUTO_SLOT_INDEX) return AUTO_SLOT_NAME;
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
    if (!global.localStorage) return false;
    global.localStorage.setItem(SAVE_SLOTS_META_KEY, JSON.stringify(meta));
    return true;
  }

  function reportStorageError(scope, error) {
    try {
      var details = error && error.message ? error.message : String(error || 'unknown');
      if (global.console && typeof global.console.warn === 'function') {
        global.console.warn('[Storage][' + scope + '] ' + details);
      }
    } catch (_) {}
  }

  function getSlotDataKey(index) {
    return SAVE_SLOT_KEY_PREFIX + String(index);
  }

  function safeGetItem(key) {
    try {
      if (!global.localStorage) return { ok: false, value: null, error: 'no_local_storage' };
      return { ok: true, value: global.localStorage.getItem(key), error: null };
    } catch (e) {
      reportStorageError('getItem:' + key, e);
      return { ok: false, value: null, error: e };
    }
  }

  function safeSetItem(key, value) {
    try {
      if (!global.localStorage) return { ok: false, error: 'no_local_storage' };
      global.localStorage.setItem(key, value);
      return { ok: true, error: null };
    } catch (e) {
      reportStorageError('setItem:' + key, e);
      return { ok: false, error: e };
    }
  }

  function safeRemoveItem(key) {
    try {
      if (!global.localStorage) return { ok: false, error: 'no_local_storage' };
      global.localStorage.removeItem(key);
      return { ok: true, error: null };
    } catch (e) {
      reportStorageError('removeItem:' + key, e);
      return { ok: false, error: e };
    }
  }

  function readMetaRaw() {
    var metaRead = safeGetItem(SAVE_SLOTS_META_KEY);
    if (!metaRead.ok) return { ok: false, meta: createDefaultSaveSlotsMeta(), hadRaw: false, error: metaRead.error };
    var hadRaw = metaRead.value != null && metaRead.value !== '';
    var parsed = safeParse(metaRead.value, null);
    return { ok: true, meta: normalizeSaveSlotsMeta(parsed), hadRaw: hadRaw, error: null };
  }

  function writeMetaSafe(meta) {
    var normalized = normalizeSaveSlotsMeta(meta);
    var res = safeSetItem(SAVE_SLOTS_META_KEY, JSON.stringify(normalized));
    return { ok: !!res.ok, meta: normalized, error: res.error || null };
  }

  function hasAnySlotPayloadRaw() {
    for (var i = 0; i < SAVE_SLOTS_COUNT; i++) {
      var slotRead = safeGetItem(getSlotDataKey(i));
      if (!slotRead.ok) continue;
      if (slotRead.value != null && slotRead.value !== '') return true;
    }
    return false;
  }

  function updateMetaField(index, updates) {
    var slotIndex = Number(index);
    if (!Number.isFinite(slotIndex)) return { ok: false, meta: loadSaveSlotsMeta(), error: 'invalid_index' };
    slotIndex = Math.floor(slotIndex);
    if (slotIndex < 0 || slotIndex >= SAVE_SLOTS_COUNT) return { ok: false, meta: loadSaveSlotsMeta(), error: 'out_of_range' };
    var meta = loadSaveSlotsMeta();
    var slot = meta.slots[slotIndex] || { name: getDefaultSlotName(slotIndex), lastSavedAt: null };
    if (updates && Object.prototype.hasOwnProperty.call(updates, 'name')) {
      slot.name = sanitizeSlotName(slotIndex, updates.name);
    }
    if (updates && Object.prototype.hasOwnProperty.call(updates, 'lastSavedAt')) {
      slot.lastSavedAt = sanitizeLastSavedAt(updates.lastSavedAt);
    }
    meta.slots[slotIndex] = slot;
    var writeMeta = writeMetaSafe(meta);
    if (!writeMeta.ok) {
      return { ok: false, meta: writeMeta.meta, error: writeMeta.error };
    }
    return { ok: true, meta: writeMeta.meta, error: null };
  }

  function migrateLegacyProgressIfNeeded() {
    var metaRead = readMetaRaw();
    var meta = metaRead.meta;
    var hasSlotData = hasAnySlotPayloadRaw();
    if (metaRead.hadRaw || hasSlotData) {
      writeMetaSafe(meta);
      return { ok: true, migrated: false, meta: meta, error: null };
    }

    var legacyRead = safeGetItem(SAVE_KEY);
    if (!legacyRead.ok || !legacyRead.value) {
      writeMetaSafe(meta);
      return { ok: true, migrated: false, meta: meta, error: null };
    }

    var legacyParsed = safeParse(legacyRead.value, null);
    if (!legacyParsed || typeof legacyParsed !== 'object') {
      writeMetaSafe(meta);
      return { ok: true, migrated: false, meta: meta, error: null };
    }

    var slotWrite = safeSetItem(getSlotDataKey(0), JSON.stringify(legacyParsed));
    if (!slotWrite.ok) {
      writeMetaSafe(meta);
      return { ok: false, migrated: false, meta: meta, error: slotWrite.error };
    }

    meta.slots[0].name = sanitizeSlotName(0, meta.slots[0].name);
    meta.slots[0].lastSavedAt = Date.now();
    var metaWrite = writeMetaSafe(meta);
    return { ok: !!metaWrite.ok, migrated: !!metaWrite.ok, meta: metaWrite.meta, error: metaWrite.error || null };
  }

  function loadSlotPayloadRaw(index) {
    var slotIndex = Number(index);
    if (!Number.isFinite(slotIndex)) return { ok: false, payload: null, error: 'invalid_index' };
    slotIndex = Math.floor(slotIndex);
    if (slotIndex < 0 || slotIndex >= SAVE_SLOTS_COUNT) return { ok: false, payload: null, error: 'out_of_range' };
    var read = safeGetItem(getSlotDataKey(slotIndex));
    if (!read.ok) return { ok: false, payload: null, error: read.error };
    if (!read.value) return { ok: true, payload: null, error: null };
    var parsed = safeParse(read.value, null);
    if (!parsed || typeof parsed !== 'object') {
      reportStorageError('loadSlot:parse:' + slotIndex, new Error('Invalid slot JSON'));
      return { ok: false, payload: null, error: 'parse_error' };
    }
    return { ok: true, payload: parsed, error: null };
  }

  var slotStorageBackend = {
    listSlots: function () {
      var migration = migrateLegacyProgressIfNeeded();
      var meta = migration.meta || createDefaultSaveSlotsMeta();
      var slots = [];
      for (var i = 0; i < SAVE_SLOTS_COUNT; i++) {
        var slotPayload = loadSlotPayloadRaw(i);
        var slotMeta = meta.slots[i] || { name: getDefaultSlotName(i), lastSavedAt: null };
        slots.push({
          index: i,
          name: getSlotName(slotMeta, i),
          lastSavedAt: sanitizeLastSavedAt(slotMeta.lastSavedAt),
          hasData: !!slotPayload.payload,
          isAuto: i === AUTO_SLOT_INDEX,
        });
      }
      if (!migration.ok) return { ok: false, meta: meta, slots: slots, error: migration.error };
      return { ok: true, meta: meta, slots: slots, error: null };
    },
    saveSlot: function (index, payload) {
      var slotIndex = Number(index);
      if (!Number.isFinite(slotIndex)) return { ok: false, error: 'invalid_index' };
      slotIndex = Math.floor(slotIndex);
      if (slotIndex < 0 || slotIndex >= SAVE_SLOTS_COUNT) return { ok: false, error: 'out_of_range' };

      migrateLegacyProgressIfNeeded();
      var serialized = serializeState(payload || {});
      serialized.version = 1;
      var write = safeSetItem(getSlotDataKey(slotIndex), JSON.stringify(serialized));
      if (!write.ok) return { ok: false, error: write.error };

      var metaRes = updateMetaField(slotIndex, {
        lastSavedAt: Date.now(),
      });
      if (!metaRes.ok) return { ok: false, error: metaRes.error };
      return { ok: true, error: null };
    },
    loadSlot: function (index) {
      migrateLegacyProgressIfNeeded();
      var loaded = loadSlotPayloadRaw(index);
      if (!loaded.ok) return { ok: false, payload: null, error: loaded.error };
      return { ok: true, payload: loaded.payload, error: null };
    },
    deleteSlot: function (index) {
      migrateLegacyProgressIfNeeded();
      if (index == null) {
        var hadError = null;
        for (var i = 0; i < SAVE_SLOTS_COUNT; i++) {
          var remove = safeRemoveItem(getSlotDataKey(i));
          if (!remove.ok && !hadError) hadError = remove.error;
        }
        var resetMeta = writeMetaSafe(createDefaultSaveSlotsMeta());
        if (!resetMeta.ok && !hadError) hadError = resetMeta.error;
        return { ok: !hadError, error: hadError };
      }
      var slotIndex = Number(index);
      if (!Number.isFinite(slotIndex)) return { ok: false, error: 'invalid_index' };
      slotIndex = Math.floor(slotIndex);
      if (slotIndex < 0 || slotIndex >= SAVE_SLOTS_COUNT) return { ok: false, error: 'out_of_range' };
      var removeOne = safeRemoveItem(getSlotDataKey(slotIndex));
      if (!removeOne.ok) return { ok: false, error: removeOne.error };
      var metaRes = updateMetaField(slotIndex, {
        name: getDefaultSlotName(slotIndex),
        lastSavedAt: null,
      });
      if (!metaRes.ok) return { ok: false, error: metaRes.error };
      return { ok: true, error: null };
    },
  };

  var activeSlotsBackend = slotStorageBackend;

  function setSlotsBackend(backend) {
    if (!backend || typeof backend !== 'object') return false;
    if (typeof backend.listSlots !== 'function') return false;
    if (typeof backend.saveSlot !== 'function') return false;
    if (typeof backend.loadSlot !== 'function') return false;
    activeSlotsBackend = backend;
    return true;
  }

  function getSlotsBackend() {
    return activeSlotsBackend;
  }

  function loadSaveSlotsMeta() {
    var list = activeSlotsBackend.listSlots();
    if (list && list.meta) return normalizeSaveSlotsMeta(list.meta);
    return createDefaultSaveSlotsMeta();
  }

  function setSlotName(index, name) {
    var res = updateMetaField(index, { name: name });
    return res && res.meta ? res.meta : loadSaveSlotsMeta();
  }

  function markSlotSaved(index, timestampMs) {
    var res = updateMetaField(index, { lastSavedAt: timestampMs });
    return res && res.meta ? res.meta : loadSaveSlotsMeta();
  }

  function hasAnySaves() {
    var list = activeSlotsBackend.listSlots();
    var slots = Array.isArray(list && list.slots) ? list.slots : [];
    for (var i = 0; i < slots.length; i++) {
      if (slots[i] && slots[i].hasData) return true;
    }
    return false;
  }

  function listSlots() {
    var result = activeSlotsBackend.listSlots();
    if (!result || typeof result !== 'object') {
      return { ok: false, meta: createDefaultSaveSlotsMeta(), slots: [], error: 'backend_invalid_response' };
    }
    return result;
  }

  function saveSlot(index, payload) {
    return activeSlotsBackend.saveSlot(index, payload);
  }

  function loadSlot(index) {
    return activeSlotsBackend.loadSlot(index);
  }

  function deleteSlot(index) {
    if (!activeSlotsBackend.deleteSlot) return { ok: false, error: 'not_supported' };
    return activeSlotsBackend.deleteSlot(index);
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
          slotIndex: Number.isFinite(d.slotIndex) ? Math.max(0, Math.floor(d.slotIndex)) : null,
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
      tutorial: state.tutorial || null,
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
      forceFenceRuntimeResetOnLoad: !!state.forceFenceRuntimeResetOnLoad,
      playerChips: Array.isArray(state.playerChips) ? state.playerChips : [],
      productionLine: state.productionLine || null,
    };
  }

  /**
   * Загрузить игру. Безопасный парс; при ошибке — null.
   * Новый формат: объект с .cells, .coins, .player и т.д. Старый: только .level, .xp (progress).
   * @returns {{ state: object | null, meta: { lastSeenAt?: number, version?: number }, legacyProgress?: object } | null}
   */
  function loadGame() {
    try {
      migrateLegacyProgressIfNeeded();
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
    } catch (e) {
      reportStorageError('saveGame', e);
    }
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
    SAVE_SLOT_KEY_PREFIX: SAVE_SLOT_KEY_PREFIX,
    SAVE_SLOTS_COUNT: SAVE_SLOTS_COUNT,
    SAVE_SLOT_NAME_MAX_LEN: SAVE_SLOT_NAME_MAX_LEN,
    AUTO_SLOT_INDEX: AUTO_SLOT_INDEX,
    loadGame: loadGame,
    saveGame: saveGame,
    listSlots: listSlots,
    saveSlot: saveSlot,
    loadSlot: loadSlot,
    deleteSlot: deleteSlot,
    loadSaveSlotsMeta: loadSaveSlotsMeta,
    setSlotName: setSlotName,
    markSlotSaved: markSlotSaved,
    hasAnySaves: hasAnySaves,
    getDefaultSlotName: getDefaultSlotName,
    safeParse: safeParse,
    setSlotsBackend: setSlotsBackend,
    getSlotsBackend: getSlotsBackend,
    reportStorageError: reportStorageError,
  };
})(typeof window !== 'undefined' ? window : this);
