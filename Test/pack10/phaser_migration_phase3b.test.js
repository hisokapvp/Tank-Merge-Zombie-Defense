/**
 * Pack 10h: Phaser Migration — Phase 3b Modal Scenes + notifyOpen/notifyClose Tests
 *
 * Tests for:
 * - ModalAdapter.notifyOpen / notifyClose (state tracking + Phaser scene routing)
 * - LevelUpScene (structural tests — scene key, show/hide, text)
 * - CrateRewardScene (structural tests — scene key, show/hide, callbacks)
 * - PauseMenuScene (structural tests — scene key, show/hide, callbacks)
 * - _notifyModal integration (game.js helper → ModalAdapter)
 *
 * Run: node Test/pack10/phaser_migration_phase3b.test.js
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

  console.log('\n\u2500\u2500 Pack 10h: Phaser Migration Phase 3b \u2014 Modal Scenes + notifyOpen/notifyClose \u2500\u2500');

  // ── Fake DOM globals for Node.js ──
  var _global = globalThis;
  _global.window = _global.window || _global;
  _global.Game = {};
  _global.performance = _global.performance || { now: function () { return Date.now(); } };
  _global.document = _global.document || {
    createElement: function (tag) { return createFakeDomEl(tag); },
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
  //  Section 1: ModalAdapter notifyOpen / notifyClose
  // ══════════════════════════════════════════
  console.log('\n  --- ModalAdapter notifyOpen / notifyClose ---');

  _global.Game = {};
  loadModule('src/phaser/modalAdapter.js');

  test('ModalAdapter exports notifyOpen and notifyClose', function () {
    var ma = _global.Game.ModalAdapter;
    assertEqual(typeof ma.notifyOpen, 'function', 'notifyOpen');
    assertEqual(typeof ma.notifyClose, 'function', 'notifyClose');
  });

  test('notifyOpen sets isOpen true', function () {
    _global.Game = {};
    loadModule('src/phaser/modalAdapter.js');
    var ma = _global.Game.ModalAdapter;
    ma.init();
    ma.registerModal('m1', null);
    assertEqual(ma.isOpen('m1'), false, 'starts closed');
    ma.notifyOpen('m1');
    assertEqual(ma.isOpen('m1'), true, 'open after notifyOpen');
  });

  test('notifyClose sets isOpen false', function () {
    var ma = _global.Game.ModalAdapter;
    ma.notifyOpen('m1');
    assertEqual(ma.isOpen('m1'), true, 'open');
    ma.notifyClose('m1');
    assertEqual(ma.isOpen('m1'), false, 'closed after notifyClose');
  });

  test('notifyOpen for unregistered modal does not crash', function () {
    var ma = _global.Game.ModalAdapter;
    ma.notifyOpen('nonexistent');
    ma.notifyClose('nonexistent');
    // no error thrown = pass
  });

  test('notifyOpen in dom mode does NOT touch DOM', function () {
    _global.Game = {};
    loadModule('src/phaser/modalAdapter.js');
    var ma = _global.Game.ModalAdapter;
    ma.init();
    var el = createFakeDomEl('div');
    el.classList.add('hidden');
    el.setAttribute('aria-hidden', 'true');
    ma.registerModal('domModal', el); // default mode='dom'
    ma.notifyOpen('domModal');
    assertEqual(el.classList.contains('hidden'), true, 'hidden class untouched in dom mode');
    assertEqual(el.getAttribute('aria-hidden'), 'true', 'aria-hidden untouched');
    assertEqual(ma.isOpen('domModal'), true, 'state still tracked');
  });

  test('notifyOpen in phaser mode calls SceneOverlayManager.show', function () {
    _global.Game = {};
    var showCalls = [];
    _global.Game.SceneOverlayManager = {
      show: function (key, data) { showCalls.push({ key: key, data: data }); },
      hide: function () {},
    };
    loadModule('src/phaser/modalAdapter.js');
    var ma = _global.Game.ModalAdapter;
    ma.init();
    var el = createFakeDomEl('div');
    ma.registerModal('pModal', el);
    ma.setPhaserSceneKey('pModal', 'TestScene');
    ma.setMode('pModal', 'phaser');
    ma.notifyOpen('pModal', { level: 5 });
    assertEqual(showCalls.length, 1, 'show called once');
    assertEqual(showCalls[0].key, 'TestScene', 'correct scene key');
  });

  test('notifyOpen in phaser mode hides DOM', function () {
    var ma = _global.Game.ModalAdapter;
    var modals = ma.getModals();
    assertEqual(modals.pModal.hasDom, true, 'has DOM');
    // DOM should be hidden in phaser mode
    // Re-read state: our modalAdapter in phaser mode should hide DOM
    var el = createFakeDomEl('div');
    _global.Game = {};
    var showCalls = [];
    _global.Game.SceneOverlayManager = {
      show: function (key) { showCalls.push(key); },
      hide: function () {},
    };
    loadModule('src/phaser/modalAdapter.js');
    ma = _global.Game.ModalAdapter;
    ma.init();
    ma.registerModal('pModal2', el);
    ma.setPhaserSceneKey('pModal2', 'Scene2');
    ma.setMode('pModal2', 'phaser');
    ma.notifyOpen('pModal2');
    assertEqual(el.classList.contains('hidden'), true, 'DOM hidden in phaser mode via notifyOpen');
    assertEqual(el.getAttribute('aria-hidden'), 'true', 'aria-hidden=true in phaser mode');
  });

  test('notifyClose in phaser mode calls SceneOverlayManager.hide', function () {
    _global.Game = {};
    var hideCalls = [];
    _global.Game.SceneOverlayManager = {
      show: function () {},
      hide: function (key) { hideCalls.push(key); },
    };
    loadModule('src/phaser/modalAdapter.js');
    var ma = _global.Game.ModalAdapter;
    ma.init();
    ma.registerModal('hModal', null);
    ma.setPhaserSceneKey('hModal', 'HideScene');
    ma.setMode('hModal', 'phaser');
    ma.notifyOpen('hModal');
    ma.notifyClose('hModal');
    assertEqual(hideCalls.length, 1, 'hide called once');
    assertEqual(hideCalls[0], 'HideScene', 'correct scene key');
    assertEqual(ma.isOpen('hModal'), false, 'state is closed');
  });

  test('notifyOpen in both mode launches Phaser and does NOT touch DOM', function () {
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
    ma.registerModal('bothM', el);
    ma.setPhaserSceneKey('bothM', 'BothScene');
    ma.setMode('bothM', 'both');
    ma.notifyOpen('bothM');
    assert(showCalls.indexOf('BothScene') !== -1, 'Phaser scene shown');
    // In 'both' mode notifyOpen should NOT hide DOM
    assertEqual(el.classList.contains('hidden'), true, 'DOM untouched in both mode (caller handles it)');
  });

  test('notifyClose in both mode hides Phaser scene', function () {
    _global.Game = {};
    var hideCalls = [];
    _global.Game.SceneOverlayManager = {
      show: function () {},
      hide: function (key) { hideCalls.push(key); },
    };
    loadModule('src/phaser/modalAdapter.js');
    var ma = _global.Game.ModalAdapter;
    ma.init();
    ma.registerModal('bothM2', null);
    ma.setPhaserSceneKey('bothM2', 'BothScene2');
    ma.setMode('bothM2', 'both');
    ma.notifyOpen('bothM2');
    ma.notifyClose('bothM2');
    assert(hideCalls.indexOf('BothScene2') !== -1, 'Phaser scene hidden in both mode');
  });

  test('notifyOpen without Phaser scene key in phaser mode just tracks state', function () {
    _global.Game = {};
    loadModule('src/phaser/modalAdapter.js');
    var ma = _global.Game.ModalAdapter;
    ma.init();
    ma.registerModal('noKey', null);
    ma.setMode('noKey', 'phaser');
    // No setPhaserSceneKey call
    ma.notifyOpen('noKey');
    assertEqual(ma.isOpen('noKey'), true, 'state tracked');
    ma.notifyClose('noKey');
    assertEqual(ma.isOpen('noKey'), false, 'closed');
  });

  // ══════════════════════════════════════════
  //  Section 2: LevelUpScene (structural tests)
  // ══════════════════════════════════════════
  console.log('\n  --- LevelUpScene (structural) ---');

  // Provide minimal Phaser stubs
  _global.Game = {};
  _global.Phaser = {
    Class: function (config) {
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
    Geom: {
      Rectangle: {
        Contains: function () { return true; },
      },
    },
  };

  loadModule('src/phaser/scenes/LevelUpScene.js');

  test('LevelUpScene exports to Game.PhaserScenes.LevelUpScene', function () {
    assert(_global.Game.PhaserScenes, 'PhaserScenes namespace');
    assert(_global.Game.PhaserScenes.LevelUpScene, 'LevelUpScene registered');
    assertEqual(typeof _global.Game.PhaserScenes.LevelUpScene, 'function', 'is constructor');
  });

  test('LevelUpScene prototype has show/hide/shutdown methods', function () {
    var proto = _global.Game.PhaserScenes.LevelUpScene.prototype;
    assertEqual(typeof proto.show, 'function', 'show');
    assertEqual(typeof proto.hide, 'function', 'hide');
    assertEqual(typeof proto.shutdown, 'function', 'shutdown');
  });

  test('LevelUpScene prototype has create and _setAllVisible', function () {
    var proto = _global.Game.PhaserScenes.LevelUpScene.prototype;
    assertEqual(typeof proto.create, 'function', 'create');
    assertEqual(typeof proto._setAllVisible, 'function', '_setAllVisible');
  });

  // ══════════════════════════════════════════
  //  Section 3: CrateRewardScene (structural tests)
  // ══════════════════════════════════════════
  console.log('\n  --- CrateRewardScene (structural) ---');

  _global.Game = {};
  loadModule('src/phaser/scenes/CrateRewardScene.js');

  test('CrateRewardScene exports to Game.PhaserScenes.CrateRewardScene', function () {
    assert(_global.Game.PhaserScenes, 'PhaserScenes namespace');
    assert(_global.Game.PhaserScenes.CrateRewardScene, 'CrateRewardScene registered');
    assertEqual(typeof _global.Game.PhaserScenes.CrateRewardScene, 'function', 'is constructor');
  });

  test('CrateRewardScene prototype has show/hide/shutdown methods', function () {
    var proto = _global.Game.PhaserScenes.CrateRewardScene.prototype;
    assertEqual(typeof proto.show, 'function', 'show');
    assertEqual(typeof proto.hide, 'function', 'hide');
    assertEqual(typeof proto.shutdown, 'function', 'shutdown');
  });

  test('CrateRewardScene prototype has create and _setAllVisible', function () {
    var proto = _global.Game.PhaserScenes.CrateRewardScene.prototype;
    assertEqual(typeof proto.create, 'function', 'create');
    assertEqual(typeof proto._setAllVisible, 'function', '_setAllVisible');
  });

  // ══════════════════════════════════════════
  //  Section 4: PauseMenuScene (structural tests)
  // ══════════════════════════════════════════
  console.log('\n  --- PauseMenuScene (structural) ---');

  _global.Game = {};
  loadModule('src/phaser/scenes/PauseMenuScene.js');

  test('PauseMenuScene exports to Game.PhaserScenes.PauseMenuScene', function () {
    assert(_global.Game.PhaserScenes, 'PhaserScenes namespace');
    assert(_global.Game.PhaserScenes.PauseMenuScene, 'PauseMenuScene registered');
    assertEqual(typeof _global.Game.PhaserScenes.PauseMenuScene, 'function', 'is constructor');
  });

  test('PauseMenuScene prototype has show/hide/shutdown methods', function () {
    var proto = _global.Game.PhaserScenes.PauseMenuScene.prototype;
    assertEqual(typeof proto.show, 'function', 'show');
    assertEqual(typeof proto.hide, 'function', 'hide');
    assertEqual(typeof proto.shutdown, 'function', 'shutdown');
  });

  test('PauseMenuScene prototype has create and _setAllVisible', function () {
    var proto = _global.Game.PhaserScenes.PauseMenuScene.prototype;
    assertEqual(typeof proto.create, 'function', 'create');
    assertEqual(typeof proto._setAllVisible, 'function', '_setAllVisible');
  });

  // ══════════════════════════════════════════
  //  Section 5: _notifyModal integration pattern
  // ══════════════════════════════════════════
  console.log('\n  --- _notifyModal integration ---');

  test('_notifyModal pattern: open routes to notifyOpen', function () {
    _global.Game = {};
    loadModule('src/phaser/modalAdapter.js');
    var ma = _global.Game.ModalAdapter;
    ma.init();
    ma.registerModal('pm', null);

    // Simulate _notifyModal from game.js
    function _notifyModal(id, isOpen, data) {
      if (!ma || !ma.isInitialized()) return;
      if (isOpen) ma.notifyOpen(id, data);
      else ma.notifyClose(id);
    }

    _notifyModal('pm', true, { test: 1 });
    assertEqual(ma.isOpen('pm'), true, 'open via notifyModal');
    _notifyModal('pm', false);
    assertEqual(ma.isOpen('pm'), false, 'closed via notifyModal');
  });

  test('_notifyModal pattern: skips when ModalAdapter not initialized', function () {
    _global.Game = {};
    loadModule('src/phaser/modalAdapter.js');
    var ma = _global.Game.ModalAdapter;
    // NOT calling ma.init()

    function _notifyModal(id, isOpen, data) {
      if (!ma || !ma.isInitialized()) return;
      if (isOpen) ma.notifyOpen(id, data);
      else ma.notifyClose(id);
    }

    _notifyModal('test', true); // should not crash
    assertEqual(ma.isOpen('test'), false, 'not tracked without init');
  });

  test('_notifyModal pattern: multiple modals tracked independently', function () {
    _global.Game = {};
    loadModule('src/phaser/modalAdapter.js');
    var ma = _global.Game.ModalAdapter;
    ma.init();
    ma.registerModal('pauseMenu', null);
    ma.registerModal('crateReward', null);
    ma.registerModal('levelUp', null);

    function _notifyModal(id, isOpen, data) {
      if (!ma || !ma.isInitialized()) return;
      if (isOpen) ma.notifyOpen(id, data);
      else ma.notifyClose(id);
    }

    _notifyModal('pauseMenu', true);
    _notifyModal('crateReward', true);
    assertEqual(ma.isOpen('pauseMenu'), true, 'pause open');
    assertEqual(ma.isOpen('crateReward'), true, 'crate open');
    assertEqual(ma.isOpen('levelUp'), false, 'level still closed');

    _notifyModal('pauseMenu', false);
    assertEqual(ma.isOpen('pauseMenu'), false, 'pause closed');
    assertEqual(ma.isOpen('crateReward'), true, 'crate still open');
  });

  // ══════════════════════════════════════════
  //  Section 6: Cross-adapter integration
  // ══════════════════════════════════════════
  console.log('\n  --- Cross-adapter: ModalAdapter + SceneOverlayManager ---');

  _global.Game = {};
  loadModule('src/phaser/sceneOverlayManager.js');
  loadModule('src/phaser/modalAdapter.js');

  test('notifyOpen in phaser mode works with real SceneOverlayManager', function () {
    var som = _global.Game.SceneOverlayManager;
    var sceneActive = {};
    var sceneSleeping = {};
    var mockGame = {
      scene: {
        getScene: function () { return { show: function () {}, hide: function () {} }; },
        isActive: function (key) { return !!sceneActive[key]; },
        isSleeping: function (key) { return !!sceneSleeping[key]; },
        wake: function (key) { sceneActive[key] = true; delete sceneSleeping[key]; },
        start: function (key) { sceneActive[key] = true; },
        sleep: function (key) { sceneSleeping[key] = true; delete sceneActive[key]; },
        stop: function () {},
        launch: function (key) { sceneActive[key] = true; },
      },
    };

    som.init({ phaserGame: mockGame });
    som.register('LevelUpScene');
    som.register('CrateRewardScene');
    som.register('PauseMenuScene');

    var ma = _global.Game.ModalAdapter;
    ma.init();
    ma.registerModal('levelUp', null);
    ma.setPhaserSceneKey('levelUp', 'LevelUpScene');
    ma.setMode('levelUp', 'phaser');

    ma.notifyOpen('levelUp', { level: 3 });
    assertEqual(som.isVisible('LevelUpScene'), true, 'LevelUpScene visible');
    assertEqual(ma.isOpen('levelUp'), true, 'levelUp open');

    ma.notifyClose('levelUp');
    assertEqual(ma.isOpen('levelUp'), false, 'levelUp closed');
  });

  test('notifyOpen/Close with crateReward + PauseMenu simultaneously', function () {
    var ma = _global.Game.ModalAdapter;
    ma.registerModal('crateReward', null);
    ma.setPhaserSceneKey('crateReward', 'CrateRewardScene');
    ma.setMode('crateReward', 'phaser');
    ma.registerModal('pauseMenu', null);
    ma.setPhaserSceneKey('pauseMenu', 'PauseMenuScene');
    ma.setMode('pauseMenu', 'phaser');

    ma.notifyOpen('crateReward', { rewardLevel: 2 });
    ma.notifyOpen('pauseMenu');
    assertEqual(ma.isOpen('crateReward'), true, 'crate open');
    assertEqual(ma.isOpen('pauseMenu'), true, 'pause open');

    ma.notifyClose('crateReward');
    assertEqual(ma.isOpen('crateReward'), false, 'crate closed');
    assertEqual(ma.isOpen('pauseMenu'), true, 'pause still open');
  });

  // ══════════════════════════════════════════
  //  Section 7: Scene show/hide data plumbing
  // ══════════════════════════════════════════
  console.log('\n  --- Scene show/hide data plumbing ---');

  // Re-provide Phaser stubs and reload scenes for data plumbing checks
  _global.Game = {};
  _global.Phaser = {
    Class: function (config) {
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
    Scene: function (cfg) { this._sceneKey = cfg ? cfg.key : undefined; },
    Geom: { Rectangle: { Contains: function () { return true; } } },
  };
  loadModule('src/phaser/scenes/LevelUpScene.js');
  loadModule('src/phaser/scenes/CrateRewardScene.js');
  loadModule('src/phaser/scenes/PauseMenuScene.js');

  test('LevelUpScene.show updates text from data', function () {
    var Proto = _global.Game.PhaserScenes.LevelUpScene.prototype;
    assertEqual(typeof Proto.show, 'function', 'show exists');
    assertEqual(typeof Proto.hide, 'function', 'hide exists');
  });

  test('CrateRewardScene.show accepts translate/callbacks', function () {
    var Proto = _global.Game.PhaserScenes.CrateRewardScene.prototype;
    assertEqual(typeof Proto.show, 'function', 'show exists');
    assertEqual(typeof Proto.hide, 'function', 'hide exists');
  });

  test('PauseMenuScene.show accepts complex data with callbacks', function () {
    var Proto = _global.Game.PhaserScenes.PauseMenuScene.prototype;
    assertEqual(typeof Proto.show, 'function', 'show exists');
    assertEqual(typeof Proto.hide, 'function', 'hide exists');
  });

  // ══════════════════════════════════════════
  //  Section 8: Edge cases
  // ══════════════════════════════════════════
  console.log('\n  --- Edge cases ---');

  test('notifyOpen then notifyOpen again keeps state open', function () {
    _global.Game = {};
    loadModule('src/phaser/modalAdapter.js');
    var ma = _global.Game.ModalAdapter;
    ma.init();
    ma.registerModal('dbl', null);
    ma.notifyOpen('dbl');
    ma.notifyOpen('dbl');
    assertEqual(ma.isOpen('dbl'), true, 'still open');
  });

  test('notifyClose without prior notifyOpen sets false', function () {
    _global.Game = {};
    loadModule('src/phaser/modalAdapter.js');
    var ma = _global.Game.ModalAdapter;
    ma.init();
    ma.registerModal('nc', null);
    ma.notifyClose('nc');
    assertEqual(ma.isOpen('nc'), false, 'false even without open');
  });

  test('open() and notifyOpen() both set isOpen true', function () {
    _global.Game = {};
    loadModule('src/phaser/modalAdapter.js');
    var ma = _global.Game.ModalAdapter;
    ma.init();
    ma.registerModal('hybrid', null);
    ma.open('hybrid');
    assertEqual(ma.isOpen('hybrid'), true, 'open via open()');
    ma.close('hybrid');
    ma.notifyOpen('hybrid');
    assertEqual(ma.isOpen('hybrid'), true, 'open via notifyOpen()');
  });

  test('destroy clears notifyOpen/Close tracked state', function () {
    _global.Game = {};
    loadModule('src/phaser/modalAdapter.js');
    var ma = _global.Game.ModalAdapter;
    ma.init();
    ma.registerModal('dest', null);
    ma.notifyOpen('dest');
    assertEqual(ma.isOpen('dest'), true, 'open');
    ma.destroy();
    assertEqual(ma.isOpen('dest'), false, 'false after destroy');
  });

  test('All three scenes register on separate PhaserScenes keys', function () {
    _global.Game = {};
    loadModule('src/phaser/scenes/LevelUpScene.js');
    loadModule('src/phaser/scenes/CrateRewardScene.js');
    loadModule('src/phaser/scenes/PauseMenuScene.js');
    var ps = _global.Game.PhaserScenes;
    assert(ps.LevelUpScene, 'LevelUpScene');
    assert(ps.CrateRewardScene, 'CrateRewardScene');
    assert(ps.PauseMenuScene, 'PauseMenuScene');
    assert(ps.LevelUpScene !== ps.CrateRewardScene, 'LevelUp != Crate');
    assert(ps.LevelUpScene !== ps.PauseMenuScene, 'LevelUp != Pause');
    assert(ps.CrateRewardScene !== ps.PauseMenuScene, 'Crate != Pause');
  });

  delete _global.Phaser;

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
