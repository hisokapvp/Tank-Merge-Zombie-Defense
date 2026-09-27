'use strict';

/**
 * Pack 29: underground hangar drone integrity + hatch badge.
 *
 * Two player-reported bugs are guarded here.
 *
 * ── Bug 1: a drone vanished when dragged and dropped back onto its own cell ──
 *
 * The underground-hangar modal resolves a drop target from the pointer
 * position. A drag that starts and ends on the SAME cell therefore resolves
 * source and target to the SAME drone object. `game.js onMerge()` routed that
 * to `_mergeDroneLocations()`, which:
 *
 *   1. compared `source.drone.level !== target.drone.level` — always equal for
 *      the same drone, so the guard never fired;
 *   2. levelled the drone up in place;
 *   3. called `_removeDroneFromLocation(source)` — which deleted the very drone
 *      it had just levelled up.
 *
 * Net effect: the drone disappeared. It was intermittent because the drop only
 * lands on the source cell when the pointer is released over it (a short or
 * jittery drag), which is exactly the "перекладывал туда-сюда и он исчез"
 * report. Tanks were unaffected because `_moveTankBetweenHangars()` returns
 * false for a same-cell move instead of merging.
 *
 * Fix: `_mergeDroneLocations()` returns false when `srcType === tgtType &&
 * srcIdx === tgtIdx`, so a same-cell drop is a no-op.
 *
 * ── Bug 2: the hatch badge only counted tanks ──
 *
 * `drawBoard()` passed `getUndergroundHangarStoredTankCount()` (tanks only) to
 * `UndergroundHangar.draw()`, so overflow drones parked underground were
 * invisible on the board. The badge now counts tanks AND drones via
 * `getUndergroundHangarStoredEntityCount()` / `UndergroundHangar.getStoredCount()`.
 *
 * Cases:
 *   UGH-1  same-cell drone drop is a no-op (no level-up, no removal).
 *   UGH-2  same-cell drop on a rack slot is a no-op.
 *   UGH-3  a genuine same-level merge between two DIFFERENT cells still works.
 *   UGH-4  a genuine merge into an underground cell clears the rack slotIndex.
 *   UGH-5  a cross-cell move (different levels) is not treated as a merge.
 *   UGH-6  getStoredCount() counts tanks and drones together.
 *   UGH-7  getStoredCount(state, 'tank') / ('drone') narrow the count.
 *   UGH-8  getStoredCount() tolerates a missing/empty hangar.
 *   UGH-9  the badge helper is exported on Game.UndergroundHangar.
 *   UGH-10 drawBoard() feeds the combined count into UndergroundHangar.draw().
 *   UGH-11 the old tank-only badge helper is no longer used by drawBoard().
 *   UGH-12 the same-cell guard precedes the level comparison in game.js.
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
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
}

function createSandbox() {
  const windowObj = {};
  const sandbox = {
    window: windowObj,
    console: console,
    Math: Math,
    Date: Date,
    JSON: JSON,
    Object: Object,
    Array: Array,
    Number: Number,
    String: String,
    Boolean: Boolean,
    Error: Error,
    isFinite: isFinite,
    parseInt: parseInt,
    parseFloat: parseFloat,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
  };
  sandbox.globalThis = sandbox;
  windowObj.window = windowObj;
  return vm.createContext(sandbox);
}

function loadModule(rel, sandbox) {
  vm.runInContext(read(rel), sandbox, { filename: rel });
  return sandbox;
}

/**
 * Extract `_mergeDroneLocations` from game.js and run it against a minimal
 * harness. This exercises the REAL production source instead of a copy, so the
 * regression cannot silently drift.
 */
