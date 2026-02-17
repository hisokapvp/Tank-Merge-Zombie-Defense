/**
 * Pack 3 — Zombie supercomputer targeting tests.
 * Run: node Test/pack3/zombieTargetSupercomputer.test.js
 */

let passCount = 0;
let failCount = 0;
const failures = [];

function assert(cond, msg) {
  if (!cond) throw new Error('Assertion failed: ' + msg);
}

function test(name, fn) {
  try {
    fn();
    passCount++;
    console.log('  ✓ ' + name);
  } catch (e) {
    failCount++;
    failures.push({ name, error: e.message });
    console.log('  ✗ ' + name + ' — ' + e.message);
  }
}

const fs = require('fs');
const path = require('path');
const code = fs.readFileSync(path.resolve(__dirname, '../..', 'game.js'), 'utf-8');

console.log('\n── Pack 3: Zombie target supercomputer ──');

function getStepZombiesBlock() {
  const match = code.match(/function stepZombies\(dt\)\s*\{[\s\S]*?\r?\n\}\r?\n/);
  return match ? match[0] : null;
}

const stepBlock = getStepZombiesBlock();

test('ZTS-1: stepZombies exists', () => {
  assert(stepBlock, 'stepZombies block found');
});

test('ZTS-2: stepZombies can apply supercomputer damage', () => {
  assert(/applySupercomputerDamage\s*\(/.test(stepBlock), 'applySupercomputerDamage(...) is used in stepZombies');
});

test('ZTS-3: stepZombies computes direction to supercomputer via atan2', () => {
  assert(/Math\.atan2\s*\(\s*sc\.y\s*-\s*center\.y\s*,\s*sc\.x\s*-\s*center\.x\s*\)/.test(stepBlock), 'uses Math.atan2(sc.y - center.y, sc.x - center.x) pattern');
});

test('ZTS-4: supercomputer retargeting is side-gated by broken fence map', () => {
  assert(/const\s+brokenFenceSides\s*=\s*getBrokenFenceSidesMap\s*\(\s*\)/.test(stepBlock), 'uses getBrokenFenceSidesMap() in stepZombies');
  assert(/const\s+canTargetSupercomputer\s*=\s*!!brokenFenceSides\[zombieSideKey\]/.test(stepBlock), 'gates supercomputer targeting by zombie side');
});

console.log('\n══════════════════════');
console.log('ZombieTargetSupercomputer: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(f => console.log('  - ' + f.name + ': ' + f.error));
}
console.log('\n');
process.exit(failCount > 0 ? 1 : 0);
