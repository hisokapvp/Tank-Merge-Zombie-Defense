(function (global) {
  'use strict';

  function getSideByPosition(x, y, centerX, centerY) {
    var cx = Number.isFinite(centerX) ? centerX : 0;
    var cy = Number.isFinite(centerY) ? centerY : 0;
    var dx = (Number.isFinite(x) ? x : cx) - cx;
    var dy = (Number.isFinite(y) ? y : cy) - cy;
    if (Math.abs(dy) > Math.abs(dx)) return dy >= 0 ? 'bottom' : 'top';
    return dx >= 0 ? 'right' : 'left';
  }

  global.Game = global.Game || {};
  global.Game.FenceSides = {
    getSideByPosition: getSideByPosition,
  };
})(typeof window !== 'undefined' ? window : this);
