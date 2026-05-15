/**
 * Pack 11 — meta_hoarder family unlock + reward parity test.
 *
 * Контракт (solo-pipeline-yandex-vk batch#1, items 1-3):
 *   1) meta_hoarder_1 — counter=25 — 5 random chips
 *   2) meta_hoarder_2 — counter=75 — 3 upgrade points + 500000 damage points
 *   3) meta_hoarder_3 — counter=150 — 5 upgrade points + 15 random chips
 *
 * Canonical pipeline (production-equivalent):
 *   const unlocked = Game.Achievements.recalculateUnlocks(state) || [];
 *   for (const id of unlocked) Game.AchievementRewards.grant(state, def);
 *
 * Проверяется:
 *   - unlock logic в recalculateUnlocks();
 *   - self-counting guard (familyId !== 'meta_hoarder' skip в инкременте);
 *   - REWARD_TABLE / ATOMIC_REWARD_MODES integrity;
 *   - composite dispatch (upgradePoints + damagePoints / upgradePoints + randomChips);
 *   - point→raw conversion (DAMAGE_PROGRESS_PER_POINT=10000);
 *   - rewarded[id] flag set after grant + idempotence.
 *
 * Run: node Test/pack11/metaHoarderUnlocks.test.js
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

assert(!!Achievements, 'Game.Achievements module must load');
assert(!!Rewards, 'Game.AchievementRewards module must load');
assert(typeof Rewards.grant === 'function', 'Rewards.grant must be a function');
assert(!!Rewards.REWARD_TABLE, 'Rewards.REWARD_TABLE must be exported');

const META_DEFS = Achievements.getDefinitions().filter(d => d.familyId === 'meta_hoarder');
assertEqual(META_DEFS.length, 3, 'exactly three meta_hoarder definitions');

function getDef(id) {
  for (let i = 0; i < META_DEFS.length; i++) if (META_DEFS[i].id === id) return META_DEFS[i];
  return null;
}

function stateWithUnlockedCount(count) {
  const state = { stats: { achievementsUnlockedCount: count } };
  Achievements.ensureState(state);
  return state;
}

function getUnlocked(state) {
  if (!state.achievements || !state.achievements.unlocked) return [];
  return Object.keys(state.achievements.unlocked)
    .filter(k => !!state.achievements.unlocked[k])
    .sort();
}

console.log('\n\u2500\u2500 Pack 11: meta_hoarder unlock + reward parity \u2500\u2500');

// ─────────────────────────────────────────────────────────────────────────
// META-HOARDER-1: REWARD_TABLE integrity
// ─────────────────────────────────────────────────────────────────────────
test('META-HOARDER-1a: REWARD_TABLE has metaHoarder1RandomChips5 entry', () => {
  const entry = Rewards.REWARD_TABLE.metaHoarder1RandomChips5;
  assert(!!entry, 'entry must exist');
  assertEqual(entry.type, 'randomChips', 'metaHoarder1 reward type must be randomChips');
  assertEqual(entry.amount, 5, 'metaHoarder1 amount must be 5');
});

test('META-HOARDER-1b: REWARD_TABLE has composite metaHoarder2Upgrade3Damage500000', () => {
  const entry = Rewards.REWARD_TABLE.metaHoarder2Upgrade3Damage500000;
  assert(!!entry, 'entry must exist');
  assertEqual(entry.type, 'composite', 'metaHoarder2 type must be composite');
  assert(Array.isArray(entry.items) && entry.items.length === 2, 'composite items must have length 2');
  const upgradeItem = entry.items.find(i => i.type === 'upgradePoints');
  const damageItem = entry.items.find(i => i.type === 'damagePoints');
  assert(!!upgradeItem && !!damageItem, 'composite items must contain upgradePoints + damagePoints');
  assertEqual(upgradeItem.amount, 3, 'metaHoarder2 upgradePoints amount must be 3');
  assertEqual(damageItem.amount, 500000, 'metaHoarder2 damagePoints amount must be 500000');
});

test('META-HOARDER-1c: REWARD_TABLE has composite metaHoarder3Upgrade5RandomChips15', () => {
  const entry = Rewards.REWARD_TABLE.metaHoarder3Upgrade5RandomChips15;
  assert(!!entry, 'entry must exist');
  assertEqual(entry.type, 'composite', 'metaHoarder3 type must be composite');
  const upgradeItem = entry.items.find(i => i.type === 'upgradePoints');
  const chipsItem = entry.items.find(i => i.type === 'randomChips');
  assert(!!upgradeItem && !!chipsItem, 'composite items must contain upgradePoints + randomChips');
  assertEqual(upgradeItem.amount, 5, 'metaHoarder3 upgradePoints amount must be 5');
  assertEqual(chipsItem.amount, 15, 'metaHoarder3 randomChips amount must be 15');
});

// ─────────────────────────────────────────────────────────────────────────
// META-HOARDER-2: unlock logic — counter thresholds 25 / 75 / 150
// ─────────────────────────────────────────────────────────────────────────
test('META-HOARDER-2a: counter=25 unlocks meta_hoarder_1 only', () => {
  const state = stateWithUnlockedCount(25);
  Achievements.recalculateUnlocks(state);
  const all = getUnlocked(state);
  assert(all.includes('meta_hoarder_1'), 'meta_hoarder_1 must unlock at counter=25');
  assert(!all.includes('meta_hoarder_2'), 'meta_hoarder_2 must NOT unlock at counter=25');
  assert(!all.includes('meta_hoarder_3'), 'meta_hoarder_3 must NOT unlock at counter=25');
});

test('META-HOARDER-2b: counter=75 unlocks _1 + _2 (not _3)', () => {
  const state = stateWithUnlockedCount(75);
  Achievements.recalculateUnlocks(state);
  const all = getUnlocked(state);
  assert(all.includes('meta_hoarder_1'), 'meta_hoarder_1 at 75');
  assert(all.includes('meta_hoarder_2'), 'meta_hoarder_2 at 75');
  assert(!all.includes('meta_hoarder_3'), 'meta_hoarder_3 must NOT unlock at 75');
});

test('META-HOARDER-2c: counter=150 unlocks all three tiers', () => {
  const state = stateWithUnlockedCount(150);
  Achievements.recalculateUnlocks(state);
  const all = getUnlocked(state);
  assert(all.includes('meta_hoarder_1') && all.includes('meta_hoarder_2') && all.includes('meta_hoarder_3'),
    'all three must unlock at 150');
});

test('META-HOARDER-2d: counter=24 unlocks nothing in family', () => {
  const state = stateWithUnlockedCount(24);
  Achievements.recalculateUnlocks(state);
  const all = getUnlocked(state);
  assert(!all.includes('meta_hoarder_1'), 'meta_hoarder_1 must NOT unlock below threshold');
});

// ─────────────────────────────────────────────────────────────────────────
// META-HOARDER-3: self-counting guard
// ─────────────────────────────────────────────────────────────────────────
test('META-HOARDER-3: unlocking meta_hoarder tiers does NOT increment counter', () => {
  const state = stateWithUnlockedCount(150);
  Achievements.recalculateUnlocks(state);
  assertEqual(state.stats.achievementsUnlockedCount, 150,
    'counter must stay at 150 — meta_hoarder family excluded from increment');
});

// ─────────────────────────────────────────────────────────────────────────
// META-HOARDER-4: canonical reward grant via Game.AchievementRewards.grant
// Simulates production pipeline (game.js: reconcileAchievementRewards →
// grantAchievementReward → AchievementRewards.grant).
// ─────────────────────────────────────────────────────────────────────────
test('META-HOARDER-4a: meta_hoarder_2 grant credits 500000 damage points via raw conversion (point→raw=10000)', () => {
  const state = stateWithUnlockedCount(75);
  state.totalDamageDealtRaw = 0;
  state.damagePointsSpent = 0;
  state.player = { damagePoints: 0 };
  Achievements.recalculateUnlocks(state);
  const def = getDef('meta_hoarder_2');
  const granted = Rewards.grant(state, def);
  assert(granted, 'Rewards.grant must succeed for meta_hoarder_2');
  // 500000 damagePoints * 10000 raw/point = 5,000,000,000 raw
  const expectedRaw = 500000 * 10000;
  assert(state.totalDamageDealtRaw >= expectedRaw,
    'totalDamageDealtRaw must be >= ' + expectedRaw + ', got ' + state.totalDamageDealtRaw);
  assertEqual(state.player.damagePoints, 500000,
    'player.damagePoints must equal 500000 after grant');
});

test('META-HOARDER-4b: meta_hoarder_2 grant credits 3 upgrade points (talentsV2.freePoints)', () => {
  const state = stateWithUnlockedCount(75);
  state.totalDamageDealtRaw = 0;
  state.damagePointsSpent = 0;
  state.player = { damagePoints: 0 };
  Achievements.recalculateUnlocks(state);
  const def = getDef('meta_hoarder_2');
  Rewards.grant(state, def);
  assert(state.player.talentsV2 && state.player.talentsV2.freePoints >= 3,
    'talentsV2.freePoints must be >= 3, got ' +
    (state.player.talentsV2 ? state.player.talentsV2.freePoints : 'no talentsV2'));
});

test('META-HOARDER-4c: meta_hoarder_3 grant credits 5 upgrade points + 15 random chips', () => {
  const state = stateWithUnlockedCount(150);
  state.player = { damagePoints: 0 };
  Achievements.recalculateUnlocks(state);
  // Mock HangarChipsUI + HangarChips.allChips so randomChips sub-item can succeed.
  // Without mocks, randomChips sub-item returns false → atomic rollback wipes upgrade points too.
  const origUi = globalCtx.Game.HangarChipsUI;
  const origChips = globalCtx.Game.HangarChips;
  let chipsAdded = 0;
  globalCtx.Game.HangarChipsUI = { addPlayerChip: function () { chipsAdded++; return true; } };
  globalCtx.Game.HangarChips = { allChips: [{ id: 'stub-chip' }] };
  try {
    const def = getDef('meta_hoarder_3');
    const granted = Rewards.grant(state, def);
    assert(granted, 'meta_hoarder_3 grant must succeed with mocked chips UI');
    assert(state.player.talentsV2 && state.player.talentsV2.freePoints >= 5,
      'talentsV2.freePoints must be >= 5 after meta_hoarder_3, got ' +
      (state.player.talentsV2 ? state.player.talentsV2.freePoints : 'no talentsV2'));
    assertEqual(chipsAdded, 15, 'addPlayerChip must be called exactly 15 times');
  } finally {
    globalCtx.Game.HangarChipsUI = origUi;
    globalCtx.Game.HangarChips = origChips;
  }
});

// ─────────────────────────────────────────────────────────────────────────
// META-HOARDER-5: rewarded[id] flag set after grant + idempotence
// ─────────────────────────────────────────────────────────────────────────
test('META-HOARDER-5a: rewarded flag set after Rewards.grant for meta_hoarder_2', () => {
  const state = stateWithUnlockedCount(75);
  state.player = { damagePoints: 0 };
  Achievements.recalculateUnlocks(state);
  const def = getDef('meta_hoarder_2');
  Rewards.grant(state, def);
  assert(!!state.achievements.rewarded['meta_hoarder_2'],
    'state.achievements.rewarded[meta_hoarder_2] must be true after grant');
});

test('META-HOARDER-5b: second grant call is no-op (idempotent)', () => {
  const state = stateWithUnlockedCount(75);
  state.player = { damagePoints: 0 };
  Achievements.recalculateUnlocks(state);
  const def = getDef('meta_hoarder_2');
  const first = Rewards.grant(state, def);
  assert(first, 'first grant must succeed');
  const firstUpgrade = state.player.talentsV2.freePoints;
  const second = Rewards.grant(state, def);
  assertEqual(second, false, 'second grant must return false');
  assertEqual(state.player.talentsV2.freePoints, firstUpgrade,
    'upgrade points must not double-credit on repeated grant');
});

// ─────────────────────────────────────────────────────────────────────────
// META-HOARDER-6: ATOMIC_REWARD_MODES rollback parity declared for composite tiers
// ─────────────────────────────────────────────────────────────────────────
test('META-HOARDER-6: composite meta_hoarder modes are declared atomic (rollback parity)', () => {
  const abs = path.resolve(__dirname, '../..', 'src/mechanics/achievementRewards.js');
  const src = fs.readFileSync(abs, 'utf-8');
  assert(/metaHoarder2Upgrade3Damage500000\s*:\s*true/.test(src),
    'ATOMIC_REWARD_MODES must contain metaHoarder2Upgrade3Damage500000');
  assert(/metaHoarder3Upgrade5RandomChips15\s*:\s*true/.test(src),
    'ATOMIC_REWARD_MODES must contain metaHoarder3Upgrade5RandomChips15');
});

// ─────────────────────────────────────────────────────────────────────────
// META-HOARDER-7: i18n parity — keys exist in ru/en/fallback
// ─────────────────────────────────────────────────────────────────────────
test('META-HOARDER-7: i18n keys present in ru.json / en.json / fallbackStrings.js', () => {
  const root = path.resolve(__dirname, '../..');
  const ru = fs.readFileSync(path.join(root, 'src/i18n/ru.json'), 'utf-8');
  const en = fs.readFileSync(path.join(root, 'src/i18n/en.json'), 'utf-8');
  const fb = fs.readFileSync(path.join(root, 'src/i18n/fallbackStrings.js'), 'utf-8');
  for (const tier of [1, 2, 3]) {
    for (const suffix of ['', 'Desc']) {
      const key = 'achievementMetaHoarder' + tier + suffix;
      assert(ru.indexOf(key) >= 0, 'ru.json missing key ' + key);
      assert(en.indexOf(key) >= 0, 'en.json missing key ' + key);
      assert(fb.indexOf(key) >= 0, 'fallbackStrings.js missing key ' + key);
    }
    const rewardKey = 'achievementRewardMetaHoarder' + tier;
    assert(ru.indexOf(rewardKey) >= 0, 'ru.json missing reward key ' + rewardKey);
    assert(en.indexOf(rewardKey) >= 0, 'en.json missing reward key ' + rewardKey);
    assert(fb.indexOf(rewardKey) >= 0, 'fallbackStrings.js missing reward key ' + rewardKey);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────
console.log('\nPack 11 (meta_hoarder unlocks) result: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length > 0) {
  console.log('\nFailed tests:');
  failures.forEach(f => console.log('  - ' + f.name + ': ' + f.error));
  process.exit(1);
}
