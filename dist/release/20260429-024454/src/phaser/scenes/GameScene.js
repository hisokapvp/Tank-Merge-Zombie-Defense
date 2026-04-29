/**
 * GameScene — Main Phaser 3 game scene.
 *
 * Phase 1 behavior:
 * - Delegates simulation step to legacy game loop functions
 * - Delegates rendering to legacy Canvas draw() pipeline via shared ctx
 * - Acts as a transparent bridge: same behavior, different loop driver
 *
 * Phase 2+ will incrementally move rendering into Phaser GameObjects.
 *
 * Integration points:
 * - Game.PhaserBridge.stepFn(dt)   — simulation step from legacy
 * - Game.PhaserBridge.drawFn(ctx)  — render from legacy
 * - Game.PhaserBridge.getNowSec()  — game clock
 * - Game.PhaserBridge.isPaused()   — pause state check
 */
(function (global) {
  'use strict';

  if (typeof Phaser === 'undefined') return;

  var GameScene = new Phaser.Class({
    Extends: Phaser.Scene,

    initialize: function GameScene() {
      Phaser.Scene.call(this, { key: 'GameScene' });
      this._lastTime = 0;
      this._fpsAvg = 60;
    },

    create: function () {
      console.log('[GameScene] Scene created — Phaser runtime active');

      // Signal to EngineAdapter that Phaser is ready
      var adapter = global.Game && global.Game.EngineAdapter;
      if (adapter && typeof adapter.setPhaserGame === 'function') {
        adapter.setPhaserGame(this.game);
      }

      // Signal to bridge that scene is ready
      var bridge = global.Game && global.Game.PhaserBridge;
      if (bridge && typeof bridge.onSceneReady === 'function') {
        bridge.onSceneReady(this);
      }

      this._lastTime = performance.now();
    },

    update: function (time, delta) {
      var bridge = global.Game && global.Game.PhaserBridge;
      if (!bridge) return;

      // delta is in ms from Phaser; convert to seconds, cap at 33ms
      var dtSec = Math.min(0.033, delta / 1000);

      // FPS tracking
      this._fpsAvg = this._fpsAvg * 0.95 + (1000 / Math.max(1, delta)) * 0.05;

      // Delegate simulation step to legacy code
      if (typeof bridge.stepFn === 'function') {
        bridge.stepFn(dtSec, time);
      }

      // Delegate rendering to legacy Canvas draw
      // In Phase 1 we still render via the legacy 2D context
      if (typeof bridge.drawFn === 'function') {
        bridge.drawFn();
      }
    },

    getFpsAvg: function () {
      return this._fpsAvg;
    },
  });

  global.Game = global.Game || {};
  global.Game.PhaserScenes = global.Game.PhaserScenes || {};
  global.Game.PhaserScenes.GameScene = GameScene;
}(window));
