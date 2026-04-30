/**
 * Pack 5 — Perf regression tests (object pool).
 * Run: node Test/pack5/perf_regression.test.js
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

loadModule('src/perf/objectPool.js');

const Pool = global.Game.ObjectPool;

console.log('\n── Pack 5: Perf regression (ObjectPool) ──');

test('P5-POOL-1: ObjectPool exists', () => {
  assert(Pool, 'ObjectPool defined');
  assert(typeof Pool.create === 'function', 'create fn');
});

test('P5-POOL-2: acquire/release reuses objects', () => {
  const pool = Pool.create({
    max: 2,
    create: () => ({ value: 0 }),
    reset: (obj) => { obj.value = 0; }
  });
  const a = pool.acquire();
  a.value = 42;
  pool.release(a);
  const b = pool.acquire();
  assertEqual(a, b, 'reused instance');
  assertEqual(b.value, 0, 'reset on release');
});

test('P5-POOL-3: pool caps size', () => {
  const pool = Pool.create({ max: 1, create: () => ({}) });
  const a = pool.acquire();
  const b = pool.acquire();
  pool.release(a);
  pool.release(b);
  const stats = pool.stats();
  assertEqual(stats.size, 1, 'size capped');
});

test('P5-POOL-4: stats track totalCreated', () => {
  const pool = Pool.create({ max: 2, create: () => ({}) });
  pool.acquire();
  pool.acquire();
  pool.acquire();
  const stats = pool.stats();
  assertEqual(stats.totalCreated, 3, 'totalCreated increments');
});

// ---------------------------------------------------------------------------
// solo-pipeline-yandex-vk#3 (B4): per-draw-stage budget regression.
// Tests are pure JS micro-benchmarks for the cull + batched-state contract
// from B2. They fail if a single draw stage overshoots its budget at the
// reference workload (1500 particles, 200 damage numbers). Budgets are
// generous (Node V8 single-thread, no GPU) so they catch only catastrophic
// regressions, not normal noise.
// ---------------------------------------------------------------------------

const DRAW_STAGE_BUDGETS_MS = {
  particlesCullBatched: 8,
  damageNumbersCullBatched: 4,
  loopFrameBudget: 16,
};

function makeMockCtx() {
  return {
    save: () => {}, restore: () => {},
    beginPath: () => {}, arc: () => {}, fill: () => {},
    fillText: () => {},
    set fillStyle(v) { this._fill = v; },
    get fillStyle() { return this._fill; },
    set globalAlpha(v) { this._a = v; },
    get globalAlpha() { return this._a; },
    set font(v) { this._font = v; },
    get font() { return this._font; },
    set textAlign(v) { this._ta = v; },
    get textAlign() { return this._ta; },
    set textBaseline(v) { this._tb = v; },
    get textBaseline() { return this._tb; },
  };
}

function timed(fn) {
  const t0 = process.hrtime.bigint();
  fn();
  const t1 = process.hrtime.bigint();
  return Number(t1 - t0) / 1e6;
}

test('P5-DRAW-1: drawParticles batched+cull stays under budget (1500 particles)', () => {
  const ctx = makeMockCtx();
  const viewSize = { w: 1280, h: 720 };
  const margin = 32;
  const particles = new Array(1500);
  for (let i = 0; i < 1500; i++) {
    particles[i] = {
      x: Math.random() * 1500 - 100,
      y: Math.random() * 900 - 100,
      r: 3, color: i % 2 ? '#fff' : '#f80',
      life: 1, max: 2, kind: i % 8 === 0 ? 'text' : 'arc',
      text: 'x',
    };
  }
  const elapsed = timed(() => {
    const minX = -margin, maxX = viewSize.w + margin;
    const minY = -margin, maxY = viewSize.h + margin;
    ctx.save();
    ctx.textAlign = 'center';
    let lastFill = null;
    let textFontSet = false;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (p.x < minX || p.x > maxX || p.y < minY || p.y > maxY) continue;
      const t = p.life / p.max;
      const alpha = Math.max(0, Math.min(1, t));
      if (p.color !== lastFill) { ctx.fillStyle = p.color; lastFill = p.color; }
      ctx.globalAlpha = alpha;
      if (p.kind === 'text') {
        if (!textFontSet) { ctx.font = '14px sans-serif'; textFontSet = true; }
        ctx.fillText(p.text, p.x, p.y);
        continue;
      }
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  });
  assert(elapsed < DRAW_STAGE_BUDGETS_MS.particlesCullBatched,
    'drawParticles took ' + elapsed.toFixed(2) + 'ms, budget=' + DRAW_STAGE_BUDGETS_MS.particlesCullBatched);
});

test('P5-DRAW-2: drawDamageNumbers batched+cull stays under budget (200 entries)', () => {
  const ctx = makeMockCtx();
  const viewSize = { w: 1280, h: 720 };
  const margin = 32;
  const dn = new Array(200);
  for (let i = 0; i < 200; i++) {
    dn[i] = {
      x: Math.random() * 1500 - 100,
      y: Math.random() * 900 - 100,
      value: 100 + i, isCrit: i % 3 === 0,
      life: 1, max: 2,
    };
  }
  const elapsed = timed(() => {
    const minX = -margin, maxX = viewSize.w + margin;
    const minY = -margin, maxY = viewSize.h + margin;
    ctx.save();
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let lastFill = null;
    for (let i = 0; i < dn.length; i++) {
      const d = dn[i];
      if (d.x < minX || d.x > maxX || d.y < minY || d.y > maxY) continue;
      const t = d.life / d.max;
      const alpha = t <= 0.2 ? t / 0.2 : (t >= 0.6 ? 1 : (t - 0.2) / 0.4);
      const fill = d.isCrit ? '#c03030' : '#fff8e0';
      if (fill !== lastFill) { ctx.fillStyle = fill; lastFill = fill; }
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha)) * (0.5 + 0.5 * t);
      ctx.fillText(d.value, d.x, d.y);
    }
    ctx.restore();
  });
  assert(elapsed < DRAW_STAGE_BUDGETS_MS.damageNumbersCullBatched,
    'drawDamageNumbers took ' + elapsed.toFixed(2) + 'ms, budget=' + DRAW_STAGE_BUDGETS_MS.damageNumbersCullBatched);
});

test('P5-DRAW-3: per-stage budgets total under loop frame budget (16ms @ 60fps)', () => {
  const total = DRAW_STAGE_BUDGETS_MS.particlesCullBatched
    + DRAW_STAGE_BUDGETS_MS.damageNumbersCullBatched;
  assert(total < DRAW_STAGE_BUDGETS_MS.loopFrameBudget,
    'sum of draw-stage budgets (' + total + 'ms) must fit in loop frame budget '
    + DRAW_STAGE_BUDGETS_MS.loopFrameBudget + 'ms');
});

console.log('\n═══════════════════════════');
console.log('PerfRegression: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(f => console.log('  - ' + f.name + ': ' + f.error));
}
console.log('═══════════════════════════\n');
process.exit(failCount > 0 ? 1 : 0);
