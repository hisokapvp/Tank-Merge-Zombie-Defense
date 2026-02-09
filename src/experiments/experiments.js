/**
 * Experiments — A/B variants with sticky assignment + local overrides.
 */
(function (global) {
  'use strict';

  var STORAGE_ASSIGN_KEY = 'experiments_assignments_v1';
  var STORAGE_CONFIG_KEY = 'experiments_config_v1';
  var STORAGE_USER_KEY = 'experiments_user_id';

  var DEFAULT_EXPERIMENTS = {
    ux_onboarding: {
      enabled: false,
      rollout: 100,
      variants: ['control', 'short'],
      weights: [50, 50],
      description: 'Onboarding flow length.'
    },
    economy_curve: {
      enabled: false,
      rollout: 50,
      variants: ['control', 'soft'],
      weights: [50, 50],
      description: 'Economy tuning curve.'
    },
    combat_fx_style: {
      enabled: false,
      rollout: 100,
      variants: ['control', 'lite'],
      weights: [50, 50],
      description: 'Combat FX load.'
    }
  };

  var assignments = {};
  var config = {};
  var userId = null;
  var telemetryPatched = false;
  var originalTelemetryLog = null;
  var pendingAssignmentLogs = [];

  function safeParse(raw, fb) {
    try { return raw ? JSON.parse(raw) : fb; }
    catch (_) { return fb; }
  }

  function nowIso() {
    return new Date().toISOString();
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

  function getOrCreateUserId() {
    var id = null;
    try {
      if (global.localStorage) id = global.localStorage.getItem(STORAGE_USER_KEY);
    } catch (_) {}
    if (!id) {
      id = 'exp_' + Math.random().toString(36).slice(2) + '_' + Date.now();
      try {
        if (global.localStorage) global.localStorage.setItem(STORAGE_USER_KEY, id);
      } catch (_) {}
    }
    return id;
  }

  function normalizeExperiment(cfg) {
    cfg = cfg || {};
    var variants = Array.isArray(cfg.variants) && cfg.variants.length ? cfg.variants.slice() : ['control'];
    var weights = Array.isArray(cfg.weights) && cfg.weights.length === variants.length ? cfg.weights.slice() : null;
    if (!weights) {
      weights = variants.map(function () { return 1; });
    }
    var enabled = !!cfg.enabled;
    var rollout = cfg.rollout != null ? clampPct(cfg.rollout) : 100;
    var forced = cfg.forceVariant != null ? String(cfg.forceVariant) : null;
    return {
      enabled: enabled,
      rollout: rollout,
      variants: variants,
      weights: weights,
      forceVariant: forced,
      description: cfg.description || ''
    };
  }

  function mergeConfigs(base, override) {
    var out = {};
    Object.keys(base || {}).forEach(function (k) {
      out[k] = normalizeExperiment(base[k]);
    });
    Object.keys(override || {}).forEach(function (k) {
      out[k] = normalizeExperiment(override[k]);
    });
    return out;
  }

  function loadAssignments() {
    try {
      var raw = global.localStorage && global.localStorage.getItem(STORAGE_ASSIGN_KEY);
      var data = safeParse(raw, null);
      if (data && typeof data === 'object') return data;
    } catch (_) {}
    return {};
  }

  function saveAssignments() {
    try {
      if (global.localStorage) global.localStorage.setItem(STORAGE_ASSIGN_KEY, JSON.stringify(assignments));
    } catch (_) {}
  }

  function loadConfig() {
    try {
      var raw = global.localStorage && global.localStorage.getItem(STORAGE_CONFIG_KEY);
      var data = safeParse(raw, null);
      if (data && typeof data === 'object') return data;
    } catch (_) {}
    return {};
  }

  function saveConfig() {
    try {
      if (global.localStorage) global.localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(config));
    } catch (_) {}
  }

  function pickVariant(id, cfg) {
    var variants = cfg.variants;
    if (!variants.length) return 'control';
    if (cfg.forceVariant && variants.indexOf(cfg.forceVariant) >= 0) return cfg.forceVariant;
    var base = String(id) + '|' + String(userId || '');
    var bucket = hashString(base) % 100;
    if (!cfg.enabled || bucket >= cfg.rollout) return variants[0];
    var total = 0;
    for (var i = 0; i < cfg.weights.length; i++) total += cfg.weights[i];
    if (total <= 0) return variants[0];
    var pick = hashString(base + '|v') % total;
    var acc = 0;
    for (var j = 0; j < cfg.weights.length; j++) {
      acc += cfg.weights[j];
      if (pick < acc) return variants[j];
    }
    return variants[0];
  }

  function ensureAssignment(id, cfg) {
    var entry = assignments[id];
    if (entry && entry.variant && cfg.variants.indexOf(entry.variant) >= 0) return entry;
    var variant = pickVariant(id, cfg);
    var next = { variant: variant, ts: nowIso() };
    assignments[id] = next;
    saveAssignments();
    if (cfg.enabled && cfg.rollout > 0) {
      logAssignment(id, variant, cfg.forceVariant ? 'forced' : 'rollout');
    }
    return next;
  }

  function logAssignment(id, variant, source) {
    var payload = { experiment: id, variant: variant, source: source || 'rollout' };
    if (global.Game && global.Game.TelemetryLogger && typeof global.Game.TelemetryLogger.log === 'function') {
      global.Game.TelemetryLogger.log('experimentAssign', payload);
    } else {
      pendingAssignmentLogs.push(payload);
    }
    if (global.Game && global.Game.AnalyticsCollector && typeof global.Game.AnalyticsCollector.track === 'function') {
      global.Game.AnalyticsCollector.track('experimentAssign', payload);
    }
  }

  function getVariant(id) {
    var cfg = config[id];
    if (!cfg) return 'control';
    if (cfg.forceVariant && cfg.variants.indexOf(cfg.forceVariant) >= 0) return cfg.forceVariant;
    var entry = ensureAssignment(id, cfg);
    return entry ? entry.variant : cfg.variants[0];
  }

  function getAssignmentsMap() {
    var out = {};
    Object.keys(config).forEach(function (id) {
      out[id] = getVariant(id);
    });
    return out;
  }

  function list() {
    var ids = Object.keys(config).sort();
    return ids.map(function (id) {
      var cfg = config[id];
      var entry = assignments[id];
      return {
        id: id,
        description: cfg.description || '',
        enabled: cfg.enabled,
        rollout: cfg.rollout,
        variants: cfg.variants.slice(),
        weights: cfg.weights.slice(),
        forceVariant: cfg.forceVariant,
        assigned: entry ? entry.variant : null,
        value: getVariant(id)
      };
    });
  }

  function attachTelemetry() {
    if (telemetryPatched) return;
    if (!global.Game || !global.Game.TelemetryLogger || typeof global.Game.TelemetryLogger.log !== 'function') return;
    telemetryPatched = true;
    originalTelemetryLog = global.Game.TelemetryLogger.log;
    global.Game.TelemetryLogger.log = function (event, data) {
      var payload = data;
      if (payload == null) {
        payload = {};
      } else if (typeof payload !== 'object') {
        payload = { value: payload };
      } else {
        payload = Object.assign({}, payload);
      }
      if (!payload.exp) payload.exp = getAssignmentsMap();
      return originalTelemetryLog.call(global.Game.TelemetryLogger, event, payload);
    };
    if (pendingAssignmentLogs.length) {
      var logs = pendingAssignmentLogs.slice();
      pendingAssignmentLogs = [];
      logs.forEach(function (payload) {
        global.Game.TelemetryLogger.log('experimentAssign', payload);
      });
    }
  }

  function init(opts) {
    opts = opts || {};
    userId = opts.userId || (global.Game && global.Game.Flags && global.Game.Flags.getUserId ? global.Game.Flags.getUserId() : null) || getOrCreateUserId();
    var remote = loadConfig();
    config = mergeConfigs(DEFAULT_EXPERIMENTS, remote);
    if (opts.experiments) {
      config = mergeConfigs(config, opts.experiments);
    }
    assignments = loadAssignments();
    Object.keys(config).forEach(function (id) {
      ensureAssignment(id, config[id]);
    });
    attachTelemetry();
    return list();
  }

  function setExperiment(id, patch) {
    if (!id) return;
    var current = config[id] || normalizeExperiment({});
    var next = Object.assign({}, current, patch || {});
    config[id] = normalizeExperiment(next);
    saveConfig();
    ensureAssignment(id, config[id]);
  }

  function clearAssignments() {
    assignments = {};
    saveAssignments();
  }

  function resetConfig() {
    config = mergeConfigs(DEFAULT_EXPERIMENTS, {});
    saveConfig();
  }

  global.Game = global.Game || {};
  global.Game.Experiments = {
    init: init,
    list: list,
    getVariant: getVariant,
    getAssignments: getAssignmentsMap,
    setExperiment: setExperiment,
    clearAssignments: clearAssignments,
    resetConfig: resetConfig,
    attachTelemetry: attachTelemetry,
    _STORAGE_ASSIGN_KEY: STORAGE_ASSIGN_KEY,
    _STORAGE_CONFIG_KEY: STORAGE_CONFIG_KEY,
  };

})(typeof window !== 'undefined' ? window : this);
