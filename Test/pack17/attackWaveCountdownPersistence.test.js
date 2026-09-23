/**
 * Pack 17 — attack-wave countdown: persist + resume from save.
 *
 * Контракт (2026-09-23, задача пользователя):
 *   1) Полный `attackEverySec` (2 минуты) до первой волны — только когда
 *      симуляция стартует заново: New Game, «Перезапуск симуляции», и загрузка
 *      critical-сейва, помеченного `forceFenceRuntimeResetOnLoad`
 *      («Сохранить прогресс и выйти» + его последующая загрузка).
 *   2) Обычное сохранение посреди игры не должно заново отсчитывать интервал:
 *      сохранился за 10 секунд до волны → после загрузки волна через 10 секунд.
 *      Значит countdown обязан персиститься.
 *
 * Реализация:
 *   - runtime seam'ы в `src/systems/worldEventsRuntime.js`:
 *     `getAttackWaveRemainingSec()`, `applyLoadedAttackWaveTiming()`,
 *     `scheduleFirstAttackWaveAfterRestart()`;
 *   - writer `storage.js` `serializeAttackWaveRemainingSec()` (live-first через
 *     `Game.getAttackWaveRemainingSec()`, fallback на `state.attackWaveRemainingSec`);
 *   - reader `game.js` `restoreFullState()` → `applyLoadedAttackWaveTiming()`;
 *     `forceFenceRuntimeResetOnLoad` ветка игнорирует поле и зовёт
 *     `scheduleFirstAttackWaveAfterRestart()`.
 *
 * Run: node Test/pack17/attackWaveCountdownPersistence.test.js
 */

'use strict';

let passCount = 0;
let failCount = 0;
const failures = [];

function assert(cond, msg) {
  if (!cond) throw new Error('Assertion failed: ' + msg);
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error((msg || 'assertEqual') + ': expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
  }
}

function assertClose(actual, expected, tolerance, msg) {
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > tolerance) {
    throw new Error((msg || 'assertClose') + ': expected ~' + expected + ' (±' + tolerance + '), got ' + actual);
  }
}

function test(name, fn) {
  try {
    fn();
    passCount++;
    console.log('  [OK] ' + name);
  } catch (e) {
    failCount++;
    failures.push({ name: name, error: e.message });
    console.log('  [FAIL] ' + name + ' - ' + e.message);
  }
}

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const gameJs = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf-8');
const storageJs = fs.readFileSync(path.join(ROOT, 'src/persistence/storage.js'), 'utf-8');
const runtimeJs = fs.readFileSync(path.join(ROOT, 'src/systems/worldEventsRuntime.js'), 'utf-8');
const typesJs = fs.readFileSync(path.join(ROOT, 'src/persistence/serializedStateTypes.js'), 'utf-8');
const saveSchema = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/saveSchema.json'), 'utf-8'));
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf-8');

/* ------------------------------------------------------------------ */
/*  Runtime controller harness (mirrors Test/pack6/worldEventsIdleWave) */
/* ------------------------------------------------------------------ */

const globalObj = globalThis;
globalObj.window = globalObj;
globalObj.Game = {};

const runtimeFn = new Function('window', 'global', runtimeJs);
runtimeFn(globalObj, globalObj);

const ATTACK_EVERY_SEC = 120;
const ATTACK_DURATION_SEC = 60;
let now = 0;
const state = { debug: {} };
const worldEventsState = {};

