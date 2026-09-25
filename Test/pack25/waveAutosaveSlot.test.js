/**
 * Pack 25 — отдельная ячейка автосейва после завершения волны атаки.
 *
 * Задача пользователя: «Добавить ещё один автосейв, который будет делаться
 * каждый раз после завершения волны атаки. Это должна быть новая ячейка
 * сохранения, а не использование существующей ячейки для сохранения после
 * перезагрузки симуляции.»
 *
 * Ключевой инвариант, который защищает этот файл:
 *   pre-retry auto slot (index 9) — владелец critical-restart payload-а, его
 *   читают `loadPreRetryPayloadFromAutoSlot()` / `canRestartFromAutoSlot()`.
 *   Wave-автосейв обязан жить в ОТДЕЛЬНОЙ ячейке (index 10) и не перетирать
 *   живьём сброшенный pre-retry сейв, иначе кнопка «Перезапустить симуляцию»
 *   загрузит не тот payload.
 *
 * Дополнительно: payload wave-автосейва — живое состояние (монеты/танки/HP стен
 * как в обычном save), но с `forceFenceRuntimeResetOnLoad = false`, чтобы
 * загрузка продолжила сохранённое расписание волн, а не начала полный интервал.
 *
 * Run: node Test/pack25/waveAutosaveSlot.test.js
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
const storageJs = fs.readFileSync(path.join(ROOT, 'src/persistence/storage.js'), 'utf-8');
const gameJs = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf-8');
const bootstrapJs = fs.readFileSync(path.join(ROOT, 'src/core/bootstrap.js'), 'utf-8');
const bigMenuJs = fs.readFileSync(path.join(ROOT, 'src/ui/bigMenuRuntime.js'), 'utf-8');
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf-8');
const ruJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/i18n/ru.json'), 'utf-8'));
const enJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/i18n/en.json'), 'utf-8'));

const AUTO_SLOT_INDEX = 9;
const WAVE_AUTO_SLOT_INDEX = 10;

/* ------------------------------------------------------------------ *
 * Real-code sandbox: исполняем настоящий storage.js, а не парсим текст.
 * ------------------------------------------------------------------ */

function createStorageSandbox() {
  const localStore = {
    _d: {},
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null; },
    setItem: function (k, v) { this._d[k] = String(v); },
    removeItem: function (k) { delete this._d[k]; },
  };
  const sandboxGlobal = {
    localStorage: localStore,
    document: null,
    console: { warn: function () {}, log: function () {}, error: function () {} },
    JSON: JSON,
    Object: Object,
    Number: Number,
    Math: Math,
    Array: Array,
    Date: Date,
    Error: Error,
    String: String,
    Boolean: Boolean,
    setTimeout: function () { return 0; },
    clearTimeout: function () {},
  };
  sandboxGlobal.window = sandboxGlobal;
  sandboxGlobal.Game = {};
  const code = storageJs;
  const fn = new Function('window', 'global', 'localStorage', 'console', 'document', code);
  fn(sandboxGlobal, sandboxGlobal, localStore, sandboxGlobal.console, sandboxGlobal.document);
  return {
    global: sandboxGlobal,
    localStore: localStore,
    reset: function () { localStore._d = {}; },
  };
}

/** Минимальный валидный state-подобный объект для serializeState(). */
function makeState(overrides) {
  const base = {
    coins: 777,
    kills: 12,
    fenceLevel: 3,
    fenceSegments: [],
    fenceSegmentsMeta: null,
    savedFenceState: { segmentsPerSide: 4, hpById: { s0: 55, s1: 0 } },
    cells: [
      { i: 0, orbitPhase: 0, tank: { id: 'tank_lvl7', level: 7, onTrack: false, powerTier: 1 } },
      { i: 1, orbitPhase: 1, tank: null },
    ],
    supercomputer: { hp: 900, maxHp: 920, state: 'idle', computerLevel: 4 },
    player: { damagePoints: 5, talentsV2: { ranksById: {}, freePoints: 0 } },
    buyCounts: { a: 2 },
    buyPrices: { a: 30 },
    achievements: {},
    stats: { currentWaveCount: 6 },
    drones: [],
    nextCrateAt: 123.5,
    attackWaveRemainingSec: 42,
    attackWaveActive: false,
    attackWaveRemainingActiveSec: 0,
    maxTankLevelAchieved: 7,
    boostUntil: 0,
    activeEffects: { attackUntil: 0, speedUntil: 0, economyUntil: 0 },
  };
  return Object.assign(base, overrides || {});
}

