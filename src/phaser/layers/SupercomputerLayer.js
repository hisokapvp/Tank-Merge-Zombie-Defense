/**
 * SupercomputerPhaserLayer — Phaser layer module for the supercomputer sprite.
 *
 * Phase 2c: Delegates to the legacy drawSupercomputer() via a registered
 * callback. Supercomputer rendering involves multi-frame animation,
 * effect transforms, sprite clip rendering, and dynamic scaling — all
 * tightly coupled with closured game state and config. The Phaser layer
 * wraps the call to enable RenderRegistry gating and future replacement.
 *
 * API:
 *   Game.PhaserLayers.Supercomputer.init(config)
 *   Game.PhaserLayers.Supercomputer.update(state)
 *   Game.PhaserLayers.Supercomputer.draw(ctx)
 *   Game.PhaserLayers.Supercomputer.setDrawFn(fn)
 *   Game.PhaserLayers.Supercomputer.destroy()
 */
(function (global) {
  'use strict';

  /** @type {Function|null} legacy drawSupercomputer callback */
  var _drawFn = null;

  /**
   * Initialize the supercomputer layer.
   * @param {Object} config
   * @param {Function} [config.drawFn] - legacy drawSupercomputer reference
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
   * Draw the supercomputer to the main canvas.
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
  global.Game.PhaserLayers.Supercomputer = {
    init: init,
    update: update,
    draw: draw,
    setDrawFn: setDrawFn,
    invalidate: invalidate,
    destroy: destroy,
  };
}(window));
