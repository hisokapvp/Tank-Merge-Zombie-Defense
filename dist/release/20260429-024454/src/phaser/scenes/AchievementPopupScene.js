/**
 * AchievementPopupScene — Phaser 3 overlay for achievement-unlock popup.
 *
 * Shows when an achievement is unlocked: name, condition, reward,
 * and Claim / Dismiss buttons.
 *
 * Lifecycle:
 *   1. Launched by SceneOverlayManager / ModalAdapter on achievement unlock
 *   2. show(data) populates from achievement definition
 *   3. Claim or dismiss triggers callback and hides
 *   4. hide() clears and sleeps the scene
 */
(function (global) {
  'use strict';

  if (typeof Phaser === 'undefined') return;

  // ── Layout ──
  var PANEL = {
    width: 340,
    height: 260,
    radius: 14,
    bgColor: 0x1a2332,
    bgAlpha: 0.97,
    borderColor: 0x44cc44,
    borderWidth: 2,
    shadowColor: 0x000000,
    shadowAlpha: 0.5,
    backdropAlpha: 0.5,
  };

  var BTN = {
    width: 130,
    height: 36,
    radius: 8,
  };

  var TEXT_STYLE = {
    title: { fontFamily: 'Arial, sans-serif', fontSize: '18px', color: '#ffdd44', align: 'center', stroke: '#000', strokeThickness: 2, wordWrap: { width: PANEL.width - 40 } },
    name: { fontFamily: 'Arial, sans-serif', fontSize: '16px', color: '#ffffff', align: 'center', wordWrap: { width: PANEL.width - 40 } },
    meta: { fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#aaaaaa', align: 'center', wordWrap: { width: PANEL.width - 40 } },
    button: { fontFamily: 'Arial, sans-serif', fontSize: '14px', color: '#ffffff', align: 'center' },
    close: { fontFamily: 'Arial, sans-serif', fontSize: '22px', color: '#cccccc' },
  };

  // ── Scene-local state ──
  var _backdrop = null;
  var _panelBg = null;
  var _titleText = null;
  var _nameText = null;
  var _conditionText = null;
  var _rewardText = null;
  var _claimBtnBg = null;
  var _claimBtnText = null;
  var _dismissBtnBg = null;
  var _dismissBtnText = null;
  var _onClaim = null;
  var _onDismiss = null;

  var AchievementPopupScene = new Phaser.Class({
    Extends: Phaser.Scene,

    initialize: function AchievementPopupScene() {
      Phaser.Scene.call(this, { key: 'AchievementPopupScene' });
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
        if (typeof _onDismiss === 'function') _onDismiss();
      });

      // ── Panel ──
      _panelBg = this.add.graphics();
      _drawPanel(_panelBg, cx, cy);
      var panelZone = this.add.zone(cx, cy, PANEL.width, PANEL.height).setInteractive();
      panelZone.on('pointerdown', function (ptr, x, y, evt) { if (evt) evt.stopPropagation(); });

      // ── Title ──
      _titleText = this.add.text(cx, cy - PANEL.height / 2 + 30, '', TEXT_STYLE.title).setOrigin(0.5);

      // ── Close (X) button ──
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
        if (typeof _onDismiss === 'function') _onDismiss();
      });

      // ── Achievement name ──
      _nameText = this.add.text(cx, cy - 50, '', TEXT_STYLE.name).setOrigin(0.5);

      // ── Condition text ──
      _conditionText = this.add.text(cx, cy - 20, '', TEXT_STYLE.meta).setOrigin(0.5);

      // ── Reward text ──
      _rewardText = this.add.text(cx, cy + 10, '', TEXT_STYLE.meta).setOrigin(0.5);

      // ── Claim button (green) ──
      var claimX = cx - BTN.width / 2 - 10;
      var btnY = cy + 65;
      _claimBtnBg = this.add.graphics();
      _drawBtn(_claimBtnBg, claimX, btnY, 0x2d8844);
      _claimBtnText = this.add.text(claimX, btnY, 'Claim', TEXT_STYLE.button).setOrigin(0.5);
      var claimZone = this.add.zone(claimX, btnY, BTN.width, BTN.height).setInteractive({ useHandCursor: true });
      claimZone.on('pointerover', function () { _drawBtn(_claimBtnBg, claimX, btnY, 0x3aaa55); });
      claimZone.on('pointerout', function () { _drawBtn(_claimBtnBg, claimX, btnY, 0x2d8844); });
      claimZone.on('pointerdown', function () {
        if (typeof _onClaim === 'function') _onClaim();
      });

      // ── Dismiss button (gray) ──
      var dismissX = cx + BTN.width / 2 + 10;
      _dismissBtnBg = this.add.graphics();
      _drawBtn(_dismissBtnBg, dismissX, btnY, 0x444444);
      _dismissBtnText = this.add.text(dismissX, btnY, 'Close', TEXT_STYLE.button).setOrigin(0.5);
      var dismissZone = this.add.zone(dismissX, btnY, BTN.width, BTN.height).setInteractive({ useHandCursor: true });
      dismissZone.on('pointerover', function () { _drawBtn(_dismissBtnBg, dismissX, btnY, 0x555555); });
      dismissZone.on('pointerout', function () { _drawBtn(_dismissBtnBg, dismissX, btnY, 0x444444); });
      dismissZone.on('pointerdown', function () {
        if (typeof _onDismiss === 'function') _onDismiss();
      });

      // Signal readiness
      var overlayMgr = global.Game && global.Game.SceneOverlayManager;
      if (overlayMgr && typeof overlayMgr.onSceneCreated === 'function') {
        overlayMgr.onSceneCreated('AchievementPopupScene');
      }

      this._setAllVisible(false);
    },

    _setAllVisible: function (visible) {
      this.children.each(function (child) {
        if (child && typeof child.setVisible === 'function') child.setVisible(visible);
      });
    },

    /**
     * Show the achievement unlock popup.
     * @param {Object} [data]
     * @param {string} [data.name] — achievement display name
     * @param {string} [data.condition] — unlock condition text
     * @param {string} [data.reward] — reward description text
     * @param {Function} [data.onClaim] — claim reward callback
     * @param {Function} [data.onDismiss] — dismiss callback
     * @param {Function} [data.translate] — i18n function
     */
    show: function (data) {
      data = data || {};
      _onClaim = data.onClaim || null;
      _onDismiss = data.onDismiss || null;
      var t = data.translate || function (k) { return k; };

      if (_titleText) _titleText.setText(t('achievementUnlockedTitle') || 'Achievement unlocked');
      if (_nameText) _nameText.setText(data.name || '');
      if (_conditionText) _conditionText.setText(data.condition || '');
      if (_rewardText) _rewardText.setText(data.reward || '');
      if (_claimBtnText) _claimBtnText.setText(t('achievementClaim') || 'Claim');
      if (_dismissBtnText) _dismissBtnText.setText(t('menuClose') || 'Close');

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
      _nameText = null;
      _conditionText = null;
      _rewardText = null;
      _claimBtnBg = null;
      _claimBtnText = null;
      _dismissBtnBg = null;
      _dismissBtnText = null;
      _onClaim = null;
      _onDismiss = null;
    },
  });

  // ── Drawing helpers ──
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

  function _drawBtn(gfx, cx, cy, color) {
    if (!gfx) return;
    gfx.clear();
    gfx.fillStyle(color, 1);
    gfx.fillRoundedRect(cx - BTN.width / 2, cy - BTN.height / 2, BTN.width, BTN.height, BTN.radius);
  }

  global.Game = global.Game || {};
  global.Game.PhaserScenes = global.Game.PhaserScenes || {};
  global.Game.PhaserScenes.AchievementPopupScene = AchievementPopupScene;
}(window));
