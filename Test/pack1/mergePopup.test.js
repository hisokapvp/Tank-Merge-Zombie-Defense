/**
 * Tests for MergePopup state machine (T1).
 * Run: node Test/pack1/mergePopup.test.js
 */

let passCount = 0;
let failCount = 0;
const failures = [];

function assert(condition, message) {
  if (!condition) throw new Error('Assertion failed: ' + message);
}
function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error((message || 'assertEqual') + ': expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
  }
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

// Mock localStorage
const store = {};
global.localStorage = {
  getItem: (k) => store[k] || null,
  setItem: (k, v) => { store[k] = v; },
  removeItem: (k) => { delete store[k]; },
};

// Mock document
global.document = {
  getElementById: () => null,
};

// ── Load module ──
const fs = require('fs');
const path = require('path');
const code = fs.readFileSync(path.resolve(__dirname, '../../src/ui/mergePopup.js'), 'utf-8');
const fn = new Function('window', 'global', 'document', 'console', 'performance', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame', code);
fn(global, global, global.document, console, global.performance, setTimeout, clearTimeout, setInterval, clearInterval, () => 0, () => {});

const MP = global.Game.MergePopup;

console.log('\n── T1: MergePopup state machine ──');

test('MP-1: Game.MergePopup exists', () => {
  assert(MP, 'MergePopup should exist');
});

test('MP-2: init() available', () => {
  assert(typeof MP.init === 'function', 'init is function');
});

test('MP-3: show() returns false without DOM', () => {
  MP.init();
  assertEqual(MP.show(2), false, 'show without DOM');
});

test('MP-4: hasSeenLevel returns false for unseen', () => {
  assertEqual(MP.hasSeenLevel(99), false);
});

test('MP-5: resetSeenLevels clears storage', () => {
  // Simulate seen level
  store['seenMergeLevels'] = JSON.stringify({ 5: true, 10: true });
  MP.loadSeenLevels({ 5: true, 10: true });
  assertEqual(MP.hasSeenLevel(5), true, 'should see level 5');

  MP.resetSeenLevels();
  assertEqual(MP.hasSeenLevel(5), false, 'level 5 cleared');
  assertEqual(MP.hasSeenLevel(10), false, 'level 10 cleared');
  assertEqual(store['seenMergeLevels'], undefined, 'storage key removed');
});

test('MP-6: exportSeenLevels returns copy', () => {
  MP.resetSeenLevels();
  MP.loadSeenLevels({ 3: true });
  const exported = MP.exportSeenLevels();
  assertEqual(exported[3], true);
  exported[3] = false;
  assertEqual(MP.hasSeenLevel(3), true, 'original unchanged');
});

test('MP-7: _STATE constants defined', () => {
  assertEqual(MP._STATE.IDLE, 0);
  assertEqual(MP._STATE.MERGE_ANIM, 1);
  assertEqual(MP._STATE.SHOWCASE, 2);
});

test('MP-8: _MERGE_ANIM_MS is 3000', () => {
  assertEqual(MP._MERGE_ANIM_MS, 3000);
});

test('MP-9: close() from IDLE does nothing', () => {
  MP.close(); // should not throw
  assertEqual(MP._getState(), 0);
});

test('MP-10: getSeenLevels returns object', () => {
  MP.resetSeenLevels();
  const seen = MP.getSeenLevels();
  assert(typeof seen === 'object', 'is object');
});

// Summary
console.log('\n═══════════════════════════');
console.log('MergePopup: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(f => console.log('  - ' + f.name + ': ' + f.error));
}
console.log('═══════════════════════════\n');
process.exit(failCount > 0 ? 1 : 0);
