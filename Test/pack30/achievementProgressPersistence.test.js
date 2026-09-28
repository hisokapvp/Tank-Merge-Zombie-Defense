'use strict';

/**
 * Pack 30: achievement progress persistence (full stats surface).
 *
 * Bug: «у большинства достижений сбрасывается прогресс после загрузки или
 * после перезагрузки симуляции».
 *
 * Root cause: achievement progress is read from `state.stats.*`
 * (`getProgressValueFromState` in src/mechanics/achievements.js), but
 * `serializeState()` wrote only a 7-field subset of `stats`
 * (tanksMergedCount, tanksBoughtCount, manualFenceRepairsCount,
 * modifierTechUnlocksCount, droneAcquisitionsCount,
 * noRepairAttackWaveStreakCount, currentWaveCount) and
 * `applySavedAchievementStats()` restored the same 7. Every other family
 * (attackWavesCompleted, moneyEarned, perfectFenceWaves, hangarMasterLevel,
 * defenseOrderStreak, maxTankLevel, chipComboTriples, chipCraftFromFragments,
 * achievementsUnlocked, coinsSpent, zombieKills, dustEarnedLifetime,
 * fragmentsAcquired, talent*, survivorWaveCompletions, droneRepairsCompleted,
 * autoMergeActivations, totalLoginDays, bonusBoxesOpened, productionBoxes*,
 * tanksCreatedByLevel) silently reset to 0 on reload. Partial reset was worse:
 * `state` is recreated by createInitialState(), zeroing the whole stats object,
 * and the progress snapshot did not carry it at all.
 *
 * Cases:
 *   ACH-P1  serializeState() persists the WHOLE stats surface (all families).
 *   ACH-P2  Counter dictionaries (tanksCreatedByLevel, zombieKillsBySource,
 *           coinsSpentBySource, productionBoxesOpenedByLevel) survive.
 *   ACH-P3  Legacy ach.* mirrors backfill counters absent from state.stats.
 *   ACH-P4  currentWaveCount stays a persisted per-run field.
 *   ACH-P5  game.js save/restore helpers are generic (no hand-picked subset).
 *   ACH-P6  Partial-reset snapshot carries stats and drops currentWaveCount.
 *   ACH-P7  Restore merges monotonically (Math.max) — never demotes progress.
 *   ACH-P8  saveSchema declares the extended stats surface.
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
const storageJs = fs.readFileSync(path.join(ROOT, 'src/persistence/storage.js'), 'utf-8');
const saveSchema = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/saveSchema.json'), 'utf-8'));

/* ------------------------------------------------------------------ *
 * Sandbox: storage.js only (serializeState is observed via the slot API)
 * ------------------------------------------------------------------ */

function createSandbox() {
  const localStore = {
    _d: {},
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null; },
    setItem: function (k, v) { this._d[k] = String(v); },
    removeItem: function (k) { delete this._d[k]; },
  };
  const sandboxGlobal = {
    localStorage: localStore,
    document: null,
    console: { warn: function () {}, log: function () {}, error: function () {} },
    JSON: JSON,
    Object: Object,
    Number: Number,
    Math: Math,
    Array: Array,
    Date: Date,
    Error: Error,
    String: String,
    setTimeout: function () { return 0; },
    clearTimeout: function () {},
    setInterval: function () { return 0; },
    clearInterval: function () {},
    requestAnimationFrame: function () { return 0; },
    cancelAnimationFrame: function () {},
  };
  sandboxGlobal.window = sandboxGlobal;
  sandboxGlobal.Game = {};

  const code = fs.readFileSync(path.join(ROOT, 'src/persistence/storage.js'), 'utf-8');
  const fn = new Function('window', 'global', 'localStorage', 'console', 'document', code);
  fn(sandboxGlobal, sandboxGlobal, localStore, sandboxGlobal.console, sandboxGlobal.document);

  return { global: sandboxGlobal, reset: function () { localStore._d = {}; } };
}

