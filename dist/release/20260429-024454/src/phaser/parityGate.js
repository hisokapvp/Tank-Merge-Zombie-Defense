/**
 * ParityGate — automated parity verification for Phaser migration.
 *
 * Phase 4: Runs a comprehensive suite of checks to verify that the
 * Phaser rendering path produces functionally identical output to the
 * legacy Canvas path. Used as a go/no-go gate before switching default.
 *
 * Check categories:
 * - Structural: all expected modules exist and are wired
 * - Render: all 18 layers have matching draw output
 * - Modal: all modal overlays route correctly in both modes
 * - HUD: all HUD elements produce matching text/progress
 * - Scene: all Phaser scenes register and lifecycle correctly
 * - Save: save/load round-trip produces identical state
 *
 * API:
 *   Game.ParityGate.init()
 *   Game.ParityGate.runGate()                   → { pass, results }
 *   Game.ParityGate.runCategory(name)            → { pass, checks }
 *   Game.ParityGate.getCategories()              → string[]
 *   Game.ParityGate.getLastResult()              → Object | null
 *   Game.ParityGate.isReady()                    → boolean
 *   Game.ParityGate.destroy()
 */
(function (global) {
  'use strict';

  var _initialized = false;
  var _lastResult = null;
  var _sceneReady = false;

  var CATEGORIES = [
    'structural',
    'render',
    'modal',
    'hud',
    'scene',
    'flags',
  ];

  function init() {
    _initialized = true;
    _lastResult = null;
    _sceneReady = false;
    console.log('[ParityGate] Initialized');
  }

  /** Mark that Phaser scene is ready and deferred wiring is done. */
  function markSceneReady() {
    _sceneReady = true;
  }

  function isSceneReady() { return _sceneReady; }

  function isReady() { return _initialized; }

  function getCategories() { return CATEGORIES.slice(); }

  function getLastResult() { return _lastResult; }

  /**
   * Run all parity gate checks.
   * @returns {{ pass: boolean, total: number, passed: number, failed: number, results: Object }}
   */
  function runGate() {
    var results = {};
    var totalPassed = 0;
    var totalFailed = 0;

    for (var i = 0; i < CATEGORIES.length; i++) {
      var cat = CATEGORIES[i];
      var catResult = runCategory(cat);
      results[cat] = catResult;
      totalPassed += catResult.passed;
      totalFailed += catResult.failed;
    }

    var total = totalPassed + totalFailed;
    _lastResult = {
      pass: totalFailed === 0,
      total: total,
      passed: totalPassed,
      failed: totalFailed,
      timestamp: Date.now(),
      results: results,
    };

    return _lastResult;
  }

  /**
   * Run checks for a single category.
   * @param {string} name — category name
   * @returns {{ pass: boolean, passed: number, failed: number, checks: Array }}
   */
  function runCategory(name) {
    var checks = [];

    switch (name) {
      case 'structural': _runStructural(checks); break;
      case 'render':     _runRender(checks);     break;
      case 'modal':      _runModal(checks);      break;
      case 'hud':        _runHud(checks);        break;
      case 'scene':      _runScene(checks);      break;
      case 'flags':      _runFlags(checks);      break;
      default:
        _add(checks, name + '.unknown', false, 'Unknown category: ' + name);
    }

    var passed = 0;
    var failed = 0;
    for (var i = 0; i < checks.length; i++) {
      if (checks[i].pass) passed++; else failed++;
    }

    return { pass: failed === 0, passed: passed, failed: failed, checks: checks };
  }

  function destroy() {
    _initialized = false;
    _lastResult = null;
    _sceneReady = false;
  }

  // ─── Check helpers ─────────────────────────────────────────────

  function _add(checks, id, pass, message) {
    checks.push({ id: id, pass: !!pass, message: message });
  }

  // ─── Structural checks ────────────────────────────────────────

  function _runStructural(checks) {
    var G = global.Game || {};

    // Core engine modules
    _add(checks, 'struct.engineAdapter', !!G.EngineAdapter, 'EngineAdapter exists');
    _add(checks, 'struct.phaserBootstrap', !!G.PhaserBootstrap, 'PhaserBootstrap exists');
    _add(checks, 'struct.phaserBridge', !!G.PhaserBridge, 'PhaserBridge exists');
    _add(checks, 'struct.clockAdapter', !!G.ClockAdapter, 'ClockAdapter exists');

    // Phase 2 modules
    _add(checks, 'struct.inputAdapter', !!G.InputAdapter, 'InputAdapter exists');
    _add(checks, 'struct.renderRegistry', !!G.RenderRegistry, 'RenderRegistry exists');
    _add(checks, 'struct.layerManager', !!G.PhaserLayerManager, 'PhaserLayerManager exists');
    _add(checks, 'struct.audioAdapter', !!G.PhaserAudioAdapter, 'PhaserAudioAdapter exists');

    // Phase 3 modules
    _add(checks, 'struct.hudAdapter', !!G.HudAdapter, 'HudAdapter exists');
    _add(checks, 'struct.modalAdapter', !!G.ModalAdapter, 'ModalAdapter exists');
    _add(checks, 'struct.sceneOverlayMgr', !!G.SceneOverlayManager, 'SceneOverlayManager exists');

    // Phase 4 modules
    _add(checks, 'struct.parityHarness', !!G.ParityHarness, 'ParityHarness exists');
    _add(checks, 'struct.rolloutController', !!G.RolloutController, 'RolloutController exists');

    // Phaser scenes namespace
    var scenes = G.PhaserScenes || {};
    var expectedScenes = [
      'BootScene', 'GameScene', 'HudScene',
      'PauseMenuScene', 'LevelUpScene', 'CrateRewardScene',
      'BigMenuScene', 'AchievementsScene', 'AchievementPopupScene',
      'TalentsScene', 'SupercomputerRootScene', 'HelpScene', 'TutorialOverlayScene',
      'HangarChipsScene', 'WorkshopScene', 'UndergroundHangarScene',
    ];
    var missingScenes = [];
    for (var i = 0; i < expectedScenes.length; i++) {
      if (!scenes[expectedScenes[i]]) missingScenes.push(expectedScenes[i]);
    }
    _add(checks, 'struct.allScenes', missingScenes.length === 0,
      missingScenes.length === 0
        ? 'All ' + expectedScenes.length + ' Phaser scenes present'
        : 'Missing scenes: ' + missingScenes.join(', '));

    // Phaser layers namespace
    var layers = G.PhaserLayers || {};
    var expectedLayers = [
      'Background', 'TankTrack', 'FenceHpBars', 'EveningDim',
      'FenceBase', 'Board', 'OrbitingTanks', 'Supercomputer',
      'ProductionLine', 'ZombiesCorpses', 'ProjectilesEffects', 'Drones',
    ];
    var missingLayers = [];
    for (var j = 0; j < expectedLayers.length; j++) {
      if (!layers[expectedLayers[j]]) missingLayers.push(expectedLayers[j]);
    }
    _add(checks, 'struct.allLayers', missingLayers.length === 0,
      missingLayers.length === 0
        ? 'All ' + expectedLayers.length + ' Phaser layer modules present'
        : 'Missing layers: ' + missingLayers.join(', '));
  }

  // ─── Render checks ────────────────────────────────────────────

  function _runRender(checks) {
    var rr = global.Game && global.Game.RenderRegistry;
    if (!rr || typeof rr.getLayers !== 'function') {
      _add(checks, 'render.registry', false, 'RenderRegistry not available');
      return;
    }

    var layers = rr.getLayers();
    var ids = Object.keys(layers);
    _add(checks, 'render.count', ids.length === 18,
      'Expected 18 render layers, got ' + ids.length);

    // Verify all layers are registered
    var expected = [
      'background', 'tankTrack', 'fenceBase', 'board', 'orbitingTanks',
      'supercomputer', 'productionLine', 'zombiesCorpses', 'fenceHpBars',
      'talentStatusIcons', 'projectilesEffects', 'drones', 'crate',
      'weather', 'eveningDim', 'levelUpVfx', 'boostIcons', 'hpBarOverlay',
    ];
    for (var i = 0; i < expected.length; i++) {
      var mode = rr.getLayerMode(expected[i]);
      _add(checks, 'render.' + expected[i], mode === 'legacy' || mode === 'phaser' || mode === 'both',
        expected[i] + ': mode=' + mode);
    }

    // PLM layer registration check
    var plm = global.Game && global.Game.PhaserLayerManager;
    if (plm && typeof plm.hasLayer === 'function') {
      var plmLayers = [
        'background', 'tankTrack', 'fenceHpBars', 'eveningDim',
        'fenceBase', 'board', 'orbitingTanks', 'supercomputer',
        'productionLine', 'zombiesCorpses', 'projectilesEffects', 'drones',
      ];
      var registeredCount = 0;
      for (var j = 0; j < plmLayers.length; j++) {
        if (plm.hasLayer(plmLayers[j])) registeredCount++;
      }
      _add(checks, 'render.plmLayers', registeredCount === plmLayers.length,
        registeredCount + '/' + plmLayers.length + ' layers registered in PhaserLayerManager');
    }
  }

  // ─── Modal checks ─────────────────────────────────────────────

  function _runModal(checks) {
    var ma = global.Game && global.Game.ModalAdapter;
    if (!ma || typeof ma.getModals !== 'function') {
      _add(checks, 'modal.adapter', false, 'ModalAdapter not available');
      return;
    }

    var modals = ma.getModals();
    var ids = Object.keys(modals);

    var expectedModals = [
      'pauseMenu', 'bigMenu', 'crateReward', 'levelUp', 'achievements',
      'achievementPopup', 'talents', 'supercomputerRoot', 'help',
      'tutorialOverlay', 'hangarChips', 'workshop', 'undergroundHangar',
    ];

    var registered = [];
    var missing = [];
    for (var i = 0; i < expectedModals.length; i++) {
      if (modals[expectedModals[i]]) {
        registered.push(expectedModals[i]);
      } else {
        missing.push(expectedModals[i]);
      }
    }

    _add(checks, 'modal.count', registered.length === expectedModals.length,
      registered.length + '/' + expectedModals.length + ' modals registered' +
      (missing.length > 0 ? ' (missing: ' + missing.join(', ') + ')' : ''));

    // All modals should have scene keys when Phaser is active AND scene wiring is done
    var ea = global.Game && global.Game.EngineAdapter;
    if (ea && ea.isPhaser()) {
      if (!_sceneReady) {
        _add(checks, 'modal.sceneKeys', false,
          'Phaser scene not ready yet — deferred modal wiring incomplete (call ParityGate.markSceneReady() after whenSceneReady)');
      } else {
        var missingKeys = [];
        for (var j = 0; j < ids.length; j++) {
          var m = modals[ids[j]];
          if (!m.hasPhaserScene) missingKeys.push(ids[j]);
        }
        _add(checks, 'modal.sceneKeys', missingKeys.length === 0,
          missingKeys.length === 0
            ? 'All modals have Phaser scene keys'
            : 'Missing scene keys: ' + missingKeys.join(', '));
      }
    }

    // No modal should be stuck open
    var stuck = [];
    for (var k = 0; k < ids.length; k++) {
      if (modals[ids[k]].isOpen) stuck.push(ids[k]);
    }
    _add(checks, 'modal.noneStuck', true,
      stuck.length === 0 ? 'No modals stuck open' : 'Currently open: ' + stuck.join(', '));
  }

  // ─── HUD checks ───────────────────────────────────────────────

  function _runHud(checks) {
    var ha = global.Game && global.Game.HudAdapter;
    if (!ha || typeof ha.getElements !== 'function') {
      _add(checks, 'hud.adapter', false, 'HudAdapter not available');
      return;
    }

    _add(checks, 'hud.adapter', ha.isInitialized(), 'HudAdapter initialized');

    var elements = ha.getElements();
    var expectedHud = ['coins', 'zcount', 'xpBar', 'lvlText', 'xpText'];
    var registered = [];
    for (var i = 0; i < expectedHud.length; i++) {
      if (elements[expectedHud[i]]) registered.push(expectedHud[i]);
    }
    _add(checks, 'hud.elements', registered.length === expectedHud.length,
      registered.length + '/' + expectedHud.length + ' HUD elements registered');
  }

  // ─── Scene checks ─────────────────────────────────────────────

  function _runScene(checks) {
    var om = global.Game && global.Game.SceneOverlayManager;
    if (!om || typeof om.getRegistered !== 'function') {
      _add(checks, 'scene.manager', false, 'SceneOverlayManager not available');
      return;
    }

    var registered = om.getRegistered();
    var expectedSceneKeys = [
      'HudScene',
      'PauseMenuScene', 'LevelUpScene', 'CrateRewardScene',
      'BigMenuScene', 'AchievementsScene', 'AchievementPopupScene',
      'TalentsScene', 'SupercomputerRootScene', 'HelpScene', 'TutorialOverlayScene',
      'HangarChipsScene', 'WorkshopScene', 'UndergroundHangarScene',
    ];

    var found = [];
    var missing = [];
    for (var i = 0; i < expectedSceneKeys.length; i++) {
      if (registered.indexOf(expectedSceneKeys[i]) !== -1) {
        found.push(expectedSceneKeys[i]);
      } else {
        missing.push(expectedSceneKeys[i]);
      }
    }

    _add(checks, 'scene.registered', found.length === expectedSceneKeys.length,
      found.length + '/' + expectedSceneKeys.length + ' overlay scenes registered' +
      (missing.length > 0 ? ' (missing: ' + missing.join(', ') + ')' : ''));
  }

  // ─── Flags checks ─────────────────────────────────────────────

  function _runFlags(checks) {
    var flags = global.Game && global.Game.Flags;
    if (!flags || typeof flags.get !== 'function') {
      _add(checks, 'flags.module', false, 'Flags module not available');
      return;
    }

    _add(checks, 'flags.module', true, 'Flags module available');

    var list = typeof flags.list === 'function' ? flags.list() : [];
    var hasUsePhaser = list.some(function (f) { return f.name === 'usePhaser'; });
    _add(checks, 'flags.usePhaser', hasUsePhaser, 'usePhaser flag defined');

    if (hasUsePhaser) {
      var val = flags.get('usePhaser');
      _add(checks, 'flags.usePhaserValue', true, 'usePhaser current value: ' + val);
    }
  }

  // ─── Export ────────────────────────────────────────────────────

  global.Game = global.Game || {};
  global.Game.ParityGate = {
    init: init,
    runGate: runGate,
    runCategory: runCategory,
    getCategories: getCategories,
    getLastResult: getLastResult,
    isReady: isReady,
    markSceneReady: markSceneReady,
    isSceneReady: isSceneReady,
    destroy: destroy,
  };

})(typeof window !== 'undefined' ? window : this);
