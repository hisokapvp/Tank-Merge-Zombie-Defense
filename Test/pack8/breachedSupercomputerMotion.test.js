/**
 * Pack 8 — breached zombie movement near the supercomputer.
 * Run: node Test/pack8/breachedSupercomputerMotion.test.js
 */

let passCount = 0;
let failCount = 0;
const failures = [];

function assert(condition, message) {
  if (!condition) throw new Error('Assertion failed: ' + message);
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
  extractFunction('getBreachedSupercomputerMoveTarget'),
  extractFunction('getDistanceToSupercomputerHitboxEdge'),
  extractFunction('getSupercomputerHitboxBoundaryPoint'),
  extractFunction('clampPointOutsideSupercomputerHitbox'),
  'module.exports = { getBreachedSupercomputerMoveTarget };'
].join('\n\n');

function createApi() {
  const sandbox = {
    module: { exports: {} },
    exports: {},
    Math: Math,
    BAL: { edgeJoinSpeed: 60 },
    zombieCollisionRadius: function () { return 10; },
  };
  vm.runInNewContext(extractedSource, sandbox, { filename: 'breachedSupercomputerMotion.test.js' });
  return sandbox.module.exports;
}

console.log('\n── Pack 8: Breached supercomputer motion ──');

test('BSM-1: breached zombie in attack window strafes horizontally instead of orbiting around the supercomputer', () => {
  const api = createApi();
  const zombie = {
    attackState: 'attack',
    attackRangePx: 24,
    joinSpeed: 60,
    renderOrder: 2,
    breachStrafePhase: 0,
    breachStrafeBaseAngle: 0,
  };
  const target = api.getBreachedSupercomputerMoveTarget(zombie, 0, -8, 0.5, 1, 1, { x: 0, y: 0 }, true, 0);
  assert(Math.abs(target.x) > 0.5, 'attack-window breached zombie gets a visible horizontal sway');
  assert(target.y < -6, 'attack-window breached zombie keeps a stand-off offset instead of collapsing into the center');
});

test('BSM-2: breached zombie in rest window backs away from the supercomputer and sways more broadly', () => {
  const api = createApi();
  const zombie = {
    attackState: 'walk',
    attackRangePx: 24,
    joinSpeed: 60,
    renderOrder: 1,
    breachStrafePhase: 0,
    breachStrafeBaseAngle: 0,
  };
  const target = api.getBreachedSupercomputerMoveTarget(zombie, 0, -20, 0.25, 1, 1, { x: 0, y: 0 }, false, 24);
  assert(target.y < -20, 'rest-window breached zombie steps farther away from the supercomputer');
  assert(Math.abs(target.x) > 1, 'rest-window breached zombie still keeps a visible horizontal sway while moving at a calmer speed');
});

test('BSM-3: breached zombie still closes distance when the attack window is active but it is far from the supercomputer', () => {
  const api = createApi();
  const zombie = {
    attackState: 'walk',
    attackRangePx: 24,
    joinSpeed: 60,
    renderOrder: 2,
    breachStrafePhase: 0,
    breachStrafeBaseAngle: 0,
  };
  const target = api.getBreachedSupercomputerMoveTarget(zombie, 80, 0, 0.25, 1, 1, { x: 0, y: 0 }, true, 0);
  assert(target.x < 80, 'attack-window breached zombie still approaches the supercomputer when out of range');
});

test('BSM-4: breached zombie treats rectangular supercomputer hitbox as a physical box and stays outside it', () => {
  const api = createApi();
  const zombie = {
    attackState: 'attack',
    attackRangePx: 24,
    joinSpeed: 60,
    renderOrder: 2,
    breachStrafePhase: 0,
    breachStrafeBaseAngle: -Math.PI / 2,
  };
  const target = api.getBreachedSupercomputerMoveTarget(zombie, 0, -5, 0.25, 1, 1, { x: 0, y: 0, shape: 'rect', halfW: 20, halfH: 12, r: 20 }, true, 0);
  assert(target.y <= -15.5, 'movement target is clamped above the top face of the hitbox box');
});

console.log('\n═══════════════════════════');
console.log('BreachedSupercomputerMotion: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(function (failure) {
    console.log('  - ' + failure.name + ': ' + failure.error);
  });
}
console.log('═══════════════════════════\n');
process.exit(failCount > 0 ? 1 : 0);