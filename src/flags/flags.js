/**
 * Feature flags with percent rollout and local overrides.
 * API:
 *   Game.Flags.init({ flags, userId })
 *   Game.Flags.define(name, config)
 *   Game.Flags.get(name)
 *   Game.Flags.setOverride(name, boolean|null)
 *   Game.Flags.clearOverrides()
 *   Game.Flags.list()
 */
(function (global) {
  'use strict';

  var STORAGE_OVERRIDE_KEY = 'feature_flag_overrides';
  var STORAGE_USER_KEY = 'feature_flag_user_id';

  var DEFAULT_FLAGS = {
    uiTutorialV2: { rollout: 0, description: 'New onboarding flow.' },
    perfHeavyFx: { rollout: 0, description: 'Enable heavier effects.' },
    economyTuningV2: { rollout: 0, description: 'Alternate economy tuning.' }
  };

  var flags = {};
  var overrides = {};
  var userId = null;

  function safeParse(raw, fb) {
    try { return raw ? JSON.parse(raw) : fb; }
    catch (_) { return fb; }
  }

  function clampPct(n) {
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  function hashString(str) {
    var h = 5381;
    for (var i = 0; i < str.length; i++) {
      h = ((h << 5) + h) + str.charCodeAt(i);
      h = h | 0;
    }
    return Math.abs(h);
  }

  function getBucket(name) {
    var base = String(name) + '|' + String(userId || '');
    return hashString(base) % 100;
  }

  function normalizeConfig(cfg) {
    cfg = cfg || {};
    return {
      rollout: cfg.rollout != null ? clampPct(cfg.rollout) : null,
      enabled: typeof cfg.enabled === 'boolean' ? cfg.enabled : null,
      description: cfg.description || ''
    };
  }

  function define(name, cfg) {
    if (!name) return;
    flags[name] = normalizeConfig(cfg);
  }

  function defineMany(obj) {
    if (!obj) return;
    for (var k in obj) {
      if (obj.hasOwnProperty(k)) define(k, obj[k]);
    }
  }

  function loadOverrides() {
    try {
      var raw = global.localStorage && global.localStorage.getItem(STORAGE_OVERRIDE_KEY);
      var data = safeParse(raw, null);
      if (data && typeof data === 'object') overrides = data;
    } catch (_) {}
  }

  function saveOverrides() {
    try {
      if (global.localStorage) {
        global.localStorage.setItem(STORAGE_OVERRIDE_KEY, JSON.stringify(overrides));
      }
    } catch (_) {}
  }

  function getOrCreateUserId() {
    var id = null;
    try {
      if (global.localStorage) {
        id = global.localStorage.getItem(STORAGE_USER_KEY);
      }
    } catch (_) {}
    if (!id) {
      id = 'u_' + Math.random().toString(36).slice(2) + '_' + Date.now();
      try {
        if (global.localStorage) {
          global.localStorage.setItem(STORAGE_USER_KEY, id);
        }
      } catch (_) {}
    }
    return id;
  }

  function computeValue(name, cfg) {
    cfg = cfg || {};
    if (cfg.enabled === true && cfg.rollout == null) return true;
    if (cfg.enabled === false && cfg.rollout == null) return false;
    var rollout = cfg.rollout != null ? clampPct(cfg.rollout) : (cfg.enabled ? 100 : 0);
    if (rollout <= 0) return false;
    if (rollout >= 100) return true;
    return getBucket(name) < rollout;
  }

  function get(name) {
    if (!name) return false;
    if (overrides && overrides.hasOwnProperty(name)) return !!overrides[name];
    var cfg = flags[name];
    if (!cfg) return false;
    return computeValue(name, cfg);
  }

  function setOverride(name, value) {
    if (!name) return;
    if (value === null || value === undefined) {
      if (overrides && overrides.hasOwnProperty(name)) {
        delete overrides[name];
        saveOverrides();
      }
      return;
    }
    overrides[name] = !!value;
    saveOverrides();
  }

  function clearOverrides() {
    overrides = {};
    saveOverrides();
  }

  function list() {
    var out = [];
    var names = Object.keys(flags).sort();
    for (var i = 0; i < names.length; i++) {
      var name = names[i];
      var cfg = flags[name];
      var override = overrides.hasOwnProperty(name) ? overrides[name] : null;
      var bucket = getBucket(name);
      var value = override != null ? override : computeValue(name, cfg);
      out.push({
        name: name,
        rollout: cfg.rollout,
        enabled: cfg.enabled,
        description: cfg.description,
        override: override,
        bucket: bucket,
        value: value
      });
    }
    return out;
  }

  function init(opts) {
    opts = opts || {};
    defineMany(DEFAULT_FLAGS);
    if (opts.flags) defineMany(opts.flags);
    userId = opts.userId || getOrCreateUserId();
    loadOverrides();
    if (opts.overrides) {
      overrides = opts.overrides;
      saveOverrides();
    }
    return list();
  }

  global.Game = global.Game || {};
  global.Game.Flags = {
    init: init,
    define: define,
    get: get,
    setOverride: setOverride,
    clearOverrides: clearOverrides,
    list: list,
    getUserId: function () { return userId; },
    STORAGE_OVERRIDE_KEY: STORAGE_OVERRIDE_KEY,
    STORAGE_USER_KEY: STORAGE_USER_KEY,
    _hash: hashString,
    _bucket: getBucket,
  };
})(typeof window !== 'undefined' ? window : this);
