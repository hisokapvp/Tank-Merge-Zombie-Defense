/**
 * Pack 3 (P1) — Zombie spawn alive-only tests.
 * Run: node Test/pack3/zombieSpawnAliveOnly.test.js
 */

let passCount = 0;
let failCount = 0;
const failures = [];

function assert(cond, msg) {
  if (!cond) throw new Error('Assertion failed: ' + msg);
}
function test(name, fn) {
  try { fn(); passCount++; console.log('  \u2713 ' + name); }
  catch (e) { failCount++; failures.push({ name, error: e.message }); console.log('  \u2717 ' + name + ' \u2014 ' + e.message); }
}

const fs = require('fs');
const path = require('path');
const code = fs.readFileSync(path.resolve(__dirname, '../..', 'game.js'), 'utf-8');

console.log('\n\u2500\u2500 Pack 3: Zombie spawn alive-only \u2500\u2500');

function getEnsureBlock() {
  const match = code.match(/function ensureZombieCount\(\)[\s\S]*?\n}\n/);
  return match ? match[0] : null;
}

const ensureBlock = getEnsureBlock();

test('ZSA-1: ensureZombieCount exists', () => {
  assert(ensureBlock, 'ensureZombieCount block found');
});

test('ZSA-2: ensureZombieCount uses BAL.zombieCountTarget', () => {
  assert(/\bBAL\.zombieCountTarget\b/.test(ensureBlock), 'uses BAL.zombieCountTarget');
});

test('ZSA-3: ensureZombieCount does not use state.zombies.length', () => {
  assert(!/state\.zombies\.length/.test(ensureBlock), 'no state.zombies.length usage');
});

test('ZSA-4: ensureZombieCount does not truncate zombies array', () => {
  assert(!/state\.zombies\.length\s*=\s*target/.test(ensureBlock), 'no array truncation');
});

test('ZSA-5: ensureZombieCount spawns by aliveCount', () => {
  assert(/while\s*\(\s*aliveCount\s*<\s*target\s*\)/.test(ensureBlock), 'uses aliveCount for target');
});

test('ZSA-6: dying zombies are skipped in slot loops', () => {
  const skips = ensureBlock.match(/z\.state\s*===\s*['"]dying['"]\)\s*continue/g) || [];
  assert(skips.length >= 2, 'dying skipped in taken and assignment');
});

console.log('\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
console.log('ZombieSpawnAliveOnly: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(f => console.log('  - ' + f.name + ': ' + f.error));
}
console.log('\n');
process.exit(failCount > 0 ? 1 : 0);
