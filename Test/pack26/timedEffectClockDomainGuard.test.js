'use strict';

/**
 * Pack 26 — timed-эффекты активаций (Шквал / Купол / Золотое время) и speed-буст
 * суперкомпьютера: защита от clock-domain mismatch.
 *
 * Баг (задача пользователя): «бафф от активки Шквал после загрузки стал
 * длительностью больше 1100 секунд», при этом поймать его в свежей сессии
 * невозможно.
 *
 * Root cause: `state.boostUntil` и `state.activeEffects.*Until` — абсолютные
 * timestamps в домене `nowSec()` (`performance.now()/1000` минус pause-offset).
 * Домен перезапускается с ~0 на КАЖДОЙ загрузке страницы и не восстанавливается
 * из payload. При этом `activeEffects` уходил в save как есть, а читался сырым:
 *
 *   writer `storage.js`:  `activeEffects: state.activeEffects`
 *   reader `game.js`:     `if (saved.activeEffects) state.activeEffects = { ...state.activeEffects, ...saved.activeEffects }`
 *
 * Итог: сессия длиной ~1100 с, бафф активирован на предпоследней секунде
 * (`attackUntil ≈ 1105`) → после reload `nowSec() ≈ 3`, остаток = 1102 с вместо
 * 10 с. Симптом ровно такой, как описал пользователь.
 *
 * Защита (три слоя, все три покрывают Шквал, Купол, Золотое время и speed-буст):
 *   1. writer — `serializeTimedEffectRemainders()` кладёт ОТНОСИТЕЛЬНЫЕ остатки
 *      (`timedEffectsRemainingSec`) через live seam `Game.getTimedEffectRemainders()`;
 *   2. reader — `restoreTimedEffectsFromSave()` предпочитает относительные
 *      остатки, а legacy-поля трактует как остатки и клампит;
 *   3. runtime guard — `clampTimedEffectsToTimeDomain()` в
 *      `normalizeActiveEffectsTimestamps()` (каждый кадр) и кламп в
 *      `useActiveAbility()` не дают остатку превысить полную длительность.
 *
 * Run: node Test/pack26/timedEffectClockDomainGuard.test.js
 */

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
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf-8');

const CEILING_SEC = 60; // fallback-потолок, когда точные длительности не резолвятся
const BOOST_DURATION_SEC = 60; // BAL.boostDurationSec
const ABILITY_DURATION_SEC = 10; // offense/defense/economyActiveDurationMs / 1000

/* ------------------------------------------------------------------ */
/*  Section 0 — извлечение guard-логики из game.js и её прогон         */
/* ------------------------------------------------------------------ */

console.log('\n  Section 0: guard semantics (extracted from game.js)');

// Секция guard-хелперов объявлена между BOOST_EFFECT_DEFS и BASE_BAL.
const guardStart = gameJs.indexOf('const TIMED_EFFECT_KEYS =');
const guardEnd = gameJs.indexOf('const BASE_BAL = {');
assert(guardStart !== -1 && guardEnd > guardStart, 'guard-блок найден в game.js');
const guardSrc = gameJs.slice(guardStart, guardEnd);

/** Собираем чистые (не завязанные на state) хелперы в изолированном vm-контексте. */
const vm = require('vm');
function buildGuardSandbox() {
  const sandbox = {
    BAL: { boostDurationSec: BOOST_DURATION_SEC },
    // talentsV2 недоступен -> используется fallback-потолок (проверяем именно
    // защитный путь, когда точные длительности неизвестны).
    getTalentsV2Api: function () { return null; },
    getTalentV2BranchIdByIndex: function (i) { return ['offense', 'defense', 'economy'][i]; },
    Date: Date,
    console: console,
  };
  sandbox.global = sandbox;
  vm.createContext(sandbox);
  // Берём только чистые хелперы: без clampTimedEffectsToTimeDomain (нужен state).
  const pure = guardSrc.slice(0, guardSrc.indexOf('/** Self-healing clamp'));
  vm.runInContext(pure + '\nvar __api = { clampTimedEffectUntilSec: clampTimedEffectUntilSec, applyTimedEffectRemainder: applyTimedEffectRemainder, getTimedEffectCeilingSec: getTimedEffectCeilingSec, refreshTimedEffectDurationsCache: refreshTimedEffectDurationsCache, TIMED_EFFECT_KEYS: TIMED_EFFECT_KEYS, CEILING: TIMED_EFFECT_RESTORE_CEILING_SEC };', sandbox);
  return sandbox.__api;
}

