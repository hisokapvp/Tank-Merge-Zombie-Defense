/**
 * ZombiesCorpsesPhaserLayer — Phaser layer module for zombies and corpses.
 *
 * Phase 2c: Delegates to the legacy renderZombiesAndCorpses() via a registered
 * callback, because zombie rendering requires depth-sorted interleaving with
 * decor sprites and accesses closured game state (zombies, decors, ZombieSprites).
 * The Phaser layer wraps the call to enable RenderRegistry gating and future
 * replacement with Phaser GameObjects.
 *
 * API:
 *   Game.PhaserLayers.ZombiesCorpses.init(config)
 *   Game.PhaserLayers.ZombiesCorpses.update(state)
 *   Game.PhaserLayers.ZombiesCorpses.draw(ctx)
 *   Game.PhaserLayers.ZombiesCorpses.setDrawFn(fn)
 *   Game.PhaserLayers.ZombiesCorpses.destroy()
 */
(function (global) {
  'use strict';

  /** @type {Function|null} legacy renderZombiesAndCorpses callback */
  var _drawFn = null;

  /**
   * Initialize the zombies/corpses layer.
   * @param {Object} config
   * @param {Function} [config.drawFn] - legacy renderZombiesAndCorpses reference
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
   * Draw zombies and corpses to the main canvas.
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
  global.Game.PhaserLayers.ZombiesCorpses = {
    init: init,
    update: update,
    draw: draw,
    setDrawFn: setDrawFn,
    invalidate: invalidate,
    destroy: destroy,
  };
}(window));
