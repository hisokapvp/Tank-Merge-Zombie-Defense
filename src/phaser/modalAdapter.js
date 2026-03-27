/**
 * ModalAdapter — Phase 3 bridge for modal migration from DOM to Phaser.
 *
 * Provides a unified interface for modal dialogs (pause menu, settings,
 * crate reward, level-up, achievements, etc.) that can be backed by
 * either the existing DOM overlays or future Phaser overlay scenes.
 *
 * In the initial phase, all modals are mode='dom' and the adapter
 * delegates to existing DOM show/hide paths. As modals migrate to Phaser,
 * their mode switches to 'phaser' and the adapter routes open/close
 * to SceneOverlayManager scenes instead.
 *
 * The adapter does NOT own open/close logic — game.js continues to call
 * setMenuOpen(), showCrateModal(), etc. The adapter intercepts the
 * DOM visibility toggle and routes it.
 *
 * API:
 *   Game.ModalAdapter.init(config)
 *   Game.ModalAdapter.registerModal(id, domEl, options)
 *   Game.ModalAdapter.open(id, data)
 *   Game.ModalAdapter.close(id)
 *   Game.ModalAdapter.isOpen(id)
 *   Game.ModalAdapter.setMode(id, mode)
 *   Game.ModalAdapter.getMode(id)          → 'dom' | 'phaser' | 'both'
 *   Game.ModalAdapter.setPhaserSceneKey(id, key)
 *   Game.ModalAdapter.getModals()          → Object
 *   Game.ModalAdapter.isInitialized()      → boolean
 *   Game.ModalAdapter.destroy()
 */
