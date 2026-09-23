/**
 * Pack 16 — «Новый уровень танка» popup не зависит от места merge.
 *
 * Контракт (2026-09-23, задача пользователя):
 *   Когда игрок впервые получает танк нового уровня, объединяя два танка,
 *   модалка «ОТКРЫТ НОВЫЙ УРОВЕНЬ ТАНКА!» должна появляться независимо от
 *   того, где именно произошёл merge:
 *     1) основной ангар  ↔ основной ангар   — `performMerge`
 *     2) подземный ангар ↔ подземный ангар  — `_performUndergroundMerge`
 *     3) кросс-ангар (main ↔ underground)   — `_performCrossHangarMerge`
 *
 *   До фикса popup вызывался только из `performMerge`, поэтому merge,
 *   сделанный переносом танка из подземного ангара, не показывал модалку.
 *
 * Канонический owner показа — единый seam `_notifyMergeNewTankLevel(...)`,
 * который вызывает `Game.MergePopup.show(lvl)`, помечает уровень просмотренным
 * и выбирает SFX (`mergeNewMaxLevel` vs `levelUp`) вместе с `playMergeFx`.
 *
 * Run: node Test/pack16/mergePopupAllHangars.test.js
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
  try { fn(); passCount++; console.log('  \u2713 ' + name); }
  catch (e) { failCount++; failures.push({ name, error: e.message }); console.log('  \u2717 ' + name + ' \u2014 ' + e.message); }
}

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const gameSrc = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8');

/** Вырезает тело функции по имени (до следующего top-level `function`/EOF). */
function extractFunctionBody(src, name) {
  const start = src.indexOf('function ' + name + '(');
  if (start === -1) return null;
  const next = src.indexOf('\nfunction ', start + 1);
  return src.slice(start, next === -1 ? src.length : next);
}

console.log('\n── Pack 16: merge popup for all hangars ──');

// ════════════════════════════════════════════════════════════════
//  Section 1 — shared seam exists and owns the popup call
// ════════════════════════════════════════════════════════════════
console.log('\n  --- Section 1: shared seam ---');

const seamBody = extractFunctionBody(gameSrc, '_notifyMergeNewTankLevel');

test('MPA-1: _notifyMergeNewTankLevel seam exists', () => {
  assert(seamBody !== null, 'seam function present in game.js');
});

test('MPA-2: seam calls MergePopup.show with the merged level', () => {
  assert(seamBody.indexOf('MergePopup') !== -1, 'seam references MergePopup');
  assert(seamBody.indexOf('.show(') !== -1, 'seam invokes MergePopup.show');
  assert(seamBody.indexOf('show(lvl)') !== -1, 'seam shows the merged level');
});

test('MPA-3: seam owns the mergeNewMaxLevel vs levelUp SFX decision', () => {
  assert(seamBody.indexOf('mergeNewMaxLevel') !== -1, 'seam keeps mergeNewMaxLevel id');
  assert(seamBody.indexOf("'levelUp'") !== -1, 'seam keeps levelUp fallback id');
  assert(seamBody.indexOf('playMergeFx') !== -1, 'seam routes effect through playMergeFx');
  assert(seamBody.indexOf('newMaxLevel > oldMaxLevel') !== -1, 'seam compares max level to detect first-time unlock');
});

// ════════════════════════════════════════════════════════════════
//  Section 2 — every merge path notifies
// ════════════════════════════════════════════════════════════════
console.log('\n  --- Section 2: all three merge paths notify ---');

const mergePaths = [
  ['performMerge', 'main hangar merge'],
  ['_performUndergroundMerge', 'underground hangar merge'],
  ['_performCrossHangarMerge', 'cross-hangar merge'],
];

