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
  dismantleBtn: document.getElementById('dismantleBtn'),
  dismantleModal: document.getElementById('dismantleModal'),
  dismantleConfirmText: document.getElementById('dismantleConfirmText'),
  dismantleYes: document.getElementById('dismantleYes'),
  dismantleNo: document.getElementById('dismantleNo'),
};

const MAX_TANK_LEVEL = 60;
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
  // Board 4x4
  rows: 4,
  cols: 4,
  cellW: 48,
  cellH: 38,
  cellGap: 5,
  boardPad: 8,

  buyCostLv1: 50,

  // Tanks
  dmgBase: 7,
  dmgMultPerLevel: 1.48,
  fireRateBase: 0.85,
  fireRateAddPerLevel: 0.075,
  rangeBase: 315,
  rangePerLevel: 10,

  // Zombie ring
  zombieTrackRadius: 340,
  zombieTrackWidth: 22,
  fenceRadius: 0,
  fenceWidth: 20,
  fenceKeepout: 12,
  zombieFencePush: 24,
  tankOrbitRadius: 250,
  tankOrbitSpeed: 0.55,
  tankTrackWidth: 16,
  zombieCountTarget: 150,
  corpseMaxCount: 150,
  zombieHpBase: 44,
  zombieHpVar: 0.22,
  omegaBase: 0.72,
  omegaVar: 0.18,
  zombieSwayAmp: 0.14,

  // Zombie visuals (walk + size) — fixed size, no level scaling
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

  // Spawn from edge
  edgeSpawnRadius: 520,
  edgeJoinSpeed: 0.9,

  // Economy
  coinsPerKillBase: 1,
  coinsPerKillLevelMul: 0.35,
  zombieKillCoinsMul: 0.5,
  zombieKillXpMul: 0.5,
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

  // Fence (configurable sprites; empty = procedural)
  fenceSpriteIds: [],

  // Decor (random placement, no-spawn zones)
  decorSpriteIds: [],
  decorCount: 24,
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
  fenceWidth: 20,
  fenceKeepout: 12,
  zombieFencePush: 24,
  tankOrbitRadius: 250,
  tankTrackWidth: 16,
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
    damageNumbers: [],
    decors: [],
    fenceSegments: [],
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
const nowSec = ()=>performance.now()/1000;
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));

