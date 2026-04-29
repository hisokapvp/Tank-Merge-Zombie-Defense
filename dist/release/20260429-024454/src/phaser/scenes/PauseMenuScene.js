/**
 * PauseMenuScene — Phaser 3 overlay scene for the pause/settings menu.
 *
 * Main view with: Continue, New Game, Save, Load, Exit buttons,
 * and a settings section with SFX/Music volume sliders and toggles.
 *
 * Subviews (confirmation dialogs for New Game and Exit) are handled
 * as toggleable groups within the same scene.
 *
 * Lifecycle:
 *   1. Launched by SceneOverlayManager / ModalAdapter
 *   2. show(data) sets button states and wires callbacks
 *   3. Button clicks invoke callbacks registered by the caller
 *   4. hide() resets to root view and sleeps the scene
 */
(function (global) {
  'use strict';

  if (typeof Phaser === 'undefined') return;

  // ── Layout ──
  var PANEL = {
    width: 400,
    height: 420,
    radius: 14,
    bgColor: 0x1a2332,
    bgAlpha: 0.97,
    borderColor: 0x44aaff,
    borderWidth: 2,
    shadowColor: 0x000000,
    shadowAlpha: 0.5,
    backdropColor: 0x050a12,
    backdropAlpha: 0.55,
  };

  var MENU_BTN = {
    width: 260,
    height: 36,
    radius: 8,
    bgColor: 0x2a3a4e,
    hoverColor: 0x3a5570,
    disabledColor: 0x1a2030,
    gap: 8,
  };

  var SLIDER = {
    width: 180,
    height: 6,
    radius: 3,
    trackColor: 0x333333,
    fillColor: 0x44aaff,
    thumbRadius: 8,
    thumbColor: 0xffffff,
  };

  var TEXT_STYLE = {
    title: { fontFamily: 'Arial, sans-serif', fontSize: '20px', color: '#ffdd44', align: 'center', stroke: '#000', strokeThickness: 2 },
    button: { fontFamily: 'Arial, sans-serif', fontSize: '15px', color: '#ffffff', align: 'center' },
    buttonDisabled: { fontFamily: 'Arial, sans-serif', fontSize: '15px', color: '#666666', align: 'center' },
    label: { fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#aaaaaa', align: 'left' },
    confirm: { fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#cccccc', align: 'center', wordWrap: { width: PANEL.width - 60 } },
  };

  // ── Scene-local state ──
  var _backdrop = null;
  var _panelBg = null;
  var _titleText = null;
  var _menuButtons = {};     // { continue, newGame, save, load, exit }
  var _settingsGroup = [];   // Graphics/Text for settings section
  var _confirmGroup = [];    // Graphics/Text for confirmation dialogs
  var _confirmView = null;   // 'newGame' | 'exit' | null
  var _callbacks = {};
  var _canContinue = true;
  var _sfxVolume = 1;
  var _musicVolume = 1;

  // Slider state
  var _sfxSliderDrag = false;
  var _musicSliderDrag = false;

  var PauseMenuScene = new Phaser.Class({
    Extends: Phaser.Scene,

    initialize: function PauseMenuScene() {
      Phaser.Scene.call(this, { key: 'PauseMenuScene' });
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
        if (typeof _callbacks.onClose === 'function') _callbacks.onClose();
      });

      // ── Panel ──
      _panelBg = this.add.graphics();
      _drawPanel(_panelBg, cx, cy);

      var panelZone = this.add.zone(cx, cy, PANEL.width, PANEL.height).setInteractive();
      panelZone.on('pointerdown', function (ptr, x, y, evt) { if (evt) evt.stopPropagation(); });

      // ── Title ──
      _titleText = this.add.text(cx, cy - PANEL.height / 2 + 30, 'Menu', TEXT_STYLE.title).setOrigin(0.5);

      // ── Close (X) button ──
      var closeX = cx + PANEL.width / 2 - 24;
      var closeY = cy - PANEL.height / 2 + 22;
      var closeBg = this.add.graphics();
      closeBg.fillStyle(0x472d1c, 0.98);
      closeBg.fillRoundedRect(closeX - 16, closeY - 16, 32, 32, 8);
      var closeTxt = this.add.text(closeX, closeY, '\u00D7', {
        fontFamily: 'Arial, sans-serif', fontSize: '22px', color: '#cccccc',
      }).setOrigin(0.5);

      var closeZone = this.add.zone(closeX, closeY, 44, 44).setInteractive({ useHandCursor: true });
      closeZone.on('pointerover', function () { closeTxt.setColor('#ffffff'); });
      closeZone.on('pointerout', function () { closeTxt.setColor('#cccccc'); });
      closeZone.on('pointerdown', function () {
        if (typeof _callbacks.onClose === 'function') _callbacks.onClose();
      });

      // ── Menu buttons ──
      var startY = cy - PANEL.height / 2 + 70;
      var btnIds = ['continue', 'newGame', 'save', 'load', 'exit'];
      var btnLabels = ['Continue', 'New game', 'Save', 'Load', 'Exit'];

      for (var i = 0; i < btnIds.length; i++) {
        var by = startY + i * (MENU_BTN.height + MENU_BTN.gap);
        _menuButtons[btnIds[i]] = _createMenuButton(self, cx, by, btnLabels[i], btnIds[i]);
      }

      // ── Settings section (below buttons) ──
      var settingsY = startY + btnIds.length * (MENU_BTN.height + MENU_BTN.gap) + 10;
      _createSettingsSection(self, cx, settingsY);

      // ── Confirmation overlay group (hidden by default) ──
      _createConfirmGroup(self, cx, cy);
      _setConfirmVisible(false);

      // Signal readiness
      var overlayMgr = global.Game && global.Game.SceneOverlayManager;
      if (overlayMgr && typeof overlayMgr.onSceneCreated === 'function') {
        overlayMgr.onSceneCreated('PauseMenuScene');
      }

      // Start hidden
      this._setAllVisible(false);
    },

    _setAllVisible: function (visible) {
      this.children.each(function (child) {
        if (child && typeof child.setVisible === 'function') child.setVisible(visible);
      });
      if (!visible) _setConfirmVisible(false);
    },

    /**
     * Show pause menu.
     * @param {Object} [data]
     * @param {boolean} [data.canContinue]
     * @param {Function} [data.onClose]
     * @param {Function} [data.onContinue]
     * @param {Function} [data.onNewGame]
     * @param {Function} [data.onSave]
     * @param {Function} [data.onLoad]
     * @param {Function} [data.onExit]
     * @param {Function} [data.onSfxChange]
     * @param {Function} [data.onMusicChange]
     * @param {number} [data.sfxVolume]
     * @param {number} [data.musicVolume]
     * @param {Function} [data.translate]
     */
    show: function (data) {
      data = data || {};
      _callbacks = {
        onClose: data.onClose || data.onContinue || null,
        onContinue: data.onContinue || null,
        onNewGame: data.onNewGame || null,
        onSave: data.onSave || null,
        onLoad: data.onLoad || null,
        onExit: data.onExit || null,
        onSfxChange: data.onSfxChange || null,
        onMusicChange: data.onMusicChange || null,
      };
      _canContinue = data.canContinue !== false;
      _sfxVolume = typeof data.sfxVolume === 'number' ? data.sfxVolume : 1;
      _musicVolume = typeof data.musicVolume === 'number' ? data.musicVolume : 1;

      var t = data.translate || function (k) { return k; };

      // Update labels
      if (_titleText) _titleText.setText(t('menuTitle') || 'Menu');

      // Update button labels
      _updateBtnLabel('continue', t('menuContinue') || 'Continue', _canContinue);
      _updateBtnLabel('newGame', t('menuNew') || 'New game', true);
      _updateBtnLabel('save', t('menuSave') || 'Save', true);
      _updateBtnLabel('load', t('menuLoad') || 'Load', true);
      _updateBtnLabel('exit', t('menuExit') || 'Exit', true);

      // Update slider positions
      _updateSliderFill('sfx', _sfxVolume);
      _updateSliderFill('music', _musicVolume);

      _confirmView = null;
      this._setAllVisible(true);
      _setConfirmVisible(false);
    },

    hide: function () {
      _confirmView = null;
      this._setAllVisible(false);
      _callbacks = {};
    },

    shutdown: function () {
      _backdrop = null;
      _panelBg = null;
      _titleText = null;
      _menuButtons = {};
      _settingsGroup = [];
      _confirmGroup = [];
      _confirmView = null;
      _callbacks = {};
    },
  });

  // ── Button helper ──
  function _createMenuButton(scene, cx, cy, label, id) {
    var bg = scene.add.graphics();
    _drawMenuBtn(bg, cx, cy, MENU_BTN.bgColor);

    var txt = scene.add.text(cx, cy, label, TEXT_STYLE.button).setOrigin(0.5);

    var zone = scene.add.zone(cx, cy, MENU_BTN.width, MENU_BTN.height).setInteractive({ useHandCursor: true });
    zone.on('pointerover', function () {
      if (!txt._disabled) _drawMenuBtn(bg, cx, cy, MENU_BTN.hoverColor);
    });
    zone.on('pointerout', function () {
      _drawMenuBtn(bg, cx, cy, txt._disabled ? MENU_BTN.disabledColor : MENU_BTN.bgColor);
    });
    zone.on('pointerdown', function () {
      if (txt._disabled) return;
      switch (id) {
        case 'continue':
          if (typeof _callbacks.onContinue === 'function') _callbacks.onContinue();
          break;
        case 'newGame':
          _showConfirm('newGame');
          break;
        case 'save':
          if (typeof _callbacks.onSave === 'function') _callbacks.onSave();
          break;
        case 'load':
          if (typeof _callbacks.onLoad === 'function') _callbacks.onLoad();
          break;
        case 'exit':
          _showConfirm('exit');
          break;
      }
    });

    return { bg: bg, txt: txt, zone: zone };
  }

  function _updateBtnLabel(id, label, enabled) {
    var btn = _menuButtons[id];
    if (!btn) return;
    btn.txt.setText(label);
    btn.txt._disabled = !enabled;
    if (enabled) {
      btn.txt.setStyle(TEXT_STYLE.button);
      _drawMenuBtn(btn.bg, btn.txt.x, btn.txt.y, MENU_BTN.bgColor);
    } else {
      btn.txt.setStyle(TEXT_STYLE.buttonDisabled);
      _drawMenuBtn(btn.bg, btn.txt.x, btn.txt.y, MENU_BTN.disabledColor);
    }
  }

  function _drawMenuBtn(gfx, cx, cy, color) {
    if (!gfx) return;
    gfx.clear();
    gfx.fillStyle(color, 1);
    gfx.fillRoundedRect(cx - MENU_BTN.width / 2, cy - MENU_BTN.height / 2, MENU_BTN.width, MENU_BTN.height, MENU_BTN.radius);
  }

  // ── Settings section ──
  var _sliders = {};

  function _createSettingsSection(scene, cx, startY) {
    var y = startY;

    // SFX Label + Slider
    var sfxLabel = scene.add.text(cx - SLIDER.width / 2, y, 'SFX', TEXT_STYLE.label);
    _settingsGroup.push(sfxLabel);
    y += 16;
    _sliders.sfx = _createSlider(scene, cx, y, 'sfx');
    y += 26;

    // Music Label + Slider
    var musicLabel = scene.add.text(cx - SLIDER.width / 2, y, 'Music', TEXT_STYLE.label);
    _settingsGroup.push(musicLabel);
    y += 16;
    _sliders.music = _createSlider(scene, cx, y, 'music');
  }

  function _createSlider(scene, cx, cy, id) {
    var trackBg = scene.add.graphics();
    trackBg.fillStyle(SLIDER.trackColor, 1);
    trackBg.fillRoundedRect(cx - SLIDER.width / 2, cy - SLIDER.height / 2, SLIDER.width, SLIDER.height, SLIDER.radius);
    _settingsGroup.push(trackBg);

    var fill = scene.add.graphics();
    _settingsGroup.push(fill);

    var thumb = scene.add.graphics();
    _settingsGroup.push(thumb);

    var trackZone = scene.add.zone(cx, cy, SLIDER.width + SLIDER.thumbRadius * 2, SLIDER.height + SLIDER.thumbRadius * 2).setInteractive({ useHandCursor: true, draggable: true });
    _settingsGroup.push(trackZone);

    var left = cx - SLIDER.width / 2;

    trackZone.on('drag', function (pointer, dragX) {
      var ratio = Math.max(0, Math.min(1, (dragX - left) / SLIDER.width));
      _drawSliderState(fill, thumb, cx, cy, ratio);
      if (id === 'sfx' && typeof _callbacks.onSfxChange === 'function') _callbacks.onSfxChange(ratio);
      if (id === 'music' && typeof _callbacks.onMusicChange === 'function') _callbacks.onMusicChange(ratio);
    });

    trackZone.on('pointerdown', function (pointer) {
      var localX = pointer.x;
      var ratio = Math.max(0, Math.min(1, (localX - left) / SLIDER.width));
      _drawSliderState(fill, thumb, cx, cy, ratio);
      if (id === 'sfx' && typeof _callbacks.onSfxChange === 'function') _callbacks.onSfxChange(ratio);
      if (id === 'music' && typeof _callbacks.onMusicChange === 'function') _callbacks.onMusicChange(ratio);
    });

    scene.input.setDraggable(trackZone);

    return { fill: fill, thumb: thumb, cx: cx, cy: cy };
  }

  function _drawSliderState(fill, thumb, cx, cy, ratio) {
    if (!fill || !thumb) return;
    var left = cx - SLIDER.width / 2;
    var fillW = ratio * SLIDER.width;

    fill.clear();
    if (fillW > 0) {
      fill.fillStyle(SLIDER.fillColor, 1);
      fill.fillRoundedRect(left, cy - SLIDER.height / 2, fillW, SLIDER.height, SLIDER.radius);
    }

    thumb.clear();
    thumb.fillStyle(SLIDER.thumbColor, 1);
    thumb.fillCircle(left + fillW, cy, SLIDER.thumbRadius);
  }

  function _updateSliderFill(id, ratio) {
    var s = _sliders[id];
    if (!s) return;
    _drawSliderState(s.fill, s.thumb, s.cx, s.cy, ratio);
  }

  // ── Confirm dialog ──
  var _confirmBg = null;
  var _confirmText = null;
  var _confirmYesBtn = null;
  var _confirmNoBtn = null;

  function _createConfirmGroup(scene, cx, cy) {
    _confirmBg = scene.add.graphics();
    _confirmBg.fillStyle(0x0d1520, 0.95);
    _confirmBg.fillRoundedRect(cx - 160, cy - 60, 320, 130, 10);
    _confirmBg.lineStyle(1, 0x44aaff, 0.5);
    _confirmBg.strokeRoundedRect(cx - 160, cy - 60, 320, 130, 10);
    _confirmGroup.push(_confirmBg);

    _confirmText = scene.add.text(cx, cy - 30, '', TEXT_STYLE.confirm).setOrigin(0.5);
    _confirmGroup.push(_confirmText);

    // Yes button
    var yesG = scene.add.graphics();
    yesG.fillStyle(0x882222, 1);
    yesG.fillRoundedRect(cx - 120, cy + 20, 100, 32, 6);
    _confirmGroup.push(yesG);
    var yesTxt = scene.add.text(cx - 70, cy + 36, 'OK', TEXT_STYLE.button).setOrigin(0.5);
    _confirmGroup.push(yesTxt);
    var yesZone = scene.add.zone(cx - 70, cy + 36, 100, 32).setInteractive({ useHandCursor: true });
    yesZone.on('pointerdown', function () {
      if (_confirmView === 'newGame' && typeof _callbacks.onNewGame === 'function') _callbacks.onNewGame();
      if (_confirmView === 'exit' && typeof _callbacks.onExit === 'function') _callbacks.onExit();
      _setConfirmVisible(false);
    });
    _confirmGroup.push(yesZone);
    _confirmYesBtn = { gfx: yesG, txt: yesTxt };

    // No/Cancel button
    var noG = scene.add.graphics();
    noG.fillStyle(0x444444, 1);
    noG.fillRoundedRect(cx + 20, cy + 20, 100, 32, 6);
    _confirmGroup.push(noG);
    var noTxt = scene.add.text(cx + 70, cy + 36, 'Cancel', TEXT_STYLE.button).setOrigin(0.5);
    _confirmGroup.push(noTxt);
    var noZone = scene.add.zone(cx + 70, cy + 36, 100, 32).setInteractive({ useHandCursor: true });
    noZone.on('pointerdown', function () {
      _setConfirmVisible(false);
      _confirmView = null;
    });
    _confirmGroup.push(noZone);
    _confirmNoBtn = { gfx: noG, txt: noTxt };
  }

  function _showConfirm(type) {
    _confirmView = type;
    if (type === 'newGame') {
      if (_confirmText) _confirmText.setText('Start a new game?\nAll progress will be lost.');
    } else if (type === 'exit') {
      if (_confirmText) _confirmText.setText('Exit the game?\nUnsaved progress will be lost.');
    }
    _setConfirmVisible(true);
  }

  function _setConfirmVisible(visible) {
    for (var i = 0; i < _confirmGroup.length; i++) {
      if (_confirmGroup[i] && typeof _confirmGroup[i].setVisible === 'function') {
        _confirmGroup[i].setVisible(visible);
      }
    }
  }

  // ── Panel draw ──
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

  global.Game = global.Game || {};
  global.Game.PhaserScenes = global.Game.PhaserScenes || {};
  global.Game.PhaserScenes.PauseMenuScene = PauseMenuScene;
}(window));