const controller = globalObj.Game.WorldEventsRuntime.createController({
  getWorldEventsCfg: function () {
    return {
      enabled: true,
      attackMode: {
        enabled: true,
        attackEverySec: ATTACK_EVERY_SEC,
        attackDurationSec: ATTACK_DURATION_SEC,
        damageMult: 3,
        idleWave: { enabled: false },
      },
      weather: { enabled: false },
    };
  },
  getState: function () { return state; },
  getWorldEventsState: function () { return worldEventsState; },
  nowSec: function () { return now; },
  clamp: function (v, a, b) { return Math.max(a, Math.min(b, v)); },
  normalizedSfxSources: function (primary, fallback) {
    return Array.isArray(primary) ? primary : (Array.isArray(fallback) ? fallback : []);
  },
  getDefaultRainLoopSources: function () { return []; },
  setSfxSources: function () {},
  playSfx: function () {},
  playLoopSfx: function () {},
  stopLoopSfx: function () {},
  setLoopSfxVolume: function () {},
  getRainCache: function () { return { maxDrops: 0, x: [], y: [], speed: [], len: [] }; },
  getViewSize: function () { return { w: 100, h: 100 }; },
  getCtx: function () { return null; },
});

function resetRuntime(nowSecValue) {
  now = Number.isFinite(nowSecValue) ? nowSecValue : 0;
  worldEventsState.attackStartAt = now + ATTACK_EVERY_SEC;
  worldEventsState.currentAttackStartAt = 0;
  worldEventsState.attackEndAt = 0;
  worldEventsState.forceAttackActive = false;
  worldEventsState.waveNumber = 0;
}

console.log('\n--- Section 1: runtime seams ---');

test('AWC-1: fresh restart schedules the full attackEverySec', function () {
  resetRuntime(0);
  const scheduled = controller.scheduleFirstAttackWaveAfterRestart();
  assertEqual(scheduled, ATTACK_EVERY_SEC, 'restart returns the full interval');
  assertEqual(worldEventsState.attackStartAt, ATTACK_EVERY_SEC, 'attackStartAt is now + interval');
  assertEqual(worldEventsState.currentAttackStartAt, 0, 'no phantom attack window');
  assertEqual(worldEventsState.attackEndAt, 0, 'no phantom attack end');
});

test('AWC-2: remaining countdown is the live distance to attackStartAt', function () {
  resetRuntime(0);
  controller.scheduleFirstAttackWaveAfterRestart();
  now = 110; // 10 seconds left
  assertClose(controller.getAttackWaveRemainingSec(), 10, 1e-6, 'countdown shrinks with time');
});

test('AWC-3: saved countdown is resumed instead of restarting the interval', function () {
  resetRuntime(500);
  // Simulate what restoreFullState does with `saved.attackWaveRemainingSec = 10`.
  const applied = controller.applyLoadedAttackWaveTiming(10);
  assertEqual(applied, true, 'load timing is applied for a plain save');
  assertEqual(worldEventsState.attackStartAt, 510, 'wave fires 10s after load, not 120s');
  assertClose(controller.getAttackWaveRemainingSec(), 10, 1e-6, 'countdown reflects the saved remainder');
});

test('AWC-4: phantom attack window from the previous session is cleared on load', function () {
  resetRuntime(500);
  // Previous page: the wave was already running when the save was written.
  worldEventsState.currentAttackStartAt = 400;
  worldEventsState.attackEndAt = 460;
  controller.applyLoadedAttackWaveTiming(10);
  assertEqual(worldEventsState.currentAttackStartAt, 0, 'stale attack window is cleared');
  assertEqual(worldEventsState.attackEndAt, 0, 'stale attack end is cleared');
});

test('AWC-5: legacy payload (no field) still gets a full interval', function () {
  resetRuntime(700);
  controller.applyLoadedAttackWaveTiming(null);
  assertEqual(worldEventsState.attackStartAt, 700 + ATTACK_EVERY_SEC, 'legacy saves keep the old full-interval behaviour');
  resetRuntime(700);
  controller.applyLoadedAttackWaveTiming(undefined);
  assertEqual(worldEventsState.attackStartAt, 700 + ATTACK_EVERY_SEC, 'undefined behaves like a legacy payload');
});

