'use strict';

/**
 * Pack 27: drone overflow into the underground hangar.
 *
 * Regression guard for a player-reported data-loss path:
 *
 *   1. every main drone slot (9) is occupied;
 *   2. the player earns another drone (achievement / production box / shop /
 *      eco-lottery);
 *   3. the drone silently disappeared.
 *
 * Root cause: `Drones.addDron()` had exactly one overflow branch —
 * `tryAbsorbIncomingDroneIntoFullSlots()`, which only merges the incoming drone
 * into an existing same-level drone. When no same-level drone existed, the
 * function returned `null` and the caller dropped the reward on the floor.
 *
 * Fix: when the main rack is full, the incoming drone is parked in the
 * underground hangar (`Game.UndergroundHangar.storeDrone`). The legacy
 * level-absorb path is kept as a second-tier fallback for a full underground
 * hangar, so no existing behaviour is removed.
 *
 * A second, independent bug is covered here: `state.undergroundHangar` was
 * READ by `restoreFullState()` / `applySavedProgress()` but never WRITTEN by
 * `serializeState()`. Without the writer, overflow drones would still vanish on
 * the next reload — the fix would have looked correct in-session only.
 *
 * Cases:
 *   DOU-1  addDron() stores the drone in the underground hangar when slots are full.
 *   DOU-2  the stored drone keeps its level and is parked in standby (slotIndex null).
 *   DOU-3  the drone is NOT pushed into state.drones (it is not a rack drone).
 *   DOU-4  a second overflow drone takes the next free underground cell.
 *   DOU-5  when the underground hangar is full too, the legacy level-absorb runs.
 *   DOU-6  when both are full and no absorb target exists, addDron() returns null.
 *   DOU-7  storeDrone() refuses tanks-only cells and reports -1 when full.
 *   DOU-8  serializeState() writes `undergroundHangar` (writer parity).
 *   DOU-9  serializeState() keeps tank and drone payloads in the same cell shape.
 *   DOU-10 serializeState() emits null for a state without an underground hangar.
 *   DOU-11 `undergroundHangar` is a known payload key (no false unknown-key diag).
 *   DOU-12 applySavedProgress() restores the hangar and clears it for legacy saves.
 *   DOU-13 partial reset preserves the underground hangar (takeProgressSnapshot).
 *   DOU-14 saveSchema.json documents the field.
 *   DOU-15 i18n ru/en carry the overflow toast key with parity.
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

/**
 * Load a browser IIFE module into a fresh sandbox with a `window` global.
 * Returns the sandbox so callers can reach `sandbox.window.Game.*`.
 */
