(function (global) {
  'use strict';

  var FENCE_DRAW_SCALE_MULT = 1.2;
  var FENCE_SEAM_OVERLAP_PX = 1;
  var FENCE_RESPONSIVE_SEAM_BREAKPOINT_PX = 1400;

  function frameScale(frame) {
    return Number.isFinite(frame && frame.scale) ? frame.scale : 1;
  }

  function frameRotationDeg(frame) {
    if (!frame) return 0;
    if (Number.isFinite(frame.rotation)) return frame.rotation;
    if (Number.isFinite(frame.rotationDeg)) return frame.rotationDeg;
    return 0;
  }

  function frameAnchor(frame) {
    var anchor = frame && frame.anchor;
    var ax = Number.isFinite(anchor && anchor.x) ? anchor.x : 0.5;
    var ay = Number.isFinite(anchor && anchor.y) ? anchor.y : 0.5;
    return { x: ax, y: ay };
  }

  function frameWorldMetrics(frame, fenceWidth) {
    var sourceW = Number.isFinite(frame && frame.w) ? frame.w : 128;
    var sourceH = Number.isFinite(frame && frame.h) ? frame.h : 128;
    var drawScale = (fenceWidth / Math.max(1, Math.max(sourceW, sourceH))) * FENCE_DRAW_SCALE_MULT * frameScale(frame);
    var drawW = sourceW * drawScale;
    var drawH = sourceH * drawScale;
    var anchor = frameAnchor(frame);
    var x0 = -drawW * anchor.x;
    var x1 = drawW * (1 - anchor.x);
    var y0 = -drawH * anchor.y;
    var y1 = drawH * (1 - anchor.y);
    var rotationRad = frameRotationDeg(frame) * Math.PI / 180;
    var cosR = Math.cos(rotationRad);
    var sinR = Math.sin(rotationRad);

    function rotatePoint(px, py) {
      return {
        x: px * cosR - py * sinR,
        y: px * sinR + py * cosR,
      };
    }

    var p0 = rotatePoint(x0, y0);
    var p1 = rotatePoint(x1, y0);
    var p2 = rotatePoint(x1, y1);
    var p3 = rotatePoint(x0, y1);

    var minX = Math.min(p0.x, p1.x, p2.x, p3.x);
    var maxX = Math.max(p0.x, p1.x, p2.x, p3.x);
    var minY = Math.min(p0.y, p1.y, p2.y, p3.y);
    var maxY = Math.max(p0.y, p1.y, p2.y, p3.y);

    return {
      left: -minX,
      right: maxX,
      up: -minY,
      down: maxY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  function buildAabbAt(x, y, metrics) {
    return {
      minX: x - metrics.left,
      maxX: x + metrics.right,
      minY: y - metrics.up,
      maxY: y + metrics.down,
    };
  }

  function positiveGap(a, b) {
    return Math.max(0, b - a);
  }

  function resolveViewportWidth(opts) {
    var fromOptions = Number(opts && opts.viewportWidth);
    if (Number.isFinite(fromOptions) && fromOptions > 0) return fromOptions;
    var fromGlobal = Number(global && global.innerWidth);
    if (Number.isFinite(fromGlobal) && fromGlobal > 0) return fromGlobal;
    return 0;
  }

  function resolveSeamOverlapPx(viewportWidth, fenceWidth) {
    if (!(viewportWidth > 0) || viewportWidth >= FENCE_RESPONSIVE_SEAM_BREAKPOINT_PX) {
      return FENCE_SEAM_OVERLAP_PX;
    }
    var responsiveRatio = Math.min(1, Math.max(0, (FENCE_RESPONSIVE_SEAM_BREAKPOINT_PX - viewportWidth) / 600));
    var maxExtraOverlap = Math.max(2, Math.min(4, (Number(fenceWidth) || 0) * 0.16));
    return FENCE_SEAM_OVERLAP_PX + responsiveRatio * maxExtraOverlap;
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

    function pushCorner(id, x, y, sideKey, spanStart, spanEnd, metrics) {
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
        holeAabb: buildAabbAt(x, y, metrics),
      });
    }

    function sideStepFor(frame) {
      return Math.max(6, fenceWidth * 1.15) * frameScale(frame);
    }

    function addSide(params) {
      var spriteId = params.spriteId;
      var isHorizontal = params.isHorizontal;
      var sideKey = params.sideKey;
      var kind = params.kind;
      var startEdge = params.startEdge;
      var endEdge = params.endEdge;
      var fixedValue = params.fixedValue;
      if (!Number.isFinite(startEdge) || !Number.isFinite(endEdge) || endEdge <= startEdge) return [];
      var sideFrame = getFrame(spriteId);
      var sideMetrics = frameWorldMetrics(sideFrame, fenceWidth);
      var step = sideStepFor(sideFrame);
      var localSpan = endEdge - startEdge;
      var baseCount = Math.max(1, Math.floor(localSpan / Math.max(1, step)) + 1);
      var count = forcedSegmentsPerSide != null ? forcedSegmentsPerSide : Math.max(1, baseCount - 1);
      var centerStart = isHorizontal ? startEdge + sideMetrics.left : startEdge + sideMetrics.up;
      var centerEnd = isHorizontal ? endEdge - sideMetrics.right : endEdge - sideMetrics.down;
      if (centerEnd < centerStart) {
        var centerMid = (centerStart + centerEnd) * 0.5;
        centerStart = centerMid;
        centerEnd = centerMid;
      }
      var centerSpan = centerEnd - centerStart;
      var edgeSegSpan = localSpan / count;
      var created = [];
      for (var i = 0; i < count; i++) {
        var t = count <= 1 ? 0.5 : (i / (count - 1));
        var v = centerStart + centerSpan * t;
        var segStart = startEdge + edgeSegSpan * i;
        var segEnd = segStart + edgeSegSpan;
        var sx = isHorizontal ? v : fixedValue;
        var sy = isHorizontal ? fixedValue : v;
        var segment = {
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
          holeAabb: buildAabbAt(sx, sy, sideMetrics),
        };
        segments.push(segment);
        created.push(segment);
      }
      return created;
    }

    function cornerBasePosition(id) {
      switch (id) {
        case 'cornerTL': return { x: -halfSide, y: -halfSide };
        case 'cornerTR': return { x: halfSide, y: -halfSide };
        case 'cornerBR': return { x: halfSide, y: halfSide };
        case 'cornerBL': return { x: -halfSide, y: halfSide };
        default: return { x: 0, y: 0 };
      }
    }

    var cornerManualInset = Number.isFinite(cornerInsetPxOverride) ? cornerInsetPxOverride : 0;
    var cornerInsetShift = -cornerManualInset;
    var cornerBase = {
      cornerTL: cornerBasePosition('cornerTL'),
      cornerTR: cornerBasePosition('cornerTR'),
      cornerBR: cornerBasePosition('cornerBR'),
      cornerBL: cornerBasePosition('cornerBL'),
    };
    var cornerFinal = {
      cornerTL: { x: cornerBase.cornerTL.x + cornerInsetShift, y: cornerBase.cornerTL.y + cornerInsetShift },
      cornerTR: { x: cornerBase.cornerTR.x - cornerInsetShift, y: cornerBase.cornerTR.y + cornerInsetShift },
      cornerBR: { x: cornerBase.cornerBR.x - cornerInsetShift, y: cornerBase.cornerBR.y - cornerInsetShift },
      cornerBL: { x: cornerBase.cornerBL.x + cornerInsetShift, y: cornerBase.cornerBL.y - cornerInsetShift },
    };

    var cornerMetrics = {
      cornerTL: frameWorldMetrics(cornerTLFrame, fenceWidth),
      cornerTR: frameWorldMetrics(cornerTRFrame, fenceWidth),
      cornerBR: frameWorldMetrics(cornerBRFrame, fenceWidth),
      cornerBL: frameWorldMetrics(cornerBLFrame, fenceWidth),
    };

    var seamOverlap = resolveSeamOverlapPx(resolveViewportWidth(opts), fenceWidth);
    var topStartEdge = cornerFinal.cornerTL.x + cornerMetrics.cornerTL.right - seamOverlap;
    var topEndEdge = cornerFinal.cornerTR.x - cornerMetrics.cornerTR.left + seamOverlap;
    var rightStartEdge = cornerFinal.cornerTR.y + cornerMetrics.cornerTR.down - seamOverlap;
    var rightEndEdge = cornerFinal.cornerBR.y - cornerMetrics.cornerBR.up + seamOverlap;
    var bottomStartEdge = cornerFinal.cornerBL.x + cornerMetrics.cornerBL.right - seamOverlap;
    var bottomEndEdge = cornerFinal.cornerBR.x - cornerMetrics.cornerBR.left + seamOverlap;
    var leftStartEdge = cornerFinal.cornerTL.y + cornerMetrics.cornerTL.down - seamOverlap;
    var leftEndEdge = cornerFinal.cornerBL.y - cornerMetrics.cornerBL.up + seamOverlap;

    var topFixedY = (cornerFinal.cornerTL.y + cornerFinal.cornerTR.y) * 0.5;
    var rightFixedX = (cornerFinal.cornerTR.x + cornerFinal.cornerBR.x) * 0.5;
    var bottomFixedY = (cornerFinal.cornerBL.y + cornerFinal.cornerBR.y) * 0.5;
    var leftFixedX = (cornerFinal.cornerTL.x + cornerFinal.cornerBL.x) * 0.5;

    pushCorner('cornerTL', cornerFinal.cornerTL.x, cornerFinal.cornerTL.y, 'top', -halfSide, topStartEdge, cornerMetrics.cornerTL);
    pushCorner('cornerTR', cornerFinal.cornerTR.x, cornerFinal.cornerTR.y, 'right', -halfSide, rightStartEdge, cornerMetrics.cornerTR);
    pushCorner('cornerBR', cornerFinal.cornerBR.x, cornerFinal.cornerBR.y, 'bottom', bottomEndEdge, halfSide, cornerMetrics.cornerBR);
    pushCorner('cornerBL', cornerFinal.cornerBL.x, cornerFinal.cornerBL.y, 'left', leftEndEdge, halfSide, cornerMetrics.cornerBL);

    var topSide = addSide({ spriteId: spriteKeys.sideTop, fixedValue: topFixedY, startEdge: topStartEdge, endEdge: topEndEdge, isHorizontal: true, sideKey: 'top', kind: 'sideTop' });
    var rightSide = addSide({ spriteId: spriteKeys.sideRight, fixedValue: rightFixedX, startEdge: rightStartEdge, endEdge: rightEndEdge, isHorizontal: false, sideKey: 'right', kind: 'sideRight' });
    var bottomSide = addSide({ spriteId: spriteKeys.sideBottom, fixedValue: bottomFixedY, startEdge: bottomStartEdge, endEdge: bottomEndEdge, isHorizontal: true, sideKey: 'bottom', kind: 'sideBottom' });
    var leftSide = addSide({ spriteId: spriteKeys.sideLeft, fixedValue: leftFixedX, startEdge: leftStartEdge, endEdge: leftEndEdge, isHorizontal: false, sideKey: 'left', kind: 'sideLeft' });

    function pickBoundary(sideList, atEnd) {
      if (!Array.isArray(sideList) || sideList.length === 0) return null;
      return atEnd ? sideList[sideList.length - 1] : sideList[0];
    }

    var byId = {};
    for (var idx = 0; idx < segments.length; idx++) {
      byId[segments[idx].id] = segments[idx];
    }

    function gapHorizontal(cornerSeg, sideSeg, cornerOnRight) {
      if (!cornerSeg || !sideSeg || !cornerSeg.holeAabb || !sideSeg.holeAabb) return 0;
      return cornerOnRight
        ? positiveGap(sideSeg.holeAabb.maxX, cornerSeg.holeAabb.minX)
        : positiveGap(cornerSeg.holeAabb.maxX, sideSeg.holeAabb.minX);
    }

    function gapVertical(cornerSeg, sideSeg, cornerOnBottom) {
      if (!cornerSeg || !sideSeg || !cornerSeg.holeAabb || !sideSeg.holeAabb) return 0;
      return cornerOnBottom
        ? positiveGap(sideSeg.holeAabb.maxY, cornerSeg.holeAabb.minY)
        : positiveGap(cornerSeg.holeAabb.maxY, sideSeg.holeAabb.minY);
    }

    var gapChecks = [
      gapHorizontal(byId.cornerTL, pickBoundary(topSide, false), false),
      gapHorizontal(byId.cornerTR, pickBoundary(topSide, true), true),
      gapHorizontal(byId.cornerBL, pickBoundary(bottomSide, false), false),
      gapHorizontal(byId.cornerBR, pickBoundary(bottomSide, true), true),
      gapVertical(byId.cornerTL, pickBoundary(leftSide, false), false),
      gapVertical(byId.cornerBL, pickBoundary(leftSide, true), true),
      gapVertical(byId.cornerTR, pickBoundary(rightSide, false), false),
      gapVertical(byId.cornerBR, pickBoundary(rightSide, true), true),
    ];

    var maxGap = 0;
    for (var gi = 0; gi < gapChecks.length; gi++) {
      maxGap = Math.max(maxGap, gapChecks[gi]);
    }
    if (maxGap > 0.5 && typeof console !== 'undefined' && console && typeof console.warn === 'function') {
      console.warn('Fence gap', maxGap);
    }

    return segments;
  }

  global.Game = global.Game || {};
  global.Game.FenceLayout = {
    buildSquareFenceSegments: buildSquareFenceSegments,
  };
})(typeof window !== 'undefined' ? window : this);
