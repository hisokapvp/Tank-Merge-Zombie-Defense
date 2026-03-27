/**
 * PhaserBridge — delegation bridge between Phaser GameScene and legacy code.
 *
 * Phase 1 behavior:
 * - Legacy game.js registers its step/draw functions here
 * - Phaser GameScene calls bridge.stepFn/drawFn each frame
 * - This allows Phaser to drive the game loop while legacy code does all work
 *
 * Phase 2+ will gradually replace bridge delegates with native Phaser rendering.
 *
 * API:
 *   Game.PhaserBridge.register(config)
 *   Game.PhaserBridge.stepFn(dt, time)
 *   Game.PhaserBridge.drawFn()
 *   Game.PhaserBridge.onSceneReady(scene)
 *   Game.PhaserBridge.getScene() → Phaser.Scene | null
 *   Game.PhaserBridge.isActive() → boolean
 */
(function (global) {
  'use strict';

  var _stepFn = null;
  var _drawFn = null;
  var _scene = null;
  var _sceneReadyCallbacks = [];

  /**
   * Register legacy step/draw functions for Phaser delegation.
   * @param {Object} config
   * @param {Function} config.step - function(dt, time) for simulation
   * @param {Function} config.draw - function() for rendering
   */
  function register(config) {
    config = config || {};
    _stepFn = typeof config.step === 'function' ? config.step : null;
    _drawFn = typeof config.draw === 'function' ? config.draw : null;
    console.log('[PhaserBridge] Legacy delegates registered');
  }

  function stepFn(dt, time) {
    if (_stepFn) _stepFn(dt, time);
  }

  function drawFn() {
    if (_drawFn) _drawFn();
  }

  function onSceneReady(scene) {
    _scene = scene;
    for (var i = 0; i < _sceneReadyCallbacks.length; i++) {
      try { _sceneReadyCallbacks[i](scene); } catch (e) {
        console.warn('[PhaserBridge] onSceneReady callback error:', e);
      }
    }
    _sceneReadyCallbacks.length = 0;
  }

  function getScene() {
    return _scene;
  }

  function isActive() {
    return _scene !== null;
  }

  function whenSceneReady(callback) {
    if (typeof callback !== 'function') return;
    if (_scene) {
      try { callback(_scene); } catch (e) {
        console.warn('[PhaserBridge] whenSceneReady callback error:', e);
      }
      return;
    }
    _sceneReadyCallbacks.push(callback);
  }

  function destroy() {
    _stepFn = null;
    _drawFn = null;
    _scene = null;
    _sceneReadyCallbacks.length = 0;
  }

  global.Game = global.Game || {};
  global.Game.PhaserBridge = {
    register: register,
    stepFn: stepFn,
    drawFn: drawFn,
    onSceneReady: onSceneReady,
    getScene: getScene,
    isActive: isActive,
    whenSceneReady: whenSceneReady,
    destroy: destroy,
  };
}(window));
