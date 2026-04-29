(function (global) {
  'use strict';

  function clamp(value, min, max) {
    if (!Number.isFinite(value)) return min;
    if (value < min) return min;
    if (value > max) return max;
    return value;
  }

  function roundedRectPath(ctx, x, y, w, h, r) {
    var radius = Math.max(0, Math.min(r, w * 0.5, h * 0.5));
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function getSeed(x, y, w, h, customSeed) {
    if (Number.isFinite(customSeed)) return Math.floor(customSeed) >>> 0;
    var ix = Math.floor(x) | 0;
    var iy = Math.floor(y) | 0;
    var iw = Math.floor(w) | 0;
    var ih = Math.floor(h) | 0;
    return ((ix * 73856093) ^ (iy * 19349663) ^ (iw * 83492791) ^ (ih * 2654435761)) >>> 0;
  }

  function drawStaticSpeckles(ctx, x, y, w, h, seed) {
    var rowStart = Math.floor(y) - 2;
    var rowEnd = y + h + 2;
    var colStart = Math.floor(x) - 2;
    var colEnd = x + w + 2;

    ctx.fillStyle = 'rgba(255,245,226,0.18)';
    for (var gy = rowStart; gy < rowEnd; gy += 3) {
      var rowSeed = (seed ^ ((gy + 17) * 374761393)) >>> 0;
      var jitter = (rowSeed % 5) - 2;
      for (var gx = colStart; gx < colEnd; gx += 5) {
        var sample = (rowSeed ^ ((gx + 29) * 668265263)) >>> 0;
        if ((sample & 3) !== 0) continue;
        ctx.fillRect(gx + jitter, gy + ((sample >>> 3) & 1), 1 + ((sample >>> 1) & 1), 1);
      }
    }

    ctx.fillStyle = 'rgba(118,58,0,0.15)';
    for (var gy2 = rowStart + 1; gy2 < rowEnd; gy2 += 5) {
      var rowSeed2 = (seed ^ ((gy2 + 53) * 1597334677)) >>> 0;
      var jitter2 = (rowSeed2 % 7) - 3;
      for (var gx2 = colStart; gx2 < colEnd; gx2 += 7) {
        var sample2 = (rowSeed2 ^ ((gx2 + 71) * 2246822519)) >>> 0;
        if ((sample2 & 7) > 1) continue;
        ctx.fillRect(gx2 + jitter2, gy2, 1, 1);
      }
    }
  }

  function drawScanlines(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(255,236,204,0.15)';
    for (var lineY = Math.floor(y) + 1; lineY < y + h; lineY += 4) {
      ctx.fillRect(x, lineY, w, 1);
    }
  }

  function draw(targetCtx, x, y, w, h, r, options) {
    if (!targetCtx || !Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return;
    var opts = options && typeof options === 'object' ? options : null;
    var radius = Number.isFinite(r) ? Math.max(0, r) : 0;
    var baseAlpha = clamp(opts && opts.baseAlpha, 0, 1);
    var brightAlpha = clamp(opts && opts.brightAlpha, 0, 1);
    var darkAlpha = clamp(opts && opts.darkAlpha, 0, 1);
    var borderAlpha = clamp(opts && opts.borderAlpha, 0, 1);
    var seed = getSeed(x, y, w, h, opts && opts.seed);

    if (!Number.isFinite(baseAlpha)) baseAlpha = 0.5;
    if (!Number.isFinite(brightAlpha)) brightAlpha = 0.17;
    if (!Number.isFinite(darkAlpha)) darkAlpha = 0.16;
    if (!Number.isFinite(borderAlpha)) borderAlpha = 0.78;

    targetCtx.save();
    roundedRectPath(targetCtx, x, y, w, h, radius);
    targetCtx.clip();

    targetCtx.fillStyle = 'rgba(255,152,0,' + baseAlpha + ')';
    targetCtx.fillRect(x, y, w, h);

    drawScanlines(targetCtx, x, y, w, h);
    drawStaticSpeckles(targetCtx, x, y, w, h, seed);

    targetCtx.fillStyle = 'rgba(255,243,216,' + brightAlpha + ')';
    targetCtx.fillRect(x, y, w, Math.max(1, h * 0.34));
    targetCtx.fillStyle = 'rgba(120,60,0,' + darkAlpha + ')';
    targetCtx.fillRect(x, y + h * 0.56, w, Math.max(1, h * 0.44));

    targetCtx.strokeStyle = 'rgba(255,216,156,' + borderAlpha + ')';
    targetCtx.lineWidth = 1;
    roundedRectPath(targetCtx, x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1), Math.max(1, radius - 1));
    targetCtx.stroke();
    targetCtx.restore();
  }

  global.Game = global.Game || {};
  global.Game.SlotActivityOverlay = {
    draw: draw,
  };
})(typeof window !== 'undefined' ? window : this);