test('AWC-6: saved value is clamped to [0, attackEverySec]', function () {
  resetRuntime(0);
  controller.applyLoadedAttackWaveTiming(9999);
  assertEqual(worldEventsState.attackStartAt, ATTACK_EVERY_SEC, 'oversized remainder clamps to the interval');
  // A due wave (negative remainder) resumes as "starts right now", never as a
  // negative schedule. Non-zero clock: an absolute 0 means "unscheduled" in
  // updateWorldEvents(), so the clamp must land on `now`, not below it.
  resetRuntime(100);
  controller.applyLoadedAttackWaveTiming(-50);
  assertEqual(worldEventsState.attackStartAt, 100, 'negative remainder clamps to now');
  assertEqual(controller.getAttackWaveRemainingSec(), 0, 'countdown never reports a negative remainder');
});

test('AWC-7: countdown is null while a debug force-attack is active', function () {
  resetRuntime(0);
  controller.scheduleFirstAttackWaveAfterRestart();
  state.debug = { forceAttackMode: true };
  assertEqual(controller.getAttackWaveRemainingSec(), null, 'force-attack has no real schedule to persist');
  assertEqual(controller.applyLoadedAttackWaveTiming(10), false, 'load timing is skipped for force-attack');
  state.debug = {};
});

test('AWC-8: after a wave fires, the next countdown equals the full interval', function () {
  resetRuntime(0);
  controller.scheduleFirstAttackWaveAfterRestart();
  now = ATTACK_EVERY_SEC; // wave fires
  controller.updateWorldEvents(0.1);
  assertEqual(worldEventsState.waveNumber, 1, 'wave #1 fired');
  assertClose(controller.getAttackWaveRemainingSec(), ATTACK_EVERY_SEC, 1e-6, 'next wave is a full interval away');
});

/* ------------------------------------------------------------------ */
/*  Section 1b: active-wave snapshot (save DURING a wave)             */
/* ------------------------------------------------------------------ */

console.log('\n--- Section 1b: active-wave snapshot ---');

function startWaveAt(nowSecValue) {
  resetRuntime(nowSecValue);
  controller.scheduleFirstAttackWaveAfterRestart();
  now = nowSecValue + ATTACK_EVERY_SEC; // wave fires
  controller.updateWorldEvents(0.1);
}

test('AWC-18: snapshot marks an in-progress wave as active with its remainder', function () {
  startWaveAt(0);
  now = ATTACK_EVERY_SEC + 20; // 40s of the 60s wave left
  const snap = controller.getAttackWaveSnapshot();
  assert(!!snap, 'snapshot exists while a wave is running');
  assertEqual(snap.active, true, 'wave is reported as active');
  assertClose(snap.remainingActiveSec, 40, 1e-6, 'remaining wave time is captured');
  // The wave fired at t=120, so the NEXT wave is scheduled for t=240 -> 100s away.
  assertClose(snap.remainingSec, ATTACK_EVERY_SEC - 20, 1e-6, 'next-wave countdown is captured too');
});

test('AWC-19: snapshot marks a between-waves state as inactive', function () {
  resetRuntime(0);
  controller.scheduleFirstAttackWaveAfterRestart();
  now = 30;
  const snap = controller.getAttackWaveSnapshot();
  assertEqual(snap.active, false, 'no wave is running');
  assertClose(snap.remainingSec, ATTACK_EVERY_SEC - 30, 1e-6, 'countdown to the next wave is captured');
  assertEqual(snap.remainingActiveSec, 0, 'no active remainder when inactive');
});

