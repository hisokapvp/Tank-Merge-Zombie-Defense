(function (global) {
  'use strict';

  var GroundGen = global.Game && global.Game.GroundGen ? global.Game.GroundGen : null;

  function toInt(v, fallback) {
    return Number.isFinite(v) ? Math.max(1, Math.floor(v)) : fallback;
  }

  function normalizeCfg(cfg) {
    var tile = (cfg && cfg.tile) || {};
    var stamps = Array.isArray(cfg && cfg.stamps) ? cfg.stamps : [];
    var pieces = Array.isArray(cfg && cfg.pieces) ? cfg.pieces : [];
    return {
      tile: {
        w: toInt(tile.w, 16),
        h: toInt(tile.h, 16),
      },
      mode: cfg && cfg.mode === 'manual' ? 'manual' : 'procedural',
      fillMode: cfg && cfg.fillMode === 'stretch' ? 'stretch' : 'repeat',
      manual: cfg && cfg.manual ? cfg.manual : { anchor: 'center', grid: [] },
      procedural: cfg && cfg.procedural ? cfg.procedural : { seed: '0', weights: [] },
      stamps: stamps,
      pieces: pieces,
    };
  }

  function getSrcRect(cfg, frame) {
    var safeCfg = normalizeCfg(cfg);
    if (!frame) return null;
    if (Number.isFinite(frame.x) && Number.isFinite(frame.y) && Number.isFinite(frame.w) && Number.isFinite(frame.h)) {
      return {
        x: Math.floor(frame.x),
        y: Math.floor(frame.y),
        w: Math.max(1, Math.floor(frame.w)),
        h: Math.max(1, Math.floor(frame.h)),
      };
    }
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

  function resolveSpawnArea(area) {
    if (!area || typeof area !== 'object') return null;
    var type = typeof area.type === 'string' ? area.type.toLowerCase() : '';
    if (!type && Number.isFinite(area.r)) type = 'circle';
    if (!type && Number.isFinite(area.w) && Number.isFinite(area.h)) type = 'rect';

    if (type === 'circle') {
      var cx = Number.isFinite(area.cx) ? area.cx : (Number.isFinite(area.x) ? area.x : 0);
      var cy = Number.isFinite(area.cy) ? area.cy : (Number.isFinite(area.y) ? area.y : 0);
      var r = Number(area.r);
      if (!Number.isFinite(r) || r <= 0) return null;
      return { type: 'circle', cx: cx, cy: cy, r: r };
    }

    if (type === 'rect') {
      var x = Number(area.x);
      var y = Number(area.y);
      var w = Number(area.w);
      var h = Number(area.h);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
      return { type: 'rect', x: x, y: y, w: w, h: h };
    }
    return null;
  }

  function hash01(seedA, seedB, seedC) {
    if (GroundGen && typeof GroundGen.hash2 === 'function') {
      return GroundGen.hash2(seedA, seedB, seedC);
    }
    var s = String(seedA) + '|' + String(seedB) + '|' + String(seedC);
    var h = 2166136261 >>> 0;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return (h >>> 0) / 4294967296;
  }

  function pickSpawnPoint(area, centerX, centerY, seedA, seedB) {
    if (!area) return { x: centerX, y: centerY };
    var r1 = hash01(seedA, seedB, 17);
    var r2 = hash01(seedA, seedB, 31);
    if (area.type === 'rect') {
      return {
        x: centerX + area.x + r1 * area.w,
        y: centerY + area.y + r2 * area.h,
      };
    }
    var angle = r1 * Math.PI * 2;
    var dist = Math.sqrt(r2) * area.r;
    return {
      x: centerX + area.cx + Math.cos(angle) * dist,
      y: centerY + area.cy + Math.sin(angle) * dist,
    };
  }

  function collectStampSets(cfg) {
    var rawStamps = Array.isArray(cfg.stamps) && cfg.stamps.length ? cfg.stamps : (Array.isArray(cfg.pieces) ? cfg.pieces : []);
    var result = [];
    for (var i = 0; i < rawStamps.length; i++) {
      var st = rawStamps[i] || {};
      var items = Array.isArray(st.items) ? st.items : [];
      if (!items.length) continue;
      var parsedItems = [];
      for (var j = 0; j < items.length; j++) {
        var it = items[j] || {};
        if (!Number.isFinite(it.x) || !Number.isFinite(it.y) || !Number.isFinite(it.w) || !Number.isFinite(it.h)) continue;
        parsedItems.push({
          xg: Number.isFinite(it.xg) ? it.xg : 0,
          yg: Number.isFinite(it.yg) ? it.yg : 0,
          x: Math.floor(it.x),
          y: Math.floor(it.y),
          w: Math.max(1, Math.floor(it.w)),
          h: Math.max(1, Math.floor(it.h)),
          scale: Number.isFinite(it.scale) && it.scale > 0 ? it.scale : 1,
        });
      }
      if (!parsedItems.length) continue;
      result.push({
        id: typeof st.id === 'string' ? st.id : ('stamp_' + i),
        count: Number.isFinite(st.count) ? Math.max(0, Math.floor(st.count)) : 1,
        spawnArea: resolveSpawnArea(st.spawnArea),
        items: parsedItems,
      });
    }
    return result;
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

        var stampSets = collectStampSets(cfg);
        var centerX = Math.floor(viewW / 2);
        var centerY = Math.floor(viewH / 2);
        for (var si = 0; si < stampSets.length; si++) {
          var stamp = stampSets[si];
          for (var ci = 0; ci < stamp.count; ci++) {
            var spawnPoint = pickSpawnPoint(stamp.spawnArea, centerX, centerY, stamp.id, ci);
            for (var ii = 0; ii < stamp.items.length; ii++) {
              var item = stamp.items[ii];
              var drawW = Math.max(1, Math.round(item.w * item.scale));
              var drawH = Math.max(1, Math.round(item.h * item.scale));
              var drawX = Math.round(spawnPoint.x + item.xg - drawW * 0.5);
              var drawY = Math.round(spawnPoint.y + item.yg - drawH * 0.5);
              localCtx.drawImage(
                atlasImg,
                item.x,
                item.y,
                item.w,
                item.h,
                drawX,
                drawY,
                drawW,
                drawH
              );
            }
          }
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