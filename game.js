// Tank Merger: Zombie Orbit

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
const GameApi = (window.Game = window.Game || {});

const ui = {
  coins: document.getElementById('coins'),
  zcount: document.getElementById('zcount'),
  buy: document.getElementById('buy'),
  buyCost: document.getElementById('buyCost'),
  boost: document.getElementById('boost'),
  buyBulk: document.getElementById('buyBulk'),
  boostState: document.getElementById('boostState'),
  talentsBtn: document.getElementById('talentsBtn'),
  achievementsBtn: document.getElementById('achievementsBtn'),
  achievementsModal: document.getElementById('achievementsModal'),
  achievementsClose: document.getElementById('achievementsClose'),
  achievementsList: document.getElementById('achievementsList'),
  achievementPopup: document.getElementById('achievementPopup'),
  achievementPopupClose: document.getElementById('achievementPopupClose'),
  achievementPopupClaim: document.getElementById('achievementPopupClaim'),
  achievementPopupName: document.getElementById('achievementPopupName'),
  achievementPopupReward: document.getElementById('achievementPopupReward'),
  settingsBtn: document.getElementById('settingsBtn'),
  langRu: document.getElementById('langRu'),
  langEn: document.getElementById('langEn'),
  menuOverlay: document.getElementById('menuOverlay'),
  menuContinue: document.getElementById('menuContinue'),
  menuNew: document.getElementById('menuNew'),
  menuSfx: document.getElementById('menuSfx'),
  menuMusic: document.getElementById('menuMusic'),
  menuSfxValue: document.getElementById('menuSfxValue'),
  menuMusicValue: document.getElementById('menuMusicValue'),
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
};

const MAX_TANK_LEVEL = 60;
const ProgressionApi = GameApi?.Progression ?? null;
function computePowerTier(playerLevel){
  if (ProgressionApi && ProgressionApi.computePowerTier) {
    return ProgressionApi.computePowerTier(playerLevel);
  }
  const lvl = Math.max(1, Math.floor(playerLevel));
  if (lvl < 10) return 0;
  if (lvl < 20) return 1;
  if (lvl < 30) return 2;
  if (lvl < 40) return 3;
  if (lvl < 50) return 4;
  return 5;
}

function refreshTanksPowerTier(){
  const tier = computePowerTier(state.player?.level ?? 1);
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

// --- Balance config (loaded from assets/balance.json) ---
let BalanceConfig = { zombie: {}, zombieOverrides: {}, tank: {}, tankOverrides: {} };

function getZombieBalanceMul(typeId, key) {
  const base = Number.isFinite(BalanceConfig.zombie?.[key]) ? BalanceConfig.zombie[key] : 1;
  const over = BalanceConfig.zombieOverrides?.[typeId];
  if (over && Number.isFinite(over[key])) return over[key];
  return base;
}
function getTankBalanceMul(level, key) {
  const base = Number.isFinite(BalanceConfig.tank?.[key]) ? BalanceConfig.tank[key] : 1;
  const over = BalanceConfig.tankOverrides?.['level_' + level];
  if (over && Number.isFinite(over[key])) return over[key];
  return base;
}

const compact = true;
const muted = false;

const backgroundLayer = {
  canvas: null,
  ready: false,
};

const audioDefaultsFromApi = GameApi?.AudioSettings?.DEFAULT_SETTINGS;
const DEFAULT_SETTINGS = audioDefaultsFromApi
  ? { ...audioDefaultsFromApi }
  : {
      sfxVolume: 0.75,
      musicVolume: 0.6,
    };

let settings = { ...DEFAULT_SETTINGS };
let audioSettingsController = null;
const InitialStateApi = GameApi?.InitialState ?? null;
const AchievementsApi = GameApi?.Achievements ?? null;

function createInitialState(){
  if (InitialStateApi && InitialStateApi.createInitialState) {
    return InitialStateApi.createInitialState({ maxLevel: MAX_TANK_LEVEL });
  }
  return {
    coins: 120,
    kills: 0,
    cells: [],
    boardRect: {x:0,y:0,w:0,h:0},
    zombies: [],
    projectiles: [],
    impacts: [],     // rings + bolts
    decals: [],      // e.g., toxic pools
    particles: [],
    damageNumbers: [],
    decors: [],
      wallDecors: [],
    nextZombieRenderOrder: 1,
    fenceSegments: [],
    fenceSegmentsMeta: null,
    savedFenceState: null,
    crate: null,
    nextCrateAt: 0,
    dragging: null,
    boostUntil: 0,
    empUntil: 0,
    activeEffects: {
      attackUntil: 0,
      speedUntil: 0,
      economyUntil: 0,
    },
    player: {
      level: 1,
      xp: 0,
      xpToNext: 500,
      maxLevel: 60,
      talentPoints: 0,
      talentsApplied: [],
      talentsPending: [],
      activeCooldowns: [0, 0, 0],
      mods: null,
      modsDirty: true,
      eventShown40: false,
      eventShown50: false,
      eventShown60: false,
    },
    endgameVisuals: false,
    maxTankLevelAchieved: 1,
    buyCounts: {},
    buyPrices: {},
    achievements: {
      unlocked: {},
      popupQueue: [],
      totalPurchased: 0,
    },
    ui: {
      talentsOpen: false,
      talentBranch: 0,
      levelReward: null,
      levelRewardTimer: 0,
      menuOpen: true,
    },
    selectedHangarCellIndex: null,
    isDismantleMode: false,
    selectedTankIds: [],
  };
}

let state = createInitialState();
let meta = { lastSeenAt: null };

// Debug panel: enabled only via URL param (?debug=1 or ?debug=true)
const DEBUG_PARAM = 'debug';
function isDebugPanelEnabled(){
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get(DEBUG_PARAM) === '1';
  } catch (_) { return false; }
}
const DebugPanelEnabled = isDebugPanelEnabled();

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
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const FENCE_HIT_INTERVAL_MS = 500;
const FENCE_DEFAULT_SEGMENT_HP = 200;
const FENCE_DEFAULT_REPAIR_COST = 100;
const ZOMBIE_DEFAULT_ATTACK_DAMAGE = 8;
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

