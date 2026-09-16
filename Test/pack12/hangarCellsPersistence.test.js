'use strict';

/**
 * Pack 12: hangar-cell installed-chip persistence (save → load round-trip).
 *
 * Regression guard for the bug where chips installed into hangar cell slots
 * vanished after loading a saved game.
 *
 * Root cause: installed chips do NOT live in runtime `state`. They live in the
 * module-owned 16-cell grid `_cells` inside `src/ui/hangarChipsUI.js`
 * (`Game.HangarChipsUI.getCells()` / `.setCells()`). `serializeState()` never
 * wrote that grid, so every save dropped it — while `playerChips` (the inventory)
 * was persisted correctly, which made the loss look like an inventory bug.
 *
 * The fix must not regress the opposite requirement: "New Game" still has to
 * clear installed chips without a page reload (`resetPlayerInventory()` rebuilds
 * the grid), and loading a legacy save that has no `hangarCells` must clear the
 * grid instead of leaking the previous session's chips.
 *
 * Cases:
 *   HCP-1  serializeState() persists the module-owned grid (live `getCells()`).
 *   HCP-2  Only the persisted subset is written (no derived activeModifiers/uiState).
 *   HCP-3  Grid falls back to `state.hangarCells` when the UI module is absent.
 *   HCP-4  `hangarCells` is null (not undefined) when no grid exists at all.
 *   HCP-5  setCells() restores slots and recomputes activeModifiers (red match).
 *   HCP-6  setCells() is fail-soft: malformed slots are dropped, grid stays 16 long.
 *   HCP-7  setCells([]) clears the grid (legacy save must not leak chips).
 *   HCP-8  restoreFullState()/applySavedProgress() call setCells unconditionally.
 *   HCP-9  resetPlayerInventory() (New Game) still rebuilds an empty grid.
 *   HCP-10 `hangarCells` is a known payload key (no false unknown-key diagnostic).
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

/** Build a minimal installed red chip record (chip 1 = triple "1-1-2"). */
function installedRedChip(overrides) {
  const base = {
    chipId: 1,
    modIds: [1, 1, 2],
    sourceComboKey: '1-1-2',
    rotation: 0,
    level: 1,
  };
  return Object.assign(base, overrides || {});
}

