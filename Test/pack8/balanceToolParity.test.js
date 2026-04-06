/**
 * Pack 8 — Balance Lab shared-kernel parity checks.
 * Run: node Test/pack8/balanceToolParity.test.js
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

function assertApprox(actual, expected, epsilon, message) {
  if (Math.abs(actual - expected) > epsilon) {
    throw new Error((message || 'assertApprox') + ': expected ' + expected + ' ± ' + epsilon + ', got ' + actual);
  }
}

function test(name, fn) {
  try {
    fn();
    passCount++;
    console.log('  ✓ ' + name);
  } catch (error) {
    failCount++;
    failures.push({ name: name, error: error.message });
    console.log('  ✗ ' + name + ' — ' + error.message);
  }
}

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');

const Shared = require(path.join(root, 'tools', 'balance-shared.js'));

function loadJSON(relPath) {
  return JSON.parse(fs.readFileSync(path.join(root, 'assets', relPath), 'utf8'));
}

const data = {
  tanks: loadJSON('tanks.json'),
  zombies: loadJSON('zombies.json'),
  fence: loadJSON('fence.json'),
  dron: loadJSON('dron.json'),
  bullet: loadJSON('bullet.json'),
  balance: loadJSON('balance.json'),
  cannon: loadJSON('balance/cannonUpgrades.json'),
  talents: loadJSON('balance/talentTree_v2.json'),
  chips: loadJSON('chips.json'),
  runtimeConstants: Shared.DEFAULT_RUNTIME_CONSTANTS,
};

const globalRef = globalThis;
globalRef.window = globalRef;
globalRef.Game = {};

function loadModule(relPath) {
  const code = fs.readFileSync(path.join(root, relPath), 'utf8');
  const fn = new Function('window', 'global', 'fetch', code);
  fn(globalRef, globalRef, function () {
    return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({}); } });
  });
}

loadModule('src/mechanics/economy.js');
loadModule('src/mechanics/fenceRepair.js');
globalRef.Game.FenceRepair.init({
  getFenceConfig() {
    return data.fence;
  },
});

const gameSource = fs.readFileSync(path.join(root, 'game.js'), 'utf8');

console.log('\n── Pack 8: Balance Lab parity ──');

test('BLP-1: shared runtime constants stay aligned with game.js BAL block', () => {
  ['dmgMultPerLevel', 'fireRateBase', 'fireRateAddPerLevel', 'zombieHpBase', 'zombieHpExtraPerLevel'].forEach((key) => {
    const match = gameSource.match(new RegExp(key + ':\\s*([0-9.]+)'));
    assert(match, 'game.js contains ' + key);
    assertApprox(Shared.DEFAULT_RUNTIME_CONSTANTS[key], Number(match[1]), 0.000001, key + ' parity');
  });
});

test('BLP-2: shared tank stats follow the runtime shot-damage contract for level 10', () => {
  const scenario = Shared.ensureScenarioShape(data, {
    bandId: Shared.getBandForLevel(10).id,
    profileKey: 'manual',
    tankLevel: 10,
    zombieLevel: 10,
    wallLevel: 7,
    droneLevel: 2,
    zombieCount: 1,
    attackWindowSec: 12,
    chipModId: null,
    talents: Shared.createEmptyTalentRanks(),
    modifiers: Shared.createIdentityModifiers(),
  }, Shared.getBandForLevel(10).id, 'manual');
  const stats = Shared.getTankStats(data, scenario);
  const tankCfg = data.tanks.tank_lvl10;
  const bulletInfo = Shared.getBulletConfigForTankLevel(data, 10);
  const cannonRow = data.cannon[9];
  const expectedShotDamage = (tankCfg.stats.baseDamage + bulletInfo.bulletCfg.addDamage)
    * Shared.getTankBalanceMultiplier(data.balance, 10, 'attackDamageMul')
    * (1 + cannonRow[2] * cannonRow[3]);
  assertApprox(stats.shotDamage, expectedShotDamage, 0.001, 'shared tank shot damage');
});

test('BLP-2b: shared tank fire rate follows tanks.json attackSpeed instead of legacy BAL curve', () => {
  const scenario = Shared.ensureScenarioShape(data, {
    bandId: Shared.getBandForLevel(10).id,
    profileKey: 'manual',
    tankLevel: 10,
    zombieLevel: 10,
    wallLevel: 7,
    droneLevel: 2,
    zombieCount: 1,
    attackWindowSec: 12,
    chipModId: null,
    talents: Shared.createEmptyTalentRanks(),
    modifiers: Shared.createIdentityModifiers(),
  }, Shared.getBandForLevel(10).id, 'manual');
  const stats = Shared.getTankStats(data, scenario);
  const tankCfg = data.tanks.tank_lvl10;
  const cannonRow = data.cannon[9];
  const expectedShotsPerSec = tankCfg.stats.attackSpeed
    * Shared.getTankBalanceMultiplier(data.balance, 10, 'attackSpeedMul')
    * (1 + cannonRow[2] * cannonRow[4]);
  assertApprox(stats.shotsPerSec, expectedShotsPerSec, 0.0001, 'shared shots/sec comes from tanks.json attackSpeed');
});

test('BLP-3: shared zombie stats use explicit Health from assets when it exists', () => {
  const zombieType = data.zombies.types[9];
  const scenario = Shared.ensureScenarioShape(data, {
    bandId: Shared.getBandForLevel(10).id,
    profileKey: 'manual',
    tankLevel: 10,
    zombieLevel: 10,
    wallLevel: 7,
    droneLevel: 2,
    zombieCount: 1,
    attackWindowSec: 12,
    chipModId: null,
    talents: Shared.createEmptyTalentRanks(),
    modifiers: Shared.createIdentityModifiers(),
  }, Shared.getBandForLevel(10).id, 'manual');
  const stats = Shared.getZombieStats(data, scenario);
  assertEqual(stats.hp, zombieType.Health, 'explicit Health drives shared zombie hp');
});

test('BLP-4: shared fence repair cost matches Game.FenceRepair for level 4 and two prior repairs', () => {
  const sharedCost = Shared.computeRepairCostFromFenceConfig(data.fence, 4, 2);
  const runtimeCost = globalRef.Game.FenceRepair.computeRepairCost(4, 2);
  assertEqual(sharedCost, runtimeCost, 'repair cost parity');
});

test('BLP-5: shared coinsForShot parity matches Game.Economy base formula', () => {
  assertEqual(Shared.coinsForShot(10), globalRef.Game.Economy.coinsForShot(10), 'coinsForShot parity');
});

test('BLP-6: absolute desiredTtk goals stay stable even when source metrics drift', () => {
  const profiles = Shared.createDefaultProfiles(data);
  const tuning = { desiredTtk: 7, zombiePressure: 50, progressionPressure: 50 };
  const baselineGoals = Shared.createDefaultGoals(data, profiles, tuning);
  const mutatedData = Shared.deepClone(data);
  mutatedData.zombies.types.forEach((type) => {
    if (Number.isFinite(type.Health)) type.Health *= 1000;
  });
  const mutatedGoals = Shared.createDefaultGoals(mutatedData, profiles, tuning);
  const baseline = baselineGoals['band-21-30'].average;
  const mutated = mutatedGoals['band-21-30'].average;
  const baselineMid = (baseline.zombieTtkMin + baseline.zombieTtkMax) * 0.5;
  const mutatedMid = (mutated.zombieTtkMin + mutated.zombieTtkMax) * 0.5;
  assertApprox(baselineMid, 7 * 1.06, 0.0001, 'goal midpoint uses absolute desiredTtk seconds');
  assertApprox(mutatedMid, baselineMid, 0.0001, 'goal midpoint is not re-seeded from current broken ttk values');
});

console.log('\n═══════════════════════════');
console.log('BalanceLabParity: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(function (failure) {
    console.log('  - ' + failure.name + ': ' + failure.error);
  });
}
console.log('═══════════════════════════\n');
process.exit(failCount > 0 ? 1 : 0);