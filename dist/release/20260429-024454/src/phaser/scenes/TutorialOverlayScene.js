/**
 * TutorialOverlayScene — Phaser 3 overlay scene for the tutorial system.
 *
 * Provides a Phaser-native counterpart to the DOM-based tutorial overlay.
 * Renders:
 * - Spotlight/mask on the target element area
 * - Cursor pointer with animation (click/drag/drop)
 * - Speech bubble with instructional text
 * - Continue / Skip buttons
 *
 * The scene delegates step progression to the legacy TutorialRuntime;
 * it only handles rendering and user interaction forwarding.
 *
 * Lifecycle:
 *   1. Launched by SceneOverlayManager when tutorial is active
 *   2. show(data) positions spotlight + bubble on current step target
 *   3. Cursor animates according to step type
 *   4. hide() clears visuals; sleep
 */
(function (global) {
  'use strict';

  if (typeof Phaser === 'undefined') return;

  // ── Layout ──
  var BUBBLE = {
    width: 220,
    minHeight: 60,
    maxHeight: 140,
    radius: 12,
    bgColor: 0x1a2332,
    bgAlpha: 0.95,
    borderColor: 0x44aaff,
    borderWidth: 2,
    padding: 12,
    tailSize: 10,
  };

  var SPOTLIGHT = {
    maskColor: 0x000000,
    maskAlpha: 0.55,
    padding: 12,
    borderRadius: 8,
    pulseMin: 0.5,
    pulseMax: 0.7,
    pulseDuration: 1200,
  };

  var CURSOR = {
    size: 32,
    color: 0xffdd44,
    alpha: 0.9,
    bobAmplitude: 4,
    bobPeriod: 600,
  };

  var BUTTON = {
    width: 100,
    height: 30,
    radius: 6,
    bgColor: 0x2d8844,
    hoverColor: 0x3aaa55,
    skipBgColor: 0x444444,
    skipHoverColor: 0x555555,
    gap: 10,
  };

  var TEXT_STYLE = {
    bubble: { fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#ffffff', align: 'left', wordWrap: { width: 196 } },
    button: { fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#ffffff', align: 'center' },
    step: { fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#888888', align: 'center' },
  };

  // ── Scene-local state ──
  var _maskGfx = null;
  var _spotlightRect = null;     // {x, y, w, h} — clear rect in mask
  var _bubbleBg = null;
  var _bubbleText = null;
  var _cursorGfx = null;
  var _stepText = null;
  var _continueBtnBg = null;
  var _continueBtnText = null;
  var _continueBtnZone = null;
  var _skipBtnBg = null;
  var _skipBtnText = null;
  var _skipBtnZone = null;
  var _callbacks = {};
  var _animTimer = null;
  var _cursorBaseX = 0;
  var _cursorBaseY = 0;
  var _cursorAnimKey = 'click';  // 'click' | 'drag' | 'drop'

  function _drawBtnRounded(gfx, cx, cy, w, h, r, color) {
    gfx.clear();
    gfx.fillStyle(color, 1);
    gfx.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, r);
  }

  var TutorialOverlayScene = new Phaser.Class({
    Extends: Phaser.Scene,

    initialize: function TutorialOverlayScene() {
      Phaser.Scene.call(this, { key: 'TutorialOverlayScene' });
    },

    create: function () {
      var self = this;
      var w = this.scale.width;
      var h = this.scale.height;

      // ── Full-screen mask with spotlight cutout ──
      _maskGfx = this.add.graphics();
      _maskGfx.setDepth(0);

      // ── Bubble ──
      _bubbleBg = this.add.graphics().setDepth(10);
      _bubbleText = this.add.text(0, 0, '', TEXT_STYLE.bubble).setDepth(11).setOrigin(0, 0);

      // ── Cursor indicator ──
      _cursorGfx = this.add.graphics().setDepth(12);

      // ── Step counter ──
      _stepText = this.add.text(w / 2, h - 20, '', TEXT_STYLE.step).setDepth(10).setOrigin(0.5);

      // ── Continue button ──
      var btnY = h - 50;
      var continueX = w / 2 - BUTTON.width / 2 - BUTTON.gap / 2;
      _continueBtnBg = this.add.graphics().setDepth(10);
      _drawBtnRounded(_continueBtnBg, continueX, btnY, BUTTON.width, BUTTON.height, BUTTON.radius, BUTTON.bgColor);
      _continueBtnText = this.add.text(continueX, btnY, 'Continue', TEXT_STYLE.button).setDepth(11).setOrigin(0.5);
      _continueBtnZone = this.add.zone(continueX, btnY, BUTTON.width, BUTTON.height).setInteractive({ useHandCursor: true }).setDepth(12);
      _continueBtnZone.on('pointerover', function () { _drawBtnRounded(_continueBtnBg, continueX, btnY, BUTTON.width, BUTTON.height, BUTTON.radius, BUTTON.hoverColor); });
      _continueBtnZone.on('pointerout', function () { _drawBtnRounded(_continueBtnBg, continueX, btnY, BUTTON.width, BUTTON.height, BUTTON.radius, BUTTON.bgColor); });
      _continueBtnZone.on('pointerdown', function () {
        if (typeof _callbacks.onContinue === 'function') _callbacks.onContinue();
      });

      // ── Skip button ──
      var skipX = w / 2 + BUTTON.width / 2 + BUTTON.gap / 2;
      _skipBtnBg = this.add.graphics().setDepth(10);
      _drawBtnRounded(_skipBtnBg, skipX, btnY, BUTTON.width, BUTTON.height, BUTTON.radius, BUTTON.skipBgColor);
      _skipBtnText = this.add.text(skipX, btnY, 'Skip', TEXT_STYLE.button).setDepth(11).setOrigin(0.5);
      _skipBtnZone = this.add.zone(skipX, btnY, BUTTON.width, BUTTON.height).setInteractive({ useHandCursor: true }).setDepth(12);
      _skipBtnZone.on('pointerover', function () { _drawBtnRounded(_skipBtnBg, skipX, btnY, BUTTON.width, BUTTON.height, BUTTON.radius, BUTTON.skipHoverColor); });
      _skipBtnZone.on('pointerout', function () { _drawBtnRounded(_skipBtnBg, skipX, btnY, BUTTON.width, BUTTON.height, BUTTON.radius, BUTTON.skipBgColor); });
      _skipBtnZone.on('pointerdown', function () {
        if (typeof _callbacks.onSkip === 'function') _callbacks.onSkip();
      });

      // Signal readiness
      var overlayMgr = global.Game && global.Game.SceneOverlayManager;
      if (overlayMgr && typeof overlayMgr.onSceneCreated === 'function') {
        overlayMgr.onSceneCreated('TutorialOverlayScene');
      }

      this._setAllVisible(false);
    },

    update: function (time) {
      if (!_cursorGfx || !_cursorGfx.visible) return;
      // Animate cursor bob
      var phase = (time % CURSOR.bobPeriod) / CURSOR.bobPeriod;
      var bobY = Math.sin(phase * Math.PI * 2) * CURSOR.bobAmplitude;
      _drawCursor(_cursorGfx, _cursorBaseX, _cursorBaseY + bobY, _cursorAnimKey);

      // Pulse spotlight mask alpha
      if (_maskGfx && _maskGfx.visible && _spotlightRect) {
        var pulsePhase = (time % SPOTLIGHT.pulseDuration) / SPOTLIGHT.pulseDuration;
        var pulseAlpha = SPOTLIGHT.pulseMin + (SPOTLIGHT.pulseMax - SPOTLIGHT.pulseMin) * (0.5 + 0.5 * Math.sin(pulsePhase * Math.PI * 2));
        _drawMask(this, _spotlightRect, pulseAlpha);
      }
    },

    _setAllVisible: function (visible) {
      this.children.each(function (child) {
        if (child && typeof child.setVisible === 'function') child.setVisible(visible);
      });
    },

    /**
     * Show tutorial overlay for a specific step.
     * @param {Object} [data]
     * @param {string} [data.message] — instructional text
     * @param {Object} [data.target] — {x, y, w, h} spotlight rect in game coords
     * @param {string} [data.cursorAnim] — 'click' | 'drag' | 'drop'
     * @param {string} [data.stepLabel] — e.g. "Step 3 / 8"
     * @param {boolean} [data.showContinue] — show continue button
     * @param {boolean} [data.showSkip] — show skip button
     * @param {Function} [data.onContinue]
     * @param {Function} [data.onSkip]
     * @param {Function} [data.translate]
     */
    show: function (data) {
      data = data || {};
      var t = data.translate || function (k) { return k; };

      _callbacks = {
        onContinue: data.onContinue || null,
        onSkip: data.onSkip || null,
      };

      _cursorAnimKey = data.cursorAnim || 'click';

      this._setAllVisible(true);

      // Button labels
      if (_continueBtnText) _continueBtnText.setText(t('tutorialContinue') || 'Continue');
      if (_skipBtnText) _skipBtnText.setText(t('tutorialSkip') || 'Skip');

      // Show/hide buttons
      var showContinue = data.showContinue !== false;
      var showSkip = data.showSkip !== false;
      if (_continueBtnBg) _continueBtnBg.setVisible(showContinue);
      if (_continueBtnText) _continueBtnText.setVisible(showContinue);
      if (_continueBtnZone) _continueBtnZone.setVisible(showContinue);
      if (_skipBtnBg) _skipBtnBg.setVisible(showSkip);
      if (_skipBtnText) _skipBtnText.setVisible(showSkip);
      if (_skipBtnZone) _skipBtnZone.setVisible(showSkip);

      // Step label
      if (_stepText) _stepText.setText(data.stepLabel || '');

      // Spotlight
      _spotlightRect = data.target || null;
      if (_spotlightRect) {
        _drawMask(this, _spotlightRect, SPOTLIGHT.maskAlpha);
      } else {
        if (_maskGfx) { _maskGfx.clear(); _maskGfx.setVisible(false); }
      }

      // Bubble
      var bubbleMsg = data.message || '';
      if (_bubbleText) _bubbleText.setText(bubbleMsg);
      if (_spotlightRect && _bubbleBg) {
        var bx = _spotlightRect.x + _spotlightRect.w + SPOTLIGHT.padding + 8;
        var by = _spotlightRect.y;
        // Keep bubble within screen
        var sw = this.scale.width;
        if (bx + BUBBLE.width > sw - 10) bx = _spotlightRect.x - BUBBLE.width - SPOTLIGHT.padding - 8;
        if (by + BUBBLE.minHeight > this.scale.height - 60) by = this.scale.height - 60 - BUBBLE.minHeight;
        if (by < 10) by = 10;
        _bubbleText.setPosition(bx + BUBBLE.padding, by + BUBBLE.padding);
        var bh = Math.min(BUBBLE.maxHeight, Math.max(BUBBLE.minHeight, _bubbleText.height + BUBBLE.padding * 2));
        _bubbleBg.clear();
        _bubbleBg.fillStyle(BUBBLE.bgColor, BUBBLE.bgAlpha);
        _bubbleBg.fillRoundedRect(bx, by, BUBBLE.width, bh, BUBBLE.radius);
        _bubbleBg.lineStyle(BUBBLE.borderWidth, BUBBLE.borderColor, 1);
        _bubbleBg.strokeRoundedRect(bx, by, BUBBLE.width, bh, BUBBLE.radius);
      } else if (_bubbleBg) {
        // Center bubble if no target
        var cx = this.scale.width / 2;
        var cy = this.scale.height / 2 - 60;
        _bubbleText.setPosition(cx - BUBBLE.width / 2 + BUBBLE.padding, cy + BUBBLE.padding);
        var bh2 = Math.min(BUBBLE.maxHeight, Math.max(BUBBLE.minHeight, _bubbleText.height + BUBBLE.padding * 2));
        _bubbleBg.clear();
        _bubbleBg.fillStyle(BUBBLE.bgColor, BUBBLE.bgAlpha);
        _bubbleBg.fillRoundedRect(cx - BUBBLE.width / 2, cy, BUBBLE.width, bh2, BUBBLE.radius);
        _bubbleBg.lineStyle(BUBBLE.borderWidth, BUBBLE.borderColor, 1);
        _bubbleBg.strokeRoundedRect(cx - BUBBLE.width / 2, cy, BUBBLE.width, bh2, BUBBLE.radius);
      }

      // Cursor position
      if (_spotlightRect) {
        _cursorBaseX = _spotlightRect.x + _spotlightRect.w / 2;
        _cursorBaseY = _spotlightRect.y + _spotlightRect.h + 8;
      } else {
        _cursorBaseX = this.scale.width / 2;
        _cursorBaseY = this.scale.height / 2;
      }
      _drawCursor(_cursorGfx, _cursorBaseX, _cursorBaseY, _cursorAnimKey);
    },

    hide: function () {
      this._setAllVisible(false);
      _callbacks = {};
      _spotlightRect = null;
      _cursorAnimKey = 'click';
    },

    shutdown: function () {
      _maskGfx = null;
      _bubbleBg = null;
      _bubbleText = null;
      _cursorGfx = null;
      _stepText = null;
      _continueBtnBg = null;
      _continueBtnText = null;
      _continueBtnZone = null;
      _skipBtnBg = null;
      _skipBtnText = null;
      _skipBtnZone = null;
      _callbacks = {};
      _spotlightRect = null;
    },
  });

  function _drawMask(scene, rect, alpha) {
    if (!_maskGfx) return;
    var w = scene.scale.width;
    var h = scene.scale.height;
    _maskGfx.clear();
    _maskGfx.fillStyle(SPOTLIGHT.maskColor, alpha);
    // Top
    _maskGfx.fillRect(0, 0, w, rect.y - SPOTLIGHT.padding);
    // Bottom
    var bottomY = rect.y + rect.h + SPOTLIGHT.padding;
    _maskGfx.fillRect(0, bottomY, w, h - bottomY);
    // Left
    _maskGfx.fillRect(0, rect.y - SPOTLIGHT.padding, rect.x - SPOTLIGHT.padding, rect.h + SPOTLIGHT.padding * 2);
    // Right
    var rightX = rect.x + rect.w + SPOTLIGHT.padding;
    _maskGfx.fillRect(rightX, rect.y - SPOTLIGHT.padding, w - rightX, rect.h + SPOTLIGHT.padding * 2);
  }

  function _drawCursor(gfx, cx, cy, animKey) {
    if (!gfx) return;
    gfx.clear();
    gfx.fillStyle(CURSOR.color, CURSOR.alpha);
    // Simple triangle pointer
    gfx.beginPath();
    gfx.moveTo(cx, cy);
    gfx.lineTo(cx + 12, cy + 16);
    gfx.lineTo(cx + 4, cy + 14);
    gfx.lineTo(cx + 2, cy + 22);
    gfx.lineTo(cx - 2, cy + 20);
    gfx.lineTo(cx, cy + 14);
    gfx.lineTo(cx - 6, cy + 14);
    gfx.closePath();
    gfx.fillPath();

    // Animation indicator
    if (animKey === 'click') {
      gfx.lineStyle(2, 0xffdd44, 0.6);
      gfx.strokeCircle(cx, cy + 10, 6);
    } else if (animKey === 'drag') {
      gfx.lineStyle(2, 0xffdd44, 0.4);
      gfx.beginPath();
      gfx.moveTo(cx + 16, cy + 10);
      gfx.lineTo(cx + 36, cy + 10);
      gfx.strokePath();
      // Arrow head
      gfx.beginPath();
      gfx.moveTo(cx + 32, cy + 6);
      gfx.lineTo(cx + 36, cy + 10);
      gfx.lineTo(cx + 32, cy + 14);
      gfx.strokePath();
    }
  }

  // ── Export ──
  global.Game = global.Game || {};
  global.Game.PhaserScenes = global.Game.PhaserScenes || {};
  global.Game.PhaserScenes.TutorialOverlayScene = TutorialOverlayScene;
  global.Game.TutorialOverlayScene = TutorialOverlayScene;
})(window);
