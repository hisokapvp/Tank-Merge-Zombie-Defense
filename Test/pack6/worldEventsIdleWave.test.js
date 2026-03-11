/**
 * Focused tests for idle zombie wave runtime between full attack waves.
 * Run: node Test/pack6/worldEventsIdleWave.test.js
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
const code = fs.readFileSync(path.resolve(__dirname, '../../src/systems/worldEventsRuntime.js'), 'utf-8');
const fn = new Function('window', 'global', code);
fn(global, global);

let now = 0;
const state = { debug: {}, zombieWaveAtkMult: 1 };
const worldEventsState = {};
const rainCache = { maxDrops: 0, x: [], y: [], speed: [], len: [] };
const fakeCtx = {
  save() {},
  restore() {},
  beginPath() {},
  moveTo() {},
  lineTo() {},
  stroke() {},
  fillRect() {},
  set strokeStyle(_) {},
  set lineWidth(_) {},
  set lineCap(_) {},
  set fillStyle(_) {},
};

const controller = global.Game.WorldEventsRuntime.createController({
  getWorldEventsCfg() {
    return {
      enabled: true,
      attackMode: {
        enabled: true,
        attackEverySec: 30,
        attackDurationSec: 10,
        damageMult: 1.5,
        idleWave: {
          enabled: true,
          attackDamageMul: 0.01,
          betweenWavesSec: 12,
          attackDurationSec: 4,
          wanderDurationSec: 8,
          retreatDistanceMinPx: 30,
          retreatDistanceMaxPx: 50,
        },
      },
      weather: { enabled: false },
    };
  },
  getState() { return state; },
  getWorldEventsState() { return worldEventsState; },
  nowSec() { return now; },
  clamp(value, min, max) { return Math.max(min, Math.min(max, value)); },
  normalizedSfxSources(primary, fallback) { return Array.isArray(primary) ? primary : (Array.isArray(fallback) ? fallback : []); },
  getDefaultRainLoopSources() { return []; },
  setSfxSources() {},
  playSfx() {},
  playLoopSfx() {},
  stopLoopSfx() {},
  setLoopSfxVolume() {},
  getRainCache() { return rainCache; },
  getViewSize() { return { w: 100, h: 100 }; },
  getCtx() { return fakeCtx; },
});

console.log('\n── Pack 6: WorldEvents idle wave runtime ──');

test('WE-1: starts in between phase with attacks disabled', () => {
  controller.updateWorldEvents(0);
  assertEqual(controller.getZombieIdleWavePhase(), 'between');
  assertEqual(controller.shouldZombieAttemptAttack(), false);
  assertEqual(controller.getZombieFenceAttackDamageMul(), 0);
});

test('WE-2: switches to light attack after the configured interval', () => {
  now = 12.1;
  controller.updateWorldEvents(0.1);
  assertEqual(controller.getZombieIdleWavePhase(), 'attack');
  assertEqual(controller.shouldZombieAttemptAttack(), true);
  assertEqual(controller.getZombieFenceAttackDamageMul(), 0.01);
});

test('WE-3: wander phase retreats zombies by a stable 30-50 px offset', () => {
  now = 16.2;
  controller.updateWorldEvents(0.1);
  assertEqual(controller.getZombieIdleWavePhase(), 'wander');
  const zombie = { anchorTheta: 1.2345 };
  const retreatA = controller.getZombieIdleRetreatOffsetPx(zombie);
  const retreatB = controller.getZombieIdleRetreatOffsetPx(zombie);
  assert(retreatA >= 30 && retreatA <= 50, 'retreat distance is within configured band');
  assertEqual(retreatA, retreatB, 'retreat distance is stable per zombie');
});

test('WE-4: full attack mode suppresses idle phase and restores full damage multiplier', () => {
  worldEventsState.attackEndAt = now + 1;
  controller.updateWorldEvents(0.1);
  assertEqual(controller.shouldZombieAttemptAttack(), true);
  assertEqual(controller.getZombieFenceAttackDamageMul(), 1.5);
  assertEqual(controller.getZombieIdleWavePhase(), 'suppressed');
  worldEventsState.attackEndAt = 0;
});

console.log('\n═══════════════════════════');
console.log('WorldEvents idle wave: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(function (failure) {
    console.log('  - ' + failure.name + ': ' + failure.error);
  });
}
console.log('═══════════════════════════\n');
process.exit(failCount > 0 ? 1 : 0);