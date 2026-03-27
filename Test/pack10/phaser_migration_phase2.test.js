/**
 * Pack 10b: Phaser Migration — Phase 2 Tests
 *
 * Tests for InputAdapter, RenderRegistry, and game.js Phase 2 integration.
 *
 * Run: node Test/pack10/phaser_migration_phase2.test.js
 */
(function () {
  'use strict';

  const fs = require('fs');
  const path = require('path');

  // ── Minimal test runner ──
  let passCount = 0;
  let failCount = 0;
  const failures = [];

  function assert(condition, message) {
    if (!condition) throw new Error('Assertion failed: ' + message);
  }

  function assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(
        (message || 'assertEqual') + ': expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual)
      );
    }
  }

  function assertApprox(actual, expected, epsilon, message) {
    if (Math.abs(actual - expected) > epsilon) {
      throw new Error(
        (message || 'assertApprox') + ': expected ~' + expected + ', got ' + actual + ' (epsilon=' + epsilon + ')'
      );
    }
  }

  function test(name, fn) {
    try {
      fn();
      passCount++;
      console.log('  ✓ ' + name);
    } catch (e) {
      failCount++;
      failures.push({ name, error: e.message });
      console.log('  ✗ ' + name + ' — ' + e.message);
    }
  }

  // ── Fake globals ──
  const global = globalThis;
  global.window = global.window || global;
  global.Game = global.Game || {};
  global.performance = global.performance || { now: () => Date.now() };
  global.document = global.document || {
    createElement: () => ({ style: {}, appendChild: () => {} }),
    body: { appendChild: () => {} },
    head: { appendChild: () => {} },
  };
  global.localStorage = global.localStorage || {
    _store: {},
    getItem(k) { return this._store[k] || null; },
    setItem(k, v) { this._store[k] = v; },
    removeItem(k) { delete this._store[k]; },
  };

  function loadModule(relPath) {
    const code = fs.readFileSync(path.resolve(__dirname, '..', '..', relPath), 'utf-8');
    const fn = new Function('window', 'global', 'document', 'localStorage', 'performance', 'console', 'Phaser', code);
    fn(global, global, global.document, global.localStorage, global.performance, console, undefined);
  }

  function resetGlobals() {
    if (global.Game.InputAdapter && typeof global.Game.InputAdapter.destroy === 'function') {
      global.Game.InputAdapter.destroy();
    }
    if (global.Game.RenderRegistry && typeof global.Game.RenderRegistry.destroy === 'function') {
      global.Game.RenderRegistry.destroy();
    }
  }

  console.log('\n── Pack 10b: Phaser Migration Phase 2 ──');

  // ── Load migration modules ──
  loadModule('src/phaser/inputAdapter.js');
  loadModule('src/phaser/renderRegistry.js');

  // ═══════════════════════════════════════════
  console.log('\n  PM2-1: InputAdapter coordinate transform');
  // ═══════════════════════════════════════════

  test('PM2-1A: InputAdapter initializes without error', function () {
    const ia = global.Game.InputAdapter;
    assert(ia, 'InputAdapter exists');
    assert(typeof ia.init === 'function', 'init is a function');
    ia.init({
      canvas: null,
      getViewSize: function () { return { w: 800, h: 600 }; },
    });
      // No crash = success
  });

  test('PM2-1B: getPointerPos returns {0,0} without canvas', function () {
    const ia = global.Game.InputAdapter;
    ia.init({ canvas: null, getViewSize: function () { return { w: 800, h: 600 }; } });
    const pos = ia.getPointerPos({ clientX: 100, clientY: 50 });
    assertEqual(pos.x, 0, 'x should be 0 without canvas');
    assertEqual(pos.y, 0, 'y should be 0 without canvas');
  });

  test('PM2-1C: getPointerPos transforms coordinates correctly with mock canvas', function () {
    const ia = global.Game.InputAdapter;
    // Mock a canvas with getBoundingClientRect
    const mockCanvas = {
      width: 1600,
      height: 1200,
      getBoundingClientRect: function () {
        return { left: 0, top: 0, width: 800, height: 600 };
      },
    };
    ia.init({ canvas: mockCanvas, getViewSize: function () { return { w: 800, h: 600 }; } });
    const pos = ia.getPointerPos({ clientX: 400, clientY: 300 });
    assertApprox(pos.x, 400, 0.01, 'x should be 400');
    assertApprox(pos.y, 300, 0.01, 'y should be 300');
  });

  test('PM2-1D: getPointerPos handles viewport scale correctly', function () {
    const ia = global.Game.InputAdapter;
    const mockCanvas = {
      width: 1600,
      height: 1200,
      getBoundingClientRect: function () {
        return { left: 0, top: 0, width: 400, height: 300 }; // CSS display is half
      },
    };
    ia.init({ canvas: mockCanvas, getViewSize: function () { return { w: 800, h: 600 }; } });
    const pos = ia.getPointerPos({ clientX: 200, clientY: 150 });
    // clientX=200 in CSS → (200-0) * (800/400) = 400 logical
    assertApprox(pos.x, 400, 0.01, 'x should be 400');
    assertApprox(pos.y, 300, 0.01, 'y should be 300');
  });

  test('PM2-1E: getPointerPos handles touch events', function () {
    const ia = global.Game.InputAdapter;
    const mockCanvas = {
      width: 800,
      height: 600,
      getBoundingClientRect: function () {
        return { left: 0, top: 0, width: 800, height: 600 };
      },
    };
    ia.init({ canvas: mockCanvas, getViewSize: function () { return { w: 800, h: 600 }; } });
    // Simulate a TouchEvent (no clientX directly, but touches[0])
    const touchEvt = { clientX: undefined, clientY: undefined, touches: [{ clientX: 100, clientY: 50 }] };
    const pos = ia.getPointerPos(touchEvt);
    assertApprox(pos.x, 100, 0.01, 'touch x');
    assertApprox(pos.y, 50, 0.01, 'touch y');
  });

  resetGlobals();

  // ═══════════════════════════════════════════
  console.log('\n  PM2-2: InputAdapter drag threshold');
  // ═══════════════════════════════════════════

  test('PM2-2A: isDragExceeded returns false for small movement', function () {
    const ia = global.Game.InputAdapter;
    assertEqual(ia.isDragExceeded(100, 100, 103, 104), false, 'distance 5 < threshold 6');
  });

  test('PM2-2B: isDragExceeded returns true for 6+px movement', function () {
    const ia = global.Game.InputAdapter;
    assertEqual(ia.isDragExceeded(100, 100, 106, 101), true, 'distance ~6.08 > threshold 6');
  });

  test('PM2-2C: isDragExceeded uses Euclidean distance', function () {
    const ia = global.Game.InputAdapter;
    // 4,4 → sqrt(32) ≈ 5.66 < 6
    assertEqual(ia.isDragExceeded(0, 0, 4, 4), false, 'diagonal 5.66 < 6');
    // 5,5 → sqrt(50) ≈ 7.07 > 6
    assertEqual(ia.isDragExceeded(0, 0, 5, 5), true, 'diagonal 7.07 > 6');
  });

  test('PM2-2D: getDragThreshold returns 6', function () {
    const ia = global.Game.InputAdapter;
    assertEqual(ia.getDragThreshold(), 6, 'threshold is 6');
  });

  // ═══════════════════════════════════════════
  console.log('\n  PM2-3: InputAdapter hit-testing');
  // ═══════════════════════════════════════════

  test('PM2-3A: cellAt finds correct cell in grid', function () {
    const ia = global.Game.InputAdapter;
    const cells = [
      { i: 0, x: 100, y: 100, w: 50, h: 50 },
      { i: 1, x: 160, y: 100, w: 50, h: 50 },
      { i: 2, x: 100, y: 160, w: 50, h: 50 },
    ];
    const c = ia.cellAt(125, 125, cells);
    assert(c !== null, 'should find cell');
    assertEqual(c.i, 0, 'should find cell 0');
  });

  test('PM2-3B: cellAt returns null for miss', function () {
    const ia = global.Game.InputAdapter;
    const cells = [{ i: 0, x: 100, y: 100, w: 50, h: 50 }];
    assertEqual(ia.cellAt(50, 50, cells), null, 'should miss');
  });

  test('PM2-3C: cellAt handles edge hits', function () {
    const ia = global.Game.InputAdapter;
    const cells = [{ i: 0, x: 100, y: 100, w: 50, h: 50 }];
    // Exactly on boundary
    assert(ia.cellAt(100, 100, cells) !== null, 'top-left edge');
    assert(ia.cellAt(150, 150, cells) !== null, 'bottom-right edge');
  });

  test('PM2-3D: hitTestCircle works correctly', function () {
    const ia = global.Game.InputAdapter;
    assertEqual(ia.hitTestCircle(100, 100, 100, 100, 10), true, 'center hit');
    assertEqual(ia.hitTestCircle(110, 100, 100, 100, 10), true, 'edge hit');
    assertEqual(ia.hitTestCircle(111, 100, 100, 100, 10), false, 'outside');
  });

  test('PM2-3E: cellAt returns null for null cells', function () {
    const ia = global.Game.InputAdapter;
    assertEqual(ia.cellAt(100, 100, null), null, 'null cells');
    assertEqual(ia.cellAt(100, 100, undefined), null, 'undefined cells');
  });

  // ═══════════════════════════════════════════
  console.log('\n  PM2-4: RenderRegistry');
  // ═══════════════════════════════════════════

  test('PM2-4A: RenderRegistry init sets all layers to legacy', function () {
    const rr = global.Game.RenderRegistry;
    rr.init();
    const layers = rr.getLayers();
    const ids = rr.getLayerIds();
    assert(ids.length > 0, 'has layer IDs');
    for (let i = 0; i < ids.length; i++) {
      assertEqual(layers[ids[i]], 'legacy', ids[i] + ' should be legacy');
    }
  });

  test('PM2-4B: RenderRegistry has correct layer count (18)', function () {
    const rr = global.Game.RenderRegistry;
    rr.init();
    assertEqual(rr.getLayerIds().length, 18, 'should have 18 layers');
  });

  test('PM2-4C: RenderRegistry layer IDs match draw() order', function () {
    const rr = global.Game.RenderRegistry;
    const ids = rr.getLayerIds();
    assertEqual(ids[0], 'background', 'first layer');
    assertEqual(ids[1], 'tankTrack', 'second layer');
    assertEqual(ids[2], 'fenceBase', 'third');
    assertEqual(ids[3], 'board', 'fourth');
    assertEqual(ids[ids.length - 1], 'hpBarOverlay', 'last layer');
  });

  test('PM2-4D: setLayerMode changes mode', function () {
    const rr = global.Game.RenderRegistry;
    rr.init();
    rr.setLayerMode('background', 'phaser');
    assertEqual(rr.getLayerMode('background'), 'phaser', 'should be phaser');
    assertEqual(rr.isPhaser('background'), true, 'isPhaser true');
    assertEqual(rr.isLegacy('background'), false, 'isLegacy false');
  });

  test('PM2-4E: setLayerMode "both" enables both paths', function () {
    const rr = global.Game.RenderRegistry;
    rr.init();
    rr.setLayerMode('board', 'both');
    assertEqual(rr.isPhaser('board'), true, 'isPhaser for both');
    assertEqual(rr.isLegacy('board'), true, 'isLegacy for both');
  });

  test('PM2-4F: setLayerMode rejects invalid mode', function () {
    const rr = global.Game.RenderRegistry;
    rr.init();
    rr.setLayerMode('board', 'invalid');
    assertEqual(rr.getLayerMode('board'), 'legacy', 'should remain legacy');
  });

  test('PM2-4G: unknown layer returns legacy by default', function () {
    const rr = global.Game.RenderRegistry;
    rr.init();
    assertEqual(rr.getLayerMode('nonexistent'), 'legacy', 'default is legacy');
    assertEqual(rr.isLegacy('nonexistent'), true, 'isLegacy for unknown');
  });

  test('PM2-4H: destroy clears state', function () {
    const rr = global.Game.RenderRegistry;
    rr.init();
    rr.setLayerMode('background', 'phaser');
    rr.destroy();
    // After destroy, getLayers should return empty or unknown defaults
    assertEqual(rr.getLayerMode('background'), 'legacy', 'reverts to default');
  });

  resetGlobals();

  // ═══════════════════════════════════════════
  console.log('\n  PM2-5: InputAdapter validation log');
  // ═══════════════════════════════════════════

  test('PM2-5A: validation log starts empty', function () {
    const ia = global.Game.InputAdapter;
    ia.init({ canvas: null, getViewSize: function () { return { w: 800, h: 600 }; } });
    assertEqual(ia.getValidationLog().length, 0, 'empty log');
  });

  test('PM2-5B: setOnPointer accepts handlers object', function () {
    const ia = global.Game.InputAdapter;
    let called = false;
    ia.setOnPointer({ pointerdown: function () { called = true; } });
    // Just verify it doesn't crash
    assert(typeof ia.setOnPointer === 'function', 'setOnPointer exists');
  });

  resetGlobals();

  // ═══════════════════════════════════════════
  console.log('\n  PM2-6: File structure and wiring');
  // ═══════════════════════════════════════════

  test('PM2-6A: inputAdapter.js file exists', function () {
    const p = path.resolve(__dirname, '..', '..', 'src', 'phaser', 'inputAdapter.js');
    assert(fs.existsSync(p), 'inputAdapter.js exists');
  });

  test('PM2-6B: renderRegistry.js file exists', function () {
    const p = path.resolve(__dirname, '..', '..', 'src', 'phaser', 'renderRegistry.js');
    assert(fs.existsSync(p), 'renderRegistry.js exists');
  });

  test('PM2-6C: index.html includes inputAdapter', function () {
    const html = fs.readFileSync(path.resolve(__dirname, '..', '..', 'index.html'), 'utf-8');
    assert(html.includes('src/phaser/inputAdapter.js'), 'inputAdapter in index.html');
  });

  test('PM2-6D: index.html includes renderRegistry', function () {
    const html = fs.readFileSync(path.resolve(__dirname, '..', '..', 'index.html'), 'utf-8');
    assert(html.includes('src/phaser/renderRegistry.js'), 'renderRegistry in index.html');
  });

  test('PM2-6E: inputAdapter loads before game.js', function () {
    const html = fs.readFileSync(path.resolve(__dirname, '..', '..', 'index.html'), 'utf-8');
    const adapterIdx = html.indexOf('src/phaser/inputAdapter.js');
    const gameIdx = html.indexOf('game.js');
    assert(adapterIdx > 0 && gameIdx > 0, 'both found');
    assert(adapterIdx < gameIdx, 'inputAdapter before game.js');
  });

  test('PM2-6F: renderRegistry loads before game.js', function () {
    const html = fs.readFileSync(path.resolve(__dirname, '..', '..', 'index.html'), 'utf-8');
    const regIdx = html.indexOf('src/phaser/renderRegistry.js');
    const gameIdx = html.indexOf('game.js');
    assert(regIdx > 0 && gameIdx > 0, 'both found');
    assert(regIdx < gameIdx, 'renderRegistry before game.js');
  });

  // ═══════════════════════════════════════════
  console.log('\n  PM2-7: game.js integration');
  // ═══════════════════════════════════════════

  test('PM2-7A: game.js delegates getPointerPos to InputAdapter', function () {
    const code = fs.readFileSync(path.resolve(__dirname, '..', '..', 'game.js'), 'utf-8');
    assert(code.includes('Game.InputAdapter') && code.includes('ia.getPointerPos'), 'getPointerPos delegation');
  });

  test('PM2-7B: game.js delegates cellAt to InputAdapter', function () {
    const code = fs.readFileSync(path.resolve(__dirname, '..', '..', 'game.js'), 'utf-8');
    assert(code.includes('ia.cellAt'), 'cellAt delegation');
  });

  test('PM2-7C: game.js draw() uses RenderRegistry', function () {
    const code = fs.readFileSync(path.resolve(__dirname, '..', '..', 'game.js'), 'utf-8');
    // Check for registry gating pattern
    assert(code.includes("_RR.isLegacy('background')"), 'background layer gated');
    assert(code.includes("_RR.isLegacy('board')"), 'board layer gated');
    assert(code.includes("_RR.isLegacy('zombiesCorpses')"), 'zombiesCorpses layer gated');
    assert(code.includes("_RR.isLegacy('hpBarOverlay')"), 'hpBarOverlay layer gated');
  });

  test('PM2-7D: game.js initializes InputAdapter in initEngineAdapterPhase1', function () {
    const code = fs.readFileSync(path.resolve(__dirname, '..', '..', 'game.js'), 'utf-8');
    assert(code.includes('InputAdapter') && code.includes('inputAdapter.init'), 'InputAdapter init in boot');
  });

  test('PM2-7E: game.js initializes RenderRegistry in initEngineAdapterPhase1', function () {
    const code = fs.readFileSync(path.resolve(__dirname, '..', '..', 'game.js'), 'utf-8');
    assert(code.includes('RenderRegistry') && code.includes('renderReg.init'), 'RenderRegistry init in boot');
  });

  test('PM2-7F: game.js drag threshold uses isDragExceeded', function () {
    const code = fs.readFileSync(path.resolve(__dirname, '..', '..', 'game.js'), 'utf-8');
    assert(code.includes('isDragExceeded'), 'isDragExceeded used in pointermove');
  });

  test('PM2-7G: draw() gates all 18 render layers', function () {
    const code = fs.readFileSync(path.resolve(__dirname, '..', '..', 'game.js'), 'utf-8');
    const layers = [
      'background', 'tankTrack', 'fenceBase', 'board', 'orbitingTanks', 'supercomputer',
      'productionLine', 'zombiesCorpses', 'fenceHpBars', 'talentStatusIcons',
      'projectilesEffects', 'drones', 'crate', 'weather', 'eveningDim', 'levelUpVfx',
      'boostIcons', 'hpBarOverlay',
    ];
    for (let i = 0; i < layers.length; i++) {
      assert(code.includes("_RR.isLegacy('" + layers[i] + "')"), 'layer ' + layers[i] + ' gated');
    }
  });

  // ── Summary ──
  console.log('\n════════════════════════════════');
  console.log('Pack 10b RESULTS: ' + passCount + ' passed, ' + failCount + ' failed');
  if (failures.length > 0) {
    console.log('\nFailed tests:');
    failures.forEach(function (f) { console.log('  - ' + f.name + ': ' + f.error); });
  }
  console.log('════════════════════════════════\n');

  if (typeof module !== 'undefined') {
    module.exports = { passCount, failCount, failures };
  }
})();