const guard = buildGuardSandbox();

test('TEC-1: fallback-потолок ограничен (60 s) и не бесконечен', () => {
  assertEqual(guard.CEILING, CEILING_SEC, 'TIMED_EFFECT_RESTORE_CEILING_SEC = BAL.boostDurationSec');
  assert(Number.isFinite(guard.getTimedEffectCeilingSec('attackUntil')), 'ceiling конечный');
  assert(guard.getTimedEffectCeilingSec('attackUntil') <= CEILING_SEC, 'ceiling не больше максимума');
});

test('TEC-2: регрессия бага — абсолютный timestamp чужого домена усекается', () => {
  // Сессия длиной ~1100 с: бафф активирован на 1095-й секунде на 10 с.
  const foreignAbsoluteUntil = 1105;
  const freshLoadNowSec = 3;
  const clamped = guard.clampTimedEffectUntilSec(foreignAbsoluteUntil, freshLoadNowSec, ABILITY_DURATION_SEC);
  assertEqual(clamped, freshLoadNowSec + ABILITY_DURATION_SEC, 'остаток усечён до полной длительности');
  assert((clamped - freshLoadNowSec) <= ABILITY_DURATION_SEC, 'остаток <= durationMs/1000');
  assert((clamped - freshLoadNowSec) < 1100, 'симптом «1100+ секунд» больше не воспроизводится');
});

test('TEC-3: легитимный остаток внутри домена не трогается', () => {
  const now = 100;
  const until = now + 7.5; // 7.5 с из 10 доступных
  assertEqual(guard.clampTimedEffectUntilSec(until, now, ABILITY_DURATION_SEC), until, 'valid остаток сохранён как есть');
});

test('TEC-4: истёкший эффект остаётся истёкшим (не воскрешается)', () => {
  const now = 500;
  const until = 120;
  assertEqual(guard.clampTimedEffectUntilSec(until, now, ABILITY_DURATION_SEC), until, 'прошлый until не поднимается до now');
  assert(guard.clampTimedEffectUntilSec(until, now, ABILITY_DURATION_SEC) < now, 'эффект всё ещё неактивен');
});

test('TEC-5: applyTimedEffectRemainder клампит остаток и обнуляет невалидный', () => {
  const now = 10;
  assertEqual(guard.applyTimedEffectRemainder(7, now, ABILITY_DURATION_SEC), now + 7, 'валидный остаток = now + remainder');
  assertEqual(guard.applyTimedEffectRemainder(9999, now, ABILITY_DURATION_SEC), now + ABILITY_DURATION_SEC, 'poisoned остаток усечён');
  assertEqual(guard.applyTimedEffectRemainder(0, now, ABILITY_DURATION_SEC), 0, 'нулевой остаток -> 0');
  assertEqual(guard.applyTimedEffectRemainder(-5, now, ABILITY_DURATION_SEC), 0, 'отрицательный остаток -> 0');
  assertEqual(guard.applyTimedEffectRemainder(NaN, now, ABILITY_DURATION_SEC), 0, 'NaN -> 0');
});

test('TEC-6: speed-буст использует свою полную длительность (60 s), а не 10 s', () => {
  guard.refreshTimedEffectDurationsCache();
  assertEqual(guard.getTimedEffectCeilingSec('boostUntil'), BOOST_DURATION_SEC, 'boostUntil ceiling = boostDurationSec');
  const now = 0;
  assertEqual(guard.applyTimedEffectRemainder(9999, now, guard.getTimedEffectCeilingSec('boostUntil')), BOOST_DURATION_SEC,
    'poisoned boost усечён до 60 s');
});

/* ------------------------------------------------------------------ */
/*  Section 1 — покрытие всех трёх активок                             */
/* ------------------------------------------------------------------ */

console.log('\n  Section 1: all three actives covered');

