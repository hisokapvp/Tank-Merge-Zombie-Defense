/**
 * Pack 8 — decor collision pulse (замена zombie fail-safe teleport).
 * Run: node Test/pack8/decorCollisionPulse.test.js
 *
 * Контракт: каждые `periodSec` секунд коллизия isWall-декора выключается на
 * случайную длительность в [offDurationMinSec, offDurationMaxSec], давая зомби
 * пройти сквозь заблокировавший их элемент карты. Телепорт-система удалена.
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

function loadModule(relPath) {
  const code = fs.readFileSync(path.join(root, relPath), 'utf8');
  const sandbox = { window: {}, Math: Math };
  sandbox.window.window = sandbox.window;
  vm.runInNewContext(code, sandbox, { filename: relPath });
  return sandbox.window.Game.DecorCollisionPulse;
}

const api = loadModule('src/mechanics/decorCollision.js');

function fixedRandom(value) {
  return function () { return value; };
}

console.log('\n── Pack 8: Decor collision pulse ──');

// DCP-1..2 — нормализация конфига
test('DCP-1: default config matches periodSec=10 / off 1..2 sec', () => {
  const cfg = api.normalizeConfig(null);
  assertEqual(cfg.enabled, true, 'pulse enabled by default');
  assertEqual(cfg.periodSec, 10, 'period is 10 seconds');
  assertEqual(cfg.offDurationMinSec, 1, 'min off duration is 1 second');
  assertEqual(cfg.offDurationMaxSec, 2, 'max off duration is 2 seconds');
});

test('DCP-2: invalid / inverted authoring values are clamped, not trusted', () => {
  const cfg = api.normalizeConfig({
    enabled: false,
    periodSec: -5,
    offDurationMinSec: 30,
    offDurationMaxSec: 1,
  });
  assertEqual(cfg.enabled, false, 'explicit disable is preserved');
  assert(cfg.periodSec >= 0.5, 'period clamped to a sane floor');
  assert(cfg.offDurationMaxSec >= cfg.offDurationMinSec, 'max never below min');
  assert(cfg.offDurationMaxSec < cfg.periodSec, 'window never swallows the whole period');
});

// DCP-3..5 — таймлайн
test('DCP-3: collision stays active for the whole first 10 seconds', () => {
  const state = api.createState(null, fixedRandom(0));
  // 9.5 сек строго до границы периода: коллизия обязана блокировать.
  for (let t = 0; t < 9.5; t += 0.5) {
    assertEqual(api.step(state, 0.5), false, 'no suppression before first period elapses');
  }
  assertEqual(api.isSuppressed(state), false, 'still blocking just before the boundary');
  assertEqual(api.step(state, 0.5), true, 'opens exactly when the first period elapses');
});

test('DCP-4: collision opens exactly at period boundary for at least 1 second', () => {
  const state = api.createState(null, fixedRandom(0)); // duration = 1 sec (min)
  api.step(state, 9.9);
  assertEqual(api.isSuppressed(state), false, 'closed just before the boundary');
  const opened = api.step(state, 0.2);
  assertEqual(opened, true, 'opens right after 10s elapse');
  assertEqual(api.isSuppressed(state), true, 'suppression flag set');
});

test('DCP-5: window closes again and reopens after another full period', () => {
  const state = api.createState(null, fixedRandom(0)); // 1 second window
  api.step(state, 10.1);
  assertEqual(api.isSuppressed(state), true, 'inside the window');
  api.step(state, 0.95);
  assertEqual(api.isSuppressed(state), true, 'window lasts ~1 second');
  api.step(state, 0.1);
  assertEqual(api.isSuppressed(state), false, 'window closed after 1 second');
  api.step(state, 9.5);
  assertEqual(api.isSuppressed(state), false, 'no reopening before the next 10-second period');
  api.step(state, 0.5);
  assertEqual(api.isSuppressed(state), true, 'reopens one period after the previous window');
});

test('DCP-6: random factor scales the window inside [min, max]', () => {
  const minState = api.createState(null, fixedRandom(0));
  api.step(minState, 10.05);
  const minLeft = api.describe(minState).secondsLeftInOff;
  assert(Math.abs(minLeft - 1) < 0.1, 'random=0 gives the 1-second minimum window');

  const maxState = api.createState(null, fixedRandom(1));
  api.step(maxState, 10.05);
  const maxLeft = api.describe(maxState).secondsLeftInOff;
  assert(Math.abs(maxLeft - 2) < 0.1, 'random=1 gives the 2-second maximum window');
});

// DCP-7..8 — устойчивость и kill-switch
test('DCP-7: disabled config never suppresses and never advances the flag', () => {
  const state = api.createState({ enabled: false, periodSec: 1, offDurationMinSec: 1, offDurationMaxSec: 1 });
  for (let i = 0; i < 40; i++) api.step(state, 0.5);
  assertEqual(api.isSuppressed(state), false, 'kill-switch keeps collision permanent');
});

test('DCP-8: invalid dt and missing state degrade safely instead of throwing', () => {
  assertEqual(api.step(null, 1), false, 'null state returns false');
  const state = api.createState(null, fixedRandom(0));
  assertEqual(api.step(state, NaN), false, 'NaN dt does not open a window');
  assertEqual(api.step(state, -5), false, 'negative dt does not open a window');
  assertEqual(api.isSuppressed(null), false, 'isSuppressed(null) is false');
});

test('DCP-9: resetState restarts the timeline from scratch', () => {
  const state = api.createState(null, fixedRandom(0));
  api.step(state, 10.5);
  assertEqual(api.isSuppressed(state), true, 'suppressed before reset');
  api.resetState(state, null);
  assertEqual(api.isSuppressed(state), false, 'reset clears suppression');
  assertEqual(api.describe(state).elapsedSec, 0, 'elapsed timeline restarted');
  api.step(state, 9.9);
  assertEqual(api.isSuppressed(state), false, 'first window again requires a full period');
});

// DCP-10..11 — интеграция с game.js (wiring, не поведение симуляции)
const gameSource = fs.readFileSync(path.join(root, 'game.js'), 'utf8');

test('DCP-10: game.js wires the pulse into both decor collision seams', () => {
  const moveFnStart = gameSource.indexOf('function resolveZombieWallMove(');
  const moveFnEnd = gameSource.indexOf('function isZombieDecorBlockedAt(');
  assert(moveFnStart !== -1 && moveFnEnd > moveFnStart, 'both decor functions present');
  assert(
    gameSource.slice(moveFnStart, moveFnEnd).indexOf('isDecorCollisionSuppressed()') !== -1,
    'resolveZombieWallMove honours the suppression flag'
  );
  const blockedFnEnd = gameSource.indexOf('\n}\n', gameSource.indexOf('function isZombieDecorBlockedAt('));
  assert(
    gameSource.slice(moveFnEnd, blockedFnEnd).indexOf('isDecorCollisionSuppressed()') !== -1,
    'isZombieDecorBlockedAt honours the suppression flag'
  );
  assert(
    gameSource.indexOf('stepDecorCollisionPulse(dt);') !== -1,
    'pulse timeline steps once per frame inside stepZombies'
  );
});

test('DCP-11: teleport fail-safe system is fully removed', () => {
  assert(gameSource.indexOf('maybeTeleportZombieNearFence') === -1, 'maybeTeleportZombieNearFence gone');
  assert(gameSource.indexOf('findZombieFenceFailSafeTeleport') === -1, 'findZombieFenceFailSafeTeleport gone');
  assert(gameSource.indexOf('failSafeTeleported') === -1, 'failSafeTeleported field gone');
  assert(gameSource.indexOf('failSafeDecor') === -1, 'failSafeDecor timer fields gone');
});

test('DCP-12: decor.json + loader + index.html + run_tests wiring is present', () => {
  const decorJson = JSON.parse(fs.readFileSync(path.join(root, 'assets/decor.json'), 'utf8'));
  assert(decorJson.collisionPulse && typeof decorJson.collisionPulse === 'object', 'decor.json carries collisionPulse');
  assertEqual(decorJson.collisionPulse.periodSec, 10, 'authoring period is 10 seconds');
  assertEqual(decorJson.collisionPulse.offDurationMinSec, 1, 'authoring min window is 1 second');
  assertEqual(decorJson.collisionPulse.offDurationMaxSec, 2, 'authoring max window is 2 seconds');

  const loaderSrc = fs.readFileSync(path.join(root, 'src/render/spriteLoaders.js'), 'utf8');
  assert(loaderSrc.indexOf('collisionPulse') !== -1, 'spriteLoaders forwards collisionPulse into DecorSprites.config');

  const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert(indexHtml.indexOf('src/mechanics/decorCollision.js') !== -1, 'index.html loads the pulse module');

  const runTests = fs.readFileSync(path.join(root, 'ci/run_tests.sh'), 'utf8');
  assert(runTests.indexOf('Test/pack8/decorCollisionPulse.test.js') !== -1, 'pulse test is registered in CI');
  assert(runTests.indexOf('zombieFailSafeTeleport.test.js') === -1, 'removed teleport test is no longer run');
});

console.log('\n═══════════════════════════');
console.log('DecorCollisionPulse: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(f => console.log('  - ' + f.name + ': ' + f.error));
}
console.log('═══════════════════════════\n');
process.exit(failCount > 0 ? 1 : 0);
