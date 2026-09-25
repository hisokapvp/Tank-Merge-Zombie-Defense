/**
 * Pack 24 — crate (подарочный бокс) timer: persist + resume from save.
 *
 * Баг (задача пользователя): «в какой-то момент перестают прилетать подарочные
 * боксы с танками». Причина — clock-domain mismatch:
 *
 *   - `state.nextCrateAt` — абсолютный timestamp в домене `nowSec()`
 *     (`performance.now()/1000` минус pause-offset). Этот домен перезапускается
 *     с ~0 на КАЖДОЙ загрузке страницы.
 *   - `nextCrateAt` при этом сохранялся в payload СЫРЫМ
 *     (`storage.js` → `nextCrateAt: state.nextCrateAt`) и восстанавливался СЫРЫМ
 *     (`game.js` → `if (saved.nextCrateAt != null) state.nextCrateAt = saved.nextCrateAt`).
 *   - Итог: сохранение на 60-й секунде сессии (`nextCrateAt ≈ 90`) после reload
 *     давало `nextCrateAt = 90` при `nowSec() ≈ 3`. Таймер «уезжал» далеко в
 *     будущее, `maybeSpawnCrate()` никогда не выполнял `now >= nextCrateAt`,
 *     и боксы переставали падать до конца сессии (или пока игрок не наиграет
 *     столько же секунд заново).
 *
 * Фикс (тот же паттерн, что уже закрыт для attack-wave countdown в Pack 17):
 *   - writer `storage.js` `serializeCrateRemainingSec()` — live-first через
 *     `Game.getCrateRemainingSec()`, кладёт ОТНОСИТЕЛЬНЫЙ остаток;
 *   - reader `game.js` `restoreFullState()` — читает `crateRemainingSec`,
 *     legacy `nextCrateAt` трактует как остаток, и клампит результат до одного
 *     `BAL.crateIntervalSec` от «сейчас».
 *
 * Run: node Test/pack24/crateTimerPersistence.test.js
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
const saveSchema = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/saveSchema.json'), 'utf-8'));

const BAL_CRATE_INTERVAL_SEC = 90;

/* ------------------------------------------------------------------ */
/*  Section 1 — writer emits a portable remainder                      */
/* ------------------------------------------------------------------ */

console.log('\n  Section 1: storage.js writer');

test('CTP-1: serializeCrateRemainingSec() exists in storage.js', () => {
  assert(storageJs.indexOf('function serializeCrateRemainingSec(') !== -1,
    'serializeCrateRemainingSec() declared');
});

test('CTP-2: writer reads the live seam Game.getCrateRemainingSec()', () => {
  const start = storageJs.indexOf('function serializeCrateRemainingSec(');
  const end = storageJs.indexOf('function serializeAttackWaveSnapshot(');
  assert(start !== -1 && end > start, 'function body slice available');
  const body = storageJs.slice(start, end);
  assert(body.indexOf('Game.getCrateRemainingSec') !== -1,
    'writer uses Game.getCrateRemainingSec (live-first)');
});

test('CTP-3: serializeState() emits crateRemainingSec', () => {
  assert(/crateRemainingSec:\s*serializeCrateRemainingSec\(state\)/.test(storageJs),
    'payload field crateRemainingSec wired to the helper');
});

test('CTP-4: writer falls back to null when live seam is unavailable', () => {
  const start = storageJs.indexOf('function serializeCrateRemainingSec(');
  const end = storageJs.indexOf('function serializeAttackWaveSnapshot(');
  const body = storageJs.slice(start, end);
  assert(body.indexOf('return null;') !== -1, 'writer returns null on missing live value');
});

/* ------------------------------------------------------------------ */
/*  Section 2 — reader (game.js) converts to absolute sim time         */
/* ------------------------------------------------------------------ */

console.log('\n  Section 2: game.js reader (restoreFullState)');

test('CTP-5: getCrateRemainingSec() seam exists and is exported on Game', () => {
  assert(gameJs.indexOf('function getCrateRemainingSec(){') !== -1,
    'getCrateRemainingSec() declared');
  assert(gameJs.indexOf('GameApi.getCrateRemainingSec = getCrateRemainingSec;') !== -1,
    'seam exported on GameApi');
});

