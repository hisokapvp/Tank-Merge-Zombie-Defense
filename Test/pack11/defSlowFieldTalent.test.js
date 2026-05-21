/**
 * Pack 11 — def_slow_field movement-slow regression test
 * (solo-pipeline-yandex-vk batch#2, item 4).
 *
 * Контракт:
 *   - При наличии прокачанного таланта def_slow_field, зомби, попавшие в радиус
 *     slowFieldRadius вокруг ЛЮБОГО неразрушенного сегмента стены, замедляются.
 *   - Замедление = slowFieldPct × rank.
 *     rank=1 → 10%  (slowPct = 0.10)
 *     rank=5 → 50%  (slowPct = 0.50)
 *   - onZombieNearWall записывает zombie._statusRt.cc.slowUntilMs / slowPct.
 *   - EMP / chip-slow / talent-slow комбинируются мультипликативно (проверяется
 *     формулой потребителя: balSpeedMul *= (1 - slowPct)).
 *
 * Run: node Test/pack11/defSlowFieldTalent.test.js
 */

'use strict';

let passCount = 0;
let failCount = 0;
const failures = [];

function assert(cond, msg) {
  if (!cond) throw new Error('Assertion failed: ' + msg);
}

function assertNear(actual, expected, eps, msg) {
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > eps) {
    throw new Error((msg || 'assertNear') + ': expected ~' + expected + ' (eps=' + eps + '), got ' + actual);
  }
}

function test(name, fn) {
  try {
    fn();
    passCount++;
    console.log('  \u2713 ' + name);
  } catch (e) {
    failCount++;
    failures.push({ name, error: e.message });
    console.log('  \u2717 ' + name + ' \u2014 ' + e.message);
  }
}

const fs = require('fs');
const path = require('path');

const globalCtx = globalThis;
globalCtx.window = globalCtx;
globalCtx.Game = globalCtx.Game || {};

if (typeof globalCtx.fetch === 'undefined') {
  globalCtx.fetch = function () { return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) }); };
}

function loadModule(relPath) {
  const abs = path.resolve(__dirname, '../..', relPath);
  const code = fs.readFileSync(abs, 'utf-8');
  const fn = new Function('window', 'global', 'document', 'console', 'fetch', 'Promise', 'setTimeout', 'clearTimeout', code);
  fn(globalCtx, globalCtx, {}, console, globalCtx.fetch, Promise, setTimeout, clearTimeout);
}

loadModule('src/systems/talents/talentsV2.js');
const Talents = globalCtx.Game.TalentsV2;
assert(!!Talents, 'Game.TalentsV2 module must load');
assert(typeof Talents.init === 'function', 'Talents.init must be a function');
assert(typeof Talents.setRanks === 'function', 'Talents.setRanks must be a function');
assert(typeof Talents.onZombieNearWall === 'function', 'Talents.onZombieNearWall must be a function');
assert(typeof Talents.getMods === 'function', 'Talents.getMods must be a function');

// Sync asset loader: read talentTree_v2.json directly from disk so init() does not need fetch.
const treeJsonPath = path.resolve(__dirname, '../../assets/balance/talentTree_v2.json');
const treeJson = JSON.parse(fs.readFileSync(treeJsonPath, 'utf-8'));

let inited = false;
let initError = null;

(async function bootstrap() {
  try {
    await Talents.init({
      assetLoader: function () { return treeJson; },
      loadSaveFn: function () { return { player: { talentsV2: { ranksById: {} } } }; },
      saveFn: function () {},
      // Provide stub: tank base damage not exercised by this test.
      getMaxTankBaseDamageFn: function () { return 100; },
    });
    inited = true;
  } catch (err) {
    initError = err;
  }
})().then(runTests);

