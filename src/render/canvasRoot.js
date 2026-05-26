/**
 * Инициализация canvas#c, resize, DPR scaling, viewport.
 */
(function (global) {
  'use strict';

  var BASE_W = 1100;
  var BASE_H = 650;

  /**
   * @param {HTMLCanvasElement} canvas
   * @returns {{ ctx: CanvasRenderingContext2D, viewport: { w: number, h: number, dpr: number } }}
   */
  function initCanvas(canvas) {
    if (!canvas) return { ctx: null, viewport: { w: BASE_W, h: BASE_H, dpr: 1 } };
    var ctx = canvas.getContext('2d');
    var dpr = getDpr();
    
    var displayW = canvas.width || BASE_W;
    var displayH = canvas.height || BASE_H;
    
    canvas.style.width = displayW + 'px';
    canvas.style.height = displayH + 'px';
    canvas.width = Math.floor(displayW * dpr);
    canvas.height = Math.floor(displayH * dpr);
    
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
    }
    
    var viewport = { w: displayW, h: displayH, dpr: dpr };
    return { ctx: ctx, viewport: viewport };
  }

  function getDpr() {
    return Math.min(global.devicePixelRatio || 1, 2);
  }

  function syncDomCanvasResolution(canvas) {
    if (!canvas) {
      return { width: 0, height: 0, logicalWidth: 0, logicalHeight: 0, dpr: getDpr() };
    }
    var rect = typeof canvas.getBoundingClientRect === 'function' ? canvas.getBoundingClientRect() : null;
    var logicalWidth = rect && rect.width > 0 ? rect.width : (canvas.clientWidth || canvas.width || 0);
    var logicalHeight = rect && rect.height > 0 ? rect.height : (canvas.clientHeight || canvas.height || 0);
    var dpr = getDpr();
    var pixelWidth = Math.max(1, Math.round(logicalWidth * dpr));
    var pixelHeight = Math.max(1, Math.round(logicalHeight * dpr));

    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;

    return {
      width: canvas.width,
      height: canvas.height,
      logicalWidth: logicalWidth,
      logicalHeight: logicalHeight,
      dpr: dpr,
    };
  }

  /**
   * Resize canvas: CSS-габариты + внутренние размеры = CSS * DPR.
   * @param {HTMLCanvasElement} canvas
   * @param {{ w: number, h: number }} containerSize — размер контейнера (stageCanvas)
   * @param {{ w: number, h: number }} baseSize — логический размер (BASE_W, BASE_H)
   * @returns {{ w: number, h: number, dpr: number }}
   */
  function resizeCanvas(canvas, containerSize, baseSize) {
    if (!canvas) return { w: baseSize.w, h: baseSize.h, dpr: getDpr() };
    var base = baseSize || { w: BASE_W, h: BASE_H };
    var maxW = Math.max(200, containerSize.width || base.w);
    var maxH = Math.max(200, containerSize.height || base.h);
    var scale = Math.min(maxW / base.w, maxH / base.h);
    var displayW = Math.max(200, Math.floor(base.w * scale));
    var displayH = Math.max(200, Math.floor(base.h * scale));
    var dpr = getDpr();

    canvas.style.width = displayW + 'px';
    canvas.style.height = displayH + 'px';
    canvas.width = Math.floor(displayW * dpr);
    canvas.height = Math.floor(displayH * dpr);

    var ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
    }

    return { w: displayW, h: displayH, dpr: dpr };
  }

  global.Game = global.Game || {};
  global.Game.CanvasRoot = {
    initCanvas: initCanvas,
    resizeCanvas: resizeCanvas,
    syncDomCanvasResolution: syncDomCanvasResolution,
    getDpr: getDpr,
    BASE_W: BASE_W,
    BASE_H: BASE_H,
  };
})(typeof window !== 'undefined' ? window : this);
