/**
 * Funnel tracking (local, debug-friendly).
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'funnel_progress_v1';
  var RETURNING_THRESHOLD_MS = 6 * 60 * 60 * 1000;

  var STEPS = [
    { id: 'first_launch', labelKey: 'funnelFirstLaunch' },
    { id: 'first_merge', labelKey: 'funnelFirstMerge' },
    { id: 'first_battle', labelKey: 'funnelFirstBattle' },
    { id: 'first_upgrade', labelKey: 'funnelFirstUpgrade' },
    { id: 'return_visit', labelKey: 'funnelReturnVisit' },
  ];

  var data = null;

  function nowIso() {
    return new Date().toISOString();
  }

  function safeParse(raw, fb) {
    try { return raw ? JSON.parse(raw) : fb; }
    catch (_) { return fb; }
  }

  function load() {
    try {
      var raw = global.localStorage && global.localStorage.getItem(STORAGE_KEY);
      var parsed = safeParse(raw, null);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch (_) {}
    return { firstLaunchAt: null, steps: {} };
  }

  function save() {
    try {
      if (global.localStorage) global.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (_) {}
  }

  function init() {
    data = load();
    if (!data.firstLaunchAt) data.firstLaunchAt = nowIso();
    if (!data.steps) data.steps = {};
    save();
  }

  function trackStep(id, meta) {
    if (!id) return;
    if (!data) init();
    if (data.steps[id]) return;
    var ts = nowIso();
    var entry = { ts: ts, meta: meta || {} };
    data.steps[id] = entry;
    save();

    var stepIndex = STEPS.findIndex(function (s) { return s.id === id; });
    var elapsedMs = null;
    if (data.firstLaunchAt) {
      var startMs = Date.parse(data.firstLaunchAt);
      var nowMs = Date.parse(ts);
      if (Number.isFinite(startMs) && Number.isFinite(nowMs)) elapsedMs = Math.max(0, nowMs - startMs);
    }

    if (global.Game && global.Game.Telemetry) {
      global.Game.Telemetry.event('funnel_' + id);
    }
    if (global.Game && global.Game.TelemetryLogger) {
      global.Game.TelemetryLogger.log('funnelStep', {
        step: id,
        order: stepIndex >= 0 ? stepIndex + 1 : null,
        elapsedMs: elapsedMs,
        meta: meta || null,
      });
    }
    if (global.Game && global.Game.AnalyticsCollector) {
      global.Game.AnalyticsCollector.track('funnelStep', { step: id });
      if (elapsedMs != null) {
        global.Game.AnalyticsCollector.recordValue('progression_time_' + id, Math.round(elapsedMs / 1000));
      }
    }

    if (id === 'first_upgrade') {
      if (global.Game && global.Game.TelemetryLogger) {
        global.Game.TelemetryLogger.log('conversion', { step: id });
      }
      if (global.Game && global.Game.AnalyticsCollector) {
        global.Game.AnalyticsCollector.track('conversion', { step: id });
      }
    }
  }

  function maybeTrackReturn(lastSeenAt) {
    if (!lastSeenAt || !Number.isFinite(lastSeenAt)) return;
    var elapsedMs = Math.max(0, Date.now() - lastSeenAt);
    if (elapsedMs < RETURNING_THRESHOLD_MS) return;
    trackStep('return_visit', { elapsedMs: elapsedMs });
    if (global.Game && global.Game.TelemetryLogger) {
      global.Game.TelemetryLogger.log('retentionReturn', { elapsedMs: elapsedMs });
    }
    if (global.Game && global.Game.AnalyticsCollector) {
      global.Game.AnalyticsCollector.recordValue('retention_hours', Math.round(elapsedMs / (1000 * 60 * 60)));
    }
  }

  function getStatus() {
    if (!data) init();
    var startMs = data.firstLaunchAt ? Date.parse(data.firstLaunchAt) : null;
    return STEPS.map(function (step, idx) {
      var entry = data.steps[step.id];
      var elapsedMs = null;
      if (entry && startMs != null) {
        var tsMs = Date.parse(entry.ts);
        if (Number.isFinite(tsMs)) elapsedMs = Math.max(0, tsMs - startMs);
      }
      return {
        id: step.id,
        labelKey: step.labelKey,
        order: idx + 1,
        completedAt: entry ? entry.ts : null,
        elapsedMs: elapsedMs,
      };
    });
  }

  function getDropOff() {
    var status = getStatus();
    for (var i = 0; i < status.length; i++) {
      if (!status[i].completedAt) return status[i];
    }
    return null;
  }

  function reset() {
    data = { firstLaunchAt: nowIso(), steps: {} };
    save();
  }

  global.Game = global.Game || {};
  global.Game.Funnel = {
    init: init,
    trackStep: trackStep,
    maybeTrackReturn: maybeTrackReturn,
    getStatus: getStatus,
    getDropOff: getDropOff,
    reset: reset,
    _STORAGE_KEY: STORAGE_KEY,
  };

})(typeof window !== 'undefined' ? window : this);
