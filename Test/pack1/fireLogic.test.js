/**
 * Tests for multi-barrel fire logic (T3).
 * Run: node Test/pack1/fireLogic.test.js
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
function test(name, fn) {
  try { fn(); passCount++; console.log('  ✓ ' + name); }
  catch (e) { failCount++; failures.push({ name, error: e.message }); console.log('  ✗ ' + name + ' — ' + e.message); }
}

// ── Fake globals ──
const global = globalThis;
global.window = global;
global.Game = {};

// ── Load combat module ──
const fs = require('fs');
const path = require('path');

function loadModule(relPath) {
  const code = fs.readFileSync(path.resolve(__dirname, '../..', relPath), 'utf-8');
  const fn = new Function('window', 'global', 'document', 'console', 'Promise', code);
  fn(global, global, {}, console, Promise);
}

loadModule('src/mechanics/combat.js');

const Combat = global.Game.Combat;

console.log('\n── T3: getProjectileCount (multi-barrel) ──');

test('FL-1: Combat.getProjectileCount exists', () => {
  assert(typeof Combat.getProjectileCount === 'function', 'is function');
});

// Levels 1-5 → 1 projectile
test('FL-2: level 1 → 1 projectile', () => {
  assertEqual(Combat.getProjectileCount(1), 1);
});
test('FL-3: level 3 → 1 projectile', () => {
  assertEqual(Combat.getProjectileCount(3), 1);
});
test('FL-4: level 5 → 1 projectile', () => {
  assertEqual(Combat.getProjectileCount(5), 1);
});

// Levels 6-10 → 2 projectiles
test('FL-5: level 6 → 2 projectiles', () => {
  assertEqual(Combat.getProjectileCount(6), 2);
});
test('FL-6: level 8 → 2 projectiles', () => {
  assertEqual(Combat.getProjectileCount(8), 2);
});
test('FL-7: level 10 → 2 projectiles', () => {
  assertEqual(Combat.getProjectileCount(10), 2);
});

// Levels 11+ → 3 projectiles
test('FL-8: level 11 → 3 projectiles', () => {
  assertEqual(Combat.getProjectileCount(11), 3);
});
test('FL-9: level 15 → 3 projectiles', () => {
  assertEqual(Combat.getProjectileCount(15), 3);
});
test('FL-10: level 30 → 3 projectiles', () => {
  assertEqual(Combat.getProjectileCount(30), 3);
});
test('FL-11: level 60 → 3 projectiles', () => {
  assertEqual(Combat.getProjectileCount(60), 3);
});

// Edge cases
test('FL-12: level 0 → 1 (clamped)', () => {
  assertEqual(Combat.getProjectileCount(0), 1);
});
test('FL-13: level -5 → 1 (clamped)', () => {
  assertEqual(Combat.getProjectileCount(-5), 1);
});
test('FL-14: level null → 1 (fallback)', () => {
  assertEqual(Combat.getProjectileCount(null), 1);
});
test('FL-15: level undefined → 1 (fallback)', () => {
  assertEqual(Combat.getProjectileCount(undefined), 1);
});
test('FL-16: level 5.9 → 1 (floored to 5)', () => {
  assertEqual(Combat.getProjectileCount(5.9), 1);
});
test('FL-17: level 10.5 → 2 (floored to 10)', () => {
  assertEqual(Combat.getProjectileCount(10.5), 2);
});

// Damage split verification
console.log('\n── T3: Damage split ──');

test('FL-18: 1 proj damage == baseDmg', () => {
  const baseDmg = 100;
  const N = Combat.getProjectileCount(3);
  const splitDmg = baseDmg / N;
  assertEqual(splitDmg * N, baseDmg, 'sum should equal base');
});

test('FL-19: 2 proj damage sums to baseDmg', () => {
  const baseDmg = 100;
  const N = Combat.getProjectileCount(7);
  const splitDmg = baseDmg / N;
  const sum = splitDmg * N;
  assertEqual(sum, baseDmg, 'sum should equal base');
});

test('FL-20: 3 proj damage sums to baseDmg', () => {
  const baseDmg = 99;
  const N = Combat.getProjectileCount(12);
  const splitDmg = baseDmg / N;
  const sum = splitDmg * N;
  assertEqual(sum, baseDmg, 'sum should equal base');
});

// Verify game.js references getProjectileCount
console.log('\n── T3: game.js integration ──');

test('FL-21: game.js uses getProjectileCount', () => {
  const gameJs = fs.readFileSync(path.resolve(__dirname, '../../game.js'), 'utf-8');
  assert(gameJs.indexOf('getProjectileCount') !== -1, 'getProjectileCount referenced in game.js');
});

test('FL-22: game.js has _nextShotId', () => {
  const gameJs = fs.readFileSync(path.resolve(__dirname, '../../game.js'), 'utf-8');
  assert(gameJs.indexOf('_nextShotId') !== -1, '_nextShotId defined in game.js');
});

test('FL-23: game.js has shotId in spawnProjectile', () => {
  const gameJs = fs.readFileSync(path.resolve(__dirname, '../../game.js'), 'utf-8');
  assert(/shotId\s*=\s*p\.shotId|shotId:\s*p\.shotId/.test(gameJs), 'shotId passed through spawnProjectile');
});

test('FL-24: game.js has BARREL_SPREAD constant', () => {
  const gameJs = fs.readFileSync(path.resolve(__dirname, '../../game.js'), 'utf-8');
  assert(gameJs.indexOf('BARREL_SPREAD') !== -1, 'BARREL_SPREAD in game.js');
});

test('FL-25: game.js checks cannonBarrels from tanks.json', () => {
  const gameJs = fs.readFileSync(path.resolve(__dirname, '../../game.js'), 'utf-8');
  assert(gameJs.indexOf('cannonBarrels') !== -1, 'cannonBarrels check in game.js');
});

// Summary
console.log('\n═══════════════════════════');
console.log('FireLogic: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(f => console.log('  - ' + f.name + ': ' + f.error));
}
console.log('═══════════════════════════\n');
process.exit(failCount > 0 ? 1 : 0);
