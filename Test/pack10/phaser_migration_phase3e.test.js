/**
 * Pack 10k: Phaser Migration — Phase 3e Hangar, Workshop, Underground Hangar Tests
 *
 * Tests for:
 * - HangarChipsScene (structural — scene key, show/hide, tabs, internal methods)
 * - WorkshopScene (structural — scene key, show/hide, sub-tabs, sub-views)
 * - UndergroundHangarScene (structural — scene key, show/hide, cells, buttons)
 * - PhaserBootstrap scene list includes Phase 3e scenes
 * - ModalAdapter scene key wiring (hangarChips, workshop, undergroundHangar)
 * - All 16 scenes coexist on PhaserScenes namespace
 *
 * Run: node Test/pack10/phaser_migration_phase3e.test.js
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

  console.log('\n\u2500\u2500 Pack 10k: Phaser Migration Phase 3e \u2014 Hangar, Workshop, Underground Hangar \u2500\u2500');

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
  //  Section 1: HangarChipsScene (structural tests)
  // ══════════════════════════════════════════
  console.log('\n  --- HangarChipsScene (structural) ---');

  _global.Game = {};
  setupPhaserStubs();
  loadModule('src/phaser/scenes/HangarChipsScene.js');

  test('HangarChipsScene exports to Game.PhaserScenes.HangarChipsScene', function () {
    assert(_global.Game.PhaserScenes, 'PhaserScenes namespace');
    assert(_global.Game.PhaserScenes.HangarChipsScene, 'HangarChipsScene registered');
    assertEqual(typeof _global.Game.PhaserScenes.HangarChipsScene, 'function', 'is constructor');
  });

  test('HangarChipsScene also exports to Game.HangarChipsScene', function () {
    assert(_global.Game.HangarChipsScene, 'Game.HangarChipsScene');
    assertEqual(_global.Game.HangarChipsScene, _global.Game.PhaserScenes.HangarChipsScene, 'same constructor');
  });

  test('HangarChipsScene prototype has show/hide/shutdown methods', function () {
    var proto = _global.Game.PhaserScenes.HangarChipsScene.prototype;
    assertEqual(typeof proto.show, 'function', 'show');
    assertEqual(typeof proto.hide, 'function', 'hide');
    assertEqual(typeof proto.shutdown, 'function', 'shutdown');
  });

  test('HangarChipsScene prototype has create and _setAllVisible', function () {
    var proto = _global.Game.PhaserScenes.HangarChipsScene.prototype;
    assertEqual(typeof proto.create, 'function', 'create');
    assertEqual(typeof proto._setAllVisible, 'function', '_setAllVisible');
  });

  test('HangarChipsScene prototype has _showTab for tab switching', function () {
    var proto = _global.Game.PhaserScenes.HangarChipsScene.prototype;
    assertEqual(typeof proto._showTab, 'function', '_showTab');
  });

  test('HangarChipsScene prototype has _refreshCells and _refreshChipList', function () {
    var proto = _global.Game.PhaserScenes.HangarChipsScene.prototype;
    assertEqual(typeof proto._refreshCells, 'function', '_refreshCells');
    assertEqual(typeof proto._refreshChipList, 'function', '_refreshChipList');
  });

  // ══════════════════════════════════════════
  //  Section 2: WorkshopScene (structural tests)
  // ══════════════════════════════════════════
  console.log('\n  --- WorkshopScene (structural) ---');

  _global.Game = {};
  setupPhaserStubs();
  loadModule('src/phaser/scenes/WorkshopScene.js');

  test('WorkshopScene exports to Game.PhaserScenes.WorkshopScene', function () {
    assert(_global.Game.PhaserScenes, 'PhaserScenes namespace');
    assert(_global.Game.PhaserScenes.WorkshopScene, 'WorkshopScene registered');
    assertEqual(typeof _global.Game.PhaserScenes.WorkshopScene, 'function', 'is constructor');
  });

  test('WorkshopScene also exports to Game.WorkshopScene', function () {
    assert(_global.Game.WorkshopScene, 'Game.WorkshopScene');
    assertEqual(_global.Game.WorkshopScene, _global.Game.PhaserScenes.WorkshopScene, 'same constructor');
  });

  test('WorkshopScene prototype has show/hide/shutdown methods', function () {
    var proto = _global.Game.PhaserScenes.WorkshopScene.prototype;
    assertEqual(typeof proto.show, 'function', 'show');
    assertEqual(typeof proto.hide, 'function', 'hide');
    assertEqual(typeof proto.shutdown, 'function', 'shutdown');
  });

  test('WorkshopScene prototype has create and _setAllVisible', function () {
    var proto = _global.Game.PhaserScenes.WorkshopScene.prototype;
    assertEqual(typeof proto.create, 'function', 'create');
    assertEqual(typeof proto._setAllVisible, 'function', '_setAllVisible');
  });

  test('WorkshopScene prototype has _showSubTab for sub-tab switching', function () {
    var proto = _global.Game.PhaserScenes.WorkshopScene.prototype;
    assertEqual(typeof proto._showSubTab, 'function', '_showSubTab');
  });

  test('WorkshopScene prototype has _refreshUpgrade, _refreshCraft, _refreshRecycle', function () {
    var proto = _global.Game.PhaserScenes.WorkshopScene.prototype;
    assertEqual(typeof proto._refreshUpgrade, 'function', '_refreshUpgrade');
    assertEqual(typeof proto._refreshCraft, 'function', '_refreshCraft');
    assertEqual(typeof proto._refreshRecycle, 'function', '_refreshRecycle');
  });

  test('WorkshopScene prototype has _switchRecycleSubTab', function () {
    var proto = _global.Game.PhaserScenes.WorkshopScene.prototype;
    assertEqual(typeof proto._switchRecycleSubTab, 'function', '_switchRecycleSubTab');
  });

  // ══════════════════════════════════════════
  //  Section 3: UndergroundHangarScene (structural tests)
  // ══════════════════════════════════════════
  console.log('\n  --- UndergroundHangarScene (structural) ---');

  _global.Game = {};
  setupPhaserStubs();
  loadModule('src/phaser/scenes/UndergroundHangarScene.js');

  test('UndergroundHangarScene exports to Game.PhaserScenes.UndergroundHangarScene', function () {
    assert(_global.Game.PhaserScenes, 'PhaserScenes namespace');
    assert(_global.Game.PhaserScenes.UndergroundHangarScene, 'UndergroundHangarScene registered');
    assertEqual(typeof _global.Game.PhaserScenes.UndergroundHangarScene, 'function', 'is constructor');
  });

  test('UndergroundHangarScene also exports to Game.UndergroundHangarScene', function () {
    assert(_global.Game.UndergroundHangarScene, 'Game.UndergroundHangarScene');
    assertEqual(_global.Game.UndergroundHangarScene, _global.Game.PhaserScenes.UndergroundHangarScene, 'same constructor');
  });

  test('UndergroundHangarScene prototype has show/hide/shutdown methods', function () {
    var proto = _global.Game.PhaserScenes.UndergroundHangarScene.prototype;
    assertEqual(typeof proto.show, 'function', 'show');
    assertEqual(typeof proto.hide, 'function', 'hide');
    assertEqual(typeof proto.shutdown, 'function', 'shutdown');
  });

  test('UndergroundHangarScene prototype has create and _setAllVisible', function () {
    var proto = _global.Game.PhaserScenes.UndergroundHangarScene.prototype;
    assertEqual(typeof proto.create, 'function', 'create');
    assertEqual(typeof proto._setAllVisible, 'function', '_setAllVisible');
  });

  test('UndergroundHangarScene prototype has _refreshCells and _refreshButtons', function () {
    var proto = _global.Game.PhaserScenes.UndergroundHangarScene.prototype;
    assertEqual(typeof proto._refreshCells, 'function', '_refreshCells');
    assertEqual(typeof proto._refreshButtons, 'function', '_refreshButtons');
  });

  test('UndergroundHangarScene prototype has _handleCellSelect', function () {
    var proto = _global.Game.PhaserScenes.UndergroundHangarScene.prototype;
    assertEqual(typeof proto._handleCellSelect, 'function', '_handleCellSelect');
  });

  // ══════════════════════════════════════════
  //  Section 4: PhaserBootstrap includes Phase 3e scenes
  // ══════════════════════════════════════════
  console.log('\n  --- PhaserBootstrap Phase 3e integration ---');

  (function () {
    // Read bootstrap source and verify it references Phase 3e scene keys
    var fs = require('fs');
    var bootstrapSrc = fs.readFileSync(path.join(ROOT, 'src', 'phaser', 'phaserBootstrap.js'), 'utf8');

    test('PhaserBootstrap references HangarChipsScene', function () {
      assert(bootstrapSrc.indexOf('HangarChipsScene') !== -1, 'HangarChipsScene in phaserBootstrap.js');
    });

    test('PhaserBootstrap references WorkshopScene', function () {
      assert(bootstrapSrc.indexOf('WorkshopScene') !== -1, 'WorkshopScene in phaserBootstrap.js');
    });

    test('PhaserBootstrap references UndergroundHangarScene', function () {
      assert(bootstrapSrc.indexOf('UndergroundHangarScene') !== -1, 'UndergroundHangarScene in phaserBootstrap.js');
    });

    test('PhaserBootstrap Phase 3e comment marker present', function () {
      assert(bootstrapSrc.indexOf('Phase 3e') !== -1, 'Phase 3e comment');
    });
  })();

  // ══════════════════════════════════════════
  //  Section 5: game.js wiring verification
  // ══════════════════════════════════════════
  console.log('\n  --- game.js Phase 3e wiring ---');

  (function () {
    var fs = require('fs');
    var gameSrc = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8');

    test('game.js registers HangarChipsScene with SceneOverlayManager', function () {
      assert(gameSrc.indexOf("register('HangarChipsScene'") !== -1, 'HangarChipsScene registered');
    });

    test('game.js registers WorkshopScene with SceneOverlayManager', function () {
      assert(gameSrc.indexOf("register('WorkshopScene'") !== -1, 'WorkshopScene registered');
    });

    test('game.js registers UndergroundHangarScene with SceneOverlayManager', function () {
      assert(gameSrc.indexOf("register('UndergroundHangarScene'") !== -1, 'UndergroundHangarScene registered');
    });

    test('game.js sets ModalAdapter key for hangarChips', function () {
      assert(gameSrc.indexOf("setPhaserSceneKey('hangarChips'") !== -1, 'hangarChips ModalAdapter key');
    });

    test('game.js sets ModalAdapter key for workshop', function () {
      assert(gameSrc.indexOf("setPhaserSceneKey('workshop'") !== -1, 'workshop ModalAdapter key');
    });

    test('game.js sets ModalAdapter key for undergroundHangar', function () {
      assert(gameSrc.indexOf("setPhaserSceneKey('undergroundHangar'") !== -1, 'undergroundHangar ModalAdapter key');
    });

    test('game.js has _notifyModal for undergroundHangar open', function () {
      assert(gameSrc.indexOf("_notifyModal('undergroundHangar', true)") !== -1, 'undergroundHangar open notify');
    });

    test('game.js has _notifyModal for undergroundHangar close', function () {
      assert(gameSrc.indexOf("_notifyModal('undergroundHangar', false)") !== -1, 'undergroundHangar close notify');
    });

    test('game.js has _notifyModal for hangarChips open', function () {
      assert(gameSrc.indexOf("_notifyModal('hangarChips', true)") !== -1, 'hangarChips open notify');
    });

    test('game.js has _notifyModal for hangarChips close', function () {
      assert(gameSrc.indexOf("_notifyModal('hangarChips', false)") !== -1, 'hangarChips close notify');
    });

    test('game.js has onViewChange callback in createController', function () {
      assert(gameSrc.indexOf('onViewChange:') !== -1, 'onViewChange callback');
    });
  })();

  // ══════════════════════════════════════════
  //  Section 6: index.html includes Phase 3e script tags
  // ══════════════════════════════════════════
  console.log('\n  --- index.html Phase 3e script tags ---');

  (function () {
    var fs = require('fs');
    var htmlSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

    test('index.html includes HangarChipsScene.js script', function () {
      assert(htmlSrc.indexOf('HangarChipsScene.js') !== -1, 'HangarChipsScene.js script tag');
    });

    test('index.html includes WorkshopScene.js script', function () {
      assert(htmlSrc.indexOf('WorkshopScene.js') !== -1, 'WorkshopScene.js script tag');
    });

    test('index.html includes UndergroundHangarScene.js script', function () {
      assert(htmlSrc.indexOf('UndergroundHangarScene.js') !== -1, 'UndergroundHangarScene.js script tag');
    });

    test('index.html has Phase 3e+ cache-bust version', function () {
      assert(htmlSrc.indexOf('phase3e') !== -1 || htmlSrc.indexOf('phase4') !== -1, 'phase3e or later cache-bust');
    });
  })();

  // ══════════════════════════════════════════
  //  Section 7: All 16 scenes coexist on PhaserScenes namespace
  // ══════════════════════════════════════════
  console.log('\n  --- All 16 scenes namespace coexistence ---');

  _global.Game = {};
  setupPhaserStubs();

  // Load all Phase 3a–3e scene modules
  var sceneModules = [
    'src/phaser/scenes/BootScene.js',
    'src/phaser/scenes/GameScene.js',
    'src/phaser/scenes/HudScene.js',
    'src/phaser/scenes/PauseMenuScene.js',
    'src/phaser/scenes/LevelUpScene.js',
    'src/phaser/scenes/CrateRewardScene.js',
    'src/phaser/scenes/BigMenuScene.js',
    'src/phaser/scenes/AchievementsScene.js',
    'src/phaser/scenes/AchievementPopupScene.js',
    'src/phaser/scenes/TalentsScene.js',
    'src/phaser/scenes/SupercomputerRootScene.js',
    'src/phaser/scenes/HelpScene.js',
    'src/phaser/scenes/TutorialOverlayScene.js',
    'src/phaser/scenes/HangarChipsScene.js',
    'src/phaser/scenes/WorkshopScene.js',
    'src/phaser/scenes/UndergroundHangarScene.js',
  ];

  var loadedAll = true;
  for (var i = 0; i < sceneModules.length; i++) {
    try {
      loadModule(sceneModules[i]);
    } catch (e) {
      console.log('  (warning) Could not load ' + sceneModules[i] + ': ' + e.message);
      loadedAll = false;
    }
  }

  var expectedSceneKeys = [
    'BootScene', 'GameScene', 'HudScene',
    'PauseMenuScene', 'LevelUpScene', 'CrateRewardScene',
    'BigMenuScene', 'AchievementsScene', 'AchievementPopupScene',
    'TalentsScene', 'SupercomputerRootScene', 'HelpScene', 'TutorialOverlayScene',
    'HangarChipsScene', 'WorkshopScene', 'UndergroundHangarScene',
  ];

  test('Game.PhaserScenes has all 16 scene constructors', function () {
    var ns = _global.Game.PhaserScenes || {};
    var missing = [];
    for (var i = 0; i < expectedSceneKeys.length; i++) {
      if (typeof ns[expectedSceneKeys[i]] !== 'function') missing.push(expectedSceneKeys[i]);
    }
    assert(missing.length === 0, 'Missing scenes: ' + missing.join(', '));
  });

  test('No duplicate scene constructors among Phase 3e scenes', function () {
    var ns = _global.Game.PhaserScenes || {};
    assert(ns.HangarChipsScene !== ns.WorkshopScene, 'HangarChipsScene !== WorkshopScene');
    assert(ns.HangarChipsScene !== ns.UndergroundHangarScene, 'HangarChipsScene !== UndergroundHangarScene');
    assert(ns.WorkshopScene !== ns.UndergroundHangarScene, 'WorkshopScene !== UndergroundHangarScene');
  });

  // ══════════════════════════════════════════
  //  Section 8: supercomputerMenu.js onViewChange integration
  // ══════════════════════════════════════════
  console.log('\n  --- supercomputerMenu.js onViewChange ---');

  (function () {
    var fs = require('fs');
    var menuSrc = fs.readFileSync(path.join(ROOT, 'src', 'ui', 'supercomputerMenu.js'), 'utf8');

    test('supercomputerMenu.js reads onViewChange from opts', function () {
      assert(menuSrc.indexOf('onViewChange') !== -1, 'onViewChange referenced');
    });

    test('supercomputerMenu.js calls onViewChange in showHangarMods', function () {
      // Should call onViewChange('hangar') after setting state.view = 'hangar'
      var idx1 = menuSrc.indexOf("state.view = 'hangar'");
      var idx2 = menuSrc.indexOf("onViewChange('hangar')", idx1);
      assert(idx1 !== -1 && idx2 !== -1 && idx2 > idx1, 'onViewChange called after state.view = hangar');
    });

    test('supercomputerMenu.js calls onViewChange in closeAll', function () {
      assert(menuSrc.indexOf("onViewChange('closed'") !== -1, 'onViewChange(closed) in closeAll');
    });

    test('supercomputerMenu.js calls onViewChange in backFromChild', function () {
      assert(menuSrc.indexOf("onViewChange('root'") !== -1, 'onViewChange(root) in backFromChild');
    });
  })();

  // ── Summary ──
  console.log('\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
  console.log('Pack 10k results: ' + passCount + ' passed, ' + failCount + ' failed');
  if (failCount > 0) {
    console.log('\nFailed tests:');
    for (var f = 0; f < failures.length; f++) {
      console.log('  - ' + failures[f].name + ': ' + failures[f].error);
    }
    process.exit(1);
  }
  console.log('');
  process.exit(0);

})();
