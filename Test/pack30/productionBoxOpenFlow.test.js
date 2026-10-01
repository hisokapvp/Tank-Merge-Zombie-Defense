/**
 * Pack 30 — Production-storage box-open flow (ad / no-ad / level-4 boost).
 *
 * Контракт (2026-09-29, задача пользователя):
 *   1) Нажатие на бокс открывает выбор: «Нет» / «Открыть» (без рекламы) /
 *      «Открыть» + значок рекламы.
 *   2) Обычная «Открыть» показывает предупреждение о пониженном шансе
 *      редкого дропа и открывает бокс с обычным шансом.
 *   3) Ad-кнопка для уровней 1–3 сразу запускает рекламу и даёт x2 к весу
 *      редких дропов (drone, two_big_chips) внутри пула уровня.
 *   4) Ad-кнопка для уровня 4 сначала показывает выбор цели («Дрон» / «2 чипа»,
 *      single-select, default «Дрон»), и «Принять» даёт +25% к выбранному
 *      предмету (замена x2, не дополнение).
 *   5) Веса LOOT_TABLE / LOOT_POOLS_BY_LEVEL иммутабельны — boost применяется
 *      локально в rollLootForLevel(level, boost).
 *
 * Run: node Test/pack30/productionBoxOpenFlow.test.js
 */

'use strict';

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

const ROOT = path.resolve(__dirname, '..', '..');
const mechSrc = fs.readFileSync(path.join(ROOT, 'src', 'mechanics', 'productionLine.js'), 'utf8');
const uiSrc = fs.readFileSync(path.join(ROOT, 'src', 'ui', 'productionLineUI.js'), 'utf8');
const indexSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const gameSrc = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8');

console.log('\n── Pack 30: production box-open flow ──');

// ════════════════════════════════════════════════════════════════
//  Section 1 — mechanics: boost contract
// ════════════════════════════════════════════════════════════════
console.log('\n  --- Section 1: boost mechanics ---');

test('BOOST-1: rare-drop constants declared', () => {
  assert(mechSrc.indexOf('RARE_LOOT_IDS') !== -1, 'RARE_LOOT_IDS present');
  assert(mechSrc.indexOf('AD_RARE_MULTIPLIER') !== -1, 'AD_RARE_MULTIPLIER present');
  assert(mechSrc.indexOf('AD_LEVEL4_TARGET_ADD_PP') !== -1, 'AD_LEVEL4_TARGET_ADD_PP present');
  assert(/AD_RARE_MULTIPLIER\s*=\s*2\b/.test(mechSrc), 'rare multiplier is 2');
  assert(/AD_LEVEL4_TARGET_ADD_PP\s*=\s*0\.25\b/.test(mechSrc), 'level-4 add is 0.25 (25 pp)');
});

test('BOOST-2: rollLootForLevel accepts an optional boost argument', () => {
  assert(/function rollLootForLevel\(level,\s*boost\)/.test(mechSrc), 'signature has boost param');
  assert(mechSrc.indexOf('resolveBoostSpec') !== -1, 'boost resolver present');
});

test('BOOST-3: levels 1-3 boost doubles both rare drops', () => {
  const fn = mechSrc.slice(mechSrc.indexOf('function resolveBoostSpec'));
  const body = fn.slice(0, fn.indexOf('\n  function ', 10));
  assert(body.indexOf('boost.rare === true') !== -1, 'rare flag handled');
  assert(body.indexOf("mode: 'double'") !== -1, 'double mode used');
  assert(body.indexOf("ids: ['drone', 'two_big_chips']") !== -1, 'both rare drops targeted');
});

test('BOOST-4: level 4 boost targets exactly one drop at +25 pp', () => {
  const fn = mechSrc.slice(mechSrc.indexOf('function resolveBoostSpec'));
  const body = fn.slice(0, fn.indexOf('\n  function ', 10));
  assert(body.indexOf('normalizedLevel >= MAX_BOX_LEVEL') !== -1, 'level-4 branch present');
  assert(body.indexOf("target !== 'drone' && target !== 'two_big_chips'") !== -1, 'only the two rare targets allowed');
  assert(body.indexOf("mode: 'add'") !== -1, 'add mode used');
  assert(body.indexOf('addPp: AD_LEVEL4_TARGET_ADD_PP') !== -1, 'single target gets +25 pp');
});

