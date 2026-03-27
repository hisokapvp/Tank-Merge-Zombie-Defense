/**
 * AchievementsScene — Phaser 3 overlay scene for the achievements list modal.
 *
 * Displays a scrollable list of all achievement definitions with:
 * - Title + done/locked badge
 * - Collapsible description, progress bar, reward text
 * - Claim deferred rewards button when applicable
 *
 * Lifecycle:
 *   1. Launched by SceneOverlayManager / ModalAdapter
 *   2. show(data) populates achievement cards from definitions
 *   3. Cards toggle expand/collapse on click
 *   4. hide() collapses all and sleeps the scene
 */
(function (global) {
  'use strict';

  if (typeof Phaser === 'undefined') return;

  // ── Layout ──
  var PANEL = {
    width: 420,
    height: 500,
    radius: 14,
    bgColor: 0x1a2332,
    bgAlpha: 0.97,
    borderColor: 0x44aaff,
    borderWidth: 2,
    shadowColor: 0x000000,
    shadowAlpha: 0.5,
    backdropAlpha: 0.55,
  };

  var CARD = {
    width: 370,
    height: 36,
    expandedHeight: 110,
    radius: 6,
    bgColor: 0x223344,
    doneBgColor: 0x1a3322,
    hoverColor: 0x2a4455,
    gap: 4,
  };

  var PROGRESS_BAR = {
    width: 160,
    height: 8,
    radius: 4,
    bgColor: 0x333333,
    fillColor: 0x44aaff,
    doneColor: 0x44cc44,
  };

  var TEXT_STYLE = {
    title: { fontFamily: 'Arial, sans-serif', fontSize: '20px', color: '#ffdd44', align: 'center', stroke: '#000', strokeThickness: 2 },
    cardTitle: { fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#ffffff', align: 'left', wordWrap: { width: 260 } },
    badge: { fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#44cc44', align: 'right' },
    badgeLocked: { fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#888888', align: 'right' },
    desc: { fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#aaaaaa', align: 'left', wordWrap: { width: 340 } },
    progress: { fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#cccccc', align: 'left' },
    reward: { fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#ffdd44', align: 'left', wordWrap: { width: 340 } },
    claimBtn: { fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#ffffff', align: 'center' },
    close: { fontFamily: 'Arial, sans-serif', fontSize: '22px', color: '#cccccc' },
    deferredCount: { fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#ffdd44', align: 'center' },
  };

  // Max visible cards without scrolling (physical limit)
  var MAX_VISIBLE_CARDS = 10;
  var SCROLL_AREA_HEIGHT = MAX_VISIBLE_CARDS * (CARD.height + CARD.gap);

  // ── Scene-local state ──
  var _backdrop = null;
  var _panelBg = null;
  var _titleText = null;
  var _cards = [];             // Array of card objects
  var _defs = [];              // Achievement definitions
  var _unlocked = {};          // { [id]: boolean }
  var _callbacks = {};
  var _scrollOffset = 0;
  var _expandedIndex = -1;     // Only one card expanded at a time
  var _deferredBtnBg = null;
  var _deferredBtnText = null;
  var _deferredBtnZone = null;
  var _deferredGroup = [];

  var AchievementsScene = new Phaser.Class({
    Extends: Phaser.Scene,

    initialize: function AchievementsScene() {
      Phaser.Scene.call(this, { key: 'AchievementsScene' });
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
      panelZone.on('pointerdown', function (ptr, x, y, evt) { if (evt) evt.stopPropagation(); });

      // ── Title ──
      _titleText = this.add.text(cx, cy - PANEL.height / 2 + 28, 'Achievements', TEXT_STYLE.title).setOrigin(0.5);

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
        if (typeof _callbacks.onClose === 'function') _callbacks.onClose();
      });

      // ── Claim deferred rewards button (below list) ──
      var defBtnY = cy + PANEL.height / 2 - 35;
      _deferredBtnBg = this.add.graphics();
      _drawBtnRounded(_deferredBtnBg, cx, defBtnY, 200, 32, 6, 0x2d8844);
      _deferredBtnText = this.add.text(cx, defBtnY, 'Claim', TEXT_STYLE.claimBtn).setOrigin(0.5);
      _deferredBtnZone = this.add.zone(cx, defBtnY, 200, 32).setInteractive({ useHandCursor: true });
      _deferredBtnZone.on('pointerover', function () { _drawBtnRounded(_deferredBtnBg, cx, defBtnY, 200, 32, 6, 0x3aaa55); });
      _deferredBtnZone.on('pointerout', function () { _drawBtnRounded(_deferredBtnBg, cx, defBtnY, 200, 32, 6, 0x2d8844); });
      _deferredBtnZone.on('pointerdown', function () {
        if (typeof _callbacks.onClaimDeferred === 'function') _callbacks.onClaimDeferred();
      });
      _deferredGroup = [_deferredBtnBg, _deferredBtnText, _deferredBtnZone];

      // Pre-create card slots
      var listStartY = cy - PANEL.height / 2 + 60;
      for (var i = 0; i < MAX_VISIBLE_CARDS; i++) {
        var cardY = listStartY + i * (CARD.height + CARD.gap);
        _cards.push(_createCard(self, cx, cardY, i));
      }

      // Signal readiness
      var overlayMgr = global.Game && global.Game.SceneOverlayManager;
      if (overlayMgr && typeof overlayMgr.onSceneCreated === 'function') {
        overlayMgr.onSceneCreated('AchievementsScene');
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
     * Show achievements list.
     * @param {Object} [data]
     * @param {Array}  [data.defs] — achievement definitions
     * @param {Object} [data.unlocked] — { [id]: boolean }
     * @param {Function} [data.getProgress] — (def) => number
     * @param {number} [data.deferredCount] — pending rewards count
     * @param {Function} [data.onClaimDeferred] — claim deferred callback
     * @param {Function} [data.onClose] — close callback
     * @param {Function} [data.translate] — i18n function
     */
    show: function (data) {
      data = data || {};
      _callbacks = {
        onClose: data.onClose || null,
        onClaimDeferred: data.onClaimDeferred || null,
        getProgress: data.getProgress || function () { return 0; },
      };
      _defs = data.defs || [];
      _unlocked = data.unlocked || {};
      _scrollOffset = 0;
      _expandedIndex = -1;

      var t = data.translate || function (k) { return k; };
      var deferredCount = data.deferredCount || 0;

      // Title
      if (_titleText) _titleText.setText(t('achievementsTitle') || 'Achievements');

      // Deferred rewards button
      var showDeferred = deferredCount > 0;
      _setGroupVisible(_deferredGroup, showDeferred);
      if (_deferredBtnText && showDeferred) {
        _deferredBtnText.setText((t('achievementClaim') || 'Claim') + ' (' + deferredCount + ')');
      }

      // Populate cards
      _populateCards(t, _callbacks.getProgress);

      this._setAllVisible(true);
      _refreshCardsVisibility(t);
    },

    hide: function () {
      this._setAllVisible(false);
      _callbacks = {};
      _defs = [];
      _unlocked = {};
      _expandedIndex = -1;
    },

    shutdown: function () {
      _backdrop = null;
      _panelBg = null;
      _titleText = null;
      _cards = [];
      _defs = [];
      _unlocked = {};
      _callbacks = {};
      _deferredGroup = [];
    },
  });

  // ── Card creation ──
  function _createCard(scene, cx, cy, index) {
    var bg = scene.add.graphics();
    _drawBtnRounded(bg, cx, cy, CARD.width, CARD.height, CARD.radius, CARD.bgColor);

    var titleText = scene.add.text(cx - CARD.width / 2 + 12, cy, '', TEXT_STYLE.cardTitle).setOrigin(0, 0.5);
    var badgeText = scene.add.text(cx + CARD.width / 2 - 12, cy, '', TEXT_STYLE.badge).setOrigin(1, 0.5);

    // Expanded content (hidden by default)
    var descText = scene.add.text(cx - CARD.width / 2 + 12, cy + 22, '', TEXT_STYLE.desc);
    descText.setVisible(false);

    var progressText = scene.add.text(cx - CARD.width / 2 + 12, cy + 42, '', TEXT_STYLE.progress);
    progressText.setVisible(false);

    var progressBarBg = scene.add.graphics();
    progressBarBg.setVisible(false);

    var progressBarFill = scene.add.graphics();
    progressBarFill.setVisible(false);

    var rewardText = scene.add.text(cx - CARD.width / 2 + 12, cy + 70, '', TEXT_STYLE.reward);
    rewardText.setVisible(false);

    var zone = scene.add.zone(cx, cy, CARD.width, CARD.height).setInteractive({ useHandCursor: true });
    zone.on('pointerover', function () {
      if (_expandedIndex !== index) _drawBtnRounded(bg, cx, cy, CARD.width, CARD.height, CARD.radius, CARD.hoverColor);
    });
    zone.on('pointerout', function () {
      var def = _defs[index + _scrollOffset];
      var isUnlocked = def && _unlocked[def.id];
      _drawBtnRounded(bg, cx, cy, CARD.width, CARD.height, CARD.radius, isUnlocked ? CARD.doneBgColor : CARD.bgColor);
    });
    zone.on('pointerdown', function () {
      _toggleExpand(index);
    });

    return {
      bg: bg, titleText: titleText, badgeText: badgeText,
      descText: descText, progressText: progressText,
      progressBarBg: progressBarBg, progressBarFill: progressBarFill,
      rewardText: rewardText, zone: zone,
      cx: cx, cy: cy,
    };
  }

  function _populateCards(t, getProgress) {
    for (var i = 0; i < MAX_VISIBLE_CARDS; i++) {
      var card = _cards[i];
      if (!card) continue;
      var defIndex = i + _scrollOffset;
      var def = _defs[defIndex];
      if (!def) {
        // Hide unused slots
        _setCardVisible(card, false);
        continue;
      }
      _setCardVisible(card, true);
      var isUnlocked = !!_unlocked[def.id];

      // Title
      var title = t(def.titleKey) || def.titleKey || def.id;
      card.titleText.setText(title);

      // Badge
      card.badgeText.setText(isUnlocked ? (t('achievementStatusDone') || 'Done') : (t('achievementStatusTodo') || 'Locked'));
      card.badgeText.setStyle(isUnlocked ? TEXT_STYLE.badge : TEXT_STYLE.badgeLocked);

      // Background
      _drawBtnRounded(card.bg, card.cx, card.cy, CARD.width, CARD.height, CARD.radius, isUnlocked ? CARD.doneBgColor : CARD.bgColor);

      // Expanded: desc, progress, reward
      var desc = def.descKey ? (t(def.descKey) || def.descKey) : '';
      card.descText.setText(desc);

      var progress = getProgress(def);
      var target = def.displayTarget || def.target || 1;
      var progressStr = (t('achievementProgress') || 'Progress: {value}/{target}')
        .replace('{value}', String(progress))
        .replace('{target}', String(target));
      card.progressText.setText(progressStr);

      // Progress bar
      var ratio = Math.min(1, progress / Math.max(1, target));
      _drawProgressBar(card.progressBarBg, card.progressBarFill, card.cx - CARD.width / 2 + 12, card.cy + 56, ratio, isUnlocked);

      // Reward
      var rewardStr = def.rewardKey ? ((t('achievementReward') || 'Reward: {reward}').replace('{reward}', t(def.rewardKey) || def.rewardKey)) : '';
      card.rewardText.setText(rewardStr);
    }
  }

  function _setCardVisible(card, visible) {
    card.bg.setVisible(visible);
    card.titleText.setVisible(visible);
    card.badgeText.setVisible(visible);
    card.zone.setVisible(visible);
    if (!visible) {
      card.descText.setVisible(false);
      card.progressText.setVisible(false);
      card.progressBarBg.setVisible(false);
      card.progressBarFill.setVisible(false);
      card.rewardText.setVisible(false);
    }
  }

  function _toggleExpand(index) {
    if (_expandedIndex === index) {
      _expandedIndex = -1;
      _collapseCard(_cards[index]);
    } else {
      // Collapse previously expanded
      if (_expandedIndex >= 0 && _expandedIndex < _cards.length) {
        _collapseCard(_cards[_expandedIndex]);
      }
      _expandedIndex = index;
      _expandCard(_cards[index]);
    }
  }

  function _expandCard(card) {
    if (!card) return;
    card.descText.setVisible(true);
    card.progressText.setVisible(true);
    card.progressBarBg.setVisible(true);
    card.progressBarFill.setVisible(true);
    card.rewardText.setVisible(true);
  }

  function _collapseCard(card) {
    if (!card) return;
    card.descText.setVisible(false);
    card.progressText.setVisible(false);
    card.progressBarBg.setVisible(false);
    card.progressBarFill.setVisible(false);
    card.rewardText.setVisible(false);
  }

  function _refreshCardsVisibility(t) {
    // Show deferred button based on actual count
    // Cards visibility is handled during populate
    for (var i = 0; i < _cards.length; i++) {
      if (i + _scrollOffset >= _defs.length) {
        _setCardVisible(_cards[i], false);
      }
    }
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

  function _drawBtnRounded(gfx, cx, cy, w, h, r, color) {
    if (!gfx) return;
    gfx.clear();
    gfx.fillStyle(color, 1);
    gfx.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, r);
  }

  function _drawProgressBar(bgGfx, fillGfx, x, y, ratio, isDone) {
    if (!bgGfx || !fillGfx) return;
    bgGfx.clear();
    bgGfx.fillStyle(PROGRESS_BAR.bgColor, 1);
    bgGfx.fillRoundedRect(x, y, PROGRESS_BAR.width, PROGRESS_BAR.height, PROGRESS_BAR.radius);

    fillGfx.clear();
    var fillW = ratio * PROGRESS_BAR.width;
    if (fillW > 0) {
      fillGfx.fillStyle(isDone ? PROGRESS_BAR.doneColor : PROGRESS_BAR.fillColor, 1);
      fillGfx.fillRoundedRect(x, y, fillW, PROGRESS_BAR.height, PROGRESS_BAR.radius);
    }
  }

  function _setGroupVisible(group, visible) {
    for (var i = 0; i < group.length; i++) {
      if (group[i] && typeof group[i].setVisible === 'function') group[i].setVisible(visible);
    }
  }

  global.Game = global.Game || {};
  global.Game.PhaserScenes = global.Game.PhaserScenes || {};
  global.Game.PhaserScenes.AchievementsScene = AchievementsScene;
}(window));
