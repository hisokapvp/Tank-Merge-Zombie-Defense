'use strict';

/**
 * Pack 23: tutorial chip-install lesson must start on a WHOLE chip, not a fragment.
 *
 * Контракт (задача пользователя 2026-09-24):
 *   Цепочка обучения `first_whole_chip_open_supercomputer` ->
 *   `first_whole_chip_open_hangar_mods` -> `first_whole_chip_install_first_red_slot`
 *   объясняет игроку, как ВСТАВЛЯТЬ чипы. Значит её триггером обязан быть
 *   полученный игроком ЦЕЛЫЙ чип.
 *
 * Root cause:
 *   Коммит 5423250 заменил в шаге проверку `hasWholePlayerChip(state)` на
 *   `hasAnyPlayerOwnedChip(state)`. Новая функция считает валидным ЛЮБОЙ
 *   chip-ресурс: целые чипы, chip-фрагменты и уже установленные в ячейки чипы.
 *   Из-за этого игрок, получивший один ФРАГМЕНТ (например, из награды за
 *   достижение или из бокса военной помощи), немедленно получал урок
 *   «вставьте чип в красный слот», хотя вставлять ему нечего — чип ещё нужно
 *   скрафтить. Это ложный старт обучения.
 *
 * Инварианты, которые проверяет пак:
 *   WCG-1  Static: activation-гейт `first_whole_chip_supercomputer_entry`
 *          использует `hasWholePlayerChip`, а не `hasAnyPlayerOwnedChip`.
 *   WCG-2  Static: completion-гейт того же шага использует `hasWholePlayerChip`.
 *   WCG-3  Static: `hasWholePlayerChip` НЕ обращается ни к `playerFragments`,
 *          ни к установленным ячейкам — фрагменты и инсталлы не могут его
 *          удовлетворить по построению.
 *   WCG-4  RUNTIME: один только фрагмент (state mirror + HangarChipsUI
 *          `getPlayerFragments`) НЕ активирует шаг: bubble/pointer не
 *          поднимаются, pause-lock не берётся, `tutorial-modal-open` не
 *          появляется на body.
 *   WCG-5  RUNTIME: чип, УЖЕ установленный в слот ячейки, тоже НЕ активирует
 *          шаг (игрок не может «вставить» то, что уже вставлено).
 *   WCG-6  RUNTIME: настоящий целый чип в инвентаре (HangarChipsUI
 *          `getPlayerChips`) активирует шаг — pause-lock берётся и body-маркер
 *          появляется.
 *   WCG-7  RUNTIME: шаг остаётся недоступным через `hasExistingProgress`-ветку
 *          только для фрагментов и становится доступным, когда добавляется
 *          целый чип (положительный контроль WCG-6 в том же sandbox).
 *
 * Run: node Test/pack23/wholeChipTutorialGate.test.js
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

const root = path.resolve(__dirname, '../..');
const tutorialRuntimeSource = fs.readFileSync(path.join(root, 'src/ui/tutorialRuntime.js'), 'utf-8');
const tutorialStepsSource = fs.readFileSync(path.join(root, 'src/config/tutorialSteps.js'), 'utf-8');
const indexPath = path.join(root, 'index.html');

console.log('\n-- Pack 23: whole-chip tutorial gate --');

/* ------------------------------------------------------------------ *
 * WCG-1..3 — static guards on the gate plumbing
 * ------------------------------------------------------------------ */

test('WCG-1: first-chip activation gate requires a whole chip', function () {
  assert(
    tutorialRuntimeSource.indexOf('return hasWholePlayerChip(state) && !isGameplayBlockingModalOpen();') !== -1,
    'activation for first_whole_chip_supercomputer_entry must call hasWholePlayerChip(state)'
  );
  assert(
    tutorialRuntimeSource.indexOf('return hasAnyPlayerOwnedChip(state) && !isGameplayBlockingModalOpen();') === -1,
    'activation must not be downgraded back to hasAnyPlayerOwnedChip(state)'
  );
});

test('WCG-2: first-chip completion eligibility requires a whole chip', function () {
  assert(
    tutorialRuntimeSource.indexOf('return hasWholePlayerChip(state);') !== -1,
    'completion eligibility for first_whole_chip_supercomputer_entry must call hasWholePlayerChip(state)'
  );
  assert(
    tutorialRuntimeSource.indexOf('return hasAnyPlayerOwnedChip(state);') === -1,
    'completion eligibility must not be downgraded back to hasAnyPlayerOwnedChip(state)'
  );
});