test('BOOST-5: LOOT_TABLE weights are never mutated by the boost', () => {
  // The boosted path must recompute probabilities locally, not write back.
  assert(mechSrc.indexOf('entries[i].weight =') === -1, 'no in-place weight write');
  assert(mechSrc.indexOf('restScale') !== -1, 'remaining probability rescaled locally');
});

test('BOOST-6: openBox forwards the boost to the roll', () => {
  assert(/function openBox\(state,\s*boxIndex,\s*boost\)/.test(mechSrc), 'openBox signature has boost');
  assert(mechSrc.indexOf('rollLootForLevel(box.level, boost)') !== -1, 'boost forwarded to roll');
  assert(mechSrc.indexOf('boosted: !!boost') !== -1, 'result records boosted flag');
});

test('BOOST-7: boost API is exported', () => {
  assert(mechSrc.indexOf('rollLootForLevel: rollLootForLevel') !== -1, 'rollLootForLevel exported');
  assert(mechSrc.indexOf('resolveBoostSpec: resolveBoostSpec') !== -1, 'resolver exported');
  assert(mechSrc.indexOf('RARE_LOOT_IDS: RARE_LOOT_IDS') !== -1, 'RARE_LOOT_IDS exported');
});

// ── Behavioural distribution checks (load the real module) ──────
function loadProductionLine() {
  const sandbox = { Game: {} };
  const vm = require('vm');
  vm.createContext(sandbox);
  vm.runInContext(mechSrc, sandbox, { filename: 'productionLine.js' });
  return sandbox.Game.ProductionLine;
}

function sampleDistribution(PL, level, boost, runs) {
  const counts = Object.create(null);
  for (let i = 0; i < runs; i++) {
    const loot = PL.rollLootForLevel(level, boost);
    counts[loot.id] = (counts[loot.id] || 0) + 1;
  }
  return counts;
}

test('BOOST-8: level-4 drone boost yields ~75% drone / ~25% chips', () => {
  const PL = loadProductionLine();
  const runs = 20000;
  const counts = sampleDistribution(PL, 4, { target: 'drone' }, runs);
  const dronePct = (counts.drone || 0) / runs;
  const chipsPct = (counts.two_big_chips || 0) / runs;
  assert(Math.abs(dronePct - 0.75) < 0.03, 'drone ≈ 75% (got ' + dronePct.toFixed(3) + ')');
  assert(Math.abs(chipsPct - 0.25) < 0.03, 'chips ≈ 25% (got ' + chipsPct.toFixed(3) + ')');
});

test('BOOST-9: level-4 chips boost yields ~75% chips / ~25% drone', () => {
  const PL = loadProductionLine();
  const runs = 20000;
  const counts = sampleDistribution(PL, 4, { target: 'two_big_chips' }, runs);
  const chipsPct = (counts.two_big_chips || 0) / runs;
  const dronePct = (counts.drone || 0) / runs;
  assert(Math.abs(chipsPct - 0.75) < 0.03, 'chips ≈ 75% (got ' + chipsPct.toFixed(3) + ')');
  assert(Math.abs(dronePct - 0.25) < 0.03, 'drone ≈ 25% (got ' + dronePct.toFixed(3) + ')');
});

test('BOOST-10: level-1 rare boost doubles rare drops and shrinks common ones', () => {
  const PL = loadProductionLine();
  const runs = 40000;
  const base = sampleDistribution(PL, 1, null, runs);
  const boosted = sampleDistribution(PL, 1, { rare: true }, runs);
  const baseDrone = (base.drone || 0) / runs;
  const boostedDrone = (boosted.drone || 0) / runs;
  // Base drone = 1/100 = 1%; doubled → 2%.
  assert(Math.abs(baseDrone - 0.01) < 0.005, 'base drone ≈ 1% (got ' + baseDrone.toFixed(4) + ')');
  assert(Math.abs(boostedDrone - 0.02) < 0.006, 'boosted drone ≈ 2% (got ' + boostedDrone.toFixed(4) + ')');
  // The most common drop (5 silicon dust, 40%) must lose probability.
  const baseCommon = (base.five_silicon_dust || 0) / runs;
  const boostedCommon = (boosted.five_silicon_dust || 0) / runs;
  assert(boostedCommon < baseCommon, 'common drop shrinks (' + baseCommon.toFixed(4) + ' → ' + boostedCommon.toFixed(4) + ')');
});

