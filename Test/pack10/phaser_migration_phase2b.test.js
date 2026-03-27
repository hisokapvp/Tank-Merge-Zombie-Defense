/**
 * Pack 10c: Phaser Migration — Phase 2b Tests
 *
 * Tests for Phaser loop handoff, main-canvas sharing, DPR restore,
 * resizeCanvas Phaser notification, and bridge step→loop delegation.
 *
 * Run: node Test/pack10/phaser_migration_phase2b.test.js
 */
(function () {
  'use strict';

  const fs = require('fs');
  const path = require('path');

  // ── Minimal test runner ──
  let passCount = 0;
  let failCount = 0;
  const failures = [];

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

  console.log('\n\u2500\u2500 Pack 10c: Phaser Migration Phase 2b \u2500\u2500');

  // ═══════════════════════════════════════════
  console.log('\n  PM2b-1: PhaserBootstrap clearBeforeRender config');
  // ═══════════════════════════════════════════

  (function () {
    // Mock Phaser namespace for bootstrap test
    var capturedConfig = null;
    var global = globalThis;
    global.Phaser = {
      CANVAS: 1,
      Scale: { NONE: 0, NO_CENTER: 0 },
      Game: function (cfg) {
        capturedConfig = cfg;
        this.destroy = function () {};
      },
      Class: function (def) {
        function Cls() { if (def.initialize) def.initialize.call(this); }
        if (def.Extends) Cls.prototype = Object.create(def.Extends.prototype);
        for (var k in def) {
          if (k !== 'initialize' && k !== 'Extends') Cls.prototype[k] = def[k];
        }
        return Cls;
      },
      Scene: function () {},
    };
    global.Game = global.Game || {};
    global.Game.PhaserScenes = {
      GameScene: function () {},
    };

    var code = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'src/phaser/phaserBootstrap.js'), 'utf-8'
    );
    var fn = new Function('window', 'global', 'Phaser', 'console', code);
    fn(global, global, global.Phaser, console);

    test('PM2b-1A: clearBeforeRender defaults to true', function () {
      capturedConfig = null;
      global.Game.PhaserBootstrap.start({
        canvas: {},
        width: 800,
        height: 600,
      });
      assert(capturedConfig, 'config captured');
      assertEqual(capturedConfig.clearBeforeRender, true, 'default clearBeforeRender');
      global.Game.PhaserBootstrap.destroy();
    });

    test('PM2b-1B: clearBeforeRender can be set to false', function () {
      capturedConfig = null;
      // Reset _game state
      global.Game.PhaserBootstrap.destroy();
      global.Game.PhaserBootstrap.start({
        canvas: {},
        width: 800,
        height: 600,
        clearBeforeRender: false,
      });
      assert(capturedConfig, 'config captured');
      assertEqual(capturedConfig.clearBeforeRender, false, 'clearBeforeRender false');
      global.Game.PhaserBootstrap.destroy();
    });

    test('PM2b-1C: transparent mode with clearBeforeRender=false has no backgroundColor', function () {
      capturedConfig = null;
      global.Game.PhaserBootstrap.destroy();
      global.Game.PhaserBootstrap.start({
        canvas: {},
        width: 800,
        height: 600,
        transparent: true,
        clearBeforeRender: false,
      });
      assert(capturedConfig, 'config captured');
      assertEqual(capturedConfig.transparent, true, 'transparent');
      // backgroundColor should be undefined when clearBeforeRender is false
      assertEqual(capturedConfig.backgroundColor, undefined, 'no backgroundColor');
      global.Game.PhaserBootstrap.destroy();
    });

    test('PM2b-1D: getGame() returns Phaser.Game instance after start', function () {
      global.Game.PhaserBootstrap.destroy();
      global.Game.PhaserBootstrap.start({
        canvas: {},
        width: 800,
        height: 600,
      });
      assert(global.Game.PhaserBootstrap.getGame() !== null, 'game not null');
      global.Game.PhaserBootstrap.destroy();
      assertEqual(global.Game.PhaserBootstrap.getGame(), null, 'null after destroy');
    });

    // Cleanup
    delete global.Phaser;
    delete global.Game.PhaserBootstrap;
    delete global.Game.PhaserScenes;
  })();

  // ═══════════════════════════════════════════
  console.log('\n  PM2b-2: PhaserBridge step→loop delegation');
  // ═══════════════════════════════════════════

  (function () {
    var global = globalThis;
    global.Game = global.Game || {};

    var code = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'src/phaser/phaserBridge.js'), 'utf-8'
    );
    var fn = new Function('window', 'global', 'console', code);
    fn(global, global, console);

    var stepCalls = [];
    var drawCalls = 0;

    global.Game.PhaserBridge.register({
      step: function (dt, time) {
        stepCalls.push({ dt: dt, time: time });
      },
      draw: function () {
        drawCalls++;
      },
    });

    test('PM2b-2A: stepFn delegates to registered step', function () {
      stepCalls.length = 0;
      global.Game.PhaserBridge.stepFn(0.016, 1000);
      assertEqual(stepCalls.length, 1, 'one step call');
      assertEqual(stepCalls[0].time, 1000, 'time passed through');
    });

    test('PM2b-2B: drawFn delegates to registered draw', function () {
      drawCalls = 0;
      global.Game.PhaserBridge.drawFn();
      assertEqual(drawCalls, 1, 'one draw call');
    });

    test('PM2b-2C: onSceneReady fires cached callbacks', function () {
      var readyScene = null;
      global.Game.PhaserBridge.destroy();
      // Reset
      fn(global, global, console);
      global.Game.PhaserBridge.whenSceneReady(function (scene) {
        readyScene = scene;
      });
      assertEqual(readyScene, null, 'not ready yet');
      global.Game.PhaserBridge.onSceneReady({ key: 'GameScene' });
      assert(readyScene !== null, 'callback fired');
      assertEqual(readyScene.key, 'GameScene', 'scene passed');
    });

    global.Game.PhaserBridge.destroy();
  })();

  // ═══════════════════════════════════════════
  console.log('\n  PM2b-3: scheduleMainLoop respects phaserLoopActive');
  // ═══════════════════════════════════════════

  (function () {
    // Simulate the game.js guard logic
    var mainLoopRafId = 0;
    var sessionRuntimeStopped = false;
    var phaserLoopActive = false;
    var rafCalled = false;

    function fakeRaf(cb) { rafCalled = true; return 1; }

    function scheduleMainLoop() {
      if (phaserLoopActive || sessionRuntimeStopped || mainLoopRafId) return;
      mainLoopRafId = fakeRaf(function () {});
    }

    test('PM2b-3A: scheduleMainLoop works when phaserLoopActive=false', function () {
      rafCalled = false;
      mainLoopRafId = 0;
      phaserLoopActive = false;
      sessionRuntimeStopped = false;
      scheduleMainLoop();
      assertEqual(rafCalled, true, 'RAF called');
    });

    test('PM2b-3B: scheduleMainLoop blocked when phaserLoopActive=true', function () {
      rafCalled = false;
      mainLoopRafId = 0;
      phaserLoopActive = true;
      sessionRuntimeStopped = false;
      scheduleMainLoop();
      assertEqual(rafCalled, false, 'RAF not called');
    });

    test('PM2b-3C: scheduleMainLoop blocked when sessionRuntimeStopped=true', function () {
      rafCalled = false;
      mainLoopRafId = 0;
      phaserLoopActive = false;
      sessionRuntimeStopped = true;
      scheduleMainLoop();
      assertEqual(rafCalled, false, 'RAF not called');
    });

    test('PM2b-3D: scheduleMainLoop blocked when mainLoopRafId != 0', function () {
      rafCalled = false;
      mainLoopRafId = 42;
      phaserLoopActive = false;
      sessionRuntimeStopped = false;
      scheduleMainLoop();
      assertEqual(rafCalled, false, 'RAF not called (already scheduled)');
    });
  })();

  // ═══════════════════════════════════════════
  console.log('\n  PM2b-4: DPR transform restoration in draw()');
  // ═══════════════════════════════════════════

  (function () {
    // Simulate the draw() DPR guard
    var transforms = [];
    var cleared = false;
    var mockCtx = {
      setTransform: function (a, b, c, d, e, f) {
        transforms.push([a, b, c, d, e, f]);
      },
      clearRect: function () { cleared = true; },
    };

    function simulateDraw(ctx, viewSize, phaserActive) {
      transforms.length = 0;
      cleared = false;
      // Simulates the Phase 2b guard at the top of draw()
      if (phaserActive) {
        ctx.setTransform(viewSize.dpr, 0, 0, viewSize.dpr, 0, 0);
      }
      ctx.clearRect(0, 0, viewSize.w, viewSize.h);
    }

    test('PM2b-4A: DPR transform set when phaserLoopActive with dpr=2', function () {
      simulateDraw(mockCtx, { w: 800, h: 600, dpr: 2 }, true);
      assertEqual(transforms.length, 1, 'one setTransform');
      assertEqual(transforms[0][0], 2, 'dpr=2 in transform');
      assertEqual(cleared, true, 'clearRect called');
    });

    test('PM2b-4B: No DPR transform when phaserLoopActive=false', function () {
      simulateDraw(mockCtx, { w: 800, h: 600, dpr: 2 }, false);
      assertEqual(transforms.length, 0, 'no setTransform');
      assertEqual(cleared, true, 'clearRect called');
    });

    test('PM2b-4C: DPR=1 still sets transform when Phaser active', function () {
      simulateDraw(mockCtx, { w: 800, h: 600, dpr: 1 }, true);
      assertEqual(transforms.length, 1, 'setTransform called');
      assertEqual(transforms[0][0], 1, 'dpr=1');
    });
  })();

  // ═══════════════════════════════════════════
  console.log('\n  PM2b-5: resizeCanvas Phaser notification');
  // ═══════════════════════════════════════════

  (function () {
    var resizeCalls = [];

    function simulateResizeNotification(phaserActive) {
      resizeCalls.length = 0;
      var canvasW = 1600;
      var canvasH = 1200;

      // Simulate the Phase 2b resize notification block
      if (phaserActive) {
        var _pGame = {
          scale: {
            resize: function (w, h) {
              resizeCalls.push({ w: w, h: h });
            },
          },
        };
        if (_pGame && _pGame.scale && typeof _pGame.scale.resize === 'function') {
          _pGame.scale.resize(canvasW, canvasH);
        }
      }
    }

    test('PM2b-5A: resize notification sent when phaserLoopActive', function () {
      simulateResizeNotification(true);
      assertEqual(resizeCalls.length, 1, 'one resize call');
      assertEqual(resizeCalls[0].w, 1600, 'width');
      assertEqual(resizeCalls[0].h, 1200, 'height');
    });

    test('PM2b-5B: no resize notification when phaserLoopActive=false', function () {
      simulateResizeNotification(false);
      assertEqual(resizeCalls.length, 0, 'no resize call');
    });
  })();

  // ═══════════════════════════════════════════
  console.log('\n  PM2b-6: Engine Adapter + Bridge integration');
  // ═══════════════════════════════════════════

  (function () {
    var global = globalThis;
    global.Game = global.Game || {};

    // Load flags
    global.Game.Flags = {
      _flags: {},
      set: function (k, v) { this._flags[k] = v; },
      get: function (k) { return this._flags[k]; },
    };

    var eaCode = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'src/core/engineAdapter.js'), 'utf-8'
    );
    var eaFn = new Function('window', 'global', 'console', eaCode);
    eaFn(global, global, console);

    var brCode = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'src/phaser/phaserBridge.js'), 'utf-8'
    );
    var brFn = new Function('window', 'global', 'console', brCode);
    brFn(global, global, console);

    test('PM2b-6A: EngineAdapter selects legacy when flag off', function () {
      global.Game.Flags.set('usePhaser', false);
      global.Game.EngineAdapter.destroy();
      eaFn(global, global, console);
      global.Game.EngineAdapter.init({ legacyCtx: {}, canvas: {} });
      assertEqual(global.Game.EngineAdapter.getActiveEngine(), 'legacy', 'legacy engine');
      assertEqual(global.Game.EngineAdapter.isPhaser(), false, 'isPhaser false');
    });

    test('PM2b-6B: EngineAdapter selects phaser when flag on', function () {
      global.Game.Flags.set('usePhaser', true);
      global.Game.EngineAdapter.destroy();
      eaFn(global, global, console);
      global.Game.EngineAdapter.init({ legacyCtx: {}, canvas: {} });
      assertEqual(global.Game.EngineAdapter.getActiveEngine(), 'phaser', 'phaser engine');
      assertEqual(global.Game.EngineAdapter.isPhaser(), true, 'isPhaser true');
    });

    test('PM2b-6C: Bridge step delegates with correct time', function () {
      var capturedTime = null;
      global.Game.PhaserBridge.register({
        step: function (dt, time) { capturedTime = time; },
        draw: function () {},
      });
      global.Game.PhaserBridge.stepFn(0.016, 42000);
      assertEqual(capturedTime, 42000, 'time propagated');
    });

    test('PM2b-6D: Bridge isActive false before scene ready', function () {
      global.Game.PhaserBridge.destroy();
      brFn(global, global, console);
      assertEqual(global.Game.PhaserBridge.isActive(), false, 'not active');
    });

    test('PM2b-6E: Bridge isActive true after scene ready', function () {
      global.Game.PhaserBridge.onSceneReady({ key: 'GameScene' });
      assertEqual(global.Game.PhaserBridge.isActive(), true, 'active');
    });

    // Cleanup
    global.Game.EngineAdapter.destroy();
    global.Game.PhaserBridge.destroy();
    delete global.Game.Flags;
  })();

  // ═══════════════════════════════════════════
  console.log('\n  PM2b-7: RenderRegistry layers persist across phases');
  // ═══════════════════════════════════════════

  (function () {
    var global = globalThis;
    global.Game = global.Game || {};

    var rrCode = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'src/phaser/renderRegistry.js'), 'utf-8'
    );
    var rrFn = new Function('window', 'global', 'console', rrCode);
    rrFn(global, global, console);

    var rr = global.Game.RenderRegistry;
    rr.init();

    test('PM2b-7A: All 18 layers start as legacy', function () {
      var ids = rr.getLayerIds();
      assertEqual(ids.length, 18, '18 layers');
      for (var i = 0; i < ids.length; i++) {
        assertEqual(rr.isLegacy(ids[i]), true, ids[i] + ' is legacy');
      }
    });

    test('PM2b-7B: setLayerMode to phaser works', function () {
      rr.setLayerMode('background', 'phaser');
      assertEqual(rr.isLegacy('background'), false, 'background not legacy');
      assertEqual(rr.isPhaser('background'), true, 'background is phaser');
    });

    test('PM2b-7C: setLayerMode to both works', function () {
      rr.setLayerMode('background', 'both');
      assertEqual(rr.isLegacy('background'), true, 'background legacy in both');
      assertEqual(rr.isPhaser('background'), true, 'background phaser in both');
    });

    test('PM2b-7D: Other layers unaffected by background change', function () {
      assertEqual(rr.isLegacy('tankTrack'), true, 'tankTrack still legacy');
      assertEqual(rr.isLegacy('zombiesCorpses'), true, 'zombiesCorpses still legacy');
    });

    test('PM2b-7E: reset back to legacy', function () {
      rr.setLayerMode('background', 'legacy');
      assertEqual(rr.isLegacy('background'), true, 'background back to legacy');
      assertEqual(rr.isPhaser('background'), false, 'background not phaser');
    });

    if (typeof rr.destroy === 'function') rr.destroy();
  })();

  // ═══════════════════════════════════════════
  console.log('\n  PM2b-8: GameScene Phase 2 update contract');
  // ═══════════════════════════════════════════

  (function () {
    var global = globalThis;
    global.Game = global.Game || {};

    // Load bridge for scene test
    var brCode = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'src/phaser/phaserBridge.js'), 'utf-8'
    );
    var brFn = new Function('window', 'global', 'console', brCode);
    brFn(global, global, console);

    var stepCalls = [];
    var drawCalls = 0;
    global.Game.PhaserBridge.register({
      step: function (dt, time) { stepCalls.push({ dt: dt, time: time }); },
      draw: function () { drawCalls++; },
    });

    // Simulate GameScene.update logic
    function simulateSceneUpdate(time, delta) {
      var bridge = global.Game.PhaserBridge;
      if (!bridge) return;
      var dtSec = Math.min(0.033, delta / 1000);
      if (typeof bridge.stepFn === 'function') bridge.stepFn(dtSec, time);
      if (typeof bridge.drawFn === 'function') bridge.drawFn();
    }

    test('PM2b-8A: Scene update calls step then draw', function () {
      stepCalls.length = 0;
      drawCalls = 0;
      simulateSceneUpdate(1000, 16.67);
      assertEqual(stepCalls.length, 1, 'one step');
      assertEqual(drawCalls, 1, 'one draw');
    });

    test('PM2b-8B: delta capped at 33ms (0.033s)', function () {
      stepCalls.length = 0;
      simulateSceneUpdate(2000, 100); // 100ms = laggy frame
      assertEqual(stepCalls[0].dt, 0.033, 'dt capped');
    });

    test('PM2b-8C: time passes through unchanged', function () {
      stepCalls.length = 0;
      simulateSceneUpdate(5000, 16);
      assertEqual(stepCalls[0].time, 5000, 'time unchanged');
    });

    test('PM2b-8D: Multiple updates accumulate correctly', function () {
      stepCalls.length = 0;
      drawCalls = 0;
      simulateSceneUpdate(1000, 16);
      simulateSceneUpdate(1016, 16);
      simulateSceneUpdate(1032, 16);
      assertEqual(stepCalls.length, 3, 'three steps');
      assertEqual(drawCalls, 3, 'three draws');
    });

    global.Game.PhaserBridge.destroy();
  })();

  // ═══════════════════════════════════════════
  console.log('\n  PM2b-9: Loop handoff integration contract');
  // ═══════════════════════════════════════════

  (function () {
    // Verify the contract: when phaserLoopActive=true, bridge.step calls loop(time)
    // and loop produces simulation + draw output.
    var loopCalls = [];
    var drawCallCount = 0;

    // Minimal simulation of the Phase 2b bridge wiring
    var phaserLoopActive = true;

    function loop(now) { loopCalls.push(now); }
    function draw() { drawCallCount++; }

    var bridgeStep = function (_dt, time) {
      if (phaserLoopActive) {
        loop(time);
      }
    };
    var bridgeDraw = function () {
      // no-op: draw is called by loop internally
    };

    test('PM2b-9A: bridge step calls loop with Phaser time', function () {
      loopCalls.length = 0;
      bridgeStep(0.016, 42000);
      assertEqual(loopCalls.length, 1, 'loop called once');
      assertEqual(loopCalls[0], 42000, 'time propagated to loop');
    });

    test('PM2b-9B: bridge draw is no-op (prevents double-render)', function () {
      drawCallCount = 0;
      bridgeDraw();
      assertEqual(drawCallCount, 0, 'draw not called from bridge');
    });

    test('PM2b-9C: bridge step is no-op when phaserLoopActive=false', function () {
      phaserLoopActive = false;
      loopCalls.length = 0;
      bridgeStep(0.016, 50000);
      assertEqual(loopCalls.length, 0, 'loop not called');
    });
  })();

  // ═══════════════════════════════════════════
  // Summary
  // ═══════════════════════════════════════════
  console.log('\n\u2500\u2500 Results \u2500\u2500');
  console.log('Passed: ' + passCount);
  console.log('Failed: ' + failCount);
  if (failures.length) {
    console.log('\nFailures:');
    for (var i = 0; i < failures.length; i++) {
      console.log('  ' + failures[i].name + ': ' + failures[i].error);
    }
  }

  process.exit(failCount > 0 ? 1 : 0);
})();
