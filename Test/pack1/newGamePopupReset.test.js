/**
 * Tests for New Game popup reset (T5).
 * Run: node Test/pack1/newGamePopupReset.test.js
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

const fs = require('fs');
const path = require('path');

console.log('\n── T5: New Game popup flag reset ──');

// Test 1: game.js contains resetSeenLevels call in resetGameState
test('T5-1: resetGameState calls MergePopup.resetSeenLevels', () => {
  const gameJs = fs.readFileSync(path.resolve(__dirname, '../../game.js'), 'utf-8');
  assert(gameJs.indexOf('MergePopup.resetSeenLevels') !== -1, 'resetSeenLevels called in game.js');
});

// Test 2: resetSeenLevels is inside resetGameState function
test('T5-2: resetSeenLevels is inside resetGameState block', () => {
  const gameJs = fs.readFileSync(path.resolve(__dirname, '../../game.js'), 'utf-8');
  const resetIdx = gameJs.indexOf('function resetGameState()');
  const callIdx = gameJs.indexOf('MergePopup.resetSeenLevels');
  assert(resetIdx !== -1, 'resetGameState exists');
  assert(callIdx !== -1, 'resetSeenLevels call exists');
  assert(callIdx > resetIdx, 'call is after function start');
  // Ensure call is before the next top-level function
  const nextFuncIdx = gameJs.indexOf('\nfunction ', callIdx);
  assert(nextFuncIdx > callIdx || nextFuncIdx === -1, 'call is within resetGameState');
});

// Test 3: MergePopup module exposes resetSeenLevels
test('T5-3: MergePopup module has resetSeenLevels', () => {
  const mpJs = fs.readFileSync(path.resolve(__dirname, '../../src/ui/mergePopup.js'), 'utf-8');
  assert(mpJs.indexOf('resetSeenLevels') !== -1, 'resetSeenLevels in mergePopup.js');
});

// Test 4: MergePopup resetSeenLevels removes localStorage key
test('T5-4: resetSeenLevels removes localStorage key', () => {
  const global = globalThis;
  global.window = global;
  global.Game = {};
  global.performance = global.performance || { now: () => Date.now() };
  const store = {};
  global.localStorage = {
    getItem: (k) => store[k] || null,
    setItem: (k, v) => { store[k] = v; },
    removeItem: (k) => { delete store[k]; },
  };
  global.document = { getElementById: () => null };

  const code = fs.readFileSync(path.resolve(__dirname, '../../src/ui/mergePopup.js'), 'utf-8');
  const fn = new Function('window', 'global', 'document', 'console', 'performance', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame', code);
  fn(global, global, global.document, console, global.performance, setTimeout, clearTimeout, setInterval, clearInterval, () => 0, () => {});

  const MP = global.Game.MergePopup;
  MP.init();

  // Set some seen levels
  MP.loadSeenLevels({ 2: true, 5: true });
  assertEqual(MP.hasSeenLevel(2), true, 'level 2 seen before reset');

  // Reset
  MP.resetSeenLevels();
  assertEqual(MP.hasSeenLevel(2), false, 'level 2 cleared after reset');
  assertEqual(MP.hasSeenLevel(5), false, 'level 5 cleared after reset');
  assertEqual(store['seenMergeLevels'], undefined, 'localStorage key removed');
});

// Test 5: New Game handler clears localStorage 'progress'
test('T5-5: menuNew handler removes progress from localStorage', () => {
  const gameJs = fs.readFileSync(path.resolve(__dirname, '../../game.js'), 'utf-8');
  // Find the menuNew click handler
  const menuNewIdx = gameJs.indexOf("menuNew?.addEventListener('click'");
  assert(menuNewIdx !== -1, 'menuNew handler exists');
  // Check that localStorage.removeItem('progress') is nearby
  const removeIdx = gameJs.indexOf("localStorage.removeItem('progress')", menuNewIdx);
  assert(removeIdx !== -1 && removeIdx - menuNewIdx < 200, 'progress removal near menuNew handler');
});

// Test 6: No auto-close in merge popup
test('T5-6: mergePopup.js has no auto-close setTimeout for popup', () => {
  const mpJs = fs.readFileSync(path.resolve(__dirname, '../../src/ui/mergePopup.js'), 'utf-8');
  // The only setTimeout should be for MERGE_ANIM → SHOWCASE transition, not for closing
  assert(mpJs.indexOf('POPUP_DURATION_MS') === -1, 'No POPUP_DURATION_MS (old auto-close)');
});

// Test 7: Merge popup has manual close buttons only
test('T5-7: mergePopup.js references btn-fight and btn-close', () => {
  const mpJs = fs.readFileSync(path.resolve(__dirname, '../../src/ui/mergePopup.js'), 'utf-8');
  assert(mpJs.indexOf('btn-fight') !== -1, 'btn-fight referenced');
  assert(mpJs.indexOf('btn-close') !== -1, 'btn-close referenced');
});

// Test 8: index.html contains the buttons
test('T5-8: index.html has btn-fight and btn-close', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf-8');
  assert(html.indexOf('id="btn-fight"') !== -1, 'btn-fight in HTML');
  assert(html.indexOf('id="btn-close"') !== -1, 'btn-close in HTML');
});

// Summary
console.log('\n═══════════════════════════');
console.log('NewGamePopupReset: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(f => console.log('  - ' + f.name + ': ' + f.error));
}
console.log('═══════════════════════════\n');
process.exit(failCount > 0 ? 1 : 0);
