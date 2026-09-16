'use strict';

/**
 * Pack 13: supercomputer viewport-independent placement (save → load round-trip).
 *
 * Regression guard for the bug where a save made while the browser was
 * fullscreen pinned the supercomputer to fullscreen coordinates, so loading that
 * save in a windowed viewport left the supercomputer outside the fence.
 *
 * Root cause: `state.supercomputer.x` / `.y` / `.offsetY` are runtime-derived
 * from the CURRENT `state.boardRect` (which depends on the viewport size), but
 * `restoreFullState()` / `applySavedProgress()` merged the whole saved
 * `supercomputer` object into runtime state via `Object.assign`, overwriting the
 * freshly computed coordinates with stale ones. The big-menu load path does not
 * call `initBoard()` afterwards, so nothing recomputed them.
 *
 * Cases:
 *   SVP-1  A canonical placement helper exists and derives x/y from boardRect.
 *   SVP-2  initBoard() uses the helper instead of inlining the formula.
 *   SVP-3  restoreFullState() repositions after merging the save payload.
 *   SVP-4  applySavedProgress() repositions after merging the save payload.
 *   SVP-5  The helper is fail-soft when boardRect is not initialized yet.
 *   SVP-6  Dependent layout (production line / HUD button) is resynced too.
 *   SVP-7  The old "keep previous coords if payload has none" hack is gone.
 */

let passCount = 0;
let failCount = 0;
const failures = [];

function assert(cond, msg) {
  if (!cond) throw new Error('Assertion failed: ' + msg);
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
const GAME_JS = fs.readFileSync(path.resolve(ROOT, 'game.js'), 'utf-8');

function sliceFunction(src, signature) {
  const start = src.indexOf(signature);
  assert(start >= 0, 'function not found: ' + signature);
  const end = src.indexOf('\nfunction ', start + signature.length);
  return src.slice(start, end > start ? end : undefined);
}

/* ------------------------------------------------------------------ *
 * SVP-1..2: canonical placement helper
 * ------------------------------------------------------------------ */

test('SVP-1: repositionSupercomputerFromBoard derives x/y from boardRect', function () {
  const body = sliceFunction(GAME_JS, 'function repositionSupercomputerFromBoard(){');
  assert(body.indexOf('boardRect.x + boardRect.w * 0.5') >= 0, 'x must be boardRect centre');
  assert(body.indexOf('boardRect.y + boardRect.h + sc.offsetY') >= 0, 'y must be boardRect bottom + offsetY');
  assert(body.indexOf('sc.offsetY = configOffset') >= 0, 'offsetY must be re-resolved from config');
});

test('SVP-2: initBoard() delegates to the helper (no inlined formula)', function () {
  const body = sliceFunction(GAME_JS, 'function initBoard(){');
  assert(body.indexOf('repositionSupercomputerFromBoard()') >= 0, 'initBoard must call the helper');
  assert(body.indexOf('hangarBottomY') === -1, 'inlined hangarBottomY formula must be removed');
  assert(body.indexOf('hangarCenterX') === -1, 'inlined hangarCenterX formula must be removed');
});

/* ------------------------------------------------------------------ *
 * SVP-3..4: restore paths
 * ------------------------------------------------------------------ */

test('SVP-3: restoreFullState repositions after merging the payload', function () {
  const body = sliceFunction(GAME_JS, 'function restoreFullState(saved){');
  const mergeIdx = body.indexOf('Object.assign(_scCurrent, saved.supercomputer)');
  assert(mergeIdx >= 0, 'restoreFullState must merge saved.supercomputer');
  const repositionIdx = body.indexOf('repositionSupercomputerFromBoard()', mergeIdx);
  assert(repositionIdx > mergeIdx, 'reposition must run AFTER the payload merge');
});

test('SVP-4: applySavedProgress repositions after merging the payload', function () {
  const body = sliceFunction(GAME_JS, 'function applySavedProgress(data){');
  const mergeIdx = body.indexOf('Object.assign(getComputerState(), supercomputer)');
  assert(mergeIdx >= 0, 'applySavedProgress must merge saved supercomputer');
  const repositionIdx = body.indexOf('repositionSupercomputerFromBoard()', mergeIdx);
  assert(repositionIdx > mergeIdx, 'reposition must run AFTER the payload merge');
});

/* ------------------------------------------------------------------ *
 * SVP-5..7: fail-soft + dependent layout + removed hack
 * ------------------------------------------------------------------ */

test('SVP-5: helper is fail-soft when boardRect is not initialized', function () {
  const body = sliceFunction(GAME_JS, 'function repositionSupercomputerFromBoard(){');
  assert(body.indexOf('!(boardRect.w > 0)') >= 0, 'must guard against zero-width boardRect');
  assert(body.indexOf('!(boardRect.h > 0)') >= 0, 'must guard against zero-height boardRect');
  assert(body.indexOf('return sc;') >= 0, 'must return early without throwing');
});

test('SVP-6: dependent layout is resynced with the new position', function () {
  const body = sliceFunction(GAME_JS, 'function syncSupercomputerDependentLayout(sc){');
  assert(body.indexOf('_PLR.updateLayout(scState.x, scState.y') >= 0, 'production line must follow the new position');
  assert(body.indexOf('updateSupercomputerHudButtonPosition()') >= 0, 'HUD button must follow the new position');
  const initBody = sliceFunction(GAME_JS, 'function initBoard(){');
  assert(initBody.indexOf('syncSupercomputerDependentLayout(sc)') >= 0, 'initBoard must resync dependent layout');
});

test('SVP-7: stale-coordinate preservation hack is removed', function () {
  assert(GAME_JS.indexOf('_scPrevX') === -1, '_scPrevX hack must be gone');
  assert(GAME_JS.indexOf('_scPrevY') === -1, '_scPrevY hack must be gone');
});

/* ------------------------------------------------------------------ */

console.log('');
console.log('-- Summary --');
console.log('Passed: ' + passCount);
console.log('Failed: ' + failCount);
if (failures.length) {
  console.log('');
  for (const f of failures) console.log('  FAILED: ' + f.name + ' - ' + f.error);
}
process.exit(failCount ? 1 : 0);