(function (global) {
  'use strict';

  /**
   * @typedef {Object} ModalEntry
   * @property {string} id
   * @property {HTMLElement|null} domEl            — root DOM overlay element
   * @property {string|null} phaserSceneKey        — SceneOverlayManager scene key
   * @property {string} mode                       — 'dom' | 'phaser' | 'both'
   * @property {boolean} isOpen
   * @property {string} hiddenClass                — CSS class to toggle (default: 'hidden')
   * @property {string} ariaAttr                   — aria-hidden attribute name
   * @property {Function|null} onOpen              — callback after open
   * @property {Function|null} onClose             — callback after close
   */

  /** @type {Object<string, ModalEntry>} */
  var _modals = {};
  var _initialized = false;

  /**
   * Initialize the modal adapter.
   * @param {Object} [config]
   */
  function init(config) {
    _modals = {};
    _initialized = true;
    console.log('[ModalAdapter] Initialized');
  }

  /**
   * Register a modal for managed open/close.
   * @param {string} id — unique modal identifier (e.g. 'pauseMenu', 'crateReward')
   * @param {HTMLElement|null} domEl — root DOM overlay element
   * @param {Object} [options]
   * @param {string} [options.mode] — 'dom' | 'phaser' | 'both' (default: 'dom')
   * @param {string} [options.hiddenClass] — CSS class for hidden state (default: 'hidden')
   * @param {Function} [options.onOpen] — callback after open
   * @param {Function} [options.onClose] — callback after close
   */
  function registerModal(id, domEl, options) {
    options = options || {};
    _modals[id] = {
      id: id,
      domEl: domEl || null,
      phaserSceneKey: null,
      mode: options.mode || 'dom',
      isOpen: false,
      hiddenClass: options.hiddenClass || 'hidden',
      ariaAttr: 'aria-hidden',
      onOpen: typeof options.onOpen === 'function' ? options.onOpen : null,
      onClose: typeof options.onClose === 'function' ? options.onClose : null,
    };
  }

  /**
   * Associate a Phaser overlay scene with a modal.
   * @param {string} id — modal ID
   * @param {string} key — SceneOverlayManager scene key
   */
  function setPhaserSceneKey(id, key) {
    var entry = _modals[id];
    if (entry) entry.phaserSceneKey = key || null;
  }

  /**
   * Open a modal.
   * @param {string} id
   * @param {*} [data] — optional data passed to the Phaser scene
   */
  function open(id, data) {
    var entry = _modals[id];
    if (!entry) return;

    entry.isOpen = true;
    var mode = entry.mode;

    // DOM path
    if ((mode === 'dom' || mode === 'both') && entry.domEl) {
      entry.domEl.classList.remove(entry.hiddenClass);
      entry.domEl.setAttribute(entry.ariaAttr, 'false');
    }

    // Phaser path
    if ((mode === 'phaser' || mode === 'both') && entry.phaserSceneKey) {
      var overlayMgr = global.Game && global.Game.SceneOverlayManager;
      if (overlayMgr && typeof overlayMgr.show === 'function') {
        overlayMgr.show(entry.phaserSceneKey);
      }
    }

    // When mode='phaser', hide DOM
    if (mode === 'phaser' && entry.domEl) {
      entry.domEl.classList.add(entry.hiddenClass);
      entry.domEl.setAttribute(entry.ariaAttr, 'true');
    }

    if (entry.onOpen) entry.onOpen(data);
  }

  /**
   * Close a modal.
   * @param {string} id
   */
  function close(id) {
    var entry = _modals[id];
    if (!entry) return;

    entry.isOpen = false;
    var mode = entry.mode;

    // DOM path
    if ((mode === 'dom' || mode === 'both') && entry.domEl) {
      entry.domEl.classList.add(entry.hiddenClass);
      entry.domEl.setAttribute(entry.ariaAttr, 'true');
    }

    // Phaser path
    if ((mode === 'phaser' || mode === 'both') && entry.phaserSceneKey) {
      var overlayMgr = global.Game && global.Game.SceneOverlayManager;
      if (overlayMgr && typeof overlayMgr.hide === 'function') {
        overlayMgr.hide(entry.phaserSceneKey);
      }
    }

    if (entry.onClose) entry.onClose();
  }

  /**
   * Check if a modal is currently open.
   * @param {string} id
   * @returns {boolean}
   */
  function isOpen(id) {
    var entry = _modals[id];
    return entry ? entry.isOpen : false;
  }

  /**
   * Switch rendering mode for a modal.
   * @param {string} id
   * @param {'dom'|'phaser'|'both'} mode
   */
  function setMode(id, mode) {
    if (mode !== 'dom' && mode !== 'phaser' && mode !== 'both') return;
    var entry = _modals[id];
    if (!entry) return;
    entry.mode = mode;
  }

  /**
   * Get current mode of a modal.
   * @param {string} id
   * @returns {'dom'|'phaser'|'both'}
   */
  function getMode(id) {
    var entry = _modals[id];
    return entry ? entry.mode : 'dom';
  }

  /**
   * Get all registered modals.
   * @returns {Object}
   */
  function getModals() {
    var result = {};
    for (var id in _modals) {
      if (_modals.hasOwnProperty(id)) {
        result[id] = {
          id: _modals[id].id,
          mode: _modals[id].mode,
          isOpen: _modals[id].isOpen,
          hasDom: !!_modals[id].domEl,
          hasPhaserScene: !!_modals[id].phaserSceneKey,
        };
      }
    }
    return result;
  }

  /**
   * Notify the adapter that a modal was opened externally (by legacy code).
   * Updates internal state and manages Phaser scene side only — does NOT
   * touch DOM, because the caller already handled DOM visibility.
   * @param {string} id
   * @param {*} [data] — optional data for the Phaser scene
   */
  function notifyOpen(id, data) {
    var entry = _modals[id];
    if (!entry) return;
    entry.isOpen = true;

    var mode = entry.mode;
    // Launch Phaser scene if mode includes phaser
    if ((mode === 'phaser' || mode === 'both') && entry.phaserSceneKey) {
      var overlayMgr = global.Game && global.Game.SceneOverlayManager;
      if (overlayMgr && typeof overlayMgr.show === 'function') {
        overlayMgr.show(entry.phaserSceneKey, data);
      }
    }
    // In phaser-only mode, ensure DOM is hidden (caller may have shown it)
    if (mode === 'phaser' && entry.domEl) {
      entry.domEl.classList.add(entry.hiddenClass);
      entry.domEl.setAttribute(entry.ariaAttr, 'true');
    }
  }

  /**
   * Notify the adapter that a modal was closed externally (by legacy code).
   * Updates internal state and hides Phaser scene — does NOT touch DOM.
   * @param {string} id
   */
  function notifyClose(id) {
    var entry = _modals[id];
    if (!entry) return;
    entry.isOpen = false;

    var mode = entry.mode;
    if ((mode === 'phaser' || mode === 'both') && entry.phaserSceneKey) {
      var overlayMgr = global.Game && global.Game.SceneOverlayManager;
      if (overlayMgr && typeof overlayMgr.hide === 'function') {
        overlayMgr.hide(entry.phaserSceneKey);
      }
    }
  }

  function isInitialized() {
    return _initialized;
  }

  function destroy() {
    _modals = {};
    _initialized = false;
  }

  global.Game = global.Game || {};
  global.Game.ModalAdapter = {
    init: init,
    registerModal: registerModal,
    setPhaserSceneKey: setPhaserSceneKey,
    open: open,
    close: close,
    notifyOpen: notifyOpen,
    notifyClose: notifyClose,
    isOpen: isOpen,
    setMode: setMode,
    getMode: getMode,
    getModals: getModals,
    isInitialized: isInitialized,
    destroy: destroy,
  };
}(window));
