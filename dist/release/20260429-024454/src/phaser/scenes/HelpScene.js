/**
 * HelpScene — Phaser 3 overlay scene for the shared help modal.
 *
 * Renders a scrollable help panel with expandable accordion sections.
 * Used by Supercomputer, Hangar, Tank/Wall, Talent overlays.
 *
 * Lifecycle:
 *   1. Launched by SceneOverlayManager / ModalAdapter on help button click
 *   2. show(data) populates title and section contents
 *   3. Sections toggle expand/collapse on click
 *   4. hide() collapses all and sleeps the scene
 */
(function (global) {
  'use strict';

  if (typeof Phaser === 'undefined') return;

  // ── Layout ──
  var PANEL = {
    width: 440,
    height: 460,
    radius: 14,
    bgColor: 0x1a2332,
    bgAlpha: 0.97,
    borderColor: 0x44aaff,
    borderWidth: 2,
    backdropAlpha: 0.55,
  };

  var SECTION = {
    width: 400,
    headerHeight: 34,
    radius: 6,
    bgColor: 0x223344,
    hoverColor: 0x2a4455,
    expandedBg: 0x1e2d40,
    gap: 6,
    maxContentHeight: 120,
    contentPadding: 10,
  };

  var TEXT_STYLE = {
    title: { fontFamily: 'Arial, sans-serif', fontSize: '20px', color: '#ffdd44', align: 'center', stroke: '#000', strokeThickness: 2 },
    sectionTitle: { fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#88bbff', align: 'left' },
    sectionArrow: { fontFamily: 'Arial, sans-serif', fontSize: '14px', color: '#88bbff', align: 'center' },
    content: { fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#cccccc', align: 'left', wordWrap: { width: 376 }, lineSpacing: 4 },
    close: { fontFamily: 'Arial, sans-serif', fontSize: '22px', color: '#cccccc' },
  };

  var MAX_SECTIONS = 10;

  // ── Scene-local state ──
  var _backdrop = null;
  var _panelBg = null;
  var _titleText = null;
  var _callbacks = {};
  var _sections = [];       // Array of section objects
  var _sectionData = [];    // Original section data
  var _expandedIndex = -1;
  var _scrollOffset = 0;

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

  var HelpScene = new Phaser.Class({
    Extends: Phaser.Scene,

    initialize: function HelpScene() {
      Phaser.Scene.call(this, { key: 'HelpScene' });
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
      _titleText = this.add.text(cx, cy - PANEL.height / 2 + 28, 'Help', TEXT_STYLE.title).setOrigin(0.5);

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

      // ── Pre-create section slots ──
      _sections = [];
      var listStartY = cy - PANEL.height / 2 + 58;
      for (var i = 0; i < MAX_SECTIONS; i++) {
        var sectionY = listStartY + i * (SECTION.headerHeight + SECTION.gap);
        _sections.push(_createSection(self, cx, sectionY, i));
      }

      // Signal readiness
      var overlayMgr = global.Game && global.Game.SceneOverlayManager;
      if (overlayMgr && typeof overlayMgr.onSceneCreated === 'function') {
        overlayMgr.onSceneCreated('HelpScene');
      }

      this._setAllVisible(false);
    },

    _setAllVisible: function (visible) {
      this.children.each(function (child) {
        if (child && typeof child.setVisible === 'function') child.setVisible(visible);
      });
      if (!visible) {
        _expandedIndex = -1;
        _scrollOffset = 0;
      }
    },

    /**
     * Show help modal.
     * @param {Object} [data]
     * @param {string} [data.title] — modal title
     * @param {Array}  [data.sections] — [{title, content}] up to MAX_SECTIONS
     * @param {Function} [data.onClose]
     * @param {Function} [data.translate]
     */
    show: function (data) {
      data = data || {};
      var t = data.translate || function (k) { return k; };
      _callbacks = { onClose: data.onClose || null };
      _sectionData = data.sections || [];
      _expandedIndex = -1;
      _scrollOffset = 0;

      if (_titleText) _titleText.setText(data.title || t('helpTitle') || 'Help');

      this._setAllVisible(true);
      this._populateSections(t);
    },

    hide: function () {
      this._setAllVisible(false);
      _callbacks = {};
      _sectionData = [];
      _expandedIndex = -1;
    },

    shutdown: function () {
      _backdrop = null;
      _panelBg = null;
      _titleText = null;
      _sections = [];
      _sectionData = [];
      _callbacks = {};
    },

    _populateSections: function (t) {
      for (var i = 0; i < MAX_SECTIONS; i++) {
        var sec = _sections[i];
        if (!sec) continue;
        var hasData = i < _sectionData.length;
        _setGroupVisible([sec.bg, sec.titleText, sec.arrowText, sec.zone], hasData);
        _setGroupVisible([sec.contentText, sec.contentBg], false);

        if (hasData) {
          var d = _sectionData[i];
          sec.titleText.setText(d.title || '');
          sec.contentText.setText(d.content || '');
          sec.arrowText.setText('\u25B6'); // collapsed arrow
        }
      }
    },

    _toggleSection: function (index) {
      if (index < 0 || index >= _sectionData.length) return;
      var wasExpanded = _expandedIndex === index;
      // Collapse previous
      if (_expandedIndex >= 0 && _expandedIndex < _sections.length) {
        var prev = _sections[_expandedIndex];
        _setGroupVisible([prev.contentText, prev.contentBg], false);
        prev.arrowText.setText('\u25B6');
        _drawBtnRounded(prev.bg, prev.cx, prev.baseY, SECTION.width, SECTION.headerHeight, SECTION.radius, SECTION.bgColor);
      }

      if (wasExpanded) {
        _expandedIndex = -1;
        this._refreshLayout();
        return;
      }

      // Expand new
      _expandedIndex = index;
      var sec = _sections[index];
      sec.arrowText.setText('\u25BC');
      _setGroupVisible([sec.contentText, sec.contentBg], true);
      _drawBtnRounded(sec.bg, sec.cx, sec.baseY, SECTION.width, SECTION.headerHeight, SECTION.radius, SECTION.expandedBg);

      // Position content below header
      var contentY = sec.baseY + SECTION.headerHeight / 2 + SECTION.contentPadding;
      sec.contentText.setPosition(sec.cx - SECTION.width / 2 + SECTION.contentPadding, contentY);
      var contentH = Math.min(SECTION.maxContentHeight, sec.contentText.height + SECTION.contentPadding * 2);
      sec.contentBg.clear();
      sec.contentBg.fillStyle(SECTION.expandedBg, 0.8);
      sec.contentBg.fillRoundedRect(
        sec.cx - SECTION.width / 2, contentY - SECTION.contentPadding / 2,
        SECTION.width, contentH, SECTION.radius
      );

      this._refreshLayout();
    },

    _refreshLayout: function () {
      var w = this.scale.width;
      var cy = this.scale.height / 2;
      var listTopY = cy - PANEL.height / 2 + 58;
      var y = listTopY;

      for (var i = 0; i < _sectionData.length && i < MAX_SECTIONS; i++) {
        var sec = _sections[i];
        sec.baseY = y + SECTION.headerHeight / 2;
        _repositionSection(sec, sec.cx, sec.baseY);
        y += SECTION.headerHeight + SECTION.gap;

        if (_expandedIndex === i) {
          var contentH = Math.min(SECTION.maxContentHeight, sec.contentText.height + SECTION.contentPadding * 2);
          var contentY = sec.baseY + SECTION.headerHeight / 2 + SECTION.contentPadding;
          sec.contentText.setPosition(sec.cx - SECTION.width / 2 + SECTION.contentPadding, contentY);
          sec.contentBg.clear();
          sec.contentBg.fillStyle(SECTION.expandedBg, 0.8);
          sec.contentBg.fillRoundedRect(
            sec.cx - SECTION.width / 2, contentY - SECTION.contentPadding / 2,
            SECTION.width, contentH, SECTION.radius
          );
          y += contentH + SECTION.gap;
        }
      }
    },
  });

  function _createSection(scene, cx, cy, index) {
    var bg = scene.add.graphics();
    _drawBtnRounded(bg, cx, cy, SECTION.width, SECTION.headerHeight, SECTION.radius, SECTION.bgColor);

    var titleText = scene.add.text(cx - SECTION.width / 2 + 30, cy, '', TEXT_STYLE.sectionTitle).setOrigin(0, 0.5);
    var arrowText = scene.add.text(cx - SECTION.width / 2 + 12, cy, '\u25B6', TEXT_STYLE.sectionArrow).setOrigin(0.5);

    var contentBg = scene.add.graphics();
    contentBg.setVisible(false);
    var contentText = scene.add.text(cx - SECTION.width / 2 + SECTION.contentPadding, cy + SECTION.headerHeight, '', TEXT_STYLE.content);
    contentText.setVisible(false);

    var zone = scene.add.zone(cx, cy, SECTION.width, SECTION.headerHeight).setInteractive({ useHandCursor: true });
    zone.on('pointerover', function () {
      if (_expandedIndex !== index) _drawBtnRounded(bg, cx, cy, SECTION.width, SECTION.headerHeight, SECTION.radius, SECTION.hoverColor);
    });
    zone.on('pointerout', function () {
      var color = _expandedIndex === index ? SECTION.expandedBg : SECTION.bgColor;
      _drawBtnRounded(bg, cx, cy, SECTION.width, SECTION.headerHeight, SECTION.radius, color);
    });
    zone.on('pointerdown', function () {
      if (scene._toggleSection) scene._toggleSection(index);
    });

    return {
      bg: bg,
      titleText: titleText,
      arrowText: arrowText,
      contentText: contentText,
      contentBg: contentBg,
      zone: zone,
      cx: cx,
      baseY: cy,
    };
  }

  function _repositionSection(sec, cx, cy) {
    _drawBtnRounded(sec.bg, cx, cy, SECTION.width, SECTION.headerHeight, SECTION.radius,
      _expandedIndex >= 0 && sec === _sections[_expandedIndex] ? SECTION.expandedBg : SECTION.bgColor);
    sec.titleText.setPosition(cx - SECTION.width / 2 + 30, cy);
    sec.arrowText.setPosition(cx - SECTION.width / 2 + 12, cy);
    if (sec.zone) sec.zone.setPosition(cx, cy);
  }

  function _setGroupVisible(items, visible) {
    for (var i = 0; i < items.length; i++) {
      if (items[i] && typeof items[i].setVisible === 'function') items[i].setVisible(visible);
    }
  }

  // ── Export ──
  global.Game = global.Game || {};
  global.Game.PhaserScenes = global.Game.PhaserScenes || {};
  global.Game.PhaserScenes.HelpScene = HelpScene;
  global.Game.HelpScene = HelpScene;
})(window);
