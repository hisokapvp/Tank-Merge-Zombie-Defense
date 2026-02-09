/**
 * Pack 7 — Release integrity script wiring.
 * Run: node Test/pack7/release_integrity.test.js
 */

let passCount = 0;
let failCount = 0;
const failures = [];

function assert(cond, msg) {
  if (!cond) throw new Error('Assertion failed: ' + msg);
}
function test(name, fn) {
  try { fn(); passCount++; console.log('  ✓ ' + name); }
  catch (e) { failCount++; failures.push({ name, error: e.message }); console.log('  ✗ ' + name + ' — ' + e.message); }
}

const fs = require('fs');
const path = require('path');

console.log('\n── Pack 7: Release integrity script ──');

test('RI-1: check_release_integrity.sh exists', () => {
  const p = path.resolve(__dirname, '../..', 'ops/release/check_release_integrity.sh');
  assert(fs.existsSync(p), 'script exists');
});

test('RI-2: build_release.sh invokes integrity check', () => {
  const p = path.resolve(__dirname, '../..', 'ops/release/build_release.sh');
  const content = fs.readFileSync(p, 'utf8');
  assert(content.indexOf('check_release_integrity.sh') !== -1, 'integrity check call present');
});

test('RI-3: integrity script checks required files', () => {
  const p = path.resolve(__dirname, '../..', 'ops/release/check_release_integrity.sh');
  const content = fs.readFileSync(p, 'utf8');
  assert(content.indexOf('index.html') !== -1, 'checks index.html');
  assert(content.indexOf('game.js') !== -1, 'checks game.js');
  assert(content.indexOf('assets/') !== -1, 'checks assets');
  assert(content.indexOf('src/') !== -1, 'checks src');
});

console.log('\n═══════════════════════════');
console.log('Release integrity: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(f => console.log('  - ' + f.name + ': ' + f.error));
}
console.log('═══════════════════════════\n');
process.exit(failCount > 0 ? 1 : 0);
