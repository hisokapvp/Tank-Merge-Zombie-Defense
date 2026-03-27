/**
 * TalentsScene — Phaser 3 overlay scene for the talent tree (V2).
 *
 * Displays 3 branches (offense, defense, economy) in columns.
 * Each branch shows tier rows of talent nodes with rank indicators
 * and edges connecting dependent nodes.
 * Footer: free points, ability slots, apply/reset buttons.
 *
 * Lifecycle:
 *   1. Launched by SceneOverlayManager / ModalAdapter
 *   2. show(data) populates from TalentsV2 API
 *   3. Nodes are interactive — click to queue rank
 *   4. hide() clears pending and sleeps the scene
 */
(function (global) {
  'use strict';

  if (typeof Phaser === 'undefined') return;

  // ── Layout ──
  var PANEL = {
    width: 560,
    height: 520,
    radius: 14,
    bgColor: 0x1a2332,
    bgAlpha: 0.97,
    borderColor: 0x44aaff,
    borderWidth: 2,
    backdropAlpha: 0.6,
  };

  var BRANCH = {
    colWidth: 170,
    gap: 10,
    headerHeight: 30,
    nodeSize: 32,
    nodeGap: 8,
    nodeRadius: 6,
    nodeBg: 0x223344,
    nodeHover: 0x2a4455,
    nodeActive: 0x44aaff,
    nodeMaxed: 0x44cc44,
    nodeLocked: 0x1a1a2a,
    edgeColor: 0x446688,
    edgeActiveColor: 0x44aaff,
    edgeWidth: 2,
  };

  var ABILITY_SLOT = {
    size: 36,
    gap: 10,
    bgColor: 0x223344,
    activeColor: 0x44aaff,
    cooldownColor: 0x884422,
    radius: 6,
  };

  var TEXT_STYLE = {
    title: { fontFamily: 'Arial, sans-serif', fontSize: '20px', color: '#ffdd44', align: 'center', stroke: '#000', strokeThickness: 2 },
    branchTitle: { fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#88bbff', align: 'center' },
    branchPoints: { fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#aaaaaa', align: 'center' },
    nodeName: { fontFamily: 'Arial, sans-serif', fontSize: '10px', color: '#ffffff', align: 'center', wordWrap: { width: 60 } },
    nodeRank: { fontFamily: 'Arial, sans-serif', fontSize: '10px', color: '#ffdd44', align: 'center' },
    summary: { fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#cccccc', align: 'center' },
    button: { fontFamily: 'Arial, sans-serif', fontSize: '14px', color: '#ffffff', align: 'center' },
    close: { fontFamily: 'Arial, sans-serif', fontSize: '22px', color: '#cccccc' },
    abilityLabel: { fontFamily: 'Arial, sans-serif', fontSize: '10px', color: '#aaaaaa', align: 'center' },
    tooltip: { fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#cccccc', align: 'left', wordWrap: { width: 200 }, backgroundColor: '#111827', padding: { x: 8, y: 6 } },
  };

  // ── Scene-local state ──
  var _backdrop = null;
  var _panelBg = null;
  var _titleText = null;
  var _callbacks = {};
  var _api = null;           // TalentsV2 query API
  var _translate = null;
  var _branchGroups = {};    // { branchId: { headerText, pointsText, nodes: [], edges: [] } }
  var _branchIds = [];
  var _summaryText = null;
  var _applyBtnBg = null;
  var _applyBtnText = null;
  var _applyBtnZone = null;
  var _resetBtnBg = null;
  var _resetBtnText = null;
  var _resetBtnZone = null;
  var _abilitySlots = [];
  var _tooltipText = null;
  var _tooltipBg = null;
  var _nodeObjects = [];     // flat array of all node {gfx, text, rankText, zone, talentId, branchId}

  // ── Helpers ──
  function _drawRRect(gfx, cx, cy, w, h, r, color, alpha) {
    gfx.clear();
    gfx.fillStyle(color, alpha !== undefined ? alpha : 1);
    gfx.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, r);
  }

  function _drawBtnRounded(gfx, cx, cy, w, h, r, color) {
    gfx.clear();
    gfx.fillStyle(color, 1);
    gfx.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, r);
  }

  function _drawPanel(gfx, cx, cy) {
    gfx.clear();
    gfx.fillStyle(PANEL.bgColor, PANEL.bgAlpha);
    gfx.fillRoundedRect(cx - PANEL.width / 2, cy - PANEL.height / 2, PANEL.width, PANEL.height, PANEL.radius);
    gfx.lineStyle(PANEL.borderWidth, PANEL.borderColor, 1);
    gfx.strokeRoundedRect(cx - PANEL.width / 2, cy - PANEL.height / 2, PANEL.width, PANEL.height, PANEL.radius);
  }

  var TalentsScene = new Phaser.Class({
    Extends: Phaser.Scene,

    initialize: function TalentsScene() {
      Phaser.Scene.call(this, { key: 'TalentsScene' });
    },

    create: function () {
      var self = this;
      var w = this.scale.width;
      var h = this.scale.height;
      var cx = w / 2;
      var cy = h / 2;

      // ── Backdrop ──
      _backdrop = this.add.graphics();
      _backdrop.fillStyle(0x050a12, PANEL.backdropAlpha);
      _backdrop.fillRect(0, 0, w, h);
      _backdrop.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
      _backdrop.on('pointerdown', function () {
        if (typeof _callbacks.onClose === 'function') _callbacks.onClose();
      });

      // ── Panel ──
      _panelBg = this.add.graphics();
      _drawPanel(_panelBg, cx, cy);
      var panelZone = this.add.zone(cx, cy, PANEL.width, PANEL.height).setInteractive();
      panelZone.on('pointerdown', function (ptr, lx, ly, evt) { if (evt) evt.stopPropagation(); });

      // ── Title ──
      _titleText = this.add.text(cx, cy - PANEL.height / 2 + 26, 'Talent Tree', TEXT_STYLE.title).setOrigin(0.5);

      // ── Close (X) ──
      var closeX = cx + PANEL.width / 2 - 24;
      var closeY = cy - PANEL.height / 2 + 22;
      var closeBg = this.add.graphics();
      closeBg.fillStyle(0x472d1c, 0.98);
      closeBg.fillRoundedRect(closeX - 16, closeY - 16, 32, 32, 8);
      var closeTxt = this.add.text(closeX, closeY, '\u00D7', TEXT_STYLE.close).setOrigin(0.5);
      var closeZone = this.add.zone(closeX, closeY, 44, 44).setInteractive({ useHandCursor: true });
      closeZone.on('pointerover', function () { closeTxt.setColor('#ffffff'); });
      closeZone.on('pointerout', function () { closeTxt.setColor('#cccccc'); });
      closeZone.on('pointerdown', function () {
        if (typeof _callbacks.onClose === 'function') _callbacks.onClose();
      });

      // ── Branch columns (defer creation until show) ──
      _branchGroups = {};
      _nodeObjects = [];

      // ── Summary footer ──
      var footerY = cy + PANEL.height / 2 - 80;
      _summaryText = this.add.text(cx, footerY, '', TEXT_STYLE.summary).setOrigin(0.5);

      // ── Ability slots (3) ──
      _abilitySlots = [];
      var slotsY = cy + PANEL.height / 2 - 55;
      var slotsStartX = cx - (3 * ABILITY_SLOT.size + 2 * ABILITY_SLOT.gap) / 2 + ABILITY_SLOT.size / 2;
      for (var s = 0; s < 3; s++) {
        var sx = slotsStartX + s * (ABILITY_SLOT.size + ABILITY_SLOT.gap);
        var slotBg = this.add.graphics();
        _drawBtnRounded(slotBg, sx, slotsY, ABILITY_SLOT.size, ABILITY_SLOT.size, ABILITY_SLOT.radius, ABILITY_SLOT.bgColor);
        var slotLabel = this.add.text(sx, slotsY, (s + 1).toString(), TEXT_STYLE.abilityLabel).setOrigin(0.5);
        var slotZone = this.add.zone(sx, slotsY, ABILITY_SLOT.size, ABILITY_SLOT.size).setInteractive({ useHandCursor: true });
        (function (idx, bg, lx) {
          slotZone.on('pointerdown', function () {
            if (typeof _callbacks.onUseAbility === 'function') _callbacks.onUseAbility(idx);
          });
          slotZone.on('pointerover', function () { _drawBtnRounded(bg, lx, slotsY, ABILITY_SLOT.size, ABILITY_SLOT.size, ABILITY_SLOT.radius, ABILITY_SLOT.activeColor); });
          slotZone.on('pointerout', function () { _drawBtnRounded(bg, lx, slotsY, ABILITY_SLOT.size, ABILITY_SLOT.size, ABILITY_SLOT.radius, ABILITY_SLOT.bgColor); });
        })(s, slotBg, sx);
        _abilitySlots.push({ bg: slotBg, label: slotLabel, zone: slotZone, x: sx, y: slotsY });
      }

      // ── Apply button ──
      var btnY = cy + PANEL.height / 2 - 24;
      var applyX = cx - 75;
      _applyBtnBg = this.add.graphics();
      _drawBtnRounded(_applyBtnBg, applyX, btnY, 120, 32, 8, 0x2d8844);
      _applyBtnText = this.add.text(applyX, btnY, 'Apply', TEXT_STYLE.button).setOrigin(0.5);
      _applyBtnZone = this.add.zone(applyX, btnY, 120, 32).setInteractive({ useHandCursor: true });
      _applyBtnZone.on('pointerover', function () { _drawBtnRounded(_applyBtnBg, applyX, btnY, 120, 32, 8, 0x3aaa55); });
      _applyBtnZone.on('pointerout', function () { _drawBtnRounded(_applyBtnBg, applyX, btnY, 120, 32, 8, 0x2d8844); });
      _applyBtnZone.on('pointerdown', function () {
        if (typeof _callbacks.onApply === 'function') _callbacks.onApply();
      });

      // ── Reset button ──
      var resetX = cx + 75;
      _resetBtnBg = this.add.graphics();
      _drawBtnRounded(_resetBtnBg, resetX, btnY, 120, 32, 8, 0x884422);
      _resetBtnText = this.add.text(resetX, btnY, 'Reset', TEXT_STYLE.button).setOrigin(0.5);
      _resetBtnZone = this.add.zone(resetX, btnY, 120, 32).setInteractive({ useHandCursor: true });
      _resetBtnZone.on('pointerover', function () { _drawBtnRounded(_resetBtnBg, resetX, btnY, 120, 32, 8, 0xaa5533); });
      _resetBtnZone.on('pointerout', function () { _drawBtnRounded(_resetBtnBg, resetX, btnY, 120, 32, 8, 0x884422); });
      _resetBtnZone.on('pointerdown', function () {
        if (typeof _callbacks.onResetAll === 'function') _callbacks.onResetAll();
      });

      // ── Tooltip ──
      _tooltipBg = this.add.graphics();
      _tooltipBg.setVisible(false).setDepth(100);
      _tooltipText = this.add.text(0, 0, '', TEXT_STYLE.tooltip).setOrigin(0, 0).setVisible(false).setDepth(101);

      // Signal readiness
      var overlayMgr = global.Game && global.Game.SceneOverlayManager;
      if (overlayMgr && typeof overlayMgr.onSceneCreated === 'function') {
        overlayMgr.onSceneCreated('TalentsScene');
      }

      this._setAllVisible(false);
    },

    _setAllVisible: function (visible) {
      this.children.each(function (child) {
        if (child && typeof child.setVisible === 'function') child.setVisible(visible);
      });
    },

    /**
     * Show talent tree.
     * @param {Object} [data]
     * @param {Object} [data.api] — TalentsV2 query API
     * @param {Array} [data.branchIds] — ['offense','defense','economy']
     * @param {Function} [data.translate]
     * @param {Function} [data.getBranchLabel]
     * @param {Function} [data.onApply]
     * @param {Function} [data.onResetAll]
     * @param {Function} [data.onUseAbility]
     * @param {Function} [data.onClose]
     * @param {Function} [data.onNodeClick] — (talentId) =>
     */
    show: function (data) {
      data = data || {};
      _api = data.api || null;
      _translate = data.translate || function (k) { return k; };
      _branchIds = data.branchIds || ['offense', 'defense', 'economy'];
      _callbacks = {
        onApply: data.onApply || null,
        onResetAll: data.onResetAll || null,
        onUseAbility: data.onUseAbility || null,
        onClose: data.onClose || null,
        onNodeClick: data.onNodeClick || null,
        getBranchLabel: data.getBranchLabel || function (id) { return id; },
      };

      // Title
      if (_titleText) _titleText.setText(_translate('talentTreeTitle') || 'Talent Tree');
      if (_applyBtnText) _applyBtnText.setText(_translate('talentApply') || 'Apply');
      if (_resetBtnText) _resetBtnText.setText(_translate('talentResetAll') || 'Reset');

      this._setAllVisible(true);
      _hideTooltip();
      this._buildBranches();
      this._refreshState();
    },

    hide: function () {
      this._setAllVisible(false);
      _hideTooltip();
      _callbacks = {};
      _api = null;
      _translate = null;
    },

    shutdown: function () {
      _backdrop = null;
      _panelBg = null;
      _titleText = null;
      _summaryText = null;
      _applyBtnBg = null;
      _applyBtnText = null;
      _applyBtnZone = null;
      _resetBtnBg = null;
      _resetBtnText = null;
      _resetBtnZone = null;
      _abilitySlots = [];
      _nodeObjects = [];
      _branchGroups = {};
      _tooltipText = null;
      _tooltipBg = null;
      _callbacks = {};
      _api = null;
    },

    /**
     * Build branch columns with talent nodes.
     */
    _buildBranches: function () {
      var self = this;
      // Destroy old node objects
      for (var i = 0; i < _nodeObjects.length; i++) {
        var n = _nodeObjects[i];
        if (n.gfx && typeof n.gfx.destroy === 'function') n.gfx.destroy();
        if (n.text && typeof n.text.destroy === 'function') n.text.destroy();
        if (n.rankText && typeof n.rankText.destroy === 'function') n.rankText.destroy();
        if (n.zone && typeof n.zone.destroy === 'function') n.zone.destroy();
      }
      _nodeObjects = [];
      // Destroy old edges
      for (var bid in _branchGroups) {
        var bg = _branchGroups[bid];
        if (bg.edgesGfx && typeof bg.edgesGfx.destroy === 'function') bg.edgesGfx.destroy();
        if (bg.headerText && typeof bg.headerText.destroy === 'function') bg.headerText.destroy();
        if (bg.pointsText && typeof bg.pointsText.destroy === 'function') bg.pointsText.destroy();
      }
      _branchGroups = {};

      var w = this.scale.width;
      var h = this.scale.height;
      var cx = w / 2;
      var cy = h / 2;

      var totalBranches = _branchIds.length;
      var branchAreaTop = cy - PANEL.height / 2 + 50;
      var branchAreaHeight = PANEL.height - 160;

      for (var b = 0; b < totalBranches; b++) {
        var branchId = _branchIds[b];
        var colCx = cx + (b - 1) * (BRANCH.colWidth + BRANCH.gap);

        // Branch header
        var label = _callbacks.getBranchLabel ? _callbacks.getBranchLabel(branchId) : branchId;
        var headerText = this.add.text(colCx, branchAreaTop, label, TEXT_STYLE.branchTitle).setOrigin(0.5);
        var pointsText = this.add.text(colCx, branchAreaTop + 16, '0 pts', TEXT_STYLE.branchPoints).setOrigin(0.5);

        // Edges graphics
        var edgesGfx = this.add.graphics();

        _branchGroups[branchId] = {
          headerText: headerText,
          pointsText: pointsText,
          edgesGfx: edgesGfx,
          colCx: colCx,
        };

        // Get talents for branch
        var talents = [];
        if (_api && typeof _api.getTalentsByBranch === 'function') {
          talents = _api.getTalentsByBranch(branchId) || [];
        }

        // Group by tier
        var tiers = {};
        for (var ti = 0; ti < talents.length; ti++) {
          var t = talents[ti];
          var tier = t.tier || 1;
          if (!tiers[tier]) tiers[tier] = [];
          tiers[tier].push(t);
        }

        var tierKeys = Object.keys(tiers).sort(function (a, b) { return Number(a) - Number(b); });
        var nodeStartY = branchAreaTop + BRANCH.headerHeight + 10;

        // Layout nodes per tier
        var nodePositions = {}; // talentId → {x, y}
        for (var tk = 0; tk < tierKeys.length; tk++) {
          var tierTalents = tiers[tierKeys[tk]];
          var tierY = nodeStartY + tk * (BRANCH.nodeSize + BRANCH.nodeGap + 4);
          var tierWidth = tierTalents.length * BRANCH.nodeSize + (tierTalents.length - 1) * 4;
          var tierStartX = colCx - tierWidth / 2 + BRANCH.nodeSize / 2;

          for (var nt = 0; nt < tierTalents.length; nt++) {
            var talent = tierTalents[nt];
            var nx = tierStartX + nt * (BRANCH.nodeSize + 4);
            var ny = tierY;
            nodePositions[talent.id] = { x: nx, y: ny };

            var nodeObj = _createNode(self, nx, ny, talent, branchId);
            _nodeObjects.push(nodeObj);
          }
        }

        // Draw edges between nodes
        _drawEdges(edgesGfx, talents, nodePositions);
      }
    },

    /**
     * Refresh node visual states from API data.
     */
    _refreshState: function () {
      if (!_api) return;
      var t = _translate || function (k) { return k; };

      // Summary
      var freePoints = typeof _api.getFreePoints === 'function' ? _api.getFreePoints() : 0;
      var pendingCostTotal = 0;
      for (var bi = 0; bi < _branchIds.length; bi++) {
        var bId = _branchIds[bi];
        var pc = typeof _api.getPendingCost === 'function' ? _api.getPendingCost(bId) : 0;
        pendingCostTotal += pc;

        // Branch points text
        var bg = _branchGroups[bId];
        if (bg && bg.pointsText) {
          var spent = typeof _api.getBranchSpent === 'function' ? _api.getBranchSpent(bId, { includePending: true }) : 0;
          bg.pointsText.setText(spent + ' ' + (t('talentPtsSpent') || 'pts'));
        }
      }

      if (_summaryText) {
        var txtParts = [(t('talentFreePoints') || 'Free') + ': ' + freePoints];
        if (pendingCostTotal > 0) {
          txtParts.push((t('talentPending') || 'Pending') + ': ' + pendingCostTotal);
        }
        _summaryText.setText(txtParts.join('  \u2022  '));
      }

      // Node states
      var ranks = typeof _api.getRanks === 'function' ? _api.getRanks() : {};
      var pending = typeof _api.getPendingRanks === 'function' ? _api.getPendingRanks() : {};
      var effective = typeof _api.getEffectiveRanks === 'function' ? _api.getEffectiveRanks() : {};

      for (var ni = 0; ni < _nodeObjects.length; ni++) {
        var node = _nodeObjects[ni];
        var applied = ranks[node.talentId] || 0;
        var pend = pending[node.talentId] || 0;
        var eff = effective[node.talentId] || 0;
        var maxRank = node.maxRank || 5;

        var color;
        if (eff >= maxRank) {
          color = BRANCH.nodeMaxed;
        } else if (pend > 0) {
          color = BRANCH.nodeActive;
        } else if (applied > 0) {
          color = 0x336644;
        } else {
          color = BRANCH.nodeBg;
        }

        if (node.gfx) _drawBtnRounded(node.gfx, node.x, node.y, BRANCH.nodeSize, BRANCH.nodeSize, BRANCH.nodeRadius, color);
        if (node.rankText) node.rankText.setText(eff + '/' + maxRank);
      }

      // Ability slots
      for (var si = 0; si < _abilitySlots.length; si++) {
        var slot = _abilitySlots[si];
        var activeBranchId = _branchIds[si] || '';
        var slotColor = ABILITY_SLOT.bgColor;
        // Could enhance with cooldown state if api exposes it
        if (slot.bg) _drawBtnRounded(slot.bg, slot.x, slot.y, ABILITY_SLOT.size, ABILITY_SLOT.size, ABILITY_SLOT.radius, slotColor);
        if (slot.label) slot.label.setText(activeBranchId.charAt(0).toUpperCase());
      }
    },
  });

  function _createNode(scene, nx, ny, talent, branchId) {
    var gfx = scene.add.graphics();
    _drawBtnRounded(gfx, nx, ny, BRANCH.nodeSize, BRANCH.nodeSize, BRANCH.nodeRadius, BRANCH.nodeBg);

    var uiInfo = null;
    if (_api && typeof _api.getTalentUi === 'function') uiInfo = _api.getTalentUi(talent.id);
    var nameKey = (uiInfo && uiInfo.nameKey) ? uiInfo.nameKey : talent.id;
    var displayName = _translate ? (_translate(nameKey) || nameKey) : nameKey;

    var text = scene.add.text(nx, ny - 4, displayName, TEXT_STYLE.nodeName).setOrigin(0.5);
    // Truncate to fit
    if (text.width > BRANCH.nodeSize + 20) text.setFontSize(8);

    var rankText = scene.add.text(nx, ny + 10, '0/' + (talent.maxRank || 5), TEXT_STYLE.nodeRank).setOrigin(0.5);

    var zone = scene.add.zone(nx, ny, BRANCH.nodeSize + 4, BRANCH.nodeSize + 4).setInteractive({ useHandCursor: true });

    zone.on('pointerover', function () {
      _drawBtnRounded(gfx, nx, ny, BRANCH.nodeSize, BRANCH.nodeSize, BRANCH.nodeRadius, BRANCH.nodeHover);
      _showTooltip(scene, nx + BRANCH.nodeSize / 2 + 8, ny, talent);
    });
    zone.on('pointerout', function () {
      // Color will be corrected by next refreshState
      _drawBtnRounded(gfx, nx, ny, BRANCH.nodeSize, BRANCH.nodeSize, BRANCH.nodeRadius, BRANCH.nodeBg);
      _hideTooltip();
    });
    zone.on('pointerdown', function () {
      if (typeof _callbacks.onNodeClick === 'function') _callbacks.onNodeClick(talent.id);
    });

    return {
      gfx: gfx,
      text: text,
      rankText: rankText,
      zone: zone,
      talentId: talent.id,
      branchId: branchId,
      maxRank: talent.maxRank || 5,
      x: nx,
      y: ny,
    };
  }

  function _drawEdges(gfx, talents, positions) {
    gfx.clear();
    gfx.lineStyle(BRANCH.edgeWidth, BRANCH.edgeColor, 0.6);
    for (var i = 0; i < talents.length; i++) {
      var t = talents[i];
      var reqs = t.requires || [];
      var pos = positions[t.id];
      if (!pos) continue;
      for (var r = 0; r < reqs.length; r++) {
        var reqPos = positions[reqs[r]];
        if (!reqPos) continue;
        gfx.beginPath();
        gfx.moveTo(reqPos.x, reqPos.y + BRANCH.nodeSize / 2);
        gfx.lineTo(pos.x, pos.y - BRANCH.nodeSize / 2);
        gfx.strokePath();
      }
    }
  }

  function _showTooltip(scene, tx, ty, talent) {
    if (!_tooltipText || !_tooltipBg) return;
    var uiInfo = null;
    if (_api && typeof _api.getTalentUi === 'function') uiInfo = _api.getTalentUi(talent.id);
    var descKey = (uiInfo && uiInfo.descKey) ? uiInfo.descKey : '';
    var desc = _translate ? (_translate(descKey) || '') : '';
    if (!desc) desc = talent.id;
    var costLine = (talent.costPerRank || 1) + ' ' + (_translate ? (_translate('talentCostPerRank') || 'per rank') : 'per rank');
    _tooltipText.setText(desc + '\n' + costLine);
    _tooltipText.setPosition(tx, ty);
    _tooltipText.setVisible(true);

    var tw = _tooltipText.width + 16;
    var th = _tooltipText.height + 12;
    _tooltipBg.clear();
    _tooltipBg.fillStyle(0x111827, 0.95);
    _tooltipBg.fillRoundedRect(tx - 8, ty - 6, tw, th, 6);
    _tooltipBg.lineStyle(1, 0x44aaff, 0.5);
    _tooltipBg.strokeRoundedRect(tx - 8, ty - 6, tw, th, 6);
    _tooltipBg.setVisible(true);
  }

  function _hideTooltip() {
    if (_tooltipText) _tooltipText.setVisible(false);
    if (_tooltipBg) _tooltipBg.setVisible(false);
  }

  // ── Export ──
  global.Game = global.Game || {};
  global.Game.PhaserScenes = global.Game.PhaserScenes || {};
  global.Game.PhaserScenes.TalentsScene = TalentsScene;
  global.Game.TalentsScene = TalentsScene;
})(window);