/* ------------------------------------------------------------------ */
/*  Section 1 — writer: отдельная ячейка, живой payload                */
/* ------------------------------------------------------------------ */

console.log('\n  Section 1: saveWaveAutoSlot writer');

test('WAS-1: wave auto slot has its own index, distinct from pre-retry auto slot', function () {
  assert(storageJs.indexOf('var WAVE_AUTO_SLOT_INDEX = 10;') !== -1, 'WAVE_AUTO_SLOT_INDEX = 10 declared');
  assert(storageJs.indexOf('var AUTO_SLOT_INDEX = 9;') !== -1, 'pre-retry AUTO_SLOT_INDEX = 9 unchanged');
  assert(WAVE_AUTO_SLOT_INDEX !== AUTO_SLOT_INDEX, 'the two auto slots must not collide');
});

test('WAS-2: saveWaveAutoSlot() exists and is exported on Game.Storage', function () {
  assert(storageJs.indexOf('function saveWaveAutoSlot(state, options)') !== -1, 'writer declared');
  assert(storageJs.indexOf('saveWaveAutoSlot: saveWaveAutoSlot,') !== -1, 'writer exported');
  assert(storageJs.indexOf('loadWaveAutoSlot: loadWaveAutoSlot,') !== -1, 'reader exported');
  assert(storageJs.indexOf('WAVE_AUTO_SLOT_INDEX: WAVE_AUTO_SLOT_INDEX,') !== -1, 'index exported');
});

test('WAS-3: writer persists the LIVE state (no pre-retry runtime reset)', function () {
  const start = storageJs.indexOf('function saveWaveAutoSlot(state, options)');
  const end = storageJs.indexOf('function loadWaveAutoSlot(');
  assert(start !== -1 && end > start, 'writer body delimited');
  const body = storageJs.slice(start, end);
  assert(body.indexOf('serializeState(state') !== -1, 'writer uses canonical serializeState()');
  assert(body.indexOf('buildPreRetryPayload') === -1, 'writer must NOT reuse the pre-retry payload builder');
  assert(body.indexOf('applyPreRetryRuntimeReset') === -1, 'writer must NOT reset runtime (tanks/coins/walls survive)');
});

test('WAS-4: writer forces forceFenceRuntimeResetOnLoad = false', function () {
  const start = storageJs.indexOf('function saveWaveAutoSlot(state, options)');
  const end = storageJs.indexOf('function loadWaveAutoSlot(');
  const body = storageJs.slice(start, end);
  assert(/payload\.forceFenceRuntimeResetOnLoad\s*=\s*false;/.test(body),
    'wave autosave must pin the flag to false so loading resumes the stored schedule');
});

test('WAS-5: writer targets WAVE_AUTO_SLOT_INDEX, never the pre-retry index', function () {
  const start = storageJs.indexOf('function saveWaveAutoSlot(state, options)');
  const end = storageJs.indexOf('function loadWaveAutoSlot(');
  const body = storageJs.slice(start, end);
  assert(body.indexOf('getSlotDataKey(WAVE_AUTO_SLOT_INDEX)') !== -1, 'writes to the wave slot key');
  assert(body.indexOf('getSlotDataKey(AUTO_SLOT_INDEX)') === -1, 'must not write to the pre-retry slot key');
});

/* ------------------------------------------------------------------ */
/*  Section 2 — runtime behaviour в реальном storage.js                */
/* ------------------------------------------------------------------ */

console.log('\n  Section 2: runtime behaviour (real storage.js)');