function saveAndReadPayload(box, state) {
  box.reset();
  const save = box.global.Game.Storage.saveSlot(0, state);
  assert(save && save.ok, 'saveSlot must succeed, error=' + (save && save.error));
  const loaded = box.global.Game.Storage.loadSlot(0);
  assert(loaded && loaded.ok && loaded.payload, 'loadSlot must return a payload');
  return loaded.payload;
}

/** Every achievement family counter that must survive a reload. */
const REQUIRED_COUNTERS = [
  'tanksMergedCount',
  'tanksBoughtCount',
  'manualFenceRepairsCount',
  'modifierTechUnlocksCount',
  'droneAcquisitionsCount',
  'noRepairAttackWaveStreakCount',
  'attackWavesCompletedCount',
  'droneRepairsCompletedCount',
  'autoMergeActivationsCount',
  'coinsSpentTotal',
  'moneyEarnedCount',
  'perfectFenceWavesCount',
  'hangarMasterLevelCount',
  'defenseOrderStreakCount',
  'maxTankLevelCount',
  'chipComboTriplesCount',
  'chipCraftFromFragmentsCount',
  'achievementsUnlockedCount',
  'dustEarnedLifetime',
  'fragmentsAcquired',
  'totalLoginDays',
  'zombieKillsTotal',
  'survivorWaveCompletionsCount',
  'talentPointsSpentTotal',
  'talentBranchesMaxedPeak',
  'talentBranchActivesMaxedPeak',
  'bonusBoxesOpenedCount',
];

/* ------------------------------------------------------------------ *
 * ACH-P1..P4: serializeState() write side
 * ------------------------------------------------------------------ */

test('ACH-P1: serializeState() persists the whole stats surface', function () {
  const box = createSandbox();
  const stats = {};
  for (let i = 0; i < REQUIRED_COUNTERS.length; i++) stats[REQUIRED_COUNTERS[i]] = (i + 1) * 7;

  const payload = saveAndReadPayload(box, { cells: [], stats: stats });
  assert(payload.stats && typeof payload.stats === 'object', 'payload must carry stats');
  for (let i = 0; i < REQUIRED_COUNTERS.length; i++) {
    const key = REQUIRED_COUNTERS[i];
    assertEqual(payload.stats[key], (i + 1) * 7, 'stats.' + key + ' must be persisted');
  }
});

test('ACH-P2: counter dictionaries survive serialization', function () {
  const box = createSandbox();
  const payload = saveAndReadPayload(box, {
    cells: [],
    stats: {
      tanksCreatedByLevel: { '3': 4, '15': 2 },
      zombieKillsBySource: { tank: 10, drone: 3, talent: 1, wall: 0 },
      coinsSpentBySource: { buy: 500 },
      productionBoxesOpenedByLevel: { '1': 6, '4': 2 },
    },
  });
  assertEqual(payload.stats.tanksCreatedByLevel['15'], 2, 'tanksCreatedByLevel must survive');
  assertEqual(payload.stats.zombieKillsBySource.tank, 10, 'zombieKillsBySource must survive');
  assertEqual(payload.stats.coinsSpentBySource.buy, 500, 'coinsSpentBySource must survive');
  assertEqual(payload.stats.productionBoxesOpenedByLevel['4'], 2, 'productionBoxesOpenedByLevel must survive');
});

