// game.js.txt1
// Tank Merger: Zombie Orbit (v3)
// Fixes requested:
// 1) If zombies look like simple blobs -> sprites not loaded; show status in HUD.
// 2) Make projectiles visible.
// 3) Tanks differ visually by level.
// 4) Projectiles & hit effects differ by level.
// 5) Reduce cell size.
// 6) Reduce tank size.

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const ui = {
  coins: document.getElementById('coins'),
  zcount: document.getElementById('zcount'),
  buy: document.getElementById('buy'),
  buyCost: document.getElementById('buyCost'),
  boost: document.getElementById('boost'),
  boostState: document.getElementById('boostState'),
  talentsBtn: document.getElementById('talentsBtn'),
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
};

// Power tier from player level (0–5): thresholds 10,20,30,40,50,60
const POWER_TIER_THRESHOLDS = [10, 20, 30, 40, 50, 60];
function computePowerTier(playerLevel){
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
  // Board 4x4 (smaller cells)
  rows: 4,
  cols: 4,
  cellW: 39,
  cellH: 30,
  cellGap: 4,
  boardPad: 6,

  buyCostLv1: 50,

  // Tanks
  dmgBase: 7,
  dmgMultPerLevel: 1.48,
  fireRateBase: 0.85,
  fireRateAddPerLevel: 0.075,
  rangeBase: 315,
  rangePerLevel: 10,

  // Zombie ring
  zombieTrackRadius: 295,
  zombieTrackWidth: 18,
  fenceRadius: 0,
  fenceWidth: 20,
  fenceKeepout: 12,
  zombieFencePush: 24,
  tankOrbitRadius: 210,
  tankOrbitSpeed: 0.55,
  tankTrackWidth: 12,
  zombieCountTarget: 150,
  zombieHpBase: 88,
  zombieHpVar: 0.22,
  omegaBase: 0.72,
  omegaVar: 0.18,
  zombieSwayAmp: 0.14,

  // Zombie visuals (walk + size)
  zombieScaleMul: 0.72,
  zombieLevelScaleAdd: 0.08,
  zombieBobAmp: 1.2,
  zombieBobSpeedMul: 7.0,
  zombieShadowW: 11,
  zombieShadowH: 5,
  zombieShadowY: 8,
  zombieGroundOffset: 6,
  zombieHpExtraPerLevel: 0.12,
  zombieLevelOmegaMul: 0.08,

  // Spawn from edge
  edgeSpawnRadius: 520,
  edgeJoinSpeed: 0.9,

  // Economy
  coinsPerKillBase: 1,
  coinsPerKillLevelMul: 0.35,
  coinsPerShotBase: 1,
  coinsPerShotLevelMul: 0.55,
  levelGoldBase: 60,
  levelGoldPerLevel: 18,
  levelRewardAutoCloseSec: 4.5,

  // Boost
  boostDurationSec: 60,
  boostMult: 2,
  tankSpriteScaleMul: 2.2,            // tuned 2.0–3.5
  tankSpriteRotOffset: -Math.PI/2,    // sprite orientation correction

  // FX
  maxParticles: 1600,
  maxDecals: 120,
  tankTrackCenterOffset: 0.5,

  // Crates
  crateIntervalSec: 60,
  crateDropSpeed: 220,
  crateSize: 34,
};

const BASE_BAL = {
  cellW: 39,
  cellH: 30,
  cellGap: 4,
  boardPad: 6,
  zombieTrackRadius: 295,
  zombieTrackWidth: 18,
  fenceWidth: 20,
  fenceKeepout: 12,
  zombieFencePush: 24,
  tankOrbitRadius: 210,
  tankTrackWidth: 12,
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

const compact = true;
const muted = false;

const backgroundLayer = {
  canvas: null,
  ctx: null,
  ready: false,
};

const DEFAULT_SETTINGS = {
  sfxVolume: 0.75,
  musicVolume: 0.6,
};

let settings = { ...DEFAULT_SETTINGS };

function createInitialState(){
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
    ui: {
      talentsOpen: false,
      talentBranch: 0,
      levelReward: null,
      levelRewardTimer: 0,
      menuOpen: true,
    },
  };
}

let state = createInitialState();

// Debug panel: enabled only via URL param (?debug=1 or ?debug=true)
const DEBUG_PARAM = 'debug';
function isDebugPanelEnabled(){
  try {
    const params = new URLSearchParams(window.location.search);
    const v = params.get(DEBUG_PARAM);
    return v === '1' || v === 'true' || v === 'yes';
  } catch (_) { return false; }
}
const DebugPanelEnabled = isDebugPanelEnabled();

let viewSize = { w: canvas.width, h: canvas.height, dpr: 1 };
let center = { x: viewSize.w/2, y: viewSize.h/2 };
const nowSec = ()=>performance.now()/1000;
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));

const STRINGS = {
  ru: {
    title: 'Tank Merger: Zombie Orbit',
    subtitle: 'В духе cut-the-rope • Ангар с оградой • Ходячие зомби • Поддержка спрайтов танков',
    menuTitle: 'Tank Merger: Zombie Orbit',
    menuSubtitle: 'Главное меню выживших',
    menuContinue: 'Продолжить',
    menuNew: 'Новая игра',
    menuLanguage: 'Язык',
    menuSfx: 'Громкость эффектов',
    menuMusic: 'Громкость музыки',
    hudCoins: 'Монеты',
    hudKills: 'Убито монстров',
    hudSprites: 'Спрайты',
    hudBoost: 'Буст',
    buyTank: 'Купить танк {level} уровня',
    boostBtn: 'Буст x2 на 60с (симуляция рекламы)',
    armyTitle: 'Армия',
    zombieSpritesTitle: 'Зомби-спрайты',
    tankSpritesTitle: 'Танки-спрайты (опционально)',
    filesLabel: 'Файлы:',
    addLabel: 'Добавь:',
    tipZombies: 'Зомби визуально «ходят» (тень + покачивание + разворот по касательной). Танки стреляют видимыми снарядами.',
    tipTanks: 'Танки-спрайты: добавь <span class="mono">assets/tanks.json</span> и PNG в <span class="mono">assets/tanks/</span>.',
    tankInfoCount: 'Кол-во',
    tankInfoMax: 'Макс. уровень',
    tankInfoLevels: 'Уровни',
    boostActive: 'x{mult} {sec}с',
    hintSpritesOff: 'Спрайты отключены (assets/zombies.json).',
    popTank: '+Танк',
    popHangar: 'Ангар',
    popTrack: 'В бой!',
    crateMessage: 'Посмотри рекламу и получи танк.',
    crateModalText: 'Посмотреть рекламу и получить танк',
    crateGet: 'Получить',
    crateAdLoading: 'Просмотр рекламы...',
    talentsBtn: 'Таланты',
    talentTreeTitle: 'Древо талантов',
    talentPoints: 'Очки талантов',
    talentApply: 'Применить',
    talentReset: 'Сбросить выбор',
    talentPending: 'Выбрано',
    talentNeedPoints: 'Не хватает очков',
    talentActive: 'Использовать активку',
    talentActiveCooldown: 'Активка ({sec}с)',
    talentActiveLocked: 'Активка недоступна',
    levelLabel: 'Уровень',
    levelShort: 'Ур.',
    levelUp: 'Ур.{level}!',
    levelModalTitle: 'Вы достигли {level} уровень',
    levelModalTalent: 'Вы получили {points} {talent}',
    levelModalGold: 'Вы получили {gold} золота',
    levelUpAccept: 'Принять награду',
    powerMoment40: 'Открыты активные способности!',
    powerMoment50: 'Максимальная мощь танков.',
    powerMoment60: 'Режим эндгейма — враги усилены.',
    statusOn: 'OK',
    statusOff: 'OFF',
    zombieShort: 'З',
    tankShort: 'Т',
  },
  en: {
    title: 'Tank Merger: Zombie Orbit',
    subtitle: 'Cut-the-rope-ish • Fence hangar • Walking zombies • Tank sprites supported',
    menuTitle: 'Tank Merger: Zombie Orbit',
    menuSubtitle: 'Survivor main menu',
    menuContinue: 'Continue',
    menuNew: 'New game',
    menuLanguage: 'Language',
    menuSfx: 'SFX volume',
    menuMusic: 'Music volume',
    hudCoins: 'Coins',
    hudKills: 'Monsters defeated',
    hudSprites: 'Sprites',
    hudBoost: 'Boost',
    buyTank: 'Buy tank Lv{level}',
    boostBtn: 'Boost x2 for 60s (ad simulation)',
    armyTitle: 'Army',
    zombieSpritesTitle: 'Zombie sprites',
    tankSpritesTitle: 'Tank sprites (optional)',
    filesLabel: 'Files:',
    addLabel: 'Add:',
    tipZombies: 'Zombies visually “walk” (shadow + sway + tangent facing). Tanks fire visible shells.',
    tipTanks: 'Tank sprites: add <span class="mono">assets/tanks.json</span> and PNGs to <span class="mono">assets/tanks/</span>.',
    tankInfoCount: 'Count',
    tankInfoMax: 'Max level',
    tankInfoLevels: 'Levels',
    boostActive: 'x{mult} {sec}s',
    hintSpritesOff: 'Sprites OFF (assets/zombies.json).',
    popTank: '+Tank',
    popHangar: 'Hangar',
    popTrack: 'To battle!',
    crateMessage: 'Watch an ad to get a tank.',
    crateModalText: 'Watch an ad to get a tank',
    crateGet: 'Claim',
    crateAdLoading: 'Watching ad...',
    talentsBtn: 'Talents',
    talentTreeTitle: 'Talent Tree',
    talentPoints: 'Talent points',
    talentApply: 'Apply',
    talentReset: 'Reset selection',
    talentPending: 'Selected',
    talentNeedPoints: 'Not enough points',
    talentActive: 'Use active',
    talentActiveCooldown: 'Active ({sec}s)',
    talentActiveLocked: 'Active unavailable',
    levelLabel: 'Level',
    levelShort: 'Lv',
    levelUp: 'Lv{level}!',
    levelModalTitle: 'You reached level {level}',
    levelModalTalent: 'You received {points} {talent}',
    levelModalGold: 'You received {gold} gold',
    levelUpAccept: 'Claim reward',
    powerMoment40: 'Active abilities unlocked!',
    powerMoment50: 'Maximum tank power.',
    powerMoment60: 'Endgame mode — enemies enhanced.',
    statusOn: 'OK',
    statusOff: 'OFF',
    zombieShort: 'Z',
    tankShort: 'T',
  }
};

