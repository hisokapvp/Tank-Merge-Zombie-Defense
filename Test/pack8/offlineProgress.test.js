/**
 * Pack 8: offline reward model integration tests.
 * Run: node Test/pack8/offlineProgress.test.js
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

// ── Load modules ──
const fs = require('fs');
const path = require('path');

function loadModule(relPath) {
  const code = fs.readFileSync(path.resolve(__dirname, '../..', relPath), 'utf-8');
  const fn = new Function('window', 'global', 'document', 'console', 'Promise', code);
  fn(global, global, {}, console, Promise);
}

loadModule('src/mechanics/trackQuery.js');
loadModule('src/mechanics/economy.js');
loadModule('src/persistence/offlineRewardModel.js');
loadModule('src/persistence/offlineProgress.js');

const OfflineProgress = global.Game.OfflineProgress;
const RewardModel = global.Game.OfflineRewardModel;

function fireRate(level) {
  return 0.85 + 0.075 * (level - 1);
}
function tankDps(level) {
  const dmg = 7 * Math.pow(1.48, level - 1);
  return dmg * fireRate(level);
}
function zombieHp(level) {
  const dmgScale = Math.pow(1.48, level - 1);
  const extra = 1 + 0.12 * Math.max(0, level - 1);
  return 44 * dmgScale * extra;
}
function coinsPerShot(level) {
  const max = Math.pow(2, 20);
  return Math.min(Math.pow(2, level - 1), max);
}
function coinsPerKill(level) {
  const base = 1 + 0.35 * Math.max(0, level - 1);
  return base * 0.5;
}
function xpPerKill(level) {
  return 9 * Math.pow(2, level - 1) * 0.5;
}

function expectedRewards(levels, elapsedSec, zombieLevel) {
  let coinsFromShots = 0;
  let totalDps = 0;
  for (const lvl of levels) {
    coinsFromShots += coinsPerShot(lvl) * fireRate(lvl) * elapsedSec;
    totalDps += tankDps(lvl);
  }
  const kills = zombieHp(zombieLevel) > 0 ? (totalDps * elapsedSec) / zombieHp(zombieLevel) : 0;
  const coins = Math.floor(coinsFromShots + kills * coinsPerKill(zombieLevel));
  const xp = Math.floor(kills * xpPerKill(zombieLevel));
  return { coins, xp };
}

console.log('\n── Pack 8: Offline rewards ──');

test('P8-1: only on-track tanks count for rewards', () => {
  const state = {
    cells: [
      { tank: { id: 't1', level: 3, onTrack: true } },
      { tank: { id: 't2', level: 10, onTrack: false } },
    ],
  };
  const elapsedMs = 10 * 60 * 1000;
  const rewards = OfflineProgress.computeOfflineRewards(state, elapsedMs);
  const expected = expectedRewards([3], elapsedMs / 1000, 3);
  assertEqual(rewards.coins, expected.coins, 'coins from on-track only');
  assertEqual(rewards.xp, expected.xp, 'xp from on-track only');
});

test('P8-2: elapsed is capped and outputs are non-negative ints', () => {
  const state = { cells: [{ tank: { id: 't1', level: 1, onTrack: true } }] };
  const elapsedMs = 13 * 60 * 60 * 1000;
  const rewards = OfflineProgress.computeOfflineRewards(state, elapsedMs);
  const cap = RewardModel.OFFLINE_CAP_MS;
  const expected = expectedRewards([1], cap / 1000, 1);
  assertEqual(rewards.elapsedMsUsed, cap, 'elapsed capped');
  assertEqual(rewards.coins, expected.coins, 'coins from cap');
  assertEqual(rewards.xp, expected.xp, 'xp from cap');
  assert(rewards.coins >= 0 && rewards.xp >= 0, 'non-negative');
  assert(Number.isInteger(rewards.coins) && Number.isInteger(rewards.xp), 'integer totals');
});

test('P8-3: no on-track tanks yields zero rewards', () => {
  const state = {
    cells: [
      { tank: { id: 't1', level: 2, onTrack: false } },
      { tank: { id: 't2', level: 5, onTrack: false } },
    ],
  };
  const rewards = OfflineProgress.computeOfflineRewards(state, 20 * 60 * 1000);
  assertEqual(rewards.coins, 0, 'coins zero');
  assertEqual(rewards.xp, 0, 'xp zero');
  assertEqual(rewards.elapsedMsUsed, 0, 'elapsed zero when no on-track tanks');
});

// Summary
console.log('\n═══════════════════════════');
console.log('Pack8 OfflineRewards: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(f => console.log('  - ' + f.name + ': ' + f.error));
}
console.log('═══════════════════════════\n');
process.exit(failCount > 0 ? 1 : 0);
