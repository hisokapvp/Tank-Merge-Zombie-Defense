'use strict';

/**
 * Pack 19: whole-chip (playerChips) inventory persistence — save → load round-trip.
 *
 * Regression guard for the bug where WHOLE chips vanished from the inventory
 * after loading a saved game, while fragments and silicon dust survived.
 *
 * Root cause (WRITE side):
 *   `src/ui/hangarChipsUI.js` resolves its canonical inventory owner via
 *   `_canonicalPlayerChipsApi()` → `Game.State.getPlayerChips/setPlayerChips`.
 *   That namespace does NOT exist anywhere in the codebase, so the resolver
 *   always returns null and every chip mutation lands in the module-owned
 *   `_playerChipsFallback` array. As a result `state.playerChips` stays `[]`
 *   for the whole run after a New Game.
 *
 *   `serializeState()` wrote `playerChips: Array.isArray(state.playerChips) ? ... : []`
 *   — i.e. it captured the PERMANENTLY EMPTY mirror instead of the live
 *   inventory. Every slot save therefore persisted `playerChips: []`, and the
 *   restore path (which only writes when the field is an array — and `[]` is an
 *   array) wiped the inventory.
 *
 *   Fragments / silicon dust / hangar cells did not regress because their
 *   writers are live-first (`getPlayerFragments()` / `getSiliconDust()` /
 *   `getCells()`), mirroring exactly what `playerChips` was missing.
 *
 * Cases:
 *   CPS-1   serializeState() persists the live module-owned chip inventory.
 *   CPS-2   writer falls back to `state.playerChips` when the UI module is absent.
 *   CPS-3   an empty array (not null/undefined) when no inventory exists at all.
 *   CPS-4   malformed / non-object entries are dropped.
 *   CPS-5   both restore paths write the inventory unconditionally ([] fallback).
 *   CPS-6   restored inventory does not alias the payload array.
 *   CPS-7   resetPlayerInventory() (New Game) clears the whole-chip inventory.
 *   CPS-8   `playerChips` is a known payload key.
 *   CPS-9   `playerChips` is declared in assets/saveSchema.json and the typedef.
 *   CPS-10  entry token parity for the touched entry assets.
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
const typesJs = fs.readFileSync(path.join(ROOT, 'src/persistence/serializedStateTypes.js'), 'utf-8');
const saveDoc = fs.readFileSync(path.join(ROOT, 'docs/ai/SYSTEMS/save.md'), 'utf-8');
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf-8');
const saveSchema = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/saveSchema.json'), 'utf-8'));

/* ------------------------------------------------------------------ *
 * Shared sandbox: storage.js + hangarChips.js + hangarChipsUI.js
 *
 * NOTE: `Game.State` is intentionally NOT provided — this mirrors the real
 * runtime, where the namespace is absent and chips therefore live in the
 * module-owned fallback inventory.
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
    setInterval: function () { return 0; },
    clearInterval: function () {},
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

/** Live whole-chip inventory mirroring a real workshop (two owned chips). */
function liveChips() {
  return [
    { chipId: 1, chipColor: 'red', modIds: [1, 2, 3], sourceComboKey: '1-2-3', level: 2, count: 1 },
    { chipId: 7, chipColor: 'blue', modIds: [7, 8, 9], sourceComboKey: '7-8-9', level: 1, count: 3 },
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
 * CPS-1..4: writer captures the live inventory
 * ------------------------------------------------------------------ */

test('CPS-1: serializeState() persists the live module-owned chip inventory', function () {
  const box = createSandbox();
  box.global.Game.HangarChipsUI.setPlayerChips(liveChips());

  // `state` deliberately carries the (realistically empty) mirror — the live
  // module-owned inventory is the only place whole chips actually live.
  const payload = saveAndReadPayload(box, { cells: [], playerChips: [] });
  assert(Array.isArray(payload.playerChips), 'playerChips must be an array');
  assertEqual(payload.playerChips.length, 2, 'both live chips must be captured');
  assertEqual(payload.playerChips[0].chipId, 1, 'first chip id preserved');
  assertEqual(payload.playerChips[0].level, 2, 'first chip level preserved');
  assertEqual(payload.playerChips[1].count, 3, 'second chip stack count preserved');
});

test('CPS-2: writer falls back to state.playerChips when the UI module is absent', function () {
  const box = createSandbox();
  box.global.Game.HangarChipsUI = undefined;

  const payload = saveAndReadPayload(box, { cells: [], playerChips: liveChips() });
  assertEqual(payload.playerChips.length, 2, 'fallback inventory must be captured');
});

test('CPS-3: playerChips is an empty array when no inventory exists at all', function () {
  const box = createSandbox();
  box.global.Game.HangarChipsUI = undefined;

  const payload = saveAndReadPayload(box, { cells: [] });
  assert(Array.isArray(payload.playerChips), 'playerChips must be an array (not null/undefined)');
  assertEqual(payload.playerChips.length, 0, 'empty inventory yields []');
});

test('CPS-4: malformed / non-object chip entries are dropped', function () {
  const box = createSandbox();
  box.global.Game.HangarChipsUI = undefined;

  const payload = saveAndReadPayload(box, {
    cells: [],
    playerChips: [
      { chipId: 3, chipColor: 'red', modIds: [1, 2, 3], sourceComboKey: '1-2-3', level: 1, count: 1 },
      null,
      'garbage',
      42,
      undefined,
    ],
  });
  assertEqual(payload.playerChips.length, 1, 'only the valid chip entry survives');
  assertEqual(payload.playerChips[0].chipId, 3, 'valid chip id preserved');
});

/* ------------------------------------------------------------------ *
 * CPS-5..6: restore paths
 * ------------------------------------------------------------------ */

test('CPS-5: both restore paths write the inventory unconditionally', function () {
  const restoreStart = gameJs.indexOf('function restoreFullState(saved){');
  assert(restoreStart >= 0, 'restoreFullState must exist');
  const restoreEnd = gameJs.indexOf('function inflateBuyPrice(', restoreStart);
  const restoreBody = gameJs.slice(restoreStart, restoreEnd > restoreStart ? restoreEnd : undefined);
  assert(
    restoreBody.indexOf('HangarChipsUI.setPlayerChips(Array.isArray(saved.playerChips) ? saved.playerChips.slice() : [], { reason: \'restore\' })') >= 0,
    'restoreFullState must call setPlayerChips unconditionally with a [] fallback'
  );
  assert(
    restoreBody.indexOf('if (Array.isArray(saved.playerChips)) {') === -1,
    'restoreFullState must not gate the inventory restore behind Array.isArray (stale-chip leak)'
  );

  const applyStart = gameJs.indexOf('function applySavedProgress(data){');
  assert(applyStart >= 0, 'applySavedProgress must exist');
  const applyEnd = gameJs.indexOf('\nfunction ', applyStart + 10);
  const applyBody = gameJs.slice(applyStart, applyEnd > applyStart ? applyEnd : undefined);
  assert(
    applyBody.indexOf('HangarChipsUI.setPlayerChips(Array.isArray(data.playerChips) ? data.playerChips.slice() : [], { reason: \'restore\' })') >= 0,
    'applySavedProgress must call setPlayerChips unconditionally with a [] fallback'
  );
  assert(
    applyBody.indexOf('if (Array.isArray(data.playerChips)) {') === -1,
    'applySavedProgress must not gate the inventory restore behind Array.isArray (stale-chip leak)'
  );
});

test('CPS-6: restore transfers array ownership (no aliasing of the payload array)', function () {
  const box = createSandbox();
  const hcui = box.global.Game.HangarChipsUI;
  hcui.setPlayerChips(liveChips());

  const payload = saveAndReadPayload(box, { cells: [], playerChips: [] });

  // Simulate the restore-path ownership transfer (`payload.playerChips.slice()`).
  hcui.setPlayerChips(payload.playerChips.slice());
  assertEqual(hcui.getPlayerChips().length, 2, 'precondition: inventory restored');

  payload.playerChips.length = 0;
  payload.playerChips.push({ chipId: 99, modIds: [1], level: 1, count: 9 });

  const live = hcui.getPlayerChips();
  assertEqual(live.length, 2, 'live inventory must not follow payload array mutations');
  assertEqual(live[0].chipId, 1, 'live inventory contents unchanged by payload mutation');
});

test('CPS-7: New Game (resetPlayerInventory) clears the whole-chip inventory', function () {
  const box = createSandbox();
  const hcui = box.global.Game.HangarChipsUI;
  hcui.setPlayerChips(liveChips());
  assertEqual(hcui.getPlayerChips().length, 2, 'precondition: chips owned');

  hcui.resetPlayerInventory({ reason: 'new_game' });
  assertEqual(hcui.getPlayerChips().length, 0, 'New Game clears the whole-chip inventory');
});

/* ------------------------------------------------------------------ *
 * CPS-8..10: payload contract surfaces
 * ------------------------------------------------------------------ */

test('CPS-8: playerChips is a known payload key and has a live-first writer', function () {
  const keysStart = gameJs.indexOf('const __KNOWN_PAYLOAD_KEYS = [');
  assert(keysStart >= 0, '__KNOWN_PAYLOAD_KEYS must exist');
  const keysEnd = gameJs.indexOf('];', keysStart);
  assert(gameJs.slice(keysStart, keysEnd).indexOf("'playerChips'") >= 0, 'playerChips must be listed in __KNOWN_PAYLOAD_KEYS');

  assert(storageJs.indexOf('function serializePlayerChips(state)') >= 0, 'storage.js must own serializePlayerChips()');
  assert(
    storageJs.indexOf("typeof chipsUi.getPlayerChips === 'function' ? chipsUi.getPlayerChips() : null") >= 0,
    'serializePlayerChips must read the live UI inventory first'
  );
  assert(
    storageJs.indexOf('playerChips: serializePlayerChips(state),') >= 0,
    'serializeState() must route playerChips through the live-first writer'
  );
  assert(
    storageJs.indexOf('playerChips: Array.isArray(state.playerChips) ? state.playerChips : [],') === -1,
    'serializeState() must not write the permanently-empty state.playerChips mirror'
  );
});

test('CPS-9: playerChips is documented in saveSchema.json, the typedef and save.md', function () {
  assert(saveSchema && saveSchema.properties, 'schema must expose properties');
  assert(!!saveSchema.properties.playerChips, 'playerChips must be declared in the schema');
  assert(typesJs.indexOf('playerChips') >= 0, 'typedef documents playerChips');
  assert(
    saveDoc.indexOf('serializePlayerChips()') >= 0,
    'docs/ai/SYSTEMS/save.md must document the live-first playerChips writer'
  );
});

test('CPS-10: touched entry assets carry the shared entry token', function () {
  const m = indexHtml.match(/var token = '([^']+)'/);
  assert(m, 'entry token present');
  const entry = m[1];
  assert(indexHtml.indexOf('src/persistence/storage.js?v=' + entry) !== -1, 'storage.js carries the entry token');
  assert(indexHtml.indexOf('src/ui/hangarChipsUI.js?v=' + entry) !== -1, 'hangarChipsUI.js carries the entry token');
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
  console.log('All whole-chip persistence checks passed.');
}
