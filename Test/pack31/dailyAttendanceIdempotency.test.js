'use strict';

/**
 * Pack 31: daily_attendance login-tick idempotency.
 *
 * Bug: «загрузил игру — выдали все достижения группы "Постоянный командир",
 * хотя я не заходил 30 разных дней».
 *
 * Root cause: `recordDailyLoginTick()` guards against double-counting with
 * `ach.lastLoginDate` (ISO yyyy-mm-dd UTC). But NEITHER restore path copied
 * that field back into `state.achievements`:
 *   - game.js `restoreFullState()`  (saved.achievements.*)
 *   - game.js `applySavedProgress()` (achievements.*)
 * So on every boot `ach.lastLoginDate` was '' → the guard never matched →
 * `totalLoginDays` incremented on EVERY reload/F5. A handful of reloads in one
 * evening unlocked the whole 2/7/14/30-day family.
 *
 * Cases:
 *   DA-1  recordDailyLoginTick is idempotent within the same UTC day.
 *   DA-2  A new day increments exactly once.
 *   DA-3  ensureStats backfills lastLoginDate from the stats mirror.
 *   DA-4  Both game.js restore paths copy lastLoginDate.
 *   DA-5  saveSchema declares achievements.lastLoginDate.
 *
 * Run: node Test/pack31/dailyAttendanceIdempotency.test.js
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
    console.log('  [OK] ' + name);
  } catch (err) {
    failCount++;
    failures.push({ name: name, error: err.message });
    console.log('  [FAIL] ' + name + ' - ' + err.message);
  }
}

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const gameJs = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf-8');
const saveSchema = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/saveSchema.json'), 'utf-8'));

const globalCtx = globalThis;
globalCtx.window = globalCtx;
globalCtx.Game = globalCtx.Game || {};

function loadModule(rel) {
  const code = fs.readFileSync(path.join(ROOT, rel), 'utf-8');
  const fn = new Function('window', 'global', 'document', 'console', code);
  fn(globalCtx, globalCtx, {}, console);
}
loadModule('src/mechanics/achievementRewards.js');
loadModule('src/mechanics/achievements.js');

const A = globalCtx.Game.Achievements;
assert(!!A && typeof A.recordDailyLoginTick === 'function', 'Game.Achievements.recordDailyLoginTick must exist');

/** Simulate a boot: restore achievements + stats, then run the boot seam. */
function boot(savedAchievements, savedStats) {
  const state = { stats: {}, achievements: {} };
  const ach = A.ensureState(state);
  ach.unlocked = { ...(savedAchievements.unlocked || {}) };
  ach.rewarded = { ...(savedAchievements.rewarded || {}) };
  /* Mirrors the FIXED restore path in game.js. */
  ach.lastLoginDate = typeof savedAchievements.lastLoginDate === 'string'
    ? savedAchievements.lastLoginDate
    : ach.lastLoginDate;
  for (const k in savedStats) state.stats[k] = savedStats[k];
  const unlocked = A.recordDailyLoginTick(state) || [];
  return { state, ach, unlocked };
}

test('DA-1: recordDailyLoginTick is idempotent within the same UTC day', function () {
  const r1 = boot({ unlocked: {}, rewarded: {} }, { totalLoginDays: 0 });
  assertEqual(r1.state.stats.totalLoginDays, 1, 'first boot counts day 1');
  const r2 = boot({ unlocked: {}, rewarded: {}, lastLoginDate: r1.ach.lastLoginDate }, { totalLoginDays: r1.state.stats.totalLoginDays });
  assertEqual(r2.state.stats.totalLoginDays, 1, 'same-day reload must not increment');
  assertEqual(r2.unlocked.length, 0, 'same-day reload must not unlock anything');
  const r3 = boot({ unlocked: {}, rewarded: {}, lastLoginDate: r2.ach.lastLoginDate }, { totalLoginDays: r2.state.stats.totalLoginDays });
  assertEqual(r3.state.stats.totalLoginDays, 1, 'third same-day reload must not increment');
});

test('DA-2: a new day increments exactly once', function () {
  const r = boot({ unlocked: {}, rewarded: {}, lastLoginDate: '2026-09-28' }, { totalLoginDays: 1 });
  assertEqual(r.state.stats.totalLoginDays, 2, 'new day increments once');
  assertEqual(r.ach.lastLoginDate, new Date().toISOString().slice(0, 10), 'anchor advances to today');
});

test('DA-3: ensureStats backfills lastLoginDate from the stats mirror', function () {
  const state = { stats: { totalLoginDays: 4, lastLoginDate: '2026-09-20' }, achievements: {} };
  const ach = A.ensureState(state);
  assertEqual(ach.lastLoginDate, '2026-09-20', 'ach.lastLoginDate backfills from stats mirror');
  assertEqual(state.stats.lastLoginDate, '2026-09-20', 'stats mirror stays in sync');
});

test('DA-4: both game.js restore paths copy lastLoginDate', function () {
  const occurrences = gameJs.split('ach.lastLoginDate = typeof').length - 1;
  assert(occurrences >= 2, 'restoreFullState + applySavedProgress must both restore lastLoginDate (found ' + occurrences + ')');
  assert(gameJs.indexOf('saved.achievements.lastLoginDate') !== -1, 'restoreFullState must read saved.achievements.lastLoginDate');
  assert(gameJs.indexOf('achievements.lastLoginDate') !== -1, 'applySavedProgress must read achievements.lastLoginDate');
});

test('DA-5: saveSchema declares achievements.lastLoginDate', function () {
  const props = (saveSchema.properties.achievements && saveSchema.properties.achievements.properties) || {};
  assert(!!props.lastLoginDate, 'saveSchema.achievements must declare lastLoginDate');
});

console.log('');
console.log('-- Summary --');
console.log('Passed: ' + passCount);
console.log('Failed: ' + failCount);
if (failCount > 0) {
  for (let i = 0; i < failures.length; i++) console.log('  FAIL: ' + failures[i].name + ' - ' + failures[i].error);
  process.exit(1);
}
