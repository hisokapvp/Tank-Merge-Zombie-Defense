/**
 * Pack 7 — Fence square geometry.
 * Run: node Test/pack7/fenceSquareGeometry.test.js
 */

let passCount = 0;
let failCount = 0;
const failures = [];

function assert(condition, message) {
  if (!condition) throw new Error('Assertion failed: ' + message);
}
function assertNear(actual, expected, eps, message) {
  if (Math.abs(actual - expected) > eps) {
    throw new Error((message || 'assertNear') + ': expected ' + expected + ', got ' + actual);
  }
}
function test(name, fn) {
  try { fn(); passCount++; console.log('  \u2713 ' + name); }
  catch (e) { failCount++; failures.push({ name, error: e.message }); console.log('  \u2717 ' + name + ' — ' + e.message); }
}

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const gamePath = path.join(root, 'game.js');
const content = fs.readFileSync(gamePath, 'utf8');

function extractFunctionBody(name) {
  const re = new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\n\\}');
  const match = content.match(re) || content.match(new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\}'));
  return match ? match[1] : null;
}

console.log('\n── Pack 7: Fence square geometry ──');

test('FSG-1: zombieFenceLimit uses square distance', () => {
  const body = extractFunctionBody('zombieFenceLimit');
  assert(!!body, 'zombieFenceLimit function found');

  const zombieFenceLimit = new Function('BAL', 'zombieCollisionRadius', 'z', body);
  const BAL = { fenceRadius: 100, fenceKeepout: 12 };
  const zombieCollisionRadius = () => 5;

  const z0 = { theta: 0 };
  const z90 = { theta: Math.PI / 2 };
  const z45 = { theta: Math.PI / 4 };

  const expectedStraight = 100 + 12 + 5;
  const expectedDiagonal = 100 / Math.max(Math.abs(Math.cos(z45.theta)), Math.abs(Math.sin(z45.theta))) + 12 + 5;

  assertNear(zombieFenceLimit(BAL, zombieCollisionRadius, z0), expectedStraight, 1e-6, 'theta 0');
  assertNear(zombieFenceLimit(BAL, zombieCollisionRadius, z90), expectedStraight, 1e-6, 'theta 90');
  assertNear(zombieFenceLimit(BAL, zombieCollisionRadius, z45), expectedDiagonal, 1e-6, 'theta 45');
});

console.log('\n═══════════════════════════');
console.log('FenceSquareGeometry: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(f => console.log('  - ' + f.name + ': ' + f.error));
}
console.log('═══════════════════════════\n');
process.exit(failCount > 0 ? 1 : 0);