function talentWord(points){
  if (getCurrentLang() === 'ru'){
    const mod10 = points % 10;
    const mod100 = points % 100;
    if (mod10 === 1 && mod100 !== 11) return 'талант';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'таланта';
    return 'талантов';
  }
  return points === 1 ? 'talent' : 'talents';
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

  document.querySelectorAll('audio[data-audio="music"]').forEach(el => {
    el.volume = musicVolume;
  });
  document.querySelectorAll('audio[data-audio="sfx"]').forEach(el => {
    el.volume = sfxVolume;
  });
  Object.keys(SFX_POOLS).forEach(id => {
    const pool = SFX_POOLS[id];
    if (!pool || !pool.players) return;
    for (const player of pool.players) {
      player.volume = sfxVolume;
    }
  });
  Object.keys(LOOP_SFX_PLAYERS).forEach(id => {
    const player = LOOP_SFX_PLAYERS[id];
    if (!player) return;
    player.volume = sfxVolume;
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
  activeAbility: 'gameplay',
  thunder: 'gameplay',
  rainLoop: 'gameplay',
  levelUp: 'ui',
  applyTalents: 'ui',
};
let gameplayAudioSnapshots = [];
let gameplayAudioFadeToken = 0;
let pauseManager = null;
let simulationPaused = false;
let lastPauseReasons = { menuOpen: false, tabInactive: false };
let SFX_AUDIO_PROBE = null;

function sfxChannelOf(id){
  return SFX_CHANNELS[id] || 'gameplay';
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
  lastPauseReasons = reasons || { menuOpen: false, tabInactive: false };
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
  if (!SFX_POOLS[id]) {
    const sources = resolveSfxSourceList(id);
    const src = sources[0];
    if (!src) return null;
    const players = [];
    const vol = clamp(settings.sfxVolume ?? DEFAULT_SETTINGS.sfxVolume, 0, 1);
    for (let i = 0; i < SFX_POOL_SIZE; i++) {
      const player = new Audio(src);
      player.preload = 'auto';
      player.volume = vol;
      enableAudioFallback(player, sources);
      players.push(player);
    }
    SFX_POOLS[id] = { players, cursor: 0 };
  }
  return SFX_POOLS[id];
}

function getLoopSfxPlayer(id){
  if (!LOOP_SFX_PLAYERS[id]) {
    const sources = resolveSfxSourceList(id);
    const src = sources[0];
    if (!src) return null;
    const player = new Audio(src);
    player.preload = 'auto';
    player.loop = true;
    enableAudioFallback(player, sources);
    LOOP_SFX_PLAYERS[id] = player;
  }
  return LOOP_SFX_PLAYERS[id];
}

function playLoopSfx(id, volumeMul){
  if (simulationPaused && sfxChannelOf(id) === 'gameplay') return;
  const vol = clamp(settings.sfxVolume ?? DEFAULT_SETTINGS.sfxVolume, 0, 1);
  const mul = Number.isFinite(volumeMul) ? clamp(volumeMul, 0, 1) : 1;
  try {
    const player = getLoopSfxPlayer(id);
    if (!player) return;
    player.volume = vol * mul;
    if (!player.paused) return;
    player.play().catch(() => {});
  } catch (e) {}
}

function setLoopSfxVolume(id, volumeMul){
  try {
    const player = LOOP_SFX_PLAYERS[id];
    if (!player || player.paused) return;
    const vol = clamp(settings.sfxVolume ?? DEFAULT_SETTINGS.sfxVolume, 0, 1);
    const mul = Number.isFinite(volumeMul) ? clamp(volumeMul, 0, 1) : 1;
    player.volume = vol * mul;
  } catch (e) {}
}

function stopLoopSfx(id){
  try {
    const player = LOOP_SFX_PLAYERS[id];
    if (!player) return;
    player.pause();
    try { player.currentTime = 0; } catch (e) {}
  } catch (e) {}
}

function normalizedSfxSources(value, fallbackList){
  const fallback = Array.isArray(fallbackList) ? fallbackList.filter((s) => typeof s === 'string' && s.length > 0) : [];
  if (Array.isArray(value)) {
    const list = value.filter((s) => typeof s === 'string' && s.length > 0);
    return list.length ? list : fallback;
  }
  if (typeof value === 'string' && value.length > 0) return [value];
  return fallback;
}

function setSfxSources(id, sources){
  const next = normalizedSfxSources(sources, []);
  if (!next.length) return;
  const prevRaw = SFX_SOURCES[id];
  const prev = Array.isArray(prevRaw)
    ? prevRaw.filter((s) => typeof s === 'string' && s.length > 0)
    : (typeof prevRaw === 'string' && prevRaw.length > 0 ? [prevRaw] : []);
  if (prev.length === next.length && prev.every((s, i) => s === next[i])) return;

  stopLoopSfx(id);
  delete LOOP_SFX_PLAYERS[id];
  delete SFX_POOLS[id];
  delete SFX_RESOLVED_SOURCE_LISTS[id];
  SFX_SOURCES[id] = next.slice();
}

function playSfx(id){
  if (simulationPaused && sfxChannelOf(id) === 'gameplay') return;
  const vol = clamp(settings.sfxVolume ?? DEFAULT_SETTINGS.sfxVolume, 0, 1);
  const now = performance.now();
  if (SFX_LAST_PLAYED[id] != null && now - SFX_LAST_PLAYED[id] < SFX_DEDUP_MS) return;
  SFX_LAST_PLAYED[id] = now;
  try{
    const pool = getSfxPool(id);
    if (!pool || !pool.players || !pool.players.length) return;
    let player = null;
    for (let i = 0; i < pool.players.length; i++) {
      const idx = (pool.cursor + i) % pool.players.length;
      const candidate = pool.players[idx];
      if (candidate.ended || candidate.paused) {
        player = candidate;
        pool.cursor = (idx + 1) % pool.players.length;
        break;
      }
    }
    if (!player) {
      player = pool.players[pool.cursor];
      pool.cursor = (pool.cursor + 1) % pool.players.length;
    }
    player.volume = vol;
    try { player.currentTime = 0; } catch (e) {}
    player.play().catch(() => {});
  }catch(e){}
}
const SFX_SOURCES = {
  shootNormal: 'assets/sfx/shoot_normal.ogg',
  shootHeavy: 'assets/sfx/shoot_heavy.ogg',
  shootHeavy2: 'assets/sfx/shoot_heavy2.ogg',
  levelUp: 'assets/sfx/level_up.ogg',
  applyTalents: 'assets/sfx/apply_talents.ogg',
  activeAbility: 'assets/sfx/active_ability.ogg',
  thunder: ['assets/sfx/thunder.ogg', 'assets/sfx/thunder.wav'],
  rainLoop: DEFAULT_RAIN_LOOP_SOURCES.slice(),
};

function updateMenuVolumes(){
  if (ui.menuMusic){
    ui.menuMusic.value = Math.round((settings.musicVolume ?? 0) * 100);
  }
  if (ui.menuSfx){
    ui.menuSfx.value = Math.round((settings.sfxVolume ?? 0) * 100);
  }
  if (ui.menuMusicValue){
    ui.menuMusicValue.textContent = `${Math.round((settings.musicVolume ?? 0) * 100)}%`;
  }
  if (ui.menuSfxValue){
    ui.menuSfxValue.textContent = `${Math.round((settings.sfxVolume ?? 0) * 100)}%`;
  }
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
    const resetBtn = overlay.querySelector('#talentReset');
    if (resetBtn) resetBtn.textContent = t('talentReset');
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
    ui.settingsBtn.setAttribute('title', t('menuSettings'));
  }
  const langSwitch = document.querySelector('.langSwitch');
  if (langSwitch){
    langSwitch.setAttribute('aria-label', t('menuLanguage'));
  }
  updateTalentUI();
  updateLevelModal();
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
  resolveVariant() { return null; },
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
};

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
  state.fenceSegments = [];
  state.fenceSegmentsMeta = null;

  if (state.crate){
    const cell = state.cells[state.crate.cellIndex];
    if (cell){
      state.crate.x = cell.x + cell.w / 2;
      state.crate.targetY = cell.y + cell.h / 2;
      state.crate.y = Math.min(state.crate.y, state.crate.targetY);
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

  buildBackground();
  initDecors();
}

function initDecors(){
  state.decors = [];
  state.wallDecors = [];
  const decorCfg = DecorSprites && DecorSprites.config ? DecorSprites.config : null;
  const cfgIds = Array.isArray(decorCfg?.spriteIds) ? decorCfg.spriteIds : [];
  const cfgCount = Number.isFinite(decorCfg?.count) ? decorCfg.count : 0;
  const cfgZones = Array.isArray(decorCfg?.noSpawnZones) ? decorCfg.noSpawnZones : [];

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
  const maxAttempts = BAL.decorMaxAttempts || 400;
  const boardRect = state.boardRect || { x: center.x - 120, y: center.y - 120, w: 240, h: 240 };
  // Decor spawns OUTSIDE the fence, not inside
  const fenceOuterEdge = Number.isFinite(BAL.fenceRadius) ? (BAL.fenceRadius + (BAL.fenceWidth || 20) * 0.5 + 12) : 300;
  const innerR = fenceOuterEdge;
  const outerRByViewport = Math.max(viewSize.w, viewSize.h) * 0.62;
  let outerR = outerRByViewport;
  if (!(outerR > innerR)) {
    outerR = innerR + 80;
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

  function tryPlaceDecor(checkZones){
    for (let attempt = 0; attempt < maxAttempts; attempt++){
      const angle = Math.random() * Math.PI * 2;
      const r = innerR + Math.random() * (outerR - innerR);
      const x = center.x + Math.cos(angle) * r;
      const y = center.y + Math.sin(angle) * r;

      if (checkZones && zones.length && pointBlockedByZones(x, y, zones)) continue;

      const spriteId = ids[Math.floor(Math.random() * ids.length)];
      const frame = DecorSprites.pickFrame(spriteId);
      const frameScale = Number.isFinite(frame?.scale) && frame.scale > 0 ? frame.scale : 1;
      const isWall = !!(frame && frame.isWall);
      const drawScale = 0.5 * balScale * frameScale;
      const baseRadius = frame ? Math.min(frame.w, frame.h) * drawScale : blockRadiusMin;
      const blockR = Math.max(blockRadiusMin, baseRadius * blockRadiusK);
      const decor = { x, y, spriteId, blockR, isWall, renderOrder: state.decors.length };
      state.decors.push(decor);
      if (isWall) state.wallDecors.push(decor);
      return true;
    }
    return false;
  }

  for (let n = 0; n < count; n++){
    const placedWithZones = tryPlaceDecor(true);
    if (!placedWithZones && zones.length) tryPlaceDecor(false);
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
    groundLayer.rebuild({
      cfg: GroundSprites.config,
      atlasImg: GroundSprites.atlasImg,
      width: viewSize.w,
      height: viewSize.h,
    });
    return !!groundLayer.ready;
  } catch (e) {
    if (typeof groundLayer.invalidate === 'function') groundLayer.invalidate();
    return false;
  }
}

function getWorldEventsAttackCfg(){
  const cfg = WorldEventsCfg && WorldEventsCfg.attackMode ? WorldEventsCfg.attackMode : {};
  const debugForceAttack = !!(state && state.debug && (
    typeof state.debug.forceAttackMode === 'boolean'
      ? state.debug.forceAttackMode
      : (typeof state.debug.forceDisableAttackMode === 'boolean' ? !state.debug.forceDisableAttackMode : false)
  ));
  const autoEnabled = !!(WorldEventsCfg && WorldEventsCfg.enabled && cfg.enabled);
  return {
    enabled: autoEnabled,
    forceEnabled: debugForceAttack,
    attackEverySec: Number.isFinite(cfg.attackEverySec) ? Math.max(1, cfg.attackEverySec) : 75,
    attackDurationSec: Number.isFinite(cfg.attackDurationSec) ? Math.max(1, cfg.attackDurationSec) : 20,
    weatherLeadInSec: Number.isFinite(cfg.weatherLeadInSec) ? Math.max(0, cfg.weatherLeadInSec) : 5,
    weatherLeadOutSec: Number.isFinite(cfg.weatherLeadOutSec) ? Math.max(0, cfg.weatherLeadOutSec) : 3,
    targetAliveMult: Number.isFinite(cfg.targetAliveMult) ? Math.max(0.1, cfg.targetAliveMult) : 1,
    targetAliveRampSec: Number.isFinite(cfg.targetAliveRampSec) ? clamp(cfg.targetAliveRampSec, 1, 3) : 2,
    speedMult: Number.isFinite(cfg.speedMult) ? Math.max(0.1, cfg.speedMult) : 1,
    damageMult: Number.isFinite(cfg.damageMult) ? Math.max(0.1, cfg.damageMult) : 1,
    eveningDimAlpha: Number.isFinite(cfg.eveningDimAlpha) ? clamp(cfg.eveningDimAlpha, 0, 1) : 0.16,
    eveningTransitionSec: Number.isFinite(cfg.eveningTransitionSec) ? clamp(cfg.eveningTransitionSec, 0.1, 30) : 4,
  };
}

function getWeatherCfg(){
  const cfg = WorldEventsCfg && WorldEventsCfg.weather ? WorldEventsCfg.weather : {};
  const lightning = cfg.lightning || {};
  const rain = cfg.rain || {};
  const debugForceWeather = !!(state && state.debug && (
    typeof state.debug.forceWeather === 'boolean'
      ? state.debug.forceWeather
      : (typeof state.debug.forceDisableWeather === 'boolean' ? !state.debug.forceDisableWeather : false)
  ));
  const hasInterval = Number.isFinite(lightning.intervalMinSec) || Number.isFinite(lightning.intervalMaxSec);
  const minSec = Number.isFinite(lightning.intervalMinSec) ? Math.max(0.1, lightning.intervalMinSec) : 8;
  const maxSec = Number.isFinite(lightning.intervalMaxSec) ? Math.max(minSec, lightning.intervalMaxSec) : Math.max(minSec, 20);
  const rainLoopSources = normalizedSfxSources(
    rain.sfxLoopSources,
    normalizedSfxSources(rain.sfxLoopFile, DEFAULT_RAIN_LOOP_SOURCES)
  );
  const autoEnabled = !!(WorldEventsCfg && WorldEventsCfg.enabled && cfg.enabled);
  const forceAttack = !!(state && state.debug && (
    typeof state.debug.forceAttackMode === 'boolean'
      ? state.debug.forceAttackMode
      : (typeof state.debug.forceDisableAttackMode === 'boolean' ? !state.debug.forceDisableAttackMode : false)
  ));
  return {
    enabled: autoEnabled || debugForceWeather || forceAttack,
    forceEnabled: debugForceWeather,
    rain: {
      ...rain,
      sfxLoopSources: rainLoopSources,
    },
    lightning: {
      ...lightning,
      intervalMinSec: minSec,
      intervalMaxSec: maxSec,
      useInterval: hasInterval,
    },
    thunder: cfg.thunder || {},
  };
}

function configureRainLoopSfx(rainCfg){
  const rain = rainCfg || {};
  const sources = normalizedSfxSources(
    rain.sfxLoopSources,
    normalizedSfxSources(rain.sfxLoopFile, DEFAULT_RAIN_LOOP_SOURCES)
  );
  setSfxSources('rainLoop', sources);
}

function scheduleNextLightning(now, lightningCfg){
  const minSec = Number.isFinite(lightningCfg?.intervalMinSec) ? Math.max(0.1, lightningCfg.intervalMinSec) : 8;
  const maxSec = Number.isFinite(lightningCfg?.intervalMaxSec) ? Math.max(minSec, lightningCfg.intervalMaxSec) : Math.max(minSec, 20);
  const delay = minSec + Math.random() * (maxSec - minSec);
  worldEventsState.nextLightningAt = now + delay;
}

function processWeatherLightning(now, dt, weatherCfg){
  const lightningCfg = weatherCfg && weatherCfg.lightning ? weatherCfg.lightning : {};
  if (!worldEventsState.weatherEnabled || !lightningCfg.enabled) return;

  const flashDur = Number.isFinite(lightningCfg.flashDurationSec) ? Math.max(0.03, lightningCfg.flashDurationSec) : 0.12;
  let shouldFlash = false;
  if (lightningCfg.useInterval) {
    if (!Number.isFinite(worldEventsState.nextLightningAt) || worldEventsState.nextLightningAt <= 0) {
      scheduleNextLightning(now, lightningCfg);
    }
    if (now >= worldEventsState.nextLightningAt) {
      shouldFlash = true;
      scheduleNextLightning(now, lightningCfg);
    }
  } else {
    const chancePerSec = Number.isFinite(lightningCfg.chancePerSec) ? Math.max(0, lightningCfg.chancePerSec) : 0.14;
    if (now >= (worldEventsState.lightningUntil || 0) && Math.random() < chancePerSec * Math.max(0.001, dt)) {
      shouldFlash = true;
    }
  }

  if (!shouldFlash) return;
  worldEventsState.lightningUntil = now + flashDur;
  if (weatherCfg.thunder && weatherCfg.thunder.enabled) {
    playSfx(weatherCfg.thunder.sfxId || 'thunder');
  }
}

function isZombieAttackModeActive(){
  const attackCfg = getWorldEventsAttackCfg();
  if (attackCfg.forceEnabled) return true;
  return nowSec() < (worldEventsState.attackEndAt || 0);
}

function getZombieAttackMultipliers(){
  const attackCfg = getWorldEventsAttackCfg();
  const attackActive = isZombieAttackModeActive();
  if ((!attackCfg.enabled && !attackCfg.forceEnabled) || !attackActive) {
    return { targetAliveMult: 1, speedMult: 1, damageMult: 1 };
  }
  const startAt = Number.isFinite(worldEventsState.currentAttackStartAt) && worldEventsState.currentAttackStartAt > 0
    ? worldEventsState.currentAttackStartAt
    : nowSec();
  const elapsed = Math.max(0, nowSec() - startAt);
  const rampSec = Number.isFinite(attackCfg.targetAliveRampSec) ? Math.max(0, attackCfg.targetAliveRampSec) : 0;
  const k = rampSec > 0 ? clamp(elapsed / rampSec, 0, 1) : 1;
  const targetAliveMult = 1 + (attackCfg.targetAliveMult - 1) * k;
  return {
    targetAliveMult,
    speedMult: attackCfg.speedMult,
    damageMult: attackCfg.damageMult,
  };
}

function updateWorldEvents(dt){
  const attackCfg = getWorldEventsAttackCfg();
  const weatherCfg = getWeatherCfg();
  const rainCfg = weatherCfg.rain || {};
  configureRainLoopSfx(rainCfg);
  const now = nowSec();
  const prevWeatherEnabled = !!worldEventsState.weatherEnabled;

  const attackAutoEnabled = !!attackCfg.enabled;
  const forceAttackEnabled = !!attackCfg.forceEnabled;

  if (forceAttackEnabled) {
    if (!worldEventsState.forceAttackActive) {
      worldEventsState.currentAttackStartAt = now;
    }
    worldEventsState.forceAttackActive = true;
    worldEventsState.attackEndAt = Number.POSITIVE_INFINITY;
  } else if (!attackAutoEnabled) {
    worldEventsState.forceAttackActive = false;
    worldEventsState.currentAttackStartAt = 0;
    worldEventsState.attackEndAt = 0;
    worldEventsState.weatherUntil = 0;
    worldEventsState.weatherEnabled = !!(weatherCfg.enabled || weatherCfg.forceEnabled);
  } else {
    if (worldEventsState.forceAttackActive) {
      worldEventsState.currentAttackStartAt = 0;
      worldEventsState.attackEndAt = 0;
      worldEventsState.attackStartAt = now + attackCfg.attackEverySec;
    }
    worldEventsState.forceAttackActive = false;
    if (!Number.isFinite(worldEventsState.attackStartAt) || worldEventsState.attackStartAt <= 0) {
      worldEventsState.attackStartAt = now + attackCfg.attackEverySec;
    }

    if (now >= worldEventsState.attackStartAt) {
      const startAt = worldEventsState.attackStartAt;
      worldEventsState.currentAttackStartAt = startAt;
      worldEventsState.attackEndAt = startAt + attackCfg.attackDurationSec;
      worldEventsState.attackStartAt = startAt + attackCfg.attackEverySec;
    }

    if (worldEventsState.attackEndAt > 0 && now >= worldEventsState.attackEndAt) {
      worldEventsState.currentAttackStartAt = 0;
    }

    const inLeadIn = now >= (worldEventsState.attackStartAt - attackCfg.weatherLeadInSec) && now < worldEventsState.attackStartAt;
    const inAttackWindow = worldEventsState.currentAttackStartAt > 0 && now >= worldEventsState.currentAttackStartAt && now < worldEventsState.attackEndAt;
    const inLeadOut = inAttackWindow && now >= (worldEventsState.attackEndAt - attackCfg.weatherLeadOutSec);
    worldEventsState.weatherEnabled = weatherCfg.enabled && (inLeadIn || (inAttackWindow && !inLeadOut));
  }

  if (forceAttackEnabled) {
    worldEventsState.weatherEnabled = true;
  }
  if (weatherCfg.forceEnabled) {
    worldEventsState.weatherEnabled = true;
  }

  if (!worldEventsState.weatherEnabled) {
    worldEventsState.lightningUntil = 0;
    worldEventsState.nextLightningAt = 0;
  }

  const rainActive = !!(worldEventsState.weatherEnabled && rainCfg.enabled !== false);
  if (!prevWeatherEnabled && rainActive) {
    worldEventsState.rainBlend = 0;
    playLoopSfx('rainLoop', 0);
  }
  if (prevWeatherEnabled && !rainActive) {
    worldEventsState.rainBlend = 0;
    stopLoopSfx('rainLoop');
  }

  // Gradual rain fade-in (same duration as evening transition)
  if (rainActive) {
    const rainTransitionSec = Number.isFinite(attackCfg.eveningTransitionSec) ? Math.max(0.1, attackCfg.eveningTransitionSec) : 4;
    const rainStep = Math.min(1, Math.max(0, dt) / rainTransitionSec);
    worldEventsState.rainBlend = clamp((worldEventsState.rainBlend || 0) + rainStep, 0, 1);
    setLoopSfxVolume('rainLoop', worldEventsState.rainBlend);
  }

  processWeatherLightning(now, dt, weatherCfg);

  const attackActive = isZombieAttackModeActive();
  const eveningTarget = attackActive ? 1 : 0;
  const transitionSec = Number.isFinite(attackCfg.eveningTransitionSec) ? Math.max(0.1, attackCfg.eveningTransitionSec) : 4;
  const blend = Number.isFinite(worldEventsState.eveningDimBlend) ? worldEventsState.eveningDimBlend : 0;
  const step = Math.min(1, Math.max(0, dt) / transitionSec);
  worldEventsState.eveningDimBlend = blend + (eveningTarget - blend) * step;
}

function ensureRainCache(requiredCount){
  const count = Math.max(0, Math.floor(requiredCount));
  if (rainCache.maxDrops >= count) return;
  for (let i = rainCache.maxDrops; i < count; i++) {
    rainCache.x[i] = Math.random();
    rainCache.y[i] = Math.random();
    rainCache.speed[i] = 0.65 + Math.random() * 0.7;
    rainCache.len[i] = 0.7 + Math.random() * 0.8;
  }
  rainCache.maxDrops = count;
}

function drawWeather(){
  const weatherCfg = getWeatherCfg();
  if (!weatherCfg.enabled || !worldEventsState.weatherEnabled) return;

  const rainCfg = weatherCfg.rain || {};
  if (rainCfg.enabled !== false) {
    const density = Number.isFinite(rainCfg.density) ? Math.max(0, rainCfg.density) : 0.16;
    const dropCount = Math.floor(viewSize.w * density);
    ensureRainCache(dropCount);
    const speedMin = Number.isFinite(rainCfg.speedMin) ? rainCfg.speedMin : 520;
    const speedMax = Number.isFinite(rainCfg.speedMax) ? rainCfg.speedMax : 760;
    const lenMin = Number.isFinite(rainCfg.lengthMin) ? rainCfg.lengthMin : 10;
    const lenMax = Number.isFinite(rainCfg.lengthMax) ? rainCfg.lengthMax : 18;
    const alpha = Number.isFinite(rainCfg.alpha) ? clamp(rainCfg.alpha, 0.05, 0.6) : 0.26;
    const rainBlend = clamp(worldEventsState.rainBlend || 0, 0, 1);
    const effectiveAlpha = alpha * rainBlend;
    if (effectiveAlpha < 0.01) { /* skip drawing if fully transparent */ }
    else {
    const t = nowSec();
    ctx.save();
    ctx.strokeStyle = `rgba(180,205,255,${effectiveAlpha})`;
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';
    for (let i = 0; i < dropCount; i++) {
      const sx = rainCache.x[i] * viewSize.w;
      const speed = speedMin + (speedMax - speedMin) * rainCache.speed[i];
      const y = ((rainCache.y[i] * (viewSize.h + 30)) + (t * speed)) % (viewSize.h + 30) - 20;
      const len = lenMin + (lenMax - lenMin) * rainCache.len[i];
      ctx.beginPath();
      ctx.moveTo(sx, y);
      ctx.lineTo(sx - len * 0.22, y + len);
      ctx.stroke();
    }
    ctx.restore();
    }
  }

  if (nowSec() < (worldEventsState.lightningUntil || 0)) {
    ctx.save();
    ctx.fillStyle = 'rgba(228,238,255,0.22)';
    ctx.fillRect(0, 0, viewSize.w, viewSize.h);
    ctx.restore();
  }
}

function makeTank(level, onTrack = false){
  return {
    id: crypto.randomUUID(),
    level,
    powerTier: computePowerTier(state.player?.level ?? 1),
    cooldown: 0,
    onTrack,
    bodyAnim: Math.random() * 2,
    cannonAnim: 0,
    firedThisCycle: false,
  };
}

function recordTankLevel(level){
  state.maxTankLevelAchieved = Math.max(state.maxTankLevelAchieved || 0, level);
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
  return Math.max(1, Math.round(base * mods.buyCostMul * expMul));
}

function getBuyCostMul(){
  const mods = getMods();
  const exp = window.Game && window.Game.Experiments ? window.Game.Experiments.getVariant('economy_curve') : 'control';
  const expMul = exp === 'soft' ? 0.92 : 1;
  return mods.buyCostMul * expMul;
}

function bumpBuyPrice(level){
  const current = ensureBuyPrice(level);
  const delta = Math.max(1, Math.ceil(current * 0.001));
  state.buyPrices[level] = current + delta;
}

function ensureAchievementsState(){
  if (AchievementsApi && AchievementsApi.ensureState) return AchievementsApi.ensureState(state);
  if (!state.achievements || typeof state.achievements !== 'object') {
    state.achievements = { unlocked: {}, popupQueue: [], totalPurchased: 0 };
  }
  if (!state.achievements.unlocked || typeof state.achievements.unlocked !== 'object') state.achievements.unlocked = {};
  if (!Array.isArray(state.achievements.popupQueue)) state.achievements.popupQueue = [];
  if (!Number.isFinite(state.achievements.totalPurchased)) state.achievements.totalPurchased = 0;
  return state.achievements;
}

function queueAchievementPopup(achievementId){
  const ach = ensureAchievementsState();
  if (!ach || !achievementId) return;
  if (ach.popupQueue.indexOf(achievementId) < 0) ach.popupQueue.push(achievementId);
}

function processAchievementProgress(deltaCount){
  const count = Math.max(0, Math.floor(Number(deltaCount) || 0));
  if (count <= 0) return;
  let unlocked = [];
  if (AchievementsApi && AchievementsApi.addProgress) {
    unlocked = AchievementsApi.addProgress(state, count) || [];
  } else {
    const ach = ensureAchievementsState();
    ach.totalPurchased += count;
  }
  for (let i = 0; i < unlocked.length; i++) queueAchievementPopup(unlocked[i]);
  maybeShowNextAchievementPopup();
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
  popText(empty.x+empty.w/2, empty.y+empty.h/2, t('popTank'), '#7dffb2');
  if (window.Game && window.Game.Telemetry) window.Game.Telemetry.event('buyTank');
  if (window.Game && window.Game.TelemetryLogger) window.Game.TelemetryLogger.log('buyTank', { level: level });
  return true;
}

function tryBuyTank(){
  const bought = performTankPurchaseOnce();
  if (bought) processAchievementProgress(1);
}

function buyBulkMode(){
  if (AchievementsApi && AchievementsApi.getBulkMode) return AchievementsApi.getBulkMode(state);
  return 'none';
}

function tryBuyBulk(){
  const mode = buyBulkMode();
  if (mode === 'none') return;
  const target = mode === 'buy2' ? 2 : (mode === 'buy5' ? 5 : Number.MAX_SAFE_INTEGER);
  const affordable = calculateAffordableBuyCount(target);
  if (mode !== 'buyMax' && affordable.count !== target) return;
  const countToBuy = mode === 'buyMax' ? affordable.count : target;
  if (countToBuy <= 0) return;
  let purchased = 0;
  for (let i = 0; i < countToBuy; i++) {
    if (!performTankPurchaseOnce()) break;
    purchased += 1;
  }
  if (purchased > 0) processAchievementProgress(purchased);
}

function mergeCells(fromIdx, toIdx){
  if (fromIdx === toIdx) return false;
  const a = state.cells[fromIdx];
  const b = state.cells[toIdx];
  if (!a.tank || !b.tank) return false;
  if (a.tank.level !== b.tank.level) return false;
  if (a.tank.level >= MAX_TANK_LEVEL) return false;
  const fromLevel = a.tank.level;
  const lvl = fromLevel + 1;
  if (lvl > MAX_TANK_LEVEL) return false;
  b.tank = makeTank(lvl, false);
  a.tank = null;
  recordTankLevel(lvl);
  if (window.Game && window.Game.Telemetry) window.Game.Telemetry.event('merge');
  if (window.Game && window.Game.TelemetryLogger) window.Game.TelemetryLogger.log('merge', { fromLevel: fromLevel, toLevel: lvl });
  if (window.Game && window.Game.Funnel) window.Game.Funnel.trackStep('first_merge', { level: lvl });

  // Show merge popup for first time achieving this level
  if (window.Game && window.Game.MergePopup) {
    window.Game.MergePopup.show(lvl);
  }

  burst(b.x+b.w/2, b.y+b.h/2, 20, 'rgba(125,255,178,.85)');
  popText(b.x+b.w/2, b.y+b.h/2-16, t('levelUp', {level: lvl}), '#eaf1ff');
  return true;
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
  const base = Math.min(Math.pow(2, level - 1), MAX_COIN_PER_SHOT);
  const activeMul = nowSec() < state.activeEffects.economyUntil ? 1.6 : 1;
  return base * incomeMult() * mods.coinsMul * activeMul;
}

function coinsForKill(level, rewardMul=1){
  const mods = getMods();
  const base = BAL.coinsPerKillBase + BAL.coinsPerKillLevelMul * Math.max(0, level - 1);
  const activeMul = nowSec() < state.activeEffects.economyUntil ? 1.6 : 1;
  return base * rewardMul * incomeMult() * mods.coinsMul * activeMul;
}

function tankStats(level){
  const mods = getMods();
  const balDmgMul = getTankBalanceMul(level, 'attackDamageMul');
  const balAtkSpeedMul = getTankBalanceMul(level, 'attackSpeedMul');
  const dmg = BAL.dmgBase * Math.pow(BAL.dmgMultPerLevel, level-1);
  const fr = BAL.fireRateBase + BAL.fireRateAddPerLevel*(level-1);
  const Combat = window.Game && window.Game.Combat;
  const range = Combat ? Combat.getShootRange({ level }, state) : (BAL.rangeBase + BAL.rangePerLevel*(level-1));
  const prof = projectileProfile(level);
  // Tie AOE to profile but also allow slight growth with level.
  const aoe = clamp(prof.aoeBase + prof.aoePerLevel*(level-1), prof.aoeMin, prof.aoeMax);
  const activeAttack = nowSec() < state.activeEffects.attackUntil ? 1.5 : 1;
  const activeSpeed = nowSec() < state.activeEffects.speedUntil ? 1.35 : 1;
  return {
    dmg: dmg * mods.dmgMul * activeAttack * balDmgMul,
    fr: fr * mods.fireRateMul * activeSpeed * balAtkSpeedMul,
    range: range * mods.rangeMul,
    aoe: aoe * mods.aoeMul * (activeAttack > 1 ? 1.2 : 1),
    prof,
  };
}

function xpNeededForLevel(level){
  if (ProgressionApi && ProgressionApi.xpNeededForLevel) {
    return ProgressionApi.xpNeededForLevel(level);
  }
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

function getLevelFlowController(){
  if (!(LevelFlowApi && typeof LevelFlowApi.createLevelFlow === 'function')) return null;
  return LevelFlowApi.createLevelFlow({
    state,
    ui,
    BAL,
    t,
    talentWord,
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

const TALENT_BRANCHES = ['Атака', 'Скорость', 'Экономика'];
const TALENT_DEFS = [];
const ACTIVE_TALENT_INDEX = [null, null, null];

function sanitizeTalentIconBaseName(name){
  // Keep it stable and filesystem-safe (Windows + web servers)
  return String(name || '')
    .trim()
    .replace(/[:\\/]/g, ' ')
    .replace(/[<>"|?*]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'talent';
}

function talentIconPath(name){
  return `assets/Telent_icon/${sanitizeTalentIconBaseName(name)}.png`;
}

// Talent tree layout: row, slot (column 0-2), parents (indices within branch)
// Pattern: 3+3+3+3+2+2+1 = 17 talents per branch
// Row gating: row N requires N*5 points spent in branch
const TALENT_LAYOUT = [
  // Row 0 (0 pts): 3 talents
  { row: 0, slot: 0, parents: [] },
  { row: 0, slot: 1, parents: [] },
  { row: 0, slot: 2, parents: [] },
  // Row 1 (5 pts): 3 talents
  { row: 1, slot: 0, parents: [0] },
  { row: 1, slot: 1, parents: [0, 1, 2] },
  { row: 1, slot: 2, parents: [2] },
  // Row 2 (10 pts): 3 talents
  { row: 2, slot: 0, parents: [3] },
  { row: 2, slot: 1, parents: [3, 4, 5] },
  { row: 2, slot: 2, parents: [5] },
  // Row 3 (15 pts): 3 talents
  { row: 3, slot: 0, parents: [6] },
  { row: 3, slot: 1, parents: [6, 7, 8] },
  { row: 3, slot: 2, parents: [8] },
  // Row 4 (20 pts): 2 talents
  { row: 4, slot: 0, parents: [9, 10] },
  { row: 4, slot: 2, parents: [10, 11] },
  // Row 5 (25 pts): 2 talents
  { row: 5, slot: 0, parents: [12] },
  { row: 5, slot: 2, parents: [13] },
  // Row 6 (30 pts): 1 talent (active)
  { row: 6, slot: 1, parents: [14, 15] },
];

// Build edges for SVG lines: { from: idx, to: idx }
const TALENT_EDGES = [];
TALENT_LAYOUT.forEach((node, i) => {
  node.parents.forEach(p => TALENT_EDGES.push({ from: p, to: i }));
});

const TALENT_ROW_POINTS = 5; // points needed per row tier

function addTalent(branch, name, desc, maxRank, kind, apply){
  const id = `${branch}-${TALENT_DEFS.length}`;
  const prev = ACTIVE_TALENT_INDEX[branch];
  const idx = TALENT_DEFS.filter(d => d.branch === branch).length;
  const layout = TALENT_LAYOUT[idx] || { row: 0, slot: 1, parents: [] };
  const def = { id, branch, name, desc, maxRank, prev, kind, apply, row: layout.row, slot: layout.slot, parents: layout.parents, icon: talentIconPath(name) };
  TALENT_DEFS.push(def);
  ACTIVE_TALENT_INDEX[branch] = TALENT_DEFS.length - 1;
}

function initTalentDefs(){
  if (TALENT_DEFS.length) return;
  const addMul = (mods, key, perRank, rank) => { mods[key] *= 1 + perRank * rank; };
  const addChance = (mods, key, perRank, rank) => { mods[key] += perRank * rank; };
  const addCooldown = (mods, perRank, rank) => { mods.activeCooldownMul *= 1 - perRank * rank; };

  // Attack branch (17)
  addTalent(0, 'Калибр', 'Урон +7% за ранг.', 5, 'passive', (mods, r) => addMul(mods, 'dmgMul', 0.07, r));
  addTalent(0, 'Бронебойные', 'Урон +30%.', 1, 'passive', (mods, r) => addMul(mods, 'dmgMul', 0.30, r));
  addTalent(0, 'Фокусировка', 'Дальность +7% за ранг.', 5, 'passive', (mods, r) => addMul(mods, 'rangeMul', 0.07, r));
  addTalent(0, 'Дальний выстрел', 'Дальность +30%.', 1, 'passive', (mods, r) => addMul(mods, 'rangeMul', 0.30, r));
  addTalent(0, 'Разрывные боеприпасы', 'AOE +7% за ранг.', 5, 'passive', (mods, r) => addMul(mods, 'aoeMul', 0.07, r));
  addTalent(0, 'Широкий взрыв', 'AOE +30%.', 1, 'passive', (mods, r) => addMul(mods, 'aoeMul', 0.30, r));
  addTalent(0, 'Отравляющие осколки', 'Шанс DOT +6% за ранг.', 5, 'passive', (mods, r) => addChance(mods, 'dotChance', 0.06, r));
  addTalent(0, 'Токсичная волна', 'Шанс DOT +25%.', 1, 'passive', (mods, r) => addChance(mods, 'dotChance', 0.25, r));
  addTalent(0, 'Кислотный урон', 'DOT-урон +7% за ранг.', 5, 'passive', (mods, r) => addMul(mods, 'dotDpsMul', 0.07, r));
  addTalent(0, 'Горящий яд', 'DOT-урон +30%.', 1, 'passive', (mods, r) => addMul(mods, 'dotDpsMul', 0.30, r));
  addTalent(0, 'Контроль зоны', 'AOE +6% за ранг.', 5, 'passive', (mods, r) => addMul(mods, 'aoeMul', 0.06, r));
  addTalent(0, 'Разгон урона', 'Урон +6% за ранг.', 5, 'passive', (mods, r) => addMul(mods, 'dmgMul', 0.06, r));
  addTalent(0, 'Смертоносный заряд', 'Урон +35%.', 1, 'passive', (mods, r) => addMul(mods, 'dmgMul', 0.35, r));
  addTalent(0, 'Шрапнель', 'AOE +7% за ранг.', 5, 'passive', (mods, r) => addMul(mods, 'aoeMul', 0.07, r));
  addTalent(0, 'Огневой поток', 'Урон +8% за ранг.', 5, 'passive', (mods, r) => addMul(mods, 'dmgMul', 0.08, r));
  addTalent(0, 'Снайперский финал', 'Дальность +35%.', 1, 'passive', (mods, r) => addMul(mods, 'rangeMul', 0.35, r));
  addTalent(0, 'Активка: Шквал', 'На 6с усиливает урон и AOE.', 1, 'active', (mods) => {
    mods.activeBranches.add(0);
  });

  // Speed branch (17)
  addTalent(1, 'Калибровка затвора', 'Скорострельность +7% за ранг.', 5, 'passive', (mods, r) => addMul(mods, 'fireRateMul', 0.07, r));
  addTalent(1, 'Турбозатвор', 'Скорострельность +30%.', 1, 'passive', (mods, r) => addMul(mods, 'fireRateMul', 0.30, r));
  addTalent(1, 'Двойной выстрел', 'Шанс двойного выстрела +5% за ранг.', 5, 'passive', (mods, r) => addChance(mods, 'doubleShotChance', 0.05, r));
  addTalent(1, 'Дуплет', 'Шанс двойного выстрела +20%.', 1, 'passive', (mods, r) => addChance(mods, 'doubleShotChance', 0.20, r));
  addTalent(1, 'Стабильная орбита', 'Скорость орбиты +7% за ранг.', 5, 'passive', (mods, r) => addMul(mods, 'orbitSpeedMul', 0.07, r));
  addTalent(1, 'Рывок орбиты', 'Скорость орбиты +30%.', 1, 'passive', (mods, r) => addMul(mods, 'orbitSpeedMul', 0.30, r));
  addTalent(1, 'Синхронизация', 'Скорострельность +6% за ранг.', 5, 'passive', (mods, r) => addMul(mods, 'fireRateMul', 0.06, r));
  addTalent(1, 'Механизм спарки', 'Шанс двойного выстрела +4% за ранг.', 5, 'passive', (mods, r) => addChance(mods, 'doubleShotChance', 0.04, r));
  addTalent(1, 'Импульс', 'Скорострельность +35%.', 1, 'passive', (mods, r) => addMul(mods, 'fireRateMul', 0.35, r));
  addTalent(1, 'Реактивный контур', 'Скорость орбиты +8% за ранг.', 5, 'passive', (mods, r) => addMul(mods, 'orbitSpeedMul', 0.08, r));
  addTalent(1, 'Сокращение перезарядки', 'Кулдауны активки -8% за ранг.', 5, 'passive', (mods, r) => addCooldown(mods, 0.08, r));
  addTalent(1, 'Молниеносность', 'Кулдауны активки -30%.', 1, 'passive', (mods, r) => addCooldown(mods, 0.30, r));
  addTalent(1, 'Сверхскорострельность', 'Скорострельность +7% за ранг.', 5, 'passive', (mods, r) => addMul(mods, 'fireRateMul', 0.07, r));
  addTalent(1, 'Серия', 'Шанс двойного выстрела +22%.', 1, 'passive', (mods, r) => addChance(mods, 'doubleShotChance', 0.22, r));
  addTalent(1, 'Разгон орбиты', 'Скорость орбиты +9% за ранг.', 5, 'passive', (mods, r) => addMul(mods, 'orbitSpeedMul', 0.09, r));
  addTalent(1, 'Стартовый импульс', 'Скорострельность +35%.', 1, 'passive', (mods, r) => addMul(mods, 'fireRateMul', 0.35, r));
  addTalent(1, 'Активка: Перегрев', 'На 6с резко ускоряет стрельбу и орбиту.', 1, 'active', (mods) => {
    mods.activeBranches.add(1);
  });

  // Economy branch (17)
  addTalent(2, 'Скидки', 'Стоимость покупки -6% за ранг.', 5, 'passive', (mods, r) => addMul(mods, 'buyCostMul', -0.06, r));
  addTalent(2, 'Оптовые закупки', 'Стоимость покупки -25%.', 1, 'passive', (mods, r) => addMul(mods, 'buyCostMul', -0.25, r));
  addTalent(2, 'Увеличенный выкуп', 'Награда монетами +7% за ранг.', 5, 'passive', (mods, r) => addMul(mods, 'coinsMul', 0.07, r));
  addTalent(2, 'Премия за убийство', 'Награда монетами +30%.', 1, 'passive', (mods, r) => addMul(mods, 'coinsMul', 0.30, r));
  addTalent(2, 'Копилка опыта', 'Опыт +7% за ранг.', 5, 'passive', (mods, r) => addMul(mods, 'xpMul', 0.07, r));
  addTalent(2, 'Ускоренное обучение', 'Опыт +30%.', 1, 'passive', (mods, r) => addMul(mods, 'xpMul', 0.30, r));
  addTalent(2, 'Снабжение', 'Награда монетами +6% за ранг.', 5, 'passive', (mods, r) => addMul(mods, 'coinsMul', 0.06, r));
  addTalent(2, 'Казначей', 'Награда монетами +35%.', 1, 'passive', (mods, r) => addMul(mods, 'coinsMul', 0.35, r));
  addTalent(2, 'Экономия топлива', 'Стоимость покупки -5% за ранг.', 5, 'passive', (mods, r) => addMul(mods, 'buyCostMul', -0.05, r));
  addTalent(2, 'Инвестор', 'Опыт +8% за ранг.', 5, 'passive', (mods, r) => addMul(mods, 'xpMul', 0.08, r));
  addTalent(2, 'Бонус за выстрел', 'Награда за выстрел +6% за ранг.', 5, 'passive', (mods, r) => addMul(mods, 'coinsMul', 0.06, r));
  addTalent(2, 'Золотая лихорадка', 'Опыт +35%.', 1, 'passive', (mods, r) => addMul(mods, 'xpMul', 0.35, r));
  addTalent(2, 'Скидка на снаряды', 'Стоимость покупки -6% за ранг.', 5, 'passive', (mods, r) => addMul(mods, 'buyCostMul', -0.06, r));
  addTalent(2, 'Программа лояльности', 'Награда монетами +8% за ранг.', 5, 'passive', (mods, r) => addMul(mods, 'coinsMul', 0.08, r));
  addTalent(2, 'Стимул обучения', 'Опыт +6% за ранг.', 5, 'passive', (mods, r) => addMul(mods, 'xpMul', 0.06, r));
  addTalent(2, 'Контракт века', 'Стоимость покупки -35%.', 1, 'passive', (mods, r) => addMul(mods, 'buyCostMul', -0.35, r));
  addTalent(2, 'Активка: Золотой час', 'На 6с увеличивает монеты и опыт.', 1, 'active', (mods) => {
    mods.activeBranches.add(2);
  });
}

function baseMods(){
  return {
    dmgMul: 1,
    rangeMul: 1,
    aoeMul: 1,
    fireRateMul: 1,
    doubleShotChance: 0,
    dotChance: 0,
    dotDpsMul: 1,
    orbitSpeedMul: 1,
    buyCostMul: 1,
    coinsMul: 1,
    xpMul: 1,
    activeCooldownMul: 1,
    activeBranches: new Set(),
  };
}

function computeModsFromApplied(applied, debugOverrides){
  initTalentDefs();
  const mods = baseMods();
  TALENT_DEFS.forEach((def, i) => {
    let rank = applied[i] || 0;
    if (debugOverrides && debugOverrides[i]) {
      if (debugOverrides[i] === 'off') return;
      if (debugOverrides[i] === 'on') rank = def.kind === 'active' ? 1 : def.maxRank;
    }
    if (rank <= 0) return;
    def.apply(mods, rank);
  });
  mods.doubleShotChance = clamp(mods.doubleShotChance, 0, 0.9);
  mods.dotChance = clamp(mods.dotChance, 0, 0.9);
  return mods;
}

function getMods(){
  const p = state.player;
  const overrides = DebugPanelEnabled && state.debug?.talentOverrides ? state.debug.talentOverrides : null;
  if (overrides) return computeModsFromApplied(p.talentsApplied, overrides);
  if (!p.mods || p.modsDirty){
    p.mods = computeModsFromApplied(p.talentsApplied);
    p.modsDirty = false;
  }
  return p.mods;
}

function pendingCost(){
  const p = state.player;
  return p.talentsPending.reduce((sum, r) => sum + r, 0);
}

function resetTalentSelections(){
  const p = state.player;
  p.talentsPending.fill(0);
  updateTalentUI();
}

function resetAllTalents(){
  const p = state.player;
  let refund = 0;
  TALENT_DEFS.forEach((def, i) => {
    const applied = p.talentsApplied[i] || 0;
    refund += applied;
    p.talentsApplied[i] = 0;
  });
  p.talentsPending.fill(0);
  p.talentPoints += refund;
  p.modsDirty = true;
  saveProgress();
  updateTalentUI();
}

function doApplyTalentSelections(){
  const p = state.player;
  const cost = pendingCost();
  if (cost <= 0 || cost > p.talentPoints) return;
  TALENT_DEFS.forEach((def, i) => {
    const pending = p.talentsPending[i] || 0;
    if (!pending) return;
    const next = Math.min(def.maxRank, (p.talentsApplied[i] || 0) + pending);
    p.talentsApplied[i] = next;
  });
  p.talentPoints -= cost;
  p.talentsPending.fill(0);
  p.modsDirty = true;
  if (window.Game && window.Game.Funnel) window.Game.Funnel.trackStep('first_upgrade', { cost: cost });
  saveProgress();
  updateTalentUI();
}

const APPLY_VFX_FLASH_MS = 120;
const APPLY_VFX_FLOW_MS = 380;
const APPLY_VFX_TOTAL_MS = 520;
let applyTalentBusy = false;

function applyTalentSelections(){
  const p = state.player;
  const cost = pendingCost();
  if (cost <= 0 || cost > p.talentPoints) return;
  if (applyTalentBusy) return;
  applyTalentBusy = true;
  const applyBtn = document.querySelector('#talentApply');
  if (applyBtn) applyBtn.disabled = true;

  playSfx('applyTalents');
  const overlay = document.getElementById('talentOverlay');
  const modal = overlay?.querySelector('.modal');
  if (modal) modal.classList.add('talentApplyFlash');
  overlay?.querySelectorAll('.talentNode').forEach(btn => {
    const i = Number(btn.dataset.talent);
    if ((p.talentsPending[i] || 0) > 0) btn.classList.add('talentEnergyFlow');
  });

  setTimeout(() => {
    if (modal) modal.classList.remove('talentApplyFlash');
    overlay?.querySelectorAll('.talentNode').forEach(btn => btn.classList.remove('talentEnergyFlow'));
    doApplyTalentSelections();
    applyTalentBusy = false;
    if (applyBtn) applyBtn.disabled = pendingCost() <= 0 || pendingCost() > state.player.talentPoints;
  }, APPLY_VFX_TOTAL_MS);
}

function canSelectTalent(i){
  const p = state.player;
  const def = TALENT_DEFS[i];
  if (!def) return false;
  if (p.talentPoints <= pendingCost()) return false;
  if (def.kind === 'active' && p.level < 40) return false;
  const appliedRank = p.talentsApplied[i] || 0;
  const pendingRank = p.talentsPending[i] || 0;
  if (appliedRank + pendingRank >= def.maxRank) return false;
  
  // Row gating: need row * 5 points spent in this branch
  const branchIndices = TALENT_DEFS.map((d, idx) => d.branch === def.branch ? idx : -1).filter(x => x >= 0);
  const pointsInBranch = branchIndices.reduce((sum, idx) => sum + (p.talentsApplied[idx] || 0) + (p.talentsPending[idx] || 0), 0);
  const requiredPoints = def.row * TALENT_ROW_POINTS;
  if (pointsInBranch < requiredPoints) return false;
  
  // Parent gating: need at least one parent with rank > 0 (OR logic), skip for row 0
  if (def.row > 0 && def.parents && def.parents.length > 0) {
    // Convert relative parents (within branch) to absolute indices
    const branchOffset = branchIndices[0];
    const hasParent = def.parents.some(relIdx => {
      const absIdx = branchOffset + relIdx;
      return (p.talentsApplied[absIdx] || 0) + (p.talentsPending[absIdx] || 0) > 0;
    });
    if (!hasParent) return false;
  }
  
  return true;
}

function adjustTalentPending(i, delta){
  const p = state.player;
  if (!p) return;
  const def = TALENT_DEFS[i];
  if (!def) return;
  if (delta > 0){
    if (!canSelectTalent(i)) return;
    p.talentsPending[i] += 1;
  } else if (delta < 0){
    p.talentsPending[i] = Math.max(0, p.talentsPending[i] - 1);
  }
  state.ui.talentBranch = def.branch;
  updateTalentUI();
}

function activeTalentIndex(branch){
  for (let i = TALENT_DEFS.length - 1; i >= 0; i--){
    if (TALENT_DEFS[i].branch === branch) return i;
  }
  return -1;
}

function canUseActive(branch){
  const p = state.player;
  if (!p) return false;
  if (p.level < 40) return false;
  const activeIndex = activeTalentIndex(branch);
  if (activeIndex < 0) return false;
  if ((p.talentsApplied[activeIndex] || 0) < 1) return false;
  const now = nowSec();
  const cooldownUntil = p.activeCooldowns[branch] || 0;
  return now >= cooldownUntil;
}

function useActiveAbility(branch){
  const p = state.player;
  if (!canUseActive(branch)) return;
  const now = nowSec();
  const mods = getMods();
  const baseCooldown = 30;
  p.activeCooldowns[branch] = now + baseCooldown * mods.activeCooldownMul;
  playSfx('activeAbility');

  if (branch === 0){
    state.activeEffects.attackUntil = now + 6;
    burst(center.x, center.y, 60, 'rgba(255,120,90,.2)');
  } else if (branch === 1){
    state.activeEffects.speedUntil = now + 6;
    burst(center.x, center.y, 60, 'rgba(125,255,178,.22)');
  } else if (branch === 2){
    state.activeEffects.economyUntil = now + 6;
    burst(center.x, center.y, 60, 'rgba(255,215,125,.22)');
  }
  saveProgress();
}

const TALENT_OPEN_ANIM_MS = 180;
function openTalents(){
  state.ui.talentsOpen = true;
  ensureTalentUI();
  updateTalentUI();
  const overlay = document.getElementById('talentOverlay');
  if (!overlay) return;
  const modal = overlay.querySelector('.modal');
  overlay.classList.remove('hidden');
  a11yOpen(overlay, { initialFocus: overlay.querySelector('#talentApply'), onClose: closeTalents });
  if (modal){
    modal.style.transform = 'scale(0.92)';
    modal.style.opacity = '0';
    modal.offsetHeight;
    modal.style.transition = `transform ${TALENT_OPEN_ANIM_MS}ms ease-out, opacity ${TALENT_OPEN_ANIM_MS}ms ease-out`;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        modal.style.transform = 'scale(1)';
        modal.style.opacity = '1';
      });
    });
  }
}

function closeTalents(){
  state.ui.talentsOpen = false;
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
}

function ensureTalentState(){
  initTalentDefs();
  const p = state.player;
  if (!Array.isArray(p.talentsApplied) || p.talentsApplied.length !== TALENT_DEFS.length){
    p.talentsApplied = Array(TALENT_DEFS.length).fill(0);
  }
  if (!Array.isArray(p.talentsPending) || p.talentsPending.length !== TALENT_DEFS.length){
    p.talentsPending = Array(TALENT_DEFS.length).fill(0);
  }
  if (!Array.isArray(p.activeCooldowns) || p.activeCooldowns.length !== 3){
    p.activeCooldowns = [0, 0, 0];
  }
  p.modsDirty = true;
}

function saveProgress(){
  if (window.Game && window.Game.Storage) {
    window.Game.Storage.saveGame(state, meta);
    return;
  }
  try{
    const p = state.player;
    localStorage.setItem('progress', JSON.stringify({
      level: p.level,
      xp: p.xp,
      talentPoints: p.talentPoints,
      talentsApplied: p.talentsApplied,
      talentsPending: p.talentsPending,
      activeCooldowns: p.activeCooldowns,
      eventShown40: p.eventShown40,
      eventShown50: p.eventShown50,
      eventShown60: p.eventShown60,
      buyCounts: state.buyCounts,
      buyPrices: state.buyPrices,
      achievements: state.achievements,
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
  ensureAchievementsState();
  state.coins = saved.coins != null ? saved.coins : state.coins;
  state.kills = saved.kills != null ? saved.kills : state.kills;
  if (saved.player) Object.assign(state.player, saved.player);
  if (saved.buyCounts) state.buyCounts = saved.buyCounts;
  if (saved.buyPrices) state.buyPrices = saved.buyPrices;
  if (saved.maxTankLevelAchieved != null) state.maxTankLevelAchieved = saved.maxTankLevelAchieved;
  if (saved.boostUntil != null) state.boostUntil = saved.boostUntil;
  if (saved.activeEffects) state.activeEffects = { ...state.activeEffects, ...saved.activeEffects };
  if (saved.achievements && typeof saved.achievements === 'object') {
    const ach = ensureAchievementsState();
    ach.unlocked = saved.achievements.unlocked && typeof saved.achievements.unlocked === 'object'
      ? { ...saved.achievements.unlocked }
      : ach.unlocked;
    ach.totalPurchased = Number.isFinite(saved.achievements.totalPurchased)
      ? Math.max(0, Math.floor(saved.achievements.totalPurchased))
      : ach.totalPurchased;
    ach.popupQueue = [];
  }
  if (saved.fenceState && typeof saved.fenceState === 'object') {
    state.savedFenceState = {
      segmentsPerSide: Number.isFinite(saved.fenceState.segmentsPerSide) ? Math.max(1, Math.floor(saved.fenceState.segmentsPerSide)) : null,
      hpById: saved.fenceState.hpById && typeof saved.fenceState.hpById === 'object' ? { ...saved.fenceState.hpById } : {},
    };
  }
  if (saved.nextCrateAt != null) state.nextCrateAt = saved.nextCrateAt;
  for (let i = 0; i < saved.cells.length; i++) {
    const sc = saved.cells[i];
    const cell = state.cells[sc.i];
    if (!cell) continue;
    if (sc.orbitPhase !== undefined) cell.orbitPhase = sc.orbitPhase;
    if (sc.tank) {
      cell.tank = makeTank(sc.tank.level, !!sc.tank.onTrack);
      if (sc.tank.powerTier != null) cell.tank.powerTier = sc.tank.powerTier;
    } else cell.tank = null;
  }
  if (saved.crate && state.cells[saved.crate.cellIndex]) {
    const cell = state.cells[saved.crate.cellIndex];
    state.crate = {
      x: cell.x + cell.w / 2,
      y: cell.y + cell.h / 2,
      targetY: cell.y + cell.h / 2,
      size: BAL.crateSize,
      pulse: 0,
      rewardLevel: saved.crate.rewardLevel ?? 1,
      cellIndex: saved.crate.cellIndex,
      claiming: false,
    };
  } else state.crate = null;
  refreshTanksPowerTier();
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
  const { buyCounts, buyPrices, achievements, ...playerData } = data;
  Object.assign(state.player, playerData);
  refreshTanksPowerTier();
  if (state.player.level >= 60) state.endgameVisuals = true;
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
    ach.popupQueue = [];
  }
  return true;
}

const PROJECTILE_KINDS = CombatProfilesApi && CombatProfilesApi.PROJECTILE_KINDS ? CombatProfilesApi.PROJECTILE_KINDS : {
  ap: { kind:'ap', speed: 820, r: 4.0, color:'#ffd36b', glow:'rgba(255,211,107,.25)', trail:'rgba(255,211,107,.12)', aoeBase: 18, aoePerLevel: 2.4, aoeMin: 16, aoeMax: 40 },
  he: { kind:'he', speed: 740, r: 5.6, color:'#ff7a6b', glow:'rgba(255,122,107,.26)', trail:'rgba(255,122,107,.12)', aoeBase: 28, aoePerLevel: 3.2, aoeMin: 24, aoeMax: 58 },
  toxic: { kind:'toxic', speed: 700, r: 5.0, color:'#b8ff3b', glow:'rgba(184,255,59,.22)', trail:'rgba(184,255,59,.10)', aoeBase: 30, aoePerLevel: 3.4, aoeMin: 26, aoeMax: 64, poolLife: 3.6, poolDpsMul: 0.20 },
  tesla: { kind:'tesla', speed: 900, r: 4.6, color:'#8bd3ff', glow:'rgba(139,211,255,.25)', trail:'rgba(139,211,255,.10)', aoeBase: 26, aoePerLevel: 2.8, aoeMin: 26, aoeMax: 66, chainRange: 84, chainJumps: 3, chainMul: 0.45 },
};

function projectileProfile(level){
  if (CombatProfilesApi && CombatProfilesApi.projectileProfile) {
    return CombatProfilesApi.projectileProfile(level, (lvl, key) => TankSprites?.resolveVariant?.(lvl, key));
  }
  const bulletVariant = TankSprites?.resolveVariant?.(level, 'bulletVariant');
  if (bulletVariant && PROJECTILE_KINDS[bulletVariant]) return PROJECTILE_KINDS[bulletVariant];
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
  const fenceLimit = zombieFenceLimit(z);
  z.targetR = fenceLimit + (Math.random()*2-1)*Math.min(4, BAL.zombieTrackWidth * 0.2);
}

const MAX_ZOMBIE_LEVEL = 60;

function toSafeInt(value, fallback){
  if (ZombieSpawnApi && ZombieSpawnApi.toSafeInt) {
    return ZombieSpawnApi.toSafeInt(value, fallback);
  }
  if (!Number.isFinite(value)) return fallback;
  const n = Math.floor(value);
  return Number.isFinite(n) ? n : fallback;
}

function getZombieSpawnBalanceConfig(){
  if (ZombieSpawnApi && ZombieSpawnApi.getZombieSpawnBalanceConfig) {
    return ZombieSpawnApi.getZombieSpawnBalanceConfig(ZombieSprites ? ZombieSprites.spawnConfig : null, BAL);
  }
  const cfg = ZombieSprites && ZombieSprites.spawnConfig ? ZombieSprites.spawnConfig : null;
  const attackMult = getZombieAttackMultipliers();
  const targetAliveBase = Math.max(1, toSafeInt(cfg?.targetAlive, BAL.zombieCountTarget));
  const targetAlive = Math.max(1, Math.round(targetAliveBase * attackMult.targetAliveMult));
  const sideCount = Math.max(1, toSafeInt(cfg?.sideCount, BAL.zombieSideCount || 4));
  const defaultPerSide = Math.max(1, Math.round(targetAlive / sideCount));
  const basePerSideTarget = Math.max(1, toSafeInt(cfg?.perSideTarget, BAL.zombiePerSideTarget || defaultPerSide));
  const perSideTarget = Math.max(1, Math.round(basePerSideTarget * attackMult.targetAliveMult));
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

  const z = {
    id: crypto.randomUUID(),
    renderOrder: nextZombieRenderOrder(),
    type: t,
    level,
    theta,
    anchorTheta: theta,
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
    fenceHitTimerMs: 0,
    breached: false,
  };

  const fenceLimit = zombieFenceLimit(z);
  z.targetR = fenceLimit + (Math.random()*2-1)*Math.min(4, BAL.zombieTrackWidth * 0.2);
  if (!fromEdge) z.r = z.targetR;
  return z;
}

function ensureZombieCount(){
  const spawnCfg = getZombieSpawnBalanceConfig();
  const target = spawnCfg.targetAlive;
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
      const nextSlot = pickMissingSlotBySide(missingBySide, aliveBySide, spawnCfg);
      if (!Number.isFinite(nextSlot.slotIndex)) break;
      assignZombieSlot(z, nextSlot.slotIndex, slotCount);
      if (nextSlot.side != null) aliveBySide[nextSlot.side] = (aliveBySide[nextSlot.side] || 0) + 1;
    }
  }

  while (aliveCount < target){
    const nextSlot = pickMissingSlotBySide(missingBySide, aliveBySide, spawnCfg);
    const spawnIndex = Number.isFinite(nextSlot.slotIndex) ? nextSlot.slotIndex : aliveCount;
    state.zombies.push(makeZombie(true, spawnIndex, slotCount));
    if (nextSlot.side != null) aliveBySide[nextSlot.side] = (aliveBySide[nextSlot.side] || 0) + 1;
    aliveCount++;
  }
}

function zombiePos(z){
  return {
    x: center.x + Math.cos(z.theta) * z.r,
    y: center.y + Math.sin(z.theta) * z.r,
  };
}

function getWallDecors(){
  if (Array.isArray(state.wallDecors) && state.wallDecors.length) return state.wallDecors;
  if (!Array.isArray(state.decors) || !state.decors.length) return [];
  return state.decors.filter((d) => !!(d && d.isWall));
}

function wallCollisionPenalty(x, y, zR, walls){
  let penalty = 0;
  for (let i = 0; i < walls.length; i++) {
    const d = walls[i];
    const blockR = Number.isFinite(d?.blockR) ? d.blockR : 0;
    if (blockR <= 0) continue;
    const minDist = zR + blockR;
    const dx = x - d.x;
    const dy = y - d.y;
    const dist = Math.hypot(dx, dy);
    const overlap = minDist - dist;
    if (overlap > 0) penalty += overlap;
  }
  return penalty;
}

function resolveZombieWallMove(z, fromX, fromY, toX, toY, dt){
  const walls = getWallDecors();
  if (!walls.length) return { x: toX, y: toY };
  const zR = zombieCollisionRadius(z);
  if (!Number.isFinite(zR) || zR <= 0) return { x: toX, y: toY };

  const dx = toX - fromX;
  const dy = toY - fromY;
  const maxStep = Math.max(1.25, (zR * 0.55) + (Math.max(0.001, dt) * 40));
  const stepLen = Math.hypot(dx, dy);
  const stepMul = stepLen > maxStep ? (maxStep / Math.max(stepLen, 1e-6)) : 1;
  const targetX = fromX + dx * stepMul;
  const targetY = fromY + dy * stepMul;

  const fullPenalty = wallCollisionPenalty(targetX, targetY, zR, walls);
  if (fullPenalty <= 1e-4) return { x: targetX, y: targetY };

  const xOnlyX = targetX;
  const xOnlyY = fromY;
  const yOnlyX = fromX;
  const yOnlyY = targetY;

  const xPenalty = wallCollisionPenalty(xOnlyX, xOnlyY, zR, walls);
  const yPenalty = wallCollisionPenalty(yOnlyX, yOnlyY, zR, walls);

  let nx = fromX;
  let ny = fromY;
  if (xPenalty < yPenalty) {
    nx = xOnlyX;
    ny = xOnlyY;
    z.wallSteerSign = Number.isFinite(z.wallSteerSign) ? z.wallSteerSign : (dy >= 0 ? 1 : -1);
  } else {
    nx = yOnlyX;
    ny = yOnlyY;
    z.wallSteerSign = Number.isFinite(z.wallSteerSign) ? z.wallSteerSign : (dx >= 0 ? 1 : -1);
  }

  const remainPenalty = wallCollisionPenalty(nx, ny, zR, walls);
  if (remainPenalty > 1e-4) {
    const sign = z.wallSteerSign || 1;
    const tangentX = -dy;
    const tangentY = dx;
    const tangentLen = Math.hypot(tangentX, tangentY) || 1;
    const sideStep = Math.min(maxStep, Math.max(0.75, zR * 0.4));
    const tx = nx + (tangentX / tangentLen) * sideStep * sign;
    const ty = ny + (tangentY / tangentLen) * sideStep * sign;
    const sidePenalty = wallCollisionPenalty(tx, ty, zR, walls);
    if (sidePenalty < remainPenalty) {
      nx = tx;
      ny = ty;
    } else {
      z.wallSteerSign = -sign;
    }
  }

  return { x: nx, y: ny };
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

function getFenceSegmentMaxHp(){
  const cfg = getFenceConfig();
  return Number.isFinite(cfg.segmentMaxHp) ? Math.max(1, cfg.segmentMaxHp) : FENCE_DEFAULT_SEGMENT_HP;
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

function getFenceInnerLimit(z){
  const tankTrackOuter = BAL.tankOrbitRadius + BAL.tankTrackWidth * 0.5 + zombieCollisionRadius(z);
  const dx = Math.cos(z.theta ?? 0);
  const dy = Math.sin(z.theta ?? 0);
  const denom = Math.max(Math.abs(dx), Math.abs(dy)) || 1;
  return tankTrackOuter / denom;
}

function applyFenceSegmentDamage(seg, amount){
  if (!seg || seg.broken) return false;
  const dmg = Math.max(0, amount || 0);
  if (dmg <= 0) return false;
  seg.hp = clamp(seg.hp - dmg, 0, seg.maxHp);
  seg.broken = seg.hp <= 0;
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

function isBlockingModalOpen(){
  const ids = [
    'menuOverlay',
    'crateModal',
    'dismantleModal',
    'boostModal',
    'resetTalentsModal',
    'talentOverlay',
    'mergePopupModal',
    'achievementsModal',
    'achievementPopup',
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
  seg.hp = seg.maxHp;
  seg.broken = false;
  popText(px, py, t('fenceRepairDone'), '#7dffb2');
  return true;
}

function resolveFenceFrameScale(frame){
  return Number.isFinite(frame?.scale) ? frame.scale : 1;
}

function getFenceCollisionPadding(){
  const spriteKeys = resolveFenceSpriteKeys();
  if (!FenceSprites.ready || !spriteKeys) return 0;

  const entries = [
    { id: spriteKeys.cornerTL, kind: 'cornerTL' },
    { id: spriteKeys.cornerTR, kind: 'cornerTR' },
    { id: spriteKeys.cornerBR, kind: 'cornerBR' },
    { id: spriteKeys.cornerBL, kind: 'cornerBL' },
    { id: spriteKeys.sideTop, kind: 'sideTop' },
    { id: spriteKeys.sideRight, kind: 'sideRight' },
    { id: spriteKeys.sideBottom, kind: 'sideBottom' },
    { id: spriteKeys.sideLeft, kind: 'sideLeft' },
  ];

  let maxOutward = 0;
  for (const entry of entries){
    const frame = FenceSprites.pickFrame(entry.id);
    if (!frame) continue;

    const drawScale = (BAL.fenceWidth / Math.max(frame.w, frame.h)) * 1.2 * resolveFenceFrameScale(frame);
    const drawW = frame.w * drawScale;
    const drawH = frame.h * drawScale;
    const ax = frame.anchor?.x ?? 0.5;
    const ay = frame.anchor?.y ?? 0.5;

    if (entry.kind === 'sideTop') maxOutward = Math.max(maxOutward, drawH * ay);
    else if (entry.kind === 'sideBottom') maxOutward = Math.max(maxOutward, drawH * (1 - ay));
    else if (entry.kind === 'sideLeft') maxOutward = Math.max(maxOutward, drawW * ax);
    else if (entry.kind === 'sideRight') maxOutward = Math.max(maxOutward, drawW * (1 - ax));
    else if (entry.kind === 'cornerTL') maxOutward = Math.max(maxOutward, drawW * ax, drawH * ay);
    else if (entry.kind === 'cornerTR') maxOutward = Math.max(maxOutward, drawW * (1 - ax), drawH * ay);
    else if (entry.kind === 'cornerBR') maxOutward = Math.max(maxOutward, drawW * (1 - ax), drawH * (1 - ay));
    else if (entry.kind === 'cornerBL') maxOutward = Math.max(maxOutward, drawW * ax, drawH * (1 - ay));
  }

  return maxOutward;
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

  const seg = getFenceSegmentForTheta(z.theta);
  if (seg && seg.broken && !z.breached && z.r <= outerLimit + Math.max(2, BAL.fenceWidth * 0.15)) {
    z.breached = true;
  }
  if (z.breached) return getFenceInnerLimit(z);
  if (seg && seg.broken) return getFenceInnerLimit(z);
  return outerLimit;
}

function startZombieDying(z){
  if (z.state === 'dying') return;
  z.state = 'dying';
  z.deathDuration = 0.65;
  z.deathTimer = z.deathDuration;
  z.deathProgress = 0;
  z.hp = 0;

  // Select death animation using deterministic helper (70% personal, 30% common)
  const personalDeath = z.type?.death || null;
  const commonDeath = ZombieSprites.deathCommon || null;
  const pickDeathAnim = Game?.Combat?.pickDeathAnim || function(c, p, r) {
    // Inline fallback if Combat module not loaded
    if (p && c) return r < 0.7 ? p : c;
    return p || c || null;
  };
  z.deathAnim = pickDeathAnim(commonDeath, personalDeath, Math.random());
  
  z.deathFrame = 0; // current frame of death animation
  z.deathAnimSpeed = 10; // frames per second for death animation

  const corpseHelper = Game?.CorpseDespawn;
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
  if (corpseHelper && corpseHelper.computeCorpseDespawnTimer) {
    z.corpseTimer = corpseHelper.computeCorpseDespawnTimer({
      deathAnim: z.deathAnim,
      deathAnimSpeed: z.deathAnimSpeed,
      deathDuration: z.deathDuration,
    });
  } else {
    z.corpseTimer = (Number.isFinite(animDuration) ? animDuration : (z.deathDuration || 0)) + 5;
  }

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
  const p = zombiePos(z);
  burst(p.x, p.y, 18, 'rgba(125,255,178,.18)');
}

function stepZombies(dt){
  const slow = (state.empUntil && nowSec() < state.empUntil) ? 0.5 : 1;
  const attackMult = getZombieAttackMultipliers();
  const speedMul = attackMult.speedMult;
  const damageMul = attackMult.damageMult;
  for (const z of state.zombies){
    if (z.state === 'dying'){
      z.deathTimer -= dt;
      z.deathProgress = clamp(1 - z.deathTimer / (z.deathDuration || 0.65), 0, 1);
      if (Number.isFinite(z.corpseTimer)) z.corpseTimer -= dt;
      
      // Advance death animation frame (non-loop: clamp to last frame)
      if (z.deathAnim) {
        const maxFrame = (z.deathAnim.frames || 1) - 1;
        z.deathFrame = Math.min((z.deathFrame || 0) + dt * (z.deathAnimSpeed || 10), maxFrame);
      }
      
      z.anim += dt * 4.5;
      continue;
    }
    const prevTheta = z.theta;
    const prevX = center.x + Math.cos(prevTheta) * z.r;
    const prevY = center.y + Math.sin(prevTheta) * z.r;

    // Balance multiplier for zombie speed
    const typeId = z.type?.id || '';
    const balSpeedMul = getZombieBalanceMul(typeId, 'speedMul');

    // Zombies approach the fence side (no circular orbiting)
    // anchorTheta stays roughly fixed (the side they approach from)
    // Only sway left/right slightly when near the fence
    z.swayPhase += dt * z.swaySpeed * slow * speedMul * balSpeedMul;
    const swayOffset = Math.sin(z.swayPhase) * BAL.zombieSwayAmp;
    const desiredTheta = z.anchorTheta + swayOffset;

    // Move radially inward toward fence
    const t = 1 - Math.exp(-dt * (z.joinSpeed ?? BAL.edgeJoinSpeed) * speedMul * balSpeedMul);
    let desiredR = z.r + (z.targetR - z.r) * t;
    desiredR -= BAL.zombieFencePush * dt * speedMul * balSpeedMul;

    z.theta = desiredTheta;
    z.r = desiredR;

    const fenceLimit = zombieFenceLimit(z);
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

    const dTheta = Math.atan2(Math.sin(z.theta - prevTheta), Math.cos(z.theta - prevTheta));
    const moving = Math.abs(dTheta) > 0.0005;
    const targetHeading = moving ? clamp(dTheta * 4.2, -0.25, 0.25) : 0;
    z.heading = smoothAngle(z.heading ?? 0, targetHeading, dt * 6);

    // Animation speed based on radial approach + sway, not orbital speed
    const radialSpeed = Math.abs(desiredR - z.r) + Math.abs(swayOffset) * 2;
    const animMul = z.type?.animSpeed ?? 1.0;
    z.anim += dt * animMul * (1.4 + radialSpeed * 2.0) * slow * speedMul * balSpeedMul;

    const attackActive = isZombieAttackModeActive();
    const targetSegment = getFenceSegmentForTheta(z.theta);
    const fenceContactLimit = zombieFenceLimit(z);
    const nearFence = z.r <= fenceContactLimit + Math.max(2, BAL.fenceWidth * 0.08);
    if (
      attackActive
      && nearFence
      && targetSegment
      && !targetSegment.broken
    ) {
      z.fenceHitTimerMs = (z.fenceHitTimerMs || 0) + dt * 1000;
      const damagePerHit = getZombieAttackDamage(z) * damageMul;
      while (z.fenceHitTimerMs >= FENCE_HIT_INTERVAL_MS) {
        z.fenceHitTimerMs -= FENCE_HIT_INTERVAL_MS;
        if (!targetSegment.broken) applyFenceSegmentDamage(targetSegment, damagePerHit);
      }
    } else {
      z.fenceHitTimerMs = 0;
    }

    if (z.dotUntil){
      if (nowSec() < z.dotUntil){
        z.hp -= ((z.dotDps || 0) * dt) / damageMul;
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
    const hasSpriteConfig = TankSprites?.ready && TankSprites?.config?.body && (TankSprites?.config?.cannons?.length || 0) > 0;
    if (hasSpriteConfig){
      const bodyCfg = TankSprites.config.body;
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

          fireTankProjectile({sx: mx, sy: my, target: primaryTarget, targets, tank, stats: s, mods});
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
    fireTankProjectile({sx, sy, target: primaryTarget, targets, tank, stats: s, mods});
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
  p.effectIntensity = 1;
  p.shotId = 0;
  p.life = 0;
}

const projectilePool = (window.Game && window.Game.ObjectPool && window.Game.ObjectPool.create)
  ? window.Game.ObjectPool.create({ max: 600, reset: resetProjectile })
  : null;

function releaseProjectile(p){
  if (projectilePool) projectilePool.release(p);
}

function fireTankProjectile({sx, sy, target, targets, tank, stats, mods}){
  const powerTier = tank.powerTier ?? computePowerTier(state.player?.level ?? 1);
  const effectIntensity = 1 + powerTier * 0.25;
  const baseTargets = Array.isArray(targets) && targets.length ? targets : (target ? [target] : []);
  if (!baseTargets.length) return;
  const tp = zombiePos(baseTargets[0]);

  // Multi-barrel: N projectiles with damage split (T3)
  const Combat = window.Game && window.Game.Combat;
  const N = Combat && Combat.getProjectileCount ? Combat.getProjectileCount(tank.level) : (tank.level <= 5 ? 1 : tank.level <= 10 ? 2 : 3);
  const splitDmg = stats.dmg / N;
  const shotId = _nextShotId++;
  const targeting = window.Game && window.Game.Targeting;
  const burstTargets = targeting && targeting.pickBurstTargets ? targeting.pickBurstTargets(baseTargets, N) : pickBurstTargetsFallback(baseTargets, N);
  if (!burstTargets.length) return;

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
      for (let i = 0; i < N; i++) {
        const b = cannonBarrels[i];
        const bx = sx + Math.cos(heading) * (b.x || 0) - Math.sin(heading) * (b.y || 0);
        const by = sy + Math.sin(heading) * (b.x || 0) + Math.cos(heading) * (b.y || 0);
        const t = burstTargets[i % burstTargets.length];
        const tpos = zombiePos(t);
        spawnProjectile({
          fromX: bx, fromY: by,
          toZombieId: t.id, toX: tpos.x, toY: tpos.y,
          level: tank.level, dmg: splitDmg,
          aoe: stats.aoe, prof: stats.prof,
          effectIntensity, shotId,
        });
      }
    } else {
      // Default: spread perpendicular to heading
      const offsets = N === 1 ? [0] : N === 2 ? [-BARREL_SPREAD / 2, BARREL_SPREAD / 2] : [-BARREL_SPREAD, 0, BARREL_SPREAD];
      for (let i = 0; i < N; i++) {
        const t = burstTargets[i % burstTargets.length];
        const tpos = zombiePos(t);
        spawnProjectile({
          fromX: sx + perpX * offsets[i],
          fromY: sy + perpY * offsets[i],
          toZombieId: t.id, toX: tpos.x, toY: tpos.y,
          level: tank.level, dmg: splitDmg,
          aoe: stats.aoe, prof: stats.prof,
          effectIntensity, shotId,
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
  tank.cooldown = 1 / (stats.fr * speedMult());
  const burstCount = Math.min(MAX_BURST_PARTICLES, Math.round(5 * effectIntensity));
  const burstAlpha = Math.min(0.85, 0.55 * (0.9 + 0.1 * effectIntensity));
  burst(sx, sy, burstCount, `rgba(255,255,255,${burstAlpha})`);
  const shootClip = powerTier <= 1 ? 'shootNormal' : powerTier <= 3 ? 'shootHeavy' : 'shootHeavy2';
  playSfx(shootClip);
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
  b.effectIntensity = p.effectIntensity ?? 1;
  b.shotId = p.shotId ?? 0;
  b.life = 2.0;
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

    b.x += vx * b.speed * dt;
    b.y += vy * b.speed * dt;

    // trail particles (scaled by effectIntensity)
    const trailColor = b.level >= 12 ? 'rgba(186,140,255,.18)' : b.trail;
    const ei = b.effectIntensity ?? 1;
    const trailR = Math.min(4, Math.max(1.5, b.r * 0.55 * ei));
    const trailAlpha = Math.min(MAX_TRAIL_ALPHA, 0.25 * (0.9 + 0.1 * ei));
    const trailColorAdj = trailColor.replace(/,\s*[\d.]+\)\s*$/, `,${trailAlpha})`);
    particle(b.x - vx*8, b.y - vy*8, trailR, trailColorAdj, 0.25);

    if (dist < Math.max(10, b.r*2.2)){
      impactAt(b.x, b.y, b);
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

function impactAt(x,y,b){
  const mods = getMods();
  const attackMult = getZombieAttackMultipliers();
  const damageMul = attackMult.damageMult;
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
      const dmgRounded = Math.round(finalDmg);
      z.hp -= dmgRounded;
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
    chainLightning(x,y,b);
  }

  // Visual impact rings (scale by effectIntensity)
  const ei = b.effectIntensity ?? 1;
  const impactCount = Math.min(40, Math.round((b.kind === 'he' ? 30 : 22) * ei));
  state.impacts.push({x,y,r:0,maxR:b.aoe,life:0.30,max:0.30,kind:b.kind});
  burst(x, y, impactCount, b.glow);
  if (b.dmg > 80){
    state.impacts.push({x,y,r:0,maxR:b.aoe * 1.4,life:0.18,max:0.18,kind:'overflow'});
  }
}

function chainLightning(x,y,b){
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

    // visual bolt
    state.impacts.push({x:curX,y:curY,tx:p.x,ty:p.y,life:0.10,max:0.10,kind:'bolt'});

    const baseChainDmg = b.dmg * mul;
    const tankLevel = b.level ?? 1;
    const critChance = critChanceFromTankLevel(tankLevel);
    const isCrit = Math.random() < critChance;
    const finalChainDmg = (baseChainDmg * (isCrit ? 1.5 : 1)) / damageMul;
    const dmgRounded = Math.round(finalChainDmg);
    best.hp -= dmgRounded;
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
    x: d.x,
    y: d.y,
    r: d.r,
    life: d.life,
    max: d.life,
    dps: d.dps || 0,
    color: d.color || 'rgba(125,255,178,.14)',
  });
}

function stepDecals(dt){
  const next = [];
  for (const d of state.decals){
    d.life -= dt;
    if (d.life <= 0) continue;

    if (d.kind === 'pool' && d.dps > 0){
      // Apply DOT inside pool
      for (const z of state.zombies){
        const p = zombiePos(z);
        const dist = Math.hypot(p.x-d.x, p.y-d.y);
        if (dist <= d.r){
          z.hp -= d.dps * dt;
        }
      }
    }

    next.push(d);
  }
  state.decals = next;
}

// ---------- Crates ----------
function pickCrateRewardLevel(){
  const levels = state.cells.map(c => c.tank?.level).filter(Boolean);
  const maxLevel = Math.max(state.maxTankLevelAchieved || 1, levels.length ? Math.max(...levels) : 1);
  if (maxLevel <= 1) return 1;
  const minLevel = Math.max(1, maxLevel - 4);
  const maxReward = Math.max(1, maxLevel - 3);
  const upper = Math.max(minLevel, maxReward);
  return minLevel + Math.floor(Math.random() * (upper - minLevel + 1));
}

function pickEmptyCell(){
  const Garage = window.Game && window.Game.Garage;
  const empty = Garage
    ? state.cells.filter(c => Garage.isCellAvailableForTank(c, state))
    : state.cells.filter(c => !c.tank);
  if (!empty.length) return null;
  return empty[Math.floor(Math.random() * empty.length)];
}

function spawnCrate(){
  const cell = pickEmptyCell();
  if (!cell) return false;
  const targetX = cell.x + cell.w / 2;
  const targetY = cell.y + cell.h / 2;
  const size = BAL.crateSize;
  state.crate = {
    x: targetX,
    y: -size,
    targetY,
    size,
    pulse: 0,
    rewardLevel: pickCrateRewardLevel(),
    cellIndex: cell.i,
    claiming: false,
  };
  return true;
}

function maybeSpawnCrate(){
  const now = nowSec();
  if (!state.nextCrateAt) state.nextCrateAt = now + BAL.crateIntervalSec;
  if (!state.crate && now >= state.nextCrateAt){
    spawnCrate();
    state.nextCrateAt = now + BAL.crateIntervalSec;
  }
}

function stepCrate(dt){
  if (!state.crate) return;
  const c = state.crate;
  c.y = Math.min(c.targetY, c.y + BAL.crateDropSpeed * dt);
  c.pulse += dt * 4;
}

function crateHitTest(x,y){
  if (!state.crate) return false;
  const c = state.crate;
  const half = c.size * 0.5;
  return x >= c.x - half && x <= c.x + half && y >= c.y - half && y <= c.y + half;
}

// ---------- Kills / respawn ----------
function cleanupKills(){
  const corpseMax = BAL.corpseMaxCount;
  let dyingCount = 0;
  if (Number.isFinite(corpseMax)){
    for (const z of state.zombies){
      if (z.state !== 'dying') continue;
      const ttl = Number.isFinite(z.corpseTimer) ? z.corpseTimer : z.deathTimer;
      if (ttl > 0) dyingCount++;
    }
  }
  const limitCorpses = Number.isFinite(corpseMax) && dyingCount > corpseMax;
  let keptDying = 0;
  const alive = [];
  for (const z of state.zombies){
    if (z.state === 'dying'){
      const ttl = Number.isFinite(z.corpseTimer) ? z.corpseTimer : z.deathTimer;
      if (ttl > 0){
        if (!limitCorpses || keptDying < corpseMax){
          alive.push(z);
          keptDying++;
        }
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
  if (pauseManager && typeof pauseManager.setMenuOpen === 'function') {
    pauseManager.setMenuOpen(!!open);
  }
  if (UIModals && typeof UIModals.setMenuOpen === 'function') {
    UIModals.setMenuOpen({
      open,
      state,
      ui,
      a11yOpen,
      a11yClose,
      onClose: () => setMenuOpen(false),
      updateMenuState,
    });
    return;
  }
  state.ui.menuOpen = open;
  document.body.classList.toggle('menu-open', open);
  if (ui.menuOverlay){
    ui.menuOverlay.classList.toggle('hidden', !open);
    ui.menuOverlay.setAttribute('aria-hidden', (!open).toString());
    if (open) a11yOpen(ui.menuOverlay, { initialFocus: ui.menuContinue, onClose: () => setMenuOpen(false) });
    else a11yClose(ui.menuOverlay);
  }
  updateMenuState();
}

function updateMenuState(){
  if (ui.menuContinue){
    const hasSave = !!getSavedProgress();
    ui.menuContinue.disabled = !hasSave;
  }
  updateMenuVolumes();
}

function resetGameState(){
  const wasCollapsed = state.debug?.collapsed;
  if (state.projectiles && state.projectiles.length){
    for (const p of state.projectiles) releaseProjectile(p);
  }
  state = createInitialState();
  // Clear popup seen-levels on New Game (T5)
  if (window.Game && window.Game.MergePopup && window.Game.MergePopup.resetSeenLevels) {
    window.Game.MergePopup.resetSeenLevels();
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
  ensureTalentState();
  state.player.xpToNext = xpNeededForLevel(state.player.level);
  state.player.modsDirty = true;

  const debugPanelEl = document.getElementById('debugPanel');
  if (debugPanelEl && debugPanelEl.parentNode) {
    debugPanelEl.parentNode.removeChild(debugPanelEl);
  }
  const layoutEl = document.querySelector('.layout');
  if (layoutEl) layoutEl.classList.remove('debugLayout');

  resizeCanvas();
  state.nextCrateAt = nowSec() + BAL.crateIntervalSec;
  if (state.cells[0] && state.cells[1] && !state.cells.some(c=>c.tank)){
    state.cells[0].tank = makeTank(1, true);
    state.cells[1].tank = makeTank(1, true);
    recordTankLevel(1);
  }
  refreshTanksPowerTier();

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
  const level = buyTankLevel();
  const cost = buyTankCost(level);
  const fmt = window.Game && window.Game.NumberFormat ? window.Game.NumberFormat.formatCompactRu : (n)=>String(Math.round(n));
  ui.coins.textContent = fmt(state.coins);
  ui.zcount.textContent = state.kills;
  const buyLabel = ui.buy.querySelector('[data-i18n="buyTank"]');
  if (buyLabel) buyLabel.textContent = t('buyTank', {level});
  ui.buyCost.textContent = fmt(cost);

  const left = state.boostUntil - nowSec();
  ui.boostState.textContent = left > 0
    ? t('boostActive', {mult: BAL.boostMult, sec: Math.ceil(left)})
    : '—';

  const Garage = window.Game && window.Game.Garage;
  const hasFree = Garage ? Garage.hasFreeCell(state) : state.cells.some(c=>!c.tank);
  ui.buy.disabled = state.coins < cost || !hasFree;

  if (ui.buyBulk) {
    const mode = buyBulkMode();
    if (mode === 'none') {
      ui.buyBulk.classList.add('hidden');
      ui.buyBulk.disabled = true;
    } else {
      ui.buyBulk.classList.remove('hidden');
      const textKey = mode === 'buy2' ? 'buyBulk2' : (mode === 'buy5' ? 'buyBulk5' : 'buyBulkMax');
      ui.buyBulk.textContent = t(textKey);
      if (mode === 'buy2') {
        const sim2 = calculateAffordableBuyCount(2);
        ui.buyBulk.disabled = sim2.count < 2;
      } else if (mode === 'buy5') {
        const sim5 = calculateAffordableBuyCount(5);
        ui.buyBulk.disabled = sim5.count < 5;
      } else {
        const simMax = calculateAffordableBuyCount(Number.MAX_SAFE_INTEGER);
        ui.buyBulk.disabled = simMax.count < 1;
      }
    }
  }

  if (ui.achievementsModal && !ui.achievementsModal.classList.contains('hidden')) {
    renderAchievementsList();
  }
  updateProgressUI();
  updateTalentUI();
  updateStageAbilitySlots();
  updateDismantleButton();
  if (DebugPanelEnabled && state.debug?.refreshZombieCounts) state.debug.refreshZombieCounts();
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
      drawTankIconTo(cctx, 18, 14, cell.tank.level, false, 0.7);
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

function renderAchievementsList(){
  if (!ui.achievementsList) return;
  const defs = getAchievementDefinitions();
  const ach = ensureAchievementsState();
  ui.achievementsList.innerHTML = '';
  for (let i = 0; i < defs.length; i++) {
    const def = defs[i];
    const done = !!ach.unlocked[def.id];
    const row = document.createElement('div');
    row.className = `achievementRow ${done ? 'done' : ''}`;
    const progress = clamp(ach.totalPurchased || 0, 0, def.target);
    const status = done ? t('achievementStatusDone') : t('achievementStatusTodo');
    row.innerHTML = `
      <div class="achievementName">${t(def.titleKey)}</div>
      <div class="achievementMeta">${t('achievementProgress', { value: progress, target: def.target })}</div>
      <div class="achievementMeta">${status}</div>
      <div class="achievementMeta">${t('achievementReward', { reward: t(def.rewardKey) })}</div>
    `;
    ui.achievementsList.appendChild(row);
  }
}

function openAchievementsModal(){
  if (!ui.achievementsModal) return;
  renderAchievementsList();
  ui.achievementsModal.classList.remove('hidden');
  ui.achievementsModal.setAttribute('aria-hidden', 'false');
  a11yOpen(ui.achievementsModal, { initialFocus: ui.achievementsClose, onClose: closeAchievementsModal });
}

function closeAchievementsModal(){
  if (!ui.achievementsModal) return;
  ui.achievementsModal.classList.add('hidden');
  ui.achievementsModal.setAttribute('aria-hidden', 'true');
  a11yClose(ui.achievementsModal);
}

function closeAchievementPopup(){
  if (!ui.achievementPopup) return;
  ui.achievementPopup.classList.add('hidden');
  ui.achievementPopup.setAttribute('aria-hidden', 'true');
  a11yClose(ui.achievementPopup);
  maybeShowNextAchievementPopup();
}

function maybeShowNextAchievementPopup(){
  const ach = ensureAchievementsState();
  if (!ui.achievementPopup || !ach || !ach.popupQueue || !ach.popupQueue.length) return;
  if (!ui.achievementPopup.classList.contains('hidden')) return;
  const nextId = ach.popupQueue.shift();
  const def = getAchievementById(nextId);
  if (!def) return;
  if (ui.achievementPopupName) ui.achievementPopupName.textContent = t(def.titleKey);
  if (ui.achievementPopupReward) ui.achievementPopupReward.textContent = t('achievementReward', { reward: t(def.rewardKey) });
  ui.achievementPopup.classList.remove('hidden');
  ui.achievementPopup.setAttribute('aria-hidden', 'false');
  a11yOpen(ui.achievementPopup, { initialFocus: ui.achievementPopupClaim, onClose: closeAchievementPopup });
}

function ensureProgressUI(){
  const topbar = document.querySelector('.stageUiRight') || document.querySelector('.stageCanvas') || document.body;
  if (document.getElementById('xpWrap')) return;

  const wrap = document.createElement('div');
  wrap.id = 'xpWrap';
  wrap.className = 'xpPanel';

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
  const p = state.player;
  const lvlText = document.getElementById('lvlText');
  const xpText = document.getElementById('xpText');
  const xpBar  = document.getElementById('xpBar');
  if (!p || !lvlText || !xpText || !xpBar) return;

  const need = Math.max(1, p.xpToNext);
  const pct = clamp(p.xp / need, 0, 1) * 100;
  const fmt = window.Game && window.Game.NumberFormat ? window.Game.NumberFormat.formatCompactRu : (n)=>String(Math.round(n));
  lvlText.textContent = `${t('levelLabel')}: ${p.level}`;
  xpText.textContent = `${fmt(p.xp)}/${fmt(need)}`;
  xpBar.style.width = `${pct}%`;
}

function ensureTalentUI(){
  if (document.getElementById('talentOverlay')) return;
  initTalentDefs();

  const overlay = document.createElement('div');
  overlay.id = 'talentOverlay';
  overlay.className = 'overlay hidden';
  overlay.innerHTML = `
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
          <button id="talentApply" class="btn btnPrimary" type="button">${t('talentApply')}</button>
          <button id="talentResetAll" class="btn btnSecondary" type="button">${t('talentResetAll')}</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeTalents();
  });
  overlay.querySelector('.modalClose')?.addEventListener('click', () => closeTalents());
  overlay.querySelector('#talentResetAll')?.addEventListener('click', () => openResetTalentsModal());
  overlay.querySelector('#talentApply')?.addEventListener('click', () => applyTalentSelections());
  overlay.querySelectorAll('.talentAbilitySlot').forEach(btn => {
    btn.addEventListener('click', () => {
      const branch = Number(btn.dataset.branch);
      useActiveAbility(branch);
    });
  });

  const branches = overlay.querySelector('#talentBranches');
  TALENT_BRANCHES.forEach((branchName, branch) => {
    const column = document.createElement('div');
    column.className = 'talentBranch';
    column.dataset.branch = String(branch);
    
    // Calculate max rows for this branch
    const branchTalents = TALENT_DEFS.filter(d => d.branch === branch);
    const maxRow = Math.max(...branchTalents.map(d => d.row));
    
    column.innerHTML = `
      <div class="talentBranchHeader">
        <span class="talentBranchTitle">${branchName}</span>
        <span class="talentBranchPoints" id="branchPoints-${branch}">0</span>
      </div>
      <div class="talentTreeContainer">
        <svg class="talentTreeSvg" id="talentSvg-${branch}"></svg>
        <div class="talentTreeGrid" id="talentGrid-${branch}" style="--rows: ${maxRow + 1}"></div>
      </div>
      <button class="btn btnSecondary talentBranchReset" data-branch="${branch}" type="button">${t('talentReset')}</button>
    `;
    
    // Branch reset button (pending only for this branch)
    column.querySelector('.talentBranchReset')?.addEventListener('click', () => {
      resetBranchPending(branch);
    });

    const grid = column.querySelector('.talentTreeGrid');
    branchTalents.forEach((def, localIdx) => {
      const globalIdx = TALENT_DEFS.findIndex(d => d === def);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'talentNode';
      btn.dataset.talent = String(globalIdx);
      btn.dataset.row = String(def.row);
      btn.dataset.slot = String(def.slot);
      btn.style.setProperty('--row', def.row);
      btn.style.setProperty('--slot', def.slot);
      btn.innerHTML = `
        <span class="talentNodeIcon" aria-hidden="true">${def.icon ? `<img src="${def.icon}" alt="" loading="lazy">` : `<span class="talentNodeGlyph">${def.kind === 'active' ? '⚡' : '◆'}</span>`}</span>
        <span class="talentNodeRank" id="rank-${globalIdx}">0/${def.maxRank}</span>
      `;
      btn.title = `${def.name}\n${def.desc}`;
      btn.addEventListener('click', (event) => {
        adjustTalentPending(globalIdx, event.shiftKey ? -1 : 1);
      });
      btn.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        adjustTalentPending(globalIdx, -1);
      });
      grid.appendChild(btn);
    });
    branches.appendChild(column);
  });
  
  // Draw SVG edges on open/resize
  let resizeTimeout = null;
  const redrawEdges = () => {
    TALENT_BRANCHES.forEach((_, branch) => drawTalentEdges(branch));
  };
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(redrawEdges, 100);
  });
}

function resetBranchPending(branch){
  const p = state.player;
  TALENT_DEFS.forEach((def, i) => {
    if (def.branch === branch) p.talentsPending[i] = 0;
  });
  updateTalentUI();
}

function drawTalentEdges(branch){
  const svg = document.getElementById(`talentSvg-${branch}`);
  const grid = document.getElementById(`talentGrid-${branch}`);
  if (!svg || !grid) return;
  
  svg.innerHTML = '';
  const gridRect = grid.getBoundingClientRect();
  svg.setAttribute('width', gridRect.width);
  svg.setAttribute('height', gridRect.height);
  svg.setAttribute('viewBox', `0 0 ${gridRect.width} ${gridRect.height}`);
  
  const branchTalents = TALENT_DEFS.filter(d => d.branch === branch);
  const branchOffset = TALENT_DEFS.findIndex(d => d.branch === branch);
  const p = state.player;
  
  branchTalents.forEach((def, localIdx) => {
    if (!def.parents || def.parents.length === 0) return;
    const toBtn = grid.querySelector(`[data-talent="${branchOffset + localIdx}"]`);
    if (!toBtn) return;
    const toRect = toBtn.getBoundingClientRect();
    const toX = toRect.left + toRect.width / 2 - gridRect.left;
    const toY = toRect.top - gridRect.top;
    
    def.parents.forEach(parentLocalIdx => {
      const fromBtn = grid.querySelector(`[data-talent="${branchOffset + parentLocalIdx}"]`);
      if (!fromBtn) return;
      const fromRect = fromBtn.getBoundingClientRect();
      const fromX = fromRect.left + fromRect.width / 2 - gridRect.left;
      const fromY = fromRect.bottom - gridRect.top;
      
      // Determine edge state
      const parentAbsIdx = branchOffset + parentLocalIdx;
      const childAbsIdx = branchOffset + localIdx;
      const parentActive = (p.talentsApplied[parentAbsIdx] || 0) + (p.talentsPending[parentAbsIdx] || 0) > 0;
      const childActive = (p.talentsApplied[childAbsIdx] || 0) + (p.talentsPending[childAbsIdx] || 0) > 0;
      
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
}

function updateTalentUI(){
  if (!state.ui.talentsOpen) return;
  const p = state.player;
  const overlay = document.getElementById('talentOverlay');
  if (!p || !overlay) return;

  const cost = pendingCost();
  const summary = overlay.querySelector('#talentSummary');
  if (summary){
    const note = cost > p.talentPoints ? ` • ${t('talentNeedPoints')}` : '';
    summary.textContent = `${t('talentPoints')}: ${p.talentPoints} • ${t('talentPending')}: ${cost}${note}`;
  }

  // Update talent nodes
  overlay.querySelectorAll('.talentNode').forEach(btn => {
    const i = Number(btn.dataset.talent);
    const def = TALENT_DEFS[i];
    const applied = p.talentsApplied[i] || 0;
    const pending = p.talentsPending[i] || 0;
    const rankText = `${applied + pending}/${def.maxRank}`;
    const rankEl = btn.querySelector('.talentNodeRank');
    if (rankEl) rankEl.textContent = rankText;

    const canSelect = canSelectTalent(i);
    const isMaxed = applied + pending >= def.maxRank;
    const isLocked = !canSelect && pending === 0 && applied === 0;
    
    btn.classList.toggle('applied', applied > 0);
    btn.classList.toggle('pending', pending > 0);
    btn.classList.toggle('maxed', isMaxed && applied > 0);
    btn.classList.toggle('locked', isLocked);
    btn.disabled = !canSelect && pending === 0;
    btn.title = `${def.name}\n${def.desc}`;
  });

  // Update branch points
  TALENT_BRANCHES.forEach((_, branch) => {
    const el = overlay.querySelector(`#branchPoints-${branch}`);
    if (!el) return;
    const applied = TALENT_DEFS.reduce((sum, def, i) => {
      if (def.branch !== branch) return sum;
      return sum + (p.talentsApplied[i] || 0);
    }, 0);
    const pending = TALENT_DEFS.reduce((sum, def, i) => {
      if (def.branch !== branch) return sum;
      return sum + (p.talentsPending[i] || 0);
    }, 0);
    el.textContent = pending > 0 ? `${applied}+${pending}` : `${applied}`;
    
    // Update branch reset button
    const resetBtn = overlay.querySelector(`.talentBranchReset[data-branch="${branch}"]`);
    if (resetBtn) resetBtn.disabled = pending <= 0;
  });

  // Redraw SVG edges
  TALENT_BRANCHES.forEach((_, branch) => drawTalentEdges(branch));

  const applyBtn = overlay.querySelector('#talentApply');
  if (applyBtn){
    applyBtn.disabled = cost <= 0 || cost > p.talentPoints;
  }
  const resetAllBtn = overlay.querySelector('#talentResetAll');
  if (resetAllBtn) resetAllBtn.disabled = !p.talentsApplied.some((r, i) => (r || 0) > 0);

  overlay.querySelectorAll('.talentAbilitySlot').forEach(btn => {
    const branch = Number(btn.dataset.branch);
    const unlocked = (p.level >= 40) && (p.talentsApplied[activeTalentIndex(branch)] || 0) >= 1;
    const canUse = canUseActive(branch);
    const cdUntil = p.activeCooldowns[branch] || 0;
    const cdLeft = Math.max(0, cdUntil - nowSec());
    btn.classList.toggle('talentAbilityLocked', !unlocked);
    btn.classList.toggle('talentAbilityUnlocked', unlocked);
    btn.disabled = !unlocked || !canUse;
    btn.title = unlocked
      ? (canUse ? TALENT_BRANCHES[branch] : t('talentActiveCooldown', {sec: Math.ceil(cdLeft)}))
      : TALENT_BRANCHES[branch];
    btn.textContent = unlocked && canUse ? '' : (cdLeft > 0 ? Math.ceil(cdLeft) : '');
  });
}

function updateStageAbilitySlots(){
  const p = state.player;
  const container = document.getElementById('stageAbilitySlots');
  if (!p || !container) return;
  container.querySelectorAll('.talentAbilitySlot').forEach(btn => {
    const branch = Number(btn.dataset.branch);
    const unlocked = (p.level >= 40) && (p.talentsApplied[activeTalentIndex(branch)] || 0) >= 1;
    const canUse = canUseActive(branch);
    const cdUntil = p.activeCooldowns[branch] || 0;
    const cdLeft = Math.max(0, cdUntil - nowSec());
    btn.classList.toggle('talentAbilityLocked', !unlocked);
    btn.classList.toggle('talentAbilityUnlocked', unlocked);
    btn.disabled = !unlocked || !canUse;
    btn.title = unlocked
      ? (canUse ? TALENT_BRANCHES[branch] : t('talentActiveCooldown', {sec: Math.ceil(cdLeft)}))
      : TALENT_BRANCHES[branch];
    btn.textContent = unlocked && canUse ? '' : (cdLeft > 0 ? Math.ceil(cdLeft) : '');
  });
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

function openBoostModal(){
  if (UIModals && typeof UIModals.openBoostModal === 'function') {
    UIModals.openBoostModal({ t, a11yOpen, onClose: closeBoostModal });
    return;
  }
  const modal = document.getElementById('boostModal');
  if (!modal) return;
  const textEl = document.getElementById('boostModalText');
  const watchEl = document.getElementById('boostModalWatch');
  if (textEl) textEl.textContent = t('boostModalText');
  if (watchEl) watchEl.textContent = t('boostModalWatch');
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  a11yOpen(modal, { initialFocus: watchEl, onClose: closeBoostModal });
}
function closeBoostModal(){
  if (UIModals && typeof UIModals.closeBoostModal === 'function') {
    UIModals.closeBoostModal({ a11yClose });
    return;
  }
  const modal = document.getElementById('boostModal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  a11yClose(modal);
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
  let cell = null;
  if (Number.isFinite(preferredIndex) && Garage && Garage.isCellAvailableForTank(state.cells[preferredIndex], state))
    cell = state.cells[preferredIndex];
  if (!cell && Garage) {
    const idx = Garage.findFreeCell(state);
    if (idx != null) cell = state.cells[idx];
  }
  if (!cell) cell = pickEmptyCell();
  if (!cell || (Garage && !Garage.isCellAvailableForTank(cell, state))) return false;
  cell.tank = makeTank(level, false);
  recordTankLevel(level);
  return true;
}

function claimCrateReward(){
  if (!state.crate || state.crate.claiming) return;
  state.crate.claiming = true;
  if (ui.crateGet){
    ui.crateGet.disabled = true;
    ui.crateGet.textContent = t('crateAdLoading');
  }
  const rewardLevel = state.crate.rewardLevel ?? 1;
  const crateCellIndex = state.crate.cellIndex;
  window.setTimeout(() => {
    grantCrateTank(rewardLevel, crateCellIndex);
    state.crate = null;
    closeCrateModal();
  }, 1200);
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
  if (isLevelModalOpen()) return;
  const p = getPointerPos(e);
  if (window.Game && window.Game.OfflineModal && window.Game.OfflineModal.handleInput(p)) return;
  if (crateHitTest(p.x, p.y)){
    openCrateModal();
    return;
  }
  const trackCell = tankOnTrackAt(p.x, p.y, nowSec());
  if (trackCell !== null){
    const trackTank = state.cells[trackCell].tank;
    trackTank.onTrack = false;
    trackTank.cooldown = 0;
    popText(p.x, p.y, t('popHangar'), '#eaf1ff');
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
  if (c.tank.onTrack){
    c.tank.onTrack = false;
    c.tank.cooldown = 0;
    popText(p.x, p.y, t('popHangar'), '#eaf1ff');
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
  if (isLevelModalOpen()) {
    state.dragging = null;
    return;
  }
  if (!state.dragging) return;
  const p = getPointerPos(e);
  state.dragging.x = p.x;
  state.dragging.y = p.y;
  const dx = p.x - state.dragging.startX;
  const dy = p.y - state.dragging.startY;
  if (Math.hypot(dx, dy) > 6) state.dragging.moved = true;
});

canvas.addEventListener('pointerup', (e)=>{
  if (isLevelModalOpen()) {
    state.dragging = null;
    return;
  }
  if (!state.dragging) return;
  const p = getPointerPos(e);
  const target = cellAt(p.x, p.y);

  const from = state.cells[state.dragging.cellIndex];
  from.tank = state.dragging.tank;

  if (!state.dragging.moved){
    from.tank.onTrack = true;
    const mods = getMods();
    const activeSpeed = nowSec() < state.activeEffects.speedUntil ? 1.35 : 1;
    from.orbitPhase = nowSec() * BAL.tankOrbitSpeed * speedMult() * mods.orbitSpeedMul * activeSpeed;
    popText(from.x+from.w/2, from.y+from.h/2, t('popTrack'), '#bfe3ff');
    state.selectedHangarCellIndex = from.i;
  } else if (target){
    const targetHasBox = state.crate && state.crate.cellIndex === target.i;
    if (targetHasBox){
      popText(target.x + target.w/2, target.y + target.h/2, t('dropOnCrateReject'), '#ffaa44');
    } else {
      const merged = mergeCells(from.i, target.i);
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

ui.buy.addEventListener('click', ()=> tryBuyTank());
ui.buyBulk?.addEventListener('click', ()=> tryBuyBulk());
ui.boost.addEventListener('click', () => openBoostModal());
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
document.getElementById('boostModalWatch')?.addEventListener('click', () => {
  state.boostUntil = nowSec() + BAL.boostDurationSec;
  closeBoostModal();
});
document.getElementById('boostModalClose')?.addEventListener('click', () => closeBoostModal());
document.getElementById('boostModal')?.addEventListener('click', (e) => {
  if (e.target?.dataset?.boostClose === 'true') closeBoostModal();
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
    onChange: ({ paused, reasons }) => {
      setSimulationPaused(paused, reasons);
      if (reasons && reasons.tabInactive && !(state && state.ui && state.ui.menuOpen)) {
        setMenuOpen(true);
      }
    },
  });
  pauseManager.attach();
  pauseManager.setMenuOpen(!!(state && state.ui && state.ui.menuOpen));
}

// ---------- Render ----------
function draw(){
  ctx.clearRect(0,0,viewSize.w,viewSize.h);

  drawBackground();
  drawTrack();
  drawTankTrack();
  drawZombieFence();
  drawBoard();
  drawOrbitingTanks();
  drawCrate();
  drawDecals();
  drawDecorZombieLayer();
  drawProjectiles();
  drawImpacts();
  drawParticles();
  drawDamageNumbers();
  drawWeather();
  drawAttackModeEveningDim();
  drawLevelUpVfx();

  // If sprites failed to load, show a small hint on canvas
  if (!ZombieSprites.ready){
    drawHint(t('hintSpritesOff'));
  }

  if (window.Game && window.Game.OfflineModal && window.Game.OfflineModal.isVisible()){
    window.Game.OfflineModal.render(ctx, viewSize);
  }

  // Debug-only zombie animation preview
  if (window.Game && window.Game.ZombieAnimPreview && window.Game.ZombieAnimPreview.isActive()){
    const previewDt = Math.min(0.033, 1/60);
    window.Game.ZombieAnimPreview.renderPreview(ctx, viewSize.w, viewSize.h, previewDt);
  }
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

function drawDecors(){
  if (!state.decors || !state.decors.length) return;
  for (let i = 0; i < state.decors.length; i++) drawDecorSpriteAt(state.decors[i]);
}

function drawTrack(){
  // Zombie track visuals intentionally disabled.
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

function drawZombieFence(){
  const halfSide = BAL.fenceRadius;
  const spriteKeys = resolveFenceSpriteKeys();
  const useSprites = FenceSprites.ready && !!spriteKeys;
  const segmentsPerSide = getFenceSegmentsPerSide();
  const maxHp = getFenceSegmentMaxHp();
  const hpBar = getFenceHealthBarConfig();

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
        spriteHash,
        cornerInsetPxOverride: FenceSprites.cornerInsetPx,
        byId,
        sideMath: null,
      };
      state.savedFenceState = null;
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

      if (seg.hp < seg.maxHp) {
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

function resolveFenceSpriteKeys(){
  const required = ['cornerTL', 'cornerTR', 'cornerBR', 'cornerBL', 'sideTop', 'sideRight', 'sideBottom', 'sideLeft'];
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
        ctx.fillStyle = 'rgba(0,0,0,.4)';
        ctx.strokeStyle = isTankSelectedForDismantle(c.tank.id) ? 'rgba(110,168,255,.9)' : 'rgba(255,255,255,.5)';
        ctx.lineWidth = 1.5;
        rr(ctx, r.x, r.y, r.w, r.h, 3);
        ctx.fill();
        ctx.stroke();
        if (isTankSelectedForDismantle(c.tank.id)){
          ctx.strokeStyle = '#eaf1ff';
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
  ctx.save();
  ctx.fillStyle = cell.tank.onTrack ? 'rgba(10,12,16,.38)' : 'rgba(0,0,0,.30)';
  rr(ctx, cx-18, cy-12, 36, 26, 8);
  ctx.fill();
  drawTankIcon(cx, cy, cell.tank.level, cell.tank.onTrack);
  ctx.restore();
}

function drawOrbitingTanks(){
  const t = nowSec();
  for (const c of state.cells){
    if (!c.tank || !c.tank.onTrack) continue;
    if (state.dragging && state.dragging.cellIndex === c.i) continue;
    const pos = tankOrbitState(c, t);
    drawTank(pos.x, pos.y, c.tank, false, pos.heading, false);
  }
}

function drawTankIcon(x,y,level,mutedSlot=false){
  drawTankIconTo(ctx, x, y, level, mutedSlot);
}

function drawTankIconTo(targetCtx, x, y, level, mutedSlot=false, scaleMul=1){
  const body = TankSprites?.pickBody?.(level);
  const cannon = TankSprites?.pickCannon?.(level);
  if (body && cannon){
    const bodyW = body.cfg.frame?.w ?? body.img.width;
    const bodyH = body.cfg.frame?.h ?? body.img.height;
    const bodyFrameX = body.cfg.frame?.x ?? 0;
    const bodyFrameY = body.cfg.frame?.y ?? 0;
    const maxW = 51 * balScale * scaleMul;
    const maxH = 39 * balScale * scaleMul;
    const scale = Math.min(maxW / bodyW, maxH / bodyH);
    targetCtx.save();
    targetCtx.translate(x, y);
    targetCtx.globalAlpha = mutedSlot ? 0.6 : 0.92;
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
    if (level != null) {
      targetCtx.fillStyle = '#eaf1ff';
      targetCtx.font = '10px system-ui, -apple-system, Segoe UI, Roboto, Arial';
      targetCtx.textAlign = 'center';
      targetCtx.textBaseline = 'top';
      targetCtx.fillText(`${t('levelShort')}${level}`, 0, drawH * 0.5 + 4);
    }
    targetCtx.restore();
    return;
  }

  const tier = Math.floor((level-1)/3);
  const hull = ['#b83232','#c63a3a','#d14646','#e05a5a','#f07171'][clamp(tier,0,4)];
  targetCtx.save();
  targetCtx.translate(x, y);
  targetCtx.scale(0.52 * balScale * scaleMul, 0.52 * balScale * scaleMul);
  targetCtx.globalAlpha = mutedSlot ? 0.65 : 0.95;
  targetCtx.fillStyle = 'rgba(0,0,0,.35)';
  rr(targetCtx, -22, -8, 44, 10, 5);
  targetCtx.fill();
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
  if (level != null) {
    targetCtx.fillStyle = '#eaf1ff';
    targetCtx.font = '10px system-ui, -apple-system, Segoe UI, Roboto, Arial';
    targetCtx.textAlign = 'center';
    targetCtx.textBaseline = 'top';
    targetCtx.fillText(`${t('levelShort')}${level}`, 0, 10);
  }
  targetCtx.restore();
}

// Aura: per-level auraVariant. If string — спрайт из auras; если number 1–6 — процедурная полоса; если null/false — нет ауры.
function computeAuraBand(level){
  const v = TankSprites?.resolveVariant?.(level, 'auraVariant');
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

function drawTank(x,y,tank,ghost=false,rotation=0,showLevelLabel=true,isDragPreview=false){
  const level = typeof tank === 'number' ? tank : tank?.level ?? 1;
  if (!isDragPreview){
    const auraSprite = TankSprites?.pickAura?.(level);
    if (auraSprite) {
      drawTankAuraSprite(x, y, auraSprite);
    } else {
      const auraBand = computeAuraBand(level);
      if (auraBand != null) drawTankAura(x, y, auraBand);
    }
  }
  // Try sprite-based tanks if assets/tanks.json exists
  const body = TankSprites?.pickBody?.(level);
  const cannon = TankSprites?.pickCannon?.(level);
  if (body && cannon){
    ctx.save();
    ctx.translate(x,y);
    ctx.rotate(rotation + (BAL.tankSpriteRotOffset ?? 0));
    ctx.globalAlpha = ghost ? 0.78 : 1;
    if (muted){
      ctx.filter = 'grayscale(1) brightness(0.75)';
      ctx.globalAlpha *= 0.6;
    }

    const configScale = TankSprites?.config?.tankScale ?? 1;
    const baseScale = (compact ? 0.065 : 0.085) * balScale * (BAL.tankSpriteScaleMul ?? 1) * configScale;            // tuned for typical PNG sizes
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
  const baseScale = (compact ? 0.56 : 0.72) * balScale * configScale;
  const levelScale = 1.0 + Math.min(0.20, level*0.010);
  const scale = baseScale * levelScale;

  ctx.save();
  ctx.translate(x,y);
  ctx.rotate(rotation + (BAL.tankSpriteRotOffset ?? 0));
  ctx.scale(scale, scale);
  ctx.globalAlpha = ghost ? 0.78 : 1;
  if (muted){
    ctx.globalAlpha *= 0.6;
  }

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

function drawZombies(){
  for (const z of state.zombies){
    const p = zombiePos(z);
    drawZombieEntity(z, p.x, p.y);
  }
}

function drawZombieEntity(z, x, y){
  if (ZombieSprites.ready && ZombieSprites.atlasImg && z.type){
    drawZombieSprite(x, y, z);
  } else {
    drawZombieFallback(x, y, z);
  }
}

function drawZombieSprite(x,y,z){
  const img = ZombieSprites.atlasImg;
  const t = z.type;
  const f = t.frame;
  const a = t.anchor;
  const facing = x >= center.x ? -1 : 1;

  const isDying = z.state === 'dying';
  const hasDeathAnim = isDying && z.deathAnim;
  const hasAttackAnim = !isDying && isZombieAttackModeActive() && t.attack;
  
  // Determine which frame to draw
  let fx, fy, fw, fh;
  if (hasDeathAnim) {
    // Use death animation frame
    const da = z.deathAnim;
    const frameIndex = Math.floor(z.deathFrame || 0);
    fx = da.x + frameIndex * da.w;
    fy = da.y;
    fw = da.w;
    fh = da.h;
  } else if (hasAttackAnim) {
    const aa = t.attack;
    const frames = aa.frames || 1;
    const typeId = t.id || '';
    const balAtkSpd = getZombieBalanceMul(typeId, 'attackSpeedMul');
    const frameIndex = Math.floor(z.anim * balAtkSpd) % frames;
    fx = aa.x + frameIndex * aa.w;
    fy = aa.y;
    fw = aa.w;
    fh = aa.h;
  } else {
    // Use walk animation frame
    const frames = t.frames || 1;
    const frameIndex = Math.floor(z.anim) % frames;
    fx = f.x + frameIndex * f.w;
    fy = f.y;
    fw = f.w;
    fh = f.h;
  }

  const scale = (t.scale ?? 1.0) * BAL.zombieScaleMul * zombieLevelScale(z);
  const baseW = hasDeathAnim ? z.deathAnim.w : (hasAttackAnim ? t.attack.w : f.w);
  const baseH = hasDeathAnim ? z.deathAnim.h : (hasAttackAnim ? t.attack.h : f.h);
  const w = baseW * scale;
  const h = baseH * scale;

  const bob = hasDeathAnim ? 0 : Math.sin(z.anim) * BAL.zombieBobAmp;
  const groundOffset = BAL.zombieGroundOffset * zombieLevelScale(z);
  const face = z.heading ?? (z.theta + (z.omega >= 0 ? Math.PI/2 : -Math.PI/2));
  const rot = face + (t.rotation ?? 0);
  
  // Death effects: keep opacity to avoid transparent corpses
  const death = isDying ? (z.deathProgress ?? 0) : 0;
  const deathScale = hasDeathAnim ? 1 : (1 - death * 0.22);
  const deathTilt = hasDeathAnim ? 0 : (death * 1.1);
  const deathAlpha = 1;

  if (state.endgameVisuals && !isDying){
    ctx.save();
    ctx.translate(x, y + bob + groundOffset);
    ctx.globalAlpha = 0.2 + 0.08 * Math.sin(nowSec() * 3);
    ctx.fillStyle = 'rgba(200,80,80,.35)';
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.5, h * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,100,100,.25)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  if (!qualityLow && !isDying){
    // shadow (without rotation)
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.20)';
    ctx.beginPath();
    ctx.ellipse(
      x,
      y + BAL.zombieShadowY + groundOffset,
      BAL.zombieShadowW * scale,
      BAL.zombieShadowH * scale,
      0, 0, Math.PI * 2
    );
    ctx.fill();
    ctx.restore();
  }

  // body
  ctx.save();
  ctx.translate(x, y + bob + groundOffset);
  ctx.globalAlpha = deathAlpha;
  ctx.scale(facing * deathScale, deathScale);
  ctx.rotate(rot * facing + deathTilt * facing);
  ctx.drawImage(
    img,
    fx, fy, fw, fh,
    -w * a.x,
    -h * a.y,
    w, h
  );
  ctx.restore();

  if ((z.level ?? 1) > 1 && !isDying){
    const ring = clamp((z.level ?? 1) - 1, 1, 6);
    ctx.save();
    ctx.strokeStyle = `rgba(185,139,255,${0.08 + ring * 0.02})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y + bob + groundOffset, w * 0.36, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

}

function drawZombieFallback(x,y,z){
  const bob = Math.sin(z.anim || 0) * BAL.zombieBobAmp;
  const groundOffset = BAL.zombieGroundOffset * zombieLevelScale(z);
  const face = z.heading ?? (z.theta + (z.omega >= 0 ? Math.PI/2 : -Math.PI/2));
  const facing = x >= center.x ? -1 : 1;
  const s = BAL.zombieScaleMul * zombieLevelScale(z);
  const levelBoost = clamp((z.level ?? 1) - 1, 0, 6);
  const isDying = z.state === 'dying';
  const skinTone = state.endgameVisuals && !isDying ? shade('#c85050', levelBoost * 8) : shade('#3cbe78', levelBoost * 10);
  const death = isDying ? (z.deathProgress ?? 0) : 0;
  const deathScale = 1 - death * 0.22;
  const deathTilt = death * 1.1;

  if (state.endgameVisuals && z.state !== 'dying'){
    ctx.save();
    ctx.translate(x, y + bob + groundOffset);
    ctx.globalAlpha = 0.22 + 0.06 * Math.sin(nowSec() * 3);
    ctx.fillStyle = 'rgba(200,80,80,.3)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 14 * s, 8 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,100,100,.22)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  if (!qualityLow && !isDying){
    // shadow
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.20)';
    ctx.beginPath();
    ctx.ellipse(x, y + BAL.zombieShadowY + groundOffset, BAL.zombieShadowW*s, BAL.zombieShadowH*s, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(x, y + bob + groundOffset);
  ctx.globalAlpha = 1;
  ctx.rotate(face * facing + deathTilt * facing);
  ctx.scale(s * facing * deathScale, s * deathScale);

  // ragged head
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = skinTone;
  ctx.strokeStyle = 'rgba(255,255,255,.10)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-12, -6);
  ctx.quadraticCurveTo(-2, -20, 10, -14);
  ctx.quadraticCurveTo(20, -6, 12, 8);
  ctx.quadraticCurveTo(4, 20, -10, 14);
  ctx.quadraticCurveTo(-22, 8, -12, -6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // eyes
  ctx.fillStyle = 'rgba(0,0,0,.62)';
  ctx.fillRect(-5, -6, 2, 2);
  ctx.fillRect(3, -7, 2, 2);

  // mouth
  ctx.strokeStyle = 'rgba(0,0,0,.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-4, 2);
  ctx.lineTo(6, 3);
  ctx.stroke();

  ctx.restore();

}

function drawProjectiles(){
  if (!state.projectiles.length) return;

  if (!isFxLite()){
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of state.projectiles){
      ctx.fillStyle = b.glow;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  for (const b of state.projectiles){
    // core
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();

    // small shape hint by kind
    if (b.kind === 'ap'){
      ctx.fillStyle = 'rgba(255,255,255,.25)';
      ctx.fillRect(b.x - 1, b.y - 4, 2, 8);
    }
    if (b.kind === 'he'){
      ctx.strokeStyle = 'rgba(255,255,255,.22)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r + 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (b.kind === 'tesla'){
      ctx.strokeStyle = 'rgba(139,211,255,.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(b.x - 6, b.y);
      ctx.lineTo(b.x + 6, b.y);
      ctx.stroke();
    }
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

  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.scale(pulse, pulse);

  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.beginPath();
  ctx.ellipse(0, half + 6, half * 0.9, half * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();

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

// ---------- Main loop ----------
let last = performance.now();
let lastFrameTs = last;
let fpsAvg = 60;
let lastProgressSave = 0;
let qualityLow = false;
function loop(now){
  const mm = getMobileMode();
  const fpsCap = mm && mm.getFpsCap ? mm.getFpsCap() : 0;
  if (fpsCap > 0 && (now - lastFrameTs) < (1000 / fpsCap)){
    requestAnimationFrame(loop);
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
    T.gauge('playerLevel', state.player ? state.player.level : 1);
    T.gauge('fps', Math.round(fpsAvg));
    T.max('maxCoins', state.coins);
    T.max('maxPlayerLevel', state.player ? state.player.level : 1);
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
  const paused = pauseManager && typeof pauseManager.isPaused === 'function'
    ? pauseManager.isPaused()
    : !!(state && state.ui && state.ui.menuOpen);
  setSimulationPaused(paused, pauseManager && pauseManager.getReasons ? pauseManager.getReasons() : { menuOpen: !!state.ui.menuOpen, tabInactive: false });
  if (!paused){
    updateWorldEvents(effDt);
    ensureZombieCount();
    maybeSpawnCrate();
    stepZombies(effDt);
    stepTanks(effDt);
    stepProjectiles(effDt);
    stepDecals(effDt);
    stepCrate(effDt);
    cleanupKills();
    stepImpacts(effDt);
    stepParticles(effDt);
    stepDamageNumbers(effDt);
  }

  updateUI();
  draw();

  requestAnimationFrame(loop);
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
  if (DebugPanelApi && typeof DebugPanelApi.initDebugPanel === 'function') {
    DebugPanelApi.initDebugPanel({
      DebugPanelEnabled,
      state,
      document,
      nowSec,
      DEBUG_PARAM,
      MAX_TANK_LEVEL,
      BAL,
      BASE_BAL,
      center,
      makeTank,
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
      initTalentDefs,
      getTalentDefs: () => TALENT_DEFS,
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
  // Load balance config
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
      getI18n,
      applyTranslations,
      updateUI,
      ensureProgressUI,
      initTalentDefs,
      applySavedProgress,
      getSavedProgress,
      ensureTalentState,
      xpNeededForLevel,
      ui,
      meta,
      grantXP,
      saveProgress,
      clamp,
      settings,
      applyAudioSettings,
      updateMenuVolumes,
      saveSettings,
      openTalents,
      setMenuOpen,
      t,
      resetGameState,
      nowSec,
      BAL,
      resizeCanvas,
      restoreFullState,
      DebugPanelEnabled,
      initDebugPanel,
      makeTank,
      recordTankLevel,
      ZombieSprites,
      getZombieSpawnBalanceConfig,
      TankSprites,
      FenceSprites,
      DecorSprites,
      onDecorSpritesLoaded: initDecors,
      GroundSprites,
      ensureZombieCount,
      acceptLevelReward,
      loop,
    });
    rebuildGroundLayer();
    return;
  }
  throw new Error('Bootstrap module unavailable');
}

boot();

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
