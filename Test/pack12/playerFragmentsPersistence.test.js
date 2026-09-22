'use strict';

/**
 * Pack 12: chip-shard (fragment) inventory persistence (save → load round-trip).
 *
 * Regression guard for the bug where chip fragments vanished after loading a
 * saved game.
 *
 * Root cause: fragments do NOT live in runtime `state`. They live in the
 * module-owned inventory inside `src/ui/hangarChipsUI.js`
 * (`Game.HangarChipsUI.getPlayerFragments()` / `.setPlayerFragments()`).
 * `serializeState()` wrote `playerChips`, `hangarCells`, `productionLine` and
 * `techStudying` — but NEVER `playerFragments`, even though the restore paths
 * (`restoreFullState` / `applySavedProgress`), the Payload Contract Map and
 * `__KNOWN_PAYLOAD_KEYS` already referenced it. So the bug was on the WRITE
 * side: every save silently dropped the shard inventory.
 *
 * The fix must not regress the opposite requirement: "New Game" still has to
 * clear fragments without a page reload (`resetPlayerInventory()` clears them),
 * and loading a legacy save without `playerFragments` must CLEAR the shard
 * inventory instead of leaking the previous session's fragments into this run.
 *
 * Cases:
 *   FGP-1  serializeState() persists the live module-owned fragment inventory.
 *   FGP-2  Writer falls back to `state.playerFragments` when the UI module is absent.
 *   FGP-3  Empty array (not null/undefined) when no inventory exists at all.
 *   FGP-4  Malformed / zero-count / non-positive-id entries are dropped.
 *   FGP-5  Both restore paths call setPlayerFragments unconditionally ([] fallback).
 *   FGP-6  resetPlayerInventory() (New Game) clears the fragment inventory.
 *   FGP-7  `playerFragments` is a known payload key (no false unknown-key diagnostic).
 *   FGP-8  `playerFragments` is declared in assets/saveSchema.json.
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
 * Shared sandbox: storage.js + hangarChips.js + hangarChipsUI.js
 * ------------------------------------------------------------------ */

function createSandbox(globalOverrides) {
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
    requestAnimationFrame: function () { return 0; },
    cancelAnimationFrame: function () {},
  };
  sandboxGlobal.window = sandboxGlobal;
  sandboxGlobal.Game = {};
  if (globalOverrides) {
    const keys = Object.keys(globalOverrides);
    for (let i = 0; i < keys.length; i++) sandboxGlobal[keys[i]] = globalOverrides[keys[i]];
  }

  function load(relPath) {
    const code = fs.readFileSync(path.resolve(ROOT, relPath), 'utf-8');
    const fn = new Function('window', 'global', 'localStorage', 'console', 'document', code);
    fn(sandboxGlobal, sandboxGlobal, localStore, sandboxGlobal.console, sandboxGlobal.document);
  }

  load('src/mechanics/hangarChips.js');
  load('src/ui/hangarChipsUI.js');
  load('src/persistence/storage.js');

  return { global: sandboxGlobal, reset: function () { localStore._d = {}; } };
}

/** Live shard inventory mirroring a real workshop: two fragment stacks. */
function liveFragments() {
  return [
    { fragmentId: 1, count: 4 },
    { fragmentId: 7, count: 2 },
  ];
}

/**
 * Save `state` through the real write path (`saveSlot` → `serializeState`) and
 * return the persisted payload. `serializeState` itself is not exported on
 * `Game.Storage`, so the slot API is the canonical way to observe the payload.
 */
function saveAndReadPayload(box, state) {
  box.reset();
  const save = box.global.Game.Storage.saveSlot(0, state);
  assert(save && save.ok, 'saveSlot must succeed, error=' + (save && save.error));
  const loaded = box.global.Game.Storage.loadSlot(0);
  assert(loaded && loaded.ok && loaded.payload, 'loadSlot must return a payload');
  return loaded.payload;
}

/* ------------------------------------------------------------------ *
 * FGP-1..4: serializeState() captures the module-owned shard inventory
 * ------------------------------------------------------------------ */

test('FGP-1: serializeState() persists the live module-owned fragment inventory', function () {
  const box = createSandbox();
  const hcui = box.global.Game.HangarChipsUI;
  hcui.setPlayerFragments(liveFragments());

  // `state` intentionally does NOT carry the fragments — the live UI is the owner.
  const payload = saveAndReadPayload(box, { cells: [] });
  assert(Array.isArray(payload.playerFragments), 'playerFragments must be an array');
  assertEqual(payload.playerFragments.length, 2, 'fragment stack count');

  const byId = {};
  for (const entry of payload.playerFragments) byId[entry.fragmentId] = entry.count;
  assertEqual(byId[1], 4, 'fragment 1 count preserved');
  assertEqual(byId[7], 2, 'fragment 7 count preserved');
});

