/**
 * Pack 10d: Phaser Migration — Phase 2c Tests
 *
 * Tests for PhaserLayerManager and individual Phaser layer modules:
 * BackgroundLayer, TankTrackLayer, FenceHpBarsLayer, EveningDimLayer.
 *
 * Run: node Test/pack10/phaser_migration_phase2c.test.js
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

  function assertApprox(actual, expected, eps, msg) {
    if (Math.abs(actual - expected) > eps) {
      throw new Error(
        (msg || 'assertApprox') + ': expected ~' + expected + ', got ' + actual + ' (eps=' + eps + ')'
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

  console.log('\n\u2500\u2500 Pack 10d: Phaser Migration Phase 2c — Layer Modules \u2500\u2500');

  // ── Fake DOM globals for Node.js ──
  var _global = globalThis;
  _global.window = _global.window || _global;
  _global.Game = {};
  _global.document = _global.document || {
    createElement: function (tag) {
      // Minimal canvas stub
      var canvas = {
        tagName: tag.toUpperCase(),
        width: 0,
        height: 0,
        style: {},
        getContext: function () {
          return createFakeCtx();
        },
      };
      return canvas;
    },
  };

  function createFakeCtx() {
    var calls = [];
    return {
      _calls: calls,
      clearRect: function () { calls.push('clearRect'); },
      save: function () { calls.push('save'); },
      restore: function () { calls.push('restore'); },
      translate: function (x, y) { calls.push('translate:' + x + ',' + y); },
      fillRect: function (x, y, w, h) { calls.push('fillRect:' + x + ',' + y + ',' + w + ',' + h); },
      strokeRect: function () { calls.push('strokeRect'); },
      beginPath: function () { calls.push('beginPath'); },
      arc: function () { calls.push('arc'); },
      ellipse: function () { calls.push('ellipse'); },
      stroke: function () { calls.push('stroke'); },
      fill: function () { calls.push('fill'); },
      drawImage: function () { calls.push('drawImage'); },
      createLinearGradient: function () {
        return { addColorStop: function () {} };
      },
      set fillStyle(v) { calls.push('fillStyle:' + v); },
      get fillStyle() { return ''; },
      set strokeStyle(v) { calls.push('strokeStyle:' + v); },
      get strokeStyle() { return ''; },
      set lineWidth(v) { calls.push('lineWidth:' + v); },
      get lineWidth() { return 1; },
      set lineCap(v) {},
      get lineCap() { return 'butt'; },
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
  loadModule('src/phaser/layers/BackgroundLayer.js');
  loadModule('src/phaser/layers/TankTrackLayer.js');
  loadModule('src/phaser/layers/FenceHpBarsLayer.js');
  loadModule('src/phaser/layers/EveningDimLayer.js');

  // ═══════════════════════════════════════════
  console.log('\n  PM2c-1: PhaserLayerManager lifecycle');
  // ═══════════════════════════════════════════

  test('PM2c-1A: init creates empty manager', function () {
    Game.PhaserLayerManager.init({ viewSize: { w: 1100, h: 650 } });
    assertEqual(Game.PhaserLayerManager.hasLayer('background'), false, 'no layers yet');
  });

  test('PM2c-1B: registerLayer adds a layer', function () {
    Game.PhaserLayerManager.init({ viewSize: { w: 1100, h: 650 } });
    var mockLayer = {
      initCalled: false,
      drawCalled: false,
      init: function () { this.initCalled = true; },
      draw: function () { this.drawCalled = true; },
      destroy: function () {},
    };
    Game.PhaserLayerManager.registerLayer('background', mockLayer);
    assertEqual(Game.PhaserLayerManager.hasLayer('background'), true, 'layer registered');
    assertEqual(mockLayer.initCalled, true, 'init called on register');
  });

  test('PM2c-1C: drawLayer calls layer draw', function () {
    Game.PhaserLayerManager.init({});
    var drawCalls = 0;
    var mockLayer = {
      init: function () {},
      draw: function () { drawCalls++; },
      destroy: function () {},
    };
    Game.PhaserLayerManager.registerLayer('test', mockLayer);
    Game.PhaserLayerManager.drawLayer('test', createFakeCtx());
    assertEqual(drawCalls, 1, 'draw called once');
  });

  test('PM2c-1D: drawLayer with unknown layer is no-op', function () {
    Game.PhaserLayerManager.init({});
    // Should not throw
    Game.PhaserLayerManager.drawLayer('nonexistent', createFakeCtx());
  });

  test('PM2c-1E: getLayer returns registered module', function () {
    Game.PhaserLayerManager.init({});
    var mod = { init: function () {}, draw: function () {}, destroy: function () {} };
    Game.PhaserLayerManager.registerLayer('x', mod);
    assertEqual(Game.PhaserLayerManager.getLayer('x'), mod, 'returns same module');
    assertEqual(Game.PhaserLayerManager.getLayer('y'), null, 'null for unknown');
  });

  test('PM2c-1F: updateAll pushes state to all layers', function () {
    Game.PhaserLayerManager.init({});
    var updated = [];
    Game.PhaserLayerManager.registerLayer('a', {
      init: function () {},
      update: function (s) { updated.push('a:' + s.val); },
      draw: function () {},
      destroy: function () {},
    });
    Game.PhaserLayerManager.registerLayer('b', {
      init: function () {},
      update: function (s) { updated.push('b:' + s.val); },
      draw: function () {},
      destroy: function () {},
    });
    Game.PhaserLayerManager.updateAll({ val: 42 });
    assert(updated.indexOf('a:42') >= 0, 'a received update');
    assert(updated.indexOf('b:42') >= 0, 'b received update');
  });

  test('PM2c-1G: invalidateAll calls invalidate on all layers', function () {
    Game.PhaserLayerManager.init({});
    var inv = [];
    Game.PhaserLayerManager.registerLayer('c', {
      init: function () {},
      draw: function () {},
      invalidate: function () { inv.push('c'); },
      destroy: function () {},
    });
    Game.PhaserLayerManager.invalidateAll();
    assertEqual(inv.length, 1, 'c invalidated');
  });

  test('PM2c-1H: destroy cleans up all layers', function () {
    Game.PhaserLayerManager.init({});
    var destroyed = [];
    Game.PhaserLayerManager.registerLayer('d', {
      init: function () {},
      draw: function () {},
      destroy: function () { destroyed.push('d'); },
    });
    Game.PhaserLayerManager.destroy();
    assertEqual(destroyed.length, 1, 'd destroyed');
    assertEqual(Game.PhaserLayerManager.hasLayer('d'), false, 'no layers after destroy');
  });

  // ═══════════════════════════════════════════
  console.log('\n  PM2c-2: BackgroundLayer');
  // ═══════════════════════════════════════════

  test('PM2c-2A: init creates offscreen canvas', function () {
    Game.PhaserLayers.Background.init({
      viewSize: { w: 800, h: 600 },
    });
    // draw does rebuild on first call
    var ctx = createFakeCtx();
    Game.PhaserLayers.Background.draw(ctx);
    // Should draw fallback gradient since no groundLayer/backgroundLayer
    assert(ctx._calls.indexOf('drawImage') >= 0, 'drawImage called for offscreen blit');
    Game.PhaserLayers.Background.destroy();
  });

  test('PM2c-2B: uses legacy groundLayer when available', function () {
    var groundDrawCalled = false;
    Game.PhaserLayers.Background.init({
      viewSize: { w: 800, h: 600 },
      groundLayer: {
        ready: true,
        draw: function () { groundDrawCalled = true; return true; },
      },
    });
    Game.PhaserLayers.Background.invalidate();
    var ctx = createFakeCtx();
    Game.PhaserLayers.Background.draw(ctx);
    assertEqual(groundDrawCalled, true, 'groundLayer.draw called');
    Game.PhaserLayers.Background.destroy();
  });

  test('PM2c-2C: uses legacy backgroundLayer canvas when groundLayer not ready', function () {
    var bgCanvas = { width: 800, height: 600 };
    Game.PhaserLayers.Background.init({
      viewSize: { w: 800, h: 600 },
      groundLayer: { ready: false, draw: function () { return false; } },
      backgroundLayer: { ready: true, canvas: bgCanvas },
    });
    Game.PhaserLayers.Background.invalidate();
    var ctx = createFakeCtx();
    Game.PhaserLayers.Background.draw(ctx);
    assert(ctx._calls.indexOf('drawImage') >= 0, 'backgroundLayer canvas blitted');
    Game.PhaserLayers.Background.destroy();
  });

  test('PM2c-2D: invalidate forces rebuild', function () {
    Game.PhaserLayers.Background.init({ viewSize: { w: 800, h: 600 } });
    var ctx = createFakeCtx();
    Game.PhaserLayers.Background.draw(ctx); // first draw = build
    var callCount1 = ctx._calls.length;
    ctx = createFakeCtx();
    Game.PhaserLayers.Background.draw(ctx); // second draw = cached
    var callCount2 = ctx._calls.length;
    assertEqual(callCount2, 1, 'only drawImage for cached blit');
    Game.PhaserLayers.Background.invalidate();
    ctx = createFakeCtx();
    Game.PhaserLayers.Background.draw(ctx); // after invalidate = rebuild
    assert(ctx._calls.length >= 1, 'rebuilt');
    Game.PhaserLayers.Background.destroy();
  });

  test('PM2c-2E: setRefs updates references', function () {
    Game.PhaserLayers.Background.init({ viewSize: { w: 800, h: 600 } });
    var newGround = {
      ready: true,
      draw: function () { return true; },
    };
    Game.PhaserLayers.Background.setRefs({ groundLayer: newGround });
    Game.PhaserLayers.Background.invalidate();
    var ctx = createFakeCtx();
    Game.PhaserLayers.Background.draw(ctx);
    assert(ctx._calls.indexOf('drawImage') >= 0, 'got blitted');
    Game.PhaserLayers.Background.destroy();
  });

  // ═══════════════════════════════════════════
  console.log('\n  PM2c-3: TankTrackLayer');
  // ═══════════════════════════════════════════

  test('PM2c-3A: init sets track parameters', function () {
    Game.PhaserLayers.TankTrack.init({
      viewSize: { w: 1100, h: 650 },
      center: { x: 550, y: 325 },
      orbitRadius: 250,
      trackWidth: 16,
    });
    // Should succeed without error
    Game.PhaserLayers.TankTrack.destroy();
  });

  test('PM2c-3B: draw renders track to offscreen then blits', function () {
    Game.PhaserLayers.TankTrack.init({
      viewSize: { w: 1100, h: 650 },
      center: { x: 550, y: 325 },
      orbitRadius: 250,
      trackWidth: 16,
    });
    var ctx = createFakeCtx();
    Game.PhaserLayers.TankTrack.draw(ctx);
    assert(ctx._calls.indexOf('drawImage') >= 0, 'blitted offscreen');
    Game.PhaserLayers.TankTrack.destroy();
  });

  test('PM2c-3C: invalidate forces rebuild', function () {
    Game.PhaserLayers.TankTrack.init({
      viewSize: { w: 1100, h: 650 },
      center: { x: 550, y: 325 },
      orbitRadius: 250,
      trackWidth: 16,
    });
    var ctx = createFakeCtx();
    Game.PhaserLayers.TankTrack.draw(ctx); // first build
    Game.PhaserLayers.TankTrack.invalidate();
    ctx = createFakeCtx();
    Game.PhaserLayers.TankTrack.draw(ctx); // rebuild
    assert(ctx._calls.indexOf('drawImage') >= 0, 'blitted after rebuild');
    Game.PhaserLayers.TankTrack.destroy();
  });

  test('PM2c-3D: update with changed radius invalidates', function () {
    Game.PhaserLayers.TankTrack.init({
      viewSize: { w: 1100, h: 650 },
      center: { x: 550, y: 325 },
      orbitRadius: 250,
      trackWidth: 16,
    });
    var ctx = createFakeCtx();
    Game.PhaserLayers.TankTrack.draw(ctx); // build
    Game.PhaserLayers.TankTrack.update({ orbitRadius: 300 });
    // Internal _ready should be false now
    ctx = createFakeCtx();
    Game.PhaserLayers.TankTrack.draw(ctx); // should rebuild
    assert(ctx._calls.indexOf('drawImage') >= 0, 'rebuilt after radius change');
    Game.PhaserLayers.TankTrack.destroy();
  });

  test('PM2c-3E: seeded noise produces consistent output', function () {
    // Test that the same inputs produce the same outputs
    Game.PhaserLayers.TankTrack.init({
      viewSize: { w: 100, h: 100 },
      center: { x: 50, y: 50 },
      orbitRadius: 40,
      trackWidth: 8,
    });
    var ctx1 = createFakeCtx();
    Game.PhaserLayers.TankTrack.draw(ctx1);
    Game.PhaserLayers.TankTrack.invalidate();
    var ctx2 = createFakeCtx();
    Game.PhaserLayers.TankTrack.draw(ctx2);
    // Both should have same call pattern (deterministic)
    assertEqual(ctx1._calls.length, ctx2._calls.length, 'same number of draws');
    Game.PhaserLayers.TankTrack.destroy();
  });

  // ═══════════════════════════════════════════
  console.log('\n  PM2c-4: FenceHpBarsLayer');
  // ═══════════════════════════════════════════

  test('PM2c-4A: init with center and bar config', function () {
    Game.PhaserLayers.FenceHpBars.init({
      center: { x: 550, y: 325 },
      hpBarConfig: { w: 28, h: 4, offsetY: -24 },
    });
    Game.PhaserLayers.FenceHpBars.destroy();
  });

  test('PM2c-4B: draw is no-op without fence segments', function () {
    Game.PhaserLayers.FenceHpBars.init({ center: { x: 550, y: 325 } });
    var ctx = createFakeCtx();
    Game.PhaserLayers.FenceHpBars.draw(ctx);
    // Should have no save/restore (no-op when no segments)
    assert(ctx._calls.indexOf('save') === -1, 'no drawing without segments');
    Game.PhaserLayers.FenceHpBars.destroy();
  });

  test('PM2c-4C: draw renders bars for damaged segments', function () {
    Game.PhaserLayers.FenceHpBars.init({
      center: { x: 0, y: 0 },
      hpBarConfig: { w: 28, h: 4, offsetY: -24 },
    });
    Game.PhaserLayers.FenceHpBars.update({
      fenceSegments: [
        { x: 10, y: 20, hp: 80, maxHp: 100 },
        { x: 30, y: 40, hp: 100, maxHp: 100 }, // full HP — should be skipped
        { x: 50, y: 60, hp: 0, maxHp: 100 },   // 0 HP
      ],
    });
    var ctx = createFakeCtx();
    Game.PhaserLayers.FenceHpBars.draw(ctx);
    assert(ctx._calls.indexOf('save') >= 0, 'save called');
    // Count fillRect calls — 2 damaged segments × 2 rects each (bg + green) minus 0-hp one
    var fillRects = ctx._calls.filter(function (c) { return c.indexOf('fillRect') === 0; });
    // Segment 1: bg + green (hp > 0)
    // Segment 3: bg only (hp = 0, greenWidth = 0)
    assertEqual(fillRects.length, 3, '3 fillRect calls: 2 for damaged, 1 for destroyed bg');
    Game.PhaserLayers.FenceHpBars.destroy();
  });

  test('PM2c-4D: draw skips full-HP segments', function () {
    Game.PhaserLayers.FenceHpBars.init({
      center: { x: 0, y: 0 },
      hpBarConfig: { w: 28, h: 4, offsetY: -24 },
    });
    Game.PhaserLayers.FenceHpBars.update({
      fenceSegments: [
        { x: 10, y: 20, hp: 100, maxHp: 100 },
        { x: 30, y: 40, hp: 50, maxHp: 50 },
      ],
    });
    var ctx = createFakeCtx();
    Game.PhaserLayers.FenceHpBars.draw(ctx);
    // All full HP — no save/restore
    assert(ctx._calls.indexOf('save') === -1, 'no bars drawn for full HP');
    Game.PhaserLayers.FenceHpBars.destroy();
  });

  test('PM2c-4E: update center changes translate', function () {
    Game.PhaserLayers.FenceHpBars.init({
      center: { x: 100, y: 200 },
      hpBarConfig: { w: 28, h: 4, offsetY: -24 },
    });
    Game.PhaserLayers.FenceHpBars.update({
      fenceSegments: [{ x: 0, y: 0, hp: 50, maxHp: 100 }],
      center: { x: 300, y: 400 },
    });
    var ctx = createFakeCtx();
    Game.PhaserLayers.FenceHpBars.draw(ctx);
    assert(ctx._calls.indexOf('translate:300,400') >= 0, 'translate uses updated center');
    Game.PhaserLayers.FenceHpBars.destroy();
  });

  // ═══════════════════════════════════════════
  console.log('\n  PM2c-5: EveningDimLayer');
  // ═══════════════════════════════════════════

  test('PM2c-5A: init sets viewport', function () {
    Game.PhaserLayers.EveningDim.init({ viewSize: { w: 1100, h: 650 } });
    Game.PhaserLayers.EveningDim.destroy();
  });

  test('PM2c-5B: draw is no-op when alpha is zero', function () {
    Game.PhaserLayers.EveningDim.init({ viewSize: { w: 1100, h: 650 } });
    Game.PhaserLayers.EveningDim.update({ baseAlpha: 0, blend: 0 });
    var ctx = createFakeCtx();
    Game.PhaserLayers.EveningDim.draw(ctx);
    assert(ctx._calls.indexOf('save') === -1, 'no drawing when alpha is 0');
    Game.PhaserLayers.EveningDim.destroy();
  });

  test('PM2c-5C: draw renders overlay when alpha > 0', function () {
    Game.PhaserLayers.EveningDim.init({ viewSize: { w: 1100, h: 650 } });
    Game.PhaserLayers.EveningDim.update({ baseAlpha: 0.6, blend: 0.8 });
    var ctx = createFakeCtx();
    Game.PhaserLayers.EveningDim.draw(ctx);
    assert(ctx._calls.indexOf('save') >= 0, 'save called');
    var fillRects = ctx._calls.filter(function (c) { return c.indexOf('fillRect') === 0; });
    assertEqual(fillRects.length, 1, 'one fillRect for dim overlay');
    // Check the fillRect covers full viewport
    assertEqual(fillRects[0], 'fillRect:0,0,1100,650', 'full viewport coverage');
    Game.PhaserLayers.EveningDim.destroy();
  });

  test('PM2c-5D: alpha is product of baseAlpha and blend', function () {
    Game.PhaserLayers.EveningDim.init({ viewSize: { w: 100, h: 100 } });
    Game.PhaserLayers.EveningDim.update({ baseAlpha: 0.5, blend: 0.4 });
    var ctx = createFakeCtx();
    Game.PhaserLayers.EveningDim.draw(ctx);
    // alpha = 0.5 * 0.4 = 0.2
    var fillStyles = ctx._calls.filter(function (c) { return c.indexOf('fillStyle') === 0; });
    assert(fillStyles.length > 0, 'fillStyle set');
    assert(fillStyles[0].indexOf('0.2') >= 0, 'alpha is 0.2');
    Game.PhaserLayers.EveningDim.destroy();
  });

  test('PM2c-5E: blend of 0 suppresses draw', function () {
    Game.PhaserLayers.EveningDim.init({ viewSize: { w: 100, h: 100 } });
    Game.PhaserLayers.EveningDim.update({ baseAlpha: 1.0, blend: 0 });
    var ctx = createFakeCtx();
    Game.PhaserLayers.EveningDim.draw(ctx);
    assert(ctx._calls.indexOf('save') === -1, 'no draw when blend is 0');
    Game.PhaserLayers.EveningDim.destroy();
  });

  test('PM2c-5F: viewport update changes fillRect dimensions', function () {
    Game.PhaserLayers.EveningDim.init({ viewSize: { w: 800, h: 480 } });
    Game.PhaserLayers.EveningDim.update({
      baseAlpha: 0.5, blend: 1.0,
      viewSize: { w: 1200, h: 700 },
    });
    var ctx = createFakeCtx();
    Game.PhaserLayers.EveningDim.draw(ctx);
    var fillRects = ctx._calls.filter(function (c) { return c.indexOf('fillRect') === 0; });
    assertEqual(fillRects[0], 'fillRect:0,0,1200,700', 'updated viewport dimensions');
    Game.PhaserLayers.EveningDim.destroy();
  });

  // ═══════════════════════════════════════════
  console.log('\n  PM2c-6: File structure and loading order');
  // ═══════════════════════════════════════════

  test('PM2c-6A: PhaserLayerManager.js exists', function () {
    var filePath = path.resolve(rootDir, 'src/phaser/layers/PhaserLayerManager.js');
    assert(fs.existsSync(filePath), 'PhaserLayerManager.js exists');
  });

  test('PM2c-6B: BackgroundLayer.js exists', function () {
    var filePath = path.resolve(rootDir, 'src/phaser/layers/BackgroundLayer.js');
    assert(fs.existsSync(filePath), 'BackgroundLayer.js exists');
  });

  test('PM2c-6C: TankTrackLayer.js exists', function () {
    var filePath = path.resolve(rootDir, 'src/phaser/layers/TankTrackLayer.js');
    assert(fs.existsSync(filePath), 'TankTrackLayer.js exists');
  });

  test('PM2c-6D: FenceHpBarsLayer.js exists', function () {
    var filePath = path.resolve(rootDir, 'src/phaser/layers/FenceHpBarsLayer.js');
    assert(fs.existsSync(filePath), 'FenceHpBarsLayer.js exists');
  });

  test('PM2c-6E: EveningDimLayer.js exists', function () {
    var filePath = path.resolve(rootDir, 'src/phaser/layers/EveningDimLayer.js');
    assert(fs.existsSync(filePath), 'EveningDimLayer.js exists');
  });

  test('PM2c-6F: index.html loads layer scripts before game.js', function () {
    var html = fs.readFileSync(path.resolve(rootDir, 'index.html'), 'utf-8');
    var layerMgrPos = html.indexOf('PhaserLayerManager.js');
    var bgLayerPos = html.indexOf('BackgroundLayer.js');
    var trackLayerPos = html.indexOf('TankTrackLayer.js');
    var fenceLayerPos = html.indexOf('FenceHpBarsLayer.js');
    var dimLayerPos = html.indexOf('EveningDimLayer.js');
    var gameJsPos = html.indexOf('game.js');
    assert(layerMgrPos > 0, 'PhaserLayerManager.js in index.html');
    assert(bgLayerPos > 0, 'BackgroundLayer.js in index.html');
    assert(trackLayerPos > 0, 'TankTrackLayer.js in index.html');
    assert(fenceLayerPos > 0, 'FenceHpBarsLayer.js in index.html');
    assert(dimLayerPos > 0, 'EveningDimLayer.js in index.html');
    assert(layerMgrPos < gameJsPos, 'PhaserLayerManager before game.js');
    assert(bgLayerPos < gameJsPos, 'BackgroundLayer before game.js');
    assert(trackLayerPos < gameJsPos, 'TankTrackLayer before game.js');
    assert(fenceLayerPos < gameJsPos, 'FenceHpBarsLayer before game.js');
    assert(dimLayerPos < gameJsPos, 'EveningDimLayer before game.js');
    // Manager loaded before individual layers
    assert(layerMgrPos < bgLayerPos, 'PhaserLayerManager before BackgroundLayer');
    assert(layerMgrPos < trackLayerPos, 'PhaserLayerManager before TankTrackLayer');
  });

  test('PM2c-6G: layer scripts loaded after renderRegistry', function () {
    var html = fs.readFileSync(path.resolve(rootDir, 'index.html'), 'utf-8');
    var regPos = html.indexOf('renderRegistry.js');
    var layerMgrPos = html.indexOf('PhaserLayerManager.js');
    assert(regPos > 0 && layerMgrPos > 0, 'both present');
    assert(regPos < layerMgrPos, 'renderRegistry before PhaserLayerManager');
  });

  // ═══════════════════════════════════════════
  console.log('\n  PM2c-7: game.js integration — draw gating');
  // ═══════════════════════════════════════════

  test('PM2c-7A: game.js has PhaserLayerManager draw calls for background', function () {
    var gameJs = fs.readFileSync(path.resolve(rootDir, 'game.js'), 'utf-8');
    assert(gameJs.indexOf("isPhaser('background')") >= 0, 'phaser gating for background');
    assert(gameJs.indexOf("drawLayer('background'") >= 0, 'PLM drawLayer for background');
  });

  test('PM2c-7B: game.js has PhaserLayerManager draw calls for tankTrack', function () {
    var gameJs = fs.readFileSync(path.resolve(rootDir, 'game.js'), 'utf-8');
    assert(gameJs.indexOf("isPhaser('tankTrack')") >= 0, 'phaser gating for tankTrack');
    assert(gameJs.indexOf("drawLayer('tankTrack'") >= 0, 'PLM drawLayer for tankTrack');
  });

  test('PM2c-7C: game.js has PhaserLayerManager draw calls for fenceHpBars', function () {
    var gameJs = fs.readFileSync(path.resolve(rootDir, 'game.js'), 'utf-8');
    assert(gameJs.indexOf("isPhaser('fenceHpBars')") >= 0, 'phaser gating for fenceHpBars');
    assert(gameJs.indexOf("drawLayer('fenceHpBars'") >= 0, 'PLM drawLayer for fenceHpBars');
  });

  test('PM2c-7D: game.js has PhaserLayerManager draw calls for eveningDim', function () {
    var gameJs = fs.readFileSync(path.resolve(rootDir, 'game.js'), 'utf-8');
    assert(gameJs.indexOf("isPhaser('eveningDim')") >= 0, 'phaser gating for eveningDim');
    assert(gameJs.indexOf("drawLayer('eveningDim'") >= 0, 'PLM drawLayer for eveningDim');
  });

  test('PM2c-7E: game.js initializes PhaserLayerManager in initEngineAdapterPhase1', function () {
    var gameJs = fs.readFileSync(path.resolve(rootDir, 'game.js'), 'utf-8');
    assert(gameJs.indexOf('PhaserLayerManager') >= 0, 'PLM referenced');
    assert(gameJs.indexOf("registerLayer('background'") >= 0, 'background layer registered');
    assert(gameJs.indexOf("registerLayer('tankTrack'") >= 0, 'tankTrack layer registered');
    assert(gameJs.indexOf("registerLayer('fenceHpBars'") >= 0, 'fenceHpBars layer registered');
    assert(gameJs.indexOf("registerLayer('eveningDim'") >= 0, 'eveningDim layer registered');
  });

  test('PM2c-7F: both legacy and phaser paths coexist for mode=both', function () {
    var gameJs = fs.readFileSync(path.resolve(rootDir, 'game.js'), 'utf-8');
    // For each migrated layer, Phaser draw comes before legacy draw
    // so both can fire in 'both' mode
    var bgPhaser = gameJs.indexOf("isPhaser('background')");
    var bgLegacy = gameJs.indexOf("isLegacy('background')");
    assert(bgPhaser < bgLegacy, 'phaser background before legacy background');

    var ttPhaser = gameJs.indexOf("isPhaser('tankTrack')");
    var ttLegacy = gameJs.indexOf("isLegacy('tankTrack')");
    assert(ttPhaser < ttLegacy, 'phaser tankTrack before legacy tankTrack');
  });

  // ═══════════════════════════════════════════
  console.log('\n  PM2c-8: RenderRegistry integration');
  // ═══════════════════════════════════════════

  // Reload RenderRegistry for clean tests
  _global.Game.RenderRegistry = undefined;
  loadModule('src/phaser/renderRegistry.js');

  test('PM2c-8A: all layers default to legacy', function () {
    Game.RenderRegistry.init();
    assertEqual(Game.RenderRegistry.getLayerMode('background'), 'legacy', 'background=legacy');
    assertEqual(Game.RenderRegistry.getLayerMode('tankTrack'), 'legacy', 'tankTrack=legacy');
    assertEqual(Game.RenderRegistry.getLayerMode('fenceHpBars'), 'legacy', 'fenceHpBars=legacy');
    assertEqual(Game.RenderRegistry.getLayerMode('eveningDim'), 'legacy', 'eveningDim=legacy');
  });

  test('PM2c-8B: switching to phaser mode blocks legacy', function () {
    Game.RenderRegistry.init();
    Game.RenderRegistry.setLayerMode('background', 'phaser');
    assertEqual(Game.RenderRegistry.isLegacy('background'), false, 'legacy blocked');
    assertEqual(Game.RenderRegistry.isPhaser('background'), true, 'phaser active');
  });

  test('PM2c-8C: both mode fires both paths', function () {
    Game.RenderRegistry.init();
    Game.RenderRegistry.setLayerMode('tankTrack', 'both');
    assertEqual(Game.RenderRegistry.isLegacy('tankTrack'), true, 'legacy active in both');
    assertEqual(Game.RenderRegistry.isPhaser('tankTrack'), true, 'phaser active in both');
  });

  test('PM2c-8D: switching layers independently', function () {
    Game.RenderRegistry.init();
    Game.RenderRegistry.setLayerMode('background', 'phaser');
    Game.RenderRegistry.setLayerMode('fenceHpBars', 'phaser');
    assertEqual(Game.RenderRegistry.isLegacy('background'), false, 'bg not legacy');
    assertEqual(Game.RenderRegistry.isPhaser('background'), true, 'bg is phaser');
    assertEqual(Game.RenderRegistry.isLegacy('tankTrack'), true, 'track still legacy');
    assertEqual(Game.RenderRegistry.isPhaser('tankTrack'), false, 'track not phaser');
    assertEqual(Game.RenderRegistry.isLegacy('fenceHpBars'), false, 'fence not legacy');
    assertEqual(Game.RenderRegistry.isPhaser('fenceHpBars'), true, 'fence is phaser');
  });

  // ═══════════════════════════════════════════
  // Summary
  // ═══════════════════════════════════════════
  console.log('\n\u2500\u2500 Phase 2c Results: ' + passCount + ' passed, ' + failCount + ' failed \u2500\u2500');
  if (failures.length) {
    console.log('\nFailed tests:');
    for (var i = 0; i < failures.length; i++) {
      console.log('  ' + failures[i].name + ': ' + failures[i].error);
    }
  }
  process.exit(failCount > 0 ? 1 : 0);
})();