function loadModule(rel, sandbox) {
  const code = read(rel);
  vm.runInContext(code, sandbox, { filename: rel });
  return sandbox;
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

/** Minimal state with a full 9-slot drone rack. */
function makeFullRackState() {
  const drones = [];
  for (let slot = 0; slot < 9; slot++) {
    drones.push({ id: 'rack_' + slot, level: 1, mode: 'standby', substate: 'repair_patrol', slotIndex: slot });
  }
  return {
    drones: drones,
    supercomputer: { x: 100, y: 100 },
    undergroundHangar: { cells: [] },
  };
}

// ─────────────────────────────────────────────────────────────
// Section 1: Drones.addDron overflow → underground hangar
// ─────────────────────────────────────────────────────────────

console.log('\n── DOU: drone overflow into underground hangar ──');

test('DOU-1: addDron() stores the drone in the underground hangar when slots are full', function () {
  const sandbox = createSandbox();
  loadModule('src/mechanics/undergroundHangar.js', sandbox);
  loadModule('src/mechanics/drones.js', sandbox);
  const Game = sandbox.window.Game;
  const state = makeFullRackState();

  const drone = Game.Drones.addDron(state, 3, {});

  assert(!!drone, 'addDron must return the stored drone instead of null');
  const cells = state.undergroundHangar.cells;
  const stored = cells.filter(function (c) { return c && c.drone; });
  assertEqual(stored.length, 1, 'exactly one underground cell must hold the drone');
  assertEqual(stored[0].drone.level, 3, 'stored drone keeps its level');
});

test('DOU-2: the stored drone is parked in standby with slotIndex null', function () {
  const sandbox = createSandbox();
  loadModule('src/mechanics/undergroundHangar.js', sandbox);
  loadModule('src/mechanics/drones.js', sandbox);
  const Game = sandbox.window.Game;
  const state = makeFullRackState();

  Game.Drones.addDron(state, 2, {});
  const stored = state.undergroundHangar.cells.filter(function (c) { return c && c.drone; })[0].drone;

  assertEqual(stored.slotIndex, null, 'stored drone must not claim a rack slot');
  assertEqual(stored.mode, 'standby', 'stored drone must be in standby');
  assertEqual(stored.targetSegmentId, null, 'stored drone must not target a fence segment');
  assertEqual(stored.repair, null, 'stored drone must not carry repair state');
});

test('DOU-3: the overflow drone is NOT pushed into state.drones', function () {
  const sandbox = createSandbox();
  loadModule('src/mechanics/undergroundHangar.js', sandbox);
  loadModule('src/mechanics/drones.js', sandbox);
  const Game = sandbox.window.Game;
  const state = makeFullRackState();

  Game.Drones.addDron(state, 1, {});

  assertEqual(state.drones.length, 9, 'rack must stay at 9 drones');
  for (let i = 0; i < state.drones.length; i++) {
    assert(state.drones[i].slotIndex !== null, 'every rack drone keeps a slot');
  }
});

test('DOU-4: a second overflow drone takes the next free underground cell', function () {
  const sandbox = createSandbox();
  loadModule('src/mechanics/undergroundHangar.js', sandbox);
  loadModule('src/mechanics/drones.js', sandbox);
  const Game = sandbox.window.Game;
  const state = makeFullRackState();

  Game.Drones.addDron(state, 1, {});
  Game.Drones.addDron(state, 4, {});

  const stored = state.undergroundHangar.cells.filter(function (c) { return c && c.drone; });
  assertEqual(stored.length, 2, 'two underground cells must be occupied');
  assertEqual(stored[0].i, 0, 'first overflow drone lands in cell 0');
  assertEqual(stored[1].i, 1, 'second overflow drone lands in cell 1');
  assertEqual(stored[1].drone.level, 4, 'second drone keeps its own level');
});

test('DOU-5: when the underground hangar is full too, the legacy level-absorb runs', function () {
  const sandbox = createSandbox();
  loadModule('src/mechanics/undergroundHangar.js', sandbox);
  loadModule('src/mechanics/drones.js', sandbox);
  const Game = sandbox.window.Game;
  const state = makeFullRackState();

  // Fill every underground cell with a tank so no drone can be stored.
  state.undergroundHangar.cells = [];
  for (let i = 0; i < 16; i++) {
    state.undergroundHangar.cells.push({ i: i, tank: { id: 't' + i, level: 1 }, drone: null });
  }

  const drone = Game.Drones.addDron(state, 1, {});

  assert(!!drone, 'legacy absorb must still return a drone');
  assertEqual(drone.slotIndex, 0, 'absorbed drone stays on the rack');
  assertEqual(drone.level, 2, 'absorbed drone levels up by one');
  assertEqual(state.drones.length, 9, 'rack size is unchanged by absorb');
});

test('DOU-6: when both hangars are full and no absorb target exists, addDron() returns null', function () {
  const sandbox = createSandbox();
  loadModule('src/mechanics/undergroundHangar.js', sandbox);
  loadModule('src/mechanics/drones.js', sandbox);
  const Game = sandbox.window.Game;
  const state = makeFullRackState();

  // Rack drones are all level 5, incoming drone is level 1 → no absorb target.
  for (let i = 0; i < state.drones.length; i++) state.drones[i].level = 5;
  state.undergroundHangar.cells = [];
  for (let i = 0; i < 16; i++) {
    state.undergroundHangar.cells.push({ i: i, tank: { id: 't' + i, level: 1 }, drone: null });
  }

  const drone = Game.Drones.addDron(state, 1, {});

  assertEqual(drone, null, 'no storage and no absorb target → null (unchanged legacy behaviour)');
  assertEqual(state.drones.length, 9, 'rack must not grow');
});

test('DOU-7: storeDrone() refuses tanks-only cells and reports -1 when full', function () {
  const sandbox = createSandbox();
  loadModule('src/mechanics/undergroundHangar.js', sandbox);
  loadModule('src/mechanics/drones.js', sandbox);
  const Game = sandbox.window.Game;
  const UH = Game.UndergroundHangar;

  const state = { drones: [], undergroundHangar: { cells: [] } };
  UH.ensureStateShape(state);
  assertEqual(UH.findFreeDroneCellIndex(state), 0, 'empty hangar reports cell 0');

  state.undergroundHangar.cells[0].tank = { id: 't0', level: 1 };
  assertEqual(UH.findFreeDroneCellIndex(state), 1, 'tank-occupied cell is skipped');

  for (let i = 0; i < 16; i++) {
    state.undergroundHangar.cells[i].tank = { id: 't' + i, level: 1 };
    state.undergroundHangar.cells[i].drone = null;
  }
  assertEqual(UH.findFreeDroneCellIndex(state), -1, 'full hangar reports -1');
  assertEqual(UH.storeDrone(state, { level: 1 }), null, 'storeDrone returns null when full');
});

// ─────────────────────────────────────────────────────────────
// Section 2: persistence writer parity
// ─────────────────────────────────────────────────────────────

console.log('\n── DOU: persistence writer parity ──');

/** Load storage.js with a minimal localStorage stub and return Game.Storage. */
function loadStorage() {
  const sandbox = createSandbox();
  const store = {};
  sandbox.window.localStorage = {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); },
    removeItem: function (k) { delete store[k]; },
  };
  sandbox.localStorage = sandbox.window.localStorage;
  loadModule('src/persistence/storage.js', sandbox);
  return sandbox.window.Game.Storage;
}

