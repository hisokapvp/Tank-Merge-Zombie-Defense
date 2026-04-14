/**
 * Pack 8 — hangar chip tech-tier resolution for active modifiers.
 * Run: node Test/pack8/hangarChipTechResolution.test.js
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let passCount = 0;
let failCount = 0;
const failures = [];

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error((message || 'assertEqual') + ': expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
  }
}

function test(name, fn) {
  try {
    fn();
    passCount++;
    console.log('  ✓ ' + name);
  } catch (error) {
    failCount++;
    failures.push({ name: name, error: error.message });
    console.log('  ✗ ' + name + ' — ' + error.message);
  }
}

const root = path.resolve(__dirname, '../..');
const hangarSource = fs.readFileSync(path.join(root, 'src', 'mechanics', 'hangarChips.js'), 'utf8');

function createApi() {
  const sandbox = {
    window: { Game: {} },
    Game: {},
    console: { log: function () {}, warn: function () {}, error: function () {} },
  };
  sandbox.global = sandbox.window;
  vm.runInNewContext(hangarSource, sandbox, { filename: 'hangarChips.js' });
  return sandbox.window.Game.HangarChips;
}

console.log('\n── Pack 8: Hangar tech-tier resolution ──');

test('HTR-1: red-slot Matryoshka active modifier resolves to the latest unlocked tier even from a stale base slot id', () => {
  const api = createApi();
  api.setUnlockedTechs({ 19: true, 20: true });
  const cell = api.createEmptyCell(0);
  cell.redSlots.slot1 = { modIds: [1, 2, 3], rotation: 1 };
  const result = api.calculateActiveModifiers(cell);
  assertEqual(result.modifiers[0].modId, 20, 'active red modifier upgrades from base Matryoshka to tier III');
});

test('HTR-2: red-slot Calming active modifier resolves to the latest unlocked tier even from a stale base slot id', () => {
  const api = createApi();
  api.setUnlockedTechs({ 29: true, 30: true });
  const cell = api.createEmptyCell(1);
  cell.redSlots.slot1 = { modIds: [1, 2, 9], rotation: 1 };
  const result = api.calculateActiveModifiers(cell);
  assertEqual(result.modifiers[0].modId, 30, 'active red modifier upgrades from base Calming to tier III');
});

console.log('\n═══════════════════════════');
console.log('HangarChipTechResolution: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(function (failure) {
    console.log('  - ' + failure.name + ': ' + failure.error);
  });
}
console.log('═══════════════════════════\n');
process.exit(failCount > 0 ? 1 : 0);