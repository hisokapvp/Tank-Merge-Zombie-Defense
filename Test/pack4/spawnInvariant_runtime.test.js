/**
 * Pack 4 — Spawn invariant runtime checks.
 * Run: node Test/pack4/spawnInvariant_runtime.test.js
 */

let passCount = 0;
let failCount = 0;
const failures = [];

function assert(cond, msg) {
  if (!cond) throw new Error('Assertion failed: ' + msg);
}
function test(name, fn) {
  try { fn(); passCount++; console.log('  OK ' + name); }
  catch (e) { failCount++; failures.push({ name, error: e.message }); console.log('  FAIL ' + name + ' - ' + e.message); }
}

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const ciScript = fs.readFileSync(path.join(root, 'ci', 'run_tests.sh'), 'utf-8');
const gameCode = fs.readFileSync(path.join(root, 'game.js'), 'utf-8');

console.log('\n-- Pack 4: Spawn invariant runtime --');

test('SIR-1: CI runs Pack 3 zombie spawn alive-only test', () => {
  assert(/Test\/pack3\/zombieSpawnAliveOnly\.test\.js/.test(ciScript), 'run_tests.sh includes zombieSpawnAliveOnly');
});

test('SIR-2: No direct truncation: state.zombies.length = target', () => {
  assert(!/state\.zombies\.length\s*=\s*target/.test(gameCode), 'no state.zombies.length = target pattern');
});

console.log('\n==============================');
console.log('SpawnInvariantRuntime: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(f => console.log('  - ' + f.name + ': ' + f.error));
}
console.log('==============================\n');
process.exit(failCount > 0 ? 1 : 0);
