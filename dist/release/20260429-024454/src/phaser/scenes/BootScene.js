/**
 * BootScene — Phaser 3 boot scene for asset preloading.
 *
 * Responsible for:
 * - Loading sprite atlases and images that Phaser needs
 * - Showing a minimal loading indicator
 * - Transitioning to GameScene when ready
 *
 * This scene runs only when usePhaser flag is active.
 */
(function (global) {
  'use strict';

  if (typeof Phaser === 'undefined') return;

  var BootScene = new Phaser.Class({
    Extends: Phaser.Scene,

    initialize: function BootScene() {
      Phaser.Scene.call(this, { key: 'BootScene' });
    },

    preload: function () {
      // ── Loading progress bar ──
      var width = this.cameras.main.width;
      var height = this.cameras.main.height;
      var progressBar = this.add.graphics();
      var progressBox = this.add.graphics();
      progressBox.fillStyle(0x222222, 0.8);
      progressBox.fillRect(width / 2 - 160, height / 2 - 15, 320, 30);

      this.load.on('progress', function (value) {
        progressBar.clear();
        progressBar.fillStyle(0x4caf50, 1);
        progressBar.fillRect(width / 2 - 150, height / 2 - 10, 300 * value, 20);
      });

      this.load.on('complete', function () {
        progressBar.destroy();
        progressBox.destroy();
      });

      // ── Preload common assets ──
      // Phase 1: minimal preload — just verify Phaser loads.
      // Phase 2+ will add atlas/spritesheet preloads here as rendering migrates.
      //
      // Example (Phase 2):
      // this.load.atlas('zombies', 'assets/zombies_atlas.png', 'assets/zombies_atlas.json');
      // this.load.atlas('tanks', 'assets/tanks_atlas.png', 'assets/tanks_atlas.json');
    },

    create: function () {
      console.log('[BootScene] Assets loaded, transitioning to GameScene');
      this.scene.start('GameScene');
    },
  });

  global.Game = global.Game || {};
  global.Game.PhaserScenes = global.Game.PhaserScenes || {};
  global.Game.PhaserScenes.BootScene = BootScene;
}(window));
