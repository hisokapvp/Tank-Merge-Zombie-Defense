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
const levelFlowJs = fs.readFileSync(path.join(root, 'src/mechanics/levelFlow.js'), 'utf-8');
const storageJs = fs.readFileSync(path.join(root, 'src/persistence/storage.js'), 'utf-8');
const garageJs = fs.readFileSync(path.join(root, 'src/mechanics/garage.js'), 'utf-8');
const supercomputerMenuJs = fs.readFileSync(path.join(root, 'src/ui/supercomputerMenu.js'), 'utf-8');
const talentOverlayDomJs = fs.readFileSync(path.join(root, 'src/ui/talentOverlayDom.js'), 'utf-8');
const talentOverlayRendererJs = fs.readFileSync(path.join(root, 'src/ui/talentOverlayRenderer.js'), 'utf-8');
const talentOverlayUiJs = fs.readFileSync(path.join(root, 'src/ui/talentOverlayUi.js'), 'utf-8');
const productionLineUiJs = fs.readFileSync(path.join(root, 'src/ui/productionLineUI.js'), 'utf-8');
const achievementsJs = fs.readFileSync(path.join(root, 'src/mechanics/achievements.js'), 'utf-8');
const achievementRewardsJs = fs.readFileSync(path.join(root, 'src/mechanics/achievementRewards.js'), 'utf-8');
const achievementsModalJs = fs.readFileSync(path.join(root, 'src/ui/achievementsModal.js'), 'utf-8');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf-8');
const ru = fs.readFileSync(path.join(root, 'src/i18n/ru.json'), 'utf-8');
const en = fs.readFileSync(path.join(root, 'src/i18n/en.json'), 'utf-8');
const fallback = fs.readFileSync(path.join(root, 'src/i18n/fallbackStrings.js'), 'utf-8');
const styleCss = fs.readFileSync(path.join(root, 'style.css'), 'utf-8');
const worldResetJs = fs.readFileSync(path.join(root, 'src/core/worldReset.js'), 'utf-8');
const projectMapMd = fs.readFileSync(path.join(root, 'docs/ai/PROJECT_MAP.md'), 'utf-8');
const aiIndexMd = fs.readFileSync(path.join(root, 'docs/ai/INDEX.md'), 'utf-8');
const uiSystemMd = fs.readFileSync(path.join(root, 'docs/ai/SYSTEMS/ui.md'), 'utf-8');
const tutorialRuntimeMd = fs.readFileSync(path.join(root, 'docs/ai/SYSTEMS/tutorial-runtime.md'), 'utf-8');
const gameJsMapMd = fs.readFileSync(path.join(root, 'docs/ai/GAME_JS_MAP.md'), 'utf-8');
const uiTalentsV2Md = fs.readFileSync(path.join(root, 'docs/ui_talents_v2.md'), 'utf-8');

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
  assertEqual(state.tutorial.version, 8, 'tutorial state uses data-driven schema version 8');
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

test('TUT-2A: pre-retry payload does not preserve purchase inflation or buy-level progress', () => {
  const retryIdx = gameJs.indexOf('function applyPreRetryRuntimeReset');
  const retryEndIdx = gameJs.indexOf('function buildPreRetryPayload', retryIdx);
  const retryBlock = retryIdx !== -1 && retryEndIdx !== -1 ? gameJs.slice(retryIdx, retryEndIdx) : '';
  const payloadIdx = gameJs.indexOf('function buildPreRetryPayload');
  const payloadEndIdx = gameJs.indexOf('function savePreRetryPayloadToAutoSlot', payloadIdx);
  const payloadBlock = payloadIdx !== -1 && payloadEndIdx !== -1 ? gameJs.slice(payloadIdx, payloadEndIdx) : '';

  assert(retryBlock.indexOf('targetState.coins = 40;') !== -1, 'pre-retry reset restores 40 starting coins');
  assert(payloadBlock.indexOf('payload.buyCounts = cloneJsonSafe(source.buyCounts, {});') === -1, 'pre-retry payload no longer preserves buyCounts');
  assert(payloadBlock.indexOf('payload.buyPrices = cloneJsonSafe(source.buyPrices, {});') === -1, 'pre-retry payload no longer preserves buyPrices');
  assert(payloadBlock.indexOf('payload.maxTankLevelAchieved = Number.isFinite(source.maxTankLevelAchieved)') === -1, 'pre-retry payload no longer preserves maxTankLevelAchieved');
});

test('TUT-2B: critical restart normalization resets purchase progress for new and legacy retry payloads', () => {
  const criticalIdx = gameJs.indexOf('function applyCriticalRestartPostLoad');
  const criticalEndIdx = gameJs.indexOf('function performCriticalRestart', criticalIdx);
  const criticalBlock = criticalIdx !== -1 && criticalEndIdx !== -1 ? gameJs.slice(criticalIdx, criticalEndIdx) : '';
  assert(criticalBlock.indexOf('resetPurchaseProgress: true') !== -1, 'critical restart explicitly requests purchase-progress reset');

  const restoreIdx = gameJs.indexOf('if (forceFenceRuntimeResetOnLoad) {');
  const restoreEndIdx = gameJs.indexOf('// Зомби — runtime-состояние, не сохраняется; при restore всегда сбрасываем.', restoreIdx);
  const restoreBlock = restoreIdx !== -1 && restoreEndIdx !== -1 ? gameJs.slice(restoreIdx, restoreEndIdx) : '';
  assert(restoreBlock.indexOf('state.buyCounts = {};') !== -1, 'legacy retry payload load clears buyCounts');
  assert(restoreBlock.indexOf('state.buyPrices = {};') !== -1, 'legacy retry payload load clears buyPrices');
  assert(restoreBlock.indexOf('state.maxTankLevelAchieved = 1;') !== -1, 'legacy retry payload load clears maxTankLevelAchieved');
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
  assert(ru.indexOf('"tutorialSupercomputerOpenMenuMessage"') !== -1, 'ru supercomputer menu tutorial message exists');
  assert(ru.indexOf('"tutorialSupercomputerOpenTreeMessage"') !== -1, 'ru supercomputer tree tutorial message exists');
  assert(ru.indexOf('"tutorialSupercomputerApplyCaliberMessage"') !== -1, 'ru supercomputer caliber tutorial message exists');
  assert(ru.indexOf('"tutorialSupercomputerDamageOpenMenuMessage"') !== -1, 'ru damage tutorial menu message exists');
  assert(ru.indexOf('"tutorialSupercomputerOpenTankWallMessage"') !== -1, 'ru damage tutorial tank-wall message exists');
  assert(ru.indexOf('"tutorialSupercomputerApplyWeaponDamageMessage"') !== -1, 'ru damage tutorial apply message exists');
  assert(ru.indexOf('"tutorialProductionStorageOpenMessage"') !== -1, 'ru production storage tutorial open message exists');
  assert(ru.indexOf('"tutorialProductionStorageOpenBoxMessage"') !== -1, 'ru production storage tutorial box message exists');
  assert(ru.indexOf('"techUnlockHelpTitle"') !== -1, 'ru hangar tech help title exists');
  assert(ru.indexOf('"hangarCellsHelpText"') !== -1, 'ru cells help text exists');
  assert(ru.indexOf('"hangarWorkshopHelpText"') !== -1, 'ru workshop help text exists');
  assert(ru.indexOf('"supercomputerTalentsHelpText"') !== -1, 'ru supercomputer talents help exists');
  assert(ru.indexOf('"supercomputerTankWallHelpText"') !== -1, 'ru supercomputer tank-wall help exists');
  assert(ru.indexOf('"tutorialContinue"') !== -1, 'ru continue button exists');
  assert(ru.indexOf('"tutorialDisable"') !== -1, 'ru disable button exists');
  assert(ru.indexOf('"tutorialLockedTooltip"') !== -1, 'ru lock tooltip exists');
  assert(ru.indexOf('"workshopChipUpgradeEmpty"') !== -1, 'ru workshop empty merge string exists');
  assert(en.indexOf('"tutorialStarterTankMessage"') !== -1, 'en tutorial message exists');
  assert(en.indexOf('"tutorialMergeTankMessage"') !== -1, 'en merge tutorial message exists');
  assert(en.indexOf('"tutorialSupercomputerOpenMenuMessage"') !== -1, 'en supercomputer menu tutorial message exists');
  assert(en.indexOf('"tutorialSupercomputerOpenTreeMessage"') !== -1, 'en supercomputer tree tutorial message exists');
  assert(en.indexOf('"tutorialSupercomputerApplyCaliberMessage"') !== -1, 'en supercomputer caliber tutorial message exists');
  assert(en.indexOf('"tutorialSupercomputerDamageOpenMenuMessage"') !== -1, 'en damage tutorial menu message exists');
  assert(en.indexOf('"tutorialSupercomputerOpenTankWallMessage"') !== -1, 'en damage tutorial tank-wall message exists');
  assert(en.indexOf('"tutorialSupercomputerApplyWeaponDamageMessage"') !== -1, 'en damage tutorial apply message exists');
  assert(en.indexOf('"tutorialProductionStorageOpenMessage"') !== -1, 'en production storage tutorial open message exists');
  assert(en.indexOf('"tutorialProductionStorageOpenBoxMessage"') !== -1, 'en production storage tutorial box message exists');
  assert(en.indexOf('"techUnlockHelpTitle"') !== -1, 'en hangar tech help title exists');
  assert(en.indexOf('"hangarCellsHelpText"') !== -1, 'en cells help text exists');
  assert(en.indexOf('"hangarWorkshopHelpText"') !== -1, 'en workshop help text exists');
  assert(en.indexOf('"supercomputerTalentsHelpText"') !== -1, 'en supercomputer talents help exists');
  assert(en.indexOf('"supercomputerTankWallHelpText"') !== -1, 'en supercomputer tank-wall help exists');
  assert(en.indexOf('"tutorialContinue"') !== -1, 'en continue button exists');
  assert(en.indexOf('"tutorialDisable"') !== -1, 'en disable button exists');
  assert(en.indexOf('"tutorialLockedTooltip"') !== -1, 'en lock tooltip exists');
  assert(en.indexOf('"workshopChipUpgradeEmpty"') !== -1, 'en workshop empty merge string exists');
  assert(fallback.indexOf('tutorialStarterTankMessage') !== -1, 'fallback tutorial message exists');
  assert(fallback.indexOf('tutorialMergeTankMessage') !== -1, 'fallback merge tutorial message exists');
  assert(fallback.indexOf('tutorialSupercomputerOpenMenuMessage') !== -1, 'fallback supercomputer menu tutorial message exists');
  assert(fallback.indexOf('tutorialSupercomputerOpenTreeMessage') !== -1, 'fallback supercomputer tree tutorial message exists');
  assert(fallback.indexOf('tutorialSupercomputerApplyCaliberMessage') !== -1, 'fallback supercomputer caliber tutorial message exists');
  assert(fallback.indexOf('tutorialSupercomputerDamageOpenMenuMessage') !== -1, 'fallback damage tutorial menu message exists');
  assert(fallback.indexOf('tutorialSupercomputerOpenTankWallMessage') !== -1, 'fallback damage tutorial tank-wall message exists');
  assert(fallback.indexOf('tutorialSupercomputerApplyWeaponDamageMessage') !== -1, 'fallback damage tutorial apply message exists');
  assert(fallback.indexOf('tutorialProductionStorageOpenMessage') !== -1, 'fallback production storage tutorial open message exists');
  assert(fallback.indexOf('tutorialProductionStorageOpenBoxMessage') !== -1, 'fallback production storage tutorial box message exists');
  assert(fallback.indexOf('techUnlockHelpTitle') !== -1, 'fallback hangar tech help title exists');
  assert(fallback.indexOf('hangarCellsHelpText') !== -1, 'fallback cells help text exists');
  assert(fallback.indexOf('hangarWorkshopHelpText') !== -1, 'fallback workshop help text exists');
  assert(fallback.indexOf('supercomputerTalentsHelpText') !== -1, 'fallback supercomputer talents help exists');
  assert(fallback.indexOf('supercomputerTankWallHelpText') !== -1, 'fallback supercomputer tank-wall help exists');
  assert(fallback.indexOf('tutorialContinue') !== -1, 'fallback continue button exists');
  assert(fallback.indexOf('tutorialDisable') !== -1, 'fallback disable button exists');
  assert(fallback.indexOf('tutorialLockedTooltip') !== -1, 'fallback lock tooltip exists');
  assert(fallback.indexOf('workshopChipUpgradeEmpty') !== -1, 'fallback workshop empty merge string exists');
});

