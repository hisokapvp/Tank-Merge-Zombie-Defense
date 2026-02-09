/**
 * Pack 7 — Analytics aggregation.
 * Run: node Test/pack7/analytics_aggregation.test.js
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
function test(name, fn) {
  try { fn(); passCount++; console.log('  ✓ ' + name); }
  catch (e) { failCount++; failures.push({ name, error: e.message }); console.log('  ✗ ' + name + ' — ' + e.message); }
}

const global = globalThis;

global.window = global;
global.Game = {};

const store = {};
global.localStorage = {
  getItem: (k) => store[k] || null,
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};

const fs = require('fs');
const path = require('path');

function loadModule(relPath) {
  const code = fs.readFileSync(path.resolve(__dirname, '../..', relPath), 'utf8');
  const fn = new Function('window', 'global', 'document', 'console', 'setTimeout', code);
  fn(global, global, {}, console, setTimeout);
}

console.log('\n── Pack 7: Analytics aggregation ──');

loadModule('src/analytics/collector.js');

const AC = global.Game.AnalyticsCollector;

AC.clear();
AC.track('mergePopupShow', { level: 2 });
AC.track('mergePopupShow', { level: 3 });
AC.track('lessonComplete', { lesson: 'Basics', score: 90 });
AC.recordValue('sessionDurationSec', 10);
AC.recordValue('sessionDurationSec', 25);

const summary = AC.getSummary();

test('AN-1: event counts tracked', () => {
  assert(summary.events.mergePopupShow, 'event exists');
  assertEqual(summary.events.mergePopupShow.count, 2);
});

test('AN-2: lesson counts tracked', () => {
  assert(summary.lessons.Basics, 'lesson exists');
  assertEqual(summary.lessons.Basics.count, 1);
});

test('AN-3: value aggregation works', () => {
  const v = summary.values.sessionDurationSec;
  assert(v, 'value exists');
  assertEqual(v.count, 2);
  assertEqual(v.min, 10);
  assertEqual(v.max, 25);
  assertEqual(v.sum, 35);
});

test('AN-4: export csv includes event row', () => {
  const csv = AC.export('csv');
  assert(csv.indexOf('event,mergePopupShow,2') !== -1, 'event row present');
});

console.log('\n═══════════════════════════');
console.log('Analytics aggregation: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(f => console.log('  - ' + f.name + ': ' + f.error));
}
console.log('═══════════════════════════\n');
process.exit(failCount > 0 ? 1 : 0);
