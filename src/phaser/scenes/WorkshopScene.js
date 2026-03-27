/**
 * WorkshopScene — Phaser 3 overlay scene for the chip workshop.
 *
 * Provides three sub-views:
 *   - Chip Upgrade: merge same-level chips to upgrade
 *   - Chip Craft: combine 3 fragments into a chip
 *   - Chip Recycle: break chips into fragments/dust, reprogram fragments
 *
 * Lifecycle:
 *   1. Launched by SceneOverlayManager / ModalAdapter (usually from HangarChipsScene tab)
 *   2. show(data) populates from HangarChipsUI API
 *   3. Sub-tab switching routes to internal sub-views
 *   4. hide() resets transient state and sleeps the scene
 */
(function (global) {
  'use strict';

  if (typeof Phaser === 'undefined') return;

  // ── Layout ──
  var PANEL = {
    width: 520,
    height: 480,
    radius: 14,
    bgColor: 0x1a2332,
    bgAlpha: 0.97,
    borderColor: 0x44aaff,
    borderWidth: 2,
    backdropAlpha: 0.6,
  };

  var SUB_TAB = {
    width: 140,
    height: 32,
    radius: 8,
    gap: 8,
    bgColor: 0x223344,
    hoverColor: 0x2a4455,
    activeColor: 0x44aaff,
    textColor: '#aaaaaa',
    activeTextColor: '#ffffff',
  };

  var SLOT = {
    size: 56,
    gap: 12,
    radius: 8,
    bgColor: 0x223344,
    filledColor: 0x44aaff,
    hoverColor: 0x2a4455,
  };

  var CHIP_CARD = {
    width: 220,
    height: 44,
    radius: 6,
    bgColor: 0x1e2d40,
    hoverColor: 0x2a4455,
    selectedColor: 0x44aaff,
  };

  var TEXT_STYLE = {
    title: { fontFamily: 'Arial, sans-serif', fontSize: '18px', color: '#ffdd44', align: 'center', stroke: '#000', strokeThickness: 2 },
    subTabText: { fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#aaaaaa', align: 'center' },
    heading: { fontFamily: 'Arial, sans-serif', fontSize: '14px', color: '#88bbff', align: 'center' },
    info: { fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#cccccc', align: 'center', wordWrap: { width: 360 } },
    cardName: { fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#ffffff', align: 'left' },
    cardDetail: { fontFamily: 'Arial, sans-serif', fontSize: '10px', color: '#88bbff', align: 'left' },
    slotLabel: { fontFamily: 'Arial, sans-serif', fontSize: '10px', color: '#aaaaaa', align: 'center' },
    button: { fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#ffffff', align: 'center' },
    resultLabel: { fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#ffdd44', align: 'center' },
    chanceLabel: { fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#cccccc', align: 'center' },
    close: { fontFamily: 'Arial, sans-serif', fontSize: '22px', color: '#cccccc' },
  };

  // Sub-tab IDs
  var SUB_TAB_IDS = ['chipUpgrade', 'chipCraft', 'chipRecycle'];
  var SUB_TAB_I18N = {
    chipUpgrade: { key: 'workshopTabUpgrade', fallback: 'Upgrade' },
    chipCraft: { key: 'workshopTabCraft', fallback: 'Craft' },
    chipRecycle: { key: 'workshopTabRecycle', fallback: 'Recycle' },
  };

  // Recycle sub-tab IDs
  var RECYCLE_SUB_IDS = ['disassemble', 'reprogram', 'dust'];
  var RECYCLE_SUB_I18N = {
    disassemble: { key: 'recycleTabDisassemble', fallback: 'Disassemble' },
    reprogram: { key: 'recycleTabReprogram', fallback: 'Reprogram' },
    dust: { key: 'recycleTabDust', fallback: 'Dust' },
  };

  // ── Scene-local state ──
  var _backdrop = null;
  var _panelBg = null;
  var _titleText = null;
  var _callbacks = {};
  var _translate = null;
  var _activeSubTab = 'chipUpgrade';

  // Sub-tab buttons
  var _subTabButtons = [];

  // Upgrade view
  var _upgradeHeading = null;
  var _upgradeChipCards = [];   // [{bg, nameText, detailText, zone}] pre-allocated
  var _upgradeInfoText = null;
  var MAX_UPGRADE_CARDS = 12;

  // Craft view
  var _craftSlots = [];         // [{bg, labelText, zone}] — 3 reagent slots
  var _craftResultGfx = null;
  var _craftResultLabel = null;
  var _craftChanceText = null;
  var _craftButton = null;
  var _craftButtonGfx = null;
  var _craftInfoText = null;

  // Recycle view
  var _recycleSubButtons = [];
  var _activeRecycleSubTab = 'disassemble';
  var _recycleInfoText = null;

  // Data
  var _api = null;
  var _playerChips = [];
  var _playerFragments = [];

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

  var WorkshopScene = new Phaser.Class({
    Extends: Phaser.Scene,

    initialize: function WorkshopScene() {
      Phaser.Scene.call(this, { key: 'WorkshopScene' });
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
      _titleText = this.add.text(cx, cy - PANEL.height / 2 + 26, 'Workshop', TEXT_STYLE.title).setOrigin(0.5);

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

      // ── Sub-tabs ──
      _subTabButtons = [];
      var tabY = cy - PANEL.height / 2 + 58;
      var totalTabW = SUB_TAB_IDS.length * (SUB_TAB.width + SUB_TAB.gap) - SUB_TAB.gap;
      var tabStartX = cx - totalTabW / 2 + SUB_TAB.width / 2;
      for (var i = 0; i < SUB_TAB_IDS.length; i++) {
        var tabX = tabStartX + i * (SUB_TAB.width + SUB_TAB.gap);
        _subTabButtons.push(_createSubTab(self, tabX, tabY, SUB_TAB_IDS[i]));
      }

      var contentTop = tabY + SUB_TAB.height / 2 + 16;

      // ── Upgrade view ──
      _upgradeHeading = this.add.text(cx, contentTop, '', TEXT_STYLE.heading).setOrigin(0.5);
      _upgradeChipCards = [];
      for (var u = 0; u < MAX_UPGRADE_CARDS; u++) {
        var row = Math.floor(u / 2);
        var col = u % 2;
        var cardX = cx + (col === 0 ? -CHIP_CARD.width / 2 - 4 : CHIP_CARD.width / 2 + 4);
        var cardY = contentTop + 30 + row * (CHIP_CARD.height + 4);
        _upgradeChipCards.push(_createChipCard(self, cardX, cardY, u));
      }
      _upgradeInfoText = this.add.text(cx, contentTop + 30 + 6 * (CHIP_CARD.height + 4) + 10, '', TEXT_STYLE.info).setOrigin(0.5);

      // ── Craft view ──
      _craftSlots = [];
      var craftSlotY = contentTop + 40;
      for (var c = 0; c < 3; c++) {
        var slotX = cx + (c - 1) * (SLOT.size + SLOT.gap);
        _craftSlots.push(_createCraftSlot(self, slotX, craftSlotY, c));
      }
      _craftResultGfx = this.add.graphics();
      _craftResultLabel = this.add.text(cx, craftSlotY + 80, '', TEXT_STYLE.resultLabel).setOrigin(0.5);
      _craftChanceText = this.add.text(cx, craftSlotY + 100, '', TEXT_STYLE.chanceLabel).setOrigin(0.5);
      _craftButtonGfx = this.add.graphics();
      var craftBtnY = craftSlotY + 140;
      _drawBtnRounded(_craftButtonGfx, cx, craftBtnY, 160, 36, 8, 0x44aaff);
      _craftButton = this.add.text(cx, craftBtnY, 'Craft', TEXT_STYLE.button).setOrigin(0.5);
      var craftBtnZone = this.add.zone(cx, craftBtnY, 160, 36).setInteractive({ useHandCursor: true });
      craftBtnZone.on('pointerdown', function () {
        if (typeof _callbacks.onCraft === 'function') _callbacks.onCraft();
      });
      _craftInfoText = this.add.text(cx, craftSlotY + 190, '', TEXT_STYLE.info).setOrigin(0.5);

      // ── Recycle view ──
      _recycleSubButtons = [];
      var recycleTabY = contentTop + 8;
      var recycleTotalW = RECYCLE_SUB_IDS.length * (110 + 6) - 6;
      var recycleStartX = cx - recycleTotalW / 2 + 55;
      for (var r = 0; r < RECYCLE_SUB_IDS.length; r++) {
        var rsX = recycleStartX + r * 116;
        _recycleSubButtons.push(_createRecycleSubTab(self, rsX, recycleTabY, RECYCLE_SUB_IDS[r]));
      }
      _recycleInfoText = this.add.text(cx, contentTop + 200, '', TEXT_STYLE.info).setOrigin(0.5);

      // Signal readiness
      var overlayMgr = global.Game && global.Game.SceneOverlayManager;
      if (overlayMgr && typeof overlayMgr.onSceneCreated === 'function') {
        overlayMgr.onSceneCreated('WorkshopScene');
      }

      this._setAllVisible(false);
    },

    _setAllVisible: function (visible) {
      this.children.each(function (child) {
        if (child && typeof child.setVisible === 'function') child.setVisible(visible);
      });
    },

    /**
     * Show workshop.
     * @param {Object} [data]
     * @param {Function} [data.onClose]
     * @param {Function} [data.onCraft]     — craft button callback
     * @param {Function} [data.onMerge]     — merge/upgrade callback(chipIdxA, chipIdxB)
     * @param {Function} [data.onDisassemble] — disassemble callback(chipIdx)
     * @param {Function} [data.onReprogram] — reprogram callback(fragmentIdx, targetMod)
     * @param {Function} [data.onDust]      — dust conversion callback(chipIdx)
     * @param {Function} [data.translate]
     * @param {Array}    [data.playerChips]
     * @param {Array}    [data.playerFragments]
     * @param {Object}   [data.api]
     * @param {string}   [data.subTab]      — initial sub-tab ('chipUpgrade','chipCraft','chipRecycle')
     */
    show: function (data) {
      data = data || {};
      _translate = data.translate || function (k) { return k; };
      _callbacks = {
        onClose: data.onClose || null,
        onCraft: data.onCraft || null,
        onMerge: data.onMerge || null,
        onDisassemble: data.onDisassemble || null,
        onReprogram: data.onReprogram || null,
        onDust: data.onDust || null,
      };
      _api = data.api || null;
      _playerChips = data.playerChips || [];
      _playerFragments = data.playerFragments || [];
      _activeSubTab = data.subTab || 'chipUpgrade';
      _activeRecycleSubTab = 'disassemble';

      if (_titleText) _titleText.setText(_translate('workshopTitle') || 'Workshop');

      this._setAllVisible(true);
      this._showSubTab(_activeSubTab);
    },

    hide: function () {
      this._setAllVisible(false);
      _callbacks = {};
      _translate = null;
      _api = null;
      _playerChips = [];
      _playerFragments = [];
      _activeSubTab = 'chipUpgrade';
      _activeRecycleSubTab = 'disassemble';
    },

    shutdown: function () {
      _backdrop = null;
      _panelBg = null;
      _titleText = null;
      _callbacks = {};
      _subTabButtons = [];
      _upgradeHeading = null;
      _upgradeChipCards = [];
      _upgradeInfoText = null;
      _craftSlots = [];
      _craftResultGfx = null;
      _craftResultLabel = null;
      _craftChanceText = null;
      _craftButton = null;
      _craftButtonGfx = null;
      _craftInfoText = null;
      _recycleSubButtons = [];
      _recycleInfoText = null;
    },

    // ── Sub-tab management ──

    _showSubTab: function (subTabId) {
      _activeSubTab = subTabId;
      this._refreshSubTabs();

      var isUpgrade = subTabId === 'chipUpgrade';
      var isCraft = subTabId === 'chipCraft';
      var isRecycle = subTabId === 'chipRecycle';

      // Upgrade view visibility
      if (_upgradeHeading) _upgradeHeading.setVisible(isUpgrade);
      for (var u = 0; u < _upgradeChipCards.length; u++) {
        _setObjGroupVisible(_upgradeChipCards[u], isUpgrade);
      }
      if (_upgradeInfoText) _upgradeInfoText.setVisible(isUpgrade);

      // Craft view visibility
      for (var c = 0; c < _craftSlots.length; c++) {
        _setObjGroupVisible(_craftSlots[c], isCraft);
      }
      if (_craftResultGfx) _craftResultGfx.setVisible(isCraft);
      if (_craftResultLabel) _craftResultLabel.setVisible(isCraft);
      if (_craftChanceText) _craftChanceText.setVisible(isCraft);
      if (_craftButtonGfx) _craftButtonGfx.setVisible(isCraft);
      if (_craftButton) _craftButton.setVisible(isCraft);
      if (_craftInfoText) _craftInfoText.setVisible(isCraft);

      // Recycle view visibility
      for (var r = 0; r < _recycleSubButtons.length; r++) {
        _setObjGroupVisible(_recycleSubButtons[r], isRecycle);
      }
      if (_recycleInfoText) _recycleInfoText.setVisible(isRecycle);

      // Populate active view
      if (isUpgrade) this._refreshUpgrade();
      if (isCraft) this._refreshCraft();
      if (isRecycle) this._refreshRecycle();
    },

    _refreshSubTabs: function () {
      var t = _translate || function (k) { return k; };
      for (var i = 0; i < _subTabButtons.length; i++) {
        var tab = _subTabButtons[i];
        var info = SUB_TAB_I18N[tab.id];
        var isActive = tab.id === _activeSubTab;
        if (tab.text) tab.text.setText(t(info.key) || info.fallback);
        if (tab.text) tab.text.setColor(isActive ? SUB_TAB.activeTextColor : SUB_TAB.textColor);
        if (tab.bg) _drawBtnRounded(tab.bg, tab.cx, tab.cy, SUB_TAB.width, SUB_TAB.height, SUB_TAB.radius, isActive ? SUB_TAB.activeColor : SUB_TAB.bgColor);
      }
    },

    // ── Upgrade view ──

    _refreshUpgrade: function () {
      var t = _translate || function (k) { return k; };
      if (_upgradeHeading) _upgradeHeading.setText(t('chipUpgradeHeading') || 'Select chips to merge');

      // Group chips by color+level for merge pairing
      var chips = _playerChips || [];
      var displayIdx = 0;
      for (var i = 0; i < chips.length && displayIdx < MAX_UPGRADE_CARDS; i++) {
        var chip = chips[i];
        var card = _upgradeChipCards[displayIdx];
        if (card) {
          if (card.nameText) card.nameText.setText(chip.name || ('Chip ' + (i + 1)));
          if (card.detailText) card.detailText.setText('Lv.' + (chip.level || 1) + ' ' + (chip.color || ''));
          card.bg.setVisible(true);
          if (card.nameText) card.nameText.setVisible(true);
          if (card.detailText) card.detailText.setVisible(true);
          if (card.zone) card.zone.setVisible(true);
        }
        displayIdx++;
      }
      // Hide remaining slots
      for (var j = displayIdx; j < MAX_UPGRADE_CARDS; j++) {
        _setObjGroupVisible(_upgradeChipCards[j], false);
      }

      if (_upgradeInfoText) {
        _upgradeInfoText.setText(chips.length === 0 ? (t('workshopNoChips') || 'No chips available') : '');
      }
    },

    // ── Craft view ──

    _refreshCraft: function () {
      var t = _translate || function (k) { return k; };
      for (var i = 0; i < _craftSlots.length; i++) {
        var slot = _craftSlots[i];
        if (slot.labelText) slot.labelText.setText(t('craftSlotEmpty') || 'Empty');
        if (slot.bg) {
          slot.bg.clear();
          slot.bg.fillStyle(SLOT.bgColor, 1);
          slot.bg.fillRoundedRect(slot.cx - SLOT.size / 2, slot.cy - SLOT.size / 2, SLOT.size, SLOT.size, SLOT.radius);
        }
      }
      if (_craftResultLabel) _craftResultLabel.setText('');
      if (_craftChanceText) _craftChanceText.setText(t('craftChanceLabel') || 'Success chance: —');
      if (_craftInfoText) {
        _craftInfoText.setText(t('workshopCraftInfo') || 'Place 3 fragments to craft a new chip.');
      }
    },

    // ── Recycle view ──

    _refreshRecycle: function () {
      var t = _translate || function (k) { return k; };
      // Update recycle sub-tab labels
      for (var i = 0; i < _recycleSubButtons.length; i++) {
        var btn = _recycleSubButtons[i];
        var info = RECYCLE_SUB_I18N[btn.id];
        var isActive = btn.id === _activeRecycleSubTab;
        if (btn.text) btn.text.setText(t(info.key) || info.fallback);
        if (btn.text) btn.text.setColor(isActive ? SUB_TAB.activeTextColor : SUB_TAB.textColor);
        if (btn.bg) _drawBtnRounded(btn.bg, btn.cx, btn.cy, 110, 28, 6, isActive ? SUB_TAB.activeColor : SUB_TAB.bgColor);
      }

      if (_recycleInfoText) {
        var recycleMessages = {
          disassemble: t('recycleDisassembleInfo') || 'Break a chip into 3 fragments.',
          reprogram: t('recycleReprogramInfo') || 'Change fragment modifier type using dust.',
          dust: t('recycleDustInfo') || 'Convert chips or fragments into silicon dust.',
        };
        _recycleInfoText.setText(recycleMessages[_activeRecycleSubTab] || '');
      }
    },

    _switchRecycleSubTab: function (subId) {
      _activeRecycleSubTab = subId;
      this._refreshRecycle();
    },
  });

  // ── Helper creators ──

  function _createSubTab(scene, x, y, tabId) {
    var bg = scene.add.graphics();
    _drawBtnRounded(bg, x, y, SUB_TAB.width, SUB_TAB.height, SUB_TAB.radius, SUB_TAB.bgColor);
    var text = scene.add.text(x, y, tabId, TEXT_STYLE.subTabText).setOrigin(0.5);
    var zone = scene.add.zone(x, y, SUB_TAB.width, SUB_TAB.height).setInteractive({ useHandCursor: true });
    zone.on('pointerover', function () {
      if (_activeSubTab !== tabId) _drawBtnRounded(bg, x, y, SUB_TAB.width, SUB_TAB.height, SUB_TAB.radius, SUB_TAB.hoverColor);
    });
    zone.on('pointerout', function () {
      _drawBtnRounded(bg, x, y, SUB_TAB.width, SUB_TAB.height, SUB_TAB.radius, _activeSubTab === tabId ? SUB_TAB.activeColor : SUB_TAB.bgColor);
    });
    zone.on('pointerdown', function () {
      if (scene._showSubTab) scene._showSubTab(tabId);
    });
    return { bg: bg, text: text, zone: zone, id: tabId, cx: x, cy: y };
  }

  function _createChipCard(scene, x, y, idx) {
    var bg = scene.add.graphics();
    bg.fillStyle(CHIP_CARD.bgColor, 1);
    bg.fillRoundedRect(x - CHIP_CARD.width / 2, y - CHIP_CARD.height / 2, CHIP_CARD.width, CHIP_CARD.height, CHIP_CARD.radius);
    var nameText = scene.add.text(x - CHIP_CARD.width / 2 + 10, y - 8, '', TEXT_STYLE.cardName).setOrigin(0, 0.5);
    var detailText = scene.add.text(x - CHIP_CARD.width / 2 + 10, y + 8, '', TEXT_STYLE.cardDetail).setOrigin(0, 0.5);
    var zone = scene.add.zone(x, y, CHIP_CARD.width, CHIP_CARD.height).setInteractive({ useHandCursor: true });
    zone.on('pointerover', function () {
      bg.clear();
      bg.fillStyle(CHIP_CARD.hoverColor, 1);
      bg.fillRoundedRect(x - CHIP_CARD.width / 2, y - CHIP_CARD.height / 2, CHIP_CARD.width, CHIP_CARD.height, CHIP_CARD.radius);
    });
    zone.on('pointerout', function () {
      bg.clear();
      bg.fillStyle(CHIP_CARD.bgColor, 1);
      bg.fillRoundedRect(x - CHIP_CARD.width / 2, y - CHIP_CARD.height / 2, CHIP_CARD.width, CHIP_CARD.height, CHIP_CARD.radius);
    });
    zone.on('pointerdown', function () {
      if (typeof _callbacks.onMerge === 'function') _callbacks.onMerge(idx);
    });
    return { bg: bg, nameText: nameText, detailText: detailText, zone: zone };
  }

  function _createCraftSlot(scene, x, y, slotIndex) {
    var bg = scene.add.graphics();
    bg.fillStyle(SLOT.bgColor, 1);
    bg.fillRoundedRect(x - SLOT.size / 2, y - SLOT.size / 2, SLOT.size, SLOT.size, SLOT.radius);
    var labelText = scene.add.text(x, y, '' + (slotIndex + 1), TEXT_STYLE.slotLabel).setOrigin(0.5);
    var zone = scene.add.zone(x, y, SLOT.size, SLOT.size).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', function () {
      if (typeof _callbacks.onCraft === 'function') _callbacks.onCraft(slotIndex);
    });
    return { bg: bg, labelText: labelText, zone: zone, cx: x, cy: y };
  }

  function _createRecycleSubTab(scene, x, y, subId) {
    var bg = scene.add.graphics();
    _drawBtnRounded(bg, x, y, 110, 28, 6, SUB_TAB.bgColor);
    var text = scene.add.text(x, y, subId, { fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#aaaaaa', align: 'center' }).setOrigin(0.5);
    var zone = scene.add.zone(x, y, 110, 28).setInteractive({ useHandCursor: true });
    zone.on('pointerover', function () {
      if (_activeRecycleSubTab !== subId) _drawBtnRounded(bg, x, y, 110, 28, 6, SUB_TAB.hoverColor);
    });
    zone.on('pointerout', function () {
      _drawBtnRounded(bg, x, y, 110, 28, 6, _activeRecycleSubTab === subId ? SUB_TAB.activeColor : SUB_TAB.bgColor);
    });
    zone.on('pointerdown', function () {
      if (scene._switchRecycleSubTab) scene._switchRecycleSubTab(subId);
    });
    return { bg: bg, text: text, zone: zone, id: subId, cx: x, cy: y };
  }

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
  global.Game.PhaserScenes.WorkshopScene = WorkshopScene;
  global.Game.WorkshopScene = WorkshopScene;
})(window);
