/**
 * InputComparisonHarness — structured A/B comparison for legacy vs Phaser input.
 *
 * Phase 2: Activates when both legacy and Phaser input paths are running.
 * Logs coordinate mismatches, drag threshold discrepancies, and hit-test
 * differences. Results are accessible via getReport() for automated testing
 * or manual inspection.
 *
 * This module is designed to be activated once during initEngineAdapterPhase1()
 * and run silently, collecting data without affecting gameplay.
 *
 * API:
 *   Game.InputComparisonHarness.init(config)
 *   Game.InputComparisonHarness.onLegacyPointer(type, pos)
 *   Game.InputComparisonHarness.onPhaserPointer(type, pos)
 *   Game.InputComparisonHarness.getReport()       → Object
 *   Game.InputComparisonHarness.isActive()         → boolean
 *   Game.InputComparisonHarness.reset()
 *   Game.InputComparisonHarness.destroy()
 */
(function (global) {
  'use strict';

  var COORD_TOLERANCE = 2;         // px — below this, coordinates match
  var MAX_MISMATCH_LOG = 200;
  var REPORT_INTERVAL_MS = 10000;  // log summary every 10s (when active and mismatches present)

  var _active = false;
  var _stats = null;
  var _mismatches = [];
  var _lastLegacy = {};  // type → {x, y, time}
  var _lastPhaser = {};  // type → {x, y, time}
  var _lastReportTime = 0;

  function _createStats() {
    return {
      totalEvents: 0,
      matchedEvents: 0,
      mismatchedEvents: 0,
      maxDeltaX: 0,
      maxDeltaY: 0,
      avgDeltaX: 0,
      avgDeltaY: 0,
      _sumDeltaX: 0,
      _sumDeltaY: 0,
    };
  }

  /**
   * Initialize the harness.
   * @param {Object} config
   * @param {boolean} [config.enabled] — whether to activate (default: false)
   * @param {number} [config.tolerance] — coordinate tolerance in px (default: 2)
   */
  function init(config) {
    config = config || {};
    _active = !!config.enabled;
    COORD_TOLERANCE = Number.isFinite(config.tolerance) ? config.tolerance : 2;
    _stats = _createStats();
    _mismatches = [];
    _lastLegacy = {};
    _lastPhaser = {};
    _lastReportTime = performance.now();

    if (_active) {
      console.log('[InputComparisonHarness] Activated — tolerance:', COORD_TOLERANCE, 'px');
    }
  }

  function isActive() {
    return _active;
  }

  /**
   * Record a legacy input event.
   * @param {string} type — 'pointerdown' | 'pointermove' | 'pointerup'
   * @param {{ x: number, y: number }} pos
   */
  function onLegacyPointer(type, pos) {
    if (!_active || !pos) return;
    _lastLegacy[type] = { x: pos.x, y: pos.y, time: performance.now() };
    _tryCompare(type);
  }

  /**
   * Record a Phaser input event.
   * @param {string} type — 'pointerdown' | 'pointermove' | 'pointerup'
   * @param {{ x: number, y: number }} pos
   */
  function onPhaserPointer(type, pos) {
    if (!_active || !pos) return;
    _lastPhaser[type] = { x: pos.x, y: pos.y, time: performance.now() };
    _tryCompare(type);
  }

  /**
   * Compare latest legacy and Phaser events of the same type.
   * Only compares if both events arrived within 16ms of each other (same frame).
   * @param {string} type
   */
  function _tryCompare(type) {
    var leg = _lastLegacy[type];
    var pha = _lastPhaser[type];
    if (!leg || !pha) return;

    // Only compare events from the same frame (~16ms window)
    if (Math.abs(leg.time - pha.time) > 16) return;

    _stats.totalEvents++;

    var dx = Math.abs(leg.x - pha.x);
    var dy = Math.abs(leg.y - pha.y);

    if (dx <= COORD_TOLERANCE && dy <= COORD_TOLERANCE) {
      _stats.matchedEvents++;
    } else {
      _stats.mismatchedEvents++;
      _stats.maxDeltaX = Math.max(_stats.maxDeltaX, dx);
      _stats.maxDeltaY = Math.max(_stats.maxDeltaY, dy);
      _stats._sumDeltaX += dx;
      _stats._sumDeltaY += dy;

      if (_mismatches.length < MAX_MISMATCH_LOG) {
        _mismatches.push({
          type: type,
          legacy: { x: leg.x.toFixed(1), y: leg.y.toFixed(1) },
          phaser: { x: pha.x.toFixed(1), y: pha.y.toFixed(1) },
          delta: { x: dx.toFixed(1), y: dy.toFixed(1) },
        });
      }
    }

    // Periodic summary logging
    var now = performance.now();
    if (_stats.mismatchedEvents > 0 && now - _lastReportTime > REPORT_INTERVAL_MS) {
      _lastReportTime = now;
      console.log('[InputComparisonHarness] ' +
        _stats.matchedEvents + '/' + _stats.totalEvents + ' matched, ' +
        _stats.mismatchedEvents + ' mismatches, ' +
        'maxDelta(' + _stats.maxDeltaX.toFixed(1) + ',' + _stats.maxDeltaY.toFixed(1) + ')');
    }

    // Clear last events after comparison
    _lastLegacy[type] = null;
    _lastPhaser[type] = null;
  }

  /**
   * Get the full A/B comparison report.
   * @returns {Object}
   */
  function getReport() {
    var mc = _stats ? _stats.mismatchedEvents : 0;
    return {
      active: _active,
      totalEvents: _stats ? _stats.totalEvents : 0,
      matchedEvents: _stats ? _stats.matchedEvents : 0,
      mismatchedEvents: mc,
      matchRate: _stats && _stats.totalEvents > 0
        ? ((_stats.matchedEvents / _stats.totalEvents) * 100).toFixed(1) + '%'
        : 'N/A',
      maxDelta: _stats ? { x: _stats.maxDeltaX, y: _stats.maxDeltaY } : { x: 0, y: 0 },
      avgDelta: mc > 0
        ? { x: _stats._sumDeltaX / mc, y: _stats._sumDeltaY / mc }
        : { x: 0, y: 0 },
      mismatches: _mismatches.slice(0, 50),  // first 50 for inspection
    };
  }

  function reset() {
    _stats = _createStats();
    _mismatches = [];
    _lastLegacy = {};
    _lastPhaser = {};
    _lastReportTime = performance.now();
  }

  function destroy() {
    _active = false;
    _stats = null;
    _mismatches = [];
    _lastLegacy = {};
    _lastPhaser = {};
  }

  global.Game = global.Game || {};
  global.Game.InputComparisonHarness = {
    init: init,
    isActive: isActive,
    onLegacyPointer: onLegacyPointer,
    onPhaserPointer: onPhaserPointer,
    getReport: getReport,
    reset: reset,
    destroy: destroy,
  };
}(window));