const STRINGS = {
  ru: {
    title: 'Merge Tank: Zombie invasion',
    subtitle: 'В духе cut-the-rope • Ангар с оградой • Ходячие зомби • Поддержка спрайтов танков',
    menuTitle: 'Merge Tank: Zombie invasion',
    menuSubtitle: 'Главное меню выживших',
    menuContinue: 'Продолжить',
    menuNew: 'Новая игра',
    menuLanguage: 'Язык',
    menuSfx: 'Громкость эффектов',
    menuMusic: 'Громкость музыки',
    hudCoins: 'Деньги',
    hudKills: 'Убито монстров',
    hudSprites: 'Спрайты',
    hudBoost: 'Буст',
    buyTank: 'Купить танк {level} уровня',
    boostBtn: 'Буст скорости',
    boostModalText: 'Получить буст скорости в 2 раза на 60 секунд посмотрев рекламу',
    boostModalWatch: 'Посмотреть',
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
    talentsBtn: 'Древо талантов',
    talentTreeTitle: 'Древо талантов',
    talentPoints: 'Очки талантов',
    talentApply: 'Применить',
    talentReset: 'Сбросить выбор',
    talentResetAll: 'Сбросить таланты',
    talentResetModalText: 'Посмотрите видео чтобы сбросить таланты',
    talentResetModalWatchBtn: 'Посмотреть и сбросить',
    talentPending: 'Выбрано',
    talentNeedPoints: 'Не хватает очков',
    talentActive: 'Использовать активку',
    talentActiveCooldown: 'Активка ({sec}с)',
    levelLabel: 'Уровень',
    levelShort: 'Ур.',
    levelUp: 'Ур.{level}!',
    levelModalTitle: 'Вы достигли {level} уровня!',
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
    dismantleBtn: 'Разобрать танк',
    dismantleBtnConfirm: 'Подтвердить разбор',
    dismantleConfirm: 'Вы действительно хотите разобрать танк {level} уровня?',
    dismantleConfirmMulti: 'Вы действительно хотите разбить выбранные танки?',
    dismantleYes: 'Да',
    dismantleNo: 'Нет',
    dismantleNoneSelected: 'Не выбрано ни одного танка',
    dismantleCount: 'танков',
    dismantleMore: 'ещё',
    dropOnCrateReject: 'Место занято',
    menuSettings: 'Настройки',
    mergePopupTitle: 'Новый танк уровень {level}',
    mergePopupSubtitle: 'ОТКРЫТ НОВЫЙ УРОВЕНЬ ТАНКА!',
    mergePopupFight: 'В бой!',
    mergePopupClose: 'Закрыть',
    mergePopupDamageLabel: 'Урон',
    mergePopupFireRateLabel: 'Скорострельность',
    mergePopupRateUnit: '/с',
    mergePopupRangeLabel: 'Дальность',
    mergePopupBarrelsLabel: 'Стволы',
    lessonProgressTitle: 'Прогресс уроков',
    lessonRepeatNow: 'Повторить сейчас',
    lessonExportSchedule: 'Экспорт расписания',
    lessonImportSchedule: 'Импорт расписания',
    lessonPreviewAnki: 'Предпросмотр Anki',
    lessonHidePreview: 'Скрыть предпросмотр',
    lessonExportAnki: 'Экспорт Anki',
    lessonScoreLabel: 'Результат: {score}',
    lessonRepeat: 'Повторить',
    lessonAnki: 'Anki',
    lessonNextNotScheduled: 'Следующее: не запланировано',
    lessonNextDueNow: 'Следующее: сейчас',
    lessonNextIn: 'Следующее: через {time}',
    lessonNextReviewLabel: 'Следующее повторение: {text}',
    lessonNextReviewNone: 'Следующее повторение: нет',
    lessonDueNotScheduled: 'не запланировано',
    lessonDueNow: 'сейчас',
    lessonDueIn: 'через {time}',
    lessonScheduleExported: 'Расписание экспортировано',
    lessonScheduleImported: 'Импортировано элементов: {count}',
    lessonPreviewUnavailable: 'Предпросмотр недоступен.',
    lessonBasics: 'Основы: Слияние танков',
    lessonCombat: 'Бой: Паттерны стрельбы',
    lessonEconomy: 'Экономика: Стратегия монет',
    lessonDefense: 'Оборона: Волны зомби',
    lessonAdvanced: 'Продвинутое: Мультиствол',
    experimentsTitle: 'Эксперименты',
    experimentsRefresh: 'Обновить',
    experimentsClear: 'Сбросить назначения',
    experimentsReset: 'Сбросить конфиг',
    experimentsEmpty: 'Эксперименты не заданы.',
    experimentsEnabled: 'Включено',
    experimentsRollout: 'Роллаут %',
    experimentsForce: 'Форс',
    experimentsAuto: 'auto',
    funnelTitle: 'Воронка',
    funnelRefresh: 'Обновить',
    funnelExport: 'Экспорт JSON',
    funnelReset: 'Сбросить воронку',
    funnelCompleted: 'готово',
    funnelPending: 'ожидание',
    funnelDrop: 'drop-off',
    funnelFirstLaunch: 'Первый запуск',
    funnelFirstMerge: 'Первый merge',
    funnelFirstBattle: 'Первый бой',
    funnelFirstUpgrade: 'Первый апгрейд',
    funnelReturnVisit: 'Повторный вход',
    triageTitle: 'Триаж багов',
    triageExport: 'Экспорт JSON',
    triageClear: 'Очистить',
    triageTitleLabel: 'Заголовок',
    triageNotesLabel: 'Заметки',
    triageStatusLabel: 'Статус',
    triagePriorityLabel: 'Приоритет',
    triageReproLabel: 'Воспроизведение',
    triageSystemLabel: 'Система',
    triageAdd: 'Добавить баг',
    triageEmpty: 'Баги не заведены.',
    triageAttachTelemetry: 'Привязать телеметрию',
    triageRemove: 'Удалить',
    triageTelemetryAttached: 'Телеметрия привязана',
  },
  en: {
    title: 'Merge Tank: Zombie invasion',
    subtitle: 'Cut-the-rope-ish • Fence hangar • Walking zombies • Tank sprites supported',
    menuTitle: 'Merge Tank: Zombie invasion',
    menuSubtitle: 'Survivor main menu',
    menuContinue: 'Continue',
    menuNew: 'New game',
    menuLanguage: 'Language',
    menuSfx: 'SFX volume',
    menuMusic: 'Music volume',
    hudCoins: 'Money',
    hudKills: 'Monsters defeated',
    hudSprites: 'Sprites',
    hudBoost: 'Boost',
    buyTank: 'Buy tank Lv{level}',
    boostBtn: 'Speed boost',
    boostModalText: 'Get 2x speed boost for 60 seconds by watching an ad',
    boostModalWatch: 'Watch',
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
    talentsBtn: 'Talent Tree',
    talentTreeTitle: 'Talent Tree',
    talentPoints: 'Talent points',
    talentApply: 'Apply',
    talentReset: 'Reset selection',
    talentResetAll: 'Reset talents',
    talentResetModalText: 'Watch a video to reset talents',
    talentResetModalWatchBtn: 'Watch and reset',
    talentPending: 'Selected',
    talentNeedPoints: 'Not enough points',
    talentActive: 'Use active',
    talentActiveCooldown: 'Active ({sec}s)',
    levelLabel: 'Level',
    levelShort: 'Lv',
    levelUp: 'Lv{level}!',
    levelModalTitle: 'You reached level {level}!',
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
    dismantleBtn: 'Dismantle tank',
    dismantleBtnConfirm: 'Confirm dismantle',
    dismantleConfirm: 'Do you really want to dismantle tank level {level}?',
    dismantleConfirmMulti: 'Do you really want to dismantle the selected tanks?',
    dismantleYes: 'Yes',
    dismantleNo: 'No',
    dismantleNoneSelected: 'No tanks selected',
    dismantleCount: 'tanks',
    dismantleMore: 'more',
    dropOnCrateReject: 'Place occupied',
    menuSettings: 'Settings',
    mergePopupTitle: 'New tank level {level}',
    mergePopupSubtitle: 'NEW TANK LEVEL UNLOCKED!',
    mergePopupFight: 'Fight!',
    mergePopupClose: 'Close',
    mergePopupDamageLabel: 'Damage',
    mergePopupFireRateLabel: 'Fire rate',
    mergePopupRateUnit: '/s',
    mergePopupRangeLabel: 'Range',
    mergePopupBarrelsLabel: 'Barrels',
    lessonProgressTitle: 'Lesson Progress',
    lessonRepeatNow: 'Repeat now',
    lessonExportSchedule: 'Export schedule',
    lessonImportSchedule: 'Import schedule',
    lessonPreviewAnki: 'Preview Anki',
    lessonHidePreview: 'Hide Preview',
    lessonExportAnki: 'Export Anki',
    lessonScoreLabel: 'Score: {score}',
    lessonRepeat: 'Repeat',
    lessonAnki: 'Anki',
    lessonNextNotScheduled: 'Next: not scheduled',
    lessonNextDueNow: 'Next: due now',
    lessonNextIn: 'Next: in {time}',
    lessonNextReviewLabel: 'Next review: {text}',
    lessonNextReviewNone: 'Next review: none',
    lessonDueNotScheduled: 'not scheduled',
    lessonDueNow: 'due now',
    lessonDueIn: 'in {time}',
    lessonScheduleExported: 'Schedule exported',
    lessonScheduleImported: 'Imported schedule items: {count}',
    lessonPreviewUnavailable: 'Preview unavailable.',
    lessonBasics: 'Basics: Merge Tanks',
    lessonCombat: 'Combat: Fire Patterns',
    lessonEconomy: 'Economy: Coin Strategy',
    lessonDefense: 'Defense: Zombie Waves',
    lessonAdvanced: 'Advanced: Multi-Barrel',
    experimentsTitle: 'Experiments',
    experimentsRefresh: 'Refresh',
    experimentsClear: 'Clear assignments',
    experimentsReset: 'Reset config',
    experimentsEmpty: 'No experiments defined.',
    experimentsEnabled: 'Enabled',
    experimentsRollout: 'Rollout %',
    experimentsForce: 'Force',
    experimentsAuto: 'auto',
    funnelTitle: 'Funnel',
    funnelRefresh: 'Refresh',
    funnelExport: 'Export JSON',
    funnelReset: 'Reset funnel',
    funnelCompleted: 'done',
    funnelPending: 'pending',
    funnelDrop: 'drop-off',
    funnelFirstLaunch: 'First launch',
    funnelFirstMerge: 'First merge',
    funnelFirstBattle: 'First battle',
    funnelFirstUpgrade: 'First upgrade',
    funnelReturnVisit: 'Return visit',
    triageTitle: 'Bug triage',
    triageExport: 'Export JSON',
    triageClear: 'Clear all',
    triageTitleLabel: 'Title',
    triageNotesLabel: 'Notes',
    triageStatusLabel: 'Status',
    triagePriorityLabel: 'Priority',
    triageReproLabel: 'Repro',
    triageSystemLabel: 'System',
    triageAdd: 'Add bug',
    triageEmpty: 'No bugs tracked.',
    triageAttachTelemetry: 'Attach telemetry',
    triageRemove: 'Remove',
    triageTelemetryAttached: 'Telemetry attached',
  }
};