test('TUT-8: tutorial steps are defined in separate data-driven config', () => {
  assert(tutorialStepsJs.indexOf("id: 'starter_tank'") !== -1, 'starter_tank step lives in tutorial config');
  assert(tutorialStepsJs.indexOf("id: 'merge_tank'") !== -1, 'merge_tank step lives in tutorial config');
  assert(tutorialStepsJs.indexOf("id: 'supercomputer_open_menu'") !== -1, 'supercomputer open menu step lives in tutorial config');
  assert(tutorialStepsJs.indexOf("id: 'supercomputer_open_talent_tree'") !== -1, 'supercomputer open tree step lives in tutorial config');
  assert(tutorialStepsJs.indexOf("id: 'supercomputer_apply_caliber'") !== -1, 'supercomputer apply caliber step lives in tutorial config');
  assert(tutorialStepsJs.indexOf("id: 'supercomputer_damage_open_menu'") !== -1, 'damage tutorial menu step lives in tutorial config');
  assert(tutorialStepsJs.indexOf("id: 'supercomputer_damage_open_tank_wall_mods'") !== -1, 'damage tutorial tank-wall step lives in tutorial config');
  assert(tutorialStepsJs.indexOf("id: 'supercomputer_damage_apply_level1_weapon_upgrade'") !== -1, 'damage tutorial apply step lives in tutorial config');
  assert(tutorialStepsJs.indexOf('bubbleControls') !== -1, 'tutorial config defines allowed bubble controls');
  assert(tutorialStepsJs.indexOf('unlock:') !== -1, 'tutorial config defines progressive unlocks');
  assert(tutorialStepsJs.indexOf('supercomputerLevelRewardDismissed: false') !== -1, 'tutorial state seeds supercomputer level-dismiss flag');
  assert(tutorialStepsJs.indexOf("requiresStepBubbleShown: 'supercomputer_open_menu'") !== -1, 'tree step requires the menu step bubble to be shown first');
  assert(tutorialStepsJs.indexOf("requiresStepBubbleShown: 'supercomputer_open_talent_tree'") !== -1, 'caliber step requires the tree step bubble to be shown first');
  assert(tutorialStepsJs.indexOf("requiresStepBubbleShown: 'supercomputer_damage_open_menu'") !== -1, 'damage mods step requires the damage menu step bubble to be shown first');
  assert(tutorialStepsJs.indexOf("requiresStepBubbleShown: 'supercomputer_damage_open_tank_wall_mods'") !== -1, 'damage apply step requires the damage mods step bubble to be shown first');
  assert(tutorialStepsJs.indexOf('minFreeTalentPoints: 1') !== -1, 'supercomputer lesson requires at least one free upgrade point');
  assert(tutorialStepsJs.indexOf('minDamagePoints: 2') !== -1, 'damage lesson requires at least two damage points');
  assert(tutorialStepsJs.indexOf("targetKinds: ['any_hangar_tank', 'any_track_tank']") !== -1, 'starter step unlocks hangar and track interactions cumulatively');
  assert(tutorialStepsJs.indexOf("uiKeys: ['buy']") !== -1, 'second step unlocks buy button cumulatively');
  assert(tutorialStepsJs.indexOf("kind: 'mergeable_hangar_pair'") !== -1, 'merge step activates only for a real mergeable pair');
  assert(tutorialStepsJs.indexOf("targetKinds: ['mergeable_hangar_pair', 'any_hangar_tank', 'any_track_tank']") !== -1, 'merge step unlocks once any relevant tank state exists while still targeting a real mergeable pair');
  assert(tutorialStepsJs.indexOf('secondaryTarget:') !== -1, 'merge step defines a secondary drag target');
  assert(tutorialStepsJs.indexOf('pointerPath:') !== -1, 'merge step defines drag-drop pointer path');
  assert(tutorialStepsJs.indexOf('selector: \"#supercomputerBtn\"') === -1, 'supercomputer target selector stays in single-quote project style');
  assert(tutorialStepsJs.indexOf("selector: '#supercomputerBtn'") !== -1, 'supercomputer menu step points to HUD button');
  assert(tutorialStepsJs.indexOf("selector: '#supercomputerOpenTalents'") !== -1, 'supercomputer tree step points to the tree tile');
  assert(tutorialStepsJs.indexOf('#talentOverlay .talentNode[data-talent-id="off_caliber"]') !== -1, 'caliber step targets the caliber talent node');
  assert(tutorialStepsJs.indexOf("talentId: 'off_caliber'") !== -1, 'caliber step completes on apply for the caliber talent');
  assert(tutorialStepsJs.indexOf("selector: '#supercomputerOpenTankWallMods'") !== -1, 'damage tutorial points to the tank-wall tile');
  assert(tutorialStepsJs.indexOf("action: 'toggle'") !== -1, 'damage tutorial targets the first gun level toggle button');
  assert(tutorialStepsJs.indexOf("kind: 'supercomputer_damage_upgrade_applied'") !== -1, 'damage tutorial completes on any applied weapons/drones/walls upgrade');
  assert(tutorialStepsJs.indexOf("targetKinds: ['supercomputer_tank_wall_per_stat_controls']") !== -1, 'damage tutorial unlocks the current per-stat controls across all tabs');
  assert(tutorialStepsJs.indexOf("id: 'production_storage_open_first_box'") !== -1, 'production storage open step lives in tutorial config');
  assert(tutorialStepsJs.indexOf("id: 'production_storage_open_box'") !== -1, 'production storage box step lives in tutorial config');
  assert(tutorialStepsJs.indexOf("kind: 'production_storage_first_box'") !== -1, 'production storage tutorial targets the first filled slot');
  assert(tutorialStepsJs.indexOf("kind: 'production_line_box_available'") !== -1, 'production storage tutorial activates only when unopened boxes exist');
  assert(tutorialStepsJs.indexOf("kind: 'production_box_opened'") !== -1, 'production storage tutorial completes when the player opens a box');
});

test('TUT-8F: caliber lesson accepts any talent purchase and pending completion survives resource spend', () => {
  assert(tutorialStepsJs.indexOf('acceptAnyTalent: true') !== -1, 'caliber lesson explicitly accepts any applied talent rank');
  assert(tutorialRuntimeJs.indexOf('getAppliedTalentRankTotal') !== -1, 'tutorial runtime can measure total applied talent ranks');
  assert(tutorialRuntimeJs.indexOf("kind === 'production_box_opened'") !== -1, 'tutorial runtime preserves pending completion for production box opening');
  assert(tutorialRuntimeJs.indexOf('preservePendingCompletion') !== -1, 'completion eligibility preserves action-based lessons after spending the gated resource');
  assert(tutorialRuntimeJs.indexOf('queryAction(runtime.documentObj, family, level, statKey, action)') !== -1, 'tank-wall tutorial target resolution uses the shared action contract helper');
});

test('TUT-8A: supercomputer tutorial reward dismissal is wired through level flow into tutorial runtime', () => {
  const globalObj = {
    window: null,
    Game: {},
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    clearTimeout,
    setTimeout,
  };
  globalObj.window = globalObj;

  new Function('window', 'global', tutorialStepsJs)(globalObj, globalObj);
  new Function('window', 'global', tutorialRuntimeJs)(globalObj, globalObj);
  new Function('window', 'global', levelFlowJs)(globalObj, globalObj);

  const tutorialState = globalObj.Game.TutorialSteps.buildInitialTutorialState();
  tutorialState.steps.starter_tank = { completed: true, dismissed: false, bubbleOpen: false, bubbleShown: true };
  tutorialState.steps.second_tank = { completed: true, dismissed: false, bubbleOpen: false, bubbleShown: true };
  tutorialState.steps.merge_tank = { completed: true, dismissed: false, bubbleOpen: false, bubbleShown: true };
  tutorialState.steps.supercomputer_open_menu = { completed: false, dismissed: false, bubbleOpen: true, bubbleShown: false };
  tutorialState.currentStepId = 'supercomputer_open_menu';

  const state = {
    ui: { menuOpen: false, levelReward: { level: 1, points: 1, gold: 0 }, levelRewardTimer: 0 },
    cells: [],
    buyCounts: {},
    achievements: { totalMerges: 0 },
    player: { talentsV2: { ranksById: {} } },
    tutorial: tutorialState,
  };

  globalObj.Game.TutorialRuntime.init({
    documentObj: null,
    getState: function () { return state; },
    saveProgress: function () {},
    updateUi: function () {},
  });

  const flow = globalObj.Game.LevelFlow.createLevelFlow({
    state: state,
    ui: { levelModal: {} },
    windowObj: globalObj,
    UIModals: { closeLevelModal: function () {} },
    saveProgress: function () {},
    updateUI: function () {},
  });

  flow.closeLevelModal();

  assertEqual(state.tutorial.flags.supercomputerLevelRewardDismissed, true, 'closing the level reward marks the tutorial trigger flag');
  assertEqual(state.tutorial.steps.supercomputer_open_menu.completed, false, 'dismissal unlocks the step but does not auto-complete it');
  assertEqual(state.tutorial.currentStepId, 'supercomputer_open_menu', 'supercomputer tutorial becomes the next pending step after dismissal');
});

test('TUT-8B: supercomputer tutorial and help UI target the live menu and talent DOM contracts', () => {
  assert(levelFlowJs.indexOf('notifyTutorialLevelRewardDismissed(dismissedLevel)') !== -1, 'level flow forwards reward dismissal to tutorial runtime');
  assert(tutorialRuntimeJs.indexOf('handleSupercomputerLevelRewardDismissed') !== -1, 'tutorial runtime exposes supercomputer dismissal handler');
  assert(tutorialRuntimeJs.indexOf('flags.supercomputerLevelRewardDismissed = true;') !== -1, 'tutorial runtime stores dismissal flag');
  assert(gameJs.indexOf('TalentOverlayDomApi') !== -1, 'game.js delegates talents overlay DOM creation to the canonical src module when available');
  assert(gameJs.indexOf('TalentOverlayRendererApi') !== -1, 'game.js delegates talent node rendering to the canonical src module when available');
  assert(gameJs.indexOf('function getTalentOverlayUiApi()') !== -1, 'game.js resolves the extracted talent overlay UI module');
  assert(gameJs.indexOf('talentOverlayUi.update({') !== -1, 'game.js delegates talent overlay redraw/update orchestration to the extracted UI module');
  assert(gameJs.indexOf('window.Game && window.Game.SupercomputerMenu') !== -1, 'game.js resolves the live SupercomputerMenu API instead of a stale cached fallback');
  assert(talentOverlayDomJs.indexOf("global.Game.TalentOverlayDom") !== -1, 'talent overlay DOM renderer is exposed as a canonical src module');
  assert(talentOverlayRendererJs.indexOf("global.Game.TalentOverlayRenderer") !== -1, 'talent node renderer is exposed as a canonical src module');
  assert(talentOverlayUiJs.indexOf("global.Game.TalentOverlayUi") !== -1, 'talent overlay UI orchestration module is exposed as a canonical src module');
  assert(talentOverlayRendererJs.indexOf("button.dataset.talentId = node.id;") !== -1, 'canonical talent node renderer preserves the tutorial data-talent-id contract');
  assert(talentOverlayDomJs.indexOf("id: 'talentOverlay'") !== -1, 'talent overlay DOM module preserves the overlay id contract');
  assert(talentOverlayDomJs.indexOf("id: 'talentApply'") !== -1, 'talent overlay DOM module preserves the apply button id contract');
  assert(talentOverlayDomJs.indexOf('mountEl') !== -1, 'talent overlay DOM module supports mounting into the supercomputer view');
  assert(indexHtml.indexOf('id="modsTankWallHelpBtn"') !== -1, 'tank and wall help button exists in supercomputer overlay');
  assert(indexHtml.indexOf('id="supercomputerTalentsMount"') !== -1, 'supercomputer overlay provides a dedicated talents mount container');
  assert(indexHtml.indexOf('src/ui/talentOverlayDom.js') !== -1, 'talent overlay DOM module is loaded from index.html');
  assert(indexHtml.indexOf('src/ui/talentOverlayRenderer.js') !== -1, 'talent node renderer module is loaded from index.html');
  assert(indexHtml.indexOf('src/ui/talentOverlayUi.js') !== -1, 'talent overlay UI orchestration module is loaded from index.html');
  assert(supercomputerMenuJs.indexOf('supercomputerTalentsHelpBtn') !== -1, 'talent tree help button is injected into the talents overlay');
  assert(supercomputerMenuJs.indexOf('openTalentsView') !== -1, 'supercomputer controller exposes an internal talents view entrypoint');
  assert(supercomputerMenuJs.indexOf("if (!wasOpen && typeof a11yOpen === 'function') a11yOpen(overlay, options || {});") !== -1, 'supercomputer controller does not re-open the already active root dialog when switching to talents view');
  assert(supercomputerMenuJs.indexOf('supercomputerTankWallHelpText') !== -1, 'tank and wall help button opens the requested help copy');
});

