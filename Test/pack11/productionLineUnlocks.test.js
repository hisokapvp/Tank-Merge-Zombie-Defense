/**
 * Pack 11 — production_line family unlock + reward parity test.
 *
 * Контракт (solo-pipeline-yandex-vk batch#2, items 4-6):
 *   1) production_line_1 — открыть 50 коробок любых уровней — 100 silicon dust
 *   2) production_line_2 — открыть 150 коробок любых уровней — 50 random chip fragments
 *   3) production_line_3 — открыть 50 коробок level 4 — 5 upgrade points + 3 drones lvl 7
 *
 * Canonical counter: state.stats.productionBoxesOpenedByLevel = { "1": N1, "2": N2, ... }
 * Lazy-init в openBox seam (productionLine.js), resolver агрегирует словарь
 * для progressType 'productionBoxesOpenedAny' (sum) / 'productionBoxesOpenedLevel4'.
 *
 * Run: node Test/pack11/productionLineUnlocks.test.js
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

loadModule('src/mechanics/achievementRewards.js');
loadModule('src/mechanics/achievements.js');

const Achievements = globalCtx.Game.Achievements;
const Rewards = globalCtx.Game.AchievementRewards;

assert(!!Achievements, 'Game.Achievements must load');
assert(!!Rewards, 'Game.AchievementRewards must load');
assert(typeof Rewards.grant === 'function', 'Rewards.grant must be a function');
assert(!!Rewards.REWARD_TABLE, 'Rewards.REWARD_TABLE must be exported');

const PL_DEFS = Achievements.getDefinitions().filter(d => d.familyId === 'production_line');
assertEqual(PL_DEFS.length, 3, 'exactly three production_line definitions');

function getDef(id) {
  for (let i = 0; i < PL_DEFS.length; i++) if (PL_DEFS[i].id === id) return PL_DEFS[i];
  return null;
}

function stateWithOpenedCounts(counts) {
  const state = { stats: { productionBoxesOpenedByLevel: Object.assign({}, counts) }, player: {} };
  Achievements.ensureState(state);
  return state;
}

function getUnlocked(state) {
  if (!state.achievements || !state.achievements.unlocked) return [];
  return Object.keys(state.achievements.unlocked).filter(k => !!state.achievements.unlocked[k]).sort();
}

console.log('\n\u2500\u2500 Pack 11: production_line unlock + reward parity \u2500\u2500');

// ─────────────────────────────────────────────────────────────────────────
// PL-1: REWARD_TABLE integrity
// ─────────────────────────────────────────────────────────────────────────
test('PL-1a: REWARD_TABLE has productionLine1Dust100 (atomic dust)', () => {
  const entry = Rewards.REWARD_TABLE.productionLine1Dust100;
  assert(!!entry, 'entry must exist');
  assertEqual(entry.type, 'dust', 'tier 1 type must be dust');
  assertEqual(entry.amount, 100, 'tier 1 amount must be 100');
});

test('PL-1b: REWARD_TABLE has productionLine2Fragments50 (atomic fragments)', () => {
  const entry = Rewards.REWARD_TABLE.productionLine2Fragments50;
  assert(!!entry, 'entry must exist');
  assertEqual(entry.type, 'fragments', 'tier 2 type must be fragments');
  assertEqual(entry.amount, 50, 'tier 2 amount must be 50');
});

test('PL-1c: REWARD_TABLE has composite productionLine3Upgrade5Drones3L7', () => {
  const entry = Rewards.REWARD_TABLE.productionLine3Upgrade5Drones3L7;
  assert(!!entry, 'entry must exist');
  assertEqual(entry.type, 'composite', 'tier 3 type must be composite');
  const upgradeItem = entry.items.find(i => i.type === 'upgradePoints');
  const droneItem = entry.items.find(i => i.type === 'drones');
  assert(!!upgradeItem && !!droneItem, 'composite items must contain upgradePoints + drones');
  assertEqual(upgradeItem.amount, 5, 'tier 3 upgradePoints amount must be 5');
  assertEqual(droneItem.amount, 3, 'tier 3 drones amount must be 3');
  assertEqual(droneItem.level, 7, 'tier 3 drones level must be 7');
});

// ─────────────────────────────────────────────────────────────────────────
// PL-2: unlock logic — progressType resolution
// ─────────────────────────────────────────────────────────────────────────
test('PL-2a: counter {1:50} unlocks production_line_1 only', () => {
  const state = stateWithOpenedCounts({ '1': 50 });
  Achievements.recalculateUnlocks(state);
  const all = getUnlocked(state);
  assert(all.includes('production_line_1'), 'production_line_1 must unlock at 50 any-level');
  assert(!all.includes('production_line_2'), 'production_line_2 must NOT unlock');
  assert(!all.includes('production_line_3'), 'production_line_3 must NOT unlock (no level 4)');
});

test('PL-2b: counter {1:80, 2:70} sums to 150 → unlocks _1 + _2 (not _3)', () => {
  const state = stateWithOpenedCounts({ '1': 80, '2': 70 });
  Achievements.recalculateUnlocks(state);
  const all = getUnlocked(state);
  assert(all.includes('production_line_1'), 'production_line_1 at sum=150');
  assert(all.includes('production_line_2'), 'production_line_2 at sum=150');
  assert(!all.includes('production_line_3'), 'production_line_3 must NOT unlock (no level 4 boxes)');
});

test('PL-2c: counter {4:50} unlocks _1 (any sum) + _3 (level 4) but NOT _2', () => {
  const state = stateWithOpenedCounts({ '4': 50 });
  Achievements.recalculateUnlocks(state);
  const all = getUnlocked(state);
  assert(all.includes('production_line_1'), 'production_line_1 at sum=50');
  assert(!all.includes('production_line_2'), 'production_line_2 must NOT unlock (sum=50<150)');
  assert(all.includes('production_line_3'), 'production_line_3 must unlock at level4=50');
});

test('PL-2d: counter {1:49} unlocks nothing', () => {
  const state = stateWithOpenedCounts({ '1': 49 });
  Achievements.recalculateUnlocks(state);
  const all = getUnlocked(state);
  assert(!all.includes('production_line_1'), 'must NOT unlock below 50');
});

test('PL-2e: missing productionBoxesOpenedByLevel dict (legacy save) yields 0 progress', () => {
  const state = { stats: {}, player: {} };
  Achievements.ensureState(state);
  Achievements.recalculateUnlocks(state);
  const all = getUnlocked(state);
  assert(!all.includes('production_line_1'), 'no dict → no progress → no unlock');
  assert(!all.includes('production_line_2'), 'no dict → no progress → no unlock');
  assert(!all.includes('production_line_3'), 'no dict → no progress → no unlock');
});

// ─────────────────────────────────────────────────────────────────────────
// PL-3: openBox seam — counter increments lazy-init
// ─────────────────────────────────────────────────────────────────────────
test('PL-3: openBox seam initialises and increments productionBoxesOpenedByLevel[String(boxLevel)]', () => {
  // Load productionLine.js in an isolated mini-context (avoid global pollution).
  const sandboxCtx = { Math, Object, Number, String, Array, JSON, console, globalThis: null };
  sandboxCtx.globalThis = sandboxCtx;
  sandboxCtx.window = sandboxCtx;
  sandboxCtx.Game = {};
  const abs = path.resolve(__dirname, '../..', 'src/mechanics/productionLine.js');
  const code = fs.readFileSync(abs, 'utf-8');
  const loader = new Function('window', 'global', 'document', 'console', code);
  loader(sandboxCtx, sandboxCtx, {}, console);
  const ProductionLine = sandboxCtx.Game.ProductionLine || sandboxCtx.Game.productionLine;
  assert(!!ProductionLine && typeof ProductionLine.openBox === 'function',
    'Game.ProductionLine.openBox must exist after loading productionLine.js');

  const state = { coins: 0, kills: 0, stats: {} };
  const pl = ProductionLine.ensureState(state);
  pl.storage = [{ level: 4, guaranteedLootId: '' }];
  ProductionLine.openBox(state, 0);
  assert(!!state.stats.productionBoxesOpenedByLevel,
    'productionBoxesOpenedByLevel must be lazy-initialised by openBox');
  assertEqual(state.stats.productionBoxesOpenedByLevel['4'], 1,
    'level=4 counter must be 1 after one openBox at level 4');

  pl.storage = [{ level: 1, guaranteedLootId: '' }, { level: 1, guaranteedLootId: '' }];
  ProductionLine.openBox(state, 0);
  ProductionLine.openBox(state, 0);
  assertEqual(state.stats.productionBoxesOpenedByLevel['1'], 2,
    'level=1 counter must aggregate to 2 after two openBox at level 1');
  assertEqual(state.stats.productionBoxesOpenedByLevel['4'], 1,
    'level=4 counter must remain 1 (independent dict key)');
});

// ─────────────────────────────────────────────────────────────────────────
// PL-4: canonical reward grant
// ─────────────────────────────────────────────────────────────────────────
test('PL-4a: production_line_1 grant credits 100 dust', () => {
  const state = stateWithOpenedCounts({ '1': 50 });
  state.player = { dust: 0 };
  Achievements.recalculateUnlocks(state);
  // Stub HangarChipsUI for dust crediting path
  const origUi = globalCtx.Game.HangarChipsUI;
  let dustCredited = 0;
  globalCtx.Game.HangarChipsUI = {
    creditSiliconDust: function (amount, source) { dustCredited += amount; return amount; },
  };
  try {
    const def = getDef('production_line_1');
    const granted = Rewards.grant(state, def);
    assert(granted, 'grant must succeed for production_line_1');
    assertEqual(dustCredited, 100, 'creditSiliconDust must be called with 100');
  } finally {
    globalCtx.Game.HangarChipsUI = origUi;
  }
});

test('PL-4b: production_line_2 grant credits 50 fragments', () => {
  const state = stateWithOpenedCounts({ '1': 150 });
  state.player = {};
  Achievements.recalculateUnlocks(state);
  // Stub HangarChipsUI + HangarChips for fragment granter path
  const origUi = globalCtx.Game.HangarChipsUI;
  const origChips = globalCtx.Game.HangarChips;
  let fragmentsAdded = 0;
  globalCtx.Game.HangarChipsUI = {
    addPlayerFragment: function (id, count) { fragmentsAdded += count; return true; },
  };
  // HangarChips.getAllChipDefs() is used by getRandomAchievementFragmentId to pick a fragmentId.
  globalCtx.Game.HangarChips = {
    getAllChipDefs: function () { return [{ id: 'chip_dummy' }]; },
  };
  try {
    const def = getDef('production_line_2');
    const granted = Rewards.grant(state, def);
    assert(granted, 'grant must succeed for production_line_2');
    assertEqual(fragmentsAdded, 50, 'addPlayerFragment must be called 50 times');
  } finally {
    globalCtx.Game.HangarChipsUI = origUi;
    globalCtx.Game.HangarChips = origChips;
  }
});

test('PL-4c: production_line_3 grant credits 5 upgrade points + 3 drones lv. 7', () => {
  const state = stateWithOpenedCounts({ '4': 50 });
  state.player = {};
  Achievements.recalculateUnlocks(state);
  // Mock drone grant: production_line_3 dispatch uses Game._productionLineAddDron if present;
  // otherwise drones fallback to deferredRewards. Conservative path: we provide _productionLineAddDron
  // stub so the composite atomic grant can succeed.
  const origAdd = globalCtx.Game._productionLineAddDron;
  let dronesAdded = 0;
  globalCtx.Game._productionLineAddDron = function (level) {
    dronesAdded++;
    return true;
  };
  try {
    const def = getDef('production_line_3');
    const granted = Rewards.grant(state, def);
    assert(granted, 'grant must succeed for production_line_3 with drone stub');
    assert(state.player.talentsV2 && state.player.talentsV2.freePoints >= 5,
      'talentsV2.freePoints must be >= 5 after production_line_3 grant, got ' +
      (state.player.talentsV2 ? state.player.talentsV2.freePoints : 'no talentsV2'));
    assertEqual(dronesAdded, 3, '_productionLineAddDron must be called exactly 3 times');
  } finally {
    globalCtx.Game._productionLineAddDron = origAdd;
  }
});

// ─────────────────────────────────────────────────────────────────────────
// PL-5: rewarded[id] flag + idempotence
// ─────────────────────────────────────────────────────────────────────────
test('PL-5a: rewarded flag set after grant for production_line_1', () => {
  const state = stateWithOpenedCounts({ '1': 50 });
  state.player = { dust: 0 };
  Achievements.recalculateUnlocks(state);
  const origUi = globalCtx.Game.HangarChipsUI;
  globalCtx.Game.HangarChipsUI = { creditSiliconDust: function (a) { return a; } };
  try {
    const def = getDef('production_line_1');
    Rewards.grant(state, def);
    assert(!!state.achievements.rewarded['production_line_1'],
      'rewarded[production_line_1] must be true after grant');
  } finally {
    globalCtx.Game.HangarChipsUI = origUi;
  }
});

test('PL-5b: second grant call is no-op (idempotent)', () => {
  const state = stateWithOpenedCounts({ '1': 50 });
  state.player = { dust: 0 };
  Achievements.recalculateUnlocks(state);
  const origUi = globalCtx.Game.HangarChipsUI;
  let credits = 0;
  globalCtx.Game.HangarChipsUI = {
    creditSiliconDust: function (a) { credits += a; return a; },
  };
  try {
    const def = getDef('production_line_1');
    const first = Rewards.grant(state, def);
    assert(first, 'first grant must succeed');
    const second = Rewards.grant(state, def);
    assertEqual(second, false, 'second grant must return false');
    assertEqual(credits, 100, 'creditSiliconDust must be called exactly once (no double credit)');
  } finally {
    globalCtx.Game.HangarChipsUI = origUi;
  }
});

// ─────────────────────────────────────────────────────────────────────────
// PL-6: ATOMIC_REWARD_MODES parity for composite tier 3
// ─────────────────────────────────────────────────────────────────────────
test('PL-6: composite production_line_3 is declared atomic (rollback parity)', () => {
  const abs = path.resolve(__dirname, '../..', 'src/mechanics/achievementRewards.js');
  const src = fs.readFileSync(abs, 'utf-8');
  assert(/productionLine3Upgrade5Drones3L7\s*:\s*true/.test(src),
    'ATOMIC_REWARD_MODES must contain productionLine3Upgrade5Drones3L7');
});

// ─────────────────────────────────────────────────────────────────────────
// PL-7: i18n parity — keys exist in ru/en/fallback
// ─────────────────────────────────────────────────────────────────────────
test('PL-7: i18n keys present in ru.json / en.json / fallbackStrings.js', () => {
  const root = path.resolve(__dirname, '../..');
  const ru = fs.readFileSync(path.join(root, 'src/i18n/ru.json'), 'utf-8');
  const en = fs.readFileSync(path.join(root, 'src/i18n/en.json'), 'utf-8');
  const fb = fs.readFileSync(path.join(root, 'src/i18n/fallbackStrings.js'), 'utf-8');
  for (const tier of [1, 2, 3]) {
    for (const suffix of ['', 'Desc']) {
      const key = 'achievementProductionLine' + tier + suffix;
      assert(ru.indexOf(key) >= 0, 'ru.json missing key ' + key);
      assert(en.indexOf(key) >= 0, 'en.json missing key ' + key);
      assert(fb.indexOf(key) >= 0, 'fallbackStrings.js missing key ' + key);
    }
    const rewardKey = 'achievementRewardProductionLine' + tier;
    assert(ru.indexOf(rewardKey) >= 0, 'ru.json missing reward key ' + rewardKey);
    assert(en.indexOf(rewardKey) >= 0, 'en.json missing reward key ' + rewardKey);
    assert(fb.indexOf(rewardKey) >= 0, 'fallbackStrings.js missing reward key ' + rewardKey);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────
console.log('\nPack 11 (production_line unlocks) result: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length > 0) {
  console.log('\nFailed tests:');
  failures.forEach(f => console.log('  - ' + f.name + ': ' + f.error));
  process.exit(1);
}
