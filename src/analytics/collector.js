/**
 * Analytics Collector — lightweight event aggregation + export.
 *
 * API:
 *   Game.AnalyticsCollector.init()
 *   Game.AnalyticsCollector.track(event, data)
 *   Game.AnalyticsCollector.recordValue(name, value)
 *   Game.AnalyticsCollector.getSummary()
 *   Game.AnalyticsCollector.export(format)
 *   Game.AnalyticsCollector.clear()
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'analytics_summary_v1';

  var summary = null;
  var dirty = false;
  var flushTimer = null;

  function nowIso() {
    return new Date().toISOString();
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

  function bumpMeta() {
    summary.meta.updatedAt = nowIso();
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

  function getSummary() {
    ensureInit();
    return deepClone(summary);
  }

  function exportSummary(format) {
    ensureInit();
    if (format === 'csv') return toCSV(summary);
    return JSON.stringify(summary, null, 2);
  }

  function toCSV(data) {
    var lines = ['type,name,count,lastTs,sum,min,max,last'];
    var events = data.events || {};
    var lessons = data.lessons || {};
    var values = data.values || {};

    for (var ev in events) {
      if (!events.hasOwnProperty(ev)) continue;
      lines.push('event,' + csvField(ev) + ',' + events[ev].count + ',' + csvField(events[ev].lastTs || '') + ',,,,');
    }
    for (var l in lessons) {
      if (!lessons.hasOwnProperty(l)) continue;
      lines.push('lesson,' + csvField(l) + ',' + lessons[l].count + ',' + csvField(lessons[l].lastTs || '') + ',,,,');
    }
    for (var v in values) {
      if (!values.hasOwnProperty(v)) continue;
      var item = values[v];
      lines.push('value,' + csvField(v) + ',' + item.count + ',,' + item.sum + ',' + item.min + ',' + item.max + ',' + item.last);
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
    summary.meta.sessions = (summary.meta.sessions || 0) + 1;
    bumpMeta();
    dirty = true;
    scheduleFlush();
  }

  global.Game = global.Game || {};
  global.Game.AnalyticsCollector = {
    init: init,
    track: track,
    recordValue: recordValue,
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
