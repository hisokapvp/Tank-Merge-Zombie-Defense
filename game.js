// Tank Merger: Zombie Orbit

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
const GameApi = (window.Game = window.Game || {});
const SeededRngApi = GameApi?.SeededRng ?? null;

const RuntimeTasks = GameApi.RuntimeTasks || { install(){}, clearAll(){}, suspendAll(){}, resumeAll(){} };

RuntimeTasks.install();

const ui = {
  coins: document.getElementById('coins'),
  zcount: document.getElementById('zcount'),
  buy: document.getElementById('buy'),
  buyCost: document.getElementById('buyCost'),
  buyBulk: document.getElementById('buyBulk'),
  autoMergeBtn: document.getElementById('autoMergeBtn'),
  supercomputerBtn: document.getElementById('supercomputerBtn'),
  achievementsBtn: document.getElementById('achievementsBtn'),
  achievementsModal: document.getElementById('achievementsModal'),
  achievementsClose: document.getElementById('achievementsClose'),
  achievementsList: document.getElementById('achievementsList'),
  achievementPopup: document.getElementById('achievementPopup'),
  achievementPopupClose: document.getElementById('achievementPopupClose'),
  achievementPopupClaim: document.getElementById('achievementPopupClaim'),
  achievementPopupName: document.getElementById('achievementPopupName'),
  achievementPopupReward: document.getElementById('achievementPopupReward'),
  achievementToast: document.getElementById('achievementToast'),
  settingsBtn: document.getElementById('settingsBtn'),
  bigMenuOverlay: document.getElementById('bigMenuOverlay'),
  bigMenuRootView: document.getElementById('bigMenuRootView'),
  bigMenuNew: document.getElementById('bigMenuNew'),
  bigMenuLoad: document.getElementById('bigMenuLoad'),
  bigMenuLoadView: document.getElementById('bigMenuLoadView'),
  bigMenuLoadRows: document.getElementById('bigMenuLoadRows'),
  bigMenuLoadBack: document.getElementById('bigMenuLoadBack'),
  bigMenuSound: document.getElementById('bigMenuSound'),
  bigMenuSoundWrap: document.getElementById('bigMenuSoundWrap'),
  bigMenuLanguageWrap: document.getElementById('bigMenuLanguageWrap'),
  bigMenuLanguage: document.getElementById('bigMenuLanguage'),
  bigMenuDevs: document.getElementById('bigMenuDevs'),
  bigMenuSoundPanel: document.getElementById('bigMenuSoundPanel'),
  bigMenuLanguagePanel: document.getElementById('bigMenuLanguagePanel'),
  bigMenuSfx: document.getElementById('bigMenuSfx'),
  bigMenuMusic: document.getElementById('bigMenuMusic'),
  bigMenuSfxValue: document.getElementById('bigMenuSfxValue'),
  bigMenuMusicValue: document.getElementById('bigMenuMusicValue'),
  bigMenuRootAutoPause: document.getElementById('bigMenuRootAutoPause'),
  bigMenuLangRu: document.getElementById('bigMenuLangRu'),
  bigMenuLangEn: document.getElementById('bigMenuLangEn'),
  creditsModal: document.getElementById('creditsModal'),
  creditsModalTitle: document.getElementById('creditsModalTitle'),
  creditsModalClose: document.getElementById('creditsModalClose'),
  creditsModalList: document.getElementById('creditsModalList'),
  langRu: document.getElementById('langRu'),
  langEn: document.getElementById('langEn'),
  menuOverlay: document.getElementById('menuOverlay'),
  menuContinue: document.getElementById('menuContinue'),
  menuNew: document.getElementById('menuNew'),
  menuSave: document.getElementById('menuSave'),
  menuLoad: document.getElementById('menuLoad'),
  menuExit: document.getElementById('menuExit'),
  smallMenuRootView: document.getElementById('smallMenuRootView'),
  smallMenuSaveView: document.getElementById('smallMenuSaveView'),
  smallMenuLoadView: document.getElementById('smallMenuLoadView'),
  smallMenuSaveRows: document.getElementById('smallMenuSaveRows'),
  smallMenuLoadRows: document.getElementById('smallMenuLoadRows'),
  smallMenuSaveBack: document.getElementById('smallMenuSaveBack'),
  smallMenuLoadBack: document.getElementById('smallMenuLoadBack'),
  smallMenuSaveToast: document.getElementById('smallMenuSaveToast'),
  menuMainView: document.getElementById('menuMainView'),
  menuExitConfirmView: document.getElementById('menuExitConfirmView'),
  menuNewConfirmView: document.getElementById('menuNewConfirmView'),
  menuNewConfirmStart: document.getElementById('menuNewConfirmStart'),
  menuNewConfirmBack: document.getElementById('menuNewConfirmBack'),
  menuExitConfirmLeave: document.getElementById('menuExitConfirmLeave'),
  menuExitConfirmCancel: document.getElementById('menuExitConfirmCancel'),
  menuSfx: document.getElementById('menuSfx'),
  menuMusic: document.getElementById('menuMusic'),
  menuAutoPause: document.getElementById('menuAutoPause'),
  menuTutorialToggle: document.getElementById('menuTutorialToggle'),
  menuSfxValue: document.getElementById('menuSfxValue'),
  menuMusicValue: document.getElementById('menuMusicValue'),
  bigMenuAutoPause: document.getElementById('bigMenuAutoPause'),
  bigMenuRootTutorial: document.getElementById('bigMenuRootTutorial'),
  crateModal: document.getElementById('crateModal'),
  crateClose: document.getElementById('crateClose'),
  crateGet: document.getElementById('crateGet'),
  crateIcon: document.getElementById('crateTankIcon'),
  crateText: document.getElementById('crateText'),
  levelModal: document.getElementById('levelModal'),
  levelTitle: document.getElementById('levelTitle'),
  levelTalent: document.getElementById('levelTalent'),
  levelGold: document.getElementById('levelGold'),
  levelAccept: document.getElementById('levelAccept'),
  levelClose: document.getElementById('levelModalClose'),
  dismantleBtn: document.getElementById('dismantleBtn'),
  dismantleModal: document.getElementById('dismantleModal'),
  dismantleConfirmText: document.getElementById('dismantleConfirmText'),
  dismantleYes: document.getElementById('dismantleYes'),
  dismantleNo: document.getElementById('dismantleNo'),
  terminalPanel: document.getElementById('terminalPanel'),
  terminalCollapseBtn: document.getElementById('terminalCollapseBtn'),
  terminalExpandBtn: document.getElementById('terminalExpandBtn'),
  stageAbilitySlots: document.getElementById('stageAbilitySlots'),
  xpWrap: document.getElementById('xpWrap'),
  stageUiRight: document.querySelector('.stageUiRight'),
};

const MAX_TANK_LEVEL = 60;
const CANNON_UPGRADES_LEVELS = 60;
const ProgressionApi = GameApi?.Progression ?? null;
function computePowerTier(computerLevel){
  if (ProgressionApi && ProgressionApi.computePowerTier) {
    return ProgressionApi.computePowerTier(computerLevel);
  }
  const lvl = Math.max(0, Math.floor(Number.isFinite(computerLevel) ? computerLevel : 0));
  if (lvl < 10) return 0;
  if (lvl < 20) return 1;
  if (lvl < 30) return 2;
  if (lvl < 40) return 3;
  if (lvl < 50) return 4;
  return 5;
}

const CannonUpgradesApi = GameApi?.CannonUpgrades ?? null;

function createFallbackCannonUpgrades(levels){
  return CannonUpgradesApi
    ? CannonUpgradesApi.createFallbackCannonUpgrades(levels ?? CANNON_UPGRADES_LEVELS)
    : [];
}

function normalizeCannonUpgradesConfig(raw){
  return CannonUpgradesApi
    ? CannonUpgradesApi.normalizeCannonUpgradesConfig(raw, CANNON_UPGRADES_LEVELS)
    : null;
}

let CannonUpgradesBalance = createFallbackCannonUpgrades(CANNON_UPGRADES_LEVELS);

function getCannonUpgradeConfig(){
  return Array.isArray(CannonUpgradesBalance) ? CannonUpgradesBalance : createFallbackCannonUpgrades(CANNON_UPGRADES_LEVELS);
}

function getCannonUpgradeRow(level){
  const lvl = Number.isFinite(level) ? Math.max(1, Math.min(CANNON_UPGRADES_LEVELS, Math.floor(level))) : 1;
  const cfg = getCannonUpgradeConfig();
  return cfg[lvl - 1] || null;
}

function normalizeAppliedCannonUpgrade(value){
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function ensureCannonUpgradesAppliedState(){
  if (!state.player || typeof state.player !== 'object') {
    state.player = {};
  }
  const source = Array.isArray(state.player.cannonUpgradesApplied) ? state.player.cannonUpgradesApplied : [];
  if (source.length !== CANNON_UPGRADES_LEVELS) {
    state.player.cannonUpgradesApplied = Array(CANNON_UPGRADES_LEVELS).fill(0);
    for (let i = 0; i < Math.min(source.length, CANNON_UPGRADES_LEVELS); i++) {
      state.player.cannonUpgradesApplied[i] = normalizeAppliedCannonUpgrade(source[i]);
    }
    return state.player.cannonUpgradesApplied;
  }
  state.player.cannonUpgradesApplied = source;
  return source;
}

function normalizeAppliedFenceUpgrade(value){
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function normalizeAppliedDronUpgrade(value){
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function ensureFenceUpgradesAppliedState(){
  if (!state.player || typeof state.player !== 'object') state.player = {};
  var source = Array.isArray(state.player.fenceUpgradesApplied) ? state.player.fenceUpgradesApplied : [];
  if (source.length !== MAX_TANK_LEVEL) {
    state.player.fenceUpgradesApplied = Array(MAX_TANK_LEVEL).fill(0);
    for (var i = 0; i < Math.min(source.length, MAX_TANK_LEVEL); i++) {
      state.player.fenceUpgradesApplied[i] = normalizeAppliedFenceUpgrade(source[i]);
    }
    return state.player.fenceUpgradesApplied;
  }
  state.player.fenceUpgradesApplied = source;
  return source;
}

function ensureDronUpgradesAppliedState(){
  if (!state.player || typeof state.player !== 'object') state.player = {};
  var levelsCount = MAX_TANK_LEVEL;
  try {
    levelsCount = getDronLevelsCount();
  } catch (e) {
    var existing = Array.isArray(state.player.dronUpgradesApplied) ? state.player.dronUpgradesApplied.length : 0;
    levelsCount = existing > 0 ? Math.min(MAX_TANK_LEVEL, existing) : MAX_TANK_LEVEL;
  }
  var source = Array.isArray(state.player.dronUpgradesApplied) ? state.player.dronUpgradesApplied : [];
  if (source.length !== levelsCount) {
    state.player.dronUpgradesApplied = Array(levelsCount).fill(0);
    for (var i = 0; i < Math.min(source.length, levelsCount); i++) {
      state.player.dronUpgradesApplied[i] = normalizeAppliedDronUpgrade(source[i]);
    }
    return state.player.dronUpgradesApplied;
  }
  state.player.dronUpgradesApplied = source;
  return source;
}

function normalizeStoredUntilSec(value){
  if (!Number.isFinite(value)) return 0;
  var safe = Number(value);
  if (safe <= 0) return 0;
  return safe > 1e11 ? (safe / 1000) : safe;
}

function normalizeActiveEffectsTimestamps(){
  if (!state || typeof state !== 'object') return;
  state.boostUntil = normalizeStoredUntilSec(state.boostUntil);
  if (!state.activeEffects || typeof state.activeEffects !== 'object') {
    state.activeEffects = { attackUntil: 0, speedUntil: 0, economyUntil: 0 };
    return;
  }
  state.activeEffects.attackUntil = normalizeStoredUntilSec(state.activeEffects.attackUntil);
  state.activeEffects.speedUntil = normalizeStoredUntilSec(state.activeEffects.speedUntil);
  state.activeEffects.economyUntil = normalizeStoredUntilSec(state.activeEffects.economyUntil);
}

function getAppliedFenceUpgradeLevel(level){
  var applied = ensureFenceUpgradesAppliedState();
  var lvl = Number.isFinite(level) ? Math.max(1, Math.min(MAX_TANK_LEVEL, Math.floor(level))) : 1;
  var idx = lvl - 1;
  var value = normalizeAppliedFenceUpgrade(applied[idx]);
  if (applied[idx] !== value) applied[idx] = value;
  return value;
}

function getAppliedCannonUpgradeLevel(level){
  const applied = ensureCannonUpgradesAppliedState();
  const lvl = Number.isFinite(level) ? Math.max(1, Math.min(CANNON_UPGRADES_LEVELS, Math.floor(level))) : 1;
  const idx = lvl - 1;
  const value = normalizeAppliedCannonUpgrade(applied[idx]);
  if (applied[idx] !== value) applied[idx] = value;
  return value;
}

function refreshTanksPowerTier(){
  const tier = computePowerTier(getComputerLevel());
  for (const cell of state.cells || []){
    if (cell.tank) cell.tank.powerTier = tier;
  }
}

const BAL = {
  rows: 4,
  cols: 4,
  cellW: 48,
  cellH: 38,
  cellGap: 5,
  boardPad: 8,

  buyCostLv1: 50,

  dmgBase: 7,
  dmgMultPerLevel: 1.48,
  fireRateBase: 0.85,
  fireRateAddPerLevel: 0.075,
  rangeBase: 315,
  rangePerLevel: 10,

  zombieTrackRadius: 340,
  zombieTrackWidth: 22,
  hangarMarginRatio: 0.06,
  fenceRadius: 0,
  fenceWidth: 20,
  fenceKeepout: 12,
  zombieFencePush: 24,
  tankOrbitRadius: 250,
  tankOrbitSpeed: 0.55,
  tankTrackWidth: 16,
  roadFenceGap: 8,
  zombieCountTarget: 150,
  zombieSideCount: 4,
  zombiePerSideTarget: 38,
  zombiePerSideTolerance: 5,
  corpseMaxCount: 150,
  zombieHpBase: 44,
  zombieHpVar: 0.22,
  omegaBase: 0.72,
  omegaVar: 0.18,
  zombieSwayAmp: 0.14,

  zombieScaleMul: 0.72,
  zombieLevelScaleAdd: 0,
  zombieBobAmp: 1.2,
  zombieBobSpeedMul: 7.0,
  zombieShadowW: 11,
  zombieShadowH: 5,
  zombieShadowY: 8,
  zombieGroundOffset: 6,
  zombieHpExtraPerLevel: 0.12,
  zombieLevelOmegaMul: 0.08,

  edgeSpawnRadius: 520,
  edgeJoinSpeed: 0.9,

  coinsPerKillBase: 1,
  coinsPerKillLevelMul: 0.35,
  zombieKillCoinsMul: 0.5,
  zombieKillXpMul: 0.5,
  coinsPerShotBase: 1,
  coinsPerShotLevelMul: 0.55,
  levelGoldBase: 60,
  levelGoldPerLevel: 18,
  levelRewardAutoCloseSec: 4.5,

  boostDurationSec: 60,
  boostMult: 2,
  tankSpriteScaleMul: 2.2,
  tankSpriteRotOffset: -Math.PI/2,

  maxParticles: 1600,
  maxDecals: 120,
  tankTrackCenterOffset: 0.5,

  crateIntervalSec: 60,
  crateDropSpeed: 220,
  crateSize: 34,

  fenceSpriteIds: [],

  decorSpriteIds: [],
  decorCount: null,
  decorNoSpawnZones: [],
  decorMaxAttempts: 400,
};

const ACTIVE_ABILITY_DURATION_SEC = 6;
const BOOST_EFFECT_DEFS = [
  { boostId: 'speedBoost', source: 'state', key: 'boostUntil', secondsTotal: BAL.boostDurationSec },
  { boostId: 'attackBoost', source: 'activeEffects', key: 'attackUntil', secondsTotal: ACTIVE_ABILITY_DURATION_SEC },
  { boostId: 'defenseBoost', source: 'activeEffects', key: 'speedUntil', secondsTotal: ACTIVE_ABILITY_DURATION_SEC },
  { boostId: 'economyBoost', source: 'activeEffects', key: 'economyUntil', secondsTotal: ACTIVE_ABILITY_DURATION_SEC },
];

const BASE_BAL = {
  cellW: 48,
  cellH: 38,
  cellGap: 5,
  boardPad: 8,
  zombieTrackRadius: 340,
  zombieTrackWidth: 22,
  hangarMarginRatio: 0.06,
  fenceWidth: 20,
  fenceKeepout: 12,
  zombieFencePush: 24,
  tankOrbitRadius: 250,
  tankTrackWidth: 16,
  roadFenceGap: 8,
  zombieScaleMul: 0.72,
  zombieBobAmp: 1.2,
  zombieShadowW: 11,
  zombieShadowH: 5,
  zombieShadowY: 8,
  zombieGroundOffset: 6,
  edgeSpawnRadius: 520,
  crateDropSpeed: 220,
  crateSize: 34,
};

const FENCE_HP_MUL = 1.05;
const FENCE_ARMOR_MUL = 1.05;

let BalanceConfig = { zombie: {}, zombieOverrides: {}, tank: {}, tankOverrides: {} };
GameApi.Balance = GameApi.Balance || {};
GameApi.Balance.CannonUpgrades = getCannonUpgradeConfig();

function getZombieBalanceMul(typeId, key) {
  const base = Number.isFinite(BalanceConfig.zombie?.[key]) ? BalanceConfig.zombie[key] : 1;
  const over = BalanceConfig.zombieOverrides?.[typeId];
  if (over && Number.isFinite(over[key])) return over[key];
  return base;
}
function getTankBalanceMul(level, key) {
  const base = Number.isFinite(BalanceConfig.tank?.[key]) ? BalanceConfig.tank[key] : 1;
  const over = BalanceConfig.tankOverrides?.['level_' + level];
  const baseMul = over && Number.isFinite(over[key]) ? over[key] : base;
  if (key !== 'attackDamageMul' && key !== 'attackSpeedMul') {
    return baseMul;
  }
  const row = getCannonUpgradeRow(level);
  if (!row) return baseMul;
  const applied = getAppliedCannonUpgradeLevel(level);
  if (applied <= 0) return baseMul;
  const perUpgradeMul = key === 'attackDamageMul' ? Number(row[3]) : Number(row[4]);
  if (!Number.isFinite(perUpgradeMul) || perUpgradeMul <= 0) return baseMul;
  return baseMul * (1 + applied * perUpgradeMul);
}

const backgroundLayer = {
  canvas: null,
  ready: false,
};

const audioDefaultsFromApi = GameApi?.AudioSettings?.DEFAULT_SETTINGS;
const audioUiConfig = GameApi?.Config?.AudioUi ?? null;
const TRACK_LOOP_ID = 'trackLoop';
const DEFAULT_TRACK_LOOP_SOURCES = ['assets/sfx/TankDrive.ogg', 'assets/sfx/TankDrive.mp3'];
const TRACK_LOOP_CODE_VOLUME_MUL = Number.isFinite(audioUiConfig?.TANK_DRIVE_VOLUME_MULT)
  ? Math.max(0, Number(audioUiConfig.TANK_DRIVE_VOLUME_MULT))
  : 3;
const DEFAULT_SETTINGS = audioDefaultsFromApi
  ? { ...audioDefaultsFromApi }
  : {
      sfxVolume: 0.75,
      musicVolume: 0.6,
      autoPauseOnInactive: false,
    };

let settings = { ...DEFAULT_SETTINGS };
let audioSettingsController = null;
let bootPromise = null;
let bigMenuInitialized = false;
let bigMenuStartPending = false;
let lastActiveButtonIdBigMenu = null;
let bootInitialMenuSubView = 'main';
let bigMenuViewMode = 'root';
let sessionStartGate = 'locked';
let bigMenuLanguageOutsideListener = null;
let creditsEscListener = null;
let creditsDataLoaded = false;
let creditsData = [];

let sfxPoolRuntimeController = null;
let worldEventsRuntimeController = null;
let crateRuntimeController = null;
let zombieRenderRuntimeController = null;
let bigMenuRuntimeController = null;
let smallMenuRuntimeController = null;
const InitialStateApi = GameApi?.InitialState ?? null;
const AchievementsApi = GameApi?.Achievements ?? null;
const SupercomputerApi = GameApi?.Supercomputer ?? null;
const DronesApi = GameApi?.Drones ?? null;
const TankHangarAnimationApi = GameApi?.TankHangarAnimation ?? null;
const FenceSidesApi = GameApi?.FenceSides ?? null;

function createInitialState(options){
  const opts = options || {};
  const reason = opts.reason === 'new_game' ? 'new_game' : 'boot';
  const initialState = InitialStateApi && InitialStateApi.createInitialState
    ? InitialStateApi.createInitialState({ maxLevel: MAX_TANK_LEVEL, reason })
    : { coins: 120, kills: 0, totalDamageDealtRaw: 0, zombieWaveAtkMult: 1,
        damagePointsSpent: 0, fenceLevel: 1, cells: [], boardRect: {x:0,y:0,w:0,h:0},
        zombies: [], projectiles: [], impacts: [], decals: [], particles: [],
        damageNumbers: [], drones: [], decors: [], wallDecors: [],
        mapSeeds: { stampsSeed: null, decorSeed: null }, nextZombieRenderOrder: 1,
        fenceSegments: [], fenceSegmentsMeta: null, savedFenceState: null,
        crate: null, nextCrateAt: 0, dragging: null, boostUntil: 0, empUntil: 0,
        activeEffects: { attackUntil: 0, speedUntil: 0, economyUntil: 0 },
        supercomputer: { computerLevel: 0, xp: 0, xpToNext: 50, maxLevel: MAX_TANK_LEVEL,
          hp: 920, maxHp: 920, armorFlat: 2, x: 0, y: 0, offsetY: 64,
          state: 'idle', animElapsedSec: 0, glitchLoopsRemaining: 0,
          glitchCooldownUntil: 0, wantsBuildTank: false, pendingBuildTank: false,
          eventShown40: false, eventShown50: false, eventShown60: false },
        player: { talentPoints: 0, damagePoints: 0, talentsApplied: [],
          activeCooldowns: [0,0,0],
          cannonUpgradesApplied: Array(CANNON_UPGRADES_LEVELS).fill(0),
          dronUpgradesApplied: Array(MAX_TANK_LEVEL).fill(0),
          mods: null, modsDirty: true,
          eventShown40: false, eventShown50: false, eventShown60: false },
        endgameVisuals: false, maxTankLevelAchieved: 1, runtimeMaxTankLevelAchieved: 1, currentFenceTierApplied: 1, buyCounts: {}, buyPrices: {},
        achievements: { unlocked: {}, popupQueue: [], totalPurchased: 0, totalMerges: 0 },
        ui: { talentsOpen: false, talentBranch: 0, levelReward: null, levelRewardTimer: 0,
          menuOpen: true, toast: { active: null, queue: [] },
          unlockFx: { autoMergeUntilMs: 0, bulkBuyUntilMs: 0 } },
        flags: {
          preRetryAutosavedThisCritical: false,
          wasCritical: false,
          preRetrySaveFailed: false,
        },
        selectedHangarCellIndex: null, isDismantleMode: false, selectedTankIds: [] };
  if (reason === 'new_game') {
    if (!initialState.player || typeof initialState.player !== 'object') {
      initialState.player = { talentPoints: 0, talentsV2: { ranksById: {}, freePoints: 0 }, freeTalentPointsV2: 0 };
    } else {
      initialState.player.talentPoints = 0;
      if (!initialState.player.talentsV2 || typeof initialState.player.talentsV2 !== 'object') {
        initialState.player.talentsV2 = { ranksById: {}, freePoints: 0 };
      } else {
        initialState.player.talentsV2.freePoints = 0;
      }
      initialState.player.freeTalentPointsV2 = 0;
    }
  }
  if (!Number.isFinite(initialState.runtimeMaxTankLevelAchieved)) {
    initialState.runtimeMaxTankLevelAchieved = Number.isFinite(initialState.maxTankLevelAchieved)
      ? Math.max(1, Math.floor(initialState.maxTankLevelAchieved))
      : 1;
  }
  if (!Number.isFinite(initialState.currentFenceTierApplied)) {
    initialState.currentFenceTierApplied = Number.isFinite(initialState.fenceLevel)
      ? Math.max(1, Math.floor(initialState.fenceLevel))
      : 1;
  }
  return initialState;
}

let state = createInitialState();
let meta = { lastSeenAt: null };
ensureCannonUpgradesAppliedState();
ensureDronUpgradesAppliedState();

function normalizeTotalDamageDealtRaw(value){
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function normalizeDamagePointsSpent(value){
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function ensureDamageProgressState(){
  state.totalDamageDealtRaw = normalizeTotalDamageDealtRaw(state.totalDamageDealtRaw);
  return state.totalDamageDealtRaw;
}

function ensureDamagePointsSpentState(){
  state.damagePointsSpent = normalizeDamagePointsSpent(state.damagePointsSpent);
  return state.damagePointsSpent;
}

function ensureRuntimeFlagsState(){
  if (!state.flags || typeof state.flags !== 'object') {
    state.flags = {};
  }
  state.flags.preRetryAutosavedThisCritical = !!state.flags.preRetryAutosavedThisCritical;
  state.flags.wasCritical = !!state.flags.wasCritical;
  state.flags.preRetrySaveFailed = !!state.flags.preRetrySaveFailed;
  if (!Array.isArray(state.flags.preRetryDronesSnapshot)) state.flags.preRetryDronesSnapshot = [];
  return state.flags;
}

function resetCriticalEntryRuntimeFlags(){
  var flags = ensureRuntimeFlagsState();
  flags.preRetryAutosavedThisCritical = false;
  flags.wasCritical = false;
  flags.preRetrySaveFailed = false;
  flags.preRetryDronesSnapshot = [];
}

function ensurePlayerDamagePointsState(){
  if (!state.player || typeof state.player !== 'object') state.player = {};
  const totalDamagePoints = Math.floor(ensureDamageProgressState() / 10000);
  const spent = ensureDamagePointsSpentState();
  const available = Math.max(0, totalDamagePoints - spent);
  state.player.damagePoints = available;
  return available;
}

function getAvailableDamagePoints(){
  return ensurePlayerDamagePointsState();
}

function getDamagePoints(){
  return getAvailableDamagePoints();
}

function getCannonUpgradeStepCost(level, appliedIndex){
  return getUpgradeStepCost(level, appliedIndex);
}

function getUpgradeStepCost(level, appliedIndex){
  // unified upgrade cost for fences and cannons
  var lvl = Number.isFinite(level) ? Math.max(1, Math.min(MAX_TANK_LEVEL, Math.floor(level))) : 1;
  var idx = Number.isFinite(appliedIndex) ? Math.max(0, Math.floor(appliedIndex)) : 0;
  // try fence config first
  var cfg = FenceSprites && FenceSprites.config ? FenceSprites.config : null;
  var base = 0;
  if (cfg && Array.isArray(cfg.levels) && cfg.levels[lvl - 1] && Number.isFinite(cfg.levels[lvl - 1].upgradeCostDamagePoints)) {
    base = Math.max(0, Math.floor(cfg.levels[lvl - 1].upgradeCostDamagePoints));
  } else {
    // fallback to cannon upgrades balance table
    var row = getCannonUpgradeRow(lvl);
    if (row && Number.isFinite(Number(row[1]))) base = Math.max(0, Math.floor(Number(row[1])));
  }
  if (!Number.isFinite(base) || base <= 0) return 0;
  // exponential growth per step (safe, ceil)
  var multiplier = 1.2;
  var cost = Math.ceil(base * Math.pow(multiplier, idx));
  if (!Number.isFinite(cost) || cost <= 0) return 0;
  if (cost > Number.MAX_SAFE_INTEGER) return Number.MAX_SAFE_INTEGER;
  return cost;
}

function getCannonUpgradeIconFrames(level){
  const layoutTuning = (window.Game && window.Game.Config && window.Game.Config.LayoutTuning) || {};
  const perLevel = Array.isArray(layoutTuning.weaponIconAnimFramesByLevel)
    ? layoutTuning.weaponIconAnimFramesByLevel
    : null;
  const idx = Number.isFinite(level) ? Math.max(1, Math.min(MAX_TANK_LEVEL, Math.floor(level))) - 1 : 0;
  if (perLevel && Number.isFinite(perLevel[idx]) && perLevel[idx] >= 1) {
    return Math.floor(perLevel[idx]);
  }
  const row = getCannonUpgradeRow(level);
  if (!row) return 1;
  const value = Number(row[5]);
  if (!Number.isFinite(value) || value < 1) return 1;
  return Math.floor(value);
}

function getCannonUpgradeIconFps(level){
  const layoutTuning = (window.Game && window.Game.Config && window.Game.Config.LayoutTuning) || {};
  const perLevel = Array.isArray(layoutTuning.weaponIconAnimFpsByLevel)
    ? layoutTuning.weaponIconAnimFpsByLevel
    : null;
  const idx = Number.isFinite(level) ? Math.max(1, Math.min(MAX_TANK_LEVEL, Math.floor(level))) - 1 : 0;
  if (perLevel && Number.isFinite(perLevel[idx]) && perLevel[idx] > 0) {
    return Number(perLevel[idx]);
  }
  return 8;
}

function getDronUpgradeIconFrames(level){
  const layoutTuning = (window.Game && window.Game.Config && window.Game.Config.LayoutTuning) || {};
  const perLevel = Array.isArray(layoutTuning.droneIconAnimFramesByLevel)
    ? layoutTuning.droneIconAnimFramesByLevel
    : null;
  const idx = Number.isFinite(level) ? Math.max(1, Math.min(MAX_TANK_LEVEL, Math.floor(level))) - 1 : 0;
  if (perLevel && Number.isFinite(perLevel[idx]) && perLevel[idx] >= 1) {
    return Math.floor(perLevel[idx]);
  }
  const cfg = getDronRuntimeConfig();
  const fly = cfg && cfg.animations && cfg.animations.fly ? cfg.animations.fly : null;
  const frames = Number(fly && fly.frames);
  if (!Number.isFinite(frames) || frames < 1) return 1;
  return Math.floor(frames);
}

function getDronUpgradeIconFps(level){
  const layoutTuning = (window.Game && window.Game.Config && window.Game.Config.LayoutTuning) || {};
  const perLevel = Array.isArray(layoutTuning.droneIconAnimFpsByLevel)
    ? layoutTuning.droneIconAnimFpsByLevel
    : null;
  const idx = Number.isFinite(level) ? Math.max(1, Math.min(MAX_TANK_LEVEL, Math.floor(level))) - 1 : 0;
  if (perLevel && Number.isFinite(perLevel[idx]) && perLevel[idx] > 0) {
    return Number(perLevel[idx]);
  }
  const cfg = getDronRuntimeConfig();
  const fly = cfg && cfg.animations && cfg.animations.fly ? cfg.animations.fly : null;
  const fps = Number(fly && fly.frameRateFps);
  if (!Number.isFinite(fps) || fps <= 0) return 10;
  return fps;
}

function getCannonUpgradeTotalCost(level, pendingCount){
  const count = Number.isFinite(pendingCount) ? Math.max(0, Math.floor(pendingCount)) : 0;
  if (count <= 0) return 0;
  const applied = getAppliedCannonUpgradeLevel(level);
  let total = 0;
  for (let k = 0; k < count; k++) {
    total += getCannonUpgradeStepCost(level, applied + k);
  }
  return total;
}

function applyCannonUpgrade(level, pendingCount){
  const lvl = Number.isFinite(level) ? Math.max(1, Math.min(CANNON_UPGRADES_LEVELS, Math.floor(level))) : 1;
  const count = Number.isFinite(pendingCount) ? Math.max(0, Math.floor(pendingCount)) : 0;
  if (count <= 0) return { ok: false, error: 'no_pending' };
  const totalCost = getCannonUpgradeTotalCost(lvl, count);
  if (totalCost <= 0) return { ok: false, error: 'invalid_cost' };
  if (getAvailableDamagePoints() < totalCost) return { ok: false, error: 'not_enough_points', totalCost: totalCost };

  const applied = ensureCannonUpgradesAppliedState();
  applied[lvl - 1] = normalizeAppliedCannonUpgrade(applied[lvl - 1]) + count;
  state.damagePointsSpent = ensureDamagePointsSpentState() + totalCost;
  state.player.modsDirty = true;
  updateDamagePointsUI();
  return {
    ok: true,
    totalCost: totalCost,
    appliedLevel: applied[lvl - 1],
  };
}

function getFenceUpgradeTotalCost(level, pendingCount){
  const count = Number.isFinite(pendingCount) ? Math.max(0, Math.floor(pendingCount)) : 0;
  if (count <= 0) return 0;
  const applied = getAppliedFenceUpgradeLevel(level);
  let total = 0;
  for (let k = 0; k < count; k++) {
    total += getUpgradeStepCost(level, applied + k);
  }
  return total;
}

function applyFenceUpgrade(level, pendingCount){
  const lvl = Number.isFinite(level) ? Math.max(1, Math.min(MAX_TANK_LEVEL, Math.floor(level))) : 1;
  const count = Number.isFinite(pendingCount) ? Math.max(0, Math.floor(pendingCount)) : 0;
  if (count <= 0) return { ok: false, error: 'no_pending' };
  const totalCost = getFenceUpgradeTotalCost(lvl, count);
  if (totalCost <= 0) return { ok: false, error: 'invalid_cost' };
  if (getAvailableDamagePoints() < totalCost) return { ok: false, error: 'not_enough_points', totalCost: totalCost };

  const applied = ensureFenceUpgradesAppliedState();
  applied[lvl - 1] = normalizeAppliedFenceUpgrade(applied[lvl - 1]) + count;
  state.damagePointsSpent = ensureDamagePointsSpentState() + totalCost;
  state.player.modsDirty = true;

  const currentLevel = getFenceLevelIndex() + 1;
  if (lvl === currentLevel) {
    const maxHp = getFenceSegmentMaxHp();
    clampFenceSegmentsToMaxHp(maxHp);
    if (state.fenceSegmentsMeta) state.fenceSegmentsMeta.segmentMaxHp = maxHp;
  }

  updateDamagePointsUI();
  return {
    ok: true,
    totalCost: totalCost,
    appliedLevel: applied[lvl - 1],
  };
}

function updateDamagePointsUI(){
  const controller = getSupercomputerMenuController();
  if (controller && typeof controller.refreshTankWallIfVisible === 'function') {
    controller.refreshTankWallIfVisible();
    return;
  }
  if (controller && typeof controller.refreshDamagePointsIfVisible === 'function') {
    controller.refreshDamagePointsIfVisible();
  }
}

function addTankDamageDealt(appliedDamage){
  const appliedDamageInt = normalizeTotalDamageDealtRaw(appliedDamage);
  if (appliedDamageInt <= 0) return 0;
  ensureDamageProgressState();
  state.totalDamageDealtRaw += appliedDamageInt;
  updateDamagePointsUI();
  return appliedDamageInt;
}

GameApi.getDamagePoints = getDamagePoints;

function debugAdjustDamagePoints(deltaValue){
  const delta = Math.floor(Number(deltaValue));
  if (!Number.isFinite(delta) || delta === 0) {
    return { ok: true, changed: false, damagePoints: getAvailableDamagePoints() };
  }
  const current = getAvailableDamagePoints();
  const next = Math.max(0, current + delta);
  if (next === current) {
    return { ok: true, changed: false, damagePoints: current };
  }

  const spent = ensureDamagePointsSpentState();
  const raw = ensureDamageProgressState();
  const remainder = raw % 10000;
  const requiredTotalDamagePoints = Math.max(0, spent + next);
  state.totalDamageDealtRaw = normalizeTotalDamageDealtRaw(requiredTotalDamagePoints * 10000 + remainder);
  state.player.modsDirty = true;
  updateDamagePointsUI();
  return { ok: true, changed: true, damagePoints: getAvailableDamagePoints() };
}

GameApi.debugAdjustDamagePoints = debugAdjustDamagePoints;

function debugAdjustTalentPoints(deltaValue){
  const delta = Math.floor(Number(deltaValue));
  if (!Number.isFinite(delta) || delta === 0) {
    const current = state.player && state.player.talentsV2 && Number.isFinite(state.player.talentsV2.freePoints)
      ? Math.max(0, Math.floor(state.player.talentsV2.freePoints))
      : Math.max(0, Math.floor(state.player && state.player.freeTalentPointsV2 || 0));
    return { ok: true, changed: false, freePoints: current };
  }

  if (!state.player.talentsV2 || typeof state.player.talentsV2 !== 'object') {
    state.player.talentsV2 = { ranksById: {}, freePoints: 0 };
  }

  const current = Number.isFinite(state.player.talentsV2.freePoints)
    ? Math.max(0, Math.floor(state.player.talentsV2.freePoints))
    : Math.max(0, Math.floor(state.player.freeTalentPointsV2 || 0));
  const next = Math.max(0, current + delta);
  if (next === current) {
    return { ok: true, changed: false, freePoints: current };
  }

  state.player.talentsV2.freePoints = next;
  state.player.freeTalentPointsV2 = next;

  if (isTalentsV2Ready()) {
    const api = getTalentsV2Api();
    if (api && typeof api.setFreePoints === 'function') {
      api.setFreePoints(next);
      syncPlayerTalentsV2FromApi();
    }
  }

  state.player.modsDirty = true;
  return { ok: true, changed: true, freePoints: state.player.freeTalentPointsV2 };
}

GameApi.debugAdjustTalentPoints = debugAdjustTalentPoints;

let supercomputerController = null;

function getComputerState() {
  if (!state.supercomputer || typeof state.supercomputer !== 'object') {
    state.supercomputer = {
      computerLevel: Number.isFinite(state.player && state.player.level) ? state.player.level : 1,
      xp: Number.isFinite(state.player && state.player.xp) ? state.player.xp : 0,
      xpToNext: Number.isFinite(state.player && state.player.xpToNext) ? state.player.xpToNext : 500,
      maxLevel: Number.isFinite(state.player && state.player.maxLevel) ? state.player.maxLevel : MAX_TANK_LEVEL,
      hp: 920,
      maxHp: 920,
      armorFlat: 2,
      x: 0,
      y: 0,
      offsetY: 64,
      state: 'idle',
      animElapsedSec: 0,
      glitchLoopsRemaining: 0,
      glitchCooldownUntil: 0,
      wantsBuildTank: false,
      pendingBuildTank: false,
      eventShown40: !!(state.player && state.player.eventShown40),
      eventShown50: !!(state.player && state.player.eventShown50),
      eventShown60: !!(state.player && state.player.eventShown60),
    };
  }
  if (supercomputerController && supercomputerController.ensureSupercomputerState) {
    supercomputerController.ensureSupercomputerState(state.supercomputer, SupercomputerSprites.config, MAX_TANK_LEVEL);
  }
  return state.supercomputer;
}

function getComputerLevel() {
  return getComputerState().computerLevel;
}

const DEFAULT_STAMPS_SEED = 'ground-stamps-seed';
const DEFAULT_DECOR_SEED = 'decor-default-seed';

function resolveGroundStampsSeed(){
  const cfgSeed = GroundSprites?.config?.seed;
  return (cfgSeed !== undefined && cfgSeed !== null) ? cfgSeed : DEFAULT_STAMPS_SEED;
}

function resolveDecorSeed(){
  const cfgSeed = DecorSprites?.config?.seed;
  return (cfgSeed !== undefined && cfgSeed !== null) ? cfgSeed : DEFAULT_DECOR_SEED;
}

function ensureMapSeedsState(){
  if (!state.mapSeeds || typeof state.mapSeeds !== 'object') {
    state.mapSeeds = { stampsSeed: null, decorSeed: null };
  }
  if (state.mapSeeds.stampsSeed === undefined || state.mapSeeds.stampsSeed === null) {
    state.mapSeeds.stampsSeed = resolveGroundStampsSeed();
  }
  if (state.mapSeeds.decorSeed === undefined || state.mapSeeds.decorSeed === null) {
    const cfgSeed = DecorSprites?.config?.seed;
    if (cfgSeed !== undefined && cfgSeed !== null) state.mapSeeds.decorSeed = cfgSeed;
  }
  return state.mapSeeds;
}

// Debug panel: enabled only via URL param (?debug=1 or ?debug=true)
const DEBUG_PARAM = 'debug';
function isDebugPanelEnabled(){
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get(DEBUG_PARAM) === '1';
  } catch (_) { return false; }
}
const DebugPanelEnabled = isDebugPanelEnabled();
let zombieAttackOverlayEnabled = false;

function toggleZombieAttackOverlayByHotkey(e){
  if (!DebugPanelEnabled) return;
  const key = String(e && e.key ? e.key : '').toLowerCase();
  if (key !== ZOMBIE_OVERLAY_TOGGLE_KEY) return;
  const tag = e && e.target && e.target.tagName ? String(e.target.tagName).toLowerCase() : '';
  const isTyping = tag === 'input' || tag === 'textarea' || (e && e.target && e.target.isContentEditable);
  if (isTyping) return;
  zombieAttackOverlayEnabled = !zombieAttackOverlayEnabled;
}

let viewSize = { w: canvas.width, h: canvas.height, dpr: 1 };
let center = { x: viewSize.w/2, y: viewSize.h/2 };
const rawNowSec = ()=>performance.now()/1000;
let simClockOffsetSec = 0;
let simPausedAtRawSec = 0;
let simClockPaused = false;
const nowSec = ()=>{
  const raw = rawNowSec();
  if (simClockPaused) return simPausedAtRawSec - simClockOffsetSec;
  return raw - simClockOffsetSec;
};
if (SupercomputerApi && typeof SupercomputerApi.createController === 'function') {
  supercomputerController = SupercomputerApi.createController({ nowSec: nowSec, random: Math.random, maxLevel: MAX_TANK_LEVEL });
}
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const FENCE_DEFAULT_SEGMENT_HP = 200;
const FENCE_DEFAULT_REPAIR_COST = 100;
const ZOMBIE_DEFAULT_ATTACK_DAMAGE = 8;
const ZOMBIE_DEFAULT_ATTACK_RANGE_PX = 24;
const ZOMBIE_DEFAULT_ATTACK_COOLDOWN_SEC = 0.35;
const ZOMBIE_DEFAULT_ATTACK_HIT_AT = 0.5;
const ZOMBIE_DEFAULT_WALK_FPS = 10;
const ZOMBIE_DEFAULT_ATTACK_FPS = 10;
const ZOMBIE_DEFAULT_DEATH_FPS = 10;
const ZOMBIE_OVERLAY_TOGGLE_KEY = 'h';
const warnedBrokenFrames = new Set();
const warnedZombieAttackDamage = new Set();
const ZombieSpawnApi = GameApi.ZombieSpawn ?? null;
const UIModals = GameApi.UIModals ?? null;
const CombatProfilesApi = GameApi.CombatProfiles ?? null;
const SpriteLoadersApi = GameApi.SpriteLoaders ?? null;
const DebugPanelApi = GameApi.DebugPanel ?? null;
const LevelFlowApi = GameApi.LevelFlow ?? null;
const BootstrapApi = GameApi.Bootstrap ?? null;
const FenceLayoutApi = GameApi.FenceLayout ?? null;
const GroundLayerApi = GameApi.GroundLayer ?? null;
const PauseManagerApi = GameApi.PauseManager ?? null;
const DepthSortApi = GameApi.DepthSort ?? null;
const AutoMergeApi = GameApi.AutoMerge ?? null;
const SupercomputerMenuApi = GameApi.SupercomputerMenu ?? null;
const CriticalModalApi = GameApi.CriticalModal ?? null;
const AchievementsModalApi = GameApi.AchievementsModal ?? null;
const WorldResetApi = GameApi.WorldReset ?? null;
const AUTO_MERGE_COOLDOWN_MS = AutoMergeApi && Number.isFinite(AutoMergeApi.AUTO_MERGE_COOLDOWN_MS)
  ? Math.max(200, Math.min(400, Math.floor(AutoMergeApi.AUTO_MERGE_COOLDOWN_MS)))
  : 300;
const ACHIEVEMENT_TOAST_DURATION_MS = 1500;
const ACHIEVEMENT_UNLOCK_PULSE_MS = 1800;
const MERGE_FX_GAP_MS = 80;
let isAutoMergeBusy = false;
let autoMergeBusyTimeout = null;
let mergeFxQueue = [];
let mergeFxQueueTimer = null;
const SUPERCOMPUTER_FALLBACK_BOUNDS = { w: 68, h: 62, anchorX: 0.5, anchorY: 42 / 62 };
const SUPERCOMPUTER_EFFECT_PRESETS = {
  vibration: { kind: 'shake', amplitudeX: 2.2, amplitudeY: 1.4, frequencyHz: 14 },
  vibrationStrong: { kind: 'shake', amplitudeX: 3.4, amplitudeY: 2.4, frequencyHz: 18 },
  sway: { kind: 'sway', angleDeg: 1.6, amplitudeX: 0.9, frequencyHz: 1.15 },
  wobble: { kind: 'sway', angleDeg: 2.3, amplitudeX: 1.5, frequencyHz: 1.8 },
  float: { kind: 'bob', amplitudeY: 2.8, frequencyHz: 1.25 },
  pulse: { kind: 'pulse', scaleMul: 0.035, frequencyHz: 2.1 },
};
const supercomputerHudRuntime = {
  activeDefs: [],
  activeRemainingSec: [],
  layout: {
    activeKey: '',
    count: 0,
    iconSize: 0,
    gapX: 0,
    gapY: 0,
    timerOffset: 0,
    fontSize: 0,
    maxPerRow: 0,
    baseX: NaN,
    baseY: NaN,
    positions: [],
    boostBBox: null,
    spriteMetrics: null,
  },
  button: {
    lastTransform: '',
    lastVisible: false,
    width: 42,
    height: 42,
  },
};
const autoMergeHudSlot = {
  parent: ui.autoMergeBtn ? ui.autoMergeBtn.parentElement : null,
  nextSibling: ui.autoMergeBtn ? ui.autoMergeBtn.nextElementSibling : null,
};

function setSimulationClockPaused(paused){
  const shouldPause = !!paused;
  if (shouldPause === simClockPaused) return;
  const raw = rawNowSec();
  if (shouldPause) {
    simPausedAtRawSec = raw;
    simClockPaused = true;
    return;
  }
  simClockOffsetSec += Math.max(0, raw - simPausedAtRawSec);
  simClockPaused = false;
}

if (GameApi.AudioSettings && GameApi.AudioSettings.createAudioSettingsController) {
  audioSettingsController = GameApi.AudioSettings.createAudioSettingsController({
    ui,
    clamp,
    initialSettings: settings,
    storageKey: 'settings',
  });
}

const STRINGS = GameApi.I18nFallback && GameApi.I18nFallback.STRINGS
  ? GameApi.I18nFallback.STRINGS
  : { ru: {}, en: {} };

if (GameApi.I18n && GameApi.I18n.setFallback) {
  GameApi.I18n.setFallback(STRINGS);
}

let currentLang = 'ru';

function getI18n(){
  return GameApi.I18n ?? null;
}

function getCurrentLang(){
  const i18n = getI18n();
  return (i18n && i18n.getLanguage) ? i18n.getLanguage() : currentLang;
}

function t(key, vars = {}){
  const i18n = getI18n();
  if (i18n && typeof i18n.t === 'function') return i18n.t(key, vars);
  const dict = STRINGS[currentLang] || STRINGS.ru;
  let text = dict[key] ?? STRINGS.ru[key] ?? key;
  for (const [k, v] of Object.entries(vars)){
    text = text.replaceAll(`{${k}}`, String(v));
  }
  return text;
}

function getTankWordKey(count){
  const n = Math.max(0, Math.floor(Number(count) || 0));
  if (getCurrentLang() === 'ru') {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 14) return 'tankWord5';
    if (mod10 === 1) return 'tankWord1';
    if (mod10 >= 2 && mod10 <= 4) return 'tankWord2_4';
    return 'tankWord5';
  }
  return n === 1 ? 'tankWord1' : 'tankWord5';
}

function bulkBuyLabel(count){
  const safeCount = Math.max(0, Math.floor(Number(count) || 0));
  const word = t(getTankWordKey(safeCount));
  return t('buyBulkBuy', { count: safeCount, tankWord: word });
}

function setLanguage(lang){
  const i18n = getI18n();
  if (i18n && typeof i18n.setLanguage === 'function') {
    if (!i18n.setLanguage(lang)) return;
    currentLang = i18n.getLanguage ? i18n.getLanguage() : lang;
  } else {
    if (!STRINGS[lang]) return;
    currentLang = lang;
    localStorage.setItem('lang', lang);
    document.documentElement.lang = lang;
  }
  applyTranslations();
  updateUI();
}

function loadSettings(){
  try{
    const raw = localStorage.getItem('settings');
    if (raw){
      const parsed = JSON.parse(raw);
      settings = {
        ...DEFAULT_SETTINGS,
        ...parsed,
      };
    }
  }catch(e){}
  settings.autoPauseOnInactive = !!settings.autoPauseOnInactive;
  syncAutoPauseWithPauseManager();
  applyAudioSettings();
  updateMenuVolumes();
}

function saveSettings(){
  try{
    localStorage.setItem('settings', JSON.stringify(settings));
  }catch(e){}
}

function applyAudioSettings(){
  const musicVolume = clamp(settings.musicVolume ?? DEFAULT_SETTINGS.musicVolume, 0, 1);
  const sfxVolume = clamp(settings.sfxVolume ?? DEFAULT_SETTINGS.sfxVolume, 0, 1);
  settings.musicVolume = musicVolume;
  settings.sfxVolume = sfxVolume;
  const criticalPolicy = getCriticalAudioPolicy();
  const muteMusicForCritical = criticalAudioActive && criticalPolicy.muteAllOnCritical;
  const criticalTrackId = criticalPolicy.criticalMusic.enabled ? criticalPolicy.criticalMusic.trackId : '';

  document.querySelectorAll('audio[data-audio="music"]').forEach(el => {
    el.volume = musicVolume;
    if (muteMusicForCritical) {
      const isCriticalTrack = criticalTrackId && el.id === criticalTrackId;
      el.muted = !isCriticalTrack;
    }
  });
  document.querySelectorAll('audio[data-audio="sfx"]').forEach(el => {
    el.volume = sfxVolume;
  });
  Object.keys(SFX_POOLS).forEach(id => {
    const pool = SFX_POOLS[id];
    if (!pool || !pool.players) return;
    for (const player of pool.players) {
      player.volume = resolveSfxPlaybackVolume(id, 1);
    }
  });
  Object.keys(LOOP_SFX_PLAYERS).forEach(id => {
    const player = LOOP_SFX_PLAYERS[id];
    if (!player) return;
    player.volume = resolveSfxPlaybackVolume(id, 1);
  });
}

// SFX playback: volume from settings.sfxVolume; dedup by event id
const SFX_LAST_PLAYED = {};
const SFX_DEDUP_MS = 80;
const SFX_POOL_SIZE = 6;
const SFX_POOLS = {};
const LOOP_SFX_PLAYERS = {};
const SFX_RESOLVED_SOURCE_LISTS = {};
const DEFAULT_RAIN_LOOP_SOURCES = ['assets/sfx/rain_loop.ogg', 'assets/sfx/rain_loop.wav'];
const SFX_CHANNELS = {
  shootNormal: 'gameplay',
  shootHeavy: 'gameplay',
  shootHeavy2: 'gameplay',
  trackLoop: 'gameplay',
  tankToTrack: 'gameplay',
  tankToHangar: 'gameplay',
  activeAbility: 'gameplay',
  thunder: 'gameplay',
  rainLoop: 'gameplay',
  uiHover: 'ui',
  uiClickOnEnabled: 'ui',
  uiClickOnDisable: 'ui',
  uiSliderPreview: 'ui',
  levelUp: 'ui',
  mergeNewMaxLevel: 'ui',
  applyTalents: 'ui',
};
const UI_SLIDER_PREVIEW_THROTTLE_MS = 160;
let lastUiSliderPreviewSfxAt = -Infinity;
let gameplayAudioSnapshots = [];
let gameplayAudioFadeToken = 0;
let pauseManager = null;
let simulationPaused = false;
let lastPauseReasons = { menuOpen: false, tabInactive: false };
let menuPauseLocks = {
  settings: !!(state && state.ui && state.ui.menuOpen),
  supercomputer: false,
  critical: false,
  bigMenu: !!(ui.bigMenuOverlay && !ui.bigMenuOverlay.classList.contains('bigMenuOverlayHidden')),
};
let supercomputerMenuController = null;
let criticalModalController = null;
let achievementsModalController = null;
let criticalFlowActive = false;
let SFX_AUDIO_PROBE = null;
let criticalAudioActive = false;
let criticalAudioSnapshot = null;
let criticalMusicRuntime = null;

function ensureSfxPoolRuntimeController(){
  if (sfxPoolRuntimeController) return sfxPoolRuntimeController;
  const api = GameApi && GameApi.SfxPoolRuntime;
  if (!api || typeof api.createController !== 'function') return null;
  sfxPoolRuntimeController = api.createController({
    sfxLastPlayed: SFX_LAST_PLAYED,
    sfxDedupMs: SFX_DEDUP_MS,
    sfxPoolSize: SFX_POOL_SIZE,
    sfxPools: SFX_POOLS,
    loopSfxPlayers: LOOP_SFX_PLAYERS,
    sfxResolvedSourceLists: SFX_RESOLVED_SOURCE_LISTS,
    sfxAudioProbe: SFX_AUDIO_PROBE,
    uiSliderPreviewThrottleMs: UI_SLIDER_PREVIEW_THROTTLE_MS,
    lastUiSliderPreviewSfxAt: lastUiSliderPreviewSfxAt,
    setLastUiSliderPreviewSfxAt(value){ lastUiSliderPreviewSfxAt = value; },
    setSfxAudioProbe(value){ SFX_AUDIO_PROBE = value; },
    getDefaultSettings(){ return DEFAULT_SETTINGS; },
    getSettings(){ return settings; },
    clamp: clamp,
    resolveSfxPlaybackVolume: resolveSfxPlaybackVolume,
    isCriticalAudioActive(){ return criticalAudioActive; },
    isCriticalSfxAllowed: isCriticalSfxAllowed,
    isSimulationPaused(){ return simulationPaused; },
    getDefaultRainLoopSources(){ return DEFAULT_RAIN_LOOP_SOURCES; },
    getDefaultTrackLoopSources(){ return DEFAULT_TRACK_LOOP_SOURCES; },
  });
  return sfxPoolRuntimeController;
}

function sfxChannelOf(id){
  return ensureSfxPoolRuntimeController()?.sfxChannelOf(id) || 'gameplay';
}

function playUiSliderPreviewSfxThrottled(){
  ensureSfxPoolRuntimeController()?.playUiSliderPreviewSfxThrottled();
}

function stopGameplayFade(){
  gameplayAudioFadeToken += 1;
}

function collectActiveGameplayPlayers(){
  const active = [];
  const seen = new Set();
  Object.keys(SFX_POOLS).forEach((id) => {
    if (sfxChannelOf(id) !== 'gameplay') return;
    const pool = SFX_POOLS[id];
    if (!pool || !Array.isArray(pool.players)) return;
    for (const player of pool.players) {
      if (!player || seen.has(player)) continue;
      if (player.paused || player.ended) continue;
      seen.add(player);
      active.push({ player, volume: Number.isFinite(player.volume) ? player.volume : 1, loop: false, id });
    }
  });
  Object.keys(LOOP_SFX_PLAYERS).forEach((id) => {
    if (sfxChannelOf(id) !== 'gameplay') return;
    const player = LOOP_SFX_PLAYERS[id];
    if (!player || seen.has(player)) return;
    if (player.paused || player.ended) return;
    seen.add(player);
    active.push({ player, volume: Number.isFinite(player.volume) ? player.volume : 1, loop: true, id });
  });
  return active;
}

function fadePauseGameplayAudio(durationSec){
  const players = collectActiveGameplayPlayers();
  gameplayAudioSnapshots = players;
  if (!players.length) return;
  const token = ++gameplayAudioFadeToken;
  const start = rawNowSec();
  const dur = Math.max(0, durationSec || 0);
  if (dur <= 0) {
    for (const entry of players) {
      const player = entry.player;
      if (!player) continue;
      player.volume = 0;
      player.pause();
    }
    return;
  }
  function tick(){
    if (token !== gameplayAudioFadeToken) return;
    const t = clamp((rawNowSec() - start) / dur, 0, 1);
    const k = 1 - t;
    for (const entry of players) {
      const player = entry.player;
      if (!player) continue;
      if (player.paused || player.ended) continue;
      player.volume = entry.volume * k;
      if (t >= 1) player.pause();
    }
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function resumeGameplayAudio(){
  stopGameplayFade();
  if (!Array.isArray(gameplayAudioSnapshots) || !gameplayAudioSnapshots.length) return;
  for (const entry of gameplayAudioSnapshots) {
    const player = entry.player;
    if (!player) continue;
    try {
      player.volume = entry.volume;
      player.play().catch(() => {});
    } catch (e) {}
  }
  gameplayAudioSnapshots = [];
}

function setSimulationPaused(nextPaused, reasons){
  const paused = !!nextPaused;
  if (simulationPaused === paused) {
    lastPauseReasons = reasons || lastPauseReasons;
    return;
  }
  simulationPaused = paused;
  lastPauseReasons = reasons || { menuOpen: false, tabInactive: false, criticalPause: false };
  setSimulationClockPaused(paused);
  if (paused) {
    if (lastPauseReasons && lastPauseReasons.tabInactive) {
      // Tab inactive: immediately stop gameplay audio (requestAnimationFrame won't tick)
      fadePauseGameplayAudio(0);
    } else {
      fadePauseGameplayAudio(1);
    }
  } else {
    resumeGameplayAudio();
  }
}

function recomputeMenuPauseLock(){
  var lockOpen = !!(menuPauseLocks.settings || menuPauseLocks.supercomputer || menuPauseLocks.critical || menuPauseLocks.bigMenu);
  if (pauseManager && typeof pauseManager.setMenuOpen === 'function') {
    pauseManager.setMenuOpen(lockOpen);
  }
}

/* Fix 4: Expose function for tech timer pause check.
   Timer pauses ONLY when settings (small menu) or bigMenu is open. */
window.Game = window.Game || {};
window.Game._isTechTimerPaused = function() {
  return !!(menuPauseLocks.settings || menuPauseLocks.bigMenu);
};

function setMenuPauseSource(source, open){
  if (!source || !Object.prototype.hasOwnProperty.call(menuPauseLocks, source)) return;
  menuPauseLocks[source] = !!open;
  recomputeMenuPauseLock();
}

function enterCriticalPause(){
  if (pauseManager && typeof pauseManager.enterCriticalPause === 'function') {
    pauseManager.enterCriticalPause();
    return;
  }
  setMenuPauseSource('critical', true);
}

function exitCriticalPause(){
  if (pauseManager && typeof pauseManager.exitCriticalPause === 'function') {
    pauseManager.exitCriticalPause();
    return;
  }
  setMenuPauseSource('critical', false);
}

function getCriticalAudioPolicy(){
  const policy = GameApi && GameApi.Config ? GameApi.Config.CriticalAudioPolicy : null;
  const allowedRaw = Array.isArray(policy && policy.allowedSfx) ? policy.allowedSfx : [];
  const allowedSfx = [];
  const seen = new Set();
  for (let i = 0; i < allowedRaw.length; i++) {
    const id = typeof allowedRaw[i] === 'string' ? allowedRaw[i].trim() : '';
    if (!id || seen.has(id)) continue;
    seen.add(id);
    allowedSfx.push(id);
  }
  const criticalMusicRaw = policy && typeof policy.criticalMusic === 'object' ? policy.criticalMusic : {};
  const trackId = typeof criticalMusicRaw.trackId === 'string' ? criticalMusicRaw.trackId.trim() : '';
  return {
    muteAllOnCritical: policy ? policy.muteAllOnCritical !== false : true,
    allowedSfx,
    criticalMusic: {
      enabled: !!(criticalMusicRaw && criticalMusicRaw.enabled && trackId),
      trackId,
    },
  };
}

function isCriticalSfxAllowed(id){
  if (!criticalAudioActive) return true;
  const sfxId = typeof id === 'string' ? id : '';
  if (!sfxId) return false;
  const policy = getCriticalAudioPolicy();
  if (!policy.allowedSfx.length) return false;
  return policy.allowedSfx.indexOf(sfxId) !== -1;
}

function resolveSfxPlaybackVolume(id, volumeMul){
  const base = clamp(settings.sfxVolume ?? DEFAULT_SETTINGS.sfxVolume, 0, 1);
  const mul = Number.isFinite(volumeMul) ? Math.max(0, Number(volumeMul)) : 1;
  const trackLoopMul = id === TRACK_LOOP_ID
    ? clamp(TRACK_LOOP_CODE_VOLUME_MUL, 0, 2)
    : 1;
  const final = clamp(base * mul * trackLoopMul, 0, 1);
  if (!criticalAudioActive) return final;
  const policy = getCriticalAudioPolicy();
  if (!isCriticalSfxAllowed(id)) return 0;
  if (!policy.muteAllOnCritical) return final;
  return final;
}

function pauseAllSfxPlayers(){
  Object.keys(SFX_POOLS).forEach((id) => {
    const pool = SFX_POOLS[id];
    if (!pool || !Array.isArray(pool.players)) return;
    for (let i = 0; i < pool.players.length; i++) {
      const player = pool.players[i];
      if (!player) continue;
      player.volume = 0;
      if (!player.paused) player.pause();
    }
  });
  Object.keys(LOOP_SFX_PLAYERS).forEach((id) => {
    const player = LOOP_SFX_PLAYERS[id];
    if (!player) return;
    player.volume = 0;
    if (!player.paused) player.pause();
  });
}

function applyCriticalAudioPolicy(){
  if (criticalAudioActive) return;
  const policy = getCriticalAudioPolicy();
  const musicNodes = Array.from(document.querySelectorAll('audio[data-audio="music"]'));
  criticalAudioSnapshot = {
    music: musicNodes.map((el) => {
      let currentTime = 0;
      try { currentTime = el.currentTime; } catch (e) {}
      return {
        el,
        muted: !!el.muted,
        volume: Number.isFinite(el.volume) ? el.volume : 1,
        paused: !!el.paused,
        currentTime,
      };
    }),
  };
  criticalAudioActive = true;
  if (policy.muteAllOnCritical) {
    for (let i = 0; i < criticalAudioSnapshot.music.length; i++) {
      const entry = criticalAudioSnapshot.music[i];
      if (!entry || !entry.el) continue;
      entry.el.muted = true;
      entry.el.pause();
    }
  }
  pauseAllSfxPlayers();

  criticalMusicRuntime = null;
  if (policy.criticalMusic.enabled && policy.criticalMusic.trackId) {
    const trackEl = document.getElementById(policy.criticalMusic.trackId);
    if (trackEl && typeof trackEl.play === 'function') {
      trackEl.muted = false;
      trackEl.volume = clamp(settings.musicVolume ?? DEFAULT_SETTINGS.musicVolume, 0, 1);
      trackEl.play().catch(() => {});
      criticalMusicRuntime = { el: trackEl };
    }
  }
}

function restoreAudioAfterCritical(){
  if (!criticalAudioActive) return;
  const snapshot = criticalAudioSnapshot;
  criticalAudioActive = false;
  criticalAudioSnapshot = null;

  if (criticalMusicRuntime && criticalMusicRuntime.el) {
    const criticalTrack = criticalMusicRuntime.el;
    const shouldContinue = snapshot && Array.isArray(snapshot.music)
      ? snapshot.music.some((entry) => entry && entry.el === criticalTrack && !entry.paused)
      : false;
    if (!shouldContinue) {
      criticalTrack.pause();
      try { criticalTrack.currentTime = 0; } catch (e) {}
    }
  }
  criticalMusicRuntime = null;

  if (snapshot && Array.isArray(snapshot.music)) {
    for (let i = 0; i < snapshot.music.length; i++) {
      const entry = snapshot.music[i];
      if (!entry || !entry.el) continue;
      entry.el.muted = !!entry.muted;
      entry.el.volume = Number.isFinite(entry.volume) ? entry.volume : entry.el.volume;
      try { entry.el.currentTime = Number.isFinite(entry.currentTime) ? Math.max(0, entry.currentTime) : entry.el.currentTime; } catch (e) {}
      if (!entry.paused) {
        entry.el.play().catch(() => {});
      } else {
        entry.el.pause();
      }
    }
  }

  applyAudioSettings();
}

function sfxSourceToMime(source){
  const normalized = String(source || '').toLowerCase();
  if (normalized.endsWith('.ogg')) return 'audio/ogg';
  if (normalized.endsWith('.wav')) return 'audio/wav';
  if (normalized.endsWith('.mp3')) return 'audio/mpeg';
  return '';
}

function canPlaySfxSource(source){
  if (typeof Audio === 'undefined') return true;
  try {
    if (!SFX_AUDIO_PROBE) SFX_AUDIO_PROBE = new Audio();
    if (!SFX_AUDIO_PROBE || typeof SFX_AUDIO_PROBE.canPlayType !== 'function') return true;
    const mime = sfxSourceToMime(source);
    if (!mime) return true;
    const support = SFX_AUDIO_PROBE.canPlayType(mime);
    return support === 'probably' || support === 'maybe';
  } catch (e) {
    return true;
  }
}

function resolveSfxSourceList(id){
  if (Object.prototype.hasOwnProperty.call(SFX_RESOLVED_SOURCE_LISTS, id)) {
    return SFX_RESOLVED_SOURCE_LISTS[id];
  }
  const source = SFX_SOURCES[id];
  const resolved = [];
  if (Array.isArray(source)) {
    for (let i = 0; i < source.length; i++) {
      const candidate = source[i];
      if (typeof candidate !== 'string' || !candidate) continue;
      if (canPlaySfxSource(candidate)) {
        resolved.push(candidate);
      }
    }
    for (let i = 0; i < source.length; i++) {
      const candidate = source[i];
      if (typeof candidate !== 'string' || !candidate) continue;
      if (resolved.indexOf(candidate) === -1) resolved.push(candidate);
    }
  } else if (typeof source === 'string' && source) {
    resolved.push(source);
  }
  SFX_RESOLVED_SOURCE_LISTS[id] = resolved;
  return resolved;
}

function enableAudioFallback(player, sourceList){
  if (!player || !Array.isArray(sourceList) || sourceList.length < 2) return;
  player.__sourceIndex = 0;
  player.addEventListener('error', function () {
    var nextIndex = Number.isFinite(player.__sourceIndex) ? player.__sourceIndex + 1 : 1;
    if (nextIndex >= sourceList.length) return;
    player.__sourceIndex = nextIndex;
    player.src = sourceList[nextIndex];
    try { player.load(); } catch (e) {}
  });
}

function getSfxPool(id){
  return ensureSfxPoolRuntimeController()?.getSfxPool(id) || null;
}

function getLoopSfxPlayer(id){
  return ensureSfxPoolRuntimeController()?.getLoopSfxPlayer(id) || null;
}

function playLoopSfx(id, volumeMul){
  ensureSfxPoolRuntimeController()?.playLoopSfx(id, volumeMul);
}

function setLoopSfxVolume(id, volumeMul){
  ensureSfxPoolRuntimeController()?.setLoopSfxVolume(id, volumeMul);
}

function stopLoopSfx(id){
  ensureSfxPoolRuntimeController()?.stopLoopSfx(id);
}

function normalizedSfxSources(value, fallbackList){
  return ensureSfxPoolRuntimeController()?.normalizedSfxSources(value, fallbackList) || [];
}

function setSfxSources(id, sources){
  ensureSfxPoolRuntimeController()?.setSfxSources(id, sources);
}

function playSfx(id, opts){
  ensureSfxPoolRuntimeController()?.playSfx(id, opts);
}

function shouldPlayTankTrackSfx(opts){
  if (opts && typeof opts.playSfx === 'boolean') return opts.playSfx;
  return !!(opts && opts.cause === 'user');
}

function setTankOnTrackState(tank, nextOnTrack, opts){
  const Garage = window.Game && window.Game.Garage;
  if (Garage && typeof Garage.setTankOnTrack === 'function') {
    return Garage.setTankOnTrack(tank, nextOnTrack, opts);
  }
  if (!tank || typeof tank !== 'object') return false;
  const next = !!nextOnTrack;
  const prev = !!tank.onTrack;
  if (prev === next) return false;
  tank.onTrack = next;
  if (shouldPlayTankTrackSfx(opts)) {
    const cfg = window.Game && window.Game.Config && window.Game.Config.AudioUi;
    const uiMult = Number.isFinite(Number(cfg && cfg.UI_SFX_VOLUME_MULT))
      ? Math.max(0, Number(cfg.UI_SFX_VOLUME_MULT))
      : 0.5;
    playSfx(next ? 'tankToTrack' : 'tankToHangar', { volumeMult: uiMult, channel: 'ui' });
  }
  return true;
}

function silenceAllTanksTrackSfx(cause){
  if (!state || !Array.isArray(state.cells)) return;
  for (let i = 0; i < state.cells.length; i++) {
    const tank = state.cells[i] && state.cells[i].tank;
    if (!tank) continue;
    setTankOnTrackState(tank, false, { cause: cause || 'reset', playSfx: false });
  }
}

let trackLoopPlaying = false;
let trackLoopHasTankOnTrack = false;

function hasAnyTankOnTrack(){
  if (!state || !Array.isArray(state.cells)) return false;
  for (let i = 0; i < state.cells.length; i++) {
    const tank = state.cells[i] && state.cells[i].tank;
    if (tank && tank.onTrack === true) return true;
  }
  return false;
}

function stopTrackLoopSfxImmediate(){
  stopLoopSfx(TRACK_LOOP_ID);
  trackLoopPlaying = false;
}

function syncTrackLoopSfxState(paused){
  trackLoopHasTankOnTrack = hasAnyTankOnTrack();
  const shouldPlay = trackLoopHasTankOnTrack && !paused;
  if (shouldPlay && !trackLoopPlaying) {
    playLoopSfx(TRACK_LOOP_ID, 1);
    trackLoopPlaying = true;
  } else if (!shouldPlay && trackLoopPlaying) {
    stopTrackLoopSfxImmediate();
  }
  if (shouldPlay) {
    setLoopSfxVolume(TRACK_LOOP_ID, 1);
  }
}

const SFX_SOURCES = {
  shootNormal: 'assets/sfx/shoot_normal.ogg',
  shootHeavy: 'assets/sfx/shoot_heavy.ogg',
  shootHeavy2: 'assets/sfx/shoot_heavy2.ogg',
  uiHover: ['assets/sfx/ui_hover.ogg', 'assets/sfx/ui_hover.mp3'],
  uiClickOnEnabled: ['assets/sfx/ui_click_enabled.ogg', 'assets/sfx/ui_click_enabled.mp3'],
  uiClickOnDisable: ['assets/sfx/ui_click_disabled.ogg', 'assets/sfx/ui_click_disabled.mp3'],
  uiSliderPreview: ['assets/sfx/ui_slider_preview_TEMPLATE.ogg'],
  tankToTrack: ['assets/sfx/tank_to_track.ogg', 'assets/sfx/tank_to_track.mp3'],
  tankToHangar: ['assets/sfx/tank_to_hangar.ogg', 'assets/sfx/tank_to_hangar.mp3'],
  trackLoop: DEFAULT_TRACK_LOOP_SOURCES.slice(),
  levelUp: 'assets/sfx/level_up.ogg',
  mergeNewMaxLevel: ['assets/sfx/merge_new_max_level.ogg', 'assets/sfx/merge_new_max_level.mp3'],
  applyTalents: 'assets/sfx/apply_talents.ogg',
  activeAbility: 'assets/sfx/active_ability.ogg',
  thunder: ['assets/sfx/thunder.ogg', 'assets/sfx/thunder.wav'],
  rainLoop: DEFAULT_RAIN_LOOP_SOURCES.slice(),
};

function normalizeVolumeKind(kind){
  return kind === 'music' ? 'music' : 'sfx';
}

function getVolumeSettingKey(kind){
  return normalizeVolumeKind(kind) === 'music' ? 'musicVolume' : 'sfxVolume';
}

function getDefaultVolume(kind){
  const key = getVolumeSettingKey(kind);
  return clamp(DEFAULT_SETTINGS[key], 0, 1);
}

function toVolumePercent(value01){
  return Math.round(clamp(value01, 0, 1) * 100);
}

function toVolume01(value, format){
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  if (format === 'percent') return clamp(numeric / 100, 0, 1);
  return clamp(numeric, 0, 1);
}

function getVolume(kind, format){
  const key = getVolumeSettingKey(kind);
  const fallback = getDefaultVolume(kind);
  const value01 = clamp(settings[key] ?? fallback, 0, 1);
  if (format === 'percent') return toVolumePercent(value01);
  return value01;
}

function setVolume(kind, value, format){
  const key = getVolumeSettingKey(kind);
  settings[key] = toVolume01(value, format);
  applyAudioSettings();
  return settings[key];
}

function isAutoPauseEnabledSetting(){
  return !!(settings && settings.autoPauseOnInactive);
}

function syncAutoPauseWithPauseManager(){
  if (!pauseManager || typeof pauseManager.setTabInactive !== 'function') return;
  if (!isAutoPauseEnabledSetting()) {
    pauseManager.setTabInactive(false);
    return;
  }
  var hidden = !!document.hidden || document.visibilityState === 'hidden';
  pauseManager.setTabInactive(hidden);
}

function setAutoPauseEnabled(enabled){
  settings.autoPauseOnInactive = !!enabled;
  syncAutoPauseWithPauseManager();
  updateMenuVolumes();
  return settings.autoPauseOnInactive;
}

function syncTutorialToggleUI() {
  const tutDisabled = !!(state && state.tutorial && state.tutorial.disabled);
  if (ui.menuTutorialToggle) ui.menuTutorialToggle.checked = !tutDisabled;
  if (ui.bigMenuRootTutorial) ui.bigMenuRootTutorial.checked = !tutDisabled;
}

function syncVolumeUIFromSettings(){
  const sfxPercent = getVolume('sfx', 'percent');
  const musicPercent = getVolume('music', 'percent');

  if (ui.menuMusic) ui.menuMusic.value = String(musicPercent);
  if (ui.menuSfx) ui.menuSfx.value = String(sfxPercent);
  if (ui.menuMusicValue) ui.menuMusicValue.textContent = `${musicPercent}%`;
  if (ui.menuSfxValue) ui.menuSfxValue.textContent = `${sfxPercent}%`;

  if (ui.bigMenuSfx) ui.bigMenuSfx.value = String(sfxPercent);
  if (ui.bigMenuMusic) ui.bigMenuMusic.value = String(musicPercent);
  if (ui.bigMenuSfxValue) ui.bigMenuSfxValue.textContent = `${sfxPercent}%`;
  if (ui.bigMenuMusicValue) ui.bigMenuMusicValue.textContent = `${musicPercent}%`;
  if (ui.menuAutoPause) ui.menuAutoPause.checked = isAutoPauseEnabledSetting();
  if (ui.bigMenuAutoPause) ui.bigMenuAutoPause.checked = isAutoPauseEnabledSetting();
  if (ui.bigMenuRootAutoPause) ui.bigMenuRootAutoPause.checked = isAutoPauseEnabledSetting();
  syncTutorialToggleUI();
}

function updateMenuVolumes(){
  syncVolumeUIFromSettings();
}

function applyTranslations(){
  document.title = t('title');
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const vars = key === 'buyTank' ? {level: 1} : {};
    el.textContent = t(key, vars);
  });
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    el.innerHTML = t(el.dataset.i18nHtml);
  });
  const overlay = document.getElementById('talentOverlay');
  if (overlay){
    const title = overlay.querySelector('.modalTitle');
    if (title) title.textContent = t('talentTreeTitle');
    const resetBtn = overlay.querySelector('#talentResetAll');
    if (resetBtn) resetBtn.textContent = t('talentResetAll');
    const applyBtn = overlay.querySelector('#talentApply');
    if (applyBtn) applyBtn.textContent = t('talentApply');
  }
  if (ui.langRu && ui.langEn){
    const lang = getCurrentLang();
    ui.langRu.classList.toggle('active', lang === 'ru');
    ui.langEn.classList.toggle('active', lang === 'en');
    ui.langRu.setAttribute('aria-pressed', lang === 'ru');
    ui.langEn.setAttribute('aria-pressed', lang === 'en');
  }
  if (ui.settingsBtn){
    ui.settingsBtn.setAttribute('aria-label', t('menuSettings'));
    ui.settingsBtn.setAttribute('data-ui-tooltip', t('menuSettings'));
    ui.settingsBtn.removeAttribute('title');
  }
  if (ui.supercomputerBtn){
    ui.supercomputerBtn.setAttribute('aria-label', t('supercomputerBtn'));
    ui.supercomputerBtn.setAttribute('data-ui-tooltip', t('supercomputerBtn'));
    ui.supercomputerBtn.removeAttribute('title');
  }
  const langSwitch = document.querySelector('.langSwitch');
  if (langSwitch){
    langSwitch.setAttribute('aria-label', t('menuLanguage'));
  }
  renderBigMenuTexts();
  updateTalentUI();
  updateLevelModal();
  updateDamagePointsUI();
}

// ---------- Sprite atlas loader (PNG + JSON) ----------
const spriteLoaders = SpriteLoadersApi && SpriteLoadersApi.createSpriteLoaders
  ? SpriteLoadersApi.createSpriteLoaders({ BAL, getState: () => state })
  : null;

const ZombieSprites = spriteLoaders && spriteLoaders.ZombieSprites ? spriteLoaders.ZombieSprites : {
  ready: false,
  error: 'SpriteLoaders module is unavailable',
  atlasImg: null,
  types: [],
  deathCommon: null,
  spawnConfig: null,
  async load() {},
  pickType() { return null; },
  pickTypeByLevel() { return null; },
};

const TankSprites = spriteLoaders && spriteLoaders.TankSprites ? spriteLoaders.TankSprites : {
  ready: false,
  error: 'SpriteLoaders module is unavailable',
  config: null,
  cache: new Map(),
  async load() {},
  getTank() { return null; },
  pickBody() { return null; },
  pickCannon() { return null; },
  pickAura() { return null; },
};

if (typeof window !== 'undefined') {
  window.TankSprites = TankSprites;
  window.Game = window.Game || {};
  window.Game.TankSprites = TankSprites;
}

const FenceSprites = spriteLoaders && spriteLoaders.FenceSprites ? spriteLoaders.FenceSprites : {
  ready: false,
  error: 'SpriteLoaders module is unavailable',
  atlasImg: null,
  maxFrameScale: 1,
  cornerInsetPx: null,
  framesById: new Map(),
  async load() {},
  pickFrame() { return null; },
};

const DecorSprites = spriteLoaders && spriteLoaders.DecorSprites ? spriteLoaders.DecorSprites : {
  ready: false,
  error: 'SpriteLoaders module is unavailable',
  atlasImg: null,
  framesById: new Map(),
  async load() {},
  pickFrame() { return null; },
};

const GroundSprites = spriteLoaders && spriteLoaders.GroundSprites ? spriteLoaders.GroundSprites : {
  ready: false,
  error: 'SpriteLoaders module is unavailable',
  atlasImg: null,
  config: null,
  async load() {},
};

const SupercomputerSprites = spriteLoaders && spriteLoaders.SupercomputerSprites ? spriteLoaders.SupercomputerSprites : {
  ready: false,
  error: 'SpriteLoaders module is unavailable',
  atlasImg: null,
  atlasImages: null,
  config: null,
  async load() {},
  getAnimation() { return null; },
  getAtlasImage() { return null; },
  getPartConfig() { return null; },
};

{
  const productionLineRender = window.Game && window.Game.ProductionLineRender;
  if (productionLineRender && typeof productionLineRender.setSpriteSource === 'function') {
    productionLineRender.setSpriteSource(SupercomputerSprites);
  }
}

const BoostIconsSprites = spriteLoaders && spriteLoaders.BoostIconsSprites ? spriteLoaders.BoostIconsSprites : {
  ready: false,
  error: 'SpriteLoaders module is unavailable',
  atlasImg: null,
  config: null,
  boosts: null,
  async load() {},
  getBoost() { return null; },
};

var DronSprites = spriteLoaders && spriteLoaders.DronSprites ? spriteLoaders.DronSprites : {
  ready: false,
  error: 'SpriteLoaders module is unavailable',
  atlasImg: null,
  config: null,
  framesById: new Map(),
  async load() {},
  getLevel() { return null; },
  getAnimation() { return null; },
  pickFrame() { return null; },
};

const BonusBoxSprites = spriteLoaders && spriteLoaders.BonusBoxSprites ? spriteLoaders.BonusBoxSprites : {
  ready: false,
  error: 'SpriteLoaders module is unavailable',
  atlasImg: null,
  config: null,
  framesById: new Map(),
  async load() {},
  getAnimation() { return null; },
  pickFrame() { return null; },
};

const BulletSprites = spriteLoaders && spriteLoaders.BulletSprites ? spriteLoaders.BulletSprites : {
  ready: false,
  error: 'SpriteLoaders module is unavailable',
  atlasImg: null,
  config: null,
  async load() {},
  getBullet() { return null; },
};

function getDronConfig(){
  try {
    if (DronSprites && DronSprites.config) return DronSprites.config;
  } catch (e) {}
  return spriteLoaders && spriteLoaders.DronSprites && spriteLoaders.DronSprites.config
    ? spriteLoaders.DronSprites.config
    : null;
}

function getFenceRepairCostCoins(){
  const repair = getFenceRepairConfig();
  return Number.isFinite(repair.costCoins) ? Math.max(0, repair.costCoins) : FENCE_DEFAULT_REPAIR_COST;
}

function getDronRuntimeConfig(){
  const cfg = getDronConfig() || {};
  const sourceLevels = cfg.levels && typeof cfg.levels === 'object' ? cfg.levels : {};
  const maxLevel = Number.isFinite(cfg.maxLevel) ? Math.max(1, Math.floor(cfg.maxLevel)) : 1;
  const levels = {};
  for (let lvl = 1; lvl <= maxLevel; lvl++) {
    const baseStats = getDronStatsForLevel(lvl, 0);
    const appliedStats = getDronStatsForLevel(lvl);
    levels[lvl] = {
      moveSpeedPxSec: Number.isFinite(appliedStats.moveSpeedPxSec) ? Math.max(0, appliedStats.moveSpeedPxSec) : Math.max(0, baseStats.moveSpeedPxSec),
      repairSpeedMult: Number.isFinite(appliedStats.repairSpeedMult) ? Math.max(0, appliedStats.repairSpeedMult) : Math.max(0, baseStats.repairSpeedMult),
      costMult: Number.isFinite(appliedStats.costMult) ? Math.max(0.01, appliedStats.costMult) : Math.max(0.01, baseStats.costMult),
    };
  }
  if (!Object.keys(levels).length && sourceLevels && typeof sourceLevels === 'object') {
    const keys = Object.keys(sourceLevels);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const parsed = Number(key);
      if (!Number.isFinite(parsed)) continue;
      levels[String(Math.max(1, Math.floor(parsed)))] = sourceLevels[key];
    }
  }
  return {
    levels: levels,
    maxLevel: maxLevel,
    baseRepairSec: Number.isFinite(cfg.baseRepairSec) ? Math.max(0.01, cfg.baseRepairSec) : 5,
    iconSize: {
      w: Number.isFinite(cfg.iconSize && cfg.iconSize.w) ? Math.max(8, cfg.iconSize.w) : 20,
      h: Number.isFinite(cfg.iconSize && cfg.iconSize.h) ? Math.max(8, cfg.iconSize.h) : 20,
    },
    iconsOffsetY: Number.isFinite(cfg.iconsOffsetY) ? cfg.iconsOffsetY : -32,
    scale: Number.isFinite(cfg.scale) ? Math.max(0.1, cfg.scale) : 1,
    anchor: cfg.anchor || { x: 0.5, y: 0.5 },
    animations: cfg.animations || {},
  };
}

const WorldEventsCfg = (GameApi.Config && GameApi.Config.WorldEvents)
  ? GameApi.Config.WorldEvents
  : {
      enabled: false,
      weather: {
        enabled: false,
        rain: { enabled: true },
        lightning: { enabled: true, intervalMinSec: 8, intervalMaxSec: 20 },
        thunder: { enabled: true, sfxId: 'thunder' },
      },
      attackMode: {
        enabled: false,
        attackEverySec: 75,
        attackDurationSec: 20,
        weatherLeadInSec: 5,
        weatherLeadOutSec: 3,
        targetAliveMult: 1,
        targetAliveRampSec: 2,
        speedMult: 1,
        damageMult: 1,
        safeWaves: 3,
        eveningDimAlpha: 0.16,
        eveningTransitionSec: 4,
      },
    };

const worldEventsState = {
  attackStartAt: nowSec() + (((WorldEventsCfg.attackMode && Number.isFinite(WorldEventsCfg.attackMode.attackEverySec)) ? Math.max(1, WorldEventsCfg.attackMode.attackEverySec) : 75)),
  currentAttackStartAt: 0,
  attackEndAt: 0,
  forceAttackActive: false,
  eveningDimBlend: 0,
  weatherUntil: 0,
  weatherEnabled: false,
  lightningUntil: 0,
  nextLightningAt: 0,
  rainBlend: 0,
  aliveMultCurrent: 1,
  waveNumber: 0,
  // attackMode supplemental spawn runtime fields
  attackSpawnDirA: null,
  attackSpawnDirB: null,
  attackSpawnDirC: null,
  attackSpawnPrevPrimaryDir: null,
  attackSpawnPrimaryStreak: 0,
  attackSpawnEpisodeKey: null,
};

function resetWorldEventsRuntimeForNewGame(){
  const attackCfg = getWorldEventsAttackCfg();
  const everySec = Number.isFinite(attackCfg.attackEverySec) ? Math.max(1, attackCfg.attackEverySec) : 75;
  worldEventsState.attackStartAt = nowSec() + everySec;
  worldEventsState.currentAttackStartAt = 0;
  worldEventsState.attackEndAt = 0;
  worldEventsState.forceAttackActive = false;
  worldEventsState.eveningDimBlend = 0;
  worldEventsState.weatherUntil = 0;
  worldEventsState.weatherEnabled = false;
  worldEventsState.lightningUntil = 0;
  worldEventsState.nextLightningAt = 0;
  worldEventsState.rainBlend = 0;
  worldEventsState.aliveMultCurrent = 1;
  worldEventsState.waveNumber = 0;
  worldEventsState.attackSpawnDirA = null;
  worldEventsState.attackSpawnDirB = null;
  worldEventsState.attackSpawnDirC = null;
  worldEventsState.attackSpawnPrevPrimaryDir = null;
  worldEventsState.attackSpawnPrimaryStreak = 0;
  worldEventsState.attackSpawnEpisodeKey = null;
}

function getDefaultZombieTargetAlive(){
  const spawnCfg = ZombieSprites && ZombieSprites.spawnConfig && typeof ZombieSprites.spawnConfig === 'object'
    ? ZombieSprites.spawnConfig
    : null;
  if (Number.isFinite(spawnCfg && spawnCfg.targetAlive)) {
    return Math.max(1, Math.floor(spawnCfg.targetAlive));
  }
  if (Number.isFinite(BAL && BAL.zombieCountTarget)) {
    return Math.max(1, Math.floor(BAL.zombieCountTarget));
  }
  return 1;
}

function resetZombieAndAttackModeToDefaultAfterRestore(){
  resetWorldEventsRuntimeForNewGame();

  const defaultTargetAlive = getDefaultZombieTargetAlive();
  BAL.zombieCountTarget = defaultTargetAlive;

  state.zombieWaveAtkMult = 1;
  if (!state.activeEffects || typeof state.activeEffects !== 'object') {
    state.activeEffects = { attackUntil: 0, speedUntil: 0, economyUntil: 0 };
  } else {
    state.activeEffects.attackUntil = 0;
    state.activeEffects.speedUntil = 0;
    state.activeEffects.economyUntil = 0;
  }

  if (Array.isArray(state.zombies)) state.zombies.length = 0;
  state.nextZombieRenderOrder = 1;

  worldEventsState.aliveMultCurrent = 1;
  worldEventsState.rainBlend = 0;
  stopLoopSfx('rainLoop');

  ensureZombieCount();
}

function normalizeAndTeleportDronesAfterRestore(stateRef){
  const targetState = stateRef && typeof stateRef === 'object' ? stateRef : state;
  if (!targetState || !Array.isArray(targetState.drones) || !targetState.drones.length) return;

  if (DronesApi && typeof DronesApi.restoreSavedDrones === 'function') {
    // Clone before passing: restoreSavedDrones clears state.drones first,
    // so passing the same reference would wipe the input array.
    var dronesCopy = JSON.parse(JSON.stringify(targetState.drones));
    DronesApi.restoreSavedDrones(targetState, dronesCopy);
  }

  const sc = targetState.supercomputer && typeof targetState.supercomputer === 'object'
    ? targetState.supercomputer
    : null;
  const baseX = Number.isFinite(sc && sc.x) ? sc.x : 0;
  const baseY = Number.isFinite(sc && sc.y) ? sc.y : 0;
  const cols = 5;
  const stepX = 18;
  const stepY = 14;

  for (let i = 0; i < targetState.drones.length; i++) {
    const drone = targetState.drones[i];
    if (!drone || typeof drone !== 'object') continue;

    const hasAssignedSlot = DronesApi
      && typeof DronesApi.isSlotIndexValid === 'function'
      && DronesApi.isSlotIndexValid(drone.slotIndex);
    if (hasAssignedSlot) {
      drone.targetSegmentId = null;
      drone.reservedSegmentId = null;
      drone.repair = null;
      if (drone.mode === 'repair') drone.substate = DronesApi && DronesApi.SUBSTATE_REPAIR_PATROL ? DronesApi.SUBSTATE_REPAIR_PATROL : 'repair_patrol';
      drone.nextRepairScanAtSec = 0;
      continue;
    }

    const col = i % cols;
    const row = Math.floor(i / cols);
    const offsetX = (col - ((cols - 1) * 0.5)) * stepX;
    const offsetY = (-stepY * 0.5) + row * stepY;
    const nextX = baseX + offsetX;
    const nextY = baseY + offsetY;

    if (!drone.basePos || typeof drone.basePos !== 'object') drone.basePos = { x: nextX, y: nextY };
    else {
      drone.basePos.x = nextX;
      drone.basePos.y = nextY;
    }

    if (!drone.pos || typeof drone.pos !== 'object') drone.pos = { x: nextX, y: nextY };
    else {
      drone.pos.x = nextX;
      drone.pos.y = nextY;
    }

    drone.targetSegmentId = null;
    drone.reservedSegmentId = null;
    drone.repair = null;
    if (drone.mode === 'repair') drone.substate = DronesApi && DronesApi.SUBSTATE_REPAIR_PATROL ? DronesApi.SUBSTATE_REPAIR_PATROL : 'repair_patrol';
    drone.nextRepairScanAtSec = 0;
  }
}

function finalizePartialRestartPostRestore(stateRef, options){
  const targetState = stateRef && typeof stateRef === 'object' ? stateRef : state;
  const opts = options && typeof options === 'object' ? options : null;
  const preserveProgression = !!(opts && opts.preserveProgression);
  const forceFenceRuntimeReset = !!(opts && opts.forceFenceRuntimeReset);
  if (targetState && typeof targetState === 'object') {
    targetState.savedFenceState = null;
    if (!preserveProgression) {
      targetState.buyCounts = {};
      targetState.buyPrices = {};
      targetState.maxTankLevelAchieved = 1;
      targetState.runtimeMaxTankLevelAchieved = 1;
      targetState.currentFenceTierApplied = 1;
      targetState.fenceLevel = 1;
    } else if (forceFenceRuntimeReset) {
      targetState.runtimeMaxTankLevelAchieved = 1;
      targetState.currentFenceTierApplied = 1;
      targetState.fenceLevel = 1;
    }
    syncFenceTierWithMaxTankLevel(targetState, { force: true });
  }
  ensureWorldEventsRuntimeController()?.forceDisableAttackModeRuntime(worldEventsState);

  // Явно очищаем зомби из переданного stateRef (и глобального state)
  var targetZombies = stateRef && Array.isArray(stateRef.zombies) ? stateRef.zombies : null;
  if (targetZombies && targetZombies.length > 0) targetZombies.length = 0;
  if (Array.isArray(state.zombies) && state.zombies !== targetZombies) state.zombies.length = 0;
  normalizeAndTeleportDronesAfterRestore(stateRef);
  resetZombieAndAttackModeToDefaultAfterRestore();
}

const rainCache = {
  maxDrops: 0,
  x: [],
  y: [],
  speed: [],
  len: [],
};

const groundLayer = GroundLayerApi && typeof GroundLayerApi.createGroundLayer === 'function'
  ? GroundLayerApi.createGroundLayer()
  : {
      ready: false,
      error: 'GroundLayer module is unavailable',
      invalidate() { this.ready = false; },
      rebuild() {},
      draw() { return false; },
    };

const BASE_CANVAS = { w: 1100, h: 650 };
let balScale = 1;

const DESKTOP_BREAKPOINT = 768;

function applyBalScale(scale){
  const clamped = clamp(scale, 1, 1.35);
  balScale = clamped;

  if (viewSize && viewSize.w >= DESKTOP_BREAKPOINT) {
    BAL.cellW = 70;
    BAL.cellH = 70;
  } else {
    BAL.cellW = BASE_BAL.cellW * clamped;
    BAL.cellH = BASE_BAL.cellH * clamped;
  }
  BAL.cellGap = BASE_BAL.cellGap * clamped;
  BAL.boardPad = BASE_BAL.boardPad * clamped;

  BAL.zombieTrackRadius = BASE_BAL.zombieTrackRadius * clamped;
  BAL.zombieTrackWidth = BASE_BAL.zombieTrackWidth * clamped;
  BAL.fenceWidth = BASE_BAL.fenceWidth * clamped;
  BAL.fenceKeepout = BASE_BAL.fenceKeepout * clamped;
  BAL.zombieFencePush = BASE_BAL.zombieFencePush * clamped;
  BAL.tankOrbitRadius = BASE_BAL.tankOrbitRadius * clamped;
  BAL.tankTrackWidth = BASE_BAL.tankTrackWidth * clamped;
  BAL.roadFenceGap = clamp(BASE_BAL.roadFenceGap * clamped, 6, 12);

  BAL.zombieScaleMul = BASE_BAL.zombieScaleMul * clamped;
  BAL.zombieBobAmp = BASE_BAL.zombieBobAmp * clamped;
  BAL.zombieShadowW = BASE_BAL.zombieShadowW * clamped;
  BAL.zombieShadowH = BASE_BAL.zombieShadowH * clamped;
  BAL.zombieShadowY = BASE_BAL.zombieShadowY * clamped;
  BAL.zombieGroundOffset = BASE_BAL.zombieGroundOffset * clamped;
  BAL.edgeSpawnRadius = BASE_BAL.edgeSpawnRadius * clamped;

  BAL.crateDropSpeed = BASE_BAL.crateDropSpeed * clamped;
  BAL.crateSize = BASE_BAL.crateSize * clamped;
}

function resizeCanvas(){
  const stage = document.querySelector('.stageCanvas');
  if (!stage) return;

  const displayW = Math.max(200, window.innerWidth);
  const displayH = Math.max(200, window.innerHeight);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  canvas.style.width = `${displayW}px`;
  canvas.style.height = `${displayH}px`;
  canvas.width = Math.floor(displayW * dpr);
  canvas.height = Math.floor(displayH * dpr);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  viewSize = { w: displayW, h: displayH, dpr };
  center = { x: viewSize.w / 2, y: viewSize.h / 2 };
  const scale = Math.min(displayW / BASE_CANVAS.w, displayH / BASE_CANVAS.h);
  applyBalScale(scale);
  initBoard();
}

// ---------- Board ----------
function initBoard(){
  const existing = state.cells.slice();
  const totalW = BAL.cols*BAL.cellW + (BAL.cols-1)*BAL.cellGap + BAL.boardPad*2;
  const totalH = BAL.rows*BAL.cellH + (BAL.rows-1)*BAL.cellGap + BAL.boardPad*2;
  const x0 = center.x - totalW/2;
  const y0 = center.y - totalH/2;

  state.cells = [];
  let i = 0;
  for (let r=0;r<BAL.rows;r++){
    for (let c=0;c<BAL.cols;c++){
      const x = x0 + BAL.boardPad + c*(BAL.cellW+BAL.cellGap);
      const y = y0 + BAL.boardPad + r*(BAL.cellH+BAL.cellGap);
      const old = existing[i];
      state.cells.push({ i, r, c, x, y, w:BAL.cellW, h:BAL.cellH, tank: old?.tank ?? null, orbitPhase: old?.orbitPhase });
      i++;
    }
  }
  state.boardRect = { x:x0, y:y0, w:totalW, h:totalH };
  const hangarCenterX = state.boardRect.x + state.boardRect.w * 0.5;
  const hangarBottomY = state.boardRect.y + state.boardRect.h;

  BAL.zombieTrackWidth = Math.max(12, 14 * balScale);
  const layoutTuning = (window.Game && window.Game.Config && window.Game.Config.LayoutTuning) || {};
  const trackToHangarGapPx = Number.isFinite(layoutTuning.trackToHangarGapPx) ? Math.max(0, layoutTuning.trackToHangarGapPx) : 5;
  const trackToFenceGapPx = Number.isFinite(layoutTuning.trackToFenceGapPx) ? Math.max(0, layoutTuning.trackToFenceGapPx) : 5;
  const spriteKeys = resolveFenceSpriteKeys();
  const fenceCfg = FenceSprites && FenceSprites.config ? FenceSprites.config : null;
  const segmentsPerSide = Number.isFinite(fenceCfg && fenceCfg.segmentsPerSide)
    ? Math.max(1, Math.floor(fenceCfg.segmentsPerSide))
    : null;
  const minFenceRadius = estimateFenceMinRadius(segmentsPerSide, spriteKeys);
  const layoutApi = window.Game && window.Game.HangarLayout;
  const computeLayout = layoutApi && layoutApi.computeHangarTrackLayout;
  if (typeof computeLayout === 'function') {
    const layout = computeLayout({
      boardW: totalW,
      boardH: totalH,
      viewW: viewSize.w,
      viewH: viewSize.h,
      tankTrackWidth: BAL.tankTrackWidth,
      fenceWidth: BAL.fenceWidth,
      zombieTrackWidth: BAL.zombieTrackWidth,
      marginRatio: BAL.hangarMarginRatio,
      hangarPad: 12,
      trackPad: 18,
      minTankOrbitRadius: 110,
      minFenceRadius: minFenceRadius,
    });
    BAL.tankOrbitRadius = layout.tankOrbitRadius;
    BAL.fenceRadius = layout.fenceRadius;
    BAL.zombieTrackRadius = layout.zombieTrackRadius;
  } else {
    const hangarRadius = Math.hypot(totalW * 0.5, totalH * 0.5);
    const trackPad = 18;
    const minSafeTankOrbit = hangarRadius + 12 + BAL.tankTrackWidth * 0.5;
    BAL.tankOrbitRadius = Math.max(110, minSafeTankOrbit + trackToHangarGapPx);
    BAL.fenceRadius = BAL.tankOrbitRadius + BAL.tankTrackWidth * 0.5 + trackToFenceGapPx + BAL.fenceWidth * 0.5;
    if (minFenceRadius > 0 && BAL.fenceRadius < minFenceRadius) BAL.fenceRadius = minFenceRadius;
    BAL.zombieTrackRadius = BAL.fenceRadius + BAL.fenceWidth * 0.5 + trackPad + BAL.zombieTrackWidth * 0.5;
  }
  const sc = getComputerState();
  const layoutTuningSupercomputerOffset = Number.isFinite(layoutTuning.supercomputerOffsetY)
    ? layoutTuning.supercomputerOffsetY
    : 64;
  const configOffset = Number.isFinite(SupercomputerSprites?.config?.offsetY)
    ? SupercomputerSprites.config.offsetY
    : layoutTuningSupercomputerOffset;
  sc.offsetY = configOffset;
  sc.x = hangarCenterX;
  sc.y = hangarBottomY + sc.offsetY;
  // ── Production Line: update render layout relative to supercomputer ──
  {
    const _PLR = window.Game && window.Game.ProductionLineRender;
    if (_PLR && typeof _PLR.updateLayout === 'function') {
      const scSprite = SupercomputerSprites && SupercomputerSprites.config;
      const scAnim = SupercomputerSprites && SupercomputerSprites.getAnimation
        ? SupercomputerSprites.getAnimation(resolveSupercomputerVisualStateName(sc))
        : null;
      const scScale = resolveSupercomputerAnimationScale(scSprite, scAnim);
      const scW = scAnim && Number.isFinite(scAnim.w) ? scAnim.w * scScale : 68 * balScale;
      const scH = scAnim && Number.isFinite(scAnim.h) ? scAnim.h * scScale : 62 * balScale;
      _PLR.updateLayout(sc.x, sc.y, scW, scH, balScale);
    }
  }
  updateSupercomputerHudButtonPosition();
  if (supercomputerController && supercomputerController.syncLevel) {
    supercomputerController.syncLevel(sc, SupercomputerSprites.config);
  }

  state.fenceSegments = [];
  state.fenceSegmentsMeta = null;

  if (state.crate){
    const cell = state.cells[state.crate.cellIndex];
    if (cell){
      state.crate.x = cell.x + cell.w / 2;
      state.crate.targetY = cell.y + cell.h / 2;
      state.crate.y = Math.min(state.crate.y, state.crate.targetY);
      if (typeof state.crate.animState !== 'string') state.crate.animState = 'idle';
      if (!Number.isFinite(state.crate.animTimeSec)) state.crate.animTimeSec = 0;
      if (typeof state.crate.isHover !== 'boolean') state.crate.isHover = false;
      if (typeof state.crate.isAlive !== 'boolean') state.crate.isAlive = true;
    }
  }
  if (state.dragging){
    const cell = state.cells[state.dragging.cellIndex];
    if (cell){
      const cx = cell.x + cell.w / 2;
      const cy = cell.y + cell.h / 2;
      state.dragging.x = cx;
      state.dragging.y = cy;
      state.dragging.dx = 0;
      state.dragging.dy = 0;
      state.dragging.startX = cx;
      state.dragging.startY = cy;
    }
  }

  ensureMapSeedsState();
  buildBackground();
  initDecors();
}

function initDecors(){
  state.decors = [];
  state.wallDecors = [];
  const mapSeeds = ensureMapSeedsState();
  const decorSeed = (mapSeeds.decorSeed !== undefined && mapSeeds.decorSeed !== null)
    ? mapSeeds.decorSeed
    : resolveDecorSeed();
  if (mapSeeds.decorSeed === undefined || mapSeeds.decorSeed === null) {
    mapSeeds.decorSeed = decorSeed;
  }

  function makeFallbackRng(seed){
    let localState = 2166136261 >>> 0;
    const src = String(seed);
    for (let i = 0; i < src.length; i++) {
      localState ^= src.charCodeAt(i);
      localState = Math.imul(localState, 16777619) >>> 0;
    }
    if (localState === 0) localState = 0x6d2b79f5;
    function nextFloat01(){
      localState = (localState + 0x6D2B79F5) >>> 0;
      let t = localState;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    return {
      nextFloat01,
      nextInt(min, max){
        let lo = Number.isFinite(min) ? Math.floor(min) : 0;
        let hi = Number.isFinite(max) ? Math.floor(max) : lo;
        if (lo > hi) {
          const tmp = lo;
          lo = hi;
          hi = tmp;
        }
        const span = hi - lo + 1;
        if (span <= 1) return lo;
        return lo + Math.floor(nextFloat01() * span);
      },
    };
  }

  const rng = (SeededRngApi && typeof SeededRngApi.makeRng === 'function')
    ? SeededRngApi.makeRng(decorSeed)
    : makeFallbackRng(decorSeed);

  const decorCfg = DecorSprites && DecorSprites.config ? DecorSprites.config : null;
  const cfgIds = Array.isArray(decorCfg?.spriteIds) ? decorCfg.spriteIds : [];
  const cfgCount = Number.isFinite(decorCfg?.count) ? decorCfg.count : 0;
  const cfgZones = Array.isArray(decorCfg?.noSpawnZones) ? decorCfg.noSpawnZones : [];
  const cfgPlacementMaxAttempts = Number.isFinite(decorCfg?.placementMaxAttempts)
    ? Math.max(1, Math.floor(decorCfg.placementMaxAttempts))
    : 40;

  const hasBalIds = Array.isArray(BAL.decorSpriteIds) && BAL.decorSpriteIds.length > 0;
  const hasBalCount = Number.isFinite(BAL.decorCount);
  const hasBalZones = Array.isArray(BAL.decorNoSpawnZones) && BAL.decorNoSpawnZones.length > 0;

  const ids = hasBalIds ? BAL.decorSpriteIds : cfgIds;
  const rawCount = hasBalCount ? BAL.decorCount : cfgCount;
  const count = Math.min(Math.max(0, rawCount || 0), 200);
  if (!ids.length || count <= 0) return;
  const blockRadiusK = Number.isFinite(decorCfg?.blockRadiusK) ? clamp(decorCfg.blockRadiusK, 0.1, 0.6) : 0.35;
  const blockRadiusMin = Number.isFinite(decorCfg?.blockRadiusMin) ? Math.max(1, decorCfg.blockRadiusMin) : 8;
  const zones = hasBalZones ? BAL.decorNoSpawnZones : cfgZones;
  const maxAttemptsPerStage = Number.isFinite(BAL.decorMaxAttempts)
    ? Math.max(1, Math.floor(BAL.decorMaxAttempts))
    : cfgPlacementMaxAttempts;
  // Decor spawns OUTSIDE the fence, not inside
  const fenceOuterEdge = Number.isFinite(BAL.fenceRadius) ? (BAL.fenceRadius + (BAL.fenceWidth || 20) * 0.5 + 12) : 300;
  const innerR = fenceOuterEdge;
  const outerRByViewport = Math.max(viewSize.w, viewSize.h) * 0.62;
  const maxMapRadius = Math.max(
    Math.hypot(center.x, center.y),
    Math.hypot(viewSize.w - center.x, center.y),
    Math.hypot(center.x, viewSize.h - center.y),
    Math.hypot(viewSize.w - center.x, viewSize.h - center.y)
  );
  let firstStageOuterR = outerRByViewport;
  if (!(firstStageOuterR > innerR)) {
    firstStageOuterR = innerR + 80;
  }
  if (firstStageOuterR > maxMapRadius) {
    firstStageOuterR = maxMapRadius;
  }
  const stageCount = 5;
  const stageOuterR = new Array(stageCount);
  for (let s = 0; s < stageCount; s++) {
    const t = (s + 1) / stageCount;
    stageOuterR[s] = firstStageOuterR + (maxMapRadius - firstStageOuterR) * t;
  }

  function isInsideMapWithPadding(x, y, pad){
    return x >= pad && x <= (viewSize.w - pad) && y >= pad && y <= (viewSize.h - pad);
  }

  function pointBlockedByZones(x, y, noSpawnZones){
    for (const z of noSpawnZones){
      const type = typeof z?.type === 'string' ? z.type.toLowerCase() : '';
      // Default to relativeToCenter=true so zones in decor.json work correctly
      const rel = z?.relativeToCenter !== false;
      const baseX = rel ? center.x : 0;
      const baseY = rel ? center.y : 0;

      if ((type === 'circle' || z?.r != null) && Number.isFinite(z?.r)) {
        const cx = baseX + (Number.isFinite(z?.cx) ? z.cx : (Number.isFinite(z?.x) ? z.x : 0));
        const cy = baseY + (Number.isFinite(z?.cy) ? z.cy : (Number.isFinite(z?.y) ? z.y : 0));
        if (Math.hypot(x - cx, y - cy) <= z.r) return true;
      }
      if ((type === 'rect' || (z?.w != null && z?.h != null)) && Number.isFinite(z?.w) && Number.isFinite(z?.h)) {
        const zx = baseX + (Number.isFinite(z?.x) ? z.x : 0) - z.w * 0.5;
        const zy = baseY + (Number.isFinite(z?.y) ? z.y : 0) - z.h * 0.5;
        if (x >= zx && x <= zx + z.w && y >= zy && y <= zy + z.h) return true;
      }
    }
    return false;
  }

  function overlapsPlacedDecors(x, y, blockR){
    for (let i = 0; i < state.decors.length; i++) {
      const d = state.decors[i];
      const minDist = blockR + d.blockR;
      if (Math.hypot(x - d.x, y - d.y) < minDist) return true;
    }
    return false;
  }

  function tryCommitDecor(x, y, spriteId){
    const frame = DecorSprites.pickFrame(spriteId);
    if (!frame) return false;
    const frameScale = Number.isFinite(frame.scale) && frame.scale > 0 ? frame.scale : 1;
    const isWall = !!frame.isWall;
    const drawScale = 0.5 * balScale * frameScale;
    const baseRadius = Math.min(frame.w, frame.h) * drawScale;
    const blockR = Math.max(blockRadiusMin, baseRadius * blockRadiusK);

    if (!isInsideMapWithPadding(x, y, blockR)) return false;
    if (Math.hypot(x - center.x, y - center.y) < innerR) return false;
    if (zones.length && pointBlockedByZones(x, y, zones)) return false;
    if (overlapsPlacedDecors(x, y, blockR)) return false;

    const decor = { x, y, spriteId, blockR, isWall, renderOrder: state.decors.length };
    state.decors.push(decor);
    if (isWall) state.wallDecors.push(decor);
    return true;
  }

  function sampleAnnulusPoint(decorIndex, stageIndex, attempt, outerR){
    const angleUnit = rng.nextFloat01();
    const radiusUnit = rng.nextFloat01();
    const angle = angleUnit * Math.PI * 2;
    const r = innerR + Math.sqrt(radiusUnit) * Math.max(1, outerR - innerR);
    return {
      x: center.x + Math.cos(angle) * r,
      y: center.y + Math.sin(angle) * r,
    };
  }

  function tryPlaceDecorForIndex(decorIndex){
    for (let stage = 0; stage < stageOuterR.length; stage++) {
      const outerR = stageOuterR[stage];
      for (let attempt = 0; attempt < maxAttemptsPerStage; attempt++) {
        const p = sampleAnnulusPoint(decorIndex, stage, attempt, outerR);
        const spriteId = ids[rng.nextInt(0, ids.length - 1)];
        if (tryCommitDecor(p.x, p.y, spriteId)) return true;
      }
    }
    return false;
  }

  function exhaustiveGridPlacement(decorIndex){
    const gridStep = Math.max(8, Math.floor(blockRadiusMin * 1.5));
    const offsetX = rng.nextInt(0, Math.max(0, gridStep - 1));
    const offsetY = rng.nextInt(0, Math.max(0, gridStep - 1));
    const startSpriteOffset = ids.length > 1 ? rng.nextInt(0, ids.length - 1) : 0;
    for (let y = offsetY; y <= viewSize.h; y += gridStep) {
      for (let x = offsetX; x <= viewSize.w; x += gridStep) {
        for (let si = 0; si < ids.length; si++) {
          const spriteId = ids[(startSpriteOffset + si) % ids.length];
          if (tryCommitDecor(x, y, spriteId)) return true;
        }
      }
    }
    return false;
  }

  function bruteForcePlacement(decorIndex){
    const hardAttempts = Math.max(12000, maxAttemptsPerStage * 300);
    for (let attempt = 0; attempt < hardAttempts; attempt++) {
      const x = rng.nextFloat01() * viewSize.w;
      const y = rng.nextFloat01() * viewSize.h;
      const spriteId = ids[rng.nextInt(0, ids.length - 1)];
      if (tryCommitDecor(x, y, spriteId)) return true;
    }
    return false;
  }

  for (let n = 0; n < count; n++) {
    if (tryPlaceDecorForIndex(n)) continue;
    if (exhaustiveGridPlacement(n)) continue;
    bruteForcePlacement(n);
  }
}

function getTankOrbitRadius(){
  return BAL.tankOrbitRadius;
}

function buildBackground(){
  const bg = document.createElement('canvas');
  bg.width = viewSize.w;
  bg.height = viewSize.h;
  const bctx = bg.getContext('2d');
  bctx.imageSmoothingEnabled = false;

  const grad = bctx.createLinearGradient(0, 0, 0, bg.height);
  grad.addColorStop(0, '#1a140f');
  grad.addColorStop(0.5, '#2e1f14');
  grad.addColorStop(1, '#4a2a16');
  bctx.fillStyle = grad;
  bctx.fillRect(0, 0, bg.width, bg.height);

  for (let y = 0; y < bg.height; y += 34){
    for (let x = 0; x < bg.width; x += 42){
      const n = seededNoise(x, y);
      const w = 60 + n * 20;
      const h = 40 + n * 18;
      const rx = x + n * 18;
      const ry = y + n * 16;
      bctx.fillStyle = n > 0.52 ? 'rgba(112,77,46,.55)' : 'rgba(47,103,57,.35)';
      bctx.beginPath();
      bctx.ellipse(rx, ry, w * 0.5, h * 0.5, n * Math.PI, 0, Math.PI * 2);
      bctx.fill();
    }
  }

  for (let i = 0; i < 1800; i++){
    const x = (i * 53) % bg.width;
    const y = (i * 91) % bg.height;
    const n = seededNoise(x * 1.3, y * 1.7);
    bctx.fillStyle = n > 0.5 ? 'rgba(84,141,75,.55)' : 'rgba(92,64,39,.5)';
    bctx.fillRect(x, y, 2 + n * 2, 2 + n * 2);
  }

  for (let i = 0; i < 520; i++){
    const x = (i * 37) % bg.width;
    const y = (i * 71) % bg.height;
    const n = seededNoise(x * 2.1, y * 1.9);
    bctx.strokeStyle = `rgba(33,82,40,${0.28 + n * 0.3})`;
    bctx.lineWidth = 1;
    bctx.beginPath();
    bctx.moveTo(x, y);
    bctx.lineTo(x + 6 + n * 8, y - 6 - n * 6);
    bctx.stroke();
  }

  backgroundLayer.canvas = bg;
  backgroundLayer.ready = true;
  rebuildGroundLayer();
}

function rebuildGroundLayer(){
  if (!groundLayer || typeof groundLayer.rebuild !== 'function') return false;
  if (!GroundSprites.ready || !GroundSprites.atlasImg || !GroundSprites.config) {
    if (typeof groundLayer.invalidate === 'function') groundLayer.invalidate();
    return false;
  }
  try {
    const mapSeeds = ensureMapSeedsState();
    groundLayer.rebuild({
      cfg: GroundSprites.config,
      atlasImg: GroundSprites.atlasImg,
      stampsSeed: mapSeeds.stampsSeed,
      width: viewSize.w,
      height: viewSize.h,
    });
    return !!groundLayer.ready;
  } catch (e) {
    if (typeof groundLayer.invalidate === 'function') groundLayer.invalidate();
    return false;
  }
}

function ensureWorldEventsRuntimeController(){
  if (worldEventsRuntimeController) return worldEventsRuntimeController;
  const api = GameApi && GameApi.WorldEventsRuntime;
  if (!api || typeof api.createController !== 'function') return null;
  worldEventsRuntimeController = api.createController({
    getState(){ return state; },
    getWorldEventsCfg(){ return WorldEventsCfg; },
    getWorldEventsState(){ return worldEventsState; },
    getRainCache(){ return rainCache; },
    getViewSize(){ return viewSize; },
    getCtx(){ return ctx; },
    clamp: clamp,
    nowSec: nowSec,
    playSfx: playSfx,
    playLoopSfx: playLoopSfx,
    setLoopSfxVolume: setLoopSfxVolume,
    stopLoopSfx: stopLoopSfx,
    normalizedSfxSources: normalizedSfxSources,
    setSfxSources: setSfxSources,
    getDefaultRainLoopSources(){ return DEFAULT_RAIN_LOOP_SOURCES; },
  });
  return worldEventsRuntimeController;
}

function getWorldEventsAttackCfg(){
  return ensureWorldEventsRuntimeController()?.getWorldEventsAttackCfg() || null;
}

function getWeatherCfg(){
  return ensureWorldEventsRuntimeController()?.getWeatherCfg() || null;
}

function configureRainLoopSfx(rainCfg){
  ensureWorldEventsRuntimeController()?.configureRainLoopSfx(rainCfg);
}

function scheduleNextLightning(now, lightningCfg){
  ensureWorldEventsRuntimeController()?.scheduleNextLightning(now, lightningCfg);
}

function processWeatherLightning(now, dt, weatherCfg){
  ensureWorldEventsRuntimeController()?.processWeatherLightning(now, dt, weatherCfg);
}

function isZombieAttackModeActive(){
  return !!ensureWorldEventsRuntimeController()?.isZombieAttackModeActive();
}

function desiredAliveMultTarget(attackCfg){
  return ensureWorldEventsRuntimeController()?.desiredAliveMultTarget(attackCfg) || 1;
}

function updateDesiredAliveMultCurrent(dt, attackCfg){
  ensureWorldEventsRuntimeController()?.updateDesiredAliveMultCurrent(dt, attackCfg);
}

function getZombieAttackMultipliers(){
  return ensureWorldEventsRuntimeController()?.getZombieAttackMultipliers()
    || { targetAliveMult: 1, speedMult: 1, damageMult: 1 };
}

function shouldZombieAttemptAttack(){
  const controller = ensureWorldEventsRuntimeController();
  if (controller && typeof controller.shouldZombieAttemptAttack === 'function') {
    return !!controller.shouldZombieAttemptAttack();
  }
  return isZombieAttackModeActive();
}

function getZombieFenceAttackDamageMul(){
  const controller = ensureWorldEventsRuntimeController();
  if (controller && typeof controller.getZombieFenceAttackDamageMul === 'function') {
    return controller.getZombieFenceAttackDamageMul();
  }
  return isZombieAttackModeActive() ? getZombieAttackMultipliers().damageMult : 0;
}

function getZombieIdleRetreatOffsetPx(zombie){
  const controller = ensureWorldEventsRuntimeController();
  if (controller && typeof controller.getZombieIdleRetreatOffsetPx === 'function') {
    return controller.getZombieIdleRetreatOffsetPx(zombie);
  }
  return 0;
}

function getZombieIdleWavePhase(){
  const controller = ensureWorldEventsRuntimeController();
  if (controller && typeof controller.getZombieIdleWavePhase === 'function') {
    return controller.getZombieIdleWavePhase();
  }
  return 'inactive';
}

function updateWorldEvents(dt){
  ensureWorldEventsRuntimeController()?.updateWorldEvents(dt);
}

function ensureRainCache(requiredCount){
  ensureWorldEventsRuntimeController()?.ensureRainCache(requiredCount);
}

function drawWeather(){
  ensureWorldEventsRuntimeController()?.drawWeather();
}

function makeTank(level, onTrack = false, options = null){
  const opts = options && typeof options === 'object' ? options : null;
  const shouldStamp = !onTrack && (!opts || opts.enableStamp !== false);
  const stampStartSec = shouldStamp
    ? (opts && Number.isFinite(opts.stampStartSec) ? opts.stampStartSec : nowSec())
    : null;
  return {
    id: crypto.randomUUID(),
    level,
    powerTier: computePowerTier(getComputerLevel()),
    cooldown: 0,
    onTrack,
    bodyAnim: Math.random() * 2,
    cannonAnim: 0,
    firedThisCycle: false,
    stampStartSec: Number.isFinite(stampStartSec) ? stampStartSec : null,
  };
}

function getTankPrintDurationSec(){
  const raw = Number(TankSprites && TankSprites.config ? TankSprites.config.tankPrintDurationSec : NaN);
  if (!Number.isFinite(raw) || raw <= 0) return 1.5;
  return raw;
}

function isTankPrinting(tank){
  if (!tank || tank.onTrack) return false;
  if (!Number.isFinite(tank.stampStartSec)) return false;
  const elapsedSec = nowSec() - tank.stampStartSec;
  const durationSec = getTankPrintDurationSec();
  if (!Number.isFinite(elapsedSec) || elapsedSec >= durationSec) {
    tank.stampStartSec = null;
    return false;
  }
  return elapsedSec >= 0;
}

function addDron(level){
  if (!(DronesApi && typeof DronesApi.addDron === 'function')) return null;
  const drone = DronesApi.addDron(state, level, { dronConfig: getDronRuntimeConfig() });
  if (drone) {
    updateUI();
  }
  return drone;
}

function getDronLevelsCount(){
  const cfg = getDronConfig() || {};
  const maxLevel = Number.isFinite(cfg && cfg.maxLevel) ? Math.max(1, Math.floor(cfg.maxLevel)) : 1;
  return Math.max(1, Math.min(MAX_TANK_LEVEL, maxLevel));
}

function getAppliedDronUpgradeLevel(level){
  const lvl = Number.isFinite(level) ? Math.max(1, Math.min(getDronLevelsCount(), Math.floor(level))) : 1;
  const applied = ensureDronUpgradesAppliedState();
  const idx = lvl - 1;
  const value = normalizeAppliedDronUpgrade(applied[idx]);
  if (applied[idx] !== value) applied[idx] = value;
  return value;
}

function getDronUpgradeStepCost(level, appliedIndex){
  return getUpgradeStepCost(level, appliedIndex);
}

function getDronUpgradePercentsForLevel(level){
  const row = getCannonUpgradeRow(level) || [];
  const moveSpeedIncPer = Number.isFinite(Number(row[4])) ? Math.max(0, Number(row[4])) : 0;
  const repairSpeedIncPer = Number.isFinite(Number(row[3])) ? Math.max(0, Number(row[3])) : 0;
  const repairCostDecPer = Number.isFinite(Number(row[3])) ? Math.max(0, Number(row[3])) : 0;
  return {
    moveSpeedIncPer,
    repairSpeedIncPer,
    repairCostDecPer,
  };
}

function buildDronStatsWithApplied(baseStats, level, applied){
  const baseMove = Number.isFinite(baseStats && baseStats.moveSpeedPxSec) ? Math.max(0, Number(baseStats.moveSpeedPxSec)) : 0;
  const baseRepair = Number.isFinite(baseStats && baseStats.repairSpeedMult) ? Math.max(0, Number(baseStats.repairSpeedMult)) : 0;
  const baseCost = Number.isFinite(baseStats && baseStats.costMult) ? Math.max(0.01, Number(baseStats.costMult)) : 1;
  const up = Number.isFinite(applied) ? Math.max(0, Math.floor(applied)) : 0;
  if (up <= 0) {
    return {
      moveSpeedPxSec: baseMove,
      repairSpeedMult: baseRepair,
      costMult: baseCost,
    };
  }
  const percents = getDronUpgradePercentsForLevel(level);
  const moveSpeedPxSec = baseMove * (1 + percents.moveSpeedIncPer * up);
  const repairSpeedMult = baseRepair * (1 + percents.repairSpeedIncPer * up);
  const costMulRaw = baseCost * (1 - percents.repairCostDecPer * up);
  return {
    moveSpeedPxSec: moveSpeedPxSec,
    repairSpeedMult: repairSpeedMult,
    costMult: Math.max(0.01, costMulRaw),
  };
}

function getDronStatsForLevel(level, appliedOverride){
  const cfg = getDronConfig() || {};
  const lvl = Number.isFinite(level) ? Math.max(1, Math.min(getDronLevelsCount(), Math.floor(level))) : 1;
  const raw = DronesApi && typeof DronesApi.getDroneLevelConfig === 'function'
    ? DronesApi.getDroneLevelConfig(cfg, lvl)
    : ((cfg && cfg.levels && cfg.levels[lvl]) || (cfg && cfg.levels && cfg.levels[String(lvl)]) || null);
  const baseStats = {
    moveSpeedPxSec: Number.isFinite(raw && raw.moveSpeedPxSec) ? Math.max(0, raw.moveSpeedPxSec) : 0,
    repairSpeedMult: Number.isFinite(raw && raw.repairSpeedMult) ? Math.max(0, raw.repairSpeedMult) : 0,
    costMult: Number.isFinite(raw && raw.costMult) ? Math.max(0.01, raw.costMult) : 1,
  };
  const applied = Number.isFinite(appliedOverride)
    ? Math.max(0, Math.floor(appliedOverride))
    : getAppliedDronUpgradeLevel(lvl);
  return buildDronStatsWithApplied(baseStats, lvl, applied);
}

function getDronUpgradeTotalCost(level, pendingCount){
  const count = Number.isFinite(pendingCount) ? Math.max(0, Math.floor(pendingCount)) : 0;
  if (count <= 0) return 0;
  const applied = getAppliedDronUpgradeLevel(level);
  let total = 0;
  for (let k = 0; k < count; k++) {
    total += getDronUpgradeStepCost(level, applied + k);
  }
  return total;
}

function applyDronUpgrade(level, pendingCount){
  const lvl = Number.isFinite(level) ? Math.max(1, Math.min(getDronLevelsCount(), Math.floor(level))) : 1;
  const count = Number.isFinite(pendingCount) ? Math.max(0, Math.floor(pendingCount)) : 0;
  if (count <= 0) return { ok: false, error: 'no_pending' };
  const totalCost = getDronUpgradeTotalCost(lvl, count);
  if (totalCost <= 0) return { ok: false, error: 'invalid_cost' };
  if (getAvailableDamagePoints() < totalCost) return { ok: false, error: 'not_enough_points', totalCost: totalCost };

  const applied = ensureDronUpgradesAppliedState();
  applied[lvl - 1] = normalizeAppliedDronUpgrade(applied[lvl - 1]) + count;

  const spent = totalCost;
  state.damagePointsSpent = ensureDamagePointsSpentState() + spent;
  state.player.modsDirty = true;
  updateDamagePointsUI();
  return {
    ok: true,
    totalCost: spent,
    appliedLevel: normalizeAppliedDronUpgrade(applied[lvl - 1]),
  };
}

function getFenceTierForTankLevel(level){
  var fenceLevels = getFenceLevels();
  var maxFenceLevel = Array.isArray(fenceLevels) && fenceLevels.length ? fenceLevels.length : MAX_TANK_LEVEL;
  var safeLevel = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;
  return Math.max(1, Math.min(maxFenceLevel, safeLevel));
}

function snapshotFenceHpById(stateRef){
  var targetState = stateRef && typeof stateRef === 'object' ? stateRef : state;
  if (!targetState || !Array.isArray(targetState.fenceSegments) || !targetState.fenceSegments.length) return;
  var hpById = {};
  for (var i = 0; i < targetState.fenceSegments.length; i++) {
    var seg = targetState.fenceSegments[i];
    if (!seg || !seg.id || !Number.isFinite(seg.hp)) continue;
    hpById[seg.id] = seg.hp;
  }
  targetState.savedFenceState = {
    segmentsPerSide: getFenceSegmentsPerSide(),
    hpById: hpById,
  };
}

function ensureFenceTierRuntimeState(stateRef){
  var targetState = stateRef && typeof stateRef === 'object' ? stateRef : state;
  if (!targetState || typeof targetState !== 'object') return;
  var maxAchieved = Number.isFinite(targetState.maxTankLevelAchieved)
    ? Math.max(1, Math.floor(targetState.maxTankLevelAchieved))
    : 1;
  if (!Number.isFinite(targetState.runtimeMaxTankLevelAchieved)) {
    targetState.runtimeMaxTankLevelAchieved = maxAchieved;
  } else {
    targetState.runtimeMaxTankLevelAchieved = Math.max(1, Math.floor(targetState.runtimeMaxTankLevelAchieved));
  }
  if (!Number.isFinite(targetState.currentFenceTierApplied)) {
    targetState.currentFenceTierApplied = getFenceTierForTankLevel(targetState.runtimeMaxTankLevelAchieved);
  }
}

function syncFenceTierWithMaxTankLevel(stateRef, options){
  var targetState = stateRef && typeof stateRef === 'object' ? stateRef : state;
  if (!targetState || typeof targetState !== 'object') return false;
  ensureFenceTierRuntimeState(targetState);
  var opts = options || {};
  var force = !!opts.force;
  var runtimeMax = Number.isFinite(targetState.runtimeMaxTankLevelAchieved)
    ? Math.max(1, Math.floor(targetState.runtimeMaxTankLevelAchieved))
    : 1;
  var desiredTier = getFenceTierForTankLevel(runtimeMax);
  var appliedTier = Number.isFinite(targetState.currentFenceTierApplied)
    ? Math.max(1, Math.floor(targetState.currentFenceTierApplied))
    : getFenceTierForTankLevel(targetState.fenceLevel);
  var currentTier = Number.isFinite(targetState.fenceLevel)
    ? Math.max(1, Math.floor(targetState.fenceLevel))
    : desiredTier;
  if (!force && desiredTier === appliedTier && currentTier === desiredTier) return false;

  targetState.fenceLevel = desiredTier;
  targetState.currentFenceTierApplied = desiredTier;
  snapshotFenceHpById(targetState);
  targetState.fenceSegments = [];
  targetState.fenceSegmentsMeta = null;

  if (targetState === state && typeof FenceSprites !== 'undefined' && FenceSprites && typeof FenceSprites.ensureLevel === 'function') {
    try { FenceSprites.ensureLevel(desiredTier); } catch (e) {}
  }
  return true;
}

function recordTankLevel(level){
  ensureFenceTierRuntimeState(state);
  const prevMaxLevel = Number.isFinite(state.maxTankLevelAchieved) ? Math.max(0, Math.floor(state.maxTankLevelAchieved)) : 0;
  const nextLevel = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;
  const grewMax = nextLevel > prevMaxLevel;
  if (grewMax) {
    state.maxTankLevelAchieved = nextLevel;
  }

  const prevRuntimeMax = Number.isFinite(state.runtimeMaxTankLevelAchieved)
    ? Math.max(1, Math.floor(state.runtimeMaxTankLevelAchieved))
    : 1;
  if (nextLevel > prevRuntimeMax) {
    state.runtimeMaxTankLevelAchieved = nextLevel;
  }

  syncFenceTierWithMaxTankLevel(state, { force: grewMax });
  if (!grewMax) return;

}

function buyTankLevel(){
  const maxLevel = Math.max(1, state.maxTankLevelAchieved || 1);
  const Econ = window.Game && window.Game.Economy;
  return Econ ? Econ.computeBuyTankLevel(maxLevel) : 1;
}

function baseBuyPrice(level){
  return window.Game && window.Game.Economy ? window.Game.Economy.getTankBaseCost(level) : Math.round(level <= 1 ? BAL.buyCostLv1 : BAL.buyCostLv1 * 2.25);
}

function ensureBuyPrice(level){
  if (!state.buyPrices) state.buyPrices = {};
  if (!state.buyPrices[level]){
    state.buyPrices[level] = baseBuyPrice(level);
  }
  return state.buyPrices[level];
}

function buyTankCost(level){
  const mods = getMods();
  const base = ensureBuyPrice(level);
  const exp = window.Game && window.Game.Experiments ? window.Game.Experiments.getVariant('economy_curve') : 'control';
  const expMul = exp === 'soft' ? 0.92 : 1;
  const buyCostMul = Number.isFinite(mods.tankBuyCostMul) ? Math.max(0, mods.tankBuyCostMul) : Math.max(0, mods.buyCostMul);
  return Math.max(1, Math.round(base * buyCostMul * expMul));
}

function getBuyCostMul(){
  const mods = getMods();
  const exp = window.Game && window.Game.Experiments ? window.Game.Experiments.getVariant('economy_curve') : 'control';
  const expMul = exp === 'soft' ? 0.92 : 1;
  const buyCostMul = Number.isFinite(mods.tankBuyCostMul) ? Math.max(0, mods.tankBuyCostMul) : Math.max(0, mods.buyCostMul);
  return buyCostMul * expMul;
}

function bumpBuyPrice(level){
  const current = ensureBuyPrice(level);
  const delta = Math.max(1, Math.ceil(current * 0.001));
  state.buyPrices[level] = current + delta;
}

function ensureAchievementsState(){
  if (AchievementsApi && AchievementsApi.ensureState) {
    const achievementsState = AchievementsApi.ensureState(state);
    if (!achievementsState) return achievementsState;
    if (!Array.isArray(achievementsState.popupQueue)) achievementsState.popupQueue = [];
    normalizeAchievementPopupQueueInPlace(achievementsState.popupQueue);
    return achievementsState;
  }
  if (!state.achievements || typeof state.achievements !== 'object') {
    state.achievements = { unlocked: {}, popupQueue: [], totalPurchased: 0, totalMerges: 0 };
  }
  if (!state.achievements.unlocked || typeof state.achievements.unlocked !== 'object') state.achievements.unlocked = {};
  if (!Array.isArray(state.achievements.popupQueue)) state.achievements.popupQueue = [];
  normalizeAchievementPopupQueueInPlace(state.achievements.popupQueue);
  if (!Number.isFinite(state.achievements.totalPurchased)) state.achievements.totalPurchased = 0;
  if (!Number.isFinite(state.achievements.totalMerges)) state.achievements.totalMerges = 0;
  return state.achievements;
}

function ensureAchievementUiState(){
  if (!state.ui || typeof state.ui !== 'object') state.ui = {};
  if (!state.ui.toast || typeof state.ui.toast !== 'object') {
    state.ui.toast = { active: null, queue: [] };
  }
  if (!state.ui.unlockFx || typeof state.ui.unlockFx !== 'object') {
    state.ui.unlockFx = { autoMergeUntilMs: 0, bulkBuyUntilMs: 0 };
  }
  state.ui.unlockFx.autoMergeUntilMs = Number.isFinite(state.ui.unlockFx.autoMergeUntilMs)
    ? Math.max(0, Math.floor(state.ui.unlockFx.autoMergeUntilMs))
    : 0;
  state.ui.unlockFx.bulkBuyUntilMs = Number.isFinite(state.ui.unlockFx.bulkBuyUntilMs)
    ? Math.max(0, Math.floor(state.ui.unlockFx.bulkBuyUntilMs))
    : 0;
  return state.ui;
}

function normalizeAchievementQueueEvent(item){
  if (!item) return null;
  if (typeof item === 'string') {
    return {
      type: 'achievement_unlock',
      id: item,
      ts: Date.now(),
    };
  }
  if (typeof item !== 'object') return null;
  if (typeof item.id !== 'string' || item.id.length <= 0) return null;
  return {
    type: 'achievement_unlock',
    id: item.id,
    ts: Number.isFinite(item.ts) ? Math.max(0, Math.floor(item.ts)) : Date.now(),
  };
}

function normalizeAchievementPopupQueueInPlace(queue){
  if (!Array.isArray(queue)) return;
  let writeIndex = 0;
  for (let readIndex = 0; readIndex < queue.length; readIndex++) {
    const event = normalizeAchievementQueueEvent(queue[readIndex]);
    if (!event) continue;
    queue[writeIndex++] = event;
  }
  queue.length = writeIndex;
}

function queueAchievementPopup(achievementId){
  const ach = ensureAchievementsState();
  if (!ach || !achievementId) return;
  ach.popupQueue.push({
    type: 'achievement_unlock',
    id: achievementId,
    ts: Date.now(),
  });
}

function processAchievementProgress(progressType, deltaCount){
  const type = typeof progressType === 'string' ? progressType : 'purchases';
  const rawDelta = typeof progressType === 'string' ? deltaCount : progressType;
  const count = Math.max(0, Math.floor(Number(rawDelta) || 0));
  if (count <= 0) return;
  let unlocked = [];
  if (AchievementsApi && AchievementsApi.addProgress) {
    unlocked = AchievementsApi.addProgress(state, type, rawDelta) || [];
  } else {
    const ach = ensureAchievementsState();
    if (type === 'merges') ach.totalMerges += count;
    else ach.totalPurchased += count;
  }
  for (let i = 0; i < unlocked.length; i++) queueAchievementPopup(unlocked[i]);
}

function clampDevInt(value){
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(value)));
}

function recalculateAchievementsAndQueuePopups(){
  if (!(AchievementsApi && AchievementsApi.recalculateUnlocks)) return [];
  const unlocked = AchievementsApi.recalculateUnlocks(state) || [];
  for (let i = 0; i < unlocked.length; i++) queueAchievementPopup(unlocked[i]);
  return unlocked;
}

function shouldBlockAchievementToastByPause(){
  const reasons = lastPauseReasons && typeof lastPauseReasons === 'object'
    ? lastPauseReasons
    : { menuOpen: false, tabInactive: false };
  return !!(reasons.menuOpen || reasons.tabInactive);
}

function toAchievementToastMessage(event){
  if (!event || event.type !== 'achievement_unlock' || typeof event.id !== 'string') return '';
  const def = getAchievementById(event.id);
  if (!def) return '';
  return t('achievementToastUnlocked', { name: t(def.titleKey) });
}

function applyAchievementUnlockFx(achievementId, nowMs){
  if (typeof achievementId !== 'string') return;
  const uiState = ensureAchievementUiState();
  const unlockFx = uiState.unlockFx;
  const untilMs = Math.max(0, Math.floor(nowMs + ACHIEVEMENT_UNLOCK_PULSE_MS));
  if (achievementId.indexOf('engineer_') === 0) {
    unlockFx.autoMergeUntilMs = Math.max(unlockFx.autoMergeUntilMs, untilMs);
  }
  if (achievementId.indexOf('creator_') === 0) {
    unlockFx.bulkBuyUntilMs = Math.max(unlockFx.bulkBuyUntilMs, untilMs);
  }
}

function updateAchievementToastState(){
  const ach = ensureAchievementsState();
  const uiState = ensureAchievementUiState();
  if (!ach || !uiState.toast) return;
  const queue = ach.popupQueue;
  const nowMs = Date.now();
  const blockedByPause = shouldBlockAchievementToastByPause();
  if (!blockedByPause && uiState.toast.active && nowMs >= uiState.toast.active.expiresAtMs) {
    uiState.toast.active = null;
  }
  if (!uiState.toast.active && !blockedByPause) {
    while (queue.length > 0) {
      const nextEvent = normalizeAchievementQueueEvent(queue.shift());
      if (!nextEvent) continue;
      const message = toAchievementToastMessage(nextEvent);
      if (!message) continue;
      uiState.toast.active = {
        type: nextEvent.type,
        id: nextEvent.id,
        message: message,
        expiresAtMs: nowMs + ACHIEVEMENT_TOAST_DURATION_MS,
      };
      applyAchievementUnlockFx(nextEvent.id, nowMs);
      break;
    }
  }
  if (!ui.achievementToast) return;
  if (uiState.toast.active && !blockedByPause) {
    ui.achievementToast.textContent = uiState.toast.active.message || '';
    ui.achievementToast.classList.remove('hidden');
    ui.achievementToast.setAttribute('aria-hidden', 'false');
  } else {
    ui.achievementToast.classList.add('hidden');
    ui.achievementToast.setAttribute('aria-hidden', 'true');
  }
}

function applyUnlockPulseState(nowMs){
  const uiState = ensureAchievementUiState();
  const unlockFx = uiState.unlockFx;
  if (ui.buyBulk) {
    const pulseBulk = Number.isFinite(unlockFx.bulkBuyUntilMs) && nowMs < unlockFx.bulkBuyUntilMs;
    ui.buyBulk.classList.toggle('unlockPulse', pulseBulk);
  }
  if (ui.autoMergeBtn) {
    const pulseAutoMerge = Number.isFinite(unlockFx.autoMergeUntilMs) && nowMs < unlockFx.autoMergeUntilMs;
    ui.autoMergeBtn.classList.toggle('unlockPulse', pulseAutoMerge);
  }
}

function mountAutoMergeButton(){
  if (!ui.autoMergeBtn || !autoMergeHudSlot.parent) return;
  if (ui.autoMergeBtn.parentElement === autoMergeHudSlot.parent) return;
  if (autoMergeHudSlot.nextSibling && autoMergeHudSlot.nextSibling.parentElement === autoMergeHudSlot.parent) {
    autoMergeHudSlot.parent.insertBefore(ui.autoMergeBtn, autoMergeHudSlot.nextSibling);
  } else {
    autoMergeHudSlot.parent.appendChild(ui.autoMergeBtn);
  }
}

function unmountAutoMergeButton(){
  if (!ui.autoMergeBtn) return;
  ui.autoMergeBtn.classList.add('hidden');
  ui.autoMergeBtn.disabled = true;
  if (ui.autoMergeBtn.parentElement) ui.autoMergeBtn.remove();
}

function debugUnlockAchievementAndClaim(achievementId){
  const ach = ensureAchievementsState();
  const def = getAchievementById(achievementId);
  if (!ach || !def) return false;
  ach.unlocked[def.id] = true;
  updateUI();
  return true;
}

function debugSetTotalMerges(rawValue){
  const ach = ensureAchievementsState();
  if (!ach) return { totalMerges: 0, unlockedNow: [] };
  ach.totalMerges = clampDevInt(Number(rawValue));
  const unlockedNow = recalculateAchievementsAndQueuePopups();
  updateUI();
  return {
    totalMerges: ach.totalMerges,
    unlockedNow: unlockedNow,
  };
}

function calculateAffordableBuyCount(limit){
  const Garage = window.Game && window.Game.Garage;
  const freeSlots = Garage && Garage.countFreeCells ? Garage.countFreeCells(state) : state.cells.filter(c => !c.tank).length;
  const maxAttempts = Math.max(0, Math.floor(Number(limit) || 0));
  if (freeSlots <= 0 || maxAttempts <= 0) return { count: 0, totalCost: 0 };

  const level = buyTankLevel();
  const mul = getBuyCostMul();
  let virtualPrice = ensureBuyPrice(level);
  let coins = state.coins;
  let totalCost = 0;
  let count = 0;
  const cap = Math.min(freeSlots, maxAttempts);

  for (let i = 0; i < cap; i++) {
    const cost = Math.max(1, Math.round(virtualPrice * mul));
    if (coins < cost) break;
    coins -= cost;
    totalCost += cost;
    count += 1;
    virtualPrice += Math.max(1, Math.ceil(virtualPrice * 0.001));
  }
  return { count, totalCost };
}

function getBulkBuyPlanByMode(mode){
  const Garage = window.Game && window.Game.Garage;
  const freeSlots = Garage && Garage.countFreeCells ? Garage.countFreeCells(state) : state.cells.filter(c => !c.tank).length;
  const resolvedMode = mode === 'buy2' || mode === 'buy5' || mode === 'buyMax' ? mode : 'none';
  if (resolvedMode === 'none') {
    return {
      mode: 'none',
      freeSlots: freeSlots,
      maxByTier: 0,
      maxAffordableByCoins: 0,
      x: 0,
      xDisplay: 2,
      count: 0,
      disabled: true,
      enabled: false,
      visible: false,
    };
  }

  const maxByTier = resolvedMode === 'buy2'
    ? 2
    : (resolvedMode === 'buy5' ? 5 : Math.max(0, freeSlots));
  const affordable = calculateAffordableBuyCount(maxByTier);
  const maxAffordableByCoins = affordable.count;
  const x = Math.min(maxByTier, freeSlots, maxAffordableByCoins);
  const xDisplay = Math.max(2, x);
  const disabled = x < 2;
  return {
    mode: resolvedMode,
    freeSlots: freeSlots,
    maxByTier: maxByTier,
    maxAffordableByCoins: maxAffordableByCoins,
    x: x,
    xDisplay: xDisplay,
    count: x,
    disabled: disabled,
    enabled: !disabled,
    visible: true,
  };
}

function performTankPurchaseOnce(){
  const level = buyTankLevel();
  const cost = buyTankCost(level);
  const Garage = window.Game && window.Game.Garage;
  const freeIdx = Garage ? Garage.findFreeCell(state) : (state.cells.find(c=>!c.tank)?.i ?? null);
  if (freeIdx == null || state.coins < cost) return false;
  const empty = state.cells[freeIdx];
  if (!empty || empty.tank || (state.crate && state.crate.cellIndex === empty.i)) return false;

  state.coins -= cost;
  empty.tank = makeTank(level, false);
  recordTankLevel(level);
  state.buyCounts[level] = (state.buyCounts[level] || 0) + 1;
  bumpBuyPrice(level);
  if (window.Game && window.Game.SupercomputerBuildTankFx && typeof window.Game.SupercomputerBuildTankFx.start === 'function') {
    window.Game.SupercomputerBuildTankFx.start(getTankPrintDurationSec());
  }
  popText(empty.x+empty.w/2, empty.y+empty.h/2, t('popTank'), '#7dffb2');
  if (window.Game && window.Game.Telemetry) window.Game.Telemetry.event('buyTank');
  if (window.Game && window.Game.TelemetryLogger) window.Game.TelemetryLogger.log('buyTank', { level: level });
  return true;
}

function tryBuyTank(){
  const bought = performTankPurchaseOnce();
  if (bought) processAchievementProgress('purchases', 1);
}

function buyBulkMode(){
  if (AchievementsApi && AchievementsApi.getBulkMode) return AchievementsApi.getBulkMode(state);
  return 'none';
}

function tryBuyBulk(){
  const mode = buyBulkMode();
  if (mode === 'none') return;
  const plan = getBulkBuyPlanByMode(mode);
  if (plan.disabled || plan.x <= 0) return;
  const countToBuy = plan.x;
  let purchased = 0;
  for (let i = 0; i < countToBuy; i++) {
    if (!performTankPurchaseOnce()) return;
    purchased += 1;
  }
  if (purchased === countToBuy) processAchievementProgress('purchases', purchased);
}

function resolveMergeResultCellIndex(fromIdx, toIdx, placeResult){
  if (placeResult !== 'hangar') return toIdx;
  if (state.cells[toIdx] && !(state.crate && state.crate.cellIndex === toIdx)) return toIdx;
  if (state.cells[fromIdx] && !(state.crate && state.crate.cellIndex === fromIdx)) return fromIdx;
  for (let i = 0; i < state.cells.length; i++) {
    const candidate = state.cells[i];
    if (!candidate || candidate.tank) continue;
    if (state.crate && state.crate.cellIndex === candidate.i) continue;
    return candidate.i;
  }
  return toIdx;
}

function resolveMergeFxPosition(context){
  const fxContext = context || {};
  if (Number.isFinite(fxContext.resultCellIndex)) {
    const cell = state.cells[fxContext.resultCellIndex];
    if (cell) {
      return {
        x: cell.x + cell.w / 2,
        y: cell.y + cell.h / 2,
      };
    }
  }

  const tankId = typeof fxContext.resultTankId === 'string' ? fxContext.resultTankId : null;
  if (tankId) {
    for (let i = 0; i < state.cells.length; i++) {
      const cell = state.cells[i];
      if (!cell || !cell.tank || cell.tank.id !== tankId) continue;
      return {
        x: cell.x + cell.w / 2,
        y: cell.y + cell.h / 2,
      };
    }
  }

  return { x: center.x, y: center.y };
}

function playMergeFxNow(context){
  const pos = resolveMergeFxPosition(context);
  burst(pos.x, pos.y, 18, 'rgba(125,255,178,.78)');
  state.impacts.push({ x: pos.x, y: pos.y, r: 0, maxR: 34, life: 0.24, max: 0.24, kind: 'he' });
  for (let i = 0; i < 6; i++) {
    state.particles.push({
      x: pos.x,
      y: pos.y,
      r: 2,
      color: 'rgba(125,255,178,.38)',
      life: 0.22,
      max: 0.22,
      vx: (Math.random() - 0.5) * 80,
      vy: (Math.random() - 0.5) * 80,
    });
  }
  const sfxId = context && typeof context.sfxId === 'string' && context.sfxId ? context.sfxId : 'levelUp';
  playSfx(sfxId);
}

function flushMergeFxQueue(){
  if (!mergeFxQueue.length) {
    mergeFxQueueTimer = null;
    return;
  }
  const context = mergeFxQueue.shift();
  playMergeFxNow(context);
  if (mergeFxQueue.length) {
    mergeFxQueueTimer = window.setTimeout(flushMergeFxQueue, MERGE_FX_GAP_MS);
  } else {
    mergeFxQueueTimer = null;
  }
}

function playMergeFx(context){
  mergeFxQueue.push(context || null);
  if (mergeFxQueueTimer != null) return;
  flushMergeFxQueue();
}

function clearMergeFxQueue(){
  mergeFxQueue = [];
  if (mergeFxQueueTimer != null) {
    window.clearTimeout(mergeFxQueueTimer);
    mergeFxQueueTimer = null;
  }
}

function performMerge(fromIdx, toIdx, opts){
  const options = opts || {};
  const placeResult = options.placeResult === 'hangar' ? 'hangar' : 'original';
  if (fromIdx === toIdx) return false;
  const a = state.cells[fromIdx];
  const b = state.cells[toIdx];
  if (!a || !b || !a.tank || !b.tank) return false;
  if (isTankPrinting(a.tank) || isTankPrinting(b.tank)) return false;
  if (a.tank.level !== b.tank.level) return false;
  if (a.tank.level >= MAX_TANK_LEVEL) return false;
  const fromLevel = a.tank.level;
  const lvl = fromLevel + 1;
  if (lvl > MAX_TANK_LEVEL) return false;

  const resultCellIndex = resolveMergeResultCellIndex(fromIdx, toIdx, placeResult);
  const resultCell = state.cells[resultCellIndex];
  if (!resultCell) return false;
  if (resultCellIndex !== fromIdx && resultCellIndex !== toIdx && resultCell.tank) return false;

  resultCell.tank = makeTank(lvl, false);
  a.tank = null;
  if (resultCellIndex !== toIdx) {
    b.tank = null;
  }

  const oldMaxLevel = Math.max(0, Number.isFinite(state.maxTankLevelAchieved) ? state.maxTankLevelAchieved : 0);

  processAchievementProgress('merges', 1);
  recordTankLevel(lvl);
  const newMaxLevel = Math.max(0, Number.isFinite(state.maxTankLevelAchieved) ? state.maxTankLevelAchieved : 0);
  if (window.Game && window.Game.Telemetry) window.Game.Telemetry.event('merge');
  if (window.Game && window.Game.TelemetryLogger) window.Game.TelemetryLogger.log('merge', { fromLevel: fromLevel, toLevel: lvl });
  if (window.Game && window.Game.Funnel) window.Game.Funnel.trackStep('first_merge', { level: lvl });

  // Show merge popup for first time achieving this level
  let mergePopupShown = false;
  if (window.Game && window.Game.MergePopup) {
    mergePopupShown = !!window.Game.MergePopup.show(lvl);
  }

  const isNewMaxLevelMergePopup = newMaxLevel > oldMaxLevel && mergePopupShown;
  playMergeFx({
    resultCellIndex: resultCellIndex,
    resultTankId: resultCell.tank && resultCell.tank.id,
    sfxId: isNewMaxLevelMergePopup ? 'mergeNewMaxLevel' : 'levelUp',
  });

  popText(resultCell.x + resultCell.w/2, resultCell.y + resultCell.h/2 - 16, t('levelUp', {level: lvl}), '#eaf1ff');
  return true;
}

function findTankCellIndex(tankRef){
  if (!tankRef || !Array.isArray(state.cells)) return null;
  const id = typeof tankRef.id === 'string' ? tankRef.id : null;
  for (let i = 0; i < state.cells.length; i++) {
    const cell = state.cells[i];
    if (!cell || !cell.tank) continue;
    if (cell.tank === tankRef) return cell.i;
    if (id && cell.tank.id === id) return cell.i;
  }
  return null;
}

function mergeAutoPair(leftTank, rightTank){
  if (isTankPrinting(leftTank) || isTankPrinting(rightTank)) return false;
  const fromIdx = findTankCellIndex(leftTank);
  const toIdx = findTankCellIndex(rightTank);
  if (fromIdx == null || toIdx == null || fromIdx === toIdx) return false;
  const fromCell = state.cells[fromIdx];
  const toCell = state.cells[toIdx];
  if (!fromCell || !toCell || !fromCell.tank || !toCell.tank) return false;
  if (fromCell.tank.level !== toCell.tank.level) return false;
  return performMerge(fromIdx, toIdx, { placeResult: 'hangar' });
}

if (AutoMergeApi && typeof AutoMergeApi.setMergePairExecutor === 'function') {
  AutoMergeApi.setMergePairExecutor(mergeAutoPair);
}
if (AutoMergeApi && typeof AutoMergeApi.setTankEligibilityPredicate === 'function') {
  AutoMergeApi.setTankEligibilityPredicate((tank) => !isTankPrinting(tank));
}

// ---------- Economy / boost ----------
function incomeMult(){
  return (nowSec() < state.boostUntil) ? BAL.boostMult : 1;
}

function speedMult(){
  return (nowSec() < state.boostUntil) ? BAL.boostMult : 1;
}

function coinsForShot(level){
  if (level <= 0) {
    console.warn('[coinsForShot] Invalid level:', level);
    return 0;
  }
  const MAX_COIN_PER_SHOT = Math.pow(2, 20);
  const mods = getMods();
  const coinsShotMul = Number.isFinite(mods.coinsShotMul) ? Math.max(0, mods.coinsShotMul) : Math.max(0, mods.coinsMul);
  const base = Math.min(Math.pow(2, level - 1), MAX_COIN_PER_SHOT);
  const activeMul = nowSec() < state.activeEffects.economyUntil ? 1.6 : 1;
  return base * incomeMult() * coinsShotMul * activeMul;
}

function coinsForKill(level, rewardMul=1){
  const mods = getMods();
  const coinsKillMul = Number.isFinite(mods.coinsKillMul) ? Math.max(0, mods.coinsKillMul) : Math.max(0, mods.coinsMul);
  const base = BAL.coinsPerKillBase + BAL.coinsPerKillLevelMul * Math.max(0, level - 1);
  const activeMul = nowSec() < state.activeEffects.economyUntil ? 1.6 : 1;
  return base * rewardMul * incomeMult() * coinsKillMul * activeMul;
}

function tankStats(level){
  const mods = getMods();
  const balDmgMul = getTankBalanceMul(level, 'attackDamageMul');
  const balAtkSpeedMul = getTankBalanceMul(level, 'attackSpeedMul');
  const fallbackBaseDamage = BAL.dmgBase * Math.pow(BAL.dmgMultPerLevel, level-1);
  const bulletInfo = getBulletConfigForTankLevel(level);
  const tankBaseDamage = bulletInfo.tankCfg && bulletInfo.tankCfg.stats && Number.isFinite(bulletInfo.tankCfg.stats.baseDamage)
    ? bulletInfo.tankCfg.stats.baseDamage
    : fallbackBaseDamage;
  const bulletAddDamage = bulletInfo.bulletCfg && Number.isFinite(bulletInfo.bulletCfg.addDamage)
    ? bulletInfo.bulletCfg.addDamage
    : 0;
  const shotBaseDamage = Math.max(0, tankBaseDamage + bulletAddDamage);
  const fr = BAL.fireRateBase + BAL.fireRateAddPerLevel*(level-1);
  const Combat = window.Game && window.Game.Combat;
  const range = Combat ? Combat.getShootRange({ level }, state) : (BAL.rangeBase + BAL.rangePerLevel*(level-1));
  const prof = projectileProfile(level, bulletInfo.bulletCfg);
  // Tie AOE to profile but also allow slight growth with level.
  const aoe = clamp(prof.aoeBase + prof.aoePerLevel*(level-1), prof.aoeMin, prof.aoeMax);
  const aoeMulFromBullet = bulletInfo.bulletCfg && Number.isFinite(bulletInfo.bulletCfg.aoe)
    ? Math.max(0, bulletInfo.bulletCfg.aoe)
    : 1;
  const activeAttack = nowSec() < state.activeEffects.attackUntil ? 1.5 : 1;
  const activeSpeed = nowSec() < state.activeEffects.speedUntil ? 1.35 : 1;
  const finalDamageMul = mods.dmgMul * activeAttack * balDmgMul;
  return {
    dmg: shotBaseDamage * finalDamageMul,
    fr: fr * mods.fireRateMul * activeSpeed * balAtkSpeedMul,
    range: range * mods.rangeMul,
    aoe: aoe * aoeMulFromBullet * mods.aoeMul * (activeAttack > 1 ? 1.2 : 1),
    prof,
    shotBaseDamage,
    bulletCfg: bulletInfo.bulletCfg,
    bulletId: bulletInfo.bulletId,
    bulletLevel: bulletInfo.bulletLevel,
  };
}

function xpNeededForLevel(level){
  if (ProgressionApi && ProgressionApi.xpNeededForLevel) {
    return ProgressionApi.xpNeededForLevel(level);
  }
  if (Math.floor(Number.isFinite(level) ? level : 0) <= 0) return 50;
  const growth = 3 ** (level - 1);
  const correction = level >= 4 ? (10 / 9) : 1;
  const decadeBoost = 2 ** Math.floor((level - 1) / 10);
  return Math.round(500 * growth * correction * decadeBoost);
}

function levelGoldReward(level){
  if (ProgressionApi && ProgressionApi.levelGoldReward) {
    return ProgressionApi.levelGoldReward(level, BAL);
  }
  return Math.max(0, Math.round(BAL.levelGoldBase + BAL.levelGoldPerLevel * Math.max(0, level - 1)));
}

function onComputerLevelChanged(payload){
  const sc = payload && payload.computer ? payload.computer : getComputerState();
  if (!sc) return;
  const oldMaxHp = payload && Number.isFinite(payload.oldMaxHp) ? payload.oldMaxHp : sc.maxHp;
  if (supercomputerController && supercomputerController.onLevelChanged) {
    supercomputerController.onLevelChanged(sc, SupercomputerSprites.config, oldMaxHp);
    return;
  }
  const stats = SupercomputerApi && SupercomputerApi.resolveStatsForLevel
    ? SupercomputerApi.resolveStatsForLevel(SupercomputerSprites.config, sc.computerLevel)
    : {
        maxHp: Math.max(1, Math.round(800 + 120 * Math.max(0, sc.computerLevel - 1))),
        armorFlat: Math.max(0, Math.round(2 + Math.max(0, sc.computerLevel - 1))),
      };
  const hpRatio = clamp((Number.isFinite(sc.hp) ? sc.hp : 0) / Math.max(1, oldMaxHp), 0, 1);
  sc.maxHp = stats.maxHp;
  sc.armorFlat = stats.armorFlat;
  sc.hp = clamp(Math.round(sc.maxHp * hpRatio), 0, sc.maxHp);
}

function getLevelFlowController(){
  if (!(LevelFlowApi && typeof LevelFlowApi.createLevelFlow === 'function')) return null;
  return LevelFlowApi.createLevelFlow({
    state,
    ui,
    BAL,
    t,
    UIModals,
    a11yOpen,
    a11yClose,
    nowSec,
    saveProgress,
    updateUI,
    refreshTanksPowerTier,
    playSfx,
    showCenterNotification,
    xpNeededForLevel,
    levelGoldReward,
    onComputerLevelChanged,
    onTalentPointsGained: function () {
      if (!isTalentsV2Ready()) return;
      const api = getTalentsV2Api();
      if (!api || typeof api.setFreePoints !== 'function' || !state.player) return;
      const nextPoints = state.player.talentsV2 && Number.isFinite(state.player.talentsV2.freePoints)
        ? Math.max(0, Math.floor(state.player.talentsV2.freePoints))
        : Math.max(0, Math.floor(state.player.freeTalentPointsV2 || 0));
      api.setFreePoints(nextPoints);
      syncPlayerTalentsV2FromApi();
    },
    windowObj: window,
  });
}

function updateLevelModal(){
  const lf = getLevelFlowController();
  if (lf && lf.updateLevelModal) return lf.updateLevelModal();
}

function openLevelModal(){
  const lf = getLevelFlowController();
  if (lf && lf.openLevelModal) return lf.openLevelModal();
}

function closeLevelModal(){
  const lf = getLevelFlowController();
  if (lf && lf.closeLevelModal) return lf.closeLevelModal();
}

function queueLevelReward(level, points, gold){
  const lf = getLevelFlowController();
  if (lf && lf.queueLevelReward) return lf.queueLevelReward(level, points, gold);
}

function acceptLevelReward(){
  const lf = getLevelFlowController();
  if (lf && lf.acceptLevelReward) return lf.acceptLevelReward();
}

function grantXP(amount){
  const lf = getLevelFlowController();
  if (lf && lf.grantXP) return lf.grantXP(amount);
}

function triggerLevelUpVfx(level){
  const lf = getLevelFlowController();
  if (lf && lf.triggerLevelUpVfx) return lf.triggerLevelUpVfx(level);
}

function checkPowerMomentEvents(level){
  const lf = getLevelFlowController();
  if (lf && lf.checkPowerMomentEvents) return lf.checkPowerMomentEvents(level);
}

let centerNotificationEl = null;
let centerNotificationHideAt = 0;
function showCenterNotification(text){
  if (!centerNotificationEl){
    centerNotificationEl = document.createElement('div');
    centerNotificationEl.className = 'centerNotification';
    centerNotificationEl.setAttribute('aria-live', 'polite');
    document.body.appendChild(centerNotificationEl);
  }
  centerNotificationEl.textContent = text;
  centerNotificationEl.classList.remove('hidden');
  centerNotificationHideAt = nowSec() + 3;
}
function updateCenterNotification(){
  if (!centerNotificationEl || !centerNotificationEl.textContent) return;
  if (nowSec() >= centerNotificationHideAt){
    centerNotificationEl.classList.add('hidden');
    centerNotificationEl.textContent = '';
  }
}

const TALENTS_V2_BRANCH_IDS = ['offense', 'defense', 'economy'];
/* V1 layout stub — kept as fallback for V2 node layout resolution */
const TALENT_LAYOUT = [];
const TALENTS_V2_ACTIVE_ID_BY_BRANCH = {
  offense: 'off_active_barrage',
  defense: 'def_active_dome',
  economy: 'eco_active_golden_hour',
};

function getTalentsV2Api(){
  return window.Game && window.Game.TalentsV2 ? window.Game.TalentsV2 : null;
}

function isTalentsV2Ready(){
  const api = getTalentsV2Api();
  if (!api || typeof api.getTreeMeta !== 'function') return false;
  return !!api.getTreeMeta();
}

function getTalentV2BranchIdByIndex(index){
  return TALENTS_V2_BRANCH_IDS[index] || TALENTS_V2_BRANCH_IDS[0];
}

function getTalentV2BranchIndexById(branchId){
  const idx = TALENTS_V2_BRANCH_IDS.indexOf(branchId);
  return idx >= 0 ? idx : 0;
}

function getTalentV2BranchLabelById(branchId){
  const key = `talentBranch_${branchId}`;
  const value = t(key);
  if (value && value !== key) return value;
  return branchId;
}

function getTalentV2ActiveTalentIdByBranch(branchId){
  const fallbackId = TALENTS_V2_ACTIVE_ID_BY_BRANCH[branchId] || '';
  const api = getTalentsV2Api();
  if (!api || typeof api.getTalentsByBranch !== 'function') return fallbackId;
  const nodes = api.getTalentsByBranch(branchId);
  if (!Array.isArray(nodes) || !nodes.length) return fallbackId;
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i] && nodes[i].id === fallbackId) return fallbackId;
  }
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i];
    if (!node || typeof node.id !== 'string') continue;
    if (node.id.indexOf('_active_') >= 0) return node.id;
  }
  const last = nodes[nodes.length - 1];
  return last && typeof last.id === 'string' ? last.id : fallbackId;
}

function getTalentV2ActiveIconByBranch(branchId){
  const fallbackByBranch = {
    offense: 'activeOff',
    defense: 'activeDef',
    economy: 'activeEco',
  };
  const fallback = fallbackByBranch[branchId] || 'activeOff';
  const api = getTalentsV2Api();
  const talentId = getTalentV2ActiveTalentIdByBranch(branchId);
  if (!api || !talentId || typeof api.getTalentUi !== 'function') return fallback;
  const ui = api.getTalentUi(talentId);
  if (!ui || typeof ui.icon !== 'string' || !ui.icon.trim()) return fallback;
  return ui.icon.trim();
}

function normalizeTalentTimerTargetMs(value, nowMs, baseDurationMs){
  const now = Number.isFinite(nowMs) ? nowMs : Date.now();
  let target = Number(value);
  if (!Number.isFinite(target) || target <= 0) return 0;
  if (target < 1e11) target *= 1000;
  const duration = Number.isFinite(baseDurationMs) ? Math.max(0, baseDurationMs) : 0;
  if (duration > 0) {
    const maxReasonableTarget = now + (duration * 4);
    if (target > maxReasonableTarget) {
      return now + duration;
    }
  }
  return target;
}

/* Talent icon helpers (previously in talentDefs.js, still used by V2) */
function sanitizeTalentIconBaseName(name){
  return String(name || '').trim()
    .replace(/[:\\/]/g, ' ').replace(/[<>"|?*]/g, '')
    .replace(/\s+/g, '_').replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '').slice(0, 80) || 'talent';
}
function talentIconPath(name){
  return `assets/Telent_icon/${sanitizeTalentIconBaseName(name)}.png`;
}

function getTalentV2ActiveIconUrlByBranch(branchId){
  const iconKey = getTalentV2ActiveIconByBranch(branchId);
  return `assets/ui/icons/talents/${iconKey}.png`;
}

function resolveTalentCantBuyReasonText(canResult){
  const reason = canResult && canResult.reason;
  if (reason === 'tier_locked') return t('talentCantBuy_tierLocked');
  if (reason === 'no_points') return t('talentCantBuy_noPoints');
  if (reason === 'max_rank') return t('talentCantBuy_maxRank');
  if (reason === 'requires') {
    const reqs = Array.isArray(canResult.missingRequires) ? canResult.missingRequires : [];
    if (!reqs.length) return t('talentCantBuy_requires');
    const api = getTalentsV2Api();
    const labels = reqs.map((req) => {
      const ui = api && typeof api.getTalentUi === 'function' ? api.getTalentUi(req.id) : null;
      const key = ui && ui.nameKey ? ui.nameKey : req.id;
      const name = t(key);
      const needRank = Number.isFinite(req.needRank) ? Math.max(1, Math.floor(req.needRank)) : 1;
      return `${name}${needRank > 1 ? ` (${needRank})` : ''}`;
    });
    return `${t('talentCantBuy_requires')}: ${labels.join(', ')}`;
  }
  return t('ui.toast.unavailable');
}
function adaptTalentsV2ModsToLegacy(v2Mods){
  const src = v2Mods && typeof v2Mods === 'object' ? v2Mods : {};
  const out = {
    dmgMul: 1, rangeMul: 1, aoeMul: 1, fireRateMul: 1,
    doubleShotChance: 0, dotChance: 0, dotDpsMul: 1,
    orbitSpeedMul: 1, buyCostMul: 1, coinsMul: 1,
    xpMul: 1, activeCooldownMul: 1, activeBranches: new Set(),
  };
  const asMul = (value, fallback) => Number.isFinite(value) ? Math.max(0, value) : fallback;

  out.dmgMul = asMul(src.damageMul, out.dmgMul);
  out.rangeMul = asMul(src.rangeMul, out.rangeMul);
  out.aoeMul = asMul(src.aoeMul, out.aoeMul);
  out.fireRateMul = asMul(src.fireRateMul, out.fireRateMul);
  out.orbitSpeedMul = asMul(src.orbitSpeedMul, out.orbitSpeedMul);
  out.buyCostMul = asMul(src.tankBuyCostMul, out.buyCostMul);
  out.tankBuyCostMul = out.buyCostMul;
  out.coinsKillMul = asMul(src.coinsKillMul, 1);
  out.coinsShotMul = asMul(src.coinsShotMul, 1);
  out.coinsMul = (out.coinsKillMul + out.coinsShotMul) * 0.5;
  out.xpMul = asMul(src.xpMul, out.xpMul);
  out.doubleShotChance = clamp(Number.isFinite(src.doubleShotChance) ? src.doubleShotChance : out.doubleShotChance, 0, 0.9);
  out.activeBranches = new Set();
  if (src.offenseActive) out.activeBranches.add(0);
  if (src.defenseActive) out.activeBranches.add(1);
  if (src.economyActive) out.activeBranches.add(2);

  return out;
}

function getMods(){
  if (isTalentsV2Ready()) {
    const api = getTalentsV2Api();
    if (api && typeof api.getMods === 'function') {
      return adaptTalentsV2ModsToLegacy(api.getMods());
    }
  }
  /* V2 not ready yet — return default neutral mods */
  return {
    dmgMul: 1, rangeMul: 1, aoeMul: 1, fireRateMul: 1,
    doubleShotChance: 0, dotChance: 0, dotDpsMul: 1,
    orbitSpeedMul: 1, buyCostMul: 1, coinsMul: 1,
    xpMul: 1, activeCooldownMul: 1, activeBranches: new Set(),
  };
}

function resetAllTalents(){
  if (!isTalentsV2Ready()) return;
  const api = getTalentsV2Api();
  if (!api) return;
  if (typeof api.resetPending === 'function') api.resetPending();
  if (typeof api.respec === 'function') api.respec();
  clearTalentRuntimeEffectsV2();
  syncPlayerTalentsV2FromApi();
  saveProgress();
  updateTalentUI();
}

function applyTalentSelections(){
  if (!isTalentsV2Ready()) return;
  const api = getTalentsV2Api();
  if (!api || typeof api.applyPending !== 'function') return;
  const result = api.applyPending();
  if (!result || !result.ok) return;
  playSfx('applyTalents');
  syncPlayerTalentsV2FromApi();
  saveProgress();
  updateTalentUI();
  updateUI();
}

function canUseActive(branch){
  if (!isTalentsV2Ready()) return false;
  const api = getTalentsV2Api();
  if (!api || typeof api.getActiveState !== 'function') return false;
  const branchId = getTalentV2BranchIdByIndex(branch);
  const activeState = api.getActiveState(branchId, Date.now());
  return !!(activeState.unlocked && activeState.charges > 0);
}

function getFirstTrackTank(){
  for (let i = 0; i < state.cells.length; i++) {
    const cell = state.cells[i];
    if (cell && cell.tank && cell.tank.onTrack) return cell.tank;
  }
  return null;
}

function useActiveAbility(branch){
  if (!isTalentsV2Ready()) return;
  normalizeActiveEffectsTimestamps();
  const api = getTalentsV2Api();
  if (!api) return;
  const nowMs = Date.now();
  let result = { ok: false, reason: 'unavailable' };
  if (branch === 0 && typeof api.activateOffenseActive === 'function') {
    result = api.activateOffenseActive(nowMs, { tank: getFirstTrackTank() });
  } else if (branch === 1 && typeof api.activateDefenseActive === 'function') {
    result = api.activateDefenseActive(nowMs);
  } else if (branch === 2 && typeof api.activateEconomyActive === 'function') {
    result = api.activateEconomyActive(nowMs);
  }
  if (!result || !result.ok) {
    if (window.Game && window.Game.Toast && typeof window.Game.Toast.show === 'function') {
      window.Game.Toast.show(t('ui.toast.unavailable'), 1400);
    }
    updateUI();
    return;
  }
  const nowSecValue = nowMs / 1000;
  let untilSec = 0;
  const branchId = getTalentV2BranchIdByIndex(branch);
  const stateAfterUse = typeof api.getActiveState === 'function'
    ? api.getActiveState(branchId, nowMs)
    : null;
  const durationMs = Number(stateAfterUse && stateAfterUse.durationMs);
  const durationSec = Number.isFinite(durationMs) && durationMs > 0
    ? (durationMs / 1000)
    : 0;
  if (durationSec > 0) {
    untilSec = nowSecValue + durationSec;
  } else if (Number.isFinite(result.untilMs) && result.untilMs > 0) {
    untilSec = result.untilMs > 1e11 ? (result.untilMs / 1000) : result.untilMs;
  }
  if (untilSec > 0 && state.activeEffects && typeof state.activeEffects === 'object') {
    if (branch === 0) state.activeEffects.attackUntil = Math.max(state.activeEffects.attackUntil || 0, untilSec);
    else if (branch === 1) state.activeEffects.speedUntil = Math.max(state.activeEffects.speedUntil || 0, untilSec);
    else if (branch === 2) state.activeEffects.economyUntil = Math.max(state.activeEffects.economyUntil || 0, untilSec);
  }
  updateUI();
}

function activateTimedBoost(boostId, secondsTotal){
  const total = Number.isFinite(secondsTotal) ? Math.max(0, secondsTotal) : 0;
  const until = nowSec() + total;
  if (boostId === 'speedBoost') {
    state.boostUntil = until;
    return;
  }
  if (!state.activeEffects || typeof state.activeEffects !== 'object') return;
  if (boostId === 'attackBoost') {
    state.activeEffects.attackUntil = until;
    return;
  }
  if (boostId === 'defenseBoost') {
    state.activeEffects.speedUntil = until;
    return;
  }
  if (boostId === 'economyBoost') {
    state.activeEffects.economyUntil = until;
  }
}

const TALENT_OPEN_ANIM_MS = 180;
let talentCloseRequestHandler = null;

function requestCloseTalents(){
  if (typeof talentCloseRequestHandler === 'function') {
    talentCloseRequestHandler();
    return;
  }
  closeTalents();
}

function openTalents(options){
  const opts = options || {};
  talentCloseRequestHandler = typeof opts.onClose === 'function' ? opts.onClose : closeTalents;
  state.ui.talentsOpen = true;
  ensureTalentUI();
  updateTalentUI();
  const overlay = document.getElementById('talentOverlay');
  if (!overlay) return;
  const modal = overlay.querySelector('.modal');
  overlay.classList.remove('hidden');
  const initialFocus = isTalentsV2Ready()
    ? (overlay.querySelector('#talentResetAll') || overlay.querySelector('.modalClose'))
    : overlay.querySelector('#talentApply');
  a11yOpen(overlay, { initialFocus, onClose: talentCloseRequestHandler });
  if (modal){
    modal.style.transform = 'scale(0.92)';
    modal.style.opacity = '0';
    modal.offsetHeight;
    modal.style.transition = `transform ${TALENT_OPEN_ANIM_MS}ms ease-out, opacity ${TALENT_OPEN_ANIM_MS}ms ease-out`;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        modal.style.transform = 'scale(1)';
        modal.style.opacity = '1';
        updateTalentUI();
        if (isTalentsV2Ready()) {
          TALENT_UI_V2_RENDER_CACHE.edgesLayoutKey = '';
          requestAnimationFrame(() => {
            if (state.ui.talentsOpen) updateTalentUI();
          });
        }
      });
    });
  }
}

function closeTalents(){
  state.ui.talentsOpen = false;
  TALENT_UI_V2_RENDER_CACHE.edgesLayoutKey = '';
  const overlay = document.getElementById('talentOverlay');
  if (overlay){
    const modal = overlay.querySelector('.modal');
    if (modal){
      modal.style.transition = '';
      modal.style.transform = '';
      modal.style.opacity = '';
    }
    overlay.classList.add('hidden');
    a11yClose(overlay);
  }
  talentCloseRequestHandler = null;
}

/* V1 initTalentDefs stub — no-op, V1 talents removed */
function initTalentDefs() {}

function ensureTalentState(){
  const p = state.player;
  if (!Array.isArray(p.talentsApplied)) {
    p.talentsApplied = [];
  }
  if (!Array.isArray(p.activeCooldowns) || p.activeCooldowns.length !== 3){
    p.activeCooldowns = [0, 0, 0];
  }
  ensureCannonUpgradesAppliedState();
  p.modsDirty = true;
}

async function initTalentsV2Runtime(){
  const talentsV2Api = window.Game && window.Game.TalentsV2;
  if (!talentsV2Api || typeof talentsV2Api.init !== 'function') return null;

  const result = await talentsV2Api.init({
    loadSaveFn: function () {
      return {
        player: state.player,
      };
    },
    saveFn: function (payload) {
      const nextPayload = payload && typeof payload === 'object' ? payload : null;
      const nextTalents = nextPayload && nextPayload.talentsV2 && typeof nextPayload.talentsV2 === 'object'
        ? nextPayload.talentsV2
        : { ranksById: {}, freePoints: 0 };
      state.player.talentsVersion = Number.isFinite(nextPayload && nextPayload.talentsVersion)
        ? Math.max(2, Math.floor(nextPayload.talentsVersion))
        : 2;
      state.player.talentsV2 = {
        ranksById: nextTalents.ranksById && typeof nextTalents.ranksById === 'object'
          ? { ...nextTalents.ranksById }
          : {},
        freePoints: Number.isFinite(nextTalents.freePoints)
          ? Math.max(0, Math.floor(nextTalents.freePoints))
          : 0,
      };
      state.player.freeTalentPointsV2 = state.player.talentsV2.freePoints;
      state.player.modsDirty = true;
      saveProgress();
    },
    assetLoader: function (path) {
      return fetch(path, { cache: 'no-store' }).then(function (response) {
        if (!response.ok) throw new Error('[TalentsV2] HTTP ' + response.status + ' for ' + path);
        return response.json();
      });
    },
    nowMsFn: function () {
      return Date.now();
    },
  });

  if (!state.player.talentsV2 || typeof state.player.talentsV2 !== 'object') {
    state.player.talentsV2 = {
      ranksById: {},
      freePoints: 0,
    };
  }
  state.player.talentsV2.ranksById = typeof talentsV2Api.getRanks === 'function'
    ? talentsV2Api.getRanks()
    : (state.player.talentsV2.ranksById || {});
  state.player.talentsV2.freePoints = typeof talentsV2Api.getFreePoints === 'function'
    ? Math.max(0, Math.floor(talentsV2Api.getFreePoints()))
    : Math.max(0, Math.floor(state.player.talentsV2.freePoints || 0));
  if (!Number.isFinite(state.player.talentsVersion)) state.player.talentsVersion = 2;
  state.player.freeTalentPointsV2 = state.player.talentsV2.freePoints;

  return result;
}

function saveProgress(){
  if (window.Game && window.Game.Storage) {
    window.Game.Storage.saveGame(state, meta);
    return;
  }
  try{
    const p = state.player;
    const sc = getComputerState();
    localStorage.setItem('progress', JSON.stringify({
      computerLevel: sc.computerLevel,
      xp: sc.xp,
      xpToNext: sc.xpToNext,
      maxLevel: sc.maxLevel,
      supercomputer: sc,
      talentPoints: p.talentPoints,
      talentsApplied: p.talentsApplied,
      talentsVersion: Number.isFinite(p.talentsVersion) ? Math.max(2, Math.floor(p.talentsVersion)) : 2,
      talentsV2: p.talentsV2 && typeof p.talentsV2 === 'object'
        ? {
            ranksById: p.talentsV2.ranksById && typeof p.talentsV2.ranksById === 'object' ? { ...p.talentsV2.ranksById } : {},
            freePoints: Number.isFinite(p.talentsV2.freePoints) ? Math.max(0, Math.floor(p.talentsV2.freePoints)) : 0,
          }
        : { ranksById: {}, freePoints: 0 },
      freeTalentPointsV2: Number.isFinite(p.freeTalentPointsV2) ? Math.max(0, Math.floor(p.freeTalentPointsV2)) : 0,
      cannonUpgradesApplied: ensureCannonUpgradesAppliedState(),
      dronUpgradesApplied: ensureDronUpgradesAppliedState(),
      fenceUpgradesApplied: ensureFenceUpgradesAppliedState(),
      eventShown40: sc.eventShown40,
      eventShown50: sc.eventShown50,
      eventShown60: sc.eventShown60,
      buyCounts: state.buyCounts,
      buyPrices: state.buyPrices,
      achievements: state.achievements,
      totalDamageDealtRaw: ensureDamageProgressState(),
      zombieWaveAtkMult: Number.isFinite(state.zombieWaveAtkMult) ? Math.max(0, state.zombieWaveAtkMult) : 1,
      damagePointsSpent: ensureDamagePointsSpentState(),
      fenceLevel: Number.isFinite(state.fenceLevel) ? Math.max(1, Math.floor(state.fenceLevel)) : 1,
      tutorial: state.tutorial,
      drones: Array.isArray(state.drones) ? state.drones : [],
      playerChips: Array.isArray(state.playerChips) ? state.playerChips : [],
      playerFragments: (window.Game && window.Game.HangarChipsUI && typeof window.Game.HangarChipsUI.getPlayerFragments === 'function') ? window.Game.HangarChipsUI.getPlayerFragments() : [],
      techStudying: (window.Game && window.Game.HangarChipsUI && typeof window.Game.HangarChipsUI.getTechStudying === 'function') ? window.Game.HangarChipsUI.getTechStudying() : null,
    }));
  }catch(e){}
}

function getSavedProgress(){
  if (window.Game && window.Game.Storage) {
    const loaded = window.Game.Storage.loadGame();
    if (loaded && loaded.legacyProgress) return loaded.legacyProgress;
    if (loaded && loaded.state) return loaded.state;
    return null;
  }
  try{
    const raw = localStorage.getItem('progress');
    if (raw) return JSON.parse(raw);
  }catch(e){}
  return null;
}

function restoreFullState(saved){
  if (!saved || !Array.isArray(saved.cells)) return;
  const forceFenceRuntimeResetOnLoad = !!saved.forceFenceRuntimeResetOnLoad;
  ensureAchievementsState();
  ensureMapSeedsState();
  ensureDamageProgressState();
  state.coins = saved.coins != null ? saved.coins : state.coins;
  state.kills = saved.kills != null ? saved.kills : state.kills;
  state.totalDamageDealtRaw = normalizeTotalDamageDealtRaw(saved.totalDamageDealtRaw);
  state.zombieWaveAtkMult = Number.isFinite(saved.zombieWaveAtkMult) ? Math.max(0, saved.zombieWaveAtkMult) : 1;
  state.damagePointsSpent = normalizeDamagePointsSpent(saved.damagePointsSpent);
  ensurePlayerDamagePointsState();
  state.fenceLevel = Number.isFinite(saved.fenceLevel) ? Math.max(1, Math.floor(saved.fenceLevel)) : 1;
  if (saved.supercomputer && typeof saved.supercomputer === 'object') {
    var _scCurrent = getComputerState();
    var _scPrevX = _scCurrent.x;
    var _scPrevY = _scCurrent.y;
    Object.assign(_scCurrent, saved.supercomputer);
    // Если в payload координаты нулевые/невалидные (pre-retry payload использует createInitialState как базу),
    // восстанавливаем предыдущие валидные координаты чтобы избежать телепорта в (0,0).
    if (!(saved.supercomputer.x > 0) && _scPrevX > 0) _scCurrent.x = _scPrevX;
    if (!(saved.supercomputer.y > 0) && _scPrevY > 0) _scCurrent.y = _scPrevY;
  }
  if (saved.player) Object.assign(state.player, saved.player);
  ensureCannonUpgradesAppliedState();
  if (!saved.supercomputer) {
    const sc = getComputerState();
    if (Number.isFinite(saved.computerLevel)) sc.computerLevel = Math.max(0, Math.floor(saved.computerLevel));
    else if (saved.player && Number.isFinite(saved.player.level)) sc.computerLevel = Math.max(0, Math.floor(saved.player.level));
    if (Number.isFinite(saved.xp)) sc.xp = Math.max(0, Math.floor(saved.xp));
    else if (saved.player && Number.isFinite(saved.player.xp)) sc.xp = Math.max(0, Math.floor(saved.player.xp));
    if (Number.isFinite(saved.xpToNext)) sc.xpToNext = Math.max(1, Math.floor(saved.xpToNext));
    else if (saved.player && Number.isFinite(saved.player.xpToNext)) sc.xpToNext = Math.max(1, Math.floor(saved.player.xpToNext));
    if (Number.isFinite(saved.maxLevel)) sc.maxLevel = Math.max(1, Math.floor(saved.maxLevel));
    else if (saved.player && Number.isFinite(saved.player.maxLevel)) sc.maxLevel = Math.max(1, Math.floor(saved.player.maxLevel));
    sc.eventShown40 = !!(saved.eventShown40 || (saved.player && saved.player.eventShown40));
    sc.eventShown50 = !!(saved.eventShown50 || (saved.player && saved.player.eventShown50));
    sc.eventShown60 = !!(saved.eventShown60 || (saved.player && saved.player.eventShown60));
  }
  if (saved.buyCounts) state.buyCounts = saved.buyCounts;
  if (saved.buyPrices) state.buyPrices = saved.buyPrices;
  if (saved.maxTankLevelAchieved != null) state.maxTankLevelAchieved = saved.maxTankLevelAchieved;
  state.runtimeMaxTankLevelAchieved = Number.isFinite(state.maxTankLevelAchieved)
    ? Math.max(1, Math.floor(state.maxTankLevelAchieved))
    : 1;
  state.currentFenceTierApplied = Number.isFinite(state.fenceLevel)
    ? Math.max(1, Math.floor(state.fenceLevel))
    : 1;
  if (saved.boostUntil != null) state.boostUntil = saved.boostUntil;
  if (saved.activeEffects) state.activeEffects = { ...state.activeEffects, ...saved.activeEffects };
  normalizeActiveEffectsTimestamps();
  if (saved.achievements && typeof saved.achievements === 'object') {
    const ach = ensureAchievementsState();
    ach.unlocked = saved.achievements.unlocked && typeof saved.achievements.unlocked === 'object'
      ? { ...saved.achievements.unlocked }
      : ach.unlocked;
    ach.totalPurchased = Number.isFinite(saved.achievements.totalPurchased)
      ? Math.max(0, Math.floor(saved.achievements.totalPurchased))
      : ach.totalPurchased;
    ach.totalMerges = Number.isFinite(saved.achievements.totalMerges)
      ? Math.max(0, Math.floor(saved.achievements.totalMerges))
      : ach.totalMerges;
    ach.popupQueue = [];
  }
  if (saved.tutorial && typeof saved.tutorial === 'object') {
    state.tutorial = cloneJsonSafe(saved.tutorial, state.tutorial || null);
  }
  if (saved.fenceState && typeof saved.fenceState === 'object') {
    state.savedFenceState = {
      segmentsPerSide: Number.isFinite(saved.fenceState.segmentsPerSide) ? Math.max(1, Math.floor(saved.fenceState.segmentsPerSide)) : null,
      hpById: saved.fenceState.hpById && typeof saved.fenceState.hpById === 'object' ? { ...saved.fenceState.hpById } : {},
    };
  }
  if (DronesApi && typeof DronesApi.restoreSavedDrones === 'function') {
    DronesApi.restoreSavedDrones(state, saved.drones);
  } else {
    state.drones = Array.isArray(saved.drones) ? saved.drones : [];
  }
  /* Restore player chips for Workshop/Chip Upgrade */
  if (Array.isArray(saved.playerChips)) {
    state.playerChips = saved.playerChips;
    if (window.Game && window.Game.HangarChipsUI && typeof window.Game.HangarChipsUI.setPlayerChips === 'function') {
      window.Game.HangarChipsUI.setPlayerChips(saved.playerChips);
    }
  }
  /* Restore player fragments (chip shards) */
  if (Array.isArray(saved.playerFragments)) {
    if (window.Game && window.Game.HangarChipsUI && typeof window.Game.HangarChipsUI.setPlayerFragments === 'function') {
      window.Game.HangarChipsUI.setPlayerFragments(saved.playerFragments);
    }
  }
  /* Restore tech study state */
  if (saved.techStudying && typeof saved.techStudying === 'object' && window.Game && window.Game.HangarChipsUI && typeof window.Game.HangarChipsUI.setTechStudying === 'function') {
    window.Game.HangarChipsUI.setTechStudying(saved.techStudying);
  }
  /* Restore production line state */
  {
    const _PL = window.Game && window.Game.ProductionLine;
    if (_PL && typeof _PL.deserialize === 'function' && saved.productionLine) {
      _PL.deserialize(state, saved.productionLine);
    }
    if (_PL && typeof _PL.resetTracking === 'function') {
      _PL.resetTracking();
    }
  }
  const scRestored = getComputerState();
  if (supercomputerController && supercomputerController.syncLevel) {
    supercomputerController.syncLevel(scRestored, SupercomputerSprites.config);
  }
  if (saved.nextCrateAt != null) state.nextCrateAt = saved.nextCrateAt;
  if (saved.mapSeeds && typeof saved.mapSeeds === 'object') {
    if (saved.mapSeeds.stampsSeed !== undefined && saved.mapSeeds.stampsSeed !== null) {
      state.mapSeeds.stampsSeed = saved.mapSeeds.stampsSeed;
    }
    if (saved.mapSeeds.decorSeed !== undefined && saved.mapSeeds.decorSeed !== null) {
      state.mapSeeds.decorSeed = saved.mapSeeds.decorSeed;
    }
  }
  for (let i = 0; i < saved.cells.length; i++) {
    const sc = saved.cells[i];
    const cell = state.cells[sc.i];
    if (!cell) continue;
    if (sc.orbitPhase !== undefined) cell.orbitPhase = sc.orbitPhase;
    if (sc.tank) {
      cell.tank = makeTank(sc.tank.level, !!sc.tank.onTrack, { enableStamp: false });
      if (sc.tank.powerTier != null) cell.tank.powerTier = sc.tank.powerTier;
    } else cell.tank = null;
  }
  if (saved.crate && state.cells[saved.crate.cellIndex]) {
    const cell = state.cells[saved.crate.cellIndex];
    state.crate = {
      id: 'crate_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      x: cell.x + cell.w / 2,
      y: cell.y + cell.h / 2,
      targetY: cell.y + cell.h / 2,
      size: BAL.crateSize,
      pulse: 0,
      animState: 'idle',
      animTimeSec: 0,
      isHover: false,
      isAlive: true,
      rewardLevel: saved.crate.rewardLevel ?? 1,
      cellIndex: saved.crate.cellIndex,
      claiming: false,
    };
  } else state.crate = null;
  refreshTanksPowerTier();
  ensureDronUpgradesAppliedState();
  ensureFenceUpgradesAppliedState();
  ensureFenceTierRuntimeState(state);
  syncFenceTierWithMaxTankLevel(state, { force: true });
  if (forceFenceRuntimeResetOnLoad) {
    state.savedFenceState = null;
    state.runtimeMaxTankLevelAchieved = 1;
    state.currentFenceTierApplied = 1;
    state.fenceLevel = 1;
    if (FenceSprites && typeof FenceSprites.ensureLevel === 'function') {
      try { FenceSprites.ensureLevel(1); } catch (e) {}
    }
  }
  // Зомби — runtime-состояние, не сохраняется; при restore всегда сбрасываем.
  if (Array.isArray(state.zombies)) state.zombies.length = 0;
  resetCriticalEntryRuntimeFlags();
}

function inflateBuyPrice(price, count){
  let current = price;
  for (let i=0;i<count;i++){
    const delta = Math.max(1, Math.ceil(current * 0.001));
    current += delta;
  }
  return current;
}

function applySavedProgress(data){
  if (!data) return false;
  const { buyCounts, buyPrices, achievements, supercomputer, computerLevel, totalDamageDealtRaw, ...playerData } = data;
  if (supercomputer && typeof supercomputer === 'object') {
    Object.assign(getComputerState(), supercomputer);
  } else {
    const sc = getComputerState();
    if (Number.isFinite(computerLevel)) sc.computerLevel = Math.max(0, Math.floor(computerLevel));
    else if (Number.isFinite(playerData.level)) sc.computerLevel = Math.max(0, Math.floor(playerData.level));
    if (Number.isFinite(playerData.xp)) sc.xp = Math.max(0, Math.floor(playerData.xp));
    if (Number.isFinite(playerData.xpToNext)) sc.xpToNext = Math.max(1, Math.floor(playerData.xpToNext));
    if (Number.isFinite(playerData.maxLevel)) sc.maxLevel = Math.max(1, Math.floor(playerData.maxLevel));
    sc.eventShown40 = !!playerData.eventShown40;
    sc.eventShown50 = !!playerData.eventShown50;
    sc.eventShown60 = !!playerData.eventShown60;
  }
  if (Number.isFinite(playerData.talentPoints)) state.player.talentPoints = Math.max(0, Math.floor(playerData.talentPoints));
  if (Array.isArray(playerData.talentsApplied)) state.player.talentsApplied = playerData.talentsApplied;
  if (playerData.talentsV2 && typeof playerData.talentsV2 === 'object') {
    state.player.talentsV2 = {
      ranksById: playerData.talentsV2.ranksById && typeof playerData.talentsV2.ranksById === 'object'
        ? { ...playerData.talentsV2.ranksById }
        : {},
      freePoints: Number.isFinite(playerData.talentsV2.freePoints)
        ? Math.max(0, Math.floor(playerData.talentsV2.freePoints))
        : 0,
    };
  } else if (!state.player.talentsV2 || typeof state.player.talentsV2 !== 'object') {
    state.player.talentsV2 = { ranksById: {}, freePoints: 0 };
  }
  if (Number.isFinite(playerData.freeTalentPointsV2)) {
    state.player.freeTalentPointsV2 = Math.max(0, Math.floor(playerData.freeTalentPointsV2));
  } else if (state.player.talentsV2 && Number.isFinite(state.player.talentsV2.freePoints)) {
    state.player.freeTalentPointsV2 = Math.max(0, Math.floor(state.player.talentsV2.freePoints));
  } else {
    state.player.freeTalentPointsV2 = 0;
  }
  if (Number.isFinite(playerData.talentsVersion)) {
    state.player.talentsVersion = Math.max(0, Math.floor(playerData.talentsVersion));
  } else if (playerData.talentsV2 && typeof playerData.talentsV2 === 'object') {
    state.player.talentsVersion = 2;
  } else {
    state.player.talentsVersion = 0;
  }
  if (Number.isFinite(playerData.damagePoints)) state.player.damagePoints = Math.max(0, Math.floor(playerData.damagePoints));
  if (playerData.tutorial && typeof playerData.tutorial === 'object') state.tutorial = cloneJsonSafe(playerData.tutorial, state.tutorial || null);
  if (Array.isArray(playerData.cannonUpgradesApplied)) state.player.cannonUpgradesApplied = playerData.cannonUpgradesApplied;
  if (Array.isArray(playerData.dronUpgradesApplied)) state.player.dronUpgradesApplied = playerData.dronUpgradesApplied;
  ensureCannonUpgradesAppliedState();
  ensureDronUpgradesAppliedState();
  ensureFenceUpgradesAppliedState();
  if (supercomputerController && supercomputerController.syncLevel) {
    supercomputerController.syncLevel(getComputerState(), SupercomputerSprites.config);
  }
  refreshTanksPowerTier();
  if (getComputerLevel() >= 60) state.endgameVisuals = true;
  if (buyCounts && typeof buyCounts === 'object'){
    state.buyCounts = buyCounts;
  }
  if (buyPrices && typeof buyPrices === 'object'){
    state.buyPrices = buyPrices;
  } else if (buyCounts && typeof buyCounts === 'object'){
    const prices = {};
    for (const [levelKey, count] of Object.entries(buyCounts)){
      const level = Number(levelKey);
      if (!Number.isFinite(level)) continue;
      const base = baseBuyPrice(level);
      prices[level] = inflateBuyPrice(base, Math.max(0, Number(count) || 0));
    }
    state.buyPrices = prices;
  }
  if (achievements && typeof achievements === 'object') {
    const ach = ensureAchievementsState();
    ach.unlocked = achievements.unlocked && typeof achievements.unlocked === 'object' ? { ...achievements.unlocked } : ach.unlocked;
    ach.totalPurchased = Number.isFinite(achievements.totalPurchased) ? Math.max(0, Math.floor(achievements.totalPurchased)) : ach.totalPurchased;
    ach.totalMerges = Number.isFinite(achievements.totalMerges) ? Math.max(0, Math.floor(achievements.totalMerges)) : ach.totalMerges;
    ach.popupQueue = [];
  }
  state.totalDamageDealtRaw = normalizeTotalDamageDealtRaw(totalDamageDealtRaw);
  state.damagePointsSpent = normalizeDamagePointsSpent(data.damagePointsSpent);
  ensurePlayerDamagePointsState();
  state.fenceLevel = Number.isFinite(data.fenceLevel) ? Math.max(1, Math.floor(data.fenceLevel)) : 1;
  state.runtimeMaxTankLevelAchieved = Number.isFinite(state.maxTankLevelAchieved)
    ? Math.max(1, Math.floor(state.maxTankLevelAchieved))
    : 1;
  state.currentFenceTierApplied = Number.isFinite(state.fenceLevel)
    ? Math.max(1, Math.floor(state.fenceLevel))
    : 1;
  syncFenceTierWithMaxTankLevel(state, { force: true });
  state.zombieWaveAtkMult = Number.isFinite(data.zombieWaveAtkMult) ? Math.max(0, data.zombieWaveAtkMult) : 1;
  /* Restore player chips for Workshop/Chip Upgrade */
  if (Array.isArray(data.playerChips)) {
    state.playerChips = data.playerChips;
    if (window.Game && window.Game.HangarChipsUI && typeof window.Game.HangarChipsUI.setPlayerChips === 'function') {
      window.Game.HangarChipsUI.setPlayerChips(data.playerChips);
    }
  }
  /* Restore tech study state */
  if (data.techStudying && typeof data.techStudying === 'object' && window.Game && window.Game.HangarChipsUI && typeof window.Game.HangarChipsUI.setTechStudying === 'function') {
    window.Game.HangarChipsUI.setTechStudying(data.techStudying);
  }
  return true;
}

const PROJECTILE_KINDS = CombatProfilesApi && CombatProfilesApi.PROJECTILE_KINDS ? CombatProfilesApi.PROJECTILE_KINDS : {
  ap: { kind:'ap', speed: 820, r: 4.0, color:'#ffd36b', glow:'rgba(255,211,107,.25)', trail:'rgba(255,211,107,.12)', aoeBase: 18, aoePerLevel: 2.4, aoeMin: 16, aoeMax: 40 },
  he: { kind:'he', speed: 740, r: 5.6, color:'#ff7a6b', glow:'rgba(255,122,107,.26)', trail:'rgba(255,122,107,.12)', aoeBase: 28, aoePerLevel: 3.2, aoeMin: 24, aoeMax: 58 },
  toxic: { kind:'toxic', speed: 700, r: 5.0, color:'#b8ff3b', glow:'rgba(184,255,59,.22)', trail:'rgba(184,255,59,.10)', aoeBase: 30, aoePerLevel: 3.4, aoeMin: 26, aoeMax: 64, poolLife: 3.6, poolDpsMul: 0.20 },
  tesla: { kind:'tesla', speed: 900, r: 4.6, color:'#8bd3ff', glow:'rgba(139,211,255,.25)', trail:'rgba(139,211,255,.10)', aoeBase: 26, aoePerLevel: 2.8, aoeMin: 26, aoeMax: 66, chainRange: 84, chainJumps: 3, chainMul: 0.45 },
};

function getTankConfigByLevel(level){
  if (!TankSprites || typeof TankSprites.getTank !== 'function') return null;
  return TankSprites.getTank(level);
}

function getBulletConfigForTankLevel(level){
  const tankCfg = getTankConfigByLevel(level);
  if (!tankCfg) return { tankCfg: null, bulletCfg: null, bulletId: 'bullet_base', bulletLevel: 1 };
  const bulletId = typeof tankCfg.bulletId === 'string' && tankCfg.bulletId.length ? tankCfg.bulletId : 'bullet_base';
  const bulletLevel = Number.isFinite(tankCfg.bulletLevel) ? Math.max(1, Math.floor(tankCfg.bulletLevel)) : 1;
  const bulletCfg = BulletSprites && typeof BulletSprites.getBullet === 'function'
    ? BulletSprites.getBullet(bulletId, bulletLevel)
    : null;
  return { tankCfg, bulletCfg, bulletId, bulletLevel };
}

function projectileProfile(level, bulletCfg){
  if (CombatProfilesApi && CombatProfilesApi.projectileProfile) {
    return CombatProfilesApi.projectileProfile(level, bulletCfg);
  }
  const bulletKind = bulletCfg && typeof bulletCfg.projectileKind === 'string' ? bulletCfg.projectileKind : null;
  if (bulletKind && PROJECTILE_KINDS[bulletKind]) return PROJECTILE_KINDS[bulletKind];
  // Level bands: 1-3 AP, 4-6 HE, 7-9 Toxic, 10+ Tesla
  if (level <= 3) return {
    kind:'ap',
    speed: 820,
    r: 4.0,
    color:'#ffd36b',
    glow:'rgba(255,211,107,.25)',
    trail:'rgba(255,211,107,.12)',
    aoeBase: 18,
    aoePerLevel: 2.4,
    aoeMin: 16,
    aoeMax: 40,
  };
  if (level <= 6) return {
    kind:'he',
    speed: 740,
    r: 5.6,
    color:'#ff7a6b',
    glow:'rgba(255,122,107,.26)',
    trail:'rgba(255,122,107,.12)',
    aoeBase: 28,
    aoePerLevel: 3.2,
    aoeMin: 24,
    aoeMax: 58,
  };
  if (level <= 9) return {
    kind:'toxic',
    speed: 700,
    r: 5.0,
    color:'#b8ff3b',
    glow:'rgba(184,255,59,.22)',
    trail:'rgba(184,255,59,.10)',
    aoeBase: 30,
    aoePerLevel: 3.4,
    aoeMin: 26,
    aoeMax: 64,
    poolLife: 3.6,
    poolDpsMul: 0.20,
  };
  return PROJECTILE_KINDS.tesla;
}

function tankLevelCounts(){
  if (CombatProfilesApi && CombatProfilesApi.tankLevelCounts) {
    return CombatProfilesApi.tankLevelCounts(state.cells);
  }
  const counts = new Map();
  for (const cell of state.cells){
    if (!cell.tank) continue;
    const lvl = cell.tank.level;
    counts.set(lvl, (counts.get(lvl) || 0) + 1);
  }
  return counts;
}

// Weights proportional to tank counts in hangar (excludes unopened crates — they have no cell yet)
function zombieLevelWeights(){
  if (CombatProfilesApi && CombatProfilesApi.zombieLevelWeights) {
    return CombatProfilesApi.zombieLevelWeights(state.cells);
  }
  const counts = tankLevelCounts();
  const levels = Array.from(counts.keys()).sort((a,b)=>a-b);
  if (!levels.length) return [{level: 1, weight: 1}];
  const total = levels.reduce((sum, lvl)=>sum + (counts.get(lvl) || 0), 0);
  if (total <= 0) return [{level: 1, weight: 1}];
  return levels.map(lvl => ({
    level: lvl,
    weight: (counts.get(lvl) || 0) / total,
  }));
}

function pickZombieLevel(){
  if (CombatProfilesApi && CombatProfilesApi.pickZombieLevel) {
    return CombatProfilesApi.pickZombieLevel(state.cells, Math.random);
  }
  const weights = zombieLevelWeights();
  let total = 0;
  for (const w of weights) total += w.weight;
  let r = Math.random() * total;
  for (const w of weights){
    r -= w.weight;
    if (r <= 0) return w.level;
  }
  return weights[weights.length - 1].level;
}

// ---------- Zombies (constant population) ----------
function edgeSpawnR(){
  return Math.max(BAL.edgeSpawnRadius, Math.max(viewSize.w, viewSize.h) * 0.62);
}

function zombieSlotTheta(slotIndex, slotCount){
  if (ZombieSpawnApi && ZombieSpawnApi.zombieSlotTheta) {
    return ZombieSpawnApi.zombieSlotTheta(slotIndex, slotCount);
  }
  const step = (Math.PI * 2) / Math.max(1, slotCount);
  const jitter = (Math.random() * 2 - 1) * step * 0.25;
  return slotIndex * step + jitter;
}

function assignZombieSlot(z, slotIndex, slotCount){
  if (ZombieSpawnApi && ZombieSpawnApi.assignZombieSlot) {
    ZombieSpawnApi.assignZombieSlot(z, slotIndex, slotCount, zombieFenceLimit, BAL);
    return;
  }
  const theta = zombieSlotTheta(slotIndex, slotCount);
  z.slotIndex = slotIndex;
  z.anchorTheta = theta;
  z.theta = theta;
  z.spawnSideKey = getSideKeyForTheta(theta);
  const fenceLimit = zombieFenceLimit(z);
  z.targetR = fenceLimit + (Math.random()*2-1)*Math.min(4, BAL.zombieTrackWidth * 0.2);
}

function toSafeInt(value, fallback){
  if (ZombieSpawnApi && ZombieSpawnApi.toSafeInt) {
    return ZombieSpawnApi.toSafeInt(value, fallback);
  }
  if (!Number.isFinite(value)) return fallback;
  const n = Math.floor(value);
  return Number.isFinite(n) ? n : fallback;
}

function getZombieSpawnBalanceConfig(){
  // optional forced multiplier (for computing baseDesiredAlive)
  const forced = arguments && arguments.length > 0 && Number.isFinite(arguments[0]) ? Number(arguments[0]) : null;
  const attackMult = getZombieAttackMultipliers();
  const desiredAliveMult = forced != null ? Math.max(0, forced) : (Number.isFinite(attackMult.targetAliveMult) ? Math.max(0, attackMult.targetAliveMult) : 1);
  if (ZombieSpawnApi && ZombieSpawnApi.getZombieSpawnBalanceConfig) {
    return ZombieSpawnApi.getZombieSpawnBalanceConfig(
      ZombieSprites ? ZombieSprites.spawnConfig : null,
      BAL,
      { desiredAliveMult: desiredAliveMult }
    );
  }
  const cfg = ZombieSprites && ZombieSprites.spawnConfig ? ZombieSprites.spawnConfig : null;
  const targetAliveBase = Math.max(1, toSafeInt(cfg?.targetAlive, BAL.zombieCountTarget));
  const targetAlive = clamp(Math.round(targetAliveBase * desiredAliveMult), 0, Number.MAX_SAFE_INTEGER);
  const sideCount = Math.max(1, toSafeInt(cfg?.sideCount, BAL.zombieSideCount || 4));
  const defaultPerSide = Math.max(1, Math.round(targetAliveBase / sideCount));
  const basePerSideTarget = Math.max(1, toSafeInt(cfg?.perSideTarget, BAL.zombiePerSideTarget || defaultPerSide));
  const perSideTarget = basePerSideTarget;
  const perSideTolerance = Math.max(0, toSafeInt(cfg?.perSideTolerance, BAL.zombiePerSideTolerance || 5));
  return {
    targetAlive,
    sideCount,
    perSideTarget,
    perSideMin: Math.max(0, perSideTarget - perSideTolerance),
    perSideMax: perSideTarget + perSideTolerance,
  };
}

function zombieSideForSlot(slotIndex, slotCount, sideCount){
  if (ZombieSpawnApi && ZombieSpawnApi.zombieSideForSlot) {
    return ZombieSpawnApi.zombieSideForSlot(slotIndex, slotCount, sideCount);
  }
  const normalized = ((slotIndex % slotCount) + slotCount) % slotCount;
  const ratio = normalized / Math.max(1, slotCount);
  return Math.max(0, Math.min(sideCount - 1, Math.floor(ratio * sideCount)));
}

function pickMissingSlotBySide(missingBySide, aliveBySide, cfg){
  if (ZombieSpawnApi && ZombieSpawnApi.pickMissingSlotBySide) {
    return ZombieSpawnApi.pickMissingSlotBySide(missingBySide, aliveBySide, cfg);
  }
  const sideCount = cfg.sideCount;
  let bestSide = -1;
  let bestScore = -Infinity;
  for (let side = 0; side < sideCount; side++){
    const slots = missingBySide[side];
    if (!slots || !slots.length) continue;
    const alive = aliveBySide[side] || 0;
    let score = cfg.perSideTarget - alive;
    if (alive < cfg.perSideMin) score += 1000;
    else if (alive > cfg.perSideMax) score -= 1000;
    if (score > bestScore){
      bestScore = score;
      bestSide = side;
    }
  }
  if (bestSide >= 0){
    const slotIndex = missingBySide[bestSide].shift();
    return { slotIndex, side: bestSide };
  }
  for (let side = 0; side < sideCount; side++){
    const slots = missingBySide[side];
    if (slots && slots.length) return { slotIndex: slots.shift(), side };
  }
  return { slotIndex: null, side: null };
}

function nextZombieRenderOrder(){
  state.nextZombieRenderOrder = Math.max(1, Number.isFinite(state.nextZombieRenderOrder) ? state.nextZombieRenderOrder : 1);
  const id = state.nextZombieRenderOrder;
  state.nextZombieRenderOrder += 1;
  return id;
}

function makeZombie(fromEdge=true, slotIndex=null, slotCount=1){
  const level = pickZombieLevel();
  const t = ZombieSprites.pickTypeByLevel ? ZombieSprites.pickTypeByLevel(level) : ZombieSprites.pickType();

  const theta = Number.isFinite(slotIndex)
    ? zombieSlotTheta(slotIndex, slotCount)
    : Math.random() * Math.PI*2;
  const dir = Math.random() < 0.5 ? -1 : 1;

  const levelHpMul = zombieHpMultiplier(level);
  const levelOmegaMul = 1 + BAL.zombieLevelOmegaMul * (level - 1);
  const baseHp = BAL.zombieHpBase * (1 + (Math.random()*2-1)*BAL.zombieHpVar) * levelHpMul;
  // Zombies no longer orbit; omegaBase is 0 (they approach the fence directly)
  const baseOmega = 0;
  const joinSpeed = fromEdge ? BAL.edgeJoinSpeed * (0.6 + Math.random() * 0.2) : BAL.edgeJoinSpeed * 1.4;
  const attackCfg = getZombieAttackConfig({ type: t });
  const animCfg = getZombieAnimConfig({ type: t });

  const z = {
    id: crypto.randomUUID(),
    renderOrder: nextZombieRenderOrder(),
    type: t,
    level,
    theta,
    anchorTheta: theta,
    spawnSideKey: getSideKeyForTheta(theta),
    heading: 0,
    slotIndex: Number.isFinite(slotIndex) ? slotIndex : null,
    swayPhase: Math.random() * Math.PI * 2,
    swaySpeed: (0.6 + Math.random() * 0.8) * (t?.omegaMul ?? 1.0),
    r: fromEdge ? edgeSpawnR() : 0,
    targetR: 0,
    omegaBase: baseOmega * (t?.omegaMul ?? 1.0),
    omega: baseOmega * (t?.omegaMul ?? 1.0),
    joinSpeed,
    hp: baseHp * (t?.hpMul ?? 1.0),
    maxHp: baseHp * (t?.hpMul ?? 1.0),
    rewardMul: (t?.rewardMul ?? 1.0),
    anim: Math.random() * (t?.frames ?? 1),
    walkAnimFrame: Math.random() * (t?.frames ?? 1),
    attackAnimTimeSec: 0,
    attackState: 'walk',
    attackCooldownTimerSec: 0,
    attackDidHit: false,
    attackTargetId: null,
    attackRangePx: attackCfg.attackRangePx,
    attackCooldownSec: attackCfg.attackCooldownSec,
    attackHitAt: attackCfg.attackHitAt,
    walkFrameRateFps: animCfg.walkFps,
    attackFrameRateFps: animCfg.attackFps,
    deathFrameRateFps: animCfg.deathFps,
    deathCommonFrameRateFps: animCfg.deathCommonFps,
    breached: false,
  };

  const fenceLimit = zombieFenceLimit(z);
  z.targetR = fenceLimit + (Math.random()*2-1)*Math.min(4, BAL.zombieTrackWidth * 0.2);
  if (!fromEdge) z.r = z.targetR;
  return z;
}

function ensureZombieCount(){
  const spawnCfg = getZombieSpawnBalanceConfig();
  const spawnCfgBase = getZombieSpawnBalanceConfig(1);
  const target = spawnCfg.targetAlive; // attackDesiredAlive
  const baseTarget = spawnCfgBase.targetAlive; // baseDesiredAlive
  const slotCount = Math.max(1, target);
  const taken = new Set();
  const aliveBySide = new Array(spawnCfg.sideCount).fill(0);
  let aliveCount = 0;

  for (const z of state.zombies){
    if (z.state === 'dying') continue;
    aliveCount++;
    if (Number.isFinite(z.slotIndex)){
      const idx = ((z.slotIndex % slotCount) + slotCount) % slotCount;
      z.slotIndex = idx;
      taken.add(idx);
      const side = zombieSideForSlot(idx, slotCount, spawnCfg.sideCount);
      aliveBySide[side] = (aliveBySide[side] || 0) + 1;
    }
  }

  const missingBySide = Array.from({ length: spawnCfg.sideCount }, () => []);
  for (let i=0;i<slotCount;i++){
    if (!taken.has(i)) {
      const side = zombieSideForSlot(i, slotCount, spawnCfg.sideCount);
      missingBySide[side].push(i);
    }
  }

  for (const z of state.zombies){
    if (z.state === 'dying') continue;
    if (!Number.isFinite(z.slotIndex)){
      if (z.attackSpawnSupplemental === true) continue;
      const nextSlot = pickMissingSlotBySide(missingBySide, aliveBySide, spawnCfg);
      if (!Number.isFinite(nextSlot.slotIndex)) break;
      assignZombieSlot(z, nextSlot.slotIndex, slotCount);
      if (nextSlot.side != null) aliveBySide[nextSlot.side] = (aliveBySide[nextSlot.side] || 0) + 1;
    }
  }

  while (aliveCount < target){
    if (aliveCount < baseTarget) {
      // base spawn — keep existing sideCount behavior
      const nextSlot = pickMissingSlotBySide(missingBySide, aliveBySide, spawnCfg);
      const spawnIndex = Number.isFinite(nextSlot.slotIndex) ? nextSlot.slotIndex : aliveCount;
      state.zombies.push(makeZombie(true, spawnIndex, slotCount));
      if (nextSlot.side != null) aliveBySide[nextSlot.side] = (aliveBySide[nextSlot.side] || 0) + 1;
      aliveCount++;
      continue;
    }
    // attackMode supplemental spawn — use episode dirs A/B/C (50/25/25)
    var w = worldEventsState || {};
    var hasRuntimeDirs = Number.isFinite(w.attackSpawnDirA) && Number.isFinite(w.attackSpawnDirB) && Number.isFinite(w.attackSpawnDirC);
    if (!hasRuntimeDirs) {
      var prevPrimary = Number.isFinite(w.attackSpawnPrevPrimaryDir) ? w.attackSpawnPrevPrimaryDir : null;
      var prevStreak = Number.isFinite(w.attackSpawnPrimaryStreak) ? Math.max(0, Math.floor(w.attackSpawnPrimaryStreak)) : 0;
      var candidates = [];
      for (var d = 0; d < 8; d++) candidates.push(d);
      if (prevPrimary != null && prevStreak >= 2) {
        candidates = candidates.filter(function (dir) { return dir !== prevPrimary; });
      }
      var idxPrimary = Math.floor(Math.random() * candidates.length);
      var dirPrimary = candidates[idxPrimary];
      var restDirs = [];
      for (var d2 = 0; d2 < 8; d2++) if (d2 !== dirPrimary) restDirs.push(d2);
      for (var ri = restDirs.length - 1; ri > 0; ri--) {
        var rj = Math.floor(Math.random() * (ri + 1));
        var tmp = restDirs[ri];
        restDirs[ri] = restDirs[rj];
        restDirs[rj] = tmp;
      }
      w.attackSpawnDirA = dirPrimary;
      w.attackSpawnDirB = restDirs[0];
      w.attackSpawnDirC = restDirs[1] || restDirs[0];
      if (prevPrimary === dirPrimary) {
        w.attackSpawnPrimaryStreak = prevStreak + 1;
      } else {
        w.attackSpawnPrimaryStreak = 1;
        w.attackSpawnPrevPrimaryDir = dirPrimary;
      }
      w.attackSpawnEpisodeKey = (w.attackSpawnEpisodeKey || 0) + 1;
    }
    var dirA = Number.isFinite(w.attackSpawnDirA) ? w.attackSpawnDirA : Math.floor(Math.random() * 8);
    var dirB = Number.isFinite(w.attackSpawnDirB) ? w.attackSpawnDirB : (dirA + 2) % 8;
    var dirC = Number.isFinite(w.attackSpawnDirC) ? w.attackSpawnDirC : (dirA + 6) % 8;
    var r = Math.random();
    var chosenDir = r < 0.5 ? dirA : (r < 0.75 ? dirB : dirC);
    var thetaCenter = chosenDir * (Math.PI * 2 / 8);
    var jitter = (Math.random() * 2 - 1) * (Math.PI / 32);
    var theta = thetaCenter + jitter;
    var z = makeZombie(true, null, slotCount);
    if (z) {
      z.theta = theta;
      z.anchorTheta = theta;
      z.slotIndex = null;
      z.attackSpawnSupplemental = true;
      z.spawnSideKey = getSideKeyForTheta(theta);
      // ensure targetR / r start from edge (makeZombie already set r)
      state.zombies.push(z);
    }
    aliveCount++;
  }
}

function zombiePos(z){
  return {
    x: center.x + Math.cos(z.theta) * z.r,
    y: center.y + Math.sin(z.theta) * z.r,
  };
}

function resolveZombieWallMove(z, fromX, fromY, toX, toY, dt){
  if (!Number.isFinite(fromX) || !Number.isFinite(fromY) || !Number.isFinite(toX) || !Number.isFinite(toY)) {
    return { x: fromX, y: fromY };
  }
  const dx = toX - fromX;
  const dy = toY - fromY;
  const zR = zombieCollisionRadius(z);
  const maxStep = Math.max(1.25, (Math.max(0.001, zR) * 0.55) + (Math.max(0.001, dt) * 40));
  const stepLen = Math.hypot(dx, dy);
  const stepMul = stepLen > maxStep ? (maxStep / Math.max(stepLen, 1e-6)) : 1;
  let nextX = fromX + dx * stepMul;
  let nextY = fromY + dy * stepMul;

  const walls = Array.isArray(state.wallDecors) ? state.wallDecors : null;
  if (walls && walls.length) {
    for (let pass = 0; pass < 2; pass++) {
      let adjusted = false;
      for (let i = 0; i < walls.length; i++) {
        const wall = walls[i];
        if (!wall || !wall.isWall) continue;
        const wallR = Number.isFinite(wall.blockR) ? Math.max(0, wall.blockR) : 0;
        if (wallR <= 0) continue;

        const minDist = wallR + zR;
        const offX = nextX - wall.x;
        const offY = nextY - wall.y;
        const distSq = offX * offX + offY * offY;
        if (distSq >= minDist * minDist) continue;

        const dist = Math.sqrt(Math.max(distSq, 0));
        if (dist > 1e-6) {
          const pushMul = minDist / dist;
          nextX = wall.x + offX * pushMul;
          nextY = wall.y + offY * pushMul;
        } else {
          const fallbackX = Math.abs(dx) > 1e-6 ? dx : (Math.cos(z.theta || 0) || 1);
          const fallbackY = Math.abs(dy) > 1e-6 ? dy : (Math.sin(z.theta || 0) || 0);
          const fallbackLen = Math.hypot(fallbackX, fallbackY) || 1;
          nextX = wall.x + (fallbackX / fallbackLen) * minDist;
          nextY = wall.y + (fallbackY / fallbackLen) * minDist;
        }
        adjusted = true;
      }
      if (!adjusted) break;
    }
  }

  return { x: nextX, y: nextY };
}

// All zombies use fixed visual size (no scaling by level).
function zombieLevelScale(z){
  return 1;
}

function zombieHpMultiplier(level){
  const lvl = Math.max(1, level);
  const dmgScale = Math.pow(BAL.dmgMultPerLevel, lvl - 1);
  const extra = 1 + BAL.zombieHpExtraPerLevel * Math.max(0, lvl - 1);
  return dmgScale * extra;
}

function zombieCollisionRadius(z){
  const t = z.type;
  const scale = (t?.scale ?? 1.0) * BAL.zombieScaleMul * zombieLevelScale(z);
  const hitbox = t?.hitbox?.r;
  if (Number.isFinite(hitbox)) return hitbox * scale;
  const baseSize = t ? Math.max(t.frame.w, t.frame.h) : 34;
  return baseSize * scale * 0.28;
}

function getFenceConfig(){
  return FenceSprites && FenceSprites.config ? FenceSprites.config : {};
}

function getFenceSegmentsPerSide(){
  const cfg = getFenceConfig();
  return Number.isFinite(cfg.segmentsPerSide) ? Math.max(1, Math.floor(cfg.segmentsPerSide)) : null;
}

function getFenceLevels(){
  const cfg = getFenceConfig();
  const fallbackMaxHp = Number.isFinite(cfg.segmentMaxHp) ? Math.max(1, Math.floor(cfg.segmentMaxHp)) : FENCE_DEFAULT_SEGMENT_HP;
  const source = Array.isArray(cfg.levels) ? cfg.levels : null;
  if (!source || source.length === 0) {
    return [{ segmentMaxHp: fallbackMaxHp, armorFlat: 0, upgradeCostDamagePoints: null }];
  }
  const levels = [];
  for (let i = 0; i < source.length; i++) {
    const raw = source[i] || {};
    if (!Number.isFinite(raw.segmentMaxHp) || raw.segmentMaxHp < 1) continue;
    const segmentMaxHp = Math.max(1, Math.floor(raw.segmentMaxHp));
    const armorFlat = Number.isFinite(raw.armorFlat) ? Math.max(0, Math.floor(raw.armorFlat)) : 0;
    const upgradeCostDamagePoints = Number.isFinite(raw.upgradeCostDamagePoints)
      ? Math.max(0, Math.floor(raw.upgradeCostDamagePoints))
      : null;
    const level = { segmentMaxHp, armorFlat, upgradeCostDamagePoints };
    if (typeof raw.atlas === 'string' && raw.atlas) level.atlas = raw.atlas;
    if (typeof raw.uiAtlas === 'string' && raw.uiAtlas) level.uiAtlas = raw.uiAtlas;
    if (typeof raw.uiFrameId === 'string' && raw.uiFrameId) level.uiFrameId = raw.uiFrameId;
    if (raw.uiFrame && typeof raw.uiFrame === 'object') level.uiFrame = raw.uiFrame;
    if (raw.uiIcon && typeof raw.uiIcon === 'object') level.uiIcon = raw.uiIcon;
    levels.push(level);
  }
  if (!levels.length) {
    return [{ segmentMaxHp: fallbackMaxHp, armorFlat: 0, upgradeCostDamagePoints: null }];
  }
  return levels;
}

function getFenceLevelIndex(){
  const levels = getFenceLevels();
  const maxLevel = levels.length;
  const requested = Number.isFinite(state.fenceLevel) ? Math.floor(state.fenceLevel) : 1;
  const clampedLevel = clamp(requested, 1, maxLevel);
  state.fenceLevel = clampedLevel;
  return clampedLevel - 1;
}

function getCurrentFenceLevelConfig(){
  const levels = getFenceLevels();
  const index = getFenceLevelIndex();
  return levels[index] || levels[0];
}

function getFenceStatsForLevel(level, appliedIndex){
  const levels = getFenceLevels();
  const lvl = Number.isFinite(level) ? Math.max(1, Math.min(levels.length, Math.floor(level))) : 1;
  const levelCfg = levels[lvl - 1] || levels[0];
  const baseHp = Number.isFinite(levelCfg && levelCfg.segmentMaxHp) ? Math.max(1, Math.floor(levelCfg.segmentMaxHp)) : FENCE_DEFAULT_SEGMENT_HP;
  const baseArmor = Number.isFinite(levelCfg && levelCfg.armorFlat) ? Math.max(0, Math.floor(levelCfg.armorFlat)) : 0;
  const applied = Number.isFinite(appliedIndex) ? Math.max(0, Math.floor(appliedIndex)) : 0;
  const currentHp = Math.max(1, Math.round(baseHp * Math.pow(FENCE_HP_MUL, applied)));
  const currentArmor = Math.max(0, Math.round(baseArmor * Math.pow(FENCE_ARMOR_MUL, applied)));
  return {
    baseHp: baseHp,
    baseArmor: baseArmor,
    currentHp: currentHp,
    currentArmor: currentArmor,
  };
}

function getFenceSegmentMaxHp(){
  const levelCfg = getCurrentFenceLevelConfig();
  const base = Number.isFinite(levelCfg && levelCfg.segmentMaxHp) ? Math.max(1, Math.floor(levelCfg.segmentMaxHp)) : FENCE_DEFAULT_SEGMENT_HP;
  const level = getFenceLevelIndex() + 1;
  const applied = getAppliedFenceUpgradeLevel(level);
  const val = Math.round(base * Math.pow(FENCE_HP_MUL, applied));
  return Math.max(1, val);
}

function getFenceArmorFlat(){
  const levelCfg = getCurrentFenceLevelConfig();
  const base = Number.isFinite(levelCfg && levelCfg.armorFlat) ? Math.max(0, Math.floor(levelCfg.armorFlat)) : 0;
  const level = getFenceLevelIndex() + 1;
  const applied = getAppliedFenceUpgradeLevel(level);
  const val = Math.round(base * Math.pow(FENCE_ARMOR_MUL, applied));
  return Math.max(0, val);
}

function getFenceUpgradeCostDamagePoints(){
  const levels = getFenceLevels();
  const index = getFenceLevelIndex();
  if (index >= levels.length - 1) return null;
  const levelCfg = levels[index] || {};
  return Number.isFinite(levelCfg.upgradeCostDamagePoints)
    ? Math.max(0, Math.floor(levelCfg.upgradeCostDamagePoints))
    : 0;
}

function getFenceStats(){
  const levels = getFenceLevels();
  const index = getFenceLevelIndex();
  const level = index + 1;
  const levelsCount = levels.length;
  const segmentMaxHp = getFenceSegmentMaxHp();
  const armorFlat = getFenceArmorFlat();
  // unlimited steps inside the same level (per-level applied upgrades)
  const applied = getAppliedFenceUpgradeLevel(level);
  const upgradeCostDamagePoints = getUpgradeStepCost(level, applied);
  const availableDamagePoints = getAvailableDamagePoints();
  const hasNextLevel = true;
  const canUpgrade = Number.isFinite(upgradeCostDamagePoints) && upgradeCostDamagePoints > 0 && availableDamagePoints >= upgradeCostDamagePoints;
  return {
    level,
    levelsCount,
    segmentMaxHp,
    armorFlat,
    hasNextLevel,
    upgradeCostDamagePoints,
    availableDamagePoints,
    canUpgrade,
  };
}

function clampFenceSegmentsToMaxHp(maxHp){
  if (!Array.isArray(state.fenceSegments) || !state.fenceSegments.length) return;
  for (let i = 0; i < state.fenceSegments.length; i++) {
    const seg = state.fenceSegments[i];
    if (!seg) continue;
    const wasBroken = !!seg.broken;
    seg.maxHp = maxHp;
    const hp = Number.isFinite(seg.hp) ? seg.hp : maxHp;
    seg.hp = clamp(hp, 0, maxHp);
    seg.broken = seg.hp <= 0;
    if (seg.broken !== wasBroken) syncFenceBreachForSegment(seg);
  }
}

function tryUpgradeFenceLevel(){
  const stats = getFenceStats();
  const cost = stats.upgradeCostDamagePoints || 0;
  if (!Number.isFinite(cost) || cost <= 0) return false;
  if (stats.availableDamagePoints < cost) return false;

  const level = stats.level;
  const applied = ensureFenceUpgradesAppliedState();
  const idx = Math.max(0, Math.min(MAX_TANK_LEVEL - 1, level - 1));
  applied[idx] = normalizeAppliedFenceUpgrade(applied[idx]) + 1;
  state.damagePointsSpent = ensureDamagePointsSpentState() + cost;

  const maxHp = getFenceSegmentMaxHp();
  clampFenceSegmentsToMaxHp(maxHp);
  if (state.fenceSegmentsMeta) state.fenceSegmentsMeta.segmentMaxHp = maxHp;

  updateDamagePointsUI();
  return true;
}

function getFenceHealthBarConfig(){
  const cfg = getFenceConfig();
  const bar = cfg.healthBar || {};
  return {
    w: Number.isFinite(bar.w) ? Math.max(8, bar.w) : 28,
    h: Number.isFinite(bar.h) ? Math.max(2, bar.h) : 4,
    offsetY: Number.isFinite(bar.offsetY) ? bar.offsetY : -24,
  };
}

function getFenceRepairConfig(){
  const cfg = getFenceConfig();
  const repair = cfg.repair || {};
  return {
    enabled: repair.enabled !== false,
    costCoins: Number.isFinite(repair.costCoins) ? Math.max(0, repair.costCoins) : FENCE_DEFAULT_REPAIR_COST,
  };
}

function mapBrokenKind(kind){
  if (!kind) return '';
  if (kind.indexOf('Broken') >= 0) return kind;
  return kind + 'Broken';
}

function resolveBrokenSpriteId(kind, spriteKeys){
  const brokenKind = mapBrokenKind(kind);
  if (FenceSprites && FenceSprites.framesById && FenceSprites.framesById.has(brokenKind)) return brokenKind;
  const fallback = spriteKeys && spriteKeys[kind] ? spriteKeys[kind] : kind;
  if (!warnedBrokenFrames.has(brokenKind)) {
    warnedBrokenFrames.add(brokenKind);
    console.warn('[Fence] Missing broken sprite id, using intact frame.', brokenKind);
  }
  return fallback;
}

function estimateFenceMinRadius(segmentsPerSide, spriteKeys){
  if (!segmentsPerSide || !spriteKeys || !FenceSprites || !FenceSprites.ready) return 0;
  const cornerInsetOverride = FenceSprites.cornerInsetPx;
  function frameScale(frame) {
    return Number.isFinite(frame && frame.scale) ? frame.scale : 1;
  }
  function cornerInset(frameA, frameB) {
    if (Number.isFinite(cornerInsetOverride)) return Math.max(0, cornerInsetOverride);
    const cornerScale = Math.max(frameScale(frameA), frameScale(frameB));
    return Math.max(4, BAL.fenceWidth * 0.65) * cornerScale;
  }
  function sideStep(frame) {
    return Math.max(6, BAL.fenceWidth * 1.15) * frameScale(frame);
  }

  const f = {
    cornerTL: FenceSprites.pickFrame(spriteKeys.cornerTL),
    cornerTR: FenceSprites.pickFrame(spriteKeys.cornerTR),
    cornerBR: FenceSprites.pickFrame(spriteKeys.cornerBR),
    cornerBL: FenceSprites.pickFrame(spriteKeys.cornerBL),
    sideTop: FenceSprites.pickFrame(spriteKeys.sideTop),
    sideRight: FenceSprites.pickFrame(spriteKeys.sideRight),
    sideBottom: FenceSprites.pickFrame(spriteKeys.sideBottom),
    sideLeft: FenceSprites.pickFrame(spriteKeys.sideLeft),
  };

  const candidates = [];
  candidates.push((sideStep(f.sideTop) * segmentsPerSide + cornerInset(f.cornerTL, f.cornerTR) + cornerInset(f.cornerTR, f.cornerTL)) * 0.5);
  candidates.push((sideStep(f.sideRight) * segmentsPerSide + cornerInset(f.cornerTR, f.cornerBR) + cornerInset(f.cornerBR, f.cornerTR)) * 0.5);
  candidates.push((sideStep(f.sideBottom) * segmentsPerSide + cornerInset(f.cornerBL, f.cornerBR) + cornerInset(f.cornerBR, f.cornerBL)) * 0.5);
  candidates.push((sideStep(f.sideLeft) * segmentsPerSide + cornerInset(f.cornerTL, f.cornerBL) + cornerInset(f.cornerBL, f.cornerTL)) * 0.5);

  let minRadius = 0;
  for (let i = 0; i < candidates.length; i++) {
    if (Number.isFinite(candidates[i])) minRadius = Math.max(minRadius, candidates[i]);
  }
  return minRadius;
}

function ensureFenceSegmentMathMeta(){
  const meta = state.fenceSegmentsMeta;
  if (!meta || !meta.byId) return;
  if (meta.sideMath) return;

  const byId = meta.byId;
  function sideInfo(sideKey, sideKind, cornerStartId, cornerEndId) {
    const sideSegs = [];
    for (let i = 0; i < state.fenceSegments.length; i++) {
      const seg = state.fenceSegments[i];
      if (seg && seg.kind === sideKind) sideSegs.push(seg);
    }
    sideSegs.sort((a, b) => (a.sideIndex || 0) - (b.sideIndex || 0));
    return {
      sideKey,
      sideKind,
      start: sideSegs.length ? sideSegs[0].spanStart : -BAL.fenceRadius,
      end: sideSegs.length ? sideSegs[sideSegs.length - 1].spanEnd : BAL.fenceRadius,
      sideSegs,
      cornerStart: byId[cornerStartId] || null,
      cornerEnd: byId[cornerEndId] || null,
    };
  }

  meta.sideMath = {
    top: sideInfo('top', 'sideTop', 'cornerTL', 'cornerTR'),
    right: sideInfo('right', 'sideRight', 'cornerTR', 'cornerBR'),
    bottom: sideInfo('bottom', 'sideBottom', 'cornerBL', 'cornerBR'),
    left: sideInfo('left', 'sideLeft', 'cornerTL', 'cornerBL'),
  };
}

function getFenceSegmentForTheta(theta){
  if (!state.fenceSegmentsMeta || !state.fenceSegmentsMeta.byId) return null;
  ensureFenceSegmentMathMeta();
  const sm = state.fenceSegmentsMeta.sideMath;
  if (!sm) return null;
  const dx = Math.cos(theta || 0);
  const dy = Math.sin(theta || 0);
  let sideKey = 'right';
  let coord = BAL.fenceRadius * dy;
  if (Math.abs(dy) > Math.abs(dx)) {
    sideKey = dy >= 0 ? 'bottom' : 'top';
    coord = BAL.fenceRadius * dx;
  } else {
    sideKey = dx >= 0 ? 'right' : 'left';
    coord = BAL.fenceRadius * dy;
  }
  const info = sm[sideKey];
  if (!info) return null;
  if (coord <= info.start) return info.cornerStart || (info.sideSegs[0] || null);
  if (coord >= info.end) return info.cornerEnd || (info.sideSegs[info.sideSegs.length - 1] || null);
  if (!info.sideSegs.length) return null;
  const t = clamp((coord - info.start) / Math.max(1e-6, info.end - info.start), 0, 0.999999);
  const idx = Math.min(info.sideSegs.length - 1, Math.floor(t * info.sideSegs.length));
  return info.sideSegs[idx];
}

function getSideKeyForTheta(theta){
  const dx = Math.cos(theta || 0);
  const dy = Math.sin(theta || 0);
  if (Math.abs(dy) > Math.abs(dx)) return dy >= 0 ? 'bottom' : 'top';
  return dx >= 0 ? 'right' : 'left';
}

function getSideByPosition(x, y){
  if (FenceSidesApi && typeof FenceSidesApi.getSideByPosition === 'function') {
    return FenceSidesApi.getSideByPosition(x, y, center.x, center.y);
  }
  const dx = x - center.x;
  const dy = y - center.y;
  if (Math.abs(dy) > Math.abs(dx)) return dy >= 0 ? 'bottom' : 'top';
  return dx >= 0 ? 'right' : 'left';
}

function createEmptyBreachesBySide(){
  return {
    top: [],
    right: [],
    bottom: [],
    left: [],
  };
}

function ensureBreachesBySide(){
  const src = state.fenceBreachesBySide;
  if (!src || !Array.isArray(src.top) || !Array.isArray(src.right) || !Array.isArray(src.bottom) || !Array.isArray(src.left)) {
    state.fenceBreachesBySide = createEmptyBreachesBySide();
  }
  return state.fenceBreachesBySide;
}

function ensureBreachIndexBySegment(){
  const src = state.fenceBreachIndexBySegment;
  if (!src || typeof src !== 'object') {
    state.fenceBreachIndexBySegment = Object.create(null);
  }
  return state.fenceBreachIndexBySegment;
}

function getFenceSideKeyForSegment(seg){
  if (!seg) return null;
  if (seg.kind === 'sideTop') return 'top';
  if (seg.kind === 'sideRight') return 'right';
  if (seg.kind === 'sideBottom') return 'bottom';
  if (seg.kind === 'sideLeft') return 'left';
  if (seg.kind === 'cornerTL') return 'top';
  if (seg.kind === 'cornerTR') return 'right';
  if (seg.kind === 'cornerBR') return 'bottom';
  if (seg.kind === 'cornerBL') return 'left';
  if (Number.isFinite(seg.theta)) return getSideKeyForTheta(seg.theta);
  if (Number.isFinite(seg.x) && Number.isFinite(seg.y)) return getSideKeyForTheta(Math.atan2(seg.y, seg.x));
  return null;
}

function removeFenceBreachBySegmentId(segmentId){
  if (segmentId == null) return;
  const key = String(segmentId);
  const indexBySegment = ensureBreachIndexBySegment();
  const entry = indexBySegment[key];
  if (!entry) return;

  const breaches = ensureBreachesBySide();
  const list = breaches[entry.sideKey];
  const idx = Number.isFinite(entry.listIndex) ? entry.listIndex : -1;
  if (!Array.isArray(list) || idx < 0 || idx >= list.length) {
    delete indexBySegment[key];
    return;
  }

  const lastIdx = list.length - 1;
  const last = list[lastIdx];
  if (idx !== lastIdx) {
    list[idx] = last;
    if (last && last.segmentId != null) {
      last.listIndex = idx;
      indexBySegment[String(last.segmentId)] = last;
    }
  }
  list.pop();
  delete indexBySegment[key];
}

function upsertFenceBreachBySegment(seg){
  if (!seg || seg.id == null || !seg.holeAabb) return;
  const sideKey = getFenceSideKeyForSegment(seg);
  if (sideKey !== 'top' && sideKey !== 'right' && sideKey !== 'bottom' && sideKey !== 'left') return;
  const aabb = seg.holeAabb;
  const centerX = (aabb.minX + aabb.maxX) * 0.5;
  const centerY = (aabb.minY + aabb.maxY) * 0.5;

  const breaches = ensureBreachesBySide();
  const indexBySegment = ensureBreachIndexBySegment();
  const segmentKey = String(seg.id);
  const existing = indexBySegment[segmentKey];

  if (existing && existing.sideKey !== sideKey) {
    removeFenceBreachBySegmentId(seg.id);
  }

  const list = breaches[sideKey];
  const active = indexBySegment[segmentKey];
  if (active) {
    active.holeAabb = aabb;
    active.center.x = centerX;
    active.center.y = centerY;
    return;
  }

  const entry = {
    segmentId: seg.id,
    holeAabb: aabb,
    center: { x: centerX, y: centerY },
    sideKey,
    listIndex: list.length,
  };
  list.push(entry);
  indexBySegment[segmentKey] = entry;
}

function syncFenceBreachForSegment(seg){
  if (!seg || seg.id == null) return;
  if (seg.broken) upsertFenceBreachBySegment(seg);
  else removeFenceBreachBySegmentId(seg.id);
}

function rebuildBreachesBySideFromFence(){
  state.fenceBreachesBySide = createEmptyBreachesBySide();
  state.fenceBreachIndexBySegment = Object.create(null);
  if (!Array.isArray(state.fenceSegments) || !state.fenceSegments.length) return;
  for (let i = 0; i < state.fenceSegments.length; i++) {
    const seg = state.fenceSegments[i];
    if (!seg || !seg.broken) continue;
    upsertFenceBreachBySegment(seg);
  }
}

function getBreachesForSide(sideKey){
  const breaches = ensureBreachesBySide();
  if (sideKey === 'top' || sideKey === 'right' || sideKey === 'bottom' || sideKey === 'left') {
    return breaches[sideKey];
  }
  return [];
}

function pointInAabb(x, y, aabb){
  if (!aabb) return false;
  const pad = arguments.length >= 4 && Number.isFinite(arguments[3]) ? Math.max(0, arguments[3]) : 0;
  return x >= (aabb.minX - pad) && x <= (aabb.maxX + pad) && y >= (aabb.minY - pad) && y <= (aabb.maxY + pad);
}

function getActiveBreachAtPoint(sideKey, x, y, padding){
  const pad = Number.isFinite(padding) ? Math.max(0, padding) : 0;
  const list = getBreachesForSide(sideKey);
  for (let i = 0; i < list.length; i++) {
    const breach = list[i];
    if (!breach || !breach.holeAabb) continue;
    if (pointInAabb(x, y, breach.holeAabb, pad)) return breach;
  }

  const breaches = ensureBreachesBySide();
  const sideLists = [breaches.top, breaches.right, breaches.bottom, breaches.left];
  for (let j = 0; j < sideLists.length; j++) {
    const sideList = sideLists[j];
    if (!Array.isArray(sideList) || sideList === list) continue;
    for (let k = 0; k < sideList.length; k++) {
      const breach = sideList[k];
      if (!breach || !breach.holeAabb) continue;
      if (pointInAabb(x, y, breach.holeAabb, 0)) return breach;
    }
  }
  return null;
}

function pickNearestBreachForSide(sideKey, x, y){
  const maxDistancePx = Number.isFinite(arguments[3]) ? Math.max(0, arguments[3]) : Infinity;
  const includeAllSides = arguments.length >= 5 ? !!arguments[4] : false;
  const maxDistanceSq = Number.isFinite(maxDistancePx) ? (maxDistancePx * maxDistancePx) : Infinity;
  const list = getBreachesForSide(sideKey);
  let best = null;
  let bestDist = Infinity;
  function consider(candidateList){
    if (!Array.isArray(candidateList) || !candidateList.length) return;
    for (let i = 0; i < candidateList.length; i++) {
      const breach = candidateList[i];
      if (!breach || !breach.center) continue;
      const dx = breach.center.x - x;
      const dy = breach.center.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 > maxDistanceSq) continue;
      if (d2 < bestDist) {
        bestDist = d2;
        best = breach;
      }
    }
  }

  consider(list);
  if (includeAllSides) {
    const breaches = ensureBreachesBySide();
    if (sideKey !== 'top') consider(breaches.top);
    if (sideKey !== 'right') consider(breaches.right);
    if (sideKey !== 'bottom') consider(breaches.bottom);
    if (sideKey !== 'left') consider(breaches.left);
  }
  return best;
}

function hasBreachOnSide(sideKey){
  const list = getBreachesForSide(sideKey);
  return Array.isArray(list) && list.length > 0;
}

function getNearestKnownBreachForZombie(sideKey, localX, localY, awarenessRadiusPx){
  const sameSideBreach = pickNearestBreachForSide(sideKey, localX, localY, awarenessRadiusPx, false);
  if (sameSideBreach) return sameSideBreach;
  const radius = Number.isFinite(awarenessRadiusPx) ? Math.max(0, awarenessRadiusPx) : 0;
  if (radius <= 0) return null;
  return pickNearestBreachForSide(sideKey, localX, localY, radius, true);
}


function getBrokenFenceSidesMap(){
  const breaches = ensureBreachesBySide();
  return {
    top: breaches.top.length > 0,
    right: breaches.right.length > 0,
    bottom: breaches.bottom.length > 0,
    left: breaches.left.length > 0,
  };
}

function getFenceBreachAwarenessRadiusPx(){
  const cfg = window.Game && window.Game.Config && window.Game.Config.WorldEvents;
  const radius = Number(cfg && cfg.attackMode && cfg.attackMode.fenceBreachAwarenessRadiusPx);
  if (!Number.isFinite(radius) || radius <= 0) return 0;
  return radius * balScale;
}

function distancePointAabb(px, py, aabb){
  if (!aabb) return Infinity;
  const dx = px < aabb.minX ? (aabb.minX - px) : (px > aabb.maxX ? (px - aabb.maxX) : 0);
  const dy = py < aabb.minY ? (aabb.minY - py) : (py > aabb.maxY ? (py - aabb.maxY) : 0);
  if (dx === 0 && dy === 0) return 0;
  return Math.hypot(dx, dy);
}

function clamp01(value, fallback){
  if (!Number.isFinite(value)) return fallback;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function getZombieAnimConfig(z){
  const type = z && z.type ? z.type : null;
  const cfg = type && type.animations && typeof type.animations === 'object' ? type.animations : null;
  const deathCommonFps = Number.isFinite(cfg?.deathCommon?.frameRateFps)
    ? cfg.deathCommon.frameRateFps
    : (function() {
        var dc = ZombieSprites?.deathCommon;
        if (Array.isArray(dc) && dc.length) dc = dc[0];
        return Number.isFinite(dc?.frameRateFps) ? dc.frameRateFps : ZOMBIE_DEFAULT_DEATH_FPS;
      })();
  return {
    walkFps: Number.isFinite(cfg?.walk?.frameRateFps) ? cfg.walk.frameRateFps : ZOMBIE_DEFAULT_WALK_FPS,
    attackFps: Number.isFinite(cfg?.attack?.frameRateFps) ? cfg.attack.frameRateFps : ZOMBIE_DEFAULT_ATTACK_FPS,
    deathFps: Number.isFinite(cfg?.death?.frameRateFps) ? cfg.death.frameRateFps : ZOMBIE_DEFAULT_DEATH_FPS,
    deathCommonFps,
  };
}

function getZombieAttackConfig(z){
  const type = z && z.type ? z.type : null;
  const cfg = type && type.attackConfig && typeof type.attackConfig === 'object' ? type.attackConfig : null;
  const legacy = type && type.attack && typeof type.attack === 'object' ? type.attack : null;
  const range = Number.isFinite(cfg?.attackRangePx)
    ? cfg.attackRangePx
    : (Number.isFinite(legacy?.attackRangePx) ? legacy.attackRangePx : ZOMBIE_DEFAULT_ATTACK_RANGE_PX);
  const cooldown = Number.isFinite(cfg?.attackCooldownSec)
    ? cfg.attackCooldownSec
    : (Number.isFinite(legacy?.attackCooldownSec) ? legacy.attackCooldownSec : ZOMBIE_DEFAULT_ATTACK_COOLDOWN_SEC);
  const hitAtRaw = Number.isFinite(cfg?.attackHitAt)
    ? cfg.attackHitAt
    : (Number.isFinite(legacy?.attackHitAt) ? legacy.attackHitAt : ZOMBIE_DEFAULT_ATTACK_HIT_AT);
  return {
    attackRangePx: Math.max(6, range),
    attackCooldownSec: Math.max(0.01, cooldown),
    attackHitAt: clamp01(hitAtRaw, ZOMBIE_DEFAULT_ATTACK_HIT_AT),
  };
}

function compareFenceTargetTie(a, b){
  const ida = (a && a.seg && a.seg.id != null) ? String(a.seg.id) : '';
  const idb = (b && b.seg && b.seg.id != null) ? String(b.seg.id) : '';
  if (ida && idb) {
    if (ida < idb) return -1;
    if (ida > idb) return 1;
  }
  const idxA = Number.isFinite(a?.index) ? a.index : 2147483647;
  const idxB = Number.isFinite(b?.index) ? b.index : 2147483647;
  if (idxA < idxB) return -1;
  if (idxA > idxB) return 1;
  return 0;
}

function selectZombieFenceTarget(zombieCenterX, zombieCenterY, attackRangePx){
  if (!Array.isArray(state.fenceSegments) || !state.fenceSegments.length) return null;
  const maxDist = Math.max(0, attackRangePx || 0);
  let best = null;
  const EPS = 1e-6;
  for (let i = 0; i < state.fenceSegments.length; i++) {
    const seg = state.fenceSegments[i];
    if (!seg || seg.broken || !Number.isFinite(seg.hp) || seg.hp <= 0 || !seg.holeAabb) continue;
    const distance = distancePointAabb(zombieCenterX, zombieCenterY, seg.holeAabb);
    if (!Number.isFinite(distance) || distance > maxDist) continue;
    const candidate = {
      seg,
      index: i,
      distance,
      isCorner: !!seg.isCorner,
    };
    if (!best) {
      best = candidate;
      continue;
    }
    if (distance < best.distance - EPS) {
      best = candidate;
      continue;
    }
    if (Math.abs(distance - best.distance) <= EPS) {
      if (candidate.isCorner && !best.isCorner) {
        best = candidate;
        continue;
      }
      if (candidate.isCorner === best.isCorner && compareFenceTargetTie(candidate, best) < 0) {
        best = candidate;
      }
    }
  }
  return best;
}

function selectZombieFenceTargetForZombie(z, attackRangePx){
  const zx = Math.cos(z.theta || 0) * (z.r || 0);
  const zy = Math.sin(z.theta || 0) * (z.r || 0);
  return selectZombieFenceTarget(zx, zy, attackRangePx);
}

function selectZombieAttackTargetForZombie(z, attackRangePx, allowSupercomputer){
  const p = zombiePos(z);
  const sc = getComputerState();
  const scCoordsValid = !!sc && Number.isFinite(sc.x) && Number.isFinite(sc.y);
  const scAlive = !!sc && Number.isFinite(sc.hp) && sc.hp > 0;
  const maxDist = Math.max(0, attackRangePx || 0);
  if (allowSupercomputer && scCoordsValid && scAlive) {
    const distToSc = Math.hypot(p.x - sc.x, p.y - sc.y);
    if (Number.isFinite(distToSc) && distToSc <= maxDist) {
      return {
        kind: 'supercomputer',
        id: 'supercomputer',
        distance: distToSc,
      };
    }
  }
  if (!allowSupercomputer && !!(z && z.knowsBreach)) return null;
  const fenceTarget = selectZombieFenceTargetForZombie(z, attackRangePx);
  if (!fenceTarget || !fenceTarget.seg) return null;
  return {
    kind: 'fence',
    seg: fenceTarget.seg,
    id: fenceTarget.seg.id || null,
    index: fenceTarget.index,
    distance: fenceTarget.distance,
    isCorner: fenceTarget.isCorner,
  };
}

function getFenceInnerLimit(z){
  return 0;
}

function findFenceSideSegment(sideKey, sideIndex){
  if (!Number.isFinite(sideIndex) || sideIndex < 0) return null;
  ensureFenceSegmentMathMeta();
  const sideMath = state.fenceSegmentsMeta && state.fenceSegmentsMeta.sideMath
    ? state.fenceSegmentsMeta.sideMath
    : null;
  const info = sideMath && sideMath[sideKey] ? sideMath[sideKey] : null;
  const list = info && Array.isArray(info.sideSegs) ? info.sideSegs : null;
  if (!list || sideIndex >= list.length) return null;
  return list[sideIndex] || null;
}

function breakAdjacentFenceSegments(seg){
  if (!seg) return 0;
  ensureFenceSegmentMathMeta();
  const sideMath = state.fenceSegmentsMeta && state.fenceSegmentsMeta.sideMath
    ? state.fenceSegmentsMeta.sideMath
    : null;
  if (!sideMath) return 0;

  function breakOneNeighbor(sideKey, sideIndex) {
    const neighbor = findFenceSideSegment(sideKey, sideIndex);
    if (!neighbor || neighbor.broken) return 0;
    neighbor.hp = 0;
    neighbor.broken = true;
    syncFenceBreachForSegment(neighbor);
    return 1;
  }

  let brokenCount = 0;

  if (seg.isCorner) {
    const cornerId = String(seg.id || seg.kind || '');
    if (cornerId === 'cornerTL') {
      brokenCount += breakOneNeighbor('top', 0);
      brokenCount += breakOneNeighbor('left', 0);
    } else if (cornerId === 'cornerTR') {
      const topInfo = sideMath.top && Array.isArray(sideMath.top.sideSegs) ? sideMath.top.sideSegs : [];
      brokenCount += breakOneNeighbor('top', Math.max(0, topInfo.length - 1));
      brokenCount += breakOneNeighbor('right', 0);
    } else if (cornerId === 'cornerBR') {
      const rightInfo = sideMath.right && Array.isArray(sideMath.right.sideSegs) ? sideMath.right.sideSegs : [];
      const bottomInfo = sideMath.bottom && Array.isArray(sideMath.bottom.sideSegs) ? sideMath.bottom.sideSegs : [];
      brokenCount += breakOneNeighbor('right', Math.max(0, rightInfo.length - 1));
      brokenCount += breakOneNeighbor('bottom', Math.max(0, bottomInfo.length - 1));
    } else if (cornerId === 'cornerBL') {
      const leftInfo = sideMath.left && Array.isArray(sideMath.left.sideSegs) ? sideMath.left.sideSegs : [];
      brokenCount += breakOneNeighbor('left', Math.max(0, leftInfo.length - 1));
      brokenCount += breakOneNeighbor('bottom', 0);
    }
    return brokenCount;
  }

  if (!Number.isFinite(seg.sideIndex)) return 0;
  const sideKey = getFenceSideKeyForSegment(seg);
  if (!sideKey) return 0;
  const offsets = [-1, 1];
  for (let i = 0; i < offsets.length; i++) {
    brokenCount += breakOneNeighbor(sideKey, seg.sideIndex + offsets[i]);
  }
  return brokenCount;
}

function applyFenceSegmentDamage(seg, amount){
  if (!seg || seg.broken) return false;
  const incomingDamage = Math.max(0, amount || 0);
  if (incomingDamage <= 0) return false;
  const armorFlat = getFenceArmorFlat();
  const finalDamage = Math.max(0, incomingDamage - armorFlat);
  if (finalDamage <= 0) return false;
  const wasBroken = !!seg.broken;
  seg.hp = clamp(seg.hp - finalDamage, 0, seg.maxHp);
  seg.broken = seg.hp <= 0;
  if (seg.broken !== wasBroken) {
    syncFenceBreachForSegment(seg);
    if (seg.broken) breakAdjacentFenceSegments(seg);
  }
  return true;
}

function getZombieAttackDamage(z){
  const id = z && z.type && z.type.id ? z.type.id : 'unknown';
  const value = z && z.type ? z.type.attackDamage : null;
  if (Number.isFinite(value) && value > 0) return value;
  if (!warnedZombieAttackDamage.has(id)) {
    warnedZombieAttackDamage.add(id);
    console.warn('[Zombies] Missing attackDamage in config, using fallback for', id);
  }
  return ZOMBIE_DEFAULT_ATTACK_DAMAGE;
}

function getZombieWaveAtkMult(){
  const value = Number.isFinite(state && state.zombieWaveAtkMult) ? state.zombieWaveAtkMult : 1;
  return Math.max(0, value);
}

function getZombieFinalAttackDamage(z, damageMul){
  const baseDamage = getZombieAttackDamage(z);
  const attackModeMul = Number.isFinite(damageMul) ? Math.max(0, damageMul) : 1;
  return baseDamage * attackModeMul * getZombieWaveAtkMult();
}

function isBlockingModalOpen(){
  const ids = [
    'menuOverlay',
    'crateModal',
    'dismantleModal',
    'resetTalentsModal',
    'talentOverlay',
    'supercomputerMenuOverlay',
    'modsHangarOverlay',
    'modsTankWallOverlay',
    'criticalOverlay',
    'mergePopupModal',
    'achievementsModal',
    'achievementPopup',
    'productionLineStorageModal',
  ];
  for (let i = 0; i < ids.length; i++) {
    const el = document.getElementById(ids[i]);
    if (!el) continue;
    const visible = !el.classList.contains('hidden') && el.getAttribute('aria-hidden') !== 'true';
    if (visible) return true;
  }
  return false;
}

function pickFenceSegmentByPoint(px, py){
  if (!Array.isArray(state.fenceSegments) || !state.fenceSegments.length) return null;
  const lx = px - center.x;
  const ly = py - center.y;
  let best = null;
  let bestDist = Infinity;
  const pad = Math.max(10, BAL.fenceWidth * 0.8);
  for (let i = 0; i < state.fenceSegments.length; i++) {
    const seg = state.fenceSegments[i];
    if (!seg || !seg.holeAabb) continue;
    const a = seg.holeAabb;
    if (lx < a.minX - pad || lx > a.maxX + pad || ly < a.minY - pad || ly > a.maxY + pad) continue;
    const d = Math.hypot(lx - seg.x, ly - seg.y);
    if (d < bestDist) {
      bestDist = d;
      best = seg;
    }
  }
  return best;
}

function tryRepairFenceSegmentAt(px, py){
  const repair = getFenceRepairConfig();
  if (!repair.enabled) return false;
  const seg = pickFenceSegmentByPoint(px, py);
  if (!seg || seg.hp >= seg.maxHp) return false;
  if (state.coins < repair.costCoins) {
    popText(px, py, t('fenceRepairNoCoins'), '#ff9c7a');
    return true;
  }
  state.coins -= repair.costCoins;
  const wasBroken = !!seg.broken;
  seg.hp = seg.maxHp;
  seg.broken = false;
  if (seg.broken !== wasBroken) syncFenceBreachForSegment(seg);
  popText(px, py, t('fenceRepairDone'), '#7dffb2');
  return true;
}

function resolveFenceFrameScale(frame){
  return Number.isFinite(frame?.scale) ? frame.scale : 1;
}

function zombieFenceLimit(z){
  let outerFenceSide = BAL.fenceRadius + BAL.fenceWidth * 0.5;
  const dx = Math.cos(z.theta ?? 0);
  const dy = Math.sin(z.theta ?? 0);
  const layoutTuning = (window.Game && window.Game.Config && window.Game.Config.LayoutTuning) || {};
  const offsetBySide = layoutTuning.zombieFenceOffsetPxBySide || {};
  let sideKey = 'right';
  if (Math.abs(dy) > Math.abs(dx)) sideKey = dy >= 0 ? 'bottom' : 'top';
  else sideKey = dx >= 0 ? 'right' : 'left';
  const sideOffset = Number.isFinite(offsetBySide[sideKey]) ? offsetBySide[sideKey] : 0;
  outerFenceSide += sideOffset * balScale;
  const denom = Math.max(Math.abs(dx), Math.abs(dy)) || 1;
  const outerLimit = outerFenceSide / denom + zombieCollisionRadius(z);

  const localX = dx * (z.r || 0);
  const localY = dy * (z.r || 0);
  const worldX = center.x + localX;
  const worldY = center.y + localY;
  const sideAtPoint = getSideByPosition(worldX, worldY);
  const breachPad = Math.max(2, zombieCollisionRadius(z) * 0.45);
  const activeBreach = getActiveBreachAtPoint(sideAtPoint, localX, localY, breachPad);
  if (activeBreach) {
    z.breached = true;
    z.breachSegmentId = activeBreach.segmentId;
    return getFenceInnerLimit(z);
  }

  const segByPoint = pickFenceSegmentByPoint(worldX, worldY);
  const segByPointBrokenAtPoint = !!(
    segByPoint
    && segByPoint.broken
    && segByPoint.holeAabb
    && pointInAabb(localX, localY, segByPoint.holeAabb, Math.max(1, zombieCollisionRadius(z) * 0.2))
  );
  const segByTheta = getFenceSegmentForTheta(z.theta);
  const seg = segByPointBrokenAtPoint ? segByPoint : segByTheta;
  if (seg && seg.broken && !z.breached && z.r <= outerLimit + Math.max(2, BAL.fenceWidth * 0.15)) {
    z.breached = true;
    z.breachSegmentId = seg.id || null;
  }
  if (z.breached) {
    // Zombie is at an active breach point — allow passage
    if (activeBreach) return getFenceInnerLimit(z);
    // Current segment is broken — allow passage
    if (segByPointBrokenAtPoint) return getFenceInnerLimit(z);
    // Zombie is deep inside (past the fence) — don't push back out
    const innerLimit = getFenceInnerLimit(z);
    const deepThreshold = innerLimit + Math.max(2, BAL.fenceWidth * 0.2);
    if (z.r <= deepThreshold) return innerLimit;
    // Zombie is at an intact segment near fence edge — reset breach status
    z.breached = false;
    z.breachSegmentId = null;
    return outerLimit;
  }
  if (segByPoint && segByPoint.broken) return getFenceInnerLimit(z);
  return outerLimit;
}

function startZombieDying(z){
  if (z.state === 'dying') return;
  z.state = 'dying';
  z.attackState = 'walk';
  z.attackTargetId = null;
  z.attackDidHit = false;
  z.deathDuration = 0.65;
  z.deathTimer = z.deathDuration;
  z.deathProgress = 0;
  z.hp = 0;

  // Select death animation using deterministic helper (70% personal, 30% common)
  const personalDeath = z.type?.death || null;
  const commonDeath = ZombieSprites.deathCommon || null;
  const pickDeathAnim = Game?.Combat?.pickDeathAnim || function(c, p, r) {
    // Inline fallback if Combat module not loaded
    var rc = c;
    if (Array.isArray(c)) rc = c.length ? c[Math.floor(Math.random() * c.length)] : null;
    if (p && rc) return r < 0.7 ? p : rc;
    return p || rc || null;
  };
  z.deathAnim = pickDeathAnim(commonDeath, personalDeath, Math.random());
  
  z.deathFrame = 0; // current frame of death animation
  const animCfg = getZombieAnimConfig(z);
  /* Check if common was selected: compare against all variants if array */
  let isCommonDeathAnim = false;
  if (z.deathAnim && ZombieSprites.deathCommon) {
    if (Array.isArray(ZombieSprites.deathCommon)) {
      for (let dci = 0; dci < ZombieSprites.deathCommon.length; dci++) {
        if (z.deathAnim === ZombieSprites.deathCommon[dci]) { isCommonDeathAnim = true; break; }
      }
    } else {
      isCommonDeathAnim = z.deathAnim === ZombieSprites.deathCommon;
    }
  }
  z.deathAnimSpeed = isCommonDeathAnim ? animCfg.deathCommonFps : animCfg.deathFps;

  const corpseHelper = Game?.CorpseDespawn;
  const corpseCfg = ZombieSprites && ZombieSprites.corpseConfig ? ZombieSprites.corpseConfig : null;
  let animDuration = null;
  if (corpseHelper && corpseHelper.computeDeathAnimDuration) {
    animDuration = corpseHelper.computeDeathAnimDuration(z.deathAnim, z.deathAnimSpeed, z.deathDuration);
  } else {
    const frames = z.deathAnim && Number.isFinite(z.deathAnim.frames) ? Math.max(1, z.deathAnim.frames) : null;
    animDuration = frames ? Math.max(0, frames - 1) / (z.deathAnimSpeed || 10) : (z.deathDuration || 0);
  }
  if (Number.isFinite(animDuration) && animDuration > 0) {
    z.deathDuration = animDuration;
    z.deathTimer = z.deathDuration;
  }

  if (corpseHelper && corpseHelper.computeCorpseTiming) {
    var corpseTiming = corpseHelper.computeCorpseTiming({
      deathAnim: z.deathAnim,
      deathAnimSpeed: z.deathAnimSpeed,
      deathDuration: z.deathDuration,
      corpseConfig: corpseCfg,
    });
    z.corpseTimerTotal = corpseTiming.corpseTimerTotal;
    z.corpseTimerLeft = corpseTiming.corpseTimerTotal;
  } else {
    var corpseDespawnSec = Number.isFinite(corpseCfg && corpseCfg.corpseDespawnSec)
      ? Math.max(0, Number(corpseCfg.corpseDespawnSec))
      : 3;
    var total = (Number.isFinite(animDuration) ? animDuration : (z.deathDuration || 0)) + corpseDespawnSec;
    z.corpseTimerTotal = total;
    z.corpseTimerLeft = total;
  }
  z.corpseTimer = z.corpseTimerLeft;

  state.coins += Math.floor(coinsForKill(z.level ?? 1, z.rewardMul) * BAL.zombieKillCoinsMul);
  state.kills += 1;
  if (window.Game && window.Game.Telemetry) window.Game.Telemetry.event('zombieKill');
  if (window.Game && window.Game.TelemetryLogger) window.Game.TelemetryLogger.log('zombieKill', { level: z.level });
  if (window.Game && window.Game.Funnel) window.Game.Funnel.trackStep('first_battle', { level: z.level });
  const mods = getMods();
  const lvl = z.level ?? 1;
  const baseXp = 9 * Math.pow(2, lvl - 1);
  const activeMul = nowSec() < state.activeEffects.economyUntil ? 1.6 : 1;
  grantXP(Math.floor(baseXp * mods.xpMul * activeMul * BAL.zombieKillXpMul));
  {
    const _PLR = window.Game && window.Game.ProductionLineRender;
    if (_PLR && typeof _PLR.triggerConveyorWork === 'function') {
      _PLR.triggerConveyorWork();
    }
  }
  const p = zombiePos(z);
  burst(p.x, p.y, 18, 'rgba(125,255,178,.18)');
}

function stepZombies(dt){
  const slow = (state.empUntil && nowSec() < state.empUntil) ? 0.5 : 1;
  const attackMult = getZombieAttackMultipliers();
  const speedMul = attackMult.speedMult;
  const attackActive = isZombieAttackModeActive();
  const shouldAttackTargets = shouldZombieAttemptAttack();
  const fenceAttackDamageMul = getZombieFenceAttackDamageMul();
  const sc = getComputerState();
  const scCoordsValid = !!sc && Number.isFinite(sc.x) && Number.isFinite(sc.y);
  const breachAwarenessRadiusPx = getFenceBreachAwarenessRadiusPx();
  for (const z of state.zombies){
    if (z.state === 'dying'){
      z.deathTimer -= dt;
      z.deathProgress = clamp(1 - z.deathTimer / (z.deathDuration || 0.65), 0, 1);
      if (Number.isFinite(z.corpseTimerLeft)) {
        z.corpseTimerLeft -= dt;
      } else if (Number.isFinite(z.corpseTimer)) {
        z.corpseTimerLeft = z.corpseTimer - dt;
      }
      if (Number.isFinite(z.corpseTimerLeft)) z.corpseTimer = z.corpseTimerLeft;
      
      // Advance death animation frame (non-loop: clamp to last frame)
      if (z.deathAnim) {
        const maxFrame = (z.deathAnim.frames || 1) - 1;
        z.deathFrame = Math.min((z.deathFrame || 0) + dt * (z.deathAnimSpeed || 10), maxFrame);
      }
      
      z.anim += dt * 4.5;
      continue;
    }
    if (!z.attackState || (z.attackState !== 'walk' && z.attackState !== 'attack' && z.attackState !== 'cooldown')) {
      z.attackState = 'walk';
    }
    if (!Number.isFinite(z.attackAnimTimeSec) || z.attackAnimTimeSec < 0) z.attackAnimTimeSec = 0;
    if (!Number.isFinite(z.attackCooldownTimerSec) || z.attackCooldownTimerSec < 0) z.attackCooldownTimerSec = 0;
    if (!Number.isFinite(z.attackRangePx) || z.attackRangePx <= 0) z.attackRangePx = getZombieAttackConfig(z).attackRangePx;
    if (!Number.isFinite(z.attackCooldownSec) || z.attackCooldownSec <= 0) z.attackCooldownSec = getZombieAttackConfig(z).attackCooldownSec;
    if (!Number.isFinite(z.attackHitAt)) z.attackHitAt = getZombieAttackConfig(z).attackHitAt;
    z.attackHitAt = clamp01(z.attackHitAt, ZOMBIE_DEFAULT_ATTACK_HIT_AT);
    if (!Number.isFinite(z.walkFrameRateFps) || z.walkFrameRateFps <= 0) z.walkFrameRateFps = getZombieAnimConfig(z).walkFps;
    if (!Number.isFinite(z.attackFrameRateFps) || z.attackFrameRateFps <= 0) z.attackFrameRateFps = getZombieAnimConfig(z).attackFps;
    if (!Number.isFinite(z.walkAnimFrame)) z.walkAnimFrame = 0;

    const typeId = z.type?.id || '';
    let balSpeedMul = getZombieBalanceMul(typeId, 'speedMul');
    const balAtkSpd = getZombieBalanceMul(typeId, 'attackSpeedMul');

    // ── Chip: slow from ice/acid pools (mods 11, 14) ──
    if (z.chipSlowUntil && (typeof performance !== 'undefined' ? performance.now() / 1000 : Date.now() / 1000) < z.chipSlowUntil) {
      balSpeedMul *= Math.max(0.05, z.chipSlowFactor || 1);
    } else {
      z.chipSlowFactor = 1; // reset
    }

    const shouldMove = !shouldAttackTargets || z.attackState !== 'attack';
    const prevTheta = z.theta;
    const prevX = center.x + Math.cos(prevTheta) * z.r;
    const prevY = center.y + Math.sin(prevTheta) * z.r;
    z.side = getSideByPosition(prevX, prevY);
    const prevLocalX = prevX - center.x;
    const prevLocalY = prevY - center.y;
    const nearestBreach = z.breached
      ? null
      : getNearestKnownBreachForZombie(z.side, prevLocalX, prevLocalY, breachAwarenessRadiusPx);
    z.knowsBreach = !!nearestBreach;
    const allowSupercomputerTarget = !!z.breached && attackActive;

    let radialSpeed = 0;
    if (shouldMove) {
      if (z.breached && scCoordsValid) {
        const toScX = sc.x - prevX;
        const toScY = sc.y - prevY;
        const distToSc = Math.hypot(toScX, toScY);
        const blendToSc = 1 - Math.exp(-dt * (z.joinSpeed ?? BAL.edgeJoinSpeed) * speedMul * balSpeedMul);
        const desiredX = distToSc > 1e-6 ? (prevX + toScX * blendToSc) : prevX;
        const desiredY = distToSc > 1e-6 ? (prevY + toScY * blendToSc) : prevY;
        const moved = resolveZombieWallMove(z, prevX, prevY, desiredX, desiredY, dt);
        const relX = moved.x - center.x;
        const relY = moved.y - center.y;
        const movedR = Math.hypot(relX, relY);
        if (Number.isFinite(movedR) && movedR > 0) {
          z.theta = Math.atan2(relY, relX);
          z.anchorTheta = z.theta;
          z.r = movedR;
          z.targetR = Math.hypot(sc.x - center.x, sc.y - center.y);
        }
        // Push breached zombie off intact fence segments (bottom corners fix):
        // If the zombie's new position overlaps an intact fence segment,
        // reduce r so it sits just inside the fence inner edge.
        const segAtPos = pickFenceSegmentByPoint(moved.x, moved.y);
        if (segAtPos && !segAtPos.broken) {
          const innerFence = BAL.fenceRadius - BAL.fenceWidth * 0.5;
          const dxF = Math.cos(z.theta);
          const dyF = Math.sin(z.theta);
          const denomF = Math.max(Math.abs(dxF), Math.abs(dyF)) || 1;
          const innerR = Math.max(0, innerFence / denomF - zombieCollisionRadius(z) * 0.5);
          if (z.r > innerR) {
            z.r = innerR;
          }
        }
        z.side = getSideByPosition(moved.x, moved.y);
        radialSpeed = Math.hypot(moved.x - prevX, moved.y - prevY);
      } else {
        if (!z.breached && nearestBreach && nearestBreach.center) {
          const breachTheta = Math.atan2(nearestBreach.center.y, nearestBreach.center.x);
          if (!Number.isFinite(z.anchorTheta)) z.anchorTheta = z.theta || 0;
          const anchorSteerAmt = clamp(dt * (z.joinSpeed ?? BAL.edgeJoinSpeed) * speedMul * balSpeedMul, 0, 1);
          z.anchorTheta = smoothAngle(z.anchorTheta, breachTheta, anchorSteerAmt);
        }

        z.swayPhase += dt * z.swaySpeed * slow * speedMul * balSpeedMul;
        const swayOffset = Math.sin(z.swayPhase) * BAL.zombieSwayAmp;
        const desiredTheta = z.anchorTheta + swayOffset;

        const blend = 1 - Math.exp(-dt * (z.joinSpeed ?? BAL.edgeJoinSpeed) * speedMul * balSpeedMul);
        const fenceLimit = zombieFenceLimit(z);
        const retreatOffset = z.breached ? 0 : getZombieIdleRetreatOffsetPx(z);
        z.targetR = fenceLimit + retreatOffset;
        let desiredR = z.r + (z.targetR - z.r) * blend;
        if (!z.breached && shouldAttackTargets) desiredR -= BAL.zombieFencePush * dt * speedMul * balSpeedMul;

        z.theta = desiredTheta;
        z.r = desiredR;

        if (z.targetR < fenceLimit) z.targetR = fenceLimit;
        if (z.r < fenceLimit) z.r = fenceLimit;

        const desiredX = center.x + Math.cos(z.theta) * z.r;
        const desiredY = center.y + Math.sin(z.theta) * z.r;
        const moved = resolveZombieWallMove(z, prevX, prevY, desiredX, desiredY, dt);
        const relX = moved.x - center.x;
        const relY = moved.y - center.y;
        const movedR = Math.hypot(relX, relY);
        if (Number.isFinite(movedR) && movedR > 0) {
          z.theta = Math.atan2(relY, relX);
          z.anchorTheta = z.theta - swayOffset;
          z.r = Math.max(movedR, zombieFenceLimit(z));
          if (z.targetR < zombieFenceLimit(z)) z.targetR = zombieFenceLimit(z);
        }
        z.side = getSideByPosition(center.x + relX, center.y + relY);
        radialSpeed = Math.abs(desiredR - z.r) + Math.abs(swayOffset) * 2;
      }

      const dTheta = Math.atan2(Math.sin(z.theta - prevTheta), Math.cos(z.theta - prevTheta));
      const moving = Math.abs(dTheta) > 0.0005;
      const targetHeading = moving ? clamp(dTheta * 4.2, -0.25, 0.25) : 0;
      z.heading = smoothAngle(z.heading ?? 0, targetHeading, dt * 6);

      const walkAnimMul = z.type?.animSpeed ?? 1.0;
      const walkAnimAdvance = dt * walkAnimMul * (1.4 + radialSpeed * 2.0) * slow * speedMul * balSpeedMul;
      z.walkAnimFrame += walkAnimAdvance * Math.max(0.01, z.walkFrameRateFps) / Math.max(1, ZOMBIE_DEFAULT_WALK_FPS);
    }

    const targetNow = shouldAttackTargets ? selectZombieAttackTargetForZombie(z, z.attackRangePx, allowSupercomputerTarget) : null;
    z.debugAttackTargetId = targetNow ? (targetNow.kind === 'fence' ? (targetNow.seg ? targetNow.seg.id : null) : 'supercomputer') : null;

    // ── Chip: calming effect (mod 9) — suppress attacks ──
    const isCalmed = z.calmUntil && (typeof performance !== 'undefined' ? performance.now() / 1000 : Date.now() / 1000) < z.calmUntil;

    if (!shouldAttackTargets || isCalmed) {
      z.attackState = 'walk';
      z.attackAnimTimeSec = 0;
      z.attackCooldownTimerSec = 0;
      z.attackDidHit = false;
      z.attackTargetId = null;
    } else if (z.attackState === 'walk') {
      if (targetNow) {
        z.attackState = 'attack';
        z.attackAnimTimeSec = 0;
        z.attackDidHit = false;
        z.attackTargetId = targetNow.kind === 'fence' ? (targetNow.seg && targetNow.seg.id ? targetNow.seg.id : null) : 'supercomputer';
      }
    } else if (z.attackState === 'attack') {
      z.attackAnimTimeSec += dt;
      const attackFrames = Math.max(1, Number.isFinite(z.type?.attack?.frames) ? z.type.attack.frames : 1);
      const attackRateFps = Math.max(0.01, z.attackFrameRateFps * (Number.isFinite(balAtkSpd) ? balAtkSpd : 1));
      const attackDurationSec = attackFrames / attackRateFps;
      const attackHitTimeSec = attackDurationSec * z.attackHitAt;

      if (!z.attackDidHit && z.attackAnimTimeSec >= attackHitTimeSec) {
        const hitTarget = selectZombieAttackTargetForZombie(z, z.attackRangePx, allowSupercomputerTarget);
        if (hitTarget && hitTarget.kind === 'fence' && hitTarget.seg) {
          applyFenceSegmentDamage(hitTarget.seg, getZombieFinalAttackDamage(z, fenceAttackDamageMul));
          z.attackTargetId = hitTarget.seg.id || z.attackTargetId || null;
        } else if (hitTarget && hitTarget.kind === 'supercomputer') {
          applySupercomputerDamage(getZombieFinalAttackDamage(z, fenceAttackDamageMul));
          z.attackTargetId = 'supercomputer';
        }
        z.attackDidHit = true;
      }

      if (z.attackAnimTimeSec >= attackDurationSec) {
        z.attackState = 'cooldown';
        z.attackCooldownTimerSec = z.attackCooldownSec;
        z.attackAnimTimeSec = 0;
        z.attackDidHit = false;
        z.attackTargetId = null;
      }
    } else if (z.attackState === 'cooldown') {
      z.attackCooldownTimerSec = Math.max(0, z.attackCooldownTimerSec - dt);
      if (z.attackCooldownTimerSec <= 0) {
        if (targetNow) {
          z.attackState = 'attack';
          z.attackAnimTimeSec = 0;
          z.attackDidHit = false;
          z.attackTargetId = targetNow.kind === 'fence' ? (targetNow.seg && targetNow.seg.id ? targetNow.seg.id : null) : 'supercomputer';
        } else {
          z.attackState = 'walk';
          z.attackTargetId = null;
        }
      }
    }

    z.anim = z.walkAnimFrame;

    if (z.dotUntil){
      if (nowSec() < z.dotUntil){
        applyDamageToZombie(z, ((z.dotDps || 0) * dt) / attackMult.damageMult, 'tank');
      } else {
        z.dotUntil = 0;
        z.dotDps = 0;
      }
    }
  }
}

function pickBurstTargetsFallback(candidates, count){
  const list = Array.isArray(candidates) ? candidates : [];
  const total = list.length;
  const n = Math.max(0, Math.floor(count || 0));
  const result = [];
  if (!total || !n) return result;
  for (let i = 0; i < n; i++) {
    result.push(list[i % total]);
  }
  return result;
}

function applyDamageToZombie(zombie, rawDamage, sourceKind){
  if (!zombie || zombie.state === 'dying') return 0;
  const beforeHp = Number.isFinite(zombie.hp) ? zombie.hp : 0;
  if (beforeHp <= 0) return 0;
  const incomingDamage = Number.isFinite(rawDamage) ? Math.max(0, rawDamage) : 0;
  if (incomingDamage <= 0) return 0;
  const nextHp = Math.max(0, beforeHp - incomingDamage);
  zombie.hp = nextHp;
  const appliedDamage = beforeHp - nextHp;
  if (sourceKind === 'tank') addTankDamageDealt(appliedDamage);
  return appliedDamage;
}

// ---------- Combat: visible projectiles ----------
function stepTanks(dt){
  const mods = getMods();
  const activeSpeed = nowSec() < state.activeEffects.speedUntil ? 1.35 : 1;
  for (const cell of state.cells){
    const tank = cell.tank;
    if (!tank || !tank.onTrack) continue;
    const balSpeedMul = getTankBalanceMul(tank.level, 'speedMul');
    const balAtkSpeedMul = getTankBalanceMul(tank.level, 'attackSpeedMul');
    const angularSpeed = BAL.tankOrbitSpeed * speedMult() * mods.orbitSpeedMul * activeSpeed * balSpeedMul;
    if (cell.orbitPhase !== undefined) cell.orbitPhase += dt * angularSpeed;

    tank.cooldown = Math.max(0, tank.cooldown - dt);
    const tankCfgForLevel = TankSprites?.getTank?.(tank.level);
    const hasSpriteConfig = TankSprites?.ready && !!(tankCfgForLevel && tankCfgForLevel.body && tankCfgForLevel.cannon);
    if (hasSpriteConfig){
      const bodyCfg = tankCfgForLevel.body;
      tank.bodyAnim += dt * (bodyCfg.animSpeed ?? 2.0);
    }

    const s = tankStats(tank.level);

    // pick target far ahead in movement direction (no shooting "backward")
    const pos = tankOrbitState(cell, nowSec());
    const sx = pos.x;
    const sy = pos.y;
    const fwdX = Math.cos(pos.heading);
    const fwdY = Math.sin(pos.heading);
    const forwardMin = 0;

    const candidates = [];
    for (const z of state.zombies){
      if (z.state === 'dying') continue;
      const p = zombiePos(z);
      const dx = p.x - sx;
      const dy = p.y - sy;
      const d = Math.hypot(dx, dy);
      if (!d || d > s.range) continue;
      const forwardDist = dx * fwdX + dy * fwdY;
      if (forwardDist <= forwardMin) continue;
      const sideDist = Math.hypot(dx - fwdX * forwardDist, dy - fwdY * forwardDist);
      candidates.push({ z, d, forwardDist, sideDist });
    }
    candidates.sort((a, b) => {
      if (b.forwardDist !== a.forwardDist) return b.forwardDist - a.forwardDist;
      return a.sideDist - b.sideDist;
    });
    const best = candidates.length ? candidates[0].z : null;
    const targetPool = candidates.map(c => c.z);

    if (hasSpriteConfig){
      const cannon = TankSprites.pickCannon(tank.level);
      const cannonCfg = cannon?.cfg;

      if (best && tank.cooldown <= 0 && cannonCfg){
        tank.cannonAnim += dt * (cannonCfg.animSpeed ?? 10.0) * speedMult() * balAtkSpeedMul;
        const frames = cannonCfg.frames || 1;
        const fireFrame = cannonCfg.fireFrame ?? 1;
        const frameIndex = Math.floor(tank.cannonAnim) % frames;

        if (frameIndex === fireFrame && !tank.firedThisCycle){
          tank.firedThisCycle = true;

          const muzzle = cannonCfg.muzzle || {x: 28, y: 0};
          const mx = sx + Math.cos(pos.heading) * muzzle.x - Math.sin(pos.heading) * muzzle.y;
          const my = sy + Math.sin(pos.heading) * muzzle.x + Math.cos(pos.heading) * muzzle.y;

          const Combat = window.Game && window.Game.Combat;
          const count = Combat && Combat.getProjectileCount ? Combat.getProjectileCount(tank.level) : (tank.level <= 5 ? 1 : tank.level <= 10 ? 2 : 3);
          const targeting = window.Game && window.Game.Targeting;
          const targets = targeting && targeting.pickBurstTargetsBySide
            ? targeting.pickBurstTargetsBySide(targetPool, count, { sx: mx, sy: my, heading: pos.heading, getPos: zombiePos })
            : (targeting && targeting.pickBurstTargets ? targeting.pickBurstTargets(targetPool, count) : pickBurstTargetsFallback(targetPool, count));
          const primaryTarget = targets.length ? targets[0] : best;

          fireTankProjectile({sx: mx, sy: my, target: primaryTarget, targets, tank, stats: s, mods, cellIndex: cell.i, targetPool: targetPool, heading: pos.heading});
        }
      }

      if (tank.cooldown > 0 || !best){
        tank.cannonAnim = 0;
        tank.firedThisCycle = false;
      }
      continue;
    }

    if (tank.cooldown > 0 || !best) continue;
    const Combat = window.Game && window.Game.Combat;
    const count = Combat && Combat.getProjectileCount ? Combat.getProjectileCount(tank.level) : (tank.level <= 5 ? 1 : tank.level <= 10 ? 2 : 3);
    const targeting = window.Game && window.Game.Targeting;
    const targets = targeting && targeting.pickBurstTargetsBySide
      ? targeting.pickBurstTargetsBySide(targetPool, count, { sx: sx, sy: sy, heading: pos.heading, getPos: zombiePos })
      : (targeting && targeting.pickBurstTargets ? targeting.pickBurstTargets(targetPool, count) : pickBurstTargetsFallback(targetPool, count));
    const primaryTarget = targets.length ? targets[0] : best;
    fireTankProjectile({sx, sy, target: primaryTarget, targets, tank, stats: s, mods, cellIndex: cell.i, targetPool: targetPool, heading: pos.heading});
  }
}

const MAX_BURST_PARTICLES = 14;
const MAX_TRAIL_ALPHA = 0.45;
let _nextShotId = 1;
let projectilesNext = [];

function resetProjectile(p){
  p.x = 0;
  p.y = 0;
  p.toX = 0;
  p.toY = 0;
  p.toZombieId = null;
  p.speed = 0;
  p.r = 0;
  p.color = '';
  p.glow = '';
  p.trail = '';
  p.kind = '';
  p.dmg = 0;
  p.aoe = 0;
  p.level = 0;
  p.prof = null;
  p.bulletCfg = null;
  p.rotation = 0;
  p.animTime = 0;
  p.effectIntensity = 1;
  p.shotId = 0;
  p.life = 0;
  p.isTankAttackingZombie = false;
  p.tank = null;
  p.chipShotMods = null;
  p.isMatryoshkaChild = false;
  p.isChainChild = false;
  p.isCascadeChild = false;
}

const projectilePool = (window.Game && window.Game.ObjectPool && window.Game.ObjectPool.create)
  ? window.Game.ObjectPool.create({ max: 600, reset: resetProjectile })
  : null;

function releaseProjectile(p){
  if (projectilePool) projectilePool.release(p);
}

/** Get combined chip-level damage multiplier for a hangar cell.
 *  Each chip installed adds +10% per level to attack power. */
function getChipLevelDmgMul(cellIndex){
  var HUI = window.Game && window.Game.HangarChipsUI;
  if (!HUI || typeof HUI.getPlayerChips !== 'function') return 1;
  var cells = typeof HUI.getCells === 'function' ? HUI.getCells() : null;
  if (!cells || !cells[cellIndex]) return 1;
  var cell = cells[cellIndex];
  var chips = HUI.getPlayerChips();
  if (!Array.isArray(chips) || !chips.length) return 1;
  var bonusPct = 0;
  /* Sum bonuses from all installed chips in this cell */
  var allSlots = [];
  if (cell.redSlots) {
    if (cell.redSlots.slot1) allSlots.push(cell.redSlots.slot1);
    if (cell.redSlots.slot2) allSlots.push(cell.redSlots.slot2);
  }
  if (cell.yellowSlots) {
    if (cell.yellowSlots.slot1) allSlots.push(cell.yellowSlots.slot1);
    if (cell.yellowSlots.slot2) allSlots.push(cell.yellowSlots.slot2);
    if (cell.yellowSlots.slot3) allSlots.push(cell.yellowSlots.slot3);
    if (cell.yellowSlots.slot4) allSlots.push(cell.yellowSlots.slot4);
  }
  for (var i = 0; i < allSlots.length; i++) {
    var installedChip = allSlots[i];
    if (!installedChip) continue;
    var chipId = installedChip.chipId;
    /* find the player's chip entry to get its level */
    for (var j = 0; j < chips.length; j++) {
      if (chips[j].chipId === chipId) {
        bonusPct += typeof HUI.chipLevelBonus === 'function' ? HUI.chipLevelBonus(chips[j].level) : (chips[j].level * 10);
        break;
      }
    }
  }
  return bonusPct > 0 ? 1 + bonusPct / 100 : 1;
}

function fireTankProjectile({sx, sy, target, targets, tank, stats, mods, cellIndex, targetPool, heading: inHeading}){
  const isTankAttackingZombie = false;
  const powerTier = tank.powerTier ?? computePowerTier(getComputerLevel());
  const effectIntensity = 1 + powerTier * 0.25;
  const baseTargets = Array.isArray(targets) && targets.length ? targets : (target ? [target] : []);
  if (!baseTargets.length) return;
  const tp = zombiePos(baseTargets[0]);

  // ── Chip modifier system ──
  const ChipFx = window.Game && window.Game.ChipEffects;
  const chipShotMods = ChipFx && typeof ChipFx.applyShotModifiers === 'function'
    ? ChipFx.applyShotModifiers({ cellIndex: cellIndex, tank: tank, stats: stats, targets: baseTargets, sx: sx, sy: sy })
    : null;

  // Multi-barrel: N projectiles with damage split (T3)
  const Combat = window.Game && window.Game.Combat;
  const N = Combat && Combat.getProjectileCount ? Combat.getProjectileCount(tank.level) : (tank.level <= 5 ? 1 : tank.level <= 10 ? 2 : 3);

  // Mod 1 (Double Shot): extra projectile per barrel
  const chipExtraProj = chipShotMods && chipShotMods.extraProjectiles ? chipShotMods.extraProjectiles : 0;
  const totalProjectiles = N + N * chipExtraProj;

  // Mod 3 (Matryoshka): big shot has ×2 dmg, ×1.25 size
  let chipDmgMul = 1;
  let chipSizeMul = 1;
  if (chipShotMods && chipShotMods.isMatryoshka) {
    chipDmgMul = chipShotMods.matryoshkaDmgMul;
    chipSizeMul = chipShotMods.matryoshkaSizeMul;
  }
  // Mod 8 (Nuke): ×3 dmg, 100px aoe
  let chipAoe = stats.aoe;
  if (chipShotMods && chipShotMods.isNuke) {
    chipDmgMul *= chipShotMods.nukeDmgMul;
    chipAoe = chipShotMods.nukeRadius;
  }

  // Mod 1: each projectile gets full barrel damage (split only by barrel count N, NOT by chip extras)
  const chipLevelDmgMul = getChipLevelDmgMul(cellIndex);
  const splitDmg = (stats.dmg * chipDmgMul * chipLevelDmgMul) / N;
  const shotId = _nextShotId++;
  const targeting = window.Game && window.Game.Targeting;
  // Pick targets for base barrels (N targets)
  const burstTargets = targeting && targeting.pickBurstTargets ? targeting.pickBurstTargets(baseTargets, N) : pickBurstTargetsFallback(baseTargets, N);
  if (!burstTargets.length) return;

  // For chip extra projectiles (mod 1), pick separate targets using side-based targeting
  // Uses the same pickBurstTargetsBySide algorithm as multi-barrel tanks
  let chipExtraTargetList = burstTargets;
  if (chipExtraProj > 0) {
    const fullPool = Array.isArray(targetPool) && targetPool.length > 0 ? targetPool : baseTargets;
    // Exclude primary targets from the pool to force different targets
    const usedIds = {};
    for (let ui = 0; ui < burstTargets.length; ui++) usedIds[burstTargets[ui].id] = true;
    const altPool = [];
    for (let ai = 0; ai < fullPool.length; ai++) {
      if (!usedIds[fullPool[ai].id]) altPool.push(fullPool[ai]);
    }
    const pool = altPool.length > 0 ? altPool : fullPool;
    const targeting = window.Game && window.Game.Targeting;
    if (targeting && targeting.pickBurstTargetsBySide && Number.isFinite(inHeading)) {
      chipExtraTargetList = targeting.pickBurstTargetsBySide(pool, N * chipExtraProj, {
        sx: sx, sy: sy, heading: inHeading, getPos: zombiePos
      });
    } else {
      chipExtraTargetList = pickBurstTargetsFallback(pool, N * chipExtraProj);
    }
  }
  // Combined target list: [base barrel targets..., chip extra targets...]
  const allTargets = [];
  for (let ti = 0; ti < N; ti++) allTargets.push(burstTargets[ti % burstTargets.length]);
  for (let ti = 0; ti < N * chipExtraProj; ti++) allTargets.push(chipExtraTargetList[ti % chipExtraTargetList.length]);

  const bulletCfgBase = stats && stats.bulletCfg ? stats.bulletCfg : null;
  if (!bulletCfgBase) {
    console.warn('[Combat] Bullet config is missing for tank level', tank.level, '(id=' + (stats?.bulletId || 'bullet_base') + ', level=' + (stats?.bulletLevel || 1) + '). Shot skipped.');
    return;
  }
  // Apply chip modifier sprite overrides (bulletSprite / impactSprite from chips.json)
  let bulletCfg = bulletCfgBase;
  if (ChipFx && typeof ChipFx.buildChipBulletCfgOverride === 'function' && typeof ChipFx.getActiveModIds === 'function') {
    const chipBulletOverride = ChipFx.buildChipBulletCfgOverride(ChipFx.getActiveModIds(cellIndex));
    if (chipBulletOverride) {
      bulletCfg = { bulletSprite: bulletCfgBase.bulletSprite, impactSprite: bulletCfgBase.impactSprite };
      if (chipBulletOverride.bulletSprite) bulletCfg.bulletSprite = chipBulletOverride.bulletSprite;
      if (chipBulletOverride.impactSprite) bulletCfg.impactSprite = chipBulletOverride.impactSprite;
    }
  }

  if (isTalentsV2Ready()) {
    const talentsApi = getTalentsV2Api();
    if (talentsApi && typeof talentsApi.onShotFired === 'function') {
      talentsApi.onShotFired({ tank, timeMs: Date.now(), rng: Math });
    }
  }

  // Barrel spread perpendicular to heading
  const heading = Math.atan2(tp.y - sy, tp.x - sx);
  const perpX = -Math.sin(heading);
  const perpY = Math.cos(heading);
  const BARREL_SPREAD = 6;

  // Check for explicit barrel positions from cannon config (tanks.json)
  let cannonBarrels = null;
  if (window.TankSprites && window.TankSprites.pickCannon) {
    const cannonData = window.TankSprites.pickCannon(tank.level);
    if (cannonData && cannonData.cfg && Array.isArray(cannonData.cfg.barrels)) {
      cannonBarrels = cannonData.cfg.barrels;
    }
  }

  const spawnBurst = () => {
    if (cannonBarrels && cannonBarrels.length >= N) {
      // Use explicit barrel positions from tanks.json
      for (let i = 0; i < totalProjectiles; i++) {
        const bIdx = i % N;
        const b = cannonBarrels[bIdx];
        const bx = sx + Math.cos(heading) * (b.x || 0) - Math.sin(heading) * (b.y || 0);
        const by = sy + Math.sin(heading) * (b.x || 0) + Math.cos(heading) * (b.y || 0);
        const t = allTargets[i % allTargets.length];
        const tpos = zombiePos(t);
        spawnProjectile({
          fromX: bx, fromY: by,
          toZombieId: t.id, toX: tpos.x, toY: tpos.y,
          level: tank.level, dmg: splitDmg,
          aoe: chipAoe, prof: stats.prof,
          bulletCfg,
          effectIntensity: effectIntensity * chipSizeMul, shotId,
          isTankAttackingZombie,
          tank,
          chipShotMods,
        });
      }
    } else {
      // Default: spread perpendicular to heading
      const offsets = totalProjectiles === 1 ? [0] : totalProjectiles === 2 ? [-BARREL_SPREAD / 2, BARREL_SPREAD / 2] : [];
      if (!offsets.length && totalProjectiles > 2) {
        for (let k = 0; k < totalProjectiles; k++) offsets.push(-BARREL_SPREAD + (2 * BARREL_SPREAD * k / (totalProjectiles - 1)));
      }
      for (let i = 0; i < totalProjectiles; i++) {
        const t = allTargets[i % allTargets.length];
        const tpos = zombiePos(t);
        spawnProjectile({
          fromX: sx + perpX * (offsets[i] || 0),
          fromY: sy + perpY * (offsets[i] || 0),
          toZombieId: t.id, toX: tpos.x, toY: tpos.y,
          level: tank.level, dmg: splitDmg,
          aoe: chipAoe, prof: stats.prof,
          bulletCfg,
          effectIntensity: effectIntensity * chipSizeMul, shotId,
          isTankAttackingZombie,
          tank,
          chipShotMods,
        });
      }
    }
    state.coins += coinsForShot(tank.level);
    if (window.Game && window.Game.Telemetry) window.Game.Telemetry.event('shotFired');
    if (window.Game && window.Game.TelemetryLogger) window.Game.TelemetryLogger.log('shotFired', { level: tank.level });
  };

  spawnBurst();
  if (Math.random() < mods.doubleShotChance){
    spawnBurst();
  }
  // Mod 6 (combo counter): fire 3 extra rapid bursts at ×1.25 dmg with 0.15s interval
  if (chipShotMods && chipShotMods.comboShots > 0) {
    for (let ci = 0; ci < chipShotMods.comboShots; ci++) {
      (function(delay) {
        setTimeout(function() { spawnBurst(); }, delay);
      })((ci + 1) * 150);
    }
  }
  tank.cooldown = 1 / (stats.fr * speedMult());
  if (!isTankAttackingZombie){
    const burstCount = Math.min(MAX_BURST_PARTICLES, Math.round(5 * effectIntensity));
    const burstAlpha = Math.min(0.85, 0.55 * (0.9 + 0.1 * effectIntensity));
    burst(sx, sy, burstCount, `rgba(255,255,255,${burstAlpha})`);
    // Use chip-specific shoot SFX if configured, otherwise fallback to power-tier clip
    let shootClip = null;
    if (ChipFx && typeof ChipFx.resolveChipShotSfx === 'function' && typeof ChipFx.getActiveModIds === 'function') {
      shootClip = ChipFx.resolveChipShotSfx(ChipFx.getActiveModIds(cellIndex));
    }
    if (!shootClip) {
      shootClip = powerTier <= 1 ? 'shootNormal' : powerTier <= 3 ? 'shootHeavy' : 'shootHeavy2';
    }
    playSfx(shootClip);
  }
}

function tankOrbitState(cell, timeSec){
  const total = BAL.rows * BAL.cols;
  const offset = (cell.i / total) * Math.PI * 2;
  const mods = getMods();
  const activeSpeed = timeSec < state.activeEffects.speedUntil ? 1.35 : 1;
  const angularSpeed = BAL.tankOrbitSpeed * speedMult() * mods.orbitSpeedMul * activeSpeed;
  if (cell.tank?.onTrack && cell.orbitPhase !== undefined) {
    const angle = cell.orbitPhase + offset;
    return {
      x: center.x + Math.cos(angle) * getTankOrbitRadius(),
      y: center.y + Math.sin(angle) * getTankOrbitRadius(),
      heading: angle + Math.PI/2,
    };
  }
  const angle = timeSec * angularSpeed + offset;
  return {
    x: center.x + Math.cos(angle) * getTankOrbitRadius(),
    y: center.y + Math.sin(angle) * getTankOrbitRadius(),
    heading: angle + Math.PI/2,
  };
}

function spawnProjectile(p){
  if (!p || !p.prof || !p.bulletCfg) return;
  const b = projectilePool ? projectilePool.acquire() : {};
  b.x = p.fromX;
  b.y = p.fromY;
  b.toX = p.toX;
  b.toY = p.toY;
  b.toZombieId = p.toZombieId;
  b.speed = p.prof.speed;
  b.r = p.prof.r;
  b.color = p.prof.color;
  b.glow = p.prof.glow;
  b.trail = p.prof.trail;
  b.kind = p.prof.kind;
  b.dmg = p.dmg;
  b.aoe = p.aoe;
  b.level = p.level;
  b.prof = p.prof;
  b.bulletCfg = p.bulletCfg;
  b.rotation = Math.atan2((p.toY ?? p.fromY) - p.fromY, (p.toX ?? p.fromX) - p.fromX);
  b.animTime = 0;
  b.effectIntensity = p.effectIntensity ?? 1;
  b.shotId = p.shotId ?? 0;
  b.life = 2.0;
  b.isTankAttackingZombie = p.isTankAttackingZombie === true;
  b.tank = p.tank || null;
  b.chipShotMods = p.chipShotMods || null;
  b.isMatryoshkaChild = p.isMatryoshkaChild || false;
  b.isChainChild = p.isChainChild || false;
  b.isCascadeChild = p.isCascadeChild || false;
  state.projectiles.push(b);
}

function stepProjectiles(dt){
  const zmap = new Map(state.zombies.map(z => [z.id, z]));
  const prev = state.projectiles;
  const next = projectilesNext;
  next.length = 0;

  for (let i = 0; i < prev.length; i++){
    const b = prev[i];
    b.life -= dt;
    if (b.life <= 0){
      releaseProjectile(b);
      continue;
    }

    // update target point (moving zombie)
    const z = zmap.get(b.toZombieId);
    const targeting = window.Game && window.Game.Targeting;
    if (targeting && targeting.updateProjectileAim) {
      targeting.updateProjectileAim(b, z, zombiePos);
    } else if (z && z.state !== 'dying') {
      const p = zombiePos(z);
      b.toX = p.x;
      b.toY = p.y;
    } else if (z && z.state === 'dying') {
      b.toZombieId = null;
    }

    const dx = b.toX - b.x;
    const dy = b.toY - b.y;
    const dist = Math.hypot(dx,dy) || 1;
    const vx = dx/dist;
    const vy = dy/dist;
    b.rotation = Math.atan2(vy, vx);
    b.animTime = (b.animTime || 0) + dt;

    b.x += vx * b.speed * dt;
    b.y += vy * b.speed * dt;

    // trail particles (scaled by effectIntensity)
    if (b.isTankAttackingZombie !== true){
      const trailColor = b.level >= 12 ? 'rgba(186,140,255,.18)' : b.trail;
      const ei = b.effectIntensity ?? 1;
      const trailR = Math.min(4, Math.max(1.5, b.r * 0.55 * ei));
      const trailAlpha = Math.min(MAX_TRAIL_ALPHA, 0.25 * (0.9 + 0.1 * ei));
      const trailColorAdj = trailColor.replace(/,\s*[\d.]+\)\s*$/, `,${trailAlpha})`);
      particle(b.x - vx*8, b.y - vy*8, trailR, trailColorAdj, 0.25);
    }

    if (dist < Math.max(10, b.r*2.2)){
      impactAt(b.x, b.y, b, { suppressCombatFx: b.isTankAttackingZombie === true });
      releaseProjectile(b);
      continue;
    }

    next.push(b);
  }

  projectilesNext = prev;
  state.projectiles = next;
}

function critChanceFromTankLevel(level){
  const lvl = Math.max(1, level);
  const percent = 1.0 + (lvl - 1) * 0.25;
  return percent / 100;
}

function impactAt(x,y,b,opts){
  const suppressCombatFx = !!(opts && opts.suppressCombatFx);
  const mods = getMods();
  const attackMult = getZombieAttackMultipliers();
  const damageMul = attackMult.damageMult;

  // ── Chip: Laser Mark boost (mod 13) ──
  const ChipFx = window.Game && window.Game.ChipEffects;
  if (ChipFx && b.chipShotMods && !b.isMatryoshkaChild) {
    const markBoost = ChipFx.checkLaserMarkBoost(x, y);
    if (markBoost) {
      b.dmg = b.dmg * markBoost.damageMul;
      b.aoe = b.aoe * markBoost.aoeMul;
    }
  }

  const talentsApi = isTalentsV2Ready() ? getTalentsV2Api() : null;
  const hasTalentsHit = !!(talentsApi && typeof talentsApi.onHit === 'function');
  const aoeVictimsCount = state.zombies.reduce((acc, z) => {
    if (!z || z.state === 'dying') return acc;
    const p = zombiePos(z);
    return Math.hypot(p.x - x, p.y - y) <= b.aoe ? acc + 1 : acc;
  }, 0);
  const tankLevel = b.level ?? 1;
  const critChance = critChanceFromTankLevel(tankLevel);
  for (const z of state.zombies){
    if (z.state === 'dying') continue;
    const p = zombiePos(z);
    const d = Math.hypot(p.x-x, p.y-y);
    if (d <= b.aoe){
      const falloff = 0.55 + 0.45*(1 - d/b.aoe);
      const baseDmg = b.dmg * falloff;
      const isCrit = Math.random() < critChance;
      const finalDmg = (baseDmg * (isCrit ? 1.5 : 1)) / damageMul;
      let dmgRounded = Math.round(finalDmg);
      if (hasTalentsHit) {
        const hitOut = talentsApi.onHit({
          tank: b.tank || null,
          zombie: z,
          timeMs: Date.now(),
          damage: finalDmg,
          source: 'direct',
          isAoe: b.aoe > 0,
          aoeVictimsCount,
          zombies: state.zombies,
          getZombiePos: zombiePos,
          rng: Math,
        }) || { damage: finalDmg };
        dmgRounded = Math.max(0, Math.round(hitOut.damage || 0));
        if (Array.isArray(hitOut.extraHits) && hitOut.extraHits.length) {
          for (let i = 0; i < hitOut.extraHits.length; i++) {
            const extra = hitOut.extraHits[i];
            if (!extra || !extra.zombie) continue;
            const extraDamage = Math.max(0, Math.round(extra.damage || 0));
            if (extraDamage <= 0) continue;
            applyDamageToZombie(extra.zombie, extraDamage, 'tank');
            const extraPos = zombiePos(extra.zombie);
            addDamageNumber(extraPos.x, extraPos.y, extraDamage, false);
          }
        }
      }
      applyDamageToZombie(z, dmgRounded, 'tank');
      addDamageNumber(p.x, p.y, dmgRounded, isCrit);
      if (Math.random() < mods.dotChance){
        z.dotUntil = nowSec() + 4;
        z.dotDps = Math.max(z.dotDps || 0, b.dmg * 0.25 * mods.dotDpsMul);
      }
    }
  }

  // Extra effects per kind
  if (b.kind === 'toxic'){
    addDecal({
      kind:'pool',
      x, y,
      r: b.aoe*0.70,
      life: b.prof?.poolLife ?? 3.6,
      dps: b.dmg * (b.prof?.poolDpsMul ?? 0.20),
      color:'rgba(184,255,59,.16)'
    });
  }

  if (b.kind === 'tesla'){
    chainLightning(x,y,b, { suppressCombatFx });
  }

  if (!suppressCombatFx){
    // Visual impact rings (scale by effectIntensity)
    const ei = b.effectIntensity ?? 1;
    const impactCount = Math.min(40, Math.round((b.kind === 'he' ? 30 : 22) * ei));
    state.impacts.push({x,y,r:0,maxR:b.aoe,life:0.30,max:0.30,kind:b.kind,bulletCfg:b.bulletCfg||null});
    burst(x, y, impactCount, b.glow);
    if (b.dmg > 80){
      state.impacts.push({x,y,r:0,maxR:b.aoe * 1.4,life:0.18,max:0.18,kind:'overflow',bulletCfg:b.bulletCfg||null});
    }
  }

  // ── Chip impact effects (mods 2–14) + cascade spawning ──
  // Cascade children trigger their own effects; only matryoshka children are blocked.
  if (b.chipShotMods && !b.isMatryoshkaChild) {
    const ChipFxI = window.Game && window.Game.ChipEffects;
    if (ChipFxI && typeof ChipFxI.applyImpactEffects === 'function') {
      ChipFxI.applyImpactEffects({
        x, y, b,
        shotMods: b.chipShotMods,
        zombies: state.zombies,
        getZombiePos: zombiePos,
        applyDamage: applyDamageToZombie,
        addDecal,
        burst,
        addDamageNumber,
        spawnProjectile,
        impacts: state.impacts,
      });
    }
    // Play chip-specific impact SFX if configured
    if (ChipFxI && typeof ChipFxI.resolveChipImpactSfx === 'function') {
      const chipImpactSfx = ChipFxI.resolveChipImpactSfx(b.chipShotMods);
      if (chipImpactSfx) playSfx(chipImpactSfx);
    }
  }
}

function chainLightning(x,y,b,opts){
  const suppressCombatFx = !!(opts && opts.suppressCombatFx);
  const attackMult = getZombieAttackMultipliers();
  const damageMul = attackMult.damageMult;
  const range = b.prof?.chainRange ?? 84;
  const jumps = b.prof?.chainJumps ?? 3;
  const mul = b.prof?.chainMul ?? 0.45;

  let curX = x, curY = y;
  const hit = new Set();

  for (let i=0;i<jumps;i++){
    let best = null;
    let bestD = Infinity;

    for (const z of state.zombies){
      if (z.state === 'dying') continue;
      if (hit.has(z.id)) continue;
      const p = zombiePos(z);
      const d = Math.hypot(p.x-curX, p.y-curY);
      if (d <= range && d < bestD){ best = z; bestD = d; }
    }
    if (!best) break;

    hit.add(best.id);
    const p = zombiePos(best);

    if (!suppressCombatFx){
      // visual bolt
      state.impacts.push({x:curX,y:curY,tx:p.x,ty:p.y,life:0.10,max:0.10,kind:'bolt'});
    }

    const baseChainDmg = b.dmg * mul;
    const tankLevel = b.level ?? 1;
    const critChance = critChanceFromTankLevel(tankLevel);
    const isCrit = Math.random() < critChance;
    const finalChainDmg = (baseChainDmg * (isCrit ? 1.5 : 1)) / damageMul;
    const dmgRounded = Math.round(finalChainDmg);
    applyDamageToZombie(best, dmgRounded, 'tank');
    addDamageNumber(p.x, p.y, dmgRounded, isCrit);
    curX = p.x;
    curY = p.y;
  }
}

const MAX_DAMAGE_NUMBERS = 24;

function formatDamageNumber(value){
  if (window.Game && window.Game.NumberFormat) return window.Game.NumberFormat.formatCompactRu(Math.round(value));
  const v = Math.round(value);
  if (v < 10000) return String(v);
  if (v < 1000000) {
    const k = v / 1000;
    return (k === Math.floor(k) ? k : k.toFixed(1).replace('.', ',')) + 'к';
  }
  const m = v / 1000000;
  return (m === Math.floor(m) ? m : m.toFixed(1).replace('.', ',')) + 'м';
}

function addDamageNumber(x, y, value, isCrit = false){
  if (state.damageNumbers.length >= MAX_DAMAGE_NUMBERS) state.damageNumbers.shift();
  const jitter = 8;
  state.damageNumbers.push({
    x: x + (Math.random() * 2 - 1) * jitter,
    y: y + (Math.random() * 2 - 1) * jitter,
    value: formatDamageNumber(value),
    life: 1,
    max: 1,
    vy: -28,
    isCrit: !!isCrit,
  });
}

function stepDamageNumbers(dt){
  const next = [];
  for (const d of state.damageNumbers){
    d.life -= dt;
    if (d.life <= 0) continue;
    d.y += d.vy * dt;
    next.push(d);
  }
  state.damageNumbers = next;
}

// ---------- Decals (persistent effects) ----------
function addDecal(d){
  if (state.decals.length > BAL.maxDecals) state.decals.shift();
  state.decals.push({
    kind: d.kind,
    subKind: d.subKind || null,
    x: d.x,
    y: d.y,
    r: d.r,
    life: d.life,
    max: d.life,
    dps: d.dps || 0,
    slowFactor: d.slowFactor || 0,
    chipModId: d.chipModId || 0,
    color: d.color || 'rgba(125,255,178,.14)',
  });
}

function stepDecals(dt){
  const next = [];
  const ChipFxD = window.Game && window.Game.ChipEffects;
  for (const d of state.decals){
    d.life -= dt;
    if (d.life <= 0) continue;

    if (d.kind === 'pool' && d.dps > 0){
      // Apply DOT inside pool
      for (const z of state.zombies){
        const p = zombiePos(z);
        const dist = Math.hypot(p.x-d.x, p.y-d.y);
        if (dist <= d.r){
          applyDamageToZombie(z, d.dps * dt, 'tank');
        }
      }
    }

    // Chip-created pools (fire, ice, acid)
    if (d.kind === 'chipPool') {
      // DOT damage (fire, acid)
      if (d.dps > 0) {
        if (d._dmgAccum == null) { d._dmgAccum = 0; d._dmgTimer = 0; }
        d._dmgTimer -= dt;
        for (const z of state.zombies) {
          if (z.state === 'dying') continue;
          const p = zombiePos(z);
          const dist = Math.hypot(p.x - d.x, p.y - d.y);
          if (dist <= d.r) {
            const tickDmg = d.dps * dt;
            applyDamageToZombie(z, tickDmg, 'tank');
            d._dmgAccum += tickDmg;
          }
        }
        if (d._dmgTimer <= 0 && d._dmgAccum > 0) {
          addDamageNumber(d.x, d.y, Math.round(d._dmgAccum), false);
          d._dmgAccum = 0;
          d._dmgTimer = 0.5;
        }
      }
      // Slow effect (ice, acid) — delegate to ChipEffects
      if (ChipFxD && typeof ChipFxD.stepChipDecal === 'function') {
        ChipFxD.stepChipDecal(d, dt, { zombies: state.zombies, getZombiePos: zombiePos });
      }
    }

    next.push(d);
  }
  state.decals = next;
}

function ensureCrateRuntimeController(){
  if (crateRuntimeController) return crateRuntimeController;
  const api = GameApi && GameApi.CrateRuntime;
  if (!api || typeof api.createController !== 'function') return null;
  crateRuntimeController = api.createController({
    getState(){ return state; },
    getBalance(){ return BAL; },
    getBonusBoxSprites(){ return BonusBoxSprites; },
    nowSec: nowSec,
  });
  return crateRuntimeController;
}

// ---------- Crates ----------
function pickCrateRewardLevel(){
  return ensureCrateRuntimeController()?.pickCrateRewardLevel() || 1;
}

function pickEmptyCell(){
  return ensureCrateRuntimeController()?.pickEmptyCell() || null;
}

function spawnCrate(){
  return !!ensureCrateRuntimeController()?.spawnCrate();
}

function getCrateAnimation(stateName){
  return ensureCrateRuntimeController()?.getCrateAnimation(stateName) || null;
}

function setCrateAnimationState(crate, nextState, resetTime){
  ensureCrateRuntimeController()?.setCrateAnimationState(crate, nextState, resetTime);
}

function syncCrateHoverAt(x, y){
  ensureCrateRuntimeController()?.syncCrateHoverAt(x, y);
}

function maybeSpawnCrate(){
  ensureCrateRuntimeController()?.maybeSpawnCrate();
}

function stepCrate(dt){
  ensureCrateRuntimeController()?.stepCrate(dt);
}

function crateHitTest(x,y){
  return !!ensureCrateRuntimeController()?.crateHitTest(x, y);
}

// ---------- Kills / respawn ----------
function cleanupKills(){
  const CORPSE_OVERFLOW_FADE_SEC = 0.2;
  const corpseMax = BAL.corpseMaxCount;
  let dyingCount = 0;
  if (Number.isFinite(corpseMax)){
    for (const z of state.zombies){
      if (z.state !== 'dying') continue;
      const ttl = Number.isFinite(z.corpseTimerLeft) ? z.corpseTimerLeft : (Number.isFinite(z.corpseTimer) ? z.corpseTimer : z.deathTimer);
      if (ttl > 0) dyingCount++;
    }
  }
  const limitCorpses = Number.isFinite(corpseMax) && dyingCount > corpseMax;
  let keptDying = 0;
  const alive = [];
  for (const z of state.zombies){
    if (z.state === 'dying'){
      const ttl = Number.isFinite(z.corpseTimerLeft) ? z.corpseTimerLeft : (Number.isFinite(z.corpseTimer) ? z.corpseTimer : z.deathTimer);
      if (ttl > 0){
        if (limitCorpses && keptDying >= corpseMax) {
          const reducedTtl = Math.min(ttl, CORPSE_OVERFLOW_FADE_SEC);
          z.corpseTimerLeft = reducedTtl;
          z.corpseTimer = reducedTtl;
        } else {
          keptDying++;
        }
        alive.push(z);
      }
      continue;
    }
    if (z.hp <= 0){
      startZombieDying(z);
      alive.push(z);
      continue;
    }
    alive.push(z);
  }
  state.zombies = alive;
  ensureZombieCount();
}

// ---------- Particles ----------
function particle(x,y,r,color,life){
  if (state.particles.length > BAL.maxParticles) return;
  state.particles.push({x,y,r,color,life,max:life,vx:(Math.random()*2-1)*40,vy:(Math.random()*2-1)*40});
}

function burst(x,y,count,color){
  const scale = getFxScale();
  const scaledCount = Math.max(1, Math.round(count * scale));
  for (let i=0;i<scaledCount;i++) particle(x,y,Math.random()*2.6+1.0,color,Math.random()*0.30+0.14);
}

function popText(x,y,text,color){
  state.particles.push({kind:'text',x,y,text,color,life:0.95,max:0.95,vy:-26});
}

function stepParticles(dt){
  const next = [];
  for (const p of state.particles){
    p.life -= dt;
    if (p.life <= 0) continue;
    if (p.kind === 'text'){
      p.y += (p.vy||-20)*dt;
      next.push(p);
      continue;
    }
    p.x += p.vx*dt;
    p.y += p.vy*dt;
    p.r *= 0.985;
    next.push(p);
  }
  state.particles = next;
}

function setMenuOpen(open){
  var canOpenSmallMenu = sessionStartGate === 'unlocked';
  var shouldOpen = !!open && canOpenSmallMenu;
  if (shouldOpen) stopTrackLoopSfxImmediate();
  if (shouldOpen) syncVolumeUIFromSettings();
  setMenuPauseSource('settings', shouldOpen);
  if (UIModals && typeof UIModals.setMenuOpen === 'function') {
    UIModals.setMenuOpen({
      open: shouldOpen,
      state,
      ui,
      a11yOpen,
      a11yClose,
      onClose: () => setMenuOpen(false),
      updateMenuState,
    });
    return;
  }
  state.ui.menuOpen = shouldOpen;
  document.body.classList.toggle('menu-open', shouldOpen);
  if (ui.menuOverlay){
    ui.menuOverlay.classList.toggle('hidden', !shouldOpen);
    ui.menuOverlay.setAttribute('aria-hidden', (!shouldOpen).toString());
    if (shouldOpen) a11yOpen(ui.menuOverlay, { initialFocus: ui.menuContinue, onClose: () => setMenuOpen(false) });
    else a11yClose(ui.menuOverlay);
  }
  updateMenuState();
}

function updateMenuState(){
  if (ui.menuContinue){
    const saved = getSavedProgress();
    ui.menuContinue.disabled = !saved || sessionStartGate !== 'unlocked';
  }
  updateMenuVolumes();
}

function ensureBigMenuRuntimeController(){
  if (bigMenuRuntimeController) return bigMenuRuntimeController;
  const api = GameApi && GameApi.BigMenuRuntime;
  if (!api || typeof api.createController !== 'function') return null;
  bigMenuRuntimeController = api.createController({
    getUi(){ return ui; },
    t: t,
    a11yOpen: a11yOpen,
    a11yClose: a11yClose,
    setMenuPauseSource: setMenuPauseSource,
    syncVolumeUIFromSettings: syncVolumeUIFromSettings,
    getCurrentLang: getCurrentLang,
    setLanguage: setLanguage,
    loadSettings: loadSettings,
    saveSettings: saveSettings,
    setVolume: setVolume,
    setAutoPauseEnabled: setAutoPauseEnabled,
    playUiSliderPreviewSfxThrottled: playUiSliderPreviewSfxThrottled,
    boot: boot,
    resetGameState: resetGameState,
    restoreFullState: restoreFullState,
    postRestoreSync: postRestoreSync,
    saveProgress: saveProgress,
    updateUI: updateUI,
    setMenuOpen: setMenuOpen,
    resumeSessionRuntime: resumeSessionRuntime,
    scheduleMainLoop: scheduleMainLoop,
    getSessionRuntimeStopped(){ return !!sessionRuntimeStopped; },
    setSessionStartGate: setSessionStartGate,
    setBootInitialMenuSubView(value){ bootInitialMenuSubView = value; },
    setMetaLastSeenAt(value){ meta.lastSeenAt = value; },
  });
  return bigMenuRuntimeController;
}

function setBigMenuOpen(open){
  if (open) stopTrackLoopSfxImmediate();
  ensureBigMenuRuntimeController()?.setBigMenuOpen(open);
}

function isBigMenuOpen(){
  return !!ensureBigMenuRuntimeController()?.isBigMenuOpen();
}

function setSessionStartGate(nextValue){
  sessionStartGate = nextValue === 'unlocked' ? 'unlocked' : 'locked';
  updateMenuState();
}

function setBigMenuView(mode){
  ensureBigMenuRuntimeController()?.setBigMenuView(mode);
}

function openBigMenuRootView(){
  ensureBigMenuRuntimeController()?.openBigMenuRootView();
}

function openBigMenuLoadView(){
  ensureBigMenuRuntimeController()?.openBigMenuLoadView();
}

function getBigMenuSaveMeta(){
  const storageApi = window.Game && window.Game.Storage;
  if (storageApi && typeof storageApi.listSlots === 'function') {
    const list = storageApi.listSlots();
    return {
      slots: Array.isArray(list && list.slots) ? list.slots : [],
      ok: !!(list && list.ok),
    };
  }
  if (storageApi && typeof storageApi.loadSaveSlotsMeta === 'function') {
    return {
      slots: (storageApi.loadSaveSlotsMeta() || {}).slots || [],
      ok: true,
    };
  }
  return { slots: [], ok: false };
}

function getBigMenuDefaultSlotName(index){
  const storageApi = window.Game && window.Game.Storage;
  if (storageApi && typeof storageApi.getDefaultSlotName === 'function') {
    return storageApi.getDefaultSlotName(index);
  }
  return 'Слот ' + (index + 1);
}

function getBigMenuSlotName(slot, index){
  const raw = slot && typeof slot === 'object' ? slot.name : '';
  if (typeof raw !== 'string') return getBigMenuDefaultSlotName(index);
  const text = raw.trim();
  return text || getBigMenuDefaultSlotName(index);
}

function bigMenuSlotHasData(slot){
  if (!slot || typeof slot !== 'object') return false;
  if (Object.prototype.hasOwnProperty.call(slot, 'hasData')) return !!slot.hasData;
  return Number(slot.lastSavedAt) > 0;
}

function loadSlotPayloadForBigMenu(slotIndex){
  const storageApi = window.Game && window.Game.Storage;
  if (!storageApi || typeof storageApi.loadSlot !== 'function') return null;
  const loaded = storageApi.loadSlot(slotIndex);
  if (!loaded || !loaded.ok || !loaded.payload || !Array.isArray(loaded.payload.cells)) {
    return null;
  }
  return loaded.payload;
}

function getBigMenuActionButtons(){
  return [ui.bigMenuNew, ui.bigMenuLoad, ui.bigMenuSound, ui.bigMenuLanguage, ui.bigMenuDevs];
}

function setMenuActionButtonSelected(button, selected){
  if (!button || !button.classList) return;
  button.classList.toggle('menuActionSelected', !!selected);
  if (selected) {
    button.classList.add('btnPrimary');
    button.classList.remove('btnSecondary');
    return;
  }
  button.classList.remove('btnPrimary');
  button.classList.add('btnSecondary');
}

function applyBigMenuSelectedState(){
  const buttons = getBigMenuActionButtons();
  for (const button of buttons) {
    if (!button || !button.id) continue;
    setMenuActionButtonSelected(button, button.id === lastActiveButtonIdBigMenu);
  }
}

function markBigMenuButtonActive(buttonId){
  if (!buttonId) return;
  lastActiveButtonIdBigMenu = buttonId;
  applyBigMenuSelectedState();
}

function removeBigMenuLanguageOutsideListener(){
  if (!bigMenuLanguageOutsideListener) return;
  document.removeEventListener('pointerdown', bigMenuLanguageOutsideListener, true);
  bigMenuLanguageOutsideListener = null;
}

function closeBigMenuLanguagePanel(){
  if (!ui.bigMenuLanguagePanel) return;
  ui.bigMenuLanguagePanel.classList.remove('is-open');
  ui.bigMenuLanguagePanel.classList.add('bigMenuLanguagePanelClosed');
  ui.bigMenuLanguagePanel.setAttribute('aria-hidden', 'true');
  removeBigMenuLanguageOutsideListener();
}

function toggleBigMenuLanguagePanel(){
  if (!ui.bigMenuLanguagePanel) return;
  const shouldOpen = !ui.bigMenuLanguagePanel.classList.contains('is-open');
  closeBigMenuPanels();
  if (!shouldOpen) return;
  ui.bigMenuLanguagePanel.classList.remove('bigMenuLanguagePanelClosed');
  ui.bigMenuLanguagePanel.classList.add('is-open');
  ui.bigMenuLanguagePanel.setAttribute('aria-hidden', 'false');
  if (!bigMenuLanguageOutsideListener) {
    bigMenuLanguageOutsideListener = function (event) {
      if (!ui.bigMenuLanguageWrap) return;
      if (ui.bigMenuLanguageWrap.contains(event.target)) return;
      closeBigMenuLanguagePanel();
    };
    document.addEventListener('pointerdown', bigMenuLanguageOutsideListener, true);
  }
}

function closeBigMenuPanels(){
  ensureBigMenuRuntimeController()?.closeBigMenuPanels();
}

function toggleBigMenuPanel(panel){
  ensureBigMenuRuntimeController()?.toggleBigMenuPanel(panel);
}

function updateBigMenuVolumeState(){
  syncVolumeUIFromSettings();
}

function applyBigMenuLanguageSelectedState(){
  if (!ui.bigMenuLangRu || !ui.bigMenuLangEn) return;
  const lang = getCurrentLang();
  setMenuActionButtonSelected(ui.bigMenuLangRu, lang === 'ru');
  setMenuActionButtonSelected(ui.bigMenuLangEn, lang === 'en');
  ui.bigMenuLangRu.setAttribute('aria-pressed', (lang === 'ru').toString());
  ui.bigMenuLangEn.setAttribute('aria-pressed', (lang === 'en').toString());
}

function getCreditsRole(item, lang){
  if (!item || typeof item !== 'object') return '';
  if (lang === 'en') {
    if (typeof item.role_en === 'string' && item.role_en.trim()) return item.role_en.trim();
    if (typeof item.role_ru === 'string' && item.role_ru.trim()) return item.role_ru.trim();
    return '';
  }
  if (typeof item.role_ru === 'string' && item.role_ru.trim()) return item.role_ru.trim();
  if (typeof item.role_en === 'string' && item.role_en.trim()) return item.role_en.trim();
  return '';
}

async function loadCreditsData(){
  if (creditsDataLoaded) return creditsData;
  try {
    const response = await fetch('assets/credits.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('credits.json load failed');
    const parsed = await response.json();
    if (!Array.isArray(parsed)) {
      creditsData = [];
      creditsDataLoaded = true;
      return creditsData;
    }
    const normalized = [];
    for (let i = 0; i < parsed.length; i++) {
      const item = parsed[i];
      if (!item || typeof item !== 'object') continue;
      const name = typeof item.name === 'string' ? item.name.trim() : '';
      if (!name) continue;
      normalized.push({
        name: name,
        role_ru: typeof item.role_ru === 'string' ? item.role_ru.trim() : '',
        role_en: typeof item.role_en === 'string' ? item.role_en.trim() : '',
      });
    }
    creditsData = normalized;
  } catch (e) {
    creditsData = [];
  }
  creditsDataLoaded = true;
  return creditsData;
}

function renderCreditsModalList(items){
  if (!ui.creditsModalList) return;
  ui.creditsModalList.innerHTML = '';
  if (!Array.isArray(items) || !items.length) {
    const empty = document.createElement('div');
    empty.className = 'creditsModal__empty';
    empty.textContent = t('creditsModalEmpty');
    ui.creditsModalList.appendChild(empty);
    return;
  }

  const lang = getCurrentLang();
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const row = document.createElement('div');
    row.className = 'creditsModal__item';

    const nameEl = document.createElement('div');
    nameEl.className = 'creditsModal__name';
    nameEl.textContent = item.name;

    const roleEl = document.createElement('div');
    roleEl.className = 'creditsModal__role';
    roleEl.textContent = getCreditsRole(item, lang);

    row.appendChild(nameEl);
    row.appendChild(roleEl);
    ui.creditsModalList.appendChild(row);
  }
}

function closeCreditsModal(){
  ensureBigMenuRuntimeController()?.closeCreditsModal();
}

async function openCreditsModal(){
  await ensureBigMenuRuntimeController()?.openCreditsModal();
}

function hasSaves(){
  const storageApi = window.Game && window.Game.Storage;
  if (storageApi && typeof storageApi.hasAnySaves === 'function') {
    try {
      return !!storageApi.hasAnySaves();
    } catch (e) {
      return false;
    }
  }

  if (storageApi && typeof storageApi.loadSaveSlotsMeta === 'function') {
    const meta = storageApi.loadSaveSlotsMeta();
    const slots = Array.isArray(meta && meta.slots) ? meta.slots : [];
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const ts = Number(slot && slot.lastSavedAt);
      if (Number.isFinite(ts) && ts > 0) return true;
    }
  }
  return false;
}

function renderBigMenuTexts(){
  ensureBigMenuRuntimeController()?.renderBigMenuTexts();
}

function updateBigMenuLoadState(){
  ensureBigMenuRuntimeController()?.updateBigMenuLoadState();
}

function applyBigMenuLanguage(lang){
  setLanguage(lang);
  try {
    localStorage.setItem('lang', getCurrentLang());
  } catch (e) {}
  renderBigMenuTexts();
  closeBigMenuLanguagePanel();
}

function setBigMenuActionButtonsDisabled(disabled){
  const buttons = getBigMenuActionButtons();
  for (const btn of buttons) {
    if (!btn) continue;
    btn.disabled = !!disabled;
  }
  if (!disabled) updateBigMenuLoadState();
}

function stopAndResetSessionToBigMenu(){
  sessionRuntimeStopped = true;
  stopTrackLoopSfxImmediate();
  RuntimeTasks.suspendAll();
  if (mainLoopRafId) {
    cancelAnimationFrame(mainLoopRafId);
    mainLoopRafId = 0;
  }

  setMenuPauseSource('settings', false);
  setMenuPauseSource('supercomputer', false);
  exitCriticalPause();
  closeBigMenuPanels();
  closeSupercomputerMenu();
  closeTalents();
  closeLevelModal();
  closeResetTalentsModal();
  closeCrateModal();
  closeDismantleModal();
  closeAchievementsModal();
  closeCriticalModal();
  if (window.Game && window.Game.MergePopup && typeof window.Game.MergePopup.close === 'function') {
    window.Game.MergePopup.close();
  }

  clearMergeFxQueue();
  RuntimeTasks.clearAll();

  if (window.Game && window.Game.TelemetryLogger && typeof window.Game.TelemetryLogger.stopAutoFlush === 'function') {
    window.Game.TelemetryLogger.stopAutoFlush();
  }

  try {
    localStorage.removeItem('progress');
  } catch (e) {}

  if (ctx && canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  if (typeof window !== 'undefined' && window.location && typeof window.location.reload === 'function') {
    window.location.reload();
    return;
  }

  resetGameState({ reason: 'reset' });
  meta.lastSeenAt = null;
  setSessionStartGate('locked');
  setMenuOpen(false);
  updateBigMenuLoadState();
  setBigMenuOpen(true);
}

function resumeSessionRuntime(){
  RuntimeTasks.resumeAll();
  sessionRuntimeStopped = false;
  last = performance.now();
  lastFrameTs = last;
  lastProgressSave = 0;
  if (window.Game && window.Game.TelemetryLogger && typeof window.Game.TelemetryLogger.startAutoFlush === 'function') {
    window.Game.TelemetryLogger.startAutoFlush();
  }
}

async function startFromBigMenu(mode){
  await ensureBigMenuRuntimeController()?.startFromBigMenu(mode);
}

function initBigMainMenu(){
  ensureBigMenuRuntimeController()?.initBigMainMenu();
}

function spawnInitialTanksLvl1(targetState, count = 1){
  const stateRef = targetState || state;
  if (!stateRef || !Array.isArray(stateRef.cells) || !stateRef.cells.length) return 0;
  const requested = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 1;
  if (requested <= 0) return 0;
  if (stateRef.cells.some((cell) => cell && cell.tank)) return 0;

  const Garage = window.Game && window.Game.Garage;
  const preferredIndices = [0, 1];
  let spawned = 0;

  function trySpawnAtCell(cell){
    if (!cell || cell.tank) return false;
    if (Garage && typeof Garage.isCellAvailableForTank === 'function' && !Garage.isCellAvailableForTank(cell, stateRef)) {
      return false;
    }
    cell.tank = makeTank(1, false, { enableStamp: false });
    spawned += 1;
    return true;
  }

  for (let i = 0; i < preferredIndices.length && spawned < requested; i++) {
    const idx = preferredIndices[i];
    if (!Number.isFinite(idx)) continue;
    trySpawnAtCell(stateRef.cells[idx]);
  }
  for (let i = 0; i < stateRef.cells.length && spawned < requested; i++) {
    trySpawnAtCell(stateRef.cells[i]);
  }
  if (spawned > 0) recordTankLevel(1);
  return spawned;
}

function clearAllTanksFromCells(targetState){
  const stateRef = targetState || state;
  if (!stateRef || !Array.isArray(stateRef.cells)) return;
  for (let i = 0; i < stateRef.cells.length; i++) {
    const cell = stateRef.cells[i];
    if (!cell) continue;
    cell.tank = null;
  }
}

function getAutoRetrySlotIndex(){
  var storageApi = window.Game && window.Game.Storage;
  return storageApi && Number.isFinite(storageApi.AUTO_SLOT_INDEX) ? storageApi.AUTO_SLOT_INDEX : 9;
}

function isValidSavedPayload(payload){
  return !!(payload && Array.isArray(payload.cells));
}

function cloneJsonSafe(value, fallback){
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_) {
    return fallback;
  }
}

function applyPreRetryRuntimeReset(targetState){
  if (!targetState || typeof targetState !== 'object') return;
  targetState.coins = 120;
  targetState.kills = 0;
  targetState.zombieWaveAtkMult = 1;
  targetState.fenceLevel = 1;
  targetState.zombies = [];
  targetState.projectiles = [];
  targetState.impacts = [];
  targetState.decals = [];
  targetState.particles = [];
  targetState.damageNumbers = [];
  targetState.dragging = null;
  targetState.crate = null;
  targetState.nextCrateAt = 0;
  targetState.boostUntil = 0;
  targetState.empUntil = 0;
  targetState.activeEffects = {
    attackUntil: 0,
    speedUntil: 0,
    economyUntil: 0,
  };
  if (!Array.isArray(targetState.cells)) targetState.cells = [];
  for (let i = 0; i < targetState.cells.length; i++) {
    const cell = targetState.cells[i];
    if (!cell) continue;
    cell.tank = null;
  }
  var seeded = 0;
  for (let i = 0; i < targetState.cells.length && seeded < 1; i++) {
    const cell = targetState.cells[i];
    if (!cell || cell.tank) continue;
    cell.tank = makeTank(1, false);
    seeded += 1;
  }
  if (!targetState.supercomputer || typeof targetState.supercomputer !== 'object') {
    targetState.supercomputer = {};
  }
  var sc = targetState.supercomputer;
  var maxHp = Number.isFinite(sc.maxHp) && sc.maxHp > 0 ? Math.floor(sc.maxHp) : 920;
  sc.maxHp = maxHp;
  sc.hp = maxHp;
  sc.state = 'idle';
  sc.animElapsedSec = 0;
  sc.glitchLoopsRemaining = 0;
  sc.pendingBuildTank = false;
  sc.wantsBuildTank = false;
  sc.destroyedAt = 0;
}

function buildPreRetryPayload(currentState){
  var source = currentState && typeof currentState === 'object' ? currentState : state;
  var payload = createInitialState({ reason: 'reset' });
  payload.cells = [];
  if (Array.isArray(source.cells) && source.cells.length) {
    for (let i = 0; i < source.cells.length; i++) {
      const sourceCell = source.cells[i];
      payload.cells.push({
        i: sourceCell && Number.isFinite(sourceCell.i) ? sourceCell.i : i,
        orbitPhase: sourceCell ? sourceCell.orbitPhase : 0,
        tank: null,
      });
    }
  }
  var snapshot = null;
  if (WorldResetApi && typeof WorldResetApi.takeProgressSnapshot === 'function') {
    snapshot = WorldResetApi.takeProgressSnapshot(source);
  }
  if (snapshot && WorldResetApi && typeof WorldResetApi.restoreProgressSnapshot === 'function') {
    WorldResetApi.restoreProgressSnapshot(payload, snapshot);
  }

  payload.buyCounts = cloneJsonSafe(source.buyCounts, {});
  payload.buyPrices = cloneJsonSafe(source.buyPrices, {});
  payload.maxTankLevelAchieved = Number.isFinite(source.maxTankLevelAchieved)
    ? Math.max(1, Math.floor(source.maxTankLevelAchieved))
    : 1;

  applyPreRetryRuntimeReset(payload);
  // Defensive: ensure drones survive pre-retry reset
  if (Array.isArray(source.drones) && source.drones.length > 0
      && (!Array.isArray(payload.drones) || !payload.drones.length)) {
    payload.drones = JSON.parse(JSON.stringify(source.drones));
  }
  return payload;
}

function savePreRetryPayloadToAutoSlot(){
  var flags = ensureRuntimeFlagsState();
  if (flags.preRetryAutosavedThisCritical) return;
  flags.preRetryAutosavedThisCritical = true;
  flags.preRetryDronesSnapshot = Array.isArray(state.drones) ? cloneJsonSafe(state.drones, []) : [];

  var storageApi = window.Game && window.Game.Storage;
  if (!storageApi || typeof storageApi.saveSlot !== 'function') {
    flags.preRetrySaveFailed = true;
    return;
  }

  var payload = buildPreRetryPayload(state);
  var result = storageApi.saveSlot(getAutoRetrySlotIndex(), payload);
  if (!result || !result.ok) {
    flags.preRetrySaveFailed = true;
    console.warn('Pre-retry autosave failed:', result && result.error ? result.error : 'unknown');
    if (window.Game && window.Game.Toast && typeof window.Game.Toast.show === 'function') {
      window.Game.Toast.show(t('menu.save.toast.error'), 1800);
    }
    return;
  }
  flags.preRetrySaveFailed = false;
}

function loadPreRetryPayloadFromAutoSlot(){
  var storageApi = window.Game && window.Game.Storage;
  if (!storageApi || typeof storageApi.loadSlot !== 'function') return null;
  var loaded = storageApi.loadSlot(getAutoRetrySlotIndex());
  if (!loaded || !loaded.ok || !isValidSavedPayload(loaded.payload)) return null;
  return loaded.payload;
}

function canRestartFromAutoSlot(){
  var flags = ensureRuntimeFlagsState();
  if (flags.preRetrySaveFailed) return false;
  return !!loadPreRetryPayloadFromAutoSlot();
}

function restoreFenceSegmentsToMaxHp(){
  const maxHp = getFenceSegmentMaxHp();
  if (Array.isArray(state.fenceSegments)) {
    for (let i = 0; i < state.fenceSegments.length; i++) {
      const seg = state.fenceSegments[i];
      if (!seg) continue;
      const wasBroken = !!seg.broken;
      seg.maxHp = maxHp;
      seg.hp = maxHp;
      seg.broken = false;
      seg.reservedByDroneId = null;
      if (seg.broken !== wasBroken) syncFenceBreachForSegment(seg);
    }
  }
  if (state.fenceSegmentsMeta) state.fenceSegmentsMeta.segmentMaxHp = maxHp;
  rebuildBreachesBySideFromFence();
}

function restoreSupercomputerAfterCritical(){
  const sc = getComputerState();
  if (!sc) return;
  sc.hp = Math.max(1, Number.isFinite(sc.maxHp) ? sc.maxHp : 1);
  sc.state = 'idle';
  sc.animElapsedSec = 0;
  sc.glitchLoopsRemaining = 0;
  sc.pendingBuildTank = false;
  sc.wantsBuildTank = false;
  sc.destroyedAt = 0;
}

function getCriticalModalController(){
  if (criticalModalController || !CriticalModalApi || typeof CriticalModalApi.createController !== 'function') {
    return criticalModalController;
  }
  criticalModalController = CriticalModalApi.createController({
    documentObj: document,
    a11yOpen,
    a11yClose,
    translate: t,
    enterCriticalPause,
    exitCriticalPause,
    applyCriticalAudioPolicy,
    restoreAudioAfterCritical,
  });
  return criticalModalController;
}

function closeCriticalModal(){
  const controller = getCriticalModalController();
  if (controller && typeof controller.close === 'function') {
    controller.close();
  }
  restoreAudioAfterCritical();
  exitCriticalPause();
}

function resetWorldRuntimeState(){
  if (WorldResetApi && typeof WorldResetApi.resetWorldRuntimeState === 'function') {
    WorldResetApi.resetWorldRuntimeState({
      resetWorldRuntime: function () {
        resetGameState({ reason: 'reset' });
      },
    });
    return;
  }
  resetGameState({ reason: 'reset' });
}

function finalizePartialRestartRestore(){
  ensureTalentState();
  ensureAchievementsState();

  const sc = getComputerState();
  sc.xpToNext = xpNeededForLevel(sc.computerLevel);
  if (supercomputerController && supercomputerController.syncLevel) {
    supercomputerController.syncLevel(sc, SupercomputerSprites.config);
  }

  state.player.modsDirty = true;
  refreshTanksPowerTier();
  restoreFenceSegmentsToMaxHp();
  restoreSupercomputerAfterCritical();
  criticalFlowActive = false;
  resetCriticalEntryRuntimeFlags();
  updateDamagePointsUI();
  closeCriticalModal();
  updateUI();
}

function restartSimulationPartial(){
  stopTrackLoopSfxImmediate();
  if (WorldResetApi && typeof WorldResetApi.restartSimulationPartial === 'function') {
    WorldResetApi.restartSimulationPartial({
      getState: function () { return state; },
      resetWorldRuntime: resetWorldRuntimeState,
      onAfterRestore: function (restoredState) {
        finalizePartialRestartPostRestore(restoredState);
        finalizePartialRestartRestore();
      },
    });
    return;
  }

  resetWorldRuntimeState();
  finalizePartialRestartPostRestore(state);
  finalizePartialRestartRestore();
}

function applyCriticalRestartPostLoad(){
  clearAllTanksFromCells(state);
  spawnInitialTanksLvl1(state, 1);
  refreshTanksPowerTier();
  finalizePartialRestartPostRestore(state, { preserveProgression: true, forceFenceRuntimeReset: true });
  // Defensive: restore drones from pre-retry snapshot when current set is missing or downgraded
  var dronePayload = loadPreRetryPayloadFromAutoSlot();
  var fallbackDrones = null;
  var flags = ensureRuntimeFlagsState();
  if (Array.isArray(flags.preRetryDronesSnapshot) && flags.preRetryDronesSnapshot.length) {
    fallbackDrones = flags.preRetryDronesSnapshot;
  }
  var dronesToRestore = (dronePayload && Array.isArray(dronePayload.drones) && dronePayload.drones.length)
    ? dronePayload.drones
    : fallbackDrones;
  if (Array.isArray(dronesToRestore) && dronesToRestore.length) {
    function droneSnapshotScore(list) {
      if (!Array.isArray(list) || !list.length) return { count: 0, levelSum: 0 };
      var count = 0;
      var levelSum = 0;
      for (var i = 0; i < list.length; i++) {
        var drone = list[i];
        if (!drone || typeof drone !== 'object') continue;
        count += 1;
        levelSum += Number.isFinite(drone.level) ? Math.max(1, Math.floor(drone.level)) : 1;
      }
      return { count: count, levelSum: levelSum };
    }

    var currentScore = droneSnapshotScore(state.drones);
    var backupScore = droneSnapshotScore(dronesToRestore);
    var shouldRestore = currentScore.count < backupScore.count || currentScore.levelSum < backupScore.levelSum;

    if (shouldRestore) {
      if (DronesApi && typeof DronesApi.restoreSavedDrones === 'function') {
        DronesApi.restoreSavedDrones(state, dronesToRestore);
      } else {
        state.drones = cloneJsonSafe(dronesToRestore, []);
      }
      normalizeAndTeleportDronesAfterRestore(state);
    }
  }
  resetCriticalEntryRuntimeFlags();
}

function performCriticalRestart(){
  var payload = loadPreRetryPayloadFromAutoSlot();
  if (!payload) {
    var flags = ensureRuntimeFlagsState();
    flags.preRetrySaveFailed = true;
    if (window.Game && window.Game.Toast && typeof window.Game.Toast.show === 'function') {
      window.Game.Toast.show(t('menu.load.toast.error'), 1800);
    }
    return;
  }
  criticalFlowActive = false;
  startFromBigMenu({
    kind: 'load-slot',
    payload: payload,
    onAfterLoadRestore: applyCriticalRestartPostLoad,
  });
}

function buildCriticalSavePayload(){
  var payload = buildPreRetryPayload(state);
  if (payload && typeof payload === 'object') {
    payload.forceFenceRuntimeResetOnLoad = true;
  }
  return payload;
}

function buildSmallMenuSavePayload(slotIndex, saveView){
  const cfg = saveView && typeof saveView === 'object' ? saveView : null;
  if (!(criticalFlowActive && cfg && cfg.exitAfterSave)) {
    return state;
  }
  return buildCriticalSavePayload();
}

function handleCriticalSaveAndExit(){
  if (smallMenuRuntimeController && typeof smallMenuRuntimeController.openCriticalSaveView === 'function') {
    smallMenuRuntimeController.openCriticalSaveView();
    return;
  }
  setMenuOpen(true);
  if (ui.menuSave && typeof ui.menuSave.click === 'function') ui.menuSave.click();
}

function handleCriticalCloseToMenu(){
  criticalFlowActive = false;
  resetCriticalEntryRuntimeFlags();
  stopAndResetSessionToBigMenu();
}

function openCriticalModal(){
  const controller = getCriticalModalController();
  if (!controller || typeof controller.open !== 'function') return;
  // ensure attackMode is force-disabled immediately when showing critical modal
  ensureWorldEventsRuntimeController()?.forceDisableAttackModeRuntime(worldEventsState);
  clearAllTanksFromCells(state);
  const hasDrones = Array.isArray(state.drones) && state.drones.length > 0;
  controller.open({
    hasDrones,
    onSaveExit: handleCriticalSaveAndExit,
    onRestart: performCriticalRestart,
    onClose: handleCriticalCloseToMenu,
    canRestart: canRestartFromAutoSlot(),
  });
}

function resetGameState(options){
  const opts = options || {};
  const reason = opts.reason === 'new_game' ? 'new_game' : 'reset';
  const preservedDrones = reason !== 'new_game' && Array.isArray(state.drones) && state.drones.length
    ? cloneJsonSafe(state.drones, [])
    : [];
  const wasCollapsed = state.debug?.collapsed;
  let wasTutorialDisabled = !!(state && state.tutorial && state.tutorial.disabled);
  if (!wasTutorialDisabled) {
    try { wasTutorialDisabled = localStorage.getItem('tutorialGlobalDisabled') === '1'; } catch (_) {}
  }
  stopTrackLoopSfxImmediate();
  silenceAllTanksTrackSfx(reason === 'reset' ? 'reset' : 'restore');
  closeCriticalModal();
  criticalFlowActive = false;
  clearMergeFxQueue();
  if (state.projectiles && state.projectiles.length){
    for (const p of state.projectiles) releaseProjectile(p);
  }
  state = createInitialState({ reason });
  if (wasTutorialDisabled && state.tutorial) {
    state.tutorial.disabled = true;
    state.tutorial.completed = true;
    state.tutorial.currentStepId = null;
  }
  if (reason !== 'new_game' && preservedDrones.length) {
    if (DronesApi && typeof DronesApi.restoreSavedDrones === 'function') {
      DronesApi.restoreSavedDrones(state, preservedDrones);
    } else {
      state.drones = cloneJsonSafe(preservedDrones, []);
    }
    normalizeAndTeleportDronesAfterRestore(state);
  }
  supercomputerHudRuntime.button.lastVisible = false;
  supercomputerHudRuntime.button.lastTransform = '';
  if (ui.supercomputerBtn) ui.supercomputerBtn.style.visibility = 'hidden';
  resetCriticalEntryRuntimeFlags();
  if (reason === 'new_game') {
    resetWorldEventsRuntimeForNewGame();
  }
  ensureDamageProgressState();
  ensureDamagePointsSpentState();
  ensureCannonUpgradesAppliedState();
  if (FenceSprites && typeof FenceSprites.ensureLevel === 'function') {
    try { FenceSprites.ensureLevel(1); } catch (e) {}
  }
  // Clear popup seen-levels on New Game (T5)
  if (window.Game && window.Game.MergePopup && window.Game.MergePopup.resetSeenLevels) {
    window.Game.MergePopup.resetSeenLevels();
  }
  // ── Reset chip effects state (cooldowns, combo counters, etc.) ──
  if (window.Game && window.Game.ChipEffects && typeof window.Game.ChipEffects.reset === 'function') {
    window.Game.ChipEffects.reset();
  }
  if (DebugPanelEnabled) {
    state.debug = {
      log: [],
      targetCellIndex: null,
      talentOverrides: {},
      forceAttackMode: false,
      forceWeather: false,
      collapsed: wasCollapsed ?? false,
      previewParticles: [],
      debugStatusActive: false,
      zombieCountCache: { at: 0, text: '' },
    };
  }
  postRestoreSync();
  const sc = getComputerState();
  sc.xpToNext = xpNeededForLevel(sc.computerLevel);
  if (supercomputerController && supercomputerController.syncLevel) {
    supercomputerController.syncLevel(sc, SupercomputerSprites.config);
  }
  state.player.modsDirty = true;

  const debugPanelEl = document.getElementById('debugPanel');
  if (debugPanelEl && debugPanelEl.parentNode) {
    debugPanelEl.parentNode.removeChild(debugPanelEl);
  }
  const layoutEl = document.querySelector('.layout');
  if (layoutEl) layoutEl.classList.remove('debugLayout');

  resizeCanvas();
  state.nextCrateAt = nowSec() + BAL.crateIntervalSec;
  if (window.Game && window.Game.SupercomputerBuildTankFx && typeof window.Game.SupercomputerBuildTankFx.stop === 'function') {
    window.Game.SupercomputerBuildTankFx.stop();
  }
  spawnInitialTanksLvl1(state, 1);
  refreshTanksPowerTier();
  updateDamagePointsUI();

  if (DebugPanelEnabled) initDebugPanel();
}

// ---------- UI ----------
function a11yOpen(modalEl, opts){
  const A11y = window.Game && window.Game.A11y;
  if (A11y && typeof A11y.openModal === 'function') {
    A11y.openModal(modalEl, opts || {});
  }
}

function a11yClose(modalEl){
  const A11y = window.Game && window.Game.A11y;
  if (A11y && typeof A11y.closeModal === 'function') {
    A11y.closeModal(modalEl);
  }
}

function updateUI(){
  const nowMs = Date.now();
  const level = buyTankLevel();
  const cost = buyTankCost(level);
  const fmt = window.Game && window.Game.NumberFormat ? window.Game.NumberFormat.formatCompactRu : (n)=>String(Math.round(n));
  ui.coins.textContent = fmt(state.coins);
  ui.zcount.textContent = state.kills;
  const buyLabel = ui.buy.querySelector('[data-i18n="buyTank"]');
  if (buyLabel) buyLabel.textContent = t('buyTank', {level});
  ui.buyCost.textContent = fmt(cost);

  const Garage = window.Game && window.Game.Garage;
  const hasFree = Garage ? Garage.hasFreeCell(state) : state.cells.some(c=>!c.tank);
  ui.buy.disabled = state.coins < cost || !hasFree;

  if (ui.buyBulk) {
    const mode = buyBulkMode();
    const plan = getBulkBuyPlanByMode(mode);
    if (!plan.visible) {
      ui.buyBulk.classList.add('hidden');
      ui.buyBulk.style.display = 'none';
      ui.buyBulk.disabled = true;
    } else {
      ui.buyBulk.classList.remove('hidden');
      ui.buyBulk.style.display = '';
      ui.buyBulk.textContent = bulkBuyLabel(plan.xDisplay);
      ui.buyBulk.disabled = plan.disabled;
    }
  }

  refreshAutoMergeButton();
  updateAchievementToastState();
  applyUnlockPulseState(nowMs);

  updateProgressUI();
  updateTalentUI();
  updateStageAbilitySlots();
  updateDismantleButton();
  updateSupercomputerHudButtonPosition();
  if (DebugPanelEnabled && state.debug?.refreshZombieCounts) state.debug.refreshZombieCounts();
}

function refreshAutoMergeButton(){
  if (!ui.autoMergeBtn) return;
  if (!AutoMergeApi || typeof AutoMergeApi.getAutoMergeButtonModel !== 'function') {
    unmountAutoMergeButton();
    return;
  }

  const model = AutoMergeApi.getAutoMergeButtonModel(state);
  if (!model || !model.visible) {
    unmountAutoMergeButton();
    return;
  }

  mountAutoMergeButton();
  ui.autoMergeBtn.classList.remove('hidden');
  ui.autoMergeBtn.textContent = model.label || t('autoMerge2');
  ui.autoMergeBtn.disabled = isAutoMergeBusy || !model.enabled;
}

function runAutoMergeClick(){
  if (!AutoMergeApi || typeof AutoMergeApi.getAutoMergeButtonModel !== 'function' || typeof AutoMergeApi.runAutoMerge !== 'function') return;
  if (isAutoMergeBusy) return;

  const model = AutoMergeApi.getAutoMergeButtonModel(state);
  if (!model || !model.visible || !model.enabled) return;

  const tier = typeof AutoMergeApi.getAutoMergeTier === 'function'
    ? AutoMergeApi.getAutoMergeTier(state)
    : 'merge2';
  if (!tier || tier === 'hidden') return;

  isAutoMergeBusy = true;
  refreshAutoMergeButton();

  try {
    AutoMergeApi.runAutoMerge(state, tier);
  } finally {
    if (autoMergeBusyTimeout != null) {
      window.clearTimeout(autoMergeBusyTimeout);
      autoMergeBusyTimeout = null;
    }
    const cooldown = Number.isFinite(model.cooldownMs)
      ? Math.max(200, Math.min(400, Math.floor(model.cooldownMs)))
      : AUTO_MERGE_COOLDOWN_MS;
    autoMergeBusyTimeout = window.setTimeout(() => {
      isAutoMergeBusy = false;
      autoMergeBusyTimeout = null;
      refreshAutoMergeButton();
    }, cooldown);
    updateUI();
  }
}

function updateDismantleButton(){
  if (!ui.dismantleBtn) return;
  ui.dismantleBtn.disabled = false;
  ui.dismantleBtn.textContent = state.isDismantleMode ? t('dismantleBtnConfirm') : t('dismantleBtn');
}

function openDismantleModal(){
  if (UIModals && typeof UIModals.openDismantleModal === 'function') {
    UIModals.openDismantleModal({
      ui,
      state,
      a11yOpen,
      onClose: closeDismantleModal,
      updateDismantleButton,
      fillDismantleConfirmModal,
    });
    return;
  }
  if (!ui.dismantleModal) return;
  if (!state.isDismantleMode){
    state.isDismantleMode = true;
    state.selectedTankIds = [];
    updateDismantleButton();
    return;
  }
  const selected = (state.selectedTankIds || []).filter(id => state.cells.some(c => c.tank?.id === id));
  if (selected.length === 0){
    state.isDismantleMode = false;
    state.selectedTankIds = [];
    updateDismantleButton();
    return;
  }
  fillDismantleConfirmModal(selected);
  ui.dismantleModal.classList.remove('hidden');
  ui.dismantleModal.setAttribute('aria-hidden', 'false');
  a11yOpen(ui.dismantleModal, { initialFocus: ui.dismantleYes, onClose: closeDismantleModal });
}

function fillDismantleConfirmModal(selectedTankIds){
  if (UIModals && typeof UIModals.fillDismantleConfirmModal === 'function') {
    UIModals.fillDismantleConfirmModal({
      ui,
      state,
      t,
      selectedTankIds,
      drawTankIconTo,
    });
    return;
  }
  if (ui.dismantleConfirmText) ui.dismantleConfirmText.textContent = t('dismantleConfirmMulti');
  if (ui.dismantleYes) ui.dismantleYes.textContent = t('dismantleYes');
  if (ui.dismantleNo) ui.dismantleNo.textContent = t('dismantleNo');
  const wrap = document.getElementById('dismantleIconsWrap');
  if (wrap){
    const maxIcons = 12;
    const ids = selectedTankIds.slice(0, maxIcons);
    const rest = Math.max(0, selectedTankIds.length - maxIcons);
    wrap.innerHTML = '';
    for (const id of ids){
      const cell = state.cells.find(c => c.tank?.id === id);
      if (!cell?.tank) continue;
      const can = document.createElement('canvas');
      can.width = 36;
      can.height = 28;
      can.style.verticalAlign = 'middle';
      can.style.marginRight = '4px';
      const cctx = can.getContext('2d');
      drawTankIconTo(cctx, 18, 14, cell.tank.level, false, 0.7, { showShadow: false });
      wrap.appendChild(can);
    }
    const span = document.createElement('span');
    span.style.marginLeft = '8px';
    span.textContent = rest > 0 ? t('dismantleMore') + ' ' + rest + ' · ' + selectedTankIds.length + ' ' + t('dismantleCount') : selectedTankIds.length + ' ' + t('dismantleCount');
    wrap.appendChild(span);
  }
}

function closeDismantleModal(){
  if (UIModals && typeof UIModals.closeDismantleModal === 'function') {
    UIModals.closeDismantleModal({ ui, a11yClose });
    return;
  }
  if (!ui.dismantleModal) return;
  ui.dismantleModal.classList.add('hidden');
  ui.dismantleModal.setAttribute('aria-hidden', 'true');
  a11yClose(ui.dismantleModal);
}

function confirmDismantle(){
  const ids = state.selectedTankIds || [];
  for (const id of ids){
    const cell = state.cells.find(c => c.tank?.id === id);
    if (!cell) continue;
    cell.tank = null;
  }
  state.selectedTankIds = [];
  state.isDismantleMode = false;
  state.selectedHangarCellIndex = null;
  closeDismantleModal();
  updateDismantleButton();
  updateUI();
  if (state.debug?.refreshHangarList) state.debug.refreshHangarList();
  if (state.debug?.refreshTankExtras) state.debug.refreshTankExtras();
  if (state.debug?.refreshZombieWeights) state.debug.refreshZombieWeights();
}

function toggleDismantleSelection(tankId){
  if (!state.selectedTankIds) state.selectedTankIds = [];
  const i = state.selectedTankIds.indexOf(tankId);
  if (i >= 0) state.selectedTankIds.splice(i, 1);
  else state.selectedTankIds.push(tankId);
}

function dismantleCheckboxRect(cell){
  const size = 14;
  return { x: cell.x + cell.w - size - 4, y: cell.y + 4, w: size, h: size };
}

function hitDismantleCheckbox(cell, px, py){
  const r = dismantleCheckboxRect(cell);
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

function isTankSelectedForDismantle(tankId){
  return (state.selectedTankIds || []).indexOf(tankId) >= 0;
}

function getAchievementDefinitions(){
  if (AchievementsApi && AchievementsApi.getDefinitions) return AchievementsApi.getDefinitions();
  return [];
}

function getAchievementById(id){
  const defs = getAchievementDefinitions();
  for (let i = 0; i < defs.length; i++) {
    if (defs[i].id === id) return defs[i];
  }
  return null;
}

function ensureAchievementsModalController(){
  if (achievementsModalController) return achievementsModalController;
  if (!AchievementsModalApi || typeof AchievementsModalApi.createController !== 'function') return null;
  achievementsModalController = AchievementsModalApi.createController({
    documentObj: document,
    listEl: ui.achievementsList,
    translate: t,
  });
  return achievementsModalController;
}

function renderAchievementsList(){
  if (!ui.achievementsList) return;
  const controller = ensureAchievementsModalController();
  if (!controller || typeof controller.renderList !== 'function') return;
  const defs = getAchievementDefinitions();
  const ach = ensureAchievementsState();
  recalculateAchievementsAndQueuePopups();
  controller.renderList({
    defs,
    unlocked: ach.unlocked,
    getProgress: (def) => {
      if (AchievementsApi && AchievementsApi.getProgressValue) {
        return AchievementsApi.getProgressValue(state, def.progressType);
      }
      return def.progressType === 'merges' ? ach.totalMerges : ach.totalPurchased;
    },
  });
}

function openAchievementsModal(){
  if (!ui.achievementsModal) return;
  const controller = ensureAchievementsModalController();
  if (controller && typeof controller.collapseAll === 'function') controller.collapseAll();
  renderAchievementsList();
  ui.achievementsModal.classList.remove('hidden');
  ui.achievementsModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('achievements-open');
  a11yOpen(ui.achievementsModal, { initialFocus: ui.achievementsClose, onClose: closeAchievementsModal });
}

function closeAchievementsModal(){
  if (!ui.achievementsModal) return;
  ui.achievementsModal.classList.add('hidden');
  ui.achievementsModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('achievements-open');
  a11yClose(ui.achievementsModal);
}

function closeAchievementPopup(){
  if (!ui.achievementPopup) return;
  ui.achievementPopup.classList.add('hidden');
  ui.achievementPopup.setAttribute('aria-hidden', 'true');
  a11yClose(ui.achievementPopup);
}

function ensureProgressUI(){
  const topbar = document.querySelector('.stageUiRight') || document.querySelector('.stageCanvas') || document.body;
  if (document.getElementById('xpWrap')) return;

  const wrap = document.createElement('div');
  wrap.id = 'xpWrap';
  wrap.className = 'xpPanel hudPanel';

  wrap.innerHTML = `
    <div class="xpLabel" id="lvlText">${t('levelLabel')}: 1</div>
    <div class="xpBar">
      <div id="xpBar" class="xpFill"></div>
    </div>
    <div class="xpValue" id="xpText">0/0</div>
  `;
  topbar.appendChild(wrap);
}

function updateProgressUI(){
  const p = getComputerState();
  const lvlText = document.getElementById('lvlText');
  const xpText = document.getElementById('xpText');
  const xpBar  = document.getElementById('xpBar');
  if (!p || !lvlText || !xpText || !xpBar) return;

  const need = Math.max(1, p.xpToNext);
  const pct = clamp(p.xp / need, 0, 1) * 100;
  const pctRounded = Math.round(pct * 10) / 10;
  const fmt = window.Game && window.Game.NumberFormat ? window.Game.NumberFormat.formatCompactRu : (n)=>String(Math.round(n));
  lvlText.textContent = `${t('levelLabel')}: ${p.computerLevel}`;
  xpText.textContent = `${fmt(p.xp)}/${fmt(need)}`;
  const nextWidth = `${pctRounded}%`;
  if (xpBar.style.width !== nextWidth) xpBar.style.width = nextWidth;
}

function ensureTalentUI(){
  if (document.getElementById('talentOverlay')) return;
  if (isTalentsV2Ready()) {
    const overlayV2 = document.createElement('div');
    overlayV2.id = 'talentOverlay';
    overlayV2.className = 'overlay hidden';
    overlayV2.innerHTML = `
      <div class="modal talentTreeModal" role="dialog" aria-modal="true">
        <div class="modalHeader">
          <div class="modalTitle">${t('talentTreeTitle')}</div>
          <button class="modalClose" type="button" aria-label="Close">✕</button>
        </div>
        <div class="modalBody talentTreeBody">
          <div class="talentBranches" id="talentBranches"></div>
        </div>
        <div class="talentFooter">
          <div class="talentSummary" id="talentSummary"></div>
          <div class="talentAbilitySlots" id="talentAbilitySlots">
            <button id="talentActive0" class="btn talentAbilitySlot" type="button" data-branch="0" title="" aria-label="Active 0"></button>
            <button id="talentActive1" class="btn talentAbilitySlot" type="button" data-branch="1" title="" aria-label="Active 1"></button>
            <button id="talentActive2" class="btn talentAbilitySlot" type="button" data-branch="2" title="" aria-label="Active 2"></button>
          </div>
          <div class="talentActions">
            <button id="talentApply" class="btn btnPrimary" type="button" disabled>${t('talentApply')}</button>
            <button id="talentResetAll" class="btn btnSecondary" type="button">${t('talentResetAll')}</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlayV2);

    overlayV2.addEventListener('click', (e) => {
      if (e.target === overlayV2) requestCloseTalents();
    });
    overlayV2.querySelector('.modalClose')?.addEventListener('click', () => requestCloseTalents());
    overlayV2.querySelector('#talentApply')?.addEventListener('click', () => applyTalentSelections());
    overlayV2.querySelector('#talentResetAll')?.addEventListener('click', () => {
      resetAllTalents();
      updateUI();
    });
    overlayV2.querySelectorAll('.talentAbilitySlot').forEach(btn => {
      btn.addEventListener('click', () => {
        const branch = Number(btn.dataset.branch);
        useActiveAbility(branch);
      });
    });

    const branchesWrap = overlayV2.querySelector('#talentBranches');
    TALENTS_V2_BRANCH_IDS.forEach((branchId, idx) => {
      const column = document.createElement('div');
      column.className = 'talentBranch';
      column.dataset.branchId = branchId;
      column.dataset.branch = String(idx);
      column.innerHTML = `
        <div class="talentBranchHeader">
          <span class="talentBranchTitle">${getTalentV2BranchLabelById(branchId)}</span>
          <span class="talentBranchPoints" id="branchPointsV2-${branchId}">0</span>
        </div>
        <div class="talentTreeContainer">
          <svg class="talentTreeSvg" id="talentSvgV2-${branchId}"></svg>
          <div class="talentTreeGrid" id="talentGridV2-${branchId}" style="--rows: 7"></div>
        </div>
        <button class="btn btnSecondary talentBranchReset" data-branch-id="${branchId}" type="button">${t('talentReset')}</button>
      `;
      column.querySelector('.talentBranchReset')?.addEventListener('click', () => {
        resetTalentPendingV2(branchId);
      });
      branchesWrap.appendChild(column);
    });

    let resizeTimeoutV2 = null;
    const redrawEdgesV2 = () => {
      TALENTS_V2_BRANCH_IDS.forEach((branchId) => drawTalentEdgesV2(overlayV2, branchId));
    };
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeoutV2);
      resizeTimeoutV2 = setTimeout(redrawEdgesV2, 100);
    });
    return;
  }
}

function syncPlayerTalentsV2FromApi(){
  const api = getTalentsV2Api();
  if (!api || !state.player) return;
  if (!state.player.talentsV2 || typeof state.player.talentsV2 !== 'object') {
    state.player.talentsV2 = { ranksById: {}, freePoints: 0 };
  }
  if (typeof api.getRanks === 'function') state.player.talentsV2.ranksById = api.getRanks();
  if (typeof api.getFreePoints === 'function') {
    state.player.talentsV2.freePoints = Math.max(0, Math.floor(api.getFreePoints()));
    state.player.freeTalentPointsV2 = state.player.talentsV2.freePoints;
  }
}

function postRestoreSync(){
  ensureTalentState();
  if (isTalentsV2Ready()) {
    const api = getTalentsV2Api();
    if (api && typeof api.syncFromSave === 'function') {
      api.syncFromSave({
        ranksById: state.player && state.player.talentsV2 && state.player.talentsV2.ranksById
          ? state.player.talentsV2.ranksById
          : {},
        freePoints: state.player && state.player.talentsV2 && Number.isFinite(state.player.talentsV2.freePoints)
          ? state.player.talentsV2.freePoints
          : (state.player ? state.player.freeTalentPointsV2 : 0),
      });
    } else {
      if (api && typeof api.setRanks === 'function') {
        const ranksById = state.player && state.player.talentsV2 && state.player.talentsV2.ranksById
          ? state.player.talentsV2.ranksById
          : {};
        api.setRanks(ranksById);
      }
      if (api && typeof api.setFreePoints === 'function') {
        const freePoints = state.player && state.player.talentsV2 && Number.isFinite(state.player.talentsV2.freePoints)
          ? state.player.talentsV2.freePoints
          : (state.player ? state.player.freeTalentPointsV2 : 0);
        api.setFreePoints(Math.max(0, Math.floor(freePoints || 0)));
      }
    }
    syncPlayerTalentsV2FromApi();
  }
  if (state.player) state.player.modsDirty = true;
}

function getTalentPendingRanksV2(){
  const api = getTalentsV2Api();
  if (!api || typeof api.getPendingRanks !== 'function') return {};
  return api.getPendingRanks() || {};
}

function getTalentPendingCostV2(){
  const api = getTalentsV2Api();
  if (!api || typeof api.getPendingCost !== 'function') return 0;
  return Math.max(0, Math.floor(api.getPendingCost()));
}

function resetTalentPendingV2(branchId){
  const api = getTalentsV2Api();
  if (!api || typeof api.resetPending !== 'function') return;
  api.resetPending(branchId);
  updateTalentUI();
}

function clearTalentRuntimeEffectsV2(){
  const api = getTalentsV2Api();
  if (!api || typeof api.clearRuntimeEffects !== 'function') return;
  const tanks = [];
  for (let i = 0; i < state.cells.length; i++) {
    const tank = state.cells[i] && state.cells[i].tank;
    if (tank) tanks.push(tank);
  }
  api.clearRuntimeEffects({
    tanks,
    zombies: Array.isArray(state.zombies) ? state.zombies : [],
    fenceSegments: Array.isArray(state.fenceSegments) ? state.fenceSegments : [],
  });
}

function getTalentBranchNodesV2(branchId){
  const api = getTalentsV2Api();
  if (!api || typeof api.getTalentsByBranch !== 'function') return [];
  const list = api.getTalentsByBranch(branchId);
  if (!Array.isArray(list)) return [];
  return list;
}

function getTalentNodeLayoutV2(localIdx, node){
  if (node && node.layout && typeof node.layout === 'object') {
    const row = Number.isFinite(node.layout.row) ? Math.max(0, Math.floor(node.layout.row)) : Math.max(0, (node && node.tier ? node.tier : 1) - 1);
    const slot = Number.isFinite(node.layout.slot) ? Math.max(0, Math.floor(node.layout.slot)) : (localIdx % 3);
    const parents = Array.isArray(node.layout.parents)
      ? node.layout.parents
          .map((value) => Number.isFinite(value) ? Math.floor(value) : -1)
          .filter((value, idx, arr) => value >= 0 && arr.indexOf(value) === idx)
      : [];
    return { row, slot, parents };
  }
  const layout = TALENT_LAYOUT[localIdx];
  if (layout) return layout;
  return {
    row: Math.max(0, (node && node.tier ? node.tier : 1) - 1),
    slot: localIdx % 3,
    parents: [],
  };
}

const TALENT_UI_V2_RENDER_CACHE = {
  signature: '',
  lang: '',
  edgesLayoutKey: '',
};

function isTalentLayoutVisibleV2(overlay){
  if (!overlay || overlay.classList.contains('hidden')) return false;
  if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
    const styles = window.getComputedStyle(overlay);
    if (!styles || styles.display === 'none' || styles.visibility === 'hidden') return false;
  }
  return true;
}

function buildTalentsV2LayoutKey(overlay){
  if (!overlay) return '';
  const keyParts = [];
  for (let i = 0; i < TALENTS_V2_BRANCH_IDS.length; i++) {
    const branchId = TALENTS_V2_BRANCH_IDS[i];
    const grid = overlay.querySelector(`#talentGridV2-${branchId}`);
    if (!grid) return '';
    const rect = grid.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return '';
    keyParts.push(`${branchId}:${Math.round(rect.width)}x${Math.round(rect.height)}`);
  }
  return keyParts.join('|');
}

function getTalentsV2CurrentLang(){
  const i18n = window.Game && window.Game.I18n;
  if (!i18n || typeof i18n.getCurrentLang !== 'function') return '';
  const lang = i18n.getCurrentLang();
  return typeof lang === 'string' ? lang : '';
}

function buildTalentsV2RenderSignature(api){
  if (!api) return 'na';
  const freePoints = typeof api.getFreePoints === 'function' ? Math.max(0, Math.floor(api.getFreePoints())) : 0;
  const ranks = typeof api.getEffectiveRanks === 'function'
    ? api.getEffectiveRanks()
    : (typeof api.getRanks === 'function' ? api.getRanks() : {});
  const pending = typeof api.getPendingRanks === 'function' ? api.getPendingRanks() : {};
  const pendingCost = typeof api.getPendingCost === 'function' ? Math.max(0, Math.floor(api.getPendingCost())) : 0;
  const parts = [`fp=${freePoints}`, `pc=${pendingCost}`];
  TALENTS_V2_BRANCH_IDS.forEach((branchId) => {
    const nodes = getTalentBranchNodesV2(branchId);
    nodes.forEach((node) => {
      const rank = Math.max(0, Math.floor(ranks[node.id] || 0));
      const pendingRank = Math.max(0, Math.floor(pending[node.id] || 0));
      let canPart = 'na';
      if (typeof api.canBuy === 'function') {
        const can = api.canBuy(node.id, { includePending: true });
        if (can && can.ok) {
          canPart = 'ok';
        } else {
          const reason = can && can.reason ? can.reason : 'unknown';
          canPart = `no:${reason}`;
          const reqs = can && Array.isArray(can.missingRequires) ? can.missingRequires : [];
          if (reqs.length > 0) {
            canPart += `:${reqs.map((req) => req && req.id ? req.id : '').join(',')}`;
          }
        }
      }
      parts.push(`${node.id}=${rank}+${pendingRank}@${canPart}`);
    });
  });
  return parts.join('|');
}

function renderTalentNodesV2(overlay, branchId){
  const api = getTalentsV2Api();
  if (!api) return;
  const grid = overlay.querySelector(`#talentGridV2-${branchId}`);
  if (!grid) return;
  const ranks = typeof api.getRanks === 'function' ? api.getRanks() : {};
  const pendingRanks = typeof api.getPendingRanks === 'function' ? api.getPendingRanks() : {};
  const nodes = getTalentBranchNodesV2(branchId);
  grid.innerHTML = '';
  const maxRowsFromLayout = TALENT_LAYOUT.reduce((max, item) => Math.max(max, Number(item.row) || 0), 0) + 1;
  const maxRowsFromTree = nodes.reduce((max, item) => Math.max(max, Number(item.tier) || 1), 1);
  grid.style.setProperty('--rows', String(Math.max(1, maxRowsFromLayout, maxRowsFromTree)));

  nodes.forEach((node, idx) => {
    const layout = getTalentNodeLayoutV2(idx, node);
    const appliedRank = Math.max(0, Math.floor(ranks[node.id] || 0));
    const pendingRank = Math.max(0, Math.floor(pendingRanks[node.id] || 0));
    const rank = appliedRank + pendingRank;
    const can = typeof api.canBuy === 'function' ? api.canBuy(node.id, { includePending: true }) : { ok: false, reason: 'unknown' };
    const tooltipReason = can.ok ? '' : resolveTalentCantBuyReasonText(can);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'talentNode';
    button.dataset.talentId = node.id;
    button.dataset.branchId = branchId;
    button.dataset.talentLocal = String(idx);
    button.dataset.row = String(Math.max(0, layout.row || 0));
    button.style.setProperty('--row', String(Math.max(0, layout.row || 0)));
    button.style.setProperty('--slot', String(Math.max(0, layout.slot || 0)));
    button.classList.toggle('applied', appliedRank > 0);
    button.classList.toggle('pending', pendingRank > 0);
    button.classList.toggle('maxed', rank >= Math.max(1, node.maxRank || 1));
    button.classList.toggle('locked', !can.ok && rank <= 0);
    let descText = t(node.ui?.descKey || node.id);
    try {
      if (node && node.ui && node.ui.descKey) {
        const vars = {};
        let currentPct = 0;
        if (Array.isArray(node.effects) && node.effects.length > 0) {
          for (let i = 0; i < node.effects.length; i++) {
            const eff = node.effects[i];
            if (eff && typeof eff.perRank === 'number') {
              currentPct = Math.round(eff.perRank * 100 * rank);
              vars.current = currentPct;
              break;
            }
          }
        }
        descText = t(node.ui.descKey, vars);
        // Fallback: if translation didn't replace placeholder, force-replace it here
        try {
          descText = ('' + descText).replaceAll('{current}', String(currentPct));
        } catch (_) {}
      }
    } catch (e) {}
    const titleText = `${t(node.ui?.nameKey || node.id)}\n${descText}${tooltipReason ? `\n${tooltipReason}` : ''}`;
    button.setAttribute('data-ui-tooltip', titleText);
    button.removeAttribute('title');
    button.innerHTML = `
      <span class="talentNodeIcon" aria-hidden="true">${node.ui && node.ui.icon ? `<img src="assets/ui/icons/talents/${node.ui.icon}.png" alt="" loading="lazy">` : `<span class="talentNodeGlyph">◆</span>`}</span>
      <span class="talentNodeRank">${rank}/${Math.max(1, node.maxRank || 1)}</span>
    `;
    button.addEventListener('click', () => {
      const check = typeof api.canBuy === 'function' ? api.canBuy(node.id, { includePending: true }) : { ok: false, reason: 'unknown' };
      if (!check.ok) {
        if (window.Game && window.Game.Toast && typeof window.Game.Toast.show === 'function') {
          window.Game.Toast.show(resolveTalentCantBuyReasonText(check), 1800);
        }
        return;
      }
      const bought = typeof api.queueRank === 'function'
        ? api.queueRank(node.id)
        : (typeof api.buyRank === 'function' ? api.buyRank(node.id) : { ok: false });
      if (!bought.ok) {
        if (window.Game && window.Game.Toast && typeof window.Game.Toast.show === 'function') {
          window.Game.Toast.show(resolveTalentCantBuyReasonText(bought), 1800);
        }
        return;
      }
      syncPlayerTalentsV2FromApi();
      updateTalentUI();
      updateUI();
    });
    grid.appendChild(button);
  });
}

function drawTalentEdgesV2(overlay, branchId){
  const api = getTalentsV2Api();
  if (!api || !overlay) return false;
  if (!isTalentLayoutVisibleV2(overlay)) return false;
  const svg = overlay.querySelector(`#talentSvgV2-${branchId}`);
  const grid = overlay.querySelector(`#talentGridV2-${branchId}`);
  if (!svg || !grid) return false;

  svg.innerHTML = '';
  const gridRect = grid.getBoundingClientRect();
  if (!gridRect || gridRect.width <= 0 || gridRect.height <= 0) return false;
  svg.setAttribute('width', gridRect.width);
  svg.setAttribute('height', gridRect.height);
  svg.setAttribute('viewBox', `0 0 ${gridRect.width} ${gridRect.height}`);

  const nodes = getTalentBranchNodesV2(branchId);
  const ranks = typeof api.getRanks === 'function' ? api.getRanks() : {};

  nodes.forEach((node, localIdx) => {
    const layout = getTalentNodeLayoutV2(localIdx, node);
    const parents = Array.isArray(layout.parents) ? layout.parents : [];
    if (!parents.length) return;
    const toBtn = grid.querySelector(`[data-branch-id="${branchId}"][data-talent-local="${localIdx}"]`);
    if (!toBtn) return;
    const toRect = toBtn.getBoundingClientRect();
    const toX = toRect.left + toRect.width / 2 - gridRect.left;
    const toY = toRect.top - gridRect.top;
    const childActive = Math.max(0, Math.floor(ranks[node.id] || 0)) > 0;

    parents.forEach((parentLocalIdx) => {
      const parentNode = nodes[parentLocalIdx];
      if (!parentNode) return;
      const fromBtn = grid.querySelector(`[data-branch-id="${branchId}"][data-talent-local="${parentLocalIdx}"]`);
      if (!fromBtn) return;
      const fromRect = fromBtn.getBoundingClientRect();
      const fromX = fromRect.left + fromRect.width / 2 - gridRect.left;
      const fromY = fromRect.bottom - gridRect.top;
      const parentActive = Math.max(0, Math.floor(ranks[parentNode.id] || 0)) > 0;

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', fromX);
      line.setAttribute('y1', fromY);
      line.setAttribute('x2', toX);
      line.setAttribute('y2', toY);
      line.classList.add('talentEdge');
      if (parentActive && childActive) line.classList.add('talentEdgeActive');
      else if (parentActive) line.classList.add('talentEdgeReady');
      svg.appendChild(line);
    });
  });
  return true;
}

function updateTalentAbilitySlotsV2(container){
  const api = getTalentsV2Api();
  if (!api || !container) return;
  const nowMs = Date.now();
  container.querySelectorAll('.talentAbilitySlot').forEach(btn => {
    const branchIndex = Number(btn.dataset.branch);
    const branchId = getTalentV2BranchIdByIndex(branchIndex);
    const stateActive = typeof api.getActiveState === 'function'
      ? api.getActiveState(branchId, nowMs)
      : { unlocked: false, charges: 0, chargesMax: 0, nextRechargeAtMs: 0, isActive: false };
    const rechargeMs = Number.isFinite(stateActive.rechargeMs) ? Math.max(0, stateActive.rechargeMs) : 0;
    const nextRechargeAtMs = normalizeTalentTimerTargetMs(stateActive.nextRechargeAtMs, nowMs, rechargeMs);
    const durationMs = Number.isFinite(stateActive.durationMs) ? Math.max(0, stateActive.durationMs) : 0;
    const untilMs = normalizeTalentTimerTargetMs(stateActive.untilMs, nowMs, durationMs);
    const rechargeLeftMs = Math.max(0, nextRechargeAtMs - nowMs);
    const secLeft = Math.max(0, Math.ceil(rechargeLeftMs / 1000));
    const disabled = !stateActive.unlocked || stateActive.charges <= 0;
    const iconUrl = getTalentV2ActiveIconUrlByBranch(branchId);
    const activeTalentId = getTalentV2ActiveTalentIdByBranch(branchId);
    const activeUi = activeTalentId && typeof api.getTalentUi === 'function' ? api.getTalentUi(activeTalentId) : null;
    const activeName = activeUi && activeUi.nameKey ? t(activeUi.nameKey) : getTalentV2BranchLabelById(branchId);
    const activeDesc = activeUi && activeUi.descKey ? t(activeUi.descKey) : '';
    const chargesCurrent = Math.max(0, Math.floor(Number(stateActive.charges) || 0));
    const chargesMax = Math.max(chargesCurrent, Math.floor(Number(stateActive.chargesMax) || 0));
    const titleParts = [activeName];
    if (activeDesc) titleParts.push(activeDesc);
    titleParts.push(t('talentActiveCharges', { current: chargesCurrent, max: chargesMax }));
    titleParts.push(secLeft > 0
      ? t('talentActiveRechargeIn', { sec: secLeft })
      : t('talentActiveRechargeReady'));
    if (untilMs > nowMs) {
      titleParts.push(t('talentActiveDurationLeft', { sec: Math.max(0, Math.ceil((untilMs - nowMs) / 1000)) }));
    }
    const rechargeFill = rechargeMs > 0 && rechargeLeftMs > 0
      ? clamp(1 - (rechargeLeftMs / Math.max(1, rechargeMs)), 0, 1)
      : 0;
    const overlayColor = chargesCurrent > 0 ? 'rgba(20,20,20,0.62)' : 'rgba(255,255,255,0.58)';
    const labelText = stateActive.unlocked && secLeft > 0 ? String(secLeft) : '';

    btn.classList.toggle('talentAbilityLocked', !stateActive.unlocked);
    btn.classList.toggle('talentAbilityUnlocked', stateActive.unlocked);
    btn.classList.toggle('pending', untilMs > nowMs);
    btn.classList.add('talentAbilitySlot_v2');
    btn.style.setProperty('--talentAbilityIcon', `url("${iconUrl}")`);
    btn.style.setProperty('--talentAbilityCdFill', String(rechargeFill));
    btn.style.setProperty('--talentAbilityCdColor', overlayColor);
    btn.setAttribute('data-cd-visible', secLeft > 0 ? '1' : '0');
    btn.setAttribute('data-charge-badge', stateActive.unlocked ? String(chargesCurrent) : '');
    btn.disabled = disabled;
    btn.setAttribute('data-ui-tooltip', titleParts.join('\n'));
    btn.removeAttribute('title');
    btn.setAttribute('aria-label', activeName);
    btn.textContent = labelText;
  });
}

function updateTalentUIV2(overlay){
  const api = getTalentsV2Api();
  if (!api || !overlay) return;
  syncPlayerTalentsV2FromApi();
  const freePoints = typeof api.getFreePoints === 'function' ? Math.max(0, Math.floor(api.getFreePoints())) : 0;
  const pendingCost = typeof api.getPendingCost === 'function' ? Math.max(0, Math.floor(api.getPendingCost())) : 0;
  const pendingRanks = typeof api.getPendingRanks === 'function' ? api.getPendingRanks() : {};
  const summary = overlay.querySelector('#talentSummary');
  if (summary) {
    summary.textContent = `${t('talentPoints')}: ${freePoints} • ${t('talentPending')}: ${pendingCost}`;
  }

  TALENTS_V2_BRANCH_IDS.forEach((branchId) => {
    const titleEl = overlay.querySelector(`.talentBranch[data-branch-id="${branchId}"] .talentBranchTitle`);
    if (titleEl) titleEl.textContent = getTalentV2BranchLabelById(branchId);
    const pointsEl = overlay.querySelector(`#branchPointsV2-${branchId}`);
    if (pointsEl && typeof api.getBranchSpent === 'function') {
      const branchApplied = Math.max(0, Math.floor(api.getBranchSpent(branchId)));
      const nodes = getTalentBranchNodesV2(branchId);
      const branchPending = nodes.reduce((sum, node) => sum + Math.max(0, Math.floor(pendingRanks[node.id] || 0)), 0);
      pointsEl.textContent = branchPending > 0 ? `${branchApplied}+${branchPending}` : `${branchApplied}`;
    }

    const resetBtn = overlay.querySelector(`.talentBranchReset[data-branch-id="${branchId}"]`);
    if (resetBtn) {
      resetBtn.textContent = t('talentReset');
      const nodes = getTalentBranchNodesV2(branchId);
      const hasPending = nodes.some((node) => Math.max(0, Math.floor(pendingRanks[node.id] || 0)) > 0);
      resetBtn.disabled = !hasPending;
    }
  });

  const currentLang = getTalentsV2CurrentLang();
  const renderSignature = buildTalentsV2RenderSignature(api);
  const signatureChanged = TALENT_UI_V2_RENDER_CACHE.signature !== renderSignature || TALENT_UI_V2_RENDER_CACHE.lang !== currentLang;
  if (signatureChanged) {
    TALENTS_V2_BRANCH_IDS.forEach((branchId) => {
      renderTalentNodesV2(overlay, branchId);
    });
    TALENT_UI_V2_RENDER_CACHE.signature = renderSignature;
    TALENT_UI_V2_RENDER_CACHE.lang = currentLang;
    TALENT_UI_V2_RENDER_CACHE.edgesLayoutKey = '';
  }

  if (!isTalentLayoutVisibleV2(overlay)) {
    TALENT_UI_V2_RENDER_CACHE.edgesLayoutKey = '';
  } else {
    const layoutKey = buildTalentsV2LayoutKey(overlay);
    if (layoutKey && (signatureChanged || TALENT_UI_V2_RENDER_CACHE.edgesLayoutKey !== layoutKey)) {
      let renderedAll = true;
      TALENTS_V2_BRANCH_IDS.forEach((branchId) => {
        renderedAll = drawTalentEdgesV2(overlay, branchId) && renderedAll;
      });
      TALENT_UI_V2_RENDER_CACHE.edgesLayoutKey = renderedAll ? layoutKey : '';
    }
  }

  updateTalentAbilitySlotsV2(overlay);

  const applyBtn = overlay.querySelector('#talentApply');
  if (applyBtn) {
    applyBtn.disabled = pendingCost <= 0 || pendingCost > freePoints;
  }

  const resetAllBtn = overlay.querySelector('#talentResetAll');
  if (resetAllBtn) {
    const ranks = api.getRanks ? api.getRanks() : {};
    const hasApplied = Object.keys(ranks).some((id) => (ranks[id] || 0) > 0);
    const hasPending = Object.keys(pendingRanks).some((id) => (pendingRanks[id] || 0) > 0);
    resetAllBtn.disabled = !(hasApplied || hasPending);
  }
}

function updateTalentUI(){
  if (!state.ui.talentsOpen) return;
  const p = state.player;
  const overlay = document.getElementById('talentOverlay');
  if (!p || !overlay) return;

  if (isTalentsV2Ready()) {
    updateTalentUIV2(overlay);
    return;
  }
}

function updateStageAbilitySlots(){
  const p = state.player;
  const container = document.getElementById('stageAbilitySlots');
  if (!p || !container) return;
  if (isTalentsV2Ready()) {
    updateTalentAbilitySlotsV2(container);
    return;
  }
}

function renderCrateIcon(level){
  if (!ui.crateIcon) return;
  const iconCtx = ui.crateIcon.getContext('2d');
  if (!iconCtx) return;
  iconCtx.imageSmoothingEnabled = false;
  iconCtx.clearRect(0, 0, ui.crateIcon.width, ui.crateIcon.height);
  drawTankIconTo(
    iconCtx,
    ui.crateIcon.width / 2,
    ui.crateIcon.height / 2 + 4,
    level,
    false,
    1.8
  );
}

function openResetTalentsModal(){
  if (UIModals && typeof UIModals.openResetTalentsModal === 'function') {
    UIModals.openResetTalentsModal({ t, a11yOpen, onClose: closeResetTalentsModal });
    return;
  }
  const modal = document.getElementById('resetTalentsModal');
  if (!modal) return;
  const textEl = document.getElementById('resetTalentsModalText');
  const watchEl = document.getElementById('resetTalentsModalWatch');
  if (textEl) textEl.textContent = t('talentResetModalText');
  if (watchEl) watchEl.textContent = t('talentResetModalWatchBtn');
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  a11yOpen(modal, { initialFocus: watchEl, onClose: closeResetTalentsModal });
}
function closeResetTalentsModal(){
  if (UIModals && typeof UIModals.closeResetTalentsModal === 'function') {
    UIModals.closeResetTalentsModal({ a11yClose });
    return;
  }
  const modal = document.getElementById('resetTalentsModal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  a11yClose(modal);
}

function openCrateModal(){
  if (UIModals && typeof UIModals.openCrateModal === 'function') {
    UIModals.openCrateModal({
      state,
      ui,
      t,
      a11yOpen,
      onClose: closeCrateModal,
      renderCrateIcon,
    });
    return;
  }
  if (!state.crate || !ui.crateModal) return;
  ui.crateModal.classList.remove('hidden');
  ui.crateModal.setAttribute('aria-hidden', 'false');
  if (ui.crateText) ui.crateText.textContent = t('crateModalText');
  if (ui.crateGet){
    ui.crateGet.disabled = false;
    ui.crateGet.textContent = t('crateGet');
  }
  a11yOpen(ui.crateModal, { initialFocus: ui.crateGet, onClose: closeCrateModal });
  renderCrateIcon(state.crate.rewardLevel ?? 1);
}

function closeCrateModal(){
  if (UIModals && typeof UIModals.closeCrateModal === 'function') {
    UIModals.closeCrateModal({ ui, a11yClose });
    return;
  }
  if (!ui.crateModal) return;
  ui.crateModal.classList.add('hidden');
  ui.crateModal.setAttribute('aria-hidden', 'true');
  a11yClose(ui.crateModal);
}

function grantCrateTank(level, preferredIndex = null){
  const Garage = window.Game && window.Game.Garage;
  if (!Number.isFinite(preferredIndex)) {
    console.warn('[Crate] Invalid crate slot id for reward grant:', preferredIndex);
    return false;
  }
  const slotId = preferredIndex | 0;
  const cell = state.cells[slotId];
  if (!cell) {
    console.warn('[Crate] Reward slot is missing, grant skipped:', slotId);
    return false;
  }
  if (cell.tank) {
    console.warn('[Crate] Reward slot already occupied, grant skipped:', slotId);
    return false;
  }
  if (Garage && !Garage.isCellAvailableForTank(cell, state)) {
    console.warn('[Crate] Reward slot is unavailable, grant skipped:', slotId);
    return false;
  }
  cell.tank = makeTank(level, false);
  recordTankLevel(level);
  return true;
}

function claimCrateReward(){
  if (!state.crate || state.crate.claiming) return;
  const crateSnapshot = state.crate;
  const crateId = crateSnapshot.id;
  const crateSlotId = crateSnapshot.cellIndex;
  const rewardLevel = crateSnapshot.rewardLevel ?? 1;

  if (!Number.isFinite(crateSlotId) || !state.cells[crateSlotId]) {
    console.warn('[Crate] Cannot claim reward: invalid crate slot id:', crateSlotId);
    return;
  }

  state.crate.claiming = true;
  if (ui.crateGet){
    ui.crateGet.disabled = true;
    ui.crateGet.textContent = t('crateAdLoading');
  }

  window.setTimeout(() => {
    if (!state.crate || state.crate.id !== crateId) {
      console.warn('[Crate] Claim skipped: crate already removed or replaced before reward grant.', {
        crateId,
        crateSlotId,
      });
      closeCrateModal();
      return;
    }
    state.crate = null;
    grantCrateTank(rewardLevel, crateSlotId);
    closeCrateModal();
  }, 1200);
}

function getSupercomputerMenuController(){
  if (supercomputerMenuController || !SupercomputerMenuApi || typeof SupercomputerMenuApi.createController !== 'function') {
    return supercomputerMenuController;
  }
  supercomputerMenuController = SupercomputerMenuApi.createController({
    documentObj: document,
    a11yOpen,
    a11yClose,
    openTalents,
    closeTalents,
    onPauseLockChange: function (open) {
      setMenuPauseSource('supercomputer', !!open);
    },
    getDamagePoints: getDamagePoints,
    getAppliedCannonUpgradeLevel: getAppliedCannonUpgradeLevel,
    getCannonUpgradeStepCost: getCannonUpgradeStepCost,
    getCannonUpgradeIconFrames: getCannonUpgradeIconFrames,
    getCannonUpgradeIconFps: getCannonUpgradeIconFps,
    getCannonUpgradeConfig: getCannonUpgradeConfig,
    applyCannonUpgrade: applyCannonUpgrade,
    getDronRuntimeConfig: getDronRuntimeConfig,
    getDronLevelsCount: getDronLevelsCount,
    getDronStatsForLevel: getDronStatsForLevel,
    getAppliedDronUpgradeLevel: getAppliedDronUpgradeLevel,
    getDronUpgradeStepCost: getDronUpgradeStepCost,
    getDronUpgradeIconFrames: getDronUpgradeIconFrames,
    getDronUpgradeIconFps: getDronUpgradeIconFps,
    applyDronUpgrade: applyDronUpgrade,
    getAppliedFenceUpgradeLevel: getAppliedFenceUpgradeLevel,
    applyFenceUpgrade: applyFenceUpgrade,
    getFenceLevels: getFenceLevels,
    getFenceConfig: getFenceConfig,
    getFenceStats: getFenceStats,
    getFenceStatsForLevel: getFenceStatsForLevel,
    upgradeFence: tryUpgradeFenceLevel,
    translate: t,
  });
  return supercomputerMenuController;
}

function openSupercomputerMenu(){
  const controller = getSupercomputerMenuController();
  if (!controller || typeof controller.openRoot !== 'function') {
    openTalents();
    return;
  }
  controller.openRoot();
}

function closeSupercomputerMenu(){
  const controller = getSupercomputerMenuController();
  if (!controller || typeof controller.closeAll !== 'function') return;
  controller.closeAll();
}

function supercomputerHitTest(x, y){
  const sc = getComputerState();
  if (!sc || !Number.isFinite(sc.x) || !Number.isFinite(sc.y)) return false;
  const config = SupercomputerSprites && SupercomputerSprites.config ? SupercomputerSprites.config : null;
  const stateName = resolveSupercomputerVisualStateName(sc);
  const anim = SupercomputerSprites && SupercomputerSprites.getAnimation ? SupercomputerSprites.getAnimation(stateName) : null;
  const scale = resolveSupercomputerAnimationScale(config, anim);
  let radius = 44 * balScale;

  if (config && config.hitbox && Number.isFinite(config.hitbox.r) && config.hitbox.r > 0) {
    radius = config.hitbox.r * scale;
  } else if (anim && Number.isFinite(anim.w) && Number.isFinite(anim.h)) {
    radius = Math.max(24 * balScale, Math.max(anim.w * scale, anim.h * scale) * 0.36);
  }

  const dx = x - sc.x;
  const dy = y - sc.y;
  return (dx * dx + dy * dy) <= radius * radius;
}

// ---------- Input ----------
function getPointerPos(evt){
  const r = canvas.getBoundingClientRect();
  const x = (evt.clientX - r.left) * (viewSize.w / r.width);
  const y = (evt.clientY - r.top) * (viewSize.h / r.height);
  return {x,y};
}

function cellAt(x,y){
  for (const c of state.cells){
    if (x>=c.x && x<=c.x+c.w && y>=c.y && y<=c.y+c.h) return c;
  }
  return null;
}

function isLevelModalOpen(){
  return !!(ui.levelModal && !ui.levelModal.classList.contains('hidden'));
}

canvas.addEventListener('pointerdown', (e)=>{
  if (isBigMenuOpen()) return;
  if (isLevelModalOpen()) return;
  const p = getPointerPos(e);
  syncCrateHoverAt(p.x, p.y);
  {
    const PLRender = window.Game && window.Game.ProductionLineRender;
    if (PLRender && typeof PLRender.syncHoverAt === 'function') PLRender.syncHoverAt(p.x, p.y);
  }
  if (isBlockingModalOpen()) return;
  if (DronesApi && typeof DronesApi.handlePointerDown === 'function') {
    const dronInput = DronesApi.handlePointerDown({
      state,
      x: p.x,
      y: p.y,
      nowSec: nowSec(),
      balScale,
      boardRect: state.boardRect,
      dronConfig: getDronRuntimeConfig(),
      fenceRepairCost: getFenceRepairCostCoins(),
    });
    if (dronInput && dronInput.handled) {
      if (dronInput.changed) updateUI();
      return;
    }
  }
  if (supercomputerHitTest(p.x, p.y)) {
    openSupercomputerMenu();
    return;
  }
  // Production line: storage cell click
  {
    const PLRender = window.Game && window.Game.ProductionLineRender;
    const PLUI = window.Game && window.Game.ProductionLineUI;
    if (PLRender && typeof PLRender.hitTestStorage === 'function' && PLRender.hitTestStorage(p.x, p.y)) {
      if (PLUI && typeof PLUI.open === 'function') {
        PLUI.open(state);
      }
      return;
    }
  }
  if (crateHitTest(p.x, p.y)){
    if (state.crate) {
      state.crate.isHover = true;
      setCrateAnimationState(state.crate, 'press', true);
    }
    openCrateModal();
    return;
  }
  const trackCell = tankOnTrackAt(p.x, p.y, nowSec());
  if (trackCell !== null){
    const trackTank = state.cells[trackCell].tank;
    if (isTankPrinting(trackTank)) return;
    const changed = setTankOnTrackState(trackTank, false, { cause: 'user' });
    if (changed) {
      trackTank.cooldown = 0;
      popText(p.x, p.y, t('popHangar'), '#eaf1ff');
    }
    return;
  }
  const c = cellAt(p.x, p.y);
  if (state.isDismantleMode){
    if (c && c.tank && hitDismantleCheckbox(c, p.x, p.y)){
      toggleDismantleSelection(c.tank.id);
      return;
    }
    return;
  }
  if (!state.dragging && !isBlockingModalOpen() && tryRepairFenceSegmentAt(p.x, p.y)) {
    updateUI();
    return;
  }
  if (!c || !c.tank) return;
  if (isTankPrinting(c.tank)) return;
  if (c.tank.onTrack){
    const changed = setTankOnTrackState(c.tank, false, { cause: 'user' });
    if (changed) {
      c.tank.cooldown = 0;
      popText(p.x, p.y, t('popHangar'), '#eaf1ff');
    }
    return;
  }
  state.dragging = {
    cellIndex: c.i,
    tank: c.tank,
    dx: p.x - (c.x+c.w/2),
    dy: p.y - (c.y+c.h/2),
    x: p.x, y: p.y,
    startX: p.x,
    startY: p.y,
    moved: false,
  };
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener('pointermove', (e)=>{
  const p = getPointerPos(e);
  syncCrateHoverAt(p.x, p.y);
  {
    const PLRender = window.Game && window.Game.ProductionLineRender;
    if (PLRender && typeof PLRender.syncHoverAt === 'function') PLRender.syncHoverAt(p.x, p.y);
  }
  if (isLevelModalOpen()) {
    state.dragging = null;
    return;
  }
  if (DronesApi && typeof DronesApi.handlePointerMove === 'function') {
    const dronMove = DronesApi.handlePointerMove({
      state,
      x: p.x,
      y: p.y,
      nowSec: nowSec(),
      balScale,
      boardRect: state.boardRect,
      dronConfig: getDronRuntimeConfig(),
      fenceRepairCost: getFenceRepairCostCoins(),
    });
    if (dronMove && dronMove.handled) return;
  }
  if (!state.dragging) return;
  const dx = p.x - state.dragging.startX;
  const dy = p.y - state.dragging.startY;
  if (!state.dragging.moved && Math.hypot(dx, dy) > 6) state.dragging.moved = true;
  if (state.dragging.moved) {
    state.dragging.x = p.x;
    state.dragging.y = p.y;
  }
});

canvas.addEventListener('pointerup', (e)=>{
  const p = getPointerPos(e);
  syncCrateHoverAt(p.x, p.y);
  {
    const PLRender = window.Game && window.Game.ProductionLineRender;
    if (PLRender && typeof PLRender.syncHoverAt === 'function') PLRender.syncHoverAt(p.x, p.y);
  }
  if (isLevelModalOpen()) {
    state.dragging = null;
    return;
  }
  if (DronesApi && typeof DronesApi.handlePointerUp === 'function') {
    const dronUp = DronesApi.handlePointerUp({
      state,
      x: p.x,
      y: p.y,
      nowSec: nowSec(),
      balScale,
      boardRect: state.boardRect,
      dronConfig: getDronRuntimeConfig(),
      fenceRepairCost: getFenceRepairCostCoins(),
    });
    if (dronUp && dronUp.handled) {
      if (dronUp.changed) updateUI();
      return;
    }
  }
  if (!state.dragging) return;
  const target = cellAt(p.x, p.y);

  const from = state.cells[state.dragging.cellIndex];
  from.tank = state.dragging.tank;

  if (!from || !from.tank || isTankPrinting(from.tank)) {
    state.dragging = null;
    updateDismantleButton();
    return;
  }

  if (!state.dragging.moved){
    const changed = setTankOnTrackState(from.tank, true, { cause: 'user' });
    if (changed) {
      const mods = getMods();
      const activeSpeed = nowSec() < state.activeEffects.speedUntil ? 1.35 : 1;
      from.orbitPhase = nowSec() * BAL.tankOrbitSpeed * speedMult() * mods.orbitSpeedMul * activeSpeed;
      popText(from.x+from.w/2, from.y+from.h/2, t('popTrack'), '#bfe3ff');
    }
    state.selectedHangarCellIndex = from.i;
  } else if (target){
    const targetHasBox = state.crate && state.crate.cellIndex === target.i;
    if (targetHasBox){
      popText(target.x + target.w/2, target.y + target.h/2, t('dropOnCrateReject'), '#ffaa44');
    } else {
      const merged = performMerge(from.i, target.i, { placeResult: 'original' });
      if (!merged && !target.tank){
        target.tank = from.tank;
        from.tank = null;
      }
      state.selectedHangarCellIndex = target.i;
    }
  }
  state.dragging = null;
  updateDismantleButton();
});

canvas.addEventListener('pointerleave', ()=>{
  if (!state.crate || state.crate.isAlive === false) return;
  if (!state.crate.isHover) return;
  state.crate.isHover = false;
  if (state.crate.animState === 'hover') setCrateAnimationState(state.crate, 'idle', true);
});

canvas.addEventListener('pointerleave', ()=>{
  const PLRender = window.Game && window.Game.ProductionLineRender;
  if (PLRender && typeof PLRender.clearHover === 'function') PLRender.clearHover();
});

ui.buy.addEventListener('click', ()=> tryBuyTank());
ui.buyBulk?.addEventListener('click', ()=> tryBuyBulk());
ui.autoMergeBtn?.addEventListener('click', ()=> runAutoMergeClick());
ui.terminalCollapseBtn?.addEventListener('click', () => {
  ui.stageUiRight?.classList.add('collapsed');
  if (ui.stageAbilitySlots && ui.terminalExpandBtn) {
    ui.terminalExpandBtn.after(ui.stageAbilitySlots);
  }
});
ui.terminalExpandBtn?.addEventListener('click', () => {
  ui.stageUiRight?.classList.remove('collapsed');
  if (ui.stageAbilitySlots && ui.xpWrap) {
    ui.xpWrap.after(ui.stageAbilitySlots);
  }
});
ui.achievementsBtn?.addEventListener('click', () => openAchievementsModal());
ui.achievementsClose?.addEventListener('click', () => closeAchievementsModal());
ui.achievementsModal?.addEventListener('click', (e) => {
  if (e.target?.dataset?.achievementsClose === 'true') closeAchievementsModal();
});
ui.achievementPopupClose?.addEventListener('click', () => closeAchievementPopup());
ui.achievementPopupClaim?.addEventListener('click', () => closeAchievementPopup());
ui.achievementPopup?.addEventListener('click', (e) => {
  if (e.target?.dataset?.achievementPopupClose === 'true') closeAchievementPopup();
});
document.getElementById('resetTalentsModalClose')?.addEventListener('click', () => closeResetTalentsModal());
document.getElementById('resetTalentsModalWatch')?.addEventListener('click', () => {
  closeResetTalentsModal();
  setTimeout(() => {
    resetAllTalents();
    updateTalentUI();
    updateUI();
  }, 100);
});
document.getElementById('resetTalentsModal')?.addEventListener('click', (e) => {
  if (e.target?.dataset?.resetTalentsClose === 'true') closeResetTalentsModal();
});
[0, 1, 2].forEach(branch => {
  document.getElementById(`stageActive${branch}`)?.addEventListener('click', () => useActiveAbility(branch));
});
ui.crateGet?.addEventListener('click', () => claimCrateReward());
ui.crateClose?.addEventListener('click', () => closeCrateModal());
ui.crateModal?.addEventListener('click', (e) => {
  if (e.target?.dataset?.crateClose){
    closeCrateModal();
  }
});
ui.dismantleBtn?.addEventListener('click', () => openDismantleModal());
ui.dismantleYes?.addEventListener('click', () => confirmDismantle());
ui.dismantleNo?.addEventListener('click', () => closeDismantleModal());
ui.dismantleModal?.addEventListener('click', (e) => {
  if (e.target?.dataset?.dismantleClose === 'true') closeDismantleModal();
});
ui.levelClose?.addEventListener('click', () => closeLevelModal());
ui.levelModal?.addEventListener('pointerdown', (e) => e.stopPropagation());
ui.levelModal?.addEventListener('click', (e) => e.stopPropagation());

if (PauseManagerApi && typeof PauseManagerApi.createPauseManager === 'function') {
  pauseManager = PauseManagerApi.createPauseManager({
    windowObj: window,
    documentObj: document,
    isAutoPauseEnabled: () => isAutoPauseEnabledSetting(),
    onChange: ({ paused, reasons }) => {
      setSimulationPaused(paused, reasons);
      if (reasons && reasons.tabInactive && !menuPauseLocks.settings && !menuPauseLocks.supercomputer && !menuPauseLocks.critical && !menuPauseLocks.bigMenu) {
        setMenuOpen(true);
      }
    },
  });
  pauseManager.attach();
  syncAutoPauseWithPauseManager();
  recomputeMenuPauseLock();
}

if (DebugPanelEnabled) {
  window.addEventListener('keydown', toggleZombieAttackOverlayByHotkey);
}

window.addEventListener('keydown', function(e) {
  if (e.key !== 'Escape') return;
  if (menuPauseLocks.settings) {
    setMenuOpen(false);
  } else if (!menuPauseLocks.supercomputer && !menuPauseLocks.critical && !menuPauseLocks.bigMenu) {
    setMenuOpen(true);
  }
});


// ---------- Render ----------
function draw(){
  ctx.clearRect(0,0,viewSize.w,viewSize.h);

  drawBackground();
  drawTankTrack();
  renderFenceBase();
  drawSupercomputer();
  // ── Production Line draw ──
  {
    const _PLR = window.Game && window.Game.ProductionLineRender;
    if (_PLR && typeof _PLR.draw === 'function') {
      _PLR.draw(ctx, state);
    }
  }
  drawBoard();
  drawOrbitingTanks();
  drawCrate();
  renderZombiesAndCorpses();
  renderFenceHpBars();
  if (isTalentsV2Ready()) {
    const talentsApi = getTalentsV2Api();
    if (talentsApi && typeof talentsApi.renderStatusIcons === 'function') {
      const tanksOnTrack = [];
      for (let i = 0; i < state.cells.length; i++) {
        const tank = state.cells[i] && state.cells[i].tank;
        if (tank && tank.onTrack) tanksOnTrack.push(tank);
      }
      talentsApi.renderStatusIcons({
        canvasCtx: ctx,
        timeMs: Date.now(),
        camera: null,
        tanks: tanksOnTrack,
        zombies: state.zombies,
        getTankPos: (tank) => {
          if (!tank || !Number.isFinite(tank._statusWorldX) || !Number.isFinite(tank._statusWorldY)) return null;
          return { x: tank._statusWorldX, y: tank._statusWorldY };
        },
        getZombiePos: zombiePos,
      });
    }
  }
  renderProjectilesAndEffects();
  drawDrones();
  drawWeather();
  drawAttackModeEveningDim();
  drawLevelUpVfx();
  drawSupercomputerBoostIcons();
  if (DebugPanelEnabled && zombieAttackOverlayEnabled) drawZombieAttackOverlay();

  // If sprites failed to load, show a small hint on canvas
  if (!ZombieSprites.ready){
    drawHint(t('hintSpritesOff'));
  }

  // Debug-only zombie animation preview
  if (window.Game && window.Game.ZombieAnimPreview && window.Game.ZombieAnimPreview.isActive()){
    const previewDt = Math.min(0.033, 1/60);
    window.Game.ZombieAnimPreview.renderPreview(ctx, viewSize.w, viewSize.h, previewDt);
  }
  drawSupercomputerHpBarOverlay();
}

function drawZombieAttackOverlay(){
  if (!Array.isArray(state.fenceSegments) || !state.fenceSegments.length) return;
  ctx.save();
  ctx.translate(center.x, center.y);
  for (let i = 0; i < state.fenceSegments.length; i++) {
    const seg = state.fenceSegments[i];
    const aabb = seg && seg.holeAabb ? seg.holeAabb : null;
    if (!aabb) continue;
    const w = aabb.maxX - aabb.minX;
    const h = aabb.maxY - aabb.minY;
    ctx.strokeStyle = seg.isCorner ? 'rgba(255,203,107,0.95)' : 'rgba(131,197,255,0.75)';
    ctx.lineWidth = seg.isCorner ? 2 : 1;
    ctx.strokeRect(aabb.minX, aabb.minY, w, h);
  }

  const byId = state.fenceSegmentsMeta && state.fenceSegmentsMeta.byId ? state.fenceSegmentsMeta.byId : null;
  for (let i = 0; i < state.zombies.length; i++) {
    const z = state.zombies[i];
    if (!z || z.state === 'dying') continue;
    const zx = Math.cos(z.theta || 0) * (z.r || 0);
    const zy = Math.sin(z.theta || 0) * (z.r || 0);
    const range = Number.isFinite(z.attackRangePx) ? z.attackRangePx : ZOMBIE_DEFAULT_ATTACK_RANGE_PX;

    ctx.strokeStyle = 'rgba(124,236,170,0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(zx, zy, range, 0, Math.PI * 2);
    ctx.stroke();

    const targetId = z.attackTargetId || z.debugAttackTargetId;
    const targetSeg = (targetId && byId && byId[targetId]) ? byId[targetId] : null;
    if (targetSeg) {
      ctx.strokeStyle = 'rgba(255,99,132,0.95)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(zx, zy);
      ctx.lineTo(targetSeg.x, targetSeg.y);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255,99,132,0.95)';
      ctx.beginPath();
      ctx.arc(targetSeg.x, targetSeg.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawAttackModeEveningDim(){
  const attackCfg = getWorldEventsAttackCfg();
  const baseAlpha = Number.isFinite(attackCfg.eveningDimAlpha) ? clamp(attackCfg.eveningDimAlpha, 0, 1) : 0;
  const blend = Number.isFinite(worldEventsState.eveningDimBlend) ? clamp(worldEventsState.eveningDimBlend, 0, 1) : 0;
  const alpha = baseAlpha * blend;
  if (alpha <= 0) return;
  ctx.save();
  ctx.fillStyle = `rgba(22,24,34,${alpha})`;
  ctx.fillRect(0, 0, viewSize.w, viewSize.h);
  ctx.restore();
}

function drawLevelUpVfx(){
  const txt = state.levelUpText;
  if (!txt) return;
  if (nowSec() >= txt.until){
    state.levelUpText = null;
    return;
  }
  const age = txt.until - nowSec();
  const ringProgress = Math.min(1, (2.2 - age) / 0.4);
  ctx.save();
  ctx.translate(center.x, center.y);
  if (ringProgress < 1){
    const r = ringProgress * Math.min(viewSize.w, viewSize.h) * 0.45;
    const alpha = 0.35 * (1 - ringProgress);
    ctx.strokeStyle = `rgba(234,241,255,${alpha})`;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  const textAlpha = Math.min(1, age * 3) * Math.min(1, age);
  ctx.globalAlpha = textAlpha;
  ctx.fillStyle = '#eaf1ff';
  ctx.font = 'bold 28px system-ui, -apple-system, Segoe UI, Roboto, Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.restore();
}

function drawBackground(){
  if (groundLayer.ready && groundLayer.draw && groundLayer.draw(ctx)){
    return;
  }
  if (backgroundLayer.ready && backgroundLayer.canvas){
    ctx.drawImage(backgroundLayer.canvas, 0, 0);
    return;
  }
  const g = ctx.createLinearGradient(0,0,0,viewSize.h);
  g.addColorStop(0, '#2f7a3d');
  g.addColorStop(1, '#6b4a2c');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,viewSize.w,viewSize.h);
}

function drawDecorSpriteAt(d){
  if (!d || !DecorSprites.ready || !DecorSprites.atlasImg) return;
  const frame = DecorSprites.pickFrame(d.spriteId);
  if (!frame) return;
  const frameScale = Number.isFinite(frame.scale) && frame.scale > 0 ? frame.scale : 1;
  const scale = 0.5 * balScale * frameScale;
  const ax = frame.anchor?.x ?? 0.5;
  const ay = frame.anchor?.y ?? 0.8;
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.drawImage(
    DecorSprites.atlasImg,
    frame.x, frame.y, frame.w, frame.h,
    d.x - frame.w * scale * ax, d.y - frame.h * scale * ay,
    frame.w * scale, frame.h * scale
  );
  ctx.restore();
}

function drawDecorZombieLayer(){
  const items = [];
  if (state.decors && state.decors.length) {
    for (let i = 0; i < state.decors.length; i++) {
      const d = state.decors[i];
      if (!Number.isFinite(d.renderOrder)) d.renderOrder = i;
      items.push({ kind: 'decor', y: d.y, order: d.renderOrder, id: d.spriteId + ':' + d.renderOrder, ref: d });
    }
  }
  if (state.zombies && state.zombies.length) {
    state.nextZombieRenderOrder = Math.max(1, Number.isFinite(state.nextZombieRenderOrder) ? state.nextZombieRenderOrder : 1);
    for (let i = 0; i < state.zombies.length; i++) {
      const z = state.zombies[i];
      if (!Number.isFinite(z.renderOrder)) z.renderOrder = state.nextZombieRenderOrder++;
      const p = zombiePos(z);
      items.push({ kind: 'zombie', y: p.y, order: z.renderOrder, id: z.id || String(z.renderOrder), ref: z, x: p.x, zY: p.y });
    }
  }
  const sorted = DepthSortApi && typeof DepthSortApi.sortDecorAndZombies === 'function'
    ? DepthSortApi.sortDecorAndZombies(items)
    : items.sort((a, b) => (a.y - b.y) || (a.order - b.order));
  for (let i = 0; i < sorted.length; i++) {
    const item = sorted[i];
    if (item.kind === 'decor') drawDecorSpriteAt(item.ref);
    else if (item.kind === 'zombie') drawZombieEntity(item.ref, item.x, item.zY);
  }
}

function renderZombiesAndCorpses(){
  drawDecorZombieLayer();
}

function renderProjectilesAndEffects(){
  drawDecals();
  drawProjectiles();
  drawImpacts();
  drawParticles();
  drawDamageNumbers();
}

function drawTankTrack(){
  ctx.save();
  ctx.translate(center.x, center.y);

  ctx.beginPath();
  ctx.arc(0,0,BAL.tankOrbitRadius,0,Math.PI*2);
  ctx.strokeStyle = 'rgba(106, 72, 40, .60)';
  ctx.lineWidth = BAL.tankTrackWidth * 2.2;
  ctx.lineCap = 'round';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0,0,BAL.tankOrbitRadius + BAL.tankTrackWidth,0,Math.PI*2);
  ctx.strokeStyle = 'rgba(155, 118, 76, .32)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0,0,BAL.tankOrbitRadius - BAL.tankTrackWidth,0,Math.PI*2);
  ctx.strokeStyle = 'rgba(44, 28, 16, .35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  for (let i=0;i<120;i++){
    const n = seededNoise(i * 17.3, i * 41.7);
    const angle = i * 0.35 + n * Math.PI * 0.8;
    const r = BAL.tankOrbitRadius + (n - 0.5) * BAL.tankTrackWidth * 1.4;
    const size = 2.2 + n * 3.2;
    const alpha = 0.18 + n * 0.28;
    ctx.fillStyle = `rgba(90, 58, 30, ${alpha})`;
    ctx.beginPath();
    ctx.ellipse(Math.cos(angle) * r, Math.sin(angle) * r, size, size * 0.6, angle, 0, Math.PI*2);
    ctx.fill();
  }

  ctx.restore();
}

function resolveSupercomputerVisualStateName(sc){
  if (!sc || typeof sc.state !== 'string' || !sc.state) return 'idle';
  return sc.state === 'idle' ? 'work' : sc.state;
}

function resolveSupercomputerAnimationScale(config, anim){
  const scaleCfg = Number.isFinite(config && config.renderScale) ? Math.max(0.1, config.renderScale) : 1;
  const animScale = Number.isFinite(anim && anim.scale) ? Math.max(0.05, anim.scale) : 1;
  return scaleCfg * animScale * balScale;
}

function resolveSupercomputerAnimationFrameIndex(anim, elapsedSec){
  const frames = Math.max(1, anim && Number.isFinite(anim.frames) ? anim.frames : 1);
  const fps = Math.max(0.01, anim && Number.isFinite(anim.frameRateFps) ? anim.frameRateFps : 1);
  const duration = frames / fps;
  if (duration <= 0) return 0;
  if (anim && anim.loop === false) {
    return Math.min(frames - 1, Math.floor(Math.max(0, elapsedSec) * fps));
  }
  return Math.floor((Math.max(0, elapsedSec) % duration) * fps) % frames;
}

function resolveSupercomputerEffectEntry(rawEffect){
  if (typeof rawEffect === 'string' && rawEffect) {
    return { preset: rawEffect };
  }
  if (!rawEffect || typeof rawEffect !== 'object') return null;
  return rawEffect;
}

function mergeSupercomputerEffectPreset(effect){
  const presetName = typeof effect.preset === 'string' && effect.preset
    ? effect.preset
    : (typeof effect.type === 'string' ? effect.type : '');
  const preset = presetName && SUPERCOMPUTER_EFFECT_PRESETS[presetName]
    ? SUPERCOMPUTER_EFFECT_PRESETS[presetName]
    : null;
  if (!preset) return effect;
  return { ...preset, ...effect, kind: effect.kind || preset.kind || effect.type || presetName };
}

function buildSupercomputerEffectTransform(anim, timeSec, baseScale){
  const effects = Array.isArray(anim && anim.effects) ? anim.effects : [];
  let offsetX = 0;
  let offsetY = 0;
  let rotationRad = 0;
  let scaleX = 1;
  let scaleY = 1;

  for (let i = 0; i < effects.length; i++) {
    const rawEffect = resolveSupercomputerEffectEntry(effects[i]);
    if (!rawEffect) continue;
    const effect = mergeSupercomputerEffectPreset(rawEffect);
    const kind = typeof effect.kind === 'string' && effect.kind
      ? effect.kind
      : (typeof effect.type === 'string' ? effect.type : (typeof effect.preset === 'string' ? effect.preset : ''));
    const frequencyHz = Number.isFinite(effect.frequencyHz) ? effect.frequencyHz : 1;
    const phase = timeSec * frequencyHz * Math.PI * 2 + (Number.isFinite(effect.phase) ? effect.phase : 0);

    if (Number.isFinite(effect.offsetX)) offsetX += effect.offsetX * baseScale;
    if (Number.isFinite(effect.offsetY)) offsetY += effect.offsetY * baseScale;

    if (kind === 'shake' || kind === 'vibration' || kind === 'vibrationStrong') {
      const amplitudeX = Number.isFinite(effect.amplitudeX) ? effect.amplitudeX : 0;
      const amplitudeY = Number.isFinite(effect.amplitudeY) ? effect.amplitudeY : amplitudeX;
      offsetX += Math.sin(phase) * amplitudeX * baseScale;
      offsetY += Math.cos(phase * 1.37) * amplitudeY * baseScale;
      continue;
    }

    if (kind === 'bob' || kind === 'float' || kind === 'hover') {
      const amplitudeY = Number.isFinite(effect.amplitudeY) ? effect.amplitudeY : 0;
      const amplitudeX = Number.isFinite(effect.amplitudeX) ? effect.amplitudeX : 0;
      offsetY += Math.sin(phase) * amplitudeY * baseScale;
      offsetX += Math.cos(phase * 0.5) * amplitudeX * baseScale;
      continue;
    }

    if (kind === 'sway' || kind === 'wobble') {
      const angleDeg = Number.isFinite(effect.angleDeg) ? effect.angleDeg : 0;
      const amplitudeX = Number.isFinite(effect.amplitudeX) ? effect.amplitudeX : 0;
      rotationRad += Math.sin(phase) * angleDeg * Math.PI / 180;
      offsetX += Math.sin(phase) * amplitudeX * baseScale;
      continue;
    }

    if (kind === 'pulse') {
      const scaleMul = Number.isFinite(effect.scaleMul) ? effect.scaleMul : 0;
      const pulse = 1 + Math.sin(phase) * scaleMul;
      scaleX *= pulse;
      scaleY *= pulse;
    }
  }

  return { offsetX, offsetY, rotationRad, scaleX, scaleY };
}

function drawSupercomputerSpriteClip(sc, config, anim, elapsedSec){
  if (!(SupercomputerSprites.ready && SupercomputerSprites.atlasImg && anim)) return false;
  const anchor = config && config.anchor ? config.anchor : { x: 0.5, y: 0.75 };
  const baseScale = resolveSupercomputerAnimationScale(config, anim);
  const frameIndex = resolveSupercomputerAnimationFrameIndex(anim, elapsedSec);
  const fx = buildSupercomputerEffectTransform(anim, performance.now() * 0.001, baseScale);

  ctx.save();
  ctx.translate(sc.x + fx.offsetX, sc.y + fx.offsetY);
  if (fx.rotationRad) ctx.rotate(fx.rotationRad);
  ctx.scale(baseScale * fx.scaleX, baseScale * fx.scaleY);
  ctx.drawImage(
    SupercomputerSprites.atlasImg,
    anim.x + frameIndex * anim.w,
    anim.y,
    anim.w,
    anim.h,
    -anim.w * (Number.isFinite(anchor.x) ? anchor.x : 0.5),
    -anim.h * (Number.isFinite(anchor.y) ? anchor.y : 0.75),
    anim.w,
    anim.h
  );
  ctx.restore();
  return true;
}

function drawSupercomputerHpBar(sc, config){
  const hpBarCfg = config && config.hpBar ? config.hpBar : config;
  const visual = SupercomputerApi && typeof SupercomputerApi.resolveHpBarVisual === 'function'
    ? SupercomputerApi.resolveHpBarVisual(config || { hpBar: hpBarCfg || null }, sc, nowSec())
    : null;
  const ratio = visual ? visual.ratio : (Math.max(0, Math.min(1, (Number(sc.hp) || 0) / Math.max(1, Number(sc.maxHp) || 1))));
  const barW = (visual ? visual.width : (Number.isFinite(hpBarCfg && hpBarCfg.width) ? hpBarCfg.width : 92)) * balScale;
  const barH = (visual ? visual.height : (Number.isFinite(hpBarCfg && hpBarCfg.height) ? hpBarCfg.height : 8)) * balScale;
  const offsetY = (visual ? visual.offsetY : (Number.isFinite(hpBarCfg && hpBarCfg.offsetY) ? hpBarCfg.offsetY : -56)) * balScale;
  const radius = Math.max(3, (visual ? visual.frameRadius : 7) * balScale);
  const pulse = visual ? visual.pulse : 1;
  const phase = visual && visual.phase ? visual.phase : {
    fillStart: '#8effbe',
    fillEnd: '#32d38c',
    glow: 'rgba(98,255,172,0.42)',
    frame: 'rgba(168,255,218,0.88)',
    shadow: 'rgba(24,96,68,0.72)',
    scanAlpha: 0.18,
    hazardAlpha: 0.04,
    sparkCount: 1,
    noiseAlpha: 0.04,
  };
  const fillW = Math.max(0, Math.min(barW, barW * ratio));
  const time = nowSec();

  ctx.save();
  ctx.translate(sc.x, sc.y + offsetY);

  ctx.shadowBlur = Math.max(10, 18 * pulse * balScale);
  ctx.shadowColor = phase.glow;
  ctx.fillStyle = phase.shadow;
  rr(ctx, -barW * 0.5 - 2, -barH * 0.5 - 2, barW + 4, barH + 4, radius + 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  const bgGradient = ctx.createLinearGradient(-barW * 0.5, 0, barW * 0.5, 0);
  bgGradient.addColorStop(0, 'rgba(8, 11, 16, 0.96)');
  bgGradient.addColorStop(0.5, 'rgba(19, 24, 33, 0.98)');
  bgGradient.addColorStop(1, 'rgba(6, 8, 12, 0.96)');
  ctx.fillStyle = bgGradient;
  rr(ctx, -barW * 0.5, -barH * 0.5, barW, barH, radius);
  ctx.fill();

  ctx.save();
  rr(ctx, -barW * 0.5 + 1, -barH * 0.5 + 1, barW - 2, barH - 2, Math.max(2, radius - 1));
  ctx.clip();

  if (phase.hazardAlpha > 0) {
    ctx.strokeStyle = 'rgba(255,255,255,' + phase.hazardAlpha + ')';
    ctx.lineWidth = Math.max(1, 2 * balScale);
    for (let stripeX = -barW; stripeX < barW * 1.5; stripeX += Math.max(8, 12 * balScale)) {
      const drift = (time * 22 * balScale) % Math.max(8, 12 * balScale);
      ctx.beginPath();
      ctx.moveTo(stripeX + drift, -barH);
      ctx.lineTo(stripeX + drift + barH * 1.6, barH);
      ctx.stroke();
    }
  }

  if (fillW > 0) {
    const fillGradient = ctx.createLinearGradient(-barW * 0.5, 0, -barW * 0.5 + fillW, 0);
    fillGradient.addColorStop(0, phase.fillStart);
    fillGradient.addColorStop(0.55, phase.fillEnd);
    fillGradient.addColorStop(1, 'rgba(255,255,255,0.86)');
    ctx.fillStyle = fillGradient;
    rr(ctx, -barW * 0.5, -barH * 0.5, fillW, barH, radius);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    rr(ctx, -barW * 0.5 + 2, -barH * 0.5 + 1, Math.max(0, fillW - 4), Math.max(1, barH * 0.34), Math.max(1, radius - 2));
    ctx.fill();

    const scanWidth = Math.max(10, fillW * 0.18);
    const scanX = -barW * 0.5 + ((time * 48 * balScale) % Math.max(scanWidth + fillW, 1)) - scanWidth;
    const scanGradient = ctx.createLinearGradient(scanX, 0, scanX + scanWidth, 0);
    scanGradient.addColorStop(0, 'rgba(255,255,255,0)');
    scanGradient.addColorStop(0.5, 'rgba(255,255,255,' + phase.scanAlpha + ')');
    scanGradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = scanGradient;
    ctx.fillRect(-barW * 0.5, -barH * 0.5, fillW, barH);

    if (phase.noiseAlpha > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + phase.noiseAlpha + ')';
      const noiseStep = Math.max(3, Math.round(5 * balScale));
      for (let noiseX = 0; noiseX < fillW; noiseX += noiseStep) {
        const wave = Math.sin(time * 7 + noiseX * 0.21);
        const alpha = Math.max(0.02, phase.noiseAlpha * (0.45 + wave * 0.55));
        ctx.fillStyle = 'rgba(255,255,255,' + alpha.toFixed(3) + ')';
        ctx.fillRect(-barW * 0.5 + noiseX, -barH * 0.5 + 1, Math.max(1, noiseStep - 1), Math.max(1, barH - 2));
      }
    }
  }

  ctx.restore();

  if (phase.sparkCount > 0 && fillW > 0) {
    const sparkBaseX = -barW * 0.5 + fillW;
    ctx.save();
    rr(ctx, -barW * 0.5, -barH * 0.5, barW, barH, radius);
    ctx.clip();
    for (let sparkIndex = 0; sparkIndex < phase.sparkCount; sparkIndex++) {
      const seed = sparkIndex * 1.73 + 0.4;
      const sparkY = Math.sin(time * (4.5 + sparkIndex) + seed) * Math.max(2, barH * 0.85);
      const sparkLen = Math.max(4, (6 + sparkIndex * 2) * balScale * pulse);
      const sparkAlpha = Math.max(0.12, 0.42 - sparkIndex * 0.05);
      const sparkStartX = Math.max(-barW * 0.5, sparkBaseX - sparkLen * 0.35);
      const sparkEndX = Math.min(barW * 0.5, sparkBaseX + sparkLen * 0.65);
      if (sparkEndX <= sparkStartX) continue;
      ctx.strokeStyle = 'rgba(255,240,210,' + sparkAlpha.toFixed(3) + ')';
      ctx.lineWidth = Math.max(1, 1.1 * balScale);
      ctx.beginPath();
      ctx.moveTo(sparkStartX, sparkY - sparkLen * 0.2);
      ctx.lineTo(sparkEndX, sparkY + sparkLen * 0.25);
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.strokeStyle = phase.frame;
  ctx.lineWidth = Math.max(1, 1.2 * balScale);
  rr(ctx, -barW * 0.5, -barH * 0.5, barW, barH, radius);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  rr(ctx, -barW * 0.5 + 1.5, -barH * 0.5 + 1.5, Math.max(0, barW - 3), Math.max(0, barH - 3), Math.max(2, radius - 2));
  ctx.stroke();
  ctx.restore();
}

function drawSupercomputerHpBarOverlay(){
  const sc = getComputerState();
  if (!sc) return;
  const config = SupercomputerSprites && SupercomputerSprites.config ? SupercomputerSprites.config : null;
  drawSupercomputerHpBar(sc, config);
}

function drawSupercomputerFallback(sc){
  ctx.save();
  ctx.translate(sc.x, sc.y);
  ctx.fillStyle = sc.state === 'destroyed' || sc.state === 'destroy' ? 'rgba(82,82,82,0.75)' : 'rgba(76,122,196,0.8)';
  rr(ctx, -34 * balScale, -42 * balScale, 68 * balScale, 62 * balScale, 10 * balScale);
  ctx.fill();
  ctx.fillStyle = 'rgba(204,233,255,0.85)';
  rr(ctx, -24 * balScale, -32 * balScale, 48 * balScale, 24 * balScale, 6 * balScale);
  ctx.fill();
  if (sc.state === 'glitch') {
    ctx.fillStyle = 'rgba(255,94,94,0.8)';
    rr(ctx, -22 * balScale, -30 * balScale, 44 * balScale, 20 * balScale, 4 * balScale);
    ctx.fill();
  }
  ctx.restore();
}

function drawSupercomputer(){
  const sc = getComputerState();
  if (!sc) return;

  const config = SupercomputerSprites && SupercomputerSprites.config ? SupercomputerSprites.config : null;
  const stateName = resolveSupercomputerVisualStateName(sc);
  const anim = SupercomputerSprites && SupercomputerSprites.getAnimation ? SupercomputerSprites.getAnimation(stateName) : null;

  if (SupercomputerSprites.ready && SupercomputerSprites.atlasImg && anim) {
    var elapsed = Number.isFinite(sc.animElapsedSec) ? sc.animElapsedSec : 0;
    if (sc.state === 'destroyed') {
      const fps = Math.max(0.01, anim.frameRateFps || 1);
      const duration = Math.max(0, Math.max(1, anim.frames || 1) / fps);
      elapsed = Math.max(0, duration - (1 / fps));
    }
    drawSupercomputerSpriteClip(sc, config, anim, elapsed);
  } else {
    drawSupercomputerFallback(sc);
  }
}

function getBoostEffectUntil(def){
  if (!def || !def.key) return 0;
  if (def.source === 'state') {
    return normalizeStoredUntilSec(state[def.key]);
  }
  if (def.source === 'activeEffects') {
    const effects = state.activeEffects;
    return normalizeStoredUntilSec(effects && effects[def.key]);
  }
  return 0;
}

function getSupercomputerBoostIconsConfig(){
  const cfg = SupercomputerSprites?.config?.boostIcons;
  return {
    anchor: cfg && (cfg.anchor === 'top' || cfg.anchor === 'bottom') ? cfg.anchor : 'top',
    offsetX: Number.isFinite(cfg && cfg.offsetX) ? cfg.offsetX : 0,
    offsetY: Number.isFinite(cfg && cfg.offsetY) ? cfg.offsetY : -10,
    maxPerRow: Number.isFinite(cfg && cfg.maxPerRow) ? Math.max(1, Math.floor(cfg.maxPerRow)) : 4,
    gapX: Number.isFinite(cfg && cfg.gapX) ? Math.max(0, cfg.gapX) : 6,
    gapY: Number.isFinite(cfg && cfg.gapY) ? Math.max(0, cfg.gapY) : 6,
  };
}

function collectActiveSupercomputerBoosts(now){
  const defs = supercomputerHudRuntime.activeDefs;
  const remaining = supercomputerHudRuntime.activeRemainingSec;
  defs.length = 0;
  remaining.length = 0;

  let activeKey = '';
  for (let i = 0; i < BOOST_EFFECT_DEFS.length; i++) {
    const def = BOOST_EFFECT_DEFS[i];
    const until = getBoostEffectUntil(def);
    const remainingSec = until - now;
    if (remainingSec <= 0) continue;
    defs.push(def);
    remaining.push(remainingSec);
    activeKey += activeKey ? ('|' + def.boostId) : def.boostId;
  }

  return {
    activeKey,
    count: defs.length,
  };
}

function resolveSupercomputerSpriteMetrics(sc){
  const config = SupercomputerSprites && SupercomputerSprites.config ? SupercomputerSprites.config : null;
  const stateName = resolveSupercomputerVisualStateName(sc);
  const anim = SupercomputerSprites && SupercomputerSprites.getAnimation ? SupercomputerSprites.getAnimation(stateName) : null;
  const scale = resolveSupercomputerAnimationScale(config, anim);

  let width = SUPERCOMPUTER_FALLBACK_BOUNDS.w * balScale;
  let height = SUPERCOMPUTER_FALLBACK_BOUNDS.h * balScale;
  let anchorX = SUPERCOMPUTER_FALLBACK_BOUNDS.anchorX;
  let anchorY = SUPERCOMPUTER_FALLBACK_BOUNDS.anchorY;

  if (SupercomputerSprites.ready && SupercomputerSprites.atlasImg && anim) {
    width = anim.w * scale;
    height = anim.h * scale;
    const anchor = config && config.anchor ? config.anchor : { x: 0.5, y: 0.75 };
    anchorX = Number.isFinite(anchor.x) ? anchor.x : 0.5;
    anchorY = Number.isFinite(anchor.y) ? anchor.y : 0.75;
  }

  const left = sc.x - width * anchorX;
  const top = sc.y - height * anchorY;

  return {
    centerX: left + width * 0.5,
    centerY: top + height * 0.5,
    width,
    height,
    halfW: width * 0.5,
    halfH: height * 0.5,
  };
}

function rectsOverlap(a, b){
  if (!a || !b) return false;
  return !(a.maxX <= b.minX || a.minX >= b.maxX || a.maxY <= b.minY || a.minY >= b.maxY);
}

function ensureSupercomputerBoostLayout(now){
  const sc = getComputerState();
  if (!sc) return null;

  const activeState = collectActiveSupercomputerBoosts(now);
  const layout = supercomputerHudRuntime.layout;
  const spriteMetrics = resolveSupercomputerSpriteMetrics(sc);
  layout.spriteMetrics = spriteMetrics;

  if (activeState.count <= 0) {
    layout.activeKey = '';
    layout.count = 0;
    layout.positions.length = 0;
    layout.boostBBox = null;
    return {
      sc,
      spriteMetrics,
      activeCount: 0,
      iconSize: Math.max(16, Math.round(24 * balScale)),
      gapY: Math.max(0, Math.round(6 * balScale)),
    };
  }

  const cfg = getSupercomputerBoostIconsConfig();
  const iconSize = Math.max(16, Math.round(24 * balScale));
  const gapX = Math.max(0, Math.round(cfg.gapX * balScale));
  const gapY = Math.max(0, Math.round(cfg.gapY * balScale));
  const timerOffset = Math.max(10, Math.round(12 * balScale));
  const fontSize = Math.max(10, Math.round(11 * balScale));
  const maxPerRow = Math.max(1, Math.floor(cfg.maxPerRow));

  const baseX = spriteMetrics.centerX + Math.round(cfg.offsetX * balScale);
  let baseY = cfg.anchor === 'bottom'
    ? (spriteMetrics.centerY + spriteMetrics.halfH)
    : (spriteMetrics.centerY - spriteMetrics.halfH);
  baseY += Math.round(cfg.offsetY * balScale);

  const layoutDirty =
    layout.activeKey !== activeState.activeKey ||
    layout.count !== activeState.count ||
    layout.iconSize !== iconSize ||
    layout.gapX !== gapX ||
    layout.gapY !== gapY ||
    layout.timerOffset !== timerOffset ||
    layout.fontSize !== fontSize ||
    layout.maxPerRow !== maxPerRow ||
    layout.baseX !== baseX ||
    layout.baseY !== baseY;

  if (layoutDirty) {
    const rowsCount = Math.ceil(activeState.count / maxPerRow);
    const groupHeight = rowsCount * iconSize + Math.max(0, rowsCount - 1) * gapY;
    const rowStepY = iconSize + gapY;
    const colStepX = iconSize + gapX;
    const groupTopY = baseY - groupHeight;

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let idx = 0;

    for (let row = 0; row < rowsCount; row++) {
      const rowCount = Math.min(maxPerRow, activeState.count - row * maxPerRow);
      const rowWidth = rowCount * iconSize + Math.max(0, rowCount - 1) * gapX;
      const rowStartX = -rowWidth * 0.5 + iconSize * 0.5;
      const rowY = groupTopY + row * rowStepY + iconSize * 0.5;

      for (let col = 0; col < rowCount; col++) {
        const pos = layout.positions[idx] || (layout.positions[idx] = { x: 0, y: 0 });
        pos.x = baseX + rowStartX + col * colStepX;
        pos.y = rowY;

        const iconLeft = pos.x - iconSize * 0.5;
        const iconTop = pos.y - iconSize * 0.5;
        const iconRight = pos.x + iconSize * 0.5;
        const labelBottom = pos.y + iconSize * 0.5 + 2 + fontSize;

        if (iconLeft < minX) minX = iconLeft;
        if (iconTop < minY) minY = iconTop;
        if (iconRight > maxX) maxX = iconRight;
        if (labelBottom > maxY) maxY = labelBottom;
        idx += 1;
      }
    }

    layout.positions.length = activeState.count;
    if (!layout.boostBBox) layout.boostBBox = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    layout.boostBBox.minX = minX;
    layout.boostBBox.minY = minY;
    layout.boostBBox.maxX = maxX;
    layout.boostBBox.maxY = maxY;
    layout.activeKey = activeState.activeKey;
    layout.count = activeState.count;
    layout.iconSize = iconSize;
    layout.gapX = gapX;
    layout.gapY = gapY;
    layout.timerOffset = timerOffset;
    layout.fontSize = fontSize;
    layout.maxPerRow = maxPerRow;
    layout.baseX = baseX;
    layout.baseY = baseY;
  }

  return {
    sc,
    spriteMetrics,
    activeCount: activeState.count,
    iconSize,
    gapY,
  };
}

function updateSupercomputerHudButtonPosition(){
  if (!ui.supercomputerBtn) return;

  const now = nowSec();
  const layoutResult = ensureSupercomputerBoostLayout(now);
  let spriteMetrics = layoutResult && layoutResult.spriteMetrics
    ? layoutResult.spriteMetrics
    : resolveSupercomputerSpriteMetrics(getComputerState());
  if (!spriteMetrics) {
    const sc = getComputerState();
    if (sc && Number.isFinite(sc.x) && Number.isFinite(sc.y)) {
      const fallbackBounds = {
        w: SUPERCOMPUTER_FALLBACK_BOUNDS.w * balScale,
        h: SUPERCOMPUTER_FALLBACK_BOUNDS.h * balScale,
      };
      spriteMetrics = {
        centerX: sc.x,
        centerY: sc.y,
        width: fallbackBounds.w,
        height: fallbackBounds.h,
        halfW: fallbackBounds.w * 0.5,
        halfH: fallbackBounds.h * 0.5,
      };
    }
  }
  if (!spriteMetrics) {
    if (supercomputerHudRuntime.button.lastVisible !== false) {
      ui.supercomputerBtn.style.visibility = 'hidden';
      supercomputerHudRuntime.button.lastVisible = false;
    }
    return;
  }

  const btnState = supercomputerHudRuntime.button;
  const btnW = Math.max(36, ui.supercomputerBtn.offsetWidth || btnState.width || 42);
  const btnH = Math.max(36, ui.supercomputerBtn.offsetHeight || btnState.height || 42);
  btnState.width = btnW;
  btnState.height = btnH;

  const scConfig = SupercomputerSprites && SupercomputerSprites.config ? SupercomputerSprites.config : null;
  const btnOffset = scConfig && scConfig.button && scConfig.button.offset ? scConfig.button.offset : null;
  const btnMarginX = btnOffset && Number.isFinite(btnOffset.x) ? btnOffset.x : 10;
  const btnMarginY = btnOffset && Number.isFinite(btnOffset.y) ? btnOffset.y : 0;
  let x = spriteMetrics.centerX + spriteMetrics.halfW + btnMarginX;
  let y = spriteMetrics.centerY - btnH * 0.5 + btnMarginY;

  const boostBBox = supercomputerHudRuntime.layout.boostBBox;
  const buttonBox = {
    minX: x,
    minY: y,
    maxX: x + btnW,
    maxY: y + btnH,
  };
  if (rectsOverlap(buttonBox, boostBBox)) {
    y += supercomputerHudRuntime.layout.iconSize + supercomputerHudRuntime.layout.gapY;
  }

  const canvasRect = canvas.getBoundingClientRect();
  const stageCanvasEl = canvas && canvas.parentElement ? canvas.parentElement : null;
  const stageRect = stageCanvasEl ? stageCanvasEl.getBoundingClientRect() : canvasRect;
  const xPx = Math.round(canvasRect.left - stageRect.left + x);
  const yPx = Math.round(canvasRect.top - stageRect.top + y);
  const nextTransform = 'translate3d(' + xPx + 'px,' + yPx + 'px,0)';

  if (btnState.lastTransform !== nextTransform) {
    ui.supercomputerBtn.style.setProperty('--supercomputer-btn-transform', nextTransform);
    ui.supercomputerBtn.style.transform = nextTransform;
    btnState.lastTransform = nextTransform;
  }
  if (btnState.lastVisible !== true) {
    ui.supercomputerBtn.style.visibility = 'visible';
    btnState.lastVisible = true;
  }
}

function isValidBoostFrame(frame){
  return !!(
    frame &&
    Number.isFinite(frame.x) &&
    Number.isFinite(frame.y) &&
    Number.isFinite(frame.w) && frame.w > 0 &&
    Number.isFinite(frame.h) && frame.h > 0
  );
}

function drawSupercomputerBoostIcons(){
  if (!BoostIconsSprites || !BoostIconsSprites.ready || !BoostIconsSprites.atlasImg || !BoostIconsSprites.boosts) return;

  const layoutResult = ensureSupercomputerBoostLayout(nowSec());
  if (!layoutResult || layoutResult.activeCount <= 0) return;

  const atlas = BoostIconsSprites.atlasImg;
  const boostsConfig = BoostIconsSprites.boosts;
  const now = nowSec();
  const iconSize = supercomputerHudRuntime.layout.iconSize;
  const fontSize = supercomputerHudRuntime.layout.fontSize;
  const defs = supercomputerHudRuntime.activeDefs;
  const positions = supercomputerHudRuntime.layout.positions;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = '700 ' + fontSize + 'px Roboto, Arial, sans-serif';

  for (let i = 0; i < defs.length; i++) {
    const def = defs[i];
    const pos = positions[i];
    if (!pos) continue;
    const until = getBoostEffectUntil(def);
    const remainingSec = until - now;
    if (remainingSec <= 0) continue;

    const boostCfg = boostsConfig[def.boostId] || null;
    const iconFrames = boostCfg && Array.isArray(boostCfg.iconFrames) ? boostCfg.iconFrames : null;
    const overlayFrames = boostCfg && Array.isArray(boostCfg.cooldownOverlayFrames) ? boostCfg.cooldownOverlayFrames : null;
    const iconFrame = iconFrames && iconFrames.length > 0 ? iconFrames[0] : null;
    const x = pos.x;
    const y = pos.y;

    ctx.fillStyle = 'rgba(10, 8, 6, 0.62)';
    rr(ctx, x - iconSize * 0.5, y - iconSize * 0.5, iconSize, iconSize, Math.max(4, Math.round(5 * balScale)));
    ctx.fill();

    if (isValidBoostFrame(iconFrame)) {
      ctx.drawImage(
        atlas,
        iconFrame.x,
        iconFrame.y,
        iconFrame.w,
        iconFrame.h,
        x - iconSize * 0.5,
        y - iconSize * 0.5,
        iconSize,
        iconSize
      );
    }

    if (overlayFrames && overlayFrames.length >= 2 && Number.isFinite(def.secondsTotal) && def.secondsTotal > 0) {
      const p = clamp(1 - (remainingSec / def.secondsTotal), 0, 1);
      const overlayIndex = Math.floor(p * (overlayFrames.length - 1));
      const overlayFrame = overlayFrames[overlayIndex];
      if (isValidBoostFrame(overlayFrame)) {
        ctx.drawImage(
          atlas,
          overlayFrame.x,
          overlayFrame.y,
          overlayFrame.w,
          overlayFrame.h,
          x - iconSize * 0.5,
          y - iconSize * 0.5,
          iconSize,
          iconSize
        );
      }
    }

    ctx.fillStyle = 'rgba(255, 245, 224, 0.98)';
    ctx.fillText(String(Math.ceil(remainingSec)), x, y + iconSize * 0.5 + 2);
  }

  ctx.restore();
}

function drawDrones(){
  if (!(DronesApi && typeof DronesApi.draw === 'function')) return;
  DronesApi.draw({
    state,
    ctx,
    nowSec: nowSec(),
    balScale,
    boardRect: state.boardRect,
    dronConfig: getDronRuntimeConfig(),
    dronSprites: DronSprites,
    fenceRepairCost: getFenceRepairCostCoins(),
  });
}

function renderFenceBase(){
  const halfSide = BAL.fenceRadius;
  const spriteKeys = resolveFenceSpriteKeys();
  const useSprites = FenceSprites.ready && !!spriteKeys;
  const segmentsPerSide = getFenceSegmentsPerSide();
  const maxHp = getFenceSegmentMaxHp();

  ctx.save();
  ctx.translate(center.x, center.y);

  if (useSprites){
    const spriteHash = Object.values(spriteKeys).join('|');
    const needRebuild =
      !state.fenceSegments ||
      state.fenceSegments.length === 0 ||
      state.fenceSegments[0].x == null ||
      state.fenceSegments[0].y == null ||
      !state.fenceSegmentsMeta ||
      state.fenceSegmentsMeta.halfSide !== halfSide ||
      state.fenceSegmentsMeta.fenceWidth !== BAL.fenceWidth ||
      state.fenceSegmentsMeta.segmentsPerSide !== segmentsPerSide ||
      state.fenceSegmentsMeta.spriteHash !== spriteHash ||
      state.fenceSegmentsMeta.cornerInsetPxOverride !== FenceSprites.cornerInsetPx;
    if (needRebuild){
      const hpById = {};
      if (Array.isArray(state.fenceSegments)) {
        for (let i = 0; i < state.fenceSegments.length; i++) {
          const prev = state.fenceSegments[i];
          if (!prev || !prev.id || !Number.isFinite(prev.hp)) continue;
          hpById[prev.id] = prev.hp;
        }
      }
      if (state.savedFenceState && state.savedFenceState.hpById && typeof state.savedFenceState.hpById === 'object') {
        const saveSegmentsPerSide = Number.isFinite(state.savedFenceState.segmentsPerSide)
          ? Math.max(1, Math.floor(state.savedFenceState.segmentsPerSide))
          : null;
        if (saveSegmentsPerSide == null || saveSegmentsPerSide === segmentsPerSide) {
          Object.assign(hpById, state.savedFenceState.hpById);
        }
      }

      if (FenceLayoutApi && typeof FenceLayoutApi.buildSquareFenceSegments === 'function') {
        const rawSegments = FenceLayoutApi.buildSquareFenceSegments({
          halfSide,
          fenceWidth: BAL.fenceWidth,
          spriteKeys,
          segmentsPerSide,
          getFrame: (spriteId) => FenceSprites.pickFrame(spriteId),
          cornerInsetPxOverride: FenceSprites.cornerInsetPx,
        });
        state.fenceSegments = rawSegments.map((seg) => {
          const id = seg.id || `${seg.kind || 'segment'}#${seg.sideIndex || 0}`;
          const hp = Number.isFinite(hpById[id]) ? clamp(hpById[id], 0, maxHp) : maxHp;
          const broken = hp <= 0;
          const intactId = seg.spriteId;
          const brokenId = resolveBrokenSpriteId(seg.kind, spriteKeys);
          return {
            ...seg,
            id,
            spriteIdIntact: intactId,
            spriteIdBroken: brokenId,
            maxHp,
            hp,
            broken,
            reservedByDroneId: null,
          };
        });
      } else {
        state.fenceSegments = [];
      }
      const byId = {};
      for (let i = 0; i < state.fenceSegments.length; i++) {
        const seg = state.fenceSegments[i];
        if (seg && seg.id) byId[seg.id] = seg;
      }
      state.fenceSegmentsMeta = {
        halfSide,
        fenceWidth: BAL.fenceWidth,
        segmentsPerSide,
        segmentMaxHp: maxHp,
        spriteHash,
        cornerInsetPxOverride: FenceSprites.cornerInsetPx,
        byId,
        sideMath: null,
      };
      rebuildBreachesBySideFromFence();
      state.savedFenceState = null;
    }
    if (state.fenceSegmentsMeta && state.fenceSegmentsMeta.segmentMaxHp !== maxHp) {
      clampFenceSegmentsToMaxHp(maxHp);
      state.fenceSegmentsMeta.segmentMaxHp = maxHp;
    }
    for (const seg of state.fenceSegments){
      const spriteId = seg.broken ? seg.spriteIdBroken : seg.spriteIdIntact;
      const frame = FenceSprites.pickFrame(spriteId);
      if (!frame || !FenceSprites.atlasImg) continue;
      ctx.save();
      ctx.translate(seg.x, seg.y);
      const rotationRad = (Number.isFinite(frame.rotationDeg) ? frame.rotationDeg : 0) * Math.PI / 180;
      if (rotationRad) ctx.rotate(rotationRad);
      const scale = (BAL.fenceWidth / Math.max(frame.w, frame.h)) * 1.2 * resolveFenceFrameScale(frame);
      const ax = frame.anchor?.x ?? 0.5;
      const ay = frame.anchor?.y ?? 0.5;
      ctx.drawImage(
        FenceSprites.atlasImg,
        frame.x, frame.y, frame.w, frame.h,
        -frame.w * scale * ax, -frame.h * scale * ay,
        frame.w * scale, frame.h * scale
      );
      ctx.restore();

      // smoke overlay for broken segments (optional)
      try {
        if (seg.broken && FenceSprites && FenceSprites.config && FenceSprites.config.smoke && Array.isArray(FenceSprites.config.smoke.frames) && FenceSprites.config.smoke.frames.length > 0) {
          const smoke = FenceSprites.config.smoke;
          const fps = Number.isFinite(smoke.fps) ? Math.max(0.01, smoke.fps) : 0;
          if (fps > 0) {
            const framesList = smoke.frames;
            const frameIndex = Math.floor(nowSec() * fps) % framesList.length;
            const smokeId = framesList[frameIndex];
            const smokeFrame = FenceSprites.pickFrame(smokeId);
            if (smokeFrame && FenceSprites.atlasImg) {
              ctx.save();
              const offset = smoke.offset || { x: 0, y: 0 };
              ctx.translate(seg.x + (offset.x || 0), seg.y + (offset.y || 0));
              const rotationRad = (Number.isFinite(smokeFrame.rotationDeg) ? smokeFrame.rotationDeg : 0) * Math.PI / 180;
              if (rotationRad) ctx.rotate(rotationRad);
              const baseScale = (BAL.fenceWidth / Math.max(smokeFrame.w, smokeFrame.h)) * 1.2 * resolveFenceFrameScale(smokeFrame);
              const smokeScaleMul = Number.isFinite(smoke.scale) ? smoke.scale : 1;
              const ax = smokeFrame.anchor?.x ?? 0.5;
              const ay = smokeFrame.anchor?.y ?? 0.5;
              const scale = baseScale * smokeScaleMul;
              ctx.drawImage(
                FenceSprites.atlasImg,
                smokeFrame.x, smokeFrame.y, smokeFrame.w, smokeFrame.h,
                -smokeFrame.w * scale * ax, -smokeFrame.h * scale * ay,
                smokeFrame.w * scale, smokeFrame.h * scale
              );
              ctx.restore();
            }
          }
        }
      } catch (e) {}
    }
  } else {
    state.fenceSegments = [];
    state.fenceSegmentsMeta = null;
    const size = halfSide * 2;
    ctx.lineJoin = 'miter';
    ctx.miterLimit = 4;
    ctx.strokeStyle = 'rgba(161, 110, 64, .55)';
    ctx.lineWidth = BAL.fenceWidth;
    ctx.beginPath();
    ctx.rect(-halfSide, -halfSide, size, size);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(59, 35, 19, .38)';
    ctx.lineWidth = Math.max(1, BAL.fenceWidth * 0.4);
    ctx.beginPath();
    ctx.rect(-halfSide + 5, -halfSide + 5, size - 10, size - 10);
    ctx.stroke();
  }

  ctx.restore();
}

function renderFenceHpBars(){
  if (!Array.isArray(state.fenceSegments) || !state.fenceSegments.length) return;
  const hpBar = getFenceHealthBarConfig();
  ctx.save();
  ctx.translate(center.x, center.y);
  for (let i = 0; i < state.fenceSegments.length; i++) {
    const seg = state.fenceSegments[i];
    if (!seg || !(seg.hp < seg.maxHp)) continue;
    const ratio = clamp(seg.hp / Math.max(1, seg.maxHp), 0, 1);
    const greenWidth = Math.round(hpBar.w * ratio);
    const barX = Math.round(seg.x - hpBar.w * 0.5);
    const barY = Math.round(seg.y + hpBar.offsetY);
    ctx.fillStyle = 'rgba(72,72,72,0.95)';
    ctx.fillRect(barX, barY, hpBar.w, hpBar.h);
    if (greenWidth > 0) {
      ctx.fillStyle = 'rgba(125,255,178,0.95)';
      ctx.fillRect(barX, barY, greenWidth, hpBar.h);
    }
  }
  ctx.restore();
}

function resolveFenceSpriteKeys(){
  const required = ['cornerTL', 'cornerTR', 'cornerBR', 'cornerBL', 'sideTop', 'sideRight', 'sideBottom', 'sideLeft'];
  // try per-level spriteKeys first
  try {
    const cfg = FenceSprites && FenceSprites.config ? FenceSprites.config : null;
    const level = Number.isFinite(state.fenceLevel) ? Math.max(1, Math.floor(state.fenceLevel)) : 1;
    if (cfg && Array.isArray(cfg.levels) && cfg.levels[level - 1] && cfg.levels[level - 1].spriteKeys) {
      const keys = cfg.levels[level - 1].spriteKeys || {};
      const map = {};
      let ok = true;
      for (let i = 0; i < required.length; i++) {
        const k = required[i];
        const id = keys[k] || k;
        if (!FenceSprites || !FenceSprites.framesById || !FenceSprites.framesById.has(id)) {
          ok = false;
          break;
        }
        map[k] = id;
      }
      if (ok) return map;
    }
  } catch (e) {}

  const hasNamed = required.every((id) => FenceSprites.framesById.has(id));
  if (hasNamed){
    return {
      cornerTL: 'cornerTL',
      cornerTR: 'cornerTR',
      cornerBR: 'cornerBR',
      cornerBL: 'cornerBL',
      sideTop: 'sideTop',
      sideRight: 'sideRight',
      sideBottom: 'sideBottom',
      sideLeft: 'sideLeft',
    };
  }
  const ids = BAL.fenceSpriteIds || [];
  if (!ids.length) return null;
  const fallbackId = ids[0];
  return {
    cornerTL: fallbackId,
    cornerTR: fallbackId,
    cornerBR: fallbackId,
    cornerBL: fallbackId,
    sideTop: fallbackId,
    sideRight: fallbackId,
    sideBottom: fallbackId,
    sideLeft: fallbackId,
  };
}

function drawFence(br){
  // simple fence around hangar (visual only)
  ctx.save();

  // Clip to board rect so corner posts don't overlap the road (T2)
  clipRoundedRect(ctx, br.x, br.y, br.w, br.h, 16);
  ctx.clip();

  const pad = 8;
  const x0 = br.x + pad, y0 = br.y + pad;
  const x1 = br.x + br.w - pad, y1 = br.y + br.h - pad;

  // posts
  ctx.fillStyle = 'rgba(172, 113, 62, .22)';
  ctx.strokeStyle = 'rgba(45, 26, 14, .25)';
  ctx.lineWidth = 2;

  const step = 22;
  for (let x=x0; x<=x1; x+=step){
    rr(ctx, x-4, y0-10, 8, 14, 3); ctx.fill(); ctx.stroke();
    rr(ctx, x-4, y1-4, 8, 14, 3); ctx.fill(); ctx.stroke();
  }
  for (let y=y0; y<=y1; y+=step){
    rr(ctx, x0-10, y-4, 14, 8, 3); ctx.fill(); ctx.stroke();
    rr(ctx, x1-4, y-4, 14, 8, 3); ctx.fill(); ctx.stroke();
  }

  // rails
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = 'rgba(172, 113, 62, .18)';
  ctx.lineWidth = 4;

  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x0, y1); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0, y1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x1, y0); ctx.lineTo(x1, y1); ctx.stroke();

  ctx.restore();
}

function clipRoundedRect(targetCtx, x, y, w, h, r){
  if (!targetCtx) return;
  if (typeof rr === 'function'){
    rr(targetCtx, x, y, w, h, r);
    return;
  }
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  targetCtx.beginPath();
  targetCtx.moveTo(x + radius, y);
  targetCtx.arcTo(x + w, y, x + w, y + h, radius);
  targetCtx.arcTo(x + w, y + h, x, y + h, radius);
  targetCtx.arcTo(x, y + h, x, y, radius);
  targetCtx.arcTo(x, y, x + w, y, radius);
  targetCtx.closePath();
}

function drawSlotActivityOverlay(targetCtx, x, y, w, h, r, timeSec){
  if (!targetCtx || !Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return;
  const overlayApi = window.Game && window.Game.SlotActivityOverlay;
  if (overlayApi && typeof overlayApi.draw === 'function') {
    overlayApi.draw(targetCtx, x, y, w, h, r, {
      baseAlpha: 0.52,
      brightAlpha: 0.18,
      darkAlpha: 0.16,
      borderAlpha: 0.78,
      seed: Math.floor(x) * 17 + Math.floor(y) * 29 + Math.floor(w) * 31 + Math.floor(h) * 37,
    });
    return;
  }

  targetCtx.save();
  targetCtx.beginPath();
  clipRoundedRect(targetCtx, x, y, w, h, r);
  targetCtx.clip();
  targetCtx.fillStyle = 'rgba(255,152,0,0.52)';
  targetCtx.fillRect(x, y, w, h);
  targetCtx.restore();
}

function drawBoard(){
  const br = state.boardRect;
  ctx.save();

  ctx.fillStyle = 'rgba(8,12,22,.66)';
  ctx.strokeStyle = 'rgba(255,255,255,.10)';
  ctx.lineWidth = 1;
  rr(ctx, br.x, br.y, br.w, br.h, 16);
  ctx.fill();
  ctx.stroke();

  drawFence(br);

  for (const c of state.cells){
    const hovered = state.dragging && cellAt(state.dragging.x, state.dragging.y)?.i === c.i;

    rr(ctx, c.x, c.y, c.w, c.h, 10);
    ctx.fillStyle = hovered ? 'rgba(110,168,255,.14)' : 'rgba(255,255,255,.05)';
    ctx.fill();
    ctx.strokeStyle = hovered ? 'rgba(110,168,255,.28)' : 'rgba(255,255,255,.10)';
    ctx.stroke();

    if (c.tank){
      drawTankSlot(c);
      if (state.isDismantleMode){
        const r = dismantleCheckboxRect(c);
        const sel = isTankSelectedForDismantle(c.tank.id);
        ctx.fillStyle = sel ? 'rgba(255,152,0,.15)' : 'rgba(30,28,24,.8)';
        ctx.strokeStyle = sel ? 'rgba(255,152,0,.9)' : 'rgba(255,152,0,.6)';
        ctx.lineWidth = 1.5;
        rr(ctx, r.x, r.y, r.w, r.h, 3);
        ctx.fill();
        ctx.stroke();
        if (sel){
          ctx.strokeStyle = '#ff9800';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(r.x + 3, r.y + r.h/2);
          ctx.lineTo(r.x + r.w/2 - 2, r.y + r.h - 4);
          ctx.lineTo(r.x + r.w - 3, r.y + 4);
          ctx.stroke();
        }
      }
    }
  }

  if (state.dragging){
    drawTank(
      state.dragging.x - state.dragging.dx,
      state.dragging.y - state.dragging.dy,
      state.dragging.tank,
      true,
      Math.PI/2,
      true,
      true
    );
  }

  ctx.restore();
}

function drawTankSlot(cell){
  const cx = cell.x + cell.w/2;
  const cy = cell.y + cell.h/2;
  const hangarRenderState = !cell.tank.onTrack && !isTankPrinting(cell.tank) && TankHangarAnimationApi && typeof TankHangarAnimationApi.computeRenderState === 'function'
    ? TankHangarAnimationApi.computeRenderState(cell, cell.tank, TankSprites && TankSprites.config, nowSec(), 'hangar')
    : null;
  const iconCx = cx + (hangarRenderState ? hangarRenderState.offsetX : 0);
  const iconCy = cy + (hangarRenderState ? hangarRenderState.offsetY : 0);
  ctx.save();
  drawTankIconWithStampReveal(cell, iconCx, iconCy, {
    showShadow: false,
    rotation: hangarRenderState ? hangarRenderState.rotation : 0,
    scaleMul: hangarRenderState ? hangarRenderState.scale : 1,
    mutedSlot: false,
    labelX: cx,
    labelY: cell.y + cell.h - Math.max(7, cell.h * 0.16),
  });
  if (cell.tank.onTrack) {
    drawSlotActivityOverlay(ctx, cell.x, cell.y, cell.w, cell.h, 10, nowSec());
  }
  ctx.restore();
}

const TANK_STAMP_ROWS = 10;
const DEFAULT_TANK_STAMP_DURATION_SEC = 1.5;

function getTankStampProgress(tank){
  if (!tank || tank.onTrack) return 1;
  if (!isTankPrinting(tank)) return 1;
  if (!Number.isFinite(tank.stampStartSec)) return 1;
  const elapsedSec = nowSec() - tank.stampStartSec;
  const durationSecRaw = getTankPrintDurationSec();
  const durationSec = Number.isFinite(durationSecRaw) && durationSecRaw > 0 ? durationSecRaw : DEFAULT_TANK_STAMP_DURATION_SEC;
  return clamp(elapsedSec / durationSec, 0, 1);
}

function drawTankIconWithStampReveal(cell, cx, cy, options = null){
  if (!cell || !cell.tank) return;
  const opts = options && typeof options === 'object' ? options : null;
  const showShadow = opts && opts.showShadow === false ? false : true;
  const mutedSlot = opts && typeof opts.mutedSlot === 'boolean' ? opts.mutedSlot : cell.tank.onTrack;
  const progress = getTankStampProgress(cell.tank);
  if (progress >= 1) {
    drawTankIcon(cx, cy, cell.tank.level, mutedSlot, opts ? {
      showShadow,
      rotation: opts.rotation,
      scaleMul: opts.scaleMul,
      labelX: opts.labelX,
      labelY: opts.labelY,
    } : { showShadow });
    return;
  }

  const rows = TANK_STAMP_ROWS;
  const iconW = Math.max(42, cell.w - 8);
  const iconH = Math.max(32, cell.h - 10);
  const left = cx - iconW * 0.5;
  const top = cy - iconH * 0.5;
  const rowH = iconH / rows;
  const visibleRows = progress * rows;
  const fullRows = Math.floor(visibleRows);
  const partialRow = visibleRows - fullRows;

  ctx.save();
  for (let row = 0; row < rows; row++) {
    let reveal = 0;
    if (row < fullRows) reveal = 1;
    else if (row === fullRows) reveal = partialRow;
    if (reveal <= 0) continue;

    const clipY = top + row * rowH;
    const clipH = rowH * reveal;
    if (clipH <= 0) continue;

    ctx.save();
    ctx.beginPath();
    ctx.rect(left, clipY, iconW, clipH + 0.5);
    ctx.clip();
    drawTankIcon(cx, cy, cell.tank.level, mutedSlot, opts ? {
      showShadow,
      rotation: opts.rotation,
      scaleMul: opts.scaleMul,
      labelX: opts.labelX,
      labelY: opts.labelY,
    } : { showShadow });
    ctx.restore();
  }
  ctx.restore();
}

function drawOrbitingTanks(){
  const t = nowSec();
  for (const c of state.cells){
    if (!c.tank || !c.tank.onTrack) continue;
    if (state.dragging && state.dragging.cellIndex === c.i) continue;
    const pos = tankOrbitState(c, t);
    const trackRenderState = TankHangarAnimationApi && typeof TankHangarAnimationApi.computeRenderState === 'function'
      ? TankHangarAnimationApi.computeRenderState(c, c.tank, TankSprites && TankSprites.config, t, 'track')
      : null;
    const statusX = pos.x + (trackRenderState ? trackRenderState.offsetX : 0);
    const statusY = pos.y + (trackRenderState ? trackRenderState.offsetY : 0);
    c.tank._statusWorldX = statusX;
    c.tank._statusWorldY = statusY;
    drawTank(pos.x, pos.y, c.tank, false, pos.heading, false, false, trackRenderState);
  }
}

function drawTankIcon(x,y,level,mutedSlot=false,options=null){
  drawTankIconTo(ctx, x, y, level, mutedSlot, 1, options);
}

function getOnTrackIconOpacity(){
  var opacity = TankSprites && TankSprites.config && TankSprites.config.ui
    ? Number(TankSprites.config.ui.onTrackIconOpacity)
    : NaN;
  if (!Number.isFinite(opacity)) return 0.45;
  return clamp(opacity, 0, 1);
}

function drawTankIconTo(targetCtx, x, y, level, mutedSlot=false, scaleMul=1, options=null){
  const opts = options && typeof options === 'object' ? options : null;
  const showShadow = !(opts && opts.showShadow === false);
  const extraScaleMul = opts && Number.isFinite(opts.scaleMul) && opts.scaleMul > 0 ? opts.scaleMul : 1;
  const drawRotation = opts && Number.isFinite(opts.rotation) ? opts.rotation : 0;
  const fixedLabelX = opts && Number.isFinite(opts.labelX) ? opts.labelX : null;
  const fixedLabelY = opts && Number.isFinite(opts.labelY) ? opts.labelY : null;
  const body = TankSprites?.pickBody?.(level);
  const cannon = TankSprites?.pickCannon?.(level);
  const onTrackIconOpacity = mutedSlot ? getOnTrackIconOpacity() : 0;
  if (body && cannon){
    const bodyW = body.cfg.frame?.w ?? body.img.width;
    const bodyH = body.cfg.frame?.h ?? body.img.height;
    const bodyFrameX = body.cfg.frame?.x ?? 0;
    const bodyFrameY = body.cfg.frame?.y ?? 0;
    const maxW = 51 * balScale * scaleMul * extraScaleMul;
    const maxH = 39 * balScale * scaleMul * extraScaleMul;
    const scale = Math.min(maxW / bodyW, maxH / bodyH);
    targetCtx.save();
    targetCtx.translate(x, y);
    if (drawRotation) targetCtx.rotate(drawRotation);
    targetCtx.globalAlpha = mutedSlot ? onTrackIconOpacity : 0.92;
    const drawW = bodyW * scale;
    const drawH = bodyH * scale;
    const bodyAnchor = body.cfg.anchor || {x:0.5, y:0.6};
    targetCtx.drawImage(
      body.img,
      bodyFrameX,
      bodyFrameY,
      bodyW,
      bodyH,
      -drawW * bodyAnchor.x,
      -drawH * bodyAnchor.y,
      drawW,
      drawH
    );

    const cannonW = cannon.cfg.frame?.w ?? cannon.img.width;
    const cannonH = cannon.cfg.frame?.h ?? cannon.img.height;
    const cannonAnchor = cannon.cfg.anchor || {x:0.35, y:0.5};
    const cannonDrawW = cannonW * scale;
    const cannonDrawH = cannonH * scale;
    targetCtx.drawImage(
      cannon.img,
      0,
      0,
      cannonW,
      cannonH,
      -cannonDrawW * cannonAnchor.x,
      -cannonDrawH * cannonAnchor.y,
      cannonDrawW,
      cannonDrawH
    );
    targetCtx.restore();
    if (level != null) {
      targetCtx.save();
      targetCtx.globalAlpha = mutedSlot ? Math.max(onTrackIconOpacity, 0.82) : 1;
      targetCtx.fillStyle = '#eaf1ff';
      targetCtx.font = '10px system-ui, -apple-system, Segoe UI, Roboto, Arial';
      targetCtx.textAlign = 'center';
      targetCtx.textBaseline = fixedLabelY != null ? 'middle' : 'top';
      targetCtx.fillText(`${t('levelShort')}${level}`, fixedLabelX != null ? fixedLabelX : x, fixedLabelY != null ? fixedLabelY : (y + drawH * 0.5 + 4));
      targetCtx.restore();
    }
    return;
  }

  const tier = Math.floor((level-1)/3);
  const hull = ['#b83232','#c63a3a','#d14646','#e05a5a','#f07171'][clamp(tier,0,4)];
  targetCtx.save();
  targetCtx.translate(x, y);
  if (drawRotation) targetCtx.rotate(drawRotation);
  targetCtx.scale(0.52 * balScale * scaleMul * extraScaleMul, 0.52 * balScale * scaleMul * extraScaleMul);
  targetCtx.globalAlpha = mutedSlot ? onTrackIconOpacity : 0.95;
  if (showShadow) {
    targetCtx.fillStyle = 'rgba(0,0,0,.35)';
    rr(targetCtx, -22, -8, 44, 10, 5);
    targetCtx.fill();
  }
  targetCtx.fillStyle = hull;
  rr(targetCtx, -18, -18, 36, 14, 6);
  targetCtx.fill();
  targetCtx.fillStyle = shade(hull, -18);
  targetCtx.beginPath();
  targetCtx.arc(0, -18, 7 + clamp(tier,0,4)*0.8, 0, Math.PI*2);
  targetCtx.fill();
  targetCtx.fillStyle = shade(hull, -30);
  rr(targetCtx, 2, -20, 16 + clamp(tier,0,4)*2, 4, 2);
  targetCtx.fill();
  targetCtx.restore();
  if (level != null) {
    const fallbackScale = 0.52 * balScale * scaleMul * extraScaleMul;
    targetCtx.save();
    targetCtx.globalAlpha = mutedSlot ? Math.max(onTrackIconOpacity, 0.82) : 1;
    targetCtx.fillStyle = '#eaf1ff';
    targetCtx.font = '10px system-ui, -apple-system, Segoe UI, Roboto, Arial';
    targetCtx.textAlign = 'center';
    targetCtx.textBaseline = fixedLabelY != null ? 'middle' : 'top';
    targetCtx.fillText(`${t('levelShort')}${level}`, fixedLabelX != null ? fixedLabelX : x, fixedLabelY != null ? fixedLabelY : (y + 10 * fallbackScale));
    targetCtx.restore();
  }
}

// Aura: per-level auraVariant. If string — спрайт из auras; если number 1–6 — процедурная полоса; если null/false — нет ауры.
function computeAuraBand(level){
  const v = getTankConfigByLevel(level)?.auraBand;
  if (v != null && typeof v === 'string') return null;
  if (v != null && typeof v === 'number' && v >= 1 && v <= 6) return v;
  if (v != null && v === false) return null;
  const lvl = Math.max(1, Math.floor(level));
  if (lvl < 10) return null;
  if (lvl >= 60) return 6;
  return 1 + Math.floor((lvl - 10) / 10);
}

const AuraStyleByBand = [
  null,
  { color: 'rgba(180,255,200,.22)', radius: 20, alpha: 0.14, effect: 'glow', pulseSpeed: 4 },
  { color: 'rgba(140,230,255,.24)', radius: 24, alpha: 0.18, effect: 'pulse', pulseSpeed: 4 },
  { color: 'rgba(100,180,255,.26)', radius: 28, alpha: 0.20, effect: 'doubleOutline', pulseSpeed: 3 },
  { color: 'rgba(186,140,255,.28)', radius: 32, alpha: 0.22, effect: 'particles', pulseSpeed: 3 },
  { color: 'rgba(255,230,140,.30)', radius: 36, alpha: 0.26, effect: 'pulse', pulseSpeed: 2.5 },
  { color: 'rgba(255,248,220,.35)', radius: 40, alpha: 0.32, effect: 'intenseGlow', pulseSpeed: 2 },
];

function drawTankAura(x, y, band){
  if (band == null || band < 1 || band > 6) return;
  const style = AuraStyleByBand[band];
  if (!style) return;
  const t = nowSec();
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(t * 0.8);
  let alpha = style.alpha;
  let scale = 1;
  const speed = style.pulseSpeed ?? 4;
  if (style.effect === 'pulse'){
    alpha *= 0.7 + 0.3 * Math.sin(t * speed);
    scale = 0.8 + 0.2 * Math.sin(t * speed);
  } else if (style.effect === 'intenseGlow'){
    alpha *= 0.85 + 0.15 * Math.sin(t * (speed * 0.5));
    scale = 0.8 + 0.2 * Math.sin(t * speed);
  } else {
    scale = 0.8 + 0.2 * Math.sin(t * speed);
  }
  const r = style.radius * scale;
  if (style.effect === 'doubleOutline'){
    ctx.globalAlpha = alpha * 0.6;
    ctx.strokeStyle = style.color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = style.color;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
  }
  if (!isFxLite() && style.effect === 'particles' && state.particles.length < BAL.maxParticles - 20){
    const n = Math.floor(2 + Math.sin(t * 3) * 1.5);
    for (let i = 0; i < n; i++){
      const a = (t * 2 + i * 2.1) % (Math.PI * 2);
      const dist = r * (0.4 + 0.4 * Math.sin(t + i));
      particle(x + Math.cos(a) * dist, y + Math.sin(a) * dist, 2, style.color.replace(/[\d.]+\)$/, '0.5)'), 0.2);
    }
  }
  ctx.restore();
}

function drawTankAuraSprite(x, y, aura){
  const cfg = aura.cfg;
  const frameList = cfg.frames && Array.isArray(cfg.frames) ? cfg.frames : null;
  const w = cfg.frameWidth ?? cfg.frame?.w ?? aura.img.width;
  const h = cfg.frameHeight ?? cfg.frame?.h ?? aura.img.height;
  const anchor = cfg.anchor || { x: 0.5, y: 0.5 };
  const animSpeed = cfg.animation?.frameRate ?? cfg.animSpeed ?? 8;
  const frameOrder = cfg.animation?.frameOrder;
  let sx, sy;
  if (frameList && frameList.length > 0){
    const frameCount = frameOrder ? frameOrder.length : frameList.length;
    const frameIndex = Math.floor(nowSec() * animSpeed) % frameCount;
    const logicalIndex = frameOrder ? frameOrder[frameIndex] : frameIndex;
    const pos = frameList[logicalIndex] ?? frameList[0];
    sx = pos.x ?? (logicalIndex * w);
    sy = pos.y ?? 0;
  } else {
    const frameX = cfg.frame?.x ?? 0;
    const frameY = cfg.frame?.y ?? 0;
    const frames = cfg.frames || 1;
    const frame = Math.floor(nowSec() * animSpeed) % frames;
    sx = frameX + frame * w;
    sy = frameY;
  }
  const baseScale = (cfg.scale ?? 1) * 0.22 * balScale;
  const t = nowSec();
  const pulseScale = 1 + 0.2 * Math.sin(t * 2.5);
  const scale = baseScale * pulseScale;
  const drawW = w * scale;
  const drawH = h * scale;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(t * 0.8);
  ctx.globalAlpha = 0.85;
  ctx.drawImage(
    aura.img,
    sx,
    sy,
    w,
    h,
    -drawW * anchor.x,
    -drawH * anchor.y,
    drawW,
    drawH
  );
  ctx.restore();
}

function drawTank(x,y,tank,ghost=false,rotation=0,showLevelLabel=true,isDragPreview=false,renderOptions=null){
  const level = typeof tank === 'number' ? tank : tank?.level ?? 1;
  const renderState = renderOptions && typeof renderOptions === 'object' ? renderOptions : null;
  const renderOffsetX = renderState && Number.isFinite(renderState.offsetX) ? renderState.offsetX : 0;
  const renderOffsetY = renderState && Number.isFinite(renderState.offsetY) ? renderState.offsetY : 0;
  const renderRotation = renderState && Number.isFinite(renderState.rotation) ? renderState.rotation : 0;
  const renderScaleMul = renderState && Number.isFinite(renderState.scale) && renderState.scale > 0 ? renderState.scale : 1;
  const drawX = x + renderOffsetX;
  const drawY = y + renderOffsetY;
  if (!isDragPreview){
    const auraSprite = TankSprites?.pickAura?.(level);
    if (auraSprite) {
      drawTankAuraSprite(drawX, drawY, auraSprite);
    } else {
      const auraBand = computeAuraBand(level);
      if (auraBand != null) drawTankAura(drawX, drawY, auraBand);
    }
  }
  // Try sprite-based tanks if assets/tanks.json exists
  const body = TankSprites?.pickBody?.(level);
  const cannon = TankSprites?.pickCannon?.(level);
  if (body && cannon){
    ctx.save();
    ctx.translate(drawX,y + renderOffsetY);
    ctx.rotate(rotation + renderRotation + (BAL.tankSpriteRotOffset ?? 0));
    ctx.globalAlpha = ghost ? 0.78 : 1;

    const configScale = TankSprites?.config?.tankScale ?? 1;
    const baseScale = 0.065 * balScale * (BAL.tankSpriteScaleMul ?? 1) * configScale * renderScaleMul;            // tuned for typical PNG sizes
    const levelScale = 1.0 + Math.min(0.20, level*0.010);
    const s = baseScale * levelScale;

    const bodyW = body.cfg.frame?.w ?? body.img.width;
    const bodyH = body.cfg.frame?.h ?? body.img.height;
    const bodyFrameX = (body.cfg.frame?.x ?? 0);
    const bodyFrameY = (body.cfg.frame?.y ?? 0);
    const bodyFrame = Math.floor(tank?.bodyAnim ?? 0) % (body.cfg.frames || 1);
    const bodyAnchor = body.cfg.anchor || {x:0.5, y:0.6};
    const bodyScale = body.cfg.scale ?? 1;
    const drawBodyW = bodyW * s * bodyScale;
    const drawBodyH = bodyH * s * bodyScale;

    ctx.drawImage(
      body.img,
      bodyFrameX + bodyFrame * bodyW,
      bodyFrameY,
      bodyW,
      bodyH,
      -drawBodyW * bodyAnchor.x,
      -drawBodyH * bodyAnchor.y,
      drawBodyW,
      drawBodyH
    );

    const cannonW = cannon.cfg.frame?.w ?? cannon.img.width;
    const cannonH = cannon.cfg.frame?.h ?? cannon.img.height;
    const cannonFrames = cannon.cfg.frames || 1;
    const cannonFrame = Math.floor(tank?.cannonAnim ?? 0) % cannonFrames;
    const cannonAnchor = cannon.cfg.anchor || {x:0.35, y:0.5};
    const cannonScale = cannon.cfg.scale ?? 1;
    const drawCannonW = cannonW * s * cannonScale;
    const drawCannonH = cannonH * s * cannonScale;
    const recoil = cannon.cfg.recoil ?? 0;
    const kick = recoil ? Math.sin(Math.min(1, tank?.cannonAnim ?? 0) * Math.PI) * recoil : 0;

    ctx.save();
    if (kick){
      ctx.translate(-kick * s, 0);
    }
    ctx.drawImage(
      cannon.img,
      cannonFrame * cannonW,
      0,
      cannonW,
      cannonH,
      -drawCannonW * cannonAnchor.x,
      -drawCannonH * cannonAnchor.y,
      drawCannonW,
      drawCannonH
    );
    ctx.restore();

    if (showLevelLabel) {
      const tier = Math.floor((level-1)/3);
      const badge = ['rgba(0,0,0,.35)','rgba(0,0,0,.35)','rgba(110,168,255,.22)','rgba(125,255,178,.22)','rgba(185,139,255,.22)'][clamp(tier,0,4)];
      ctx.fillStyle = badge;
      rr(ctx, -16, 6, 32, 16, 8);
      ctx.fill();
      ctx.fillStyle = '#eaf1ff';
      ctx.font = '11px system-ui, -apple-system, Segoe UI, Roboto, Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${t('levelShort')}${level}`, 0, 14);
    }

    ctx.restore();
    return;
  }

  // Fallback: vector tank (smaller)
  const configScale = TankSprites?.config?.tankScale ?? 1;
  const baseScale = 0.56 * balScale * configScale * renderScaleMul;
  const levelScale = 1.0 + Math.min(0.20, level*0.010);
  const scale = baseScale * levelScale;

  ctx.save();
  ctx.translate(drawX,drawY);
  ctx.rotate(rotation + renderRotation + (BAL.tankSpriteRotOffset ?? 0));
  ctx.scale(scale, scale);
  ctx.globalAlpha = ghost ? 0.78 : 1;

  const tier = Math.floor((level-1)/3);
  const hull = ['#b83232','#c63a3a','#d14646','#e05a5a','#f07171'][clamp(tier,0,4)];
  const edge = 'rgba(255,255,255,.22)';

  // Silhouette differences by tier
  const turretR = 10 + clamp(tier,0,4)*1.4;
  const barrelW = 22 + clamp(tier,0,4)*3.2;
  const doubleBarrel = tier >= 3;

  // tracks
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  rr(ctx, -30, -16, 60, 14, 7);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.06)';
  for (let i=-24;i<=24;i+=8) ctx.fillRect(i, -14, 4, 10);

  // hull
  ctx.fillStyle = hull;
  ctx.strokeStyle = edge;
  ctx.lineWidth = 2;
  rr(ctx, -24, -28, 48, 24, 9);
  ctx.fill();
  ctx.stroke();

  // armor plates
  if (tier >= 2){
    ctx.fillStyle = 'rgba(255,255,255,.08)';
    rr(ctx, -22, -26, 18, 6, 3);
    rr(ctx, 4, -26, 18, 6, 3);
    ctx.fill();
  }

  // turret
  ctx.beginPath();
  ctx.arc(0,-20,turretR,0,Math.PI*2);
  ctx.fillStyle = shade(hull, -18);
  ctx.fill();
  ctx.stroke();

  // barrel
  ctx.save();
  ctx.translate(6,-22);
  ctx.rotate(-0.06);
  ctx.fillStyle = shade(hull, -30);
  if (doubleBarrel){
    rr(ctx, 0, -5, barrelW, 4, 2);
    rr(ctx, 0, 1, barrelW, 4, 2);
  } else {
    rr(ctx, 0, -3, barrelW, 6, 3);
  }
  ctx.fill();
  ctx.restore();

  if (showLevelLabel) {
    const badge = ['rgba(0,0,0,.35)','rgba(0,0,0,.35)','rgba(110,168,255,.22)','rgba(125,255,178,.22)','rgba(185,139,255,.22)'][clamp(tier,0,4)];
    ctx.fillStyle = badge;
    rr(ctx, -16, 1, 32, 16, 8);
    ctx.fill();
    ctx.fillStyle = '#eaf1ff';
    ctx.font = '11px system-ui, -apple-system, Segoe UI, Roboto, Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${t('levelShort')}${level}`, 0, 9);
  }

  // glow for high tier
  if (tier >= 3){
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(185,139,255,.22)';
    ctx.lineWidth = 2;
    rr(ctx, -26, -30, 52, 26, 10);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

function ensureZombieRenderRuntimeController(){
  if (zombieRenderRuntimeController) return zombieRenderRuntimeController;
  const api = GameApi && GameApi.ZombieRender;
  if (!api || typeof api.createController !== 'function') return null;
  zombieRenderRuntimeController = api.createController({
    getCtx(){ return ctx; },
    getZombieSprites(){ return ZombieSprites; },
    getBalance(){ return BAL; },
    getCenter(){ return center; },
    getState(){ return state; },
    nowSec: nowSec,
    clamp: clamp,
    shade: shade,
    zombieLevelScale: zombieLevelScale,
    getZombieBalanceMul: getZombieBalanceMul,
    getZombieDefaultAttackFps(){ return ZOMBIE_DEFAULT_ATTACK_FPS; },
    getZombieCorpseFadeOutSec(){
      const fadeOut = ZombieSprites && ZombieSprites.corpseConfig ? ZombieSprites.corpseConfig.corpseFadeOutSec : null;
      return Number.isFinite(fadeOut) ? Math.max(0, fadeOut) : 0;
    },
    isQualityLow(){ return !!qualityLow; },
  });
  return zombieRenderRuntimeController;
}

function drawZombieEntity(z, x, y){
  ensureZombieRenderRuntimeController()?.drawZombieEntity(z, x, y);
}

function drawProjectiles(){
  if (!state.projectiles.length) return;

  for (const b of state.projectiles){
    if (b.isTankAttackingZombie === true) continue;
    const bulletSprite = b.bulletCfg && b.bulletCfg.bulletSprite ? b.bulletCfg.bulletSprite : null;
    const ChipFxB = window.Game && window.Game.ChipEffects;
    const bulletAtlasImg = bulletSprite && bulletSprite.src && ChipFxB && typeof ChipFxB.getChipAtlasImage === 'function'
      ? (ChipFxB.getChipAtlasImage(bulletSprite.src) || (BulletSprites && BulletSprites.atlasImg))
      : (BulletSprites && BulletSprites.atlasImg);
    if (bulletAtlasImg && bulletSprite) {
      const frames = Math.max(1, Number.isFinite(bulletSprite.frames) ? Math.floor(bulletSprite.frames) : 1);
      const fps = Math.max(0.01, Number(bulletSprite.frameRateFps || bulletSprite.animSpeed || 12));
      const frameIndex = Math.floor((b.animTime || 0) * fps) % frames;
      const sx = (bulletSprite.frame && Number.isFinite(bulletSprite.frame.x) ? bulletSprite.frame.x : 0) + frameIndex * bulletSprite.frame.w;
      const sy = bulletSprite.frame && Number.isFinite(bulletSprite.frame.y) ? bulletSprite.frame.y : 0;
      const sw = bulletSprite.frame.w;
      const sh = bulletSprite.frame.h;
      const anchor = bulletSprite.anchor || { x: 0.5, y: 0.5 };
      const baseScale = Number.isFinite(bulletSprite.scale) ? Math.max(0.05, bulletSprite.scale) : 1;
      const scale = baseScale * (b.effectIntensity ?? 1);
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(Number.isFinite(b.rotation) ? b.rotation : 0);
      ctx.drawImage(
        bulletAtlasImg,
        sx,
        sy,
        sw,
        sh,
        -sw * scale * anchor.x,
        -sh * scale * anchor.y,
        sw * scale,
        sh * scale
      );
      ctx.restore();
      continue;
    }

    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawImpacts(){
  for (const fx of state.impacts){
    const t = fx.life / fx.max;

    if ((qualityLow || isFxLite()) && fx.kind === 'overflow') continue;

    if (fx.kind === 'bolt'){
      if (qualityLow || isFxLite()) continue;
      ctx.save();
      ctx.globalAlpha = t;
      ctx.strokeStyle = 'rgba(139,211,255,.65)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(fx.x, fx.y);
      const mx = (fx.x + fx.tx)/2;
      const my = (fx.y + fx.ty)/2;
      ctx.lineTo(mx + (Math.random()*2-1)*8, my + (Math.random()*2-1)*8);
      ctx.lineTo(fx.tx, fx.ty);
      ctx.stroke();
      ctx.restore();
      continue;
    }

    const impactSprite = fx.bulletCfg && fx.bulletCfg.impactSprite ? fx.bulletCfg.impactSprite : null;
    const ChipFxI = window.Game && window.Game.ChipEffects;
    const impactAtlasImg = impactSprite && impactSprite.src && ChipFxI && typeof ChipFxI.getChipAtlasImage === 'function'
      ? (ChipFxI.getChipAtlasImage(impactSprite.src) || (BulletSprites && BulletSprites.atlasImg))
      : (BulletSprites && BulletSprites.atlasImg);
    if (impactAtlasImg && impactSprite) {
      const elapsed = Math.max(0, (fx.max || 0) - (fx.life || 0));
      const frames = Math.max(1, Number.isFinite(impactSprite.frames) ? Math.floor(impactSprite.frames) : 1);
      const fps = Math.max(0.01, Number(impactSprite.frameRateFps || impactSprite.animSpeed || 12));
      const frameIndex = Math.min(frames - 1, Math.floor(elapsed * fps));
      const sx = (impactSprite.frame && Number.isFinite(impactSprite.frame.x) ? impactSprite.frame.x : 0) + frameIndex * impactSprite.frame.w;
      const sy = impactSprite.frame && Number.isFinite(impactSprite.frame.y) ? impactSprite.frame.y : 0;
      const sw = impactSprite.frame.w;
      const sh = impactSprite.frame.h;
      const scale = Number.isFinite(impactSprite.scale) ? Math.max(0.05, impactSprite.scale) : 1;

      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, t));
      ctx.drawImage(
        impactAtlasImg,
        sx,
        sy,
        sw,
        sh,
        fx.x - sw * scale * 0.5,
        fx.y - sh * scale * 0.5,
        sw * scale,
        sh * scale
      );
      ctx.restore();
      continue;
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    const col = fx.kind === 'toxic'
      ? 'rgba(184,255,59,'
      : (fx.kind === 'he'
        ? 'rgba(255,122,107,'
        : (fx.kind === 'overflow'
          ? 'rgba(255,240,160,'
          : 'rgba(255,211,107,'));

    ctx.strokeStyle = `${col}${0.22*t})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(fx.x, fx.y, fx.r, 0, Math.PI*2);
    ctx.stroke();

    if (!qualityLow){
      ctx.strokeStyle = `${col}${0.10*t})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, fx.r*0.72, 0, Math.PI*2);
      ctx.stroke();
    }

    ctx.restore();
  }
}

function drawCrate(){
  if (!state.crate) return;
  const c = state.crate;
  const size = c.size;
  const half = size * 0.5;
  const pulse = 1 + Math.sin(c.pulse) * 0.04;

  const anim = getCrateAnimation(c.animState);
  const frameIds = anim && Array.isArray(anim.frames) ? anim.frames : null;
  const frameCount = frameIds && frameIds.length ? frameIds.length : 0;
  const fps = anim ? Math.max(0.01, Number(anim.frameRateFps) || 1) : 1;
  const durationSec = frameCount > 0 ? frameCount / fps : 0;
  var frameIndex = 0;
  if (frameCount > 0 && durationSec > 0) {
    if (anim.loop !== false) frameIndex = Math.floor((c.animTimeSec % durationSec) * fps) % frameCount;
    else frameIndex = Math.min(frameCount - 1, Math.floor(c.animTimeSec * fps));
  }
  const frameId = frameCount > 0 ? frameIds[frameIndex] : null;
  const frame = frameId && BonusBoxSprites && typeof BonusBoxSprites.pickFrame === 'function'
    ? BonusBoxSprites.pickFrame(frameId)
    : null;

  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.scale(pulse, pulse);

  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.beginPath();
  ctx.ellipse(0, half + 6, half * 0.9, half * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();

  if (BonusBoxSprites && BonusBoxSprites.ready && BonusBoxSprites.atlasImg && frame) {
    const config = BonusBoxSprites.config || {};
    const anchor = config.anchor || { x: 0.5, y: 0.5 };
    const spriteScale = Number.isFinite(config.scale) ? Math.max(0.1, config.scale) : 1;
    const drawW = size * spriteScale;
    const drawH = size * spriteScale;
    ctx.drawImage(
      BonusBoxSprites.atlasImg,
      frame.x,
      frame.y,
      frame.w,
      frame.h,
      -drawW * anchor.x,
      -drawH * anchor.y,
      drawW,
      drawH
    );
    ctx.restore();
    return;
  }

  ctx.fillStyle = '#c88b4c';
  ctx.strokeStyle = 'rgba(0,0,0,.35)';
  ctx.lineWidth = 2;
  rr(ctx, -half, -half, size, size, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#9c6a3a';
  rr(ctx, -half, -half + size * 0.32, size, size * 0.22, 4);
  ctx.fill();

  ctx.fillStyle = '#f4d060';
  rr(ctx, -8, -6, 16, 12, 3);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.25)';
  ctx.strokeRect(-10, -8, 20, 16);

  ctx.restore();
}

function drawDecals(){
  for (const d of state.decals){
    const t = d.life / d.max;
    ctx.save();
    ctx.globalAlpha = 0.8 * t;
    ctx.fillStyle = d.color;
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }
}

function drawDamageNumbers(){
  for (const d of state.damageNumbers){
    const t = d.life / d.max;
    const alpha = t <= 0.2 ? t / 0.2 : (t >= 0.6 ? 1 : (t - 0.2) / 0.4);
    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1) * (0.5 + 0.5 * t);
    ctx.fillStyle = d.isCrit ? '#c03030' : '#fff8e0';
    ctx.font = '11px system-ui, -apple-system, Segoe UI, Roboto, Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(d.value, d.x, d.y);
    ctx.restore();
  }
}

function drawParticles(){
  for (const p of state.particles){
    const t = p.life / p.max;
    if (p.kind === 'text'){
      ctx.save();
      ctx.globalAlpha = clamp(t,0,1);
      ctx.fillStyle = p.color;
      ctx.font = '14px system-ui, -apple-system, Segoe UI, Roboto, Arial';
      ctx.textAlign = 'center';
      ctx.fillText(p.text, p.x, p.y);
      ctx.restore();
      continue;
    }
    ctx.save();
    ctx.globalAlpha = clamp(t,0,1);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
    ctx.fill();
    ctx.restore();
  }
}

function drawHint(text){
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.45)';
  rr(ctx, 14, 14, 360, 34, 12);
  ctx.fill();
  ctx.fillStyle = 'rgba(234,241,255,.86)';
  ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto, Arial';
  ctx.fillText(text, 28, 36);
  ctx.restore();
}

function tankOnTrackAt(x,y,timeSec){
  let best = null;
  let bestD = Infinity;
  for (const c of state.cells){
    if (!c.tank || !c.tank.onTrack) continue;
    const p = tankOrbitState(c, timeSec);
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < 20 && d < bestD){
      best = c.i;
      bestD = d;
    }
  }
  return best;
}

// ---------- Helpers ----------
function getMobileMode(){
  return window.Game && window.Game.MobileMode ? window.Game.MobileMode : null;
}

function getFxLevel(){
  const mm = getMobileMode();
  return mm && mm.getFxLevel ? mm.getFxLevel() : 0;
}

function getFxScale(){
  const mm = getMobileMode();
  return mm && mm.getFxScale ? mm.getFxScale() : 1;
}

function isFxLite(){
  return getFxLevel() >= 1;
}

function isFxUltraLite(){
  return getFxLevel() >= 2;
}

function smoothAngle(current, target, amt){
  const diff = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + diff * clamp(amt, 0, 1);
}

function rr(ctx, x,y,w,h,r){
  r = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y, x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r);
  ctx.arcTo(x, y, x+w, y, r);
  ctx.closePath();
}

function shade(hex, delta){
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgb(${clamp(r+delta,0,255)},${clamp(g+delta,0,255)},${clamp(b+delta,0,255)})`;
}

function seededNoise(x, y){
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

// ---------- Impacts tick ----------
function stepImpacts(dt){
  const next = [];
  for (const fx of state.impacts){
    fx.life -= dt;
    if (fx.life <= 0) continue;
    if (fx.kind !== 'bolt'){
      const k = 1 - fx.life / fx.max;
      fx.r = fx.maxR * k;
    }
    next.push(fx);
  }
  state.impacts = next;
}

function setSupercomputerWantsBuildTank(wantsBuildTank){
  const sc = getComputerState();
  if (!sc) return;
  if (supercomputerController && supercomputerController.setWantsBuildTank) {
    supercomputerController.setWantsBuildTank(sc, wantsBuildTank);
    return;
  }
  sc.wantsBuildTank = !!wantsBuildTank;
}

function applySupercomputerDamage(baseDamage){
  const sc = getComputerState();
  if (!sc) return { finalDamage: 0, hp: 0, destroyedNow: false };
  const flags = ensureRuntimeFlagsState();
  const maxHp = Number.isFinite(sc.maxHp) && sc.maxHp > 0 ? sc.maxHp : Math.max(1, Number.isFinite(sc.hp) ? sc.hp : 1);
  const hpThreshold = maxHp * 0.05;
  const isCriticalNow = Number.isFinite(sc.hp) && sc.hp <= hpThreshold;
  if (!isCriticalNow) {
    flags.preRetryAutosavedThisCritical = false;
    flags.wasCritical = false;
    flags.preRetrySaveFailed = false;
  }
  if (criticalFlowActive) {
    return { finalDamage: 0, hp: sc.hp, destroyedNow: false, clampedCritical: true };
  }

  const incoming = Number.isFinite(baseDamage) ? Math.max(0, baseDamage) : 0;
  const armorFlat = Number.isFinite(sc.armorFlat) ? Math.max(0, sc.armorFlat) : 0;
  const finalDamage = Math.max(0, incoming - armorFlat);
  const prevHp = Number.isFinite(sc.hp) ? Math.max(0, sc.hp) : 0;

  if (!flags.wasCritical && prevHp > hpThreshold && (prevHp - finalDamage) <= hpThreshold) {
    const appliedToThreshold = Math.max(0, prevHp - hpThreshold);
    sc.hp = hpThreshold;
    flags.wasCritical = true;
    savePreRetryPayloadToAutoSlot();
    criticalFlowActive = true;
    openCriticalModal();
    return { finalDamage: appliedToThreshold, hp: sc.hp, destroyedNow: false, clampedCritical: true };
  }

  if (supercomputerController && supercomputerController.applyDamage) {
    return supercomputerController.applyDamage(sc, baseDamage, SupercomputerSprites.config);
  }

  sc.hp = Math.max(0, prevHp - finalDamage);
  const destroyedNow = prevHp > 0 && sc.hp === 0;
  if (destroyedNow) {
    sc.state = 'destroyed';
    sc.wantsBuildTank = false;
    sc.pendingBuildTank = false;
  }
  return { finalDamage, hp: sc.hp, destroyedNow };
}

function stepSupercomputer(dt){
  const sc = getComputerState();
  if (!sc) return;
  if (supercomputerController && supercomputerController.step) {
    supercomputerController.step(sc, dt, SupercomputerSprites.config);
    return;
  }
  sc.animElapsedSec = (Number.isFinite(sc.animElapsedSec) ? sc.animElapsedSec : 0) + Math.max(0, dt);
}

GameApi.setSupercomputerWantsBuildTank = setSupercomputerWantsBuildTank;
GameApi.applySupercomputerDamage = applySupercomputerDamage;
GameApi.SupercomputerRuntime = {
  setWantsBuildTank: setSupercomputerWantsBuildTank,
  applyDamage: applySupercomputerDamage,
  getState: getComputerState,
};

// ---------- Main loop ----------
let last = performance.now();
let lastFrameTs = last;
let fpsAvg = 60;
let lastProgressSave = 0;
let qualityLow = false;
let mainLoopRafId = 0;
let sessionRuntimeStopped = false;

function scheduleMainLoop(){
  if (sessionRuntimeStopped || mainLoopRafId) return;
  mainLoopRafId = requestAnimationFrame(function (ts) {
    mainLoopRafId = 0;
    loop(ts);
  });
}

function loop(now){
  if (sessionRuntimeStopped) return;
  const mm = getMobileMode();
  const fpsCap = mm && mm.getFpsCap ? mm.getFpsCap() : 0;
  if (fpsCap > 0 && (now - lastFrameTs) < (1000 / fpsCap)){
    scheduleMainLoop();
    return;
  }
  lastFrameTs = now;
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  fpsAvg = fpsAvg * 0.95 + (1 / Math.max(0.001, dt)) * 0.05;
  const fxLevel = getFxLevel();
  qualityLow = fpsAvg < 45 || fxLevel >= 1;
  if (isFxUltraLite()){
    BAL.maxParticles = 520;
    BAL.maxDecals = 50;
  } else {
    BAL.maxParticles = qualityLow ? 900 : 1600;
    BAL.maxDecals = qualityLow ? 70 : 120;
  }
  if (nowSec() - lastProgressSave > 7){
    saveProgress();
    lastProgressSave = nowSec();
    // Refresh telemetry debug widget (throttled to save interval)
    if (DebugPanelEnabled && window.Game && window.Game.Telemetry) window.Game.Telemetry.refreshUI();
  }
  // Telemetry: update gauges every frame (cheap)
  if (window.Game && window.Game.Telemetry) {
    var T = window.Game.Telemetry;
    T.gauge('coins', state.coins);
    T.gauge('kills', state.kills);
    T.gauge('computerLevel', getComputerLevel());
    T.gauge('fps', Math.round(fpsAvg));
    T.max('maxCoins', state.coins);
    T.max('maxComputerLevel', getComputerLevel());
    var tankCount = 0;
    for (var ci = 0; ci < state.cells.length; ci++) { if (state.cells[ci] && state.cells[ci].tank) tankCount++; }
    T.gauge('tanksOnBoard', tankCount);
    T.gauge('zombieCount', state.zombies ? state.zombies.length : 0);
  }

  if (state.levelUpVfxUntil != null && nowSec() >= state.levelUpVfxUntil){
    state.timeScale = 1;
    state.levelUpVfxUntil = null;
  }

  updateCenterNotification();

  const effDt = dt * (state.timeScale ?? 1);
  normalizeActiveEffectsTimestamps();
  const paused = pauseManager && typeof pauseManager.isPaused === 'function'
    ? pauseManager.isPaused()
    : !!(
      (state && state.ui && state.ui.menuOpen) ||
      (supercomputerMenuController && typeof supercomputerMenuController.isOpen === 'function' && supercomputerMenuController.isOpen())
    );
  setSimulationPaused(paused, pauseManager && pauseManager.getReasons ? pauseManager.getReasons() : { menuOpen: !!state.ui.menuOpen, tabInactive: false, criticalPause: false });
  syncTrackLoopSfxState(paused);
  if (!paused){
    updateWorldEvents(effDt);
    ensureZombieCount();
    maybeSpawnCrate();
    stepZombies(effDt);
    if (isTalentsV2Ready()) {
      const talentsApi = getTalentsV2Api();
      const nowMs = Date.now();
      if (talentsApi && typeof talentsApi.onUpdate === 'function') {
        talentsApi.onUpdate({
          timeMs: nowMs,
          dtMs: effDt * 1000,
          segments: state.fenceSegments,
          state,
        });
      }
      if (talentsApi && typeof talentsApi.tickStatuses === 'function') {
        talentsApi.tickStatuses({
          timeMs: nowMs,
          zombies: state.zombies,
        });
      }
    }
    stepTanks(effDt);
    stepProjectiles(effDt);
    stepDecals(effDt);
    // ── Chip effects tick (electro nodes, laser marks) ──
    {
      const _ChipFxStep = window.Game && window.Game.ChipEffects;
      if (_ChipFxStep && typeof _ChipFxStep.stepChipEffects === 'function') {
        _ChipFxStep.stepChipEffects(effDt, {
          zombies: state.zombies,
          getZombiePos: zombiePos,
          applyDamage: applyDamageToZombie,
          addDamageNumber,
          impacts: state.impacts,
        });
      }
    }
    stepCrate(effDt);
    cleanupKills();
    stepImpacts(effDt);
    stepParticles(effDt);
    stepDamageNumbers(effDt);
    stepSupercomputer(effDt);
    // ── Production Line step ──
    {
      const _PL = window.Game && window.Game.ProductionLine;
      if (_PL && typeof _PL.step === 'function') {
        _PL.step(state, effDt);
      }
    }
    {
      const _PLR = window.Game && window.Game.ProductionLineRender;
      if (_PLR && typeof _PLR.syncState === 'function') {
        _PLR.syncState(state, effDt);
      }
    }
    if (DronesApi && typeof DronesApi.step === 'function') {
      DronesApi.step({
        state,
        dt: effDt,
        nowSec: nowSec(),
        fenceRepairCost: getFenceRepairCostCoins(),
        dronConfig: getDronRuntimeConfig(),
        boardRect: state.boardRect,
        fenceOrigin: center,
        worldBounds: { minX: 0, minY: 0, maxX: viewSize.w, maxY: viewSize.h },
        onFenceSegmentStateChanged: syncFenceBreachForSegment,
      });
    }
  }

  syncFenceTierWithMaxTankLevel(state);

  updateUI();
  draw();

  scheduleMainLoop();
}

// ---------- Debug Panel (?debug=1) ----------
const DEBUG_MAX_TANK_LEVEL = MAX_TANK_LEVEL;
const DEBUG_LOG_MAX = 100;

function debugLog(level, msg){
  if (!DebugPanelEnabled || !state.debug) return;
  const entry = { level: level || 'info', msg: String(msg), t: nowSec() };
  state.debug.log.push(entry);
  if (state.debug.log.length > DEBUG_LOG_MAX) state.debug.log.shift();
  const el = document.getElementById('debugLog');
  if (el){
    const line = document.createElement('div');
    line.className = `debugLogEntry ${entry.level}`;
    line.textContent = `[${entry.level}] ${entry.msg}`;
    el.appendChild(line);
    el.scrollTop = el.scrollHeight;
  }
}

function debugReset(){
  if (!DebugPanelEnabled || !state.debug) return;
  try {
    state.debug.talentOverrides = {};
    state.debug.targetCellIndex = null;
    state.debug.debugStatusActive = false;
    state.activeEffects.attackUntil = 0;
    state.activeEffects.speedUntil = 0;
    state.activeEffects.economyUntil = 0;
    if (state.debug.previewParticles) state.debug.previewParticles = [];
    state.particles = state.particles.filter(p => !p.debugPreview);
    state.impacts = state.impacts.filter(fx => !fx.debugPreview);
    state.decals = state.decals.filter(d => !d.debugPreview);
    if (state.player?.mods) state.player.modsDirty = true;
    debugLog('info', 'Reset: overrides, target, statuses, preview VFX cleared.');
  } catch (e) {
    debugLog('error', 'Reset failed: ' + (e && e.message));
  }
}

function safeDebug(fn, fallbackMsg){
  try {
    return fn();
  } catch (e) {
    debugLog('error', fallbackMsg + (e && e.message ? ': ' + e.message : ''));
    return undefined;
  }
}

function initDebugPanel(){
  const getWaveInfo = function () {
    const now = nowSec();
    const attackCfg = getWorldEventsAttackCfg();
    const attackActive = isZombieAttackModeActive();
    const waveNumber = Number.isFinite(worldEventsState.waveNumber) ? Math.max(0, Math.floor(worldEventsState.waveNumber)) : 0;
    const safeWaves = Number.isFinite(attackCfg.safeWaves) ? Math.max(0, Math.floor(attackCfg.safeWaves)) : 0;
    return {
      waveNumber,
      safeWaves,
      attackActive: !!attackActive,
      nextAttackInSec: !attackActive && Number.isFinite(worldEventsState.attackStartAt)
        ? Math.max(0, worldEventsState.attackStartAt - now)
        : 0,
      attackEndsInSec: attackActive && Number.isFinite(worldEventsState.attackEndAt)
        ? Math.max(0, worldEventsState.attackEndAt - now)
        : 0,
      idleWavePhase: getZombieIdleWavePhase(),
      zombieWaveAtkMult: Number.isFinite(state.zombieWaveAtkMult) ? Math.max(0, state.zombieWaveAtkMult) : 1,
      zombiesAlive: Array.isArray(state.zombies)
        ? state.zombies.filter(function (z) { return z && z.state !== 'dying'; }).length
        : 0,
    };
  };

  if (DebugPanelApi && typeof DebugPanelApi.initDebugPanel === 'function') {
    DebugPanelApi.initDebugPanel({
      DebugPanelEnabled,
      state,
      document,
      nowSec,
      DEBUG_PARAM,
      MAX_TANK_LEVEL,
      MAX_DRON_LEVEL: Math.max(10, getDronRuntimeConfig().maxLevel || 1),
      BAL,
      BASE_BAL,
      center,
      makeTank,
      addDron,
      recordTankLevel,
      openDismantleModal,
      setMenuOpen,
      tankLevelCounts,
      computeAuraBand,
      zombieLevelWeights,
      pickZombieLevel,
      initBoard,
      burst,
      playSfx,
      canUseActive,
      useActiveAbility,
      getAchievementDefinitions,
      debugUnlockAchievementAndClaim,
      debugSetTotalMerges,
      debugAdjustTalentPoints,
      debugAdjustDamagePoints,
      getWaveInfo,
      updateUI,
      debugLog,
      debugReset,
      safeDebug,
    });
    return;
  }
  debugLog('warn', 'DebugPanel module unavailable.');
}

// ---------- Boot ----------
async function boot(){
  if (bootPromise) return bootPromise;
  bootPromise = (async function runBootFlow() {
    try {
      const balRes = await fetch('assets/balance.json', { cache: 'no-store' });
      if (balRes.ok) {
        const balData = await balRes.json();
        BalanceConfig = {
          zombie: balData.zombie || {},
          zombieOverrides: balData.zombieOverrides || {},
          tank: balData.tank || {},
          tankOverrides: balData.tankOverrides || {},
        };
      }
    } catch (e) { console.warn('balance.json load failed:', e); }

    try {
      const cannonRes = await fetch('assets/balance/cannonUpgrades.json', { cache: 'no-store' });
      if (!cannonRes.ok) throw new Error('HTTP ' + cannonRes.status);
      const cannonData = await cannonRes.json();
      const normalizedCannon = normalizeCannonUpgradesConfig(cannonData);
      if (!normalizedCannon) throw new Error('validation_failed');
      CannonUpgradesBalance = normalizedCannon;
      GameApi.Balance = GameApi.Balance || {};
      GameApi.Balance.CannonUpgrades = CannonUpgradesBalance;
    } catch (e) {
      CannonUpgradesBalance = createFallbackCannonUpgrades(CANNON_UPGRADES_LEVELS);
      GameApi.Balance = GameApi.Balance || {};
      GameApi.Balance.CannonUpgrades = CannonUpgradesBalance;
      console.warn('[Balance] using fallback CannonUpgrades:', e);
    }

    // ── Load chips.json for chip modifier visuals / sounds ──
    try {
      const chipsRes = await fetch('assets/chips.json', { cache: 'no-store' });
      if (chipsRes.ok) {
        const chipsData = await chipsRes.json();
        if (window.Game && window.Game.ChipEffects && typeof window.Game.ChipEffects.loadChipsCfg === 'function') {
          window.Game.ChipEffects.loadChipsCfg(chipsData);
          console.log('[ChipEffects] chips.json loaded OK');
        }
      }
    } catch (e) { console.warn('chips.json load failed:', e); }

    await GroundSprites.load().catch(function () {});
    rebuildGroundLayer();
    if (BootstrapApi && typeof BootstrapApi.runBoot === 'function') {
      await BootstrapApi.runBoot({
        windowObj: window,
        documentObj: document,
        localStorageObj: localStorage,
        getState: () => state,
        getSettings: () => settings,
        loadSettings,
        setLanguage,
        currentLang,
        initialMenuSubView: bootInitialMenuSubView,
        getI18n,
        applyTranslations,
        updateUI,
        ensureProgressUI,
        initTalentDefs,
        applySavedProgress,
        getSavedProgress,
        ensureTalentState,
        initTalentsV2: initTalentsV2Runtime,
        xpNeededForLevel,
        ui,
        meta,
        grantXP,
        saveProgress,
        buildSavePayload: buildSmallMenuSavePayload,
        clamp,
        settings,
        getVolume,
        setVolume,
        setAutoPauseEnabled,
        applyAudioSettings,
        updateMenuVolumes,
        syncVolumeUIFromSettings,
        playUiSliderPreviewSfxThrottled,
        stopTrackLoopSfxImmediate,
        saveSettings,
        openTalents,
        openSupercomputerMenu,
        setMenuOpen,
        onSmallMenuApiReady: (api) => { smallMenuRuntimeController = api || null; },
        onCriticalSaveExitCompleted: () => { stopAndResetSessionToBigMenu(); },
        stopAndResetSessionToBigMenu,
        updateBigMenuLoadState,
        isSessionStartUnlocked: () => sessionStartGate === 'unlocked',
        unlockSessionStartGate: () => setSessionStartGate('unlocked'),
        t,
        resetGameState,
        nowSec,
        BAL,
        resizeCanvas,
        restoreFullState,
        postRestoreSync,
        DebugPanelEnabled,
        initDebugPanel,
        makeTank,
        ensureStarterTanks: spawnInitialTanksLvl1,
        recordTankLevel,
        ZombieSprites,
        getZombieSpawnBalanceConfig,
        TankSprites,
        BulletSprites,
        BoostIconsSprites,
        FenceSprites,
        DecorSprites,
        SupercomputerSprites,
        DronSprites,
        BonusBoxSprites,
        onSupercomputerConfigLoaded: initBoard,
        onDecorSpritesLoaded: initDecors,
        GroundSprites,
        ensureZombieCount,
        acceptLevelReward,
        loop,
        startLoop: scheduleMainLoop,
      });
      rebuildGroundLayer();
      return;
    }
    throw new Error('Bootstrap module unavailable');
  })().catch(function (err) {
    bootPromise = null;
    throw err;
  });
  return bootPromise;
}

initBigMainMenu();

// ── Production Line UI init ──
{
  const _PLUI = window.Game && window.Game.ProductionLineUI;
  if (_PLUI && typeof _PLUI.init === 'function') {
    // Expose addDron callback for loot resolution
    window.Game._productionLineAddDron = addDron;
    _PLUI.init({
      t: t,
      a11yOpen: a11yOpen,
      a11yClose: a11yClose,
      toast: function (msg) {
        if (window.Game && window.Game.Toast && typeof window.Game.Toast.show === 'function') {
          window.Game.Toast.show(msg);
        }
      },
      onOpenBox: function (boxIndex) {
        const PL = window.Game && window.Game.ProductionLine;
        if (!PL) return null;
        const result = PL.openBox(state, boxIndex);
        updateUI();
        return result;
      },
    });
  }
}

/*
assets/zombies.json example:
{
  "atlas": "zombie_atlas.png",
  "types": [
    {"id":"walker","frame":{"x":0,"y":0,"w":64,"h":64},"anchor":{"x":0.5,"y":0.75},"scale":1.2,"hpMul":1.0,"omegaMul":1.0,"rewardMul":1.0,"weight":1.0},
    {"id":"runner","frame":{"x":64,"y":0,"w":64,"h":64},"anchor":{"x":0.5,"y":0.75},"scale":1.1,"hpMul":0.85,"omegaMul":1.35,"rewardMul":0.9,"weight":0.7}
  ]
}
*/