/** Live grid mirroring a real hangar: cell 0 has a matched red pair, cell 3 a lone yellow chip. */
function createLiveGrid(hcui) {
  const h = hcui.Game.HangarChips;
  const cells = h.createHangarCellsState();
  h.installChip(cells[0], 'red', 'slot1', h.getChipById(h.allChips, 1), 1);
  h.installChip(cells[0], 'red', 'slot2', h.getChipById(h.allChips, 1), 1);
  h.installChip(cells[3], 'yellow', 'slot1', h.getChipById(h.allChips, 157), 2);
  return cells;
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
 * HCP-1..4: serializeState() captures the module-owned grid
 * ------------------------------------------------------------------ */

test('HCP-1: serializeState() persists the live module-owned grid', function () {
  const box = createSandbox();
  const hcui = box.global.Game.HangarChipsUI;
  hcui.setCells(createLiveGrid(box.global));

  const payload = saveAndReadPayload(box, { cells: [] });
  assert(Array.isArray(payload.hangarCells), 'hangarCells must be an array');
  assertEqual(payload.hangarCells.length, 16, 'grid length');
  assert(payload.hangarCells[0].redSlots.slot1 !== null, 'cell 0 slot1 chip must be captured');
  assert(payload.hangarCells[0].redSlots.slot2 !== null, 'cell 0 slot2 chip must be captured');
  assert(payload.hangarCells[3].yellowSlots.slot1 !== null, 'cell 3 yellow chip must be captured');
  assertEqual(payload.hangarCells[3].yellowSlots.slot1.level, 2, 'installed chip level preserved');
});

test('HCP-2: only the persisted subset is written (derived fields excluded)', function () {
  const box = createSandbox();
  const hcui = box.global.Game.HangarChipsUI;
  hcui.setCells(createLiveGrid(box.global));

  const payload = saveAndReadPayload(box, { cells: [] });
  const cell = payload.hangarCells[0];
  assert(!('activeModifiers' in cell), 'activeModifiers is runtime-derived and must not be persisted');
  assert(!('uiState' in cell), 'uiState is runtime-derived and must not be persisted');
  assert(!('tankId' in cell), 'tankId is runtime-derived and must not be persisted');

  const slot = cell.redSlots.slot1;
  assertEqual(slot.chipId, 1, 'slot.chipId');
  assertEqual(slot.sourceComboKey, '1-1-2', 'slot.sourceComboKey');
  assertEqual(slot.rotation, 0, 'slot.rotation');
  assertEqual(slot.level, 1, 'slot.level');
  assert(Array.isArray(slot.modIds) && slot.modIds.length === 3, 'slot.modIds preserved');
});

test('HCP-3: grid falls back to state.hangarCells when the UI module is absent', function () {
  const box = createSandbox();
  const h = box.global.Game.HangarChips;
  const fallbackGrid = h.createHangarCellsState();
  h.installChip(fallbackGrid[5], 'red', 'slot1', h.getChipById(h.allChips, 1), 1);
  box.global.Game.HangarChipsUI = undefined;

  const payload = saveAndReadPayload(box, { cells: [], hangarCells: fallbackGrid });
  assert(Array.isArray(payload.hangarCells), 'fallback grid must still be captured');
  assert(payload.hangarCells[5].redSlots.slot1 !== null, 'fallback cell 5 chip captured');
});

test('HCP-4: hangarCells is null when neither the grid nor state.hangarCells exist', function () {
  const box = createSandbox();
  box.global.Game.HangarChipsUI = undefined;
  const payload = saveAndReadPayload(box, { cells: [] });
  assert(payload.hangarCells === null, 'hangarCells must be null (not undefined) with no grid');
});

/* ------------------------------------------------------------------ *
 * HCP-5..7: setCells() restore semantics
 * ------------------------------------------------------------------ */

test('HCP-5: setCells() restores slots and recomputes activeModifiers', function () {
  const box = createSandbox();
  const hcui = box.global.Game.HangarChipsUI;
  const h = box.global.Game.HangarChips;
  hcui.setCells(createLiveGrid(box.global));
  const payload = saveAndReadPayload(box, { cells: [] });

  // Fresh, empty grid → then restore from the payload.
  hcui.setCells([]);
  hcui.setCells(payload.hangarCells);

  const cells = hcui.getCells();
  assertEqual(cells.length, 16, 'restored grid length');
  const chip = cells[0].redSlots.slot1;
  assert(!!chip, 'cell 0 slot1 must be restored');
  assertEqual(chip.chipId, 1, 'restored chipId');
  assertEqual(chip.sourceComboKey, '1-1-2', 'restored sourceComboKey');

  // Both red slots hold the same chip → red match must be recomputed.
  assert(cells[0].uiState.redMatchSuccess === true, 'redMatchSuccess recomputed after load');
  assert(Array.isArray(cells[0].activeModifiers) && cells[0].activeModifiers.length === 2,
    'activeModifiers recomputed (2 red mods)');

  const yellow = cells[3].yellowSlots.slot1;
  assert(!!yellow, 'cell 3 yellow chip restored');
  assertEqual(yellow.level, 2, 'yellow chip level restored');
});

test('HCP-6: setCells() is fail-soft on malformed slots and keeps the grid shape', function () {
  const box = createSandbox();
  const hcui = box.global.Game.HangarChipsUI;
  hcui.setCells([134, 7, null, 0, 0, 0]);

  const cells = hcui.getCells();
  assert(Array.isArray(cells), 'grid must remain an array');
  assertEqual(cells.length, 16, 'grid must keep its canonical 16-cell shape');

  hcui.setCells([
    { id: 0, redSlots: { slot1: { chipId: 1, modIds: [1, 1, 2], sourceComboKey: '1-1-2', rotation: 99, level: 0 } } },
  ]);
  const restored = hcui.getCells()[0].redSlots.slot1;
  assert(!!restored, 'valid slot survives');
  assertEqual(restored.rotation, 0, 'rotation normalized into 0..2');
  assertEqual(restored.level, 1, 'invalid level falls back to 1');

  // Missing modIds → dropped, not turned into a ghost chip.
  hcui.setCells([{ id: 1, redSlots: { slot2: { chipId: 4 } } }]);
  assert(hcui.getCells()[1].redSlots.slot2 === null, 'slot without modIds must be dropped');
});

test('HCP-7: setCells([]) clears the grid (legacy save must not leak chips)', function () {
  const box = createSandbox();
  const hcui = box.global.Game.HangarChipsUI;
  hcui.setCells(createLiveGrid(box.global));
  assert(hcui.getCells()[0].redSlots.slot1 !== null, 'precondition: chips installed');

  hcui.setCells([]);
  const cells = hcui.getCells();
  assertEqual(cells.length, 16, 'cleared grid keeps 16 cells');
  for (let i = 0; i < 16; i++) {
    assert(cells[i].redSlots.slot1 === null, 'cell ' + i + ' red slot1 cleared');
    assert(cells[i].redSlots.slot2 === null, 'cell ' + i + ' red slot2 cleared');
    assert(cells[i].yellowSlots.slot1 === null, 'cell ' + i + ' yellow slot1 cleared');
    assert(cells[i].yellowSlots.slot2 === null, 'cell ' + i + ' yellow slot2 cleared');
    assert(cells[i].yellowSlots.slot3 === null, 'cell ' + i + ' yellow slot3 cleared');
    assert(cells[i].yellowSlots.slot4 === null, 'cell ' + i + ' yellow slot4 cleared');
  }
});

/* ------------------------------------------------------------------ *
 * HCP-8..10: restore paths + New Game + payload contract
 * ------------------------------------------------------------------ */

test('HCP-8: both restore paths call setCells unconditionally', function () {
  const src = fs.readFileSync(path.resolve(ROOT, 'game.js'), 'utf-8');

  const restoreStart = src.indexOf('function restoreFullState(saved){');
  assert(restoreStart >= 0, 'restoreFullState must exist');
  const restoreEnd = src.indexOf('function restoreSupercomputerAfterCritical(){', restoreStart);
  const restoreBody = src.slice(restoreStart, restoreEnd > restoreStart ? restoreEnd : undefined);
  assert(
    restoreBody.indexOf('HangarChipsUI.setCells(Array.isArray(saved.hangarCells) ? saved.hangarCells : [])') >= 0,
    'restoreFullState must call setCells with an explicit [] fallback (no chip leak)'
  );

  const applyStart = src.indexOf('function applySavedProgress(data){');
  assert(applyStart >= 0, 'applySavedProgress must exist');
  const applyEnd = src.indexOf('\nfunction ', applyStart + 10);
  const applyBody = src.slice(applyStart, applyEnd > applyStart ? applyEnd : undefined);
  assert(
    applyBody.indexOf('HangarChipsUI.setCells(Array.isArray(data.hangarCells) ? data.hangarCells : [])') >= 0,
    'applySavedProgress must call setCells with an explicit [] fallback (no chip leak)'
  );
});

test('HCP-9: resetPlayerInventory (New Game) still rebuilds an empty grid', function () {
  const box = createSandbox();
  const hcui = box.global.Game.HangarChipsUI;
  hcui.setCells(createLiveGrid(box.global));
  assert(hcui.getCells()[0].redSlots.slot1 !== null, 'precondition: chips installed');

  hcui.resetPlayerInventory({ reason: 'new_game' });
  const cells = hcui.getCells();
  assertEqual(cells.length, 16, 'New Game grid keeps 16 cells');
  assert(cells[0].redSlots.slot1 === null, 'New Game clears installed chips');
  assert(cells[3].yellowSlots.slot1 === null, 'New Game clears yellow chips');
});

test('HCP-10: hangarCells is a known payload key', function () {
  const src = fs.readFileSync(path.resolve(ROOT, 'game.js'), 'utf-8');
  const keysStart = src.indexOf('const __KNOWN_PAYLOAD_KEYS = [');
  assert(keysStart >= 0, '__KNOWN_PAYLOAD_KEYS must exist');
  const keysEnd = src.indexOf('];', keysStart);
  const list = src.slice(keysStart, keysEnd);
  assert(list.indexOf("'hangarCells'") >= 0, 'hangarCells must be listed in __KNOWN_PAYLOAD_KEYS');
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
  console.log('All hangar-cell chip persistence checks passed.');
}