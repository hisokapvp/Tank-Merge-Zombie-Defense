/**
 * Funnel tracking (local, debug-friendly).
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'funnel_progress_v1';
  var RETURNING_THRESHOLD_MS = 6 * 60 * 60 * 1000;
  var ANALYTICS_REVIEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

  var STEPS = [
    { id: 'first_launch', labelKey: 'funnelFirstLaunch' },
    { id: 'first_merge', labelKey: 'funnelFirstMerge' },
    { id: 'first_battle', labelKey: 'funnelFirstBattle' },
    { id: 'first_upgrade', labelKey: 'funnelFirstUpgrade' },
    { id: 'return_visit', labelKey: 'funnelReturnVisit' },
  ];

  var ANALYTICS_STEPS = [
    { id: 'taxonomy_registered', labelKey: 'analyticsTaxonomyRegistered' },
    { id: 'consent_recorded', labelKey: 'analyticsConsentRecorded' },
    { id: 'matomo_primary_live', labelKey: 'analyticsMatomoPrimaryLive' },
    { id: 'posthog_secondary_live', labelKey: 'analyticsPosthogSecondaryLive' },
    { id: 'read_back_verified', labelKey: 'analyticsReadBackVerified' },
    { id: 'manual_smoke', labelKey: 'analyticsManualSmoke' },
    { id: 'weekly_review', labelKey: 'analyticsWeeklyReview' },
  ];

  var data = null;

  function nowIso() {
    return new Date().toISOString();
  }

  function safeParse(raw, fb) {
    try { return raw ? JSON.parse(raw) : fb; }
    catch (_) { return fb; }
  }

  function blankAnalyticsData() {
    return {
      startedAt: nowIso(),
      steps: {},
      lastManualSmokeAt: null,
      lastWeeklyReviewAt: null,
      lastReadBackAt: null,
    };
  }

  function load() {
    try {
      var raw = global.localStorage && global.localStorage.getItem(STORAGE_KEY);
      var parsed = safeParse(raw, null);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch (_) {}
    return { firstLaunchAt: null, steps: {}, analytics: blankAnalyticsData() };
  }

  function save() {
    try {
      if (global.localStorage) global.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (_) {}
  }

  function ensureInit() {
    if (!data) init();
    if (!data.steps || typeof data.steps !== 'object') data.steps = {};
    if (!data.analytics || typeof data.analytics !== 'object') data.analytics = blankAnalyticsData();
    if (!data.analytics.steps || typeof data.analytics.steps !== 'object') data.analytics.steps = {};
  }

  function init() {
    data = load();
    if (!data.firstLaunchAt) data.firstLaunchAt = nowIso();
    ensureInit();
    save();
  }

  function computeElapsedMs(originTs, eventTs) {
    var startMs = originTs ? Date.parse(originTs) : NaN;
    var nowMs = eventTs ? Date.parse(eventTs) : NaN;
    if (!Number.isFinite(startMs) || !Number.isFinite(nowMs)) return null;
    return Math.max(0, nowMs - startMs);
  }

  function upsertStep(target, id, meta, allowRepeat) {
    var existing = target[id];
    if (existing && !allowRepeat) return existing;
    var ts = nowIso();
    var next = existing || { ts: ts, count: 0, meta: {} };
    next.ts = ts;
    next.count = (next.count || 0) + 1;
    next.meta = meta || {};
    target[id] = next;
    return next;
  }

  function trackStep(id, meta) {
    if (!id) return;
    ensureInit();
    if (data.steps[id]) return;
    var entry = upsertStep(data.steps, id, meta || {}, false);
    save();

    var stepIndex = STEPS.findIndex(function (s) { return s.id === id; });
    var elapsedMs = computeElapsedMs(data.firstLaunchAt, entry.ts);

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

  function trackAnalyticsStep(id, meta, allowRepeat) {
    if (!id) return;
    ensureInit();
    var existed = !!data.analytics.steps[id];
    var entry = upsertStep(data.analytics.steps, id, meta || {}, !!allowRepeat);
    if (!entry) return;
    if (existed && !allowRepeat) return;
    if (id === 'manual_smoke') data.analytics.lastManualSmokeAt = entry.ts;
    if (id === 'weekly_review') data.analytics.lastWeeklyReviewAt = entry.ts;
    if (id === 'read_back_verified') data.analytics.lastReadBackAt = entry.ts;
    save();

    if (global.Game && global.Game.TelemetryLogger) {
      global.Game.TelemetryLogger.log('analyticsRolloutStep', {
        step: id,
        count: entry.count,
        meta: meta || null,
      });
    }
    if (global.Game && global.Game.AnalyticsCollector) {
      global.Game.AnalyticsCollector.track('analyticsRolloutStep', { step: id });
    }
  }

  function markManualSmoke(meta) {
    trackAnalyticsStep('manual_smoke', meta || {}, true);
  }

  function markWeeklyReview(meta) {
    trackAnalyticsStep('weekly_review', meta || {}, true);
  }

  function markReadBack(meta) {
    trackAnalyticsStep('read_back_verified', meta || {}, true);
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
    ensureInit();
    return STEPS.map(function (step, idx) {
      var entry = data.steps[step.id];
      return {
        id: step.id,
        labelKey: step.labelKey,
        order: idx + 1,
        completedAt: entry ? entry.ts : null,
        elapsedMs: entry ? computeElapsedMs(data.firstLaunchAt, entry.ts) : null,
      };
    });
  }

  function getAnalyticsStatus() {
    ensureInit();
    return ANALYTICS_STEPS.map(function (step, idx) {
      var entry = data.analytics.steps[step.id];
      return {
        id: step.id,
        labelKey: step.labelKey,
        order: idx + 1,
        completedAt: entry ? entry.ts : null,
        count: entry ? entry.count : 0,
        meta: entry ? entry.meta : null,
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

  function getAnalyticsAdoptionSnapshot() {
    ensureInit();
    var reviewMs = data.analytics.lastWeeklyReviewAt ? Date.parse(data.analytics.lastWeeklyReviewAt) : NaN;
    var smokeMs = data.analytics.lastManualSmokeAt ? Date.parse(data.analytics.lastManualSmokeAt) : NaN;
    return {
      steps: getAnalyticsStatus(),
      lastManualSmokeAt: data.analytics.lastManualSmokeAt,
      lastWeeklyReviewAt: data.analytics.lastWeeklyReviewAt,
      lastReadBackAt: data.analytics.lastReadBackAt,
      stale: {
        weeklyReview: !Number.isFinite(reviewMs) || Date.now() - reviewMs > ANALYTICS_REVIEW_WINDOW_MS,
        manualSmoke: !Number.isFinite(smokeMs) || Date.now() - smokeMs > ANALYTICS_REVIEW_WINDOW_MS,
      },
    };
  }

  function reset() {
    data = { firstLaunchAt: nowIso(), steps: {}, analytics: blankAnalyticsData() };
    save();
  }

  global.Game = global.Game || {};
  global.Game.Funnel = {
    init: init,
    trackStep: trackStep,
    trackAnalyticsStep: trackAnalyticsStep,
    markManualSmoke: markManualSmoke,
    markWeeklyReview: markWeeklyReview,
    markReadBack: markReadBack,
    maybeTrackReturn: maybeTrackReturn,
    getStatus: getStatus,
    getAnalyticsStatus: getAnalyticsStatus,
    getAnalyticsAdoptionSnapshot: getAnalyticsAdoptionSnapshot,
    getDropOff: getDropOff,
    reset: reset,
    _STORAGE_KEY: STORAGE_KEY,
    _ANALYTICS_STEPS: ANALYTICS_STEPS.slice(),
  };

})(typeof window !== 'undefined' ? window : this);