mergePaths.forEach(function (entry) {
  const fnName = entry[0];
  const label = entry[1];
  test('MPA-4: ' + fnName + ' (' + label + ') calls the shared seam', () => {
    const body = extractFunctionBody(gameSrc, fnName);
    assert(body !== null, fnName + ' present');
    assert(body.indexOf('_notifyMergeNewTankLevel(') !== -1, fnName + ' notifies new tank level');
  });
});

test('MPA-5: merge paths capture oldMaxLevel before recordTankLevel', () => {
  mergePaths.forEach(function (entry) {
    const body = extractFunctionBody(gameSrc, entry[0]);
    const oldIdx = body.indexOf('const oldMaxLevel');
    const recordIdx = body.indexOf('recordTankLevel(lvl)');
    const notifyIdx = body.indexOf('_notifyMergeNewTankLevel(');
    assert(oldIdx !== -1, entry[0] + ' captures oldMaxLevel');
    assert(recordIdx !== -1, entry[0] + ' records the new level');
    assert(notifyIdx !== -1, entry[0] + ' notifies');
    assert(oldIdx < recordIdx, entry[0] + ': oldMaxLevel captured BEFORE recordTankLevel');
    assert(recordIdx < notifyIdx, entry[0] + ': recordTankLevel BEFORE notify');
  });
});

// ════════════════════════════════════════════════════════════════
//  Section 3 — no duplicated popup call outside the seam
// ════════════════════════════════════════════════════════════════
console.log('\n  --- Section 3: single point of truth ---');

test('MPA-6: MergePopup.show is not called from individual merge branches', () => {
  mergePaths.forEach(function (entry) {
    const body = extractFunctionBody(gameSrc, entry[0]);
    assert(
      body.indexOf('MergePopup.show') === -1,
      entry[0] + ' must delegate to the seam instead of calling MergePopup.show directly'
    );
  });
});

test('MPA-7: old inline maxLevel block removed from performMerge', () => {
  const body = extractFunctionBody(gameSrc, 'performMerge');
  assert(
    body.indexOf('isNewMaxLevelMergePopup') === -1,
    'stale local isNewMaxLevelMergePopup variable is gone'
  );
});

// ════════════════════════════════════════════════════════════════
//  Section 4 — fxContext optional for underground cells
// ════════════════════════════════════════════════════════════════
console.log('\n  --- Section 4: fxContext optional ---');

test('MPA-8: seam tolerates a null fxContext (underground cells have no board geometry)', () => {
  assert(seamBody.indexOf('fxContext &&') !== -1, 'seam null-guards fxContext before reading fields');
  assert(seamBody.indexOf('resolveMergeFxPosition') !== -1 || seamBody.indexOf('resultCellIndex') !== -1,
    'seam forwards optional cell/entity hints');
});

test('MPA-9: underground + cross-hangar merges pass no board context', () => {
  ['_performUndergroundMerge', '_performCrossHangarMerge'].forEach(function (fnName) {
    const body = extractFunctionBody(gameSrc, fnName);
    assert(
      body.indexOf('_notifyMergeNewTankLevel(oldMaxLevel, lvl, null)') !== -1,
      fnName + ' passes null fxContext'
    );
  });
});

test('MPA-10: main hangar merge still forwards result cell/tank hints', () => {
  const body = extractFunctionBody(gameSrc, 'performMerge');
  assert(body.indexOf('resultCellIndex: resultCellIndex') !== -1, 'main merge forwards resultCellIndex');
  assert(body.indexOf('resultTankId:') !== -1, 'main merge forwards resultTankId');
});

// ════════════════════════════════════════════════════════════════
//  Summary
// ════════════════════════════════════════════════════════════════
console.log('\n\u2550' + '\u2550'.repeat(30) + '\u2550');
console.log('MergePopupAllHangars: ' + passCount + ' passed, ' + failCount + ' failed');
console.log('\u2550' + '\u2550'.repeat(30) + '\u2550');

if (failCount > 0) {
  failures.forEach(function (f) { console.log('  - ' + f.name + ': ' + f.error); });
  process.exit(1);
}
