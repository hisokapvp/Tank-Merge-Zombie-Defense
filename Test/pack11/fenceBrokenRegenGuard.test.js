'use strict';

let passCount = 0;
let failCount = 0;
const failures = [];

function assert(cond, msg) {
  if (!cond) throw new Error('Assertion failed: ' + msg);
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error((msg || 'assertEqual') + ': expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
  }
}

function test(name, fn) {
  try {
    fn();
    passCount++;
    console.log('  [OK] ' + name);
  } catch (err) {
    failCount++;
    failures.push({ name: name, error: err.message });
    console.log('  [FAIL] ' + name + ' - ' + err.message);
  }
}

const fs = require('fs');
const path = require('path');

const globalCtx = globalThis;
globalCtx.window = globalCtx;
globalCtx.Game = globalCtx.Game || {};

if (typeof globalCtx.fetch === 'undefined') {
  globalCtx.fetch = function () {
    return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({}); } });
  };
}

function loadModule(relPath) {
  const abs = path.resolve(__dirname, '../..', relPath);
  const code = fs.readFileSync(abs, 'utf-8');
  const fn = new Function('window', 'global', 'document', 'console', 'fetch', 'Promise', 'setTimeout', 'clearTimeout', code);
  fn(globalCtx, globalCtx, {}, console, globalCtx.fetch, Promise, setTimeout, clearTimeout);
}

loadModule('src/systems/talents/talentsV2.js');

const Talents = globalCtx.Game.TalentsV2;
assert(!!Talents, 'Game.TalentsV2 module must load');

const treeJsonPath = path.resolve(__dirname, '../../assets/balance/talentTree_v2.json');
const treeJson = JSON.parse(fs.readFileSync(treeJsonPath, 'utf-8'));

(async function bootstrap() {
  await Talents.init({
    assetLoader: function () { return treeJson; },
    loadSaveFn: function () { return { player: { talentsV2: { ranksById: {} } } }; },
    saveFn: function () {},
    getMaxTankBaseDamageFn: function () { return 100; },
  });

  console.log('\n-- Pack 11: fence broken regen guard --');

  test('FBR-1: broken segment keeps 0 HP even if passive repair mods are active', function () {
    Talents._runRt.actives.defense.untilMs = 20000;
    const seg = {
      hp: 90,
      maxHp: 100,
      broken: true,
      _defRt: {
        nextRegenAtMs: 1,
        nextAutoRepairAtMs: 1,
        lastDamageAtMs: 0,
        shieldHp: 0,
        barrierUntilMs: 0,
        barrierIcdUntilMs: 0,
        secondWindUsed: false,
        secondWindReadyAtMs: 0,
        immunityUntilMs: 0,
        immunityIcdUntilMs: 0,
        stunIcdUntilMs: 0,
        thornsIcdUntilMs: 0,
        nextShieldAtMs: 0,
        protectAheadAnalyzeUntilMs: 0,
        protectAheadBuffUntilMs: 0,
      },
    };

    Talents.onUpdate({
      timeMs: 1000,
      dtMs: 1000,
      segments: [seg],
      mods: {
        wallRegenPctPerSec: 0.1,
        wallRegenDelayMs: 100,
        autoRepairPct: 0.2,
        autoRepairPeriodMs: 100,
        defActiveAutoRepairPctPerSec: 0.3,
      },
    });

    assertEqual(seg.hp, 0, 'broken segment hp must be normalized to 0');
    assertEqual(seg.broken, true, 'broken flag must stay true until repair');
  });

  test('FBR-2: non-broken segment still receives periodic regen and auto-repair', function () {
    Talents._runRt.actives.defense.untilMs = 0;
    const seg = {
      hp: 50,
      maxHp: 100,
      broken: false,
      _defRt: {
        nextRegenAtMs: 50,
        nextAutoRepairAtMs: 50,
        lastDamageAtMs: 0,
        shieldHp: 0,
        barrierUntilMs: 0,
        barrierIcdUntilMs: 0,
        secondWindUsed: false,
        secondWindReadyAtMs: 0,
        immunityUntilMs: 0,
        immunityIcdUntilMs: 0,
        stunIcdUntilMs: 0,
        thornsIcdUntilMs: 0,
        nextShieldAtMs: 0,
        protectAheadAnalyzeUntilMs: 0,
        protectAheadBuffUntilMs: 0,
      },
    };

    Talents.onUpdate({
      timeMs: 100,
      dtMs: 0,
      segments: [seg],
      mods: {
        wallRegenPctPerSec: 0.1,
        wallRegenDelayMs: 100,
        autoRepairPct: 0.2,
        autoRepairPeriodMs: 100,
      },
    });

    assertEqual(seg.hp, 80, 'non-broken segment should receive regen and auto-repair');
  });

  test('FBR-3: defense active auto-repair still heals a damaged non-broken segment', function () {
    Talents._runRt.actives.defense.untilMs = 5000;
    const seg = { hp: 50, maxHp: 100, broken: false };

    Talents.onUpdate({
      timeMs: 1000,
      dtMs: 1000,
      segments: [seg],
      mods: {
        defActiveAutoRepairPctPerSec: 0.25,
      },
    });

    assertEqual(seg.hp, 75, 'defense active auto-repair should keep working for damaged intact segments');
  });

  console.log('\n-- Summary --');
  console.log('Passed: ' + passCount);
  console.log('Failed: ' + failCount);
  if (failures.length) {
    for (let i = 0; i < failures.length; i++) {
      console.log('  - ' + failures[i].name + ': ' + failures[i].error);
    }
  }
  process.exit(failCount > 0 ? 1 : 0);
})().catch(function (err) {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});