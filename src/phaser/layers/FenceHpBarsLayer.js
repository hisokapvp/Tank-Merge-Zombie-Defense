/**
 * FenceHpBarsPhaserLayer — Phaser layer module for fence segment HP bars.
 *
 * Phase 2c: Renders health bars above damaged fence segments.
 * This is a dynamic layer that reads fence segment state each frame.
 *
 * API:
 *   Game.PhaserLayers.FenceHpBars.init(config)
 *   Game.PhaserLayers.FenceHpBars.update(state)
 *   Game.PhaserLayers.FenceHpBars.draw(ctx)
 *   Game.PhaserLayers.FenceHpBars.destroy()
 */
(function (global) {
  'use strict';

  // Cached config
  var _centerX = 0;
  var _centerY = 0;
  var _hpBarW = 28;
  var _hpBarH = 4;
  var _hpBarOffsetY = -24;

  // Cached state reference
  var _fenceSegments = null;

  /**
   * Clamp value between min and max.
   */
  function clamp(v, lo, hi) {
    return v < lo ? lo : (v > hi ? hi : v);
  }

  /**
   * Initialize the fence HP bars layer.
   * @param {Object} config
   * @param {Object} config.center      - { x, y }
   * @param {Object} [config.hpBarConfig] - { w, h, offsetY }
   */
  function init(config) {
    config = config || {};
    var c = config.center || {};
    _centerX = c.x || 0;
    _centerY = c.y || 0;
    var bar = config.hpBarConfig || {};
    _hpBarW = Number.isFinite(bar.w) ? Math.max(8, bar.w) : 28;
    _hpBarH = Number.isFinite(bar.h) ? Math.max(2, bar.h) : 4;
    _hpBarOffsetY = Number.isFinite(bar.offsetY) ? bar.offsetY : -24;
  }

  /**
   * Update state references each frame.
   * @param {Object} params
   * @param {Array}  params.fenceSegments
   * @param {Object} [params.center]
   * @param {Object} [params.hpBarConfig]
   */
  function update(params) {
    if (!params) return;
    _fenceSegments = params.fenceSegments || null;
    if (params.center) {
      _centerX = params.center.x;
      _centerY = params.center.y;
    }
    if (params.hpBarConfig) {
      var bar = params.hpBarConfig;
      _hpBarW = Number.isFinite(bar.w) ? Math.max(8, bar.w) : _hpBarW;
      _hpBarH = Number.isFinite(bar.h) ? Math.max(2, bar.h) : _hpBarH;
      _hpBarOffsetY = Number.isFinite(bar.offsetY) ? bar.offsetY : _hpBarOffsetY;
    }
  }

  /**
   * Draw fence HP bars to the main canvas.
   * @param {CanvasRenderingContext2D} ctx
   */
  function draw(ctx) {
    if (!Array.isArray(_fenceSegments) || !_fenceSegments.length) return;

    var hasVisible = false;
    for (var j = 0; j < _fenceSegments.length; j++) {
      var s = _fenceSegments[j];
      if (!s) continue;
      if (s.hp < s.maxHp) { hasVisible = true; break; }
      if (Number.isFinite(s.shieldHp) && s.shieldHp > 0) { hasVisible = true; break; }
    }
    if (!hasVisible) return;

    ctx.save();
    ctx.translate(_centerX, _centerY);

    for (var i = 0; i < _fenceSegments.length; i++) {
      var seg = _fenceSegments[i];
      if (!seg) continue;
      var damaged = seg.hp < seg.maxHp;
      var hasShield = Number.isFinite(seg.shieldHp) && seg.shieldHp > 0
        && Number.isFinite(seg.shieldHpMax) && seg.shieldHpMax > 0;
      if (!damaged && !hasShield) continue;

      var barX = Math.round(seg.x - _hpBarW * 0.5);
      var barY = Math.round(seg.y + _hpBarOffsetY);

      if (damaged) {
        var ratio = clamp(seg.hp / Math.max(1, seg.maxHp), 0, 1);
        var greenWidth = Math.round(_hpBarW * ratio);

        // Background
        ctx.fillStyle = 'rgba(72,72,72,0.95)';
        ctx.fillRect(barX, barY, _hpBarW, _hpBarH);

        // Green health portion
        if (greenWidth > 0) {
          ctx.fillStyle = 'rgba(125,255,178,0.95)';
          ctx.fillRect(barX, barY, greenWidth, _hpBarH);
        }
      }

      // Cumulative-shield (def_shield v3): yellow bar above HP bar.
      // Visible only when seg.shieldHp > 0; width scales by shieldHp / shieldHpMax.
      if (hasShield) {
        var shieldRatio = clamp(seg.shieldHp / Math.max(1, seg.shieldHpMax), 0, 1);
        var shieldWidth = Math.round(_hpBarW * shieldRatio);
        var shieldY = barY - _hpBarH - 2;
        if (shieldWidth > 0) {
          ctx.fillStyle = 'rgba(255,224,102,0.95)';
          ctx.fillRect(barX, shieldY, shieldWidth, _hpBarH);
        }
      }
    }

    ctx.restore();
  }

  function invalidate() {
    // Dynamic layer — no cache to invalidate
  }

  function destroy() {
    _fenceSegments = null;
  }

  global.Game = global.Game || {};
  global.Game.PhaserLayers = global.Game.PhaserLayers || {};
  global.Game.PhaserLayers.FenceHpBars = {
    init: init,
    update: update,
    draw: draw,
    invalidate: invalidate,
    destroy: destroy,
  };
}(window));