test('TUT-8C: achievements modal uses the same pause-manager contract as other blocking modals', () => {
  assert(gameJs.indexOf("achievements: false") !== -1, 'achievements pause source is registered in menu pause locks');
  assert(gameJs.indexOf("setMenuPauseSource('achievements', true);") !== -1, 'achievements modal enables pause on open');
  assert(gameJs.indexOf("setMenuPauseSource('achievements', false);") !== -1, 'achievements modal releases pause on close');
});

test('TUT-8K: achievements modal hides locked-status copy and shows threshold-based creator-engineer descriptions', () => {
  assert(achievementsJs.indexOf('target: 200') !== -1, 'creator novice threshold is defined in achievements runtime');
  assert(achievementsJs.indexOf('target: 800') !== -1, 'creator pro threshold is defined in achievements runtime');
  assert(achievementsJs.indexOf('target: 1600') !== -1, 'creator expert threshold is defined in achievements runtime');
  assert(achievementsJs.indexOf('target: 500') !== -1, 'engineer pro threshold is defined in achievements runtime');
  assert(achievementsModalJs.indexOf("achievementStatusTodo") === -1, 'achievements modal no longer renders the locked status line');
  assert(achievementsModalJs.indexOf("achievementDescriptionCreateTanks") !== -1, 'achievements modal uses the creator threshold description template');
  assert(achievementsModalJs.indexOf("achievementDescriptionMergeTanks") !== -1, 'achievements modal uses the engineer threshold description template');
  assert(ru.indexOf('"achievementCreatorNoviceDesc": "Создайте 200 танков"') !== -1, 'ru creator novice description matches runtime threshold');
  assert(ru.indexOf('"achievementCreatorProDesc": "Создайте 800 танков"') !== -1, 'ru creator pro description matches runtime threshold');
  assert(ru.indexOf('"achievementCreatorExpertDesc": "Создайте 1600 танков"') !== -1, 'ru creator expert description matches runtime threshold');
  assert(ru.indexOf('"achievementEngineerNoviceDesc": "Объедините 200 танков"') !== -1, 'ru engineer novice description matches runtime threshold');
  assert(ru.indexOf('"achievementEngineerProDesc": "Объедините 500 танков"') !== -1, 'ru engineer pro description matches runtime threshold');
  assert(ru.indexOf('"achievementEngineerExpertDesc": "Объедините 1000 танков"') !== -1, 'ru engineer expert description matches runtime threshold');
  assert(en.indexOf('"achievementCreatorNoviceDesc": "Create 200 tanks"') !== -1, 'en creator novice description matches runtime threshold');
  assert(en.indexOf('"achievementCreatorProDesc": "Create 800 tanks"') !== -1, 'en creator pro description matches runtime threshold');
  assert(en.indexOf('"achievementCreatorExpertDesc": "Create 1600 tanks"') !== -1, 'en creator expert description matches runtime threshold');
  assert(en.indexOf('"achievementEngineerNoviceDesc": "Merge 200 tanks"') !== -1, 'en engineer novice description matches runtime threshold');
  assert(en.indexOf('"achievementEngineerProDesc": "Merge 500 tanks"') !== -1, 'en engineer pro description matches runtime threshold');
  assert(en.indexOf('"achievementEngineerExpertDesc": "Merge 1000 tanks"') !== -1, 'en engineer expert description matches runtime threshold');
});

test('TUT-8M: fence mechanic achievements define manual-repair thresholds, rewards, and synced copy', () => {
  assert(achievementsJs.indexOf("id: 'fence_mechanic_1'") !== -1, 'fence mechanic I definition exists');
  assert(achievementsJs.indexOf("id: 'fence_mechanic_2'") !== -1, 'fence mechanic II definition exists');
  assert(achievementsJs.indexOf("id: 'fence_mechanic_3'") !== -1, 'fence mechanic III definition exists');
  assert(achievementsJs.indexOf("progressType: 'manualFenceRepairs'") !== -1, 'manual fence repair progress type is defined');
  assert(achievementsJs.indexOf('target: 50') !== -1, 'fence mechanic II threshold is defined');
  assert(achievementsJs.indexOf('target: 200') !== -1, 'fence mechanic III threshold is defined');
  assert(achievementsJs.indexOf("rewardMode: 'fenceMechanicCoins75'") !== -1, 'fence mechanic I reward mode is defined');
  assert(achievementsJs.indexOf("rewardMode: 'fenceMechanicDust5'") !== -1, 'fence mechanic II reward mode is defined');
  assert(achievementsJs.indexOf("rewardMode: 'fenceMechanicFragment1'") !== -1, 'fence mechanic III reward mode is defined');
  assert(ru.indexOf('"achievementFenceMechanic1": "Механик ограды I"') !== -1, 'ru fence mechanic I title exists');
  assert(ru.indexOf('"achievementFenceMechanic2Desc": "Выполните 50 успешных ручных ремонтов ограды"') !== -1, 'ru fence mechanic II description exists');
  assert(ru.indexOf('"achievementRewardFenceMechanicFragment1": "1 случайный фрагмент чипа"') !== -1, 'ru fence mechanic III reward exists');
  assert(en.indexOf('"achievementFenceMechanic1": "Fence Mechanic I"') !== -1, 'en fence mechanic I title exists');
  assert(en.indexOf('"achievementFenceMechanic3Desc": "Complete 200 successful manual fence repairs"') !== -1, 'en fence mechanic III description exists');
  assert(en.indexOf('"achievementRewardFenceMechanicDust5": "5 silicon dust"') !== -1, 'en fence mechanic II reward exists');
  assert(fallback.indexOf("achievementFenceMechanic1: 'Механик ограды I'") !== -1, 'fallback ru fence mechanic I title exists');
  assert(fallback.indexOf("achievementFenceMechanic3Desc: 'Complete 200 successful manual fence repairs'") !== -1, 'fallback en fence mechanic III description exists');
  assert(fallback.indexOf("achievementRewardFenceMechanicCoins75: '75$'") !== -1, 'fallback achievement reward string exists');
});

test('TUT-8N: manual fence repair progress runtime unlocks the 1/50/200 tiers and seeds safe reward state', () => {
  const globalObj = { window: null, Game: {} };
  globalObj.window = globalObj;
  new Function('window', 'global', achievementsJs)(globalObj, globalObj);

  const api = globalObj.Game.Achievements;
  const state = {
    achievements: { unlocked: {}, popupQueue: [] },
    stats: {},
  };

  api.ensureState(state);
  assertEqual(state.achievements.totalManualFenceRepairs, 0, 'manual repair counter starts from zero');
  assert(state.achievements.rewarded && typeof state.achievements.rewarded === 'object', 'rewarded map is initialized for one-shot rewards');

  let unlocked = api.addProgress(state, 'manualFenceRepairs', 1);
  assert(unlocked.indexOf('fence_mechanic_1') !== -1, 'first successful manual repair unlocks tier I');
  assertEqual(api.getProgressValue(state, 'manualFenceRepairs'), 1, 'manual repair progress reads back from achievements runtime');
  assertEqual(state.stats.manualFenceRepairsCount, 1, 'manual repair progress is mirrored into stats runtime');

  unlocked = api.addProgress(state, 'manualFenceRepairs', 49);
  assert(unlocked.indexOf('fence_mechanic_2') !== -1, '50 successful manual repairs unlock tier II');

  unlocked = api.addProgress(state, 'manualFenceRepairs', 150);
  assert(unlocked.indexOf('fence_mechanic_3') !== -1, '200 successful manual repairs unlock tier III');
  assertEqual(api.getProgressValue(state, 'manualFenceRepairs'), 200, 'manual repair progress reaches the final threshold without drift');
});

test('TUT-8O: successful manual repair increments once and save restore keeps the counter plus reward state', () => {
  const repairFnIdx = gameJs.indexOf('function tryRepairFenceSegmentAt(px, py){');
  const repairFnEndIdx = gameJs.indexOf('function resolveFenceFrameScale(frame){', repairFnIdx);
  const repairBlock = repairFnIdx !== -1 && repairFnEndIdx !== -1 ? gameJs.slice(repairFnIdx, repairFnEndIdx) : '';
  assert(repairBlock.indexOf("processAchievementProgress('manualFenceRepairs', 1);") !== -1, 'successful manual repair advances the fence achievement counter');
  assertEqual(repairBlock.split("processAchievementProgress('manualFenceRepairs', 1);").length - 1, 1, 'manual repair hook increments the counter exactly once inside the repair action');
  assert(gameJs.indexOf("case 'fenceMechanicCoins75':") !== -1, 'game runtime grants the tier I fence mechanic reward');
  assert(gameJs.indexOf("case 'fenceMechanicDust5':") !== -1, 'game runtime grants the tier II fence mechanic reward');
  assert(gameJs.indexOf("case 'fenceMechanicFragment1':") !== -1, 'game runtime grants the tier III fence mechanic reward');
  assert(gameJs.indexOf('ach.totalManualFenceRepairs = Number.isFinite(saved.achievements.totalManualFenceRepairs)') !== -1, 'restoreFullState keeps manual repair progress from saves');
  assert(gameJs.indexOf("ach.rewarded = saved.achievements.rewarded && typeof saved.achievements.rewarded === 'object'") !== -1, 'restoreFullState keeps one-shot reward state from saves');
  assert(gameJs.indexOf('ach.totalManualFenceRepairs = Number.isFinite(achievements.totalManualFenceRepairs)') !== -1, 'applySavedProgress keeps manual repair progress from save payloads');
  assert(gameJs.indexOf("ach.rewarded = achievements.rewarded && typeof achievements.rewarded === 'object'") !== -1, 'applySavedProgress keeps one-shot reward state from save payloads');
});

