'use strict';

/**
 * Pack 11: fence damage persistence (save → load round-trip).
 *
 * Regression guard for two independent bugs that both flattened every wall back
 * to full HP after a save/load cycle:
 *
 *   FDP-1/2/3  serializeState() lost fence HP when `state.fenceSegments` was
 *              transiently EMPTY (post-resize / post-fence-tier-change window) and
 *              only `state.savedFenceState` still held the damage snapshot.
 *   FDP-4      restoreFullState() called syncFenceTierWithMaxTankLevel(), which
 *              internally calls snapshotFenceHpById() and overwrote the freshly
 *              restored `state.savedFenceState` with the PRE-load session's HP,
 *              so the saved damage was discarded before the fence rebuilt.
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

/* ------------------------------------------------------------------ *
 * FDP-1..3: serializeState() fence-HP capture
 * ------------------------------------------------------------------ */

function createStorageHarness() {
  const storage = {};
  const localStore = {
    _d: {},
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null; },
    setItem: function (k, v) { this._d[k] = String(v); },
    removeItem: function (k) { delete this._d[k]; },
  };
  const sandboxGlobal = {
    localStorage: localStore,
    console: { warn: function () {}, log: function () {}, error: function () {} },
    JSON: JSON,
    Object: Object,
    Number: Number,
    Math: Math,
    Array: Array,
    Date: Date,
    Error: Error,
    String: String,
  };
  sandboxGlobal.window = sandboxGlobal;
  sandboxGlobal.Game = {};

  const code = fs.readFileSync(path.resolve(ROOT, 'src/persistence/storage.js'), 'utf-8');
  const fn = new Function('window', 'global', 'localStorage', 'console', code);
  fn(sandboxGlobal, sandboxGlobal, localStore, sandboxGlobal.console);

  storage.api = sandboxGlobal.Game.Storage;
  storage.reset = function () { localStore._d = {}; };
  return storage;
}

const harness = createStorageHarness();
assert(!!harness.api, 'Game.Storage must export after load');
assert(typeof harness.api.saveSlot === 'function', 'Game.Storage.saveSlot must exist');
assert(typeof harness.api.loadSlot === 'function', 'Game.Storage.loadSlot must exist');

function roundTripFenceState(state) {
  harness.reset();
  const save = harness.api.saveSlot(0, state);
  assert(save && save.ok, 'saveSlot should succeed, error=' + (save && save.error));
  const loaded = harness.api.loadSlot(0);
  assert(loaded && loaded.ok && loaded.payload, 'loadSlot should return a payload');
  return loaded.payload.fenceState;
}

test('FDP-1: live damaged segments are persisted with their real HP', function () {
  const fenceState = roundTripFenceState({
    fenceSegments: [
      { id: 'sideTop#0', hp: 42 },
      { id: 'sideTop#1', hp: 0 },
      { id: 'cornerTL', hp: 7 },
    ],
    fenceSegmentsMeta: { segmentsPerSide: 7 },
  });
  assert(!!fenceState, 'fenceState must be present in payload');
  assertEqual(fenceState.segmentsPerSide, 7, 'segmentsPerSide');
  assertEqual(fenceState.hpById['sideTop#0'], 42, 'sideTop#0 hp');
  assertEqual(fenceState.hpById['sideTop#1'], 0, 'broken segment must stay at 0');
  assertEqual(fenceState.hpById['cornerTL'], 7, 'cornerTL hp');
});

test('FDP-2: damage survives when fenceSegments is empty and only savedFenceState holds it', function () {
  // Post-resize / post-tier-change window: game.js cleared state.fenceSegments
  // after snapshotFenceHpById() moved the damage into state.savedFenceState.
  const fenceState = roundTripFenceState({
    fenceSegments: [],
    fenceSegmentsMeta: null,
    savedFenceState: {
      segmentsPerSide: 7,
      hpById: { 'sideTop#0': 33, 'sideTop#3': 0 },
    },
  });
  assert(!!fenceState, 'fenceState must be present in payload');
  assertEqual(fenceState.segmentsPerSide, 7, 'segmentsPerSide must come from snapshot');
  assertEqual(fenceState.hpById['sideTop#0'], 33, 'snapshot damage must be persisted');
  assertEqual(fenceState.hpById['sideTop#3'], 0, 'snapshot broken segment must stay at 0');
});

