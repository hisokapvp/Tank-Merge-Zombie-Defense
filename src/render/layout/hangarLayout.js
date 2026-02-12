/**
 * Расчёт безопасной геометрии ангара/треков относительно canvas.
 */
(function (global) {
  'use strict';

  function toNumber(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
  }

  function computeHangarTrackLayout(input) {
    var boardW = Math.max(1, toNumber(input && input.boardW, 1));
    var boardH = Math.max(1, toNumber(input && input.boardH, 1));
    var viewW = Math.max(1, toNumber(input && input.viewW, 1));
    var viewH = Math.max(1, toNumber(input && input.viewH, 1));

    var tankTrackWidth = Math.max(1, toNumber(input && input.tankTrackWidth, 16));
    var fenceWidth = Math.max(1, toNumber(input && input.fenceWidth, 20));
    var marginRatio = Math.max(0, toNumber(input && input.marginRatio, 0.06));

    var hangarPad = toNumber(input && input.hangarPad, 12);
    var orbitPad = Math.max(10, toNumber(input && input.orbitPad, 24 + tankTrackWidth));
    var fencePad = toNumber(input && input.fencePad, 24);
    var trackPad = toNumber(input && input.trackPad, 18);
    var minTankOrbitRadius = Math.max(1, toNumber(input && input.minTankOrbitRadius, 110));
    var zombieTrackWidth = Math.max(1, toNumber(input && input.zombieTrackWidth, 14));

    var halfDiag = Math.hypot(boardW * 0.5, boardH * 0.5);
    var tankOrbitRadius = Math.max(minTankOrbitRadius, halfDiag + hangarPad + orbitPad);
    var fenceRadius = tankOrbitRadius + fencePad;
    var zombieTrackRadius = fenceRadius + fenceWidth + trackPad;

    var minCanvas = Math.min(viewW, viewH);
    var maxOuter = Math.max(40, minCanvas * (0.5 - marginRatio));
    var currentOuter = zombieTrackRadius + zombieTrackWidth * 0.5;
    if (currentOuter > maxOuter) {
      var overflow = currentOuter - maxOuter;
      var minSafeTankOrbit = halfDiag + hangarPad + Math.max(6, tankTrackWidth * 0.6);
      tankOrbitRadius = Math.max(minSafeTankOrbit, tankOrbitRadius - overflow);
      fenceRadius = tankOrbitRadius + fencePad;
      zombieTrackRadius = fenceRadius + fenceWidth + trackPad;
    }

    return {
      tankOrbitRadius: tankOrbitRadius,
      fenceRadius: fenceRadius,
      zombieTrackRadius: zombieTrackRadius,
    };
  }

  global.Game = global.Game || {};
  global.Game.HangarLayout = {
    computeHangarTrackLayout: computeHangarTrackLayout,
  };
})(typeof window !== 'undefined' ? window : this);
