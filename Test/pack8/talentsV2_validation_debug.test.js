/**
 * Pack 8: Talents v2 validation/debug/fps guards tests.
 * Run: node Test/pack8/talentsV2_validation_debug.test.js
 */

let passCount = 0;
let failCount = 0;
const failures = [];

function assert(condition, message) {
  if (!condition) throw new Error('Assertion failed: ' + message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error((message || 'assertEqual') + ': expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
  }
}

async function test(name, fn) {
  try {
    await fn();
    passCount++;
    console.log('  ✓ ' + name);
  } catch (e) {
    failCount++;
    failures.push({ name, error: e && e.message ? e.message : String(e) });
    console.log('  ✗ ' + name + ' — ' + (e && e.message ? e.message : String(e)));
  }
}

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const TREE = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../..', 'assets/balance/talentTree_v2.json'), 'utf8'));
const TALENTS_CODE = fs.readFileSync(path.resolve(__dirname, '../..', 'src/systems/talents/talentsV2.js'), 'utf8');

function createLocalStorage(init) {
  const store = Object.assign({}, init || {});
  return {
    getItem: function (k) {
      return Object.prototype.hasOwnProperty.call(store, k) ? String(store[k]) : null;
    },
    setItem: function (k, v) {
      store[k] = String(v);
    },
    removeItem: function (k) {
      delete store[k];
    },
    clear: function () {
      const keys = Object.keys(store);
      for (let i = 0; i < keys.length; i++) delete store[keys[i]];
    },
  };
}

function createApiAndInit(options) {
  const opts = options || {};
  const localStorage = createLocalStorage(opts.localStorage);
  const listeners = {};

  const sandbox = {
    window: {
      location: { protocol: 'file:', hostname: 'localhost', search: '' },
      Game: {},
      localStorage,
      addEventListener: function (name, cb) {
        listeners[name] = cb;
      },
    },
    fetch: null,
    console,
  };
  sandbox.window.window = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(TALENTS_CODE, sandbox);
  const api = sandbox.window.Game.TalentsV2;

  const saveRoot = opts.saveRoot || { player: { talentsVersion: 2, talentsV2: { ranksById: {}, freePoints: 0 }, freeTalentPointsV2: 0 } };
  return api.init({
    loadSaveFn: function () { return saveRoot; },
    saveFn: function () {},
    assetLoader: function () { return TREE; },
    nowMsFn: function () { return 1000; },
  }).then(function () {
    return {
      api,
      localStorage,
      listeners,
    };
  });
}

console.log('\n── Pack 8: Talents v2 validation/debug/fps guards ──');

(async function run() {
  await test('P8-V1: validate() reports unknown param key with talent/effect context', async function () {
    const { api } = await createApiAndInit();
    const brokenTree = JSON.parse(JSON.stringify(TREE));
    brokenTree.talents[0].effects.push({ type: 'param', key: 'unknownParamKey_demo', value: 1 });

    const issues = api.validate({ tree: brokenTree, ranksById: {} });
    const found = issues.find(function (it) {
      return it && it.code === 'tree.effect_param_unknown' && it.details && it.details.talentId === brokenTree.talents[0].id;
    });
    assert(!!found, 'tree.effect_param_unknown must be reported');
  });

  await test('P8-V2: validate() confirms mods contract has no missing keys on baseline', async function () {
    const { api } = await createApiAndInit();
    const issues = api.validate();
    const missing = issues.filter(function (it) { return it && it.code === 'mods.missing_key'; });
    assertEqual(missing.length, 0, 'baseline should not miss required mod keys');
  });

  await test('P8-V3: onHit without timeMs throws in dev', async function () {
    const { api } = await createApiAndInit();
    let threw = false;
    try {
      api.onHit({
        tank: { id: 't1' },
        zombie: { id: 'z1', hp: 100, maxHp: 100 },
        damage: 10,
      });
    } catch (e) {
      threw = /timeMs/.test(String(e && e.message));
    }
    assert(threw, 'onHit must throw when timeMs is missing in dev mode');
  });

  await test('P8-V4: onUpdate interest catch-up is guarded by max steps', async function () {
    const { api } = await createApiAndInit();
    api._runRt.eco.interestNextAtMs = 1;
    const state = { coins: 1000 };

    const out = api.onUpdate({
      timeMs: 500000,
      dtMs: 16,
      state,
      mods: {
        interestPeriodMs: 1,
        interestPct: 0.05,
        interestCapPerTick: 1000,
      },
    });

    assert(out.interestTicks <= 120, 'interestTicks must be clamped by catch-up guard');
    assert(state.coins > 1000, 'interest still accrues during guarded catch-up');
  });

  await test('P8-V5: talents_debug_forceChance=1 forces deterministic procs', async function () {
    const { api, localStorage } = await createApiAndInit();
    localStorage.setItem('talents_debug_forceChance', '1');

    const tank = { id: 't-force' };
    api.onShotFired({
      tank,
      timeMs: 1000,
      mods: {
        armorPiercingProcChance: 0,
        armorPiercingProcDurationMs: 5000,
        armorPiercingProcIcdMs: 0,
      },
      rng: { random: function () { return 0.9999; } },
    });

    const rt = api.ensureTankRt(tank);
    assert(rt.buffs.armorPiercing.untilMs >= 6000, 'armorPiercing proc must trigger under forceChance');
  });

  await test('P8-V6: debugDump returns concise snapshot fields', async function () {
    const { api } = await createApiAndInit();
    const snap = api.debugDump();
    assert(!!snap && typeof snap === 'object', 'debugDump returns object');
    assert(!!snap.ranksById, 'debugDump has ranksById');
    assert(!!snap.mods, 'debugDump has mods');
    assert(!!snap.runActives, 'debugDump has runActives');
    assert(!!snap.migration, 'debugDump has migration block');
  });

  await test('P8-V7: ricochet search stops at nearest target and expands only when needed', async function () {
    const { api } = await createApiAndInit();
    const mods = {
      ricochetChance: 1,
      ricochetBounces: 1,
      ricochetRadius: 500,
      ricochetDamageMul: 0.7,
      damageMul: 1,
    };

    function hitAt(distance) {
      const from = { id: 'from-' + distance, state: 'alive', hp: 100, maxHp: 100, _sx: 0, _sy: 0 };
      const nearest = { id: 'nearest-' + distance, state: 'alive', hp: 100, maxHp: 100, _sx: distance, _sy: 0 };
      const farther = { id: 'farther-' + distance, state: 'alive', hp: 100, maxHp: 100, _sx: 420, _sy: 0 };
      const zombies = [from, nearest, farther];
      const radii = [];
      const out = api.onHit({
        tank: { id: 'ricochet-tank-' + distance },
        zombie: from,
        zombies,
        damage: 100,
        timeMs: 1000,
        mods,
        queryZombieIndicesInRadius: function (x, y, radius) {
          radii.push(radius);
          const radiusSq = radius * radius;
          return zombies.reduce(function (indices, zombie, index) {
            const dx = zombie._sx - x;
            const dy = zombie._sy - y;
            if (dx * dx + dy * dy <= radiusSq) indices.push(index);
            return indices;
          }, []);
        },
      });
      assertEqual(out.extraHits[0].zombie, nearest, 'the same nearest target is selected');
      return radii;
    }

    const denseRadii = hitAt(70);
    assertEqual(denseRadii.length, 1, 'dense targets need one small-radius query');
    assertEqual(denseRadii[0], 96, 'dense targets avoid scanning the full 500px radius');

    const sparseRadii = hitAt(140);
    assertEqual(sparseRadii.length, 2, 'sparse targets expand once before a hit');
    assertEqual(sparseRadii[0], 96, 'search starts at one collision-grid cell');
    assertEqual(sparseRadii[1], 192, 'search doubles until it finds the nearest target');
  });

  console.log('\n═══════════════════════════');
  console.log('Pack8 TalentsValidationDebug: ' + passCount + ' passed, ' + failCount + ' failed');
  if (failures.length) {
    failures.forEach(function (f) {
      console.log('  - ' + f.name + ': ' + f.error);
    });
  }
  console.log('═══════════════════════════\n');
  process.exit(failCount > 0 ? 1 : 0);
})();
