'use strict';

/**
 * Pack 12 — chip craft-from-fragments + tech-upgrade match stability.
 *
 * Regression guard for two reported player-facing bugs:
 *
 *   Bug 1 — crafting a chip from tier II/III fragments produced a chip that
 *   could not be installed into any slot. Root cause: `assembleChip()` matched
 *   the combination against the pool by joined *live* modIds, so any
 *   tech-upgraded fragment (15–30) produced `chipId: -1`, and every install
 *   path resolves the chip through `getChipById()` — a lookup that returned null.
 *
 *   Bug 2 — after upgrading a modification (tech unlock), the order of the
 *   modifiers inside a whole chip changed, so two chips that shared two
 *   modifiers stopped syncing. Root cause: `normalizeRedPlacement()` /
 *   `normalizeYellowPlacement()` sorted by the *live* modId. Unlocking tier II
 *   moved that mod past its neighbours in the sort order and reshuffled the
 *   A/B/C vertices, breaking `checkRedMatch` / `checkYellowMatch`.
 *
 * Also covers the self-healing path for legacy inventory entries that were
 * already persisted with `chipId: -1` before the fix.
 *
 * Cases:
 *   CFS-1  assembleChip() from tier II/III fragments returns a real pool chipId.
 *   CFS-2  The crafted chip is resolvable via getChipById() (install path works).
 *   CFS-3  Invalid base combinations are still rejected (all-same, 2+ specials).
 *   CFS-4  Base-only crafting is unchanged (no behaviour drift).
 *   CFS-5  resolveChipDefForModIds() heals a legacy modIds triple.
 *   CFS-6  Red pair still matches after the shared mod is upgraded to tier II.
 *   CFS-7  Red pair still matches after the shared mod is upgraded to tier III.
 *   CFS-8  Red pair still matches when only ONE side was upgraded (mixed tiers).
 *   CFS-9  Yellow inner adjacency survives a tech upgrade of an inner mod.
 *   CFS-10 A genuinely different chip still fails to match (no false positives).
 *   CFS-11 setPlayerChips() repairs a legacy `chipId: -1` entry in place.
 *   CFS-12 Tech tier resolution for active modifiers is preserved (HTR parity).
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

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

const ROOT = path.resolve(__dirname, '../..');

function createApi() {
  const source = fs.readFileSync(path.join(ROOT, 'src', 'mechanics', 'hangarChips.js'), 'utf8');
  const sandbox = {
    window: { Game: {} },
    Game: {},
    console: { log: function () {}, warn: function () {}, error: function () {} },
  };
  sandbox.global = sandbox.window;
  vm.runInNewContext(source, sandbox, { filename: 'hangarChips.js' });
  return sandbox.window.Game.HangarChips;
}

/* Sandbox with mechanics + UI, mirroring pack12/hangarCellsPersistence. */
function createUiSandbox() {
  const sandboxGlobal = {
    localStorage: {
      _d: {},
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null; },
      setItem: function (k, v) { this._d[k] = String(v); },
      removeItem: function (k) { delete this._d[k]; },
    },
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

  const load = function (relPath) {
    const code = fs.readFileSync(path.join(ROOT, relPath), 'utf-8');
    const fn = new Function('window', 'global', 'localStorage', 'console', 'document', code);
    fn(sandboxGlobal, sandboxGlobal, sandboxGlobal.localStorage, sandboxGlobal.console, sandboxGlobal.document);
  };
  load(path.join('src', 'mechanics', 'hangarChips.js'));
  load(path.join('src', 'ui', 'hangarChipsUI.js'));
  return sandboxGlobal;
}

console.log('\n── Pack 12: Chip craft + tech-upgrade match stability ──');

test('CFS-1: assembleChip() from tier II/III fragments returns a real pool chipId', function () {
  const api = createApi();
  api.setUnlockedTechs({ 15: true, 16: true, 17: true, 18: true });
  /* 16 = Multishot III (base 1), 18 = Chain Charge III (base 2), 2 = Chain Charge I */
  const crafted = api.assembleChip([16, 18, 2]);
  assert(crafted, 'crafted chip must not be null');
  assert(crafted.chipId > 0, 'chipId must resolve to a real pool chip, got ' + crafted.chipId);
  assertEqual(crafted.sourceComboKey, '1-2-2', 'base combo key folds tiers onto base mods');
  assertEqual(crafted.chipColor, 'red', 'base-only triple stays red');
});

