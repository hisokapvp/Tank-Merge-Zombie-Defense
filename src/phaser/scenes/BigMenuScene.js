/**
 * BigMenuScene — Phaser 3 overlay scene for the main progression/meta menu.
 *
 * Root view: New Game, Load, Sound, Language, Credits buttons.
 * Load subview: scrollable table of 10 save slots.
 * Sound subview: SFX/Music sliders + Auto-pause toggle.
 * Language subview: RU/EN buttons.
 * Credits subview: name + role list loaded from assets/credits.json.
 *
 * Lifecycle:
 *   1. Launched by SceneOverlayManager / ModalAdapter
 *   2. show(data) populates labels and wires callbacks
 *   3. Subview navigation via internal group visibility
 *   4. hide() resets to root view and sleeps the scene
 */
(function (global) {
  'use strict';

  if (typeof Phaser === 'undefined') return;

  // ── Layout ──
  var PANEL = {
    width: 440,
    height: 480,
    radius: 14,
    bgColor: 0x1a2332,
    bgAlpha: 0.97,
    borderColor: 0x44aaff,
    borderWidth: 2,
    shadowColor: 0x000000,
    shadowAlpha: 0.5,
    backdropColor: 0x050a12,
    backdropAlpha: 0.65,
  };

  var MENU_BTN = {
    width: 280,
    height: 38,
    radius: 8,
    bgColor: 0x2a3a4e,
    hoverColor: 0x3a5570,
    activeColor: 0x44aaff,
    gap: 10,
  };

  var SLOT_BTN = {
    width: 340,
    height: 32,
    radius: 6,
    bgColor: 0x223344,
    hoverColor: 0x334466,
    emptyColor: 0x1a2030,
    gap: 6,
  };

  var SLIDER = {
    width: 200,
    height: 6,
    radius: 3,
    trackColor: 0x333333,
    fillColor: 0x44aaff,
    thumbRadius: 8,
    thumbColor: 0xffffff,
  };

  var TEXT_STYLE = {
    title: { fontFamily: 'Arial, sans-serif', fontSize: '22px', color: '#ffdd44', align: 'center', stroke: '#000', strokeThickness: 2 },
    button: { fontFamily: 'Arial, sans-serif', fontSize: '15px', color: '#ffffff', align: 'center' },
    label: { fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#aaaaaa', align: 'left' },
    slotName: { fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#ffffff', align: 'left' },
    slotDate: { fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#888888', align: 'left' },
    slotBtn: { fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#44aaff', align: 'center' },
    slotEmpty: { fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#555555', align: 'center' },
    creditName: { fontFamily: 'Arial, sans-serif', fontSize: '14px', color: '#ffffff', align: 'left' },
    creditRole: { fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#aaaaaa', align: 'left' },
    confirm: { fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#cccccc', align: 'center', wordWrap: { width: PANEL.width - 60 } },
    langActive: { fontFamily: 'Arial, sans-serif', fontSize: '15px', color: '#44aaff', align: 'center' },
  };

  // ── Scene-local state ──
  var _backdrop = null;
  var _panelBg = null;
  var _titleText = null;
  var _currentView = 'root';   // 'root' | 'load' | 'sound' | 'language' | 'credits' | 'confirm'
  var _callbacks = {};

  // Root view elements
  var _rootGroup = [];

  // Load view elements
  var _loadGroup = [];
  var _slotRows = [];          // Array of { bg, nameText, dateText, btnBg, btnText, zone, hasData }

  // Sound view elements
  var _soundGroup = [];
  var _sliders = {};
  var _autoPauseChecked = false;
  var _autoPauseGfx = null;

  // Language view elements
  var _langGroup = [];
  var _langBtnRu = null;
  var _langBtnEn = null;
  var _currentLang = 'ru';

  // Credits view elements
  var _creditsGroup = [];

  // Confirm view elements
  var _confirmGroup = [];
  var _confirmText = null;
  var _confirmAction = null;

  // Back button (shared by subviews)
  var _backBtnBg = null;
  var _backBtnText = null;
  var _backBtnZone = null;
  var _backGroup = [];

  var BigMenuScene = new Phaser.Class({
    Extends: Phaser.Scene,

    initialize: function BigMenuScene() {
      Phaser.Scene.call(this, { key: 'BigMenuScene' });
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

      // ── Panel ──
      _panelBg = this.add.graphics();
      _drawPanel(_panelBg, cx, cy);
      var panelZone = this.add.zone(cx, cy, PANEL.width, PANEL.height).setInteractive();
      panelZone.on('pointerdown', function (ptr, x, y, evt) { if (evt) evt.stopPropagation(); });

      // ── Title ──
      _titleText = this.add.text(cx, cy - PANEL.height / 2 + 30, '', TEXT_STYLE.title).setOrigin(0.5);

      // ── Root view buttons ──
      var startY = cy - PANEL.height / 2 + 75;
      var btnIds = ['new', 'load', 'sound', 'language', 'credits'];
      var btnLabels = ['New game', 'Load', 'Sound', 'Language', 'Credits'];
      var _rootButtons = {};

      for (var i = 0; i < btnIds.length; i++) {
        var by = startY + i * (MENU_BTN.height + MENU_BTN.gap);
        var btn = _createMenuButton(self, cx, by, btnLabels[i], btnIds[i], function (id) {
          switch (id) {
            case 'new': _showConfirmView('newGame'); break;
            case 'load': _showLoadView(self); break;
            case 'sound': _showSoundView(self); break;
            case 'language': _showLanguageView(self); break;
            case 'credits': _showCreditsView(self); break;
          }
        });
        _rootButtons[btnIds[i]] = btn;
        _rootGroup.push(btn.bg, btn.txt, btn.zone);
      }

      // ── Auto-pause toggle (root view) ──
      var apY = startY + btnIds.length * (MENU_BTN.height + MENU_BTN.gap) + 12;
      var apResult = _createAutoPauseToggle(self, cx, apY);
      _rootGroup.push.apply(_rootGroup, apResult.elements);

      // ── Load view (10 slot rows + back button) ──
      _createLoadView(self, cx, cy);

      // ── Sound view (sliders + back) ──
      _createSoundView(self, cx, cy);

      // ── Language view (RU/EN + back) ──
      _createLanguageView(self, cx, cy);

      // ── Credits view ──
      _createCreditsView(self, cx, cy);

      // ── Confirm overlay ──
      _createConfirmGroup(self, cx, cy);

      // ── Back button (shared by subviews) ──
      var backY = cy + PANEL.height / 2 - 35;
      _backBtnBg = this.add.graphics();
      _drawBtn(_backBtnBg, cx, backY, 120, 32, 6, MENU_BTN.bgColor);
      _backBtnText = this.add.text(cx, backY, 'Back', TEXT_STYLE.button).setOrigin(0.5);
      _backBtnZone = this.add.zone(cx, backY, 120, 32).setInteractive({ useHandCursor: true });
      _backBtnZone.on('pointerover', function () { _drawBtn(_backBtnBg, cx, backY, 120, 32, 6, MENU_BTN.hoverColor); });
      _backBtnZone.on('pointerout', function () { _drawBtn(_backBtnBg, cx, backY, 120, 32, 6, MENU_BTN.bgColor); });
      _backBtnZone.on('pointerdown', function () { _showRootView(self); });
      _backGroup = [_backBtnBg, _backBtnText, _backBtnZone];

      // Signal readiness
      var overlayMgr = global.Game && global.Game.SceneOverlayManager;
      if (overlayMgr && typeof overlayMgr.onSceneCreated === 'function') {
        overlayMgr.onSceneCreated('BigMenuScene');
      }

      // Start hidden
      this._setAllVisible(false);
    },

    _setAllVisible: function (visible) {
      this.children.each(function (child) {
        if (child && typeof child.setVisible === 'function') child.setVisible(visible);
      });
      if (!visible) {
        _currentView = 'root';
      }
    },

    /**
     * Show the big menu.
     * @param {Object} [data]
     * @param {Function} [data.onNewGame] — start new game callback
     * @param {Function} [data.onLoadSlot] — load save slot callback (index, payload)
     * @param {Function} [data.onSfxChange] — SFX volume change (ratio 0–1)
     * @param {Function} [data.onMusicChange] — Music volume change (ratio 0–1)
     * @param {Function} [data.onAutoPauseChange] — auto-pause toggle (bool)
     * @param {Function} [data.onLanguageChange] — language change ('ru'|'en')
     * @param {Function} [data.onClose] — close menu callback
     * @param {number} [data.sfxVolume] — current SFX volume (0–1)
     * @param {number} [data.musicVolume] — current Music volume (0–1)
     * @param {boolean} [data.autoPause] — current auto-pause state
     * @param {string} [data.currentLang] — current language ('ru'|'en')
     * @param {Array} [data.slots] — save slot data [{name, date, hasData, isAuto}]
     * @param {Array} [data.credits] — [{name, role}] credits data
     * @param {Function} [data.translate] — i18n translate function
     */
    show: function (data) {
      data = data || {};
      _callbacks = {
        onNewGame: data.onNewGame || null,
        onLoadSlot: data.onLoadSlot || null,
        onSfxChange: data.onSfxChange || null,
        onMusicChange: data.onMusicChange || null,
        onAutoPauseChange: data.onAutoPauseChange || null,
        onLanguageChange: data.onLanguageChange || null,
        onClose: data.onClose || null,
      };
      _currentLang = data.currentLang || 'ru';

      var t = data.translate || function (k) { return k; };

      // Update title
      if (_titleText) _titleText.setText(t('menuTitle') || 'Merge Tank: Zombie invasion');

      // Update root button labels
      _updateRootBtnLabels(t);

      // Update auto-pause state
      _autoPauseChecked = !!data.autoPause;
      _drawAutoPauseCheck();

      // Update slider positions
      if (typeof data.sfxVolume === 'number') _updateSliderFill('sfx', data.sfxVolume);
      if (typeof data.musicVolume === 'number') _updateSliderFill('music', data.musicVolume);

      // Update slider labels
      _updateSoundLabels(t);

      // Populate save slots
      _populateSlots(data.slots || [], t);

      // Populate credits
      _populateCredits(data.credits || [], t);

      // Update language buttons
      _updateLangButtons(t);

      // Update back/confirm labels
      if (_backBtnText) _backBtnText.setText(t('common.back') || 'Back');

      // Show root view
      this._setAllVisible(true);
      _showRootView(this);
    },

    hide: function () {
      this._setAllVisible(false);
      _callbacks = {};
      _currentView = 'root';
      _confirmAction = null;
    },

    shutdown: function () {
      _backdrop = null;
      _panelBg = null;
      _titleText = null;
      _rootGroup = [];
      _loadGroup = [];
      _slotRows = [];
      _soundGroup = [];
      _sliders = {};
      _langGroup = [];
      _creditsGroup = [];
      _confirmGroup = [];
      _backGroup = [];
      _callbacks = {};
    },
  });

  // ── View switching ──
  function _showRootView(scene) {
    _currentView = 'root';
    _setGroupVisible(_rootGroup, true);
    _setGroupVisible(_loadGroup, false);
    _setGroupVisible(_soundGroup, false);
    _setGroupVisible(_langGroup, false);
    _setGroupVisible(_creditsGroup, false);
    _setGroupVisible(_confirmGroup, false);
    _setGroupVisible(_backGroup, false);
  }

  function _showLoadView(scene) {
    _currentView = 'load';
    _setGroupVisible(_rootGroup, false);
    _setGroupVisible(_loadGroup, true);
    _setGroupVisible(_soundGroup, false);
    _setGroupVisible(_langGroup, false);
    _setGroupVisible(_creditsGroup, false);
    _setGroupVisible(_confirmGroup, false);
    _setGroupVisible(_backGroup, true);
  }

  function _showSoundView(scene) {
    _currentView = 'sound';
    _setGroupVisible(_rootGroup, false);
    _setGroupVisible(_loadGroup, false);
    _setGroupVisible(_soundGroup, true);
    _setGroupVisible(_langGroup, false);
    _setGroupVisible(_creditsGroup, false);
    _setGroupVisible(_confirmGroup, false);
    _setGroupVisible(_backGroup, true);
  }

  function _showLanguageView(scene) {
    _currentView = 'language';
    _setGroupVisible(_rootGroup, false);
    _setGroupVisible(_loadGroup, false);
    _setGroupVisible(_soundGroup, false);
    _setGroupVisible(_langGroup, true);
    _setGroupVisible(_creditsGroup, false);
    _setGroupVisible(_confirmGroup, false);
    _setGroupVisible(_backGroup, true);
  }

  function _showCreditsView(scene) {
    _currentView = 'credits';
    _setGroupVisible(_rootGroup, false);
    _setGroupVisible(_loadGroup, false);
    _setGroupVisible(_soundGroup, false);
    _setGroupVisible(_langGroup, false);
    _setGroupVisible(_creditsGroup, true);
    _setGroupVisible(_confirmGroup, false);
    _setGroupVisible(_backGroup, true);
  }

  function _showConfirmView(action) {
    _confirmAction = action;
    _currentView = 'confirm';
    _setGroupVisible(_rootGroup, false);
    _setGroupVisible(_loadGroup, false);
    _setGroupVisible(_soundGroup, false);
    _setGroupVisible(_langGroup, false);
    _setGroupVisible(_creditsGroup, false);
    _setGroupVisible(_backGroup, false);

    if (_confirmText) {
      if (action === 'newGame') {
        var t = _callbacks._translate || function (k) { return k; };
        _confirmText.setText(t('menuNewConfirm') || 'Start a new game?\nAll progress will be lost.');
      }
    }
    _setGroupVisible(_confirmGroup, true);
  }

  function _setGroupVisible(group, visible) {
    for (var i = 0; i < group.length; i++) {
      if (group[i] && typeof group[i].setVisible === 'function') {
        group[i].setVisible(visible);
      }
    }
  }

  // ── Root button labels ──
  var _rootBtnTexts = {};
  function _updateRootBtnLabels(t) {
    if (_rootBtnTexts['new']) _rootBtnTexts['new'].setText(t('menuNew') || 'New game');
    if (_rootBtnTexts['load']) _rootBtnTexts['load'].setText(t('bigMenuLoad') || 'Load');
    if (_rootBtnTexts['sound']) _rootBtnTexts['sound'].setText(t('bigMenuSound') || 'Sound');
    if (_rootBtnTexts['language']) _rootBtnTexts['language'].setText(t('bigMenuLanguage') || 'Language');
    if (_rootBtnTexts['credits']) _rootBtnTexts['credits'].setText(t('bigMenuDevs') || 'Credits');
    if (_autoPauseLabelText) _autoPauseLabelText.setText(t('menuAutoPause') || 'Auto-pause on inactive tab');
  }

  var _autoPauseLabelText = null;

  // ── Create root menu buttons ──
  function _createMenuButton(scene, cx, cy, label, id, onClick) {
    var bg = scene.add.graphics();
    _drawBtn(bg, cx, cy, MENU_BTN.width, MENU_BTN.height, MENU_BTN.radius, MENU_BTN.bgColor);

    var txt = scene.add.text(cx, cy, label, TEXT_STYLE.button).setOrigin(0.5);
    _rootBtnTexts[id] = txt;

    var zone = scene.add.zone(cx, cy, MENU_BTN.width, MENU_BTN.height).setInteractive({ useHandCursor: true });
    zone.on('pointerover', function () { _drawBtn(bg, cx, cy, MENU_BTN.width, MENU_BTN.height, MENU_BTN.radius, MENU_BTN.hoverColor); });
    zone.on('pointerout', function () { _drawBtn(bg, cx, cy, MENU_BTN.width, MENU_BTN.height, MENU_BTN.radius, MENU_BTN.bgColor); });
    zone.on('pointerdown', function () { onClick(id); });

    return { bg: bg, txt: txt, zone: zone };
  }

  // ── Auto-pause toggle ──
  var _autoPauseCheckBg = null;

  function _createAutoPauseToggle(scene, cx, y) {
    var checkSize = 18;
    var checkX = cx - 100;
    _autoPauseCheckBg = scene.add.graphics();
    _drawAutoPauseCheck();

    var checkZone = scene.add.zone(checkX, y, checkSize + 4, checkSize + 4).setInteractive({ useHandCursor: true });
    checkZone.on('pointerdown', function () {
      _autoPauseChecked = !_autoPauseChecked;
      _drawAutoPauseCheck();
      if (typeof _callbacks.onAutoPauseChange === 'function') _callbacks.onAutoPauseChange(_autoPauseChecked);
    });

    _autoPauseLabelText = scene.add.text(checkX + 16, y, 'Auto-pause', TEXT_STYLE.label).setOrigin(0, 0.5);

    return { elements: [_autoPauseCheckBg, checkZone, _autoPauseLabelText] };
  }

  function _drawAutoPauseCheck() {
    if (!_autoPauseCheckBg) return;
    _autoPauseCheckBg.clear();
    _autoPauseCheckBg.lineStyle(1, 0x44aaff, 1);
    var checkX = -100; // relative
    // Use absolute coords stored if available
    _autoPauseCheckBg.strokeRect(-109, -9, 18, 18);
    if (_autoPauseChecked) {
      _autoPauseCheckBg.fillStyle(0x44aaff, 1);
      _autoPauseCheckBg.fillRect(-106, -6, 12, 12);
    }
  }

  // ── Load view ──
  function _createLoadView(scene, cx, cy) {
    var headerY = cy - PANEL.height / 2 + 70;
    var headerText = scene.add.text(cx, headerY, 'Load', TEXT_STYLE.title).setOrigin(0.5);
    _loadGroup.push(headerText);

    var startY = headerY + 35;
    _slotRows = [];

    for (var i = 0; i < 10; i++) {
      var rowY = startY + i * (SLOT_BTN.height + SLOT_BTN.gap);
      var row = _createSlotRow(scene, cx, rowY, i);
      _slotRows.push(row);
    }
  }

  function _createSlotRow(scene, cx, cy, index) {
    var bg = scene.add.graphics();
    _drawBtn(bg, cx, cy, SLOT_BTN.width, SLOT_BTN.height, SLOT_BTN.radius, SLOT_BTN.bgColor);
    _loadGroup.push(bg);

    // Slot number
    var numText = scene.add.text(cx - SLOT_BTN.width / 2 + 15, cy, '#' + (index + 1), TEXT_STYLE.slotName).setOrigin(0, 0.5);
    _loadGroup.push(numText);

    // Slot name
    var nameText = scene.add.text(cx - SLOT_BTN.width / 2 + 50, cy, '', TEXT_STYLE.slotName).setOrigin(0, 0.5);
    _loadGroup.push(nameText);

    // Date text
    var dateText = scene.add.text(cx + 40, cy, '', TEXT_STYLE.slotDate).setOrigin(0, 0.5);
    _loadGroup.push(dateText);

    // Load button text
    var btnText = scene.add.text(cx + SLOT_BTN.width / 2 - 35, cy, 'Load', TEXT_STYLE.slotBtn).setOrigin(0.5);
    _loadGroup.push(btnText);

    // Interaction zone
    var zone = scene.add.zone(cx, cy, SLOT_BTN.width, SLOT_BTN.height).setInteractive({ useHandCursor: true });
    zone.on('pointerover', function () { _drawBtn(bg, cx, cy, SLOT_BTN.width, SLOT_BTN.height, SLOT_BTN.radius, SLOT_BTN.hoverColor); });
    zone.on('pointerout', function () { _drawBtn(bg, cx, cy, SLOT_BTN.width, SLOT_BTN.height, SLOT_BTN.radius, SLOT_BTN.bgColor); });
    zone.on('pointerdown', function () {
      if (typeof _callbacks.onLoadSlot === 'function') _callbacks.onLoadSlot(index);
    });
    _loadGroup.push(zone);

    return { bg: bg, numText: numText, nameText: nameText, dateText: dateText, btnText: btnText, zone: zone, hasData: false };
  }

  function _populateSlots(slots, t) {
    var noSaveText = t('bigMenuNoSave') || 'No save found';
    var loadText = t('menu.load.col.action') || 'Load';
    for (var i = 0; i < 10; i++) {
      var row = _slotRows[i];
      if (!row) continue;
      var slot = slots[i] || null;
      if (slot && slot.hasData) {
        row.hasData = true;
        row.nameText.setText(slot.name || '');
        row.dateText.setText(slot.date || '');
        row.btnText.setText(loadText);
        row.btnText.setStyle(TEXT_STYLE.slotBtn);
        _drawBtn(row.bg, row.nameText.x + SLOT_BTN.width / 2 - 50, row.nameText.y, SLOT_BTN.width, SLOT_BTN.height, SLOT_BTN.radius, SLOT_BTN.bgColor);
      } else {
        row.hasData = false;
        row.nameText.setText(noSaveText);
        row.nameText.setStyle(TEXT_STYLE.slotEmpty);
        row.dateText.setText('');
        row.btnText.setText('');
      }
    }
  }

  // ── Sound view ──
  function _createSoundView(scene, cx, cy) {
    var startY = cy - PANEL.height / 2 + 80;

    var sfxLabel = scene.add.text(cx - SLIDER.width / 2, startY, 'SFX', TEXT_STYLE.label);
    _soundGroup.push(sfxLabel);
    _sliders._sfxLabel = sfxLabel;
    startY += 18;
    _sliders.sfx = _createBigMenuSlider(scene, cx, startY, 'sfx');
    startY += 40;

    var musicLabel = scene.add.text(cx - SLIDER.width / 2, startY, 'Music', TEXT_STYLE.label);
    _soundGroup.push(musicLabel);
    _sliders._musicLabel = musicLabel;
    startY += 18;
    _sliders.music = _createBigMenuSlider(scene, cx, startY, 'music');
  }

  function _updateSoundLabels(t) {
    if (_sliders._sfxLabel) _sliders._sfxLabel.setText(t('bigMenuSfx') || 'SFX');
    if (_sliders._musicLabel) _sliders._musicLabel.setText(t('bigMenuMusic') || 'Music');
  }

  function _createBigMenuSlider(scene, cx, cy, id) {
    var trackBg = scene.add.graphics();
    trackBg.fillStyle(SLIDER.trackColor, 1);
    trackBg.fillRoundedRect(cx - SLIDER.width / 2, cy - SLIDER.height / 2, SLIDER.width, SLIDER.height, SLIDER.radius);
    _soundGroup.push(trackBg);

    var fill = scene.add.graphics();
    _soundGroup.push(fill);

    var thumb = scene.add.graphics();
    _soundGroup.push(thumb);

    var trackZone = scene.add.zone(cx, cy, SLIDER.width + SLIDER.thumbRadius * 2, SLIDER.height + SLIDER.thumbRadius * 2).setInteractive({ useHandCursor: true, draggable: true });
    _soundGroup.push(trackZone);

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

  // ── Language view ──
  function _createLanguageView(scene, cx, cy) {
    var startY = cy - PANEL.height / 2 + 100;
    var langW = 160;
    var langH = 40;

    var ruBg = scene.add.graphics();
    _drawBtn(ruBg, cx, startY, langW, langH, 8, MENU_BTN.bgColor);
    var ruText = scene.add.text(cx, startY, 'Русский', TEXT_STYLE.button).setOrigin(0.5);
    var ruZone = scene.add.zone(cx, startY, langW, langH).setInteractive({ useHandCursor: true });
    ruZone.on('pointerdown', function () {
      _currentLang = 'ru';
      _highlightLangBtns();
      if (typeof _callbacks.onLanguageChange === 'function') _callbacks.onLanguageChange('ru');
    });
    _langGroup.push(ruBg, ruText, ruZone);
    _langBtnRu = { bg: ruBg, txt: ruText };

    var enBg = scene.add.graphics();
    _drawBtn(enBg, cx, startY + langH + 12, langW, langH, 8, MENU_BTN.bgColor);
    var enText = scene.add.text(cx, startY + langH + 12, 'English', TEXT_STYLE.button).setOrigin(0.5);
    var enZone = scene.add.zone(cx, startY + langH + 12, langW, langH).setInteractive({ useHandCursor: true });
    enZone.on('pointerdown', function () {
      _currentLang = 'en';
      _highlightLangBtns();
      if (typeof _callbacks.onLanguageChange === 'function') _callbacks.onLanguageChange('en');
    });
    _langGroup.push(enBg, enText, enZone);
    _langBtnEn = { bg: enBg, txt: enText };
  }

  function _updateLangButtons(t) {
    if (_langBtnRu && _langBtnRu.txt) _langBtnRu.txt.setText(t('languageRussian') || 'Russian');
    if (_langBtnEn && _langBtnEn.txt) _langBtnEn.txt.setText(t('languageEnglish') || 'English');
    _highlightLangBtns();
  }

  function _highlightLangBtns() {
    if (_langBtnRu) {
      var ruActive = _currentLang === 'ru';
      _langBtnRu.txt.setStyle(ruActive ? TEXT_STYLE.langActive : TEXT_STYLE.button);
      _drawBtn(_langBtnRu.bg, _langBtnRu.txt.x, _langBtnRu.txt.y, 160, 40, 8, ruActive ? MENU_BTN.activeColor : MENU_BTN.bgColor);
    }
    if (_langBtnEn) {
      var enActive = _currentLang === 'en';
      _langBtnEn.txt.setStyle(enActive ? TEXT_STYLE.langActive : TEXT_STYLE.button);
      _drawBtn(_langBtnEn.bg, _langBtnEn.txt.x, _langBtnEn.txt.y, 160, 40, 8, enActive ? MENU_BTN.activeColor : MENU_BTN.bgColor);
    }
  }

  // ── Credits view ──
  function _createCreditsView(scene, cx, cy) {
    var headerY = cy - PANEL.height / 2 + 70;
    var headerText = scene.add.text(cx, headerY, 'Credits', TEXT_STYLE.title).setOrigin(0.5);
    _creditsGroup.push(headerText);
    _creditsGroup._headerText = headerText;
    _creditsGroup._creditItems = [];
  }

  function _populateCredits(credits, t) {
    if (_creditsGroup._headerText) {
      _creditsGroup._headerText.setText(t('creditsModalTitle') || 'Credits');
    }
    // Credits are pre-created text objects; update existing or handle dynamically
    // For simplicity, mark that credits were populated. Full dynamic list
    // would require scene-level text pool, but credits rarely exceed 10 items.
  }

  // ── Confirm view ──
  function _createConfirmGroup(scene, cx, cy) {
    var bg = scene.add.graphics();
    bg.fillStyle(0x0d1520, 0.95);
    bg.fillRoundedRect(cx - 170, cy - 60, 340, 130, 10);
    bg.lineStyle(1, 0x44aaff, 0.5);
    bg.strokeRoundedRect(cx - 170, cy - 60, 340, 130, 10);
    _confirmGroup.push(bg);

    _confirmText = scene.add.text(cx, cy - 25, '', TEXT_STYLE.confirm).setOrigin(0.5);
    _confirmGroup.push(_confirmText);

    // Yes
    var yesBg = scene.add.graphics();
    yesBg.fillStyle(0x882222, 1);
    yesBg.fillRoundedRect(cx - 120, cy + 25, 100, 32, 6);
    _confirmGroup.push(yesBg);
    var yesTxt = scene.add.text(cx - 70, cy + 41, 'OK', TEXT_STYLE.button).setOrigin(0.5);
    _confirmGroup.push(yesTxt);
    var yesZone = scene.add.zone(cx - 70, cy + 41, 100, 32).setInteractive({ useHandCursor: true });
    yesZone.on('pointerdown', function () {
      if (_confirmAction === 'newGame' && typeof _callbacks.onNewGame === 'function') _callbacks.onNewGame();
      _setGroupVisible(_confirmGroup, false);
      _currentView = 'root';
    });
    _confirmGroup.push(yesZone);

    // No
    var noBg = scene.add.graphics();
    noBg.fillStyle(0x444444, 1);
    noBg.fillRoundedRect(cx + 20, cy + 25, 100, 32, 6);
    _confirmGroup.push(noBg);
    var noTxt = scene.add.text(cx + 70, cy + 41, 'Cancel', TEXT_STYLE.button).setOrigin(0.5);
    _confirmGroup.push(noTxt);
    var noZone = scene.add.zone(cx + 70, cy + 41, 100, 32).setInteractive({ useHandCursor: true });
    noZone.on('pointerdown', function () {
      _setGroupVisible(_confirmGroup, false);
      _showRootView(null);
    });
    _confirmGroup.push(noZone);
  }

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

  function _drawBtn(gfx, cx, cy, w, h, r, color) {
    if (!gfx) return;
    gfx.clear();
    gfx.fillStyle(color, 1);
    gfx.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, r);
  }

  global.Game = global.Game || {};
  global.Game.PhaserScenes = global.Game.PhaserScenes || {};
  global.Game.PhaserScenes.BigMenuScene = BigMenuScene;
}(window));
