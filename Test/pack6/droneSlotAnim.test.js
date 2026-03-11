/**
 * Focused tests for drone slot/world animation resolution.
 * Run: node Test/pack6/droneSlotAnim.test.js
 */

let passCount = 0;
let failCount = 0;
const failures = [];

function assert(condition, message) {
  if (!condition) throw new Error('Assertion failed: ' + message);
}

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
  } catch (e) {
    failCount++;
    failures.push({ name, error: e.message });
    console.log('  ✗ ' + name + ' — ' + e.message);
  }
}

const global = globalThis;
global.window = global;
global.Game = {};

const fs = require('fs');
const path = require('path');
const code = fs.readFileSync(path.resolve(__dirname, '../../src/mechanics/drones.js'), 'utf-8');
const fn = new Function('window', 'global', code);
fn(global, global);

const Drones = global.Game.Drones;

console.log('\n── Pack 6: Drone slot animation state ──');

test('DR-1: standby drone uses wait animation in slot', () => {
  assertEqual(Drones._resolveHangarDroneAnimName({ mode: Drones.MODE_STANDBY }), 'wait');
});

test('DR-2: repair patrol and repair work both use work animation in slot', () => {
  assertEqual(Drones._resolveHangarDroneAnimName({ mode: Drones.MODE_REPAIR, substate: Drones.SUBSTATE_REPAIR_PATROL }), 'work');
  assertEqual(Drones._resolveHangarDroneAnimName({ mode: Drones.MODE_REPAIR, substate: Drones.SUBSTATE_REPAIR_WORK }), 'work');
});

test('DR-3: world sprite keeps fly/repair split for active drone bodies', () => {
  assertEqual(Drones._resolveWorldDroneAnimName({ mode: Drones.MODE_REPAIR, substate: Drones.SUBSTATE_REPAIR_PATROL }), 'fly');
  assertEqual(Drones._resolveWorldDroneAnimName({ mode: Drones.MODE_REPAIR, substate: Drones.SUBSTATE_REPAIR_WORK }), 'repair');
});

console.log('\n═══════════════════════════');
console.log('Drone slot anim: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(function (failure) {
    console.log('  - ' + failure.name + ': ' + failure.error);
  });
}
console.log('═══════════════════════════\n');
process.exit(failCount > 0 ? 1 : 0);