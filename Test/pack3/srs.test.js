/**
 * Pack 3 — SRS scheduler tests.
 * Run: node Test/pack3/srs.test.js
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
  const code = fs.readFileSync(path.resolve(__dirname, '../..', relPath), 'utf-8');
  const fn = new Function('window', 'global', 'document', 'console', 'setTimeout', 'clearTimeout', code);
  fn(global, global, {}, console, setTimeout, clearTimeout);
}

loadModule('src/scheduler/srs.js');

const SRS = global.Game.SRS;
const DAY = 24 * 60 * 60 * 1000;

console.log('\n── Pack 3: SRS Scheduler ──');

test('SRS-1: SRS exists', () => {
  assert(SRS, 'SRS defined');
  assert(typeof SRS.recordReview === 'function', 'recordReview fn');
  assert(typeof SRS.listDue === 'function', 'listDue fn');
});

test('SRS-2: recordReview sets interval for first review', () => {
  SRS.importSchedule('{"version":1,"items":{}}');
  const item = SRS.recordReview('lessonA', 5, 0);
  assertEqual(item.interval, 1);
  assertEqual(item.reps, 1);
  assertEqual(item.dueAt, DAY);
});

test('SRS-3: second review sets interval to 6', () => {
  SRS.importSchedule('{"version":1,"items":{}}');
  SRS.recordReview('lessonB', 5, 0);
  const item = SRS.recordReview('lessonB', 5, DAY);
  assertEqual(item.interval, 6);
  assert(item.dueAt >= DAY + 6 * DAY, 'due after 6 days');
});

test('SRS-4: failed review resets reps', () => {
  SRS.importSchedule('{"version":1,"items":{}}');
  SRS.recordReview('lessonC', 5, 0);
  const item = SRS.recordReview('lessonC', 2, DAY);
  assertEqual(item.reps, 0);
  assertEqual(item.interval, 1);
});

test('SRS-5: scheduleNow marks due immediately', () => {
  SRS.importSchedule('{"version":1,"items":{}}');
  const item = SRS.scheduleNow('lessonD', 123);
  assertEqual(item.dueAt, 123);
  const due = SRS.listDue(123);
  assertEqual(due.length, 1);
  assertEqual(due[0].id, 'lessonD');
});

test('SRS-6: export/import roundtrip', () => {
  SRS.importSchedule('{"version":1,"items":{}}');
  SRS.recordReview('lessonE', 5, 0);
  const exported = SRS.exportSchedule();
  const count = SRS.importSchedule(exported);
  assertEqual(count, 1);
});

console.log('\n═══════════════════════════');
console.log('SRS: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(f => console.log('  - ' + f.name + ': ' + f.error));
}
console.log('═══════════════════════════\n');
process.exit(failCount > 0 ? 1 : 0);
