/**
 * BackgroundPhaserLayer — Phaser layer module for the background/ground.
 *
 * Phase 2c: Renders the ground tiles and stamps to an offscreen canvas,
 * then blits it to the main ctx. This mirrors the legacy groundLayer
 * approach but lives in the Phaser layer system for lifecycle management.
 *
 * When the layer is set to 'phaser' in RenderRegistry, draw() is called
 * from game.js draw() at the background z-position.
 *
 * API:
 *   Game.PhaserLayers.Background.init(config)
 *   Game.PhaserLayers.Background.update(state)
 *   Game.PhaserLayers.Background.draw(ctx)
 *   Game.PhaserLayers.Background.invalidate()
 *   Game.PhaserLayers.Background.destroy()
 */
(function (global) {
  'use strict';

  var _offscreen = null;
  var _offCtx = null;
  var _ready = false;
  var _width = 0;
  var _height = 0;

  // Cached references from config/state
  var _groundLayer = null;
  var _backgroundLayer = null;
  var _groundSprites = null;

  /**
   * Initialize the background layer.
   * @param {Object} config
   * @param {Object} config.viewSize - { w, h }
   * @param {Object} [config.groundLayer] - legacy groundLayer reference
   * @param {Object} [config.backgroundLayer] - legacy backgroundLayer reference
   * @param {Object} [config.groundSprites] - GroundSprites reference
   */
  function init(config) {
    config = config || {};
    var vs = config.viewSize || {};
    _width = vs.w || 1100;
    _height = vs.h || 650;
    _groundLayer = config.groundLayer || null;
    _backgroundLayer = config.backgroundLayer || null;
    _groundSprites = config.groundSprites || null;
    _ready = false;

    // Create offscreen canvas for caching
    _offscreen = document.createElement('canvas');
    _offscreen.width = _width;
    _offscreen.height = _height;
    _offCtx = _offscreen.getContext('2d');
  }

  /**
   * Update references from game state.
   * @param {Object} state
   */
  function update(state) {
    // No per-frame state needed — background is static.
    // Rebuild is triggered by invalidate() or resize.
  }

  /**
   * Rebuild the offscreen background cache.
   * Called when viewport changes or ground config changes.
   */
  function rebuild() {
    if (!_offscreen || !_offCtx) return;

    // Resize offscreen if needed
    if (_offscreen.width !== _width || _offscreen.height !== _height) {
      _offscreen.width = _width;
      _offscreen.height = _height;
    }

    // Attempt 1: use legacy groundLayer (it handles tiles + stamps)
    if (_groundLayer && _groundLayer.ready && typeof _groundLayer.draw === 'function') {
      _offCtx.clearRect(0, 0, _width, _height);
      var drew = _groundLayer.draw(_offCtx);
      if (drew) {
        _ready = true;
        return;
      }
    }

    // Attempt 2: use legacy backgroundLayer canvas
    if (_backgroundLayer && _backgroundLayer.ready && _backgroundLayer.canvas) {
      _offCtx.clearRect(0, 0, _width, _height);
      _offCtx.drawImage(_backgroundLayer.canvas, 0, 0);
      _ready = true;
      return;
    }

    // Attempt 3: fallback gradient (matches legacy drawBackground)
    _offCtx.clearRect(0, 0, _width, _height);
    var g = _offCtx.createLinearGradient(0, 0, 0, _height);
    g.addColorStop(0, '#2f7a3d');
    g.addColorStop(1, '#6b4a2c');
    _offCtx.fillStyle = g;
    _offCtx.fillRect(0, 0, _width, _height);
    _ready = true;
  }

  /**
   * Draw the cached background to the main canvas context.
   * @param {CanvasRenderingContext2D} ctx
   */
  function draw(ctx) {
    if (!_ready) rebuild();
    if (!_ready || !_offscreen) return;
    ctx.drawImage(_offscreen, 0, 0);
  }

  /**
   * Invalidate the cached background (triggers rebuild on next draw).
   */
  function invalidate() {
    _ready = false;
  }

  /**
   * Resize the layer for a new viewport.
   * @param {number} w
   * @param {number} h
   */
  function resize(w, h) {
    _width = w || _width;
    _height = h || _height;
    invalidate();
  }

  /**
   * Update external references (groundLayer, backgroundLayer).
   * @param {Object} refs
   */
  function setRefs(refs) {
    if (!refs) return;
    if (refs.groundLayer !== undefined) _groundLayer = refs.groundLayer;
    if (refs.backgroundLayer !== undefined) _backgroundLayer = refs.backgroundLayer;
    if (refs.groundSprites !== undefined) _groundSprites = refs.groundSprites;
  }

  function destroy() {
    _offscreen = null;
    _offCtx = null;
    _ready = false;
    _groundLayer = null;
    _backgroundLayer = null;
    _groundSprites = null;
  }

  global.Game = global.Game || {};
  global.Game.PhaserLayers = global.Game.PhaserLayers || {};
  global.Game.PhaserLayers.Background = {
    init: init,
    update: update,
    draw: draw,
    invalidate: invalidate,
    resize: resize,
    setRefs: setRefs,
    destroy: destroy,
  };
}(window));
