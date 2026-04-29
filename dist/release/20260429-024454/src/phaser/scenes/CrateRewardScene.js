/**
 * CrateRewardScene — Phaser 3 overlay scene for military aid crate modal.
 *
 * Displays a crate reward with: title, tank icon placeholder,
 * description text, dismiss button and claim button.
 *
 * Lifecycle:
 *   1. Launched by SceneOverlayManager / ModalAdapter
 *   2. show(data) populates text and icon info from crate state
 *   3. Claim/dismiss buttons close via callbacks
 *   4. hide() clears and sleeps the scene
 */
(function (global) {
  'use strict';

  if (typeof Phaser === 'undefined') return;

  // ── Layout constants ──
  var PANEL = {
    width: 340,
    height: 300,
    radius: 14,
    bgColor: 0x1a2332,
    bgAlpha: 0.96,
    borderColor: 0x44aaff,
    borderWidth: 2,
    shadowColor: 0x000000,
    shadowAlpha: 0.5,
    backdropColor: 0x050a12,
    backdropAlpha: 0.6,
  };

  var TEXT_STYLE = {
    title: { fontFamily: 'Arial, sans-serif', fontSize: '20px', color: '#ffdd44', align: 'center', stroke: '#000', strokeThickness: 2, wordWrap: { width: PANEL.width - 40 } },
    body: { fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#cccccc', align: 'center', stroke: '#000', strokeThickness: 1, wordWrap: { width: PANEL.width - 40 } },
    button: { fontFamily: 'Arial, sans-serif', fontSize: '15px', color: '#ffffff', align: 'center', stroke: '#000', strokeThickness: 1 },
    buttonSecondary: { fontFamily: 'Arial, sans-serif', fontSize: '14px', color: '#aaaaaa', align: 'center' },
  };

  var BTN_PRIMARY = {
    width: 180,
    height: 38,
    radius: 8,
    bgColor: 0x2d8844,
    hoverColor: 0x3aaa55,
  };

  var BTN_SECONDARY = {
    width: 140,
    height: 34,
    radius: 6,
    bgColor: 0x444444,
    hoverColor: 0x555555,
  };

  // ── Scene-local state ──
  var _backdrop = null;
  var _panelBg = null;
  var _titleText = null;
  var _bodyText = null;
  var _iconGraphics = null;
  var _claimBtnBg = null;
  var _claimBtnText = null;
  var _dismissBtnBg = null;
  var _dismissBtnText = null;
  var _closeBtnBg = null;
  var _closeBtnText = null;
  var _onClaim = null;
  var _onDismiss = null;

  var CrateRewardScene = new Phaser.Class({
    Extends: Phaser.Scene,

    initialize: function CrateRewardScene() {
      Phaser.Scene.call(this, { key: 'CrateRewardScene' });
    },

    create: function () {
      var self = this;
      var w = this.scale.width;
      var h = this.scale.height;
      var cx = w / 2;
      var cy = h / 2;

      // ── Backdrop ──
      _backdrop = this.add.graphics();
      _backdrop.fillStyle(PANEL.backdropColor, PANEL.backdropAlpha);
      _backdrop.fillRect(0, 0, w, h);
      _backdrop.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
      _backdrop.on('pointerdown', function () {
        if (typeof _onDismiss === 'function') _onDismiss();
      });

      // ── Panel background ──
      _panelBg = this.add.graphics();
      _drawPanel(_panelBg, cx, cy);

      // Block clicks on panel from reaching backdrop
      var panelZone = this.add.zone(cx, cy, PANEL.width, PANEL.height).setInteractive();
      panelZone.on('pointerdown', function (ptr, x, y, evt) { if (evt) evt.stopPropagation(); });

      // ── Close (X) button ──
      var closeX = cx + PANEL.width / 2 - 24;
      var closeY = cy - PANEL.height / 2 + 22;
      _closeBtnBg = this.add.graphics();
      _closeBtnBg.fillStyle(0x472d1c, 0.98);
      _closeBtnBg.fillRoundedRect(closeX - 16, closeY - 16, 32, 32, 8);
      _closeBtnText = this.add.text(closeX, closeY, '\u00D7', {
        fontFamily: 'Arial, sans-serif', fontSize: '22px', color: '#cccccc',
      }).setOrigin(0.5);

      var closeZone = this.add.zone(closeX, closeY, 44, 44).setInteractive({ useHandCursor: true });
      closeZone.on('pointerover', function () { _closeBtnText.setColor('#ffffff'); });
      closeZone.on('pointerout', function () { _closeBtnText.setColor('#cccccc'); });
      closeZone.on('pointerdown', function () {
        if (typeof _onDismiss === 'function') _onDismiss();
      });

      // ── Title ──
      _titleText = this.add.text(cx, cy - 110, '', TEXT_STYLE.title).setOrigin(0.5);

      // ── Icon placeholder (colored square representing tank level) ──
      _iconGraphics = this.add.graphics();
      _drawIconPlaceholder(_iconGraphics, cx, cy - 50, 1);

      // ── Body text ──
      _bodyText = this.add.text(cx, cy + 10, '', TEXT_STYLE.body).setOrigin(0.5);

      // ── Claim (primary) button ──
      var claimY = cy + 70;
      _claimBtnBg = this.add.graphics();
      _drawBtn(_claimBtnBg, cx, claimY, BTN_PRIMARY.width, BTN_PRIMARY.height, BTN_PRIMARY.radius, BTN_PRIMARY.bgColor);
      _claimBtnText = this.add.text(cx, claimY, '', TEXT_STYLE.button).setOrigin(0.5);

      var claimZone = this.add.zone(cx, claimY, BTN_PRIMARY.width, BTN_PRIMARY.height).setInteractive({ useHandCursor: true });
      claimZone.on('pointerover', function () { _drawBtn(_claimBtnBg, cx, claimY, BTN_PRIMARY.width, BTN_PRIMARY.height, BTN_PRIMARY.radius, BTN_PRIMARY.hoverColor); });
      claimZone.on('pointerout', function () { _drawBtn(_claimBtnBg, cx, claimY, BTN_PRIMARY.width, BTN_PRIMARY.height, BTN_PRIMARY.radius, BTN_PRIMARY.bgColor); });
      claimZone.on('pointerdown', function () {
        if (typeof _onClaim === 'function') _onClaim();
      });

      // ── Dismiss (secondary) button ──
      var dismissY = cy + 115;
      _dismissBtnBg = this.add.graphics();
      _drawBtn(_dismissBtnBg, cx, dismissY, BTN_SECONDARY.width, BTN_SECONDARY.height, BTN_SECONDARY.radius, BTN_SECONDARY.bgColor);
      _dismissBtnText = this.add.text(cx, dismissY, '', TEXT_STYLE.buttonSecondary).setOrigin(0.5);

      var dismissZone = this.add.zone(cx, dismissY, BTN_SECONDARY.width, BTN_SECONDARY.height).setInteractive({ useHandCursor: true });
      dismissZone.on('pointerover', function () { _drawBtn(_dismissBtnBg, cx, dismissY, BTN_SECONDARY.width, BTN_SECONDARY.height, BTN_SECONDARY.radius, BTN_SECONDARY.hoverColor); });
      dismissZone.on('pointerout', function () { _drawBtn(_dismissBtnBg, cx, dismissY, BTN_SECONDARY.width, BTN_SECONDARY.height, BTN_SECONDARY.radius, BTN_SECONDARY.bgColor); });
      dismissZone.on('pointerdown', function () {
        if (typeof _onDismiss === 'function') _onDismiss();
      });

      // Signal readiness
      var overlayMgr = global.Game && global.Game.SceneOverlayManager;
      if (overlayMgr && typeof overlayMgr.onSceneCreated === 'function') {
        overlayMgr.onSceneCreated('CrateRewardScene');
      }

      // Start hidden
      this._setAllVisible(false);
    },

    _setAllVisible: function (visible) {
      this.children.each(function (child) {
        if (child && typeof child.setVisible === 'function') child.setVisible(visible);
      });
    },

    /**
     * Show the crate reward modal.
     * @param {Object} [data]
     * @param {number} [data.rewardLevel] — tank level for icon
     * @param {Function} [data.onClaim] — called when claim button pressed
     * @param {Function} [data.onDismiss] — called when dismiss/close pressed
     * @param {Function} [data.translate] — i18n function
     */
    show: function (data) {
      data = data || {};
      _onClaim = data.onClaim || null;
      _onDismiss = data.onDismiss || null;
      var t = data.translate || function (k) { return k; };
      var level = data.rewardLevel || 1;

      if (_titleText) _titleText.setText(t('crateModalTitle') || 'Military Aid');
      if (_bodyText) _bodyText.setText(t('crateModalText') || 'An additional tank has been sent');
      if (_claimBtnText) _claimBtnText.setText(t('crateGet') || 'Claim');
      if (_dismissBtnText) _dismissBtnText.setText(t('menuClose') || 'Close');

      // Draw icon with level color
      if (_iconGraphics) {
        var w = this.scale.width;
        var h = this.scale.height;
        _drawIconPlaceholder(_iconGraphics, w / 2, h / 2 - 50, level);
      }

      this._setAllVisible(true);
    },

    hide: function () {
      this._setAllVisible(false);
      _onClaim = null;
      _onDismiss = null;
    },

    shutdown: function () {
      _backdrop = null;
      _panelBg = null;
      _titleText = null;
      _bodyText = null;
      _iconGraphics = null;
      _claimBtnBg = null;
      _claimBtnText = null;
      _dismissBtnBg = null;
      _dismissBtnText = null;
      _closeBtnBg = null;
      _closeBtnText = null;
      _onClaim = null;
      _onDismiss = null;
    },
  });

  // ── Helpers ──
  function _drawPanel(gfx, cx, cy) {
    if (!gfx) return;
    gfx.clear();
    var px = cx - PANEL.width / 2;
    var py = cy - PANEL.height / 2;
    gfx.fillStyle(PANEL.shadowColor, PANEL.shadowAlpha);
    gfx.fillRoundedRect(px + 3, py + 3, PANEL.width, PANEL.height, PANEL.radius);
    gfx.fillStyle(PANEL.bgColor, PANEL.bgAlpha);
    gfx.fillRoundedRect(px, py, PANEL.width, PANEL.height, PANEL.radius);
    gfx.lineStyle(PANEL.borderWidth, PANEL.borderColor, 1);
    gfx.strokeRoundedRect(px, py, PANEL.width, PANEL.height, PANEL.radius);
  }

  function _drawBtn(gfx, cx, cy, w, h, r, color) {
    if (!gfx) return;
    gfx.clear();
    gfx.fillStyle(color, 1);
    gfx.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, r);
  }

  // Tank level → color mapping for the icon placeholder
  var _tankColors = [0x888888, 0x44aa44, 0x44aaff, 0x8844ff, 0xff8844, 0xff4444, 0xffdd44];

  function _drawIconPlaceholder(gfx, cx, cy, level) {
    if (!gfx) return;
    gfx.clear();
    var color = _tankColors[Math.min(level, _tankColors.length) - 1] || 0x888888;
    var size = 64;
    // Tank body shape (simplified)
    gfx.fillStyle(color, 1);
    gfx.fillRoundedRect(cx - size / 2, cy - size / 2, size, size, 8);
    // Level indicator
    gfx.fillStyle(0x000000, 0.4);
    gfx.fillRoundedRect(cx - 12, cy + size / 2 - 20, 24, 16, 4);
  }

  global.Game = global.Game || {};
  global.Game.PhaserScenes = global.Game.PhaserScenes || {};
  global.Game.PhaserScenes.CrateRewardScene = CrateRewardScene;
}(window));
