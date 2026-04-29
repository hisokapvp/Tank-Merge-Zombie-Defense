/**
 * OrbitingTanksPhaserLayer — Phaser layer module for tanks orbiting on track.
 *
 * Phase 2c: Delegates to the legacy drawOrbitingTanks() via a registered
 * callback. Orbiting tank rendering uses tankOrbitState, sprite picking,
 * and status world position writes — tightly coupled with closured game state.
 * The Phaser layer wraps the call to enable RenderRegistry gating and future
 * replacement with Phaser GameObjects.
 *
 * API:
 *   Game.PhaserLayers.OrbitingTanks.init(config)
 *   Game.PhaserLayers.OrbitingTanks.update(state)
 *   Game.PhaserLayers.OrbitingTanks.draw(ctx)
 *   Game.PhaserLayers.OrbitingTanks.setDrawFn(fn)
 *   Game.PhaserLayers.OrbitingTanks.destroy()
 */
(function (global) {
  'use strict';

  /** @type {Function|null} legacy drawOrbitingTanks callback */
  var _drawFn = null;

  /**
   * Initialize the orbiting tanks layer.
   * @param {Object} config
   * @param {Function} [config.drawFn] - legacy drawOrbitingTanks reference
   */
  function init(config) {
    config = config || {};
    if (typeof config.drawFn === 'function') {
      _drawFn = config.drawFn;
    }
  }

  /**
   * Update state references each frame.
   * @param {Object} _params
   */
  function update(_params) {
    // Delegation layer — legacy fn reads closured state directly
  }

  /**
   * Set or replace the legacy draw callback.
   * @param {Function} fn
   */
  function setDrawFn(fn) {
    if (typeof fn === 'function') _drawFn = fn;
  }

  /**
   * Draw orbiting tanks to the main canvas.
   * @param {CanvasRenderingContext2D} _ctx
   */
  function draw(_ctx) {
    if (typeof _drawFn === 'function') _drawFn();
  }

  function invalidate() {
    // Dynamic layer — no cache
  }

  function destroy() {
    _drawFn = null;
  }

  global.Game = global.Game || {};
  global.Game.PhaserLayers = global.Game.PhaserLayers || {};
  global.Game.PhaserLayers.OrbitingTanks = {
    init: init,
    update: update,
    draw: draw,
    setDrawFn: setDrawFn,
    invalidate: invalidate,
    destroy: destroy,
  };
}(window));
