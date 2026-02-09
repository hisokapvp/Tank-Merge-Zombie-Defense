/**
 * Pack 2 — Telemetry Logger + Anki Export tests.
 * Run: node Test/pack2/telemetryExport.test.js
 *
 * Validates TelemetryLogger (log, flush, export, clear, rotation)
 * and AnkiExport (CSV/JSON generation, escaping).
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

// ── Fake globals ──
const global = globalThis;
global.window = global;
global.Game = {};
global.Blob = class Blob { constructor(parts, opts) { this.content = parts.join(''); this.type = opts && opts.type; } };
global.URL = { createObjectURL: () => 'blob://fake', revokeObjectURL: () => {} };

const store = {};
global.localStorage = {
  getItem: (k) => store[k] || null,
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
global.document = {
  getElementById: () => null,
  createElement: () => ({
    style: {},
    addEventListener: () => {},
    click: () => {},
    setAttribute: () => {},
  }),
  body: {
    appendChild: () => {},
    removeChild: () => {},
  },
};

const fs = require('fs');
const pathMod = require('path');

function loadModule(relPath) {
  const code = fs.readFileSync(pathMod.resolve(__dirname, '../..', relPath), 'utf-8');
  const fn = new Function('window', 'global', 'document', 'console', 'Promise',
    'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', code);
  fn(global, global, global.document, console, Promise, setTimeout, clearTimeout, setInterval, clearInterval);
}

// Load base telemetry first, then logger, then anki
loadModule('src/utils/telemetry.js');
loadModule('src/telemetry/telemetry.js');
loadModule('src/ui/lessonProgress.js');
loadModule('src/tools/anki/anki_export.js');

const TL = global.Game.TelemetryLogger;
const AE = global.Game.AnkiExport;
const LP = global.Game.LessonProgress;

// ═══════════════════════════════════════
console.log('\n── Pack 2: TelemetryLogger ──');

test('TEL-1: TelemetryLogger exists', () => {
  assert(TL, 'TelemetryLogger defined');
  assert(typeof TL.log === 'function', 'log fn');
  assert(typeof TL.flush === 'function', 'flush fn');
  assert(typeof TL.export === 'function', 'export fn');
  assert(typeof TL.clear === 'function', 'clear fn');
});

test('TEL-2: log() records entry', () => {
  TL.clear();
  TL.log('testEvent', { value: 42 });
  const entries = TL.getEntries();
  assertEqual(entries.length, 1, 'one entry');
  assertEqual(entries[0].event, 'testEvent');
  assertEqual(entries[0].data.value, 42);
});

test('TEL-3: log() adds timestamp', () => {
  TL.clear();
  TL.log('timed');
  const e = TL.getEntries()[0];
  assert(e.ts, 'has timestamp');
  assert(e.ts.indexOf('T') !== -1, 'ISO format');
});

test('TEL-4: setLesson tags entries', () => {
  TL.clear();
  TL.setLesson('TestLesson');
  TL.log('action1');
  TL.setLesson(null);
  TL.log('action2');
  const entries = TL.getEntries();
  assertEqual(entries[0].lesson, 'TestLesson');
  assertEqual(entries[1].lesson, undefined);
});

test('TEL-5: clear() empties entries and storage', () => {
  TL.log('willBeCleared');
  TL.clear();
  assertEqual(TL.getEntries().length, 0, 'memory cleared');
  assertEqual(store[TL._STORAGE_KEY], undefined, 'storage cleared');
});

test('TEL-6: export as JSON', () => {
  TL.clear();
  TL.log('ev1');
  TL.log('ev2');
  const json = TL.export('json');
  const parsed = JSON.parse(json);
  assertEqual(parsed.length, 2);
  assertEqual(parsed[0].event, 'ev1');
});

test('TEL-7: export as CSV', () => {
  TL.clear();
  TL.log('csvEvent', 'somedata');
  const csv = TL.export('csv');
  assert(csv.indexOf('timestamp,event,lesson,data') === 0, 'header line');
  assert(csv.indexOf('csvEvent') !== -1, 'event present');
});

test('TEL-8: CSV escaping of commas and quotes', () => {
  const escaped = TL._csvField('hello, "world"');
  assertEqual(escaped, '"hello, ""world"""');
});

test('TEL-9: CSV escaping of newlines', () => {
  const escaped = TL._csvField('line1\nline2');
  assertEqual(escaped, '"line1\nline2"');
});

test('TEL-10: CSV no escaping needed', () => {
  assertEqual(TL._csvField('simple'), 'simple');
});

test('TEL-11: rotation at MAX_ENTRIES', () => {
  TL.clear();
  for (let i = 0; i < TL._MAX_ENTRIES + 100; i++) {
    TL.log('rot' + i);
  }
  const entries = TL.getEntries();
  assert(entries.length <= TL._MAX_ENTRIES, 'entries rotated to max');
  assertEqual(entries.length, TL._MAX_ENTRIES);
});

test('TEL-12: empty event name is ignored', () => {
  TL.clear();
  TL.log('');
  TL.log(null);
  TL.log(undefined);
  assertEqual(TL.getEntries().length, 0, 'no entries for empty events');
});

test('TEL-13: getEntries returns independent copy', () => {
  TL.clear();
  TL.log('original');
  const copy = TL.getEntries();
  copy.push({ ts: 'fake', event: 'fake' });
  assertEqual(TL.getEntries().length, 1, 'original not mutated');
});

// ═══════════════════════════════════════
console.log('\n── Pack 2: AnkiExport ──');

test('ANKI-1: AnkiExport exists', () => {
  assert(AE, 'AnkiExport defined');
  assert(typeof AE.generate === 'function', 'generate fn');
  assert(typeof AE.buildCards === 'function', 'buildCards fn');
});

test('ANKI-2: generate CSV produces tab-separated lines', () => {
  TL.clear();
  TL.log('testAnki');
  const csv = AE.generate('csv');
  // Each line should have tabs
  const lines = csv.split('\n');
  assert(lines.length >= 1, 'at least one line');
  for (let i = 0; i < lines.length; i++) {
    assert(lines[i].indexOf('\t') !== -1, 'line ' + i + ' has tabs');
  }
});

test('ANKI-3: generate JSON is valid', () => {
  TL.clear();
  TL.log('jsonTest');
  const json = AE.generate('json');
  const parsed = JSON.parse(json);
  assert(Array.isArray(parsed), 'is array');
  assert(parsed.length >= 1, 'has cards');
});

test('ANKI-4: buildCards from LessonProgress', () => {
  LP.load(); // loads defaults
  const cards = AE.buildCards({ tagFilter: 'lesson' });
  assert(cards.length > 0, 'lesson cards generated');
  assert(cards[0].front.indexOf('Lesson:') !== -1, 'has Lesson prefix');
});

test('ANKI-5: buildCards from telemetry', () => {
  TL.clear();
  TL.log('uniqueEvent123');
  const cards = AE.buildCards({ tagFilter: 'telemetry' });
  let found = false;
  for (let i = 0; i < cards.length; i++) {
    if (cards[i].front.indexOf('uniqueEvent123') !== -1) found = true;
  }
  assert(found, 'telemetry event found in cards');
});

test('ANKI-6: CSV escaping in AnkiExport', () => {
  const escaped = AE._escapeCSV('hello\tworld');
  assertEqual(escaped, '"hello\tworld"');
});

test('ANKI-7: empty telemetry produces empty or minimal output', () => {
  TL.clear();
  // clear lesson progress too
  LP.resetAll();
  const cards = AE.buildCards({ tagFilter: 'telemetry' });
  assertEqual(cards.length, 0, 'no telemetry cards');
});

test('ANKI-8: hookUI does not throw without DOM', () => {
  AE.hookUI(); // should not throw
});

// ═══════════════════════════════════════
console.log('\n── Pack 2: LessonProgress ──');

test('LP-1: LessonProgress exists', () => {
  assert(LP, 'defined');
  assert(typeof LP.getLessons === 'function', 'getLessons fn');
  assert(typeof LP.updateLesson === 'function', 'updateLesson fn');
  assert(typeof LP.completeLesson === 'function', 'completeLesson fn');
});

test('LP-2: load() initializes default lessons', () => {
  delete store[LP._STORAGE_KEY];
  LP.load();
  const lessons = LP.getLessons();
  assertEqual(lessons.length, LP._DEFAULT_LESSONS.length);
});

test('LP-3: updateLesson sets score', () => {
  LP.load();
  LP.updateLesson('Basics: Merge Tanks', 95);
  const lessons = LP.getLessons();
  let found = null;
  for (let i = 0; i < lessons.length; i++) {
    if (lessons[i].name === 'Basics: Merge Tanks') found = lessons[i];
  }
  assert(found, 'lesson found');
  assertEqual(found.lastScore, 95);
});

test('LP-4: completeLesson marks completed', () => {
  LP.load();
  LP.completeLesson('Combat: Fire Patterns', 88);
  const lessons = LP.getLessons();
  let found = null;
  for (let i = 0; i < lessons.length; i++) {
    if (lessons[i].name === 'Combat: Fire Patterns') found = lessons[i];
  }
  assert(found, 'lesson found');
  assertEqual(found.completed, true);
  assertEqual(found.lastScore, 88);
});

test('LP-5: updateLesson creates new lesson if not found', () => {
  LP.load();
  LP.updateLesson('New Custom Lesson', 50);
  const lessons = LP.getLessons();
  let found = false;
  for (let i = 0; i < lessons.length; i++) {
    if (lessons[i].name === 'New Custom Lesson') found = true;
  }
  assert(found, 'new lesson added');
});

test('LP-6: resetAll restores defaults', () => {
  LP.load();
  LP.completeLesson('Basics: Merge Tanks', 100);
  LP.resetAll();
  const lessons = LP.getLessons();
  for (let i = 0; i < lessons.length; i++) {
    assertEqual(lessons[i].completed, false, lessons[i].name + ' not completed');
    assertEqual(lessons[i].lastScore, null, lessons[i].name + ' no score');
  }
});

test('LP-7: getLessons returns independent copy', () => {
  LP.load();
  const copy = LP.getLessons();
  copy[0].name = 'MUTATED';
  const original = LP.getLessons();
  assert(original[0].name !== 'MUTATED', 'not mutated');
});

test('LP-8: save/load persistence roundtrip', () => {
  LP.load();
  LP.updateLesson('Basics: Merge Tanks', 77);
  LP.save();
  // Simulate fresh load
  const raw = store[LP._STORAGE_KEY];
  assert(raw, 'saved to storage');
  const parsed = JSON.parse(raw);
  let found = false;
  for (let i = 0; i < parsed.length; i++) {
    if (parsed[i].name === 'Basics: Merge Tanks' && parsed[i].lastScore === 77) found = true;
  }
  assert(found, 'score persisted');
});

test('LP-9: init without DOM does not throw', () => {
  LP.init();
});

// ── Summary ──
console.log('\n═══════════════════════════');
console.log('TelemetryExport: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(f => console.log('  - ' + f.name + ': ' + f.error));
}
console.log('═══════════════════════════\n');
process.exit(failCount > 0 ? 1 : 0);
