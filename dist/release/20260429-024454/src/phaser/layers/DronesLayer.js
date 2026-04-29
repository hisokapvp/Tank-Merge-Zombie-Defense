/**
 * DronesPhaserLayer — Phaser layer module for drones.
 *
 * Phase 2c: Delegates to the legacy drawDrones() via a registered callback.
 * Drone rendering uses DronesApi.draw() with many closured config getters.
 * The Phaser layer wraps the call to enable RenderRegistry gating and future
 * replacement with Phaser GameObjects.
 *
 * API:
 *   Game.PhaserLayers.Drones.init(config)
 *   Game.PhaserLayers.Drones.update(state)
 *   Game.PhaserLayers.Drones.draw(ctx)
 *   Game.PhaserLayers.Drones.setDrawFn(fn)
 *   Game.PhaserLayers.Drones.destroy()
 */
(function (global) {
  'use strict';

  /** @type {Function|null} legacy drawDrones callback */
  var _drawFn = null;

  /**
   * Initialize the drones layer.
   * @param {Object} config
   * @param {Function} [config.drawFn] - legacy drawDrones reference
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
   * Draw drones to the main canvas.
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
  global.Game.PhaserLayers.Drones = {
    init: init,
    update: update,
    draw: draw,
    setDrawFn: setDrawFn,
    invalidate: invalidate,
    destroy: destroy,
  };
}(window));
