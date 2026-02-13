(function (global) {
  'use strict';

  var GroundGen = global.Game && global.Game.GroundGen ? global.Game.GroundGen : null;

  function toInt(v, fallback) {
    return Number.isFinite(v) ? Math.max(1, Math.floor(v)) : fallback;
  }

  function normalizeCfg(cfg) {
    var tile = (cfg && cfg.tile) || {};
    return {
      tile: {
        w: toInt(tile.w, 16),
        h: toInt(tile.h, 16),
      },
      mode: cfg && cfg.mode === 'manual' ? 'manual' : 'procedural',
      fillMode: cfg && cfg.fillMode === 'stretch' ? 'stretch' : 'repeat',
      manual: cfg && cfg.manual ? cfg.manual : { anchor: 'center', grid: [] },
      procedural: cfg && cfg.procedural ? cfg.procedural : { seed: '0', weights: [] },
    };
  }

  function getSrcRect(cfg, frame) {
    var safeCfg = normalizeCfg(cfg);
    if (!frame) return null;
    var col = Number(frame.col);
    var row = Number(frame.row);
    if (!Number.isFinite(col) || !Number.isFinite(row)) return null;
    var tw = safeCfg.tile.w;
    var th = safeCfg.tile.h;
    return {
      x: Math.floor(col) * tw,
      y: Math.floor(row) * th,
      w: tw,
      h: th,
    };
  }

  function computeRanges(viewW, viewH, tileW, tileH) {
    var centerX = Math.floor(viewW / 2);
    var centerY = Math.floor(viewH / 2);
    var halfW = Math.floor(tileW / 2);
    var halfH = Math.floor(tileH / 2);

    var minTx = Math.floor((-centerX + halfW) / tileW) - 1;
    var maxTx = Math.ceil((viewW - centerX + halfW) / tileW) + 1;
    var minTy = Math.floor((-centerY + halfH) / tileH) - 1;
    var maxTy = Math.ceil((viewH - centerY + halfH) / tileH) + 1;

    return {
      centerX: centerX,
      centerY: centerY,
      minTx: minTx,
      maxTx: maxTx,
      minTy: minTy,
      maxTy: maxTy,
      countX: Math.max(1, maxTx - minTx + 1),
      countY: Math.max(1, maxTy - minTy + 1),
    };
  }

  function computeLayout(cfg, viewW, viewH) {
    var safeCfg = normalizeCfg(cfg);
    var tw = safeCfg.tile.w;
    var th = safeCfg.tile.h;
    var ranges = computeRanges(viewW, viewH, tw, th);
    var placements = [];

    var tx;
    var ty;
    if (safeCfg.fillMode === 'repeat') {
      for (ty = ranges.minTy; ty <= ranges.maxTy; ty++) {
        var y = ranges.centerY + ty * th - Math.floor(th / 2);
        for (tx = ranges.minTx; tx <= ranges.maxTx; tx++) {
          var x = ranges.centerX + tx * tw - Math.floor(tw / 2);
          var right = x + tw;
          var bottom = y + th;
          if (right <= 0 || x >= viewW || bottom <= 0 || y >= viewH) continue;
          placements.push({ tileX: tx, tileY: ty, x: x, y: y, w: tw, h: th });
        }
      }
      return placements;
    }

    var maxAbsX = Math.max(Math.abs(ranges.minTx), Math.abs(ranges.maxTx));
    var maxAbsY = Math.max(Math.abs(ranges.minTy), Math.abs(ranges.maxTy));
    var stretchCountX = Math.max(1, maxAbsX * 2 + 1);
    var stretchCountY = Math.max(1, maxAbsY * 2 + 1);

    for (var yi = 0; yi < stretchCountY; yi++) {
      var y0 = Math.round((yi * viewH) / stretchCountY);
      var y1 = Math.round(((yi + 1) * viewH) / stretchCountY);
      var dy = y1 - y0;
      ty = -maxAbsY + yi;
      for (var xi = 0; xi < stretchCountX; xi++) {
        var x0 = Math.round((xi * viewW) / stretchCountX);
        var x1 = Math.round(((xi + 1) * viewW) / stretchCountX);
        var dx = x1 - x0;
        tx = -maxAbsX + xi;
        placements.push({ tileX: tx, tileY: ty, x: x0, y: y0, w: dx, h: dy });
      }
    }
    return placements;
  }

  function createGroundLayer() {
    return {
      canvas: null,
      ctx: null,
      ready: false,
      error: '',
      width: 0,
      height: 0,
      invalidate: function () {
        this.ready = false;
        this.error = '';
      },
      rebuild: function (params) {
        var opts = params || {};
        var atlasImg = opts.atlasImg;
        var cfg = normalizeCfg(opts.cfg || {});
        var viewW = toInt(opts.width, 0);
        var viewH = toInt(opts.height, 0);

        if (!atlasImg || !viewW || !viewH) {
          this.invalidate();
          return;
        }
        if (!GroundGen || typeof GroundGen.getTileAt !== 'function') {
          this.ready = false;
          this.error = 'GroundGen unavailable';
          return;
        }

        var canvas = document.createElement('canvas');
        canvas.width = viewW;
        canvas.height = viewH;
        var localCtx = canvas.getContext('2d');
        localCtx.imageSmoothingEnabled = false;

        var placements = computeLayout(cfg, viewW, viewH);
        for (var i = 0; i < placements.length; i++) {
          var place = placements[i];
          var tile = GroundGen.getTileAt(cfg, place.tileX, place.tileY);
          if (!tile || !tile.frame) continue;
          var src = getSrcRect(cfg, tile.frame);
          if (!src) continue;

          var rotationDeg = Number.isFinite(tile.rotationDeg) ? tile.rotationDeg : 0;
          var rotationRad = (rotationDeg * Math.PI) / 180;
          var scale = Number.isFinite(tile.scale) && tile.scale > 0 ? tile.scale : 1;

          var centerX = place.x + Math.floor(place.w / 2);
          var centerY = place.y + Math.floor(place.h / 2);
          var drawW = Math.max(1, Math.round(place.w * scale));
          var drawH = Math.max(1, Math.round(place.h * scale));

          localCtx.save();
          localCtx.translate(centerX, centerY);
          localCtx.rotate(rotationRad);
          localCtx.drawImage(
            atlasImg,
            src.x,
            src.y,
            src.w,
            src.h,
            -Math.floor(drawW / 2),
            -Math.floor(drawH / 2),
            drawW,
            drawH
          );
          localCtx.restore();
        }

        this.canvas = canvas;
        this.ctx = localCtx;
        this.width = viewW;
        this.height = viewH;
        this.ready = true;
        this.error = '';
      },
      draw: function (targetCtx) {
        if (!this.ready || !this.canvas || !targetCtx) return false;
        targetCtx.imageSmoothingEnabled = false;
        targetCtx.drawImage(this.canvas, 0, 0);
        return true;
      },
    };
  }

  global.Game = global.Game || {};
  global.Game.GroundLayer = {
    createGroundLayer: createGroundLayer,
    computeLayout: computeLayout,
    getSrcRect: getSrcRect,
  };
})(typeof window !== 'undefined' ? window : this);