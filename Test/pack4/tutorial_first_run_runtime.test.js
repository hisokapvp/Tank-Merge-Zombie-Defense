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
  assert(tutorialStepsJs.indexOf('#modsTankWallOverlay .scGunsTable__row[data-level="1"] [data-guns-action="plus"]') !== -1, 'damage tutorial points to the first gun level plus button');
  assert(tutorialStepsJs.indexOf("kind: 'supercomputer_damage_upgrade_applied'") !== -1, 'damage tutorial completes on any applied weapons/drones/walls upgrade');
  assert(tutorialStepsJs.indexOf('#modsTankWallOverlay [data-dron-action="apply"]') !== -1, 'damage tutorial unlocks drone apply controls too');
  assert(tutorialStepsJs.indexOf('#modsTankWallOverlay [data-walls-action="apply"]') !== -1, 'damage tutorial unlocks wall apply controls too');
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

test('TUT-8D: tutorial runtime documentation lives in a dedicated map and UI docs only link to it', () => {
  assert(aiIndexMd.indexOf('docs/ai/SYSTEMS/tutorial-runtime.md') !== -1, 'AI index links to dedicated tutorial runtime map');
  assert(uiSystemMd.indexOf('docs/ai/SYSTEMS/tutorial-runtime.md') !== -1, 'UI system doc links to dedicated tutorial runtime map');
  assert(tutorialRuntimeMd.indexOf('getPreferredPendingStepId') !== -1, 'tutorial runtime map documents first-available step selection');
  assert(tutorialRuntimeMd.indexOf('supercomputer_damage_apply_level1_weapon_upgrade') !== -1, 'tutorial runtime map documents the supercomputer damage lesson invariant');
});

test('TUT-8E: tutorial bubble CSS wraps long text and keeps controls visible on small screens', () => {
  assert(styleCss.indexOf('width:clamp(332px, 34vw, 460px);') !== -1, 'tutorial bubble uses a fixed-width desktop shell');
  assert(styleCss.indexOf('overflow-wrap:break-word;') !== -1, 'tutorial message wraps long text by words');
  assert(styleCss.indexOf('flex-wrap:wrap;') !== -1, 'tutorial actions can wrap instead of clipping');
  assert(styleCss.indexOf('min-width:100%;') !== -1, 'tutorial actions stack to full width on narrow viewports');
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