/**
 * Analytics Collector — lightweight event aggregation + rollout health summary.
 *
 * API:
 *   Game.AnalyticsCollector.init()
 *   Game.AnalyticsCollector.track(event, data)
 *   Game.AnalyticsCollector.recordValue(name, value)
 *   Game.AnalyticsCollector.setAnalyticsRollout(snapshot)
 *   Game.AnalyticsCollector.markVerification(kind, payload)
 *   Game.AnalyticsCollector.getAnalyticsSnapshot()
 *   Game.AnalyticsCollector.assessStaleness()
 *   Game.AnalyticsCollector.getSummary()
 *   Game.AnalyticsCollector.export(format)
 *   Game.AnalyticsCollector.clear()
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'analytics_summary_v1';
  var ANALYTICS_STALE_AFTER_MS = 15 * 60 * 1000;
  var REVIEW_STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

  var summary = null;
  var dirty = false;
  var flushTimer = null;

  function nowIso() {
    return new Date().toISOString();
  }

  function blankAnalyticsState() {
    return {
      taxonomyVersion: '',
      consent: {
        status: 'unknown',
        updatedAt: null,
        source: '',
      },
      rollout: {
        generatedAt: null,
        enabled: false,
        limitedEvents: true,
        canary: false,
        readBackEnabled: false,
        primaryAdapter: '',
        secondaryAdapter: '',
        activeAdapters: [],
        batching: {
          batchSize: 0,
          intervalMs: 0,
          maxPending: 0,
        },
        experiment: {
          id: '',
          variant: 'control',
          source: '',
        },
        flags: {},
      },
      adapters: {},
      verification: {
        readBackAt: null,
        readBackStatus: 'unknown',
        manualSmokeAt: null,
        manualSmokeNote: '',
        weeklyReviewAt: null,
        weeklyReviewNote: '',
      },
      stale: {
        overall: false,
        reasons: [],
      },
    };
  }

  function blankSummary() {
    var now = nowIso();
    return {
      meta: {
        createdAt: now,
        updatedAt: now,
        lastEventAt: null,
        sessions: 1,
      },
      events: {},
      lessons: {},
      values: {},
      analytics: blankAnalyticsState(),
    };
  }

  function safeParse(raw, fb) {
    try { return raw ? JSON.parse(raw) : fb; }
    catch (_) { return fb; }
  }

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function load() {
    try {
      var raw = global.localStorage && global.localStorage.getItem(STORAGE_KEY);
      var data = safeParse(raw, null);
      if (data && typeof data === 'object') {
        summary = data;
        ensureAnalyticsState();
        return;
      }
    } catch (_) {}
    summary = blankSummary();
  }

  function save() {
    if (!dirty) return;
    dirty = false;
    try {
      if (global.localStorage) {
        global.localStorage.setItem(STORAGE_KEY, JSON.stringify(summary));
      }
    } catch (_) {}
  }

  function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(function () {
      flushTimer = null;
      save();
    }, 0);
  }

  function ensureInit() {
    if (!summary) load();
  }

  function ensureAnalyticsState() {
    ensureInit();
    if (!summary.analytics || typeof summary.analytics !== 'object') {
      summary.analytics = blankAnalyticsState();
    }
    if (!summary.analytics.rollout || typeof summary.analytics.rollout !== 'object') {
      summary.analytics.rollout = blankAnalyticsState().rollout;
    }
    if (!summary.analytics.consent || typeof summary.analytics.consent !== 'object') {
      summary.analytics.consent = blankAnalyticsState().consent;
    }
    if (!summary.analytics.adapters || typeof summary.analytics.adapters !== 'object') {
      summary.analytics.adapters = {};
    }
    if (!summary.analytics.verification || typeof summary.analytics.verification !== 'object') {
      summary.analytics.verification = blankAnalyticsState().verification;
    }
    if (!summary.analytics.stale || typeof summary.analytics.stale !== 'object') {
      summary.analytics.stale = blankAnalyticsState().stale;
    }
  }

  function bumpMeta() {
    summary.meta.updatedAt = nowIso();
  }

  function normalizeVerificationPayload(payload) {
    payload = payload && typeof payload === 'object' ? payload : {};
    return {
      ts: payload.ts || payload.at || nowIso(),
      status: payload.status || 'verified',
      note: payload.note || payload.source || payload.adapter || '',
    };
  }

  function computeAnalyticsStaleness(analytics, nowMs) {
    var reasons = [];
    var now = typeof nowMs === 'number' ? nowMs : Date.now();
    var verification = analytics.verification || {};
    var adapters = analytics.adapters || {};

    var weeklyReviewAt = verification.weeklyReviewAt ? Date.parse(verification.weeklyReviewAt) : NaN;
    if (!Number.isFinite(weeklyReviewAt) || now - weeklyReviewAt > REVIEW_STALE_AFTER_MS) {
      reasons.push('weekly_review_stale');
    }

    var manualSmokeAt = verification.manualSmokeAt ? Date.parse(verification.manualSmokeAt) : NaN;
    if (!Number.isFinite(manualSmokeAt) || now - manualSmokeAt > REVIEW_STALE_AFTER_MS) {
      reasons.push('manual_smoke_stale');
    }

    var readBackAt = verification.readBackAt ? Date.parse(verification.readBackAt) : NaN;
    if ((analytics.rollout || {}).readBackEnabled) {
      if (!Number.isFinite(readBackAt) || now - readBackAt > ANALYTICS_STALE_AFTER_MS) {
        reasons.push('read_back_stale');
      }
    }

    for (var name in adapters) {
      if (!Object.prototype.hasOwnProperty.call(adapters, name)) continue;
      var item = adapters[name] || {};
      var lastBatchAt = item.lastBatchAt ? Date.parse(item.lastBatchAt) : NaN;
      if (item.enabled && Number.isFinite(lastBatchAt) && now - lastBatchAt > ANALYTICS_STALE_AFTER_MS) {
        reasons.push(name + '_batch_stale');
      }
    }

    return {
      overall: reasons.length > 0,
      reasons: reasons,
    };
  }

  function track(event, data) {
    if (!event) return;
    ensureInit();
    var item = summary.events[event] || { count: 0, lastTs: null };
    item.count += 1;
    item.lastTs = nowIso();
    summary.events[event] = item;
    summary.meta.lastEventAt = item.lastTs;

    if (data && data.lesson) {
      var lessonKey = String(data.lesson);
      var lesson = summary.lessons[lessonKey] || { count: 0, lastTs: null };
      lesson.count += 1;
      lesson.lastTs = item.lastTs;
      summary.lessons[lessonKey] = lesson;
    }

    if (event === 'analyticsReadBack') {
      markVerification('read_back', data);
    } else if (event === 'analyticsManualSmoke') {
      markVerification('manual_smoke', data);
    } else if (event === 'analyticsWeeklyReview') {
      markVerification('weekly_review', data);
    }

    bumpMeta();
    dirty = true;
    scheduleFlush();
  }

  function recordValue(name, value) {
    if (!name || !Number.isFinite(value)) return;
    ensureInit();
    var item = summary.values[name] || { count: 0, sum: 0, min: value, max: value, last: value };
    item.count += 1;
    item.sum += value;
    item.min = Math.min(item.min, value);
    item.max = Math.max(item.max, value);
    item.last = value;
    summary.values[name] = item;
    bumpMeta();
    dirty = true;
    scheduleFlush();
  }

  function setAnalyticsRollout(snapshot) {
    ensureAnalyticsState();
    snapshot = snapshot && typeof snapshot === 'object' ? snapshot : {};
    summary.analytics.taxonomyVersion = String(snapshot.taxonomyVersion || '').trim();
    summary.analytics.consent = deepClone(snapshot.consent || blankAnalyticsState().consent);
    summary.analytics.rollout = deepClone(snapshot.rollout || blankAnalyticsState().rollout);
    summary.analytics.adapters = deepClone(snapshot.adapters || {});
    summary.analytics.verification = deepClone(snapshot.verification || blankAnalyticsState().verification);
    summary.analytics.stale = computeAnalyticsStaleness(summary.analytics, Date.now());
    bumpMeta();
    dirty = true;
    scheduleFlush();
  }

  function markVerification(kind, payload) {
    ensureAnalyticsState();
    var normalized = normalizeVerificationPayload(payload);
    var verification = summary.analytics.verification;
    if (kind === 'read_back') {
      verification.readBackAt = normalized.ts;
      verification.readBackStatus = normalized.status;
    } else if (kind === 'manual_smoke') {
      verification.manualSmokeAt = normalized.ts;
      verification.manualSmokeNote = normalized.note;
    } else if (kind === 'weekly_review') {
      verification.weeklyReviewAt = normalized.ts;
      verification.weeklyReviewNote = normalized.note;
    }
    summary.analytics.stale = computeAnalyticsStaleness(summary.analytics, Date.now());
    bumpMeta();
    dirty = true;
    scheduleFlush();
  }

  function getAnalyticsSnapshot() {
    ensureAnalyticsState();
    summary.analytics.stale = computeAnalyticsStaleness(summary.analytics, Date.now());
    return deepClone(summary.analytics);
  }

  function assessStaleness(nowMs) {
    ensureAnalyticsState();
    summary.analytics.stale = computeAnalyticsStaleness(summary.analytics, nowMs);
    return deepClone(summary.analytics.stale);
  }

  function getSummary() {
    ensureInit();
    ensureAnalyticsState();
    summary.analytics.stale = computeAnalyticsStaleness(summary.analytics, Date.now());
    return deepClone(summary);
  }

  function exportSummary(format) {
    ensureInit();
    if (format === 'csv') return toCSV(summary);
    return JSON.stringify(getSummary(), null, 2);
  }

  function toCSV(data) {
    var lines = ['type,name,count,lastTs,sum,min,max,last'];
    var events = data.events || {};
    var lessons = data.lessons || {};
    var values = data.values || {};
    var adapters = ((data.analytics || {}).adapters) || {};

    for (var ev in events) {
      if (!Object.prototype.hasOwnProperty.call(events, ev)) continue;
      lines.push('event,' + csvField(ev) + ',' + events[ev].count + ',' + csvField(events[ev].lastTs || '') + ',,,,');
    }
    for (var l in lessons) {
      if (!Object.prototype.hasOwnProperty.call(lessons, l)) continue;
      lines.push('lesson,' + csvField(l) + ',' + lessons[l].count + ',' + csvField(lessons[l].lastTs || '') + ',,,,');
    }
    for (var v in values) {
      if (!Object.prototype.hasOwnProperty.call(values, v)) continue;
      var item = values[v];
      lines.push('value,' + csvField(v) + ',' + item.count + ',,' + item.sum + ',' + item.min + ',' + item.max + ',' + item.last);
    }
    for (var name in adapters) {
      if (!Object.prototype.hasOwnProperty.call(adapters, name)) continue;
      var adapter = adapters[name] || {};
      lines.push('backend,' + csvField(name) + ',' + (adapter.sentCount || 0) + ',' + csvField(adapter.lastBatchAt || '') + ',,,,' + csvField(adapter.lastStatus || 'unknown'));
    }
    return lines.join('\n');
  }

  function csvField(val) {
    var s = String(val == null ? '' : val);
    if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function clear() {
    summary = blankSummary();
    dirty = true;
    scheduleFlush();
  }

  function init() {
    ensureInit();
    ensureAnalyticsState();
    summary.meta.sessions = (summary.meta.sessions || 0) + 1;
    summary.analytics.stale = computeAnalyticsStaleness(summary.analytics, Date.now());
    bumpMeta();
    dirty = true;
    scheduleFlush();
  }

  global.Game = global.Game || {};
  global.Game.AnalyticsCollector = {
    init: init,
    track: track,
    recordValue: recordValue,
    setAnalyticsRollout: setAnalyticsRollout,
    markVerification: markVerification,
    getAnalyticsSnapshot: getAnalyticsSnapshot,
    assessStaleness: assessStaleness,
    getSummary: getSummary,
    export: exportSummary,
    clear: clear,
    _STORAGE_KEY: STORAGE_KEY,
    _csvField: csvField,
  };

  if (global.document && global.setTimeout) {
    setTimeout(function () {
      try { init(); } catch (_) {}
    }, 0);
  }

})(typeof window !== 'undefined' ? window : this);
