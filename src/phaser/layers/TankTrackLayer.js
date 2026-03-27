/**
 * TankTrackPhaserLayer — Phaser layer module for the tank orbit track.
 *
 * Phase 2c: Renders the circular tank track with noise detail to an
 * offscreen canvas, then blits it. The track is static geometry that
 * only changes on viewport resize or balance recalculation.
 *
 * API:
 *   Game.PhaserLayers.TankTrack.init(config)
 *   Game.PhaserLayers.TankTrack.update(state)
 *   Game.PhaserLayers.TankTrack.draw(ctx)
 *   Game.PhaserLayers.TankTrack.invalidate()
 *   Game.PhaserLayers.TankTrack.destroy()
 */
(function (global) {
  'use strict';

  var _offscreen = null;
  var _offCtx = null;
  var _ready = false;

  // Cached config values
  var _centerX = 0;
  var _centerY = 0;
  var _orbitRadius = 250;
  var _trackWidth = 16;
  var _width = 0;
  var _height = 0;

  /**
   * Seeded noise — identical to game.js seededNoise.
   * @param {number} x
   * @param {number} y
   * @returns {number} 0..1
   */
  function seededNoise(x, y) {
    var s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return s - Math.floor(s);
  }

  /**
   * Initialize the tank track layer.
   * @param {Object} config
   * @param {Object} config.viewSize - { w, h }
   * @param {Object} config.center   - { x, y }
   * @param {number} config.orbitRadius
   * @param {number} config.trackWidth
   */
  function init(config) {
    config = config || {};
    var vs = config.viewSize || {};
    _width = vs.w || 1100;
    _height = vs.h || 650;
    var c = config.center || {};
    _centerX = c.x || _width / 2;
    _centerY = c.y || _height / 2;
    _orbitRadius = config.orbitRadius || 250;
    _trackWidth = config.trackWidth || 16;
    _ready = false;

    _offscreen = document.createElement('canvas');
    _offscreen.width = _width;
    _offscreen.height = _height;
    _offCtx = _offscreen.getContext('2d');
  }

  /**
   * Update track parameters from game state.
   * @param {Object} params
   * @param {Object} [params.center]
   * @param {number} [params.orbitRadius]
   * @param {number} [params.trackWidth]
   */
  function update(params) {
    if (!params) return;
    var changed = false;
    if (params.center) {
      if (params.center.x !== _centerX || params.center.y !== _centerY) {
        _centerX = params.center.x;
        _centerY = params.center.y;
        changed = true;
      }
    }
    if (Number.isFinite(params.orbitRadius) && params.orbitRadius !== _orbitRadius) {
      _orbitRadius = params.orbitRadius;
      changed = true;
    }
    if (Number.isFinite(params.trackWidth) && params.trackWidth !== _trackWidth) {
      _trackWidth = params.trackWidth;
      changed = true;
    }
    if (changed) _ready = false;
  }

  /**
   * Rebuild the offscreen track cache.
   */
  function rebuild() {
    if (!_offscreen || !_offCtx) return;

    if (_offscreen.width !== _width || _offscreen.height !== _height) {
      _offscreen.width = _width;
      _offscreen.height = _height;
    }

    var ctx = _offCtx;
    ctx.clearRect(0, 0, _width, _height);
    ctx.save();
    ctx.translate(_centerX, _centerY);

    // Main track arc
    ctx.beginPath();
    ctx.arc(0, 0, _orbitRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(106, 72, 40, .60)';
    ctx.lineWidth = _trackWidth * 2.2;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Outer edge
    ctx.beginPath();
    ctx.arc(0, 0, _orbitRadius + _trackWidth, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(155, 118, 76, .32)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Inner edge
    ctx.beginPath();
    ctx.arc(0, 0, _orbitRadius - _trackWidth, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(44, 28, 16, .35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Noise particles
    for (var i = 0; i < 120; i++) {
      var n = seededNoise(i * 17.3, i * 41.7);
      var angle = i * 0.35 + n * Math.PI * 0.8;
      var r = _orbitRadius + (n - 0.5) * _trackWidth * 1.4;
      var size = 2.2 + n * 3.2;
      var alpha = 0.18 + n * 0.28;
      ctx.fillStyle = 'rgba(90, 58, 30, ' + alpha + ')';
      ctx.beginPath();
      ctx.ellipse(
        Math.cos(angle) * r,
        Math.sin(angle) * r,
        size, size * 0.6,
        angle, 0, Math.PI * 2
      );
      ctx.fill();
    }

    ctx.restore();
    _ready = true;
  }

  /**
   * Draw the cached tank track to the main canvas.
   * @param {CanvasRenderingContext2D} ctx
   */
  function draw(ctx) {
    if (!_ready) rebuild();
    if (!_ready || !_offscreen) return;
    ctx.drawImage(_offscreen, 0, 0);
  }

  function invalidate() {
    _ready = false;
  }

  function resize(w, h) {
    _width = w || _width;
    _height = h || _height;
    if (_offscreen) {
      _offscreen.width = _width;
      _offscreen.height = _height;
    }
    invalidate();
  }

  function destroy() {
    _offscreen = null;
    _offCtx = null;
    _ready = false;
  }

  global.Game = global.Game || {};
  global.Game.PhaserLayers = global.Game.PhaserLayers || {};
  global.Game.PhaserLayers.TankTrack = {
    init: init,
    update: update,
    draw: draw,
    invalidate: invalidate,
    resize: resize,
    destroy: destroy,
  };
}(window));