test('TEC-7: guard покрывает Шквал, Купол и Золотое время', () => {
  assertEqual(guard.TIMED_EFFECT_KEYS.join(','), 'attackUntil,speedUntil,economyUntil',
    'все три activeEffects-поля под guard');
});

test('TEC-8: runtime guard вызывается из normalizeActiveEffectsTimestamps()', () => {
  const body = gameJs.slice(gameJs.indexOf('function normalizeActiveEffectsTimestamps(){'));
  const scoped = body.slice(0, body.indexOf('\nfunction getAppliedFenceUpgradeLevel'));
  assert(scoped.indexOf('clampTimedEffectsToTimeDomain()') !== -1,
    'self-healing clamp на каждом кадре');
  assert(scoped.indexOf('state.boostUntil = normalizeStoredUntilSec(state.boostUntil)') !== -1,
    'speed-буст тоже нормализуется');
});

test('TEC-9: clampTimedEffectsToTimeDomain покрывает boostUntil и все activeEffects', () => {
  const start = gameJs.indexOf('function clampTimedEffectsToTimeDomain(){');
  const end = gameJs.indexOf('/**\n * Читает timed-эффекты из payload');
  const body = gameJs.slice(start, end);
  assert(start !== -1 && end > start, 'функция найдена');
  assert(body.indexOf('state.boostUntil = clampTimedEffectUntilSec') !== -1, 'boostUntil clamped');
  assert(body.indexOf('TIMED_EFFECT_KEYS') !== -1, 'activeEffects clamped через общий список ключей');
});

test('TEC-10: useActiveAbility не наследует poisoned-absolute через Math.max', () => {
  const start = gameJs.indexOf('function useActiveAbility(branch){');
  const end = gameJs.indexOf('function activateTimedBoost(');
  const body = gameJs.slice(start, end);
  assert(start !== -1 && end > start, 'useActiveAbility найден');
  assert(body.indexOf('refreshTimedEffectDurationsCache()') !== -1, 'точные длительности резолвятся перед записью');
  assert(body.indexOf('const clampedUntil = Math.min(nowSecValue + abilityCeiling, untilSec)') !== -1,
    'запись ограничена потолком длительности активки');
  assert(body.indexOf('Math.max(state.activeEffects.attackUntil || 0, untilSec)') === -1,
    'старое сырое Math.max-присваивание удалено');
});

test('TEC-11: активки и speed-буст остаются функциональными (пороги не ослаблены)', () => {
  assert(gameJs.indexOf("if (branch === 0) state.activeEffects.attackUntil = clampedUntil;") !== -1, 'Шквал пишется');
  assert(gameJs.indexOf("else if (branch === 1) state.activeEffects.speedUntil = clampedUntil;") !== -1, 'Купол пишется');
  assert(gameJs.indexOf("else if (branch === 2) state.activeEffects.economyUntil = clampedUntil;") !== -1, 'Золотое время пишется');
  assert(gameJs.indexOf('state.boostUntil = until;') !== -1, 'speed-буст пишется без изменений');
});

/* ------------------------------------------------------------------ */
/*  Section 2 — reader: оба restore-пути                              */
/* ------------------------------------------------------------------ */

console.log('\n  Section 2: reader paths (restoreFullState + applySavedProgress)');

test('TEC-12: raw-merge saved.activeEffects удалён из restoreFullState()', () => {
  assert(gameJs.indexOf('if (saved.activeEffects) state.activeEffects = { ...state.activeEffects, ...saved.activeEffects };') === -1,
    'сырой merge абсолютных значений больше не выполняется');
  assert(gameJs.indexOf('restoreTimedEffectsFromSave(saved);') !== -1,
    'restoreFullState переведён на restoreTimedEffectsFromSave()');
});

test('TEC-13: raw-absolute boostUntil не восстанавливается как есть', () => {
  assert(gameJs.indexOf('if (saved.boostUntil != null) state.boostUntil = saved.boostUntil;') === -1,
    'сырое восстановление boostUntil удалено');
});