test('CTP-6: seam returns null when the timer is uninitialized', () => {
  const start = gameJs.indexOf('function getCrateRemainingSec(){');
  const end = gameJs.indexOf('GameApi.getCrateRemainingSec');
  assert(start !== -1 && end > start, 'function body slice available');
  const body = gameJs.slice(start, end);
  assert(body.indexOf('return null;') !== -1, 'null for uninitialized nextCrateAt');
  assert(body.indexOf('state.nextCrateAt - nowSec()') !== -1, 'remainder = nextCrateAt - nowSec()');
});

test('CTP-7: restore consumes crateRemainingSec (portable remainder)', () => {
  assert(gameJs.indexOf('saved.crateRemainingSec') !== -1,
    'restoreFullState reads saved.crateRemainingSec');
});

test('CTP-8: legacy nextCrateAt is treated as a remainder, not raw absolute', () => {
  const start = gameJs.indexOf('Number.isFinite(saved.crateRemainingSec)');
  assert(start !== -1, 'crate restore block present');
  const body = gameJs.slice(start, start + 600);
  assert(body.indexOf('saved.nextCrateAt - crateNow') !== -1,
    'legacy nextCrateAt converted via (saved.nextCrateAt - now)');
});

test('CTP-9: restored countdown is clamped to one crateIntervalSec', () => {
  const start = gameJs.indexOf('saved.crateRemainingSec');
  const body = gameJs.slice(start, start + 800);
  assert(body.indexOf('Math.min(crateRemaining, crateInterval)') !== -1,
    'clamp to crateInterval so a huge/stale value cannot stall drops');
});

test('CTP-10: crate restore derives interval from BAL.crateIntervalSec', () => {
  const start = gameJs.indexOf('saved.crateRemainingSec');
  const body = gameJs.slice(start - 900, start + 800);
  assert(body.indexOf('BAL.crateIntervalSec') !== -1, 'reads BAL.crateIntervalSec (single owner)');
});

test('CTP-11: crateRemainingSec registered in __KNOWN_PAYLOAD_KEYS', () => {
  assert(gameJs.indexOf("'crateRemainingSec'") !== -1,
    'field listed in __KNOWN_PAYLOAD_KEYS (no schema drift warning)');
});

/* ------------------------------------------------------------------ */
/*  Section 3 — schema + regression guard                              */
/* ------------------------------------------------------------------ */

console.log('\n  Section 3: schema + guards');

test('CTP-12: saveSchema declares crateRemainingSec', () => {
  const prop = saveSchema.properties && saveSchema.properties.crateRemainingSec;
  assert(prop, 'crateRemainingSec present in schema properties');
  assert(Array.isArray(prop.type) && prop.type.indexOf('number') !== -1 && prop.type.indexOf('null') !== -1,
    'schema type allows number|null');
});

test('CTP-13: the raw-absolute assignment is gone', () => {
  assert(gameJs.indexOf('if (saved.nextCrateAt != null) state.nextCrateAt = saved.nextCrateAt;') === -1,
    'no raw absolute nextCrateAt restore remains');
});

test('CTP-14: spawn/cadence owners unchanged (BAL.crateIntervalSec = 90)', () => {
  const match = gameJs.match(/crateIntervalSec:\s*(\d+)/);
  assert(match, 'crateIntervalSec declared in game.js');
  assertEqual(Number(match[1]), BAL_CRATE_INTERVAL_SEC, 'cadence is still 90 s');
});

test('CTP-15: maybeSpawnCrate still gates on now >= nextCrateAt', () => {
  const runtimeJs = fs.readFileSync(path.join(ROOT, 'src/mechanics/crateRuntime.js'), 'utf-8');
  assert(runtimeJs.indexOf('now >= state.nextCrateAt') !== -1,
    'spawn gate intact (contract not weakened by the fix)');
});

/* ------------------------------------------------------------------ */

console.log('\n' + '-'.repeat(60));
console.log('Pack 24 crate timer persistence: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  for (const f of failures) console.log('  FAILED: ' + f.name + ' -> ' + f.error);
}
console.log('-'.repeat(60));

if (failCount > 0) process.exit(1);