function makeMergeHarness() {
  const gameJs = read('game.js');
  const start = gameJs.indexOf('function _mergeDroneLocations(');
  assert(start !== -1, '_mergeDroneLocations must exist in game.js');
  // The function ends at the next top-level `function ` declaration.
  const rest = gameJs.slice(start + 10);
  const nextFn = rest.indexOf('\nfunction ');
  assert(nextFn !== -1, '_mergeDroneLocations must be followed by another function');
  const fnSource = gameJs.slice(start, start + 10 + nextFn);

  const state = {
    drones: [],
    undergroundHangar: { cells: [] },
  };
  for (let i = 0; i < 16; i++) state.undergroundHangar.cells.push({ i: i, tank: null, drone: null });

  const calls = { removed: [], cleared: [] };

  const harness = {
    state: state,
    DronesApi: {
      mergeDroneSlots: function (st, sourceDrone, targetDrone) {
        targetDrone.level = targetDrone.level + 1;
        const idx = st.drones.indexOf(sourceDrone);
        if (idx >= 0) st.drones.splice(idx, 1);
        return true;
      },
    },
    getDronRuntimeConfig: function () { return { maxLevel: 10 }; },
    _clearStoredDroneRepairState: function (drone) { calls.cleared.push(drone.id); },
    _getDroneBySlotIndex: function (slotIdx) {
      for (let i = 0; i < state.drones.length; i++) {
        if (state.drones[i] && state.drones[i].slotIndex === slotIdx) return state.drones[i];
      }
      return null;
    },
    _getUndergroundCell: function (idx) { return state.undergroundHangar.cells[idx] || null; },
    _resolveDroneLocation: function (type, idx) {
      if (type === 'drone') {
        const drone = harness._getDroneBySlotIndex(idx);
        return drone ? { type: 'drone', index: idx, drone: drone } : null;
      }
      if (type === 'underground') {
        const cell = harness._getUndergroundCell(idx);
        if (cell && cell.drone) return { type: 'underground', index: idx, cell: cell, drone: cell.drone };
      }
      return null;
    },
    _removeDroneFromLocation: function (location) {
      if (!location || !location.drone) return false;
      calls.removed.push(location.drone.id);
      if (location.type === 'underground') {
        const cell = location.cell || harness._getUndergroundCell(location.index);
        if (!cell || !cell.drone) return false;
        cell.drone = null;
        return true;
      }
      const idx = state.drones.indexOf(location.drone);
      if (idx >= 0) { state.drones.splice(idx, 1); return true; }
      return false;
    },
  };

  const sandbox = createSandbox();
  sandbox.state = state;
  sandbox.DronesApi = harness.DronesApi;
  sandbox.getDronRuntimeConfig = harness.getDronRuntimeConfig;
  sandbox._clearStoredDroneRepairState = harness._clearStoredDroneRepairState;
  sandbox._getDroneBySlotIndex = harness._getDroneBySlotIndex;
  sandbox._getUndergroundCell = harness._getUndergroundCell;
  sandbox._resolveDroneLocation = harness._resolveDroneLocation;
  sandbox._removeDroneFromLocation = harness._removeDroneFromLocation;
  vm.runInContext(fnSource + '\n;this.__merge = _mergeDroneLocations;', sandbox, { filename: 'game.js#_mergeDroneLocations' });

  return {
    state: state,
    calls: calls,
    merge: sandbox.__merge,
    reset: function () {
      state.drones.length = 0;
      for (let i = 0; i < state.undergroundHangar.cells.length; i++) {
        state.undergroundHangar.cells[i].tank = null;
        state.undergroundHangar.cells[i].drone = null;
      }
      calls.removed.length = 0;
      calls.cleared.length = 0;
    },
  };
}

function makeDrone(id, level, slotIndex) {
  return {
    id: id,
    level: level,
    mode: 'standby',
    substate: 'repair_patrol',
    slotIndex: slotIndex === undefined ? null : slotIndex,
    pos: { x: 0, y: 0 },
    basePos: { x: 0, y: 0 },
    patrolSeed: 0,
  };
}

// ─────────────────────────────────────────────────────────────
// Section 1: same-cell drop must never destroy a drone
// ─────────────────────────────────────────────────────────────

console.log('\n── UGH: same-cell drone drop is a no-op ──');

