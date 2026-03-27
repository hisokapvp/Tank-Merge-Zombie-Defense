/**
 * EngineAdapter — runtime engine selection facade.
 *
 * Provides a unified interface for the game to work with either
 * the legacy Canvas 2D path or the Phaser 3 runtime.
 *
 * API:
 *   Game.EngineAdapter.init(config)
 *   Game.EngineAdapter.getActiveEngine()   → 'legacy' | 'phaser'
 *   Game.EngineAdapter.isPhaser()          → boolean
 *   Game.EngineAdapter.getLegacyCtx()      → CanvasRenderingContext2D | null
 *   Game.EngineAdapter.getPhaserGame()     → Phaser.Game | null
 *   Game.EngineAdapter.onReady(callback)   → void
 *   Game.EngineAdapter.destroy()           → void
 */
(function (global) {
  'use strict';

  var _engine = 'legacy';
  var _phaserGame = null;
  var _legacyCtx = null;
  var _ready = false;
  var _readyCallbacks = [];
  var _config = null;

  function resolveEngine() {
    var flags = global.Game && global.Game.Flags;
    if (flags && typeof flags.get === 'function' && flags.get('usePhaser')) {
      return 'phaser';
    }
    return 'legacy';
  }

  function fireReady() {
    _ready = true;
    for (var i = 0; i < _readyCallbacks.length; i++) {
      try { _readyCallbacks[i](_engine); } catch (e) {
        console.warn('[EngineAdapter] onReady callback error:', e);
      }
    }
    _readyCallbacks.length = 0;
  }

  /**
   * Initialize the engine adapter.
   * @param {Object} config
   * @param {CanvasRenderingContext2D} config.legacyCtx - current Canvas 2D context
   * @param {HTMLCanvasElement} config.canvas - current canvas element
   * @param {Object} [config.phaserConfig] - Phaser game config overrides
   */
  function init(config) {
    _config = config || {};
    _engine = resolveEngine();
    _legacyCtx = _config.legacyCtx || null;

    if (_engine === 'phaser') {
      // Phaser bootstrap will be handled by Game.PhaserBootstrap
      // which calls setPhaserGame() when ready
      console.log('[EngineAdapter] Engine selected: phaser');
    } else {
      console.log('[EngineAdapter] Engine selected: legacy');
      fireReady();
    }
  }

  function getActiveEngine() {
    return _engine;
  }

  function isPhaser() {
    return _engine === 'phaser';
  }

  function getLegacyCtx() {
    return _legacyCtx;
  }

  function getPhaserGame() {
    return _phaserGame;
  }

  function getConfig() {
    return _config;
  }

  /**
   * Called by PhaserBootstrap when Phaser.Game is ready.
   * @param {Phaser.Game} game
   */
  function setPhaserGame(game) {
    _phaserGame = game;
    if (_engine === 'phaser' && !_ready) {
      fireReady();
    }
  }

  function onReady(callback) {
    if (typeof callback !== 'function') return;
    if (_ready) {
      try { callback(_engine); } catch (e) {
        console.warn('[EngineAdapter] onReady callback error:', e);
      }
      return;
    }
    _readyCallbacks.push(callback);
  }

  function isReady() {
    return _ready;
  }

  function destroy() {
    if (_phaserGame && typeof _phaserGame.destroy === 'function') {
      _phaserGame.destroy(true);
    }
    _phaserGame = null;
    _ready = false;
    _readyCallbacks.length = 0;
    _engine = 'legacy';
  }

  global.Game = global.Game || {};
  global.Game.EngineAdapter = {
    init: init,
    getActiveEngine: getActiveEngine,
    isPhaser: isPhaser,
    getLegacyCtx: getLegacyCtx,
    getPhaserGame: getPhaserGame,
    getConfig: getConfig,
    setPhaserGame: setPhaserGame,
    onReady: onReady,
    isReady: isReady,
    destroy: destroy,
  };
}(window));
