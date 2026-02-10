/**
 * Pack 6 — Burst targeting helper tests.
 * Run: node Test/pack6/burstTargeting.test.js
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

const fs = require('fs');
const path = require('path');

function loadModule(relPath) {
  const code = fs.readFileSync(path.resolve(__dirname, '../..', relPath), 'utf-8');
  const fn = new Function('window', 'global', 'document', 'console', 'Promise', code);
  fn(global, global, {}, console, Promise);
}

loadModule('src/mechanics/targeting.js');

const Targeting = global.Game.Targeting;

console.log('\n── Pack 6: Burst targeting helper ──');

test('BT-1: pickBurstTargets exists', () => {
  assert(typeof Targeting.pickBurstTargets === 'function', 'is function');
});

test('BT-2: unique when enough targets', () => {
  const a = { id: 'a' };
  const b = { id: 'b' };
  const c = { id: 'c' };
  const res = Targeting.pickBurstTargets([a, b, c], 2);
  assertEqual(res.length, 2, 'length');
  assertEqual(res[0], a, 'first');
  assertEqual(res[1], b, 'second');
});

test('BT-3: repeats when not enough targets', () => {
  const a = { id: 'a' };
  const b = { id: 'b' };
  const res = Targeting.pickBurstTargets([a, b], 3);
  assertEqual(res.length, 3, 'length');
  assertEqual(res[0], a, 'first');
  assertEqual(res[1], b, 'second');
  assertEqual(res[2], a, 'repeat');
});

test('BT-4: single target repeats', () => {
  const a = { id: 'a' };
  const res = Targeting.pickBurstTargets([a], 3);
  assertEqual(res.length, 3, 'length');
  assertEqual(res[0], a, 'first');
  assertEqual(res[1], a, 'second');
  assertEqual(res[2], a, 'third');
});

test('BT-5: empty candidates -> empty', () => {
  const res = Targeting.pickBurstTargets([], 3);
  assertEqual(res.length, 0, 'length');
});

// Summary
console.log('\n═══════════════════════════');
console.log('BurstTargeting: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(f => console.log('  - ' + f.name + ': ' + f.error));
}
console.log('═══════════════════════════\n');
process.exit(failCount > 0 ? 1 : 0);