test('UGH-1: same-cell drone drop is a no-op (no level-up, no removal)', function () {
  const h = makeMergeHarness();
  const drone = makeDrone('ugA', 5, null);
  h.state.undergroundHangar.cells[1].drone = drone;

  const result = h.merge('underground', 1, 'underground', 1);

  assertEqual(result, false, 'same-cell drop must report no merge');
  assertEqual(h.state.undergroundHangar.cells[1].drone, drone, 'the drone must still be in its cell');
  assertEqual(drone.level, 5, 'the drone must NOT be levelled up');
  assertEqual(h.calls.removed.length, 0, 'nothing may be removed');
});

test('UGH-2: same-cell drop on a rack slot is a no-op', function () {
  const h = makeMergeHarness();
  const drone = makeDrone('rackA', 3, 4);
  h.state.drones.push(drone);

  const result = h.merge('drone', 4, 'drone', 4);

  assertEqual(result, false, 'same-slot drop must report no merge');
  assertEqual(h.state.drones.length, 1, 'the rack drone must survive');
  assertEqual(drone.level, 3, 'the rack drone must NOT be levelled up');
  assertEqual(h.calls.removed.length, 0, 'nothing may be removed');
});

test('UGH-3: a genuine same-level merge between two DIFFERENT cells still works', function () {
  const h = makeMergeHarness();
  const a = makeDrone('ugA', 2, null);
  const b = makeDrone('ugB', 2, null);
  h.state.undergroundHangar.cells[0].drone = a;
  h.state.undergroundHangar.cells[1].drone = b;

  const result = h.merge('underground', 0, 'underground', 1);

  assertEqual(result, true, 'a real merge must succeed');
  assertEqual(h.state.undergroundHangar.cells[1].drone.level, 3, 'target drone levels up');
  assertEqual(h.state.undergroundHangar.cells[0].drone, null, 'source cell is emptied');
  assertEqual(h.calls.removed.length, 1, 'exactly one drone is removed');
});

test('UGH-4: a genuine merge into an underground cell clears the rack slotIndex', function () {
  const h = makeMergeHarness();
  const rackDrone = makeDrone('rackA', 4, 2);
  const ugDrone = makeDrone('ugA', 4, null);
  h.state.drones.push(rackDrone);
  h.state.undergroundHangar.cells[3].drone = ugDrone;

  const result = h.merge('drone', 2, 'underground', 3);

  assertEqual(result, true, 'cross-location merge must succeed');
  assertEqual(ugDrone.level, 5, 'underground drone levels up');
  assertEqual(ugDrone.slotIndex, null, 'merged drone must not keep a rack slotIndex');
  assertEqual(h.state.drones.length, 0, 'the rack drone is consumed');
});

test('UGH-5: a cross-cell move with different levels is not treated as a merge', function () {
  const h = makeMergeHarness();
  h.state.undergroundHangar.cells[0].drone = makeDrone('ugA', 2, null);
  h.state.undergroundHangar.cells[1].drone = makeDrone('ugB', 5, null);

  const result = h.merge('underground', 0, 'underground', 1);

  assertEqual(result, false, 'different levels must not merge');
  assertEqual(h.state.undergroundHangar.cells[0].drone.level, 2, 'source drone untouched');
  assertEqual(h.state.undergroundHangar.cells[1].drone.level, 5, 'target drone untouched');
});

// ─────────────────────────────────────────────────────────────
// Section 2: hatch badge counts tanks AND drones
// ─────────────────────────────────────────────────────────────

console.log('\n── UGH: hatch badge counts tanks and drones ──');

test('UGH-6: getStoredCount() counts tanks and drones together', function () {
  const sandbox = createSandbox();
  loadModule('src/mechanics/undergroundHangar.js', sandbox);
  const UH = sandbox.window.Game.UndergroundHangar;
  const state = { undergroundHangar: { cells: [] } };
  UH.ensureStateShape(state);
  state.undergroundHangar.cells[0].tank = { id: 't1', level: 3 };
  state.undergroundHangar.cells[1].drone = makeDrone('d1', 2, null);
  state.undergroundHangar.cells[2].drone = makeDrone('d2', 4, null);

  assertEqual(UH.getStoredCount(state), 3, 'badge must count 1 tank + 2 drones');
});

