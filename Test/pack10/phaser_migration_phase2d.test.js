/**
 * Pack 10f: Phaser Migration — Phase 2d Audio Adapter + Input Comparison + HUD Adapter Tests
 *
 * Tests for:
 * - PhaserAudioAdapter (audio bridge with fallback)
 * - InputComparisonHarness (A/B input comparison)
 * - HudAdapter (Phase 3 HUD migration shell)
 *
 * Run: node Test/pack10/phaser_migration_phase2d.test.js
 */
(function () {
  'use strict';

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

  function assertContains(arr, item, msg) {
    if (!Array.isArray(arr) || arr.indexOf(item) === -1) {
      throw new Error(
        (msg || 'assertContains') + ': ' + JSON.stringify(item) + ' not found in ' + JSON.stringify(arr)
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

  console.log('\n\u2500\u2500 Pack 10f: Phaser Migration Phase 2d — Audio/Input/HUD Adapters \u2500\u2500');

  // ── Fake DOM globals for Node.js ──
  var _global = globalThis;
  _global.window = _global.window || _global;
  _global.Game = {};
  _global.performance = _global.performance || { now: function () { return Date.now(); } };
  _global.document = _global.document || {
    createElement: function (tag) {
      return {
        tagName: tag.toUpperCase(),
        width: 0,
        height: 0,
        style: {},
        textContent: '',
        getContext: function () { return createFakeCtx(); },
      };
    },
    getElementById: function () { return null; },
  };
  _global.console = _global.console || { log: function () {}, warn: function () {}, error: function () {} };

  function createFakeCtx() {
    return {
      clearRect: function () {},
      save: function () {},
      restore: function () {},
    };
  }

  // ── Load modules ──
  var ROOT = path.resolve(__dirname, '..', '..');

  function loadModule(relativePath) {
    var fullPath = path.join(ROOT, relativePath);
    // Clear cache to allow reloading modules with fresh Game namespace
    delete require.cache[require.resolve(fullPath)];
    require(fullPath);
  }

  // ══════════════════════════════════════════
  //  Section 1: PhaserAudioAdapter
  // ══════════════════════════════════════════
  console.log('\n  --- PhaserAudioAdapter ---');

  // Reset Game namespace before loading
  _global.Game = {};
  loadModule('src/phaser/audioAdapter.js');

  test('PhaserAudioAdapter exports expected API', function () {
    var aa = _global.Game.PhaserAudioAdapter;
    assert(aa, 'PhaserAudioAdapter not on Game');
    assertEqual(typeof aa.init, 'function', 'init');
    assertEqual(typeof aa.isActive, 'function', 'isActive');
    assertEqual(typeof aa.preloadSfx, 'function', 'preloadSfx');
    assertEqual(typeof aa.playSfx, 'function', 'playSfx');
    assertEqual(typeof aa.playLoop, 'function', 'playLoop');
    assertEqual(typeof aa.stopLoop, 'function', 'stopLoop');
    assertEqual(typeof aa.setLoopVolume, 'function', 'setLoopVolume');
    assertEqual(typeof aa.pauseAll, 'function', 'pauseAll');
    assertEqual(typeof aa.resumeAll, 'function', 'resumeAll');
    assertEqual(typeof aa.getPreloadedIds, 'function', 'getPreloadedIds');
    assertEqual(typeof aa.destroy, 'function', 'destroy');
  });

  test('PhaserAudioAdapter inactive without Phaser game', function () {
    var aa = _global.Game.PhaserAudioAdapter;
    aa.init({});
    assertEqual(aa.isActive(), false, 'should be inactive');
  });

  test('PhaserAudioAdapter inactive with null phaserGame', function () {
    var aa = _global.Game.PhaserAudioAdapter;
    aa.init({ phaserGame: null });
    assertEqual(aa.isActive(), false, 'should be inactive');
  });

  test('PhaserAudioAdapter playSfx returns false when inactive', function () {
    var aa = _global.Game.PhaserAudioAdapter;
    aa.init({});
    var result = aa.playSfx('shoot', { volume: 0.5 });
    assertEqual(result, false, 'playSfx should return false');
  });

  test('PhaserAudioAdapter playLoop returns false when inactive', function () {
    var aa = _global.Game.PhaserAudioAdapter;
    aa.init({});
    var result = aa.playLoop('trackLoop', 0.5);
    assertEqual(result, false, 'playLoop should return false');
  });

  test('PhaserAudioAdapter getPreloadedIds empty initially', function () {
    var aa = _global.Game.PhaserAudioAdapter;
    aa.init({});
    var ids = aa.getPreloadedIds();
    assertEqual(ids.length, 0, 'should have no preloaded ids');
  });

  test('PhaserAudioAdapter destroy clears state', function () {
    var aa = _global.Game.PhaserAudioAdapter;
    aa.init({});
    aa.destroy();
    assertEqual(aa.isActive(), false, 'should be inactive after destroy');
    assertEqual(aa.getPreloadedIds().length, 0, 'no preloaded ids');
  });

  test('PhaserAudioAdapter pauseAll/resumeAll safe when inactive', function () {
    var aa = _global.Game.PhaserAudioAdapter;
    aa.init({});
    // Should not throw
    aa.pauseAll();
    aa.resumeAll();
    assert(true, 'no errors');
  });

  test('PhaserAudioAdapter stopLoop safe for unknown id', function () {
    var aa = _global.Game.PhaserAudioAdapter;
    aa.init({});
    // Should not throw
    aa.stopLoop('nonexistent');
    assert(true, 'no errors');
  });

  test('PhaserAudioAdapter active with mock Phaser game', function () {
    var aa = _global.Game.PhaserAudioAdapter;
    var mockGame = {
      sound: {
        mute: false,
        add: function (id, cfg) {
          return {
            isPlaying: false,
            volume: cfg ? cfg.volume : 1,
            loop: cfg ? cfg.loop : false,
            play: function () {},
            stop: function () {},
            destroy: function () {},
          };
        },
        pauseAll: function () {},
        resumeAll: function () {},
      },
    };
    aa.init({ phaserGame: mockGame });
    assertEqual(aa.isActive(), true, 'should be active with mock game');
    aa.destroy();
  });

  test('PhaserAudioAdapter playSfx returns false without preload', function () {
    var aa = _global.Game.PhaserAudioAdapter;
    var mockGame = {
      sound: {
        mute: false,
        add: function () { return { isPlaying: false, volume: 1, play: function () {}, stop: function () {}, destroy: function () {} }; },
        pauseAll: function () {},
        resumeAll: function () {},
      },
    };
    aa.init({ phaserGame: mockGame });
    var result = aa.playSfx('shootNormal', { volume: 0.5 });
    assertEqual(result, false, 'should return false without preload');
    aa.destroy();
  });

  // ══════════════════════════════════════════
  //  Section 2: InputComparisonHarness
  // ══════════════════════════════════════════
  console.log('\n  --- InputComparisonHarness ---');

  _global.Game = {};
  loadModule('src/phaser/inputComparisonHarness.js');

  test('InputComparisonHarness exports expected API', function () {
    var ich = _global.Game.InputComparisonHarness;
    assert(ich, 'InputComparisonHarness not on Game');
    assertEqual(typeof ich.init, 'function', 'init');
    assertEqual(typeof ich.isActive, 'function', 'isActive');
    assertEqual(typeof ich.onLegacyPointer, 'function', 'onLegacyPointer');
    assertEqual(typeof ich.onPhaserPointer, 'function', 'onPhaserPointer');
    assertEqual(typeof ich.getReport, 'function', 'getReport');
    assertEqual(typeof ich.reset, 'function', 'reset');
    assertEqual(typeof ich.destroy, 'function', 'destroy');
  });

  test('InputComparisonHarness inactive by default', function () {
    var ich = _global.Game.InputComparisonHarness;
    ich.init({});
    assertEqual(ich.isActive(), false, 'should be inactive by default');
  });

  test('InputComparisonHarness active when enabled', function () {
    var ich = _global.Game.InputComparisonHarness;
    ich.init({ enabled: true });
    assertEqual(ich.isActive(), true, 'should be active');
  });

  test('InputComparisonHarness reports zero events initially', function () {
    var ich = _global.Game.InputComparisonHarness;
    ich.init({ enabled: true });
    var report = ich.getReport();
    assertEqual(report.totalEvents, 0, 'totalEvents');
    assertEqual(report.matchedEvents, 0, 'matchedEvents');
    assertEqual(report.mismatchedEvents, 0, 'mismatchedEvents');
    assertEqual(report.active, true, 'active flag');
  });

  test('InputComparisonHarness detects matching coordinates', function () {
    var ich = _global.Game.InputComparisonHarness;
    ich.init({ enabled: true, tolerance: 2 });
    // Simulate simultaneous events within 16ms
    ich.onLegacyPointer('pointerdown', { x: 100, y: 200 });
    ich.onPhaserPointer('pointerdown', { x: 101, y: 201 });
    var report = ich.getReport();
    assertEqual(report.totalEvents, 1, 'totalEvents');
    assertEqual(report.matchedEvents, 1, 'matchedEvents should match within tolerance');
    assertEqual(report.mismatchedEvents, 0, 'mismatchedEvents');
  });

  test('InputComparisonHarness detects mismatched coordinates', function () {
    var ich = _global.Game.InputComparisonHarness;
    ich.init({ enabled: true, tolerance: 2 });
    ich.onLegacyPointer('pointermove', { x: 100, y: 200 });
    ich.onPhaserPointer('pointermove', { x: 110, y: 200 });
    var report = ich.getReport();
    assertEqual(report.totalEvents, 1, 'totalEvents');
    assertEqual(report.matchedEvents, 0, 'matchedEvents');
    assertEqual(report.mismatchedEvents, 1, 'mismatchedEvents');
    assert(report.maxDelta.x >= 10, 'maxDeltaX should be >= 10');
  });

  test('InputComparisonHarness ignores events when inactive', function () {
    var ich = _global.Game.InputComparisonHarness;
    ich.init({ enabled: false });
    ich.onLegacyPointer('pointerdown', { x: 100, y: 200 });
    ich.onPhaserPointer('pointerdown', { x: 100, y: 200 });
    var report = ich.getReport();
    assertEqual(report.totalEvents, 0, 'no events should be recorded');
  });

  test('InputComparisonHarness reset clears stats', function () {
    var ich = _global.Game.InputComparisonHarness;
    ich.init({ enabled: true });
    ich.onLegacyPointer('pointerdown', { x: 100, y: 200 });
    ich.onPhaserPointer('pointerdown', { x: 100, y: 200 });
    ich.reset();
    var report = ich.getReport();
    assertEqual(report.totalEvents, 0, 'totalEvents after reset');
  });

  test('InputComparisonHarness destroy deactivates', function () {
    var ich = _global.Game.InputComparisonHarness;
    ich.init({ enabled: true });
    ich.destroy();
    assertEqual(ich.isActive(), false, 'should be inactive after destroy');
  });

  test('InputComparisonHarness matchRate shows percentage', function () {
    var ich = _global.Game.InputComparisonHarness;
    ich.init({ enabled: true, tolerance: 2 });
    ich.onLegacyPointer('pointerdown', { x: 100, y: 200 });
    ich.onPhaserPointer('pointerdown', { x: 100, y: 200 });
    ich.onLegacyPointer('pointermove', { x: 50, y: 50 });
    ich.onPhaserPointer('pointermove', { x: 50, y: 50 });
    var report = ich.getReport();
    assertEqual(report.matchRate, '100.0%', 'matchRate');
  });

  test('InputComparisonHarness handles null pos gracefully', function () {
    var ich = _global.Game.InputComparisonHarness;
    ich.init({ enabled: true });
    // Should not throw
    ich.onLegacyPointer('pointerdown', null);
    ich.onPhaserPointer('pointerdown', null);
    var report = ich.getReport();
    assertEqual(report.totalEvents, 0, 'no events from null pos');
  });

  test('InputComparisonHarness mismatches array has detail', function () {
    var ich = _global.Game.InputComparisonHarness;
    ich.init({ enabled: true, tolerance: 2 });
    ich.onLegacyPointer('pointerup', { x: 0, y: 0 });
    ich.onPhaserPointer('pointerup', { x: 20, y: 30 });
    var report = ich.getReport();
    assertEqual(report.mismatches.length, 1, 'one mismatch');
    assertEqual(report.mismatches[0].type, 'pointerup', 'event type');
  });

  // ══════════════════════════════════════════
  //  Section 3: HudAdapter
  // ══════════════════════════════════════════
  console.log('\n  --- HudAdapter ---');

  _global.Game = {};
  loadModule('src/phaser/hudAdapter.js');

  test('HudAdapter exports expected API', function () {
    var ha = _global.Game.HudAdapter;
    assert(ha, 'HudAdapter not on Game');
    assertEqual(typeof ha.init, 'function', 'init');
    assertEqual(typeof ha.registerElement, 'function', 'registerElement');
    assertEqual(typeof ha.setPhaserObject, 'function', 'setPhaserObject');
    assertEqual(typeof ha.updateText, 'function', 'updateText');
    assertEqual(typeof ha.updateProgress, 'function', 'updateProgress');
    assertEqual(typeof ha.setVisible, 'function', 'setVisible');
    assertEqual(typeof ha.setMode, 'function', 'setMode');
    assertEqual(typeof ha.getMode, 'function', 'getMode');
    assertEqual(typeof ha.getElements, 'function', 'getElements');
    assertEqual(typeof ha.isInitialized, 'function', 'isInitialized');
    assertEqual(typeof ha.destroy, 'function', 'destroy');
  });

  test('HudAdapter not initialized before init()', function () {
    var ha = _global.Game.HudAdapter;
    ha.destroy();
    assertEqual(ha.isInitialized(), false, 'not initialized');
  });

  test('HudAdapter initialized after init()', function () {
    var ha = _global.Game.HudAdapter;
    ha.init();
    assertEqual(ha.isInitialized(), true, 'initialized');
  });

  test('HudAdapter registerElement and getElements', function () {
    var ha = _global.Game.HudAdapter;
    ha.init();
    var fakeEl = { textContent: '' };
    ha.registerElement('coins', fakeEl, { type: 'text' });
    var elements = ha.getElements();
    assert(elements.coins, 'coins element registered');
    assertEqual(elements.coins.type, 'text', 'element type');
    assertEqual(elements.coins.mode, 'dom', 'default mode');
  });

  test('HudAdapter updateText updates DOM', function () {
    var ha = _global.Game.HudAdapter;
    ha.init();
    var fakeEl = { textContent: '' };
    ha.registerElement('coins', fakeEl, { type: 'text' });
    ha.updateText('coins', '1234');
    assertEqual(fakeEl.textContent, '1234', 'DOM text updated');
  });

  test('HudAdapter updateText skips unchanged text', function () {
    var ha = _global.Game.HudAdapter;
    ha.init();
    var callCount = 0;
    var fakeEl = {
      _textContent: '',
      set textContent(v) { callCount++; this._textContent = v; },
      get textContent() { return this._textContent; },
    };
    ha.registerElement('coins', fakeEl, { type: 'text' });
    ha.updateText('coins', '100');
    ha.updateText('coins', '100'); // same value
    assertEqual(callCount, 1, 'textContent set only once');
  });

  test('HudAdapter updateProgress updates DOM style', function () {
    var ha = _global.Game.HudAdapter;
    ha.init();
    var fakeEl = { style: {} };
    ha.registerElement('xpBar', fakeEl, { type: 'progress' });
    ha.updateProgress('xpBar', 0.75);
    assertEqual(fakeEl.style.width, '75%', 'width updated');
  });

  test('HudAdapter updateProgress clamps range', function () {
    var ha = _global.Game.HudAdapter;
    ha.init();
    var fakeEl = { style: {} };
    ha.registerElement('xpBar', fakeEl, { type: 'progress' });
    ha.updateProgress('xpBar', 1.5);
    assertEqual(fakeEl.style.width, '100%', 'clamped to 100%');
    ha.updateProgress('xpBar', -0.5);
    assertEqual(fakeEl.style.width, '0%', 'clamped to 0%');
  });

  test('HudAdapter setMode switches to phaser', function () {
    var ha = _global.Game.HudAdapter;
    ha.init();
    var fakeEl = { textContent: '', style: {} };
    ha.registerElement('coins', fakeEl, { type: 'text' });
    ha.setMode('coins', 'phaser');
    assertEqual(ha.getMode('coins'), 'phaser', 'mode changed');
    assertEqual(fakeEl.style.display, 'none', 'DOM hidden');
  });

  test('HudAdapter setMode switches back to dom', function () {
    var ha = _global.Game.HudAdapter;
    ha.init();
    var fakeEl = { textContent: '', style: {} };
    ha.registerElement('coins', fakeEl, { type: 'text' });
    ha.setMode('coins', 'phaser');
    ha.setMode('coins', 'dom');
    assertEqual(ha.getMode('coins'), 'dom', 'mode restored');
    assertEqual(fakeEl.style.display, '', 'DOM shown');
  });

  test('HudAdapter setVisible toggles DOM display', function () {
    var ha = _global.Game.HudAdapter;
    ha.init();
    var fakeEl = { style: {} };
    ha.registerElement('xpWrap', fakeEl, { type: 'container' });
    ha.setVisible('xpWrap', false);
    assertEqual(fakeEl.style.display, 'none', 'hidden');
    ha.setVisible('xpWrap', true);
    assertEqual(fakeEl.style.display, '', 'visible');
  });

  test('HudAdapter getMode returns dom for unknown element', function () {
    var ha = _global.Game.HudAdapter;
    ha.init();
    assertEqual(ha.getMode('nonexistent'), 'dom', 'default dom');
  });

  test('HudAdapter setMode rejects invalid mode', function () {
    var ha = _global.Game.HudAdapter;
    ha.init();
    ha.registerElement('coins', { textContent: '' }, { type: 'text' });
    ha.setMode('coins', 'invalid');
    assertEqual(ha.getMode('coins'), 'dom', 'mode unchanged');
  });

  test('HudAdapter updateText routes to Phaser when phaser mode', function () {
    var ha = _global.Game.HudAdapter;
    ha.init();
    var setText = '';
    var fakeEl = { textContent: '', style: {} };
    var fakePhaserObj = { setText: function (t) { setText = t; } };
    ha.registerElement('coins', fakeEl, { type: 'text' });
    ha.setPhaserObject('coins', fakePhaserObj);
    ha.setMode('coins', 'phaser');
    ha.updateText('coins', '5000');
    assertEqual(setText, '5000', 'Phaser text updated');
    assertEqual(fakeEl.textContent, '', 'DOM not updated');
  });

  test('HudAdapter updateText routes to both in both mode', function () {
    var ha = _global.Game.HudAdapter;
    ha.init();
    var setText = '';
    var fakeEl = { textContent: '', style: {} };
    var fakePhaserObj = { setText: function (t) { setText = t; } };
    ha.registerElement('coins', fakeEl, { type: 'text' });
    ha.setPhaserObject('coins', fakePhaserObj);
    ha.setMode('coins', 'both');
    ha.updateText('coins', '9999');
    assertEqual(setText, '9999', 'Phaser text updated');
    assertEqual(fakeEl.textContent, '9999', 'DOM also updated');
  });

  test('HudAdapter destroy clears state', function () {
    var ha = _global.Game.HudAdapter;
    ha.init();
    ha.registerElement('coins', { textContent: '' }, { type: 'text' });
    ha.destroy();
    assertEqual(ha.isInitialized(), false, 'not initialized');
    var elements = ha.getElements();
    assertEqual(Object.keys(elements).length, 0, 'elements cleared');
  });

  test('HudAdapter setPhaserObject for unknown id is safe', function () {
    var ha = _global.Game.HudAdapter;
    ha.init();
    // Should not throw
    ha.setPhaserObject('nonexistent', {});
    assert(true, 'no error');
  });

  test('HudAdapter updateProgress routes to Phaser with setProgress', function () {
    var ha = _global.Game.HudAdapter;
    ha.init();
    var setProgressVal = -1;
    var fakeEl = { style: {} };
    var fakePhaserObj = { setProgress: function (v) { setProgressVal = v; } };
    ha.registerElement('xpBar', fakeEl, { type: 'progress' });
    ha.setPhaserObject('xpBar', fakePhaserObj);
    ha.setMode('xpBar', 'phaser');
    ha.updateProgress('xpBar', 0.5);
    assertEqual(setProgressVal, 0.5, 'Phaser progress updated');
  });

  // ══════════════════════════════════════════
  //  Section 4: Integration between modules
  // ══════════════════════════════════════════
  console.log('\n  --- Integration ---');

  test('All three modules coexist on Game namespace', function () {
    _global.Game = {};
    loadModule('src/phaser/audioAdapter.js');
    loadModule('src/phaser/inputComparisonHarness.js');
    loadModule('src/phaser/hudAdapter.js');
    assert(_global.Game.PhaserAudioAdapter, 'PhaserAudioAdapter');
    assert(_global.Game.InputComparisonHarness, 'InputComparisonHarness');
    assert(_global.Game.HudAdapter, 'HudAdapter');
  });

  test('Modules independent init/destroy', function () {
    _global.Game.PhaserAudioAdapter.init({});
    _global.Game.InputComparisonHarness.init({ enabled: true });
    _global.Game.HudAdapter.init();

    _global.Game.PhaserAudioAdapter.destroy();
    assertEqual(_global.Game.InputComparisonHarness.isActive(), true, 'ICH still active');
    assertEqual(_global.Game.HudAdapter.isInitialized(), true, 'HUD still initialized');

    _global.Game.InputComparisonHarness.destroy();
    _global.Game.HudAdapter.destroy();
  });

  // ── Summary ──
  console.log('\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
  console.log('Total: ' + (passCount + failCount) + '  Passed: ' + passCount + '  Failed: ' + failCount);
  if (failures.length > 0) {
    console.log('\nFailures:');
    failures.forEach(function (f) {
      console.log('  \u2717 ' + f.name + ': ' + f.error);
    });
  }
  console.log('\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n');
  process.exit(failCount > 0 ? 1 : 0);
})();
