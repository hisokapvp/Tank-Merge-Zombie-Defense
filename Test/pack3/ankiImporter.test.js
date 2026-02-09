/**
 * Pack 3 — Anki Importer tests.
 * Run: node Test/pack3/ankiImporter.test.js
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
loadModule('src/tools/anki/importer.js');

const Importer = global.Game.AnkiImporter;
const Catalog = global.Game.LessonCatalog;

console.log('\n── Pack 3: Anki Importer ──');

test('ANKI-1: Importer exists', () => {
  assert(Importer, 'AnkiImporter defined');
  assert(typeof Importer.generateImport === 'function', 'generateImport fn');
  assert(typeof Importer.preview === 'function', 'preview fn');
});

test('ANKI-2: generateImport CSV has 4 columns', () => {
  const lessons = Catalog.listLessons();
  const cards = Importer.buildCardsFromLessons(lessons);
  const csv = Importer.generateImport(cards, 'csv');
  const line = csv.split('\n')[0];
  const cols = line.split(',');
  assertEqual(cols.length, 4);
});

test('ANKI-3: preview JSON is valid', () => {
  const json = Importer.preview('json', { limit: 2 });
  const parsed = JSON.parse(json);
  assert(Array.isArray(parsed), 'is array');
  assertEqual(parsed.length, 2);
});

console.log('\n═══════════════════════════');
console.log('Anki Importer: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(f => console.log('  - ' + f.name + ': ' + f.error));
}
console.log('═══════════════════════════\n');
process.exit(failCount > 0 ? 1 : 0);
