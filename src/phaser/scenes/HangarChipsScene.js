/**
 * HangarChipsScene — Phaser 3 overlay scene for the chip hangar system.
 *
 * Displays the full Hangar/Mods UI with three tabs:
 *   - Cells: 4×4 cell grid (left) + butterfly SVG slot layout + chip list (right)
 *   - Workshop: chip upgrade / chip craft / chip recycle sub-tabs
 *   - Tech Unlock: modifier technology research panel
 *
 * Lifecycle:
 *   1. Launched by SceneOverlayManager / ModalAdapter
 *   2. show(data) populates from HangarChipsUI API
 *   3. Tab switching routes to internal sub-views
 *   4. hide() resets transient state and sleeps the scene
 */
(function (global) {
  'use strict';

  if (typeof Phaser === 'undefined') return;

  // ── Layout ──
  var PANEL = {
    width: 620,
    height: 520,
    radius: 14,
    bgColor: 0x1a2332,
    bgAlpha: 0.97,
    borderColor: 0x44aaff,
    borderWidth: 2,
    backdropAlpha: 0.6,
  };

  var TAB = {
    width: 180,
    height: 36,
    radius: 8,
    gap: 8,
    bgColor: 0x223344,
    hoverColor: 0x2a4455,
    activeColor: 0x44aaff,
    textColor: '#aaaaaa',
    activeTextColor: '#ffffff',
  };

  var CELL = {
    size: 52,
    gap: 6,
    cols: 4,
    rows: 4,
    radius: 6,
    bgColor: 0x223344,
    hoverColor: 0x2a4455,
    selectedColor: 0x44aaff,
    lockedColor: 0x1a1a2a,
    chipInstalledColor: 0x44cc44,
  };

  var BUTTERFLY = {
    width: 240,
    height: 180,
    slotRadius: 4,
    emptyColor: 0x334455,
    filledColor: 0x44aaff,
    redColor: 0xcc4444,
    yellowColor: 0xccaa44,
  };

  var CHIP_LIST = {
    width: 240,
    itemHeight: 36,
    maxVisible: 8,
    radius: 6,
    bgColor: 0x1e2d40,
    hoverColor: 0x2a4455,
    selectedColor: 0x44aaff,
  };

  var TEXT_STYLE = {
    title: { fontFamily: 'Arial, sans-serif', fontSize: '20px', color: '#ffdd44', align: 'center', stroke: '#000', strokeThickness: 2 },
    tabText: { fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#aaaaaa', align: 'center' },
    cellLabel: { fontFamily: 'Arial, sans-serif', fontSize: '10px', color: '#ffffff', align: 'center' },
    cellLevel: { fontFamily: 'Arial, sans-serif', fontSize: '9px', color: '#88bbff', align: 'center' },
    slotLabel: { fontFamily: 'Arial, sans-serif', fontSize: '10px', color: '#cccccc', align: 'center' },
    chipName: { fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#ffffff', align: 'left' },
    chipLevel: { fontFamily: 'Arial, sans-serif', fontSize: '10px', color: '#88bbff', align: 'left' },
    chipMod: { fontFamily: 'Arial, sans-serif', fontSize: '10px', color: '#aaaaaa', align: 'left' },
    sectionTitle: { fontFamily: 'Arial, sans-serif', fontSize: '14px', color: '#88bbff', align: 'center' },
    info: { fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#cccccc', align: 'center', wordWrap: { width: 260 } },
    button: { fontFamily: 'Arial, sans-serif', fontSize: '14px', color: '#ffffff', align: 'center' },
    close: { fontFamily: 'Arial, sans-serif', fontSize: '22px', color: '#cccccc' },
    helpBtn: { fontFamily: 'Arial, sans-serif', fontSize: '18px', color: '#88bbff', align: 'center' },
  };

  // ── Scene-local state ──
  var _backdrop = null;
  var _panelBg = null;
  var _titleText = null;
  var _callbacks = {};
  var _translate = null;
  var _activeTab = 'cells';  // 'cells' | 'workshop' | 'techUnlock'

  // Tab buttons
  var _tabButtons = [];       // [{bg, text, zone, id}]

  // Cells tab
  var _cellObjects = [];      // [{bg, labelText, levelText, zone}] — 16 cells
  var _selectedCellIndex = -1;
  var _butterflyGfx = null;
  var _butterflySlots = [];   // [{gfx, labelText, zone, slotId}] — 6 slots
  var _chipListItems = [];    // [{bg, nameText, levelText, zone}]
  var _chipListScroll = 0;
  var _cellsGroup = null;

  // Workshop tab
  var _workshopGroup = null;
  var _workshopSubTabButtons = [];
  var _workshopActiveSubTab = 'chipUpgrade';
  var _workshopInfoText = null;

  // Tech unlock tab
  var _techGroup = null;
  var _techInfoText = null;
  var _techProgressGfx = null;
  var _techProgressText = null;

  // Data references
  var _api = null;  // hangarChipsUI API ref
  var _cells = [];
  var _playerChips = [];

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

  // ── Tab IDs ──
  var TAB_IDS = ['cells', 'workshop', 'techUnlock'];
  var TAB_I18N = {
    cells: { key: 'hangarTabCells', fallback: 'Cells' },
    workshop: { key: 'hangarTabWorkshop', fallback: 'Workshop' },
    techUnlock: { key: 'hangarTabTechUnlock', fallback: 'Technologies' },
  };

  // ── Workshop sub-tab IDs ──
  var WORKSHOP_SUB_TABS = ['chipUpgrade', 'chipCraft', 'chipRecycle'];
  var WORKSHOP_SUB_I18N = {
    chipUpgrade: { key: 'workshopTabUpgrade', fallback: 'Upgrade' },
    chipCraft: { key: 'workshopTabCraft', fallback: 'Craft' },
    chipRecycle: { key: 'workshopTabRecycle', fallback: 'Recycle' },
  };

  // ── Slot IDs ──
  var SLOT_IDS = ['R1', 'R2', 'Y1', 'Y2', 'Y3', 'Y4'];

  var HangarChipsScene = new Phaser.Class({
    Extends: Phaser.Scene,

    initialize: function HangarChipsScene() {
      Phaser.Scene.call(this, { key: 'HangarChipsScene' });
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
      _titleText = this.add.text(cx, cy - PANEL.height / 2 + 28, 'Hangar / Mods', TEXT_STYLE.title).setOrigin(0.5);

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

      // ── Help button ──
      var helpX = cx - PANEL.width / 2 + 32;
      var helpY = cy - PANEL.height / 2 + 22;
      var helpBg = this.add.graphics();
      helpBg.fillStyle(0x334455, 0.98);
      helpBg.fillRoundedRect(helpX - 16, helpY - 16, 32, 32, 8);
      var helpTxt = this.add.text(helpX, helpY, '?', TEXT_STYLE.helpBtn).setOrigin(0.5);
      var helpZone = this.add.zone(helpX, helpY, 44, 44).setInteractive({ useHandCursor: true });
      helpZone.on('pointerover', function () { helpTxt.setColor('#ffffff'); helpBg.clear(); helpBg.fillStyle(0x445566, 0.98); helpBg.fillRoundedRect(helpX - 16, helpY - 16, 32, 32, 8); });
      helpZone.on('pointerout', function () { helpTxt.setColor('#88bbff'); helpBg.clear(); helpBg.fillStyle(0x334455, 0.98); helpBg.fillRoundedRect(helpX - 16, helpY - 16, 32, 32, 8); });
      helpZone.on('pointerdown', function () {
        if (typeof _callbacks.onHelp === 'function') _callbacks.onHelp();
      });

      // ── Tabs ──
      _tabButtons = [];
      var tabStartX = cx - (TAB_IDS.length * (TAB.width + TAB.gap) - TAB.gap) / 2 + TAB.width / 2;
      var tabY = cy - PANEL.height / 2 + 62;
      for (var ti = 0; ti < TAB_IDS.length; ti++) {
        var tabX = tabStartX + ti * (TAB.width + TAB.gap);
        _tabButtons.push(_createTab(self, tabX, tabY, TAB_IDS[ti]));
      }

      // ── Cells tab content ──
      var panelL = cx - PANEL.width / 2 + 16;
      var panelR = cx + PANEL.width / 2 - 16;
      var contentTop = tabY + TAB.height / 2 + 12;

      // Cell grid (left side)
      _cellObjects = [];
      var gridW = CELL.cols * (CELL.size + CELL.gap) - CELL.gap;
      var gridStartX = panelL + gridW / 2 - (CELL.cols * (CELL.size + CELL.gap) - CELL.gap) / 2 + CELL.size / 2;
      for (var row = 0; row < CELL.rows; row++) {
        for (var col = 0; col < CELL.cols; col++) {
          var cellIdx = row * CELL.cols + col;
          var cellX = panelL + col * (CELL.size + CELL.gap) + CELL.size / 2;
          var cellY = contentTop + row * (CELL.size + CELL.gap) + CELL.size / 2;
          _cellObjects.push(_createCell(self, cellX, cellY, cellIdx));
        }
      }

      // Butterfly slot layout (right side, top)
      var rightCx = panelL + gridW + 40 + (panelR - panelL - gridW - 40) / 2;
      var butterflyY = contentTop + 50;
      _butterflyGfx = this.add.graphics();
      _butterflySlots = [];
      for (var si = 0; si < SLOT_IDS.length; si++) {
        _butterflySlots.push(_createSlot(self, rightCx, butterflyY, si));
      }

      // Chip inventory list (right side, below butterfly)
      var chipListTop = contentTop + 140;
      _chipListItems = [];
      for (var ci = 0; ci < CHIP_LIST.maxVisible; ci++) {
        var chipY = chipListTop + ci * CHIP_LIST.itemHeight;
        _chipListItems.push(_createChipListItem(self, rightCx, chipY, ci));
      }

      // ── Workshop tab content ──
      _workshopSubTabButtons = [];
      var wsTabY = contentTop + 8;
      var wsTotalW = WORKSHOP_SUB_TABS.length * (120 + 6) - 6;
      var wsTabStartX = cx - wsTotalW / 2 + 60;
      for (var wsi = 0; wsi < WORKSHOP_SUB_TABS.length; wsi++) {
        var wsX = wsTabStartX + wsi * 126;
        _workshopSubTabButtons.push(_createWorkshopSubTab(self, wsX, wsTabY, WORKSHOP_SUB_TABS[wsi]));
      }
      _workshopInfoText = this.add.text(cx, contentTop + 200, '', TEXT_STYLE.info).setOrigin(0.5);

      // ── Tech unlock tab content ──
      _techInfoText = this.add.text(cx, contentTop + 40, '', TEXT_STYLE.info).setOrigin(0.5);
      _techProgressGfx = this.add.graphics();
      _techProgressText = this.add.text(cx, contentTop + 80, '', TEXT_STYLE.info).setOrigin(0.5);

      // Signal readiness
      var overlayMgr = global.Game && global.Game.SceneOverlayManager;
      if (overlayMgr && typeof overlayMgr.onSceneCreated === 'function') {
        overlayMgr.onSceneCreated('HangarChipsScene');
      }

      this._setAllVisible(false);
    },

    _setAllVisible: function (visible) {
      this.children.each(function (child) {
        if (child && typeof child.setVisible === 'function') child.setVisible(visible);
      });
    },

    /**
     * Show hangar chips UI.
     * @param {Object} [data]
     * @param {Function} [data.onClose]      — back/close callback
     * @param {Function} [data.onHelp]       — help button callback
     * @param {Function} [data.onCellSelect] — cell selection callback(cellIndex)
     * @param {Function} [data.onSlotSelect] — slot selection callback(slotId)
     * @param {Function} [data.onChipSelect] — chip list selection callback(chipIdx)
     * @param {Function} [data.onInstallChip] — install chip callback(cellIdx, slotId, chipIdx)
     * @param {Function} [data.onTabSwitch]  — tab switch callback(tabId)
     * @param {Function} [data.translate]
     * @param {Array}    [data.cells]        — current cell states
     * @param {Array}    [data.playerChips]  — owned chip list
     * @param {number}   [data.selectedCell] — pre-selected cell index
     * @param {Object}   [data.api]          — HangarChipsUI API reference
     */
    show: function (data) {
      data = data || {};
      _translate = data.translate || function (k) { return k; };
      _callbacks = {
        onClose: data.onClose || null,
        onHelp: data.onHelp || null,
        onCellSelect: data.onCellSelect || null,
        onSlotSelect: data.onSlotSelect || null,
        onChipSelect: data.onChipSelect || null,
        onInstallChip: data.onInstallChip || null,
        onTabSwitch: data.onTabSwitch || null,
      };
      _api = data.api || null;
      _cells = data.cells || [];
      _playerChips = data.playerChips || [];
      _selectedCellIndex = typeof data.selectedCell === 'number' ? data.selectedCell : -1;
      _activeTab = 'cells';
      _workshopActiveSubTab = 'chipUpgrade';
      _chipListScroll = 0;

      // Populate title
      if (_titleText) _titleText.setText(_translate('hangarTitle') || 'Hangar / Mods');

      // Update tab labels
      this._refreshTabs();

      this._setAllVisible(true);
      this._showTab('cells');
      this._refreshCells();
      this._refreshSlots();
      this._refreshChipList();
    },

    hide: function () {
      this._setAllVisible(false);
      _callbacks = {};
      _translate = null;
      _api = null;
      _cells = [];
      _playerChips = [];
      _selectedCellIndex = -1;
      _activeTab = 'cells';
      _workshopActiveSubTab = 'chipUpgrade';
      _chipListScroll = 0;
    },

    shutdown: function () {
      _backdrop = null;
      _panelBg = null;
      _titleText = null;
      _callbacks = {};
      _tabButtons = [];
      _cellObjects = [];
      _butterflyGfx = null;
      _butterflySlots = [];
      _chipListItems = [];
      _workshopSubTabButtons = [];
      _workshopInfoText = null;
      _techInfoText = null;
      _techProgressGfx = null;
      _techProgressText = null;
    },

    // ── Tab management ──

    _refreshTabs: function () {
      var t = _translate || function (k) { return k; };
      for (var i = 0; i < _tabButtons.length; i++) {
        var tab = _tabButtons[i];
        var info = TAB_I18N[tab.id];
        var isActive = tab.id === _activeTab;
        if (tab.text) tab.text.setText(t(info.key) || info.fallback);
        if (tab.text) tab.text.setColor(isActive ? TAB.activeTextColor : TAB.textColor);
        if (tab.bg) _drawBtnRounded(tab.bg, tab.cx, tab.cy, TAB.width, TAB.height, TAB.radius, isActive ? TAB.activeColor : TAB.bgColor);
      }
    },

    _showTab: function (tabId) {
      _activeTab = tabId;
      this._refreshTabs();

      // Visibility: cells tab
      var showCells = tabId === 'cells';
      for (var i = 0; i < _cellObjects.length; i++) {
        _setObjGroupVisible(_cellObjects[i], showCells);
      }
      for (var j = 0; j < _butterflySlots.length; j++) {
        _setObjGroupVisible(_butterflySlots[j], showCells);
      }
      if (_butterflyGfx) _butterflyGfx.setVisible(showCells);
      for (var k = 0; k < _chipListItems.length; k++) {
        _setObjGroupVisible(_chipListItems[k], showCells);
      }

      // Visibility: workshop tab
      var showWorkshop = tabId === 'workshop';
      for (var w = 0; w < _workshopSubTabButtons.length; w++) {
        _setObjGroupVisible(_workshopSubTabButtons[w], showWorkshop);
      }
      if (_workshopInfoText) _workshopInfoText.setVisible(showWorkshop);

      // Visibility: tech tab
      var showTech = tabId === 'techUnlock';
      if (_techInfoText) _techInfoText.setVisible(showTech);
      if (_techProgressGfx) _techProgressGfx.setVisible(showTech);
      if (_techProgressText) _techProgressText.setVisible(showTech);

      // Populate active tab
      if (showWorkshop) this._refreshWorkshop();
      if (showTech) this._refreshTech();
    },

    // ── Cell grid ──

    _refreshCells: function () {
      for (var i = 0; i < _cellObjects.length && i < 16; i++) {
        var cell = _cellObjects[i];
        var data = (i < _cells.length) ? _cells[i] : null;
        var isLocked = !data || data.locked;
        var isSelected = i === _selectedCellIndex;
        var hasChips = data && data.installedChips && data.installedChips > 0;

        var color = isLocked ? CELL.lockedColor :
          isSelected ? CELL.selectedColor :
            hasChips ? CELL.chipInstalledColor : CELL.bgColor;
        _drawBtnRounded(cell.bg, cell.cx, cell.cy, CELL.size, CELL.size, CELL.radius, color);

        if (cell.labelText) cell.labelText.setText(isLocked ? '🔒' : '' + (i + 1));
        if (cell.levelText) {
          cell.levelText.setText(data && data.level ? 'Lv.' + data.level : '');
          cell.levelText.setVisible(!isLocked);
        }
      }
    },

    _selectCell: function (index) {
      _selectedCellIndex = index;
      this._refreshCells();
      this._refreshSlots();
      this._refreshChipList();
      if (typeof _callbacks.onCellSelect === 'function') _callbacks.onCellSelect(index);
    },

    // ── Butterfly slots ──

    _refreshSlots: function () {
      var t = _translate || function (k) { return k; };
      var cellData = (_selectedCellIndex >= 0 && _selectedCellIndex < _cells.length) ? _cells[_selectedCellIndex] : null;
      var slots = (cellData && cellData.slots) ? cellData.slots : {};

      // Slot positions relative to butterfly center (simple hex layout)
      var offsets = [
        { x: -30, y: -30 }, // R1
        { x: 30, y: -30 },  // R2
        { x: -60, y: 20 },  // Y1
        { x: 0, y: 20 },    // Y2
        { x: 60, y: 20 },   // Y3 (was outside, moved)
        { x: 0, y: 60 },    // Y4
      ];

      for (var i = 0; i < _butterflySlots.length; i++) {
        var slot = _butterflySlots[i];
        var slotId = SLOT_IDS[i];
        var slotData = slots[slotId] || null;
        var isFilled = slotData && slotData.chipId;
        var isRed = slotId.charAt(0) === 'R';

        var color = isFilled ? (isRed ? BUTTERFLY.redColor : BUTTERFLY.yellowColor) : BUTTERFLY.emptyColor;
        if (slot.gfx) {
          slot.gfx.clear();
          slot.gfx.fillStyle(color, 1);
          slot.gfx.fillRoundedRect(-14, -14, 28, 28, BUTTERFLY.slotRadius);
        }
        if (slot.labelText) slot.labelText.setText(slotId);
      }
    },

    // ── Chip list ──

    _refreshChipList: function () {
      var chips = _playerChips || [];
      for (var i = 0; i < _chipListItems.length; i++) {
        var item = _chipListItems[i];
        var chipIdx = _chipListScroll + i;
        var hasChip = chipIdx < chips.length;

        _setObjGroupVisible(item, hasChip && _activeTab === 'cells');
        if (hasChip) {
          var chip = chips[chipIdx];
          if (item.nameText) item.nameText.setText(chip.name || ('Chip ' + (chipIdx + 1)));
          if (item.levelText) item.levelText.setText('Lv.' + (chip.level || 1));
        }
      }
    },

    // ── Workshop tab ──

    _refreshWorkshop: function () {
      var t = _translate || function (k) { return k; };
      for (var i = 0; i < _workshopSubTabButtons.length; i++) {
        var stab = _workshopSubTabButtons[i];
        var stabInfo = WORKSHOP_SUB_I18N[stab.id];
        var isActive = stab.id === _workshopActiveSubTab;
        if (stab.text) stab.text.setText(t(stabInfo.key) || stabInfo.fallback);
        if (stab.text) stab.text.setColor(isActive ? TAB.activeTextColor : TAB.textColor);
        if (stab.bg) _drawBtnRounded(stab.bg, stab.cx, stab.cy, 120, 30, 6, isActive ? TAB.activeColor : TAB.bgColor);
      }

      if (_workshopInfoText) {
        var msgs = {
          chipUpgrade: t('workshopUpgradeInfo') || 'Select two same-level chips to merge and upgrade.',
          chipCraft: t('workshopCraftInfo') || 'Combine 3 fragments to craft a new chip.',
          chipRecycle: t('workshopRecycleInfo') || 'Break down chips into fragments or dust.',
        };
        _workshopInfoText.setText(msgs[_workshopActiveSubTab] || '');
      }
    },

    _switchWorkshopSubTab: function (subTabId) {
      _workshopActiveSubTab = subTabId;
      this._refreshWorkshop();
    },

    // ── Tech unlock tab ──

    _refreshTech: function () {
      var t = _translate || function (k) { return k; };
      if (_techInfoText) {
        _techInfoText.setText(t('techUnlockInfo') || 'Feed chips to research new modifier technologies.');
      }
      // Progress bar
      var progress = 0;
      if (_api && typeof _api.getTechFeedProgress === 'function') {
        progress = _api.getTechFeedProgress() || 0;
      }
      if (_techProgressGfx) {
        var barW = 280;
        var barH = 16;
        var barX = this.scale.width / 2 - barW / 2;
        var barY = this.scale.height / 2 - PANEL.height / 2 + 130;
        _techProgressGfx.clear();
        _techProgressGfx.fillStyle(0x223344, 1);
        _techProgressGfx.fillRoundedRect(barX, barY, barW, barH, 4);
        _techProgressGfx.fillStyle(0x44aaff, 1);
        var fillW = Math.max(0, Math.min(1, progress)) * barW;
        if (fillW > 0) _techProgressGfx.fillRoundedRect(barX, barY, fillW, barH, 4);
      }
      if (_techProgressText) {
        _techProgressText.setText(Math.round(progress * 100) + '%');
      }
    },
  });

  // ── Helper creators ──

  function _createTab(scene, x, y, tabId) {
    var bg = scene.add.graphics();
    _drawBtnRounded(bg, x, y, TAB.width, TAB.height, TAB.radius, TAB.bgColor);
    var text = scene.add.text(x, y, tabId, TEXT_STYLE.tabText).setOrigin(0.5);
    var zone = scene.add.zone(x, y, TAB.width, TAB.height).setInteractive({ useHandCursor: true });
    zone.on('pointerover', function () {
      if (_activeTab !== tabId) _drawBtnRounded(bg, x, y, TAB.width, TAB.height, TAB.radius, TAB.hoverColor);
    });
    zone.on('pointerout', function () {
      _drawBtnRounded(bg, x, y, TAB.width, TAB.height, TAB.radius, _activeTab === tabId ? TAB.activeColor : TAB.bgColor);
    });
    zone.on('pointerdown', function () {
      if (scene._showTab) scene._showTab(tabId);
      if (typeof _callbacks.onTabSwitch === 'function') _callbacks.onTabSwitch(tabId);
    });
    return { bg: bg, text: text, zone: zone, id: tabId, cx: x, cy: y };
  }

  function _createCell(scene, x, y, cellIdx) {
    var bg = scene.add.graphics();
    _drawBtnRounded(bg, x, y, CELL.size, CELL.size, CELL.radius, CELL.bgColor);
    var labelText = scene.add.text(x, y - 6, '' + (cellIdx + 1), TEXT_STYLE.cellLabel).setOrigin(0.5);
    var levelText = scene.add.text(x, y + 10, '', TEXT_STYLE.cellLevel).setOrigin(0.5);
    var zone = scene.add.zone(x, y, CELL.size, CELL.size).setInteractive({ useHandCursor: true });
    zone.on('pointerover', function () {
      if (_selectedCellIndex !== cellIdx) _drawBtnRounded(bg, x, y, CELL.size, CELL.size, CELL.radius, CELL.hoverColor);
    });
    zone.on('pointerout', function () {
      var color = _selectedCellIndex === cellIdx ? CELL.selectedColor : CELL.bgColor;
      _drawBtnRounded(bg, x, y, CELL.size, CELL.size, CELL.radius, color);
    });
    zone.on('pointerdown', function () {
      if (scene._selectCell) scene._selectCell(cellIdx);
    });
    return { bg: bg, labelText: labelText, levelText: levelText, zone: zone, cx: x, cy: y };
  }

  function _createSlot(scene, baseCx, baseCy, slotIndex) {
    // Simple grid layout for 6 slots (2 rows of 3)
    var col = slotIndex % 3;
    var row = Math.floor(slotIndex / 3);
    var sx = baseCx + (col - 1) * 46;
    var sy = baseCy + row * 46;

    var gfx = scene.add.graphics();
    gfx.fillStyle(BUTTERFLY.emptyColor, 1);
    gfx.fillRoundedRect(sx - 14, sy - 14, 28, 28, BUTTERFLY.slotRadius);

    var labelText = scene.add.text(sx, sy, SLOT_IDS[slotIndex], TEXT_STYLE.slotLabel).setOrigin(0.5);
    var zone = scene.add.zone(sx, sy, 28, 28).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', function () {
      if (typeof _callbacks.onSlotSelect === 'function') _callbacks.onSlotSelect(SLOT_IDS[slotIndex]);
    });

    return { gfx: gfx, labelText: labelText, zone: zone, slotId: SLOT_IDS[slotIndex], cx: sx, cy: sy };
  }

  function _createChipListItem(scene, baseCx, y, localIdx) {
    var bg = scene.add.graphics();
    bg.fillStyle(CHIP_LIST.bgColor, 1);
    bg.fillRoundedRect(baseCx - CHIP_LIST.width / 2, y - CHIP_LIST.itemHeight / 2, CHIP_LIST.width, CHIP_LIST.itemHeight, CHIP_LIST.radius);
    var nameText = scene.add.text(baseCx - CHIP_LIST.width / 2 + 10, y - 6, '', TEXT_STYLE.chipName).setOrigin(0, 0.5);
    var levelText = scene.add.text(baseCx + CHIP_LIST.width / 2 - 10, y - 6, '', TEXT_STYLE.chipLevel).setOrigin(1, 0.5);
    var zone = scene.add.zone(baseCx, y, CHIP_LIST.width, CHIP_LIST.itemHeight).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', function () {
      if (typeof _callbacks.onChipSelect === 'function') _callbacks.onChipSelect(_chipListScroll + localIdx);
    });
    return { bg: bg, nameText: nameText, levelText: levelText, zone: zone };
  }

  function _createWorkshopSubTab(scene, x, y, subTabId) {
    var bg = scene.add.graphics();
    _drawBtnRounded(bg, x, y, 120, 30, 6, TAB.bgColor);
    var text = scene.add.text(x, y, subTabId, { fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#aaaaaa', align: 'center' }).setOrigin(0.5);
    var zone = scene.add.zone(x, y, 120, 30).setInteractive({ useHandCursor: true });
    zone.on('pointerover', function () {
      if (_workshopActiveSubTab !== subTabId) _drawBtnRounded(bg, x, y, 120, 30, 6, TAB.hoverColor);
    });
    zone.on('pointerout', function () {
      _drawBtnRounded(bg, x, y, 120, 30, 6, _workshopActiveSubTab === subTabId ? TAB.activeColor : TAB.bgColor);
    });
    zone.on('pointerdown', function () {
      if (scene._switchWorkshopSubTab) scene._switchWorkshopSubTab(subTabId);
    });
    return { bg: bg, text: text, zone: zone, id: subTabId, cx: x, cy: y };
  }

  // ── Visibility helpers ──

  function _setObjGroupVisible(obj, visible) {
    if (!obj) return;
    for (var key in obj) {
      if (obj.hasOwnProperty(key) && obj[key] && typeof obj[key].setVisible === 'function') {
        obj[key].setVisible(visible);
      }
    }
  }

  // ── Export ──
  global.Game = global.Game || {};
  global.Game.PhaserScenes = global.Game.PhaserScenes || {};
  global.Game.PhaserScenes.HangarChipsScene = HangarChipsScene;
  global.Game.HangarChipsScene = HangarChipsScene;
})(window);
