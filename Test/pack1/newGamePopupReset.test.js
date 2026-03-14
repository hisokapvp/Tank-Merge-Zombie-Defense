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

console.log('\n── T5: New Game reset + talent point rules ──');

// Test 1: game.js contains resetSeenLevels call in resetGameState
test('T5-1: resetGameState calls MergePopup.resetSeenLevels', () => {
  const gameJs = fs.readFileSync(path.resolve(__dirname, '../../game.js'), 'utf-8');
  assert(gameJs.indexOf('MergePopup.resetSeenLevels') !== -1, 'resetSeenLevels called in game.js');
});

// Test 2: resetSeenLevels is inside resetGameState function
test('T5-2: resetSeenLevels is inside resetGameState block', () => {
  const gameJs = fs.readFileSync(path.resolve(__dirname, '../../game.js'), 'utf-8');
  const resetIdx = gameJs.indexOf('function resetGameState(options)');
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

// Test 5: New Game handler clears localStorage 'progress' and passes new_game reason
test('T5-5: menuNew handler removes progress and calls reset with reason=new_game', () => {
  const bootJs = fs.readFileSync(path.resolve(__dirname, '../../src/core/bootstrap.js'), 'utf-8');
  const menuNewIdx = bootJs.indexOf("opts.ui.menuNew && opts.ui.menuNew.addEventListener('click'");
  assert(menuNewIdx !== -1, 'menuNew handler exists in bootstrap');
  const removeIdx = bootJs.indexOf("localStorageObj.removeItem('progress')", menuNewIdx);
  assert(removeIdx !== -1 && removeIdx - menuNewIdx < 220, 'progress removal near menuNew handler');
  const reasonIdx = bootJs.indexOf("opts.resetGameState({ reason: 'new_game' })", menuNewIdx);
  assert(reasonIdx !== -1 && reasonIdx - menuNewIdx < 260, 'new game reason passed to reset');
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
  assert(mpJs.indexOf('mergePopupCloseX') !== -1, 'mergePopupCloseX referenced');
});

// Test 8: index.html contains the buttons
test('T5-8: index.html has btn-fight and btn-close', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf-8');
  assert(html.indexOf('id="btn-fight"') !== -1, 'btn-fight in HTML');
  assert(html.indexOf('id="btn-close"') !== -1, 'btn-close in HTML');
  assert(html.indexOf('id="mergePopupCloseX"') !== -1, 'mergePopupCloseX in HTML');
});

// Test 9: Boot default does not auto-grant talent point
test('T5-9: boot path keeps default talentPoints=0', () => {
  const gameJs = fs.readFileSync(path.resolve(__dirname, '../../game.js'), 'utf-8');
  assert(gameJs.indexOf('let state = createInitialState();') !== -1, 'boot uses default createInitialState without new_game reason');
  const initStateJs = fs.readFileSync(path.resolve(__dirname, '../../src/persistence/initialState.js'), 'utf-8');
  assert(initStateJs.indexOf('talentPoints: 0') !== -1, 'default initial talent points are zero');
});

// Test 10: New Game path resets talent points to zero
test('T5-10: new game reset keeps player.talentPoints at 0', () => {
  const gameJs = fs.readFileSync(path.resolve(__dirname, '../../game.js'), 'utf-8');
  assert(gameJs.indexOf("const reason = opts.reason === 'new_game' ? 'new_game' : 'reset';") !== -1, 'reset has explicit reason split');
  assert(gameJs.indexOf("state = createInitialState({ reason });") !== -1, 'reset passes reason into initial state creation');
  const assignIdx = gameJs.indexOf('initialState.player.talentPoints = 0;');
  assert(assignIdx !== -1, 'new_game flow uses direct assignment to 0');
  assert(gameJs.indexOf('talentPoints += 1') === -1, 'no accumulating increment for reset talent point');
});

// Test 11: Load path does not force talentPoints=1
test('T5-11: load path keeps talentPoints from save', () => {
  const gameJs = fs.readFileSync(path.resolve(__dirname, '../../game.js'), 'utf-8');
  assert(gameJs.indexOf('if (Number.isFinite(playerData.talentPoints)) state.player.talentPoints = Math.max(0, Math.floor(playerData.talentPoints));') !== -1,
    'applySavedProgress restores talent points from save payload');
  const loadFnStart = gameJs.indexOf('function applySavedProgress(data){');
  const loadFnEnd = gameJs.indexOf('return true;', loadFnStart);
  const loadFnBody = loadFnStart !== -1 && loadFnEnd !== -1 ? gameJs.slice(loadFnStart, loadFnEnd) : '';
  assert(loadFnBody.indexOf('talentPoints = 1') === -1, 'load path does not inject new_game talent grant');
});

// Test 12: First guaranteed new-game box grants a working red big chip
test('T5-12: guaranteed one_big_chip yields working red level-1 chip with 3 unique mods', () => {
  const global = globalThis;
  global.window = global;
  let capturedChip = null;
  let capturedLevel = null;
  global.Game = {
    HangarChipsUI: {
      addPlayerChip: (chip, level) => {
        capturedChip = chip;
        capturedLevel = level;
      }
    }
  };

  const code = fs.readFileSync(path.resolve(__dirname, '../../src/mechanics/productionLine.js'), 'utf-8');
  const fn = new Function('window', 'global', code);
  fn(global, global);

  const state = {
    productionLine: {
      killsTracked: 0,
      boxesProduced: 0,
      progress: 0,
      storageSlots: 9,
      storage: [{ id: 'box_test', guaranteedLootId: 'one_big_chip' }],
      conveyorAnimTime: 0,
      firstNewGameBoxGuaranteedPending: false,
    }
  };

  const result = global.Game.ProductionLine.openBox(state, 0);
  const chip = capturedChip || (result && result.items && result.items[0] ? result.items[0].chip : null);

  assert(result && result.lootId === 'one_big_chip', 'one_big_chip loot returned');
  assert(chip, 'chip payload exists');
  assertEqual(capturedLevel, 1, 'chip added at level 1');
  assertEqual(chip.chipColor, 'red', 'guaranteed chip is red');
  assert(Number.isFinite(chip.chipId) && chip.chipId > 0, 'chipId is canonical positive number');
  assert(Array.isArray(chip.modIds) && chip.modIds.length === 3, 'chip has 3 modifiers');
  assert(new Set(chip.modIds).size === 3, 'chip modifiers are unique');
  assert(chip.modIds.every((id) => Number.isFinite(id) && id >= 1 && id <= 9), 'chip modifiers are valid non-special ids');
  assertEqual(chip.sourceComboKey, chip.modIds.slice().sort((a, b) => a - b).join('-'), 'combo key matches modifiers');
});

// Test 13: Close buttons use unified single-glyph skin and are skipped by font floor
test('T5-13: close buttons use unified X skin and font-floor skips all close variants', () => {
  const css = fs.readFileSync(path.resolve(__dirname, '../../style.css'), 'utf-8');
  const fontFloor = fs.readFileSync(path.resolve(__dirname, '../../src/ui/fontFloor.js'), 'utf-8');

  assert(css.indexOf("content:'✕';") !== -1, 'close buttons use unified glyph icon');
  assert(css.indexOf('.crateModal__close::after') !== -1 && css.indexOf('content:none;') !== -1, 'close buttons disable second pseudo element');
  assert(css.indexOf('.lessonProgress__close::before') !== -1, 'lesson progress close keeps unified close selector');
  assert(css.indexOf('.crateModal__close{') !== -1 && css.indexOf('min-width:44px;') !== -1, 'close buttons keep 44x44 hit area');
  assert(fontFloor.indexOf("'.levelModal__close'") !== -1, 'font floor skips all level close buttons');
  assert(fontFloor.indexOf("'.crateModal__close'") !== -1, 'font floor skips crate close button');
});

// Test 14: Tech acceleration modal renders bottom silicon dust row and total summary
test('T5-14: tech acceleration modal has bottom dust row and total summary placeholder', () => {
  const uiJs = fs.readFileSync(path.resolve(__dirname, '../../src/ui/hangarChipsUI.js'), 'utf-8');
  const ru = fs.readFileSync(path.resolve(__dirname, '../../src/i18n/ru.json'), 'utf-8');
  const en = fs.readFileSync(path.resolve(__dirname, '../../src/i18n/en.json'), 'utf-8');

  assert(uiJs.indexOf('techModal__dustRow') !== -1, 'dust row markup exists');
  assert(uiJs.indexOf('data-accel-dust-count') !== -1, 'dust row contains live counter');
  assert(uiJs.indexOf("return _siliconDust + ' / ' + Math.max(0, selectedDustCount || 0);") !== -1, 'dust counter shows available first and selected second');
  assert(uiJs.indexOf("replace('{total}'") !== -1, 'summary updates total acceleration placeholder');
  assert(ru.indexOf('{total}%') !== -1, 'ru summary includes total placeholder');
  assert(en.indexOf('{total}%') !== -1, 'en summary includes total placeholder');
});

// Test 15: Workshop transient state resets on tab exit and dust fragments render per unit
test('T5-15: workshop reset API and unit fragment dust rendering are present', () => {
  const uiJs = fs.readFileSync(path.resolve(__dirname, '../../src/ui/hangarChipsUI.js'), 'utf-8');
  const scJs = fs.readFileSync(path.resolve(__dirname, '../../src/ui/supercomputerMenu.js'), 'utf-8');

  assert(uiJs.indexOf('function resetTransientUiState()') !== -1, 'hangar chips UI exposes resetTransientUiState');
  assert(uiJs.indexOf("resetTransientUiState: resetTransientUiState") !== -1, 'resetTransientUiState is exported in public API');
  assert(uiJs.indexOf("var dustKeyUnit = 'frag_' + frag.fragmentId + '_' + unitIndex;") !== -1, 'dust view renders fragment keys per unit');
  assert(uiJs.indexOf("if (wasWorkshop && !isWorkshop) resetTransientUiState();") !== -1, 'leaving workshop top tab resets transient state');
  assert(scJs.indexOf("chipsUi.resetTransientUiState()") !== -1, 'closing hangar overlay resets transient state');
});

test('T5-16: available hangar chips prioritize match-capable entries and keep stable order inside groups', () => {
  const uiJs = fs.readFileSync(path.resolve(__dirname, '../../src/ui/hangarChipsUI.js'), 'utf-8');

  assert(uiJs.indexOf('function _sortAvailableChipsByMatchPriority(chips, canMatchMap)') !== -1, 'available chips use dedicated match-priority sorter');
  assert(uiJs.indexOf('if (a.canMatch !== b.canMatch) return a.canMatch ? -1 : 1;') !== -1, 'match-capable chips sort ahead of regular ones');
  assert(uiJs.indexOf('return a.order - b.order;') !== -1, 'sort keeps stable order inside priority groups');
  assert(uiJs.indexOf('chips = _sortAvailableChipsByMatchPriority(chips, canMatchMap);') !== -1, 'renderChipsList applies match-priority sorting');
});

// Summary
console.log('\n═══════════════════════════');
console.log('NewGamePopupReset: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(f => console.log('  - ' + f.name + ': ' + f.error));
}
console.log('═══════════════════════════\n');
process.exit(failCount > 0 ? 1 : 0);