test('WAS-6: wave autosave and pre-retry autosave coexist without overwriting each other', function () {
  const box = createStorageSandbox();
  const Storage = box.global.Game.Storage;

  // 1) Кладём «pre-retry» payload в слот 9 каноническим slot API.
  const preRetry = Storage.saveSlot(AUTO_SLOT_INDEX, makeState({ coins: 40, kills: 0 }));
  assert(preRetry && preRetry.ok, 'pre-retry saveSlot(9) succeeded');
  const beforeWave = Storage.loadSlot(AUTO_SLOT_INDEX).payload;
  assertEqual(beforeWave.coins, 40, 'pre-retry slot holds the reset payload');

  // 2) Пишем wave-автосейв живого состояния в слот 10.
  const wave = Storage.saveWaveAutoSlot(makeState(), { lastSavedAt: Date.now() });
  assert(wave && wave.ok, 'saveWaveAutoSlot() succeeded');

  // 3) Pre-retry слот НЕ тронут.
  const afterWave = Storage.loadSlot(AUTO_SLOT_INDEX).payload;
  assertEqual(afterWave.coins, 40, 'pre-retry slot still holds the reset payload after wave autosave');
  assertEqual(afterWave.kills, 0, 'pre-retry slot kill count untouched');

  // 4) Wave-слот содержит живое состояние.
  const wavePayload = Storage.loadWaveAutoSlot().payload;
  assert(wavePayload, 'wave autosave payload readable');
  assertEqual(wavePayload.coins, 777, 'wave autosave holds live coins, not the reset 40');
  assertEqual(wavePayload.kills, 12, 'wave autosave holds live kills');
});

test('WAS-7: wave autosave payload resumes the stored attack-wave schedule', function () {
  const box = createStorageSandbox();
  const Storage = box.global.Game.Storage;
  Storage.saveWaveAutoSlot(makeState({ attackWaveRemainingSec: 42, attackWaveActive: false }), {});
  const payload = Storage.loadWaveAutoSlot().payload;
  assertEqual(payload.attackWaveRemainingSec, 42, 'remaining attack-wave seconds survive');
  assertEqual(payload.attackWaveActive, false, 'inactive wave flag survives');
  assertEqual(payload.forceFenceRuntimeResetOnLoad, false, 'loading must not restart the wave interval');
});

test('WAS-8: wave autosave preserves live tank cells and fence HP (живое состояние)', function () {
  const box = createStorageSandbox();
  const Storage = box.global.Game.Storage;
  Storage.saveWaveAutoSlot(makeState(), {});
  const payload = Storage.loadWaveAutoSlot().payload;
  assert(Array.isArray(payload.cells), 'cells serialized');
  assert(payload.cells[0] && payload.cells[0].tank, 'live tank survives in the wave autosave');
  assertEqual(payload.cells[0].tank.level, 7, 'tank level is the live one');
  assert(payload.fenceState && payload.fenceState.hpById, 'fence HP map serialized');
  assertEqual(payload.fenceState.hpById.s1, 0, 'broken wall stays broken in the wave autosave');
});

test('WAS-9: wave autosave does not touch manual slots', function () {
  const box = createStorageSandbox();
  const Storage = box.global.Game.Storage;
  // cleanup() в storage.js может снести слоты — проверяем только отсутствие записи в manual-слоты.
  Storage.saveWaveAutoSlot(makeState(), {});
  for (let i = 0; i < AUTO_SLOT_INDEX; i++) {
    const res = Storage.loadSlot(i);
    assert(res.ok && res.payload === null, 'manual slot ' + i + ' was not written by the wave autosave');
  }
});

test('WAS-10: SAVE_SLOTS_COUNT grew to 11 and lists the wave slot with isWaveAuto', function () {
  const box = createStorageSandbox();
  const Storage = box.global.Game.Storage;
  assertEqual(Storage.SAVE_SLOTS_COUNT, 11, 'SAVE_SLOTS_COUNT = 11');
  const list = Storage.listSlots();
  assert(list && list.ok, 'listSlots() ok');
  assertEqual(list.slots.length, 11, '11 slots reported');
  assertEqual(list.slots[AUTO_SLOT_INDEX].isAuto, true, 'slot 10 marked isAuto');
  assertEqual(list.slots[WAVE_AUTO_SLOT_INDEX].isWaveAuto, true, 'slot 11 marked isWaveAuto');
  assertEqual(list.slots[WAVE_AUTO_SLOT_INDEX].isAuto, false, 'wave slot is not the pre-retry auto slot');
});

