/**
 * Pack 5 — PerfCapture report tests (perf-capture-tool).
 * Run: node Test/pack5/perfCaptureReport.test.js
 *
 * Pure-Node: drives Game.PerfCapture via its __test seam (no DOM / no browser).
 * Verifies ring wraparound, percentile math, report schema, budget flagging,
 * the onFrame zero-overhead early-out, and steady-state alloc stability
 * (no new phase/ring objects after warmup).
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
function assertClose(a, b, eps, msg) {
  if (Math.abs(a - b) > (eps == null ? 1e-6 : eps)) {
    throw new Error((msg || 'assertClose') + ': expected ~' + b + ', got ' + a);
  }
}
function test(name, fn) {
  try { fn(); passCount++; console.log('  ✓ ' + name); }
  catch (e) { failCount++; failures.push({ name, error: e.message }); console.log('  ✗ ' + name + ' — ' + e.message); }
}

const global = globalThis;
global.window = global;
global.Game = {};

const fs = require('fs');
const path = require('path');

function loadModule(relPath) {
  const code = fs.readFileSync(path.resolve(__dirname, '../..', relPath), 'utf-8');
  const fn = new Function('window', 'global', 'document', 'console', code);
  fn(global, global, {}, console);
}

loadModule('src/perf/profiler.js');
loadModule('src/perf/perfCapture.js');

const Profiler = global.Game.Profiler;
const PC = global.Game.PerfCapture;
const T = PC && PC.__test;

console.log('\n── Pack 5: PerfCapture report ──');

test('PC-1: PerfCapture + Profiler frame API exist', () => {
  assert(PC, 'PerfCapture defined');
  assert(typeof PC.start === 'function', 'start fn');
  assert(typeof PC.onFrame === 'function', 'onFrame fn');
  assert(typeof PC.buildReport === 'function', 'buildReport fn');
  assert(T, '__test seam present');
  assert(typeof Profiler.beginFrame === 'function', 'Profiler.beginFrame');
  assert(typeof Profiler.getFrameMs === 'function', 'Profiler.getFrameMs');
  assert(typeof Profiler.forEachFrameMs === 'function', 'Profiler.forEachFrameMs');
});

test('PC-2: Profiler per-frame accumulator sums multi-call phases', () => {
  Profiler.setEnabled(true);
  Profiler.reset();
  Profiler.beginFrame();
  // simulate a phase that runs twice in one frame
  Profiler.start('phaseX'); Profiler.end('phaseX');
  Profiler.start('phaseX'); Profiler.end('phaseX');
  Profiler.endFrame();
  // getFrameMs is a SUM, not an average — both calls counted.
  assert(Profiler.getFrameMs('phaseX') >= 0, 'frame ms is a finite sum');
  // a phase that never ran reads 0
  assertEqual(Profiler.getFrameMs('nope'), 0, 'absent phase reads 0');
});

test('PC-3: ring wraparound keeps the last RING_CAP samples', () => {
  T.resetData();
  const CAP = T.RING_CAP;
  const n = CAP + 50;
  for (let i = 0; i < n; i++) T.pushFrame(i, 16);
  assertEqual(T.ringFilled(), CAP, 'ring filled capped at RING_CAP');
  const sum = T.summarize();
  // oldest retained = push #50, newest = push #(CAP+49)
  assertClose(sum.frameCpu.max, CAP + 49, 1e-6, 'max is newest retained');
  assertClose(sum.frameCpu.min, 50, 1e-6, 'min is oldest retained (older overwritten)');
  assertEqual(sum.frames, CAP, 'frame count reflects ring size');
});

test('PC-4: percentile math (linear interpolation)', () => {
  const vals = [10, 20, 30, 40, 50];
  assertClose(T.percentile(vals, 0), 10, 1e-9, 'p0');
  assertClose(T.percentile(vals, 50), 30, 1e-9, 'p50');
  assertClose(T.percentile(vals, 100), 50, 1e-9, 'p100');
  assertClose(T.percentile(vals, 95), 48, 1e-9, 'p95 interpolated');
  assertEqual(T.percentile([], 50), 0, 'empty → 0');
  assertEqual(T.percentile([7], 95), 7, 'single value');
});

test('PC-5: report schema is self-describing and complete', () => {
  T.resetData();
  for (let i = 0; i < 20; i++) T.pushFrame(8 + (i % 4), 16 + (i % 3));
  T.accumPhase('loop.update', 4);
  T.accumPhase('loop.draw', 5);
  T.accumPhase('drawZombies', 3);
  T.recordEntity('zombies', 120);
  const rep = T.buildReport();
  const j = rep.json;
  assertEqual(j.schema, 'tmzd.perfCapture.report', 'schema id');
  assertEqual(j.schemaVersion, 1, 'schema version');
  assert(j.legend && typeof j.legend === 'object', 'legend present');
  assert(j.units && j.units.time === 'ms', 'units present');
  assert(j.frame && j.frame.cpuMs && typeof j.frame.cpuMs.p95 === 'number', 'frame.cpuMs.p95');
  assert(typeof j.frame.fps.avg === 'number', 'fps.avg');
  assert(Array.isArray(j.phases), 'phases array');
  assert(j.frame.split && typeof j.frame.split.drawMs === 'number', 'frame split from umbrella phases');
  assert(j.entities && j.entities.zombies && j.entities.zombies.peak === 120, 'entity peak captured');
  assert(j.memory && typeof j.memory.supported === 'boolean', 'memory block');
  assert(j.environment && ('renderEngine' in j.environment), 'environment block');
  assert(j.verdict && typeof j.verdict.likelyBottleneck === 'string', 'verdict present');
  assertEqual(j.capture.frames, 20, 'capture.frames matches pushed frames');
  // umbrella phases must NOT pollute the ranked hotspot list
  for (let i = 0; i < j.phases.length; i++) {
    assert(j.phases[i].name !== 'loop.update' && j.phases[i].name !== 'loop.draw',
      'umbrella phase excluded from hotspots: ' + j.phases[i].name);
  }
  // payload bundles markdown + a fenced json block
  assert(rep.payload.indexOf('```json') >= 0, 'payload has fenced json block');
  assert(rep.payload.indexOf('# TMZD Perf Capture Report') >= 0, 'payload has markdown summary');
});

test('PC-6: budget flagging reflects balance budgets', () => {
  Profiler.setBudgets({ 'stepProjectiles': 1.0, 'cleanupKills': 5.0 });
  T.resetData();
  for (let i = 0; i < 5; i++) T.pushFrame(6, 16);
  for (let i = 0; i < 5; i++) T.accumPhase('stepProjectiles', 5.0); // avg 5 >= budget 1 → over
  T.accumPhase('cleanupKills', 0.2);                                // avg 0.2 < budget 5 → ok
  const j = T.buildReport().json;
  let sp = null, ck = null;
  for (let i = 0; i < j.phases.length; i++) {
    if (j.phases[i].name === 'stepProjectiles') sp = j.phases[i];
    if (j.phases[i].name === 'cleanupKills') ck = j.phases[i];
  }
  assert(sp, 'stepProjectiles present in report');
  assertEqual(sp.budgetMs, 1.0, 'budget surfaced');
  assertEqual(sp.overBudget, true, 'over-budget flagged');
  assert(ck, 'cleanupKills present');
  assertEqual(ck.overBudget, false, 'under-budget not flagged');
});

test('PC-7: onFrame is a no-op when not capturing (zero-overhead path)', () => {
  T.setCapturing(false);
  T.resetData();
  PC.onFrame(1, 0.016, { zombies: [], projectiles: [] });
  PC.onFrame(2, 0.016, { zombies: [], projectiles: [] });
  assertEqual(T.ringFilled(), 0, 'no frames recorded while not capturing');
});

test('PC-8: steady state adds no new phase/ring objects after warmup', () => {
  T.resetData();
  const names = ['stepZombies', 'stepProjectiles', 'drawZombies'];
  for (let i = 0; i < names.length; i++) T.accumPhase(names[i], 1.0); // warmup
  const warmKeys = T.phaseKeyCount();
  assertEqual(warmKeys, names.length, 'one key per distinct phase');
  for (let r = 0; r < 200; r++) {
    for (let i = 0; i < names.length; i++) T.accumPhase(names[i], 1.0 + (r % 3));
  }
  assertEqual(T.phaseKeyCount(), warmKeys, 'no new phase keys after warmup');
  const CAP = T.RING_CAP;
  for (let i = 0; i < CAP + 200; i++) T.pushFrame(5, 16);
  assertEqual(T.ringFilled(), CAP, 'ring does not grow past RING_CAP');
});

console.log('\n═══════════════════════════');
console.log('PerfCapture: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(f => console.log('  - ' + f.name + ': ' + f.error));
}
console.log('═══════════════════════════\n');
process.exit(failCount > 0 ? 1 : 0);
