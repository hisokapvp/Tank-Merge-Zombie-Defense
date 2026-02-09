/**
 * Pack 2 — Enhanced Telemetry Logger.
 *
 * Расширяет Game.Telemetry дополнительным «lesson-aware» логированием.
 * Предоставляет:
 *   Game.TelemetryLogger.log(event, data)   — запись события с timestamp
 *   Game.TelemetryLogger.flush()            — сброс буфера в localStorage
 *   Game.TelemetryLogger.export(format)     — вернуть накопленные записи (json|csv)
 *   Game.TelemetryLogger.clear()            — очистка всех записей
 *   Game.TelemetryLogger.getEntries()       — получить массив записей (read-only копия)
 *   Game.TelemetryLogger.setLesson(name)    — установить текущий урок для тегирования
 *
 * Записи хранятся в памяти и периодически flush-ятся в localStorage.
 * Ротация: если записей > MAX_ENTRIES, старые удаляются.
 * Async non-blocking: flush использует setTimeout(0) для неблокирующей записи.
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'telemetry_log';
  var MAX_ENTRIES = 2000;
  var MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
  var FLUSH_INTERVAL_MS = 15000; // авто-flush каждые 15 с

  var entries = [];
  var currentLesson = null;
  var flushTimer = null;
  var dirty = false;

  /* ── Helpers ── */
  function safeParse(raw, fb) {
    try { return raw ? JSON.parse(raw) : fb; }
    catch (_) { return fb; }
  }

  function now() {
    return new Date().toISOString();
  }

  function cloneArray(arr) {
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var e = arr[i];
      var copy = { ts: e.ts, event: e.event };
      if (e.lesson) copy.lesson = e.lesson;
      if (e.data !== undefined) copy.data = e.data;
      out.push(copy);
    }
    return out;
  }

  function parseTs(ts) {
    var ms = Date.parse(ts);
    return Number.isFinite(ms) ? ms : null;
  }

  function trimBuffer(buffer, nowMs, maxEntries, maxAgeMs) {
    var target = Array.isArray(buffer) ? buffer : entries;
    var now = typeof nowMs === 'number' ? nowMs : Date.now();
    var maxCount = typeof maxEntries === 'number' ? maxEntries : MAX_ENTRIES;
    var maxAge = typeof maxAgeMs === 'number' ? maxAgeMs : MAX_AGE_MS;
    var trimmed = [];

    for (var i = 0; i < target.length; i++) {
      var item = target[i];
      if (!item || !item.ts) continue;
      if (maxAge > 0) {
        var tsMs = parseTs(item.ts);
        if (tsMs == null) continue;
        if (now - tsMs > maxAge) continue;
      }
      trimmed.push(item);
    }

    if (maxCount > 0 && trimmed.length > maxCount) {
      trimmed = trimmed.slice(trimmed.length - maxCount);
    }

    if (!Array.isArray(buffer)) entries = trimmed;
    return trimmed;
  }

  /* ── Core API ── */

  /**
   * Записать событие.
   * @param {string} event — тип события (merge, fire, kill, lessonStart, lessonEnd, ...)
   * @param {*} [data]     — произвольные данные
   */
  function log(event, data) {
    if (!event) return;
    var entry = { ts: now(), event: event };
    if (currentLesson) entry.lesson = currentLesson;
    if (data !== undefined) entry.data = data;
    entries.push(entry);
    dirty = true;
    entries = trimBuffer(entries, Date.now());
    // Notify base telemetry
    if (global.Game && global.Game.Telemetry && global.Game.Telemetry.event) {
      global.Game.Telemetry.event(event);
    }
  }

  /**
   * Flush буфера в localStorage (неблокирующий).
   * @param {function} [cb] — callback после записи
   */
  function flush(cb) {
    if (!dirty && !cb) return;
    entries = trimBuffer(entries, Date.now());
    var snapshot = JSON.stringify(entries);
    dirty = false;
    setTimeout(function () {
      try {
        if (global.localStorage) {
          global.localStorage.setItem(STORAGE_KEY, snapshot);
        }
      } catch (e) {
        // localStorage quota — молча проглатываем
      }
      if (typeof cb === 'function') cb();
    }, 0);
  }

  /**
   * Экспорт записей.
   * @param {'json'|'csv'} [format='json']
   * @returns {string}
   */
  function exportEntries(format) {
    flush(); // ensure latest data persisted
    var data = cloneArray(entries);
    if (format === 'csv') {
      return entriesToCSV(data);
    }
    return JSON.stringify(data, null, 2);
  }

  /**
   * Конвертация массива записей в CSV-строку.
   */
  function entriesToCSV(arr) {
    var lines = ['timestamp,event,lesson,data'];
    for (var i = 0; i < arr.length; i++) {
      var e = arr[i];
      var dataStr = e.data !== undefined ? JSON.stringify(e.data) : '';
      lines.push(
        csvField(e.ts) + ',' +
        csvField(e.event) + ',' +
        csvField(e.lesson || '') + ',' +
        csvField(dataStr)
      );
    }
    return lines.join('\n');
  }

  /** Escape CSV field (RFC 4180). */
  function csvField(val) {
    var s = String(val);
    if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  /** Очистить все записи (memory + storage). */
  function clear() {
    entries = [];
    dirty = false;
    try {
      if (global.localStorage) global.localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
  }

  /** Вернуть копию массива записей. */
  function getEntries() {
    return cloneArray(entries);
  }

  /** Установить текущий урок. */
  function setLesson(name) {
    currentLesson = name || null;
  }

  /** Загрузить сохранённые записи из localStorage. */
  function load() {
    try {
      var raw = global.localStorage && global.localStorage.getItem(STORAGE_KEY);
      var data = safeParse(raw, null);
      if (Array.isArray(data)) {
        entries = trimBuffer(data, Date.now());
      }
    } catch (_) {}
  }

  /** Запустить авто-flush таймер. */
  function startAutoFlush() {
    if (flushTimer) return;
    flushTimer = setInterval(function () {
      flush();
    }, FLUSH_INTERVAL_MS);
  }

  /** Остановить авто-flush. */
  function stopAutoFlush() {
    if (flushTimer) { clearInterval(flushTimer); flushTimer = null; }
  }

  /** Init — загрузить + запустить таймер. */
  function init() {
    load();
    startAutoFlush();
  }

  /* ── Export ── */
  global.Game = global.Game || {};
  global.Game.TelemetryLogger = {
    init: init,
    log: log,
    flush: flush,
    export: exportEntries,
    clear: clear,
    getEntries: getEntries,
    setLesson: setLesson,
    load: load,
    startAutoFlush: startAutoFlush,
    stopAutoFlush: stopAutoFlush,
    // testing
    _STORAGE_KEY: STORAGE_KEY,
    _MAX_ENTRIES: MAX_ENTRIES,
    _MAX_AGE_MS: MAX_AGE_MS,
    _entriesToCSV: entriesToCSV,
    _csvField: csvField,
    trimBuffer: trimBuffer,
  };

})(typeof window !== 'undefined' ? window : this);