test('UGH-7: getStoredCount(state, kind) narrows the count', function () {
  const sandbox = createSandbox();
  loadModule('src/mechanics/undergroundHangar.js', sandbox);
  const UH = sandbox.window.Game.UndergroundHangar;
  const state = { undergroundHangar: { cells: [] } };
  UH.ensureStateShape(state);
  state.undergroundHangar.cells[0].tank = { id: 't1', level: 3 };
  state.undergroundHangar.cells[1].drone = makeDrone('d1', 2, null);

  assertEqual(UH.getStoredCount(state, 'tank'), 1, 'tank-only count');
  assertEqual(UH.getStoredCount(state, 'drone'), 1, 'drone-only count');
});

test('UGH-8: getStoredCount() tolerates a missing/empty hangar', function () {
  const sandbox = createSandbox();
  loadModule('src/mechanics/undergroundHangar.js', sandbox);
  const UH = sandbox.window.Game.UndergroundHangar;

  assertEqual(UH.getStoredCount(null), 0, 'null state yields 0');
  assertEqual(UH.getStoredCount({}), 0, 'state without hangar yields 0');
  assertEqual(UH.getStoredCount({ undergroundHangar: { cells: [] } }), 0, 'empty hangar yields 0');
});

test('UGH-9: the badge helper is exported on Game.UndergroundHangar', function () {
  const sandbox = createSandbox();
  loadModule('src/mechanics/undergroundHangar.js', sandbox);
  const UH = sandbox.window.Game.UndergroundHangar;

  assertEqual(typeof UH.getStoredCount, 'function', 'getStoredCount must be public');
});

test('UGH-10: drawBoard() feeds the combined count into UndergroundHangar.draw()', function () {
  const gameJs = read('game.js');
  const drawStart = gameJs.indexOf('function drawBoard(){');
  assert(drawStart !== -1, 'drawBoard must exist');
  const drawBody = gameJs.slice(drawStart, drawStart + 4000);

  assert(drawBody.indexOf('getUndergroundHangarStoredEntityCount()') !== -1,
    'drawBoard must compute the combined stored count');
  assert(drawBody.indexOf('_UH.draw(ctx, c, undergroundStoredCount)') !== -1,
    'drawBoard must pass the combined count to UndergroundHangar.draw');
});

test('UGH-11: the tank-only badge helper is no longer used by drawBoard()', function () {
  const gameJs = read('game.js');
  const drawStart = gameJs.indexOf('function drawBoard(){');
  const drawBody = gameJs.slice(drawStart, drawStart + 4000);

  assert(drawBody.indexOf('getUndergroundHangarStoredTankCount()') === -1,
    'drawBoard must not use the tank-only count for the badge');
});

test('UGH-12: the same-cell guard precedes the level comparison in game.js', function () {
  const gameJs = read('game.js');
  const fnStart = gameJs.indexOf('function _mergeDroneLocations(');
  assert(fnStart !== -1, '_mergeDroneLocations must exist');
  const fnBody = gameJs.slice(fnStart, fnStart + 1600);

  const guardIdx = fnBody.indexOf('srcType === tgtType && srcIdx === tgtIdx');
  const levelIdx = fnBody.indexOf('source.drone.level !== target.drone.level');

  assert(guardIdx !== -1, 'the same-cell guard must exist');
  assert(levelIdx !== -1, 'the level comparison must still exist');
  assert(guardIdx < levelIdx, 'the same-cell guard must run BEFORE the level comparison');
});

// ─────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────

console.log('\n──────────────────────────────────────────────');
console.log('Pack 29 results: ' + passCount + ' passed, ' + failCount + ' failed');
if (failCount > 0) {
  console.log('\nFailures:');
  failures.forEach(function (f) { console.log('  - ' + f.name + ': ' + f.error); });
  process.exit(1);
}
console.log('All Pack 29 checks passed.');