/**
 * Save `state` through the real write path (`saveSlot` → `serializeState`) and
 * return the persisted payload. `serializeState` itself is not exported on
 * `Game.Storage`, so the slot API is the canonical way to observe the payload.
 */
function saveAndReadPayload(Storage, state) {
  const save = Storage.saveSlot(0, state);
  assert(save && save.ok, 'saveSlot must succeed, error=' + (save && save.error));
  const loaded = Storage.loadSlot(0);
  assert(loaded && loaded.ok && loaded.payload, 'loadSlot must return a payload');
  return loaded.payload;
}

test('DOU-8: serializeState() writes `undergroundHangar` (writer parity)', function () {
  const Storage = loadStorage();
  const state = makeFullRackState();
  state.undergroundHangar.cells = [{ i: 0, tank: null, drone: { id: 'd1', level: 3, mode: 'standby', substate: 'repair_patrol', slotIndex: null } }];

  const payload = saveAndReadPayload(Storage, state);

  assert(Object.prototype.hasOwnProperty.call(payload, 'undergroundHangar'), 'payload must carry undergroundHangar');
  assert(!!payload.undergroundHangar, 'undergroundHangar must not be null when cells exist');
  assertEqual(payload.undergroundHangar.cells.length, 1, 'one cell persisted');
  assertEqual(payload.undergroundHangar.cells[0].drone.level, 3, 'drone level persisted');
  assertEqual(payload.undergroundHangar.cells[0].drone.slotIndex, null, 'stored drone keeps slotIndex null');
});

test('DOU-9: serializeState() keeps tank and drone payloads in the same cell shape', function () {
  const Storage = loadStorage();
  const state = makeFullRackState();
  state.undergroundHangar.cells = [
    { i: 0, tank: { id: 'tk1', level: 7, onTrack: true, powerTier: 2 }, drone: null },
    { i: 1, tank: null, drone: { id: 'd1', level: 2, mode: 'standby', substate: 'repair_patrol', slotIndex: null } },
  ];

  const payload = saveAndReadPayload(Storage, state);
  const cells = payload.undergroundHangar.cells;

  assertEqual(cells[0].tank.level, 7, 'tank level persisted');
  assertEqual(cells[0].tank.powerTier, 2, 'tank powerTier persisted');
  assertEqual(cells[0].drone, null, 'tank cell has no drone');
  assertEqual(cells[1].tank, null, 'drone cell has no tank');
  assertEqual(cells[1].drone.id, 'd1', 'drone id persisted');
});

