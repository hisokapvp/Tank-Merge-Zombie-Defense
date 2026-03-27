/**
 * PhaserBootstrap — creates and configures the Phaser.Game instance.
 *
 * Called by game.js boot() when EngineAdapter selects 'phaser'.
 * Responsible for:
 * - Creating Phaser.Game with correct canvas config
 * - Registering BootScene and GameScene
 * - Setting up the PhaserBridge for legacy code delegation
 *
 * API:
 *   Game.PhaserBootstrap.start(config) → Phaser.Game
 *   Game.PhaserBootstrap.getGame()     → Phaser.Game | null
 *   Game.PhaserBootstrap.destroy()     → void
 */
(function (global) {
  'use strict';

  if (typeof Phaser === 'undefined') {
    // Phaser not loaded — provide stub so callers don't crash
    global.Game = global.Game || {};
    global.Game.PhaserBootstrap = {
      start: function () {
        console.warn('[PhaserBootstrap] Phaser not available');
        return null;
      },
      getGame: function () { return null; },
      destroy: function () {},
    };
    return;
  }

  var _game = null;

  /**
   * Start the Phaser game.
   * @param {Object} config
   * @param {HTMLCanvasElement} config.canvas - existing canvas element to use
   * @param {number} config.width - game width
   * @param {number} config.height - game height
   * @param {boolean} [config.transparent] - transparent canvas background
   * @returns {Phaser.Game}
   */
  function start(config) {
    if (_game) {
      console.warn('[PhaserBootstrap] Phaser game already running');
      return _game;
    }

    config = config || {};
    var scenes = global.Game && global.Game.PhaserScenes || {};
    var sceneList = [];

    if (scenes.BootScene) sceneList.push(scenes.BootScene);
    if (scenes.GameScene) sceneList.push(scenes.GameScene);
    // Phase 3: HudScene runs as overlay, launched after GameScene is ready
    if (scenes.HudScene) sceneList.push(scenes.HudScene);
    // Phase 3b: Modal overlay scenes
    if (scenes.PauseMenuScene) sceneList.push(scenes.PauseMenuScene);
    if (scenes.LevelUpScene) sceneList.push(scenes.LevelUpScene);
    if (scenes.CrateRewardScene) sceneList.push(scenes.CrateRewardScene);
    // Phase 3c: Progression & achievement overlay scenes
    if (scenes.BigMenuScene) sceneList.push(scenes.BigMenuScene);
    if (scenes.AchievementsScene) sceneList.push(scenes.AchievementsScene);
    if (scenes.AchievementPopupScene) sceneList.push(scenes.AchievementPopupScene);
    // Phase 3d: Talents, supercomputer root, help, tutorial overlay scenes
    if (scenes.TalentsScene) sceneList.push(scenes.TalentsScene);
    if (scenes.SupercomputerRootScene) sceneList.push(scenes.SupercomputerRootScene);
    if (scenes.HelpScene) sceneList.push(scenes.HelpScene);
    if (scenes.TutorialOverlayScene) sceneList.push(scenes.TutorialOverlayScene);
    // Phase 3e: Hangar, workshop, underground hangar overlay scenes
    if (scenes.HangarChipsScene) sceneList.push(scenes.HangarChipsScene);
    if (scenes.WorkshopScene) sceneList.push(scenes.WorkshopScene);
    if (scenes.UndergroundHangarScene) sceneList.push(scenes.UndergroundHangarScene);

    if (sceneList.length === 0) {
      console.error('[PhaserBootstrap] No scenes registered');
      return null;
    }

    var clearBefore = config.clearBeforeRender !== undefined
      ? !!config.clearBeforeRender : true;

    var phaserConfig = {
      type: Phaser.CANVAS,
      canvas: config.canvas || null,
      width: config.width || 1100,
      height: config.height || 650,
      backgroundColor: clearBefore ? '#000000' : undefined,
      transparent: !!config.transparent,
      clearBeforeRender: clearBefore,
      banner: false,
      audio: {
        // Phase 2d: enable Web Audio for PhaserAudioAdapter; legacy fallback always available
        noAudio: !!config.noAudio,
      },
      scene: sceneList,
      render: {
        pixelArt: false,
        antialias: true,
        roundPixels: false,
      },
      scale: {
        mode: Phaser.Scale.NONE, // We manage canvas size ourselves
        autoCenter: Phaser.Scale.NO_CENTER,
      },
      input: {
        // Phase 2d: enable Phaser input for A/B comparison harness
        // Legacy Pointer Events remain primary; Phaser input runs in parallel
        mouse: !config.noInput,
        touch: !config.noInput,
        keyboard: false,
        gamepad: false,
      },
      fps: {
        target: 60,
        forceSetTimeOut: false,
      },
      callbacks: {
        preBoot: function (game) {
          console.log('[PhaserBootstrap] Phaser pre-boot');
        },
        postBoot: function (game) {
          console.log('[PhaserBootstrap] Phaser post-boot — game ready');
        },
      },
    };

    _game = new Phaser.Game(phaserConfig);
    return _game;
  }

  function getGame() {
    return _game;
  }

  function destroy() {
    if (_game) {
      _game.destroy(true);
      _game = null;
    }
  }

  global.Game = global.Game || {};
  global.Game.PhaserBootstrap = {
    start: start,
    getGame: getGame,
    destroy: destroy,
  };
}(window));
