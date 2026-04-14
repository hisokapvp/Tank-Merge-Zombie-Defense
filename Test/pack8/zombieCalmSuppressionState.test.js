/**
 * Pack 8 — zombie calm suppression pause/resume.
 * Run: node Test/pack8/zombieCalmSuppressionState.test.js
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
  extractFunction('resetZombieCalmSuppressionState'),
  extractFunction('shouldZombieHoldPositionWhileCalmed'),
  extractFunction('syncZombieCalmSuppressionState'),
  'module.exports = { resetZombieCalmSuppressionState, shouldZombieHoldPositionWhileCalmed, syncZombieCalmSuppressionState };'
].join('\n\n');

function createApi() {
  const sandbox = {
    module: { exports: {} },
    exports: {},
  };
  vm.runInNewContext(extractedSource, sandbox, { filename: 'zombieCalmSuppressionState.test.js' });
  return sandbox.module.exports;
}

console.log('\n── Pack 8: Zombie calm suppression state ──');

test('ZCS-1: entering calm snapshots attack progress and forces walk state', () => {
  const api = createApi();
  const zombie = {
    attackState: 'attack',
    attackAnimTimeSec: 0.32,
    attackCooldownTimerSec: 0,
    attackDidHit: false,
    attackTargetId: 'supercomputer',
    calmUntil: 10,
    calmHitCount: 3,
    calmImmuneUntil: 0,
  };

  api.syncZombieCalmSuppressionState(zombie, true, { kind: 'supercomputer' });

  assertEqual(zombie.calmSuppressionActive, true, 'calm suppression becomes active');
  assertEqual(zombie.calmResumeState, 'attack', 'attack state is cached for resume');
  assertEqual(zombie.calmResumeAttackAnimTimeSec, 0.32, 'attack animation progress is cached');
  assertEqual(zombie.attackState, 'walk', 'calmed zombie stops attacking immediately');
  assertEqual(zombie.attackAnimTimeSec, 0, 'live attack animation timer is cleared while calmed');
});

test('ZCS-2: leaving calm with a valid target restores paused attack state', () => {
  const api = createApi();
  const zombie = {
    attackState: 'attack',
    attackAnimTimeSec: 0.45,
    attackCooldownTimerSec: 0,
    attackDidHit: false,
    attackTargetId: 'supercomputer',
    calmUntil: 10,
    calmHitCount: 1,
    calmImmuneUntil: 0,
  };

  api.syncZombieCalmSuppressionState(zombie, true, { kind: 'supercomputer' });
  api.syncZombieCalmSuppressionState(zombie, false, { kind: 'supercomputer' });

  assertEqual(zombie.calmSuppressionActive, false, 'calm suppression flag is cleared after recovery');
  assertEqual(zombie.attackState, 'attack', 'attack state resumes after calm ends');
  assertEqual(zombie.attackAnimTimeSec, 0.45, 'attack animation resumes from cached progress');
  assertEqual(zombie.attackTargetId, 'supercomputer', 'supercomputer target is restored on resume');
});

test('ZCS-3: leaving calm with a valid target restores paused cooldown state', () => {
  const api = createApi();
  const zombie = {
    attackState: 'cooldown',
    attackAnimTimeSec: 0,
    attackCooldownTimerSec: 0.6,
    attackDidHit: false,
    attackTargetId: 'segment-1',
    calmUntil: 10,
    calmHitCount: 1,
    calmImmuneUntil: 0,
  };

  api.syncZombieCalmSuppressionState(zombie, true, { kind: 'fence', seg: { id: 'segment-1' } });
  api.syncZombieCalmSuppressionState(zombie, false, { kind: 'fence', seg: { id: 'segment-1' } });

  assertEqual(zombie.attackState, 'cooldown', 'cooldown state resumes after calm ends');
  assertEqual(zombie.attackCooldownTimerSec, 0.6, 'cooldown timer resumes from cached value');
  assertEqual(zombie.attackTargetId, 'segment-1', 'fence target id is restored on resume');
});

test('ZCS-4: leaving calm without a target clears resume state and keeps the zombie walking', () => {
  const api = createApi();
  const zombie = {
    attackState: 'attack',
    attackAnimTimeSec: 0.2,
    attackCooldownTimerSec: 0,
    attackDidHit: false,
    attackTargetId: 'supercomputer',
    calmUntil: 10,
    calmHitCount: 1,
    calmImmuneUntil: 0,
  };

  api.syncZombieCalmSuppressionState(zombie, true, { kind: 'supercomputer' });
  api.syncZombieCalmSuppressionState(zombie, false, null);

  assertEqual(zombie.attackState, 'walk', 'zombie stays in walk state when no target is available after calm');
  assertEqual(zombie.calmResumeState, '', 'resume state is cleared when calm exits without a target');
  assertEqual(zombie.calmSuppressionActive, false, 'calm suppression flag is cleared');
});

test('ZCS-5: active calm suppression holds the zombie in place instead of letting walk drift continue', () => {
  const api = createApi();
  const zombie = {
    calmSuppressionActive: true,
  };

  assertEqual(api.shouldZombieHoldPositionWhileCalmed(zombie, true), true, 'suppressed calm window holds position');
});

test('ZCS-6: hold-position path disables itself as soon as calm is inactive or not yet armed', () => {
  const api = createApi();

  assertEqual(api.shouldZombieHoldPositionWhileCalmed({ calmSuppressionActive: false }, true), false, 'missing suppression flag does not freeze movement');
  assertEqual(api.shouldZombieHoldPositionWhileCalmed({ calmSuppressionActive: true }, false), false, 'expired calm window releases movement');
});

console.log('\n═══════════════════════════');
console.log('ZombieCalmSuppressionState: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(function (failure) {
    console.log('  - ' + failure.name + ': ' + failure.error);
  });
}
console.log('═══════════════════════════\n');
process.exit(failCount > 0 ? 1 : 0);