test('WCG-3: hasWholePlayerChip cannot be satisfied by fragments or installed chips', function () {
  const start = tutorialRuntimeSource.indexOf('function hasWholePlayerChip(state)');
  const end = tutorialRuntimeSource.indexOf('function hasAnyPlayerOwnedChip(state)', start);
  assert(start !== -1 && end > start, 'hasWholePlayerChip helper body is present');
  const body = tutorialRuntimeSource.slice(start, end);
  assert(body.indexOf('playerFragments') === -1, 'whole-chip helper must not read playerFragments');
  assert(body.indexOf('getPlayerFragments') === -1, 'whole-chip helper must not read HangarChipsUI.getPlayerFragments');
  assert(body.indexOf('hangarCells') === -1, 'whole-chip helper must not read hangarCells');
  assert(body.indexOf('getCells') === -1, 'whole-chip helper must not read installed hangar cells');
  assert(body.indexOf('hasPlayerOwnedWholeChip') !== -1, 'whole-chip helper keeps the HangarChipsUI whole-chip probe');
  assert(body.indexOf('getPlayerChips') !== -1, 'whole-chip helper keeps the whole-chip inventory probe');
});

/* ------------------------------------------------------------------ *
 * Runtime harness — real tutorialRuntime.js in a sandbox
 * ------------------------------------------------------------------ */

function createBodyClassList() {
  const classes = {};
  return {
    classes: classes,
    contains(name) { return !!classes[name]; },
    toggle(name, force) {
      const next = typeof force === 'boolean' ? force : !classes[name];
      classes[name] = next;
      return next;
    },
    add(name) { classes[name] = true; },
    remove(name) { classes[name] = false; },
  };
}

function createHarness(options) {
  const opts = options || {};
  const body = { classList: createBodyClassList() };
  const globalObj = {
    window: null,
    Game: {},
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    getComputedStyle() { return { display: 'block', visibility: 'visible' }; },
  };
  globalObj.window = globalObj;

  new Function('window', 'global', tutorialStepsSource)(globalObj, globalObj);
  new Function('window', 'global', tutorialRuntimeSource)(globalObj, globalObj);

  const pauseCalls = { enter: 0, exit: 0 };

  const tutorialState = globalObj.Game.TutorialSteps.buildInitialTutorialState();
  const stepIds = Object.keys(tutorialState.steps);
  for (let i = 0; i < stepIds.length; i++) {
    tutorialState.steps[stepIds[i]] = { completed: true, dismissed: false, bubbleOpen: false, bubbleShown: true };
  }
  tutorialState.steps.first_whole_chip_open_supercomputer = {
    completed: false,
    dismissed: false,
    bubbleOpen: true,
    /* `bubbleShown: false` keeps the bubble from being auto-closed by
       `closeShownPendingBubble` when no DOM target can be resolved in this
       headless sandbox. Activation is then observable through the real
       pause-lock and the `tutorial-modal-open` body marker. */
    bubbleShown: false,
  };
  tutorialState.currentStepId = 'first_whole_chip_open_supercomputer';

  const state = {
    ui: { menuOpen: false },
    cells: [],
    buyCounts: {},
    achievements: { totalMerges: 0 },
    player: { damagePoints: 0, talentsV2: { ranksById: {} } },
    playerChips: [],
    playerFragments: opts.fragments || [],
    hangarCells: opts.hangarCells || [],
    tutorial: tutorialState,
  };

  const hangarUi = {
    getPlayerChips() { return opts.chips ? opts.chips() : []; },
    getPlayerFragments() { return opts.fragments || []; },
    getCells() { return opts.cells ? opts.cells() : []; },
  };
  if (opts.wholeChipProbe !== false) {
    hangarUi.hasPlayerOwnedWholeChip = function () {
      const chips = opts.chips ? opts.chips() : [];
      for (let i = 0; i < chips.length; i++) {
        if (chips[i] && Number(chips[i].count) > 0) return true;
      }
      return false;
    };
  }
  globalObj.Game.HangarChipsUI = hangarUi;

  globalObj.Game.TutorialRuntime.init({
    documentObj: {
      body: body,
      querySelector() { return null; },
      querySelectorAll() { return []; },
      getElementById() { return null; },
      createElement() { return { style: {}, setAttribute() {}, appendChild() {}, classList: { toggle() {}, add() {}, remove() {} } }; },
    },
    getState() { return state; },
    saveProgress() {},
    updateUi() {},
    enterCriticalPause() { pauseCalls.enter++; return true; },
    exitCriticalPause() { pauseCalls.exit++; return true; },
    t(key) { return key; },
  });

  return { state: state, pauseCalls: pauseCalls, body: body, syncNow: globalObj.Game.TutorialRuntime.syncNow };
}

const FRAGMENT_ONLY_STATE = [{ fragmentId: 7, count: 3 }];
const INSTALLED_ONLY_CELLS = [
  {
    index: 0,
    redSlots: { slot1: { chipId: 1, level: 1, modIds: [1, 2, 3] }, slot2: null },
    yellowSlots: { slot1: null, slot2: null, slot3: null, slot4: null },
  },
];

