/**
 * Pack 4 — Profiler stress tests.
 * Run: node Test/pack4/perf_stress.test.js
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

loadModule('src/perf/profiler.js');

const Profiler = global.Game.Profiler;

// The profiler defaults to disabled unless Game.DEBUG === true (release-mirror
// zero-overhead contract). This pure-Node harness has no DEBUG flag, so it must
// opt in explicitly at boot for start/end/measure to record stats. (Documented
// in src/perf/profiler.js.)
Profiler.setEnabled(true);

console.log('\n── Pack 4: Profiler ──');

test('PROF-1: Profiler exists', () => {
  assert(Profiler, 'Profiler defined');
  assert(typeof Profiler.start === 'function', 'start fn');
  assert(typeof Profiler.end === 'function', 'end fn');
  assert(typeof Profiler.measure === 'function', 'measure fn');
});

test('PROF-2: start/end records stats', () => {
  Profiler.reset();
  Profiler.start('loop');
  for (let i = 0; i < 5000; i++) { Math.sqrt(i); }
  Profiler.end('loop');
  const stats = Profiler.getStats();
  assert(stats.loop, 'loop stats');
  assertEqual(stats.loop.count, 1, 'count');
  assert(stats.loop.totalMs >= 0, 'totalMs >= 0');
});

test('PROF-3: measure returns fn result', () => {
  Profiler.reset();
  const result = Profiler.measure('sum', () => 2 + 3);
  assertEqual(result, 5, 'result');
  const stats = Profiler.getStats();
  assertEqual(stats.sum.count, 1, 'count');
});

test('PROF-4: stress multiple samples', () => {
  Profiler.reset();
  for (let i = 0; i < 200; i++) {
    Profiler.measure('stress', () => {
      for (let j = 0; j < 200; j++) { Math.sin(j); }
    });
  }
  const stats = Profiler.getStats();
  assertEqual(stats.stress.count, 200, 'sample count');
  assert(stats.stress.avgMs >= 0, 'avgMs >= 0');
});

console.log('\n═══════════════════════════');
console.log('Profiler: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(f => console.log('  - ' + f.name + ': ' + f.error));
}
console.log('═══════════════════════════\n');
process.exit(failCount > 0 ? 1 : 0);
