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
    var forcedSegmentsPerSide = Number.isFinite(opts.segmentsPerSide)
      ? Math.max(1, Math.floor(opts.segmentsPerSide))
      : null;

    var segments = [];
    if (!spriteKeys || !Number.isFinite(halfSide) || !Number.isFinite(fenceWidth)) return segments;

    var cornerTLFrame = getFrame(spriteKeys.cornerTL);
    var cornerTRFrame = getFrame(spriteKeys.cornerTR);
    var cornerBRFrame = getFrame(spriteKeys.cornerBR);
    var cornerBLFrame = getFrame(spriteKeys.cornerBL);

    function pushCorner(id, x, y, sideKey, spanStart, spanEnd) {
      segments.push({
        id: id,
        kind: id,
        sideKey: sideKey,
        sideIndex: null,
        x: x,
        y: y,
        spriteId: spriteKeys[id],
        isCorner: true,
        spanStart: spanStart,
        spanEnd: spanEnd,
        holeAabb: {
          minX: x - fenceWidth * 0.75,
          maxX: x + fenceWidth * 0.75,
          minY: y - fenceWidth * 0.75,
          maxY: y + fenceWidth * 0.75,
        },
      });
    }

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
      var sideKey = params.sideKey;
      var kind = params.kind;
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return;
      var sideFrame = getFrame(spriteId);
      var step = sideStepFor(sideFrame);
      var localSpan = end - start;
      var baseCount = Math.max(1, Math.floor(localSpan / Math.max(1, step)) + 1);
      var count = forcedSegmentsPerSide != null ? forcedSegmentsPerSide : Math.max(1, baseCount - 1);
      var segSpan = localSpan / count;
      for (var i = 0; i < count; i++) {
        var t = (i + 0.5) / count;
        var v = start + localSpan * t;
        var segStart = start + segSpan * i;
        var segEnd = segStart + segSpan;
        var sx = isHorizontal ? v : fixedValue;
        var sy = isHorizontal ? fixedValue : v;
        var halfW = isHorizontal ? segSpan * 0.5 : fenceWidth * 0.75;
        var halfH = isHorizontal ? fenceWidth * 0.75 : segSpan * 0.5;
        segments.push({
          id: kind + '#' + i,
          kind: kind,
          sideKey: sideKey,
          sideIndex: i,
          x: sx,
          y: sy,
          spriteId: spriteId,
          isCorner: false,
          spanStart: segStart,
          spanEnd: segEnd,
          holeAabb: {
            minX: sx - halfW,
            maxX: sx + halfW,
            minY: sy - halfH,
            maxY: sy + halfH,
          },
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

    pushCorner('cornerTL', -halfSide, -halfSide, 'top', -halfSide, topStart);
    pushCorner('cornerTR', halfSide, -halfSide, 'right', -halfSide, rightStart);
    pushCorner('cornerBR', halfSide, halfSide, 'bottom', bottomEnd, halfSide);
    pushCorner('cornerBL', -halfSide, halfSide, 'left', leftEnd, halfSide);

    addSide({ spriteId: spriteKeys.sideTop, fixedValue: -halfSide, start: topStart, end: topEnd, isHorizontal: true, sideKey: 'top', kind: 'sideTop' });
    addSide({ spriteId: spriteKeys.sideRight, fixedValue: halfSide, start: rightStart, end: rightEnd, isHorizontal: false, sideKey: 'right', kind: 'sideRight' });
    addSide({ spriteId: spriteKeys.sideBottom, fixedValue: halfSide, start: bottomStart, end: bottomEnd, isHorizontal: true, sideKey: 'bottom', kind: 'sideBottom' });
    addSide({ spriteId: spriteKeys.sideLeft, fixedValue: -halfSide, start: leftStart, end: leftEnd, isHorizontal: false, sideKey: 'left', kind: 'sideLeft' });

    return segments;
  }

  global.Game = global.Game || {};
  global.Game.FenceLayout = {
    buildSquareFenceSegments: buildSquareFenceSegments,
  };
})(typeof window !== 'undefined' ? window : this);
