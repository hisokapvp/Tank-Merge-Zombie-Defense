/**
 * Lightweight profiler (Pack 4).
 * Minimal overhead timing helpers for debug and regression checks.
 */
(function (global) {
  'use strict';

  var nowFn = (global.performance && typeof global.performance.now === 'function')
    ? function () { return global.performance.now(); }
    : function () { return Date.now(); };

  var stats = {};
  var active = {};
  var enabled = true;

  function ensureStat(name) {
    if (!stats[name]) {
      stats[name] = { count: 0, totalMs: 0, minMs: Infinity, maxMs: 0, lastMs: 0 };
    }
    return stats[name];
  }

  function record(name, duration) {
    if (!enabled || !name || !Number.isFinite(duration)) return;
    var stat = ensureStat(name);
    stat.count += 1;
    stat.totalMs += duration;
    stat.lastMs = duration;
    if (duration < stat.minMs) stat.minMs = duration;
    if (duration > stat.maxMs) stat.maxMs = duration;
  }

  function start(name) {
    if (!enabled || !name) return;
    active[name] = nowFn();
  }

  function end(name) {
    if (!enabled || !name) return null;
    var startAt = active[name];
    if (!Number.isFinite(startAt)) return null;
    var duration = nowFn() - startAt;
    delete active[name];
    record(name, duration);
    return duration;
  }

  function measure(name, fn) {
    if (typeof fn !== 'function') return undefined;
    if (!enabled) return fn();
    var startAt = nowFn();
    var result;
    try {
      result = fn();
    } finally {
      record(name, nowFn() - startAt);
    }
    return result;
  }

  function wrap(name, fn) {
    if (typeof fn !== 'function') return fn;
    return function () {
      var args = arguments;
      return measure(name, function () { return fn.apply(this, args); });
    };
  }

  function getStats() {
    var out = {};
    for (var key in stats) {
      if (!stats.hasOwnProperty(key)) continue;
      var stat = stats[key];
      out[key] = {
        count: stat.count,
        totalMs: stat.totalMs,
        minMs: stat.minMs === Infinity ? 0 : stat.minMs,
        maxMs: stat.maxMs,
        lastMs: stat.lastMs,
        avgMs: stat.count ? stat.totalMs / stat.count : 0
      };
    }
    return out;
  }

  function reset() {
    stats = {};
    active = {};
  }

  function report() {
    var rows = [];
    var summary = getStats();
    for (var key in summary) {
      if (!summary.hasOwnProperty(key)) continue;
      rows.push({ name: key, totalMs: summary[key].totalMs, data: summary[key] });
    }
    rows.sort(function (a, b) { return b.totalMs - a.totalMs; });
    var lines = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      lines.push(
        r.name + ': ' +
        'count=' + r.data.count + ', ' +
        'avg=' + r.data.avgMs.toFixed(3) + 'ms, ' +
        'min=' + r.data.minMs.toFixed(3) + 'ms, ' +
        'max=' + r.data.maxMs.toFixed(3) + 'ms, ' +
        'total=' + r.data.totalMs.toFixed(3) + 'ms'
      );
    }
    return lines.join('\n');
  }

  function setEnabled(flag) {
    enabled = flag !== false;
  }

  function isEnabled() {
    return enabled;
  }

  global.Game = global.Game || {};
  global.Game.Profiler = {
    start: start,
    end: end,
    measure: measure,
    wrap: wrap,
    getStats: getStats,
    reset: reset,
    report: report,
    setEnabled: setEnabled,
    isEnabled: isEnabled
  };
})(typeof window !== 'undefined' ? window : this);
