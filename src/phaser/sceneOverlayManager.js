/**
 * SceneOverlayManager — coordinates Phaser overlay scenes (HUD, modals).
 *
 * Phaser supports multiple simultaneously active scenes. This manager
 * tracks which overlay scenes are registered and their current state
 * (active / sleeping / stopped). It provides a unified API for launching,
 * sleeping, waking, and stopping overlay scenes without knowing Phaser
 * scene manager internals.
 *
 * API:
 *   Game.SceneOverlayManager.init(config)
 *   Game.SceneOverlayManager.register(key, options)
 *   Game.SceneOverlayManager.show(key)
 *   Game.SceneOverlayManager.hide(key)
 *   Game.SceneOverlayManager.isVisible(key)
 *   Game.SceneOverlayManager.getState(key)       → 'active' | 'sleeping' | 'stopped' | null
 *   Game.SceneOverlayManager.onSceneCreated(key)  — callback from scene's create()
 *   Game.SceneOverlayManager.getRegistered()      → string[]
 *   Game.SceneOverlayManager.destroy()
 */
(function (global) {
  'use strict';

  /**
   * @typedef {Object} OverlayEntry
   * @property {string} key          — Phaser scene key
   * @property {boolean} autoLaunch  — launch scene automatically on init
   * @property {boolean} visible     — current visibility
   * @property {boolean} created     — scene's create() has been called
   */

  /** @type {Object<string, OverlayEntry>} */
  var _overlays = {};
  var _phaserGame = null;
  var _initialized = false;

  /**
   * Initialize the overlay manager.
   * @param {Object} config
   * @param {Phaser.Game} config.phaserGame — reference to the running Phaser.Game
   */
  function init(config) {
    config = config || {};
    _phaserGame = config.phaserGame || null;
    _overlays = {};
    _initialized = true;
    console.log('[SceneOverlayManager] Initialized');
  }

  /**
   * Register an overlay scene for management.
   * @param {string} key — Phaser scene key (must match the Scene class key)
   * @param {Object} [options]
   * @param {boolean} [options.autoLaunch] — launch scene immediately (default: false)
   */
  function register(key, options) {
    if (!key) return;
    options = options || {};
    _overlays[key] = {
      key: key,
      autoLaunch: !!options.autoLaunch,
      visible: false,
      created: false,
    };

    // Auto-launch if requested and Phaser game is available
    if (options.autoLaunch && _phaserGame) {
      _launchScene(key);
    }
  }

  /**
   * Show (wake/launch) an overlay scene.
   * @param {string} key
   */
  function show(key) {
    var entry = _overlays[key];
    if (!entry) return;

    if (!_phaserGame) return;

    var sceneMgr = _phaserGame.scene;
    if (!sceneMgr) return;

    var sceneInstance = sceneMgr.getScene(key);
    if (!sceneInstance) {
      // Scene not added yet — try launching
      _launchScene(key);
      entry.visible = true;
      return;
    }

    if (sceneMgr.isSleeping(key)) {
      sceneMgr.wake(key);
    } else if (!sceneMgr.isActive(key)) {
      sceneMgr.start(key);
    }

    // Call scene's show() method if available
    if (typeof sceneInstance.show === 'function') {
      sceneInstance.show();
    }

    entry.visible = true;
  }

  /**
   * Hide (sleep) an overlay scene.
   * @param {string} key
   */
  function hide(key) {
    var entry = _overlays[key];
    if (!entry) return;

    if (!_phaserGame) return;

    var sceneMgr = _phaserGame.scene;
    if (!sceneMgr) return;

    var sceneInstance = sceneMgr.getScene(key);
    if (sceneInstance && typeof sceneInstance.hide === 'function') {
      sceneInstance.hide();
    }

    if (sceneMgr.isActive(key)) {
      sceneMgr.sleep(key);
    }

    entry.visible = false;
  }

  /**
   * Check if an overlay is currently visible.
   * @param {string} key
   * @returns {boolean}
   */
  function isVisible(key) {
    var entry = _overlays[key];
    return entry ? entry.visible : false;
  }

  /**
   * Get the lifecycle state of an overlay scene.
   * @param {string} key
   * @returns {'active'|'sleeping'|'stopped'|null}
   */
  function getState(key) {
    if (!_overlays[key]) return null;
    if (!_phaserGame || !_phaserGame.scene) return 'stopped';

    var sceneMgr = _phaserGame.scene;
    if (sceneMgr.isActive(key)) return 'active';
    if (sceneMgr.isSleeping(key)) return 'sleeping';
    return 'stopped';
  }

  /**
   * Called by overlay scenes in their create() method to signal readiness.
   * @param {string} key
   */
  function onSceneCreated(key) {
    var entry = _overlays[key];
    if (entry) {
      entry.created = true;
    }
  }

  /**
   * Get list of registered overlay keys.
   * @returns {string[]}
   */
  function getRegistered() {
    return Object.keys(_overlays);
  }

  /**
   * Check if initialized.
   * @returns {boolean}
   */
  function isInitialized() {
    return _initialized;
  }

  function destroy() {
    // Stop all overlay scenes
    if (_phaserGame && _phaserGame.scene) {
      for (var key in _overlays) {
        if (_overlays.hasOwnProperty(key)) {
          try {
            if (_phaserGame.scene.isActive(key) || _phaserGame.scene.isSleeping(key)) {
              _phaserGame.scene.stop(key);
            }
          } catch (e) { /* scene may already be destroyed */ }
        }
      }
    }
    _overlays = {};
    _phaserGame = null;
    _initialized = false;
  }

  // --- Internal helpers ---

  function _launchScene(key) {
    if (!_phaserGame || !_phaserGame.scene) return;
    try {
      _phaserGame.scene.launch(key);
    } catch (e) {
      console.warn('[SceneOverlayManager] Failed to launch scene:', key, e);
    }
  }

  global.Game = global.Game || {};
  global.Game.SceneOverlayManager = {
    init: init,
    register: register,
    show: show,
    hide: hide,
    isVisible: isVisible,
    getState: getState,
    onSceneCreated: onSceneCreated,
    getRegistered: getRegistered,
    isInitialized: isInitialized,
    destroy: destroy,
  };
}(window));
