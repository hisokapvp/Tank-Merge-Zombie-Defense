/**
 * Pack 5 — Perf regression tests (object pool).
 * Run: node Test/pack5/perf_regression.test.js
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

const global = globalThis;
global.window = global;
global.Game = {};

const fs = require('fs');
const path = require('path');

function loadModule(relPath) {
  const code = fs.readFileSync(path.resolve(__dirname, '../..', relPath), 'utf-8');
  const fn = new Function('window', 'global', 'document', 'console', code);
  fn(global, global, {}, console);
}

loadModule('src/perf/objectPool.js');

const Pool = global.Game.ObjectPool;

console.log('\n── Pack 5: Perf regression (ObjectPool) ──');

test('P5-POOL-1: ObjectPool exists', () => {
  assert(Pool, 'ObjectPool defined');
  assert(typeof Pool.create === 'function', 'create fn');
});

test('P5-POOL-2: acquire/release reuses objects', () => {
  const pool = Pool.create({
    max: 2,
    create: () => ({ value: 0 }),
    reset: (obj) => { obj.value = 0; }
  });
  const a = pool.acquire();
  a.value = 42;
  pool.release(a);
  const b = pool.acquire();
  assertEqual(a, b, 'reused instance');
  assertEqual(b.value, 0, 'reset on release');
});

test('P5-POOL-3: pool caps size', () => {
  const pool = Pool.create({ max: 1, create: () => ({}) });
  const a = pool.acquire();
  const b = pool.acquire();
  pool.release(a);
  pool.release(b);
  const stats = pool.stats();
  assertEqual(stats.size, 1, 'size capped');
});

test('P5-POOL-4: stats track totalCreated', () => {
  const pool = Pool.create({ max: 2, create: () => ({}) });
  pool.acquire();
  pool.acquire();
  pool.acquire();
  const stats = pool.stats();
  assertEqual(stats.totalCreated, 3, 'totalCreated increments');
});

console.log('\n═══════════════════════════');
console.log('PerfRegression: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(f => console.log('  - ' + f.name + ': ' + f.error));
}
console.log('═══════════════════════════\n');
process.exit(failCount > 0 ? 1 : 0);
