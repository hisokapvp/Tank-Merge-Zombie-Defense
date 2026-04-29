/**
 * ProjectilesEffectsPhaserLayer — Phaser layer module for projectiles and effects.
 *
 * Phase 2c: Delegates to the legacy renderProjectilesAndEffects() via a
 * registered callback. The legacy function draws decals, projectiles,
 * impacts, particles and damage numbers — all tightly coupled with closured
 * game state and sprite atlases. The Phaser layer wraps the call to enable
 * RenderRegistry gating and future replacement with Phaser GameObjects.
 *
 * API:
 *   Game.PhaserLayers.ProjectilesEffects.init(config)
 *   Game.PhaserLayers.ProjectilesEffects.update(state)
 *   Game.PhaserLayers.ProjectilesEffects.draw(ctx)
 *   Game.PhaserLayers.ProjectilesEffects.setDrawFn(fn)
 *   Game.PhaserLayers.ProjectilesEffects.destroy()
 */
(function (global) {
  'use strict';

  /** @type {Function|null} legacy renderProjectilesAndEffects callback */
  var _drawFn = null;

  /**
   * Initialize the projectiles/effects layer.
   * @param {Object} config
   * @param {Function} [config.drawFn] - legacy renderProjectilesAndEffects reference
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
   * Draw projectiles and effects to the main canvas.
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
  global.Game.PhaserLayers.ProjectilesEffects = {
    init: init,
    update: update,
    draw: draw,
    setDrawFn: setDrawFn,
    invalidate: invalidate,
    destroy: destroy,
  };
}(window));
