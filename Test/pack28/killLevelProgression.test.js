'use strict';

/**
 * Pack 28: альтернативный путь получения уровня — убийства.
 *
 * ТЗ: уровень можно получить либо накопив нужное количество опыта, либо
 * убив 500 000 зомби. Дополнительная шкала не нужна — прогресс виден в
 * тултипе полоски опыта. Счётчик убийств для повышения уровня (НЕ тот,
 * что выведен в терминале суперкомпьютера) сбрасывается после каждого
 * полученного уровня.
 *
 * Контракт:
 *   * счётчик — `supercomputer.levelKills`, отдельный от `state.kills`;
 *   * порог — 500 000 (`LEVEL_KILL_THRESHOLD` / `killLevelThreshold`);
 *   * сброс — после ЛЮБОГО полученного уровня (и по XP, и по убийствам);
 *   * остаток сверх порога НЕ переносится (сброс в 0, а не -= threshold);
 *   * награды/модалка/VFX идут через тот же seam, что и XP-путь.
 *
 * Cases:
 *   KLP-1  levelFlow принимает killLevelThreshold и отдаёт его через getKillLevelThreshold().
 *   KLP-2  grantKillProgress копит levelKills, не трогая state.kills.
 *   KLP-3  при достижении порога выдаётся ровно один уровень.
 *   KLP-4  счётчик сбрасывается в 0 после уровня (остаток не переносится).
 *   KLP-5  уровень по убийствам выдаёт те же награды, что и XP-путь.
 *   KLP-6  уровень, полученный по XP, тоже сбрасывает levelKills.
 *   KLP-7  на maxLevel прогресс не копится и уровень не выдаётся.
 *   KLP-8  битые/отрицательные значения levelKills нормализуются в 0.
 *   KLP-9  game.js: kill-seam вызывает grantKillProgress(1) рядом с grantXP.
 *   KLP-10 game.js: LEVEL_KILL_THRESHOLD === 500000 и проброшен в levelFlow.
 *   KLP-11 initialState.js: supercomputer.levelKills стартует с 0.
 *   KLP-12 worldReset.js: levelKills входит в partial-reset snapshot/restore.
 *   KLP-13 supercomputer.js: ensureSupercomputerState нормализует levelKills.
 *   KLP-14 i18n ru/en/fallback несут levelAltKillTooltip с {kills} и {target}.
 *   KLP-15 game.js: полоска опыта несёт data-ui-tooltip-provider="xpLevel".
 *   KLP-16 bootstrap.js: обработчики ищут и provider-элементы.
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
  } catch (err) {
    failCount++;
    failures.push({ name: name, error: err.message });
    console.log('  [FAIL] ' + name + ' - ' + err.message);
  }
}

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
}

function loadModule(rel, sandbox) {
  const code = read(rel);
  vm.runInContext(code, sandbox, { filename: rel });
  return sandbox;
}

function createSandbox() {
  const windowObj = {};
  const sandbox = {
    window: windowObj,
    console: console,
    Math: Math,
    Date: Date,
    JSON: JSON,
    Object: Object,
    Array: Array,
    Number: Number,
    String: String,
    Boolean: Boolean,
    Error: Error,
    isFinite: isFinite,
    parseInt: parseInt,
    parseFloat: parseFloat,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
  };
  sandbox.globalThis = sandbox;
  windowObj.window = windowObj;
  return vm.createContext(sandbox);
}

const THRESHOLD = 500000;

/** Минимальный state + контроллер levelFlow с фиксированными наградами. */
function makeLevelFlow(overrides) {
  const opts = overrides || {};
  const state = {
    coins: 0,
    kills: 0,
    ui: { levelReward: null, levelRewardTimer: 0 },
    supercomputer: {
      computerLevel: 1,
      xp: 0,
      xpToNext: 100,
      levelKills: 0,
      maxLevel: 60,
      maxHp: 1000,
      hp: 1000,
      armorFlat: 0,
      eventShown40: false,
      eventShown50: false,
      eventShown60: false,
    },
    player: { talentPoints: 0 },
  };
  if (opts.stateMutator) opts.stateMutator(state);

  const sandbox = createSandbox();
  loadModule('src/mechanics/levelFlow.js', sandbox);
  const Game = sandbox.window.Game;

  const lf = Game.LevelFlow.createLevelFlow({
    state: state,
    ui: {},
    BAL: {},
    UIModals: {
      openLevelModal: function (o) { if (o && o.updateLevelModal) o.updateLevelModal(); },
      closeLevelModal: function () {},
    },
    xpNeededForLevel: function () { return 100; },
    levelGoldReward: function () { return 25; },
    killLevelThreshold: opts.threshold != null ? opts.threshold : THRESHOLD,
    onComputerLevelChanged: function () {},
    checkPowerMomentEvents: function () {},
    playSfx: function () {},
    saveProgress: function () {},
    updateUI: function () {},
    showCenterNotification: function () {},
    nowSec: function () { return 0; },
    windowObj: { clearTimeout: function () {} },
  });

  return { lf: lf, state: state };
}