let currentLang = 'ru';

function t(key, vars = {}){
  const dict = STRINGS[currentLang] || STRINGS.ru;
  let text = dict[key] ?? STRINGS.ru[key] ?? key;
  for (const [k, v] of Object.entries(vars)){
    text = text.replaceAll(`{${k}}`, String(v));
  }
  return text;
}

function talentWord(points){
  if (currentLang === 'ru'){
    const mod10 = points % 10;
    const mod100 = points % 100;
    if (mod10 === 1 && mod100 !== 11) return 'талант';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'таланта';
    return 'талантов';
  }
  return points === 1 ? 'talent' : 'talents';
}

function setLanguage(lang){
  if (!STRINGS[lang]) return;
  currentLang = lang;
  localStorage.setItem('lang', lang);
  document.documentElement.lang = lang;
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
}

// SFX playback: volume from settings.sfxVolume; dedup by event id
const SFX_LAST_PLAYED = {};
const SFX_DEDUP_MS = 80;
function playSfx(id){
  const vol = clamp(settings.sfxVolume ?? DEFAULT_SETTINGS.sfxVolume, 0, 1);
  const now = performance.now();
  if (SFX_LAST_PLAYED[id] != null && now - SFX_LAST_PLAYED[id] < SFX_DEDUP_MS) return;
  SFX_LAST_PLAYED[id] = now;
  try{
    const src = SFX_SOURCES[id];
    if (!src) return;
    const a = new Audio(src);
    a.volume = vol;
    a.play().catch(() => {});
  }catch(e){}
}
const SFX_SOURCES = {
  shootNormal: 'assets/sfx/shoot_normal.ogg',
  shootHeavy: 'assets/sfx/shoot_heavy.ogg',
  shootHeavy2: 'assets/sfx/shoot_heavy2.ogg',
  levelUp: 'assets/sfx/level_up.ogg',
  applyTalents: 'assets/sfx/apply_talents.ogg',
  activeAbility: 'assets/sfx/active_ability.ogg',
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
    ui.langRu.classList.toggle('active', currentLang === 'ru');
    ui.langEn.classList.toggle('active', currentLang === 'en');
  }
  updateTalentUI();
  updateLevelModal();
}

// ---------- Sprite atlas loader (PNG + JSON) ----------
const ZombieSprites = {
  ready: false,
  error: '',
  atlasImg: null,
  types: [],
  async load(){
    try{
      const res = await fetch('assets/zombies.json', {cache:'no-store'});
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const atlasPath = 'assets/' + (data.atlas || 'zombie_atlas.png');
      const img = await loadImage(atlasPath);

      this.types = (data.types || []).map(t => ({
        id: t.id || 'zombie',
        frame: t.frame || {x:0,y:0,w:64,h:64},
        frames: t.frames ?? 1,
        animSpeed: t.animSpeed ?? 1.0,
        anchor: t.anchor || {x:0.5,y:0.75},
        scale: t.scale ?? 1.0,
        rotation: t.rotation ?? 0,
        hpMul: t.hpMul ?? 1.0,
        omegaMul: t.omegaMul ?? 1.0,
        rewardMul: t.rewardMul ?? 1.0,
        weight: t.weight ?? 1.0,
        hitbox: t.hitbox ?? null,
      }));
      if (!this.types.length) throw new Error('types[] empty');

      this.atlasImg = img;
      this.ready = true;
      this.error = '';
    }catch(e){
      this.ready = false;
      this.atlasImg = null;
      this.types = [];
      this.error = String(e);
    }
  },
  pickType(){
    if (!this.ready || !this.types.length) return null;
    // weighted random
    let sum = 0;
    for (const t of this.types) sum += t.weight;
    let r = Math.random() * sum;
    for (const t of this.types){
      r -= t.weight;
      if (r <= 0) return t;
    }
    return this.types[this.types.length-1];
  }
};

const TankSprites = {
  ready: false,
  error: '',
  config: null,
  cache: new Map(),
  async load(){
    try{
      const res = await fetch('assets/tanks.json', {cache:'no-store'});
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const cfg = await res.json();
      this.config = cfg;

      const srcs = new Set();
      if (cfg?.body?.src) srcs.add('assets/' + cfg.body.src);
      for (const cannon of cfg?.cannons || []){
        if (cannon?.src) srcs.add('assets/' + cannon.src);
      }

      for (const s of srcs){
        const img = await loadImage(s);
        this.cache.set(s, img);
      }

      this.ready = true;
      this.error = '';
    }catch(e){
      this.ready = false;
      this.error = String(e);
      this.config = null;
      this.cache.clear();
    }
  },
  pickBody(){
    if (!this.ready || !this.config?.body?.src) return null;
    const cfg = this.config.body;
    const full = 'assets/' + cfg.src;
    const img = this.cache.get(full);
    if (!img) return null;
    return { img, cfg };
  },
  pickCannon(level){
    if (!this.ready || !this.config?.cannons?.length) return null;
    const cannons = [...this.config.cannons].sort((a,b)=>a.minLevel - b.minLevel);
    let chosen = null;
    for (const cannon of cannons){
      if (cannon.minLevel <= level) chosen = cannon;
    }
    if (!chosen?.src) return null;
    const full = 'assets/' + chosen.src;
    const img = this.cache.get(full);
    if (!img) return null;
    return { img, cfg: chosen };
  }
};

function loadImage(url){
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = ()=>resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

const BASE_CANVAS = { w: 1100, h: 650 };
let balScale = 1;

function applyBalScale(scale){
  const clamped = clamp(scale, 1, 1.35);
  balScale = clamped;

  BAL.cellW = BASE_BAL.cellW * clamped;
  BAL.cellH = BASE_BAL.cellH * clamped;
  BAL.cellGap = BASE_BAL.cellGap * clamped;
  BAL.boardPad = BASE_BAL.boardPad * clamped;

  BAL.zombieTrackRadius = BASE_BAL.zombieTrackRadius * clamped;
  BAL.zombieTrackWidth = BASE_BAL.zombieTrackWidth * clamped;
  BAL.fenceWidth = BASE_BAL.fenceWidth * clamped;
  BAL.fenceKeepout = BASE_BAL.fenceKeepout * clamped;
  BAL.zombieFencePush = BASE_BAL.zombieFencePush * clamped;
  BAL.tankOrbitRadius = BASE_BAL.tankOrbitRadius * clamped;
  BAL.tankTrackWidth = BASE_BAL.tankTrackWidth * clamped;

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

  const rect = stage.getBoundingClientRect();
  const maxW = Math.max(200, rect.width);
  const maxH = Math.max(200, rect.height);
  const scale = Math.min(maxW / BASE_CANVAS.w, maxH / BASE_CANVAS.h);
  const displayW = Math.max(200, Math.floor(BASE_CANVAS.w * scale));
  const displayH = Math.max(200, Math.floor(BASE_CANVAS.h * scale));
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  canvas.style.width = `${displayW}px`;
  canvas.style.height = `${displayH}px`;
  canvas.width = Math.floor(displayW * dpr);
  canvas.height = Math.floor(displayH * dpr);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  viewSize = { w: displayW, h: displayH, dpr };
  center = { x: viewSize.w / 2, y: viewSize.h / 2 };
  applyBalScale(scale);
  initBoard();
}

// ---------- Board ----------
function initBoard(){
  const existing = state.cells.map(c=>c.tank);
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
      state.cells.push({ i, r, c, x, y, w:BAL.cellW, h:BAL.cellH, tank: existing[i] ?? null });
      i++;
    }
  }
  state.boardRect = { x:x0, y:y0, w:totalW, h:totalH };

  const hangarRadius = Math.max(totalW, totalH) / 2 + 12;
  const orbitPad = 10;
  const fencePad = 24;
  const trackPad = 18;
  BAL.tankOrbitRadius = Math.max(110, hangarRadius + orbitPad);
  BAL.fenceRadius = BAL.tankOrbitRadius + fencePad;
  BAL.zombieTrackRadius = BAL.fenceRadius + BAL.fenceWidth + trackPad;
  BAL.zombieTrackWidth = Math.max(12, 14 * balScale);

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
}

function getTankOrbitRadius(){
  return BAL.tankOrbitRadius - BAL.tankTrackWidth * BAL.tankTrackCenterOffset;
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
  backgroundLayer.ctx = bctx;
  backgroundLayer.ready = true;
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
  return 1 + Math.floor(maxLevel / 5);
}

function baseBuyPrice(level){
  return Math.round(level <= 1 ? BAL.buyCostLv1 : BAL.buyCostLv1 * 2.25);
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
  return Math.max(1, Math.round(base * mods.buyCostMul));
}

function bumpBuyPrice(level){
  const current = ensureBuyPrice(level);
  const delta = Math.max(1, Math.ceil(current * 0.001));
  state.buyPrices[level] = current + delta;
}

function tryBuyTank(){
  const level = buyTankLevel();
  const cost = buyTankCost(level);
  if (state.coins < cost) return;
  const empty = state.cells.find(c=>!c.tank);
  if (!empty) return;
  state.coins -= cost;
  empty.tank = makeTank(level, false);
  recordTankLevel(level);
  state.buyCounts[level] = (state.buyCounts[level] || 0) + 1;
  bumpBuyPrice(level);
  popText(empty.x+empty.w/2, empty.y+empty.h/2, t('popTank'), '#7dffb2');
}

