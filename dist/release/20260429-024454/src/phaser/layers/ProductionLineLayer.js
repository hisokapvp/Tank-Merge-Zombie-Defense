/**
 * ProductionLinePhaserLayer — Phaser layer module for the production line.
 *
 * Phase 2c: Delegates to the legacy ProductionLineRender.draw() via a
 * registered callback. The production line renderer is already extracted
 * to src/render/productionLineRender.js, but it still requires the game
 * state and ctx. The Phaser layer wraps the call to enable RenderRegistry
 * gating and future replacement with Phaser GameObjects.
 *
 * API:
 *   Game.PhaserLayers.ProductionLine.init(config)
 *   Game.PhaserLayers.ProductionLine.update(state)
 *   Game.PhaserLayers.ProductionLine.draw(ctx)
 *   Game.PhaserLayers.ProductionLine.setDrawFn(fn)
 *   Game.PhaserLayers.ProductionLine.destroy()
 */
(function (global) {
  'use strict';

  /** @type {Function|null} legacy production line draw callback */
  var _drawFn = null;

  /**
   * Initialize the production line layer.
   * @param {Object} config
   * @param {Function} [config.drawFn] - callback that draws production line
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
    // Delegation layer — the draw callback accesses state directly
  }

  /**
   * Set or replace the legacy draw callback.
   * @param {Function} fn
   */
  function setDrawFn(fn) {
    if (typeof fn === 'function') _drawFn = fn;
  }

  /**
   * Draw the production line to the main canvas.
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
  global.Game.PhaserLayers.ProductionLine = {
    init: init,
    update: update,
    draw: draw,
    setDrawFn: setDrawFn,
    invalidate: invalidate,
    destroy: destroy,
  };
}(window));
