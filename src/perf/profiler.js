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
  // Solo-pipeline-yandex-vk#1 step-1 (postmortem item 15):
  // Default `enabled` is derived from `Game.DEBUG === true`. In release-mirror
  // (no DEBUG flag set) the profiler stays off and start/end/measure become
  // O(1) early-returns — no measurement-API serialization overhead. The Pack 4
  // perf_stress test continues to call `setEnabled(true)` explicitly at boot
  // so the existing test contract is preserved.
  var _enabledDefault = !!(global.Game && global.Game.DEBUG === true);
  var enabled = _enabledDefault;

  // Per-phase budget thresholds in milliseconds. When `record()` observes a
  // duration ≥ budget, it emits `perf.budget.exceeded` on Game.Events for
  // on-device diagnostics (postmortem item 11). Default is empty — caller
  // populates via setBudget(name, ms). `Infinity` budget disables alerting
  // for that phase without unsetting the entry.
  var budgets = Object.create(null);

  // Solo-pipeline-yandex-vk#2 / item 8: per-phase emit-rate throttle for
  // `perf.budget.exceeded`. A budget regression is typically systematic —
  // if drawZombies overruns 3.0ms once, it overruns every frame at 60Hz
  // (≈ 60 emits/sec per phase). With ~5 hot phases that is hundreds of
  // events/sec hitting Game.Events listeners, console, and any telemetry
  // sink. We therefore emit at most one `perf.budget.exceeded` per phase
  // per `_BUDGET_EMIT_THROTTLE_MS` window. Signal fidelity is preserved
  // (regressions still surface within 1s on every reproduction) while
  // worst-case noise is bounded to N_phases events/sec. Choice of 1000ms:
  // ≥ 60× cheaper than per-frame emit at 60Hz, still well under typical
  // human reaction time so a tester sees the alert as "live" feedback,
  // and matches the resolution of typical telemetry rollups.
  var _BUDGET_EMIT_THROTTLE_MS = 1000;
  var _lastBudgetEmitMs = Object.create(null);

  // perf-capture-tool: per-frame SUM accumulator. Unlike `stats` (cumulative
  // over the whole session) `frameMs` holds the summed duration of each phase
  // WITHIN the current frame. This is correct for phases that run multiple
  // times per frame (drawTank×N, impactAt×N) where a single getStats() avg is
  // not representative of the per-frame cost. Game.PerfCapture reads it via
  // getFrameMs()/forEachFrameMs() once per frame. Zero-alloc steady state:
  // beginFrame() zeroes existing keys in place (no delete / no realloc); a new
  // phase name adds a key once (warmup) and the object shape is stable after.
  var frameMs = Object.create(null);
  var frameActive = false;

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
    // perf-capture-tool: accumulate into the current-frame SUM. Only while a
    // frame window is open (beginFrame() called) — otherwise zero overhead.
    if (frameActive) {
      var fprev = frameMs[name];
      frameMs[name] = (typeof fprev === 'number' ? fprev : 0) + duration;
    }
    // Budget threshold check (postmortem item 11): emit on Game.Events so
    // on-device diagnostics can surface a real signal instead of noise.
    // Solo-pipeline-yandex-vk#2 / item 8: throttle emits per-phase to avoid
    // flooding listeners when a regression repeats every frame at 60Hz.
    var budget = budgets[name];
    if (budget != null && Number.isFinite(budget) && duration >= budget) {
      var nowMs = nowFn();
      var lastMs = _lastBudgetEmitMs[name];
      // First overrun for this phase always emits; subsequent overruns are
      // throttled to one per `_BUDGET_EMIT_THROTTLE_MS` window. We use
      // null-check (not `|| 0`) so that a small `nowFn()` value early after
      // process start does not accidentally suppress the very first emit.
      if (lastMs == null || nowMs - lastMs >= _BUDGET_EMIT_THROTTLE_MS) {
        _lastBudgetEmitMs[name] = nowMs;
        var bus = global.Game && global.Game.Events;
        if (bus && typeof bus.emit === 'function') {
          bus.emit('perf.budget.exceeded', {
            phase: name,
            ms: duration,
            budget: budget,
            count: stat.count
          });
        }
      }
    }
  }

  function setBudget(name, ms) {
    if (!name) return;
    if (ms == null) { delete budgets[name]; return; }
    if (!Number.isFinite(ms) || ms < 0) return;
    budgets[name] = ms;
  }

  function getBudgets() {
    var out = {};
    for (var k in budgets) {
      if (Object.prototype.hasOwnProperty.call(budgets, k)) out[k] = budgets[k];
    }
    return out;
  }

  function setBudgets(map) {
    if (!map || typeof map !== 'object') return;
    for (var k in map) {
      if (Object.prototype.hasOwnProperty.call(map, k)) setBudget(k, map[k]);
    }
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
    // Solo-pipeline-yandex-vk#2 / item 8: clear emit-throttle window so
    // tests / regression checks that call reset() observe deterministic
    // emit behavior on the very first overrun after reset.
    _lastBudgetEmitMs = Object.create(null);
    // perf-capture-tool: drop the per-frame accumulator so a fresh capture
    // starts from a clean slate.
    frameMs = Object.create(null);
    frameActive = false;
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

  // perf-capture-tool: per-frame window control + readers.
  // beginFrame() opens the window and zeroes the accumulator in place; record()
  // sums each phase into frameMs while open; endFrame() closes the window.
  function beginFrame() {
    if (!enabled) return;
    frameActive = true;
    for (var k in frameMs) frameMs[k] = 0;
  }

  function endFrame() {
    frameActive = false;
  }

  function getFrameMs(name) {
    var v = frameMs[name];
    return (typeof v === 'number') ? v : 0;
  }

  function forEachFrameMs(cb) {
    if (typeof cb !== 'function') return;
    for (var k in frameMs) cb(k, frameMs[k]);
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
    isEnabled: isEnabled,
    // Solo-pipeline-yandex-vk#1 step-1 extensions:
    setBudget: setBudget,
    setBudgets: setBudgets,
    getBudgets: getBudgets,
    // perf-capture-tool extensions (per-frame SUM accumulator):
    beginFrame: beginFrame,
    endFrame: endFrame,
    getFrameMs: getFrameMs,
    forEachFrameMs: forEachFrameMs
  };
})(typeof window !== 'undefined' ? window : this);