function mergeCells(fromIdx, toIdx){
  if (fromIdx === toIdx) return false;
  const a = state.cells[fromIdx];
  const b = state.cells[toIdx];
  if (!a.tank || !b.tank) return false;
  if (a.tank.level !== b.tank.level) return false;

  const lvl = a.tank.level + 1;
  b.tank = makeTank(lvl, false);
  a.tank = null;
  recordTankLevel(lvl);

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
  const mods = getMods();
  const base = BAL.coinsPerShotBase + BAL.coinsPerShotLevelMul * Math.max(0, level - 1);
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
  const dmg = BAL.dmgBase * Math.pow(BAL.dmgMultPerLevel, level-1);
  const fr = BAL.fireRateBase + BAL.fireRateAddPerLevel*(level-1);
  const range = BAL.rangeBase + BAL.rangePerLevel*(level-1);
  const prof = projectileProfile(level);
  // Tie AOE to profile but also allow slight growth with level.
  const aoe = clamp(prof.aoeBase + prof.aoePerLevel*(level-1), prof.aoeMin, prof.aoeMax);
  const activeAttack = nowSec() < state.activeEffects.attackUntil ? 1.5 : 1;
  const activeSpeed = nowSec() < state.activeEffects.speedUntil ? 1.35 : 1;
  return {
    dmg: dmg * mods.dmgMul * activeAttack,
    fr: fr * mods.fireRateMul * activeSpeed,
    range: range * mods.rangeMul,
    aoe: aoe * mods.aoeMul * (activeAttack > 1 ? 1.2 : 1),
    prof,
  };
}

function xpNeededForLevel(level){
  const growth = 3 ** (level - 1);
  const correction = level >= 4 ? (10 / 9) : 1;
  const decadeBoost = 2 ** Math.floor((level - 1) / 10);
  return Math.round(500 * growth * correction * decadeBoost);
}

function levelGoldReward(level){
  return Math.max(0, Math.round(BAL.levelGoldBase + BAL.levelGoldPerLevel * Math.max(0, level - 1)));
}

function updateLevelModal(){
  const reward = state.ui.levelReward;
  if (!reward || !ui.levelModal) return;
  if (ui.levelTitle) ui.levelTitle.textContent = t('levelModalTitle', {level: reward.level});
  if (ui.levelTalent){
    ui.levelTalent.textContent = t('levelModalTalent', {
      points: reward.points,
      talent: talentWord(reward.points),
    });
  }
  if (ui.levelGold) ui.levelGold.textContent = t('levelModalGold', {gold: reward.gold});
  if (ui.levelAccept) ui.levelAccept.textContent = t('levelUpAccept');
}

function openLevelModal(){
  if (!ui.levelModal) return;
  ui.levelModal.classList.remove('hidden');
  ui.levelModal.setAttribute('aria-hidden', 'false');
  updateLevelModal();
  if (state.ui.levelRewardTimer){
    window.clearTimeout(state.ui.levelRewardTimer);
  }
  state.ui.levelRewardTimer = window.setTimeout(() => {
    acceptLevelReward();
  }, BAL.levelRewardAutoCloseSec * 1000);
}

function closeLevelModal(){
  if (!ui.levelModal) return;
  ui.levelModal.classList.add('hidden');
  ui.levelModal.setAttribute('aria-hidden', 'true');
  if (state.ui.levelRewardTimer){
    window.clearTimeout(state.ui.levelRewardTimer);
    state.ui.levelRewardTimer = 0;
  }
}

function queueLevelReward(level, points, gold){
  if (!points && !gold) return;
  const reward = state.ui.levelReward;
  if (reward){
    reward.level = Math.max(reward.level, level);
    reward.points += points;
    reward.gold += gold;
  } else {
    state.ui.levelReward = { level, points, gold };
  }
  openLevelModal();
}

function acceptLevelReward(){
  const reward = state.ui.levelReward;
  if (!reward) return;
  state.player.talentPoints += reward.points;
  state.coins += reward.gold;
  state.ui.levelReward = null;
  closeLevelModal();
  saveProgress();
  updateUI();
}

function grantXP(amount){
  const p = state.player;
  if (!p || p.level >= p.maxLevel) return;

  p.xp += amount;
  let leveled = false;
  let gainedLevels = 0;
  let rewardGold = 0;

  while (p.level < p.maxLevel){
    p.xpToNext = xpNeededForLevel(p.level);
    if (p.xp < p.xpToNext) break;

    p.xp -= p.xpToNext;
    p.level += 1;
    leveled = true;
    gainedLevels += 1;
    rewardGold += levelGoldReward(p.level);
  }
  p.xpToNext = xpNeededForLevel(p.level);
  if (leveled){
    refreshTanksPowerTier();
    triggerLevelUpVfx(p.level);
    checkPowerMomentEvents(p.level);
    queueLevelReward(p.level, gainedLevels, rewardGold);
    saveProgress();
  }
}

function triggerLevelUpVfx(level){
  const now = nowSec();
  state.levelUpVfxUntil = now + 0.15;
  state.levelUpText = { level, until: now + 2.2 };
  state.timeScale = 0.7;
  playSfx('levelUp');
}

function checkPowerMomentEvents(level){
  const p = state.player;
  if (!p) return;
  if (level >= 40 && !p.eventShown40){
    p.eventShown40 = true;
    showCenterNotification(t('powerMoment40'));
  }
  if (level >= 50) p.eventShown50 = true;
  if (level >= 60){
    p.eventShown60 = true;
    state.endgameVisuals = true;
  }
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

function addTalent(branch, name, desc, maxRank, kind, apply){
  const id = `${branch}-${TALENT_DEFS.length}`;
  const prev = ACTIVE_TALENT_INDEX[branch];
  const def = { id, branch, name, desc, maxRank, prev, kind, apply };
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
  overlay?.querySelectorAll('.talentBtn').forEach(btn => {
    const i = Number(btn.dataset.talent);
    if ((p.talentsPending[i] || 0) > 0) btn.classList.add('talentEnergyFlow');
  });

  setTimeout(() => {
    if (modal) modal.classList.remove('talentApplyFlash');
    overlay?.querySelectorAll('.talentBtn').forEach(btn => btn.classList.remove('talentEnergyFlow'));
    doApplyTalentSelections();
    applyTalentBusy = false;
    if (applyBtn) applyBtn.disabled = pendingCost() <= 0 || pendingCost() > state.player.talentPoints;
  }, APPLY_VFX_TOTAL_MS);
}

function canSelectTalent(i){
  const p = state.player;
  const def = TALENT_DEFS[i];
  if (!def) return false;
  if (def.kind === 'active' && p.level < 40) return false;
  const appliedRank = p.talentsApplied[i] || 0;
  const pendingRank = p.talentsPending[i] || 0;
  if (appliedRank + pendingRank >= def.maxRank) return false;
  if (def.prev !== null && def.prev !== undefined){
    if ((p.talentsApplied[def.prev] || 0) < 1) return false;
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
    }));
  }catch(e){}
}

function getSavedProgress(){
  try{
    const raw = localStorage.getItem('progress');
    if (raw) return JSON.parse(raw);
  }catch(e){}
  return null;
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
  const { buyCounts, buyPrices, ...playerData } = data;
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
  return true;
}

function projectileProfile(level){
  // Different projectile & impact styles by level bands.
  // 1-3: AP shell (small aoe)
  // 4-6: HE (bigger aoe + bright explosion)
  // 7-9: Toxic (aoe + poison pool DOT)
  // 10+: Tesla (aoe + chain lightning)
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
  return {
    kind:'tesla',
    speed: 900,
    r: 4.6,
    color:'#8bd3ff',
    glow:'rgba(139,211,255,.25)',
    trail:'rgba(139,211,255,.10)',
    aoeBase: 26,
    aoePerLevel: 2.8,
    aoeMin: 26,
    aoeMax: 66,
    chainRange: 84,
    chainJumps: 3,
    chainMul: 0.45,
  };
}

function tankLevelCounts(){
  const counts = new Map();
  for (const cell of state.cells){
    if (!cell.tank) continue;
    const lvl = cell.tank.level;
    counts.set(lvl, (counts.get(lvl) || 0) + 1);
  }
  return counts;
}

function zombieLevelWeights(){
  const counts = tankLevelCounts();
  const levels = Array.from(counts.keys()).sort((a,b)=>a-b);
  if (!levels.length) return [{level: 1, weight: 1}];
  if (levels.length === 1) return [{level: levels[0], weight: 1}];

  const minLevel = levels[0];
  const remaining = 0.15;
  const minWeightBase = 0.85;
  const otherLevels = levels.slice(1);
  const nonMinTotal = otherLevels.reduce((sum, lvl)=>sum + (counts.get(lvl) || 0), 0) || 1;
  const snap = 0.05;

  const weights = [];
  let snappedSum = 0;
  for (const lvl of otherLevels){
    const raw = remaining * ((counts.get(lvl) || 0) / nonMinTotal);
    let snapped = Math.round(raw / snap) * snap;
    if (snapped < snap / 2) snapped = 0;
    weights.push({level: lvl, weight: snapped, raw});
    snappedSum += snapped;
  }

  if (snappedSum > remaining){
    const scale = remaining / snappedSum;
    snappedSum = 0;
    for (const w of weights){
      w.weight *= scale;
      snappedSum += w.weight;
    }
  } else if (snappedSum === 0){
    for (const w of weights){
      w.weight = w.raw;
      snappedSum += w.weight;
    }
  }

  const minWeight = Math.max(0, 1 - snappedSum);
  return [{level: minLevel, weight: minWeight}, ...weights.map(w=>({level:w.level, weight:w.weight}))];
}

function pickZombieLevel(){
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
  const step = (Math.PI * 2) / Math.max(1, slotCount);
  const jitter = (Math.random() * 2 - 1) * step * 0.25;
  return slotIndex * step + jitter;
}

