/**
 * Pack 4 — Calendar UI model tests.
 * Run: node Test/pack4/calendar.test.js
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

const fs = require('fs');
const path = require('path');

function loadModule(relPath) {
  const code = fs.readFileSync(path.resolve(__dirname, '../..', relPath), 'utf-8');
  const fn = new Function('window', 'global', 'document', 'console', code);
  fn(global, global, {}, console);
}

loadModule('src/ui/calendar/calendar.js');

const CalendarUI = global.Game.CalendarUI;

console.log('\n── Pack 4: Calendar UI ──');

test('CAL-1: CalendarUI exists', () => {
  assert(CalendarUI, 'CalendarUI defined');
  assert(typeof CalendarUI.create === 'function', 'create fn');
  assert(typeof CalendarUI._buildModel === 'function', 'build model fn');
});

test('CAL-2: buildModel groups items by day', () => {
  const now = new Date(2025, 0, 15, 12, 0, 0).getTime();
  const items = [
    { id: 'lesson_a', dueAt: now + 60 * 60 * 1000 },
    { id: 'lesson_b', dueAt: now + 26 * 60 * 60 * 1000 },
    { id: 'lesson_c', dueAt: now + 10 * 24 * 60 * 60 * 1000 }
  ];
  const model = CalendarUI._buildModel(items, now, 7, (id) => 'Name ' + id);
  assertEqual(model.totalCount, 3, 'total count');
  assertEqual(model.laterCount, 1, 'later count');
  assert(model.days.length >= 1, 'days grouped');
  assert(model.days[0].items.length >= 1, 'first day has item');
});

test('CAL-3: label shows Today for same day', () => {
  const now = new Date(2025, 0, 20, 9, 0, 0).getTime();
  const label = CalendarUI._formatDayLabel(now, now);
  assert(label.indexOf('Today') === 0, 'starts with Today');
});

console.log('\n═══════════════════════════');
console.log('Calendar: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(f => console.log('  - ' + f.name + ': ' + f.error));
}
console.log('═══════════════════════════\n');
process.exit(failCount > 0 ? 1 : 0);
