/**
 * Унификация mouse/touch → координаты canvas (viewport).
 */
(function (global) {
  'use strict';

  /**
   * Получить координаты точки в системе canvas (логические, с учётом DPR уже применён в ctx).
   * @param {PointerEvent | MouseEvent | TouchEvent} evt
   * @param {HTMLCanvasElement} canvas
   * @param {{ w: number, h: number }} viewport — логические размеры (displayW, displayH)
   * @returns {{ x: number, y: number }}
   */
  function getCanvasPoint(evt, canvas, viewport) {
    if (!canvas) return { x: 0, y: 0 };
    var r = canvas.getBoundingClientRect();
    var clientX = evt.clientX != null ? evt.clientX : (evt.touches && evt.touches[0] ? evt.touches[0].clientX : 0);
    var clientY = evt.clientY != null ? evt.clientY : (evt.touches && evt.touches[0] ? evt.touches[0].clientY : 0);
    var vw = viewport && viewport.w != null ? viewport.w : canvas.width;
    var vh = viewport && viewport.h != null ? viewport.h : canvas.height;
    var scaleX = r.width ? vw / r.width : 1;
    var scaleY = r.height ? vh / r.height : 1;
    var x = (clientX - r.left) * scaleX;
    var y = (clientY - r.top) * scaleY;
    return { x: x, y: y };
  }

  /**
   * Подписаться на pointer/mouse/touch и вызывать handler с getCanvasPoint(evt, canvas, viewport).
   * @param {HTMLCanvasElement} canvas
   * @param {{ w: number, h: number }} viewport — функция, возвращающая текущий viewport
   * @param {{ pointerdown?: function, pointerup?: function, pointermove?: function }} handlers
   */
  function attachInput(canvas, getViewport, handlers) {
    if (!canvas) return;
    function dispatch(type, evt) {
      var viewport = typeof getViewport === 'function' ? getViewport() : getViewport;
      var point = getCanvasPoint(evt, canvas, viewport);
      var fn = handlers[type];
      if (fn) fn(point, evt);
    }
    canvas.addEventListener('pointerdown', function (e) { dispatch('pointerdown', e); });
    canvas.addEventListener('pointerup', function (e) { dispatch('pointerup', e); });
    canvas.addEventListener('pointermove', function (e) { dispatch('pointermove', e); });
    canvas.addEventListener('pointercancel', function (e) { dispatch('pointerup', e); });
  }

  global.Game = global.Game || {};
  global.Game.Input = {
    getCanvasPoint: getCanvasPoint,
    attachInput: attachInput,
  };
})(typeof window !== 'undefined' ? window : this);