console.log('\n── KLP: kill-based level progression ──');

test('KLP-1: levelFlow exposes the configured kill threshold', function () {
  const ctx = makeLevelFlow();
  assertEqual(ctx.lf.getKillLevelThreshold(), THRESHOLD, 'threshold must round-trip');
});

test('KLP-2: grantKillProgress accumulates levelKills without touching state.kills', function () {
  const ctx = makeLevelFlow();
  ctx.lf.grantKillProgress(10);
  assertEqual(ctx.state.supercomputer.levelKills, 10, 'levelKills accumulates');
  assertEqual(ctx.state.kills, 0, 'HUD kills counter must stay untouched');
});

test('KLP-3: reaching the threshold grants exactly one level', function () {
  const ctx = makeLevelFlow();
  ctx.lf.grantKillProgress(THRESHOLD);
  assertEqual(ctx.state.supercomputer.computerLevel, 2, 'one level gained');
});

test('KLP-4: the kill counter resets to 0 after a level (no carry-over)', function () {
  const ctx = makeLevelFlow();
  ctx.lf.grantKillProgress(THRESHOLD + 12345);
  assertEqual(ctx.state.supercomputer.levelKills, 0, 'counter resets, remainder is dropped');
  assertEqual(ctx.state.supercomputer.computerLevel, 2, 'only one level from one threshold');
});

test('KLP-5: kill-based level grants the same rewards as the XP path', function () {
  const killCtx = makeLevelFlow();
  killCtx.lf.grantKillProgress(THRESHOLD);

  const xpCtx = makeLevelFlow();
  xpCtx.lf.grantXP(100);

  assertEqual(killCtx.state.coins, xpCtx.state.coins, 'gold parity');
  assertEqual(killCtx.state.player.talentPoints, xpCtx.state.player.talentPoints, 'talent points parity');
  assertEqual(killCtx.state.supercomputer.computerLevel, xpCtx.state.supercomputer.computerLevel, 'level parity');
});

test('KLP-6: an XP level-up also resets the kill counter', function () {
  const ctx = makeLevelFlow();
  ctx.lf.grantKillProgress(THRESHOLD - 1);
  assertEqual(ctx.state.supercomputer.levelKills, THRESHOLD - 1, 'progress accumulated');
  ctx.lf.grantXP(100);
  assertEqual(ctx.state.supercomputer.computerLevel, 2, 'XP granted a level');
  assertEqual(ctx.state.supercomputer.levelKills, 0, 'XP level-up resets kill counter');
});

test('KLP-7: at maxLevel kill progress is neither stored nor converted', function () {
  const ctx = makeLevelFlow({
    stateMutator: function (s) { s.supercomputer.computerLevel = 60; },
  });
  const gained = ctx.lf.grantKillProgress(THRESHOLD * 3);
  assertEqual(gained, 0, 'no levels past maxLevel');
  assertEqual(ctx.state.supercomputer.levelKills, 0, 'no progress stored at maxLevel');
});

test('KLP-8: broken levelKills values normalize to 0', function () {
  const ctx = makeLevelFlow({
    stateMutator: function (s) { s.supercomputer.levelKills = -50; },
  });
  ctx.lf.grantKillProgress(5);
  assertEqual(ctx.state.supercomputer.levelKills, 5, 'negative value normalized before increment');
});