test('AWC-20: loading an active snapshot RESUMES the wave instead of killing it', function () {
  // Save mid-wave: 40s of the wave left, next wave 120s away.
  startWaveAt(0);
  now = ATTACK_EVERY_SEC + 20;
  const saved = controller.getAttackWaveSnapshot();

  // New page: fresh runtime, then load the snapshot.
  resetRuntime(9000);
  const applied = controller.applyLoadedAttackWaveSnapshot(saved);
  assertEqual(applied, true, 'snapshot is applied');
  assertEqual(controller.isZombieAttackModeActive(), true, 'wave is ACTIVE right after load (the reported bug)');
  assertEqual(worldEventsState.currentAttackStartAt, 9000, 'episode start is re-anchored to load time');
  assertClose(worldEventsState.attackEndAt, 9040, 1e-6, 'wave keeps its saved remainder');
  assertClose(controller.getAttackWaveRemainingSec(), ATTACK_EVERY_SEC - 20, 1e-6, 'next wave keeps its saved countdown');
});

test('AWC-21: an active wave still ends on schedule after load', function () {
  startWaveAt(0);
  now = ATTACK_EVERY_SEC + 20;
  const saved = controller.getAttackWaveSnapshot();
  resetRuntime(9000);
  controller.applyLoadedAttackWaveSnapshot(saved);
  now = 9041; // past the restored attackEndAt
  controller.updateWorldEvents(0.1);
  assertEqual(controller.isZombieAttackModeActive(), false, 'wave ends when its restored remainder elapses');
});

test('AWC-22: inactive snapshot keeps the wave off and resumes the countdown', function () {
  resetRuntime(0);
  controller.scheduleFirstAttackWaveAfterRestart();
  now = 30;
  const saved = controller.getAttackWaveSnapshot();
  resetRuntime(9000);
  controller.applyLoadedAttackWaveSnapshot(saved);
  assertEqual(controller.isZombieAttackModeActive(), false, 'no wave is running after load');
  assertClose(controller.getAttackWaveRemainingSec(), ATTACK_EVERY_SEC - 30, 1e-6, 'countdown resumes, not restarts');
});

test('AWC-23: active remainder is clamped to attackDurationSec', function () {
  resetRuntime(9000);
  controller.applyLoadedAttackWaveSnapshot({ remainingSec: 10, active: true, remainingActiveSec: 99999 });
  assertClose(worldEventsState.attackEndAt - 9000, ATTACK_DURATION_SEC, 1e-6, 'oversized active remainder clamps to the wave duration');
});

test('AWC-24: snapshot is null while a debug force-attack is active', function () {
  resetRuntime(0);
  controller.scheduleFirstAttackWaveAfterRestart();
  state.debug = { forceAttackMode: true };
  assertEqual(controller.getAttackWaveSnapshot(), null, 'force-attack has no real schedule to persist');
  assertEqual(controller.applyLoadedAttackWaveSnapshot({ remainingSec: 10, active: true }), false, 'load is skipped for force-attack');
  state.debug = {};
});

/* ------------------------------------------------------------------ */
/*  Static wiring guards                                              */
/* ------------------------------------------------------------------ */

console.log('\n--- Section 2: payload + wiring contract ---');

test('AWC-9: storage.js persists the schedule snapshot via the live runtime seam', function () {
  assert(storageJs.indexOf('function serializeAttackWaveSnapshot(state)') !== -1, 'writer helper exists');
  assert(storageJs.indexOf('global.Game.getAttackWaveSnapshot') !== -1, 'writer reads the live runtime seam');
  assert(storageJs.indexOf('state.attackWaveRemainingSec') !== -1, 'writer keeps a state fallback');
  assert(storageJs.indexOf('attackWaveRemainingSec: attackWaveSnapshot ? attackWaveSnapshot.remainingSec : null') !== -1, 'payload carries the countdown');
  assert(storageJs.indexOf('attackWaveActive: attackWaveSnapshot ? attackWaveSnapshot.active : false') !== -1, 'payload carries the active flag');
  assert(storageJs.indexOf('attackWaveRemainingActiveSec: attackWaveSnapshot ? attackWaveSnapshot.remainingActiveSec : 0') !== -1, 'payload carries the active remainder');
});

