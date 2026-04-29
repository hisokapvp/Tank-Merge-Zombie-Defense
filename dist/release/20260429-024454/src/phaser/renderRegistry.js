/**
 * RenderRegistry — tracks which render layers are handled by Phaser vs legacy.
 *
 * Phase 2: As rendering is migrated layer-by-layer from legacy Canvas 2D to
 * Phaser GameObjects, this registry tracks which layers are active in each mode.
 * The legacy draw() function checks the registry before calling each layer's
 * draw function, and the Phaser scene checks it to know which layers to render.
 *
 * Layer IDs follow the draw() z-order in game.js:
 *   background, tankTrack, fenceBase, board, orbitingTanks, supercomputer,
 *   productionLine, zombiesCorpses, fenceHpBars, talentStatusIcons,
 *   projectilesEffects, drones, crate, weather, eveningDim, levelUpVfx,
 *   boostIcons, hpBarOverlay
 *
 * API:
 *   Game.RenderRegistry.init()
 *   Game.RenderRegistry.setLayerMode(layerId, mode)
 *   Game.RenderRegistry.getLayerMode(layerId) → 'legacy' | 'phaser' | 'both'
 *   Game.RenderRegistry.isLegacy(layerId) → boolean
 *   Game.RenderRegistry.isPhaser(layerId) → boolean
 *   Game.RenderRegistry.getLayers() → { [layerId]: mode }
 *   Game.RenderRegistry.destroy()
 */
(function (global) {
  'use strict';

  /** @type {string[]} Canonical render layer IDs in z-order */
  var LAYER_IDS = [
    'background',
    'tankTrack',
    'fenceBase',
    'board',
    'orbitingTanks',
    'supercomputer',
    'productionLine',
    'zombiesCorpses',
    'fenceHpBars',
    'talentStatusIcons',
    'projectilesEffects',
    'drones',
    'crate',
    'weather',
    'eveningDim',
    'levelUpVfx',
    'boostIcons',
    'hpBarOverlay',
  ];

  /** @type {Object<string, string>} layerId → 'legacy' | 'phaser' | 'both' */
  var _layers = {};

  function init() {
    _layers = {};
    for (var i = 0; i < LAYER_IDS.length; i++) {
      _layers[LAYER_IDS[i]] = 'legacy';
    }
  }

  /**
   * Set the rendering mode for a layer.
   * @param {string} layerId
   * @param {'legacy'|'phaser'|'both'} mode
   */
  function setLayerMode(layerId, mode) {
    if (mode !== 'legacy' && mode !== 'phaser' && mode !== 'both') {
      console.warn('[RenderRegistry] Invalid mode:', mode, 'for layer:', layerId);
      return;
    }
    _layers[layerId] = mode;
  }

  /**
   * Get the rendering mode for a layer.
   * @param {string} layerId
   * @returns {'legacy'|'phaser'|'both'}
   */
  function getLayerMode(layerId) {
    return _layers[layerId] || 'legacy';
  }

  /**
   * Check if legacy should render this layer.
   * Returns true for 'legacy' and 'both' modes.
   * @param {string} layerId
   * @returns {boolean}
   */
  function isLegacy(layerId) {
    var mode = _layers[layerId] || 'legacy';
    return mode === 'legacy' || mode === 'both';
  }

  /**
   * Check if Phaser should render this layer.
   * Returns true for 'phaser' and 'both' modes.
   * @param {string} layerId
   * @returns {boolean}
   */
  function isPhaser(layerId) {
    var mode = _layers[layerId] || 'legacy';
    return mode === 'phaser' || mode === 'both';
  }

  /**
   * Get all layers and their modes.
   * @returns {Object<string, string>}
   */
  function getLayers() {
    var result = {};
    for (var key in _layers) {
      if (_layers.hasOwnProperty(key)) {
        result[key] = _layers[key];
      }
    }
    return result;
  }

  /**
   * Get canonical layer IDs in z-order.
   * @returns {string[]}
   */
  function getLayerIds() {
    return LAYER_IDS.slice();
  }

  function destroy() {
    _layers = {};
  }

  global.Game = global.Game || {};
  global.Game.RenderRegistry = {
    init: init,
    setLayerMode: setLayerMode,
    getLayerMode: getLayerMode,
    isLegacy: isLegacy,
    isPhaser: isPhaser,
    getLayers: getLayers,
    getLayerIds: getLayerIds,
    destroy: destroy,
  };
}(window));
