/**
 * SupercomputerRootScene — Phaser 3 overlay scene for the supercomputer root menu.
 *
 * Displays navigation tiles leading to sub-views:
 * - Talents (talent tree)
 * - Hangar / Mods (chips/cells)
 * - Weapons / Drones / Walls (tank wall upgrades)
 *
 * Lifecycle:
 *   1. Launched by SceneOverlayManager / ModalAdapter
 *   2. show(data) populates tiles from callbacks
 *   3. Tile click routes to sub-views via callbacks
 *   4. hide() resets state and sleeps the scene
 */
(function (global) {
  'use strict';

  if (typeof Phaser === 'undefined') return;

  // ── Layout ──
  var PANEL = {
    width: 400,
    height: 360,
    radius: 14,
    bgColor: 0x1a2332,
    bgAlpha: 0.97,
    borderColor: 0x44aaff,
    borderWidth: 2,
    backdropAlpha: 0.6,
  };

  var TILE = {
    width: 300,
    height: 56,
    radius: 10,
    bgColor: 0x223344,
    hoverColor: 0x2a4a66,
    activeColor: 0x44aaff,
    gap: 14,
  };

  var TEXT_STYLE = {
    title: { fontFamily: 'Arial, sans-serif', fontSize: '20px', color: '#ffdd44', align: 'center', stroke: '#000', strokeThickness: 2 },
    tileName: { fontFamily: 'Arial, sans-serif', fontSize: '15px', color: '#ffffff', align: 'center' },
    tileDesc: { fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#8899aa', align: 'center' },
    close: { fontFamily: 'Arial, sans-serif', fontSize: '22px', color: '#cccccc' },
    levelLabel: { fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#aaaaaa', align: 'center' },
  };

  // ── Scene-local state ──
  var _backdrop = null;
  var _panelBg = null;
  var _titleText = null;
  var _levelText = null;
  var _callbacks = {};
  var _tiles = [];

  // IDs for tiles
  var TILE_IDS = ['talents', 'hangar', 'tankWall'];

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

  var SupercomputerRootScene = new Phaser.Class({
    Extends: Phaser.Scene,

    initialize: function SupercomputerRootScene() {
      Phaser.Scene.call(this, { key: 'SupercomputerRootScene' });
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
      _titleText = this.add.text(cx, cy - PANEL.height / 2 + 28, 'Supercomputer', TEXT_STYLE.title).setOrigin(0.5);

      // ── Level label ──
      _levelText = this.add.text(cx, cy - PANEL.height / 2 + 52, '', TEXT_STYLE.levelLabel).setOrigin(0.5);

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
      var helpTxt = this.add.text(helpX, helpY, '?', { fontFamily: 'Arial, sans-serif', fontSize: '18px', color: '#88bbff', align: 'center' }).setOrigin(0.5);
      var helpZone = this.add.zone(helpX, helpY, 44, 44).setInteractive({ useHandCursor: true });
      helpZone.on('pointerover', function () { helpTxt.setColor('#ffffff'); helpBg.clear(); helpBg.fillStyle(0x445566, 0.98); helpBg.fillRoundedRect(helpX - 16, helpY - 16, 32, 32, 8); });
      helpZone.on('pointerout', function () { helpTxt.setColor('#88bbff'); helpBg.clear(); helpBg.fillStyle(0x334455, 0.98); helpBg.fillRoundedRect(helpX - 16, helpY - 16, 32, 32, 8); });
      helpZone.on('pointerdown', function () {
        if (typeof _callbacks.onHelp === 'function') _callbacks.onHelp();
      });

      // ── Tiles ──
      _tiles = [];
      var tileStartY = cy - PANEL.height / 2 + 90;
      for (var i = 0; i < TILE_IDS.length; i++) {
        var tileY = tileStartY + i * (TILE.height + TILE.gap);
        var tile = _createTile(self, cx, tileY, TILE_IDS[i], i);
        _tiles.push(tile);
      }

      // Signal readiness
      var overlayMgr = global.Game && global.Game.SceneOverlayManager;
      if (overlayMgr && typeof overlayMgr.onSceneCreated === 'function') {
        overlayMgr.onSceneCreated('SupercomputerRootScene');
      }

      this._setAllVisible(false);
    },

    _setAllVisible: function (visible) {
      this.children.each(function (child) {
        if (child && typeof child.setVisible === 'function') child.setVisible(visible);
      });
    },

    /**
     * Show root menu.
     * @param {Object} [data]
     * @param {Function} [data.onOpenTalents]
     * @param {Function} [data.onOpenHangar]
     * @param {Function} [data.onOpenTankWall]
     * @param {Function} [data.onHelp]
     * @param {Function} [data.onClose]
     * @param {Function} [data.translate]
     * @param {number}   [data.computerLevel]
     */
    show: function (data) {
      data = data || {};
      var t = data.translate || function (k) { return k; };
      _callbacks = {
        onClose: data.onClose || null,
        onHelp: data.onHelp || null,
        onOpenTalents: data.onOpenTalents || null,
        onOpenHangar: data.onOpenHangar || null,
        onOpenTankWall: data.onOpenTankWall || null,
      };

      if (_titleText) _titleText.setText(t('supercomputerTitle') || 'Supercomputer');
      if (_levelText) {
        var lvl = data.computerLevel || 0;
        _levelText.setText((t('supercomputerLevel') || 'Level') + ' ' + lvl);
      }

      // Tile labels
      var tileLabels = [
        { nameKey: 'supercomputerTalents', descKey: 'supercomputerTalentsDesc', fallback: 'Talents', descFallback: 'Upgrade combat abilities' },
        { nameKey: 'supercomputerHangar', descKey: 'supercomputerHangarDesc', fallback: 'Hangar / Mods', descFallback: 'Install chip modifiers' },
        { nameKey: 'supercomputerTankWall', descKey: 'supercomputerTankWallDesc', fallback: 'Weapons / Walls', descFallback: 'Upgrade weapons, drones, walls' },
      ];

      for (var i = 0; i < _tiles.length && i < tileLabels.length; i++) {
        var tile = _tiles[i];
        var info = tileLabels[i];
        if (tile.nameText) tile.nameText.setText(t(info.nameKey) || info.fallback);
        if (tile.descText) tile.descText.setText(t(info.descKey) || info.descFallback);
      }

      this._setAllVisible(true);
    },

    hide: function () {
      this._setAllVisible(false);
      _callbacks = {};
    },

    shutdown: function () {
      _backdrop = null;
      _panelBg = null;
      _titleText = null;
      _levelText = null;
      _callbacks = {};
      _tiles = [];
    },
  });

  function _createTile(scene, cx, cy, tileId, index) {
    var bg = scene.add.graphics();
    _drawBtnRounded(bg, cx, cy, TILE.width, TILE.height, TILE.radius, TILE.bgColor);

    var nameText = scene.add.text(cx, cy - 8, tileId, TEXT_STYLE.tileName).setOrigin(0.5);
    var descText = scene.add.text(cx, cy + 12, '', TEXT_STYLE.tileDesc).setOrigin(0.5);

    var zone = scene.add.zone(cx, cy, TILE.width, TILE.height).setInteractive({ useHandCursor: true });
    zone.on('pointerover', function () { _drawBtnRounded(bg, cx, cy, TILE.width, TILE.height, TILE.radius, TILE.hoverColor); });
    zone.on('pointerout', function () { _drawBtnRounded(bg, cx, cy, TILE.width, TILE.height, TILE.radius, TILE.bgColor); });
    zone.on('pointerdown', function () {
      _drawBtnRounded(bg, cx, cy, TILE.width, TILE.height, TILE.radius, TILE.activeColor);
      var cbKey = 'onOpen' + tileId.charAt(0).toUpperCase() + tileId.slice(1);
      // Map tile IDs to callback names
      var map = { talents: 'onOpenTalents', hangar: 'onOpenHangar', tankWall: 'onOpenTankWall' };
      var key = map[tileId] || cbKey;
      if (typeof _callbacks[key] === 'function') _callbacks[key]();
    });

    return { bg: bg, nameText: nameText, descText: descText, zone: zone, id: tileId };
  }

  // ── Export ──
  global.Game = global.Game || {};
  global.Game.PhaserScenes = global.Game.PhaserScenes || {};
  global.Game.PhaserScenes.SupercomputerRootScene = SupercomputerRootScene;
  global.Game.SupercomputerRootScene = SupercomputerRootScene;
})(window);
