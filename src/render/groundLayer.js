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

  function makeRect(x, y, w, h) {
    return {
      x: Math.round(x),
      y: Math.round(y),
      w: Math.max(1, Math.round(w)),
      h: Math.max(1, Math.round(h)),
    };
  }

  function itemDrawRect(spawnPoint, item) {
    var drawW = Math.max(1, Math.round(item.w * item.scale));
    var drawH = Math.max(1, Math.round(item.h * item.scale));
    var drawX = Math.round(spawnPoint.x + item.xg - drawW * 0.5);
    var drawY = Math.round(spawnPoint.y + item.yg - drawH * 0.5);
    return makeRect(drawX, drawY, drawW, drawH);
  }

  function rectsOverlap(a, b) {
    return a.x < (b.x + b.w) && (a.x + a.w) > b.x && a.y < (b.y + b.h) && (a.y + a.h) > b.y;
  }

  function isOccupied(rect, occupiedRects) {
    for (var i = 0; i < occupiedRects.length; i++) {
      if (rectsOverlap(rect, occupiedRects[i])) return true;
    }
    return false;
  }

  function areAnyRectsOccupied(rects, occupiedRects) {
    for (var i = 0; i < rects.length; i++) {
      if (isOccupied(rects[i], occupiedRects)) return true;
    }
    return false;
  }

  function unionRects(rects) {
    if (!Array.isArray(rects) || !rects.length) return null;
    var minX = rects[0].x;
    var minY = rects[0].y;
    var maxX = rects[0].x + rects[0].w;
    var maxY = rects[0].y + rects[0].h;
    for (var i = 1; i < rects.length; i++) {
      var r = rects[i];
      if (r.x < minX) minX = r.x;
      if (r.y < minY) minY = r.y;
      if ((r.x + r.w) > maxX) maxX = r.x + r.w;
      if ((r.y + r.h) > maxY) maxY = r.y + r.h;
    }
    return makeRect(minX, minY, maxX - minX, maxY - minY);
  }

  function collectStampSets(cfg) {
    var rawStamps = Array.isArray(cfg.stamps) && cfg.stamps.length ? cfg.stamps : (Array.isArray(cfg.pieces) ? cfg.pieces : []);
    var defaultAttempts = Number.isFinite(cfg.stampPlacementMaxAttempts) ? Math.max(1, Math.floor(cfg.stampPlacementMaxAttempts)) : 24;
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
        mode: st.mode === 'variants' ? 'variants' : 'composite',
        count: Number.isFinite(st.count) ? Math.max(0, Math.floor(st.count)) : 1,
        maxPlacementAttempts: Number.isFinite(st.maxPlacementAttempts) ? Math.max(1, Math.floor(st.maxPlacementAttempts)) : defaultAttempts,
        spawnArea: resolveSpawnArea(st.spawnArea),
        items: parsedItems,
      });
    }
    return result;
  }

  function buildVariantPlacementOrder(stamp) {
    var count = Number.isFinite(stamp && stamp.count) ? Math.max(0, Math.floor(stamp.count)) : 0;
    var variants = Array.isArray(stamp && stamp.items) ? stamp.items.length : 0;
    if (count <= 0 || variants <= 0) return [];

    var counts = new Array(variants);
    for (var i = 0; i < variants; i++) counts[i] = 0;

    var assigned = 0;
    if (count >= variants) {
      for (i = 0; i < variants; i++) {
        counts[i] = 1;
      }
      assigned = variants;
    }

    var remaining = count - assigned;
    for (i = 0; i < remaining; i++) {
      var pick = Math.floor(hash01(stamp.id, 'variant-count', i + 1) * variants);
      if (pick < 0) pick = 0;
      if (pick >= variants) pick = variants - 1;
      counts[pick] += 1;
    }

    var order = new Array(count);
    var cursor = 0;
    for (i = 0; i < variants; i++) {
      for (var n = 0; n < counts[i]; n++) {
        order[cursor++] = i;
      }
    }

    for (var j = order.length - 1; j > 0; j--) {
      var rnd = hash01(stamp.id, 'variant-shuffle', j);
      var k = Math.floor(rnd * (j + 1));
      if (k < 0) k = 0;
      if (k > j) k = j;
      var tmp = order[j];
      order[j] = order[k];
      order[k] = tmp;
    }

    return order;
  }

  function estimateStampRequestArea(items) {
    if (!Array.isArray(items) || !items.length) return 0;
    var total = 0;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!it) continue;
      var w = Math.max(1, Math.round(it.w * it.scale));
      var h = Math.max(1, Math.round(it.h * it.scale));
      total += w * h;
    }
    return total;
  }

  function buildStampRequests(stampSets) {
    var requests = [];
    var requestedTotal = 0;

    for (var si = 0; si < stampSets.length; si++) {
      var stamp = stampSets[si];
      if (!stamp) continue;
      var maxAttempts = Number.isFinite(stamp.maxPlacementAttempts) ? Math.max(1, stamp.maxPlacementAttempts) : 24;
      if (stamp.mode === 'variants') {
        var order = buildVariantPlacementOrder(stamp);
        for (var vi = 0; vi < order.length; vi++) {
          var variantIdx = order[vi];
          var variantItem = stamp.items[variantIdx];
          if (!variantItem) continue;
          requests.push({
            stampId: stamp.id,
            requestKey: 'v' + vi,
            spawnArea: stamp.spawnArea,
            maxAttempts: maxAttempts,
            items: [variantItem],
            requestArea: estimateStampRequestArea([variantItem]),
          });
          requestedTotal += 1;
        }
        continue;
      }

      for (var ci = 0; ci < stamp.count; ci++) {
        requests.push({
          stampId: stamp.id,
          requestKey: 'c' + ci,
          spawnArea: stamp.spawnArea,
          maxAttempts: maxAttempts,
          items: stamp.items,
          requestArea: estimateStampRequestArea(stamp.items),
        });
        requestedTotal += 1;
      }
    }

    requests.sort(function (a, b) {
      var areaDelta = a.requestArea - b.requestArea;
      if (areaDelta !== 0) return areaDelta;
      return a.stampId < b.stampId ? -1 : (a.stampId > b.stampId ? 1 : 0);
    });

    return {
      requests: requests,
      requestedTotal: requestedTotal,
    };
  }

  function pickSpawnPointByRatios(area, centerX, centerY, angle01, dist01) {
    if (!area) return { x: centerX, y: centerY };
    if (area.type === 'rect') {
      return {
        x: centerX + area.x + angle01 * area.w,
        y: centerY + area.y + dist01 * area.h,
      };
    }
    var angle = angle01 * Math.PI * 2;
    var dist = Math.sqrt(dist01) * area.r;
    return {
      x: centerX + area.cx + Math.cos(angle) * dist,
      y: centerY + area.cy + Math.sin(angle) * dist,
    };
  }

  function tryPlaceStampRequest(request, centerX, centerY, occupiedRects) {
    var maxAttempts = Number.isFinite(request.maxAttempts) ? Math.max(1, request.maxAttempts) : 24;
    for (var attempt = 0; attempt < maxAttempts; attempt++) {
      var spawn = pickSpawnPoint(request.spawnArea, centerX, centerY, request.stampId, request.requestKey + '|' + attempt);
      var itemRects = [];
      for (var i = 0; i < request.items.length; i++) {
        itemRects.push(itemDrawRect(spawn, request.items[i]));
      }
      if (areAnyRectsOccupied(itemRects, occupiedRects)) continue;
      return { itemRects: itemRects, usedFallback: false };
    }

    var fallbackAttempts = Math.max(12, maxAttempts);
    for (var fa = 0; fa < fallbackAttempts; fa++) {
      var angle01 = (hash01(request.stampId, request.requestKey, 'faA|' + fa) + (fa * 0.3819660112501051)) % 1;
      var dist01 = (hash01(request.stampId, request.requestKey, 'faR|' + fa) + (fa * 0.6180339887498948)) % 1;
      var fallbackSpawn = pickSpawnPointByRatios(request.spawnArea, centerX, centerY, angle01, dist01);
      var fallbackRects = [];
      for (var fi = 0; fi < request.items.length; fi++) {
        fallbackRects.push(itemDrawRect(fallbackSpawn, request.items[fi]));
      }
      if (areAnyRectsOccupied(fallbackRects, occupiedRects)) continue;
      return { itemRects: fallbackRects, usedFallback: true };
    }

    return null;
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
      stampPlacementStats: { requestedTotal: 0, placedTotal: 0, coverage: 1 },
      width: 0,
      height: 0,
      invalidate: function () {
        this.ready = false;
        this.error = '';
        this.stampPlacementStats = { requestedTotal: 0, placedTotal: 0, coverage: 1 };
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
        var tileDrawList = [];
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

          tileDrawList.push({
            srcX: src.x,
            srcY: src.y,
            srcW: src.w,
            srcH: src.h,
            centerX: centerX,
            centerY: centerY,
            drawW: drawW,
            drawH: drawH,
            rotationRad: rotationRad,
          });
        }

        for (i = 0; i < tileDrawList.length; i++) {
          var tileDraw = tileDrawList[i];
          localCtx.save();
          localCtx.translate(tileDraw.centerX, tileDraw.centerY);
          localCtx.rotate(tileDraw.rotationRad);
          localCtx.drawImage(
            atlasImg,
            tileDraw.srcX,
            tileDraw.srcY,
            tileDraw.srcW,
            tileDraw.srcH,
            -Math.floor(tileDraw.drawW / 2),
            -Math.floor(tileDraw.drawH / 2),
            tileDraw.drawW,
            tileDraw.drawH
          );
          localCtx.restore();
        }

        var stampSets = collectStampSets(cfg);
        var centerX = Math.floor(viewW / 2);
        var centerY = Math.floor(viewH / 2);
        var occupiedRects = [];
        var stampReqPack = buildStampRequests(stampSets);
        var stampRequests = stampReqPack.requests;
        var requestedTotal = stampReqPack.requestedTotal;
        var placedTotal = 0;
        var stampDrawList = [];

        for (var si = 0; si < stampRequests.length; si++) {
          var request = stampRequests[si];
          var placement = tryPlaceStampRequest(request, centerX, centerY, occupiedRects);
          if (!placement || !Array.isArray(placement.itemRects)) continue;
          for (var ii = 0; ii < request.items.length; ii++) {
            var item = request.items[ii];
            var drawRect = placement.itemRects[ii];
            if (!item || !drawRect) continue;
            stampDrawList.push({
              srcX: item.x,
              srcY: item.y,
              srcW: item.w,
              srcH: item.h,
              dstX: drawRect.x,
              dstY: drawRect.y,
              dstW: drawRect.w,
              dstH: drawRect.h,
            });
            occupiedRects.push(drawRect);
          }
          placedTotal += 1;
        }

        for (i = 0; i < stampDrawList.length; i++) {
          var stampDraw = stampDrawList[i];
          localCtx.drawImage(
            atlasImg,
            stampDraw.srcX,
            stampDraw.srcY,
            stampDraw.srcW,
            stampDraw.srcH,
            stampDraw.dstX,
            stampDraw.dstY,
            stampDraw.dstW,
            stampDraw.dstH
          );
        }

        var coverage = requestedTotal > 0 ? (placedTotal / requestedTotal) : 1;
        this.stampPlacementStats = {
          requestedTotal: requestedTotal,
          placedTotal: placedTotal,
          coverage: coverage,
        };

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