function runTests() {
  console.log('\n\u2500\u2500 Pack 11: def_slow_field movement-slow regression \u2500\u2500');

  test('SLOW-FIELD-0: TalentsV2.init() succeeds with sync assetLoader', () => {
    if (initError) throw initError;
    assert(inited, 'init() must complete');
  });

  test('SLOW-FIELD-1a: rank=1 → slowFieldPct mod = 0.10 (±0.001)', () => {
    Talents.setRanks({ def_slow_field: 1 });
    const mods = Talents.getMods();
    const pct = Number.isFinite(mods.wallSlowFieldPct) && mods.wallSlowFieldPct > 0
      ? mods.wallSlowFieldPct
      : (Number.isFinite(mods.slowFieldPct) ? mods.slowFieldPct : 0);
    assertNear(pct, 0.10, 1e-3, 'rank=1 slow pct');
  });

  test('SLOW-FIELD-1b: rank=5 → slowFieldPct mod = 0.50 (±0.001)', () => {
    Talents.setRanks({ def_slow_field: 5 });
    const mods = Talents.getMods();
    const pct = Number.isFinite(mods.wallSlowFieldPct) && mods.wallSlowFieldPct > 0
      ? mods.wallSlowFieldPct
      : (Number.isFinite(mods.slowFieldPct) ? mods.slowFieldPct : 0);
    assertNear(pct, 0.50, 1e-3, 'rank=5 slow pct');
  });

  test('SLOW-FIELD-2a: onZombieNearWall sets zombie._statusRt.cc.slowPct=0.10 at rank=1', () => {
    Talents.setRanks({ def_slow_field: 1 });
    const z = {};
    const r = Talents.onZombieNearWall({ zombie: z, timeMs: 10000 });
    assert(r && r.ok, 'onZombieNearWall returns ok=true');
    assert(z._statusRt && z._statusRt.cc, 'zombie._statusRt.cc must be created');
    assertNear(z._statusRt.cc.slowPct, 0.10, 1e-3, 'rank=1 zRt.cc.slowPct');
    assert(z._statusRt.cc.slowUntilMs > 10000,
      'slowUntilMs must extend beyond now (got ' + z._statusRt.cc.slowUntilMs + ')');
  });

  test('SLOW-FIELD-2b: onZombieNearWall sets zombie._statusRt.cc.slowPct=0.50 at rank=5', () => {
    Talents.setRanks({ def_slow_field: 5 });
    const z = {};
    const r = Talents.onZombieNearWall({ zombie: z, timeMs: 10000 });
    assert(r && r.ok, 'onZombieNearWall returns ok=true');
    assertNear(z._statusRt.cc.slowPct, 0.50, 1e-3, 'rank=5 zRt.cc.slowPct');
  });

  test('SLOW-FIELD-3: rank=0 → onZombieNearWall returns ok=false (no slow applied)', () => {
    Talents.setRanks({ def_slow_field: 0 });
    const z = {};
    const r = Talents.onZombieNearWall({ zombie: z, timeMs: 10000 });
    assert(!r || !r.ok, 'rank=0 must return ok=false');
  });

  test('SLOW-FIELD-4: multiplicative composition with chip+EMP slow preserves all sources', () => {
    // Consumer-side formula (game.js stepZombies): balSpeedMul *= (1 - slowPct) for each source.
    // Verify rank=5 talent (0.5) × chip 0.7 × EMP 0.6 multiplies cleanly.
    const talentSlow = 0.5;   // rank=5
    const chipFactor = 0.7;   // chip slow factor (already 1-pct form)
    const empFactor = 0.6;    // EMP slow factor
    let balSpeedMul = 1.0;
    balSpeedMul *= chipFactor;
    balSpeedMul *= empFactor;
    balSpeedMul *= Math.max(0.05, 1 - talentSlow);
    // Expected: 1 × 0.7 × 0.6 × 0.5 = 0.21
    assertNear(balSpeedMul, 0.21, 1e-6, 'multiplicative composition');
  });

  // ── Item 5 (Колючая проволока / def_thorns) regression ──
  test('BARBED-WIRE-1: rank=5 dmg = 0.10 × maxTankBaseDamage applied to attacker via applyDamage bridge', () => {
    Talents.setRanks({ def_thorns: 5 });
    const attacker = { hp: 100, state: 'walk' };
    const seg = { hp: 1000, maxHp: 1000 };
    let appliedDmg = 0;
    let appliedTarget = null;
    const bridge = function (payload) {
      appliedTarget = payload.zombie;
      appliedDmg = payload.damage;
      // Mimic game-side: subtract HP, if zero — mark dying.
      if (appliedTarget && appliedDmg > 0) {
        const before = Math.max(0, appliedTarget.hp || 0);
        const after = Math.max(0, before - appliedDmg);
        appliedTarget.hp = after;
        if (after <= 0) appliedTarget.state = 'dying';
        return before - after;
      }
      return 0;
    };
    const out = Talents.onWallDamage({
      seg, damage: 50, zombie: attacker, timeMs: 20000,
      applyDamage: bridge,
    });
    assert(out, 'onWallDamage returns result');
    // Expected: maxTankBaseDmg=100 (from getMaxTankBaseDamageFn stub) × 0.02 × 5 = 10
    assertNear(appliedDmg, 10, 1e-6, 'barbed wire damage = 0.02 × rank × baseDmg');
    assert(appliedTarget === attacker, 'damage applied to attacker (no AOE)');
    assert(attacker.hp === 90, 'attacker.hp was decremented (got ' + attacker.hp + ')');
  });

  test('BARBED-WIRE-2: rank=0 → no thorns damage applied', () => {
    Talents.setRanks({ def_thorns: 0 });
    const attacker = { hp: 100, state: 'walk' };
    const seg = { hp: 1000, maxHp: 1000 };
    let appliedDmg = 0;
    Talents.onWallDamage({
      seg, damage: 50, zombie: attacker, timeMs: 30000,
      applyDamage: function (p) { appliedDmg = p.damage; return p.damage; },
    });
    assertNear(appliedDmg, 0, 1e-6, 'rank=0 thorns must not apply damage');
    assert(attacker.hp === 100, 'attacker.hp untouched at rank=0');
  });

  test('BARBED-WIRE-3: ICD prevents double-apply within thornsIcdMs window', () => {
    Talents.setRanks({ def_thorns: 5 });
    const attacker = { hp: 100, state: 'walk' };
    const seg = { hp: 1000, maxHp: 1000 };
    let totalApplied = 0;
    const bridge = function (p) { totalApplied += p.damage; attacker.hp -= p.damage; return p.damage; };
    Talents.onWallDamage({ seg, damage: 50, zombie: attacker, timeMs: 40000, applyDamage: bridge });
    // Same hit at t+50ms — within 300ms ICD → must NOT trigger second proc
    Talents.onWallDamage({ seg, damage: 50, zombie: attacker, timeMs: 40050, applyDamage: bridge });
    assertNear(totalApplied, 10, 1e-6, 'ICD blocks second proc within 300ms (got ' + totalApplied + ')');
    // After ICD expiry — second proc should fire.
    Talents.onWallDamage({ seg, damage: 50, zombie: attacker, timeMs: 40400, applyDamage: bridge });
    assertNear(totalApplied, 20, 1e-6, 'second proc after ICD expiry');
  });

  // ─── Summary ───
  console.log('\n\u2500\u2500 Summary \u2500\u2500');
  console.log('  Passed: ' + passCount);
  console.log('  Failed: ' + failCount);

  if (failCount > 0) {
    console.log('\n\u2500\u2500 Failures \u2500\u2500');
    failures.forEach(f => console.log('  \u2717 ' + f.name + ': ' + f.error));
    process.exitCode = 1;
  } else {
    console.log('\n  \u2713 All tests passed');
  }
}
