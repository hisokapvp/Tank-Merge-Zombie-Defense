/**
 * Расчёт безопасной геометрии ангара/треков относительно canvas.
 */
(function (global) {
  'use strict';

  function toNumber(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
  }

  function getLayoutTuning(globalObj) {
    var tuning = globalObj
      && globalObj.Game
      && globalObj.Game.Config
      && globalObj.Game.Config.LayoutTuning;
    return {
      trackToHangarGapPx: Math.max(0, toNumber(tuning && tuning.trackToHangarGapPx, 5)),
      trackToFenceGapPx: Math.max(0, toNumber(tuning && tuning.trackToFenceGapPx, 5)),
    };
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
    var trackPad = toNumber(input && input.trackPad, 18);
    var minTankOrbitRadius = Math.max(1, toNumber(input && input.minTankOrbitRadius, 110));
    var minFenceRadius = Math.max(0, toNumber(input && input.minFenceRadius, 0));
    var zombieTrackWidth = Math.max(1, toNumber(input && input.zombieTrackWidth, 14));
    var tuning = getLayoutTuning(global);

    var halfDiag = Math.hypot(boardW * 0.5, boardH * 0.5);
    var minSafeTankOrbit = Math.max(minTankOrbitRadius, halfDiag + hangarPad + tankTrackWidth * 0.5);
    var tankOrbitRadius = Math.max(minSafeTankOrbit, minSafeTankOrbit + tuning.trackToHangarGapPx);
    var fenceRadius = tankOrbitRadius + tankTrackWidth * 0.5 + tuning.trackToFenceGapPx + fenceWidth * 0.5;
    if (minFenceRadius > 0 && fenceRadius < minFenceRadius) {
      fenceRadius = minFenceRadius;
      tankOrbitRadius = Math.max(minSafeTankOrbit, fenceRadius - (tankTrackWidth * 0.5 + tuning.trackToFenceGapPx + fenceWidth * 0.5));
      fenceRadius = tankOrbitRadius + tankTrackWidth * 0.5 + tuning.trackToFenceGapPx + fenceWidth * 0.5;
      if (fenceRadius < minFenceRadius) fenceRadius = minFenceRadius;
    }
    var zombieTrackRadius = fenceRadius + fenceWidth * 0.5 + trackPad + zombieTrackWidth * 0.5;

    var minCanvas = Math.min(viewW, viewH);
    var maxOuter = Math.max(40, minCanvas * (0.5 - marginRatio));
    var currentOuter = zombieTrackRadius + zombieTrackWidth * 0.5;
    if (currentOuter > maxOuter) {
      var overflow = currentOuter - maxOuter;
      tankOrbitRadius = Math.max(minSafeTankOrbit, tankOrbitRadius - overflow);
      fenceRadius = tankOrbitRadius + tankTrackWidth * 0.5 + tuning.trackToFenceGapPx + fenceWidth * 0.5;
      if (minFenceRadius > 0 && fenceRadius < minFenceRadius) {
        fenceRadius = minFenceRadius;
        tankOrbitRadius = Math.max(minSafeTankOrbit, fenceRadius - (tankTrackWidth * 0.5 + tuning.trackToFenceGapPx + fenceWidth * 0.5));
      }
      zombieTrackRadius = fenceRadius + fenceWidth * 0.5 + trackPad + zombieTrackWidth * 0.5;
      var afterOuter = zombieTrackRadius + zombieTrackWidth * 0.5;
      if (afterOuter > maxOuter && typeof console !== 'undefined' && console.warn) {
        console.warn('[HangarLayout] Layout does not fit in canvas; applying maximum possible size.', {
          maxOuter: maxOuter,
          requestedOuter: afterOuter,
          minFenceRadius: minFenceRadius,
        });
      }
    }

    return {
      tankOrbitRadius: tankOrbitRadius,
      fenceRadius: fenceRadius,
      zombieTrackRadius: zombieTrackRadius,
      gapHangarToTrack: (tankOrbitRadius - tankTrackWidth * 0.5) - (halfDiag + hangarPad),
      gapTrackToFence: (fenceRadius - fenceWidth * 0.5) - (tankOrbitRadius + tankTrackWidth * 0.5),
    };
  }

  global.Game = global.Game || {};
  global.Game.HangarLayout = {
    computeHangarTrackLayout: computeHangarTrackLayout,
  };
})(typeof window !== 'undefined' ? window : this);
