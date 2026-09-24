'use strict';

/**
 * Pack 18: module-owned hangar resource persistence
 * (silicon dust + timed tech study + per-tech feed progress).
 *
 * Regression guard for two player-visible bugs reported together:
 *   1) «Кремниевая пыль» пропадала после загрузки сохранённой игры.
 *   2) Технология, поставленная на изучение и уже набравшая >1 часа прогресса,
 *      после save → load отображалась как «даже не ставил на изучение».
 *
 * Root cause (same class of defect as `playerFragments`, see Pack 12): these
 * resources do NOT live in runtime `state`. They live in the module-owned
 * inventory of `src/ui/hangarChipsUI.js`
 * (`getSiliconDust()` / `getTechStudying()` / `getTechFeedProgress()`).
 * `serializeState()` wrote `playerChips`, `playerFragments`, `hangarCells`,
 * `productionLine` — but NEVER the dust balance, the in-progress tech study or
 * the fed-chip counters, even though the restore paths already read
 * `saved.techStudying`. So the bug was on the WRITE side for dust, and on the
 * READ side for the study (guarded by `if (saved.techStudying && ...)`, so a
 * payload without the field silently kept ticking / reset).
 *
 * Cases:
 *   DSP-1   serializeState() persists the live module-owned dust balance.
 *   DSP-2   Dust writer falls back to `state.siliconDust` when the UI is absent.
 *   DSP-3   Dust writer clamps negatives / non-numbers to 0.
 *   DSP-4   serializeState() persists the in-progress tech study (live-first).
 *   DSP-5   Malformed / incomplete tech study collapses to `null`.
 *   DSP-6   serializeState() persists fed-chip counters and drops junk entries.
 *   DSP-7   Both restore paths write all three fields unconditionally.
 *   DSP-8   All three fields are known payload keys (no false unknown-key diagnostic).
 *   DSP-9   All three fields are declared in assets/saveSchema.json.
 *   DSP-10  New Game (resetPlayerInventory) clears dust, study and feed progress.
 *   DSP-11  Restore uses the NEUTRAL `setSiliconDust` seam (never `creditSiliconDust`).
 *   DSP-12  entry token parity for the touched entry assets.
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
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf-8');
const saveSchema = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/saveSchema.json'), 'utf-8'));

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

/**
 * Save `state` through the real write path (`saveSlot` → `serializeState`) and
 * return the persisted payload. `serializeState` is not exported on
 * `Game.Storage`, so the slot API is the only canonical way to observe it.
 */
function saveAndReadPayload(box, state) {
  box.reset();
  const save = box.global.Game.Storage.saveSlot(0, state);
  assert(save && save.ok, 'saveSlot must succeed, error=' + (save && save.error));
  const loaded = box.global.Game.Storage.loadSlot(0);
  assert(loaded && loaded.ok && loaded.payload, 'loadSlot must return a payload');
  return loaded.payload;
}

/** Live tech study mirroring a 2h tech that already accumulated 1h+ of progress. */
function liveStudy() {
  return { modId: 15, elapsed: 3900, duration: 7200, acceleratedPct: 25 };
}

/* ------------------------------------------------------------------ *
 * DSP-1..3: silicon dust writer
 * ------------------------------------------------------------------ */

test('DSP-1: serializeState() persists the live module-owned dust balance', function () {
  const box = createSandbox();
  box.global.Game.HangarChipsUI.setSiliconDust(175);

  // `state` intentionally does NOT carry the dust — the live UI is the owner.
  const payload = saveAndReadPayload(box, { cells: [] });
  assertEqual(payload.siliconDust, 175, 'live dust balance must be captured');
});

test('DSP-2: dust writer falls back to state.siliconDust when the UI module is absent', function () {
  const box = createSandbox();
  box.global.Game.HangarChipsUI = undefined;

  const payload = saveAndReadPayload(box, { cells: [], siliconDust: 42 });
  assertEqual(payload.siliconDust, 42, 'fallback dust balance must be captured');
});

test('DSP-3: dust writer clamps negatives / non-numbers to 0', function () {
  const box = createSandbox();
  box.global.Game.HangarChipsUI = undefined;

  assertEqual(saveAndReadPayload(box, { cells: [], siliconDust: -50 }).siliconDust, 0, 'negative dust clamps to 0');
  assertEqual(saveAndReadPayload(box, { cells: [], siliconDust: 'lots' }).siliconDust, 0, 'non-number dust becomes 0');
  assertEqual(saveAndReadPayload(box, { cells: [] }).siliconDust, 0, 'missing dust becomes 0 (never null)');
});

/* ------------------------------------------------------------------ *
 * DSP-4..6: tech study + feed progress writers
 * ------------------------------------------------------------------ */

