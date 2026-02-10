/**
 * Tests for number format v2 + RU i18n + file patterns (T4/T5).
 * Run: node Test/pack1/numberFormat_v2.test.js
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

// ── Fake globals ──
const global = globalThis;
global.window = global;
global.Game = {};

function loadModule(relPath) {
  const code = fs.readFileSync(path.resolve(__dirname, '../..', relPath), 'utf-8');
  const fn = new Function('window', 'global', 'document', 'console', 'Promise', code);
  fn(global, global, {}, console, Promise);
}

loadModule('src/utils/numberFormat.js');

const { formatShortNumber, formatCompactRu } = global.Game.NumberFormat;

console.log('\n── T4/T5: number format v2 + RU i18n ──');

test('NF-1: 9999 → "9999"', () => {
  assertEqual(formatShortNumber(9999), '9999');
});

test('NF-2: 10000 → "10K"', () => {
  assertEqual(formatShortNumber(10000), '10K');
});

test('NF-3: 1_000_000 → "1M"', () => {
  assertEqual(formatShortNumber(1000000), '1M');
});

test('NF-4: 1_000_000_000 → "1B"', () => {
  assertEqual(formatShortNumber(1000000000), '1B');
});

test('NF-5: 1e36 → "1e+36" fallback', () => {
  assertEqual(formatShortNumber(1e36), '1e+36');
});

test('NF-6: formatCompactRu mirrors formatShortNumber', () => {
  assertEqual(formatCompactRu(50000), formatShortNumber(50000));
});

test('NF-7: suffix list present in numberFormat.js', () => {
  const nf = fs.readFileSync(path.resolve(__dirname, '../../src/utils/numberFormat.js'), 'utf-8');
  const tokens = ['K', 'M', 'B', 'T', 'Q', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
  let lastIdx = -1;
  tokens.forEach(token => {
    const idx = nf.indexOf("'" + token + "'");
    assert(idx !== -1, 'suffix ' + token + ' exists');
    assert(idx > lastIdx, 'suffix ' + token + ' order');
    lastIdx = idx;
  });
});

test('NF-8: merge preview has no RESULT label', () => {
  const mp = fs.readFileSync(path.resolve(__dirname, '../../src/ui/mergePreview/mergePreviewRenderer.js'), 'utf-8');
  assert(mp.indexOf('RESULT') === -1, 'RESULT label removed');
});

test('NF-9: RU i18n merge popup strings updated', () => {
  const ru = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../src/i18n/ru.json'), 'utf-8'));
  assertEqual(ru.mergePopupSubtitle, 'ОТКРЫТ НОВЫЙ УРОВЕНЬ ТАНКА!');
  assertEqual(ru.mergePopupTitle, 'Новый танк уровень {level}');
  assertEqual(ru.levelModalTitle, 'Вы достигли {level} уровня!');
});

// Summary
console.log('\n═══════════════════════════');
console.log('NumberFormatV2: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(f => console.log('  - ' + f.name + ': ' + f.error));
}
console.log('═══════════════════════════\n');
process.exit(failCount > 0 ? 1 : 0);
