/**
 * HudScene — Phaser 3 overlay scene for HUD rendering.
 *
 * Runs in parallel with GameScene. Creates Phaser Text/Graphics objects
 * for core HUD elements (coins, kills, XP bar, level text, XP text).
 * When active, wires Phaser objects into HudAdapter via setPhaserObject().
 *
 * The scene has a transparent background and does NOT capture input —
 * all input flows through to the GameScene underneath.
 *
 * Lifecycle:
 *   1. Launched by SceneOverlayManager after GameScene is ready
 *   2. Creates Phaser Text objects matching DOM HUD layout
 *   3. Calls HudAdapter.setPhaserObject(id, obj) for each element
 *   4. On each update(), reads HudAdapter element state (no polling — adapter pushes)
 *   5. Can be slept/woken by SceneOverlayManager
 */
(function (global) {
  'use strict';

  if (typeof Phaser === 'undefined') return;

  /** @type {Object<string, Phaser.GameObjects.Text>} */
  var _textObjects = {};
  /** @type {Phaser.GameObjects.Graphics|null} */
  var _xpBarBg = null;
  /** @type {Phaser.GameObjects.Graphics|null} */
  var _xpBarFill = null;
  var _xpBarRatio = 0;

  // HUD layout constants — match CSS terminal-panel right-side layout
  var HUD_CFG = {
    // Right-side HUD origin (relative to game canvas)
    rightX: 0,    // computed on create based on canvas width
    topY: 10,
    textStyle: {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    },
    labelStyle: {
      fontFamily: 'Arial, sans-serif',
      fontSize: '12px',
      color: '#aaaaaa',
    },
    xpBar: {
      width: 180,
      height: 14,
      bgColor: 0x333333,
      fillColor: 0x44aaff,
      radius: 3,
      y: 0,   // computed
    },
    lineHeight: 22,
  };

  var HudScene = new Phaser.Class({
    Extends: Phaser.Scene,

    initialize: function HudScene() {
      Phaser.Scene.call(this, { key: 'HudScene' });
    },

    create: function () {
      console.log('[HudScene] HUD overlay scene created');

      // Position HUD in upper-right area (mirroring CSS terminal panel)
      var w = this.scale.width;
      HUD_CFG.rightX = w - 200;

      var y = HUD_CFG.topY;
      var x = HUD_CFG.rightX;

      // --- Coins ---
      _textObjects.coinsLabel = this.add.text(x, y, 'Money', HUD_CFG.labelStyle);
      y += 14;
      _textObjects.coins = this.add.text(x, y, '0', HUD_CFG.textStyle);
      y += HUD_CFG.lineHeight;

      // --- Kills ---
      _textObjects.zcountLabel = this.add.text(x, y, 'Kills', HUD_CFG.labelStyle);
      y += 14;
      _textObjects.zcount = this.add.text(x, y, '0', HUD_CFG.textStyle);
      y += HUD_CFG.lineHeight + 6;

      // --- Level text ---
      _textObjects.lvlText = this.add.text(x, y, '', HUD_CFG.textStyle);
      y += HUD_CFG.lineHeight;

      // --- XP Bar (Graphics) ---
      HUD_CFG.xpBar.y = y;
      _xpBarBg = this.add.graphics();
      _xpBarBg.fillStyle(HUD_CFG.xpBar.bgColor, 1);
      _xpBarBg.fillRoundedRect(x, y, HUD_CFG.xpBar.width, HUD_CFG.xpBar.height, HUD_CFG.xpBar.radius);

      _xpBarFill = this.add.graphics();
      _xpBarRatio = 0;
      _drawXpFill(x, y, 0);

      y += HUD_CFG.xpBar.height + 4;

      // --- XP text ---
      _textObjects.xpText = this.add.text(x, y, '0/0', HUD_CFG.textStyle);

      // Wire into HudAdapter
      var hudAdapter = global.Game && global.Game.HudAdapter;
      if (hudAdapter && typeof hudAdapter.setPhaserObject === 'function') {
        hudAdapter.setPhaserObject('coins', _textObjects.coins);
        hudAdapter.setPhaserObject('zcount', _textObjects.zcount);
        hudAdapter.setPhaserObject('lvlText', _textObjects.lvlText);
        hudAdapter.setPhaserObject('xpText', _textObjects.xpText);
        // XP bar uses custom progress setter
        hudAdapter.setPhaserObject('xpBar', {
          setProgress: function (ratio) {
            _xpBarRatio = ratio;
            _drawXpFill(HUD_CFG.rightX, HUD_CFG.xpBar.y, ratio);
          },
        });
      }

      // Disable input on this scene (let GameScene handle all input)
      this.input.enabled = false;

      // Signal readiness
      var overlayMgr = global.Game && global.Game.SceneOverlayManager;
      if (overlayMgr && typeof overlayMgr.onSceneCreated === 'function') {
        overlayMgr.onSceneCreated('HudScene');
      }

      // Start hidden — SceneOverlayManager controls visibility
      this._setAllVisible(false);
    },

    /** Toggle visibility of all HUD objects */
    _setAllVisible: function (visible) {
      for (var key in _textObjects) {
        if (_textObjects.hasOwnProperty(key) && _textObjects[key]) {
          _textObjects[key].setVisible(visible);
        }
      }
      if (_xpBarBg) _xpBarBg.setVisible(visible);
      if (_xpBarFill) _xpBarFill.setVisible(visible);
    },

    /** Called by SceneOverlayManager when showing the HUD overlay */
    show: function () {
      this._setAllVisible(true);
    },

    /** Called by SceneOverlayManager when hiding the HUD overlay */
    hide: function () {
      this._setAllVisible(false);
    },

    /** Update HUD labels from i18n (call after language change) */
    refreshLabels: function (translate) {
      if (!translate) return;
      if (_textObjects.coinsLabel) _textObjects.coinsLabel.setText(translate('hudCoins') || 'Money');
      if (_textObjects.zcountLabel) _textObjects.zcountLabel.setText(translate('hudKills') || 'Kills');
    },

    shutdown: function () {
      _textObjects = {};
      _xpBarBg = null;
      _xpBarFill = null;
      _xpBarRatio = 0;
    },
  });

  function _drawXpFill(x, y, ratio) {
    if (!_xpBarFill) return;
    _xpBarFill.clear();
    var fillW = Math.max(0, Math.min(1, ratio)) * HUD_CFG.xpBar.width;
    if (fillW > 0) {
      _xpBarFill.fillStyle(HUD_CFG.xpBar.fillColor, 1);
      _xpBarFill.fillRoundedRect(x, y, fillW, HUD_CFG.xpBar.height, HUD_CFG.xpBar.radius);
    }
  }

  global.Game = global.Game || {};
  global.Game.PhaserScenes = global.Game.PhaserScenes || {};
  global.Game.PhaserScenes.HudScene = HudScene;
}(window));