test('WAS-11: legacy 10-entry saveSlotsMeta is padded, not corrupted (backward compat)', function () {
  const box = createStorageSandbox();
  const Storage = box.global.Game.Storage;
  // Legacy meta: ровно 10 записей, как писал предыдущий билд.
  const legacy = { slots: [] };
  for (let i = 0; i < 10; i++) legacy.slots.push({ name: 'Slot ' + (i + 1), lastSavedAt: i === 2 ? 1700000000000 : null });
  box.localStore.setItem('saveSlotsMeta_v1', JSON.stringify(legacy));

  const list = Storage.listSlots();
  assert(list && list.ok, 'listSlots() survives legacy meta');
  assertEqual(list.slots.length, 11, 'legacy meta padded up to 11 slots');
  assertEqual(list.slots[2].name, 'Slot 3', 'existing manual slot name preserved');
  assertEqual(list.slots[2].lastSavedAt, 1700000000000, 'existing lastSavedAt preserved');
  assertEqual(list.slots[WAVE_AUTO_SLOT_INDEX].hasData, false, 'new slot starts empty');
  assert(list.slots[WAVE_AUTO_SLOT_INDEX].name.length > 0, 'new slot has a default name');
});

test('WAS-12: wave autosave is deletable/resettable без затрагивания pre-retry слота', function () {
  const box = createStorageSandbox();
  const Storage = box.global.Game.Storage;
  Storage.saveSlot(AUTO_SLOT_INDEX, makeState({ coins: 40 }));
  Storage.saveWaveAutoSlot(makeState(), {});

  const del = Storage.deleteSlot(WAVE_AUTO_SLOT_INDEX);
  assert(del && del.ok, 'wave slot deleted');
  assertEqual(Storage.loadWaveAutoSlot().payload, null, 'wave slot is empty after delete');
  const preRetry = Storage.loadSlot(AUTO_SLOT_INDEX).payload;
  assert(preRetry && preRetry.coins === 40, 'pre-retry slot untouched by wave-slot delete');
});

/* ------------------------------------------------------------------ */
/*  Section 3 — game.js seam                                           */
/* ------------------------------------------------------------------ */

console.log('\n  Section 3: game.js wave-end seam');

test('WAS-13: saveWaveAutoSlotAfterWaveEnd() exists and uses the storage API', function () {
  assert(gameJs.indexOf('function saveWaveAutoSlotAfterWaveEnd()') !== -1, 'seam helper declared');
  const start = gameJs.indexOf('function saveWaveAutoSlotAfterWaveEnd()');
  const end = gameJs.indexOf('\nfunction ', start + 10);
  const body = gameJs.slice(start, end > start ? end : undefined);
  assert(body.indexOf('storageApi.saveWaveAutoSlot(') !== -1, 'delegates to Storage.saveWaveAutoSlot()');
  assert(body.indexOf('getAutoRetrySlotIndex') === -1, 'must not reuse the pre-retry slot reader');
});

test('WAS-14: seam is called on the attack active -> inactive transition only', function () {
  const start = gameJs.indexOf('function handleNoRepairAttackWaveTransition(wasAttackActive, attackActiveNow){');
  assert(start !== -1, 'transition handler exists');
  const end = gameJs.indexOf('\nfunction ', start + 10);
  const body = gameJs.slice(start, end > start ? end : undefined);
  const callIdx = body.indexOf('saveWaveAutoSlotAfterWaveEnd();');
  assert(callIdx !== -1, 'wave-end autosave is invoked from the transition handler');
  const finalizeIdx = body.indexOf('finalizeNoRepairAttackWaveEpisode();');
  assert(finalizeIdx !== -1 && callIdx > finalizeIdx,
    'autosave must run AFTER finalize so the payload has the awarded rewards');
  // begin-ветка (attackActiveNow && !wasAttackActive) не должна писать сейв.
  const beginIdx = body.indexOf('beginNoRepairAttackWaveEpisode();');
  assert(beginIdx !== -1 && callIdx > beginIdx, 'autosave must not sit in the begin branch');
});

