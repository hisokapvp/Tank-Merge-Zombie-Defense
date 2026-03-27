/**
 * LevelUpScene — Phaser 3 overlay scene for level-up reward modal.
 *
 * Displays when the supercomputer levels up: shows level number,
 * reward text (upgrade/damage points + gold), and an accept button.
 *
 * Lifecycle:
 *   1. Launched by SceneOverlayManager / ModalAdapter when level-up occurs
 *   2. show(data) populates text from reward data
 *   3. Accept button closes the modal via onAccept callback
 *   4. hide() clears and sleeps the scene
 */
(function (global) {
  'use strict';

  if (typeof Phaser === 'undefined') return;

  // ── Layout constants ──
  var PANEL = {
    width: 360,
    height: 260,
    radius: 14,
    bgColor: 0x1a2332,
    bgAlpha: 0.96,
    borderColor: 0x44aaff,
    borderWidth: 2,
    shadowColor: 0x000000,
    shadowAlpha: 0.5,
    backdropAlpha: 0.55,
  };

  var TEXT_STYLE = {
    title: { fontFamily: 'Arial, sans-serif', fontSize: '22px', color: '#ffdd44', align: 'center', stroke: '#000', strokeThickness: 2, wordWrap: { width: PANEL.width - 40 } },
    body: { fontFamily: 'Arial, sans-serif', fontSize: '15px', color: '#ffffff', align: 'center', stroke: '#000', strokeThickness: 1, wordWrap: { width: PANEL.width - 40 } },
    button: { fontFamily: 'Arial, sans-serif', fontSize: '16px', color: '#ffffff', align: 'center', stroke: '#000', strokeThickness: 1 },
  };

  var BTN = {
    width: 200,
    height: 40,
    radius: 8,
    bgColor: 0x2d8844,
    hoverColor: 0x3aaa55,
    textColor: '#ffffff',
  };

  // ── Scene-local state ──
  var _backdrop = null;
  var _panelBg = null;
  var _titleText = null;
  var _rewardText1 = null;
  var _rewardText2 = null;
  var _acceptBtnBg = null;
  var _acceptBtnText = null;
  var _closeBtnBg = null;
  var _closeBtnText = null;
  var _onAccept = null;

  var LevelUpScene = new Phaser.Class({
    Extends: Phaser.Scene,

    initialize: function LevelUpScene() {
      Phaser.Scene.call(this, { key: 'LevelUpScene' });
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

      // ── Panel background ──
      _panelBg = this.add.graphics();
      _drawPanel(_panelBg, cx, cy);

      // ── Title ──
      _titleText = this.add.text(cx, cy - 80, '', TEXT_STYLE.title).setOrigin(0.5);

      // ── Reward lines ──
      _rewardText1 = this.add.text(cx, cy - 35, '', TEXT_STYLE.body).setOrigin(0.5);
      _rewardText2 = this.add.text(cx, cy - 5, '', TEXT_STYLE.body).setOrigin(0.5);

      // ── Accept button ──
      var btnY = cy + 60;
      _acceptBtnBg = this.add.graphics();
      _drawButton(_acceptBtnBg, cx, btnY, BTN.bgColor);
      _acceptBtnText = this.add.text(cx, btnY, '', TEXT_STYLE.button).setOrigin(0.5);

      // Button interactivity
      var btnZone = this.add.zone(cx, btnY, BTN.width, BTN.height).setInteractive({ useHandCursor: true });
      btnZone.on('pointerover', function () { _drawButton(_acceptBtnBg, cx, btnY, BTN.hoverColor); });
      btnZone.on('pointerout', function () { _drawButton(_acceptBtnBg, cx, btnY, BTN.bgColor); });
      btnZone.on('pointerdown', function () {
        if (typeof _onAccept === 'function') _onAccept();
      });

      // ── Close (X) button ──
      var closeX = cx + PANEL.width / 2 - 24;
      var closeY = cy - PANEL.height / 2 + 20;
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
        if (typeof _onAccept === 'function') _onAccept();
      });

      // Signal readiness
      var overlayMgr = global.Game && global.Game.SceneOverlayManager;
      if (overlayMgr && typeof overlayMgr.onSceneCreated === 'function') {
        overlayMgr.onSceneCreated('LevelUpScene');
      }

      // Start hidden
      this._setAllVisible(false);
    },

    _setAllVisible: function (visible) {
      var items = [_backdrop, _panelBg, _titleText, _rewardText1, _rewardText2,
        _acceptBtnBg, _acceptBtnText, _closeBtnBg, _closeBtnText];
      for (var i = 0; i < items.length; i++) {
        if (items[i] && typeof items[i].setVisible === 'function') items[i].setVisible(visible);
      }
      // Toggle children interactivity
      this.children.each(function (child) {
        if (child && typeof child.setVisible === 'function') child.setVisible(visible);
      });
    },

    /**
     * Show the level-up modal with reward data.
     * @param {Object} [data]
     * @param {number} [data.level]
     * @param {number} [data.points]
     * @param {number} [data.gold]
     * @param {number} [data.damagePoints]
     * @param {Function} [data.onAccept]
     * @param {Function} [data.translate]
     */
    show: function (data) {
      data = data || {};
      _onAccept = data.onAccept || null;
      var t = data.translate || function (k) { return k; };
      var fmt = data.formatNumber || function (n) { return String(n); };

      var level = data.level || 1;
      var points = data.points || 0;
      var gold = data.gold || 0;
      var damagePoints = data.damagePoints || 0;

      // Title
      var titleKey = t('levelModalTitle') || 'Level {level}!';
      if (_titleText) _titleText.setText(titleKey.replace('{level}', String(level)));

      // Reward line 1: points
      if (_rewardText1) {
        if (damagePoints > 0) {
          var line1Key = t('levelModalTalentWithDamage') || 'Reward: {points} upgrade points and {damagePoints} damage points';
          _rewardText1.setText(line1Key.replace('{points}', fmt(points)).replace('{damagePoints}', fmt(damagePoints)));
        } else {
          var line1 = t('levelModalTalent') || 'Reward: {points} upgrade points';
          _rewardText1.setText(line1.replace('{points}', fmt(points)));
        }
        _rewardText1.setVisible(points > 0 || damagePoints > 0);
      }

      // Reward line 2: gold
      if (_rewardText2) {
        var line2 = t('levelModalGold') || 'You received {gold} gold';
        _rewardText2.setText(line2.replace('{gold}', fmt(gold)));
        _rewardText2.setVisible(gold > 0);
      }

      // Accept button text
      if (_acceptBtnText) _acceptBtnText.setText(t('levelUpAccept') || 'Claim reward');

      this._setAllVisible(true);
    },

    hide: function () {
      this._setAllVisible(false);
      _onAccept = null;
    },

    shutdown: function () {
      _backdrop = null;
      _panelBg = null;
      _titleText = null;
      _rewardText1 = null;
      _rewardText2 = null;
      _acceptBtnBg = null;
      _acceptBtnText = null;
      _closeBtnBg = null;
      _closeBtnText = null;
      _onAccept = null;
    },
  });

  // ── Helpers ──
  function _drawPanel(gfx, cx, cy) {
    if (!gfx) return;
    gfx.clear();
    var px = cx - PANEL.width / 2;
    var py = cy - PANEL.height / 2;
    // Shadow
    gfx.fillStyle(PANEL.shadowColor, PANEL.shadowAlpha);
    gfx.fillRoundedRect(px + 3, py + 3, PANEL.width, PANEL.height, PANEL.radius);
    // Background
    gfx.fillStyle(PANEL.bgColor, PANEL.bgAlpha);
    gfx.fillRoundedRect(px, py, PANEL.width, PANEL.height, PANEL.radius);
    // Border
    gfx.lineStyle(PANEL.borderWidth, PANEL.borderColor, 1);
    gfx.strokeRoundedRect(px, py, PANEL.width, PANEL.height, PANEL.radius);
  }

  function _drawButton(gfx, cx, cy, color) {
    if (!gfx) return;
    gfx.clear();
    gfx.fillStyle(color, 1);
    gfx.fillRoundedRect(cx - BTN.width / 2, cy - BTN.height / 2, BTN.width, BTN.height, BTN.radius);
  }

  global.Game = global.Game || {};
  global.Game.PhaserScenes = global.Game.PhaserScenes || {};
  global.Game.PhaserScenes.LevelUpScene = LevelUpScene;
}(window));