test('CFS-2: crafted chip is resolvable through getChipById (install path works)', function () {
  const api = createApi();
  api.setUnlockedTechs({ 15: true, 16: true, 17: true, 18: true });
  const crafted = api.assembleChip([16, 18, 2]);
  const resolved = api.getChipById(api.allChips, crafted.chipId);
  assert(resolved, 'getChipById must find the crafted chip');
  assertEqual(resolved.chipId, crafted.chipId, 'resolved chipId matches');
  assertEqual(resolved.chipColor, crafted.chipColor, 'resolved color matches');
});

test('CFS-3: invalid base combinations are still rejected', function () {
  const api = createApi();
  api.setUnlockedTechs({ 15: true });
  /* Multishot III → base 1, so [15, 1, 1] folds to 1-1-1 (all-same) and must fail. */
  assertEqual(api.assembleChip([15, 1, 1]), null, 'all-same base triple rejected');
  /* Two specials (11 + 12) fold to two specials and must fail. */
  assertEqual(api.assembleChip([11, 12, 1]), null, 'triple with two specials rejected');
  assertEqual(api.assembleChip([1, 2]), null, 'incomplete triple rejected');
});

test('CFS-4: base-only crafting is unchanged', function () {
  const api = createApi();
  const base = api.assembleChip([2, 3, 4]);
  assert(base, 'base triple must craft');
  assertEqual(base.sourceComboKey, '2-3-4', 'base key preserved');
  assertEqual(base.chipId, api.getChipByKey(api.allChips, '2-3-4').chipId, 'base chipId preserved');
  assertEqual(JSON.stringify(base.modIds.slice().sort(function (a, b) { return a - b; })),
    JSON.stringify([2, 3, 4]), 'base modIds preserved');
});

test('CFS-5: resolveChipDefForModIds() heals a legacy modIds triple', function () {
  const api = createApi();
  api.setUnlockedTechs({ 17: true });
  const healed = api.resolveChipDefForModIds([17, 3, 4]);
  assert(healed, 'legacy triple must heal');
  assert(healed.chipId > 0, 'healed chipId is a real pool id');
  assertEqual(healed.sourceComboKey, '2-3-4', 'healed key folds the tier onto its base');
});

test('CFS-6: red pair still matches after the shared mod is upgraded to tier II', function () {
  const api = createApi();
  const before = api.createEmptyCell(0);
  before.redSlots.slot1 = { modIds: [2, 3, 4], rotation: 0 };
  before.redSlots.slot2 = { modIds: [2, 3, 5], rotation: 0 };
  assertEqual(api.calculateActiveModifiers(before).redMatchSuccess, true, 'baseline pair matches');

  api.setUnlockedTechs({ 17: true }); /* 2 → 17 on every stored chip */
  const after = api.createEmptyCell(1);
  after.redSlots.slot1 = { modIds: [17, 3, 4], rotation: 0 };
  after.redSlots.slot2 = { modIds: [17, 3, 5], rotation: 0 };
  const res = api.calculateActiveModifiers(after);
  assertEqual(res.redMatchSuccess, true, 'pair must keep matching after the tier II unlock');
  assertEqual(res.modifiers.length, 2, 'both shared vertices stay active');
  assert(res.modifiers[0].modId >= 15, 'active modifier resolves to the upgraded tier, got ' + res.modifiers[0].modId);
});

test('CFS-7: red pair still matches after the shared mod is upgraded to tier III', function () {
  const api = createApi();
  api.setUnlockedTechs({ 15: true, 16: true }); /* 1 → 15 → 16 */
  const cell = api.createEmptyCell(0);
  cell.redSlots.slot1 = { modIds: [16, 3, 4], rotation: 0 };
  cell.redSlots.slot2 = { modIds: [16, 3, 5], rotation: 0 };
  const res = api.calculateActiveModifiers(cell);
  assertEqual(res.redMatchSuccess, true, 'pair must match at tier III too');
  assertEqual(res.modifiers[0].modId, 16, 'active modifier resolves to tier III');
});