test('TUT-8P: new technology II-IV achievements define thresholds, rewards, and synced copy', () => {
  assert(achievementsJs.indexOf("id: 'new_technology_2'") !== -1, 'new technology II definition exists');
  assert(achievementsJs.indexOf("id: 'new_technology_3'") !== -1, 'new technology III definition exists');
  assert(achievementsJs.indexOf("id: 'new_technology_4'") !== -1, 'new technology IV definition exists');
  assert(achievementsJs.indexOf("rewardMode: 'newTechnologyDust20'") !== -1, 'new technology II reward mode is defined');
  assert(achievementsJs.indexOf("rewardMode: 'newTechnologyRandomChips2'") !== -1, 'new technology III reward mode is defined');
  assert(achievementsJs.indexOf("rewardMode: 'newTechnologyUpgradePoints3'") !== -1, 'new technology IV reward mode is defined');
  assert(achievementsJs.indexOf('target: 3') !== -1, 'new technology II threshold is defined');
  assert(achievementsJs.indexOf('target: 8') !== -1, 'new technology III threshold is defined');
  assert(achievementsJs.indexOf('target: 16') !== -1, 'new technology IV threshold is defined');
  assert(ru.indexOf('"achievementNewTechnology2": "Новая технология II"') !== -1, 'ru new technology II title exists');
  assert(ru.indexOf('"achievementNewTechnology4Desc": "Завершите изучение всех 16 уникальных технологий модификатора"') !== -1, 'ru new technology IV description exists');
  assert(ru.indexOf('"achievementRewardNewTechnologyDust20": "20 кремниевой пыли"') !== -1, 'ru new technology II reward exists');
  assert(en.indexOf('"achievementNewTechnology3": "New Technology III"') !== -1, 'en new technology III title exists');
  assert(en.indexOf('"achievementNewTechnology2Desc": "Complete 3 unique modifier technology studies"') !== -1, 'en new technology II description exists');
  assert(en.indexOf('"achievementRewardNewTechnologyUpgradePoints3": "3 upgrade points"') !== -1, 'en new technology IV reward exists');
  assert(fallback.indexOf("achievementNewTechnology2: 'Новая технология II'") !== -1, 'fallback ru new technology II title exists');
  assert(fallback.indexOf("achievementNewTechnology4Desc: 'Complete all 16 unique modifier technologies'") !== -1, 'fallback en new technology IV description exists');
  assert(fallback.indexOf("achievementRewardNewTechnologyChips2: '2 random chips'") !== -1, 'fallback new technology III reward exists');
});

test('TUT-8Q: tech achievements recalculate from unlocked runtime state and grant tier rewards once', () => {
  const rewardState = {
    dust: 0,
    chips: [],
    fragments: [],
  };
  const chipDef = { chipId: 1, chipColor: 'red', modIds: [1, 2, 3], sourceComboKey: '1-2-3' };
  const globalObj = {
    window: null,
    Game: {
      HangarChips: {
        allChips: [chipDef],
        getUnlockedTechs() {
          return { 15: true, 16: true, 17: true, 18: true, 19: true, 20: true, 21: true, 22: true };
        },
      },
      HangarChipsUI: {
        getSiliconDust() { return rewardState.dust; },
        setSiliconDust(value) { rewardState.dust = value; },
        addPlayerChip(def, level) { rewardState.chips.push({ def, level }); },
        addPlayerFragment(fragmentId, count) { rewardState.fragments.push({ fragmentId, count }); },
      },
    },
  };
  globalObj.window = globalObj;
  new Function('window', 'global', achievementsJs)(globalObj, globalObj);

  const api = globalObj.Game.Achievements;
  const state = {
    achievements: { unlocked: {}, popupQueue: [], rewarded: {} },
    stats: {},
    player: {
      talentsV2: { freePoints: 0 },
      freeTalentPointsV2: 0,
    },
  };

  api.ensureState(state);
  assertEqual(state.achievements.totalModifierTechUnlocks, 8, 'ensureState infers eight completed tech studies from runtime');

  let unlocked = api.recalculateUnlocks(state);
  assert(unlocked.indexOf('new_technology_1') !== -1, 'retroactive recalculation unlocks new technology I');
  assert(unlocked.indexOf('new_technology_2') !== -1, 'retroactive recalculation unlocks new technology II');
  assert(unlocked.indexOf('new_technology_3') !== -1, 'retroactive recalculation unlocks new technology III');
  assertEqual(rewardState.fragments.length, 2, 'new technology I grants two fragments once');
  assertEqual(rewardState.dust, 20, 'new technology II grants 20 silicon dust');
  assertEqual(rewardState.chips.length, 2, 'new technology III grants two random chips');
  assertEqual(state.player.talentsV2.freePoints, 0, 'new technology IV is not granted before all 16 techs');

  unlocked = api.recalculateUnlocks(state);
  assertEqual(unlocked.length, 0, 're-running recalculation without new techs does not unlock anything else');
  assertEqual(rewardState.fragments.length, 2, 'fragment reward stays one-shot');
  assertEqual(rewardState.dust, 20, 'dust reward stays one-shot');
  assertEqual(rewardState.chips.length, 2, 'chip reward stays one-shot');

  const finalTechIds = [23, 24, 25, 26, 27, 28, 29, 30];
  let finalUnlocks = [];
  for (let i = 0; i < finalTechIds.length; i++) {
    finalUnlocks = finalUnlocks.concat(api.recordModifierTechUnlock(state, finalTechIds[i]) || []);
  }
  assert(finalUnlocks.indexOf('new_technology_4') !== -1, 'recording all 16 unique techs unlocks new technology IV');
  assertEqual(state.player.talentsV2.freePoints, 3, 'new technology IV grants 3 upgrade points');
  assertEqual(state.player.freeTalentPointsV2, 3, 'upgrade points stay synchronized with freeTalentPointsV2');

  api.recalculateUnlocks(state);
  assertEqual(state.player.talentsV2.freePoints, 3, 'upgrade point reward stays one-shot after subsequent recalculation');
});

test('TUT-8R: duty shift achievements define 1/4/9 drone thresholds, rewards, and synced copy', () => {
  assert(achievementsJs.indexOf("id: 'duty_shift_1'") !== -1, 'duty shift I definition exists');
  assert(achievementsJs.indexOf("id: 'duty_shift_2'") !== -1, 'duty shift II definition exists');
  assert(achievementsJs.indexOf("id: 'duty_shift_3'") !== -1, 'duty shift III definition exists');
  assert(achievementsJs.indexOf("progressType: 'droneAcquisitions'") !== -1, 'drone acquisition progress type is defined');
  assert(achievementsJs.indexOf('target: 4') !== -1, 'duty shift II threshold is defined');
  assert(achievementsJs.indexOf('target: 9') !== -1, 'duty shift III threshold is defined');
  assert(achievementsJs.indexOf("rewardMode: 'dutyShiftUpgradePoint1'") !== -1, 'duty shift I reward mode is defined');
  assert(achievementsJs.indexOf("rewardMode: 'dutyShiftDamage20000'") !== -1, 'duty shift II reward mode is defined');
  assert(achievementsJs.indexOf("rewardMode: 'dutyShiftUpgradePoints2'") !== -1, 'duty shift III reward mode is defined');
  assert(ru.indexOf('"achievementDutyShift1": "Смена дежурства I"') !== -1, 'ru duty shift I title exists');
  assert(ru.indexOf('"achievementDutyShift3Desc": "Получите 9 дронов техподдержки"') !== -1, 'ru duty shift III description exists');
  assert(ru.indexOf('"achievementRewardDutyShiftDamage20000": "20000 очков урона"') !== -1, 'ru duty shift II reward exists');
  assert(en.indexOf('"achievementDutyShift1": "Shift Change I"') !== -1, 'en duty shift I title exists');
  assert(en.indexOf('"achievementDutyShift2Desc": "Get 4 maintenance drones"') !== -1, 'en duty shift II description exists');
  assert(en.indexOf('"achievementRewardDutyShiftUpgradePoints2": "2 upgrade points"') !== -1, 'en duty shift III reward exists');
  assert(fallback.indexOf("achievementDutyShift1: 'Смена дежурства I'") !== -1, 'fallback ru duty shift I title exists');
  assert(fallback.indexOf("achievementDutyShift3Desc: 'Get 9 maintenance drones'") !== -1, 'fallback en duty shift III description exists');
  assert(fallback.indexOf("achievementRewardDutyShiftDamage20000: '20000 damage points'") !== -1, 'fallback duty shift II reward exists');
});

test('TUT-8S: drone acquisition achievements increment on addDron, persist counters, and grant rewards once', () => {
  const globalObj = {
    window: null,
    Game: {},
  };
  globalObj.window = globalObj;
  new Function('window', 'global', achievementsJs)(globalObj, globalObj);
  new Function('window', 'global', achievementRewardsJs)(globalObj, globalObj);

  const achievementsApi = globalObj.Game.Achievements;
  const rewardsApi = globalObj.Game.AchievementRewards;
  const dutyShiftDefs = achievementsApi.getDefinitions().filter(function (def) {
    return def.familyId === 'duty_shift';
  });
  const byId = {};
  for (let i = 0; i < dutyShiftDefs.length; i++) byId[dutyShiftDefs[i].id] = dutyShiftDefs[i];

  const state = {
    achievements: { unlocked: {}, popupQueue: [], rewarded: {} },
    stats: {},
    drones: [],
    player: {
      talentsV2: { freePoints: 0 },
      freeTalentPointsV2: 0,
      damagePoints: 0,
    },
    totalDamageDealtRaw: 0,
    damagePointsSpent: 0,
  };

  achievementsApi.ensureState(state);
  assertEqual(state.achievements.totalDroneAcquisitions, 0, 'drone acquisition counter starts from zero');
  assertEqual(state.stats.droneAcquisitionsCount, 0, 'mirrored drone acquisition counter starts from zero');

  let unlocked = achievementsApi.addProgress(state, 'droneAcquisitions', 1);
  assert(unlocked.indexOf('duty_shift_1') !== -1, 'first drone unlocks duty shift I');
  assertEqual(state.stats.droneAcquisitionsCount, 1, 'first drone increments mirrored counter');
  assert(rewardsApi.grant(state, byId.duty_shift_1), 'tier I reward grants once');
  assertEqual(state.player.talentsV2.freePoints, 1, 'tier I reward grants 1 upgrade point');
  assertEqual(state.player.freeTalentPointsV2, 1, 'tier I reward keeps freeTalentPointsV2 in sync');
  assertEqual(rewardsApi.grant(state, byId.duty_shift_1), false, 'tier I reward does not grant twice');

  unlocked = achievementsApi.addProgress(state, 'droneAcquisitions', 3);
  assert(unlocked.indexOf('duty_shift_2') !== -1, 'fourth drone unlocks duty shift II');
  assert(rewardsApi.grant(state, byId.duty_shift_2), 'tier II reward grants once');
  assertEqual(state.totalDamageDealtRaw, 200000000, 'tier II reward adds 20000 damage points worth of raw damage progress');
  assertEqual(state.player.damagePoints, 20000, 'tier II reward grants 20000 available damage points');
  assertEqual(rewardsApi.grant(state, byId.duty_shift_2), false, 'tier II reward does not grant twice');

  unlocked = achievementsApi.addProgress(state, 'droneAcquisitions', 5);
  assert(unlocked.indexOf('duty_shift_3') !== -1, 'ninth drone unlocks duty shift III');
  assert(rewardsApi.grant(state, byId.duty_shift_3), 'tier III reward grants once');
  assertEqual(state.player.talentsV2.freePoints, 3, 'tier III reward adds 2 more upgrade points');
  assertEqual(state.achievements.totalDroneAcquisitions, 9, 'drone acquisition total reaches the final threshold');

  assert(gameJs.indexOf("processAchievementProgress('droneAcquisitions', 1);") !== -1, 'canonical addDron hook increments the drone achievement counter');
  assert(gameJs.indexOf('ach.totalDroneAcquisitions = Number.isFinite(saved.achievements.totalDroneAcquisitions)') !== -1, 'restoreFullState keeps drone acquisition progress from saves');
  assert(gameJs.indexOf('ach.totalDroneAcquisitions = Number.isFinite(achievements.totalDroneAcquisitions)') !== -1, 'applySavedProgress keeps drone acquisition progress from save payloads');
  assert(gameJs.indexOf('droneAcquisitionsCount: clampDevInt(') !== -1, 'serialized achievement stats include the mirrored drone acquisition counter');
  assert(storageJs.indexOf('droneAcquisitionsCount: normalizeSafeCounter(') !== -1, 'storage serialization normalizes the mirrored drone acquisition counter');
});