test('TEC-14: applySavedProgress() (прогресс-загрузка) тоже проходит через guard', () => {
  const start = gameJs.indexOf('function applySavedProgress(data){');
  const end = gameJs.indexOf('const PROJECTILE_KINDS =');
  const body = gameJs.slice(start, end);
  assert(start !== -1 && end > start, 'applySavedProgress найден');
  assert(body.indexOf('restoreTimedEffectsFromSave(data);') !== -1,
    'второй restore-путь покрыт тем же guard-ом');
});

test('TEC-15: restoreTimedEffectsFromSave предпочитает относительные остатки', () => {
  const start = gameJs.indexOf('function restoreTimedEffectsFromSave(saved){');
  const end = gameJs.indexOf('const BASE_BAL = {');
  const body = gameJs.slice(start, end);
  assert(start !== -1 && end > start, 'функция найдена');
  assert(body.indexOf('saved.timedEffectsRemainingSec') !== -1, 'relative-поле читается первым');
  assert(body.indexOf('legacyAbsolute - nowSecValue') !== -1, 'legacy-поля трактуются как остатки');
  assert(body.indexOf('applyTimedEffectRemainder(') !== -1, 'запись идёт через кламп');
  assert(body.includes("'attackUntil'") && body.includes("'speedUntil'") && body.includes("'economyUntil'"),
    'все три активки восстанавливаются');
});

/* ------------------------------------------------------------------ */
/*  Section 3 — writer + seam                                         */
/* ------------------------------------------------------------------ */

console.log('\n  Section 3: writer + public seam');

test('TEC-16: seam Game.getTimedEffectRemainders() объявлен и раскрыт на GameApi', () => {
  assert(gameJs.indexOf('function getTimedEffectRemainders(){') !== -1, 'seam объявлен');
  assert(gameJs.indexOf('GameApi.getTimedEffectRemainders = getTimedEffectRemainders;') !== -1, 'seam экспортирован');
  const start = gameJs.indexOf('function getTimedEffectRemainders(){');
  const end = gameJs.indexOf('GameApi.getTimedEffectRemainders');
  const body = gameJs.slice(start, end);
  assert(body.indexOf('boostSec') !== -1 && body.indexOf('attackSec') !== -1
    && body.indexOf('defenseSec') !== -1 && body.indexOf('economySec') !== -1,
    'seam отдаёт остатки всех четырёх эффектов');
});

test('TEC-17: writer serializeTimedEffectRemainders() live-first и fail-safe', () => {
  const start = storageJs.indexOf('function serializeTimedEffectRemainders(state) {');
  const end = storageJs.indexOf('/**\n   * Прочитать текущий снимок расписания волны атаки');
  const body = storageJs.slice(start, end);
  assert(start !== -1 && end > start, 'writer найден');
  assert(body.indexOf('global.Game && global.Game.getTimedEffectRemainders') !== -1, 'live-first через seam');
  assert(body.indexOf('return null;') !== -1, 'null при недоступном seam (reader уйдёт в legacy-ветку с клампом)');
});

test('TEC-18: serializeState() эмитит timedEffectsRemainingSec', () => {
  assert(/timedEffectsRemainingSec:\s*serializeTimedEffectRemainders\(state\)/.test(storageJs),
    'payload-поле связано с writer-ом');
});

/* ------------------------------------------------------------------ */
/*  Section 4 — schema + payload contract                             */
/* ------------------------------------------------------------------ */

console.log('\n  Section 4: schema + payload contract');

test('TEC-19: saveSchema объявляет timedEffectsRemainingSec', () => {
  const prop = saveSchema.properties && saveSchema.properties.timedEffectsRemainingSec;
  assert(prop, 'поле присутствует в schema properties');
  assert(Array.isArray(prop.type) && prop.type.indexOf('object') !== -1 && prop.type.indexOf('null') !== -1,
    'schema type допускает object|null');
});

test('TEC-20: timedEffectsRemainingSec внесён в __KNOWN_PAYLOAD_KEYS', () => {
  const start = gameJs.indexOf('const __KNOWN_PAYLOAD_KEYS = [');
  const end = gameJs.indexOf('function reportUnknownPayloadKeys');
  const body = gameJs.slice(start, end);
  assert(body.indexOf("'timedEffectsRemainingSec'") !== -1, 'нет dev-warning об unknown key');
});