function assignZombieSlot(z, slotIndex, slotCount){
  const theta = zombieSlotTheta(slotIndex, slotCount);
  z.slotIndex = slotIndex;
  z.anchorTheta = theta;
  z.theta = theta;
  const fenceLimit = zombieFenceLimit(z);
  z.targetR = fenceLimit + (Math.random()*2-1)*Math.min(4, BAL.zombieTrackWidth * 0.2);
}

function makeZombie(fromEdge=true, slotIndex=null, slotCount=1){
  const t = ZombieSprites.pickType();
  const level = pickZombieLevel();

  const theta = Number.isFinite(slotIndex)
    ? zombieSlotTheta(slotIndex, slotCount)
    : Math.random() * Math.PI*2;
  const dir = Math.random() < 0.5 ? -1 : 1;

  const levelHpMul = zombieHpMultiplier(level);
  const levelOmegaMul = 1 + BAL.zombieLevelOmegaMul * (level - 1);
  const baseHp = BAL.zombieHpBase * (1 + (Math.random()*2-1)*BAL.zombieHpVar) * levelHpMul;
  const baseOmega = (BAL.omegaBase + (Math.random()*2-1)*BAL.omegaVar) * dir * levelOmegaMul;
  const joinSpeed = fromEdge ? BAL.edgeJoinSpeed * (0.6 + Math.random() * 0.2) : BAL.edgeJoinSpeed * 1.4;

  const z = {
    id: crypto.randomUUID(),
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
    omega: baseOmega * (t?.omegaMul ?? 1.0),
    joinSpeed,
    hp: baseHp * (t?.hpMul ?? 1.0),
    maxHp: baseHp * (t?.hpMul ?? 1.0),
    rewardMul: (t?.rewardMul ?? 1.0),
    anim: Math.random() * (t?.frames ?? 1),
  };

  const fenceLimit = zombieFenceLimit(z);
  z.targetR = fenceLimit + (Math.random()*2-1)*Math.min(4, BAL.zombieTrackWidth * 0.2);
  if (!fromEdge) z.r = z.targetR;
  return z;
}

function ensureZombieCount(){
  const target = BAL.zombieCountTarget;
  const slotCount = Math.max(1, target);
  const taken = new Set();

  for (const z of state.zombies){
    if (Number.isFinite(z.slotIndex)){
      const idx = ((z.slotIndex % slotCount) + slotCount) % slotCount;
      z.slotIndex = idx;
      taken.add(idx);
    }
  }

  const missing = [];
  for (let i=0;i<slotCount;i++){
    if (!taken.has(i)) missing.push(i);
  }

  for (const z of state.zombies){
    if (!Number.isFinite(z.slotIndex)){
      const idx = missing.shift();
      if (idx === undefined) break;
      assignZombieSlot(z, idx, slotCount);
    }
  }

  while (state.zombies.length < target){
    const idx = missing.shift();
    state.zombies.push(makeZombie(true, idx ?? state.zombies.length, slotCount));
  }
  if (state.zombies.length > target) state.zombies.length = target;
}

function zombiePos(z){
  return {
    x: center.x + Math.cos(z.theta) * z.r,
    y: center.y + Math.sin(z.theta) * z.r,
  };
}