test('BOOST-11: boosted probabilities always sum to 100%', () => {
  const PL = loadProductionLine();
  const runs = 40000;
  for (const level of [1, 2, 3, 4]) {
    const boost = level >= 4 ? { target: 'drone' } : { rare: true };
    const counts = sampleDistribution(PL, level, boost, runs);
    let total = 0;
    for (const id in counts) total += counts[id];
    assertEqual(total, runs, 'level ' + level + ' total samples');
  }
});

// ════════════════════════════════════════════════════════════════
//  Section 2 — UI: three-screen confirm flow
// ════════════════════════════════════════════════════════════════
console.log('\n  --- Section 2: confirm flow UI ---');

test('UI-1: choice screen has Нет / Открыть / Открыть+ad', () => {
  assert(indexSrc.indexOf('id="plConfirmNo"') !== -1, 'Нет button present');
  assert(indexSrc.indexOf('id="plConfirmOpenPlain"') !== -1, 'plain Открыть button present');
  assert(indexSrc.indexOf('id="plConfirmYes"') !== -1, 'ad Открыть button present');
  assert(indexSrc.indexOf('talentResetCooldownAdBtn__icon') !== -1, 'ad icon present');
  assert(indexSrc.indexOf('id="plConfirmAdHint"') !== -1, 'ad hint present');
});

test('UI-2: no-ad warning screen has text + Нет / Да', () => {
  assert(indexSrc.indexOf('id="plConfirmNoAdScreen"') !== -1, 'no-ad screen present');
  assert(indexSrc.indexOf('id="plConfirmNoAdText"') !== -1, 'warning text present');
  assert(indexSrc.indexOf('id="plConfirmNoAdNo"') !== -1, 'Нет present');
  assert(indexSrc.indexOf('id="plConfirmNoAdYes"') !== -1, 'Да present');
});

test('UI-3: level-4 boost screen has radiogroup + Нет / Принять', () => {
  assert(indexSrc.indexOf('id="plConfirmBoostScreen"') !== -1, 'boost screen present');
  assert(indexSrc.indexOf('role="radiogroup"') !== -1, 'radiogroup semantics');
  assert(indexSrc.indexOf('id="plBoostDrone"') !== -1, 'drone radio present');
  assert(indexSrc.indexOf('id="plBoostChips"') !== -1, 'chips radio present');
  assert(indexSrc.indexOf('id="plConfirmBoostNo"') !== -1, 'Нет present');
  assert(indexSrc.indexOf('id="plConfirmBoostAccept"') !== -1, 'Принять present');
});

test('UI-4: drone radio is checked by default (single-select)', () => {
  const droneTag = indexSrc.slice(indexSrc.indexOf('id="plBoostDrone"'));
  assert(droneTag.slice(0, 120).indexOf('checked') !== -1, 'drone checked by default');
  assert(indexSrc.indexOf('name="plBoostTarget"') !== -1, 'shared radio name enforces single-select');
});

test('UI-5: UI wires every confirm button', () => {
  assert(uiSrc.indexOf("getElementById('plConfirmOpenPlain')") !== -1, 'plain button wired');
  assert(uiSrc.indexOf("getElementById('plConfirmNoAdYes')") !== -1, 'no-ad yes wired');
  assert(uiSrc.indexOf("getElementById('plConfirmNoAdNo')") !== -1, 'no-ad no wired');
  assert(uiSrc.indexOf("getElementById('plConfirmBoostAccept')") !== -1, 'boost accept wired');
  assert(uiSrc.indexOf("getElementById('plConfirmBoostNo')") !== -1, 'boost no wired');
});