test('FDP-3: snapshot ids do not leak across a mismatched fence layout', function () {
  const fenceState = roundTripFenceState({
    fenceSegments: [],
    fenceSegmentsMeta: { segmentsPerSide: 9 },
    savedFenceState: {
      segmentsPerSide: 7,
      hpById: { 'sideTop#0': 33, 'sideLeft#4': 0 },
    },
  });
  assert(!!fenceState, 'fenceState must be present in payload');
  assertEqual(fenceState.segmentsPerSide, 9, 'current layout must win for segmentsPerSide');
  assertEqual(Object.keys(fenceState.hpById).length, 0, 'mismatched-layout ids must be dropped');
});

test('FDP-3b: live segments take precedence over a stale snapshot entry for the same id', function () {
  const fenceState = roundTripFenceState({
    fenceSegments: [{ id: 'sideTop#0', hp: 5 }],
    fenceSegmentsMeta: { segmentsPerSide: 7 },
    savedFenceState: { segmentsPerSide: 7, hpById: { 'sideTop#0': 60 } },
  });
  assertEqual(fenceState.hpById['sideTop#0'], 5, 'live HP must win over the snapshot value');
});

/* ------------------------------------------------------------------ *
 * FDP-4: restoreFullState() must re-apply the payload snapshot
 *        AFTER syncFenceTierWithMaxTankLevel()
 * ------------------------------------------------------------------ */

test('FDP-4: restoreFullState re-applies saved.fenceState after the tier sync snapshot', function () {
  const src = fs.readFileSync(path.resolve(ROOT, 'game.js'), 'utf-8');
  const restoreStart = src.indexOf('function restoreFullState(saved){');
  assert(restoreStart >= 0, 'restoreFullState must exist in game.js');
  const restoreEnd = src.indexOf('function restoreSupercomputerAfterCritical(){', restoreStart);
  assert(restoreEnd > restoreStart, 'restoreFullState body must be delimited');
  const body = src.slice(restoreStart, restoreEnd);

  const tierSyncIdx = body.indexOf('syncFenceTierWithMaxTankLevel(state, { force: true });');
  assert(tierSyncIdx >= 0, 'restoreFullState must call syncFenceTierWithMaxTankLevel');

  // The re-application must sit after the tier sync and before the
  // forceFenceRuntimeResetOnLoad branch (which intentionally clears the snapshot).
  const reapplyIdx = body.indexOf('state.savedFenceState = {', tierSyncIdx);
  assert(reapplyIdx > tierSyncIdx, 'saved.fenceState re-application must follow the tier sync');

  const forceResetIdx = body.indexOf('if (forceFenceRuntimeResetOnLoad) {', tierSyncIdx);
  assert(forceResetIdx > reapplyIdx, 're-application must precede the forceFenceRuntimeResetOnLoad clear');
});

test('FDP-4b: syncFenceTierWithMaxTankLevel still snapshots (guards the ordering assumption)', function () {
  const src = fs.readFileSync(path.resolve(ROOT, 'game.js'), 'utf-8');
  const fnStart = src.indexOf('function syncFenceTierWithMaxTankLevel(stateRef, options){');
  assert(fnStart >= 0, 'syncFenceTierWithMaxTankLevel must exist');
  const fnEnd = src.indexOf('\nfunction ', fnStart + 10);
  const body = src.slice(fnStart, fnEnd > fnStart ? fnEnd : undefined);
  assert(
    body.indexOf('snapshotFenceHpById(targetState);') >= 0,
    'syncFenceTierWithMaxTankLevel must still call snapshotFenceHpById (this is why the re-apply is needed)'
  );
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
  console.log('All fence damage persistence checks passed.');
}