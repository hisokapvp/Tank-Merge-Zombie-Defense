/**
 * Pack 4 — first-run tutorial and start-state regressions.
 * Run: node Test/pack4/tutorial_first_run_runtime.test.js
 */

let passCount = 0;
let failCount = 0;
const failures = [];

function assert(condition, message) {
  if (!condition) throw new Error('Assertion failed: ' + message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error((message || 'assertEqual') + ': expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
  }
}

function test(name, fn) {
  try {
    fn();
    passCount += 1;
    console.log('  OK ' + name);
  } catch (error) {
    failCount += 1;
    failures.push({ name, error: error.message });
    console.log('  FAIL ' + name + ' - ' + error.message);
  }
}

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const gameJs = fs.readFileSync(path.join(root, 'game.js'), 'utf-8');
const bootstrapJs = fs.readFileSync(path.join(root, 'src/core/bootstrap.js'), 'utf-8');
const tutorialStepsJs = fs.readFileSync(path.join(root, 'src/config/tutorialSteps.js'), 'utf-8');
const tutorialRuntimeJs = fs.readFileSync(path.join(root, 'src/ui/tutorialRuntime.js'), 'utf-8');
const tutorialCursorConfig = fs.readFileSync(path.join(root, 'assets/tutotialCursore.json'), 'utf-8');
const hangarChipsUiJs = fs.readFileSync(path.join(root, 'src/ui/hangarChipsUI.js'), 'utf-8');
const storageJs = fs.readFileSync(path.join(root, 'src/persistence/storage.js'), 'utf-8');
const garageJs = fs.readFileSync(path.join(root, 'src/mechanics/garage.js'), 'utf-8');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf-8');
const ru = fs.readFileSync(path.join(root, 'src/i18n/ru.json'), 'utf-8');
const en = fs.readFileSync(path.join(root, 'src/i18n/en.json'), 'utf-8');
const fallback = fs.readFileSync(path.join(root, 'src/i18n/fallbackStrings.js'), 'utf-8');
const worldResetJs = fs.readFileSync(path.join(root, 'src/core/worldReset.js'), 'utf-8');

console.log('\n-- Pack 4: First-run tutorial runtime --');

test('TUT-1: createInitialState starts with 40 coins and starter_tank tutorial step', () => {
  const globalObj = globalThis;
  globalObj.window = globalObj;
  globalObj.Game = {};

  const tutorialStepsCode = fs.readFileSync(path.join(root, 'src/config/tutorialSteps.js'), 'utf-8');
  const tutorialStepsFn = new Function('window', 'global', tutorialStepsCode);
  tutorialStepsFn(globalObj, globalObj);

  const code = fs.readFileSync(path.join(root, 'src/persistence/initialState.js'), 'utf-8');
  const fn = new Function('window', 'global', code);
  fn(globalObj, globalObj);

  const state = globalObj.Game.InitialState.createInitialState({ reason: 'new_game' });
  assertEqual(state.coins, 40, 'new game starts with 40 coins');
  assertEqual(state.tutorial.version, 5, 'tutorial state uses data-driven schema version 5');
  assert(state.tutorial && state.tutorial.currentStepId === 'starter_tank', 'starter tutorial step exists');
  assert(state.tutorial.steps && state.tutorial.steps.starter_tank && state.tutorial.steps.starter_tank.completed === false, 'starter tutorial step is pending');
  assert(state.tutorial.steps.starter_tank.bubbleOpen === true, 'starter tutorial bubble starts open');
  assert(state.tutorial.steps.merge_tank && state.tutorial.steps.merge_tank.completed === false, 'merge tutorial step is present and pending');
});

test('TUT-2: starter tank spawn and pre-retry reset keep the tank in hangar', () => {
  assert(gameJs.indexOf('cell.tank = makeTank(1, false, { enableStamp: false });') !== -1, 'starter tank spawns with onTrack=false and no stamp');
  const firstSpawnIdx = gameJs.indexOf('function spawnInitialTanksLvl1');
  const secondSpawnIdx = gameJs.indexOf('function clearAllTanksFromCells', firstSpawnIdx);
  const spawnBlock = firstSpawnIdx !== -1 && secondSpawnIdx !== -1 ? gameJs.slice(firstSpawnIdx, secondSpawnIdx) : '';
  assert(spawnBlock.indexOf('makeTank(1, false') !== -1, 'spawnInitialTanksLvl1 keeps starter tank in hangar');
  const retryIdx = gameJs.indexOf('function applyPreRetryRuntimeReset');
  const retryEndIdx = gameJs.indexOf('function buildPreRetryPayload', retryIdx);
  const retryBlock = retryIdx !== -1 && retryEndIdx !== -1 ? gameJs.slice(retryIdx, retryEndIdx) : '';
  assert(retryBlock.indexOf('makeTank(1, false)') !== -1, 'partial reset seeds hangar tank, not track tank');
});

test('TUT-3: bootstrap seeds exactly one starter tank and initializes tutorial runtime', () => {
  assert(bootstrapJs.indexOf('opts.ensureStarterTanks(getState(), 1);') !== -1, 'bootstrap seeds one starter tank');
  assert(bootstrapJs.indexOf('windowObj.Game.TutorialRuntime.init({') !== -1, 'bootstrap initializes tutorial runtime');
});

test('TUT-4: tutorial state is serialized and preserved by world reset snapshot', () => {
  assert(storageJs.indexOf('tutorial: state.tutorial || null') !== -1, 'storage serializes tutorial state');
  assert(worldResetJs.indexOf('tutorial: cloneObject(src.tutorial, null)') !== -1, 'world reset snapshot includes tutorial state');
  assert(worldResetJs.indexOf('target.tutorial = cloneObject(src.tutorial, target.tutorial || null);') !== -1, 'world reset restore includes tutorial state');
});

test('TUT-5: garage notifies tutorial runtime when a tank goes on track', () => {
  assert(garageJs.indexOf('tutorial.handleTankOnTrackChanged(tank, next, opts || null);') !== -1, 'garage notifies tutorial runtime');
});

test('TUT-6: tutorial runtime is loaded from index.html', () => {
  assert(indexHtml.indexOf('src/config/tutorialSteps.js') !== -1, 'tutorial steps config script is loaded');
  assert(indexHtml.indexOf('src/ui/tutorialRuntime.js') !== -1, 'tutorial runtime script is loaded');
});

test('TUT-7: tutorial strings exist in ru/en/fallback', () => {
  assert(ru.indexOf('"tutorialStarterTankMessage"') !== -1, 'ru tutorial message exists');
  assert(ru.indexOf('"tutorialMergeTankMessage"') !== -1, 'ru merge tutorial message exists');
  assert(ru.indexOf('"techUnlockHelpTitle"') !== -1, 'ru hangar tech help title exists');
  assert(ru.indexOf('"tutorialContinue"') !== -1, 'ru continue button exists');
  assert(ru.indexOf('"tutorialDisable"') !== -1, 'ru disable button exists');
  assert(ru.indexOf('"tutorialLockedTooltip"') !== -1, 'ru lock tooltip exists');
  assert(ru.indexOf('"workshopChipUpgradeEmpty"') !== -1, 'ru workshop empty merge string exists');
  assert(en.indexOf('"tutorialStarterTankMessage"') !== -1, 'en tutorial message exists');
  assert(en.indexOf('"tutorialMergeTankMessage"') !== -1, 'en merge tutorial message exists');
  assert(en.indexOf('"techUnlockHelpTitle"') !== -1, 'en hangar tech help title exists');
  assert(en.indexOf('"tutorialContinue"') !== -1, 'en continue button exists');
  assert(en.indexOf('"tutorialDisable"') !== -1, 'en disable button exists');
  assert(en.indexOf('"tutorialLockedTooltip"') !== -1, 'en lock tooltip exists');
  assert(en.indexOf('"workshopChipUpgradeEmpty"') !== -1, 'en workshop empty merge string exists');
  assert(fallback.indexOf('tutorialStarterTankMessage') !== -1, 'fallback tutorial message exists');
  assert(fallback.indexOf('tutorialMergeTankMessage') !== -1, 'fallback merge tutorial message exists');
  assert(fallback.indexOf('techUnlockHelpTitle') !== -1, 'fallback hangar tech help title exists');
  assert(fallback.indexOf('tutorialContinue') !== -1, 'fallback continue button exists');
  assert(fallback.indexOf('tutorialDisable') !== -1, 'fallback disable button exists');
  assert(fallback.indexOf('tutorialLockedTooltip') !== -1, 'fallback lock tooltip exists');
  assert(fallback.indexOf('workshopChipUpgradeEmpty') !== -1, 'fallback workshop empty merge string exists');
});

test('TUT-8: tutorial steps are defined in separate data-driven config', () => {
  assert(tutorialStepsJs.indexOf("id: 'starter_tank'") !== -1, 'starter_tank step lives in tutorial config');
  assert(tutorialStepsJs.indexOf("id: 'merge_tank'") !== -1, 'merge_tank step lives in tutorial config');
  assert(tutorialStepsJs.indexOf('bubbleControls') !== -1, 'tutorial config defines allowed bubble controls');
  assert(tutorialStepsJs.indexOf('unlock:') !== -1, 'tutorial config defines progressive unlocks');
  assert(tutorialStepsJs.indexOf("targetKinds: ['any_hangar_tank', 'any_track_tank']") !== -1, 'starter step unlocks hangar and track interactions cumulatively');
  assert(tutorialStepsJs.indexOf("uiKeys: ['buy']") !== -1, 'second step unlocks buy button cumulatively');
  assert(tutorialStepsJs.indexOf("kind: 'mergeable_hangar_pair'") !== -1, 'merge step activates only for a real mergeable pair');
  assert(tutorialStepsJs.indexOf("targetKinds: ['mergeable_hangar_pair', 'any_hangar_tank', 'any_track_tank']") !== -1, 'merge step unlocks once any relevant tank state exists while still targeting a real mergeable pair');
  assert(tutorialStepsJs.indexOf('secondaryTarget:') !== -1, 'merge step defines a secondary drag target');
  assert(tutorialStepsJs.indexOf('pointerPath:') !== -1, 'merge step defines drag-drop pointer path');
});

test('TUT-9: cursor config supports per-step sprite rotation, motion angle and optional offsets', () => {
  assert(tutorialCursorConfig.indexOf('"steps"') !== -1, 'cursor config contains per-step section');
  assert(tutorialCursorConfig.indexOf('"spriteRotationDeg"') !== -1, 'cursor config stores sprite rotation');
  assert(tutorialCursorConfig.indexOf('"motionAngleDeg"') !== -1, 'cursor config stores motion angle');
  assert(tutorialCursorConfig.indexOf('"offset"') !== -1, 'cursor config stores optional pointer offsets');
  assert(tutorialRuntimeJs.indexOf('runtime.cursorConfig.steps') !== -1, 'runtime reads per-step cursor settings');
  assert(tutorialRuntimeJs.indexOf('offset: sanitizeCursorOffset(next.offset)') !== -1, 'runtime sanitizes missing offset values to defaults');
  assert(tutorialRuntimeJs.indexOf('pointerCenterX: pointerCenterX + offsetX') !== -1, 'runtime applies X offset to pointer layout');
  assert(tutorialRuntimeJs.indexOf('pointerCenterY: pointerCenterY + offsetY') !== -1, 'runtime applies Y offset to pointer layout');
  assert(tutorialRuntimeJs.indexOf("'any_hangar_tank'") !== -1, 'runtime resolves cumulative tank targets');
});

test('TUT-10: merge tutorial completion waits for merge after step activation', () => {
  assert(tutorialRuntimeJs.indexOf('function getPreferredPendingStepId(state, tutorial)') !== -1, 'runtime dynamically selects the next available pending step');
  assert(tutorialRuntimeJs.indexOf('findMergeableTutorialPair') !== -1, 'runtime resolves merge tutorial targets from actual player state');
  assert(tutorialRuntimeJs.indexOf('activeStepMergedBaseline') !== -1, 'runtime tracks merge baseline for active step');
  assert(tutorialRuntimeJs.indexOf('getCompletedTankMergeCount(state) > runtime.activeStepMergedBaseline') !== -1, 'merge step completes only after merge count increases during active step');
});

test('TUT-13: hangar tech help button and modal hooks are wired into the overlay', () => {
  assert(indexHtml.indexOf('id="modsHangarHelpBtn"') !== -1, 'hangar overlay includes a dedicated help button');
  assert(indexHtml.indexOf('data-tech-help-open="true"') !== -1, 'hangar help button exposes the expected action attribute');
  assert(hangarChipsUiJs.indexOf('syncTechUnlockHelpButtonCopy') !== -1, 'hangar UI syncs help button caption through i18n');
  assert(hangarChipsUiJs.indexOf('_showTechUnlockHelpModal') !== -1, 'hangar UI implements the help modal opener');
});

test('TUT-11: chip upgrade tab keeps only mergeable chips and removes large vertex dots', () => {
  assert(hangarChipsUiJs.indexOf('var mergeableChips = chips.filter(function (chip) {') !== -1, 'chip upgrade grid filters inventory to mergeable chips only');
  assert(hangarChipsUiJs.indexOf("t('workshopChipUpgradeEmpty'") !== -1, 'chip upgrade grid renders empty-state message when no pair exists');
  assert(hangarChipsUiJs.indexOf('Math.max(w, h) >= 54 ? 0 :') !== -1, 'large chip icons suppress vertex dots');
});

test('TUT-12: terminal collapse button label is fully renamed', () => {
  assert(indexHtml.indexOf('aria-label="Свернуть терминал"') !== -1, 'collapse button aria-label renamed');
  assert(indexHtml.indexOf('data-ui-tooltip="Свернуть терминал"') !== -1, 'collapse button tooltip renamed');
});

console.log('\n==============================');
console.log('TutorialFirstRunRuntime: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(function (failure) {
    console.log('  - ' + failure.name + ': ' + failure.error);
  });
}
console.log('==============================\n');
process.exit(failCount > 0 ? 1 : 0);