test('DOU-10: serializeState() emits null for a state without an underground hangar', function () {
  const Storage = loadStorage();
  const state = makeFullRackState();
  delete state.undergroundHangar;

  const payload = saveAndReadPayload(Storage, state);

  assertEqual(payload.undergroundHangar, null, 'missing hangar serializes to null');
});

test('DOU-11: `undergroundHangar` is a known payload key (no false unknown-key diag)', function () {
  const gameJs = read('game.js');
  const block = gameJs.slice(gameJs.indexOf('const __KNOWN_PAYLOAD_KEYS'), gameJs.indexOf('function reportUnknownPayloadKeys'));
  assert(block.indexOf("'undergroundHangar'") !== -1, 'undergroundHangar must be listed in __KNOWN_PAYLOAD_KEYS');
});

test('DOU-12: applySavedProgress() restores the hangar and clears it for legacy saves', function () {
  const gameJs = read('game.js');
  const fnStart = gameJs.indexOf('function applySavedProgress(data){');
  assert(fnStart !== -1, 'applySavedProgress must exist');
  const fnBody = gameJs.slice(fnStart, fnStart + 12000);

  assert(fnBody.indexOf('data.undergroundHangar') !== -1, 'applySavedProgress must read data.undergroundHangar');
  assert(fnBody.indexOf('state.undergroundHangar = { cells: [] }') !== -1, 'legacy payload must clear the hangar');
  assert(fnBody.indexOf('ensureStateShape') !== -1, 'restore must normalize the hangar shape');
});

test('DOU-13: partial reset preserves the underground hangar (takeProgressSnapshot)', function () {
  const worldReset = read('src/core/worldReset.js');
  const snapStart = worldReset.indexOf('function takeProgressSnapshot');
  const snapEnd = worldReset.indexOf('function restoreProgressSnapshot');
  const snapBody = worldReset.slice(snapStart, snapEnd);
  const restoreBody = worldReset.slice(snapEnd, worldReset.indexOf('function resetWorldRuntimeState'));

  assert(snapBody.indexOf('undergroundHangar') !== -1, 'takeProgressSnapshot must capture undergroundHangar');
  assert(restoreBody.indexOf('undergroundHangar') !== -1, 'restoreProgressSnapshot must restore undergroundHangar');
});

test('DOU-14: saveSchema.json documents the field', function () {
  const schema = JSON.parse(read('assets/saveSchema.json'));
  assert(!!schema.properties.undergroundHangar, 'saveSchema must declare undergroundHangar');
  assertEqual(schema.properties.undergroundHangar.type[0], 'object', 'undergroundHangar is an object');
  assert(!!schema.properties.undergroundHangar.properties.cells, 'cells array must be documented');
});

test('DOU-15: i18n ru/en carry the overflow toast key with parity', function () {
  const ru = JSON.parse(read('src/i18n/ru.json'));
  const en = JSON.parse(read('src/i18n/en.json'));

  assert(typeof ru.droneStoredUnderground === 'string' && ru.droneStoredUnderground.length > 0, 'ru key must exist');
  assert(typeof en.droneStoredUnderground === 'string' && en.droneStoredUnderground.length > 0, 'en key must exist');
  assertEqual(Object.keys(ru).length, Object.keys(en).length, 'ru/en key counts must match');
});

// ─────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────

console.log('\n──────────────────────────────────────────────');
console.log('Pack 27 results: ' + passCount + ' passed, ' + failCount + ' failed');
if (failCount > 0) {
  console.log('\nFailures:');
  failures.forEach(function (f) { console.log('  - ' + f.name + ': ' + f.error); });
  process.exit(1);
}
console.log('All Pack 27 checks passed.');