test('UI-6: level-4 ad button defers the ad until Принять', () => {
  const fn = uiSrc.slice(uiSrc.indexOf('function _confirmOpenAd'));
  const body = fn.slice(0, fn.indexOf('\n  function ', 10));
  assert(body.indexOf('_showBoostScreen()') !== -1, 'level-4 shows picker first');
  assert(body.indexOf('_requestAdThenOpen({ rare: true })') !== -1, 'levels 1-3 request ad immediately');
});

test('UI-7: boost target resets to drone on each open', () => {
  assert(uiSrc.indexOf('function _resetBoostTarget') !== -1, 'reset helper present');
  const fn = uiSrc.slice(uiSrc.indexOf('function _resetBoostTarget'));
  const body = fn.slice(0, fn.indexOf('\n  function ', 10));
  assert(body.indexOf('drone.checked = true') !== -1, 'drone re-checked');
  assert(body.indexOf('chips.checked = false') !== -1, 'chips cleared');
});

test('UI-8: early ad close keeps the player on the screen (no open)', () => {
  const fn = uiSrc.slice(uiSrc.indexOf('function _requestAdThenOpen'));
  const body = fn.slice(0, fn.indexOf('\n  function ', 10));
  assert(body.indexOf('result.success !== true') !== -1, 'success checked');
  assert(body.indexOf('_openBoxWithBoost(boost)') !== -1, 'open only on success');
});

// ════════════════════════════════════════════════════════════════
//  Section 3 — wiring + i18n parity
// ════════════════════════════════════════════════════════════════
console.log('\n  --- Section 3: wiring + i18n ---');

test('WIRE-1: game.js onOpenBox forwards the boost', () => {
  assert(gameSrc.indexOf('onOpenBox: function (boxIndex, boost)') !== -1, 'boost param present');
  assert(gameSrc.indexOf('PL.openBox(state, boxIndex, boost || null)') !== -1, 'boost forwarded');
});

test('I18N-1: new keys exist in ru + en + fallback (both locales)', () => {
  const ru = fs.readFileSync(path.join(ROOT, 'src', 'i18n', 'ru.json'), 'utf8');
  const en = fs.readFileSync(path.join(ROOT, 'src', 'i18n', 'en.json'), 'utf8');
  const fb = fs.readFileSync(path.join(ROOT, 'src', 'i18n', 'fallbackStrings.js'), 'utf8');
  const keys = ['plConfirmAdHint', 'plConfirmNoAdText', 'plConfirmBoostText', 'plConfirmBoostDrone', 'plConfirmBoostChips', 'plConfirmBoostAccept', 'plConfirmYesShort'];
  for (let i = 0; i < keys.length; i++) {
    assert(ru.indexOf('"' + keys[i] + '"') !== -1, 'ru has ' + keys[i]);
    assert(en.indexOf('"' + keys[i] + '"') !== -1, 'en has ' + keys[i]);
    assertEqual((fb.match(new RegExp(keys[i], 'g')) || []).length, 2, 'fallback has both locales for ' + keys[i]);
  }
});

test('I18N-2: ad hint text matches the user spec', () => {
  const ru = fs.readFileSync(path.join(ROOT, 'src', 'i18n', 'ru.json'), 'utf8');
  assert(ru.indexOf('Х2 шанс на самый редкий дроп') !== -1, 'ad hint copy present');
  assert(ru.indexOf('Увеличить шанс выпадения для:') !== -1, 'boost title copy present');
});

test('I18N-3: no-ad warning text matches the user spec', () => {
  const ru = fs.readFileSync(path.join(ROOT, 'src', 'i18n', 'ru.json'), 'utf8');
  assert(ru.indexOf('Открывая бокс без просмотра рекламы') !== -1, 'warning copy present');
  assert(ru.indexOf('в 2 раза ниже') !== -1, 'halved-chance copy present');
});

// ════════════════════════════════════════════════════════════════
//  Summary
// ════════════════════════════════════════════════════════════════
console.log('\n── Pack 30 summary ──');
console.log('  Passed: ' + passCount);
console.log('  Failed: ' + failCount);
if (failCount > 0) {
  console.log('\n  Failures:');
  for (let i = 0; i < failures.length; i++) {
    console.log('    - ' + failures[i].name + ': ' + failures[i].error);
  }
  process.exit(1);
}
console.log('  All checks passed.');