test('FGP-2: writer falls back to state.playerFragments when the UI module is absent', function () {
  const box = createSandbox();
  box.global.Game.HangarChipsUI = undefined;

  const payload = saveAndReadPayload(box, { cells: [], playerFragments: liveFragments() });
  assert(Array.isArray(payload.playerFragments), 'fallback fragments must be captured');
  assertEqual(payload.playerFragments.length, 2, 'fallback fragment stack count');
});

test('FGP-3: playerFragments is an empty array when no inventory exists at all', function () {
  const box = createSandbox();
  box.global.Game.HangarChipsUI = undefined;

  const payload = saveAndReadPayload(box, { cells: [] });
  assert(Array.isArray(payload.playerFragments), 'playerFragments must be an array (not null/undefined)');
  assertEqual(payload.playerFragments.length, 0, 'empty inventory yields []');
});

test('FGP-4: malformed / zero-count / non-positive-id fragment entries are dropped', function () {
  const box = createSandbox();
  box.global.Game.HangarChipsUI = undefined;

  const payload = saveAndReadPayload(box, {
    cells: [],
    playerFragments: [
      { fragmentId: 1, count: 3 },
      { fragmentId: 0, count: 5 },
      { fragmentId: -2, count: 5 },
      { fragmentId: 4, count: 0 },
      { fragmentId: 5, count: -1 },
      null,
      'garbage',
    ],
  });
  assertEqual(payload.playerFragments.length, 1, 'only the valid entry survives');
  assertEqual(payload.playerFragments[0].fragmentId, 1, 'valid fragmentId preserved');
  assertEqual(payload.playerFragments[0].count, 3, 'valid count preserved');
});

/* ------------------------------------------------------------------ *
 * FGP-5..6: restore paths + New Game
 * ------------------------------------------------------------------ */

test('FGP-5: both restore paths call setPlayerFragments unconditionally', function () {
  const src = fs.readFileSync(path.resolve(ROOT, 'game.js'), 'utf-8');

  const restoreStart = src.indexOf('function restoreFullState(saved){');
  assert(restoreStart >= 0, 'restoreFullState must exist');
  const restoreEnd = src.indexOf('function restoreSupercomputerAfterCritical(){', restoreStart);
  const restoreBody = src.slice(restoreStart, restoreEnd > restoreStart ? restoreEnd : undefined);
  assert(
    restoreBody.indexOf('HangarChipsUI.setPlayerFragments(Array.isArray(saved.playerFragments) ? saved.playerFragments : [])') >= 0,
    'restoreFullState must call setPlayerFragments with an explicit [] fallback (no fragment leak)'
  );

  const applyStart = src.indexOf('function applySavedProgress(data){');
  assert(applyStart >= 0, 'applySavedProgress must exist');
  const applyEnd = src.indexOf('\nfunction ', applyStart + 10);
  const applyBody = src.slice(applyStart, applyEnd > applyStart ? applyEnd : undefined);
  assert(
    applyBody.indexOf('HangarChipsUI.setPlayerFragments(Array.isArray(data.playerFragments) ? data.playerFragments : [])') >= 0,
    'applySavedProgress must call setPlayerFragments with an explicit [] fallback (no fragment leak)'
  );
});

test('FGP-6: resetPlayerInventory (New Game) clears the fragment inventory', function () {
  const box = createSandbox();
  const hcui = box.global.Game.HangarChipsUI;
  hcui.setPlayerFragments(liveFragments());
  assert(hcui.getPlayerFragments().length === 2, 'precondition: fragments owned');

  hcui.resetPlayerInventory({ reason: 'new_game' });
  assertEqual(hcui.getPlayerFragments().length, 0, 'New Game clears the shard inventory');
});

/* ------------------------------------------------------------------ *
 * FGP-7..8: payload contract surfaces
 * ------------------------------------------------------------------ */

test('FGP-7: playerFragments is a known payload key', function () {
  const src = fs.readFileSync(path.resolve(ROOT, 'game.js'), 'utf-8');
  const keysStart = src.indexOf('const __KNOWN_PAYLOAD_KEYS = [');
  assert(keysStart >= 0, '__KNOWN_PAYLOAD_KEYS must exist');
  const keysEnd = src.indexOf('];', keysStart);
  const list = src.slice(keysStart, keysEnd);
  assert(list.indexOf("'playerFragments'") >= 0, 'playerFragments must be listed in __KNOWN_PAYLOAD_KEYS');
});

test('FGP-8: playerFragments is declared in assets/saveSchema.json', function () {
  const raw = fs.readFileSync(path.resolve(ROOT, 'assets/saveSchema.json'), 'utf-8');
  const schema = JSON.parse(raw);
  assert(schema && schema.properties, 'schema must expose properties');
  assert(!!schema.properties.playerFragments, 'playerFragments must be a declared schema property');
  assertEqual(schema.properties.playerFragments.type, 'array', 'playerFragments schema type');
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
  console.log('All player-fragment persistence checks passed.');
}
