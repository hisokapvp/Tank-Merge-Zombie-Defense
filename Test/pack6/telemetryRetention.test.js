/**
 * Pack 6 — Telemetry retention tests.
 * Run: node Test/pack6/telemetryRetention.test.js
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

global.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

const fs = require('fs');
const path = require('path');

function loadModule(relPath) {
  const code = fs.readFileSync(path.resolve(__dirname, '../..', relPath), 'utf8');
  const fn = new Function('window', 'global', 'document', 'console', 'Promise',
    'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', code);
  fn(global, global, {}, console, Promise, setTimeout, clearTimeout, setInterval, clearInterval);
}

loadModule('src/telemetry/telemetry.js');

const TL = global.Game.TelemetryLogger;

console.log('\n── Pack 6: Telemetry retention ──');

test('TR-1: trimBuffer exists', () => {
  assert(TL, 'TelemetryLogger defined');
  assert(typeof TL.trimBuffer === 'function', 'trimBuffer fn');
});

test('TR-2: trimBuffer drops old entries', () => {
  const now = Date.now();
  const oldTs = new Date(now - (TL._MAX_AGE_MS + 1000)).toISOString();
  const newTs = new Date(now - 1000).toISOString();
  const entries = [
    { ts: oldTs, event: 'old' },
    { ts: newTs, event: 'new' }
  ];
  const trimmed = TL.trimBuffer(entries, now, 2000, TL._MAX_AGE_MS);
  assertEqual(trimmed.length, 1);
  assertEqual(trimmed[0].event, 'new');
});

test('TR-3: trimBuffer enforces max entries', () => {
  const now = Date.now();
  const entries = [];
  for (let i = 0; i < 5; i++) {
    entries.push({ ts: new Date(now - i * 1000).toISOString(), event: 'e' + i });
  }
  const trimmed = TL.trimBuffer(entries, now, 3, TL._MAX_AGE_MS);
  assertEqual(trimmed.length, 3);
  assertEqual(trimmed[0].event, 'e2');
  assertEqual(trimmed[2].event, 'e0');
});

console.log('\n═══════════════════════════');
console.log('TelemetryRetention: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(f => console.log('  - ' + f.name + ': ' + f.error));
}
console.log('═══════════════════════════\n');
process.exit(failCount > 0 ? 1 : 0);
