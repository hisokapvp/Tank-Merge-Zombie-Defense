/**
 * Pack 8 — supercomputer runtime attack hitbox.
 * Run: node Test/pack8/supercomputerAttackHitbox.test.js
 */

let passCount = 0;
let failCount = 0;
const failures = [];

function assert(condition, message) {
  if (!condition) throw new Error('Assertion failed: ' + message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message + ' (expected ' + expected + ', got ' + actual + ')');
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
  extractFunction('selectZombieAttackTargetForZombie'),
  extractFunction('resolveSupercomputerAttackHitbox'),
  extractFunction('getDistanceToSupercomputerHitboxEdge'),
  'module.exports = { selectZombieAttackTargetForZombie, resolveSupercomputerAttackHitbox };'
].join('\n\n');

function createApi(options) {
  const opts = options || {};
  const sandbox = {
    module: { exports: {} },
    exports: {},
    Math: Math,
    balScale: 1,
    zombiePos: function (zombie) {
      return { x: zombie.x, y: zombie.y };
    },
    getComputerState: function () {
      return opts.scState || { x: 100, y: 200, hp: 100 };
    },
    selectZombieFenceTargetForZombie: function () {
      return null;
    },
    resolveSupercomputerVisualStateName: function () {
      return 'idle';
    },
    resolveSupercomputerAnimationScale: function () {
      return 1;
    },
    resolveSupercomputerSpriteMetrics: function () {
      return Object.assign({ centerX: 100, centerY: 180, halfW: 40, halfH: 30, width: 80, height: 60 }, opts.metrics || {});
    },
    SupercomputerSprites: {
      config: opts.spriteConfig || { hitbox: { w: 60, h: 60, offsetX: 0, offsetY: 0 } },
      getAnimation: function () {
        return { w: 80, h: 60 };
      },
    },
  };
  vm.runInNewContext(extractedSource, sandbox, { filename: 'supercomputerAttackHitbox.test.js' });
  return sandbox.module.exports;
}

console.log('\n── Pack 8: Supercomputer attack hitbox ──');

test('SAH-1: resolveSupercomputerAttackHitbox applies configurable offset and rectangle size from supercomputer.json', () => {
  const api = createApi({
    spriteConfig: { hitbox: { w: 60, h: 36, offsetX: 6, offsetY: -9 } },
    metrics: { centerX: 100, centerY: 180 },
  });
  const hitbox = api.resolveSupercomputerAttackHitbox({ x: 120, y: 220, hp: 100 });
  assertEqual(hitbox.x, 106, 'hitbox X uses sprite center plus config offset');
  assertEqual(hitbox.y, 171, 'hitbox Y uses sprite center plus config offset');
  assertEqual(hitbox.width, 60, 'hitbox width comes from config');
  assertEqual(hitbox.height, 36, 'hitbox height comes from config');
  assertEqual(hitbox.shape, 'rect', 'rectangular hitbox mode is enabled when width/height are present');
});

test('SAH-2: selectZombieAttackTargetForZombie measures distance to the rectangular hitbox edge, not to raw supercomputer anchor', () => {
  const api = createApi({
    scState: { x: 100, y: 200, hp: 100 },
    spriteConfig: { hitbox: { w: 40, h: 30, offsetX: 0, offsetY: 0 } },
    metrics: { centerX: 100, centerY: 180 },
  });
  const zombie = { x: 124, y: 180, knowsBreach: false };
  const target = api.selectZombieAttackTargetForZombie(zombie, 5, true);
  assert(target && target.kind === 'supercomputer', 'zombie reaches the supercomputer via hitbox edge distance');
  assertEqual(target.distance, 4, 'reported distance is measured from hitbox edge');
});

console.log('\n═══════════════════════════');
console.log('SupercomputerAttackHitbox: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(function (failure) {
    console.log('  - ' + failure.name + ': ' + failure.error);
  });
}
console.log('═══════════════════════════\n');
process.exit(failCount > 0 ? 1 : 0);