/* ------------------------------------------------------------------ *
 * WCG-4..6 — runtime behaviour
 * ------------------------------------------------------------------ */

test('WCG-4: a fragment alone does not start the chip-install lesson', function () {
  const harness = createHarness({ fragments: FRAGMENT_ONLY_STATE, chips: function () { return []; } });
  harness.syncNow();
  assertEqual(harness.pauseCalls.enter, 0, 'fragment-only inventory must not take the tutorial pause-lock');
  assertEqual(
    harness.body.classList.contains('tutorial-modal-open'),
    false,
    'fragment-only inventory must not mark the body as tutorial-modal-open'
  );
  assertEqual(
    harness.state.tutorial.currentStepId,
    'first_whole_chip_open_supercomputer',
    'step stays pending (not silently completed) while no whole chip exists'
  );
  assertEqual(
    harness.state.tutorial.steps.first_whole_chip_open_supercomputer.completed,
    false,
    'chip-install lessons must not complete from fragments'
  );
});

test('WCG-5: an already installed chip does not start the chip-install lesson', function () {
  const harness = createHarness({
    fragments: [],
    chips: function () { return []; },
    cells: function () { return INSTALLED_ONLY_CELLS; },
  });
  harness.syncNow();
  assertEqual(harness.pauseCalls.enter, 0, 'installed chips must not take the tutorial pause-lock');
  assertEqual(
    harness.body.classList.contains('tutorial-modal-open'),
    false,
    'installed chips must not mark the body as tutorial-modal-open'
  );
});

test('WCG-6: an owned whole chip starts the chip-install lesson', function () {
  const chips = [];
  const harness = createHarness({ fragments: FRAGMENT_ONLY_STATE, chips: function () { return chips; } });

  harness.syncNow();
  assertEqual(harness.pauseCalls.enter, 0, 'precondition: fragments alone are not enough');

  chips.push({ chipId: 1, chipColor: 'red', level: 1, count: 1, modIds: [1, 2, 3] });
  harness.syncNow();

  assertEqual(harness.pauseCalls.enter, 1, 'an owned whole chip must activate the step and take the pause-lock');
  assertEqual(
    harness.body.classList.contains('tutorial-modal-open'),
    true,
    'an owned whole chip must mark the body as tutorial-modal-open'
  );
});

/* ------------------------------------------------------------------ *
 * WCG-7 — completion eligibility is not satisfied by fragments
 * ------------------------------------------------------------------ */

test('WCG-7: chip-install completion stays blocked while only fragments are owned', function () {
  const chips = [];
  const harness = createHarness({ fragments: FRAGMENT_ONLY_STATE, chips: function () { return chips; } });
  harness.syncNow();
  harness.syncNow();
  assertEqual(
    harness.state.tutorial.steps.first_whole_chip_open_supercomputer.completed,
    false,
    'repeated syncs must not complete the step from fragments'
  );
  assertEqual(
    harness.state.tutorial.completed,
    false,
    'tutorial must not be marked completed while the chip lesson is still pending'
  );
});

/* ------------------------------------------------------------------ *
 * Static parity with the step config + entry token
 * ------------------------------------------------------------------ */

test('WCG-8: step config keeps the whole-chip chain wired to the same activation kind', function () {
  assert(
    tutorialStepsSource.indexOf("id: 'first_whole_chip_open_supercomputer'") !== -1,
    'chip lesson entry step is defined in the step config'
  );
  assert(
    tutorialStepsSource.indexOf("kind: 'first_whole_chip_supercomputer_entry'") !== -1,
    'chip lesson entry step keeps its activation kind'
  );
  assert(
    tutorialStepsSource.indexOf("id: 'first_whole_chip_install_first_red_slot'") !== -1,
    'chip install step is defined in the step config'
  );
});

test('WCG-9: entry token parity on index.html', function () {
  const indexBody = fs.readFileSync(indexPath, 'utf-8');
  const m = indexBody.match(/var token = '([^']+)'/);
  assert(m, 'entry token present');
  const token = m[1];
  assert(token !== '20260924-crate-modal-pause', 'token must be bumped when tutorialRuntime.js changes');
  const all = indexBody.match(/\?v=([A-Za-z0-9._-]+)/g) || [];
  assert(all.length > 0, 'found ?v= markers');
  const wrong = all.filter(function (x) { return x !== '?v=' + token; });
  assert(wrong.length === 0, 'all ?v= must equal the token; mismatches: ' + wrong.slice(0, 5).join(', '));
});

/* ------------------------------------------------------------------ */

console.log('\n-- Summary --');
console.log('Passed: ' + passCount);
console.log('Failed: ' + failCount);
if (failCount > 0) {
  for (const f of failures) console.log('  * ' + f.name + ': ' + f.error);
  process.exitCode = 1;
} else {
  console.log('All whole-chip tutorial gate checks passed.');
}
