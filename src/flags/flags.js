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
    economyTuningV2: { rollout: 0, description: 'Alternate economy tuning.' },
    mobileMode: { rollout: 0, description: 'Force mobile performance mode.' },
    mobileFxLite: { rollout: 0, description: 'Force lighter FX in mobile mode.' },
    mobileFxUltraLite: { rollout: 0, description: 'Force ultra-light FX in mobile mode.' },
    usePhaser: { rollout: 0, description: 'Enable Phaser 3 runtime instead of legacy Canvas.' },
    tmzdAnalyticsEnabled: { rollout: 0, description: 'Enable remote TMZD analytics adapters.' },
    tmzdAnalyticsLimitedEvents: { enabled: true, description: 'Keep TMZD analytics on the limited event taxonomy by default.' },
    tmzdAnalyticsMatomoEnabled: { rollout: 0, description: 'Enable Matomo as the primary TMZD analytics sink.' },
    tmzdAnalyticsPostHogEnabled: { rollout: 0, description: 'Enable PostHog as the secondary TMZD analytics sink.' },
    tmzdAnalyticsCanary: { rollout: 0, description: 'Allow TMZD analytics canary rollout through experiments.' },
    tmzdAnalyticsReadBack: { rollout: 0, description: 'Require TMZD analytics read-back verification signals.' }
  };

  var TMZD_ANALYTICS_FLAG_NAMES = [
    'tmzdAnalyticsEnabled',
    'tmzdAnalyticsLimitedEvents',
    'tmzdAnalyticsMatomoEnabled',
    'tmzdAnalyticsPostHogEnabled',
    'tmzdAnalyticsCanary',
    'tmzdAnalyticsReadBack'
  ];

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
    if (overrides && Object.prototype.hasOwnProperty.call(overrides, name)) return !!overrides[name];
    var cfg = flags[name];
    if (!cfg) return false;
    return computeValue(name, cfg);
  }

  function getDetail(name) {
    if (!name) return null;
    var cfg = flags[name];
    if (!cfg) return null;
    var override = Object.prototype.hasOwnProperty.call(overrides, name) ? overrides[name] : null;
    return {
      name: name,
      rollout: cfg.rollout,
      enabled: cfg.enabled,
      description: cfg.description,
      override: override,
      bucket: getBucket(name),
      value: override != null ? override : computeValue(name, cfg)
    };
  }

  function setOverride(name, value) {
    if (!name) return;
    if (value === null || value === undefined) {
      if (overrides && Object.prototype.hasOwnProperty.call(overrides, name)) {
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
      out.push(getDetail(name));
    }
    return out;
  }

  function getAnalyticsSnapshot() {
    var details = {};
    for (var i = 0; i < TMZD_ANALYTICS_FLAG_NAMES.length; i++) {
      var flagName = TMZD_ANALYTICS_FLAG_NAMES[i];
      details[flagName] = getDetail(flagName);
    }
    return {
      enabled: get('tmzdAnalyticsEnabled'),
      limitedEvents: get('tmzdAnalyticsLimitedEvents'),
      matomoPrimary: get('tmzdAnalyticsMatomoEnabled'),
      posthogSecondary: get('tmzdAnalyticsPostHogEnabled'),
      canary: get('tmzdAnalyticsCanary'),
      readBackVerification: get('tmzdAnalyticsReadBack'),
      flags: details
    };
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
    getDetail: getDetail,
    getAnalyticsSnapshot: getAnalyticsSnapshot,
    setOverride: setOverride,
    clearOverrides: clearOverrides,
    list: list,
    getUserId: function () { return userId; },
    STORAGE_OVERRIDE_KEY: STORAGE_OVERRIDE_KEY,
    STORAGE_USER_KEY: STORAGE_USER_KEY,
    TMZD_ANALYTICS_FLAG_NAMES: TMZD_ANALYTICS_FLAG_NAMES.slice(),
    _hash: hashString,
    _bucket: getBucket,
  };
})(typeof window !== 'undefined' ? window : this);