function zombieLevelScale(z){
  const level = z.level ?? 1;
  return 1 + BAL.zombieLevelScaleAdd * Math.max(0, level - 1);
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

function zombieFenceLimit(z){
  return BAL.fenceRadius + BAL.fenceKeepout + zombieCollisionRadius(z);
}

function startZombieDying(z){
  if (z.state === 'dying') return;
  z.state = 'dying';
  z.deathDuration = 0.65;
  z.deathTimer = z.deathDuration;
  z.deathProgress = 0;
  z.hp = 0;

  state.coins += coinsForKill(z.level ?? 1, z.rewardMul);
  state.kills += 1;
  const mods = getMods();
  const base = 5 + Math.random() * 5;
  const levelMul = 1.1 ** Math.max(0, (z.level ?? 1) - 1);
  const activeMul = nowSec() < state.activeEffects.economyUntil ? 1.6 : 1;
  grantXP(base * levelMul * mods.xpMul * activeMul);
  const p = zombiePos(z);
  burst(p.x, p.y, 18, 'rgba(125,255,178,.18)');
}

function stepZombies(dt){
  const slow = (state.empUntil && nowSec() < state.empUntil) ? 0.5 : 1;
  for (const z of state.zombies){
    if (z.state === 'dying'){
      z.deathTimer -= dt;
      z.deathProgress = clamp(1 - z.deathTimer / (z.deathDuration || 0.65), 0, 1);
      z.anim += dt * 4.5;
      continue;
    }
    const prevTheta = z.theta;

    z.swayPhase += dt * z.swaySpeed * slow;
    z.theta = z.anchorTheta + Math.sin(z.swayPhase) * BAL.zombieSwayAmp;

    // Join ring from edge
    const t = 1 - Math.exp(-dt * (z.joinSpeed ?? BAL.edgeJoinSpeed));
    z.r = z.r + (z.targetR - z.r) * t;
    z.r -= BAL.zombieFencePush * dt;

    const fenceLimit = zombieFenceLimit(z);
    if (z.targetR < fenceLimit) z.targetR = fenceLimit;
    if (z.r < fenceLimit) z.r = fenceLimit;

    const dTheta = Math.atan2(Math.sin(z.theta - prevTheta), Math.cos(z.theta - prevTheta));
    const moving = Math.abs(dTheta) > 0.0005;
    const targetHeading = moving ? clamp(dTheta * 4.2, -0.25, 0.25) : 0;
    z.heading = smoothAngle(z.heading ?? 0, targetHeading, dt * 6);

    const speed = Math.abs(z.omega);
    const animMul = z.type?.animSpeed ?? 1.0;
    z.anim += dt * animMul * (1.4 + speed * 6.0) * slow;

    if (z.dotUntil){
      if (nowSec() < z.dotUntil){
        z.hp -= (z.dotDps || 0) * dt;
      } else {
        z.dotUntil = 0;
        z.dotDps = 0;
      }
    }
  }
}

// ---------- Combat: visible projectiles ----------
function stepTanks(dt){
  for (const cell of state.cells){
    const tank = cell.tank;
    if (!tank || !tank.onTrack) continue;

    tank.cooldown = Math.max(0, tank.cooldown - dt);
    const hasSpriteConfig = TankSprites?.ready && TankSprites?.config?.body && (TankSprites?.config?.cannons?.length || 0) > 0;
    if (hasSpriteConfig){
      const bodyCfg = TankSprites.config.body;
      tank.bodyAnim += dt * (bodyCfg.animSpeed ?? 2.0);
    }

    const s = tankStats(tank.level);
    const mods = getMods();

    // pick nearest zombie in range + forward sector
    let best = null;
    let bestD = Infinity;
    const pos = tankOrbitState(cell, nowSec());
    const sx = pos.x;
    const sy = pos.y;
    const fwdX = Math.cos(pos.heading);
    const fwdY = Math.sin(pos.heading);

    for (const z of state.zombies){
      if (z.state === 'dying') continue;
      const p = zombiePos(z);
      const dx = p.x - sx;
      const dy = p.y - sy;
      const d = Math.hypot(dx, dy);
      if (!d || d > s.range || d >= bestD) continue;
      const dot = (dx * fwdX + dy * fwdY) / d;
      if (dot <= 0) continue;
      best = z;
      bestD = d;
    }

    if (hasSpriteConfig){
      const cannon = TankSprites.pickCannon(tank.level);
      const cannonCfg = cannon?.cfg;

      if (best && tank.cooldown <= 0 && cannonCfg){
        tank.cannonAnim += dt * (cannonCfg.animSpeed ?? 10.0) * speedMult();
        const frames = cannonCfg.frames || 1;
        const fireFrame = cannonCfg.fireFrame ?? 1;
        const frameIndex = Math.floor(tank.cannonAnim) % frames;

        if (frameIndex === fireFrame && !tank.firedThisCycle){
          tank.firedThisCycle = true;

          const muzzle = cannonCfg.muzzle || {x: 28, y: 0};
          const mx = sx + Math.cos(pos.heading) * muzzle.x - Math.sin(pos.heading) * muzzle.y;
          const my = sy + Math.sin(pos.heading) * muzzle.x + Math.cos(pos.heading) * muzzle.y;

          fireTankProjectile({sx: mx, sy: my, target: best, tank, stats: s, mods});
        }
      }

      if (tank.cooldown > 0 || !best){
        tank.cannonAnim = 0;
        tank.firedThisCycle = false;
      }
      continue;
    }

    if (tank.cooldown > 0 || !best) continue;
    fireTankProjectile({sx, sy, target: best, tank, stats: s, mods});
  }
}

const MAX_BURST_PARTICLES = 14;
const MAX_TRAIL_ALPHA = 0.45;

function fireTankProjectile({sx, sy, target, tank, stats, mods}){
  const powerTier = tank.powerTier ?? computePowerTier(state.player?.level ?? 1);
  const effectIntensity = 1 + powerTier * 0.25;
  const tp = zombiePos(target);
  const spawn = () => {
    spawnProjectile({
      fromX: sx,
      fromY: sy,
      toZombieId: target.id,
      toX: tp.x,
      toY: tp.y,
      level: tank.level,
      dmg: stats.dmg,
      aoe: stats.aoe,
      prof: stats.prof,
      effectIntensity,
    });
    state.coins += coinsForShot(tank.level);
  };
  spawn();
  if (Math.random() < mods.doubleShotChance){
    spawn();
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
  const angle = timeSec * BAL.tankOrbitSpeed * speedMult() * mods.orbitSpeedMul * activeSpeed + offset;
  const orbitR = getTankOrbitRadius();
  return {
    x: center.x + Math.cos(angle) * orbitR,
    y: center.y + Math.sin(angle) * orbitR,
    heading: angle + Math.PI/2,
  };
}

function spawnProjectile(p){
  state.projectiles.push({
    x: p.fromX,
    y: p.fromY,
    toX: p.toX,
    toY: p.toY,
    toZombieId: p.toZombieId,
    speed: p.prof.speed,
    r: p.prof.r,
    color: p.prof.color,
    glow: p.prof.glow,
    trail: p.prof.trail,
    kind: p.prof.kind,
    dmg: p.dmg,
    aoe: p.aoe,
    level: p.level,
    prof: p.prof,
    effectIntensity: p.effectIntensity ?? 1,
    life: 2.0,
  });
}

function stepProjectiles(dt){
  const zmap = new Map(state.zombies.map(z => [z.id, z]));
  const next = [];

  for (const b of state.projectiles){
    b.life -= dt;
    if (b.life <= 0) continue;

    // update target point (moving zombie)
    const z = zmap.get(b.toZombieId);
    if (z){
      const p = zombiePos(z);
      b.toX = p.x;
      b.toY = p.y;
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
      continue;
    }

    next.push(b);
  }

  state.projectiles = next;
}

function impactAt(x,y,b){
  const mods = getMods();
  // Base AOE damage
  for (const z of state.zombies){
    if (z.state === 'dying') continue;
    const p = zombiePos(z);
    const d = Math.hypot(p.x-x, p.y-y);
    if (d <= b.aoe){
      const falloff = 0.55 + 0.45*(1 - d/b.aoe);
      z.hp -= b.dmg * falloff;
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

    best.hp -= b.dmg * mul;
    curX = p.x;
    curY = p.y;
  }
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
  const empty = state.cells.filter(c => !c.tank);
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
  const alive = [];
  for (const z of state.zombies){
    if (z.state === 'dying'){
      if (z.deathTimer > 0){
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
  for (let i=0;i<count;i++) particle(x,y,Math.random()*2.6+1.0,color,Math.random()*0.30+0.14);
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
  state.ui.menuOpen = open;
  document.body.classList.toggle('menu-open', open);
  if (ui.menuOverlay){
    ui.menuOverlay.classList.toggle('hidden', !open);
    ui.menuOverlay.setAttribute('aria-hidden', (!open).toString());
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
  state = createInitialState();
  if (DebugPanelEnabled) {
    state.debug = {
      log: [],
      targetCellIndex: null,
      talentOverrides: {},
      collapsed: wasCollapsed ?? false,
      previewParticles: [],
      debugStatusActive: false,
    };
  }
  ensureTalentState();
  state.player.xpToNext = xpNeededForLevel(state.player.level);
  state.player.modsDirty = true;
  resizeCanvas();
  state.nextCrateAt = nowSec() + BAL.crateIntervalSec;
  if (state.cells[0] && state.cells[1] && !state.cells.some(c=>c.tank)){
    state.cells[0].tank = makeTank(1, true);
    state.cells[1].tank = makeTank(1, true);
    recordTankLevel(1);
  }
  refreshTanksPowerTier();
}

// ---------- UI ----------
function updateUI(){
  const level = buyTankLevel();
  const cost = buyTankCost(level);
  ui.coins.textContent = Math.floor(state.coins);
  ui.zcount.textContent = state.kills;
  const buyLabel = ui.buy.querySelector('[data-i18n="buyTank"]');
  if (buyLabel) buyLabel.textContent = t('buyTank', {level});
  ui.buyCost.innerHTML = `${cost}<span class="coinIcon">🪙</span>`;

  const left = state.boostUntil - nowSec();
  ui.boostState.textContent = left > 0
    ? t('boostActive', {mult: BAL.boostMult, sec: Math.ceil(left)})
    : '—';

  ui.buy.disabled = state.coins < cost || !state.cells.some(c=>!c.tank);
  updateProgressUI();
  updateTalentUI();
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
  lvlText.textContent = `${t('levelLabel')}: ${p.level}`;
  xpText.textContent = `${Math.floor(p.xp)}/${need}`;
  xpBar.style.width = `${pct}%`;
}

function ensureTalentUI(){
  if (document.getElementById('talentOverlay')) return;
  initTalentDefs();

  const overlay = document.createElement('div');
  overlay.id = 'talentOverlay';
  overlay.className = 'overlay hidden';
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modalHeader">
        <div class="modalTitle">${t('talentTreeTitle')}</div>
        <button class="modalClose" type="button" aria-label="Close">✕</button>
      </div>
      <div class="modalBody">
        <div class="talentBranches" id="talentBranches"></div>
      </div>
      <div class="talentFooter">
        <div class="talentSummary" id="talentSummary"></div>
        <div class="talentActions">
          <button id="talentReset" class="btn btnSecondary" type="button">${t('talentReset')}</button>
          <button id="talentApply" class="btn btnPrimary" type="button">${t('talentApply')}</button>
          <button id="talentActive" class="btn btnSecondary" type="button">${t('talentActive')}</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeTalents();
  });
  overlay.querySelector('.modalClose')?.addEventListener('click', () => closeTalents());
  overlay.querySelector('#talentReset')?.addEventListener('click', () => resetTalentSelections());
  overlay.querySelector('#talentApply')?.addEventListener('click', () => applyTalentSelections());
  overlay.querySelector('#talentActive')?.addEventListener('click', () => useActiveAbility(state.ui.talentBranch));

  const branches = overlay.querySelector('#talentBranches');
  TALENT_BRANCHES.forEach((branchName, branch) => {
    const column = document.createElement('div');
    column.className = 'talentBranch';
    column.dataset.branch = String(branch);
    column.innerHTML = `
      <div class="talentBranchTitle">
        <span>${branchName}</span>
        <span class="talentBranchPoints" id="branchPoints-${branch}"></span>
      </div>
      <div class="talentList"></div>
    `;
    column.querySelector('.talentBranchTitle')?.addEventListener('click', () => {
      state.ui.talentBranch = branch;
      updateTalentUI();
    });

    const list = column.querySelector('.talentList');
    TALENT_DEFS.forEach((def, i) => {
      if (def.branch !== branch) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'talentBtn';
      btn.dataset.talent = String(i);
      btn.innerHTML = `
        <strong><span class="talentName">${def.name}</span><span class="talentRank"></span></strong>
        <small class="talentDesc">${def.desc}</small>
      `;
      btn.addEventListener('click', (event) => {
        adjustTalentPending(i, event.shiftKey ? -1 : 1);
      });
      btn.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        adjustTalentPending(i, -1);
      });
      list.appendChild(btn);
    });
    branches.appendChild(column);
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

  overlay.querySelectorAll('.talentBtn').forEach(btn => {
    const i = Number(btn.dataset.talent);
    const def = TALENT_DEFS[i];
    const applied = p.talentsApplied[i] || 0;
    const pending = p.talentsPending[i] || 0;
    const rankText = `${applied + pending}/${def.maxRank}`;
    const rankEl = btn.querySelector('.talentRank');
    if (rankEl) rankEl.textContent = rankText;

    btn.classList.toggle('applied', applied > 0);
    btn.classList.toggle('pending', pending > 0);
    btn.disabled = !canSelectTalent(i) && pending === 0;
    btn.style.opacity = canSelectTalent(i) || pending > 0 || applied > 0 ? '1' : '0.45';
    btn.title = `${def.name}\n${def.desc}`;
  });

  overlay.querySelectorAll('.talentBranch').forEach(column => {
    const branch = Number(column.dataset.branch);
    column.classList.toggle('selected', branch === state.ui.talentBranch);
  });

  TALENT_BRANCHES.forEach((_, branch) => {
    const el = overlay.querySelector(`#branchPoints-${branch}`);
    if (!el) return;
    const applied = TALENT_DEFS.reduce((sum, def, i) => {
      if (def.branch !== branch) return sum;
      return sum + (p.talentsApplied[i] || 0);
    }, 0);
    el.textContent = `⭐ ${applied}`;
  });

  const applyBtn = overlay.querySelector('#talentApply');
  if (applyBtn){
    applyBtn.disabled = cost <= 0 || cost > p.talentPoints;
  }
  const resetBtn = overlay.querySelector('#talentReset');
  if (resetBtn) resetBtn.disabled = cost <= 0;

  const activeBtn = overlay.querySelector('#talentActive');
  if (activeBtn){
    const branch = state.ui.talentBranch;
    const cdUntil = p.activeCooldowns[branch] || 0;
    const now = nowSec();
    const cdLeft = Math.max(0, cdUntil - now);
    const canUse = canUseActive(branch);
    const label = canUse
      ? t('talentActive')
      : cdLeft > 0
        ? t('talentActiveCooldown', {sec: Math.ceil(cdLeft)})
        : t('talentActiveLocked');
    activeBtn.textContent = `${label} • ${TALENT_BRANCHES[branch]}`;
    activeBtn.disabled = !canUse;
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

function openCrateModal(){
  if (!state.crate || !ui.crateModal) return;
  ui.crateModal.classList.remove('hidden');
  ui.crateModal.setAttribute('aria-hidden', 'false');
  if (ui.crateText) ui.crateText.textContent = t('crateModalText');
  if (ui.crateGet){
    ui.crateGet.disabled = false;
    ui.crateGet.textContent = t('crateGet');
  }
  renderCrateIcon(state.crate.rewardLevel ?? 1);
}

function closeCrateModal(){
  if (!ui.crateModal) return;
  ui.crateModal.classList.add('hidden');
  ui.crateModal.setAttribute('aria-hidden', 'true');
}

function grantCrateTank(level, preferredIndex = null){
  let cell = null;
  if (Number.isFinite(preferredIndex)){
    const candidate = state.cells[preferredIndex];
    if (candidate && !candidate.tank) cell = candidate;
  }
  if (!cell) cell = pickEmptyCell();
  if (!cell) return false;
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

canvas.addEventListener('pointerdown', (e)=>{
  const p = getPointerPos(e);
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
  if (!state.dragging) return;
  const p = getPointerPos(e);
  state.dragging.x = p.x;
  state.dragging.y = p.y;
  const dx = p.x - state.dragging.startX;
  const dy = p.y - state.dragging.startY;
  if (Math.hypot(dx, dy) > 6) state.dragging.moved = true;
});

canvas.addEventListener('pointerup', (e)=>{
  if (!state.dragging) return;
  const p = getPointerPos(e);
  const target = cellAt(p.x, p.y);

  const from = state.cells[state.dragging.cellIndex];
  from.tank = state.dragging.tank;

  if (!state.dragging.moved){
    from.tank.onTrack = true;
    popText(from.x+from.w/2, from.y+from.h/2, t('popTrack'), '#bfe3ff');
  } else if (target){
    const merged = mergeCells(from.i, target.i);
    if (!merged && !target.tank){
      target.tank = from.tank;
      from.tank = null;
    }
  }
  state.dragging = null;
});

ui.buy.addEventListener('click', ()=> tryBuyTank());
ui.boost.addEventListener('click', ()=> { state.boostUntil = nowSec() + BAL.boostDurationSec; });
ui.crateGet?.addEventListener('click', () => claimCrateReward());
ui.crateClose?.addEventListener('click', () => closeCrateModal());
ui.crateModal?.addEventListener('click', (e) => {
  if (e.target?.dataset?.crateClose){
    closeCrateModal();
  }
});

// ---------- Render ----------
function draw(){
  ctx.clearRect(0,0,viewSize.w,viewSize.h);

  drawBackground();
  drawTrack();
  drawZombieFence();
  drawTankTrack();
  drawBoard();
  drawOrbitingTanks();
  drawCrate();
  drawDecals();
  drawZombies();
  drawProjectiles();
  drawImpacts();
  drawParticles();
  drawLevelUpVfx();

  // If sprites failed to load, show a small hint on canvas
  if (!ZombieSprites.ready){
    drawHint(t('hintSpritesOff'));
  }
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
  ctx.fillText(t('levelUp', { level: txt.level }).replace('!', ''), 0, -12);
  ctx.restore();
}

function drawBackground(){
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

function drawTrack(){
  ctx.save();
  ctx.translate(center.x, center.y);

  ctx.beginPath();
  ctx.arc(0,0,BAL.zombieTrackRadius,0,Math.PI*2);
  ctx.strokeStyle = 'rgba(110,168,255,.18)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0,0,BAL.zombieTrackRadius + BAL.zombieTrackWidth,0,Math.PI*2);
  ctx.strokeStyle = 'rgba(125,255,178,.07)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0,0,BAL.zombieTrackRadius - BAL.zombieTrackWidth,0,Math.PI*2);
  ctx.strokeStyle = 'rgba(125,255,178,.06)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();
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
  const r = BAL.fenceRadius;
  ctx.save();
  ctx.translate(center.x, center.y);

  ctx.strokeStyle = 'rgba(161, 110, 64, .55)';
  ctx.lineWidth = BAL.fenceWidth;
  ctx.beginPath();
  ctx.arc(0,0,r,0,Math.PI*2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(59, 35, 19, .38)';
  ctx.lineWidth = BAL.fenceWidth * 0.4;
  ctx.beginPath();
  ctx.arc(0,0,r-5,0,Math.PI*2);
  ctx.stroke();

  const posts = 40;
  const postScale = BAL.fenceWidth / 4;
  for (let i=0;i<posts;i++){
    const a = (i/posts) * Math.PI*2;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(a);
    ctx.fillStyle = 'rgba(188, 126, 74, .55)';
    ctx.strokeStyle = 'rgba(45, 26, 14, .3)';
    ctx.lineWidth = 1.5 * postScale;
    rr(ctx, -3 * postScale, -10 * postScale, 6 * postScale, 18 * postScale, 2 * postScale);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

function drawFence(br){
  // simple fence around hangar (visual only)
  ctx.save();

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
    }
  }

  if (state.dragging){
    drawTank(
      state.dragging.x - state.dragging.dx,
      state.dragging.y - state.dragging.dy,
      state.dragging.tank,
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
  rr(ctx, cx-14, cy-10, 28, 20, 8);
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
    drawTank(pos.x, pos.y, c.tank, false, pos.heading);
  }
}

function drawTankIcon(x,y,level,mutedSlot=false){
  drawTankIconTo(ctx, x, y, level, mutedSlot);
}

function drawTankIconTo(targetCtx, x, y, level, mutedSlot=false, scaleMul=1){
  const body = TankSprites?.pickBody?.();
  const cannon = TankSprites?.pickCannon?.(level);
  if (body && cannon){
    const bodyW = body.cfg.frame?.w ?? body.img.width;
    const bodyH = body.cfg.frame?.h ?? body.img.height;
    const maxW = 34 * balScale * scaleMul;
    const maxH = 26 * balScale * scaleMul;
    const scale = Math.min(maxW / bodyW, maxH / bodyH);
    targetCtx.save();
    targetCtx.translate(x, y);
    targetCtx.globalAlpha = mutedSlot ? 0.6 : 0.92;
    const drawW = bodyW * scale;
    const drawH = bodyH * scale;
    const bodyAnchor = body.cfg.anchor || {x:0.5, y:0.6};
    targetCtx.drawImage(
      body.img,
      0,
      0,
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
  targetCtx.restore();
}

const AuraStyleByTier = [
  null,
  { color: 'rgba(180,255,200,.22)', radius: 20, alpha: 0.14, effect: 'glow' },
  { color: 'rgba(140,230,255,.24)', radius: 24, alpha: 0.18, effect: 'pulse' },
  { color: 'rgba(100,180,255,.26)', radius: 28, alpha: 0.20, effect: 'doubleOutline' },
  { color: 'rgba(186,140,255,.28)', radius: 32, alpha: 0.22, effect: 'particles' },
  { color: 'rgba(255,248,220,.35)', radius: 38, alpha: 0.32, effect: 'intenseGlow' },
];

function drawTankAura(x, y, tier){
  if (tier < 1 || tier > 5) return;
  const style = AuraStyleByTier[tier];
  if (!style) return;
  const t = nowSec();
  ctx.save();
  ctx.translate(x, y);
  let alpha = style.alpha;
  let scale = 1;
  if (style.effect === 'pulse'){
    alpha *= 0.7 + 0.3 * Math.sin(t * 4);
    scale = 0.92 + 0.08 * Math.sin(t * 4);
  } else if (style.effect === 'intenseGlow'){
    alpha *= 0.85 + 0.15 * Math.sin(t * 2);
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
  if (style.effect === 'particles' && state.particles.length < BAL.maxParticles - 20){
    const n = Math.floor(2 + Math.sin(t * 3) * 1.5);
    for (let i = 0; i < n; i++){
      const a = (t * 2 + i * 2.1) % (Math.PI * 2);
      const dist = r * (0.4 + 0.4 * Math.sin(t + i));
      particle(x + Math.cos(a) * dist, y + Math.sin(a) * dist, 2, style.color.replace(/[\d.]+\)$/, '0.5)'), 0.2);
    }
  }
  ctx.restore();
}

function drawTank(x,y,tank,ghost=false,rotation=0){
  const level = typeof tank === 'number' ? tank : tank?.level ?? 1;
  const powerTier = (tank && typeof tank === 'object' && tank.powerTier != null) ? tank.powerTier : computePowerTier(state.player?.level ?? 1);
  drawTankAura(x, y, powerTier);
  // Try sprite-based tanks if assets/tanks.json exists
  const body = TankSprites?.pickBody?.();
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
    const bodyFrame = Math.floor(tank?.bodyAnim ?? 0) % (body.cfg.frames || 1);
    const bodyAnchor = body.cfg.anchor || {x:0.5, y:0.6};
    const bodyScale = body.cfg.scale ?? 1;
    const drawBodyW = bodyW * s * bodyScale;
    const drawBodyH = bodyH * s * bodyScale;

    ctx.drawImage(
      body.img,
      bodyFrame * bodyW,
      0,
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

    // level badge (same as vector)
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

  // level badge
  const badge = ['rgba(0,0,0,.35)','rgba(0,0,0,.35)','rgba(110,168,255,.22)','rgba(125,255,178,.22)','rgba(185,139,255,.22)'][clamp(tier,0,4)];
  ctx.fillStyle = badge;
  rr(ctx, -16, 1, 32, 16, 8);
  ctx.fill();

  ctx.fillStyle = '#eaf1ff';
  ctx.font = '11px system-ui, -apple-system, Segoe UI, Roboto, Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${t('levelShort')}${level}`, 0, 9);

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
    if (ZombieSprites.ready && ZombieSprites.atlasImg && z.type){
      drawZombieSprite(p.x, p.y, z);
    } else {
      drawZombieFallback(p.x, p.y, z);
    }
  }
}

function drawZombieSprite(x,y,z){
  const img = ZombieSprites.atlasImg;
  const t = z.type;
  const f = t.frame;
  const a = t.anchor;
  const facing = x >= center.x ? -1 : 1;

  const frames = t.frames || 1;
  const frameIndex = Math.floor(z.anim) % frames;

  const fx = f.x + frameIndex * f.w;
  const fy = f.y;

  const scale = (t.scale ?? 1.0) * BAL.zombieScaleMul * zombieLevelScale(z);
  const w = f.w * scale;
  const h = f.h * scale;

  const bob = Math.sin(z.anim) * BAL.zombieBobAmp;
  const groundOffset = BAL.zombieGroundOffset * zombieLevelScale(z);
  const face = z.heading ?? (z.theta + (z.omega >= 0 ? Math.PI/2 : -Math.PI/2));
  const rot = face + (t.rotation ?? 0);
  const death = z.state === 'dying' ? (z.deathProgress ?? 0) : 0;
  const deathScale = 1 - death * 0.22;
  const deathTilt = death * 1.1;

  if (state.endgameVisuals && z.state !== 'dying'){
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

  if (!qualityLow){
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
  ctx.globalAlpha = 1 - death;
  ctx.scale(facing * deathScale, deathScale);
  ctx.rotate(rot * facing + deathTilt * facing);
  ctx.drawImage(
    img,
    fx, fy, f.w, f.h,
    -w * a.x,
    -h * a.y,
    w, h
  );
  ctx.restore();

  if ((z.level ?? 1) > 1){
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
  const skinTone = state.endgameVisuals && z.state !== 'dying' ? shade('#c85050', levelBoost * 8) : shade('#3cbe78', levelBoost * 10);
  const death = z.state === 'dying' ? (z.deathProgress ?? 0) : 0;
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

  if (!qualityLow){
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
  ctx.globalAlpha = 1 - death;
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
  for (const b of state.projectiles){
    // glow
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = b.glow;
    ctx.beginPath();
    ctx.arc(b.x,b.y,b.r*2.2,0,Math.PI*2);
    ctx.fill();
    ctx.restore();

    // core
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(b.x,b.y,b.r,0,Math.PI*2);
    ctx.fill();

    // small shape hint by kind
    if (b.kind === 'ap'){
      ctx.fillStyle = 'rgba(255,255,255,.25)';
      ctx.fillRect(b.x-1, b.y-4, 2, 8);
    }
    if (b.kind === 'he'){
      ctx.strokeStyle = 'rgba(255,255,255,.22)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(b.x,b.y,b.r+2,0,Math.PI*2);
      ctx.stroke();
    }
    if (b.kind === 'tesla'){
      ctx.strokeStyle = 'rgba(139,211,255,.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(b.x-6, b.y);
      ctx.lineTo(b.x+6, b.y);
      ctx.stroke();
    }
  }
}

function drawImpacts(){
  for (const fx of state.impacts){
    const t = fx.life / fx.max;

    if (qualityLow && fx.kind === 'overflow') continue;

    if (fx.kind === 'bolt'){
      if (qualityLow) continue;
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
let fpsAvg = 60;
let lastProgressSave = 0;
let qualityLow = false;
function loop(now){
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  fpsAvg = fpsAvg * 0.95 + (1 / Math.max(0.001, dt)) * 0.05;
  qualityLow = fpsAvg < 45;
  BAL.maxParticles = qualityLow ? 900 : 1600;
  BAL.maxDecals = qualityLow ? 70 : 120;
  if (nowSec() - lastProgressSave > 7){
    saveProgress();
    lastProgressSave = nowSec();
  }

  if (state.levelUpVfxUntil != null && nowSec() >= state.levelUpVfxUntil){
    state.timeScale = 1;
    state.levelUpVfxUntil = null;
  }

  updateCenterNotification();

  const effDt = dt * (state.timeScale ?? 1);
  if (!state.ui.menuOpen){
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
  }

  updateUI();
  draw();

  requestAnimationFrame(loop);
}

// ---------- Debug Panel (?debug=1) ----------
const DEBUG_MAX_TANK_LEVEL = 20;
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
  if (!DebugPanelEnabled) return;
  state.debug = state.debug || {
    log: [],
    targetCellIndex: null,
    talentOverrides: {},
    collapsed: false,
    previewParticles: [],
    debugStatusActive: false,
  };

  const main = document.querySelector('.layout');
  if (!main || document.getElementById('debugPanel')) return;

  main.classList.add('debugLayout');

  const panel = document.createElement('div');
  panel.id = 'debugPanel';
  panel.className = 'debugPanel';

  const activeNames = ['Шквал (Attack)', 'Перегрев (Speed)', 'Золотой час (Economy)'];
  const effectCategories = [
    { id: 'vfx', label: 'VFX' },
    { id: 'status', label: 'Status' },
  ];
  const vfxList = [
    { id: 'burst', label: 'Burst center' },
    { id: 'particle_burst', label: 'Particle burst' },
    { id: 'impact_ring', label: 'Impact ring' },
    { id: 'decal_pool', label: 'Decal pool' },
  ];
  const statusList = [
    { id: 'attack', key: 'attackUntil', label: 'Attack +50%' },
    { id: 'speed', key: 'speedUntil', label: 'Speed +35%' },
    { id: 'economy', key: 'economyUntil', label: 'Economy +60%' },
  ];

  panel.innerHTML = `
    <div class="debugPanelHeader">
      <span class="debugPanelTitle">Debug (?debug=1)</span>
      <button type="button" class="debugCollapseBtn" id="debugCollapse">Collapse</button>
    </div>
    <div class="debugTabs">
      <button type="button" class="debugTab active" data-tab="tanks">Tanks</button>
      <button type="button" class="debugTab" data-tab="effects">Effects</button>
      <button type="button" class="debugTab" data-tab="actives">Actives</button>
      <button type="button" class="debugTab" data-tab="talents">Talents</button>
      <button type="button" class="debugTab" data-tab="logs">Logs&Tools</button>
    </div>
    <div class="debugPanelBody">
      <div id="debugSectionTanks" class="debugSection active">
        <div class="debugRow">
          <label class="debugLabel">Tank level (1–${DEBUG_MAX_TANK_LEVEL})</label>
          <select id="debugTankLevel" class="debugSelect"></select>
        </div>
        <button type="button" class="debugBtn" id="debugSpawnTank">Spawn in free slot</button>
        <div class="debugRow" style="margin-top:8px">
          <label class="debugLabel">Hangar — select target</label>
          <div id="debugHangarList"></div>
        </div>
      </div>
      <div id="debugSectionEffects" class="debugSection">
        <div class="debugRow">
          <label class="debugLabel">Category</label>
          <select id="debugEffectCategory" class="debugSelect">
            <option value="all">All</option>
            <option value="vfx">VFX</option>
            <option value="status">Status</option>
          </select>
        </div>
        <div id="debugEffectList"></div>
        <div class="debugTools" style="margin-top:8px">
          <button type="button" class="debugBtn" id="debugStopAllVfx">Stop all preview VFX</button>
          <button type="button" class="debugBtn danger" id="debugClearStatuses">Clear debug statuses</button>
        </div>
      </div>
      <div id="debugSectionActives" class="debugSection">
        <div class="debugRow">
          <label class="debugLabel">Target: selected tank (info only)</label>
        </div>
        <div class="debugRow">
          <label><input type="checkbox" id="debugBypass" checked /> Bypass cooldown/cost</label>
        </div>
        <div id="debugActivesList"></div>
      </div>
      <div id="debugSectionTalents" class="debugSection">
        <div id="debugTalentsList"></div>
        <button type="button" class="debugBtn" id="debugClearOverrides">Clear talent overrides</button>
      </div>
      <div id="debugSectionLogs" class="debugSection">
        <button type="button" class="debugBtn" id="debugResetBtn">Reset (overrides + statuses + VFX)</button>
        <button type="button" class="debugBtn" id="debugClearLog">Clear log</button>
      </div>
    </div>
    <div class="debugLogWrap">
      <div id="debugLog"></div>
    </div>
  `;

  const tankLevelSelect = panel.querySelector('#debugTankLevel');
  for (let l = 1; l <= DEBUG_MAX_TANK_LEVEL; l++) tankLevelSelect.appendChild(new Option('Lv' + l, l));

  panel.querySelectorAll('.debugTab').forEach(btn => {
    btn.addEventListener('click', () => {
      panel.querySelectorAll('.debugTab').forEach(b => b.classList.remove('active'));
      panel.querySelectorAll('.debugSection').forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      const sectionId = 'debugSection' + tab.charAt(0).toUpperCase() + tab.slice(1);
      const section = panel.querySelector('#' + sectionId);
      if (section) section.classList.add('active');
      if (tab === 'tanks') refreshDebugHangarList();
      if (tab === 'effects') refreshDebugEffectList();
      if (tab === 'actives') refreshDebugActivesList();
      if (tab === 'talents') refreshDebugTalentsList();
    });
  });

  const collapseBtn = panel.querySelector('#debugCollapse');
  if (collapseBtn) collapseBtn.addEventListener('click', () => {
    state.debug.collapsed = !state.debug.collapsed;
    panel.classList.toggle('collapsed', state.debug.collapsed);
    collapseBtn.textContent = state.debug.collapsed ? 'Expand' : 'Collapse';
  });

  const spawnBtn = panel.querySelector('#debugSpawnTank');
  if (spawnBtn) spawnBtn.addEventListener('click', () => {
    safeDebug(() => {
      const level = Math.max(1, Math.min(DEBUG_MAX_TANK_LEVEL, Number(panel.querySelector('#debugTankLevel').value) || 1));
      const empty = state.cells.find(c => !c.tank);
      if (!empty) {
        debugLog('warn', 'No free hangar slot.');
        return;
      }
      empty.tank = makeTank(level, false);
      recordTankLevel(level);
      debugLog('info', `Spawned tank Lv${level} in slot ${empty.i}.`);
      refreshDebugHangarList();
    }, 'Spawn failed ');
  });

  const stopVfxBtn = panel.querySelector('#debugStopAllVfx');
  if (stopVfxBtn) stopVfxBtn.addEventListener('click', () => {
    safeDebug(() => {
      state.particles = state.particles.filter(p => !p.debugPreview);
      state.impacts = state.impacts.filter(fx => !fx.debugPreview);
      state.decals = state.decals.filter(d => !d.debugPreview);
      debugLog('info', 'Stopped all preview VFX.');
    }, 'Stop VFX failed ');
  });

  const clearStatusBtn = panel.querySelector('#debugClearStatuses');
  if (clearStatusBtn) clearStatusBtn.addEventListener('click', () => {
    safeDebug(() => {
      state.debug.debugStatusActive = false;
      state.activeEffects.attackUntil = 0;
      state.activeEffects.speedUntil = 0;
      state.activeEffects.economyUntil = 0;
      debugLog('info', 'Cleared debug statuses.');
    }, 'Clear statuses failed ');
  });

  const clearOverridesBtn = panel.querySelector('#debugClearOverrides');
  if (clearOverridesBtn) clearOverridesBtn.addEventListener('click', () => {
    safeDebug(() => {
      state.debug.talentOverrides = {};
      state.player.modsDirty = true;
      debugLog('info', 'Cleared talent overrides.');
      refreshDebugTalentsList();
    }, 'Clear overrides failed ');
  });

  const resetBtn = panel.querySelector('#debugResetBtn');
  if (resetBtn) resetBtn.addEventListener('click', () => debugReset());
  const clearLogBtn = panel.querySelector('#debugClearLog');
  if (clearLogBtn) clearLogBtn.addEventListener('click', () => {
    state.debug.log = [];
    const el = panel.querySelector('#debugLog');
    if (el) el.innerHTML = '';
    debugLog('info', 'Log cleared.');
  });

  function refreshDebugHangarList(){
    const container = panel.querySelector('#debugHangarList');
    if (!container) return;
    container.innerHTML = '';
    (state.cells || []).forEach((cell, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'debugBtn';
      btn.style.marginRight = '4px';
      btn.style.marginBottom = '4px';
      if (cell.tank) {
        btn.textContent = `#${i} Lv${cell.tank.level}`;
        btn.addEventListener('click', () => {
          state.debug.targetCellIndex = i;
          debugLog('info', `Target tank: slot ${i} Lv${cell.tank.level}.`);
          panel.querySelectorAll('#debugHangarList button').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        });
        if (state.debug.targetCellIndex === i) btn.classList.add('active');
      } else {
        btn.textContent = `#${i} empty`;
        btn.disabled = true;
      }
      container.appendChild(btn);
    });
  }

  function refreshDebugEffectList(){
    const container = panel.querySelector('#debugEffectList');
    if (!container) return;
    container.innerHTML = '';
    const catEl = panel.querySelector('#debugEffectCategory');
    const cat = catEl ? catEl.value : 'all';
    const showVfx = cat === 'all' || cat === 'vfx';
    const showStatus = cat === 'all' || cat === 'status';
    if (showVfx) {
      vfxList.forEach(ef => {
        const row = document.createElement('div');
        row.className = 'debugRow';
        row.innerHTML = `<span class="debugLabel">${ef.label}</span>
          <button type="button" class="debugBtn debugPlayVfx" data-id="${ef.id}">Play once</button>`;
        row.querySelector('button').addEventListener('click', () => {
          safeDebug(() => {
            const x = center.x + (Math.random() - 0.5) * 80;
            const y = center.y + (Math.random() - 0.5) * 80;
            if (ef.id === 'burst') {
              burst(x, y, 12, 'rgba(255,180,120,.25)');
              debugLog('info', 'VFX: Burst at center.');
            } else if (ef.id === 'particle_burst') {
              for (let i = 0; i < 8; i++) {
                const p = { x, y, r: 2, color: 'rgba(200,255,180,.4)', life: 0.4, max: 0.4, vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 60, debugPreview: true };
                state.particles.push(p);
              }
              debugLog('info', 'VFX: Particle burst.');
            } else if (ef.id === 'impact_ring') {
              state.impacts.push({ x, y, r: 0, maxR: 40, life: 0.3, max: 0.3, kind: 'he', debugPreview: true });
              debugLog('info', 'VFX: Impact ring.');
            } else if (ef.id === 'decal_pool') {
              state.decals.push({ kind: 'pool', x, y, r: 25, life: 5, max: 5, dps: 0, color: 'rgba(125,255,178,.14)', debugPreview: true });
              debugLog('info', 'VFX: Decal pool.');
            }
          }, 'VFX failed ');
        });
        container.appendChild(row);
      });
    }
    if (showStatus) {
      statusList.forEach(ef => {
        const row = document.createElement('div');
        row.className = 'debugRow';
        const dur = 6;
        row.innerHTML = `<span class="debugLabel">${ef.label}</span>
          <button type="button" class="debugBtn debugApplyStatus" data-key="${ef.key}">Apply ${dur}s</button>
          <button type="button" class="debugBtn debugRemoveStatus" data-key="${ef.key}">Remove</button>`;
        row.querySelector('.debugApplyStatus').addEventListener('click', () => {
          safeDebug(() => {
            state.activeEffects[ef.key] = nowSec() + dur;
            state.debug.debugStatusActive = true;
            debugLog('info', `Status: ${ef.label} applied ${dur}s.`);
          }, 'Apply status failed ');
        });
        row.querySelector('.debugRemoveStatus').addEventListener('click', () => {
          safeDebug(() => {
            state.activeEffects[ef.key] = 0;
            debugLog('info', `Status: ${ef.label} removed.`);
          }, 'Remove status failed ');
        });
        container.appendChild(row);
      });
    }
  }

  const effectCategoryEl = panel.querySelector('#debugEffectCategory');
  if (effectCategoryEl) effectCategoryEl.addEventListener('change', refreshDebugEffectList);

  function refreshDebugActivesList(){
    const container = panel.querySelector('#debugActivesList');
    if (!container) return;
    container.innerHTML = '';
    initTalentDefs();
    [0, 1, 2].forEach(branch => {
      const row = document.createElement('div');
      row.className = 'debugRow';
      const name = activeNames[branch] || 'Active ' + branch;
      row.innerHTML = `<span class="debugLabel">${name}</span>
        <button type="button" class="debugBtn debugActivateActive" data-branch="${branch}">Activate</button>`;
      row.querySelector('button').addEventListener('click', () => {
        safeDebug(() => {
          const bypassEl = panel.querySelector('#debugBypass');
          const bypass = bypassEl && bypassEl.checked;
          if (bypass) {
            const now = nowSec();
            state.player.activeCooldowns[branch] = now;
            if (branch === 0) state.activeEffects.attackUntil = now + 6;
            else if (branch === 1) state.activeEffects.speedUntil = now + 6;
            else if (branch === 2) state.activeEffects.economyUntil = now + 6;
            playSfx('activeAbility');
            burst(center.x, center.y, 60, branch === 0 ? 'rgba(255,120,90,.2)' : branch === 1 ? 'rgba(125,255,178,.22)' : 'rgba(255,215,125,.22)');
            state.debug.debugStatusActive = true;
            debugLog('info', `Active ${name} (bypass) activated.`);
          } else {
            if (!canUseActive(branch)) {
              debugLog('warn', `Active ${name}: cannot use (cooldown or not unlocked).`);
              return;
            }
            useActiveAbility(branch);
            debugLog('info', `Active ${name} activated.`);
          }
        }, 'Activate failed ');
      });
      container.appendChild(row);
    });
  }

  function refreshDebugTalentsList(){
    const container = panel.querySelector('#debugTalentsList');
    if (!container) return;
    container.innerHTML = '';
    initTalentDefs();
    TALENT_DEFS.forEach((def, i) => {
      const row = document.createElement('div');
      row.className = 'debugRow';
      const current = state.debug.talentOverrides[i] || 'normal';
      row.innerHTML = `<span class="debugLabel" title="${def.desc}">${def.name}</span>
        <select class="debugSelect debugTalentOverride" data-talent="${i}" style="width:auto;display:inline-block;margin-left:4px">
          <option value="normal" ${current === 'normal' ? 'selected' : ''}>Normal</option>
          <option value="on" ${current === 'on' ? 'selected' : ''}>Force ON</option>
          <option value="off" ${current === 'off' ? 'selected' : ''}>Force OFF</option>
        </select>`;
      row.querySelector('select').addEventListener('change', (e) => {
        const v = e.target.value;
        if (v === 'normal') delete state.debug.talentOverrides[i];
        else state.debug.talentOverrides[i] = v;
        state.player.modsDirty = true;
        debugLog('info', `Talent ${def.name}: ${v}.`);
      });
      container.appendChild(row);
    });
  }

  main.insertBefore(panel, main.firstChild);
  refreshDebugHangarList();
  refreshDebugEffectList();
  refreshDebugActivesList();
  refreshDebugTalentsList();
  debugLog('info', 'Debug panel ready. URL param: ' + DEBUG_PARAM + '=1');
}

// ---------- Boot ----------
async function boot(){
  loadSettings();
  const savedLang = localStorage.getItem('lang');
  if (savedLang && STRINGS[savedLang]) currentLang = savedLang;
  applyTranslations();
  ensureProgressUI();
  initTalentDefs();
  applySavedProgress(getSavedProgress());
  ensureTalentState();
  state.player.xpToNext = xpNeededForLevel(state.player.level);
  state.player.modsDirty = true;
  if (ui.langRu && ui.langEn){
    ui.langRu.addEventListener('click', () => setLanguage('ru'));
    ui.langEn.addEventListener('click', () => setLanguage('en'));
  }
  ui.menuContinue?.addEventListener('click', () => {
    setMenuOpen(false);
  });
  ui.menuNew?.addEventListener('click', () => {
    localStorage.removeItem('progress');
    resetGameState();
    saveProgress();
    setMenuOpen(false);
  });
  ui.menuSfx?.addEventListener('input', (e) => {
    const value = Number(e.target.value) / 100;
    settings.sfxVolume = clamp(value, 0, 1);
    applyAudioSettings();
    updateMenuVolumes();
    saveSettings();
  });
  ui.menuMusic?.addEventListener('input', (e) => {
    const value = Number(e.target.value) / 100;
    settings.musicVolume = clamp(value, 0, 1);
    applyAudioSettings();
    updateMenuVolumes();
    saveSettings();
  });
  ui.talentsBtn?.addEventListener('click', () => openTalents());
  ui.levelAccept?.addEventListener('click', () => acceptLevelReward());
  window.addEventListener('resize', resizeCanvas);
  if (window.visualViewport){
    window.visualViewport.addEventListener('resize', resizeCanvas);
  }
  resizeCanvas();
  state.nextCrateAt = nowSec() + BAL.crateIntervalSec;

  if (DebugPanelEnabled) initDebugPanel();

  // starter tanks
  if (state.cells[0] && state.cells[1] && !state.cells.some(c=>c.tank)){
    state.cells[0].tank = makeTank(1, true);
    state.cells[1].tank = makeTank(1, true);
    recordTankLevel(1);
  }

  await ZombieSprites.load();
  // optional tanks (won't break if missing)
  await TankSprites.load();

  ensureZombieCount();
  updateUI();
  setMenuOpen(true);
  requestAnimationFrame(loop);
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
