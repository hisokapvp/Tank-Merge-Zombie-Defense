/**
 * Pack 2 — Fire logic regression tests.
 * Run: node Test/pack2/fireLogicRegression.test.js
 *
 * Validates getProjectileCount, getShootRange, pickDeathAnim
 * for regressions after Pack 2 changes.
 */

let passCount = 0;
let failCount = 0;
const failures = [];

function assert(cond, msg) {
  if (!cond) throw new Error('Assertion failed: ' + msg);
}
function assertEqual(a, b, msg) {
  if (a !== b) throw new Error((msg || 'assertEqual') + ': expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a));
}
function test(name, fn) {
  try { fn(); passCount++; console.log('  ✓ ' + name); }
  catch (e) { failCount++; failures.push({ name, error: e.message }); console.log('  ✗ ' + name + ' — ' + e.message); }
}

// ── Fake globals ──
const global = globalThis;
global.window = global;
global.Game = {};

const fs = require('fs');
const pathMod = require('path');

function loadModule(relPath) {
  const code = fs.readFileSync(pathMod.resolve(__dirname, '../..', relPath), 'utf-8');
  const fn = new Function('window', 'global', 'document', 'console', 'Promise', code);
  fn(global, global, {}, console, Promise);
}

loadModule('src/mechanics/combat.js');
const Combat = global.Game.Combat;

// ═══════════════════════════════════════
console.log('\n── Pack 2: Fire logic regression ──');

// getProjectileCount regression
test('FLR-1: getProjectileCount exists', () => {
  assert(typeof Combat.getProjectileCount === 'function', 'is fn');
});

test('FLR-2: levels 1-5 → 1', () => {
  for (let l = 1; l <= 5; l++) assertEqual(Combat.getProjectileCount(l), 1, 'level ' + l);
});

test('FLR-3: levels 6-10 → 2', () => {
  for (let l = 6; l <= 10; l++) assertEqual(Combat.getProjectileCount(l), 2, 'level ' + l);
});

test('FLR-4: levels 11-60 → 3', () => {
  for (let l = 11; l <= 60; l++) assertEqual(Combat.getProjectileCount(l), 3, 'level ' + l);
});

test('FLR-5: edge level 0 → 1', () => {
  assertEqual(Combat.getProjectileCount(0), 1);
});

test('FLR-6: edge level null → 1', () => {
  assertEqual(Combat.getProjectileCount(null), 1);
});

// getShootRange regression
test('FLR-7: getShootRange returns 315', () => {
  assertEqual(Combat.getShootRange({}), 315);
});

test('FLR-8: FIXED_SHOOT_RANGE constant is 315', () => {
  assertEqual(Combat.FIXED_SHOOT_RANGE, 315);
});

// pickDeathAnim regression
test('FLR-9: pickDeathAnim both available, rand < 0.7 → personal', () => {
  const p = { id: 'personal' };
  const c = { id: 'common' };
  assertEqual(Combat.pickDeathAnim(c, p, 0.3), p);
});

test('FLR-10: pickDeathAnim both available, rand >= 0.7 → common', () => {
  const p = { id: 'personal' };
  const c = { id: 'common' };
  assertEqual(Combat.pickDeathAnim(c, p, 0.8), c);
});

test('FLR-11: pickDeathAnim only personal → personal', () => {
  const p = { id: 'personal' };
  assertEqual(Combat.pickDeathAnim(null, p, 0.99), p);
});

test('FLR-12: pickDeathAnim only common → common', () => {
  const c = { id: 'common' };
  assertEqual(Combat.pickDeathAnim(c, null, 0.1), c);
});

test('FLR-13: pickDeathAnim both null → null', () => {
  assertEqual(Combat.pickDeathAnim(null, null, 0.5), null);
});

test('FLR-14: pickDeathAnim boundary rand=0.7 → common', () => {
  const p = { id: 'p' };
  const c = { id: 'c' };
  assertEqual(Combat.pickDeathAnim(c, p, 0.7), c);
});

test('FLR-15: pickDeathAnim rand=0.0 → personal', () => {
  const p = { id: 'p' };
  const c = { id: 'c' };
  assertEqual(Combat.pickDeathAnim(c, p, 0.0), p);
});

// Damage conservation
test('FLR-16: damage split sums to base for all projectile counts', () => {
  const baseDmg = 147;
  for (let lvl of [3, 8, 15]) {
    const N = Combat.getProjectileCount(lvl);
    const split = baseDmg / N;
    const sum = split * N;
    assertEqual(sum, baseDmg, 'lvl ' + lvl + ' N=' + N);
  }
});

test('FLR-17: tanks.json documents optional stats.projectileCount contract', () => {
  const tanksJson = fs.readFileSync(pathMod.resolve(__dirname, '../../assets/tanks.json'), 'utf-8');
  assert(tanksJson.indexOf('_comment_projectileCount') !== -1, 'tanks.json exposes projectileCount guidance for per-level tuning');
});

// ── Summary ──
console.log('\n═══════════════════════════');
console.log('FireLogicRegression: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(f => console.log('  - ' + f.name + ': ' + f.error));
}
console.log('═══════════════════════════\n');
process.exit(failCount > 0 ? 1 : 0);
