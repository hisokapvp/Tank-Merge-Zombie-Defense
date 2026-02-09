/**
 * Pack 6 — Feature flags tests.
 * Run: node Test/pack6/flags.test.js
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
  const fn = new Function('window', 'global', 'document', 'console', code);
  fn(global, global, {}, console);
}

loadModule('src/flags/flags.js');

const Flags = global.Game.Flags;

console.log('\n── Pack 6: Feature Flags ──');

test('FF-1: Flags exists', () => {
  assert(Flags, 'Flags defined');
  assert(typeof Flags.get === 'function', 'get fn');
  assert(typeof Flags.define === 'function', 'define fn');
});

test('FF-2: rollout 0% => false', () => {
  Flags.init({ userId: 'userA', flags: { testFlag0: { rollout: 0 } } });
  assertEqual(Flags.get('testFlag0'), false);
});

test('FF-3: rollout 100% => true', () => {
  Flags.init({ userId: 'userA', flags: { testFlag100: { rollout: 100 } } });
  assertEqual(Flags.get('testFlag100'), true);
});

test('FF-4: rollout uses deterministic bucket', () => {
  Flags.init({ userId: 'userB', flags: { testFlag50: { rollout: 50 } } });
  const bucket = Flags._bucket('testFlag50');
  const expected = bucket < 50;
  assertEqual(Flags.get('testFlag50'), expected);
});

test('FF-5: overrides take precedence', () => {
  Flags.init({ userId: 'userC', flags: { testFlagOverride: { rollout: 0 } } });
  Flags.setOverride('testFlagOverride', true);
  assertEqual(Flags.get('testFlagOverride'), true);
  Flags.setOverride('testFlagOverride', null);
  assertEqual(Flags.get('testFlagOverride'), false);
});

test('FF-6: overrides persist to storage', () => {
  Flags.init({ userId: 'userD', flags: { testFlagPersist: { rollout: 0 } } });
  Flags.setOverride('testFlagPersist', true);
  const key = Flags.STORAGE_OVERRIDE_KEY;
  assert(!!store[key], 'override stored');
});

console.log('\n═══════════════════════════');
console.log('Flags: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(f => console.log('  - ' + f.name + ': ' + f.error));
}
console.log('═══════════════════════════\n');
process.exit(failCount > 0 ? 1 : 0);