test('AWC-10: game.js exposes the read seams and the restart scheduler', function () {
  assert(gameJs.indexOf('function getAttackWaveRemainingSec()') !== -1, 'countdown read seam exists');
  assert(gameJs.indexOf('function getAttackWaveSnapshot()') !== -1, 'snapshot read seam exists');
  assert(gameJs.indexOf('GameApi.getAttackWaveRemainingSec = getAttackWaveRemainingSec;') !== -1, 'countdown seam is exposed on Game');
  assert(gameJs.indexOf('GameApi.getAttackWaveSnapshot = getAttackWaveSnapshot;') !== -1, 'snapshot seam is exposed on Game');
  assert(gameJs.indexOf('function applyLoadedAttackWaveSnapshot(snapshot)') !== -1, 'load-apply helper exists');
  assert(gameJs.indexOf('function scheduleFirstAttackWaveAfterRestart()') !== -1, 'restart scheduler exists');
});

test('AWC-11: New Game / partial restart go through the restart scheduler', function () {
  const fnStart = gameJs.indexOf('function resetWorldEventsRuntimeForNewGame(){');
  assert(fnStart >= 0, 'resetWorldEventsRuntimeForNewGame must exist');
  const fnEnd = gameJs.indexOf('\nfunction ', fnStart + 10);
  const body = gameJs.slice(fnStart, fnEnd > fnStart ? fnEnd : undefined);
  assert(
    body.indexOf('controller.scheduleFirstAttackWaveAfterRestart()') !== -1,
    'restart path delegates to the canonical scheduler'
  );
});

test('AWC-12: restoreFullState consumes the snapshot and honours the critical-save override', function () {
  const start = gameJs.indexOf('function restoreFullState(saved){');
  assert(start >= 0, 'restoreFullState must exist');
  const end = gameJs.indexOf('function inflateBuyPrice(', start);
  assert(end > start, 'restoreFullState body must be delimited');
  const body = gameJs.slice(start, end);
  const forceIdx = body.indexOf('if (forceFenceRuntimeResetOnLoad) {');
  assert(forceIdx >= 0, 'critical-save branch is present');
  const schedulerIdx = body.indexOf('scheduleFirstAttackWaveAfterRestart();', forceIdx);
  const snapshotIdx = body.indexOf('applyLoadedAttackWaveSnapshot({', forceIdx);
  assert(schedulerIdx > forceIdx, 'critical saves re-arm the full interval');
  assert(snapshotIdx > schedulerIdx, 'plain saves resume the saved schedule');
  assert(body.indexOf('active: saved.attackWaveActive === true,', snapshotIdx) !== -1, 'plain saves restore the active-wave flag');
  assert(body.indexOf('remainingActiveSec: saved.attackWaveRemainingActiveSec,', snapshotIdx) !== -1, 'plain saves restore the active remainder');
});

test('AWC-12b: a restored active wave re-begins its achievement episode', function () {
  const start = gameJs.indexOf('function restoreFullState(saved){');
  const end = gameJs.indexOf('function inflateBuyPrice(', start);
  const body = gameJs.slice(start, end);
  const snapshotIdx = body.indexOf('applyLoadedAttackWaveSnapshot({');
  const gateIdx = body.indexOf('isZombieAttackModeActive()', snapshotIdx);
  const beginIdx = body.indexOf('beginNoRepairAttackWaveEpisode();', snapshotIdx);
  assert(gateIdx > snapshotIdx, 'episode begin is gated on the restored active state');
  assert(beginIdx > gateIdx, 'restored active wave begins its episode');
  assert(body.indexOf('beginDefenseOrderEpisode();', beginIdx) !== -1, 'defense-order episode is begun too');
});

