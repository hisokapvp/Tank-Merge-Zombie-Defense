/**
 * Pack 10: Phaser 3 Migration — Baseline Tests
 *
 * Tests that verify the migration infrastructure is correct
 * and that legacy behavior is preserved when engine seam is in place.
 *
 * Run: node Test/tests.js (auto-discovered)
 * Or standalone: node Test/pack10/phaser_migration_baseline.test.js
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

  function assertDeepIncludes(obj, key, message) {
    if (!(key in obj)) {
      throw new Error((message || 'assertDeepIncludes') + ': key "' + key + '" not found');
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

  console.log('\n── Pack 10: Phaser Migration Baseline ──');

  // ── Load migration modules ──
  loadModule('src/flags/flags.js');
  loadModule('src/core/engineAdapter.js');
  loadModule('src/phaser/phaserBridge.js');
  loadModule('src/phaser/clockAdapter.js');
  // BootScene/GameScene/PhaserBootstrap need Phaser global, skip in Node tests
  // They have `if (typeof Phaser === 'undefined') return;` guards

  // ── PM-1: Feature flag ──
  console.log('\n  PM-1: usePhaser feature flag');

  test('PM-1A: usePhaser flag defaults to off (rollout 0)', () => {
    Game.Flags.init({});
    assertEqual(Game.Flags.get('usePhaser'), false);
  });

  test('PM-1B: usePhaser flag responds to override', () => {
    Game.Flags.setOverride('usePhaser', true);
    assertEqual(Game.Flags.get('usePhaser'), true);
    Game.Flags.setOverride('usePhaser', null);
    assertEqual(Game.Flags.get('usePhaser'), false);
  });

  test('PM-1C: usePhaser appears in flag list', () => {
    const list = Game.Flags.list();
    const found = list.some(function (f) { return f.name === 'usePhaser'; });
    assert(found, 'usePhaser should be in the flag list');
  });

  // ── PM-2: EngineAdapter ──
  console.log('\n  PM-2: EngineAdapter');

  test('PM-2A: EngineAdapter defaults to legacy', () => {
    Game.Flags.setOverride('usePhaser', null);
    Game.EngineAdapter.init({ legacyCtx: null, canvas: null });
    assertEqual(Game.EngineAdapter.getActiveEngine(), 'legacy');
    assertEqual(Game.EngineAdapter.isPhaser(), false);
  });

  test('PM-2B: EngineAdapter selects phaser when flag on', () => {
    Game.Flags.setOverride('usePhaser', true);
    // Re-init to pick up flag
    Game.EngineAdapter.destroy();
    Game.EngineAdapter.init({ legacyCtx: null, canvas: null });
    assertEqual(Game.EngineAdapter.getActiveEngine(), 'phaser');
    assertEqual(Game.EngineAdapter.isPhaser(), true);
    Game.Flags.setOverride('usePhaser', null);
    Game.EngineAdapter.destroy();
  });

  test('PM-2C: EngineAdapter onReady fires for legacy', () => {
    let firedEngine = null;
    Game.EngineAdapter.init({ legacyCtx: null, canvas: null });
    Game.EngineAdapter.onReady(function (engine) { firedEngine = engine; });
    assertEqual(firedEngine, 'legacy');
  });

  test('PM-2D: EngineAdapter isReady is true after init for legacy', () => {
    assertEqual(Game.EngineAdapter.isReady(), true);
  });

  test('PM-2E: EngineAdapter.destroy cleans up', () => {
    Game.EngineAdapter.destroy();
    assertEqual(Game.EngineAdapter.isReady(), false);
    assertEqual(Game.EngineAdapter.getPhaserGame(), null);
  });

  // ── PM-3: PhaserBridge ──
  console.log('\n  PM-3: PhaserBridge');

  test('PM-3A: PhaserBridge starts inactive', () => {
    assertEqual(Game.PhaserBridge.isActive(), false);
    assertEqual(Game.PhaserBridge.getScene(), null);
  });

  test('PM-3B: PhaserBridge.register sets delegates', () => {
    let stepCalled = false;
    let drawCalled = false;
    Game.PhaserBridge.register({
      step: function () { stepCalled = true; },
      draw: function () { drawCalled = true; },
    });
    Game.PhaserBridge.stepFn(0.016, 1000);
    Game.PhaserBridge.drawFn();
    assert(stepCalled, 'step delegate called');
    assert(drawCalled, 'draw delegate called');
  });

  test('PM-3C: PhaserBridge.onSceneReady fires callbacks', () => {
    let readyScene = null;
    Game.PhaserBridge.whenSceneReady(function (scene) { readyScene = scene; });
    assertEqual(readyScene, null);
    Game.PhaserBridge.onSceneReady({ name: 'MockScene' });
    assertEqual(readyScene && readyScene.name, 'MockScene');
    assertEqual(Game.PhaserBridge.isActive(), true);
    Game.PhaserBridge.destroy();
  });

  // ── PM-4: ClockAdapter ──
  console.log('\n  PM-4: ClockAdapter');

  test('PM-4A: ClockAdapter provides defaults without init', () => {
    const now = Game.ClockAdapter.getNowSec();
    assert(typeof now === 'number' && now > 0, 'getNowSec returns positive number');
    assertEqual(Game.ClockAdapter.isPaused(), false);
    assertEqual(Game.ClockAdapter.getTimeScale(), 1);
  });

  test('PM-4B: ClockAdapter uses provided functions', () => {
    Game.ClockAdapter.init({
      nowSec: function () { return 42.5; },
      isPaused: function () { return true; },
      getTimeScale: function () { return 0.5; },
    });
    assertEqual(Game.ClockAdapter.getNowSec(), 42.5);
    assertEqual(Game.ClockAdapter.isPaused(), true);
    assertEqual(Game.ClockAdapter.getTimeScale(), 0.5);
  });

  test('PM-4C: ClockAdapter.getDt returns 0 when paused', () => {
    assertEqual(Game.ClockAdapter.getDt(0.016), 0);
  });

  test('PM-4D: ClockAdapter.getDt applies time scale', () => {
    Game.ClockAdapter.init({
      nowSec: function () { return 100; },
      isPaused: function () { return false; },
      getTimeScale: function () { return 2; },
    });
    assertEqual(Game.ClockAdapter.getDt(0.016), 0.032);
  });

  // ── PM-5: File structure verification ──
  console.log('\n  PM-5: File structure');

  test('PM-5A: Phaser vendor file exists', () => {
    const phaserPath = path.resolve(__dirname, '..', '..', 'vendor', 'phaser.min.js');
    assert(fs.existsSync(phaserPath), 'vendor/phaser.min.js should exist');
  });

  test('PM-5B: Phaser vendor file is non-trivial (>500KB)', () => {
    const phaserPath = path.resolve(__dirname, '..', '..', 'vendor', 'phaser.min.js');
    const stat = fs.statSync(phaserPath);
    assert(stat.size > 500000, 'Phaser file should be >500KB, got ' + stat.size);
  });

  test('PM-5C: All migration modules exist', () => {
    const files = [
      'src/core/engineAdapter.js',
      'src/phaser/phaserBootstrap.js',
      'src/phaser/phaserBridge.js',
      'src/phaser/clockAdapter.js',
      'src/phaser/scenes/BootScene.js',
      'src/phaser/scenes/GameScene.js',
    ];
    for (const f of files) {
      const full = path.resolve(__dirname, '..', '..', f);
      assert(fs.existsSync(full), f + ' should exist');
    }
  });

  test('PM-5D: Migration docs exist', () => {
    const docs = [
      'docs/migration/PHASER_MIGRATION.md',
      'docs/migration/RISK_REGISTER.md',
      'docs/migration/BASELINE_CONTRACTS.md',
    ];
    for (const d of docs) {
      const full = path.resolve(__dirname, '..', '..', d);
      assert(fs.existsSync(full), d + ' should exist');
    }
  });

  // ── PM-6: BootScene/GameScene guards ──
  console.log('\n  PM-6: Scene guards (no Phaser in Node)');

  test('PM-6A: BootScene module loads without Phaser (guard)', () => {
    // Loading BootScene without Phaser global should not crash
    loadModule('src/phaser/scenes/BootScene.js');
    // Scene should not be registered since Phaser is undefined
    // (the module returns early)
    assert(true, 'BootScene loaded without crash');
  });

  test('PM-6B: GameScene module loads without Phaser (guard)', () => {
    loadModule('src/phaser/scenes/GameScene.js');
    assert(true, 'GameScene loaded without crash');
  });

  test('PM-6C: PhaserBootstrap provides stub when Phaser unavailable', () => {
    loadModule('src/phaser/phaserBootstrap.js');
    const bootstrap = Game.PhaserBootstrap;
    assert(bootstrap, 'PhaserBootstrap should be defined');
    const result = bootstrap.start({});
    assertEqual(result, null);
    assertEqual(bootstrap.getGame(), null);
  });

  // ── PM-7: index.html wiring ──
  console.log('\n  PM-7: index.html wiring');

  test('PM-7A: index.html includes engineAdapter script', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '..', '..', 'index.html'), 'utf-8');
    assert(html.includes('src/core/engineAdapter.js'), 'engineAdapter.js in index.html');
  });

  test('PM-7B: index.html includes Phaser vendor', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '..', '..', 'index.html'), 'utf-8');
    assert(html.includes('vendor/phaser.min.js'), 'phaser.min.js in index.html');
  });

  test('PM-7C: index.html includes phaserBootstrap', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '..', '..', 'index.html'), 'utf-8');
    assert(html.includes('src/phaser/phaserBootstrap.js'), 'phaserBootstrap.js in index.html');
  });

  test('PM-7D: index.html script order: engineAdapter before game.js', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '..', '..', 'index.html'), 'utf-8');
    const adapterIdx = html.indexOf('src/core/engineAdapter.js');
    const gameIdx = html.indexOf('game.js?');
    assert(adapterIdx > 0 && gameIdx > 0, 'both scripts found');
    assert(adapterIdx < gameIdx, 'engineAdapter loads before game.js');
  });

  test('PM-7E: index.html script order: phaser vendor before scenes', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '..', '..', 'index.html'), 'utf-8');
    const phaserIdx = html.indexOf('vendor/phaser.min.js');
    const bootSceneIdx = html.indexOf('src/phaser/scenes/BootScene.js');
    assert(phaserIdx > 0 && bootSceneIdx > 0, 'both scripts found');
    assert(phaserIdx < bootSceneIdx, 'phaser vendor loads before scenes');
  });

  // ── PM-8: Feature flag integration check ──
  console.log('\n  PM-8: Flag integration');

  test('PM-8A: usePhaser flag in DEFAULT_FLAGS of flags.js', () => {
    const code = fs.readFileSync(path.resolve(__dirname, '..', '..', 'src', 'flags', 'flags.js'), 'utf-8');
    assert(code.includes('usePhaser'), 'usePhaser defined in flags.js');
  });

  test('PM-8B: game.js calls initEngineAdapterPhase1', () => {
    const code = fs.readFileSync(path.resolve(__dirname, '..', '..', 'game.js'), 'utf-8');
    assert(code.includes('initEngineAdapterPhase1'), 'initEngineAdapterPhase1 in game.js');
  });

  // ── Summary ──
  console.log('\n════════════════════════════════');
  console.log('Pack 10 RESULTS: ' + passCount + ' passed, ' + failCount + ' failed');
  if (failures.length > 0) {
    console.log('\nFailed tests:');
    failures.forEach(function (f) { console.log('  - ' + f.name + ': ' + f.error); });
  }
  console.log('════════════════════════════════\n');

  if (typeof module !== 'undefined') {
    module.exports = { passCount, failCount, failures };
  }
})();
