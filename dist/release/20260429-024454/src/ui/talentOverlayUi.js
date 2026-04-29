(function (global) {
  'use strict';

  var cache = {
    signature: '',
    lang: '',
    edgesLayoutKey: '',
  };

  function update(options) {
    var opts = options || {};
    var overlay = opts.overlay || null;
    var api = opts.api || null;
    var branchIds = Array.isArray(opts.branchIds) ? opts.branchIds : [];
    if (!overlay || !api || !branchIds.length) return false;

    var translate = typeof opts.translate === 'function'
      ? opts.translate
      : function (key, fallback) { return fallback || key || ''; };
    var getBranchLabel = typeof opts.getBranchLabel === 'function'
      ? opts.getBranchLabel
      : function (branchId) { return String(branchId || ''); };
    var getBranchNodes = typeof opts.getBranchNodes === 'function'
      ? opts.getBranchNodes
      : function () { return []; };
    var renderBranchNodes = typeof opts.renderBranchNodes === 'function'
      ? opts.renderBranchNodes
      : function () {};
    var drawBranchEdges = typeof opts.drawBranchEdges === 'function'
      ? opts.drawBranchEdges
      : function () { return false; };
    var updateAbilitySlots = typeof opts.updateAbilitySlots === 'function'
      ? opts.updateAbilitySlots
      : function () {};
    var getResetAllState = typeof opts.getResetAllState === 'function'
      ? opts.getResetAllState
      : null;
    var isLayoutVisible = typeof opts.isLayoutVisible === 'function'
      ? opts.isLayoutVisible
      : function () { return false; };
    var buildLayoutKey = typeof opts.buildLayoutKey === 'function'
      ? opts.buildLayoutKey
      : function () { return ''; };
    var buildRenderSignature = typeof opts.buildRenderSignature === 'function'
      ? opts.buildRenderSignature
      : function () { return ''; };
    var getCurrentLang = typeof opts.getCurrentLang === 'function'
      ? opts.getCurrentLang
      : function () { return ''; };

    if (typeof opts.syncPlayerTalents === 'function') opts.syncPlayerTalents();

    var freePoints = typeof api.getFreePoints === 'function' ? Math.max(0, Math.floor(api.getFreePoints())) : 0;
    var pendingCost = typeof api.getPendingCost === 'function' ? Math.max(0, Math.floor(api.getPendingCost())) : 0;
    var pendingRanks = typeof api.getPendingRanks === 'function' ? api.getPendingRanks() : {};
    var summary = overlay.querySelector('#talentSummary');
    if (summary) {
      summary.textContent = translate('talentPoints') + ': ' + freePoints + ' • ' + translate('talentPending') + ': ' + pendingCost;
    }

    for (var branchIndex = 0; branchIndex < branchIds.length; branchIndex++) {
      var branchId = branchIds[branchIndex];
      var titleEl = overlay.querySelector('.talentBranch[data-branch-id="' + branchId + '"] .talentBranchTitle');
      if (titleEl) titleEl.textContent = getBranchLabel(branchId);

      var pointsEl = overlay.querySelector('#branchPointsV2-' + branchId);
      if (pointsEl && typeof api.getBranchSpent === 'function') {
        var branchApplied = Math.max(0, Math.floor(api.getBranchSpent(branchId)));
        var nodes = getBranchNodes(branchId);
        var branchPending = 0;
        for (var nodeIndex = 0; nodeIndex < nodes.length; nodeIndex++) {
          var node = nodes[nodeIndex];
          if (!node || !node.id) continue;
          branchPending += Math.max(0, Math.floor(pendingRanks[node.id] || 0));
        }
        pointsEl.textContent = branchPending > 0 ? String(branchApplied) + '+' + String(branchPending) : String(branchApplied);
      }

      var resetBtn = overlay.querySelector('.talentBranchReset[data-branch-id="' + branchId + '"]');
      if (resetBtn) {
        resetBtn.textContent = translate('talentReset');
        var branchNodes = getBranchNodes(branchId);
        var hasPending = false;
        for (var pendingIndex = 0; pendingIndex < branchNodes.length; pendingIndex++) {
          var branchNode = branchNodes[pendingIndex];
          if (!branchNode || !branchNode.id) continue;
          if (Math.max(0, Math.floor(pendingRanks[branchNode.id] || 0)) > 0) {
            hasPending = true;
            break;
          }
        }
        resetBtn.disabled = !hasPending;
      }
    }

    var currentLang = getCurrentLang();
    var renderSignature = buildRenderSignature(api);
    var signatureChanged = cache.signature !== renderSignature || cache.lang !== currentLang;
    if (signatureChanged) {
      for (var renderIndex = 0; renderIndex < branchIds.length; renderIndex++) {
        renderBranchNodes(overlay, branchIds[renderIndex]);
      }
      cache.signature = renderSignature;
      cache.lang = currentLang;
      cache.edgesLayoutKey = '';
    }

    if (!isLayoutVisible(overlay)) {
      cache.edgesLayoutKey = '';
    } else {
      var layoutKey = buildLayoutKey(overlay);
      if (layoutKey && (signatureChanged || cache.edgesLayoutKey !== layoutKey)) {
        var renderedAll = true;
        for (var edgeIndex = 0; edgeIndex < branchIds.length; edgeIndex++) {
          renderedAll = drawBranchEdges(overlay, branchIds[edgeIndex]) && renderedAll;
        }
        cache.edgesLayoutKey = renderedAll ? layoutKey : '';
      }
    }

    updateAbilitySlots(overlay);

    var applyBtn = overlay.querySelector('#talentApply');
    if (applyBtn) {
      applyBtn.disabled = pendingCost <= 0 || pendingCost > freePoints;
    }

    var resetAllBtn = overlay.querySelector('#talentResetAll');
    if (resetAllBtn) {
      var ranks = typeof api.getRanks === 'function' ? api.getRanks() : {};
      var rankIds = Object.keys(ranks);
      var hasApplied = false;
      for (var rankIndex = 0; rankIndex < rankIds.length; rankIndex++) {
        if ((ranks[rankIds[rankIndex]] || 0) > 0) {
          hasApplied = true;
          break;
        }
      }
      var pendingIds = Object.keys(pendingRanks);
      var hasAnyPending = false;
      for (var pendingIdIndex = 0; pendingIdIndex < pendingIds.length; pendingIdIndex++) {
        if ((pendingRanks[pendingIds[pendingIdIndex]] || 0) > 0) {
          hasAnyPending = true;
          break;
        }
      }
      var resetAllState = getResetAllState ? getResetAllState({ hasApplied: hasApplied, hasPending: hasAnyPending }) : null;
      if (resetAllState) {
        resetAllBtn.textContent = resetAllState.text || translate('talentResetAll');
        resetAllBtn.disabled = !!resetAllState.disabled;
        if (resetAllState.tooltip) {
          resetAllBtn.setAttribute('data-ui-tooltip', resetAllState.tooltip);
          resetAllBtn.removeAttribute('title');
        } else {
          resetAllBtn.removeAttribute('data-ui-tooltip');
          resetAllBtn.removeAttribute('title');
        }
      } else {
        resetAllBtn.textContent = translate('talentResetAll');
        resetAllBtn.disabled = !(hasApplied || hasAnyPending);
        resetAllBtn.removeAttribute('data-ui-tooltip');
        resetAllBtn.removeAttribute('title');
      }
    }

    return true;
  }

  function invalidateLayoutCache() {
    cache.edgesLayoutKey = '';
  }

  function invalidateAllCache() {
    cache.signature = '';
    cache.lang = '';
    cache.edgesLayoutKey = '';
  }

  global.Game = global.Game || {};
  global.Game.TalentOverlayUi = {
    update: update,
    invalidateLayoutCache: invalidateLayoutCache,
    invalidateAllCache: invalidateAllCache,
  };
})(typeof window !== 'undefined' ? window : this);