test('ACH-P3: legacy ach.* mirrors backfill counters absent from state.stats', function () {
  const box = createSandbox();
  const payload = saveAndReadPayload(box, {
    cells: [],
    stats: {},
    achievements: {
      totalAttackWavesCompleted: 12,
      totalMoneyEarned: 900,
      totalPerfectFenceWaves: 5,
      totalHangarMasterLevel: 7,
      totalDefenseOrderStreak: 3,
      totalMaxTankLevel: 9,
      totalChipComboTriples: 2,
      totalChipCraftFromFragments: 4,
      totalAchievementsUnlocked: 11,
      totalCoinsSpent: 1500,
      totalZombieKills: 250,
      dustEarnedLifetime: 60,
      fragmentsAcquired: 8,
      totalLoginDays: 6,
      totalSurvivorWaveCompletions: 1,
      totalTalentPointsSpent: 14,
      totalTalentBranchesMaxed: 2,
      totalTalentBranchActivesMaxed: 1,
    },
  });
  assertEqual(payload.stats.attackWavesCompletedCount, 12, 'attackWavesCompletedCount backfills from mirror');
  assertEqual(payload.stats.moneyEarnedCount, 900, 'moneyEarnedCount backfills from mirror');
  assertEqual(payload.stats.perfectFenceWavesCount, 5, 'perfectFenceWavesCount backfills from mirror');
  assertEqual(payload.stats.hangarMasterLevelCount, 7, 'hangarMasterLevelCount backfills from mirror');
  assertEqual(payload.stats.defenseOrderStreakCount, 3, 'defenseOrderStreakCount backfills from mirror');
  assertEqual(payload.stats.maxTankLevelCount, 9, 'maxTankLevelCount backfills from mirror');
  assertEqual(payload.stats.chipComboTriplesCount, 2, 'chipComboTriplesCount backfills from mirror');
  assertEqual(payload.stats.chipCraftFromFragmentsCount, 4, 'chipCraftFromFragmentsCount backfills from mirror');
  assertEqual(payload.stats.achievementsUnlockedCount, 11, 'achievementsUnlockedCount backfills from mirror');
  assertEqual(payload.stats.coinsSpentTotal, 1500, 'coinsSpentTotal backfills from mirror');
  assertEqual(payload.stats.zombieKillsTotal, 250, 'zombieKillsTotal backfills from mirror');
  assertEqual(payload.stats.dustEarnedLifetime, 60, 'dustEarnedLifetime backfills from mirror');
  assertEqual(payload.stats.fragmentsAcquired, 8, 'fragmentsAcquired backfills from mirror');
  assertEqual(payload.stats.totalLoginDays, 6, 'totalLoginDays backfills from mirror');
  assertEqual(payload.stats.survivorWaveCompletionsCount, 1, 'survivorWaveCompletionsCount backfills from mirror');
  assertEqual(payload.stats.talentPointsSpentTotal, 14, 'talentPointsSpentTotal backfills from mirror');
  assertEqual(payload.stats.talentBranchesMaxedPeak, 2, 'talentBranchesMaxedPeak backfills from mirror');
  assertEqual(payload.stats.talentBranchActivesMaxedPeak, 1, 'talentBranchActivesMaxedPeak backfills from mirror');
});

test('ACH-P4: currentWaveCount stays a persisted per-run field', function () {
  const box = createSandbox();
  const payload = saveAndReadPayload(box, { cells: [], stats: { currentWaveCount: 18 } });
  assertEqual(payload.stats.currentWaveCount, 18, 'currentWaveCount must be persisted');
  assert(storageJs.indexOf('currentWaveCount:') !== -1, 'serializeState must keep the currentWaveCount literal');
});

/* ------------------------------------------------------------------ *
 * ACH-P5..P7: game.js read/write + partial reset
 * ------------------------------------------------------------------ */

test('ACH-P5: game.js save/restore helpers are generic, not a hand-picked subset', function () {
  const serStart = gameJs.indexOf('function getSerializedAchievementStats(){');
  const serEnd = gameJs.indexOf('function applySavedAchievementStats(', serStart);
  assert(serStart !== -1 && serEnd !== -1, 'both helpers must exist');
  const serBody = gameJs.slice(serStart, serEnd);
  assert(serBody.indexOf('for (const key in stats)') !== -1, 'serializer must iterate the whole stats object');
  assert(serBody.indexOf('legacyFallbacks') !== -1, 'serializer must keep legacy mirror fallbacks');

  const appStart = gameJs.indexOf('function applySavedAchievementStats(');
  const appEnd = gameJs.indexOf('\nfunction ', appStart + 10);
  const appBody = gameJs.slice(appStart, appEnd);
  assert(appBody.indexOf('for (const key in savedStats)') !== -1, 'restore must iterate the whole saved stats object');
  assert(appBody.indexOf('Math.max(') !== -1, 'restore must merge monotonically');
});

