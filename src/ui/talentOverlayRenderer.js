(function (global) {
  'use strict';

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

    for (var localIdx = 0; localIdx < nodes.length; localIdx++) {
      var node = nodes[localIdx];
      if (!node || !node.id) continue;
      var layout = getNodeLayout(localIdx, node) || {};
      var parents = Array.isArray(layout.parents) ? layout.parents : [];
      if (!parents.length) continue;

      var toBtn = grid.querySelector('[data-branch-id="' + branchId + '"][data-talent-local="' + localIdx + '"]');
      if (!toBtn || typeof toBtn.getBoundingClientRect !== 'function') continue;

      var toRect = toBtn.getBoundingClientRect();
      var toX = toRect.left + toRect.width / 2 - gridRect.left;
      var toY = toRect.top - gridRect.top;
      var childActive = Math.max(0, Math.floor(ranks[node.id] || 0)) > 0;

      for (var parentIndex = 0; parentIndex < parents.length; parentIndex++) {
        var parentLocalIdx = parents[parentIndex];
        var parentNode = nodes[parentLocalIdx];
        if (!parentNode) continue;

        var fromBtn = grid.querySelector('[data-branch-id="' + branchId + '"][data-talent-local="' + parentLocalIdx + '"]');
        if (!fromBtn || typeof fromBtn.getBoundingClientRect !== 'function') continue;

        var fromRect = fromBtn.getBoundingClientRect();
        var fromX = fromRect.left + fromRect.width / 2 - gridRect.left;
        var fromY = fromRect.bottom - gridRect.top;
        var parentActive = Math.max(0, Math.floor(ranks[parentNode.id] || 0)) > 0;
        var gapY = Math.max(0, toY - fromY);
        var elbowY = fromY + Math.max(6, Math.min(24, gapY * 0.5 + 4));
        if (elbowY >= toY) elbowY = fromY + gapY * 0.5;

        var path = documentObj.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M ' + fromX + ' ' + fromY + ' L ' + fromX + ' ' + elbowY + ' L ' + toX + ' ' + elbowY + ' L ' + toX + ' ' + toY);
        path.classList.add('talentEdge');
        if (parentActive && childActive) path.classList.add('talentEdgeActive');
        else if (parentActive) path.classList.add('talentEdgeReady');
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