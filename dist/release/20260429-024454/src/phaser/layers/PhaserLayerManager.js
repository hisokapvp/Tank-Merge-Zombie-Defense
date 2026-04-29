/**
 * PhaserLayerManager — coordinator for Phaser render layer modules.
 *
 * Phase 2c: Each render layer being migrated to Phaser has a module that:
 *   - Accepts game state and config as input
 *   - Draws to Canvas 2D ctx at the correct z-position
 *   - Is called from game.js draw() when RenderRegistry says 'phaser'
 *
 * This approach preserves z-order interleaving during incremental migration.
 * When all layers are migrated (Phase 4), modules will switch to native
 * Phaser GameObjects.
 *
 * API:
 *   Game.PhaserLayerManager.init(config)
 *   Game.PhaserLayerManager.registerLayer(layerId, module)
 *   Game.PhaserLayerManager.drawLayer(layerId, ctx)
 *   Game.PhaserLayerManager.updateLayer(layerId, state)
 *   Game.PhaserLayerManager.hasLayer(layerId) → boolean
 *   Game.PhaserLayerManager.getLayer(layerId) → module | null
 *   Game.PhaserLayerManager.destroy()
 */
(function (global) {
  'use strict';

  /** @type {Object<string, Object>} layerId → layer module */
  var _layers = {};
  var _config = null;

  /**
   * Initialize the layer manager.
   * @param {Object} config
   * @param {Object} config.viewSize - { w, h, dpr }
   * @param {Object} config.center  - { x, y }
   * @param {Function} config.nowSec - game clock
   * @param {number} config.balScale - balance scale factor
   */
  function init(config) {
    _config = config || {};
    _layers = {};
  }

  /**
   * Register a layer module for a given render layer.
   * Module must implement: init(config), draw(ctx), destroy().
   * Optional: update(state), invalidate().
   * @param {string} layerId
   * @param {Object} module
   */
  function registerLayer(layerId, module) {
    if (!layerId || !module) return;
    _layers[layerId] = module;
    if (typeof module.init === 'function' && _config) {
      module.init(_config);
    }
  }

  /**
   * Draw a specific layer to the given canvas context.
   * Called from game.js draw() at the correct z-position.
   * @param {string} layerId
   * @param {CanvasRenderingContext2D} ctx
   */
  function drawLayer(layerId, ctx) {
    var layer = _layers[layerId];
    if (!layer || typeof layer.draw !== 'function') return;
    layer.draw(ctx);
  }

  /**
   * Push state updates to a specific layer.
   * @param {string} layerId
   * @param {Object} state
   */
  function updateLayer(layerId, state) {
    var layer = _layers[layerId];
    if (!layer || typeof layer.update !== 'function') return;
    layer.update(state);
  }

  /**
   * Push state updates to all registered layers.
   * @param {Object} state
   */
  function updateAll(state) {
    for (var id in _layers) {
      if (_layers.hasOwnProperty(id)) {
        var layer = _layers[id];
        if (typeof layer.update === 'function') {
          layer.update(state);
        }
      }
    }
  }

  /**
   * Check if a layer module is registered.
   * @param {string} layerId
   * @returns {boolean}
   */
  function hasLayer(layerId) {
    return !!_layers[layerId];
  }

  /**
   * Get a registered layer module.
   * @param {string} layerId
   * @returns {Object|null}
   */
  function getLayer(layerId) {
    return _layers[layerId] || null;
  }

  /**
   * Get the shared config.
   * @returns {Object|null}
   */
  function getConfig() {
    return _config;
  }

  /**
   * Invalidate a specific layer (forces rebuild on next draw).
   * @param {string} layerId
   */
  function invalidateLayer(layerId) {
    var layer = _layers[layerId];
    if (layer && typeof layer.invalidate === 'function') {
      layer.invalidate();
    }
  }

  /**
   * Invalidate all registered layers.
   */
  function invalidateAll() {
    for (var id in _layers) {
      if (_layers.hasOwnProperty(id)) {
        var layer = _layers[id];
        if (typeof layer.invalidate === 'function') {
          layer.invalidate();
        }
      }
    }
  }

  function destroy() {
    for (var id in _layers) {
      if (_layers.hasOwnProperty(id)) {
        var layer = _layers[id];
        if (typeof layer.destroy === 'function') {
          layer.destroy();
        }
      }
    }
    _layers = {};
    _config = null;
  }

  global.Game = global.Game || {};
  global.Game.PhaserLayerManager = {
    init: init,
    registerLayer: registerLayer,
    drawLayer: drawLayer,
    updateLayer: updateLayer,
    updateAll: updateAll,
    hasLayer: hasLayer,
    getLayer: getLayer,
    getConfig: getConfig,
    invalidateLayer: invalidateLayer,
    invalidateAll: invalidateAll,
    destroy: destroy,
  };
}(window));
