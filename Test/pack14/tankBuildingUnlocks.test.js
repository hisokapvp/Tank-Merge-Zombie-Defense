/**
 * Pack 14 — tank_building family unlock + reward parity test.
 *
 * Контракт (batch tank-building):
 *   1) tank_building_1 — создать 5 танков 15 уровня  → offset 4
 *   2) tank_building_2 — создать 5 танков 30 уровня  → offset 3
 *   3) tank_building_3 — создать 10 танков 45 уровня → offset 2
 *   4) tank_building_4 — создать 10 танков 60 уровня → offset 1
 *
 * Canonical counter: state.stats.tanksCreatedByLevel = { "15": N, "45": M, ... }
 * Инкремент только через Game.Achievements.recordTankCreatedAtLevel из
 * real-creation seam (game.js recordTankLevel с cause !== 'seed').
 *
 * Награда — пассивный модификатор (type 'buyLevelOffset' в REWARD_TABLE):
 * предметов не выдаёт, способность читается через getBuyLevelOffset(state).
 *
 * Run: node Test/pack14/tankBuildingUnlocks.test.js
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
loadModule('src/mechanics/economy.js');

const Achievements = globalCtx.Game.Achievements;
const Rewards = globalCtx.Game.AchievementRewards;
const Economy = globalCtx.Game.Economy;

function makeState() {
  return {
    coins: 0,
    stats: {},
    achievements: { unlocked: {}, rewarded: {}, popupQueue: [], counters: {} },
  };
}

// ─────────────────────────────────────────────────────────────────────────
// TB-1: family зарегистрирована с правильными thresholds
// ─────────────────────────────────────────────────────────────────────────
test('TB-1: family tank_building зарегистрирована (4 тира)', () => {
  const defs = Achievements.getDefinitions().filter((d) => d.familyId === 'tank_building');
  assertEqual(defs.length, 4, 'tank_building must have 4 tiers');
  assertEqual(defs[0].progressLevel, 15, 'tier 1 level');
  assertEqual(defs[0].target, 5, 'tier 1 target');
  assertEqual(defs[1].progressLevel, 30, 'tier 2 level');
  assertEqual(defs[1].target, 5, 'tier 2 target');
  assertEqual(defs[2].progressLevel, 45, 'tier 3 level');
  assertEqual(defs[2].target, 10, 'tier 3 target');
  assertEqual(defs[3].progressLevel, 60, 'tier 4 level');
  assertEqual(defs[3].target, 10, 'tier 4 target');
});

// ─────────────────────────────────────────────────────────────────────────
// TB-2: recorder + unlock thresholds
// ─────────────────────────────────────────────────────────────────────────
test('TB-2: 5 танков 15 уровня → unlock tier 1, offset 4', () => {
  const st = makeState();
  for (let i = 0; i < 4; i++) Achievements.recordTankCreatedAtLevel(st, 15);
  assert(!st.achievements.unlocked.tank_building_1, 'must not unlock at 4');
  Achievements.recordTankCreatedAtLevel(st, 15);
  assert(st.achievements.unlocked.tank_building_1, 'must unlock at 5');
  assertEqual(Achievements.getBuyLevelOffset(st), 4, 'offset after tier 1');
});

test('TB-3: 10 танков 45 уровня → unlock tier 3, offset 2', () => {
  const st = makeState();
  for (let i = 0; i < 9; i++) Achievements.recordTankCreatedAtLevel(st, 45);
  assert(!st.achievements.unlocked.tank_building_3, 'must not unlock at 9');
  Achievements.recordTankCreatedAtLevel(st, 45);
  assert(st.achievements.unlocked.tank_building_3, 'must unlock at 10');
  assertEqual(Achievements.getBuyLevelOffset(st), 2, 'offset after tier 3');
});

test('TB-4: уровни не смешиваются — 15 и 45 считаются раздельно', () => {
  const st = makeState();
  for (let i = 0; i < 5; i++) Achievements.recordTankCreatedAtLevel(st, 15);
  for (let i = 0; i < 5; i++) Achievements.recordTankCreatedAtLevel(st, 45);
  assert(st.achievements.unlocked.tank_building_1, 'tier 1 unlocked');
  assert(!st.achievements.unlocked.tank_building_3, 'tier 3 must NOT unlock from mixed levels');
  assertEqual(st.stats.tanksCreatedByLevel['15'], 5, 'level 15 counter');
  assertEqual(st.stats.tanksCreatedByLevel['45'], 5, 'level 45 counter');
});

// ─────────────────────────────────────────────────────────────────────────
// TB-5: offset ladder — максимальный unlocked тир побеждает
// ─────────────────────────────────────────────────────────────────────────
test('TB-5: offset ladder 5 → 4 → 3 → 2 → 1', () => {
  const st = makeState();
  assertEqual(Achievements.getBuyLevelOffset(st), 5, 'base offset');
  st.achievements.unlocked.tank_building_1 = true;
  assertEqual(Achievements.getBuyLevelOffset(st), 4, 'tier 1');
  st.achievements.unlocked.tank_building_2 = true;
  assertEqual(Achievements.getBuyLevelOffset(st), 3, 'tier 2');
  st.achievements.unlocked.tank_building_3 = true;
  assertEqual(Achievements.getBuyLevelOffset(st), 2, 'tier 3');
  st.achievements.unlocked.tank_building_4 = true;
  assertEqual(Achievements.getBuyLevelOffset(st), 1, 'tier 4');
});

// ─────────────────────────────────────────────────────────────────────────
// TB-6: интеграция с economy — IV тир достижим (cap 59)
// ─────────────────────────────────────────────────────────────────────────
test('TB-6: max=60 + offset 1 → 59 (награда IV тира не срезается cap)', () => {
  assertEqual(Economy.computeBuyTankLevel(60, 1), 59, 'tier 4 buy level');
  assertEqual(Economy.MAX_BUY_TANK_LEVEL, 59, 'cap raised to 59');
  assertEqual(Economy.DEFAULT_BUY_LEVEL_OFFSET, 5, 'default offset');
});

// ─────────────────────────────────────────────────────────────────────────
// TB-7: reward mode — declarative, не выдаёт предметов
// ─────────────────────────────────────────────────────────────────────────
test('TB-7: REWARD_TABLE содержит buyLevelOffset с правильными amount', () => {
  const table = Rewards.REWARD_TABLE;
  assertEqual(table.tankBuildingOffset4.type, 'buyLevelOffset', 'tier 1 type');
  assertEqual(table.tankBuildingOffset4.amount, 4, 'tier 1 amount');
  assertEqual(table.tankBuildingOffset3.amount, 3, 'tier 2 amount');
  assertEqual(table.tankBuildingOffset2.amount, 2, 'tier 3 amount');
  assertEqual(table.tankBuildingOffset1.amount, 1, 'tier 4 amount');
});

test('TB-8: grantByTable не обрабатывает buyLevelOffset (пассивный модификатор)', () => {
  const st = makeState();
  const def = Achievements.getDefinitions().find((d) => d.id === 'tank_building_1');
  const granted = Rewards.grant(st, def);
  assertEqual(granted, false, 'buyLevelOffset must not grant items');
});

// ─────────────────────────────────────────────────────────────────────────
// TB-9: i18n parity — ключи есть в ru/en/fallback
// ─────────────────────────────────────────────────────────────────────────
test('TB-9: i18n keys present in ru.json / en.json / fallbackStrings.js', () => {
  const root = path.resolve(__dirname, '../..');
  const ru = fs.readFileSync(path.join(root, 'src/i18n/ru.json'), 'utf-8');
  const en = fs.readFileSync(path.join(root, 'src/i18n/en.json'), 'utf-8');
  const fb = fs.readFileSync(path.join(root, 'src/i18n/fallbackStrings.js'), 'utf-8');
  for (const tier of [1, 2, 3, 4]) {
    for (const suffix of ['', 'Desc']) {
      const key = 'achievementTankBuilding' + tier + suffix;
      assert(ru.indexOf(key) >= 0, 'ru.json missing key ' + key);
      assert(en.indexOf(key) >= 0, 'en.json missing key ' + key);
      assert(fb.indexOf(key) >= 0, 'fallbackStrings.js missing key ' + key);
    }
    const rewardKey = 'achievementRewardTankBuilding' + tier;
    assert(ru.indexOf(rewardKey) >= 0, 'ru.json missing reward key ' + rewardKey);
    assert(en.indexOf(rewardKey) >= 0, 'en.json missing reward key ' + rewardKey);
    assert(fb.indexOf(rewardKey) >= 0, 'fallbackStrings.js missing reward key ' + rewardKey);
  }
  assert(ru.indexOf('buyTankBonusTooltip') >= 0, 'ru.json missing buyTankBonusTooltip');
  assert(en.indexOf('buyTankBonusTooltip') >= 0, 'en.json missing buyTankBonusTooltip');
  assert(fb.indexOf('buyTankBonusTooltip') >= 0, 'fallbackStrings.js missing buyTankBonusTooltip');
});

// ─────────────────────────────────────────────────────────────────────────
// TB-10: persistence — счётчик сериализуется и восстанавливается
// ─────────────────────────────────────────────────────────────────────────
test('TB-10: tanksCreatedByLevel присутствует в initialState и saveSchema', () => {
  const root = path.resolve(__dirname, '../..');
  const initSrc = fs.readFileSync(path.join(root, 'src/persistence/initialState.js'), 'utf-8');
  const schemaSrc = fs.readFileSync(path.join(root, 'assets/saveSchema.json'), 'utf-8');
  assert(initSrc.indexOf('tanksCreatedByLevel') >= 0, 'initialState must declare tanksCreatedByLevel');
  assert(schemaSrc.indexOf('tanksCreatedByLevel') >= 0, 'saveSchema must declare tanksCreatedByLevel');
});

// ─────────────────────────────────────────────────────────────────────────
// TB-11: seed/restore gating — recordTankLevel принимает cause
// ─────────────────────────────────────────────────────────────────────────
test('TB-11: game.js recordTankLevel гейтит seed-путь', () => {
  const root = path.resolve(__dirname, '../..');
  const gameSrc = fs.readFileSync(path.join(root, 'game.js'), 'utf-8');
  assert(/function recordTankLevel\(level,\s*cause\)/.test(gameSrc),
    'recordTankLevel must accept cause param');
  assert(/recordTankLevel\(1,\s*'seed'\)/.test(gameSrc),
    'spawnInitialTanksLvl1 must pass seed cause');
  assert(/cause !== 'seed'/.test(gameSrc),
    'recordTankLevel must gate seed path');
});

// ─────────────────────────────────────────────────────────────────────────
// TB-12: game.js early-return для buyLevelOffset
// ─────────────────────────────────────────────────────────────────────────
test('TB-12: grantAchievementReward делает early-return для buyLevelOffset', () => {
  const root = path.resolve(__dirname, '../..');
  const gameSrc = fs.readFileSync(path.join(root, 'game.js'), 'utf-8');
  assert(/entry\.type === 'buyLevelOffset'/.test(gameSrc),
    'grantAchievementReward must handle buyLevelOffset');
  assert(/getBuyLevelOffset/.test(gameSrc),
    'game.js must consume getBuyLevelOffset');
});

console.log('\n' + '='.repeat(60));
console.log('TankBuildingUnlocks: ' + passCount + ' passed, ' + failCount + ' failed');
if (failCount > 0) {
  console.log('='.repeat(60));
  for (const f of failures) console.log('  - ' + f.name + ': ' + f.error);
}
console.log('='.repeat(60));

process.exit(failCount > 0 ? 1 : 0);
