/**
 * Pack 2 — Auto-merge deterministic pairing tests.
 * Run: node Test/pack2/autoMerge.test.js
 */

let passCount = 0;
let failCount = 0;
const failures = [];

function assert(cond, msg) {
  if (!cond) throw new Error('Assertion failed: ' + msg);
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error((msg || 'assertEqual') + ': expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
  }
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

const global = globalThis;
global.window = global;
global.Game = {};

const fs = require('fs');
const path = require('path');
const code = fs.readFileSync(path.resolve(__dirname, '../../src/mechanics/autoMerge.js'), 'utf-8');
const fn = new Function('window', 'global', code);
fn(global, global);

const AutoMerge = global.Game.AutoMerge;

function mkTank(id, level, onTrack, extra) {
  return Object.assign({ id, level, onTrack: !!onTrack }, extra || {});
}

function mkState(cells, unlocked) {
  return {
    cells: cells,
    achievements: { unlocked: unlocked || {} },
  };
}

console.log('\n── Pack 2: Auto-merge ──');

test('AM-1: module loads', () => {
  assert(!!AutoMerge, 'AutoMerge exists');
  assert(typeof AutoMerge.findMergePairs === 'function', 'findMergePairs exists');
});

test('AM-2: excluded requiresAd/locked/fromAdBox are not paired', () => {
  const state = mkState([
    { i: 0, tank: mkTank('a', 1, false, { requiresAd: true }) },
    { i: 1, tank: mkTank('b', 1, false, { locked: true }) },
    { i: 2, tank: mkTank('c', 1, true, { fromAdBox: true }) },
    { i: 3, tank: mkTank('d', 1, true, { fromAdBox: true }) },
  ]);

  const pairs = AutoMerge.findMergePairs({ state, maxPairs: Infinity, includeHangar: true, includeTrack: true, excludeAdBox: true });
  assertEqual(pairs.length, 0, 'no valid pairs');
});

test('AM-3: order is level asc, then hangar slot asc, then track index asc', () => {
  const tB = mkTank('B', 1, false);
  const tD = mkTank('D', 1, false);
  const tE = mkTank('E', 1, true, { trackIndex: 1 });
  const tC = mkTank('C', 1, true, { trackIndex: 5 });
  const tA = mkTank('A', 2, false);

  const state = mkState([
    { i: 0, tank: tA },
    { i: 1, tank: tB },
    { i: 2, tank: tC },
    { i: 3, tank: tD },
    { i: 4, tank: tE },
  ]);

  const pairs = AutoMerge.findMergePairs({ state, maxPairs: Infinity, includeHangar: true, includeTrack: true, excludeAdBox: true });
  assertEqual(pairs.length, 2, 'two pairs');
  assertEqual(pairs[0][0].id, 'B', 'pair1 first is hangar slot 1');
  assertEqual(pairs[0][1].id, 'D', 'pair1 second is hangar slot 3');
  assertEqual(pairs[1][0].id, 'E', 'pair2 first is track index 1');
  assertEqual(pairs[1][1].id, 'C', 'pair2 second is track index 5');
});

test('AM-4: maxPairs limits output and pairs are (0,1),(2,3)', () => {
  const state = mkState([
    { i: 0, tank: mkTank('a', 1, false) },
    { i: 1, tank: mkTank('b', 1, false) },
    { i: 2, tank: mkTank('c', 1, false) },
    { i: 3, tank: mkTank('d', 1, false) },
  ]);

  const pairs = AutoMerge.findMergePairs({ state, maxPairs: 1, includeHangar: true, includeTrack: true, excludeAdBox: true });
  assertEqual(pairs.length, 1, 'limited to one pair');
  assertEqual(pairs[0][0].id, 'a', 'first sequential pair');
  assertEqual(pairs[0][1].id, 'b', 'first sequential pair');
});

test('AM-5: tiers and labels by creator_* unlocks', () => {
  const onePairState = mkState([
    { i: 0, tank: mkTank('a', 1, false) },
    { i: 1, tank: mkTank('b', 1, false) },
  ], {});

  assertEqual(AutoMerge.getAutoMergeTier(onePairState), 'hidden', 'hidden before novice');

  onePairState.achievements.unlocked.creator_novice = true;
  assertEqual(AutoMerge.getAutoMergeTier(onePairState), 'merge2', 'novice tier');

  let model = AutoMerge.getAutoMergeButtonModel(onePairState);
  assertEqual(model.visible, true, 'visible at novice');
  assertEqual(model.enabled, true, 'enabled with one pair');
  assert(model.label.indexOf('2') >= 0, 'label is merge 2');

  onePairState.achievements.unlocked.creator_pro = true;
  model = AutoMerge.getAutoMergeButtonModel(onePairState);
  assert(model.label.indexOf('2') >= 0, 'pro with one pair still shows 2');

  onePairState.cells.push({ i: 2, tank: mkTank('c', 1, false) });
  onePairState.cells.push({ i: 3, tank: mkTank('d', 1, false) });
  model = AutoMerge.getAutoMergeButtonModel(onePairState);
  assert(model.label.indexOf('4') >= 0, 'pro with two pairs shows 4');

  onePairState.achievements.unlocked.creator_expert = true;
  model = AutoMerge.getAutoMergeButtonModel(onePairState);
  assertEqual(AutoMerge.getAutoMergeTier(onePairState), 'mergeAll', 'expert tier');
  assert(model.label.toLowerCase().indexOf('все') >= 0 || model.label.toLowerCase().indexOf('all') >= 0, 'expert label is merge all');
});

test('AM-6: mergeAll uses snapshot pairs (no chain in same click)', () => {
  const state = mkState([
    { i: 0, tank: mkTank('a', 1, false) },
    { i: 1, tank: mkTank('b', 1, false) },
    { i: 2, tank: mkTank('c', 1, false) },
    { i: 3, tank: mkTank('d', 1, false) },
  ], { creator_novice: true, creator_pro: true, creator_expert: true });

  let idCounter = 0;
  function fakeMergeExecutor(leftTank, rightTank) {
    let leftCell = null;
    let rightCell = null;
    for (let i = 0; i < state.cells.length; i++) {
      const cell = state.cells[i];
      if (cell.tank === leftTank) leftCell = cell;
      if (cell.tank === rightTank) rightCell = cell;
    }
    if (!leftCell || !rightCell || !leftCell.tank || !rightCell.tank) return false;
    if (leftCell.tank.level !== rightCell.tank.level) return false;

    const nextLevel = leftCell.tank.level + 1;
    rightCell.tank = mkTank('merged_' + (++idCounter), nextLevel, false);
    leftCell.tank = null;
    return true;
  }

  const result = AutoMerge.runAutoMerge(state, 'mergeAll', { mergePair: fakeMergeExecutor });
  assertEqual(result.totalPairs, 2, 'snapshot has two pairs');
  assertEqual(result.executed, 2, 'exactly two merges executed');

  let level2Count = 0;
  for (let i = 0; i < state.cells.length; i++) {
    if (state.cells[i].tank && state.cells[i].tank.level === 2) level2Count++;
  }
  assertEqual(level2Count, 2, 'no extra third merge from chain reaction');
});

console.log('\n═══════════════════════════');
console.log('AutoMerge: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(f => console.log('  - ' + f.name + ': ' + f.error));
}
console.log('═══════════════════════════\n');
process.exit(failCount > 0 ? 1 : 0);
