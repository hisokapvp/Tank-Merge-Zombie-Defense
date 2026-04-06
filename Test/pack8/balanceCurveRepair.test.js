/**
 * Pack 8 — repaired balance curve sanity.
 * Run: node Test/pack8/balanceCurveRepair.test.js
 */

let passCount = 0;
let failCount = 0;
const failures = [];

function assert(condition, message) {
  if (!condition) throw new Error('Assertion failed: ' + message);
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

const tanks = loadJSON('tanks.json');
const zombies = loadJSON('zombies.json');
const balance = loadJSON('balance.json');
const cannon = loadJSON('balance/cannonUpgrades.json');
const targetTtkSec = Shared.getGoalTuningPreset('balanced').desiredTtk;

function getZombieHealth(level) {
  const type = zombies.types[level - 1];
  return Number.isFinite(type.Health) ? type.Health : type.health;
}

function getShotDamage(level) {
  const tank = tanks['tank_lvl' + level];
  const row = cannon[level - 1] || [];
  const cannonApplied = Number.isFinite(row[2]) ? row[2] : 0;
  const cannonDamagePerUpgrade = Number.isFinite(row[3]) ? row[3] : 0;
  const attackDamageMul = Number.isFinite(balance && balance.tank && balance.tank.attackDamageMul)
    ? balance.tank.attackDamageMul
    : 1;
  return tank.stats.baseDamage * attackDamageMul * (1 + cannonApplied * cannonDamagePerUpgrade);
}

console.log('\n── Pack 8: Balance curve repair ──');

test('BCR-1: tank baseDamage is strictly increasing across all 60 levels', () => {
  for (let level = 2; level <= 60; level++) {
    const prev = tanks['tank_lvl' + (level - 1)].stats.baseDamage;
    const next = tanks['tank_lvl' + level].stats.baseDamage;
    assert(next > prev, 'baseDamage must increase from level ' + (level - 1) + ' to ' + level);
  }
});

test('BCR-2: zombie explicit Health is strictly increasing across all 60 levels', () => {
  for (let level = 2; level <= 60; level++) {
    const prev = getZombieHealth(level - 1);
    const next = getZombieHealth(level);
    assert(next > prev, 'Health must increase from level ' + (level - 1) + ' to ' + level);
  }
});

test('BCR-3: repaired single-target TTK tracks the balanced goal for standard levels', () => {
  [2, 10, 20, 30, 40, 50, 60].forEach((level) => {
    const ttk = getZombieHealth(level) / getShotDamage(level);
    assertApprox(ttk, targetTtkSec, 0.05, 'balanced target TTK at level ' + level);
  });
});

console.log('\n═══════════════════════════');
console.log('BalanceCurveRepair: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(function (failure) {
    console.log('  - ' + failure.name + ': ' + failure.error);
  });
}
console.log('═══════════════════════════\n');
process.exit(failCount > 0 ? 1 : 0);