test('AWC-13: legacy-progress restore path also resumes the schedule', function () {
  const start = gameJs.indexOf('function applySavedProgress(data){');
  assert(start >= 0, 'applySavedProgress must exist');
  const end = gameJs.indexOf('const PROJECTILE_KINDS', start);
  assert(end > start, 'applySavedProgress body must be delimited');
  const body = gameJs.slice(start, end);
  assert(body.indexOf('applyLoadedAttackWaveSnapshot({') !== -1, 'legacy path applies the saved schedule');
  assert(body.indexOf('active: data.attackWaveActive === true,') !== -1, 'legacy path restores the active-wave flag');
});

test('AWC-14: all three schedule fields are known payload keys', function () {
  const start = gameJs.indexOf('const __KNOWN_PAYLOAD_KEYS = [');
  assert(start >= 0, 'known-keys list exists');
  const end = gameJs.indexOf('];', start);
  const list = gameJs.slice(start, end);
  assert(list.indexOf("'attackWaveRemainingSec'") !== -1, 'countdown is registered');
  assert(list.indexOf("'attackWaveActive'") !== -1, 'active flag is registered');
  assert(list.indexOf("'attackWaveRemainingActiveSec'") !== -1, 'active remainder is registered');
});

test('AWC-15: schema + typedef document all three fields', function () {
  const props = saveSchema.properties || {};
  assert(!!props.attackWaveRemainingSec, 'saveSchema declares attackWaveRemainingSec');
  assert(props.attackWaveRemainingSec.type.indexOf('number') !== -1 && props.attackWaveRemainingSec.type.indexOf('null') !== -1, 'countdown allows number|null');
  assert(props.attackWaveRemainingSec.minimum === 0, 'countdown floor is 0');
  assert(!!props.attackWaveActive && props.attackWaveActive.type === 'boolean', 'saveSchema declares the boolean active flag');
  assert(!!props.attackWaveRemainingActiveSec && props.attackWaveRemainingActiveSec.minimum === 0, 'saveSchema declares the active remainder');
  assert(typesJs.indexOf('attackWaveActive') !== -1, 'canonical typedef documents the active flag');
  assert(typesJs.indexOf('attackWaveRemainingActiveSec') !== -1, 'canonical typedef documents the active remainder');
});

test('AWC-16: runtime seam functions are exported by the controller', function () {
  assert(runtimeJs.indexOf('getAttackWaveRemainingSec: getAttackWaveRemainingSec,') !== -1, 'countdown reader is exported');
  assert(runtimeJs.indexOf('getAttackWaveSnapshot: getAttackWaveSnapshot,') !== -1, 'snapshot reader is exported');
  assert(runtimeJs.indexOf('applyLoadedAttackWaveTiming: applyLoadedAttackWaveTiming,') !== -1, 'countdown-only apply is exported');
  assert(runtimeJs.indexOf('applyLoadedAttackWaveSnapshot: applyLoadedAttackWaveSnapshot,') !== -1, 'snapshot apply is exported');
  assert(runtimeJs.indexOf('scheduleFirstAttackWaveAfterRestart: scheduleFirstAttackWaveAfterRestart,') !== -1, 'restart scheduler is exported');
});

test('AWC-17: entry token is shared by the touched entry assets', function () {
  const m = indexHtml.match(/var token = '([^']+)'/);
  assert(m, 'entry token present');
  const entry = m[1];
  assert(indexHtml.indexOf('src/persistence/storage.js?v=' + entry) !== -1, 'storage.js carries the entry token');
  assert(indexHtml.indexOf('src/persistence/serializedStateTypes.js?v=' + entry) !== -1, 'serializedStateTypes.js carries the entry token');
  assert(indexHtml.indexOf('src/systems/worldEventsRuntime.js?v=' + entry) !== -1, 'worldEventsRuntime.js carries the entry token');
});

/* ------------------------------------------------------------------ */

console.log('\n==============================');
console.log('AttackWaveCountdownPersistence: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(function (failure) {
    console.log('  - ' + failure.name + ': ' + failure.error);
  });
}
console.log('==============================\n');
process.exit(failCount > 0 ? 1 : 0);