test('TUT-8T: track cleanup achievements define a shared no-repair wave family, rewards, and synced copy', () => {
  assert(achievementsJs.indexOf("id: 'track_cleanup'") !== -1, 'track cleanup family exists');
  assert(achievementsJs.indexOf("id: 'track_cleanup_1'") !== -1, 'track cleanup I definition exists');
  assert(achievementsJs.indexOf("id: 'track_cleanup_2'") !== -1, 'track cleanup II definition exists');
  assert(achievementsJs.indexOf("id: 'track_cleanup_3'") !== -1, 'track cleanup III definition exists');
  assert(achievementsJs.indexOf("id: 'track_cleanup_4'") !== -1, 'track cleanup IV definition exists');
  assert(achievementsJs.indexOf("id: 'track_cleanup_5'") !== -1, 'track cleanup V definition exists');
  assertEqual(achievementsJs.split("progressType: 'noRepairAttackWaveStreak'").length - 1, 5, 'track cleanup ladder shares one streak progress type');
  assert(achievementsJs.indexOf("rewardMode: 'trackCleanupDamagePoints50'") !== -1, 'track cleanup I reward mode is defined');
  assert(achievementsJs.indexOf("rewardMode: 'trackCleanupFragments2'") !== -1, 'track cleanup II reward mode is defined');
  assert(achievementsJs.indexOf("rewardMode: 'trackCleanupUpgradePoint1'") !== -1, 'track cleanup III reward mode is defined');
  assert(achievementsJs.indexOf("rewardMode: 'trackCleanupRandomChips5'") !== -1, 'track cleanup IV reward mode is defined');
  assert(achievementsJs.indexOf("rewardMode: 'trackCleanupUpgradePoints3'") !== -1, 'track cleanup V reward mode is defined');
  assert(ru.indexOf('"achievementTrackCleanup1": "Уборка трассы I"') !== -1, 'ru track cleanup I title exists');
  assert(ru.indexOf('"achievementTrackCleanup5Desc": "Переживите 50 волн атак зомби подряд без починки фрагментов забора"') !== -1, 'ru track cleanup V description exists');
  assert(ru.indexOf('"achievementRewardTrackCleanupChips5": "5 случайных чипов"') !== -1, 'ru track cleanup IV reward exists');
  assert(en.indexOf('"achievementTrackCleanup1": "Track Cleanup I"') !== -1, 'en track cleanup I title exists');
  assert(en.indexOf('"achievementTrackCleanup4Desc": "Survive 25 zombie attack waves in a row without repairing fence segments"') !== -1, 'en track cleanup IV description exists');
  assert(en.indexOf('"achievementRewardTrackCleanupUpgradePoints3": "3 upgrade points"') !== -1, 'en track cleanup V reward exists');
  assert(fallback.indexOf("achievementTrackCleanup1: 'Уборка трассы I'") !== -1, 'fallback ru track cleanup I title exists');
  assert(fallback.indexOf("achievementTrackCleanup5Desc: 'Survive 50 zombie attack waves in a row without repairing fence segments'") !== -1, 'fallback en track cleanup V description exists');
  assert(fallback.indexOf("achievementRewardTrackCleanupChips5: '5 random chips'") !== -1, 'fallback track cleanup IV reward exists');
  assert(fallback.indexOf("achievementRewardTrackCleanupUpgradePoints3: '3 upgrade points'") !== -1, 'fallback track cleanup V reward exists');
});

test('TUT-8U: no-repair wave streak runtime resets on invalidation, persists mirrored counters, and grants rewards once', () => {
  const rewardState = {
    fragments: [],
    chips: [],
  };
  const globalObj = {
    window: null,
    Game: {
      HangarChips: {
        allChips: [{ chipId: 101 }, { chipId: 102 }],
      },
      HangarChipsUI: {
        addPlayerChip(chipDef, count) { rewardState.chips.push({ chipDef, count }); },
        addPlayerFragment(fragmentId, count) { rewardState.fragments.push({ fragmentId, count }); },
        getSiliconDust() { return 0; },
        setSiliconDust() {},
      },
    },
  };
  globalObj.window = globalObj;
  new Function('window', 'global', achievementsJs)(globalObj, globalObj);
  new Function('window', 'global', achievementRewardsJs)(globalObj, globalObj);

  const achievementsApi = globalObj.Game.Achievements;
  const rewardsApi = globalObj.Game.AchievementRewards;
  const defs = achievementsApi.getDefinitions().filter(function (def) {
    return def.familyId === 'track_cleanup';
  });
  const byId = {};
  for (let i = 0; i < defs.length; i++) byId[defs[i].id] = defs[i];

  const state = {
    achievements: { unlocked: {}, popupQueue: [], rewarded: {} },
    stats: {},
    player: {
      talentsV2: { freePoints: 0 },
      freeTalentPointsV2: 0,
      damagePoints: 0,
    },
    totalDamageDealtRaw: 0,
    damagePointsSpent: 0,
  };

  achievementsApi.ensureState(state);
  assertEqual(state.achievements.totalNoRepairAttackWaveStreak, 0, 'no-repair wave streak starts from zero');
  assertEqual(state.stats.noRepairAttackWaveStreakCount, 0, 'mirrored no-repair wave streak starts from zero');

  let unlocked = achievementsApi.recordNoRepairAttackWaveSuccess(state);
  assert(unlocked.indexOf('track_cleanup_1') !== -1, 'first clean wave unlocks track cleanup I');
  assertEqual(achievementsApi.getProgressValue(state, 'noRepairAttackWaveStreak'), 1, 'track cleanup streak reads back from runtime');
  assertEqual(state.stats.noRepairAttackWaveStreakCount, 1, 'track cleanup streak is mirrored into stats');
  assert(rewardsApi.grant(state, byId.track_cleanup_1), 'track cleanup I reward grants once');
  assertEqual(state.player.damagePoints, 50, 'track cleanup I reward grants 50 damage points');
  assertEqual(rewardsApi.grant(state, byId.track_cleanup_1), false, 'track cleanup I reward stays one-shot');

  achievementsApi.resetNoRepairAttackWaveStreak(state);
  assertEqual(achievementsApi.getProgressValue(state, 'noRepairAttackWaveStreak'), 0, 'invalidated wave resets the streak');

  unlocked = [];
  for (let i = 0; i < 5; i++) {
    unlocked = unlocked.concat(achievementsApi.recordNoRepairAttackWaveSuccess(state) || []);
  }
  assert(unlocked.indexOf('track_cleanup_2') !== -1, 'five clean waves unlock track cleanup II');
  assert(rewardsApi.grant(state, byId.track_cleanup_2), 'track cleanup II reward grants once');
  assertEqual(rewardState.fragments.length, 2, 'track cleanup II reward grants two fragments');

  unlocked = [];
  for (let i = 0; i < 5; i++) {
    unlocked = unlocked.concat(achievementsApi.recordNoRepairAttackWaveSuccess(state) || []);
  }
  assert(unlocked.indexOf('track_cleanup_3') !== -1, 'ten clean waves unlock track cleanup III');
  assert(rewardsApi.grant(state, byId.track_cleanup_3), 'track cleanup III reward grants once');
  assertEqual(state.player.talentsV2.freePoints, 1, 'track cleanup III reward grants 1 upgrade point');
  assertEqual(state.player.freeTalentPointsV2, 1, 'track cleanup III reward keeps freeTalentPointsV2 in sync');

  unlocked = [];
  for (let i = 0; i < 15; i++) {
    unlocked = unlocked.concat(achievementsApi.recordNoRepairAttackWaveSuccess(state) || []);
  }
  assert(unlocked.indexOf('track_cleanup_4') !== -1, 'twenty-five clean waves unlock track cleanup IV');
  assert(rewardsApi.grant(state, byId.track_cleanup_4, { random: function () { return 0; } }), 'track cleanup IV reward grants once');
  assertEqual(rewardState.chips.length, 5, 'track cleanup IV reward grants five random chips through the canonical chip inventory path');
  assertEqual(rewardsApi.grant(state, byId.track_cleanup_4, { random: function () { return 0; } }), false, 'track cleanup IV reward stays one-shot');

  unlocked = [];
  for (let i = 0; i < 25; i++) {
    unlocked = unlocked.concat(achievementsApi.recordNoRepairAttackWaveSuccess(state) || []);
  }
  assert(unlocked.indexOf('track_cleanup_5') !== -1, 'fifty clean waves unlock track cleanup V');
  assert(rewardsApi.grant(state, byId.track_cleanup_5), 'track cleanup V reward grants once');
  assertEqual(state.player.talentsV2.freePoints, 4, 'track cleanup V reward adds 3 more upgrade points');
  assertEqual(state.player.freeTalentPointsV2, 4, 'track cleanup V reward keeps freeTalentPointsV2 in sync');
  assertEqual(rewardsApi.grant(state, byId.track_cleanup_5), false, 'track cleanup V reward stays one-shot');

  const initialStateSource = fs.readFileSync(path.join(root, 'src/persistence/initialState.js'), 'utf-8');
  assert(initialStateSource.indexOf('totalNoRepairAttackWaveStreak: 0') !== -1, 'initial state seeds no-repair streak achievement field');
  assert(initialStateSource.indexOf('noRepairAttackWaveStreakCount: 0') !== -1, 'initial state seeds mirrored no-repair streak stat');
  assert(storageJs.indexOf('noRepairAttackWaveStreakCount: normalizeSafeCounter(') !== -1, 'storage serialization normalizes the mirrored no-repair streak stat');
});

test('TUT-8V: attack-wave tracking invalidates on both manual and drone fence repair and restores the streak from saves', () => {
  assert(gameJs.indexOf('function beginNoRepairAttackWaveEpisode(){') !== -1, 'game runtime defines attack-wave start tracking');
  assert(gameJs.indexOf('function finalizeNoRepairAttackWaveEpisode(){') !== -1, 'game runtime defines attack-wave completion tracking');
  assert(gameJs.indexOf('handleNoRepairAttackWaveTransition(wasAttackActive, isZombieAttackModeActive());') !== -1, 'world events transition feeds the no-repair tracker');
  const repairFnIdx = gameJs.indexOf('function tryRepairFenceSegmentAt(px, py){');
  const repairFnEndIdx = gameJs.indexOf('function resolveFenceFrameScale(frame){', repairFnIdx);
  const repairBlock = repairFnIdx !== -1 && repairFnEndIdx !== -1 ? gameJs.slice(repairFnIdx, repairFnEndIdx) : '';
  const invalidationIdx = repairBlock.indexOf('invalidateNoRepairAttackWaveEpisode();');
  const manualProgressIdx = repairBlock.indexOf("processAchievementProgress('manualFenceRepairs', 1);");
  assert(invalidationIdx !== -1 && manualProgressIdx !== -1 && invalidationIdx < manualProgressIdx, 'manual fence repair invalidates the no-repair streak before counting manual repair progress');
  assert(gameJs.indexOf('const repairHpSnapshot = captureFenceHpSnapshotForNoRepairTracking();') !== -1, 'drone repair path snapshots fence HP before drone step');
  assert(gameJs.indexOf('invalidateNoRepairAttackWaveOnDroneRepair(repairHpSnapshot);') !== -1, 'drone repair path invalidates the no-repair streak on actual HP gain');
  assert(gameJs.indexOf('ach.totalNoRepairAttackWaveStreak = Number.isFinite(saved.achievements.totalNoRepairAttackWaveStreak)') !== -1, 'restoreFullState keeps no-repair streak progress from saves');
  assert(gameJs.indexOf('ach.totalNoRepairAttackWaveStreak = Number.isFinite(achievements.totalNoRepairAttackWaveStreak)') !== -1, 'applySavedProgress keeps no-repair streak progress from save payloads');
  assert(gameJs.indexOf('noRepairAttackWaveStreakCount: clampDevInt(') !== -1, 'serialized achievement stats include the mirrored no-repair streak counter');
  assert(gameJs.indexOf("case 'trackCleanupRandomChips5':") !== -1, 'game reward reconciliation recognizes track cleanup IV rewards');
  assert(gameJs.indexOf("case 'trackCleanupUpgradePoints3':") !== -1, 'game reward reconciliation recognizes track cleanup V rewards');
});