test('ACH-P6: partial-reset snapshot carries stats and drops currentWaveCount', function () {
  const snapStart = gameJs.indexOf('takeProgressSnapshot: function (snapshotState) {');
  const snapEnd = gameJs.indexOf('restoreProgressSnapshot: function (targetState, snap) {', snapStart);
  assert(snapStart !== -1 && snapEnd !== -1, 'partial-reset snapshot override must exist');
  const snapBody = gameJs.slice(snapStart, snapEnd);
  assert(snapBody.indexOf('snap.stats = statsSnap') !== -1, 'snapshot must capture the stats surface');
  assert(snapBody.indexOf("sk === 'currentWaveCount'") !== -1, 'snapshot must drop the per-run wave counter');

  const resStart = snapEnd;
  const resEnd = gameJs.indexOf('onAfterRestore: function (restoredState) {', resStart);
  const resBody = gameJs.slice(resStart, resEnd);
  assert(resBody.indexOf('snap.stats') !== -1, 'restore must reapply the stats surface');
  assert(resBody.indexOf('Math.max(') !== -1, 'restore must merge monotonically');
});

test('ACH-P7: restore merges monotonically so a stale payload cannot demote progress', function () {
  const appStart = gameJs.indexOf('function applySavedAchievementStats(');
  const appEnd = gameJs.indexOf('\nfunction ', appStart + 10);
  const appBody = gameJs.slice(appStart, appEnd);
  assert(/state\.stats\[key\] = Math\.max\(current, incoming\)/.test(appBody), 'scalar counters merge via Math.max');
  assert(/target\[mk\] = Math\.max\(current, incoming\)/.test(appBody), 'dictionary counters merge via Math.max');
});

/* ------------------------------------------------------------------ *
 * ACH-P8: schema
 * ------------------------------------------------------------------ */

test('ACH-P8: saveSchema declares the extended stats surface', function () {
  assert(saveSchema && saveSchema.properties && saveSchema.properties.stats, 'stats must be a declared schema property');
  const props = saveSchema.properties.stats.properties || {};
  const declared = [
    'attackWavesCompletedCount',
    'moneyEarnedCount',
    'perfectFenceWavesCount',
    'hangarMasterLevelCount',
    'defenseOrderStreakCount',
    'maxTankLevelCount',
    'chipComboTriplesCount',
    'chipCraftFromFragmentsCount',
    'achievementsUnlockedCount',
    'coinsSpentTotal',
    'zombieKillsTotal',
    'dustEarnedLifetime',
    'fragmentsAcquired',
    'totalLoginDays',
    'survivorWaveCompletionsCount',
    'talentPointsSpentTotal',
    'talentBranchesMaxedPeak',
    'talentBranchActivesMaxedPeak',
    'bonusBoxesOpenedCount',
    'currentWaveCount',
  ];
  for (let i = 0; i < declared.length; i++) {
    assert(!!props[declared[i]], 'saveSchema.stats must declare ' + declared[i]);
  }
});

/* ------------------------------------------------------------------ */

console.log('');
console.log('-- Summary --');
console.log('Passed: ' + passCount);
console.log('Failed: ' + failCount);
if (failCount > 0) {
  for (const f of failures) console.log('  * ' + f.name + ': ' + f.error);
  process.exitCode = 1;
} else {
  console.log('All achievement progress persistence checks passed.');
}
