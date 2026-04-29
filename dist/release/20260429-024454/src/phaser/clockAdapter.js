/**
 * ClockAdapter — bridges game clock and pause semantics between
 * the legacy Canvas runtime and Phaser 3.
 *
 * In Phase 1, this adapter allows the Phaser scene update cycle
 * to use the same timing/pause semantics as the legacy loop.
 *
 * API:
 *   Game.ClockAdapter.init(config)
 *   Game.ClockAdapter.getNowSec()      → number (game time in seconds)
 *   Game.ClockAdapter.isPaused()       → boolean
 *   Game.ClockAdapter.getTimeScale()   → number
 *   Game.ClockAdapter.getDt(rawDt)     → number (scaled dt)
 */
(function (global) {
  'use strict';

  var _nowSecFn = null;
  var _isPausedFn = null;
  var _getTimeScaleFn = null;

  /**
   * Initialize the clock adapter.
   * @param {Object} config
   * @param {Function} config.nowSec - game clock function returning seconds
   * @param {Function} config.isPaused - returns true when game is paused
   * @param {Function} config.getTimeScale - returns current time scale factor
   */
  function init(config) {
    config = config || {};
    _nowSecFn = typeof config.nowSec === 'function' ? config.nowSec : null;
    _isPausedFn = typeof config.isPaused === 'function' ? config.isPaused : null;
    _getTimeScaleFn = typeof config.getTimeScale === 'function' ? config.getTimeScale : null;
    console.log('[ClockAdapter] Initialized');
  }

  function getNowSec() {
    if (_nowSecFn) return _nowSecFn();
    return performance.now() / 1000;
  }

  function isPaused() {
    if (_isPausedFn) return _isPausedFn();
    return false;
  }

  function getTimeScale() {
    if (_getTimeScaleFn) return _getTimeScaleFn();
    return 1;
  }

  /**
   * Apply time scale and pause to a raw delta time.
   * @param {number} rawDt - raw delta time in seconds
   * @returns {number} effective dt (0 if paused)
   */
  function getDt(rawDt) {
    if (isPaused()) return 0;
    return rawDt * getTimeScale();
  }

  global.Game = global.Game || {};
  global.Game.ClockAdapter = {
    init: init,
    getNowSec: getNowSec,
    isPaused: isPaused,
    getTimeScale: getTimeScale,
    getDt: getDt,
  };
}(window));
