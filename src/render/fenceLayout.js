(function (global) {
  'use strict';

  function frameScale(frame) {
    return Number.isFinite(frame && frame.scale) ? frame.scale : 1;
  }

  function buildSquareFenceSegments(options) {
    var opts = options || {};
    var halfSide = opts.halfSide;
    var fenceWidth = opts.fenceWidth;
    var spriteKeys = opts.spriteKeys;
    var getFrame = typeof opts.getFrame === 'function' ? opts.getFrame : function () { return null; };
    var cornerInsetPxOverride = opts.cornerInsetPxOverride;

    var segments = [];
    if (!spriteKeys || !Number.isFinite(halfSide) || !Number.isFinite(fenceWidth)) return segments;

    var cornerTLFrame = getFrame(spriteKeys.cornerTL);
    var cornerTRFrame = getFrame(spriteKeys.cornerTR);
    var cornerBRFrame = getFrame(spriteKeys.cornerBR);
    var cornerBLFrame = getFrame(spriteKeys.cornerBL);

    segments.push({ x: -halfSide, y: -halfSide, spriteId: spriteKeys.cornerTL, isCorner: true });
    segments.push({ x: halfSide, y: -halfSide, spriteId: spriteKeys.cornerTR, isCorner: true });
    segments.push({ x: halfSide, y: halfSide, spriteId: spriteKeys.cornerBR, isCorner: true });
    segments.push({ x: -halfSide, y: halfSide, spriteId: spriteKeys.cornerBL, isCorner: true });

    function cornerInsetFor(frameA, frameB) {
      if (Number.isFinite(cornerInsetPxOverride)) {
        return Math.max(0, cornerInsetPxOverride);
      }
      var scaleA = frameScale(frameA);
      var scaleB = frameScale(frameB);
      var cornerScale = Math.max(scaleA, scaleB);
      return Math.max(4, fenceWidth * 0.65) * cornerScale;
    }

    function sideStepFor(frame) {
      return Math.max(6, fenceWidth * 1.15) * frameScale(frame);
    }

    function addSide(params) {
      var spriteId = params.spriteId;
      var fixedValue = params.fixedValue;
      var start = params.start;
      var end = params.end;
      var isHorizontal = params.isHorizontal;
      var sideFrame = getFrame(spriteId);
      var step = sideStepFor(sideFrame);
      var localSpan = Math.max(0, end - start);
      var count = Math.max(1, Math.floor(localSpan / step) + 1);
      for (var i = 0; i < count; i++) {
        var t = count === 1 ? 0.5 : i / (count - 1);
        var v = start + localSpan * t;
        segments.push({
          x: isHorizontal ? v : fixedValue,
          y: isHorizontal ? fixedValue : v,
          spriteId: spriteId,
          isCorner: false,
        });
      }
    }

    var topStart = -halfSide + cornerInsetFor(cornerTLFrame, cornerTRFrame);
    var topEnd = halfSide - cornerInsetFor(cornerTRFrame, cornerTLFrame);
    var rightStart = -halfSide + cornerInsetFor(cornerTRFrame, cornerBRFrame);
    var rightEnd = halfSide - cornerInsetFor(cornerBRFrame, cornerTRFrame);
    var bottomStart = -halfSide + cornerInsetFor(cornerBLFrame, cornerBRFrame);
    var bottomEnd = halfSide - cornerInsetFor(cornerBRFrame, cornerBLFrame);
    var leftStart = -halfSide + cornerInsetFor(cornerTLFrame, cornerBLFrame);
    var leftEnd = halfSide - cornerInsetFor(cornerBLFrame, cornerTLFrame);

    addSide({ spriteId: spriteKeys.sideTop, fixedValue: -halfSide, start: topStart, end: topEnd, isHorizontal: true });
    addSide({ spriteId: spriteKeys.sideRight, fixedValue: halfSide, start: rightStart, end: rightEnd, isHorizontal: false });
    addSide({ spriteId: spriteKeys.sideBottom, fixedValue: halfSide, start: bottomStart, end: bottomEnd, isHorizontal: true });
    addSide({ spriteId: spriteKeys.sideLeft, fixedValue: -halfSide, start: leftStart, end: leftEnd, isHorizontal: false });

    return segments;
  }

  global.Game = global.Game || {};
  global.Game.FenceLayout = {
    buildSquareFenceSegments: buildSquareFenceSegments,
  };
})(typeof window !== 'undefined' ? window : this);