test('DSP-4: serializeState() persists the in-progress tech study', function () {
  const box = createSandbox();
  box.global.Game.HangarChipsUI.setTechStudying(liveStudy());

  const payload = saveAndReadPayload(box, { cells: [] });
  assert(payload.techStudying && typeof payload.techStudying === 'object', 'techStudying must be an object');
  assertEqual(payload.techStudying.modId, 15, 'studied tech id preserved');
  assertEqual(payload.techStudying.elapsed, 3900, 'accumulated study progress preserved');
  assertEqual(payload.techStudying.duration, 7200, 'study duration preserved');
  assertEqual(payload.techStudying.acceleratedPct, 25, 'acceleration preserved');
});

test('DSP-5: malformed / incomplete tech study collapses to null', function () {
  const box = createSandbox();
  box.global.Game.HangarChipsUI = undefined;

  assertEqual(saveAndReadPayload(box, { cells: [] }).techStudying, null, 'missing study becomes null');
  assertEqual(saveAndReadPayload(box, { cells: [], techStudying: {} }).techStudying, null, 'empty study becomes null');
  assertEqual(
    saveAndReadPayload(box, { cells: [], techStudying: { modId: 0, elapsed: 10, duration: 7200 } }).techStudying,
    null,
    'non-positive modId becomes null'
  );
  assertEqual(
    saveAndReadPayload(box, { cells: [], techStudying: { modId: 15, elapsed: 10, duration: 0 } }).techStudying,
    null,
    'non-positive duration becomes null'
  );

  const clamped = saveAndReadPayload(box, {
    cells: [],
    techStudying: { modId: 15, elapsed: 999999, duration: 7200, acceleratedPct: 500 },
  }).techStudying;
  assertEqual(clamped.elapsed, 7200, 'elapsed clamps to duration');
  assertEqual(clamped.acceleratedPct, 100, 'acceleratedPct clamps to 100');
});

test('DSP-6: serializeState() persists fed-chip counters and drops junk entries', function () {
  const box = createSandbox();
  box.global.Game.HangarChipsUI.setTechFeedProgress({ 15: 12, 16: 3 });
  let payload = saveAndReadPayload(box, { cells: [] });
  assertEqual(payload.techFeedProgress['15'], 12, 'live feed progress for tech 15');
  assertEqual(payload.techFeedProgress['16'], 3, 'live feed progress for tech 16');

  box.global.Game.HangarChipsUI = undefined;
  payload = saveAndReadPayload(box, {
    cells: [],
    techFeedProgress: { 15: 5, 0: 9, '-3': 2, 17: 0, 18: -4, abc: 7 },
  });
  assertEqual(Object.keys(payload.techFeedProgress).length, 1, 'only the valid feed entry survives');
  assertEqual(payload.techFeedProgress['15'], 5, 'valid feed entry preserved');
});

/* ------------------------------------------------------------------ *
 * DSP-7..8: restore paths + payload contract surfaces
 * ------------------------------------------------------------------ */

test('DSP-7: both restore paths write dust, study and feed progress unconditionally', function () {
  const restoreStart = gameJs.indexOf('function restoreFullState(saved){');
  assert(restoreStart >= 0, 'restoreFullState must exist');
  const restoreEnd = gameJs.indexOf('function inflateBuyPrice(', restoreStart);
  const restoreBody = gameJs.slice(restoreStart, restoreEnd > restoreStart ? restoreEnd : undefined);
  assert(
    restoreBody.indexOf('setSiliconDust(Number.isFinite(saved.siliconDust) ? Math.max(0, Math.floor(saved.siliconDust)) : 0)') >= 0,
    'restoreFullState must call setSiliconDust with an explicit 0 fallback'
  );
  assert(
    restoreBody.indexOf('setTechFeedProgress(') >= 0 && restoreBody.indexOf('saved.techFeedProgress') >= 0,
    'restoreFullState must restore fed-chip counters'
  );
  assert(
    restoreBody.indexOf('setTechStudying(') >= 0 && restoreBody.indexOf('saved.techStudying') >= 0,
    'restoreFullState must restore the tech study'
  );
  assert(
    restoreBody.indexOf("saved.techStudying && typeof saved.techStudying === 'object' ? saved.techStudying : null") >= 0,
    'restoreFullState study restore must be unconditional with a null fallback'
  );

  const applyStart = gameJs.indexOf('function applySavedProgress(data){');
  assert(applyStart >= 0, 'applySavedProgress must exist');
  const applyEnd = gameJs.indexOf('\nfunction ', applyStart + 10);
  const applyBody = gameJs.slice(applyStart, applyEnd > applyStart ? applyEnd : undefined);
  assert(
    applyBody.indexOf('setSiliconDust(Number.isFinite(data.siliconDust) ? Math.max(0, Math.floor(data.siliconDust)) : 0)') >= 0,
    'applySavedProgress must call setSiliconDust with an explicit 0 fallback'
  );
  assert(
    applyBody.indexOf('setTechFeedProgress(') >= 0 && applyBody.indexOf('data.techFeedProgress') >= 0,
    'applySavedProgress must restore fed-chip counters'
  );
  assert(
    applyBody.indexOf('setTechStudying(') >= 0 && applyBody.indexOf('data.techStudying') >= 0,
    'applySavedProgress must restore the tech study'
  );
});

