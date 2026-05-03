/**
 * Pack 10 — Achievements batch parity test.
 *
 * Контракт (solo-pipeline-yandex-vk batch 5, item 20):
 * Один вызов addProgress(state, 'moneyEarned', K*killCoins) должен давать
 * тот же набор unlock-ов, что K последовательных вызовов addProgress с
 * delta=killCoins. Это гарантирует корректность batch-coalescer из Phase 1,
 * который передаёт totalCoinsThisFrame одним вызовом вместо K единичных.
 *
 * Corner case: delta = ровно на границе threshold.
 *
 * Run: node Test/pack10/achievementsBatchParity.test.js
 */

'use strict';

let passCount = 0;
let failCount = 0;
const failures = [];

function assert(cond, msg) {
  if (!cond) throw new Error('Assertion failed: ' + msg);
}

function assertEqual(a, b, msg) {
  if (a !== b) throw new Error((msg || 'assertEqual') + ': expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a));
}

function assertDeepEqualSets(a, b, msg) {
  const sa = JSON.stringify([...a].sort());
  const sb = JSON.stringify([...b].sort());
  if (sa !== sb) throw new Error((msg || 'assertDeepEqualSets') + ':\n  expected ' + sb + '\n  got     ' + sa);
}

function test(name, fn) {
  try {
    fn();
    passCount++;
    console.log('  \u2713 ' + name);
  } catch (e) {
    failCount++;
    failures.push({ name, error: e.message });
    console.log('  \u2717 ' + name + ' \u2014 ' + e.message);
  }
}

const globalCtx = globalThis;
globalCtx.window = globalCtx;
globalCtx.Game = globalCtx.Game || {};

const fs = require('fs');
const path = require('path');

function loadModule(relPath) {
  const abs = path.resolve(__dirname, '../..', relPath);
  const code = fs.readFileSync(abs, 'utf-8');
  const fn = new Function('window', 'global', 'document', 'console', code);
  fn(globalCtx, globalCtx, {}, console);
}

loadModule('src/mechanics/achievements.js');

const { addProgress, ensureState } = globalCtx.Game.Achievements;

/** Create a minimal fresh state for achievements. */
function freshState() {
  return {};
}

/** Get sorted array of unlocked achievement IDs from state. */
function getUnlocked(state) {
  if (!state.achievements || !state.achievements.unlocked) return [];
  return Object.keys(state.achievements.unlocked)
    .filter(k => !!state.achievements.unlocked[k])
    .sort();
}

console.log('\n\u2500\u2500 Pack 10: achievements batch parity \u2500\u2500');

// ─────────────────────────────────────────────────────────────────────────
// ACH-PARITY-1: K individual calls == 1 batch call at the threshold boundary
// killCoins=100, K=100 → total=10,000 crosses stable_income_1 (target=10000)
// ─────────────────────────────────────────────────────────────────────────
test('ACH-PARITY-1: K individual calls == 1 batch call (moneyEarned, stable_income_1)', () => {
  const killCoins = 100;
  const K = 100; // total = 10,000 → crosses stable_income_1 threshold

  const stateIndividual = freshState();
  for (let i = 0; i < K; i++) {
    addProgress(stateIndividual, 'moneyEarned', killCoins);
  }

  const stateBatch = freshState();
  addProgress(stateBatch, 'moneyEarned', killCoins * K);

  const unlockedInd = getUnlocked(stateIndividual);
  const unlockedBatch = getUnlocked(stateBatch);

  assertDeepEqualSets(unlockedBatch, unlockedInd, 'batch unlocks must equal individual unlocks');
  assert(unlockedBatch.includes('stable_income_1'), 'stable_income_1 must be unlocked at totalMoneyEarned=10000');
});

// ─────────────────────────────────────────────────────────────────────────
// ACH-PARITY-2: corner case — exactly at threshold boundary (delta = target)
// One batch call with delta = exactly 10,000 must unlock stable_income_1.
// A sequential approach (9999 + 1) must produce the same result.
// ─────────────────────────────────────────────────────────────────────────
test('ACH-PARITY-2: exact-boundary delta == target unlocks correctly', () => {
  const TARGET = 10000; // stable_income_1 target

  // Sequential approach: TARGET-1 then +1
  const stateSeq = freshState();
  addProgress(stateSeq, 'moneyEarned', TARGET - 1);
  assert(!getUnlocked(stateSeq).includes('stable_income_1'), 'not yet unlocked at TARGET-1');
  addProgress(stateSeq, 'moneyEarned', 1);
  assert(getUnlocked(stateSeq).includes('stable_income_1'), 'unlocked on reaching TARGET via seq approach');

  // Batch approach: single call at exactly TARGET
  const stateBatch = freshState();
  addProgress(stateBatch, 'moneyEarned', TARGET);
  assert(getUnlocked(stateBatch).includes('stable_income_1'), 'batch at exact TARGET must unlock stable_income_1');

  // Parity
  assertDeepEqualSets(getUnlocked(stateBatch), getUnlocked(stateSeq), 'exact-boundary parity: batch == seq');
});

// ─────────────────────────────────────────────────────────────────────────
// ACH-PARITY-3: multiple thresholds crossed — batch vs K individual calls
// killCoins=200, K=5000 → total=1,000,000 crosses stable_income_1 AND _2
// ─────────────────────────────────────────────────────────────────────────
test('ACH-PARITY-3: multiple thresholds bulk parity (stable_income_1 + stable_income_2)', () => {
  const killCoins = 200;
  const K = 5000; // total = 1,000,000

  const stateBatch = freshState();
  addProgress(stateBatch, 'moneyEarned', killCoins * K);

  const stateInd = freshState();
  for (let i = 0; i < K; i++) {
    addProgress(stateInd, 'moneyEarned', killCoins);
  }

  const bUnlocked = getUnlocked(stateBatch);
  const iUnlocked = getUnlocked(stateInd);

  assertDeepEqualSets(bUnlocked, iUnlocked, 'multi-threshold parity must hold');
  assert(bUnlocked.includes('stable_income_1'), 'stable_income_1 must be unlocked');
  assert(bUnlocked.includes('stable_income_2'), 'stable_income_2 must be unlocked at 1M');
});

// ─────────────────────────────────────────────────────────────────────────
// ACH-PARITY-4: delta=0 returns empty array, no spurious unlocks
// ─────────────────────────────────────────────────────────────────────────
test('ACH-PARITY-4: delta=0 returns empty array (no spurious unlocks)', () => {
  const state = freshState();
  const result = addProgress(state, 'moneyEarned', 0);
  assert(Array.isArray(result), 'addProgress must return array');
  assertEqual(result.length, 0, 'delta=0 must return empty array');
  assertEqual(getUnlocked(state).length, 0, 'no achievements unlocked for delta=0');
});

// ─────────────────────────────────────────────────────────────────────────
// ACH-PARITY-5: partial batch (below threshold) → no unlock in both modes
// ─────────────────────────────────────────────────────────────────────────
test('ACH-PARITY-5: below-threshold batch and individual both unlock nothing', () => {
  const killCoins = 50;
  const K = 100; // total = 5,000 → below stable_income_1 (10,000)

  const stateBatch = freshState();
  addProgress(stateBatch, 'moneyEarned', killCoins * K);

  const stateInd = freshState();
  for (let i = 0; i < K; i++) {
    addProgress(stateInd, 'moneyEarned', killCoins);
  }

  const bUnlocked = getUnlocked(stateBatch);
  const iUnlocked = getUnlocked(stateInd);

  assertDeepEqualSets(bUnlocked, iUnlocked, 'below-threshold parity');
  assert(!bUnlocked.includes('stable_income_1'), 'stable_income_1 must NOT be unlocked below threshold');
});

// ─────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────
console.log('\nPack 10 (achievements batch parity) result: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length > 0) {
  console.log('\nFailed tests:');
  failures.forEach(f => console.log('  - ' + f.name + ': ' + f.error));
  process.exit(1);
}