if (window.Game && window.Game.I18n && window.Game.I18n.setFallback) {
  window.Game.I18n.setFallback(STRINGS);
}

let currentLang = 'ru';

function getI18n(){
  return window.Game && window.Game.I18n ? window.Game.I18n : null;
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
const ZombieSprites = {
  ready: false,
  error: '',
  atlasImg: null,
  types: [],
  deathCommon: null,
  async load(){
    try{
      const res = await fetch('assets/zombies.json', {cache:'no-store'});
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const atlasPath = 'assets/' + (data.atlas || 'zombie_atlas.png');
      const img = await loadImage(atlasPath);

      // Parse common death animation
      if (data.deathCommon) {
        this.deathCommon = {
          x: data.deathCommon.x ?? 0,
          y: data.deathCommon.y ?? 0,
          w: data.deathCommon.w ?? 96,
          h: data.deathCommon.h ?? 96,
          frames: data.deathCommon.frames ?? 1
        };
      } else {
        this.deathCommon = null;
      }

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
        // Personal death animation (optional)
        death: t.death ? {
          x: t.death.x ?? 0,
          y: t.death.y ?? 0,
          w: t.death.w ?? t.frame?.w ?? 96,
          h: t.death.h ?? t.frame?.h ?? 96,
          frames: t.death.frames ?? 1
        } : null,
      }));
      if (!this.types.length) throw new Error('types[] empty');

      this.atlasImg = img;
      this.ready = true;
      this.error = '';
    }catch(e){
      this.ready = false;
      this.atlasImg = null;
      this.types = [];
      this.deathCommon = null;
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
  },
  pickTypeByLevel(level){
    if (!this.ready || !this.types.length) return null;
    const lvl = Math.max(1, Math.min(60, Math.floor(level)));
    const id = 'zombie_lvl' + lvl;
    const found = this.types.find(t => t.id === id);
    if (found) return found;
    const idx = (lvl - 1) % this.types.length;
    return this.types[idx] || this.types[0];
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
      for (const id of Object.keys(cfg?.bodies || {})){
        const b = cfg.bodies[id];
        if (b?.src) srcs.add('assets/' + b.src);
      }
      for (const cannon of cfg?.cannons || []){
        if (cannon?.src) srcs.add('assets/' + cannon.src);
      }
      for (const id of Object.keys(cfg?.auras || {})){
        const a = cfg.auras[id];
        if (a && typeof a === 'object' && a.src) srcs.add('assets/' + a.src);
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
  resolveVariant(level, key){
    const levels = this.config?.levels;
    if (!levels || !Array.isArray(levels)) return null;
    const lvl = Math.max(1, Math.min(60, Math.floor(level)));
    for (let L = lvl; L >= 1; L--){
      const entry = levels[L - 1];
      if (entry && entry[key] != null) return entry[key];
    }
    return null;
  },
  pickBody(level){
    if (!this.ready || !this.config?.body?.src) return null;
    const bodyVariant = level != null ? this.resolveVariant(level, 'bodyVariant') : null;
    const bodies = this.config?.bodies;
    const cfg = (bodies && bodyVariant && bodies[bodyVariant]) ? bodies[bodyVariant] : this.config.body;
    if (!cfg?.src) return null;
    const full = 'assets/' + cfg.src;
    const img = this.cache.get(full);
    if (!img) return null;
    return { img, cfg };
  },
  pickCannon(level){
    if (!this.ready || !this.config?.cannons?.length) return null;
    const cannonVariant = level != null ? this.resolveVariant(level, 'cannonVariant') : null;
    const cannons = this.config.cannons;
    let chosen = null;
    if (cannonVariant){
      chosen = cannons.find(c => c.id === cannonVariant);
      if (!chosen && typeof console !== 'undefined' && console.warn) console.warn('TankSprites: unknown cannonVariant', cannonVariant);
    }
    if (!chosen){
      const sorted = [...cannons].sort((a,b)=>a.minLevel - b.minLevel);
      for (const cannon of sorted){
        if (cannon.minLevel <= level) chosen = cannon;
      }
    }
    if (!chosen?.src) return null;
    const full = 'assets/' + chosen.src;
    const img = this.cache.get(full);
    if (!img) return null;
    return { img, cfg: chosen };
  },
  pickAura(level){
    if (!this.ready) return null;
    const auraVariant = level != null ? this.resolveVariant(level, 'auraVariant') : null;
    if (auraVariant == null || typeof auraVariant !== 'string') return null;
    const auras = this.config?.auras;
    const cfg = auras?.[auraVariant];
    if (!cfg?.src) return null;
    const full = 'assets/' + cfg.src;
    const img = this.cache.get(full);
    if (!img) return null;
    return { img, cfg };
  }
};

if (typeof window !== 'undefined') {
  window.TankSprites = TankSprites;
  window.Game = window.Game || {};
  window.Game.TankSprites = TankSprites;
}

const FenceSprites = {
  ready: false,
  error: '',
  atlasImg: null,
  framesById: new Map(),
  async load(){
    try{
      const res = await fetch('assets/fence.json', {cache:'no-store'});
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const atlasPath = 'assets/' + (data.atlas || 'fence.png');
      const img = await loadImage(atlasPath);
      this.atlasImg = img;
      this.framesById.clear();
      const autoIds = [];
      for (const f of (data.frames || [])){
        const id = f.id || String(this.framesById.size);
        this.framesById.set(id, { x: f.x ?? 0, y: f.y ?? 0, w: f.h ?? 32, h: f.h ?? 32, anchor: f.anchor || { x: 0.5, y: 0.5 } });
        autoIds.push(id);
      }
      // Авто-инициализация BAL.fenceSpriteIds, если пустой
      if ((BAL.fenceSpriteIds || []).length === 0 && autoIds.length > 0) {
        BAL.fenceSpriteIds = autoIds;
        // Сбросить сегменты забора для пересборки
        if (state && Array.isArray(state.fenceSegments)) {
          state.fenceSegments = [];
        }
      }
      this.ready = true;
      this.error = '';
    }catch(e){
      this.ready = false;
      this.atlasImg = null;
      this.framesById.clear();
      this.error = String(e);
    }
  },
  pickFrame(spriteId){
    return this.framesById.get(spriteId) || this.framesById.values().next().value;
  }
};

const DecorSprites = {
  ready: false,
  error: '',
  atlasImg: null,
  framesById: new Map(),
  async load(){
    try{
      const res = await fetch('assets/decor.json', {cache:'no-store'});
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const atlasPath = 'assets/' + (data.atlas || 'decor.png');
      const img = await loadImage(atlasPath);
      this.atlasImg = img;
      this.framesById.clear();
      for (const f of (data.frames || [])){
        const id = f.id || String(this.framesById.size);
        this.framesById.set(id, { x: f.x ?? 0, y: f.y ?? 0, w: f.w ?? 24, h: f.h ?? 24, anchor: f.anchor || { x: 0.5, y: 0.8 } });
      }
      this.ready = true;
      this.error = '';
    }catch(e){
      this.ready = false;
      this.atlasImg = null;
      this.framesById.clear();
      this.error = String(e);
    }
  },
  pickFrame(spriteId){
    return this.framesById.get(spriteId) || this.framesById.values().next().value;
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

  const hangarRadius = Math.max(totalW, totalH) / 2 + 12;
  const orbitPad = Math.max(10, 24 + BAL.tankTrackWidth);
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
  initDecors();
}

function initDecors(){
  state.decors = [];
  const ids = BAL.decorSpriteIds || [];
  const count = Math.min(Math.max(0, BAL.decorCount || 0), 200);
  if (!ids.length || count <= 0) return;
  const zones = BAL.decorNoSpawnZones || [];
  const maxAttempts = BAL.decorMaxAttempts || 400;
  const innerR = (BAL.tankOrbitRadius || 200) + 50;
  const outerR = Math.min(viewSize.w, viewSize.h) / 2 - 30;
  if (outerR <= innerR) return;
  for (let n = 0; n < count; n++){
    for (let attempt = 0; attempt < maxAttempts; attempt++){
      const angle = Math.random() * Math.PI * 2;
      const r = innerR + Math.random() * (outerR - innerR);
      const x = center.x + Math.cos(angle) * r;
      const y = center.y + Math.sin(angle) * r;
      let inZone = false;
      for (const z of zones){
        if (z.r != null && Math.hypot(x - (z.cx ?? z.x ?? 0), y - (z.cy ?? z.y ?? 0)) <= z.r) inZone = true;
        if (z.w != null && z.h != null && x >= (z.x ?? 0) && x <= (z.x ?? 0) + z.w && y >= (z.y ?? 0) && y <= (z.y ?? 0) + z.h) inZone = true;
      }
      if (!inZone){
        state.decors.push({ x, y, spriteId: ids[Math.floor(Math.random() * ids.length)] });
        break;
      }
    }
  }
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

function bumpBuyPrice(level){
  const current = ensureBuyPrice(level);
  const delta = Math.max(1, Math.ceil(current * 0.001));
  state.buyPrices[level] = current + delta;
}

function tryBuyTank(){
  const level = buyTankLevel();
  const cost = buyTankCost(level);
  const Garage = window.Game && window.Game.Garage;
  const freeIdx = Garage ? Garage.findFreeCell(state) : (state.cells.find(c=>!c.tank)?.i ?? null);
  if (freeIdx == null || state.coins < cost) return;
  const empty = state.cells[freeIdx];
  if (!empty || empty.tank || (state.crate && state.crate.cellIndex === empty.i)) return;
  state.coins -= cost;
  empty.tank = makeTank(level, false);
  recordTankLevel(level);
  state.buyCounts[level] = (state.buyCounts[level] || 0) + 1;
  bumpBuyPrice(level);
  popText(empty.x+empty.w/2, empty.y+empty.h/2, t('popTank'), '#7dffb2');
  if (window.Game && window.Game.Telemetry) window.Game.Telemetry.event('buyTank');
  if (window.Game && window.Game.TelemetryLogger) window.Game.TelemetryLogger.log('buyTank', { level: level });
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
  const fmt = window.Game && window.Game.NumberFormat ? window.Game.NumberFormat.formatCompactRu : (n)=>String(Math.round(n));
  if (ui.levelGold) ui.levelGold.textContent = t('levelModalGold', {gold: fmt(reward.gold)});
  if (ui.levelAccept) ui.levelAccept.textContent = t('levelUpAccept');
}

function openLevelModal(){
  if (!ui.levelModal) return;
  ui.levelModal.classList.remove('hidden');
  ui.levelModal.setAttribute('aria-hidden', 'false');
  a11yOpen(ui.levelModal, { initialFocus: ui.levelAccept, onClose: closeLevelModal });
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
  a11yClose(ui.levelModal);
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
  const def = { id, branch, name, desc, maxRank, prev, kind, apply, row: layout.row, slot: layout.slot, parents: layout.parents };
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
  state.coins = saved.coins != null ? saved.coins : state.coins;
  state.kills = saved.kills != null ? saved.kills : state.kills;
  if (saved.player) Object.assign(state.player, saved.player);
  if (saved.buyCounts) state.buyCounts = saved.buyCounts;
  if (saved.buyPrices) state.buyPrices = saved.buyPrices;
  if (saved.maxTankLevelAchieved != null) state.maxTankLevelAchieved = saved.maxTankLevelAchieved;
  if (saved.boostUntil != null) state.boostUntil = saved.boostUntil;
  if (saved.activeEffects) state.activeEffects = { ...state.activeEffects, ...saved.activeEffects };
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

const PROJECTILE_KINDS = {
  ap: { kind:'ap', speed: 820, r: 4.0, color:'#ffd36b', glow:'rgba(255,211,107,.25)', trail:'rgba(255,211,107,.12)', aoeBase: 18, aoePerLevel: 2.4, aoeMin: 16, aoeMax: 40 },
  he: { kind:'he', speed: 740, r: 5.6, color:'#ff7a6b', glow:'rgba(255,122,107,.26)', trail:'rgba(255,122,107,.12)', aoeBase: 28, aoePerLevel: 3.2, aoeMin: 24, aoeMax: 58 },
  toxic: { kind:'toxic', speed: 700, r: 5.0, color:'#b8ff3b', glow:'rgba(184,255,59,.22)', trail:'rgba(184,255,59,.10)', aoeBase: 30, aoePerLevel: 3.4, aoeMin: 26, aoeMax: 64, poolLife: 3.6, poolDpsMul: 0.20 },
  tesla: { kind:'tesla', speed: 900, r: 4.6, color:'#8bd3ff', glow:'rgba(139,211,255,.25)', trail:'rgba(139,211,255,.10)', aoeBase: 26, aoePerLevel: 2.8, aoeMin: 26, aoeMax: 66, chainRange: 84, chainJumps: 3, chainMul: 0.45 },
};

function projectileProfile(level){
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

const MAX_ZOMBIE_LEVEL = 60;

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
  let aliveCount = 0;

  for (const z of state.zombies){
    if (z.state === 'dying') continue;
    aliveCount++;
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
    if (z.state === 'dying') continue;
    if (!Number.isFinite(z.slotIndex)){
      const idx = missing.shift();
      if (idx === undefined) break;
      assignZombieSlot(z, idx, slotCount);
    }
  }

  while (aliveCount < target){
    const idx = missing.shift();
    state.zombies.push(makeZombie(true, idx ?? aliveCount, slotCount));
    aliveCount++;
  }
}

function zombiePos(z){
  return {
    x: center.x + Math.cos(z.theta) * z.r,
    y: center.y + Math.sin(z.theta) * z.r,
  };
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
  const angularSpeed = BAL.tankOrbitSpeed * speedMult() * mods.orbitSpeedMul * activeSpeed;
  for (const cell of state.cells){
    const tank = cell.tank;
    if (!tank || !tank.onTrack) continue;
    if (cell.orbitPhase !== undefined) cell.orbitPhase += dt * angularSpeed;

    tank.cooldown = Math.max(0, tank.cooldown - dt);
    const hasSpriteConfig = TankSprites?.ready && TankSprites?.config?.body && (TankSprites?.config?.cannons?.length || 0) > 0;
    if (hasSpriteConfig){
      const bodyCfg = TankSprites.config.body;
      tank.bodyAnim += dt * (bodyCfg.animSpeed ?? 2.0);
    }

    const s = tankStats(tank.level);
    const mods = getMods();

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
        tank.cannonAnim += dt * (cannonCfg.animSpeed ?? 10.0) * speedMult();
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
      const finalDmg = baseDmg * (isCrit ? 1.5 : 1);
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
    const finalChainDmg = baseChainDmg * (isCrit ? 1.5 : 1);
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
      collapsed: wasCollapsed ?? false,
      previewParticles: [],
      debugStatusActive: false,
      zombieCountCache: { at: 0, text: '' },
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
        <span class="talentNodeIcon">${def.kind === 'active' ? '⚡' : '◆'}</span>
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
  const modal = document.getElementById('boostModal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  a11yClose(modal);
}

function openResetTalentsModal(){
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
  const modal = document.getElementById('resetTalentsModal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  a11yClose(modal);
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
  a11yOpen(ui.crateModal, { initialFocus: ui.crateGet, onClose: closeCrateModal });
  renderCrateIcon(state.crate.rewardLevel ?? 1);
}

function closeCrateModal(){
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

canvas.addEventListener('pointerdown', (e)=>{
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
ui.boost.addEventListener('click', () => openBoostModal());
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

// ---------- Render ----------
function draw(){
  ctx.clearRect(0,0,viewSize.w,viewSize.h);

  drawBackground();
  drawDecors();
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
  drawDamageNumbers();
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

function drawDecors(){
  if (!state.decors || !state.decors.length) return;
  if (!DecorSprites.ready || !DecorSprites.atlasImg) return;
  for (const d of state.decors){
    const frame = DecorSprites.pickFrame(d.spriteId);
    if (!frame) continue;
    const scale = 0.5 * balScale;
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
  const ids = BAL.fenceSpriteIds || [];
  const useSprites = FenceSprites.ready && ids.length > 0;

  ctx.save();
  ctx.translate(center.x, center.y);

  if (useSprites){
    if (!state.fenceSegments || state.fenceSegments.length === 0){
      state.fenceSegments = [];
      const segments = 40;
      for (let i = 0; i < segments; i++){
        const a = (i / segments) * Math.PI * 2;
        const sid = ids[Math.floor(Math.random() * ids.length)];
        state.fenceSegments.push({ a, spriteId: sid });
      }
    }
    for (const seg of state.fenceSegments){
      const frame = FenceSprites.pickFrame(seg.spriteId);
      if (!frame || !FenceSprites.atlasImg) continue;
      const px = Math.cos(seg.a) * r;
      const py = Math.sin(seg.a) * r;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(seg.a);
      const scale = (BAL.fenceWidth / Math.max(frame.w, frame.h)) * 1.2;
      const ax = frame.anchor?.x ?? 0.5;
      const ay = frame.anchor?.y ?? 0.5;
      ctx.drawImage(
        FenceSprites.atlasImg,
        frame.x, frame.y, frame.w, frame.h,
        -frame.w * scale * ax, -frame.h * scale * ay,
        frame.w * scale, frame.h * scale
      );
      ctx.restore();
    }
  } else {
    state.fenceSegments = [];
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
  }

  ctx.restore();
}

function drawFence(br){
  // simple fence around hangar (visual only)
  ctx.save();

  // Clip to board rect so corner posts don't overlap the road (T2)
  ctx.beginPath();
  rr(ctx, br.x, br.y, br.w, br.h, 16);
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

  const isDying = z.state === 'dying';
  const hasDeathAnim = isDying && z.deathAnim;
  
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
  const w = (hasDeathAnim ? z.deathAnim.w : f.w) * scale;
  const h = (hasDeathAnim ? z.deathAnim.h : f.h) * scale;

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
  if (!DebugPanelEnabled) return;
  state.debug = state.debug || {
    log: [],
    targetCellIndex: null,
    talentOverrides: {},
    collapsed: false,
    previewParticles: [],
    debugStatusActive: false,
    zombieCountCache: { at: 0, text: '' },
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
      <button type="button" class="debugTab" data-tab="zombies">Zombies</button>
      <button type="button" class="debugTab" data-tab="roads">Roads/Hangar</button>
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
        <div id="debugTankComposition" class="debugRow" style="margin-top:6px;font-size:11px"></div>
        <div id="debugMergePossible" class="debugRow" style="margin-top:4px;font-size:11px"></div>
        <div id="debugAuraBand" class="debugRow" style="margin-top:4px;font-size:11px"></div>
        <button type="button" class="debugBtn" id="debugDismantleBtn" style="margin-top:6px">Dismantle selected tank</button>
        <button type="button" class="debugBtn" id="debugOpenSettings">Open Settings</button>
      </div>
      <div id="debugSectionZombies" class="debugSection">
        <div id="debugZombieCounts" class="debugRow" style="font-size:11px;margin-bottom:6px"></div>
        <div id="debugZombieWeights" class="debugRow" style="font-size:11px;margin-bottom:6px"></div>
        <div class="debugRow">
          <button type="button" class="debugBtn debugSimSpawns" data-n="100">Simulate 100 spawns</button>
          <button type="button" class="debugBtn debugSimSpawns" data-n="1000">Simulate 1000 spawns</button>
        </div>
        <div id="debugSimResults" class="debugRow" style="font-size:11px;margin-top:6px;white-space:pre-wrap;max-height:120px;overflow:auto"></div>
      </div>
      <div id="debugSectionRoads" class="debugSection">
        <div class="debugRow"><label class="debugLabel">Zombie track radius</label><input type="range" id="debugZombieRadius" min="200" max="450" step="5" /><span id="debugZombieRadiusVal"></span></div>
        <div class="debugRow"><label class="debugLabel">Tank orbit radius</label><input type="range" id="debugTankRadius" min="150" max="320" step="5" /><span id="debugTankRadiusVal"></span></div>
        <div class="debugRow"><label class="debugLabel">Cell width</label><input type="range" id="debugCellW" min="30" max="70" step="2" /><span id="debugCellWVal"></span></div>
        <div class="debugRow"><label class="debugLabel">Cell height</label><input type="range" id="debugCellH" min="22" max="50" step="2" /><span id="debugCellHVal"></span></div>
        <div class="debugRow" style="margin-top:8px">
          <button type="button" class="debugBtn" id="debugApplyRoads">Apply</button>
          <button type="button" class="debugBtn" id="debugResetRoads">Reset to defaults</button>
        </div>
        <div id="debugRoadsNote" class="debugRow" style="font-size:10px;color:var(--muted);margin-top:4px"></div>
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
        <button type="button" class="debugBtn" id="lessonProgressBtn">Lesson Progress</button>
        <div id="debugTelemetryMount"></div>
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
      if (tab === 'tanks') { refreshDebugHangarList(); refreshDebugTankExtras(); }
      if (tab === 'effects') refreshDebugEffectList();
      if (tab === 'zombies') { refreshDebugZombieWeights(); refreshDebugZombieCounts(); }
      if (tab === 'roads') refreshDebugRoadsSliders();
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
      refreshDebugTankExtras();
    }, 'Spawn failed ');
  });

  const dismantleDebugBtn = panel.querySelector('#debugDismantleBtn');
  if (dismantleDebugBtn) dismantleDebugBtn.addEventListener('click', () => {
    safeDebug(() => {
      const idx = state.debug.targetCellIndex;
      const cell = idx != null && state.cells[idx] ? state.cells[idx] : null;
      if (!cell?.tank) { debugLog('warn', 'Select a slot with a tank first.'); return; }
      state.selectedHangarCellIndex = idx;
      openDismantleModal();
    }, 'Dismantle failed ');
  });

  const openSettingsBtn = panel.querySelector('#debugOpenSettings');
  if (openSettingsBtn) openSettingsBtn.addEventListener('click', () => setMenuOpen(true));

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
          refreshDebugTankExtras();
        });
        if (state.debug.targetCellIndex === i) btn.classList.add('active');
      } else {
        btn.textContent = `#${i} empty`;
        btn.disabled = true;
      }
      container.appendChild(btn);
    });
    refreshDebugTankExtras();
  }

  function refreshDebugTankExtras(){
    const compEl = panel.querySelector('#debugTankComposition');
    const mergeEl = panel.querySelector('#debugMergePossible');
    const auraEl = panel.querySelector('#debugAuraBand');
    const dismantleBtn = panel.querySelector('#debugDismantleBtn');
    const counts = tankLevelCounts();
    const levels = Array.from(counts.keys()).sort((a,b)=>a-b);
    const total = levels.reduce((s,l)=>s+(counts.get(l)||0),0);
    if (compEl) compEl.textContent = total ? 'By level: ' + levels.map(l=>`Lv${l}:${counts.get(l)}`).join(', ') : 'No tanks (excl. unopened crates).';
    const idx = state.debug.targetCellIndex;
    const cell = idx != null && state.cells[idx] ? state.cells[idx] : null;
    const tank = cell?.tank;
    if (mergeEl) {
      if (!tank) mergeEl.textContent = 'Merge possible: — (select a tank)';
      else {
        const sameLevel = state.cells.some(c=>c !== cell && c.tank && c.tank.level === tank.level);
        const atMax = tank.level >= MAX_TANK_LEVEL;
        mergeEl.textContent = 'Merge possible: ' + (sameLevel && !atMax ? 'Yes' : (atMax ? 'No (max level)' : 'No (no same-level tank)'));
      }
    }
    if (auraEl) {
      if (!tank) auraEl.textContent = 'Aura band: —';
      else {
        const band = computeAuraBand(tank.level);
        auraEl.textContent = 'Level ' + tank.level + ' → Aura band: ' + (band == null ? 'none (<10)' : band);
      }
    }
    if (dismantleBtn) dismantleBtn.disabled = !tank || (tank.onTrack === true);
  }

  function refreshDebugZombieWeights(){
    const el = panel.querySelector('#debugZombieWeights');
    if (!el) return;
    const weights = zombieLevelWeights();
    el.textContent = weights.length ? 'Weights: ' + weights.map(w=>`Lv${w.level} ${(w.weight*100).toFixed(1)}%`).join(', ') : 'No tanks → fallback Lv1 100%';
  }

  function refreshDebugZombieCounts(){
    const el = panel.querySelector('#debugZombieCounts');
    if (!el) return;
    const now = nowSec();
    const cache = state.debug.zombieCountCache || { at: 0, text: '' };
    if (!cache.at || (now - cache.at) >= 0.5) {
      const zombies = state.zombies || [];
      let dying = 0;
      for (const z of zombies) { if (z.state === 'dying') dying++; }
      const total = zombies.length;
      const alive = total - dying;
      const target = BAL.zombieCountTarget;
      cache.at = now;
      cache.text = 'Alive: ' + alive + ' | Dying: ' + dying + ' | Target: ' + target + ' | Total: ' + total;
      cache.alive = alive;
      cache.dying = dying;
      cache.target = target;
      cache.total = total;
      state.debug.zombieCountCache = cache;
    }
    el.textContent = cache.text || 'Alive: 0 | Dying: 0 | Target: ' + BAL.zombieCountTarget + ' | Total: 0';
  }

  function refreshDebugRoadsSliders(){
    const rZ = panel.querySelector('#debugZombieRadius');
    const rT = panel.querySelector('#debugTankRadius');
    const cW = panel.querySelector('#debugCellW');
    const cH = panel.querySelector('#debugCellH');
    const vZ = panel.querySelector('#debugZombieRadiusVal');
    const vT = panel.querySelector('#debugTankRadiusVal');
    const vW = panel.querySelector('#debugCellWVal');
    const vH = panel.querySelector('#debugCellHVal');
    if (rZ) { rZ.value = BAL.zombieTrackRadius; if (vZ) vZ.textContent = BAL.zombieTrackRadius; }
    if (rT) { rT.value = BAL.tankOrbitRadius; if (vT) vT.textContent = BAL.tankOrbitRadius; }
    if (cW) { cW.value = BAL.cellW; if (vW) vW.textContent = BAL.cellW; }
    if (cH) { cH.value = BAL.cellH; if (vH) vH.textContent = BAL.cellH; }
  }

  panel.querySelectorAll('.debugSimSpawns').forEach(btn => {
    btn.addEventListener('click', () => {
      safeDebug(() => {
        const n = Number(btn.dataset.n) || 100;
        const counts = {};
        for (let i = 0; i < n; i++) {
          const lvl = pickZombieLevel();
          counts[lvl] = (counts[lvl] || 0) + 1;
        }
        const levels = Object.keys(counts).map(Number).sort((a,b)=>a-b);
        const lines = levels.map(l=>`Lv${l}: ${counts[l]} (${(counts[l]/n*100).toFixed(1)}%)`);
        const el = panel.querySelector('#debugSimResults');
        if (el) el.textContent = `Simulated ${n} spawns:\n` + lines.join('\n');
        debugLog('info', `Simulated ${n} zombie spawns.`);
      }, 'Simulate failed ');
    });
  });

  ['debugZombieRadius','debugTankRadius','debugCellW','debugCellH'].forEach(id => {
    const input = panel.querySelector('#' + id);
    const valId = id + 'Val';
    const valEl = panel.querySelector('#' + valId);
    if (input && valEl) input.addEventListener('input', () => { valEl.textContent = input.value; });
  });

  const applyRoadsBtn = panel.querySelector('#debugApplyRoads');
  if (applyRoadsBtn) applyRoadsBtn.addEventListener('click', () => {
    safeDebug(() => {
      const rZ = panel.querySelector('#debugZombieRadius');
      const rT = panel.querySelector('#debugTankRadius');
      const cW = panel.querySelector('#debugCellW');
      const cH = panel.querySelector('#debugCellH');
      if (rZ) BAL.zombieTrackRadius = Number(rZ.value);
      if (rT) BAL.tankOrbitRadius = Number(rT.value);
      if (cW) BAL.cellW = Number(cW.value);
      if (cH) BAL.cellH = Number(cH.value);
      initBoard();
      const note = panel.querySelector('#debugRoadsNote');
      if (note) note.textContent = 'Applied. Resize may override; reload for persistent defaults.';
      debugLog('info', 'Roads/hangar applied.');
    }, 'Apply failed ');
  });

  const resetRoadsBtn = panel.querySelector('#debugResetRoads');
  if (resetRoadsBtn) resetRoadsBtn.addEventListener('click', () => {
    safeDebug(() => {
      BAL.zombieTrackRadius = BASE_BAL.zombieTrackRadius;
      BAL.tankOrbitRadius = BASE_BAL.tankOrbitRadius;
      BAL.cellW = BASE_BAL.cellW;
      BAL.cellH = BASE_BAL.cellH;
      BAL.cellGap = BASE_BAL.cellGap;
      BAL.boardPad = BASE_BAL.boardPad;
      initBoard();
      refreshDebugRoadsSliders();
      const note = panel.querySelector('#debugRoadsNote');
      if (note) note.textContent = '';
      debugLog('info', 'Roads/hangar reset to defaults.');
    }, 'Reset failed ');
  });

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

  state.debug.refreshHangarList = refreshDebugHangarList;
  state.debug.refreshTankExtras = refreshDebugTankExtras;
  state.debug.refreshZombieWeights = refreshDebugZombieWeights;
  state.debug.refreshZombieCounts = refreshDebugZombieCounts;
  state.debug.refreshRoadsSliders = refreshDebugRoadsSliders;
  main.insertBefore(panel, main.firstChild);
  refreshDebugHangarList();
  refreshDebugEffectList();
  refreshDebugActivesList();
  refreshDebugTalentsList();
  // Init telemetry debug widget
  if (window.Game && window.Game.Telemetry) {
    var telMount = panel.querySelector('#debugTelemetryMount');
    if (telMount) window.Game.Telemetry.initUI(telMount);
  }
  debugLog('info', 'Debug panel ready. URL param: ' + DEBUG_PARAM + '=1');
}

// ---------- Boot ----------
async function boot(){
  loadSettings();
  const savedLang = localStorage.getItem('lang');
  if (savedLang) setLanguage(savedLang);
  else setLanguage(currentLang);
  const i18n = getI18n();
  if (i18n && typeof i18n.onReady === 'function') {
    i18n.onReady(() => {
      applyTranslations();
      updateUI();
      if (window.Game && window.Game.LessonProgress && window.Game.LessonProgress.renderList) {
        window.Game.LessonProgress.renderList();
      }
    });
  }
  ensureProgressUI();
  initTalentDefs();
  let loaded = null;
  if (window.Game && window.Game.Storage) {
    loaded = window.Game.Storage.loadGame();
    if (loaded) {
      if (loaded.legacyProgress) applySavedProgress(loaded.legacyProgress);
      if (loaded.meta && loaded.meta.lastSeenAt != null) meta.lastSeenAt = loaded.meta.lastSeenAt;
    }
  } else {
    applySavedProgress(getSavedProgress());
  }
  ensureTalentState();
  state.player.xpToNext = xpNeededForLevel(state.player.level);
  state.player.modsDirty = true;
  if (ui.langRu && ui.langEn){
    ui.langRu.addEventListener('click', () => setLanguage('ru'));
    ui.langEn.addEventListener('click', () => setLanguage('en'));
  }
  ui.menuContinue?.addEventListener('click', () => {
    const ContinueFlow = window.Game && window.Game.ContinueFlow;
    const OfflineModal = window.Game && window.Game.OfflineModal;
    const AdService = window.Game && window.Game.AdService;
    if (ContinueFlow && OfflineModal && AdService) {
      ContinueFlow.onContinueClick(state, meta, () => setMenuOpen(false), (rewards) => {
        if (!rewards || (rewards.coins === 0 && rewards.xp === 0)) return;
        OfflineModal.showOfflineRewardsModal({
          coins: rewards.coins,
          xp: rewards.xp,
          onConfirm() {
            OfflineModal.setClaiming(true);
            AdService.requestRewardedAd().then((result) => {
              if (result && result.success) {
                state.coins += rewards.coins;
                state.player.xp += rewards.xp;
                grantXP(0);
                meta.lastSeenAt = Date.now();
                saveProgress();
                OfflineModal.hideModal();
                updateUI();
              }
              OfflineModal.setClaiming(false);
            });
          },
        });
      });
      return;
    }
    setMenuOpen(false);
  });
  ui.menuNew?.addEventListener('click', () => {
    localStorage.removeItem('progress');
    resetGameState();
    meta.lastSeenAt = Date.now();
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
  ui.settingsBtn?.addEventListener('click', () => setMenuOpen(true));
  const settingsTooltip = document.getElementById('settingsTooltip');
  if (ui.settingsBtn && settingsTooltip){
    ui.settingsBtn.addEventListener('mouseenter', () => {
      settingsTooltip.textContent = t('menuSettings');
      settingsTooltip.classList.remove('hidden');
      settingsTooltip.setAttribute('aria-hidden', 'false');
    });
    ui.settingsBtn.addEventListener('mousemove', (e) => {
      settingsTooltip.style.left = e.clientX + 'px';
      settingsTooltip.style.top = (e.clientY + 12) + 'px';
      settingsTooltip.style.transform = 'translate(-50%, 0)';
    });
    ui.settingsBtn.addEventListener('mouseleave', () => {
      settingsTooltip.classList.add('hidden');
      settingsTooltip.setAttribute('aria-hidden', 'true');
    });
    // Touch: show tooltip immediately on tap, no delay (T4)
    ui.settingsBtn.addEventListener('touchstart', (e) => {
      settingsTooltip.textContent = t('menuSettings');
      settingsTooltip.classList.remove('hidden');
      settingsTooltip.setAttribute('aria-hidden', 'false');
      const touch = e.touches[0];
      if (touch) {
        settingsTooltip.style.left = touch.clientX + 'px';
        settingsTooltip.style.top = (touch.clientY + 24) + 'px';
        settingsTooltip.style.transform = 'translate(-50%, 0)';
      }
    }, { passive: true });
    ui.settingsBtn.addEventListener('touchend', () => {
      settingsTooltip.classList.add('hidden');
      settingsTooltip.setAttribute('aria-hidden', 'true');
    });
  }
  ui.levelAccept?.addEventListener('click', () => acceptLevelReward());
  window.addEventListener('resize', resizeCanvas);
  if (window.visualViewport){
    window.visualViewport.addEventListener('resize', resizeCanvas);
  }
  resizeCanvas();
  if (loaded && loaded.state) restoreFullState(loaded.state);
  state.nextCrateAt = state.nextCrateAt || nowSec() + BAL.crateIntervalSec;

  // Load telemetry lifetime data (before debug panel init)
  if (window.Game && window.Game.Telemetry) {
    window.Game.Telemetry.loadLifetime();
  }

  if (window.Game && window.Game.Flags) {
    window.Game.Flags.init();
  }

  if (window.Game && window.Game.MobileMode) {
    window.Game.MobileMode.init();
  }

  if (window.Game && window.Game.Experiments) {
    window.Game.Experiments.init();
  }

  if (window.Game && window.Game.Funnel) {
    window.Game.Funnel.init();
  }

  if (DebugPanelEnabled) initDebugPanel();

  if (DebugPanelEnabled && window.Game && window.Game.AdminFlags) {
    window.Game.AdminFlags.init();
  }

  // starter tanks
  if (state.cells[0] && state.cells[1] && !state.cells.some(c=>c.tank)){
    state.cells[0].tank = makeTank(1, true);
    state.cells[1].tank = makeTank(1, true);
    recordTankLevel(1);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && window.Game && window.Game.Storage) {
      meta.lastSeenAt = Date.now();
      window.Game.Storage.saveGame(state, meta);
    }
  });
  window.addEventListener('pagehide', () => {
    if (window.Game && window.Game.Storage) {
      meta.lastSeenAt = Date.now();
      window.Game.Storage.saveGame(state, meta);
    }
  });

  await ZombieSprites.load();
  // optional tanks (won't break if missing)
  await TankSprites.load();
  FenceSprites.load().catch(() => {});
  DecorSprites.load().catch(() => {});

  // Initialize merge popup
  if (window.Game && window.Game.MergePopup) {
    window.Game.MergePopup.init();
  }

  // Pack 2: Initialize TelemetryLogger
  if (window.Game && window.Game.TelemetryLogger) {
    window.Game.TelemetryLogger.init();
  }

  if (window.Game && window.Game.Experiments) {
    window.Game.Experiments.attachTelemetry();
  }

  if (window.Game && window.Game.Funnel) {
    window.Game.Funnel.trackStep('first_launch', { hasSave: !!(loaded && loaded.state) });
    if (meta && meta.lastSeenAt != null) {
      window.Game.Funnel.maybeTrackReturn(meta.lastSeenAt);
    }
  }

  // Pack 2: Initialize LessonProgress
  if (window.Game && window.Game.LessonProgress) {
    window.Game.LessonProgress.init();
  }

  // Pack 2: Hook Anki export button
  if (window.Game && window.Game.AnkiExport) {
    window.Game.AnkiExport.hookUI();
  }

  // Initialize debug-only zombie animation preview
  if (window.Game && window.Game.ZombieAnimPreview) {
    window.Game.ZombieAnimPreview.init();
  }

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
