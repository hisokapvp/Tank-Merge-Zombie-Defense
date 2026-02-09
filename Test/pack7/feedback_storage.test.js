/**
 * Pack 7 — Feedback widget storage.
 * Run: node Test/pack7/feedback_storage.test.js
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

global.Game = {
  TelemetryLogger: {
    _logs: [],
    log: function (event, data) {
      this._logs.push({ event: event, data: data });
    }
  }
};

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

console.log('\n── Pack 7: Feedback widget storage ──');

loadModule('src/feedback/widget.js');

const FW = global.Game.FeedbackWidget;

test('FB-1: submit stores feedback entry', () => {
  const res = FW.submitFeedback({ message: 'Hello world', rating: 4, category: 'bug' });
  assert(res.ok, 'submit ok');
  const raw = store[FW._STORAGE_KEY];
  assert(!!raw, 'storage updated');
  const arr = JSON.parse(raw);
  assertEqual(arr.length, 1, 'one entry');
  assertEqual(arr[0].message, 'Hello world');
});

test('FB-2: empty message rejected', () => {
  const res = FW.submitFeedback({ message: '   ' });
  assertEqual(res.ok, false, 'empty rejected');
});

test('FB-3: telemetry log recorded', () => {
  const logs = global.Game.TelemetryLogger._logs;
  assert(logs.length >= 1, 'log present');
  assertEqual(logs[0].event, 'feedbackSubmit');
});

console.log('\n═══════════════════════════');
console.log('Feedback storage: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(f => console.log('  - ' + f.name + ': ' + f.error));
}
console.log('═══════════════════════════\n');
process.exit(failCount > 0 ? 1 : 0);
