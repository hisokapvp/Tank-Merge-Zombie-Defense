/**
 * FenceBasePhaserLayer — Phaser layer module for the fence base geometry.
 *
 * Phase 2c: Delegates to the legacy renderFenceBase() via a registered
 * callback, because fence rendering is tightly coupled with game state
 * mutation (segment rebuild). The Phaser layer wraps the call to enable
 * RenderRegistry gating and future replacement with Phaser GameObjects.
 *
 * API:
 *   Game.PhaserLayers.FenceBase.init(config)
 *   Game.PhaserLayers.FenceBase.update(state)
 *   Game.PhaserLayers.FenceBase.draw(ctx)
 *   Game.PhaserLayers.FenceBase.setDrawFn(fn)
 *   Game.PhaserLayers.FenceBase.destroy()
 */
(function (global) {
  'use strict';

  /** @type {Function|null} legacy renderFenceBase callback */
  var _drawFn = null;

  /**
   * Initialize the fence base layer.
   * @param {Object} config
   * @param {Function} [config.drawFn] - legacy renderFenceBase reference
   */
  function init(config) {
    config = config || {};
    if (typeof config.drawFn === 'function') {
      _drawFn = config.drawFn;
    }
  }

  /**
   * Update state references each frame.
   * No per-frame state needed — the legacy function reads game state directly.
   * @param {Object} _params
   */
  function update(_params) {
    // Delegation layer — legacy fn reads closured state directly
  }

  /**
   * Set or replace the legacy draw callback.
   * Called from game.js during init to provide the closured renderFenceBase.
   * @param {Function} fn
   */
  function setDrawFn(fn) {
    if (typeof fn === 'function') _drawFn = fn;
  }

  /**
   * Draw the fence base to the main canvas.
   * Delegates to legacy renderFenceBase for now.
   * @param {CanvasRenderingContext2D} _ctx
   */
  function draw(_ctx) {
    if (typeof _drawFn === 'function') _drawFn();
  }

  function invalidate() {
    // Delegation layer — no cache
  }

  function destroy() {
    _drawFn = null;
  }

  global.Game = global.Game || {};
  global.Game.PhaserLayers = global.Game.PhaserLayers || {};
  global.Game.PhaserLayers.FenceBase = {
    init: init,
    update: update,
    draw: draw,
    setDrawFn: setDrawFn,
    invalidate: invalidate,
    destroy: destroy,
  };
}(window));