test('TEC-21: entry token согласован по всем ?v=-маркерам', () => {
  const tokens = indexHtml.match(/\?v=([A-Za-z0-9._-]+)/g) || [];
  assert(tokens.length > 0, '?v= маркеры присутствуют');
  const unique = Array.from(new Set(tokens.map(function (t) { return t.slice(3); })));
  assertEqual(unique.length, 1, 'ровно один уникальный entry token');
});

/* ------------------------------------------------------------------ */
/*  Section 5 — per-frame guard: прогон на fake state                 */
/* ------------------------------------------------------------------ */

console.log('\n  Section 5: per-frame self-healing guard (vm + fake state)');

/**
 * Собирает `normalizeStoredUntilSec` + guard-блок + `normalizeActiveEffectsTimestamps`
 * в изолированном контексте с подконтрольными `state` и `nowSec()`. Это позволяет
 * проверить hot-path слой детерминированно (без зависимости от requestAnimationFrame).
 */
function runNormalizeAgainst(activeEffects, boostUntil, nowValue) {
  const normalizeStart = gameJs.indexOf('function normalizeStoredUntilSec(value){');
  const normalizeEnd = gameJs.indexOf('function getAppliedFenceUpgradeLevel');
  assert(normalizeStart !== -1 && normalizeEnd > normalizeStart, 'normalize-блок найден');
  const normalizeSrc = gameJs.slice(normalizeStart, normalizeEnd);

  const sandbox = {
    state: { boostUntil: boostUntil, activeEffects: Object.assign({}, activeEffects) },
    BAL: { boostDurationSec: BOOST_DURATION_SEC },
    getTalentsV2Api: function () { return null; },
    isTalentsV2Ready: function () { return false; }, // talentsV2 ещё не готов
    getTalentV2BranchIdByIndex: function (i) { return ['offense', 'defense', 'economy'][i]; },
    __now: nowValue,
    Date: Date,
    console: console,
  };
  sandbox.global = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(
    guardSrc
    + '\nfunction nowSec(){ return __now; }'
    + '\n' + normalizeSrc
    + '\n__run = function(){ normalizeActiveEffectsTimestamps(); };',
    ctx
  );
  sandbox.__run();
  return { boostUntil: sandbox.state.boostUntil, activeEffects: sandbox.state.activeEffects };
}

test('TEC-22: hot-path guard усекает poisoned-absolute до полной длительности', () => {
  const now = 12;
  const result = runNormalizeAgainst({ attackUntil: 4321, speedUntil: 4321, economyUntil: 4321 }, 4321, now);
  // talentsV2 недоступен -> действует страховочный потолок (60 s), а он общий для
  // всех timed-эффектов. Важно, что 4321 больше не проходит: значение ограничено.
  assertEqual(result.activeEffects.attackUntil, now + CEILING_SEC, 'Шквал усечён до потолка');
  assertEqual(result.activeEffects.speedUntil, now + CEILING_SEC, 'Купол усечён до потолка');
  assertEqual(result.activeEffects.economyUntil, now + CEILING_SEC, 'Золотое время усечено до потолка');
  assertEqual(result.boostUntil, now + BOOST_DURATION_SEC, 'speed-буст усечён до 60 s');
  assert((result.activeEffects.attackUntil - now) < 1100, 'симптом «1100+ секунд» устранён на hot-path');
});

