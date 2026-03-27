/**
 * HudAdapter — Phase 3 bridge for HUD element migration from DOM to Phaser.
 *
 * Phase 3: Provides a unified interface for HUD elements (money, kills,
 * XP bar, level text, action buttons, ability slots) that can be backed
 * by either the existing DOM elements or future Phaser UI objects.
 *
 * In the initial phase, all HUD elements are marked 'dom' and the adapter
 * simply delegates to the existing DOM update paths. As elements are
 * migrated to Phaser, their mode switches to 'phaser' and the adapter
 * routes updates to Phaser GameObjects instead.
 *
 * The adapter does NOT own the HUD update schedule — game.js updateUI()
 * continues to call the adapter's update methods at the same frequency.
 *
 * API:
 *   Game.HudAdapter.init(config)
 *   Game.HudAdapter.registerElement(id, domEl, options)
 *   Game.HudAdapter.updateText(id, text)
 *   Game.HudAdapter.updateProgress(id, ratio)
 *   Game.HudAdapter.setVisible(id, visible)
 *   Game.HudAdapter.setMode(id, mode)
 *   Game.HudAdapter.getMode(id)          → 'dom' | 'phaser' | 'both'
 *   Game.HudAdapter.getElements()         → Object
 *   Game.HudAdapter.destroy()
 */
(function (global) {
  'use strict';

  /**
   * @typedef {Object} HudElement
   * @property {string} id
   * @property {HTMLElement|null} domEl
   * @property {Object|null} phaserObj    — future Phaser GameObject reference
   * @property {string} mode              — 'dom' | 'phaser' | 'both'
   * @property {string} type              — 'text' | 'progress' | 'button' | 'container'
   * @property {string} lastText
   * @property {number} lastProgress
   */

  /** @type {Object<string, HudElement>} */
  var _elements = {};
  var _initialized = false;

  /**
   * Initialize the HUD adapter.
   * @param {Object} [config]
   */
  function init(config) {
    _elements = {};
    _initialized = true;
    console.log('[HudAdapter] Initialized');
  }

  /**
   * Register a HUD element for managed updates.
   * @param {string} id — unique element identifier (e.g. 'coins', 'zcount', 'xpBar')
   * @param {HTMLElement|null} domEl — existing DOM element
   * @param {Object} [options]
   * @param {string} [options.type] — 'text' | 'progress' | 'button' | 'container'
   * @param {string} [options.mode] — 'dom' | 'phaser' | 'both' (default: 'dom')
   */
  function registerElement(id, domEl, options) {
    options = options || {};
    _elements[id] = {
      id: id,
      domEl: domEl || null,
      phaserObj: null,
      mode: options.mode || 'dom',
      type: options.type || 'text',
      lastText: '',
      lastProgress: 0,
    };
  }

  /**
   * Attach a Phaser GameObject to a registered element.
   * @param {string} id
   * @param {Object} phaserObj — Phaser.GameObjects.Text, BitmapText, etc.
   */
  function setPhaserObject(id, phaserObj) {
    var el = _elements[id];
    if (!el) return;
    el.phaserObj = phaserObj || null;
  }

  /**
   * Update the text content of a HUD element.
   * Routes to DOM, Phaser, or both depending on element mode.
   * @param {string} id
   * @param {string} text
   */
  function updateText(id, text) {
    var el = _elements[id];
    if (!el) return;

    // Skip if text unchanged (avoid DOM thrashing)
    if (el.lastText === text) return;
    el.lastText = text;

    var mode = el.mode;

    // DOM path
    if ((mode === 'dom' || mode === 'both') && el.domEl) {
      el.domEl.textContent = text;
    }

    // Phaser path
    if ((mode === 'phaser' || mode === 'both') && el.phaserObj) {
      if (typeof el.phaserObj.setText === 'function') {
        el.phaserObj.setText(text);
      }
    }
  }

  /**
   * Update a progress-bar element (XP bar, health bar, etc.).
   * @param {string} id
   * @param {number} ratio — 0..1
   */
  function updateProgress(id, ratio) {
    var el = _elements[id];
    if (!el) return;

    var r = Math.max(0, Math.min(1, ratio));
    if (el.lastProgress === r) return;
    el.lastProgress = r;

    var mode = el.mode;

    // DOM path — update CSS width
    if ((mode === 'dom' || mode === 'both') && el.domEl) {
      el.domEl.style.width = (r * 100) + '%';
    }

    // Phaser path — update scaleX or custom setter
    if ((mode === 'phaser' || mode === 'both') && el.phaserObj) {
      if (typeof el.phaserObj.setProgress === 'function') {
        el.phaserObj.setProgress(r);
      } else if (el.phaserObj.scaleX !== undefined) {
        el.phaserObj.scaleX = r;
      }
    }
  }

  /**
   * Set visibility of a HUD element.
   * @param {string} id
   * @param {boolean} visible
   */
  function setVisible(id, visible) {
    var el = _elements[id];
    if (!el) return;

    var mode = el.mode;

    if ((mode === 'dom' || mode === 'both') && el.domEl) {
      el.domEl.style.display = visible ? '' : 'none';
    }

    if ((mode === 'phaser' || mode === 'both') && el.phaserObj) {
      if (typeof el.phaserObj.setVisible === 'function') {
        el.phaserObj.setVisible(visible);
      }
    }
  }

  /**
   * Switch the rendering mode for a HUD element.
   * @param {string} id
   * @param {'dom'|'phaser'|'both'} mode
   */
  function setMode(id, mode) {
    if (mode !== 'dom' && mode !== 'phaser' && mode !== 'both') return;
    var el = _elements[id];
    if (!el) return;
    el.mode = mode;

    // When switching to 'phaser' only, hide DOM element
    if (mode === 'phaser' && el.domEl) {
      el.domEl.style.display = 'none';
    }
    // When switching to 'dom' only, show DOM element and hide Phaser
    if (mode === 'dom') {
      if (el.domEl) el.domEl.style.display = '';
      if (el.phaserObj && typeof el.phaserObj.setVisible === 'function') {
        el.phaserObj.setVisible(false);
      }
    }
  }

  /**
   * Get the current mode of a HUD element.
   * @param {string} id
   * @returns {'dom'|'phaser'|'both'}
   */
  function getMode(id) {
    var el = _elements[id];
    return el ? el.mode : 'dom';
  }

  /**
   * Get all registered elements.
   * @returns {Object<string, HudElement>}
   */
  function getElements() {
    var result = {};
    for (var id in _elements) {
      if (_elements.hasOwnProperty(id)) {
        result[id] = _elements[id];
      }
    }
    return result;
  }

  /**
   * Check if the adapter is initialized.
   * @returns {boolean}
   */
  function isInitialized() {
    return _initialized;
  }

  function destroy() {
    _elements = {};
    _initialized = false;
  }

  global.Game = global.Game || {};
  global.Game.HudAdapter = {
    init: init,
    registerElement: registerElement,
    setPhaserObject: setPhaserObject,
    updateText: updateText,
    updateProgress: updateProgress,
    setVisible: setVisible,
    setMode: setMode,
    getMode: getMode,
    getElements: getElements,
    isInitialized: isInitialized,
    destroy: destroy,
  };
}(window));