test('WAS-15: seam is guarded against critical flow and destroyed supercomputer', function () {
  const start = gameJs.indexOf('function saveWaveAutoSlotAfterWaveEnd()');
  const end = gameJs.indexOf('\nfunction ', start + 10);
  const body = gameJs.slice(start, end > start ? end : undefined);
  assert(body.indexOf('if (criticalFlowActive) return false;') !== -1,
    'critical flow owns the pre-retry slot; wave autosave must bail out');
  assert(body.indexOf("sc.state === 'destroyed'") !== -1, 'destroyed supercomputer must not write a wave autosave');
  assert(body.indexOf('return false;') !== -1, 'seam reports failure instead of throwing');
});

/* ------------------------------------------------------------------ *
 * Section 3b — transition detection (регресс: автосейв не срабатывал)
 *
 * Баг: `updateWorldEvents()` вычислял `wasAttackActive` через
 * `isZombieAttackModeActive()` ДО `runtime.updateWorldEvents(dt)`, а `updateWorldEvents`
 * в первом кадре после конца волны обнуляет `currentAttackStartAt`/`attackEndAt`
 * ещё до чтения «после». Оба чтения давали `false`, переход true→false не
 * детектировался, и wave-autosave не вызывался никогда.
 * ------------------------------------------------------------------ */

console.log('\n  Section 3b: transition detection');

test('WAS-20: updateWorldEvents detects the transition via a persistent last-value latch', function () {
  const start = gameJs.indexOf('function updateWorldEvents(dt){');
  assert(start !== -1, 'updateWorldEvents exists');
  const end = gameJs.indexOf('\nfunction ', start + 10);
  const body = gameJs.slice(start, end > start ? end : undefined);
  assert(body.indexOf('zombieAttackModeActivePrev') !== -1,
    'latch variable must be used to compare against the previous frame');
  assert(body.indexOf('handleNoRepairAttackWaveTransition(zombieAttackModeActivePrev, attackActiveNow)') !== -1,
    'transition handler receives the latch value as "was"');
  assert(body.indexOf('zombieAttackModeActivePrev = attackActiveNow;') !== -1,
    'latch is updated after the comparison');
  // Anti-regression: чтение "до" и "после" вокруг runtime-update давало false→false.
  assert(!/const wasAttackActive = isZombieAttackModeActive\(\);\s*\n\s*ensureWorldEventsRuntimeController\(\)\?\.updateWorldEvents\(dt\);/.test(body),
    'must not read wasAttackActive before the runtime update (that produced false→false)');
  assert(body.indexOf('const attackActiveNow = isZombieAttackModeActive();') !== -1,
    'current active state is read AFTER the runtime update');
  assert(body.indexOf('ensureWorldEventsRuntimeController()?.updateWorldEvents(dt);') < body.indexOf('const attackActiveNow = isZombieAttackModeActive();'),
    'runtime update must run before reading the new state');
});

test('WAS-21: latch is declared with var so earlier callers cannot hit TDZ', function () {
  assert(/^(?:var zombieAttackModeActivePrev)/m.test(gameJs) || gameJs.indexOf('var zombieAttackModeActivePrev = false;') !== -1,
    'latch uses var (resetWorldEventsRuntimeForNewGame assigns it and is declared earlier)');
  assert(gameJs.indexOf('let zombieAttackModeActivePrev') === -1,
    'let would throw a TDZ ReferenceError from the earlier reset function');
});

test('WAS-22: world reset re-syncs the latch to avoid a phantom transition', function () {
  const start = gameJs.indexOf('function resetWorldEventsRuntimeForNewGame(){');
  assert(start !== -1, 'resetWorldEventsRuntimeForNewGame exists');
  const end = gameJs.indexOf('\nfunction ', start + 10);
  const body = gameJs.slice(start, end > start ? end : undefined);
  assert(body.indexOf('zombieAttackModeActivePrev = false;') !== -1,
    'reset must clear the latch, otherwise the first frame after restart fakes a true->false edge');
});

