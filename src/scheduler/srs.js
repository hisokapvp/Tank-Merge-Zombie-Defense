/**
 * Spaced Repetition Scheduler (SM-2).
 * Provides persistence and basic scheduling utilities.
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'srs_schedule_v1';
  var VERSION = 1;
  var DAY_MS = 24 * 60 * 60 * 1000;

  var items = {};
  var saveTimer = null;
  var dirty = false;

  function safeParse(raw, fallback) {
    if (global.Game && global.Game.Storage && global.Game.Storage.safeParse) {
      return global.Game.Storage.safeParse(raw, fallback);
    }
    try {
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  }

  function clamp(num, min, max) {
    return Math.max(min, Math.min(max, num));
  }

  function nowMs() {
    return Date.now();
  }

  function cloneItem(item) {
    return {
      id: item.id,
      reps: item.reps,
      interval: item.interval,
      ease: item.ease,
      dueAt: item.dueAt,
      lastReviewAt: item.lastReviewAt
    };
  }

  function normalizeItem(id, data, fallbackNow) {
    var now = fallbackNow || nowMs();
    var out = {
      id: String(id),
      reps: 0,
      interval: 0,
      ease: 2.5,
      dueAt: now,
      lastReviewAt: null
    };
    if (!data || typeof data !== 'object') return out;
    if (Number.isFinite(data.reps)) out.reps = Math.max(0, Math.floor(data.reps));
    if (Number.isFinite(data.interval)) out.interval = Math.max(0, Math.floor(data.interval));
    if (Number.isFinite(data.ease)) out.ease = Math.max(1.3, data.ease);
    if (Number.isFinite(data.dueAt)) out.dueAt = data.dueAt;
    if (Number.isFinite(data.lastReviewAt)) out.lastReviewAt = data.lastReviewAt;
    return out;
  }

  function normalizeItems(rawItems) {
    var out = {};
    if (!rawItems || typeof rawItems !== 'object') return out;
    for (var key in rawItems) {
      if (!rawItems.hasOwnProperty(key)) continue;
      out[key] = normalizeItem(key, rawItems[key]);
    }
    return out;
  }

  function scheduleSave() {
    if (saveTimer) return;
    saveTimer = setTimeout(function () {
      saveTimer = null;
      if (!dirty) return;
      dirty = false;
      try {
        if (global.localStorage) {
          var payload = JSON.stringify({ version: VERSION, items: items });
          global.localStorage.setItem(STORAGE_KEY, payload);
        }
      } catch (_) {}
    }, 0);
  }

  function markDirty() {
    dirty = true;
    scheduleSave();
  }

  function load() {
    try {
      var raw = global.localStorage && global.localStorage.getItem(STORAGE_KEY);
      var data = safeParse(raw, null);
      if (data && data.items) {
        items = normalizeItems(data.items);
      }
    } catch (_) {}
  }

  function init() {
    load();
  }

  function getItem(id) {
    if (!id) return null;
    var item = items[id];
    return item ? cloneItem(item) : null;
  }

  function upsertItem(id, data) {
    var item = normalizeItem(id, data);
    items[id] = item;
    markDirty();
    return cloneItem(item);
  }

  function recordReview(id, grade, now) {
    if (!id) return null;
    var ts = Number.isFinite(now) ? now : nowMs();
    var q = clamp(Number.isFinite(grade) ? grade : 3, 0, 5);
    var item = items[id] ? normalizeItem(id, items[id], ts) : normalizeItem(id, null, ts);

    if (q < 3) {
      item.reps = 0;
      item.interval = 1;
    } else {
      item.reps += 1;
      if (item.reps === 1) {
        item.interval = 1;
      } else if (item.reps === 2) {
        item.interval = 6;
      } else {
        item.interval = Math.round(item.interval * item.ease);
      }
    }

    var easeDelta = 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02);
    item.ease = Math.max(1.3, item.ease + easeDelta);
    item.lastReviewAt = ts;
    item.dueAt = ts + item.interval * DAY_MS;

    items[id] = item;
    markDirty();
    return cloneItem(item);
  }

  function scheduleNow(id, now) {
    if (!id) return null;
    var ts = Number.isFinite(now) ? now : nowMs();
    var item = items[id] ? normalizeItem(id, items[id], ts) : normalizeItem(id, null, ts);
    item.dueAt = ts;
    items[id] = item;
    markDirty();
    return cloneItem(item);
  }

  function listDue(now) {
    var ts = Number.isFinite(now) ? now : nowMs();
    var due = [];
    for (var key in items) {
      if (!items.hasOwnProperty(key)) continue;
      if (items[key].dueAt <= ts) {
        due.push(cloneItem(items[key]));
      }
    }
    due.sort(function (a, b) { return a.dueAt - b.dueAt; });
    return due;
  }

  function getNextReview(now) {
    var ts = Number.isFinite(now) ? now : nowMs();
    var next = null;
    for (var key in items) {
      if (!items.hasOwnProperty(key)) continue;
      var item = items[key];
      if (!next || item.dueAt < next.dueAt) {
        next = item;
      }
    }
    return next ? cloneItem(next) : null;
  }

  function exportSchedule() {
    return JSON.stringify({ version: VERSION, items: items }, null, 2);
  }

  function importSchedule(payload) {
    var data = payload;
    if (typeof payload === 'string') {
      data = safeParse(payload, null);
    }
    if (!data || typeof data !== 'object' || !data.items) return 0;
    items = normalizeItems(data.items);
    markDirty();
    return Object.keys(items).length;
  }

  global.Game = global.Game || {};
  global.Game.SRS = {
    init: init,
    recordReview: recordReview,
    getNextReview: getNextReview,
    listDue: listDue,
    scheduleNow: scheduleNow,
    exportSchedule: exportSchedule,
    importSchedule: importSchedule,
    getItem: getItem,
    _STORAGE_KEY: STORAGE_KEY
  };
})(typeof window !== 'undefined' ? window : this);
