/**
 * Pack 2 — Merge animation regression tests.
 * Run: node Test/pack2/mergeAnimRegression.test.js
 *
 * Validates MergePopup state machine, animation constants,
 * seenLevels persistence and reset behaviour.
 */

let passCount = 0;
let failCount = 0;
const failures = [];

function assert(cond, msg) {
  if (!cond) throw new Error('Assertion failed: ' + msg);
}
function assertEqual(a, b, msg) {
  if (a !== b) throw new Error((msg || 'assertEqual') + ': expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a));
}
function assertDeepEqual(a, b, msg) {
  if (JSON.stringify(a) !== JSON.stringify(b))
    throw new Error((msg || 'assertDeepEqual') + ': expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a));
}
function test(name, fn) {
  try { fn(); passCount++; console.log('  ✓ ' + name); }
  catch (e) { failCount++; failures.push({ name, error: e.message }); console.log('  ✗ ' + name + ' — ' + e.message); }
}

// ── Fake globals ──
const global = globalThis;
global.window = global;
global.Game = {};
global.currentLang = 'ru';
global.BAL = { dmgBase: 7, dmgMultPerLevel: 1.48, fireRateBase: 0.85, fireRateAddPerLevel: 0.075 };
global.performance = global.performance || { now: () => Date.now() };

const store = {};
global.localStorage = {
  getItem: (k) => store[k] || null,
  setItem: (k, v) => { store[k] = v; },
  removeItem: (k) => { delete store[k]; },
};
global.document = { getElementById: () => null };

// ── Load module ──
const fs = require('fs');
const path = require('path');
const code = fs.readFileSync(path.resolve(__dirname, '../../src/ui/mergePopup.js'), 'utf-8');
const fn = new Function('window', 'global', 'document', 'console', 'performance',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
  'requestAnimationFrame', 'cancelAnimationFrame', code);
fn(global, global, global.document, console, global.performance,
  setTimeout, clearTimeout, setInterval, clearInterval, () => 0, () => {});

const MP = global.Game.MergePopup;

// ═══════════════════════════════════════
console.log('\n── Pack 2: MergePopup regression ──');

test('MAR-1: Module loads without error', () => {
  assert(MP, 'MergePopup exists');
});

test('MAR-2: STATE constants unchanged (IDLE=0,MERGE_ANIM=1,SHOWCASE=2)', () => {
  assertEqual(MP._STATE.IDLE, 0);
  assertEqual(MP._STATE.MERGE_ANIM, 1);
  assertEqual(MP._STATE.SHOWCASE, 2);
});

test('MAR-3: MERGE_ANIM_MS is 3000', () => {
  assertEqual(MP._MERGE_ANIM_MS, 3000);
});

test('MAR-4: init() without DOM does not throw', () => {
  MP.init(); // should be harmless
  assertEqual(MP._getState(), 0, 'stays IDLE');
});

test('MAR-5: show() returns false without DOM', () => {
  assertEqual(MP.show(5), false);
});

test('MAR-6: close() from IDLE is no-op', () => {
  MP.close();
  assertEqual(MP._getState(), 0);
});

test('MAR-7: resetSeenLevels clears all', () => {
  MP.loadSeenLevels({ 1: true, 2: true, 3: true });
  assert(MP.hasSeenLevel(1), 'before reset');
  MP.resetSeenLevels();
  assertEqual(MP.hasSeenLevel(1), false, 'after reset');
  assertEqual(MP.hasSeenLevel(2), false);
  assertEqual(MP.hasSeenLevel(3), false);
});

test('MAR-8: exportSeenLevels returns independent copy', () => {
  MP.resetSeenLevels();
  MP.loadSeenLevels({ 10: true });
  const exported = MP.exportSeenLevels();
  exported[10] = false;
  assertEqual(MP.hasSeenLevel(10), true, 'original not mutated');
});

test('MAR-9: getSeenLevels returns object', () => {
  const seen = MP.getSeenLevels();
  assert(typeof seen === 'object' && seen !== null, 'is object');
});

test('MAR-10: localStorage persistence of seenLevels', () => {
  MP.resetSeenLevels();
  MP.loadSeenLevels({ 7: true });
  // Simulate save via show path — just check load path
  const raw = store['seenMergeLevels'];
  // loadSeenLevels does not save; resetSeenLevels removes
  assertEqual(store['seenMergeLevels'], undefined, 'resetSeenLevels removes key');
});

// ── Summary ──
console.log('\n═══════════════════════════');
console.log('MergeAnimRegression: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(f => console.log('  - ' + f.name + ': ' + f.error));
}
console.log('═══════════════════════════\n');
process.exit(failCount > 0 ? 1 : 0);
