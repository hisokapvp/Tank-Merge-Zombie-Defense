/**
 * EveningDimPhaserLayer — Phaser layer module for attack mode evening dimming.
 *
 * Phase 2c: Renders the semi-transparent dark overlay during attack mode.
 * This is a dynamic layer driven by worldEventsState.eveningDimBlend
 * and the attack config's eveningDimAlpha.
 *
 * API:
 *   Game.PhaserLayers.EveningDim.init(config)
 *   Game.PhaserLayers.EveningDim.update(state)
 *   Game.PhaserLayers.EveningDim.draw(ctx)
 *   Game.PhaserLayers.EveningDim.destroy()
 */
(function (global) {
  'use strict';

  var _width = 0;
  var _height = 0;
  var _alpha = 0;

  function clamp(v, lo, hi) {
    return v < lo ? lo : (v > hi ? hi : v);
  }

  /**
   * Initialize the evening dim layer.
   * @param {Object} config
   * @param {Object} config.viewSize - { w, h }
   */
  function init(config) {
    config = config || {};
    var vs = config.viewSize || {};
    _width = vs.w || 1100;
    _height = vs.h || 650;
    _alpha = 0;
  }

  /**
   * Update the dim alpha from game state.
   * @param {Object} params
   * @param {number} params.baseAlpha - attackCfg.eveningDimAlpha
   * @param {number} params.blend     - worldEventsState.eveningDimBlend
   * @param {Object} [params.viewSize]
   */
  function update(params) {
    if (!params) return;
    var baseAlpha = Number.isFinite(params.baseAlpha) ? clamp(params.baseAlpha, 0, 1) : 0;
    var blend = Number.isFinite(params.blend) ? clamp(params.blend, 0, 1) : 0;
    _alpha = baseAlpha * blend;
    if (params.viewSize) {
      _width = params.viewSize.w || _width;
      _height = params.viewSize.h || _height;
    }
  }

  /**
   * Draw the dimming overlay.
   * @param {CanvasRenderingContext2D} ctx
   */
  function draw(ctx) {
    if (_alpha <= 0) return;
    ctx.save();
    ctx.fillStyle = 'rgba(22,24,34,' + _alpha + ')';
    ctx.fillRect(0, 0, _width, _height);
    ctx.restore();
  }

  function invalidate() {
    // Dynamic — no cache
  }

  function destroy() {
    _alpha = 0;
  }

  global.Game = global.Game || {};
  global.Game.PhaserLayers = global.Game.PhaserLayers || {};
  global.Game.PhaserLayers.EveningDim = {
    init: init,
    update: update,
    draw: draw,
    invalidate: invalidate,
    destroy: destroy,
  };
}(window));
