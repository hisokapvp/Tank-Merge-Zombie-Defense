/**
 * Pack 10i: Phaser Migration — Phase 3c Progression/Meta + Achievement Scenes Tests
 *
 * Tests for:
 * - BigMenuScene (structural tests — scene key, show/hide, subview methods)
 * - AchievementsScene (structural tests — scene key, show/hide, card list)
 * - AchievementPopupScene (structural tests — scene key, show/hide, callbacks)
 * - _notifyModal integration for bigMenu and achievementPopup
 * - Cross-adapter integration (ModalAdapter + SceneOverlayManager for new scenes)
 *
 * Run: node Test/pack10/phaser_migration_phase3c.test.js
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

  console.log('\n\u2500\u2500 Pack 10i: Phaser Migration Phase 3c \u2014 Progression/Meta + Achievement Scenes \u2500\u2500');

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

  // ── Phaser stubs ──
  function setupPhaserStubs() {
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
  }

  // ══════════════════════════════════════════
  //  Section 1: BigMenuScene (structural tests)
  // ══════════════════════════════════════════
  console.log('\n  --- BigMenuScene (structural) ---');

  _global.Game = {};
  setupPhaserStubs();
  loadModule('src/phaser/scenes/BigMenuScene.js');

  test('BigMenuScene exports to Game.PhaserScenes.BigMenuScene', function () {
    assert(_global.Game.PhaserScenes, 'PhaserScenes namespace');
    assert(_global.Game.PhaserScenes.BigMenuScene, 'BigMenuScene registered');
    assertEqual(typeof _global.Game.PhaserScenes.BigMenuScene, 'function', 'is constructor');
  });

  test('BigMenuScene prototype has show/hide/shutdown methods', function () {
    var proto = _global.Game.PhaserScenes.BigMenuScene.prototype;
    assertEqual(typeof proto.show, 'function', 'show');
    assertEqual(typeof proto.hide, 'function', 'hide');
    assertEqual(typeof proto.shutdown, 'function', 'shutdown');
  });

  test('BigMenuScene prototype has create and _setAllVisible', function () {
    var proto = _global.Game.PhaserScenes.BigMenuScene.prototype;
    assertEqual(typeof proto.create, 'function', 'create');
    assertEqual(typeof proto._setAllVisible, 'function', '_setAllVisible');
  });

  // ══════════════════════════════════════════
  //  Section 2: AchievementsScene (structural tests)
  // ══════════════════════════════════════════
  console.log('\n  --- AchievementsScene (structural) ---');

  _global.Game = {};
  setupPhaserStubs();
  loadModule('src/phaser/scenes/AchievementsScene.js');

  test('AchievementsScene exports to Game.PhaserScenes.AchievementsScene', function () {
    assert(_global.Game.PhaserScenes, 'PhaserScenes namespace');
    assert(_global.Game.PhaserScenes.AchievementsScene, 'AchievementsScene registered');
    assertEqual(typeof _global.Game.PhaserScenes.AchievementsScene, 'function', 'is constructor');
  });

  test('AchievementsScene prototype has show/hide/shutdown methods', function () {
    var proto = _global.Game.PhaserScenes.AchievementsScene.prototype;
    assertEqual(typeof proto.show, 'function', 'show');
    assertEqual(typeof proto.hide, 'function', 'hide');
    assertEqual(typeof proto.shutdown, 'function', 'shutdown');
  });

  test('AchievementsScene prototype has create and _setAllVisible', function () {
    var proto = _global.Game.PhaserScenes.AchievementsScene.prototype;
    assertEqual(typeof proto.create, 'function', 'create');
    assertEqual(typeof proto._setAllVisible, 'function', '_setAllVisible');
  });

  // ══════════════════════════════════════════
  //  Section 3: AchievementPopupScene (structural tests)
  // ══════════════════════════════════════════
  console.log('\n  --- AchievementPopupScene (structural) ---');

  _global.Game = {};
  setupPhaserStubs();
  loadModule('src/phaser/scenes/AchievementPopupScene.js');

  test('AchievementPopupScene exports to Game.PhaserScenes.AchievementPopupScene', function () {
    assert(_global.Game.PhaserScenes, 'PhaserScenes namespace');
    assert(_global.Game.PhaserScenes.AchievementPopupScene, 'AchievementPopupScene registered');
    assertEqual(typeof _global.Game.PhaserScenes.AchievementPopupScene, 'function', 'is constructor');
  });

  test('AchievementPopupScene prototype has show/hide/shutdown methods', function () {
    var proto = _global.Game.PhaserScenes.AchievementPopupScene.prototype;
    assertEqual(typeof proto.show, 'function', 'show');
    assertEqual(typeof proto.hide, 'function', 'hide');
    assertEqual(typeof proto.shutdown, 'function', 'shutdown');
  });

  test('AchievementPopupScene prototype has create and _setAllVisible', function () {
    var proto = _global.Game.PhaserScenes.AchievementPopupScene.prototype;
    assertEqual(typeof proto.create, 'function', 'create');
    assertEqual(typeof proto._setAllVisible, 'function', '_setAllVisible');
  });

  // ══════════════════════════════════════════
  //  Section 4: All six scenes coexist on PhaserScenes namespace
  // ══════════════════════════════════════════
  console.log('\n  --- All six scenes coexist ---');

  _global.Game = {};
  setupPhaserStubs();
  loadModule('src/phaser/scenes/LevelUpScene.js');
  loadModule('src/phaser/scenes/CrateRewardScene.js');
  loadModule('src/phaser/scenes/PauseMenuScene.js');
  loadModule('src/phaser/scenes/BigMenuScene.js');
  loadModule('src/phaser/scenes/AchievementsScene.js');
  loadModule('src/phaser/scenes/AchievementPopupScene.js');

  test('All six scenes register on separate PhaserScenes keys', function () {
    var ps = _global.Game.PhaserScenes;
    assert(ps.LevelUpScene, 'LevelUpScene');
    assert(ps.CrateRewardScene, 'CrateRewardScene');
    assert(ps.PauseMenuScene, 'PauseMenuScene');
    assert(ps.BigMenuScene, 'BigMenuScene');
    assert(ps.AchievementsScene, 'AchievementsScene');
    assert(ps.AchievementPopupScene, 'AchievementPopupScene');
  });

  test('No two scenes share same constructor', function () {
    var ps = _global.Game.PhaserScenes;
    var keys = ['LevelUpScene', 'CrateRewardScene', 'PauseMenuScene', 'BigMenuScene', 'AchievementsScene', 'AchievementPopupScene'];
    for (var i = 0; i < keys.length; i++) {
      for (var j = i + 1; j < keys.length; j++) {
        assert(ps[keys[i]] !== ps[keys[j]], keys[i] + ' !== ' + keys[j]);
      }
    }
  });

  // ══════════════════════════════════════════
  //  Section 5: _notifyModal integration for new modals
  // ══════════════════════════════════════════
  console.log('\n  --- _notifyModal integration for new modals ---');

  _global.Game = {};
  loadModule('src/phaser/modalAdapter.js');

  test('_notifyModal pattern: bigMenu open/close', function () {
    var ma = _global.Game.ModalAdapter;
    ma.init();
    ma.registerModal('bigMenu', null);

    function _notifyModal(id, isOpen, data) {
      if (!ma || !ma.isInitialized()) return;
      if (isOpen) ma.notifyOpen(id, data);
      else ma.notifyClose(id);
    }

    _notifyModal('bigMenu', true);
    assertEqual(ma.isOpen('bigMenu'), true, 'bigMenu open');
    _notifyModal('bigMenu', false);
    assertEqual(ma.isOpen('bigMenu'), false, 'bigMenu closed');
  });

  test('_notifyModal pattern: achievementPopup open with data', function () {
    _global.Game = {};
    loadModule('src/phaser/modalAdapter.js');
    var ma = _global.Game.ModalAdapter;
    ma.init();
    ma.registerModal('achievementPopup', null);

    var lastData = null;
    var origNotifyOpen = ma.notifyOpen.bind(ma);
    // Track data passed through
    function _notifyModal(id, isOpen, data) {
      if (!ma || !ma.isInitialized()) return;
      if (isOpen) { lastData = data; ma.notifyOpen(id, data); }
      else ma.notifyClose(id);
    }

    _notifyModal('achievementPopup', true, { name: 'Test Ach', condition: 'Kill 10', reward: '+1 talent' });
    assertEqual(ma.isOpen('achievementPopup'), true, 'popup open');
    assertEqual(lastData.name, 'Test Ach', 'name passed through');
    assertEqual(lastData.condition, 'Kill 10', 'condition passed through');
    assertEqual(lastData.reward, '+1 talent', 'reward passed through');

    _notifyModal('achievementPopup', false);
    assertEqual(ma.isOpen('achievementPopup'), false, 'popup closed');
  });

  test('_notifyModal: all six modals tracked independently', function () {
    _global.Game = {};
    loadModule('src/phaser/modalAdapter.js');
    var ma = _global.Game.ModalAdapter;
    ma.init();

    var ids = ['pauseMenu', 'crateReward', 'levelUp', 'bigMenu', 'achievements', 'achievementPopup'];
    ids.forEach(function (id) { ma.registerModal(id, null); });

    function _notifyModal(id, isOpen, data) {
      if (!ma || !ma.isInitialized()) return;
      if (isOpen) ma.notifyOpen(id, data);
      else ma.notifyClose(id);
    }

    _notifyModal('bigMenu', true);
    _notifyModal('achievementPopup', true);
    _notifyModal('pauseMenu', true);

    assertEqual(ma.isOpen('bigMenu'), true, 'bigMenu open');
    assertEqual(ma.isOpen('achievementPopup'), true, 'achievementPopup open');
    assertEqual(ma.isOpen('pauseMenu'), true, 'pauseMenu open');
    assertEqual(ma.isOpen('crateReward'), false, 'crateReward still closed');
    assertEqual(ma.isOpen('levelUp'), false, 'levelUp still closed');
    assertEqual(ma.isOpen('achievements'), false, 'achievements still closed');

    _notifyModal('bigMenu', false);
    assertEqual(ma.isOpen('bigMenu'), false, 'bigMenu closed');
    assertEqual(ma.isOpen('achievementPopup'), true, 'achievementPopup still open');
  });

  // ══════════════════════════════════════════
  //  Section 6: Cross-adapter integration for new scenes
  // ══════════════════════════════════════════
  console.log('\n  --- Cross-adapter: ModalAdapter + SceneOverlayManager for new scenes ---');

  _global.Game = {};
  loadModule('src/phaser/sceneOverlayManager.js');
  loadModule('src/phaser/modalAdapter.js');

  test('notifyOpen routes BigMenuScene through SceneOverlayManager', function () {
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
    som.register('BigMenuScene');
    som.register('AchievementsScene');
    som.register('AchievementPopupScene');

    var ma = _global.Game.ModalAdapter;
    ma.init();

    ma.registerModal('bigMenu', null);
    ma.setPhaserSceneKey('bigMenu', 'BigMenuScene');
    ma.setMode('bigMenu', 'phaser');

    ma.notifyOpen('bigMenu');
    assertEqual(som.isVisible('BigMenuScene'), true, 'BigMenuScene visible');
    assertEqual(ma.isOpen('bigMenu'), true, 'bigMenu open');

    ma.notifyClose('bigMenu');
    assertEqual(ma.isOpen('bigMenu'), false, 'bigMenu closed');
  });

  test('notifyOpen routes AchievementsScene through SceneOverlayManager', function () {
    var ma = _global.Game.ModalAdapter;
    ma.registerModal('achievements', null);
    ma.setPhaserSceneKey('achievements', 'AchievementsScene');
    ma.setMode('achievements', 'phaser');

    ma.notifyOpen('achievements');
    var som = _global.Game.SceneOverlayManager;
    assertEqual(som.isVisible('AchievementsScene'), true, 'AchievementsScene visible');
    assertEqual(ma.isOpen('achievements'), true, 'achievements open');

    ma.notifyClose('achievements');
    assertEqual(ma.isOpen('achievements'), false, 'achievements closed');
  });

  test('notifyOpen routes AchievementPopupScene through SceneOverlayManager', function () {
    var ma = _global.Game.ModalAdapter;
    ma.registerModal('achievementPopup', null);
    ma.setPhaserSceneKey('achievementPopup', 'AchievementPopupScene');
    ma.setMode('achievementPopup', 'phaser');

    ma.notifyOpen('achievementPopup', { name: 'Hero', condition: 'Survive 10 waves', reward: 'Talent point' });
    var som = _global.Game.SceneOverlayManager;
    assertEqual(som.isVisible('AchievementPopupScene'), true, 'AchievementPopupScene visible');
    assertEqual(ma.isOpen('achievementPopup'), true, 'achievementPopup open');

    ma.notifyClose('achievementPopup');
    assertEqual(ma.isOpen('achievementPopup'), false, 'achievementPopup closed');
  });

  test('Multiple new scenes open simultaneously', function () {
    var ma = _global.Game.ModalAdapter;
    var som = _global.Game.SceneOverlayManager;

    ma.notifyOpen('bigMenu');
    ma.notifyOpen('achievementPopup', { name: 'A' });

    assertEqual(ma.isOpen('bigMenu'), true, 'bigMenu open');
    assertEqual(ma.isOpen('achievementPopup'), true, 'popup open');
    assertEqual(som.isVisible('BigMenuScene'), true, 'BigMenuScene visible');
    assertEqual(som.isVisible('AchievementPopupScene'), true, 'AchievementPopupScene visible');

    ma.notifyClose('achievementPopup');
    assertEqual(ma.isOpen('bigMenu'), true, 'bigMenu still open');
    assertEqual(ma.isOpen('achievementPopup'), false, 'popup closed');

    ma.notifyClose('bigMenu');
    assertEqual(ma.isOpen('bigMenu'), false, 'bigMenu closed');
  });

  // ══════════════════════════════════════════
  //  Section 7: Edge cases for new scenes
  // ══════════════════════════════════════════
  console.log('\n  --- Edge cases ---');

  test('BigMenuScene double-open keeps state open', function () {
    _global.Game = {};
    loadModule('src/phaser/modalAdapter.js');
    var ma = _global.Game.ModalAdapter;
    ma.init();
    ma.registerModal('bigMenu', null);
    ma.notifyOpen('bigMenu');
    ma.notifyOpen('bigMenu');
    assertEqual(ma.isOpen('bigMenu'), true, 'still open');
  });

  test('AchievementPopup close without prior open sets false', function () {
    _global.Game = {};
    loadModule('src/phaser/modalAdapter.js');
    var ma = _global.Game.ModalAdapter;
    ma.init();
    ma.registerModal('achievementPopup', null);
    ma.notifyClose('achievementPopup');
    assertEqual(ma.isOpen('achievementPopup'), false, 'false without open');
  });

  test('Destroy clears all new modal states', function () {
    _global.Game = {};
    loadModule('src/phaser/modalAdapter.js');
    var ma = _global.Game.ModalAdapter;
    ma.init();
    ma.registerModal('bigMenu', null);
    ma.registerModal('achievementPopup', null);
    ma.notifyOpen('bigMenu');
    ma.notifyOpen('achievementPopup');
    assertEqual(ma.isOpen('bigMenu'), true, 'bigMenu open');
    assertEqual(ma.isOpen('achievementPopup'), true, 'popup open');
    ma.destroy();
    assertEqual(ma.isOpen('bigMenu'), false, 'bigMenu cleared');
    assertEqual(ma.isOpen('achievementPopup'), false, 'popup cleared');
  });

  test('notifyOpen in both mode for BigMenu launches Phaser and does NOT touch DOM', function () {
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
    ma.registerModal('bigMenu', el);
    ma.setPhaserSceneKey('bigMenu', 'BigMenuScene');
    ma.setMode('bigMenu', 'both');
    ma.notifyOpen('bigMenu');
    assert(showCalls.indexOf('BigMenuScene') !== -1, 'Phaser scene shown');
    assertEqual(el.classList.contains('hidden'), true, 'DOM untouched in both mode');
  });

  test('notifyOpen in phaser mode for AchievementPopup hides DOM', function () {
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
    ma.registerModal('achievementPopup', el);
    ma.setPhaserSceneKey('achievementPopup', 'AchievementPopupScene');
    ma.setMode('achievementPopup', 'phaser');
    ma.notifyOpen('achievementPopup');
    assertEqual(el.classList.contains('hidden'), true, 'DOM hidden in phaser mode');
    assertEqual(el.getAttribute('aria-hidden'), 'true', 'aria-hidden=true');
    assertEqual(ma.isOpen('achievementPopup'), true, 'state tracked');
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