test('DSP-8: dust, tech study and feed progress are known payload keys', function () {
  const keysStart = gameJs.indexOf('const __KNOWN_PAYLOAD_KEYS = [');
  assert(keysStart >= 0, '__KNOWN_PAYLOAD_KEYS must exist');
  const keysEnd = gameJs.indexOf('];', keysStart);
  const list = gameJs.slice(keysStart, keysEnd);
  assert(list.indexOf("'siliconDust'") >= 0, 'siliconDust must be listed in __KNOWN_PAYLOAD_KEYS');
  assert(list.indexOf("'techStudying'") >= 0, 'techStudying must be listed in __KNOWN_PAYLOAD_KEYS');
  assert(list.indexOf("'techFeedProgress'") >= 0, 'techFeedProgress must be listed in __KNOWN_PAYLOAD_KEYS');
});

test('DSP-9: all three fields are declared in assets/saveSchema.json and the JSDoc typedef', function () {
  assert(saveSchema && saveSchema.properties, 'schema must expose properties');
  assert(!!saveSchema.properties.siliconDust, 'siliconDust must be a declared schema property');
  assertEqual(saveSchema.properties.siliconDust.type, 'integer', 'siliconDust schema type');
  assert(!!saveSchema.properties.techStudying, 'techStudying must be a declared schema property');
  assert(!!saveSchema.properties.techFeedProgress, 'techFeedProgress must be a declared schema property');
  assertEqual(saveSchema.properties.techFeedProgress.type, 'object', 'techFeedProgress schema type');
  assert(typesJs.indexOf('@property {number} siliconDust') >= 0, 'typedef documents siliconDust');
  assert(typesJs.indexOf('techStudying') >= 0, 'typedef documents techStudying');
  assert(typesJs.indexOf('techFeedProgress') >= 0, 'typedef documents techFeedProgress');
});

/* ------------------------------------------------------------------ *
 * DSP-10..11: New Game contract + neutral dust seam
 * ------------------------------------------------------------------ */

test('DSP-10: New Game (resetPlayerInventory) clears dust, study and feed progress', function () {
  const box = createSandbox();
  const hcui = box.global.Game.HangarChipsUI;
  hcui.setSiliconDust(175);
  hcui.setTechStudying(liveStudy());
  hcui.setTechFeedProgress({ 15: 12 });

  hcui.resetPlayerInventory({ reason: 'new_game' });

  assertEqual(hcui.getSiliconDust(), 0, 'New Game clears the dust balance');
  assertEqual(hcui.getTechStudying(), null, 'New Game clears the in-progress study');
  assertEqual(Object.keys(hcui.getTechFeedProgress()).length, 0, 'New Game clears fed-chip counters');
});

test('DSP-11: restore uses the neutral setSiliconDust seam, never creditSiliconDust', function () {
  const restoreStart = gameJs.indexOf('function restoreFullState(saved){');
  const restoreEnd = gameJs.indexOf('function inflateBuyPrice(', restoreStart);
  const restoreBody = gameJs.slice(restoreStart, restoreEnd);
  assert(restoreBody.indexOf('setSiliconDust(') >= 0, 'restoreFullState uses the neutral dust seam');
  assert(restoreBody.indexOf('creditSiliconDust(') === -1, 'restore must not re-credit the lifetime dust counter');

  const applyStart = gameJs.indexOf('function applySavedProgress(data){');
  const applyEnd = gameJs.indexOf('\nfunction ', applyStart + 10);
  const applyBody = gameJs.slice(applyStart, applyEnd);
  assert(applyBody.indexOf('setSiliconDust(') >= 0, 'applySavedProgress uses the neutral dust seam');
  assert(applyBody.indexOf('creditSiliconDust(') === -1, 'legacy restore must not re-credit the lifetime dust counter');
});

/* ------------------------------------------------------------------ *
 * DSP-12: entry token parity
 * ------------------------------------------------------------------ */

test('DSP-12: touched entry assets carry the shared entry token', function () {
  const m = indexHtml.match(/var token = '([^']+)'/);
  assert(m, 'entry token present');
  const entry = m[1];
  assert(indexHtml.indexOf('src/persistence/storage.js?v=' + entry) !== -1, 'storage.js carries the entry token');
  assert(
    indexHtml.indexOf('src/persistence/serializedStateTypes.js?v=' + entry) !== -1,
    'serializedStateTypes.js carries the entry token'
  );
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
  console.log('All hangar resource persistence checks passed.');
}
