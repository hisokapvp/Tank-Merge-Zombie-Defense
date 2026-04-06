/**
 * Pack 8 — zombie stuck fail-safe teleport.
 * Run: node Test/pack8/zombieFailSafeTeleport.test.js
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
  } catch (error) {
    failCount++;
    failures.push({ name: name, error: error.message });
    console.log('  ✗ ' + name + ' — ' + error.message);
  }
}

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '../..');
const gameSource = fs.readFileSync(path.join(root, 'game.js'), 'utf8');

function extractFunction(name) {
  const signature = 'function ' + name + '(';
  const start = gameSource.indexOf(signature);
  if (start === -1) throw new Error('Function not found: ' + name);
  const bodyStart = gameSource.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < gameSource.length; index++) {
    const ch = gameSource[index];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return gameSource.slice(start, index + 1);
    }
  }
  throw new Error('Unbalanced braces for ' + name);
}

const extractedSource = [
  extractFunction('isZombieDecorBlockedAt'),
  extractFunction('findZombieFenceFailSafeTeleport'),
  extractFunction('maybeTeleportZombieNearFence'),
  'module.exports = { isZombieDecorBlockedAt, findZombieFenceFailSafeTeleport, maybeTeleportZombieNearFence };'
].join('\n\n');

function createApi(options) {
  const math = Object.create(Math);
  math.random = function () { return 0.5; };
  const sandbox = {
    module: { exports: {} },
    exports: {},
    Math: math,
    state: { wallDecors: options.wallDecors || [] },
    center: { x: 0, y: 0 },
    zombieCollisionRadius: function () { return options.zombieRadius || 10; },
    zombieFenceLimit: function () { return options.fenceLimit || 100; },
    getSideByPosition: function () { return 'top'; },
  };
  vm.runInNewContext(extractedSource, sandbox, { filename: 'zombieFailSafeTeleport.test.js' });
  return sandbox.module.exports;
}

console.log('\n── Pack 8: Zombie fail-safe teleport ──');

test('ZFT-1: teleport does not trigger before the 20-second timeout', () => {
  const api = createApi({ wallDecors: [] });
  const zombie = {
    state: 'walk',
    breached: false,
    failSafeTeleported: false,
    spawnTimeSec: 5,
    theta: 0,
    anchorTheta: 0,
    r: 170,
  };
  assertEqual(api.maybeTeleportZombieNearFence(zombie, 24), false, 'teleport stays disabled before timeout');
  assertEqual(zombie.failSafeTeleported, false, 'zombie is not marked as teleported');
  assertEqual(zombie.r, 170, 'zombie radius stays unchanged');
});

test('ZFT-2: teleport moves a stuck zombie near the fence but keeps it outside by 20-30 px', () => {
  const api = createApi({ wallDecors: [] });
  const zombie = {
    state: 'walk',
    breached: false,
    failSafeTeleported: false,
    spawnTimeSec: 0,
    theta: 0,
    anchorTheta: 0,
    r: 180,
  };
  assertEqual(api.maybeTeleportZombieNearFence(zombie, 21), true, 'teleport triggers after timeout');
  assertEqual(zombie.failSafeTeleported, true, 'zombie is marked as teleported');
  assert(zombie.r >= 120 && zombie.r <= 130, 'teleport radius stays 20-30 px outside the fence');
});

test('ZFT-3: blocked straight-line teleport rotates away from decor wall', () => {
  const api = createApi({
    wallDecors: [{ isWall: true, x: 125, y: 0, blockR: 20 }],
  });
  const candidate = api.findZombieFenceFailSafeTeleport({ theta: 0, anchorTheta: 0 });
  assert(candidate, 'candidate is found');
  assert(candidate.theta !== 0, 'candidate rotates away from the blocked forward angle');
  assert(candidate.r >= 120 && candidate.r <= 130, 'candidate still lands near the fence');
});

console.log('\n═══════════════════════════');
console.log('ZombieFailSafeTeleport: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(function (failure) {
    console.log('  - ' + failure.name + ': ' + failure.error);
  });
}
console.log('═══════════════════════════\n');
process.exit(failCount > 0 ? 1 : 0);