test('TUT-8W: restore plus recalculation unlocks track cleanup IV-V once and preserves rewarded dedupe', () => {
  const rewardState = {
    chips: [],
  };
  const globalObj = {
    window: null,
    Game: {
      HangarChips: {
        allChips: [{ chipId: 201 }, { chipId: 202 }],
      },
      HangarChipsUI: {
        addPlayerChip(chipDef, count) { rewardState.chips.push({ chipDef, count }); },
      },
    },
  };
  globalObj.window = globalObj;
  new Function('window', 'global', achievementsJs)(globalObj, globalObj);
  new Function('window', 'global', achievementRewardsJs)(globalObj, globalObj);

  const achievementsApi = globalObj.Game.Achievements;
  const rewardsApi = globalObj.Game.AchievementRewards;
  const defs = achievementsApi.getDefinitions().filter(function (def) {
    return def.familyId === 'track_cleanup';
  });
  const byId = {};
  for (let i = 0; i < defs.length; i++) byId[defs[i].id] = defs[i];

  const restoredState = {
    achievements: {
      unlocked: {},
      popupQueue: [],
      rewarded: {},
      totalNoRepairAttackWaveStreak: 50,
    },
    stats: {
      noRepairAttackWaveStreakCount: 50,
    },
    player: {
      talentsV2: { freePoints: 0 },
      freeTalentPointsV2: 0,
    },
  };

  achievementsApi.ensureState(restoredState);
  let unlocked = achievementsApi.recalculateUnlocks(restoredState) || [];
  assert(unlocked.indexOf('track_cleanup_4') !== -1, 'recalculation restores track cleanup IV from persisted streak progress');
  assert(unlocked.indexOf('track_cleanup_5') !== -1, 'recalculation restores track cleanup V from persisted streak progress');
  assert(rewardsApi.grant(restoredState, byId.track_cleanup_4, { random: function () { return 0; } }), 'restored track cleanup IV reward grants once');
  assertEqual(rewardState.chips.length, 5, 'restored track cleanup IV reward still uses the canonical chip inventory path');
  assert(rewardsApi.grant(restoredState, byId.track_cleanup_5), 'restored track cleanup V reward grants once');
  assertEqual(restoredState.player.talentsV2.freePoints, 3, 'restored track cleanup V reward grants 3 upgrade points once');

  unlocked = achievementsApi.recalculateUnlocks(restoredState) || [];
  assertEqual(unlocked.length, 0, 're-running recalculation after restore does not unlock track cleanup tiers again');
  assertEqual(rewardsApi.grant(restoredState, byId.track_cleanup_4, { random: function () { return 0; } }), false, 'restored rewarded map blocks duplicate track cleanup IV rewards');
  assertEqual(rewardsApi.grant(restoredState, byId.track_cleanup_5), false, 'restored rewarded map blocks duplicate track cleanup V rewards');
});

test('TUT-8D: tutorial runtime documentation lives in a dedicated map and UI docs only link to it', () => {
  assert(aiIndexMd.indexOf('docs/ai/SYSTEMS/tutorial-runtime.md') !== -1, 'AI index links to dedicated tutorial runtime map');
  assert(uiSystemMd.indexOf('docs/ai/SYSTEMS/tutorial-runtime.md') !== -1, 'UI system doc links to dedicated tutorial runtime map');
  assert(uiSystemMd.indexOf('Tooltip dismiss contract') !== -1, 'UI system doc records the tooltip dismiss contract near close/remove patterns');
  assert(uiSystemMd.indexOf('data-input-drag-host="true"') !== -1, 'UI system doc records the shared drag-host input guard attribute');
  assert(tutorialRuntimeMd.indexOf('getPreferredPendingStepId') !== -1, 'tutorial runtime map documents first-available step selection');
  assert(tutorialRuntimeMd.indexOf('supercomputer_damage_apply_level1_weapon_upgrade') !== -1, 'tutorial runtime map documents the supercomputer damage lesson invariant');
});

test('TUT-8E: tutorial bubble CSS wraps long text and keeps controls visible on small screens', () => {
  assert(styleCss.indexOf('width:clamp(332px, 34vw, 460px);') !== -1, 'tutorial bubble uses a fixed-width desktop shell');
  assert(styleCss.indexOf('--ui-scale:1;') !== -1, 'tutorial bubble locally overrides ui scale instead of inheriting the master shell scale');
  assert(styleCss.indexOf('overflow-wrap:break-word;') !== -1, 'tutorial message wraps long text by words');
  assert(styleCss.indexOf('flex-wrap:wrap;') !== -1, 'tutorial actions can wrap instead of clipping');
  assert(styleCss.indexOf('min-width:100%;') !== -1, 'tutorial actions stack to full width on narrow viewports');
  assert(styleCss.indexOf('[data-input-drag-host="true"]') !== -1, 'shared drag-host selector owns the touch-action contract for modal drag surfaces');
});

test('TUT-8L: production storage modal pause hook is wired through game bootstrap and tutorial targets the first filled slot', () => {
  assert(productionLineUiJs.indexOf('_onPauseLockChange') !== -1, 'production storage UI keeps a dedicated pause-lock callback');
  assert(productionLineUiJs.indexOf('if (!wasOpen && _onPauseLockChange) _onPauseLockChange(true);') !== -1, 'production storage UI enables pause lock on open');
  assert(productionLineUiJs.indexOf('if (wasOpen && _onPauseLockChange) _onPauseLockChange(false);') !== -1, 'production storage UI releases pause lock on close');
  assert(gameJs.indexOf("setMenuPauseSource('productionStorage', !!open);") !== -1, 'game bootstrap maps production storage open state into pause manager');
  assert(tutorialRuntimeJs.indexOf('function getFirstProductionStorageBoxTarget()') !== -1, 'tutorial runtime resolves the first filled production storage slot dynamically');
  assert(tutorialRuntimeJs.indexOf("'#plStorageGrid .plStorage__cell--filled'") !== -1, 'tutorial runtime queries the first filled production storage slot from the DOM');
});

function makeVisibleElement(id) {
  return {
    id: id,
    hidden: false,
    getAttribute(name) {
      if (name === 'aria-hidden') return 'false';
      return null;
    },
  };
}

function makeVisibilityOnlyDocument(elementsById) {
  return {
    body: { classList: { contains() { return false; }, toggle() {} } },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getElementById(id) { return elementsById[id] || null; },
  };
}

test('TUT-10C: supercomputer navigation step completes when the target child view opens even after the root view hides', () => {
  const runtimeSource = fs.readFileSync(path.join(root, 'src/ui/tutorialRuntime.js'), 'utf-8');
  const stepsSource = fs.readFileSync(path.join(root, 'src/config/tutorialSteps.js'), 'utf-8');

  const globalObj = {
    window: null,
    Game: {},
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    getComputedStyle() { return { display: 'block', visibility: 'visible' }; },
  };
  globalObj.window = globalObj;

  new Function('window', 'global', stepsSource)(globalObj, globalObj);
  new Function('window', 'global', runtimeSource)(globalObj, globalObj);

  const tutorialState = globalObj.Game.TutorialSteps.buildInitialTutorialState();
  tutorialState.steps.starter_tank = { completed: true, dismissed: false, bubbleOpen: false, bubbleShown: true };
  tutorialState.steps.second_tank = { completed: true, dismissed: false, bubbleOpen: false, bubbleShown: true };
  tutorialState.steps.merge_tank = { completed: true, dismissed: false, bubbleOpen: false, bubbleShown: true };
  tutorialState.steps.supercomputer_open_menu = { completed: true, dismissed: false, bubbleOpen: false, bubbleShown: true };
  tutorialState.steps.supercomputer_open_talent_tree = { completed: true, dismissed: false, bubbleOpen: false, bubbleShown: true };
  tutorialState.steps.supercomputer_apply_caliber = { completed: true, dismissed: false, bubbleOpen: false, bubbleShown: true };
  tutorialState.steps.supercomputer_damage_open_menu = { completed: true, dismissed: false, bubbleOpen: false, bubbleShown: true };
  tutorialState.steps.supercomputer_damage_open_tank_wall_mods = { completed: false, dismissed: false, bubbleOpen: true, bubbleShown: true };
  tutorialState.currentStepId = 'supercomputer_damage_open_tank_wall_mods';

  const rootOverlay = makeVisibleElement('supercomputerMenuOverlay');
  rootOverlay.hidden = true;
  const state = {
    ui: { menuOpen: false },
    cells: [],
    buyCounts: {},
    achievements: { totalMerges: 0 },
    player: { damagePoints: 2, talentsV2: { ranksById: {} } },
    tutorial: tutorialState,
  };

  globalObj.Game.TutorialRuntime.init({
    documentObj: makeVisibilityOnlyDocument({
      supercomputerMenuOverlay: rootOverlay,
      modsTankWallOverlay: makeVisibleElement('modsTankWallOverlay'),
      modsTankWallPanelGuns: makeVisibleElement('modsTankWallPanelGuns'),
    }),
    getState: function () { return state; },
    saveProgress: function () {},
    updateUi: function () {},
  });

  globalObj.Game.TutorialRuntime.syncNow();
  assertEqual(state.tutorial.steps.supercomputer_damage_open_tank_wall_mods.completed, true, 'tank-wall navigation step completes once the child view opens');
});

test('TUT-10D: supercomputer UI-step completions require their gated availability', () => {
  const runtimeSource = fs.readFileSync(path.join(root, 'src/ui/tutorialRuntime.js'), 'utf-8');
  const stepsSource = fs.readFileSync(path.join(root, 'src/config/tutorialSteps.js'), 'utf-8');

  const globalObj = {
    window: null,
    Game: {},
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    getComputedStyle() { return { display: 'block', visibility: 'visible' }; },
  };
  globalObj.window = globalObj;

  new Function('window', 'global', stepsSource)(globalObj, globalObj);
  new Function('window', 'global', runtimeSource)(globalObj, globalObj);

  const tutorialState = globalObj.Game.TutorialSteps.buildInitialTutorialState();
  tutorialState.steps.starter_tank = { completed: true, dismissed: false, bubbleOpen: false, bubbleShown: true };
  tutorialState.steps.second_tank = { completed: true, dismissed: false, bubbleOpen: false, bubbleShown: true };
  tutorialState.steps.merge_tank = { completed: true, dismissed: false, bubbleOpen: false, bubbleShown: true };
  tutorialState.steps.supercomputer_open_menu = { completed: true, dismissed: false, bubbleOpen: false, bubbleShown: false };
  tutorialState.steps.supercomputer_open_talent_tree = { completed: true, dismissed: false, bubbleOpen: false, bubbleShown: false };
  tutorialState.steps.supercomputer_apply_caliber = { completed: false, dismissed: false, bubbleOpen: true, bubbleShown: false };
  tutorialState.currentStepId = 'supercomputer_apply_caliber';

  const talentsOverlay = makeVisibleElement('talentOverlay');
  const state = {
    ui: { menuOpen: false },
    cells: [],
    buyCounts: {},
    achievements: { totalMerges: 0 },
    supercomputer: { computerLevel: 1 },
    player: { freeTalentPointsV2: 1, talentsV2: { ranksById: {} } },
    tutorial: tutorialState,
  };

  globalObj.Game.TutorialRuntime.init({
    documentObj: makeVisibilityOnlyDocument({ talentOverlay: talentsOverlay }),
    getState: function () { return state; },
    saveProgress: function () {},
    updateUi: function () {},
  });

  state.player.talentsV2.ranksById.off_caliber = 1;
  globalObj.Game.TutorialRuntime.syncNow();
  assertEqual(state.tutorial.steps.supercomputer_apply_caliber.completed, false, 'caliber step does not complete when the tree step bubble was never shown');

  state.tutorial.steps.supercomputer_open_talent_tree.bubbleShown = true;
  globalObj.Game.TutorialRuntime.syncNow();
  assertEqual(state.tutorial.steps.supercomputer_apply_caliber.completed, true, 'caliber step completes once its gating step bubble was shown and the talent is applied');
});

