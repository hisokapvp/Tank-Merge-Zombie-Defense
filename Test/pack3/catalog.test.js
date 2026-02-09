/**
 * Pack 3 — Lesson Catalog tests.
 * Run: node Test/pack3/catalog.test.js
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

loadModule('src/lessons/catalog.js');

const Catalog = global.Game.LessonCatalog;

console.log('\n── Pack 3: Lesson Catalog ──');

test('CAT-1: LessonCatalog exists', () => {
  assert(Catalog, 'LessonCatalog defined');
  assert(typeof Catalog.listLessons === 'function', 'listLessons fn');
  assert(typeof Catalog.getLessonById === 'function', 'getLessonById fn');
});

test('CAT-2: listLessons returns entries', () => {
  const lessons = Catalog.listLessons();
  assert(Array.isArray(lessons), 'is array');
  assert(lessons.length >= 5, 'at least 5 lessons');
});

test('CAT-3: getLessonById finds a known lesson', () => {
  const lesson = Catalog.getLessonById('basics_merge_tanks');
  assert(lesson, 'lesson found');
  assertEqual(lesson.name, 'Basics: Merge Tanks');
});

console.log('\n═══════════════════════════');
console.log('Catalog: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(f => console.log('  - ' + f.name + ': ' + f.error));
}
console.log('═══════════════════════════\n');
process.exit(failCount > 0 ? 1 : 0);
