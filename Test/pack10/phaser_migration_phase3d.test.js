/**
 * Pack 10j: Phaser Migration — Phase 3d Talents, Supercomputer Root, Help, Tutorial Overlay Tests
 *
 * Tests for:
 * - TalentsScene (structural — scene key, show/hide, internal methods)
 * - SupercomputerRootScene (structural — scene key, show/hide, tiles)
 * - HelpScene (structural — scene key, show/hide, accordion methods)
 * - TutorialOverlayScene (structural — scene key, show/hide, update loop)
 * - _notifyModal integration for talents and supercomputerRoot
 * - Cross-adapter integration (ModalAdapter + SceneOverlayManager for Phase 3d scenes)
 * - All ten scenes coexist on PhaserScenes namespace
 *
 * Run: node Test/pack10/phaser_migration_phase3d.test.js
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

  console.log('\n\u2500\u2500 Pack 10j: Phaser Migration Phase 3d \u2014 Talents, SC Root, Help, Tutorial \u2500\u2500');

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
  //  Section 1: TalentsScene (structural tests)
  // ══════════════════════════════════════════
  console.log('\n  --- TalentsScene (structural) ---');

  _global.Game = {};
  setupPhaserStubs();
  loadModule('src/phaser/scenes/TalentsScene.js');

  test('TalentsScene exports to Game.PhaserScenes.TalentsScene', function () {
    assert(_global.Game.PhaserScenes, 'PhaserScenes namespace');
    assert(_global.Game.PhaserScenes.TalentsScene, 'TalentsScene registered');
    assertEqual(typeof _global.Game.PhaserScenes.TalentsScene, 'function', 'is constructor');
  });

  test('TalentsScene also exports to Game.TalentsScene', function () {
    assert(_global.Game.TalentsScene, 'Game.TalentsScene');
    assertEqual(_global.Game.TalentsScene, _global.Game.PhaserScenes.TalentsScene, 'same constructor');
  });

  test('TalentsScene prototype has show/hide/shutdown methods', function () {
    var proto = _global.Game.PhaserScenes.TalentsScene.prototype;
    assertEqual(typeof proto.show, 'function', 'show');
    assertEqual(typeof proto.hide, 'function', 'hide');
    assertEqual(typeof proto.shutdown, 'function', 'shutdown');
  });

  test('TalentsScene prototype has create and _setAllVisible', function () {
    var proto = _global.Game.PhaserScenes.TalentsScene.prototype;
    assertEqual(typeof proto.create, 'function', 'create');
    assertEqual(typeof proto._setAllVisible, 'function', '_setAllVisible');
  });

  test('TalentsScene prototype has _buildBranches and _refreshState', function () {
    var proto = _global.Game.PhaserScenes.TalentsScene.prototype;
    assertEqual(typeof proto._buildBranches, 'function', '_buildBranches');
    assertEqual(typeof proto._refreshState, 'function', '_refreshState');
  });

  // ══════════════════════════════════════════
  //  Section 2: SupercomputerRootScene (structural tests)
  // ══════════════════════════════════════════
  console.log('\n  --- SupercomputerRootScene (structural) ---');

  _global.Game = {};
  setupPhaserStubs();
  loadModule('src/phaser/scenes/SupercomputerRootScene.js');

  test('SupercomputerRootScene exports to Game.PhaserScenes.SupercomputerRootScene', function () {
    assert(_global.Game.PhaserScenes, 'PhaserScenes namespace');
    assert(_global.Game.PhaserScenes.SupercomputerRootScene, 'SupercomputerRootScene registered');
    assertEqual(typeof _global.Game.PhaserScenes.SupercomputerRootScene, 'function', 'is constructor');
  });

  test('SupercomputerRootScene also exports to Game.SupercomputerRootScene', function () {
    assert(_global.Game.SupercomputerRootScene, 'Game.SupercomputerRootScene');
    assertEqual(_global.Game.SupercomputerRootScene, _global.Game.PhaserScenes.SupercomputerRootScene, 'same constructor');
  });

  test('SupercomputerRootScene prototype has show/hide/shutdown methods', function () {
    var proto = _global.Game.PhaserScenes.SupercomputerRootScene.prototype;
    assertEqual(typeof proto.show, 'function', 'show');
    assertEqual(typeof proto.hide, 'function', 'hide');
    assertEqual(typeof proto.shutdown, 'function', 'shutdown');
  });

  test('SupercomputerRootScene prototype has create and _setAllVisible', function () {
    var proto = _global.Game.PhaserScenes.SupercomputerRootScene.prototype;
    assertEqual(typeof proto.create, 'function', 'create');
    assertEqual(typeof proto._setAllVisible, 'function', '_setAllVisible');
  });

  // ══════════════════════════════════════════
  //  Section 3: HelpScene (structural tests)
  // ══════════════════════════════════════════
  console.log('\n  --- HelpScene (structural) ---');

  _global.Game = {};
  setupPhaserStubs();
  loadModule('src/phaser/scenes/HelpScene.js');

  test('HelpScene exports to Game.PhaserScenes.HelpScene', function () {
    assert(_global.Game.PhaserScenes, 'PhaserScenes namespace');
    assert(_global.Game.PhaserScenes.HelpScene, 'HelpScene registered');
    assertEqual(typeof _global.Game.PhaserScenes.HelpScene, 'function', 'is constructor');
  });

  test('HelpScene also exports to Game.HelpScene', function () {
    assert(_global.Game.HelpScene, 'Game.HelpScene');
    assertEqual(_global.Game.HelpScene, _global.Game.PhaserScenes.HelpScene, 'same constructor');
  });

  test('HelpScene prototype has show/hide/shutdown methods', function () {
    var proto = _global.Game.PhaserScenes.HelpScene.prototype;
    assertEqual(typeof proto.show, 'function', 'show');
    assertEqual(typeof proto.hide, 'function', 'hide');
    assertEqual(typeof proto.shutdown, 'function', 'shutdown');
  });

  test('HelpScene prototype has create and _setAllVisible', function () {
    var proto = _global.Game.PhaserScenes.HelpScene.prototype;
    assertEqual(typeof proto.create, 'function', 'create');
    assertEqual(typeof proto._setAllVisible, 'function', '_setAllVisible');
  });

  test('HelpScene prototype has _toggleSection and _refreshLayout', function () {
    var proto = _global.Game.PhaserScenes.HelpScene.prototype;
    assertEqual(typeof proto._toggleSection, 'function', '_toggleSection');
    assertEqual(typeof proto._refreshLayout, 'function', '_refreshLayout');
  });

  // ══════════════════════════════════════════
  //  Section 4: TutorialOverlayScene (structural tests)
  // ══════════════════════════════════════════
  console.log('\n  --- TutorialOverlayScene (structural) ---');

  _global.Game = {};
  setupPhaserStubs();
  loadModule('src/phaser/scenes/TutorialOverlayScene.js');

  test('TutorialOverlayScene exports to Game.PhaserScenes.TutorialOverlayScene', function () {
    assert(_global.Game.PhaserScenes, 'PhaserScenes namespace');
    assert(_global.Game.PhaserScenes.TutorialOverlayScene, 'TutorialOverlayScene registered');
    assertEqual(typeof _global.Game.PhaserScenes.TutorialOverlayScene, 'function', 'is constructor');
  });

  test('TutorialOverlayScene also exports to Game.TutorialOverlayScene', function () {
    assert(_global.Game.TutorialOverlayScene, 'Game.TutorialOverlayScene');
    assertEqual(_global.Game.TutorialOverlayScene, _global.Game.PhaserScenes.TutorialOverlayScene, 'same constructor');
  });

  test('TutorialOverlayScene prototype has show/hide/shutdown methods', function () {
    var proto = _global.Game.PhaserScenes.TutorialOverlayScene.prototype;
    assertEqual(typeof proto.show, 'function', 'show');
    assertEqual(typeof proto.hide, 'function', 'hide');
    assertEqual(typeof proto.shutdown, 'function', 'shutdown');
  });

  test('TutorialOverlayScene prototype has create, update and _setAllVisible', function () {
    var proto = _global.Game.PhaserScenes.TutorialOverlayScene.prototype;
    assertEqual(typeof proto.create, 'function', 'create');
    assertEqual(typeof proto.update, 'function', 'update');
    assertEqual(typeof proto._setAllVisible, 'function', '_setAllVisible');
  });

  // ══════════════════════════════════════════
  //  Section 5: All ten scenes coexist on PhaserScenes namespace
  // ══════════════════════════════════════════
  console.log('\n  --- All ten scenes coexist ---');

  _global.Game = {};
  setupPhaserStubs();
  loadModule('src/phaser/scenes/LevelUpScene.js');
  loadModule('src/phaser/scenes/CrateRewardScene.js');
  loadModule('src/phaser/scenes/PauseMenuScene.js');
  loadModule('src/phaser/scenes/BigMenuScene.js');
  loadModule('src/phaser/scenes/AchievementsScene.js');
  loadModule('src/phaser/scenes/AchievementPopupScene.js');
  loadModule('src/phaser/scenes/TalentsScene.js');
  loadModule('src/phaser/scenes/SupercomputerRootScene.js');
  loadModule('src/phaser/scenes/HelpScene.js');
  loadModule('src/phaser/scenes/TutorialOverlayScene.js');

  test('All ten scenes register on separate PhaserScenes keys', function () {
    var ps = _global.Game.PhaserScenes;
    assert(ps.LevelUpScene, 'LevelUpScene');
    assert(ps.CrateRewardScene, 'CrateRewardScene');
    assert(ps.PauseMenuScene, 'PauseMenuScene');
    assert(ps.BigMenuScene, 'BigMenuScene');
    assert(ps.AchievementsScene, 'AchievementsScene');
    assert(ps.AchievementPopupScene, 'AchievementPopupScene');
    assert(ps.TalentsScene, 'TalentsScene');
    assert(ps.SupercomputerRootScene, 'SupercomputerRootScene');
    assert(ps.HelpScene, 'HelpScene');
    assert(ps.TutorialOverlayScene, 'TutorialOverlayScene');
  });

  test('No two scenes share same constructor', function () {
    var ps = _global.Game.PhaserScenes;
    var keys = [
      'LevelUpScene', 'CrateRewardScene', 'PauseMenuScene',
      'BigMenuScene', 'AchievementsScene', 'AchievementPopupScene',
      'TalentsScene', 'SupercomputerRootScene', 'HelpScene', 'TutorialOverlayScene',
    ];
    for (var i = 0; i < keys.length; i++) {
      for (var j = i + 1; j < keys.length; j++) {
        assert(ps[keys[i]] !== ps[keys[j]], keys[i] + ' !== ' + keys[j]);
      }
    }
  });

  // ══════════════════════════════════════════
  //  Section 6: _notifyModal integration for Phase 3d modals
  // ══════════════════════════════════════════
  console.log('\n  --- _notifyModal integration for Phase 3d modals ---');

  _global.Game = {};
  loadModule('src/phaser/modalAdapter.js');

  test('_notifyModal pattern: talents open/close', function () {
    var ma = _global.Game.ModalAdapter;
    ma.init();
    ma.registerModal('talents', null);

    function _notifyModal(id, isOpen, data) {
      if (!ma || !ma.isInitialized()) return;
      if (isOpen) ma.notifyOpen(id, data);
      else ma.notifyClose(id);
    }

    _notifyModal('talents', true);
    assertEqual(ma.isOpen('talents'), true, 'talents open');
    _notifyModal('talents', false);
    assertEqual(ma.isOpen('talents'), false, 'talents closed');
  });

  test('_notifyModal pattern: supercomputerRoot open/close', function () {
    _global.Game = {};
    loadModule('src/phaser/modalAdapter.js');
    var ma = _global.Game.ModalAdapter;
    ma.init();
    ma.registerModal('supercomputerRoot', null);

    function _notifyModal(id, isOpen, data) {
      if (!ma || !ma.isInitialized()) return;
      if (isOpen) ma.notifyOpen(id, data);
      else ma.notifyClose(id);
    }

    _notifyModal('supercomputerRoot', true);
    assertEqual(ma.isOpen('supercomputerRoot'), true, 'supercomputerRoot open');
    _notifyModal('supercomputerRoot', false);
    assertEqual(ma.isOpen('supercomputerRoot'), false, 'supercomputerRoot closed');
  });

  test('_notifyModal pattern: help open/close', function () {
    _global.Game = {};
    loadModule('src/phaser/modalAdapter.js');
    var ma = _global.Game.ModalAdapter;
    ma.init();
    ma.registerModal('help', null);

    function _notifyModal(id, isOpen, data) {
      if (!ma || !ma.isInitialized()) return;
      if (isOpen) ma.notifyOpen(id, data);
      else ma.notifyClose(id);
    }

    _notifyModal('help', true);
    assertEqual(ma.isOpen('help'), true, 'help open');
    _notifyModal('help', false);
    assertEqual(ma.isOpen('help'), false, 'help closed');
  });

  test('_notifyModal pattern: tutorialOverlay open/close', function () {
    _global.Game = {};
    loadModule('src/phaser/modalAdapter.js');
    var ma = _global.Game.ModalAdapter;
    ma.init();
    ma.registerModal('tutorialOverlay', null);

    function _notifyModal(id, isOpen, data) {
      if (!ma || !ma.isInitialized()) return;
      if (isOpen) ma.notifyOpen(id, data);
      else ma.notifyClose(id);
    }

    _notifyModal('tutorialOverlay', true);
    assertEqual(ma.isOpen('tutorialOverlay'), true, 'tutorialOverlay open');
    _notifyModal('tutorialOverlay', false);
    assertEqual(ma.isOpen('tutorialOverlay'), false, 'tutorialOverlay closed');
  });

  test('_notifyModal: all ten modals tracked independently', function () {
    _global.Game = {};
    loadModule('src/phaser/modalAdapter.js');
    var ma = _global.Game.ModalAdapter;
    ma.init();

    var ids = [
      'pauseMenu', 'crateReward', 'levelUp', 'bigMenu',
      'achievements', 'achievementPopup',
      'talents', 'supercomputerRoot', 'help', 'tutorialOverlay',
    ];
    ids.forEach(function (id) { ma.registerModal(id, null); });

    function _notifyModal(id, isOpen, data) {
      if (!ma || !ma.isInitialized()) return;
      if (isOpen) ma.notifyOpen(id, data);
      else ma.notifyClose(id);
    }

    _notifyModal('talents', true);
    _notifyModal('supercomputerRoot', true);
    _notifyModal('help', true);
    _notifyModal('bigMenu', true);

    assertEqual(ma.isOpen('talents'), true, 'talents open');
    assertEqual(ma.isOpen('supercomputerRoot'), true, 'supercomputerRoot open');
    assertEqual(ma.isOpen('help'), true, 'help open');
    assertEqual(ma.isOpen('bigMenu'), true, 'bigMenu open');
    assertEqual(ma.isOpen('tutorialOverlay'), false, 'tutorialOverlay still closed');
    assertEqual(ma.isOpen('pauseMenu'), false, 'pauseMenu still closed');
    assertEqual(ma.isOpen('crateReward'), false, 'crateReward still closed');

    _notifyModal('talents', false);
    assertEqual(ma.isOpen('talents'), false, 'talents closed');
    assertEqual(ma.isOpen('supercomputerRoot'), true, 'supercomputerRoot still open');
    assertEqual(ma.isOpen('help'), true, 'help still open');
  });

  // ══════════════════════════════════════════
  //  Section 7: Cross-adapter integration for Phase 3d scenes
  // ══════════════════════════════════════════
  console.log('\n  --- Cross-adapter: ModalAdapter + SceneOverlayManager for Phase 3d scenes ---');

  _global.Game = {};
  loadModule('src/phaser/sceneOverlayManager.js');
  loadModule('src/phaser/modalAdapter.js');

  (function () {
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
    som.register('TalentsScene');
    som.register('SupercomputerRootScene');
    som.register('HelpScene');
    som.register('TutorialOverlayScene');

    var ma = _global.Game.ModalAdapter;
    ma.init();

    test('notifyOpen routes TalentsScene through SceneOverlayManager', function () {
      ma.registerModal('talents', null);
      ma.setPhaserSceneKey('talents', 'TalentsScene');
      ma.setMode('talents', 'phaser');

      ma.notifyOpen('talents');
      assertEqual(som.isVisible('TalentsScene'), true, 'TalentsScene visible');
      assertEqual(ma.isOpen('talents'), true, 'talents open');

      ma.notifyClose('talents');
      assertEqual(ma.isOpen('talents'), false, 'talents closed');
    });

    test('notifyOpen routes SupercomputerRootScene through SceneOverlayManager', function () {
      ma.registerModal('supercomputerRoot', null);
      ma.setPhaserSceneKey('supercomputerRoot', 'SupercomputerRootScene');
      ma.setMode('supercomputerRoot', 'phaser');

      ma.notifyOpen('supercomputerRoot');
      assertEqual(som.isVisible('SupercomputerRootScene'), true, 'SupercomputerRootScene visible');
      assertEqual(ma.isOpen('supercomputerRoot'), true, 'supercomputerRoot open');

      ma.notifyClose('supercomputerRoot');
      assertEqual(ma.isOpen('supercomputerRoot'), false, 'supercomputerRoot closed');
    });

    test('notifyOpen routes HelpScene through SceneOverlayManager', function () {
      ma.registerModal('help', null);
      ma.setPhaserSceneKey('help', 'HelpScene');
      ma.setMode('help', 'phaser');

      ma.notifyOpen('help');
      assertEqual(som.isVisible('HelpScene'), true, 'HelpScene visible');
      assertEqual(ma.isOpen('help'), true, 'help open');

      ma.notifyClose('help');
      assertEqual(ma.isOpen('help'), false, 'help closed');
    });

    test('notifyOpen routes TutorialOverlayScene through SceneOverlayManager', function () {
      ma.registerModal('tutorialOverlay', null);
      ma.setPhaserSceneKey('tutorialOverlay', 'TutorialOverlayScene');
      ma.setMode('tutorialOverlay', 'phaser');

      ma.notifyOpen('tutorialOverlay');
      assertEqual(som.isVisible('TutorialOverlayScene'), true, 'TutorialOverlayScene visible');
      assertEqual(ma.isOpen('tutorialOverlay'), true, 'tutorialOverlay open');

      ma.notifyClose('tutorialOverlay');
      assertEqual(ma.isOpen('tutorialOverlay'), false, 'tutorialOverlay closed');
    });

    test('Multiple Phase 3d scenes open simultaneously', function () {
      ma.notifyOpen('talents');
      ma.notifyOpen('help');
      ma.notifyOpen('tutorialOverlay');

      assertEqual(ma.isOpen('talents'), true, 'talents open');
      assertEqual(ma.isOpen('help'), true, 'help open');
      assertEqual(ma.isOpen('tutorialOverlay'), true, 'tutorialOverlay open');
      assertEqual(som.isVisible('TalentsScene'), true, 'TalentsScene visible');
      assertEqual(som.isVisible('HelpScene'), true, 'HelpScene visible');
      assertEqual(som.isVisible('TutorialOverlayScene'), true, 'TutorialOverlayScene visible');

      ma.notifyClose('help');
      assertEqual(ma.isOpen('talents'), true, 'talents still open');
      assertEqual(ma.isOpen('help'), false, 'help closed');
      assertEqual(ma.isOpen('tutorialOverlay'), true, 'tutorialOverlay still open');

      ma.notifyClose('talents');
      ma.notifyClose('tutorialOverlay');
    });
  }());

  // ══════════════════════════════════════════
  //  Section 8: Edge cases for Phase 3d scenes
  // ══════════════════════════════════════════
  console.log('\n  --- Edge cases ---');

  test('TalentsScene double-open keeps state open', function () {
    _global.Game = {};
    loadModule('src/phaser/modalAdapter.js');
    var ma = _global.Game.ModalAdapter;
    ma.init();
    ma.registerModal('talents', null);
    ma.notifyOpen('talents');
    ma.notifyOpen('talents');
    assertEqual(ma.isOpen('talents'), true, 'still open');
  });

  test('SupercomputerRoot close without prior open sets false', function () {
    _global.Game = {};
    loadModule('src/phaser/modalAdapter.js');
    var ma = _global.Game.ModalAdapter;
    ma.init();
    ma.registerModal('supercomputerRoot', null);
    ma.notifyClose('supercomputerRoot');
    assertEqual(ma.isOpen('supercomputerRoot'), false, 'false without open');
  });

  test('Destroy clears all Phase 3d modal states', function () {
    _global.Game = {};
    loadModule('src/phaser/modalAdapter.js');
    var ma = _global.Game.ModalAdapter;
    ma.init();
    ma.registerModal('talents', null);
    ma.registerModal('supercomputerRoot', null);
    ma.registerModal('help', null);
    ma.registerModal('tutorialOverlay', null);
    ma.notifyOpen('talents');
    ma.notifyOpen('supercomputerRoot');
    ma.notifyOpen('help');
    ma.notifyOpen('tutorialOverlay');
    assertEqual(ma.isOpen('talents'), true, 'talents open');
    assertEqual(ma.isOpen('supercomputerRoot'), true, 'supercomputerRoot open');
    assertEqual(ma.isOpen('help'), true, 'help open');
    assertEqual(ma.isOpen('tutorialOverlay'), true, 'tutorialOverlay open');
    ma.destroy();
    assertEqual(ma.isOpen('talents'), false, 'talents cleared');
    assertEqual(ma.isOpen('supercomputerRoot'), false, 'supercomputerRoot cleared');
    assertEqual(ma.isOpen('help'), false, 'help cleared');
    assertEqual(ma.isOpen('tutorialOverlay'), false, 'tutorialOverlay cleared');
  });

  test('notifyOpen in both mode for Talents launches Phaser and does NOT touch DOM', function () {
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
    ma.registerModal('talents', el);
    ma.setPhaserSceneKey('talents', 'TalentsScene');
    ma.setMode('talents', 'both');
    ma.notifyOpen('talents');
    assert(showCalls.indexOf('TalentsScene') !== -1, 'Phaser scene shown');
    assertEqual(el.classList.contains('hidden'), true, 'DOM untouched in both mode');
  });

  test('notifyOpen in phaser mode for Help hides DOM', function () {
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
    ma.registerModal('help', el);
    ma.setPhaserSceneKey('help', 'HelpScene');
    ma.setMode('help', 'phaser');
    ma.notifyOpen('help');
    assertEqual(el.classList.contains('hidden'), true, 'DOM hidden in phaser mode');
    assertEqual(el.getAttribute('aria-hidden'), 'true', 'aria-hidden=true');
    assertEqual(ma.isOpen('help'), true, 'state tracked');
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