test('TUT-10E: damage tutorial completion requires the mods-step bubble and accepts any applied damage upgrade family', () => {
  const runtimeSource = fs.readFileSync(path.join(root, 'src/ui/tutorialRuntime.js'), 'utf-8');
  const stepsSource = fs.readFileSync(path.join(root, 'src/config/tutorialSteps.js'), 'utf-8');

  const globalObj = {
    window: null,
    Game: {},
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    getComputedStyle() { return { display: 'block', visibility: 'visible' }; },
  };
  globalObj.window = globalObj;

  new Function('window', 'global', stepsSource)(globalObj, globalObj);
  new Function('window', 'global', runtimeSource)(globalObj, globalObj);

  const tutorialState = globalObj.Game.TutorialSteps.buildInitialTutorialState();
  tutorialState.steps.starter_tank = { completed: true, dismissed: false, bubbleOpen: false, bubbleShown: true };
  tutorialState.steps.second_tank = { completed: true, dismissed: false, bubbleOpen: false, bubbleShown: true };
  tutorialState.steps.merge_tank = { completed: true, dismissed: false, bubbleOpen: false, bubbleShown: true };
  tutorialState.steps.supercomputer_open_menu = { completed: true, dismissed: false, bubbleOpen: false, bubbleShown: true };
  tutorialState.steps.supercomputer_open_talent_tree = { completed: true, dismissed: false, bubbleOpen: false, bubbleShown: true };
  tutorialState.steps.supercomputer_apply_caliber = { completed: true, dismissed: false, bubbleOpen: false, bubbleShown: true };
  tutorialState.steps.supercomputer_damage_open_menu = { completed: true, dismissed: false, bubbleOpen: false, bubbleShown: true };
  tutorialState.steps.supercomputer_damage_open_tank_wall_mods = { completed: true, dismissed: false, bubbleOpen: false, bubbleShown: false };
  tutorialState.steps.supercomputer_damage_apply_level1_weapon_upgrade = { completed: false, dismissed: false, bubbleOpen: true, bubbleShown: false };
  tutorialState.currentStepId = 'supercomputer_damage_apply_level1_weapon_upgrade';

  const state = {
    ui: { menuOpen: false },
    cells: [],
    buyCounts: {},
    achievements: { totalMerges: 0 },
    player: {
      damagePoints: 2,
      cannonUpgradesApplied: [0],
      dronUpgradesApplied: [0],
      fenceUpgradesApplied: [0],
      talentsV2: { ranksById: {} },
    },
    tutorial: tutorialState,
  };

  globalObj.Game.TutorialRuntime.init({
    documentObj: makeVisibilityOnlyDocument({
      modsTankWallOverlay: makeVisibleElement('modsTankWallOverlay'),
      modsTankWallPanelGuns: makeVisibleElement('modsTankWallPanelGuns'),
    }),
    getState: function () { return state; },
    saveProgress: function () {},
    updateUi: function () {},
  });

  state.player.cannonUpgradesApplied[0] = 1;
  globalObj.Game.TutorialRuntime.syncNow();
  assertEqual(state.tutorial.steps.supercomputer_damage_apply_level1_weapon_upgrade.completed, false, 'damage apply step does not complete until the mods step bubble was shown');

  state.tutorial.steps.supercomputer_damage_open_tank_wall_mods.bubbleShown = true;
  globalObj.Game.TutorialRuntime.syncNow();
  assertEqual(state.tutorial.steps.supercomputer_damage_apply_level1_weapon_upgrade.completed, true, 'damage apply step completes after an applied damage upgrade once the mods step bubble was shown');
});

test('TUT-10E2: damage tutorial also completes from drone and wall applied upgrades', () => {
  const runtimeSource = fs.readFileSync(path.join(root, 'src/ui/tutorialRuntime.js'), 'utf-8');
  const stepsSource = fs.readFileSync(path.join(root, 'src/config/tutorialSteps.js'), 'utf-8');

  const globalObj = {
    window: null,
    Game: {},
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    getComputedStyle() { return { display: 'block', visibility: 'visible' }; },
  };
  globalObj.window = globalObj;

  new Function('window', 'global', stepsSource)(globalObj, globalObj);
  new Function('window', 'global', runtimeSource)(globalObj, globalObj);

  const tutorialState = globalObj.Game.TutorialSteps.buildInitialTutorialState();
  tutorialState.steps.starter_tank = { completed: true, dismissed: false, bubbleOpen: false, bubbleShown: true };
  tutorialState.steps.second_tank = { completed: true, dismissed: false, bubbleOpen: false, bubbleShown: true };
  tutorialState.steps.merge_tank = { completed: true, dismissed: false, bubbleOpen: false, bubbleShown: true };
  tutorialState.steps.supercomputer_open_menu = { completed: true, dismissed: false, bubbleOpen: false, bubbleShown: true };
  tutorialState.steps.supercomputer_open_talent_tree = { completed: true, dismissed: false, bubbleOpen: false, bubbleShown: true };
  tutorialState.steps.supercomputer_apply_caliber = { completed: true, dismissed: false, bubbleOpen: false, bubbleShown: true };
  tutorialState.steps.supercomputer_damage_open_menu = { completed: true, dismissed: false, bubbleOpen: false, bubbleShown: true };
  tutorialState.steps.supercomputer_damage_open_tank_wall_mods = { completed: true, dismissed: false, bubbleOpen: false, bubbleShown: true };
  tutorialState.steps.supercomputer_damage_apply_level1_weapon_upgrade = { completed: false, dismissed: false, bubbleOpen: true, bubbleShown: false };
  tutorialState.currentStepId = 'supercomputer_damage_apply_level1_weapon_upgrade';

  const state = {
    ui: { menuOpen: false },
    cells: [],
    buyCounts: {},
    achievements: { totalMerges: 0 },
    player: {
      damagePoints: 2,
      cannonUpgradesApplied: [0],
      dronUpgradesApplied: [1],
      fenceUpgradesApplied: [0],
      talentsV2: { ranksById: {} },
    },
    tutorial: tutorialState,
  };

  globalObj.Game.TutorialRuntime.init({
    documentObj: makeVisibilityOnlyDocument({
      modsTankWallOverlay: makeVisibleElement('modsTankWallOverlay'),
      modsTankWallPanelGuns: makeVisibleElement('modsTankWallPanelGuns'),
    }),
    getState: function () { return state; },
    saveProgress: function () {},
    updateUi: function () {},
  });

  globalObj.Game.TutorialRuntime.syncNow();
  assertEqual(state.tutorial.steps.supercomputer_damage_apply_level1_weapon_upgrade.completed, true, 'damage apply step completes from an already-applied drone or wall upgrade too');
});

test('TUT-10F: talent overlay DOM module renders the stable tutorial target ids', () => {
  const sandbox = globalThis;
  sandbox.window = sandbox;
  sandbox.Game = {};

  function makeDocument() {
    const elements = {};
    function Element(tag) {
      this.tag = tag;
      this.children = [];
      this.style = { setProperty(name, value) { this[name] = value; } };
      this.className = '';
      this.textContent = '';
      this.type = '';
      this._id = '';
      this.attributes = {};
      Object.defineProperty(this, 'id', {
        get() { return this._id; },
        set(v) { this._id = v; if (v) elements[v] = this; },
      });
    }
    Element.prototype.setAttribute = function (name, value) { this.attributes[name] = value; };
    Element.prototype.getAttribute = function (name) { return this.attributes[name] || null; };
    Element.prototype.addEventListener = function (event, f) {
      this._listeners = this._listeners || {};
      this._listeners[event] = f;
    };
    Element.prototype.appendChild = function (child) {
      this.children.push(child);
    };
    return {
      body: new Element('body'),
      createElement: (tag) => new Element(tag),
      getElementById: (id) => elements[id] || null,
    };
  }

  const documentObj = makeDocument();
  const fn = new Function('window', 'global', talentOverlayDomJs);
  fn(sandbox, sandbox);
  sandbox.Game.TalentOverlayDom.ensure({
    documentObj: documentObj,
    translate: function (_key, fallback) { return fallback || ''; },
    branchIds: ['offense', 'defense', 'economy'],
    getBranchLabel: function (branchId) { return branchId; },
  });

  assert(!!documentObj.getElementById('talentOverlay'), 'talent overlay root created');
  assert(!!documentObj.getElementById('talentBranches'), 'talent branches container created');
  assert(!!documentObj.getElementById('talentApply'), 'talent apply button created');
  assert(!!documentObj.getElementById('talentResetAll'), 'talent reset-all button created');
  assert(!!documentObj.getElementById('talentActive0'), 'first active ability slot created');
  assert(!!documentObj.getElementById('talentGridV2-offense'), 'offense grid created with stable id');
  assert(!!documentObj.getElementById('talentSvgV2-defense'), 'defense svg created with stable id');
});

test('TUT-8C: talent overlay close button and help button share the supercomputer modal spacing pattern', () => {
  assert(styleCss.indexOf('.hangarChipsHelpBtn{') !== -1, 'shared question-button style exists');
  assert(styleCss.indexOf('padding-right:calc(var(--uiModalPad) + 56px);') !== -1, 'talent modal header reserves close-button space while keeping SC edge spacing');
  assert(styleCss.indexOf('#talentOverlay .modalClose{') !== -1, 'talent overlay has dedicated close-button positioning rule');
  assert(styleCss.indexOf('top:10px;') !== -1 && styleCss.indexOf('right:10px;') !== -1, 'close-button spacing matches the supercomputer modal edge offsets');
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
  assert(tutorialRuntimeJs.indexOf('return firstAvailable || firstIncomplete;') !== -1, 'runtime keeps the first available incomplete step instead of skipping ahead to later lessons');
  assert(tutorialRuntimeJs.indexOf('findMergeableTutorialPair') !== -1, 'runtime resolves merge tutorial targets from actual player state');
  assert(tutorialRuntimeJs.indexOf('activeStepMergedBaseline') !== -1, 'runtime tracks merge baseline for active step');
  assert(tutorialRuntimeJs.indexOf('getCompletedTankMergeCount(state) > runtime.activeStepMergedBaseline') !== -1, 'merge step completes only after merge count increases during active step');
});

test('TUT-10J: docs and AI maps document the first-available tutorial step rule and extracted talents UI orchestration', () => {
  assert(projectMapMd.indexOf('first available incomplete tutorial step') !== -1, 'project map records the first-available tutorial step invariant');
  assert(aiIndexMd.indexOf('first available incomplete tutorial step') !== -1, 'AI index points readers to the first-available tutorial step rule');
  assert(uiSystemMd.indexOf('first available incomplete tutorial step') !== -1, 'UI system doc records the tutorial runtime ordering rule');
  assert(gameJsMapMd.indexOf('src/ui/talentOverlayUi.js') !== -1, 'game.js map records the extracted talents overlay UI module');
  assert(uiTalentsV2Md.indexOf('src/ui/talentOverlayUi.js') !== -1, 'talents v2 UI doc records the extracted redraw/update orchestration module');
});

test('TUT-10G: tutorial keeps the earliest available supercomputer lesson ahead of later damage lessons', () => {
  const runtimeSource = fs.readFileSync(path.join(root, 'src/ui/tutorialRuntime.js'), 'utf-8');
  const stepsSource = fs.readFileSync(path.join(root, 'src/config/tutorialSteps.js'), 'utf-8');

  const globalObj = {
    window: null,
    Game: {},
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  };
  globalObj.window = globalObj;

  new Function('window', 'global', stepsSource)(globalObj, globalObj);
  new Function('window', 'global', runtimeSource)(globalObj, globalObj);

  const tutorialState = globalObj.Game.TutorialSteps.buildInitialTutorialState();
  tutorialState.steps.starter_tank = { completed: true, dismissed: false, bubbleOpen: false, bubbleShown: true };
  tutorialState.steps.second_tank = { completed: true, dismissed: false, bubbleOpen: false, bubbleShown: true };
  tutorialState.steps.merge_tank = { completed: true, dismissed: false, bubbleOpen: false, bubbleShown: true };

  const state = {
    ui: { menuOpen: false },
    cells: [],
    buyCounts: {},
    achievements: { totalMerges: 0 },
    supercomputer: { computerLevel: 1 },
    player: { freeTalentPointsV2: 1, damagePoints: 2, talentsV2: { ranksById: {} } },
    tutorial: tutorialState,
  };
  state.tutorial.flags.supercomputerLevelRewardDismissed = true;

  globalObj.Game.TutorialRuntime.init({
    documentObj: null,
    getState: function () { return state; },
    saveProgress: function () {},
    updateUi: function () {},
  });

  globalObj.Game.TutorialRuntime.syncNow();
  assertEqual(state.tutorial.currentStepId, 'supercomputer_open_menu', 'the earlier supercomputer menu lesson stays pending when both it and the damage lesson are available');
});

