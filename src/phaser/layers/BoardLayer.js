/**
 * BoardPhaserLayer — Phaser layer module for the board cells and tank slots.
 *
 * Phase 2c: Delegates to the legacy drawBoard() via a registered callback.
 * Board rendering includes cell grid, tank icons, stamp reveals, dismantle
 * mode overlays, dragged tank, and UndergroundHangar cell — all tightly
 * coupled with closured game state. The Phaser layer wraps the call to
 * enable RenderRegistry gating and future replacement with Phaser GameObjects.
 *
 * API:
 *   Game.PhaserLayers.Board.init(config)
 *   Game.PhaserLayers.Board.update(state)
 *   Game.PhaserLayers.Board.draw(ctx)
 *   Game.PhaserLayers.Board.setDrawFn(fn)
 *   Game.PhaserLayers.Board.destroy()
 */
(function (global) {
  'use strict';

  /** @type {Function|null} legacy drawBoard callback */
  var _drawFn = null;

  /**
   * Initialize the board layer.
   * @param {Object} config
   * @param {Function} [config.drawFn] - legacy drawBoard reference
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
   * Draw the board to the main canvas.
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
  global.Game.PhaserLayers.Board = {
    init: init,
    update: update,
    draw: draw,
    setDrawFn: setDrawFn,
    invalidate: invalidate,
    destroy: destroy,
  };
}(window));