test('WAS-23: save restore re-syncs the latch to the loaded schedule', function () {
  const start = gameJs.indexOf('function restoreFullState(saved){');
  assert(start !== -1, 'restoreFullState exists');
  const end = gameJs.indexOf('function restoreSupercomputerAfterCritical(){', start);
  assert(end > start, 'restoreFullState body delimited');
  const body = gameJs.slice(start, end);
  const snapIdx = body.indexOf('applyLoadedAttackWaveSnapshot(');
  const syncIdx = body.indexOf('zombieAttackModeActivePrev = isZombieAttackModeActive();');
  assert(snapIdx !== -1, 'restore applies the attack-wave snapshot');
  assert(syncIdx !== -1, 'restore re-syncs the latch after replacing the schedule');
  assert(syncIdx > snapIdx, 'latch sync must follow the snapshot application');
});

/* ------------------------------------------------------------------ */
/*  Section 4 — UI wiring                                              */
/* ------------------------------------------------------------------ */

console.log('\n  Section 4: UI wiring');

test('WAS-16: small menu resolves bounds from Storage.SAVE_SLOTS_COUNT', function () {
  assert(bootstrapJs.indexOf('Number.isFinite(storageApi.SAVE_SLOTS_COUNT)') !== -1,
    'small menu reads SAVE_SLOTS_COUNT instead of a hardcoded 10');
  assert(bootstrapJs.indexOf('slotIndex > 9') === -1, 'hardcoded > 9 bound removed from small menu');
  assert(bootstrapJs.indexOf('isWaveAutoSlot(slot, index)') !== -1, 'wave-auto slot detection exists');
  assert(bootstrapJs.indexOf("opts.t('save.autoWaveName')") !== -1, 'wave-auto slot rendered via its own i18n key');
});

test('WAS-17: big menu Load resolves bounds and the wave-auto name', function () {
  assert(bigMenuJs.indexOf('function getBigMenuTotalSlotCount()') !== -1, 'big menu slot-count helper exists');
  assert(bigMenuJs.indexOf('slotIndex > 9') === -1, 'hardcoded > 9 bound removed from big menu');
  assert(bigMenuJs.indexOf("deps.t('save.autoWaveName')") !== -1, 'wave-auto slot rendered via its own i18n key');
});

test('WAS-18: i18n key save.autoWaveName exists in RU and EN (parity)', function () {
  assert(typeof ruJson['save.autoWaveName'] === 'string' && ruJson['save.autoWaveName'].length > 0,
    'ru.json has save.autoWaveName');
  assert(typeof enJson['save.autoWaveName'] === 'string' && enJson['save.autoWaveName'].length > 0,
    'en.json has save.autoWaveName');
  assert(ruJson['save.autoWaveName'] !== enJson['save.autoWaveName'], 'RU and EN strings are actually localized');
});

test('WAS-19: entry token is bumped and shared by the touched entry assets', function () {
  const m = indexHtml.match(/var token = '([^']+)'/);
  assert(m, 'entry token present');
  const entry = m[1];
  assertEqual(entry, '20260925-wave-autosave-latch-fix', 'entry token reflects this change');
  assert(indexHtml.indexOf('src/persistence/storage.js?v=' + entry) !== -1, 'storage.js carries the token');
  assert(indexHtml.indexOf('src/core/bootstrap.js?v=' + entry) !== -1, 'bootstrap.js carries the token');
  assert(indexHtml.indexOf('src/ui/bigMenuRuntime.js?v=' + entry) !== -1, 'bigMenuRuntime.js carries the token');
  assert(indexHtml.indexOf('src/i18n/fallbackStrings.js?v=' + entry) !== -1, 'fallbackStrings.js carries the token');
});

/* ------------------------------------------------------------------ */

console.log('\n==============================');
console.log('WaveAutosaveSlot: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(function (failure) {
    console.log('  - ' + failure.name + ': ' + failure.error);
  });
}
console.log('==============================\n');
process.exit(failCount > 0 ? 1 : 0);