test('TEC-22b: с известными длительностями (talentsV2) Шквал ограничен 10 s', () => {
  const now = 12;
  const sandbox = {
    state: { boostUntil: 4321, activeEffects: { attackUntil: 4321, speedUntil: 4321, economyUntil: 4321 } },
    BAL: { boostDurationSec: BOOST_DURATION_SEC },
    // talentsV2 «готов» и отдаёт реальные durationMs из balance.
    isTalentsV2Ready: function () { return true; },
    getTalentsV2Api: function () {
      return {
        getActiveState: function (branchId) { return { durationMs: ABILITY_DURATION_SEC * 1000 }; },
      };
    },
    getTalentV2BranchIdByIndex: function (i) { return ['offense', 'defense', 'economy'][i]; },
    __now: now,
    Date: Date,
    console: console,
  };
  sandbox.global = sandbox;
  const ctx = vm.createContext(sandbox);
  const normalizeStart = gameJs.indexOf('function normalizeStoredUntilSec(value){');
  const normalizeSrc = gameJs.slice(normalizeStart, gameJs.indexOf('function getAppliedFenceUpgradeLevel'));
  vm.runInContext(
    guardSrc
    + '\nfunction nowSec(){ return __now; }'
    + '\n' + normalizeSrc
    + '\n__run = function(){ normalizeActiveEffectsTimestamps(); };',
    ctx
  );
  sandbox.__run();
  assertEqual(sandbox.state.activeEffects.attackUntil, now + ABILITY_DURATION_SEC, 'Шквал ограничен durationMs/1000 = 10 s');
  assertEqual(sandbox.state.activeEffects.speedUntil, now + ABILITY_DURATION_SEC, 'Купол ограничен 10 s');
  assertEqual(sandbox.state.activeEffects.economyUntil, now + ABILITY_DURATION_SEC, 'Золотое время ограничено 10 s');
  assertEqual(sandbox.state.boostUntil, now + BOOST_DURATION_SEC, 'speed-буст сохраняет свою длительность 60 s');
});

test('TEC-22c: гейт abilitiesResolved не даёт резолвить длительности каждый кадр', () => {
  const body = gameJs.slice(
    gameJs.indexOf('function clampTimedEffectsToTimeDomain(){'),
    gameJs.indexOf('/**\n * Читает timed-эффекты из payload')
  );
  assert(body.indexOf('timedEffectRuntime.abilitiesResolved') !== -1, 'гейт читается на hot-path');
  assert(body.indexOf('!timedEffectRuntime.abilitiesResolved') !== -1, 'resolve выполняется только пока флаг снят');
  assert(body.indexOf('isTalentsV2Ready()') !== -1, 'resolve привязан к готовности talentsV2');
});

test('TEC-23: hot-path guard не ломает легитимные значения', () => {
  const now = 100;
  const result = runNormalizeAgainst({ attackUntil: now + 7, speedUntil: 0, economyUntil: now - 5 }, now + 4, now);
  assertEqual(result.activeEffects.attackUntil, now + 7, 'валидный остаток сохранён');
  assertEqual(result.activeEffects.speedUntil, 0, 'нулевое значение не воскрешается');
  assert(result.activeEffects.economyUntil < now, 'истёкший эффект остался истёкшим');
});

test('TEC-24: http-эпоха (ms) отсекается существующим normalizeStoredUntilSec', () => {
  const now = 5;
  const result = runNormalizeAgainst({ attackUntil: 1e9, speedUntil: 0, economyUntil: 0 }, 1e9, now);
  assertEqual(result.activeEffects.attackUntil, 0, 'значение > 1e6 обнуляется как артефакт домена');
  assertEqual(result.boostUntil, 0, 'boostUntil > 1e6 обнуляется');
});

test('TEC-25: guard идемпотентен (повторный прогон не меняет результат)', () => {
  const now = 40;
  const first = runNormalizeAgainst({ attackUntil: 5000, speedUntil: 5000, economyUntil: 5000 }, 5000, now);
  const second = runNormalizeAgainst(first.activeEffects, first.boostUntil, now);
  assertEqual(second.activeEffects.attackUntil, first.activeEffects.attackUntil, 'attackUntil стабилен');
  assertEqual(second.activeEffects.speedUntil, first.activeEffects.speedUntil, 'speedUntil стабилен');
  assertEqual(second.activeEffects.economyUntil, first.activeEffects.economyUntil, 'economyUntil стабилен');
  assertEqual(second.boostUntil, first.boostUntil, 'boostUntil стабилен');
});

/* ------------------------------------------------------------------ */

console.log('\n' + '-'.repeat(60));
console.log('Pack 26 timed-effect clock-domain guard: ' + passCount + ' passed, ' + failCount + ' failed');
if (failCount > 0) {
  console.log('\nFailures:');
  failures.forEach(function (f) { console.log('  - ' + f.name + ': ' + f.error); });
  process.exit(1);
}
console.log('All Pack 26 checks passed.');
