/**
 * Pack 10e: Phaser Migration — Phase 2c Delegation Layer Tests
 *
 * Tests for the delegation-based Phaser layer modules:
 * FenceBaseLayer, BoardLayer, OrbitingTanksLayer, SupercomputerLayer,
 * ProductionLineLayer, ZombiesCorpsesLayer, ProjectilesEffectsLayer, DronesLayer.
 *
 * Run: node Test/pack10/phaser_migration_phase2c_delegation.test.js
 */
(function () {
  'use strict';

  var fs = require('fs');
  var path = require('path');

  // ── Minimal test runner ──
  var passCount = 0;
  var failCount = 0;
  var failures = [];

  function assert(cond, msg) {
    if (!cond) throw new Error('Assertion failed: ' + msg);
  }

  function assertEqual(actual, expected, msg) {
    if (actual !== expected) {
      throw new Error(
        (msg || 'assertEqual') + ': expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual)
      );
    }
  }

  function test(name, fn) {
    try {
      fn();
      passCount++;
      console.log('  \u2713 ' + name);
    } catch (e) {
      failCount++;
      failures.push({ name: name, error: e.message });
      console.log('  \u2717 ' + name + ' \u2014 ' + e.message);
    }
  }

  console.log('\n\u2500\u2500 Pack 10e: Phaser Migration Phase 2c — Delegation Layers \u2500\u2500');

  // ── Fake DOM globals for Node.js ──
  var _global = globalThis;
  _global.window = _global.window || _global;
  _global.Game = {};
  _global.document = _global.document || {
    createElement: function (tag) {
      return {
        tagName: tag.toUpperCase(),
        width: 0,
        height: 0,
        style: {},
        getContext: function () { return createFakeCtx(); },
      };
    },
  };

  function createFakeCtx() {
    var calls = [];
    return {
      _calls: calls,
      clearRect: function () { calls.push('clearRect'); },
      save: function () { calls.push('save'); },
      restore: function () { calls.push('restore'); },
      translate: function () { calls.push('translate'); },
      fillRect: function () { calls.push('fillRect'); },
      beginPath: function () { calls.push('beginPath'); },
      arc: function () { calls.push('arc'); },
      stroke: function () { calls.push('stroke'); },
      fill: function () { calls.push('fill'); },
      drawImage: function () { calls.push('drawImage'); },
      set fillStyle(v) {},
      get fillStyle() { return ''; },
      set strokeStyle(v) {},
      get strokeStyle() { return ''; },
      set lineWidth(v) {},
      get lineWidth() { return 1; },
      set globalAlpha(v) {},
      get globalAlpha() { return 1; },
    };
  }

  // ── Load modules ──
  var rootDir = path.resolve(__dirname, '..', '..');

  function loadModule(relPath) {
    var code = fs.readFileSync(path.resolve(rootDir, relPath), 'utf-8');
    var fn = new Function('window', 'document', 'console', code);
    fn(_global, _global.document, console);
  }

  loadModule('src/phaser/layers/PhaserLayerManager.js');
  loadModule('src/phaser/layers/FenceBaseLayer.js');
  loadModule('src/phaser/layers/BoardLayer.js');
  loadModule('src/phaser/layers/OrbitingTanksLayer.js');
  loadModule('src/phaser/layers/SupercomputerLayer.js');
  loadModule('src/phaser/layers/ProductionLineLayer.js');
  loadModule('src/phaser/layers/ZombiesCorpsesLayer.js');
  loadModule('src/phaser/layers/ProjectilesEffectsLayer.js');
  loadModule('src/phaser/layers/DronesLayer.js');

  // ═══════════════════════════════════════════
  // Helper: test a delegation layer module
  // ═══════════════════════════════════════════
  function testDelegationLayer(layerName, namespace) {
    var layer = Game.PhaserLayers[namespace];

    test(layerName + '-1: module exists on Game.PhaserLayers.' + namespace, function () {
      assert(layer != null, 'module exists');
      assertEqual(typeof layer.init, 'function', 'has init');
      assertEqual(typeof layer.update, 'function', 'has update');
      assertEqual(typeof layer.draw, 'function', 'has draw');
      assertEqual(typeof layer.setDrawFn, 'function', 'has setDrawFn');
      assertEqual(typeof layer.invalidate, 'function', 'has invalidate');
      assertEqual(typeof layer.destroy, 'function', 'has destroy');
    });

    test(layerName + '-2: init accepts config with drawFn', function () {
      var called = false;
      layer.init({ drawFn: function () { called = true; } });
      layer.draw(createFakeCtx());
      assertEqual(called, true, 'drawFn was called');
    });

    test(layerName + '-3: draw is no-op without drawFn', function () {
      layer.destroy();
      layer.init({});
      // Should not throw
      layer.draw(createFakeCtx());
    });

    test(layerName + '-4: setDrawFn replaces draw callback', function () {
      layer.init({});
      var first = 0;
      var second = 0;
      layer.setDrawFn(function () { first++; });
      layer.draw(createFakeCtx());
      assertEqual(first, 1, 'first fn called');

      layer.setDrawFn(function () { second++; });
      layer.draw(createFakeCtx());
      assertEqual(first, 1, 'first fn not called again');
      assertEqual(second, 1, 'second fn called');
    });

    test(layerName + '-5: destroy clears drawFn', function () {
      layer.init({});
      var called = false;
      layer.setDrawFn(function () { called = true; });
      layer.destroy();
      layer.draw(createFakeCtx());
      assertEqual(called, false, 'drawFn not called after destroy');
    });

    test(layerName + '-6: setDrawFn rejects non-function', function () {
      layer.init({});
      var called = false;
      layer.setDrawFn(function () { called = true; });
      layer.setDrawFn('not a function');
      layer.setDrawFn(null);
      layer.setDrawFn(42);
      layer.draw(createFakeCtx());
      assertEqual(called, true, 'original fn still active');
    });

    test(layerName + '-7: update does not throw', function () {
      layer.init({});
      // Delegation layers ignore update args
      layer.update(null);
      layer.update({});
      layer.update({ foo: 'bar' });
    });

    test(layerName + '-8: invalidate does not throw', function () {
      layer.init({});
      layer.invalidate();
    });
  }

  // ═══════════════════════════════════════════
  console.log('\n  DL-1: FenceBaseLayer');
  // ═══════════════════════════════════════════
  testDelegationLayer('FB', 'FenceBase');

  // ═══════════════════════════════════════════
  console.log('\n  DL-2: BoardLayer');
  // ═══════════════════════════════════════════
  testDelegationLayer('BD', 'Board');

  // ═══════════════════════════════════════════
  console.log('\n  DL-3: OrbitingTanksLayer');
  // ═══════════════════════════════════════════
  testDelegationLayer('OT', 'OrbitingTanks');

  // ═══════════════════════════════════════════
  console.log('\n  DL-4: SupercomputerLayer');
  // ═══════════════════════════════════════════
  testDelegationLayer('SC', 'Supercomputer');

  // ═══════════════════════════════════════════
  console.log('\n  DL-5: ProductionLineLayer');
  // ═══════════════════════════════════════════
  testDelegationLayer('PL', 'ProductionLine');

  // ═══════════════════════════════════════════
  console.log('\n  DL-6: ZombiesCorpsesLayer');
  // ═══════════════════════════════════════════
  testDelegationLayer('ZC', 'ZombiesCorpses');

  // ═══════════════════════════════════════════
  console.log('\n  DL-7: ProjectilesEffectsLayer');
  // ═══════════════════════════════════════════
  testDelegationLayer('PE', 'ProjectilesEffects');

  // ═══════════════════════════════════════════
  console.log('\n  DL-8: DronesLayer');
  // ═══════════════════════════════════════════
  testDelegationLayer('DR', 'Drones');

  // ═══════════════════════════════════════════
  console.log('\n  DL-9: PLM integration with delegation layers');
  // ═══════════════════════════════════════════

  test('DL-9A: PLM registers and draws delegation layer', function () {
    Game.PhaserLayerManager.init({ viewSize: { w: 1100, h: 650 } });
    var drawCount = 0;
    Game.PhaserLayers.FenceBase.init({});
    Game.PhaserLayers.FenceBase.setDrawFn(function () { drawCount++; });
    Game.PhaserLayerManager.registerLayer('fenceBase', Game.PhaserLayers.FenceBase);
    Game.PhaserLayerManager.drawLayer('fenceBase', createFakeCtx());
    assertEqual(drawCount, 1, 'delegation draw called via PLM');
  });

  test('DL-9B: PLM draws multiple delegation layers in order', function () {
    Game.PhaserLayerManager.init({});
    var order = [];

    Game.PhaserLayers.FenceBase.init({});
    Game.PhaserLayers.FenceBase.setDrawFn(function () { order.push('fence'); });
    Game.PhaserLayerManager.registerLayer('fenceBase', Game.PhaserLayers.FenceBase);

    Game.PhaserLayers.ZombiesCorpses.init({});
    Game.PhaserLayers.ZombiesCorpses.setDrawFn(function () { order.push('zombies'); });
    Game.PhaserLayerManager.registerLayer('zombiesCorpses', Game.PhaserLayers.ZombiesCorpses);

    Game.PhaserLayers.Drones.init({});
    Game.PhaserLayers.Drones.setDrawFn(function () { order.push('drones'); });
    Game.PhaserLayerManager.registerLayer('drones', Game.PhaserLayers.Drones);

    var ctx = createFakeCtx();
    Game.PhaserLayerManager.drawLayer('fenceBase', ctx);
    Game.PhaserLayerManager.drawLayer('zombiesCorpses', ctx);
    Game.PhaserLayerManager.drawLayer('drones', ctx);

    assertEqual(order.join(','), 'fence,zombies,drones', 'draw order preserved');
  });

  test('DL-9C: PLM destroy cleans up delegation layers', function () {
    Game.PhaserLayerManager.init({});
    var drawCalled = false;
    Game.PhaserLayers.Board.init({});
    Game.PhaserLayers.Board.setDrawFn(function () { drawCalled = true; });
    Game.PhaserLayerManager.registerLayer('board', Game.PhaserLayers.Board);
    Game.PhaserLayerManager.destroy();

    assertEqual(Game.PhaserLayerManager.hasLayer('board'), false, 'layer removed after destroy');
  });

  test('DL-9D: All 8 delegation layers register in PLM at once', function () {
    Game.PhaserLayerManager.init({});
    var layers = ['FenceBase', 'Board', 'OrbitingTanks', 'Supercomputer', 'ProductionLine', 'ZombiesCorpses', 'ProjectilesEffects', 'Drones'];
    var layerIds = ['fenceBase', 'board', 'orbitingTanks', 'supercomputer', 'productionLine', 'zombiesCorpses', 'projectilesEffects', 'drones'];

    for (var i = 0; i < layers.length; i++) {
      var mod = Game.PhaserLayers[layers[i]];
      mod.init({});
      mod.setDrawFn(function () {});
      Game.PhaserLayerManager.registerLayer(layerIds[i], mod);
    }

    for (var j = 0; j < layerIds.length; j++) {
      assertEqual(Game.PhaserLayerManager.hasLayer(layerIds[j]), true, layerIds[j] + ' registered');
    }
  });

  // ═══════════════════════════════════════════
  console.log('\n  DL-10: RenderRegistry integration');
  // ═══════════════════════════════════════════

  loadModule('src/phaser/renderRegistry.js');

  test('DL-10A: RenderRegistry defaults all new layers to legacy', function () {
    Game.RenderRegistry.init();
    var ids = ['fenceBase', 'board', 'orbitingTanks', 'supercomputer', 'productionLine', 'zombiesCorpses', 'projectilesEffects', 'drones'];
    for (var i = 0; i < ids.length; i++) {
      assertEqual(Game.RenderRegistry.getLayerMode(ids[i]), 'legacy', ids[i] + ' defaults to legacy');
      assertEqual(Game.RenderRegistry.isLegacy(ids[i]), true, ids[i] + ' isLegacy');
      assertEqual(Game.RenderRegistry.isPhaser(ids[i]), false, ids[i] + ' not isPhaser');
    }
  });

  test('DL-10B: setting layer and to phaser mode switches correctly', function () {
    Game.RenderRegistry.init();
    Game.RenderRegistry.setLayerMode('fenceBase', 'phaser');
    assertEqual(Game.RenderRegistry.isPhaser('fenceBase'), true, 'fenceBase is phaser');
    assertEqual(Game.RenderRegistry.isLegacy('fenceBase'), false, 'fenceBase not legacy');
  });

  test('DL-10C: both mode enables both paths', function () {
    Game.RenderRegistry.init();
    Game.RenderRegistry.setLayerMode('zombiesCorpses', 'both');
    assertEqual(Game.RenderRegistry.isPhaser('zombiesCorpses'), true, 'phaser path active');
    assertEqual(Game.RenderRegistry.isLegacy('zombiesCorpses'), true, 'legacy path active');
  });

  // ═══════════════════════════════════
  // Summary
  // ═══════════════════════════════════
  console.log('\n\u2500\u2500 Results: ' + passCount + ' passed, ' + failCount + ' failed \u2500\u2500');
  if (failures.length) {
    console.log('\nFailures:');
    for (var i = 0; i < failures.length; i++) {
      console.log('  ' + (i + 1) + '. ' + failures[i].name + ': ' + failures[i].error);
    }
  }
  process.exit(failCount > 0 ? 1 : 0);
}());
