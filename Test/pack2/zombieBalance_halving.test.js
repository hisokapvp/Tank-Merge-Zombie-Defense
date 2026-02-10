/**
 * Pack 2 — Zombie balance halving tests.
 * Run: node Test/pack2/zombieBalance_halving.test.js
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

console.log('\n\u2500\u2500 Pack 2: Zombie balance halving \u2500\u2500');

test('ZBH-1: zombieHpBase is 44', () => {
  assert(/zombieHpBase:\s*44\b/.test(code), 'zombieHpBase: 44');
});

test('ZBH-2: zombieKillCoinsMul is 0.5', () => {
  assert(/zombieKillCoinsMul:\s*0\.5\b/.test(code), 'zombieKillCoinsMul: 0.5');
});

test('ZBH-3: zombieKillXpMul is 0.5', () => {
  assert(/zombieKillXpMul:\s*0\.5\b/.test(code), 'zombieKillXpMul: 0.5');
});

test('ZBH-4: kill coins use Math.floor(total * zombieKillCoinsMul)', () => {
  const re = /state\.coins\s*\+=\s*Math\.floor\([\s\S]*?\*\s*BAL\.zombieKillCoinsMul\s*\)/;
  assert(re.test(code), 'coins for kill use Math.floor(... * BAL.zombieKillCoinsMul)');
});

test('ZBH-5: kill XP use Math.floor(total * zombieKillXpMul)', () => {
  const re = /grantXP\(\s*Math\.floor\([\s\S]*?\*\s*BAL\.zombieKillXpMul\s*\)\s*\)/;
  assert(re.test(code), 'xp for kill use Math.floor(... * BAL.zombieKillXpMul)');
});

console.log('\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
console.log('ZombieBalanceHalving: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(f => console.log('  - ' + f.name + ': ' + f.error));
}
console.log('\n');
process.exit(failCount > 0 ? 1 : 0);
