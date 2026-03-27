/**
 * UndergroundHangarScene — Phaser 3 overlay scene for the underground hangar.
 *
 * Shows:
 *   - Upper hangar grid (15 main cells, skipping cell 15)
 *   - 9 drone slots in 3-rail layout (top/left/right, 3 each)
 *   - Underground storage grid (16 mixed cells: tank or drone)
 *   - Transfer, buy, bulk-buy, auto-merge action buttons
 *   - Cell selection + move/merge affordances
 *
 * Lifecycle:
 *   1. Launched by SceneOverlayManager / ModalAdapter
 *   2. show(data) receives stateRef, callbacks, translate
 *   3. hide() resets selection, sleeps the scene
 */
(function (global) {
  'use strict';

  if (typeof Phaser === 'undefined') return;

  // ── Layout constants ──
  var PANEL = {
    width: 700,
    height: 560,
    radius: 14,
    bgColor: 0x1a2332,
    bgAlpha: 0.97,
    borderColor: 0x44aaff,
    borderWidth: 2,
    backdropAlpha: 0.6,
  };

  var CELL = {
    size: 56,
    gap: 4,
    radius: 8,
    bgColor: 0x223344,
    occupiedColor: 0x2a4455,
    selectedColor: 0x44aaff,
    canMoveColor: 0x226644,
    canMergeColor: 0x886622,
    hoverColor: 0x2a4455,
  };

  var DRONE_CELL = {
    size: 40,
    gap: 4,
    radius: 6,
    bgColor: 0x223344,
    selectedColor: 0x44aaff,
    occupiedColor: 0x2a4455,
  };

  var TEXT_STYLE = {
    title: { fontFamily: 'Arial, sans-serif', fontSize: '18px', color: '#ffdd44', align: 'center', stroke: '#000', strokeThickness: 2 },
    sectionTitle: { fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#88bbff', align: 'center' },
    levelBadge: { fontFamily: 'Arial, sans-serif', fontSize: '9px', color: '#ffffff', align: 'center', stroke: '#000', strokeThickness: 1 },
    button: { fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#ffffff', align: 'center' },
    info: { fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#cccccc', align: 'center', wordWrap: { width: 360 } },
    close: { fontFamily: 'Arial, sans-serif', fontSize: '22px', color: '#cccccc' },
  };

  var BTN = {
    width: 150,
    height: 32,
    radius: 8,
    bgColor: 0x44aaff,
    disabledColor: 0x334466,
    gap: 8,
  };

  var MAIN_GRID_COLS = 5;
  var UNDERGROUND_COLS = 4;
  var UNDERGROUND_ROWS = 4;

  // ── Scene-local state ──
  var _backdrop = null;
  var _panelBg = null;
  var _titleText = null;
  var _callbacks = {};
  var _translate = null;
  var _stateRef = null;
  var _selected = null; // { type: 'main'|'underground'|'drone', index: number }

  // Main cells — pre-allocated render objects
  var _mainCells = [];          // [{bg, levelText, zone, index}], length 15
  var _mainSectionTitle = null;

  // Drone slots — 9 slots in 3 rails
  var _droneCells = [];         // [{bg, levelText, zone, slotIndex}], length 9

  // Underground cells — 16 cells
  var _ugCells = [];            // [{bg, levelText, zone}]
  var _ugSectionTitle = null;

  // Transfer button
  var _transferBtnGfx = null;
  var _transferBtnText = null;
  var _transferBtnZone = null;

  // Action buttons (buy / bulkBuy / autoMerge)
  var _buyBtnGfx = null;
  var _buyBtnText = null;
  var _buyBtnZone = null;
  var _bulkBuyBtnGfx = null;
  var _bulkBuyBtnText = null;
  var _bulkBuyBtnZone = null;
  var _autoMergeBtnGfx = null;
  var _autoMergeBtnText = null;
  var _autoMergeBtnZone = null;

  function _drawRounded(gfx, cx, cy, w, h, r, color, alpha) {
    gfx.clear();
    gfx.fillStyle(color, alpha !== undefined ? alpha : 1);
    gfx.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, r);
  }

  function _drawCell(gfx, cx, cy, size, color) {
    gfx.clear();
    gfx.fillStyle(color, 1);
    gfx.fillRoundedRect(cx - size / 2, cy - size / 2, size, size, CELL.radius);
  }

  function _drawDroneCell(gfx, cx, cy, color) {
    gfx.clear();
    gfx.fillStyle(color, 1);
    gfx.fillRoundedRect(cx - DRONE_CELL.size / 2, cy - DRONE_CELL.size / 2, DRONE_CELL.size, DRONE_CELL.size, DRONE_CELL.radius);
  }

  // ── Entity helpers ──
  function _getEntityAt(type, index) {
    if (!_stateRef) return null;
    if (type === 'main') {
      var cell = (_stateRef.cells || [])[index];
      return cell && cell.tank ? cell.tank : null;
    }
    if (type === 'underground') {
      var ugh = _stateRef.undergroundHangar || {};
      var cell2 = (ugh.cells || [])[index];
      if (!cell2) return null;
      return cell2.tank || cell2.drone || null;
    }
    if (type === 'drone') {
      if (!_stateRef || !Array.isArray(_stateRef.drones)) return null;
      for (var d = 0; d < _stateRef.drones.length; d++) {
        var dr = _stateRef.drones[d];
        if (dr && Number(dr.slotIndex) === index && dr.level) return dr;
      }
      return null;
    }
    return null;
  }

  function _getEntityKindAt(type, index) {
    if (type === 'main') return 'tank';
    if (type === 'drone') return 'drone';
    if (type === 'underground') {
      var ugh = _stateRef && _stateRef.undergroundHangar || {};
      var cell = (ugh.cells || [])[index];
      if (cell && cell.tank) return 'tank';
      if (cell && cell.drone) return 'drone';
      return null;
    }
    return null;
  }

  function _canTypeAcceptKind(type, kind) {
    if (!kind) return false;
    if (type === 'main') return kind === 'tank';
    if (type === 'drone') return kind === 'drone';
    if (type === 'underground') return true;
    return false;
  }

  function _getCellColor(type, index) {
    var entity = _getEntityAt(type, index);
    var isSel = _selected && _selected.type === type && _selected.index === index;
    if (isSel) return CELL.selectedColor;
    if (!_selected || !_getEntityAt(_selected.type, _selected.index)) {
      return entity ? CELL.occupiedColor : CELL.bgColor;
    }
    // Affordance check
    var srcEntity = _getEntityAt(_selected.type, _selected.index);
    var srcKind = _getEntityKindAt(_selected.type, _selected.index);
    if (!entity) {
      return _canTypeAcceptKind(type, srcKind) ? CELL.canMoveColor : CELL.bgColor;
    }
    var tgtKind = _getEntityKindAt(type, index);
    if (srcKind === tgtKind && srcEntity.level === entity.level) return CELL.canMergeColor;
    return CELL.occupiedColor;
  }

  var UndergroundHangarScene = new Phaser.Class({
    Extends: Phaser.Scene,

    initialize: function UndergroundHangarScene() {
      Phaser.Scene.call(this, { key: 'UndergroundHangarScene' });
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
      _panelBg.fillStyle(PANEL.bgColor, PANEL.bgAlpha);
      _panelBg.fillRoundedRect(cx - PANEL.width / 2, cy - PANEL.height / 2, PANEL.width, PANEL.height, PANEL.radius);
      _panelBg.lineStyle(PANEL.borderWidth, PANEL.borderColor, 1);
      _panelBg.strokeRoundedRect(cx - PANEL.width / 2, cy - PANEL.height / 2, PANEL.width, PANEL.height, PANEL.radius);
      var panelZone = this.add.zone(cx, cy, PANEL.width, PANEL.height).setInteractive();
      panelZone.on('pointerdown', function (ptr, lx, ly, evt) { if (evt) evt.stopPropagation(); });

      // ── Title ──
      _titleText = this.add.text(cx, cy - PANEL.height / 2 + 26, 'Underground Hangar', TEXT_STYLE.title).setOrigin(0.5);

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

      // ── Content layout ──
      var leftCol = cx - PANEL.width / 2 + 20;
      var topY = cy - PANEL.height / 2 + 54;

      // ── Main Hangar Section ──
      _mainSectionTitle = this.add.text(cx - 100, topY, 'Upper Hangar', TEXT_STYLE.sectionTitle).setOrigin(0.5);

      _mainCells = [];
      var mainGridLeft = leftCol;
      var mainGridTop = topY + 20;
      var mainIdx = 0;
      for (var i = 0; i < 16; i++) {
        if (i === 15) continue; // skip underground hangar button cell
        var col = mainIdx % MAIN_GRID_COLS;
        var row = Math.floor(mainIdx / MAIN_GRID_COLS);
        var cellX = mainGridLeft + col * (CELL.size + CELL.gap) + CELL.size / 2;
        var cellY = mainGridTop + row * (CELL.size + CELL.gap) + CELL.size / 2;
        var cellObj = _createMainCell(self, cellX, cellY, i);
        _mainCells.push(cellObj);
        mainIdx++;
      }

      // ── Drone Rails ──
      var droneRailX = mainGridLeft + MAIN_GRID_COLS * (CELL.size + CELL.gap) + 20;
      var droneRailTop = mainGridTop;
      _droneCells = [];
      for (var ds = 0; ds < 9; ds++) {
        var drCol = ds % 3;
        var drRow = Math.floor(ds / 3);
        var drX = droneRailX + drCol * (DRONE_CELL.size + DRONE_CELL.gap) + DRONE_CELL.size / 2;
        var drY = droneRailTop + drRow * (DRONE_CELL.size + DRONE_CELL.gap) + DRONE_CELL.size / 2;
        _droneCells.push(_createDroneCell(self, drX, drY, ds));
      }

      // ── Transfer button ──
      var mainGridBottom = mainGridTop + 3 * (CELL.size + CELL.gap);
      var transferY = mainGridBottom + 14;
      _transferBtnGfx = this.add.graphics();
      _drawRounded(_transferBtnGfx, cx - 100, transferY, 120, 28, 8, BTN.bgColor);
      _transferBtnText = this.add.text(cx - 100, transferY, '\u2191 Transfer', TEXT_STYLE.button).setOrigin(0.5);
      _transferBtnZone = this.add.zone(cx - 100, transferY, 120, 28).setInteractive({ useHandCursor: true });
      _transferBtnZone.on('pointerdown', function () {
        if (typeof _callbacks.onTransferAllToUpperHangar === 'function') _callbacks.onTransferAllToUpperHangar();
        self._refreshCells();
      });

      // ── Underground Hangar Section ──
      var ugTop = transferY + 28;
      _ugSectionTitle = this.add.text(cx - 100, ugTop, 'Underground Storage', TEXT_STYLE.sectionTitle).setOrigin(0.5);

      _ugCells = [];
      var ugGridTop = ugTop + 18;
      for (var u = 0; u < 16; u++) {
        var ucol = u % UNDERGROUND_COLS;
        var urow = Math.floor(u / UNDERGROUND_COLS);
        var ucX = mainGridLeft + ucol * (CELL.size + CELL.gap) + CELL.size / 2;
        var ucY = ugGridTop + urow * (CELL.size + CELL.gap) + CELL.size / 2;
        _ugCells.push(_createUndergroundCell(self, ucX, ucY, u));
      }

      // ── Action Buttons (sidebar) ──
      var sideX = cx + PANEL.width / 2 - 100;
      var sideTop = topY + 20;

      _buyBtnGfx = this.add.graphics();
      _drawRounded(_buyBtnGfx, sideX, sideTop, BTN.width, BTN.height, BTN.radius, BTN.bgColor);
      _buyBtnText = this.add.text(sideX, sideTop, 'Buy', TEXT_STYLE.button).setOrigin(0.5);
      _buyBtnZone = this.add.zone(sideX, sideTop, BTN.width, BTN.height).setInteractive({ useHandCursor: true });
      _buyBtnZone.on('pointerdown', function () {
        if (typeof _callbacks.onBuy === 'function') _callbacks.onBuy();
        self._refreshCells();
      });

      _bulkBuyBtnGfx = this.add.graphics();
      _drawRounded(_bulkBuyBtnGfx, sideX, sideTop + BTN.height + BTN.gap, BTN.width, BTN.height, BTN.radius, BTN.bgColor);
      _bulkBuyBtnText = this.add.text(sideX, sideTop + BTN.height + BTN.gap, 'Bulk Buy', TEXT_STYLE.button).setOrigin(0.5);
      _bulkBuyBtnZone = this.add.zone(sideX, sideTop + BTN.height + BTN.gap, BTN.width, BTN.height).setInteractive({ useHandCursor: true });
      _bulkBuyBtnZone.on('pointerdown', function () {
        if (typeof _callbacks.onBuyBulk === 'function') _callbacks.onBuyBulk();
        self._refreshCells();
      });

      _autoMergeBtnGfx = this.add.graphics();
      _drawRounded(_autoMergeBtnGfx, sideX, sideTop + 2 * (BTN.height + BTN.gap), BTN.width, BTN.height, BTN.radius, BTN.bgColor);
      _autoMergeBtnText = this.add.text(sideX, sideTop + 2 * (BTN.height + BTN.gap), 'Auto Merge', TEXT_STYLE.button).setOrigin(0.5);
      _autoMergeBtnZone = this.add.zone(sideX, sideTop + 2 * (BTN.height + BTN.gap), BTN.width, BTN.height).setInteractive({ useHandCursor: true });
      _autoMergeBtnZone.on('pointerdown', function () {
        if (typeof _callbacks.onAutoMerge === 'function') _callbacks.onAutoMerge();
        self._refreshCells();
      });

      // Signal readiness
      var overlayMgr = global.Game && global.Game.SceneOverlayManager;
      if (overlayMgr && typeof overlayMgr.onSceneCreated === 'function') {
        overlayMgr.onSceneCreated('UndergroundHangarScene');
      }

      this._setAllVisible(false);
    },

    _setAllVisible: function (visible) {
      this.children.each(function (child) {
        if (child && typeof child.setVisible === 'function') child.setVisible(visible);
      });
    },

    /**
     * Show underground hangar overlay.
     * @param {Object} [data]
     * @param {Function} [data.onClose]
     * @param {Function} [data.onBuy]
     * @param {Function} [data.onBuyBulk]
     * @param {Function} [data.onAutoMerge]
     * @param {Function} [data.onTransferAllToUpperHangar]
     * @param {Function} [data.onMove]     — (srcType,srcIdx,tgtType,tgtIdx)
     * @param {Function} [data.onMerge]    — (srcType,srcIdx,tgtType,tgtIdx)
     * @param {Function} [data.translate]
     * @param {Object}   [data.stateRef]   — game state (cells, drones, undergroundHangar)
     * @param {Function} [data.getBuyLevel]
     * @param {Function} [data.getBuyCost]
     * @param {Function} [data.getBulkBuyButtonModel]
     * @param {Function} [data.getAutoMergeButtonModel]
     * @param {Function} [data.getTransferAllButtonModel]
     */
    show: function (data) {
      data = data || {};
      _translate = data.translate || function (k) { return k; };
      _stateRef = data.stateRef || null;
      _selected = null;

      _callbacks = {
        onClose: data.onClose || null,
        onBuy: data.onBuy || null,
        onBuyBulk: data.onBuyBulk || null,
        onAutoMerge: data.onAutoMerge || null,
        onTransferAllToUpperHangar: data.onTransferAllToUpperHangar || null,
        onMove: data.onMove || null,
        onMerge: data.onMerge || null,
        getBuyLevel: data.getBuyLevel || null,
        getBuyCost: data.getBuyCost || null,
        getBulkBuyButtonModel: data.getBulkBuyButtonModel || null,
        getAutoMergeButtonModel: data.getAutoMergeButtonModel || null,
        getTransferAllButtonModel: data.getTransferAllButtonModel || null,
      };

      if (_titleText) {
        _titleText.setText(_translate('ughModalTitle') || 'Underground Hangar');
      }
      if (_mainSectionTitle) {
        _mainSectionTitle.setText(_translate('ughMainHangarTitle') || 'Upper Hangar');
      }
      if (_ugSectionTitle) {
        _ugSectionTitle.setText(_translate('ughUndergroundTitle') || 'Underground Storage');
      }

      this._setAllVisible(true);
      this._refreshCells();
      this._refreshButtons();
    },

    hide: function () {
      this._setAllVisible(false);
      _callbacks = {};
      _translate = null;
      _stateRef = null;
      _selected = null;
    },

    shutdown: function () {
      _backdrop = null;
      _panelBg = null;
      _titleText = null;
      _callbacks = {};
      _mainCells = [];
      _droneCells = [];
      _ugCells = [];
      _mainSectionTitle = null;
      _ugSectionTitle = null;
      _transferBtnGfx = null;
      _transferBtnText = null;
      _transferBtnZone = null;
      _buyBtnGfx = null;
      _buyBtnText = null;
      _buyBtnZone = null;
      _bulkBuyBtnGfx = null;
      _bulkBuyBtnText = null;
      _bulkBuyBtnZone = null;
      _autoMergeBtnGfx = null;
      _autoMergeBtnText = null;
      _autoMergeBtnZone = null;
    },

    // ── Cell refresh ──

    _refreshCells: function () {
      var t = _translate || function (k) { return k; };

      // Main cells
      for (var m = 0; m < _mainCells.length; m++) {
        var mc = _mainCells[m];
        var entity = _getEntityAt('main', mc.cellIndex);
        var color = _getCellColor('main', mc.cellIndex);
        _drawCell(mc.bg, mc.cx, mc.cy, CELL.size, color);
        if (mc.levelText) {
          mc.levelText.setText(entity ? ((t('levelShort') || 'Lv') + (entity.level || 1)) : '');
          mc.levelText.setVisible(!!entity);
        }
      }

      // Drone cells
      for (var d = 0; d < _droneCells.length; d++) {
        var dc = _droneCells[d];
        var drone = _getEntityAt('drone', dc.slotIndex);
        var dColor = _getCellColor('drone', dc.slotIndex);
        _drawDroneCell(dc.bg, dc.cx, dc.cy, dColor);
        if (dc.levelText) {
          dc.levelText.setText(drone ? ((t('levelShort') || 'Lv') + (drone.level || 1)) : '');
          dc.levelText.setVisible(!!drone);
        }
      }

      // Underground cells
      for (var u = 0; u < _ugCells.length; u++) {
        var uc = _ugCells[u];
        var ugEntity = _getEntityAt('underground', u);
        var ugColor = _getCellColor('underground', u);
        _drawCell(uc.bg, uc.cx, uc.cy, CELL.size, ugColor);
        if (uc.levelText) {
          var kind = _getEntityKindAt('underground', u);
          var prefix = kind === 'drone' ? 'D' : (t('levelShort') || 'Lv');
          uc.levelText.setText(ugEntity ? (prefix + (ugEntity.level || 1)) : '');
          uc.levelText.setVisible(!!ugEntity);
        }
      }
    },

    // ── Button refresh ──

    _refreshButtons: function () {
      var t = _translate || function (k) { return k; };

      // Buy button
      var buyLevel = (typeof _callbacks.getBuyLevel === 'function') ? _callbacks.getBuyLevel() : 1;
      var buyCost = (typeof _callbacks.getBuyCost === 'function') ? _callbacks.getBuyCost(buyLevel) : 0;
      var buyLabel = (t('ughBuyTank') || 'Buy Lv{level} - ${cost}')
        .replace('{level}', String(buyLevel))
        .replace('{cost}', String(buyCost));
      if (_buyBtnText) _buyBtnText.setText(buyLabel);

      // Bulk buy
      var bulkModel = (typeof _callbacks.getBulkBuyButtonModel === 'function') ? _callbacks.getBulkBuyButtonModel() : null;
      var bulkVisible = bulkModel && bulkModel.visible;
      if (_bulkBuyBtnGfx) _bulkBuyBtnGfx.setVisible(!!bulkVisible);
      if (_bulkBuyBtnText) {
        _bulkBuyBtnText.setVisible(!!bulkVisible);
        if (bulkVisible) _bulkBuyBtnText.setText(bulkModel.label || t('ughBuyBulk') || 'Bulk Buy');
      }
      if (_bulkBuyBtnZone) _bulkBuyBtnZone.setVisible(!!bulkVisible);

      // Auto merge
      var autoModel = (typeof _callbacks.getAutoMergeButtonModel === 'function') ? _callbacks.getAutoMergeButtonModel() : null;
      var autoVisible = autoModel && autoModel.visible;
      if (_autoMergeBtnGfx) _autoMergeBtnGfx.setVisible(!!autoVisible);
      if (_autoMergeBtnText) {
        _autoMergeBtnText.setVisible(!!autoVisible);
        if (autoVisible) _autoMergeBtnText.setText(autoModel.label || t('ughAutoMerge') || 'Auto Merge');
      }
      if (_autoMergeBtnZone) _autoMergeBtnZone.setVisible(!!autoVisible);

      // Transfer
      var transferModel = (typeof _callbacks.getTransferAllButtonModel === 'function') ? _callbacks.getTransferAllButtonModel() : null;
      var transferEnabled = transferModel && transferModel.enabled;
      if (_transferBtnGfx) {
        _drawRounded(_transferBtnGfx, _transferBtnGfx._cx || 0, _transferBtnGfx._cy || 0, 120, 28, 8,
          transferEnabled ? BTN.bgColor : BTN.disabledColor);
      }
      if (_transferBtnText) {
        _transferBtnText.setText('\u2191 ' + (t('ughTransferToUpper') || 'Transfer'));
      }
    },

    // ── Cell selection ──

    _handleCellSelect: function (type, index) {
      var entity = _getEntityAt(type, index);

      // Nothing selected — select if occupied
      if (!_selected) {
        if (entity) _selected = { type: type, index: index };
        this._refreshCells();
        return;
      }

      // Same cell — deselect
      if (_selected.type === type && _selected.index === index) {
        _selected = null;
        this._refreshCells();
        return;
      }

      var srcEntity = _getEntityAt(_selected.type, _selected.index);
      if (!srcEntity) {
        _selected = entity ? { type: type, index: index } : null;
        this._refreshCells();
        return;
      }

      var srcKind = _getEntityKindAt(_selected.type, _selected.index);
      var tgtKind = entity ? _getEntityKindAt(type, index) : null;

      // Empty cell — try move
      if (!entity) {
        if (_canTypeAcceptKind(type, srcKind)) {
          if (typeof _callbacks.onMove === 'function') {
            _callbacks.onMove(_selected.type, _selected.index, type, index);
          }
          _selected = null;
        }
        this._refreshCells();
        return;
      }

      // Different kind — reselect
      if (srcKind !== tgtKind) {
        _selected = { type: type, index: index };
        this._refreshCells();
        return;
      }

      // Same kind, same level — merge
      if (srcEntity.level === entity.level) {
        if (typeof _callbacks.onMerge === 'function') {
          _callbacks.onMerge(_selected.type, _selected.index, type, index);
        }
        _selected = null;
        this._refreshCells();
        return;
      }

      // Different level — reselect
      _selected = { type: type, index: index };
      this._refreshCells();
    },
  });

  // ── Helper creators ──

  function _createMainCell(scene, x, y, cellIndex) {
    var bg = scene.add.graphics();
    _drawCell(bg, x, y, CELL.size, CELL.bgColor);
    var levelText = scene.add.text(x, y + CELL.size / 2 - 8, '', TEXT_STYLE.levelBadge).setOrigin(0.5);
    var zone = scene.add.zone(x, y, CELL.size, CELL.size).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', function () {
      if (scene._handleCellSelect) scene._handleCellSelect('main', cellIndex);
    });
    return { bg: bg, levelText: levelText, zone: zone, cx: x, cy: y, cellIndex: cellIndex };
  }

  function _createDroneCell(scene, x, y, slotIndex) {
    var bg = scene.add.graphics();
    _drawDroneCell(bg, x, y, DRONE_CELL.bgColor);
    var levelText = scene.add.text(x, y + DRONE_CELL.size / 2 - 6, '', TEXT_STYLE.levelBadge).setOrigin(0.5);
    var zone = scene.add.zone(x, y, DRONE_CELL.size, DRONE_CELL.size).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', function () {
      if (scene._handleCellSelect) scene._handleCellSelect('drone', slotIndex);
    });
    return { bg: bg, levelText: levelText, zone: zone, cx: x, cy: y, slotIndex: slotIndex };
  }

  function _createUndergroundCell(scene, x, y, index) {
    var bg = scene.add.graphics();
    _drawCell(bg, x, y, CELL.size, CELL.bgColor);
    var levelText = scene.add.text(x, y + CELL.size / 2 - 8, '', TEXT_STYLE.levelBadge).setOrigin(0.5);
    var zone = scene.add.zone(x, y, CELL.size, CELL.size).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', function () {
      if (scene._handleCellSelect) scene._handleCellSelect('underground', index);
    });
    return { bg: bg, levelText: levelText, zone: zone, cx: x, cy: y };
  }

  // ── Export ──
  global.Game = global.Game || {};
  global.Game.PhaserScenes = global.Game.PhaserScenes || {};
  global.Game.PhaserScenes.UndergroundHangarScene = UndergroundHangarScene;
  global.Game.UndergroundHangarScene = UndergroundHangarScene;
})(window);