test('CFS-8: red pair still matches when only one side was upgraded (mixed tiers)', function () {
  const api = createApi();
  api.setUnlockedTechs({ 17: true });
  const cell = api.createEmptyCell(0);
  /* Left chip still stores base mod 2; right chip was rewritten to 17 by the unlock. */
  cell.redSlots.slot1 = { modIds: [2, 3, 4], rotation: 0 };
  cell.redSlots.slot2 = { modIds: [17, 3, 5], rotation: 0 };
  const res = api.calculateActiveModifiers(cell);
  assertEqual(res.redMatchSuccess, true, 'mixed base/upgraded stores must still match');
});

test('CFS-9: yellow inner adjacency survives a tech upgrade of an inner mod', function () {
  const api = createApi();
  const before = api.createEmptyCell(0);
  before.redSlots.slot1 = { modIds: [2, 3, 4], rotation: 0 };
  before.yellowSlots.slot1 = { modIds: [2, 4, 11], rotation: 0 };
  assertEqual(api.calculateActiveModifiers(before).yellowMatchSuccess, true, 'baseline yellow matches');

  api.setUnlockedTechs({ 17: true });
  const after = api.createEmptyCell(1);
  after.redSlots.slot1 = { modIds: [17, 3, 4], rotation: 0 };
  after.yellowSlots.slot1 = { modIds: [17, 4, 11], rotation: 0 };
  const res = api.calculateActiveModifiers(after);
  assertEqual(res.yellowMatchSuccess, true, 'yellow must keep matching after the upgrade');
  /* red1 contributes vertex A only, then the yellow X modifier follows it. */
  const yellowMod = res.modifiers.filter(function (m) { return m.source === 'yellow'; })[0];
  assert(yellowMod, 'yellow modifier must be active after the upgrade');
  assertEqual(yellowMod.modId, 11, 'yellow X modifier still activates');
});

test('CFS-10: a genuinely different chip still fails to match (no false positives)', function () {
  const api = createApi();
  const cell = api.createEmptyCell(0);
  cell.redSlots.slot1 = { modIds: [2, 3, 4], rotation: 0 };
  /* Differs on the shared bottom-inner vertex B (3 vs 5); vertex C is outer-only. */
  cell.redSlots.slot2 = { modIds: [2, 5, 6], rotation: 0 };
  assertEqual(api.calculateActiveModifiers(cell).redMatchSuccess, false, 'different chip must not match');
});

test('CFS-11: setPlayerChips() repairs a legacy chipId:-1 entry in place', function () {
  const box = createUiSandbox();
  const ui = box.Game.HangarChipsUI;
  const api = box.Game.HangarChips;
  api.setUnlockedTechs({ 17: true });
  const legacy = [{
    chipId: -1,
    chipColor: 'red',
    modIds: [17, 3, 4],
    sourceComboKey: '2-3-4',
    level: 1,
    count: 1,
  }];
  ui.setPlayerChips(legacy, { reason: 'restore' });
  const stored = ui.getPlayerChips();
  assertEqual(stored.length, 1, 'entry survives the restore');
  assert(stored[0].chipId > 0, 'legacy chipId:-1 must be healed, got ' + stored[0].chipId);
  assert(stored[0].chipId === api.getChipByKey(api.allChips, '2-3-4').chipId, 'healed to the base pool chip id');
});

test('CFS-12: tech tier resolution for active modifiers is preserved (HTR parity)', function () {
  const api = createApi();
  api.setUnlockedTechs({ 19: true, 20: true });
  const cell = api.createEmptyCell(0);
  cell.redSlots.slot1 = { modIds: [1, 2, 3], rotation: 1 };
  assertEqual(api.calculateActiveModifiers(cell).modifiers[0].modId, 20,
    'stale base slot id still resolves to the latest tier');
});

console.log('\n═══════════════════════════');
console.log('ChipCraftAndTechMatch: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(function (failure) {
    console.log('  - ' + failure.name + ': ' + failure.error);
  });
}
console.log('═══════════════════════════\n');
process.exit(failCount > 0 ? 1 : 0);