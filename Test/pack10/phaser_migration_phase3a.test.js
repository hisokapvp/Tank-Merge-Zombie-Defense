/**
 * Pack 10g: Phaser Migration — Phase 3a HudScene + SceneOverlayManager + ModalAdapter Tests
 *
 * Tests for:
 * - SceneOverlayManager (overlay scene coordination)
 * - ModalAdapter (modal DOM/Phaser bridge)
 * - HudScene (Phaser HUD overlay — structural tests; no real Phaser runtime)
 * - HudAdapter wiring integration (updateUI/updateProgressUI delegation)
 *
 * Run: node Test/pack10/phaser_migration_phase3a.test.js
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

  function assertDeepEqual(actual, expected, msg) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(
        (msg || 'assertDeepEqual') + ': expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual)
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

  console.log('\n\u2500\u2500 Pack 10g: Phaser Migration Phase 3a \u2014 HudScene / SceneOverlayManager / ModalAdapter \u2500\u2500');

  // ── Fake DOM globals for Node.js ──
  var _global = globalThis;
  _global.window = _global.window || _global;
  _global.Game = {};
  _global.performance = _global.performance || { now: function () { return Date.now(); } };
  _global.document = _global.document || {
    createElement: function (tag) {
      return createFakeDomEl(tag);
    },
    getElementById: function () { return null; },
  };
  _global.console = _global.console || { log: function () {}, warn: function () {}, error: function () {} };

  function createFakeDomEl(tag) {
    return {
      tagName: (tag || 'div').toUpperCase(),
      style: {},
      textContent: '',
      classList: createFakeClassList(),
      getAttribute: function (attr) { return this['_attr_' + attr] || null; },
      setAttribute: function (attr, val) { this['_attr_' + attr] = val; },
      removeAttribute: function (attr) { delete this['_attr_' + attr]; },
      children: [],
    };
  }

  function createFakeClassList() {
    var classes = {};
    return {
      add: function (c) { classes[c] = true; },
      remove: function (c) { delete classes[c]; },
      toggle: function (c, force) {
        if (force === undefined) {
          if (classes[c]) delete classes[c]; else classes[c] = true;
        } else if (force) {
          classes[c] = true;
        } else {
          delete classes[c];
        }
      },
      contains: function (c) { return !!classes[c]; },
      _raw: classes,
    };
  }

  // ── Load modules ──
  var ROOT = path.resolve(__dirname, '..', '..');

  function loadModule(relativePath) {
    var fullPath = path.join(ROOT, relativePath);
    delete require.cache[require.resolve(fullPath)];
    require(fullPath);
  }

  // ══════════════════════════════════════════
  //  Section 1: SceneOverlayManager
  // ══════════════════════════════════════════
  console.log('\n  --- SceneOverlayManager ---');

  _global.Game = {};
  loadModule('src/phaser/sceneOverlayManager.js');

  test('SceneOverlayManager exports expected API', function () {
    var som = _global.Game.SceneOverlayManager;
    assert(som, 'SceneOverlayManager not on Game');
    assertEqual(typeof som.init, 'function', 'init');
    assertEqual(typeof som.register, 'function', 'register');
    assertEqual(typeof som.show, 'function', 'show');
    assertEqual(typeof som.hide, 'function', 'hide');
    assertEqual(typeof som.isVisible, 'function', 'isVisible');
    assertEqual(typeof som.getState, 'function', 'getState');
    assertEqual(typeof som.onSceneCreated, 'function', 'onSceneCreated');
    assertEqual(typeof som.getRegistered, 'function', 'getRegistered');
    assertEqual(typeof som.isInitialized, 'function', 'isInitialized');
    assertEqual(typeof som.destroy, 'function', 'destroy');
  });

  test('SceneOverlayManager not initialized before init()', function () {
    _global.Game = {};
    loadModule('src/phaser/sceneOverlayManager.js');
    assertEqual(_global.Game.SceneOverlayManager.isInitialized(), false, 'should be false');
  });

  test('SceneOverlayManager init sets initialized', function () {
    var som = _global.Game.SceneOverlayManager;
    som.init({});
    assertEqual(som.isInitialized(), true, 'should be true after init');
  });

  test('SceneOverlayManager register adds entry', function () {
    _global.Game = {};
    loadModule('src/phaser/sceneOverlayManager.js');
    var som = _global.Game.SceneOverlayManager;
    som.init({});
    som.register('TestScene');
    var registered = som.getRegistered();
    assert(registered.indexOf('TestScene') !== -1, 'TestScene should be registered');
  });

  test('SceneOverlayManager isVisible defaults to false', function () {
    var som = _global.Game.SceneOverlayManager;
    assertEqual(som.isVisible('TestScene'), false, 'not visible by default');
  });

  test('SceneOverlayManager getState returns stopped without Phaser game', function () {
    var som = _global.Game.SceneOverlayManager;
    assertEqual(som.getState('TestScene'), 'stopped', 'should be stopped');
  });

  test('SceneOverlayManager getState returns null for unregistered', function () {
    var som = _global.Game.SceneOverlayManager;
    assertEqual(som.getState('NonExistent'), null, 'should be null');
  });

  test('SceneOverlayManager show sets visible flag with mock Phaser game', function () {
    _global.Game = {};
    loadModule('src/phaser/sceneOverlayManager.js');
    var som = _global.Game.SceneOverlayManager;

    var sceneActions = [];
    var mockGame = {
      scene: {
        getScene: function (key) {
          return {
            show: function () { sceneActions.push('show:' + key); },
            hide: function () { sceneActions.push('hide:' + key); },
          };
        },
        isActive: function () { return false; },
        isSleeping: function () { return true; },
        wake: function (key) { sceneActions.push('wake:' + key); },
        start: function (key) { sceneActions.push('start:' + key); },
        sleep: function (key) { sceneActions.push('sleep:' + key); },
        stop: function () {},
        launch: function (key) { sceneActions.push('launch:' + key); },
      },
    };

    som.init({ phaserGame: mockGame });
    som.register('HudScene');
    som.show('HudScene');
    assertEqual(som.isVisible('HudScene'), true, 'should be visible after show');
    assert(sceneActions.indexOf('wake:HudScene') !== -1, 'should wake sleeping scene');
  });

  test('SceneOverlayManager hide sets visible flag false', function () {
    var som = _global.Game.SceneOverlayManager;
    som.hide('HudScene');
    assertEqual(som.isVisible('HudScene'), false, 'should be hidden after hide');
  });

  test('SceneOverlayManager onSceneCreated marks created', function () {
    _global.Game = {};
    loadModule('src/phaser/sceneOverlayManager.js');
    var som = _global.Game.SceneOverlayManager;
    som.init({});
    som.register('TestScene');
    som.onSceneCreated('TestScene');
    // Internal state — verify no crash and getRegistered still works
    assert(som.getRegistered().indexOf('TestScene') !== -1, 'still registered');
  });

  test('SceneOverlayManager destroy clears state', function () {
    var som = _global.Game.SceneOverlayManager;
    som.destroy();
    assertEqual(som.isInitialized(), false, 'not initialized after destroy');
    assertDeepEqual(som.getRegistered(), [], 'no registered after destroy');
  });

  test('SceneOverlayManager show without Phaser game does not crash', function () {
    _global.Game = {};
    loadModule('src/phaser/sceneOverlayManager.js');
    var som = _global.Game.SceneOverlayManager;
    som.init({});
    som.register('SomeScene');
    som.show('SomeScene'); // no phaserGame — should not throw
    // visible flag still set optimistically
  });

  test('SceneOverlayManager register with autoLaunch triggers launch', function () {
    _global.Game = {};
    loadModule('src/phaser/sceneOverlayManager.js');
    var som = _global.Game.SceneOverlayManager;
    var launched = [];
    var mockGame = {
      scene: {
        launch: function (k) { launched.push(k); },
        getScene: function () { return null; },
        isActive: function () { return false; },
        isSleeping: function () { return false; },
        stop: function () {},
      },
    };
    som.init({ phaserGame: mockGame });
    som.register('AutoScene', { autoLaunch: true });
    assert(launched.indexOf('AutoScene') !== -1, 'should auto-launch');
  });

  // ══════════════════════════════════════════
  //  Section 2: ModalAdapter
  // ══════════════════════════════════════════
  console.log('\n  --- ModalAdapter ---');

  _global.Game = {};
  loadModule('src/phaser/modalAdapter.js');

  test('ModalAdapter exports expected API', function () {
    var ma = _global.Game.ModalAdapter;
    assert(ma, 'ModalAdapter not on Game');
    assertEqual(typeof ma.init, 'function', 'init');
    assertEqual(typeof ma.registerModal, 'function', 'registerModal');
    assertEqual(typeof ma.setPhaserSceneKey, 'function', 'setPhaserSceneKey');
    assertEqual(typeof ma.open, 'function', 'open');
    assertEqual(typeof ma.close, 'function', 'close');
    assertEqual(typeof ma.isOpen, 'function', 'isOpen');
    assertEqual(typeof ma.setMode, 'function', 'setMode');
    assertEqual(typeof ma.getMode, 'function', 'getMode');
    assertEqual(typeof ma.getModals, 'function', 'getModals');
    assertEqual(typeof ma.isInitialized, 'function', 'isInitialized');
    assertEqual(typeof ma.destroy, 'function', 'destroy');
  });

  test('ModalAdapter not initialized before init()', function () {
    _global.Game = {};
    loadModule('src/phaser/modalAdapter.js');
    assertEqual(_global.Game.ModalAdapter.isInitialized(), false, 'should be false');
  });

  test('ModalAdapter init sets initialized', function () {
    var ma = _global.Game.ModalAdapter;
    ma.init();
    assertEqual(ma.isInitialized(), true, 'should be true');
  });

  test('ModalAdapter registerModal and getModals', function () {
    var ma = _global.Game.ModalAdapter;
    var el = createFakeDomEl('div');
    ma.registerModal('testModal', el, { hiddenClass: 'hidden' });
    var modals = ma.getModals();
    assert(modals.testModal, 'testModal should be registered');
    assertEqual(modals.testModal.mode, 'dom', 'default mode is dom');
    assertEqual(modals.testModal.isOpen, false, 'starts closed');
    assertEqual(modals.testModal.hasDom, true, 'has DOM element');
    assertEqual(modals.testModal.hasPhaserScene, false, 'no Phaser scene');
  });

  test('ModalAdapter open sets isOpen and shows DOM', function () {
    var ma = _global.Game.ModalAdapter;
    var el = createFakeDomEl('div');
    el.classList.add('hidden');
    el.setAttribute('aria-hidden', 'true');
    _global.Game = {};
    loadModule('src/phaser/modalAdapter.js');
    ma = _global.Game.ModalAdapter;
    ma.init();
    ma.registerModal('m1', el, { hiddenClass: 'hidden' });
    ma.open('m1');
    assertEqual(ma.isOpen('m1'), true, 'should be open');
    assertEqual(el.classList.contains('hidden'), false, 'hidden class removed');
    assertEqual(el.getAttribute('aria-hidden'), 'false', 'aria-hidden false');
  });

  test('ModalAdapter close sets isOpen false and hides DOM', function () {
    var ma = _global.Game.ModalAdapter;
    ma.close('m1');
    assertEqual(ma.isOpen('m1'), false, 'should be closed');
  });

  test('ModalAdapter isOpen returns false for unregistered', function () {
    assertEqual(_global.Game.ModalAdapter.isOpen('nonexistent'), false, 'false for unknown');
  });

  test('ModalAdapter setMode changes mode', function () {
    var ma = _global.Game.ModalAdapter;
    ma.setMode('m1', 'phaser');
    assertEqual(ma.getMode('m1'), 'phaser', 'mode should be phaser');
    ma.setMode('m1', 'both');
    assertEqual(ma.getMode('m1'), 'both', 'mode should be both');
    ma.setMode('m1', 'dom');
    assertEqual(ma.getMode('m1'), 'dom', 'mode should be dom');
  });

  test('ModalAdapter setMode rejects invalid value', function () {
    var ma = _global.Game.ModalAdapter;
    ma.setMode('m1', 'dom');
    ma.setMode('m1', 'invalid');
    assertEqual(ma.getMode('m1'), 'dom', 'mode unchanged for invalid');
  });

  test('ModalAdapter getMode returns dom for unregistered', function () {
    assertEqual(_global.Game.ModalAdapter.getMode('nonexistent'), 'dom', 'default dom');
  });

  test('ModalAdapter setPhaserSceneKey', function () {
    var ma = _global.Game.ModalAdapter;
    ma.setPhaserSceneKey('m1', 'PauseMenuScene');
    var modals = ma.getModals();
    assertEqual(modals.m1.hasPhaserScene, true, 'should have Phaser scene');
  });

  test('ModalAdapter open in phaser mode calls SceneOverlayManager.show', function () {
    _global.Game = {};
    var showCalls = [];
    _global.Game.SceneOverlayManager = {
      show: function (key) { showCalls.push(key); },
      hide: function () {},
    };
    loadModule('src/phaser/modalAdapter.js');
    var ma = _global.Game.ModalAdapter;
    ma.init();
    var el = createFakeDomEl('div');
    ma.registerModal('pm', el);
    ma.setPhaserSceneKey('pm', 'PauseScene');
    ma.setMode('pm', 'phaser');
    ma.open('pm');
    assert(showCalls.indexOf('PauseScene') !== -1, 'should call show on overlay mgr');
    // DOM should be hidden in phaser mode
    assertEqual(el.classList.contains('hidden'), true, 'DOM hidden in phaser mode');
  });

  test('ModalAdapter close in phaser mode calls SceneOverlayManager.hide', function () {
    var hideCalls = [];
    _global.Game.SceneOverlayManager.hide = function (key) { hideCalls.push(key); };
    var ma = _global.Game.ModalAdapter;
    ma.close('pm');
    assert(hideCalls.indexOf('PauseScene') !== -1, 'should call hide');
  });

  test('ModalAdapter open with onOpen callback', function () {
    _global.Game = {};
    loadModule('src/phaser/modalAdapter.js');
    var ma = _global.Game.ModalAdapter;
    ma.init();
    var openData = null;
    ma.registerModal('cb', null, { onOpen: function (d) { openData = d; } });
    ma.open('cb', { reward: 100 });
    assertDeepEqual(openData, { reward: 100 }, 'onOpen receives data');
  });

  test('ModalAdapter close with onClose callback', function () {
    var ma = _global.Game.ModalAdapter;
    var closeCalled = false;
    _global.Game = {};
    loadModule('src/phaser/modalAdapter.js');
    ma = _global.Game.ModalAdapter;
    ma.init();
    ma.registerModal('cb2', null, { onClose: function () { closeCalled = true; } });
    ma.open('cb2');
    ma.close('cb2');
    assertEqual(closeCalled, true, 'onClose fired');
  });

  test('ModalAdapter destroy clears state', function () {
    var ma = _global.Game.ModalAdapter;
    ma.destroy();
    assertEqual(ma.isInitialized(), false, 'not initialized');
    assertDeepEqual(ma.getModals(), {}, 'no modals');
  });

  test('ModalAdapter open in both mode shows DOM and Phaser', function () {
    _global.Game = {};
    var showCalls = [];
    _global.Game.SceneOverlayManager = {
      show: function (key) { showCalls.push(key); },
      hide: function () {},
    };
    loadModule('src/phaser/modalAdapter.js');
    var ma = _global.Game.ModalAdapter;
    ma.init();
    var el = createFakeDomEl('div');
    el.classList.add('hidden');
    ma.registerModal('both1', el);
    ma.setPhaserSceneKey('both1', 'BothScene');
    ma.setMode('both1', 'both');
    ma.open('both1');
    assertEqual(el.classList.contains('hidden'), false, 'DOM visible in both mode');
    assert(showCalls.indexOf('BothScene') !== -1, 'Phaser scene shown in both mode');
  });

  // ══════════════════════════════════════════
  //  Section 3: HudScene (structural tests)
  // ══════════════════════════════════════════
  console.log('\n  --- HudScene (structural) ---');

  // HudScene requires Phaser global — provide minimal stubs
  _global.Game = {};
  _global.Phaser = {
    Class: function (config) {
      // Minimal Phaser.Class stub — store config and return constructor
      function SceneClass() {
        if (config.initialize) config.initialize.call(this);
      }
      SceneClass.prototype = {};
      for (var key in config) {
        if (config.hasOwnProperty(key) && key !== 'initialize' && key !== 'Extends') {
          SceneClass.prototype[key] = config[key];
        }
      }
      return SceneClass;
    },
    Scene: function (cfg) {
      this._sceneKey = cfg ? cfg.key : undefined;
    },
  };

  loadModule('src/phaser/scenes/HudScene.js');

  test('HudScene exports to Game.PhaserScenes.HudScene', function () {
    assert(_global.Game.PhaserScenes, 'PhaserScenes namespace');
    assert(_global.Game.PhaserScenes.HudScene, 'HudScene registered');
    assertEqual(typeof _global.Game.PhaserScenes.HudScene, 'function', 'is constructor');
  });

  delete _global.Phaser;

  // ══════════════════════════════════════════
  //  Section 4: HudAdapter wiring integration
  // ══════════════════════════════════════════
  console.log('\n  --- HudAdapter wiring integration ---');

  _global.Game = {};
  loadModule('src/phaser/hudAdapter.js');

  test('HudAdapter updateText routes to DOM element', function () {
    var hud = _global.Game.HudAdapter;
    hud.init();
    var el = createFakeDomEl('span');
    hud.registerElement('coins', el, { type: 'text' });
    hud.updateText('coins', '1234');
    assertEqual(el.textContent, '1234', 'DOM updated');
  });

  test('HudAdapter updateText skips unchanged text', function () {
    var hud = _global.Game.HudAdapter;
    var el = createFakeDomEl('span');
    hud.registerElement('coins2', el, { type: 'text' });
    hud.updateText('coins2', 'abc');
    assertEqual(el.textContent, 'abc', 'first update');
    el.textContent = 'MODIFIED_BY_OTHER_CODE';
    hud.updateText('coins2', 'abc');
    // Because lastText was 'abc' and new text is 'abc', skip
    assertEqual(el.textContent, 'MODIFIED_BY_OTHER_CODE', 'skipped — text unchanged');
  });

  test('HudAdapter updateProgress updates DOM style.width', function () {
    var hud = _global.Game.HudAdapter;
    var el = createFakeDomEl('div');
    hud.registerElement('xpBar', el, { type: 'progress' });
    hud.updateProgress('xpBar', 0.6);
    assertEqual(el.style.width, '60%', 'width set to 60%');
  });

  test('HudAdapter updateProgress clamps to 0-1', function () {
    var hud = _global.Game.HudAdapter;
    var el = createFakeDomEl('div');
    hud.registerElement('bar2', el, { type: 'progress' });
    hud.updateProgress('bar2', 1.5);
    assertEqual(el.style.width, '100%', 'clamped to 100%');
    hud.updateProgress('bar2', -0.3);
    assertEqual(el.style.width, '0%', 'clamped to 0%');
  });

  test('HudAdapter updateText routes to Phaser object in both mode', function () {
    _global.Game = {};
    loadModule('src/phaser/hudAdapter.js');
    var hud = _global.Game.HudAdapter;
    hud.init();
    var el = createFakeDomEl('span');
    var phaserText = '';
    hud.registerElement('coins', el, { type: 'text', mode: 'both' });
    hud.setPhaserObject('coins', { setText: function (t) { phaserText = t; } });
    hud.updateText('coins', '5678');
    assertEqual(el.textContent, '5678', 'DOM updated');
    assertEqual(phaserText, '5678', 'Phaser text updated');
  });

  test('HudAdapter updateProgress routes to Phaser object with setProgress', function () {
    var hud = _global.Game.HudAdapter;
    var progressValue = -1;
    var el = createFakeDomEl('div');
    hud.registerElement('bar3', el, { type: 'progress', mode: 'both' });
    hud.setPhaserObject('bar3', {
      setProgress: function (v) { progressValue = v; },
      scaleX: 0,
    });
    hud.updateProgress('bar3', 0.75);
    assertEqual(progressValue, 0.75, 'setProgress called with 0.75');
    assertEqual(el.style.width, '75%', 'DOM also updated');
  });

  test('HudAdapter setMode phaser hides DOM', function () {
    _global.Game = {};
    loadModule('src/phaser/hudAdapter.js');
    var hud = _global.Game.HudAdapter;
    hud.init();
    var el = createFakeDomEl('span');
    hud.registerElement('elem1', el, { type: 'text' });
    hud.setMode('elem1', 'phaser');
    assertEqual(el.style.display, 'none', 'DOM hidden in phaser mode');
  });

  test('HudAdapter setMode dom shows DOM and hides Phaser', function () {
    var hud = _global.Game.HudAdapter;
    var el = createFakeDomEl('span');
    var phaserVisible = true;
    hud.registerElement('elem2', el, { type: 'text', mode: 'phaser' });
    hud.setPhaserObject('elem2', { setVisible: function (v) { phaserVisible = v; } });
    el.style.display = 'none';
    hud.setMode('elem2', 'dom');
    assertEqual(el.style.display, '', 'DOM visible');
    assertEqual(phaserVisible, false, 'Phaser hidden');
  });

  test('HudAdapter setVisible controls DOM display', function () {
    var hud = _global.Game.HudAdapter;
    var el = createFakeDomEl('span');
    hud.registerElement('vis1', el, { type: 'text' });
    hud.setVisible('vis1', false);
    assertEqual(el.style.display, 'none', 'hidden');
    hud.setVisible('vis1', true);
    assertEqual(el.style.display, '', 'visible');
  });

  test('HudAdapter getElements returns all registered', function () {
    var hud = _global.Game.HudAdapter;
    var els = hud.getElements();
    assert(els.elem2, 'elem2 registered');
    assert(els.vis1, 'vis1 registered');
  });

  test('HudAdapter destroy clears all elements', function () {
    var hud = _global.Game.HudAdapter;
    hud.destroy();
    assertEqual(hud.isInitialized(), false, 'not initialized');
    assertDeepEqual(hud.getElements(), {}, 'no elements');
  });

  // ══════════════════════════════════════════
  //  Section 5: Integration — ModalAdapter + SceneOverlayManager
  // ══════════════════════════════════════════
  console.log('\n  --- Integration: ModalAdapter + SceneOverlayManager ---');

  _global.Game = {};
  loadModule('src/phaser/sceneOverlayManager.js');
  loadModule('src/phaser/modalAdapter.js');

  test('ModalAdapter open in phaser mode delegates to real SceneOverlayManager', function () {
    var som = _global.Game.SceneOverlayManager;
    var sceneSleeping = {};
    var sceneActive = {};
    var mockGame = {
      scene: {
        getScene: function (key) {
          return {
            show: function () {},
            hide: function () {},
          };
        },
        isActive: function (key) { return !!sceneActive[key]; },
        isSleeping: function (key) { return !!sceneSleeping[key]; },
        wake: function (key) { sceneActive[key] = true; delete sceneSleeping[key]; },
        start: function (key) { sceneActive[key] = true; },
        sleep: function (key) { sceneSleeping[key] = true; delete sceneActive[key]; },
        stop: function (key) { delete sceneActive[key]; delete sceneSleeping[key]; },
        launch: function (key) { sceneActive[key] = true; },
      },
    };

    som.init({ phaserGame: mockGame });
    som.register('PauseMenuScene');

    var ma = _global.Game.ModalAdapter;
    ma.init();
    var el = createFakeDomEl('div');
    ma.registerModal('pause', el);
    ma.setPhaserSceneKey('pause', 'PauseMenuScene');
    ma.setMode('pause', 'phaser');
    ma.open('pause');

    assertEqual(som.isVisible('PauseMenuScene'), true, 'overlay visible after modal open');
    assertEqual(ma.isOpen('pause'), true, 'modal is open');

    ma.close('pause');
    assertEqual(ma.isOpen('pause'), false, 'modal closed');
  });

  test('Multiple modals can be registered and operate independently', function () {
    var ma = _global.Game.ModalAdapter;
    var el1 = createFakeDomEl('div');
    var el2 = createFakeDomEl('div');
    ma.registerModal('modal1', el1);
    ma.registerModal('modal2', el2);
    ma.open('modal1');
    assertEqual(ma.isOpen('modal1'), true, 'modal1 open');
    assertEqual(ma.isOpen('modal2'), false, 'modal2 still closed');
    ma.open('modal2');
    assertEqual(ma.isOpen('modal2'), true, 'modal2 open');
    ma.close('modal1');
    assertEqual(ma.isOpen('modal1'), false, 'modal1 closed');
    assertEqual(ma.isOpen('modal2'), true, 'modal2 still open');
  });

  test('ModalAdapter and SceneOverlayManager destroy independently', function () {
    _global.Game.ModalAdapter.destroy();
    _global.Game.SceneOverlayManager.destroy();
    assertEqual(_global.Game.ModalAdapter.isInitialized(), false, 'MA destroyed');
    assertEqual(_global.Game.SceneOverlayManager.isInitialized(), false, 'SOM destroyed');
  });

  // ══════════════════════════════════════════
  //  Section 6: Edge cases
  // ══════════════════════════════════════════
  console.log('\n  --- Edge cases ---');

  test('SceneOverlayManager show for active (not sleeping) scene calls start', function () {
    _global.Game = {};
    loadModule('src/phaser/sceneOverlayManager.js');
    var som = _global.Game.SceneOverlayManager;
    var actions = [];
    var mockGame = {
      scene: {
        getScene: function (k) { return { show: function () {} }; },
        isActive: function () { return false; },
        isSleeping: function () { return false; },
        wake: function () {},
        start: function (k) { actions.push('start:' + k); },
        sleep: function () {},
        stop: function () {},
        launch: function () {},
      },
    };
    som.init({ phaserGame: mockGame });
    som.register('S1');
    som.show('S1');
    assert(actions.indexOf('start:S1') !== -1, 'should start non-sleeping scene');
  });

  test('SceneOverlayManager hide for inactive scene does not crash', function () {
    var som = _global.Game.SceneOverlayManager;
    som.hide('S1');
    assertEqual(som.isVisible('S1'), false, 'hidden');
  });

  test('ModalAdapter registerModal without DOM element works', function () {
    _global.Game = {};
    loadModule('src/phaser/modalAdapter.js');
    var ma = _global.Game.ModalAdapter;
    ma.init();
    ma.registerModal('noDom', null);
    ma.open('noDom');
    assertEqual(ma.isOpen('noDom'), true, 'open without DOM');
    ma.close('noDom');
    assertEqual(ma.isOpen('noDom'), false, 'close without DOM');
  });

  test('HudAdapter registerElement with null domEl does not crash updates', function () {
    _global.Game = {};
    loadModule('src/phaser/hudAdapter.js');
    var hud = _global.Game.HudAdapter;
    hud.init();
    hud.registerElement('nullEl', null, { type: 'text' });
    hud.updateText('nullEl', 'test'); // should not throw
    hud.updateProgress('nullEl', 0.5); // should not throw
    hud.setVisible('nullEl', false);   // should not throw
  });

  test('SceneOverlayManager getState returns active for active scene', function () {
    _global.Game = {};
    loadModule('src/phaser/sceneOverlayManager.js');
    var som = _global.Game.SceneOverlayManager;
    var mockGame = {
      scene: {
        isActive: function () { return true; },
        isSleeping: function () { return false; },
        stop: function () {},
        launch: function () {},
      },
    };
    som.init({ phaserGame: mockGame });
    som.register('ActiveScene');
    assertEqual(som.getState('ActiveScene'), 'active', 'should be active');
  });

  test('SceneOverlayManager getState returns sleeping for sleeping scene', function () {
    _global.Game = {};
    loadModule('src/phaser/sceneOverlayManager.js');
    var som = _global.Game.SceneOverlayManager;
    var mockGame = {
      scene: {
        isActive: function () { return false; },
        isSleeping: function () { return true; },
        stop: function () {},
        launch: function () {},
      },
    };
    som.init({ phaserGame: mockGame });
    som.register('SleepScene');
    assertEqual(som.getState('SleepScene'), 'sleeping', 'should be sleeping');
  });

  // ════════════════════════════════════════════════
  //  Results
  // ════════════════════════════════════════════════
  console.log('\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
  console.log('Total: ' + (passCount + failCount) + '  Passed: ' + passCount + '  Failed: ' + failCount);
  console.log('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');

  if (failures.length > 0) {
    console.log('\nFailed tests:');
    failures.forEach(function (f) {
      console.log('  - ' + f.name + ': ' + f.error);
    });
  }

  process.exit(failCount > 0 ? 1 : 0);
}());