test('TUT-10H: root-open completion advances the gated talent-tree lesson before the later damage lesson', () => {
  const runtimeSource = fs.readFileSync(path.join(root, 'src/ui/tutorialRuntime.js'), 'utf-8');
  const stepsSource = fs.readFileSync(path.join(root, 'src/config/tutorialSteps.js'), 'utf-8');

  const globalObj = {
    window: null,
    Game: {},
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    getComputedStyle() { return { display: 'block', visibility: 'visible' }; },
  };
  globalObj.window = globalObj;

  new Function('window', 'global', stepsSource)(globalObj, globalObj);
  new Function('window', 'global', runtimeSource)(globalObj, globalObj);

  const tutorialState = globalObj.Game.TutorialSteps.buildInitialTutorialState();
  tutorialState.steps.starter_tank = { completed: true, dismissed: false, bubbleOpen: false, bubbleShown: true };
  tutorialState.steps.second_tank = { completed: true, dismissed: false, bubbleOpen: false, bubbleShown: true };
  tutorialState.steps.merge_tank = { completed: true, dismissed: false, bubbleOpen: false, bubbleShown: true };
  tutorialState.steps.supercomputer_open_menu = { completed: true, dismissed: false, bubbleOpen: false, bubbleShown: true };

  const state = {
    ui: { menuOpen: false },
    cells: [],
    buyCounts: {},
    achievements: { totalMerges: 0 },
    supercomputer: { computerLevel: 1 },
    player: { freeTalentPointsV2: 1, damagePoints: 2, talentsV2: { ranksById: {} } },
    tutorial: tutorialState,
  };
  state.tutorial.flags.supercomputerLevelRewardDismissed = true;

  globalObj.Game.TutorialRuntime.init({
    documentObj: makeVisibilityOnlyDocument({
      supercomputerMenuOverlay: makeVisibleElement('supercomputerMenuOverlay'),
    }),
    getState: function () { return state; },
    saveProgress: function () {},
    updateUi: function () {},
  });

  globalObj.Game.TutorialRuntime.syncNow();
  assertEqual(state.tutorial.currentStepId, 'supercomputer_open_talent_tree', 'opening the root menu makes the gated tree step the current tutorial step');
  assertEqual(state.tutorial.steps.supercomputer_damage_open_menu.completed, false, 'later damage lesson does not steal the root-open completion');
});

test('TUT-10I: talents-open state keeps the caliber lesson ahead of later damage lessons', () => {
  const runtimeSource = fs.readFileSync(path.join(root, 'src/ui/tutorialRuntime.js'), 'utf-8');
  const stepsSource = fs.readFileSync(path.join(root, 'src/config/tutorialSteps.js'), 'utf-8');

  const globalObj = {
    window: null,
    Game: {},
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    getComputedStyle() { return { display: 'block', visibility: 'visible' }; },
  };
  globalObj.window = globalObj;

  new Function('window', 'global', stepsSource)(globalObj, globalObj);
  new Function('window', 'global', runtimeSource)(globalObj, globalObj);

  const tutorialState = globalObj.Game.TutorialSteps.buildInitialTutorialState();
  tutorialState.steps.starter_tank = { completed: true, dismissed: false, bubbleOpen: false, bubbleShown: true };
  tutorialState.steps.second_tank = { completed: true, dismissed: false, bubbleOpen: false, bubbleShown: true };
  tutorialState.steps.merge_tank = { completed: true, dismissed: false, bubbleOpen: false, bubbleShown: true };
  tutorialState.steps.supercomputer_open_menu = { completed: true, dismissed: false, bubbleOpen: false, bubbleShown: true };
  tutorialState.steps.supercomputer_open_talent_tree = { completed: true, dismissed: false, bubbleOpen: false, bubbleShown: true };

  const state = {
    ui: { menuOpen: false },
    cells: [],
    buyCounts: {},
    achievements: { totalMerges: 0 },
    supercomputer: { computerLevel: 1 },
    player: { freeTalentPointsV2: 1, damagePoints: 2, talentsV2: { ranksById: {} } },
    tutorial: tutorialState,
  };
  state.tutorial.flags.supercomputerLevelRewardDismissed = true;

  globalObj.Game.TutorialRuntime.init({
    documentObj: makeVisibilityOnlyDocument({
      talentOverlay: makeVisibleElement('talentOverlay'),
    }),
    getState: function () { return state; },
    saveProgress: function () {},
    updateUi: function () {},
  });

  globalObj.Game.TutorialRuntime.syncNow();
  assertEqual(state.tutorial.currentStepId, 'supercomputer_apply_caliber', 'caliber lesson remains pending when the talents overlay is already open and a later damage lesson is also available');
});

test('TUT-10A: tutorial bubble is one-shot per cycle and restart resets the cycle', () => {
  assert(tutorialStepsJs.indexOf('bubbleShown: false') !== -1, 'tutorial step state tracks one-shot bubble display');
  assert(tutorialRuntimeJs.indexOf('bubbleShown = true;') !== -1, 'tutorial runtime stores shown-bubble fact');
  assert(tutorialRuntimeJs.indexOf('closeShownPendingBubble') !== -1, 'shown bubbles are auto-closed instead of reopening after suppression');
  assert(tutorialRuntimeJs.indexOf('tutorial.steps[activeStepId].completed = true;') === -1, 'closing a bubble no longer completes the step');
  assert(tutorialRuntimeJs.indexOf('state.tutorial = createDefaultTutorialState();') !== -1, 'enabling tutorial restarts the tutorial cycle');
});

test('TUT-10B: pending tutorial steps still complete after the key action makes them inactive', () => {
  const runtimeSource = fs.readFileSync(path.join(root, 'src/ui/tutorialRuntime.js'), 'utf-8');
  const stepsSource = fs.readFileSync(path.join(root, 'src/config/tutorialSteps.js'), 'utf-8');

  const secondTankGlobal = { window: null, Game: {}, localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} } };
  secondTankGlobal.window = secondTankGlobal;
  new Function('window', 'global', stepsSource)(secondTankGlobal, secondTankGlobal);
  new Function('window', 'global', runtimeSource)(secondTankGlobal, secondTankGlobal);

  const secondTankState = {
    coins: 50,
    ui: { menuOpen: false },
    cells: [{ i: 0, x: 0, y: 0, w: 64, h: 64, tank: { level: 1, onTrack: false } }],
    buyCounts: {},
    achievements: { totalMerges: 0 },
    tutorial: {
      version: 5,
      disabled: false,
      completed: false,
      currentStepId: 'second_tank',
      steps: {
        starter_tank: { completed: true, dismissed: false, bubbleOpen: false, bubbleShown: true },
        second_tank: { completed: false, dismissed: false, bubbleOpen: true, bubbleShown: true },
        merge_tank: { completed: false, dismissed: false, bubbleOpen: true, bubbleShown: false }
      }
    }
  };

  secondTankGlobal.Game.TutorialRuntime.init({
    documentObj: null,
    getState: function () { return secondTankState; },
    saveProgress: function () {},
    updateUi: function () {}
  });

  secondTankState.coins = 0;
  secondTankState.buyCounts = { lvl1: 1 };
  secondTankGlobal.Game.TutorialRuntime.syncNow();
  assertEqual(secondTankState.tutorial.steps.second_tank.completed, true, 'second_tank completes from pending state even after coins drop below activation');

  const mergeGlobal = { window: null, Game: {}, localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} } };
  mergeGlobal.window = mergeGlobal;
  new Function('window', 'global', stepsSource)(mergeGlobal, mergeGlobal);
  new Function('window', 'global', runtimeSource)(mergeGlobal, mergeGlobal);

  const mergeState = {
    coins: 0,
    ui: { menuOpen: false },
    cells: [{ i: 0, x: 0, y: 0, w: 64, h: 64, tank: { level: 2, onTrack: false } }],
    buyCounts: {},
    achievements: { totalMerges: 0 },
    tutorial: {
      version: 5,
      disabled: false,
      completed: false,
      currentStepId: 'merge_tank',
      steps: {
        starter_tank: { completed: true, dismissed: false, bubbleOpen: false, bubbleShown: true },
        second_tank: { completed: true, dismissed: false, bubbleOpen: false, bubbleShown: true },
        merge_tank: { completed: false, dismissed: false, bubbleOpen: true, bubbleShown: true }
      }
    }
  };

  mergeGlobal.Game.TutorialRuntime.init({
    documentObj: null,
    getState: function () { return mergeState; },
    saveProgress: function () {},
    updateUi: function () {}
  });

  mergeState.achievements.totalMerges = 1;
  mergeGlobal.Game.TutorialRuntime.syncNow();
  assertEqual(mergeState.tutorial.steps.merge_tank.completed, true, 'merge_tank completes from pending state even after the merge pair disappears');
});

test('TUT-10C: a shown bubble auto-closes when the tutorial overlay is suppressed', () => {
  const runtimeSource = fs.readFileSync(path.join(root, 'src/ui/tutorialRuntime.js'), 'utf-8');
  const stepsSource = fs.readFileSync(path.join(root, 'src/config/tutorialSteps.js'), 'utf-8');
  const globalObj = { window: null, Game: {}, localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} } };
  globalObj.window = globalObj;
  new Function('window', 'global', stepsSource)(globalObj, globalObj);
  new Function('window', 'global', runtimeSource)(globalObj, globalObj);

  const state = {
    coins: 40,
    ui: { menuOpen: true },
    cells: [{ i: 0, x: 0, y: 0, w: 64, h: 64, tank: { level: 1, onTrack: false } }],
    buyCounts: {},
    achievements: { totalMerges: 0 },
    tutorial: {
      version: 5,
      disabled: false,
      completed: false,
      currentStepId: 'starter_tank',
      steps: {
        starter_tank: { completed: false, dismissed: false, bubbleOpen: true, bubbleShown: true },
        second_tank: { completed: false, dismissed: false, bubbleOpen: true, bubbleShown: false },
        merge_tank: { completed: false, dismissed: false, bubbleOpen: true, bubbleShown: false }
      }
    }
  };

  globalObj.Game.TutorialRuntime.init({
    documentObj: null,
    getState: function () { return state; },
    saveProgress: function () {},
    updateUi: function () {}
  });

  assertEqual(state.tutorial.steps.starter_tank.bubbleOpen, false, 'shown bubble closes when overlay is suppressed instead of reopening later');
});

test('TUT-13: hangar tech help button and modal hooks are wired into the overlay', () => {
  assert(indexHtml.indexOf('id="modsHangarHelpBtn"') !== -1, 'hangar overlay includes a dedicated help button');
  assert(indexHtml.indexOf('data-tech-help-open="true"') !== -1, 'hangar help button exposes the expected action attribute');
  assert(hangarChipsUiJs.indexOf('syncTechUnlockHelpButtonCopy') !== -1, 'hangar UI syncs help button caption through i18n');
  assert(hangarChipsUiJs.indexOf('_showTechUnlockHelpModal') !== -1, 'hangar UI implements the help modal opener');
  assert(hangarChipsUiJs.indexOf('getActiveHangarHelpConfig') !== -1, 'hangar help modal resolves copy from the active tab');
  assert(hangarChipsUiJs.indexOf("if (tabId === 'workshop')") !== -1, 'hangar help keeps dedicated workshop copy instead of reusing tech unlock text');
  assert(hangarChipsUiJs.indexOf("helpBtn.setAttribute('data-ui-tooltip', label);") !== -1, 'hangar help button uses the unified game tooltip');
  assert(hangarChipsUiJs.indexOf("helpBtn.setAttribute('title', label);") === -1, 'hangar help button no longer uses a native title tooltip');
  assert(hangarChipsUiJs.indexOf('techModal__dialog--help') !== -1, 'hangar help modal uses dedicated help layout styling');
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