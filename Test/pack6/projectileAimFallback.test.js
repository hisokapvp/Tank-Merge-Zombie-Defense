/**
 * Pack 6 — Projectile aim fallback tests.
 * Run: node Test/pack6/projectileAimFallback.test.js
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

console.log('\n── Pack 6: Projectile aim fallback ──');

test('PA-1: updateProjectileAim updates toX/toY when target alive', () => {
  const proj = { toX: 1, toY: 2, toZombieId: 7 };
  const target = { id: 7, state: 'alive' };
  Targeting.updateProjectileAim(proj, target, () => ({ x: 10, y: 20 }));
  assertEqual(proj.toX, 10, 'toX');
  assertEqual(proj.toY, 20, 'toY');
  assertEqual(proj.toZombieId, 7, 'id stays');
});

test('PA-2: updateProjectileAim keeps last aim when target dying', () => {
  const proj = { toX: 5, toY: 6, toZombieId: 9 };
  const target = { id: 9, state: 'dying' };
  Targeting.updateProjectileAim(proj, target, () => ({ x: 100, y: 200 }));
  assertEqual(proj.toX, 5, 'toX');
  assertEqual(proj.toY, 6, 'toY');
  assertEqual(proj.toZombieId, null, 'id cleared');
});

test('PA-3: updateProjectileAim ignores missing target', () => {
  const proj = { toX: 3, toY: 4, toZombieId: 2 };
  Targeting.updateProjectileAim(proj, null, () => ({ x: 9, y: 9 }));
  assertEqual(proj.toX, 3, 'toX');
  assertEqual(proj.toY, 4, 'toY');
  assertEqual(proj.toZombieId, 2, 'id stays');
});

// Summary
console.log('\n═══════════════════════════');
console.log('ProjectileAimFallback: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(f => console.log('  - ' + f.name + ': ' + f.error));
}
console.log('═══════════════════════════\n');
process.exit(failCount > 0 ? 1 : 0);