test('KLP-9: game.js kill seam calls grantKillProgress(1) next to grantXP', function () {
  const src = read('game.js');
  assert(/grantXP\(_killXp\);\s*\n[\s\S]{0,400}?grantKillProgress\(1\);/.test(src),
    'kill seam must feed the per-level kill counter');
});

test('KLP-10: game.js defines LEVEL_KILL_THRESHOLD = 500000 and passes it to levelFlow', function () {
  const src = read('game.js');
  assert(/const LEVEL_KILL_THRESHOLD = 500000;/.test(src), 'threshold constant must be 500000');
  assert(/killLevelThreshold:\s*LEVEL_KILL_THRESHOLD/.test(src), 'threshold must be wired into createLevelFlow');
});

test('KLP-11: initialState.js seeds supercomputer.levelKills = 0', function () {
  const src = read('src/persistence/initialState.js');
  assert(/supercomputer:\s*\{[\s\S]{0,400}?levelKills:\s*0/.test(src), 'initial levelKills must be 0');
});

test('KLP-12: worldReset.js keeps levelKills in the partial-reset snapshot', function () {
  const src = read('src/core/worldReset.js');
  const take = src.indexOf('function takeProgressSnapshot');
  const restore = src.indexOf('function restoreProgressSnapshot');
  assert(take !== -1 && restore !== -1, 'both snapshot functions must exist');
  const takeBody = src.slice(take, restore);
  const restoreBody = src.slice(restore);
  assert(/levelKills:\s*toSafeInt\(supercomputer\.levelKills/.test(takeBody), 'snapshot must capture levelKills');
  assert(/target\.supercomputer\.levelKills = toSafeInt\(supercomputer\.levelKills/.test(restoreBody), 'restore must apply levelKills');
});

test('KLP-13: ensureSupercomputerState normalizes levelKills', function () {
  const src = read('src/mechanics/supercomputer.js');
  assert(/sc\.levelKills = Number\.isFinite\(sc\.levelKills\)/.test(src), 'normalizer must clamp levelKills');
});

test('KLP-14: i18n carries levelAltKillTooltip with {kills} and {target} in ru/en/fallback', function () {
  const ru = JSON.parse(read('src/i18n/ru.json'));
  const en = JSON.parse(read('src/i18n/en.json'));
  const fb = read('src/i18n/fallbackStrings.js');
  for (const [label, dict] of [['ru', ru], ['en', en]]) {
    const text = dict.levelAltKillTooltip;
    assert(typeof text === 'string' && text.length > 0, label + ' key must exist');
    assert(text.indexOf('{kills}') !== -1, label + ' must interpolate {kills}');
    assert(text.indexOf('{target}') !== -1, label + ' must interpolate {target}');
  }
  const fbMatches = fb.match(/levelAltKillTooltip:/g) || [];
  assertEqual(fbMatches.length, 2, 'fallback must carry the key for both ru and en');
});

test('KLP-15: the XP bar carries the dynamic tooltip provider hook', function () {
  const src = read('game.js');
  assert(/data-ui-tooltip-provider="xpLevel"/.test(src), 'markup must declare the provider');
  assert(/TooltipProviders\.xpLevel/.test(src), 'provider must be registered');
  assert(/levelAltKillTooltip/.test(src), 'provider must build the i18n tooltip text');
});

test('KLP-16: bootstrap tooltip handlers also match provider elements', function () {
  const src = read('src/core/bootstrap.js');
  const matches = src.match(/closest\('\[data-ui-tooltip\],\[data-ui-tooltip-provider\]'\)/g) || [];
  assertEqual(matches.length, 2, 'pointerover and touchstart must both match provider elements');
  assert(/data-ui-tooltip-provider/.test(src), 'bootstrap must read the provider attribute');
});

console.log('\nPack 28 results: ' + passCount + ' passed, ' + failCount + ' failed');
if (failCount > 0) {
  console.log('\nFailures:');
  failures.forEach(function (f) { console.log('  - ' + f.name + ': ' + f.error); });
  process.exit(1);
}
