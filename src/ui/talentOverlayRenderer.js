(function (global) {
  'use strict';

  function toFixedNumber(value) {
    var numeric = Number(value);
    return Number.isFinite(numeric) ? numeric.toFixed(2) : '0.00';
  }

  function hashEdgeSeed(branchId, parentLocalIdx, childLocalIdx) {
    var text = String(branchId || '');
    var hash = 2166136261;
    for (var i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    hash ^= (parentLocalIdx + 1) * 131;
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    hash ^= (childLocalIdx + 1) * 197;
    return Math.abs(hash >>> 0);
  }

  function getNodeAnchorPoint(button, gridRect) {
    if (!button || !gridRect || typeof button.getBoundingClientRect !== 'function') return null;
    var anchor = typeof button.querySelector === 'function'
      ? button.querySelector('.talentNodeIcon')
      : null;
    var rect = anchor && typeof anchor.getBoundingClientRect === 'function'
      ? anchor.getBoundingClientRect()
      : button.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: rect.left + rect.width / 2 - gridRect.left,
      y: rect.top + rect.height / 2 - gridRect.top,
    };
  }

  function buildEdgePath(fromX, fromY, toX, toY, options) {
    var opts = options || {};
    var deltaX = toX - fromX;
    var gapY = Math.max(0, toY - fromY);
    var emphasis = Number.isFinite(opts.emphasis) ? Math.max(0.9, opts.emphasis) : 1;
    var waveBoost = Number.isFinite(opts.waveBoost) ? Math.max(0, opts.waveBoost) : 0;
    var direction = deltaX === 0 ? 1 : (deltaX > 0 ? 1 : -1);
    var bend = Math.max(18, Math.min(62, (Math.abs(deltaX) * 0.4 + gapY * 0.19) * emphasis + 8 + waveBoost));
    var control1X = fromX + direction * Math.max(6, bend * 0.22);
    var control1Y = fromY + Math.max(14, Math.min(42, gapY * (0.34 + emphasis * 0.06) + 10 + waveBoost * 0.22));
    var control2X = toX - direction * Math.max(10, bend * 0.96);
    var control2Y = toY - Math.max(14, Math.min(38, gapY * (0.27 + emphasis * 0.05) + 8 + waveBoost * 0.16));

    if (Math.abs(deltaX) < 8) {
      control1X = fromX + direction * Math.max(4, bend * 0.16);
      control2X = toX - direction * Math.max(4, bend * 0.16);
    }

    return 'M ' + fromX + ' ' + fromY
      + ' C ' + control1X + ' ' + control1Y
      + ', ' + control2X + ' ' + control2Y
      + ', ' + toX + ' ' + toY;
  }

  function applyEdgeMotion(path, branchId, parentLocalIdx, childLocalIdx, fromX, toX, motionScale) {
    if (!path || !path.style || typeof path.style.setProperty !== 'function') return;
    var scale = Number.isFinite(motionScale) ? Math.max(0.7, motionScale) : 1;
    var seed = hashEdgeSeed(branchId, parentLocalIdx, childLocalIdx);
    var biasX = ((seed % 3) - 1) * 1.02;
    if (biasX === 0) biasX = toX >= fromX ? 1.08 : -1.08;
    var biasY = -0.56 - ((seed % 4) * 0.11);
    var activeMotion = scale >= 1;
    var waveDuration = activeMotion
      ? (0.74 + (seed % 7) * 0.05)
      : (1.48 + (seed % 7) * 0.11);
    var wobbleDuration = activeMotion
      ? (0.26 + (seed % 5) * 0.03)
      : (0.34 + (seed % 5) * 0.04);
    var auraDuration = waveDuration * (activeMotion ? 1.08 : 1.22);
    var phaseOffset = -0.09 * ((seed % 13) + ((seed >>> 4) % 5) * 0.35);
    biasX *= scale;
    biasY *= scale;
    path.style.setProperty('--talent-edge-flow-duration', toFixedNumber(waveDuration) + 's');
    path.style.setProperty('--talent-edge-wobble-duration', toFixedNumber(wobbleDuration) + 's');
    path.style.setProperty('--talent-edge-aura-duration', toFixedNumber(auraDuration) + 's');
    path.style.setProperty('--talent-edge-phase', toFixedNumber(phaseOffset) + 's');
    path.style.setProperty('--talent-edge-jitter-x', toFixedNumber(biasX) + 'px');
    path.style.setProperty('--talent-edge-jitter-y', toFixedNumber(biasY) + 'px');
    path.style.setProperty('--talent-edge-jitter-x-neg', toFixedNumber(biasX * -0.72) + 'px');
    path.style.setProperty('--talent-edge-jitter-y-neg', toFixedNumber(Math.abs(biasY) * 0.52) + 'px');
    if (branchId) path.dataset.branchId = branchId;
  }

  function drawBranchEdges(options) {
    var opts = options || {};
    var overlay = opts.overlay || null;
    var branchId = typeof opts.branchId === 'string' ? opts.branchId : '';
    var documentObj = opts.documentObj || (typeof document !== 'undefined' ? document : null);
    if (!overlay || !branchId || !documentObj || typeof documentObj.createElementNS !== 'function') return false;

    var svg = typeof overlay.querySelector === 'function'
      ? overlay.querySelector('#talentSvgV2-' + branchId)
      : null;
    var grid = typeof overlay.querySelector === 'function'
      ? overlay.querySelector('#talentGridV2-' + branchId)
      : null;
    if (!svg || !grid) return false;

    svg.innerHTML = '';
    var gridRect = typeof grid.getBoundingClientRect === 'function' ? grid.getBoundingClientRect() : null;
    if (!gridRect || gridRect.width <= 0 || gridRect.height <= 0) return false;

    svg.setAttribute('width', gridRect.width);
    svg.setAttribute('height', gridRect.height);
    svg.setAttribute('viewBox', '0 0 ' + gridRect.width + ' ' + gridRect.height);

    var nodes = Array.isArray(opts.nodes) ? opts.nodes : [];
    var ranks = opts.ranks && typeof opts.ranks === 'object' ? opts.ranks : {};
    var getNodeLayout = typeof opts.getNodeLayout === 'function'
      ? opts.getNodeLayout
      : function (index) { return { row: 0, slot: index, parents: [] }; };

    var nodeButtons = [];
    var nodeAnchors = [];
    for (var buttonIndex = 0; buttonIndex < nodes.length; buttonIndex++) {
      var button = grid.querySelector('[data-branch-id="' + branchId + '"][data-talent-local="' + buttonIndex + '"]');
      nodeButtons[buttonIndex] = button || null;
      nodeAnchors[buttonIndex] = getNodeAnchorPoint(button, gridRect);
    }

    for (var localIdx = 0; localIdx < nodes.length; localIdx++) {
      var node = nodes[localIdx];
      if (!node || !node.id) continue;
      var layout = getNodeLayout(localIdx, node) || {};
      var parents = Array.isArray(layout.parents) ? layout.parents : [];
      if (!parents.length) continue;

      var toAnchor = nodeAnchors[localIdx];
      if (!toAnchor) continue;

      var toX = toAnchor.x;
      var toY = toAnchor.y;
      var childActive = Math.max(0, Math.floor(ranks[node.id] || 0)) > 0;

      for (var parentIndex = 0; parentIndex < parents.length; parentIndex++) {
        var parentLocalIdx = parents[parentIndex];
        var parentNode = nodes[parentLocalIdx];
        if (!parentNode) continue;

        var fromAnchor = nodeAnchors[parentLocalIdx];
        if (!fromAnchor) continue;

        var fromX = fromAnchor.x;
        var fromY = fromAnchor.y;
        var parentActive = Math.max(0, Math.floor(ranks[parentNode.id] || 0)) > 0;
        var relationState = parentActive && childActive ? 'active' : (parentActive ? 'ready' : 'base');
        var emphasis = relationState === 'active' ? 1.46 : (relationState === 'ready' ? 1.2 : 1.02);
        var waveBoost = relationState === 'active' ? 10 : (relationState === 'ready' ? 6 : 0);
        var pathData = buildEdgePath(fromX, fromY, toX, toY, { emphasis: emphasis, waveBoost: waveBoost });

        if (relationState !== 'base') {
          var aura = documentObj.createElementNS('http://www.w3.org/2000/svg', 'path');
          aura.setAttribute('d', pathData);
          aura.classList.add('talentEdgeAura');
          if (relationState === 'active') aura.classList.add('talentEdgeAuraActive');
          else if (relationState === 'ready') aura.classList.add('talentEdgeAuraReady');
          svg.appendChild(aura);
        }

        var path = documentObj.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathData);
        path.classList.add('talentEdge');
        if (relationState === 'active') {
          path.classList.add('talentEdgeActive');
          applyEdgeMotion(path, branchId, parentLocalIdx, localIdx, fromX, toX, 1.16);
        } else if (relationState === 'ready') {
          path.classList.add('talentEdgeReady');
          applyEdgeMotion(path, branchId, parentLocalIdx, localIdx, fromX, toX, 0.94);
        }
        svg.appendChild(path);
      }
    }

    return true;
  }

  function renderBranchNodes(options) {
    var opts = options || {};
    var overlay = opts.overlay || null;
    var branchId = typeof opts.branchId === 'string' ? opts.branchId : '';
    var documentObj = opts.documentObj || (typeof document !== 'undefined' ? document : null);
    if (!overlay || !branchId || !documentObj || typeof documentObj.createElement !== 'function') return false;

    var grid = typeof overlay.querySelector === 'function'
      ? overlay.querySelector('#talentGridV2-' + branchId)
      : null;
    if (!grid) return false;

    var nodes = Array.isArray(opts.nodes) ? opts.nodes : [];
    var ranks = opts.ranks && typeof opts.ranks === 'object' ? opts.ranks : {};
    var pendingRanks = opts.pendingRanks && typeof opts.pendingRanks === 'object' ? opts.pendingRanks : {};
    var translate = typeof opts.translate === 'function'
      ? opts.translate
      : function (_key, fallback) { return fallback || ''; };
    var getNodeLayout = typeof opts.getNodeLayout === 'function'
      ? opts.getNodeLayout
      : function (index) { return { row: 0, slot: index, parents: [] }; };
    var getBuyState = typeof opts.getBuyState === 'function'
      ? opts.getBuyState
      : function () { return { ok: false, reason: 'unknown' }; };
    var getTooltipReason = typeof opts.getTooltipReason === 'function'
      ? opts.getTooltipReason
      : function () { return ''; };
    var getNodeName = typeof opts.getNodeName === 'function'
      ? opts.getNodeName
      : function (node) { return node && node.id ? String(node.id) : ''; };
    var getNodeDescription = typeof opts.getNodeDescription === 'function'
      ? opts.getNodeDescription
      : function () { return ''; };
    var onNodeClick = typeof opts.onNodeClick === 'function' ? opts.onNodeClick : function () {};

    var maxLayoutRow = 0;
    var maxTierRow = 1;
    grid.innerHTML = '';

    for (var nodeIndex = 0; nodeIndex < nodes.length; nodeIndex++) {
      var layoutProbe = getNodeLayout(nodeIndex, nodes[nodeIndex]) || {};
      maxLayoutRow = Math.max(maxLayoutRow, Number(layoutProbe.row) || 0);
      maxTierRow = Math.max(maxTierRow, Number(nodes[nodeIndex] && nodes[nodeIndex].tier) || 1);
    }
    if (grid.style && typeof grid.style.setProperty === 'function') {
      grid.style.setProperty('--rows', String(Math.max(1, maxLayoutRow + 1, maxTierRow)));
    }

    for (var index = 0; index < nodes.length; index++) {
      var node = nodes[index];
      if (!node || !node.id) continue;
      var layout = getNodeLayout(index, node) || {};
      var appliedRank = Math.max(0, Math.floor(Number(ranks[node.id]) || 0));
      var pendingRank = Math.max(0, Math.floor(Number(pendingRanks[node.id]) || 0));
      var rank = appliedRank + pendingRank;
      var can = getBuyState(node.id) || { ok: false, reason: 'unknown' };
      var tooltipReason = can.ok ? '' : getTooltipReason(can);

      var button = documentObj.createElement('button');
      button.type = 'button';
      button.className = 'talentNode';
      button.dataset.talentId = node.id;
      button.dataset.branchId = branchId;
      button.dataset.talentLocal = String(index);
      button.dataset.row = String(Math.max(0, Number(layout.row) || 0));
      if (button.style && typeof button.style.setProperty === 'function') {
        button.style.setProperty('--row', String(Math.max(0, Number(layout.row) || 0)));
        button.style.setProperty('--slot', String(Math.max(0, Number(layout.slot) || 0)));
      }
      button.classList.toggle('applied', appliedRank > 0);
      button.classList.toggle('pending', pendingRank > 0);
      button.classList.toggle('maxed', rank >= Math.max(1, Number(node.maxRank) || 1));
      button.classList.toggle('locked', !can.ok && rank <= 0);

      var descText = getNodeDescription(node, rank);
      var titleText = getNodeName(node) + '\n' + descText + (tooltipReason ? '\n' + tooltipReason : '');
      button.setAttribute('data-ui-tooltip', titleText);
      button.removeAttribute('title');
      button.innerHTML = ''
        + '<span class="talentNodeIcon" aria-hidden="true">'
        + (node.ui && node.ui.icon
          ? '<img src="assets/ui/icons/talents/' + node.ui.icon + '.png" alt="" loading="lazy">'
          : '<span class="talentNodeGlyph">◆</span>')
        + '</span>'
        + '<span class="talentNodeRank">'
        + rank + '/' + Math.max(1, Number(node.maxRank) || 1)
        + '</span>';
      button.addEventListener('click', function (event) {
        onNodeClick(event.currentTarget && event.currentTarget.dataset ? event.currentTarget.dataset.talentId : '', event);
      });
      grid.appendChild(button);
    }

    return true;
  }

  global.Game = global.Game || {};
  global.Game.TalentOverlayRenderer = {
    drawBranchEdges: drawBranchEdges,
    renderBranchNodes: renderBranchNodes,
  };
})(typeof window !== 'undefined' ? window : this);