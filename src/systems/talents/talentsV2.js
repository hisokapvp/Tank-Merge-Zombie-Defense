(function (global) {
  'use strict';

  var TREE_PATH = 'assets/balance/talentTree_v2.json';
  var ALLOWED_EFFECT_TYPES = {
    stat_add: true,
    stat_mul: true,
    unlock: true,
    param: true,
  };
  var DEBUG_LOCALSTORAGE_KEYS = {
    dtScale: 'debug_dtScale',
    fixedDtMs: 'debug_fixedDtMs',
    forceChance: 'talents_debug_forceChance',
    forceChanceKey: 'talents_debug_forceChanceKey',
    showIcons: 'talents_debug_showIcons',
    dump: 'talents_debug_dump',
  };
  var DEFAULT_MAX_CATCHUP_STEPS = 120;
  var RESPEC_PRICE_BASE = 500;
  var RESPEC_PRICE_MULTIPLIER = 10;
  var RESPEC_PRICE_CAP = 4.99e16;
  var RESPEC_COOLDOWN_MS = 120 * 60 * 1000;
  var LEGACY_BRANCH_LAYOUT = [
    { row: 0, slot: 0, parents: [] },
    { row: 0, slot: 1, parents: [] },
    { row: 0, slot: 2, parents: [] },
    { row: 1, slot: 0, parents: [0] },
    { row: 1, slot: 1, parents: [0, 1, 2] },
    { row: 1, slot: 2, parents: [2] },
    { row: 2, slot: 0, parents: [3] },
    { row: 2, slot: 1, parents: [3, 4, 5] },
    { row: 2, slot: 2, parents: [5] },
    { row: 3, slot: 0, parents: [6] },
    { row: 3, slot: 1, parents: [6, 7, 8] },
    { row: 3, slot: 2, parents: [8] },
    { row: 4, slot: 0, parents: [9, 10] },
    { row: 4, slot: 2, parents: [10, 11] },
    { row: 5, slot: 0, parents: [12] },
    { row: 5, slot: 2, parents: [13] },
    { row: 6, slot: 1, parents: [14, 15] },
  ];
  var DEV_MODE = !!(global && global.location && (
    global.location.protocol === 'file:' ||
    global.location.hostname === 'localhost' ||
    global.location.hostname === '127.0.0.1' ||
    /[?&]debug=1(?:[&#]|$)/.test(global.location.search || '')
  ));

  var LEGACY_V1_TALENT_ORDER = [
    'Калибр',
    'Бронебойные',
    'Фокусировка',
    'Дальний выстрел',
    'Разрывные боеприпасы',
    'Широкий взрыв',
    'Отравляющие осколки',
    'Токсичная волна',
    'Кислотный урон',
    'Горящий яд',
    'Контроль зоны',
    'Разгон урона',
    'Смертоносный заряд',
    'Шрапнель',
    'Огневой поток',
    'Снайперский финал',
    'Активка: Шквал',
    'Калибровка затвора',
    'Турбозатвор',
    'Двойной выстрел',
    'Дуплет',
    'Стабильная орбита',
    'Рывок орбиты',
    'Синхронизация',
    'Механизм спарки',
    'Импульс',
    'Реактивный контур',
    'Сокращение перезарядки',
    'Молниеносность',
    'Сверхскорострельность',
    'Серия',
    'Разгон орбиты',
    'Стартовый импульс',
    'Активка: Перегрев',
    'Скидки',
    'Оптовые закупки',
    'Увеличенный выкуп',
    'Премия за убийство',
    'Копилка опыта',
    'Ускоренное обучение',
    'Снабжение',
    'Казначей',
    'Экономия топлива',
    'Инвестор',
    'Бонус за выстрел',
    'Золотая лихорадка',
    'Скидка на снаряды',
    'Программа лояльности',
    'Стимул обучения',
    'Контракт века',
    'Активка: Золотой час',
  ];

  var MIGRATE_V1_TO_V2 = {
    'Калибр': { id: 'off_caliber', op: 'addRankFromOld' },
    'Бронебойные': { id: 'off_armor_piercing_proc', op: 'setRankIfBought', value: 1 },
    'Кислотный урон': { id: 'off_acid_dot', op: 'addRankFromOld' },
    'Горящий яд': { id: 'off_convert_to_dot', op: 'addRankIfBought', value: 2 },
    'Контроль зоны': { id: 'off_aoe', op: 'addRankFromOld' },
    'Огневой поток': { id: 'off_caliber', op: 'addRankFromOld' },
    'Снайперский финал': { id: 'off_range', op: 'addRankIfBought', value: 3 },
    'Активка: Шквал': { id: 'off_active_barrage', op: 'setRankIfBought', value: 1 },
    'Фокусировка': { id: 'off_range', op: 'addRankFromOld' },
    'Дальний выстрел': { id: 'off_range', op: 'addRankIfBought', value: 2 },
    'Разрывные боеприпасы': { id: 'off_aoe', op: 'addRankFromOld' },
    'Широкий взрыв': { id: 'off_aoe', op: 'addRankIfBought', value: 2 },
    'Отравляющие осколки': { id: 'off_acid_dot', op: 'addRankFromOld' },
    'Токсичная волна': { id: 'off_convert_to_dot', op: 'addRankIfBought', value: 2 },

    'Синхронизация': { id: 'off_fire_rate', op: 'addRankFromOld' },
    'Импульс': { id: 'off_impulse_proc', op: 'setRankIfBought', value: 1 },
    'Сверхскорострельность': { id: 'off_fire_rate', op: 'addRankFromOld' },
    'Калибровка затвора': { id: 'off_fire_rate', op: 'addRankFromOld' },
    'Турбозатвор': { id: 'off_fire_rate', op: 'addRankIfBought', value: 2 },
    'Стартовый импульс': { id: 'off_impulse_proc', op: 'setRankIfBought', value: 1 },
    'Активка: Перегрев': { id: 'off_active_barrage', op: 'setRankIfBought', value: 1 },
    'Механизм спарки': { id: 'off_multishot', op: 'addRankFromOld' },
    'Двойной выстрел': { id: 'off_multishot', op: 'addRankFromOld' },
    'Серия': { id: 'off_multishot', op: 'addRankIfBought', value: 2 },
    'Дуплет': { id: 'off_multishot', op: 'addRankIfBought', value: 2 },
    'Разгон орбиты': { id: 'off_orbit_speed', op: 'addRankFromOld' },
    'Стабильная орбита': { id: 'off_orbit_speed', op: 'addRankFromOld' },
    'Рывок орбиты': { id: 'off_orbit_speed', op: 'addRankIfBought', value: 2 },

    'Скидки': { id: 'eco_buy_discount', op: 'addRankFromOld' },
    'Экономия топлива': { id: 'eco_buy_discount', op: 'addRankFromOld' },
    'Скидка на снаряды': { id: 'eco_buy_discount', op: 'addRankFromOld' },
    'Оптовые закупки': { id: 'eco_bulk_buy', op: 'setRankIfBought', value: 1 },
    'Контракт века': { id: 'eco_century_contract', op: 'setRankIfBought', value: 1 },
    'Увеличенный выкуп': { id: 'eco_coins_kill_bonus', op: 'addRankFromOld' },
    'Снабжение': { id: 'eco_coins_kill_bonus', op: 'addRankFromOld' },
    'Казначей': { id: 'eco_coins_kill_bonus', op: 'addRankIfBought', value: 2 },
    'Программа лояльности': { id: 'eco_coins_kill_bonus', op: 'addRankFromOld' },
    'Бонус за выстрел': { id: 'eco_coins_shot_bonus', op: 'addRankFromOld' },
    'Премия за убийство': { id: 'eco_coins_kill_bonus', op: 'ensureMinRank', value: 3 },
    'Копилка опыта': { id: 'eco_xp_bonus', op: 'addRankFromOld' },
    'Инвестор': { id: 'eco_xp_bonus', op: 'addRankFromOld' },
    'Стимул обучения': { id: 'eco_xp_bonus', op: 'addRankFromOld' },
    'Ускоренное обучение': { id: 'eco_xp_bonus', op: 'addRankIfBought', value: 2 },
    'Золотая лихорадка': { id: 'eco_xp_bonus', op: 'addRankIfBought', value: 2 },
  };

  var BASE_MODS_TEMPLATE = Object.freeze({
    damageMul: 1,
    fireRateMul: 1,
    rangeMul: 1,
    aoeMul: 1,
    orbitSpeedMul: 1,
    coinsKillMul: 1,
    coinsShotMul: 1,
    xpMul: 1,
    wallHpMul: 1,
    wallDrPct: 0,
    wallArmorFlat: 0,
    wallArmorMul: 1,
    tankBuyCostMul: 1,
    mergeExtraLevelChance: 0,
    repairCostMul: 1,
    upgradeCostMul_guns: 1,
    upgradeCostMul_sc: 1,
    upgradeCostMul_wall: 1,
    upgradeCostMul_drone: 1,
    /* taxReliefCostMul: removed in solo-pipeline-yandex-vk#1 item 4 (Гениальный инженер) — legacy field. */
    voucherDiscountMul: 1,
    brokenSegmentDamageMul: 1,
    executeDamageMul: 0,
    markDamageTakenMul: 1,
    acidDotDpsMul: 1,
    pulseAoeDamageMul: 1,
    pulseAoeMul: 1,
    // pulseRadiusMul: canonical alias for pulseAoeMul used by game.js bullet-AoE
    // wiring. Resolved via getModNumber(mods, 'pulseRadiusMul', ['pulseAoeMul'], 1)
    // — same alias-fallback pattern as pulseDamageMul/pulseAoeDamageMul (see L2835).
    pulseRadiusMul: 1,
    ricochetDamageMul: 1,
    convertToDotPct: 0,
    convertToDotDurationMs: 0,
    convertToDotStackMode: null,
    doubleShotChance: 0,
    tripleShotChance: 0,
    ricochetChance: 0,
    // solo-pipeline-yandex-vk#1 batch#1 item 2 (Мастер-ремонтник): шанс полного
    // ремонта всех фрагментов забора при manual или drone repair (0,2%/rank, cap 2%).
    // Старые ключи doubleRewardChanceKill/Shot удалены вместе с их apply-paths.
    fullRepairChancePerRank: 0,
    // solo-pipeline-yandex-vk#1 batch#1 item 3 (Толковый кладовщик): сокращение
    // killCostForBox(boxIndex) на 4% за ранг (cap 40%). Множитель=1-clamp(reduction,0,cap).
    boxReagentReductionPerRank: 0,
    acidDotChance: 0,
    acidDotDurationMs: 0,
    armorPiercingProcChance: 0,
    armorPiercingProcDamageMul: 1,
    armorPiercingProcDurationMs: 0,
    armorPiercingProcIcdMs: 0,
    impulseProcChance: 0,
    impulseProcDurationMs: 0,
    impulseProcFireRateMul: 1,
    impulseProcIcdMs: 0,
    markChance: 0,
    markDurationMs: 0,
    executeHpThreshold: 0,
    ccMicroChance: 0,
    ccMicroIcdMs: 0,
    ccMicroMode: null,
    ccMicroSlowDurationMs: 0,
    ccMicroSlowPct: 0,
    rampUpFireRatePerStack: 0,
    rampUpTickMs: 0,
    rampUpStackMax: 0,
    rampUpGraceMs: 0,
    crowdAoeDamageMul: 1,
    crowdMinCount: 0,
    pulseAoeEveryN: 0,
    offenseActiveDurationMs: 0,
    offenseActiveDamageMul: 1,
    offenseActiveFireRateMul: 1,
    offenseActiveOrbitMul: 1,
    offenseActiveAoeMul: 1,
    offenseActiveCharges: 0,
    offenseActiveRechargeMs: 0,
    regenPctPerSec: 0,
    regenDelayMs: 0,
    wallRegenPctPerSec: 0,
    wallRegenDelayMs: 0,
    wallShieldPct: 0,
    wallShieldCapPct: 0,
    wallShieldPeriodMs: 0,
    slowFieldPct: 0,
    slowFieldRadius: 0,
    wallSlowFieldPct: 0,
    wallSlowFieldRadius: 0,
    thornsPct: 0,
    thornsRadius: 0,
    thornsIcdMs: 0,
    barbedWirePctOfMaxTankBaseDamage: 0,
    wallBarrierHpThreshold: 0,
    wallBarrierDrPct: 0,
    wallBarrierDurationMs: 0,
    wallBarrierIcdMs: 0,
    stunOnWallHitChance: 0,
    stunOnWallHitDurationMs: 0,
    stunOnWallHitIcdMs: 0,
    secondWindRestorePct: 0,
    secondWindCooldownMs: 0,
    autoRepairPct: 0,
    autoRepairPeriodMs: 0,
    repairEfficiencyMul: 1,
    droneRepairSpeedBonusPerRank: 0,
    damageBlessingTiers: null,
    protectAheadAnalyzeMs: 0,
    protectAheadBuffMs: 0,
    protectAheadArmorPerRank: 0,
    repairDiscountTimerPeriodMs: 0,
    repairDiscountTimerCostMul: 1,
    repairDiscountPeriodMs: 0,
    repairDiscountMul: 1,
    explosiveBaseDamagePerRank: 0,
    explosiveBaseRadiusPx: 0,
    explosiveBaseDamageCapPerFrame: 0,
    immunityProcChance: 0,
    immunityProcDurationMs: 0,
    immunityProcIcdMs: 0,
    resistAcidPct: 0,
    resistExplosionPct: 0,
    resistFirePct: 0,
    resistXPct: 0,
    resistByZombieLevel: null,
    defenseActiveDurationMs: 0,
    defenseActiveDamageTakenMul: 1,
    defenseActiveAutoRepairPctPerSec: 0,
    defenseActiveCharges: 0,
    defenseActiveRechargeMs: 0,
    interestPct: 0,
    interestPeriodMs: 0,
    voucherKillsNeed: 0,
    voucherCap: 0,
    lotterySameLevelChance: 0,
    lotteryPlus5Chance: 0,
    lotteryDroneL1Chance: 0,
    cleanDefenseCoinsMul: 1,
    cleanDefenseXpMul: 1,
    greyToDamagePointsMul: 0,
    /* critKillCoinsBonusFlat: removed in solo-pipeline-yandex-vk#1 batch#1 item 3 (rebrand
       eco_crit_kill_bonus -> Толковый кладовщик). Old flat crit-coin bonus apply-path in
       onKill deleted; replaced by boxReagentReductionPerRank consumed in productionLine. */
    killBountyChance: 0,
    killBountyCoinsMul: 1,
    killBountyDurationMs: 0,
    killBountyIcdMs: 0,
    /* taxReliefDurationMs: removed in solo-pipeline-yandex-vk#1 item 4 (Гениальный инженер) — legacy field. */
    critKillXpMul: 1,
    economyActiveDurationMs: 0,
    economyActiveCoinsMul: 1,
    economyActiveXpMul: 1,
    economyActiveCharges: 0,
    economyActiveRechargeMs: 0,
    ricochetBouncesBase: 0,
    ricochetBouncesFromRank: 0,
    ricochetBouncesValue: 0,
    ricochetRadius: 0,
    offenseActive: false,
    defenseActive: false,
    economyActive: false,
    acidDot: false,
    armorPiercingProc: false,
    impulseProc: false,
    mark: false,
    execute: false,
    ccMicro: false,
    rampUp: false,
    pulseAoe: false,
    convertToDot: false,
    ricochet: false,
    wallShield: false,
    slowField: false,
    thorns: false,
    wallBarrier: false,
    stunOnWallHit: false,
    secondWind: false,
    autoRepair: false,
    protectAhead: false,
    repairDiscountTimer: false,
    explosiveBase: false,
    immunityProc: false,
    bulkBuy: false,
    chipMania: false,
    bulkBuyCostMul: 1,
    chipManiaFragmentChance: 0,
    cleanDefense: false,
    greyToDamagePoints: false,
    interest: false,
    mergeExtraLevel: false,
    voucher: false,
    lottery: false,
    killBounty: false,
  });

  var MODS_WHITELIST_KEYS = Object.keys(BASE_MODS_TEMPLATE);
  var MODS_WHITELIST_SET = {};
  for (var mw = 0; mw < MODS_WHITELIST_KEYS.length; mw++) {
    MODS_WHITELIST_SET[MODS_WHITELIST_KEYS[mw]] = true;
  }

  var runtime = {
    tree: null,
    talentsById: {},
    talentsByBranch: {},
    branches: [],
    tierUnlockSpent: [0, 5, 10, 20, 30],
    caps: {},
    ranksById: {},
    pendingById: {},
    freePoints: 0,
    respec: {
      resetCount: 0,
      cooldownEndsAtMs: 0,
    },
    modsCache: null,
    modsDirty: true,
    loadSaveFn: null,
    saveFn: null,
    assetLoader: null,
    nowMsFn: function () { return Date.now(); },
    getMaxTankBaseDamageFn: null,
    runRt: null,
    loadedTalentsVersion: 0,
    migratedFromVersion: null,
    lastValidationIssues: [],
    _debug: {
      lastReadAtMs: 0,
      config: {
        dtScale: 1,
        fixedDtMs: 0,
        forceChanceAll: false,
        forceChanceKey: '',
        showIcons: true,
        dumpEnabled: false,
      },
      channels: {
        onUpdate: { rawTimeMs: 0, virtualTimeMs: 0 },
        tickStatuses: { rawTimeMs: 0, virtualTimeMs: 0 },
      },
      warnAtByKey: {},
      hotkeysBound: false,
      counters: {
        shotCalls: 0,
        hitCalls: 0,
        directHitCalls: 0,
      },
      lastSeen: {
        tank: null,
        zombie: null,
      },
    },
  };
  var DOT_TICK_STEP_MS = 200;
  var DOT_KEYS = ['acid', 'converted'];

  function isFiniteNumber(value) {
    return Number.isFinite(value);
  }

  function toInt(value, fallback) {
    var num = Number(value);
    if (!isFiniteNumber(num)) return fallback;
    return Math.floor(num);
  }

  function toNumber(value, fallback) {
    var num = Number(value);
    return isFiniteNumber(num) ? num : fallback;
  }

  function clamp(value, min, max) {
    var num = toNumber(value, min);
    if (num < min) return min;
    if (num > max) return max;
    return num;
  }

  function cloneObject(source) {
    var out = {};
    if (!source || typeof source !== 'object') return out;
    var keys = Object.keys(source);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      out[key] = source[key];
    }
    return out;
  }

  function sanitizeRespecState(source) {
    var payload = asObject(source) || {};
    var resetCount = Math.max(0, toInt(payload.resetCount, 0));
    var cooldownEndsAtMs = Math.max(0, toNumber(payload.cooldownEndsAtMs, 0));
    if (!isFiniteNumber(cooldownEndsAtMs)) cooldownEndsAtMs = 0;
    return {
      resetCount: resetCount,
      cooldownEndsAtMs: cooldownEndsAtMs,
    };
  }

  function cloneRespecState(source) {
    return sanitizeRespecState(source);
  }

  function issue(level, code, message, details) {
    var out = {
      level: level,
      code: code,
      message: message,
    };
    if (details && typeof details === 'object') out.details = details;
    return out;
  }

  function pushIssue(list, level, code, message, details) {
    if (!Array.isArray(list)) return;
    list.push(issue(level, code, message, details));
  }

  function appendIssues(target, source) {
    if (!Array.isArray(target) || !Array.isArray(source) || source.length <= 0) return;
    for (var i = 0; i < source.length; i++) target.push(source[i]);
  }

  function toLowerString(value) {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
  }

  function normalizeChanceKey(key) {
    var raw = toLowerString(key).replace(/[^a-z0-9]/g, '');
    if (!raw) return '';
    var map = {
      acid: 'acid',
      aciddot: 'acid',
      mark: 'mark',
      ricochet: 'ricochet',
      cc: 'cc',
      crowd: 'cc',
      armorpiercing: 'armorpiercing',
      impulse: 'impulse',
      killbounty: 'killbounty',
      immunity: 'immunity',
      stun: 'stun',
      lottery: 'lottery',
      doublerewardkill: 'doublerewardkill',
      doublerewardshot: 'doublerewardshot',
    };
    return map[raw] || raw;
  }

  function safeGetLocalStorageItem(key) {
    if (!key || !global || !global.localStorage) return null;
    try {
      return global.localStorage.getItem(key);
    } catch (_) {
      return null;
    }
  }

  function toBoolFromStorage(rawValue, fallback) {
    if (rawValue === null || rawValue === undefined || rawValue === '') return fallback;
    var s = toLowerString(String(rawValue));
    if (!s) return fallback;
    if (s === '0' || s === 'false' || s === 'off' || s === 'no') return false;
    if (s === '1' || s === 'true' || s === 'on' || s === 'yes') return true;
    return fallback;
  }

  function readDebugConfig(nowMs) {
    var dbg = runtime._debug;
    var now = toNumber(nowMs, runtime.nowMsFn());
    if (now - toNumber(dbg.lastReadAtMs, 0) < 250) return dbg.config;

    var dtScale = toNumber(safeGetLocalStorageItem(DEBUG_LOCALSTORAGE_KEYS.dtScale), 1);
    if (!isFiniteNumber(dtScale) || dtScale <= 0) dtScale = 1;
    dtScale = clamp(dtScale, 0.1, 20);

    var fixedDtMs = toNumber(safeGetLocalStorageItem(DEBUG_LOCALSTORAGE_KEYS.fixedDtMs), 0);
    if (!isFiniteNumber(fixedDtMs) || fixedDtMs < 0) fixedDtMs = 0;
    fixedDtMs = clamp(fixedDtMs, 0, 10000);

    dbg.config = {
      dtScale: dtScale,
      fixedDtMs: fixedDtMs,
      forceChanceAll: toBoolFromStorage(safeGetLocalStorageItem(DEBUG_LOCALSTORAGE_KEYS.forceChance), false),
      forceChanceKey: normalizeChanceKey(safeGetLocalStorageItem(DEBUG_LOCALSTORAGE_KEYS.forceChanceKey)),
      showIcons: toBoolFromStorage(safeGetLocalStorageItem(DEBUG_LOCALSTORAGE_KEYS.showIcons), true),
      dumpEnabled: toBoolFromStorage(safeGetLocalStorageItem(DEBUG_LOCALSTORAGE_KEYS.dump), false),
    };
    dbg.lastReadAtMs = now;
    return dbg.config;
  }

  function resolveDebugFrameTime(channelKey, rawTimeMs, rawDtMs) {
    var dbg = runtime._debug;
    var cfg = readDebugConfig(rawTimeMs);
    var channel = dbg.channels[channelKey];
    if (!channel) {
      channel = { rawTimeMs: 0, virtualTimeMs: 0 };
      dbg.channels[channelKey] = channel;
    }

    var baseTimeMs = toNumber(rawTimeMs, runtime.nowMsFn());
    var baseDtMs = Math.max(0, toNumber(rawDtMs, 0));
    var useOverride = cfg.fixedDtMs > 0 || Math.abs(cfg.dtScale - 1) > 0.0001;
    if (!useOverride) {
      channel.rawTimeMs = baseTimeMs;
      channel.virtualTimeMs = baseTimeMs;
      return {
        timeMs: baseTimeMs,
        dtMs: baseDtMs,
        overridden: false,
      };
    }

    var inferredDtMs = baseDtMs;
    if (inferredDtMs <= 0 && channel.rawTimeMs > 0) {
      inferredDtMs = Math.max(0, baseTimeMs - channel.rawTimeMs);
    }

    var stepMs = cfg.fixedDtMs > 0
      ? cfg.fixedDtMs
      : Math.max(0, inferredDtMs * cfg.dtScale);

    if (!isFiniteNumber(channel.virtualTimeMs) || channel.virtualTimeMs <= 0) {
      channel.virtualTimeMs = baseTimeMs;
    } else {
      channel.virtualTimeMs += stepMs;
    }
    channel.rawTimeMs = baseTimeMs;

    return {
      timeMs: channel.virtualTimeMs,
      dtMs: stepMs,
      overridden: true,
    };
  }

  function warnWithCooldown(warnKey, message, extra) {
    var dbg = runtime._debug;
    var nowMs = runtime.nowMsFn();
    var lastAt = toNumber(dbg.warnAtByKey[warnKey], 0);
    if (nowMs - lastAt < 1500) return;
    dbg.warnAtByKey[warnKey] = nowMs;
    if (extra !== undefined) console.warn(message, extra);
    else console.warn(message);
  }

  function getMaxCatchupSteps() {
    return DEFAULT_MAX_CATCHUP_STEPS;
  }

  function clampLoopProgressToNearNow(timeMs, stepMs) {
    var safeStep = Math.max(1, toInt(stepMs, 1));
    return toNumber(timeMs, 0) - Math.max(1, Math.floor(safeStep * 0.25));
  }

  function isChanceForced(chanceKey) {
    if (!DEV_MODE) return false;
    var cfg = readDebugConfig(runtime.nowMsFn());
    if (cfg.forceChanceAll) return true;
    var normalized = normalizeChanceKey(chanceKey);
    return !!normalized && !!cfg.forceChanceKey && cfg.forceChanceKey === normalized;
  }

  function resolveChance(chance, chanceKey) {
    if (isChanceForced(chanceKey)) return 1;
    return clamp(chance, 0, 1);
  }

  function cloneRanks(ranks) {
    var result = {};
    var keys = Object.keys(ranks || {});
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      result[key] = ranks[key];
    }
    return result;
  }

  function createRunRuntime() {
    return {
      wave: { damageToWalls: false },
      eco: {
        vouchers: 0,
        voucherKills: 0,
        interestNextAtMs: 0,
        taxReliefUntilMs: 0,
        greyDamage: 0,
        repairDiscountReady: false,
        nextRepairDiscountAtMs: 0,
      },
      actives: {
        offense: { untilMs: 0, charges: 0, nextRechargeAtMs: 0 },
        defense: { untilMs: 0, charges: 0, nextRechargeAtMs: 0 },
        economy: { untilMs: 0, charges: 0, nextRechargeAtMs: 0 },
      },
      activeCaps: {
        offense: 0,
        defense: 0,
        economy: 0,
      },
      _activesInitialized: false,
    };
  }

  function ensureRunRt() {
    if (!runtime.runRt || typeof runtime.runRt !== 'object') {
      runtime.runRt = createRunRuntime();
      if (api) api._runRt = runtime.runRt;
    }
    var runRt = runtime.runRt;
    if (!runRt.wave || typeof runRt.wave !== 'object') runRt.wave = { damageToWalls: false };
    if (typeof runRt.wave.damageToWalls !== 'boolean') runRt.wave.damageToWalls = false;

    if (!runRt.eco || typeof runRt.eco !== 'object') runRt.eco = {};
    if (!isFiniteNumber(runRt.eco.vouchers)) runRt.eco.vouchers = 0;
    if (!isFiniteNumber(runRt.eco.voucherKills)) runRt.eco.voucherKills = 0;
    if (!isFiniteNumber(runRt.eco.interestNextAtMs)) runRt.eco.interestNextAtMs = 0;
    if (!isFiniteNumber(runRt.eco.taxReliefUntilMs)) runRt.eco.taxReliefUntilMs = 0;
    if (!isFiniteNumber(runRt.eco.greyDamage)) runRt.eco.greyDamage = 0;
    if (typeof runRt.eco.repairDiscountReady !== 'boolean') runRt.eco.repairDiscountReady = false;
    if (!isFiniteNumber(runRt.eco.nextRepairDiscountAtMs)) runRt.eco.nextRepairDiscountAtMs = 0;

    if (!runRt.actives || typeof runRt.actives !== 'object') runRt.actives = {};
    if (!runRt.actives.offense || typeof runRt.actives.offense !== 'object') {
      runRt.actives.offense = { untilMs: 0, charges: 0, nextRechargeAtMs: 0 };
    }
    if (!runRt.actives.defense || typeof runRt.actives.defense !== 'object') {
      runRt.actives.defense = { untilMs: 0, charges: 0, nextRechargeAtMs: 0 };
    }
    if (!runRt.actives.economy || typeof runRt.actives.economy !== 'object') {
      runRt.actives.economy = { untilMs: 0, charges: 0, nextRechargeAtMs: 0 };
    }

    var offenseRt = runRt.actives.offense;
    var defenseRt = runRt.actives.defense;
    var economyRt = runRt.actives.economy;
    if (!isFiniteNumber(offenseRt.untilMs)) offenseRt.untilMs = 0;
    if (!isFiniteNumber(offenseRt.charges)) offenseRt.charges = 0;
    if (!isFiniteNumber(offenseRt.nextRechargeAtMs)) offenseRt.nextRechargeAtMs = 0;
    if (!isFiniteNumber(defenseRt.untilMs)) defenseRt.untilMs = 0;
    if (!isFiniteNumber(defenseRt.charges)) defenseRt.charges = 0;
    if (!isFiniteNumber(defenseRt.nextRechargeAtMs)) defenseRt.nextRechargeAtMs = 0;
    if (!isFiniteNumber(economyRt.untilMs)) economyRt.untilMs = 0;
    if (!isFiniteNumber(economyRt.charges)) economyRt.charges = 0;
    if (!isFiniteNumber(economyRt.nextRechargeAtMs)) economyRt.nextRechargeAtMs = 0;

    if (!runRt.activeCaps || typeof runRt.activeCaps !== 'object') runRt.activeCaps = {};
    if (!isFiniteNumber(runRt.activeCaps.offense)) runRt.activeCaps.offense = 0;
    if (!isFiniteNumber(runRt.activeCaps.defense)) runRt.activeCaps.defense = 0;
    if (!isFiniteNumber(runRt.activeCaps.economy)) runRt.activeCaps.economy = 0;

    if (typeof runRt._activesInitialized !== 'boolean') runRt._activesInitialized = false;

    return runRt;
  }

  function createBaseMods() {
    return cloneObject(BASE_MODS_TEMPLATE);
  }

  function ensureModFieldDefault(mods, key, value) {
    if (!Object.prototype.hasOwnProperty.call(mods, key)) {
      mods[key] = value;
    }
  }

  function warnParamCollision(paramKey, talentId) {
    if (!DEV_MODE) return;
    console.warn('[TalentsV2] param key collision, last wins:', paramKey, 'talent=', talentId);
  }

  function isDurationLikeKey(key) {
    return typeof key === 'string' && (
      key.indexOf('DurationMs') >= 0 ||
      key.indexOf('IcdMs') >= 0 ||
      key.indexOf('PeriodMs') >= 0 ||
      key.indexOf('RechargeMs') >= 0 ||
      key.indexOf('DelayMs') >= 0 ||
      key.indexOf('TickMs') >= 0 ||
      key.indexOf('GraceMs') >= 0
    );
  }

  function isEveryNKey(key) {
    return typeof key === 'string' && key.indexOf('EveryN') >= 0;
  }

  function collectTreeValidationIssues(tree, options) {
    var opts = options || {};
    var issues = [];

    if (!tree || typeof tree !== 'object') {
      pushIssue(issues, 'error', 'tree.invalid_payload', '[TalentsV2] Invalid talent tree payload');
      return issues;
    }
    if (tree.version !== 2) {
      pushIssue(issues, 'error', 'tree.version', '[TalentsV2] talentTree_v2 version must be 2', {
        actual: tree.version,
      });
    }

    if (!Array.isArray(tree.tierUnlockSpent) || tree.tierUnlockSpent.length !== 5) {
      pushIssue(issues, 'error', 'tree.tier_unlock_shape', '[TalentsV2] tierUnlockSpent must be an array of 5 numbers');
    } else {
      for (var ti = 0; ti < tree.tierUnlockSpent.length; ti++) {
        var tierValue = tree.tierUnlockSpent[ti];
        if (!isFiniteNumber(tierValue)) {
          pushIssue(issues, 'error', 'tree.tier_unlock_non_numeric', '[TalentsV2] tierUnlockSpent contains non-numeric values', {
            index: ti,
            value: tierValue,
          });
          continue;
        }
        if (ti > 0 && tierValue < tree.tierUnlockSpent[ti - 1]) {
          pushIssue(issues, 'error', 'tree.tier_unlock_not_monotonic', '[TalentsV2] tierUnlockSpent must be monotonic non-decreasing', {
            index: ti,
            prev: tree.tierUnlockSpent[ti - 1],
            value: tierValue,
          });
        }
      }
    }

    var caps = tree.caps && typeof tree.caps === 'object' ? tree.caps : {};
    var capKeys = Object.keys(caps);
    for (var ci = 0; ci < capKeys.length; ci++) {
      var capKey = capKeys[ci];
      var capValue = caps[capKey];
      if (!isFiniteNumber(capValue)) continue;
      if (capKey.indexOf('Chance') >= 0 && (capValue < 0 || capValue > 1)) {
        pushIssue(issues, 'error', 'tree.caps.chance_range', '[TalentsV2] chance cap must be in [0..1]', {
          key: capKey,
          value: capValue,
        });
      }
    }

    if (!Array.isArray(tree.branches) || tree.branches.length !== 3) {
      pushIssue(issues, 'error', 'tree.branches_shape', '[TalentsV2] branches must contain exactly 3 entries');
    }

    var branchSet = {};
    var branches = Array.isArray(tree.branches) ? tree.branches : [];
    for (var bi = 0; bi < branches.length; bi++) {
      var branch = branches[bi];
      if (!branch || typeof branch !== 'object' || typeof branch.id !== 'string' || !branch.id.trim()) {
        pushIssue(issues, 'error', 'tree.branch_invalid', '[TalentsV2] branch has invalid id', { index: bi });
        continue;
      }
      if (branchSet[branch.id]) {
        pushIssue(issues, 'error', 'tree.branch_duplicate', '[TalentsV2] duplicate branch id: ' + branch.id, {
          branchId: branch.id,
        });
      }
      branchSet[branch.id] = true;
    }

    if (!Array.isArray(tree.talents) || tree.talents.length !== 51) {
      pushIssue(issues, 'error', 'tree.talents_shape', '[TalentsV2] talents must contain exactly 51 entries', {
        actual: Array.isArray(tree.talents) ? tree.talents.length : -1,
      });
    }

    var talentSet = {};
    var talents = Array.isArray(tree.talents) ? tree.talents : [];
    for (var i = 0; i < talents.length; i++) {
      var talent = talents[i];
      if (!talent || typeof talent !== 'object') {
        pushIssue(issues, 'error', 'tree.talent_invalid', '[TalentsV2] invalid talent entry', { index: i });
        continue;
      }
      if (typeof talent.id !== 'string' || !talent.id.trim()) {
        pushIssue(issues, 'error', 'tree.talent_id_missing', '[TalentsV2] talent.id is required', { index: i });
        continue;
      }
      if (talentSet[talent.id]) {
        pushIssue(issues, 'error', 'tree.talent_duplicate', '[TalentsV2] duplicate talent id: ' + talent.id, {
          talentId: talent.id,
        });
      }
      talentSet[talent.id] = true;

      if (typeof talent.branch !== 'string' || !branchSet[talent.branch]) {
        pushIssue(issues, 'error', 'tree.talent_branch_unknown', '[TalentsV2] talent ' + talent.id + ' has unknown branch', {
          talentId: talent.id,
          branch: talent.branch,
        });
      }
      if (!isFiniteNumber(talent.tier) || talent.tier < 1 || talent.tier > 5) {
        pushIssue(issues, 'error', 'tree.talent_tier_invalid', '[TalentsV2] talent ' + talent.id + ' has invalid tier', {
          talentId: talent.id,
          tier: talent.tier,
        });
      }
      if (!isFiniteNumber(talent.maxRank) || talent.maxRank < 1) {
        pushIssue(issues, 'error', 'tree.talent_max_rank_invalid', '[TalentsV2] talent ' + talent.id + ' has invalid maxRank', {
          talentId: talent.id,
          maxRank: talent.maxRank,
        });
      }
      if (!isFiniteNumber(talent.costPerRank) || talent.costPerRank < 1) {
        pushIssue(issues, 'error', 'tree.talent_cost_invalid', '[TalentsV2] talent ' + talent.id + ' has invalid costPerRank', {
          talentId: talent.id,
          costPerRank: talent.costPerRank,
        });
      }
      if (!Array.isArray(talent.requires)) {
        pushIssue(issues, 'error', 'tree.talent_requires_invalid', '[TalentsV2] talent ' + talent.id + ' must contain requires[]', {
          talentId: talent.id,
        });
      }
      if (!talent.ui || typeof talent.ui !== 'object' ||
          typeof talent.ui.nameKey !== 'string' ||
          typeof talent.ui.descKey !== 'string' ||
          typeof talent.ui.icon !== 'string') {
        pushIssue(issues, 'error', 'tree.talent_ui_invalid', '[TalentsV2] talent ' + talent.id + ' has invalid ui config', {
          talentId: talent.id,
        });
      }
      if (!Array.isArray(talent.effects)) {
        pushIssue(issues, 'error', 'tree.talent_effects_invalid', '[TalentsV2] talent ' + talent.id + ' must contain effects[]', {
          talentId: talent.id,
        });
        continue;
      }

      for (var ei = 0; ei < talent.effects.length; ei++) {
        var effect = talent.effects[ei];
        if (!effect || typeof effect !== 'object') {
          pushIssue(issues, 'error', 'tree.effect_invalid', '[TalentsV2] talent ' + talent.id + ' has invalid effect', {
            talentId: talent.id,
            effectIndex: ei,
          });
          continue;
        }
        if (!ALLOWED_EFFECT_TYPES[effect.type]) {
          pushIssue(issues, 'error', 'tree.effect_type_unsupported', '[TalentsV2] unsupported effect type in ' + talent.id + ': ' + effect.type, {
            talentId: talent.id,
            effectIndex: ei,
            effectType: effect.type,
          });
          continue;
        }
        if ((effect.type === 'stat_add' || effect.type === 'stat_mul') && typeof effect.stat !== 'string') {
          pushIssue(issues, 'error', 'tree.effect_stat_required', '[TalentsV2] effect stat is required for ' + effect.type + ' in ' + talent.id, {
            talentId: talent.id,
            effectIndex: ei,
          });
        }
        if (effect.type === 'stat_add' || effect.type === 'stat_mul') {
          if (typeof effect.stat === 'string' && !MODS_WHITELIST_SET[effect.stat]) {
            pushIssue(issues, DEV_MODE ? 'error' : 'warning', 'tree.effect_stat_unknown', '[TalentsV2] unknown stat key in effect', {
              talentId: talent.id,
              effectIndex: ei,
              key: effect.stat,
            });
          }
        }
        if ((effect.type === 'unlock' || effect.type === 'param') && typeof effect.key !== 'string') {
          pushIssue(issues, 'error', 'tree.effect_key_required', '[TalentsV2] effect key is required for ' + effect.type + ' in ' + talent.id, {
            talentId: talent.id,
            effectIndex: ei,
          });
        }
        if (effect.type === 'unlock' && typeof effect.key === 'string' && !MODS_WHITELIST_SET[effect.key]) {
          pushIssue(issues, DEV_MODE ? 'error' : 'warning', 'tree.effect_unlock_unknown', '[TalentsV2] unknown unlock key in effect', {
            talentId: talent.id,
            effectIndex: ei,
            key: effect.key,
          });
        }
        if (effect.type === 'param') {
          if (typeof effect.key === 'string' && !MODS_WHITELIST_SET[effect.key]) {
            pushIssue(issues, DEV_MODE ? 'error' : 'warning', 'tree.effect_param_unknown', '[TalentsV2] unknown param key in effect', {
              talentId: talent.id,
              effectIndex: ei,
              key: effect.key,
            });
          }
          if (isFiniteNumber(effect.min) && isFiniteNumber(effect.max) && effect.min > effect.max) {
            pushIssue(issues, 'error', 'tree.effect_param_min_gt_max', '[TalentsV2] param effect has min > max', {
              talentId: talent.id,
              effectIndex: ei,
              min: effect.min,
              max: effect.max,
              key: effect.key,
            });
          }
          if (isDurationLikeKey(effect.key) && Object.prototype.hasOwnProperty.call(effect, 'value') && toNumber(effect.value, 0) < 0) {
            pushIssue(issues, 'error', 'tree.effect_param_negative_duration', '[TalentsV2] timing param must be >= 0', {
              talentId: talent.id,
              effectIndex: ei,
              key: effect.key,
              value: effect.value,
            });
          }
          if (isDurationLikeKey(effect.key) && !Object.prototype.hasOwnProperty.call(effect, 'value')) {
            if (isFiniteNumber(effect.base) && effect.base < 0) {
              pushIssue(issues, 'error', 'tree.effect_param_negative_base', '[TalentsV2] timing param base must be >= 0', {
                talentId: talent.id,
                effectIndex: ei,
                key: effect.key,
                base: effect.base,
              });
            }
            if (isFiniteNumber(effect.min) && effect.min < 0) {
              pushIssue(issues, 'error', 'tree.effect_param_negative_min', '[TalentsV2] timing param min must be >= 0', {
                talentId: talent.id,
                effectIndex: ei,
                key: effect.key,
                min: effect.min,
              });
            }
          }
          if (isEveryNKey(effect.key)) {
            var everyNMin = isFiniteNumber(effect.min) ? effect.min : null;
            var everyNValue = isFiniteNumber(effect.value) ? effect.value : null;
            var everyNBase = isFiniteNumber(effect.base) ? effect.base : null;
            if ((everyNMin !== null && everyNMin < 1) || (everyNValue !== null && everyNValue < 1) || (everyNBase !== null && everyNBase < 1)) {
              pushIssue(issues, 'error', 'tree.effect_param_everyn_invalid', '[TalentsV2] everyN param must be >= 1', {
                talentId: talent.id,
                effectIndex: ei,
                key: effect.key,
                min: effect.min,
                value: effect.value,
                base: effect.base,
              });
            }
          }
        }
      }
    }

    if (opts.requireRequiresTargets !== false && Array.isArray(tree.talents)) {
      var ids = Object.keys(talentSet);
      for (var ti2 = 0; ti2 < ids.length; ti2++) {
        var tId = ids[ti2];
        var tal = null;
        for (var tk = 0; tk < tree.talents.length; tk++) {
          if (tree.talents[tk] && tree.talents[tk].id === tId) {
            tal = tree.talents[tk];
            break;
          }
        }
        if (!tal || !Array.isArray(tal.requires)) continue;
        for (var rq = 0; rq < tal.requires.length; rq++) {
          var reqId = tal.requires[rq];
          if (!talentSet[reqId]) {
            pushIssue(issues, 'error', 'tree.requires_unknown', '[TalentsV2] requires references unknown talent id', {
              talentId: tId,
              requiredId: reqId,
            });
          }
        }
      }
    }

    return issues;
  }

  function validateTreePayload(tree) {
    var issues = collectTreeValidationIssues(tree, { requireRequiresTargets: true });
    var hasError = false;
    for (var i = 0; i < issues.length; i++) {
      if (issues[i] && issues[i].level === 'error') {
        hasError = true;
        break;
      }
    }

    if (DEV_MODE && issues.length > 0) {
      console.warn('[TalentsV2] tree validation issues', issues);
    }

    if (hasError) {
      throw new Error(issues[0] && issues[0].message ? issues[0].message : '[TalentsV2] tree validation failed');
    }
    return issues;
  }

  function normalizeTree(rawTree) {
    var treeIssues = validateTreePayload(rawTree);

    var normalized = {
      version: 2,
      tierUnlockSpent: rawTree.tierUnlockSpent.map(function (value) {
        return Math.max(0, toInt(value, 0));
      }),
      branches: [],
      caps: cloneObject(rawTree.caps || {}),
      talents: [],
      talentsById: {},
      talentsByBranch: {},
      _validationIssues: Array.isArray(treeIssues) ? treeIssues.slice() : [],
    };

    for (var bi = 0; bi < rawTree.branches.length; bi++) {
      var branch = rawTree.branches[bi];
      var branchId = String(branch.id);
      normalized.branches.push({ id: branchId, nameKey: branch.nameKey || '' });
      normalized.talentsByBranch[branchId] = [];
    }

    for (var ti = 0; ti < rawTree.talents.length; ti++) {
      var talent = rawTree.talents[ti];
      var normalizedTalent = {
        id: talent.id,
        branch: talent.branch,
        tier: clamp(toInt(talent.tier, 1), 1, 5),
        maxRank: Math.max(1, toInt(talent.maxRank, 1)),
        costPerRank: Math.max(1, toInt(talent.costPerRank, 1)),
        requires: Array.isArray(talent.requires) ? talent.requires.slice() : [],
        ui: {
          nameKey: talent.ui.nameKey,
          descKey: talent.ui.descKey,
          icon: talent.ui.icon,
          currentEffectKey: typeof talent.ui.currentEffectKey === 'string' ? talent.ui.currentEffectKey : undefined,
          currentFormat: typeof talent.ui.currentFormat === 'string' ? talent.ui.currentFormat : undefined,
          currentVars: talent.ui.currentVars && typeof talent.ui.currentVars === 'object' ? cloneObject(talent.ui.currentVars) : undefined,
        },
        effects: Array.isArray(talent.effects) ? talent.effects.map(function (effect) { return cloneObject(effect); }) : [],
      };

      normalized.talents.push(normalizedTalent);
      normalized.talentsById[normalizedTalent.id] = normalizedTalent;
      if (!normalized.talentsByBranch[normalizedTalent.branch]) {
        normalized.talentsByBranch[normalizedTalent.branch] = [];
      }
      normalized.talentsByBranch[normalizedTalent.branch].push(normalizedTalent);
    }

    return normalized;
  }

  function sanitizeRanks(inputRanks) {
    var ranks = {};
    var byId = runtime.talentsById || {};
    var ids = Object.keys(byId);
    for (var i = 0; i < ids.length; i++) {
      var talentId = ids[i];
      var def = byId[talentId];
      var rank = toInt(inputRanks && inputRanks[talentId], 0);
      if (rank < 0) rank = 0;
      if (rank > def.maxRank) rank = def.maxRank;
      if (rank > 0) ranks[talentId] = rank;
    }
    return ranks;
  }

  function asObject(value) {
    return value && typeof value === 'object' ? value : null;
  }

  function resolveV1Name(rawName) {
    return typeof rawName === 'string' ? rawName.trim() : '';
  }

  function normalizeLegacyTalentEntry(name, rankValue, boughtValue) {
    var safeName = resolveV1Name(name);
    if (!safeName) return null;

    var rank = toInt(rankValue, NaN);
    var bought = boughtValue === true;

    if (!isFiniteNumber(rank)) {
      if (rankValue === true || boughtValue === true) {
        rank = 1;
        bought = true;
      } else if (rankValue === false || boughtValue === false) {
        rank = 0;
      } else {
        rank = 1;
        bought = true;
      }
    }

    if (rank < 0) rank = 0;
    if (rank > 0) bought = true;
    if (bought && rank <= 0) rank = 1;

    return {
      name: safeName,
      rank: rank,
      bought: rank > 0 || bought,
    };
  }

  function pushLegacyEntry(out, name, rankValue, boughtValue) {
    var normalized = normalizeLegacyTalentEntry(name, rankValue, boughtValue);
    if (!normalized) return 0;
    out.push(normalized);
    return 1;
  }

  function collectNamedLegacyTalents(value, out) {
    var added = 0;
    if (Array.isArray(value)) {
      for (var i = 0; i < value.length; i++) {
        var item = value[i];
        if (typeof item === 'string') {
          added += pushLegacyEntry(out, item, 1, true);
          continue;
        }
        var obj = asObject(item);
        if (!obj) continue;
        var name = obj.name || obj.title || obj.talentName || obj.key || obj.id;
        added += pushLegacyEntry(out, name, obj.rank, obj.bought);
      }
      return added;
    }

    var mapObj = asObject(value);
    if (!mapObj) return 0;
    var keys = Object.keys(mapObj);
    for (var ki = 0; ki < keys.length; ki++) {
      var mapKey = keys[ki];
      var mapValue = mapObj[mapKey];
      var mapEntry = asObject(mapValue);
      if (mapEntry) {
        added += pushLegacyEntry(out, mapKey, mapEntry.rank, mapEntry.bought);
        continue;
      }
      if (typeof mapValue === 'boolean') {
        if (mapValue) added += pushLegacyEntry(out, mapKey, 1, true);
        continue;
      }
      added += pushLegacyEntry(out, mapKey, mapValue, false);
    }
    return added;
  }

  function collectLegacyAppliedArray(value, out) {
    if (!Array.isArray(value)) return 0;
    var added = 0;
    for (var i = 0; i < value.length && i < LEGACY_V1_TALENT_ORDER.length; i++) {
      var name = LEGACY_V1_TALENT_ORDER[i];
      var raw = value[i];
      if (raw === undefined || raw === null) continue;
      if (typeof raw === 'boolean') {
        if (raw) added += pushLegacyEntry(out, name, 1, true);
        continue;
      }
      var rawObj = asObject(raw);
      if (rawObj) {
        added += pushLegacyEntry(out, name, rawObj.rank, rawObj.bought);
        continue;
      }
      added += pushLegacyEntry(out, name, raw, false);
    }
    return added;
  }

  function extractV1Talents(saveRoot) {
    var root = asObject(saveRoot) || {};
    var player = asObject(root.player);
    var out = [];

    var namedCandidates = [
      root.talentsV1,
      player && player.talentsV1,
      root.legacyTalents,
      player && player.legacyTalents,
      root.talentsByName,
      player && player.talentsByName,
      root.talents,
      player && player.talents,
    ];

    var namedAdded = 0;
    for (var ni = 0; ni < namedCandidates.length; ni++) {
      namedAdded += collectNamedLegacyTalents(namedCandidates[ni], out);
    }
    if (namedAdded > 0) return out;

    collectLegacyAppliedArray(root.talentsApplied, out);
    collectLegacyAppliedArray(player && player.talentsApplied, out);
    return out;
  }

  function extractV1Points(saveRoot) {
    var root = asObject(saveRoot) || {};
    var player = asObject(root.player);

    var free = 0;
    if (isFiniteNumber(root.freeTalentPointsV1)) free = Math.max(0, toInt(root.freeTalentPointsV1, 0));
    else if (player && isFiniteNumber(player.freeTalentPointsV1)) free = Math.max(0, toInt(player.freeTalentPointsV1, 0));
    else if (isFiniteNumber(root.talentPoints)) free = Math.max(0, toInt(root.talentPoints, 0));
    else if (player && isFiniteNumber(player.talentPoints)) free = Math.max(0, toInt(player.talentPoints, 0));

    var spent = 0;
    if (isFiniteNumber(root.spentTalentPoints)) spent = Math.max(0, toInt(root.spentTalentPoints, 0));
    else if (player && isFiniteNumber(player.spentTalentPoints)) spent = Math.max(0, toInt(player.spentTalentPoints, 0));
    else if (isFiniteNumber(root.talentPointsSpent)) spent = Math.max(0, toInt(root.talentPointsSpent, 0));
    else if (player && isFiniteNumber(player.talentPointsSpent)) spent = Math.max(0, toInt(player.talentPointsSpent, 0));

    return {
      spent: spent,
      free: free,
    };
  }

  function migrateTalentsV1toV2(oldSave) {
    var extracted = extractV1Talents(oldSave);
    var pointsV1 = extractV1Points(oldSave);

    var maxRankById = {};
    var ids = Object.keys(runtime.talentsById || {});
    for (var i = 0; i < ids.length; i++) {
      var talentId = ids[i];
      var def = runtime.talentsById[talentId];
      maxRankById[talentId] = Math.max(1, toInt(def && def.maxRank, 1));
    }

    var ranksById = {};
    var refund = 0;
    var spentV1 = 0;

    for (var ti = 0; ti < extracted.length; ti++) {
      var old = extracted[ti];
      var oldRank = Math.max(0, toInt(old && old.rank, 0));
      var oldBought = !!(old && old.bought);
      spentV1 += oldRank;

      var mapRule = old && old.name ? MIGRATE_V1_TO_V2[old.name] : null;
      if (!mapRule || !mapRule.id || !isFiniteNumber(maxRankById[mapRule.id])) {
        refund += oldRank;
        continue;
      }

      var current = Math.max(0, toInt(ranksById[mapRule.id], 0));
      if (mapRule.op === 'addRankFromOld') {
        current += oldRank;
      } else if (mapRule.op === 'addRankIfBought') {
        if (oldBought) current += Math.max(0, toInt(mapRule.value, 0));
      } else if (mapRule.op === 'setRankIfBought') {
        if (oldBought) current = Math.max(current, Math.max(1, toInt(mapRule.value, 1)));
      } else if (mapRule.op === 'ensureMinRank') {
        if (oldBought) current = Math.max(current, Math.max(1, toInt(mapRule.value, 1)));
      } else {
        refund += oldRank;
        continue;
      }

      var maxRank = maxRankById[mapRule.id];
      if (current > maxRank) current = maxRank;
      if (current > 0) ranksById[mapRule.id] = current;
    }

    var spentV2 = 0;
    var rankIds = Object.keys(ranksById);
    for (var ri = 0; ri < rankIds.length; ri++) {
      spentV2 += Math.max(0, toInt(ranksById[rankIds[ri]], 0));
    }

    var totalV1 = Math.max(0, toInt(pointsV1.spent, 0) + toInt(pointsV1.free, 0));
    var freePoints = Math.max(0, totalV1 - spentV2) + refund;

    if (DEV_MODE) {
      console.info('[TalentsV2] migrate v1->v2', {
        spentV1: spentV1,
        spentV2: spentV2,
        refund: refund,
        freePoints: freePoints,
      });
    }

    return {
      talentsVersion: 2,
      talentsV2: {
        ranksById: ranksById,
        freePoints: freePoints,
      },
      freeTalentPointsV2: freePoints,
    };
  }

  function extractTalentsSave(saveRoot) {
    var root = saveRoot && typeof saveRoot === 'object' ? saveRoot : {};
    var player = root.player && typeof root.player === 'object' ? root.player : null;
    var payload = null;
    if (root.talentsV2 && typeof root.talentsV2 === 'object') payload = root.talentsV2;
    if (!payload && player && player.talentsV2 && typeof player.talentsV2 === 'object') payload = player.talentsV2;

    var freePoints = 0;
    if (payload && isFiniteNumber(payload.freePoints)) {
      freePoints = Math.max(0, toInt(payload.freePoints, 0));
    } else if (isFiniteNumber(root.freeTalentPointsV2)) {
      freePoints = Math.max(0, toInt(root.freeTalentPointsV2, 0));
    } else if (player && isFiniteNumber(player.freeTalentPointsV2)) {
      freePoints = Math.max(0, toInt(player.freeTalentPointsV2, 0));
    }

    var ranksById = payload && payload.ranksById && typeof payload.ranksById === 'object'
      ? payload.ranksById
      : {};
    var respec = payload && payload.respec && typeof payload.respec === 'object'
      ? payload.respec
      : null;

    return {
      talentsVersion: isFiniteNumber(root.talentsVersion) ? toInt(root.talentsVersion, 0) :
        (player && isFiniteNumber(player.talentsVersion) ? toInt(player.talentsVersion, 0) : 0),
      ranksById: ranksById,
      freePoints: freePoints,
      respec: sanitizeRespecState(respec),
    };
  }

  function getSavePayload() {
    return {
      talentsVersion: 2,
      talentsV2: {
        ranksById: cloneRanks(runtime.ranksById),
        freePoints: runtime.freePoints,
        respec: cloneRespecState(runtime.respec),
      },
      freeTalentPointsV2: runtime.freePoints,
      savedAtMs: runtime.nowMsFn(),
    };
  }

  function persistSave() {
    if (typeof runtime.saveFn !== 'function') return;
    runtime.saveFn(getSavePayload());
  }

  function loadFromSave() {
    var saveRoot = typeof runtime.loadSaveFn === 'function' ? runtime.loadSaveFn() : null;
    var parsed = extractTalentsSave(saveRoot);
    runtime.loadedTalentsVersion = parsed.talentsVersion;
    runtime.migratedFromVersion = null;
    if (parsed.talentsVersion < 2) {
      runtime.migratedFromVersion = parsed.talentsVersion;
      var migrationPatch = migrateTalentsV1toV2(saveRoot);
      if (migrationPatch && migrationPatch.talentsV2 && typeof migrationPatch.talentsV2 === 'object') {
        if (typeof runtime.saveFn === 'function') {
          runtime.saveFn(migrationPatch);
        }
        parsed = extractTalentsSave(migrationPatch);
      }
    }
    runtime.loadedTalentsVersion = parsed.talentsVersion;
    runtime.ranksById = sanitizeRanks(parsed.ranksById);
    runtime.pendingById = {};
    runtime.freePoints = Math.max(0, toInt(parsed.freePoints, 0));
    runtime.respec = sanitizeRespecState(parsed.respec);
    runtime.modsDirty = true;
    runtime.modsCache = null;
    runtime.runRt = createRunRuntime();
    if (api) api._runRt = runtime.runRt;
  }

  function syncRunActiveCharges(mods) {
    var runRt = ensureRunRt();
    var currMods = mods && typeof mods === 'object' ? mods : getMods();
    var offMax = Math.max(0, toInt(getModNumber(currMods, 'offActiveCharges', ['offenseActiveCharges'], 0), 0));
    var defMax = Math.max(0, toInt(getModNumber(currMods, 'defActiveCharges', ['defenseActiveCharges'], 0), 0));
    var ecoMax = Math.max(0, toInt(getModNumber(currMods, 'ecoActiveCharges', ['economyActiveCharges'], 0), 0));
    var prevOffMax = Math.max(0, toInt(runRt.activeCaps && runRt.activeCaps.offense, 0));
    var prevDefMax = Math.max(0, toInt(runRt.activeCaps && runRt.activeCaps.defense, 0));
    var prevEcoMax = Math.max(0, toInt(runRt.activeCaps && runRt.activeCaps.economy, 0));

    if (!runRt._activesInitialized) {
      runRt.actives.offense.charges = offMax;
      runRt.actives.defense.charges = defMax;
      runRt.actives.economy.charges = ecoMax;
      runRt.activeCaps.offense = offMax;
      runRt.activeCaps.defense = defMax;
      runRt.activeCaps.economy = ecoMax;
      runRt._activesInitialized = true;
      return;
    }

    if (offMax > prevOffMax && runRt.actives.offense.charges <= 0) runRt.actives.offense.charges = offMax;
    if (defMax > prevDefMax && runRt.actives.defense.charges <= 0) runRt.actives.defense.charges = defMax;
    if (ecoMax > prevEcoMax && runRt.actives.economy.charges <= 0) runRt.actives.economy.charges = ecoMax;

    if (runRt.actives.offense.charges > offMax) runRt.actives.offense.charges = offMax;
    if (runRt.actives.defense.charges > defMax) runRt.actives.defense.charges = defMax;
    if (runRt.actives.economy.charges > ecoMax) runRt.actives.economy.charges = ecoMax;

    runRt.activeCaps.offense = offMax;
    runRt.activeCaps.defense = defMax;
    runRt.activeCaps.economy = ecoMax;
  }

  function applyParamEffect(mods, effect, rank, stateInfo, talentId) {
    var key = effect.key;
    if (!key) return;

    if (Object.prototype.hasOwnProperty.call(effect, 'value')) {
      if (rank > 0) {
        if (stateInfo.paramSetByKey[key]) warnParamCollision(key, talentId);
        stateInfo.paramSetByKey[key] = true;
        var rawValue = effect.value;
        // Tier-band-style array values (e.g. resistByZombieLevel) gate each entry
        // by its own fromRank, so the runtime sees only the tiers unlocked at
        // the current rank without stacking onto a single zombie.
        if (Array.isArray(rawValue) && rawValue.length > 0
            && rawValue[0] && typeof rawValue[0] === 'object'
            && Object.prototype.hasOwnProperty.call(rawValue[0], 'fromRank')) {
          var filtered = [];
          for (var ai = 0; ai < rawValue.length; ai++) {
            var entry = rawValue[ai];
            if (!entry || typeof entry !== 'object') continue;
            if (rank >= toInt(entry.fromRank, 1)) filtered.push(entry);
          }
          mods[key] = filtered;
        } else {
          mods[key] = rawValue;
        }
      }
      return;
    }

    var fromRank = Math.max(1, toInt(effect.fromRank, 1));
    if (rank < fromRank) return;

    var base = toNumber(effect.base, 0);
    var perRank = toNumber(effect.perRank, 0);
    var value = base + perRank * rank;

    if (isFiniteNumber(effect.min)) value = Math.max(effect.min, value);
    if (isFiniteNumber(effect.max)) value = Math.min(effect.max, value);

    if (stateInfo.paramSetByKey[key]) warnParamCollision(key, talentId);
    stateInfo.paramSetByKey[key] = true;
    mods[key] = value;
  }

  function applyCaps(mods, caps) {
    if (!caps || typeof caps !== 'object') return;

    if (isFiniteNumber(caps.doubleShotChance)) {
      mods.doubleShotChance = Math.min(mods.doubleShotChance, caps.doubleShotChance);
    }
    if (isFiniteNumber(caps.tripleShotChance)) {
      mods.tripleShotChance = Math.min(mods.tripleShotChance, caps.tripleShotChance);
    }
    if (isFiniteNumber(caps.ricochetChance)) {
      mods.ricochetChance = Math.min(mods.ricochetChance, caps.ricochetChance);
    }
    if (isFiniteNumber(caps.fullRepairChance)) {
      mods.fullRepairChancePerRank = Math.min(mods.fullRepairChancePerRank, caps.fullRepairChance);
    }
    if (isFiniteNumber(caps.boxReagentReduction)) {
      mods.boxReagentReductionPerRank = Math.min(mods.boxReagentReductionPerRank, caps.boxReagentReduction);
    }
    if (isFiniteNumber(caps.resistPct)) {
      mods.resistAcidPct = Math.min(mods.resistAcidPct, caps.resistPct);
      mods.resistExplosionPct = Math.min(mods.resistExplosionPct, caps.resistPct);
      mods.resistFirePct = Math.min(mods.resistFirePct, caps.resistPct);
    }

    var capKeys = Object.keys(caps);
    for (var i = 0; i < capKeys.length; i++) {
      var capKey = capKeys[i];
      var capValue = caps[capKey];
      if (!isFiniteNumber(capValue)) continue;

      if (capKey.slice(-3) === 'Min') {
        var targetKey = capKey.slice(0, -3);
        if (isFiniteNumber(mods[targetKey])) {
          mods[targetKey] = Math.max(mods[targetKey], capValue);
        }
        continue;
      }

      if (isFiniteNumber(mods[capKey])) {
        mods[capKey] = Math.min(mods[capKey], capValue);
      }
    }
  }

  function computeModsFromTalents(tree, ranksById) {
    var mods = createBaseMods();
    var talents = tree && Array.isArray(tree.talents) ? tree.talents : [];
    var stateInfo = { paramSetByKey: {} };

    for (var i = 0; i < talents.length; i++) {
      var talent = talents[i];
      var rank = toInt(ranksById && ranksById[talent.id], 0);
      if (rank <= 0) continue;
      if (rank > talent.maxRank) rank = talent.maxRank;

      var effects = Array.isArray(talent.effects) ? talent.effects : [];
      for (var ei = 0; ei < effects.length; ei++) {
        var effect = effects[ei];
        if (!effect || typeof effect !== 'object') continue;

        if (effect.type === 'stat_add') {
          var addKey = effect.stat;
          var perRankAdd = toNumber(effect.perRank, 0);
          ensureModFieldDefault(mods, addKey, 0);
          mods[addKey] = toNumber(mods[addKey], 0) + perRankAdd * rank;
          continue;
        }

        if (effect.type === 'stat_mul') {
          var mulKey = effect.stat;
          var perRankMul = toNumber(effect.perRank, 0);
          ensureModFieldDefault(mods, mulKey, 1);
          mods[mulKey] = toNumber(mods[mulKey], 1) * (1 + perRankMul * rank);
          continue;
        }

        if (effect.type === 'unlock') {
          mods[effect.key] = rank > 0;
          continue;
        }

        if (effect.type === 'param') {
          applyParamEffect(mods, effect, rank, stateInfo, talent.id);
        }
      }
    }

    applyCaps(mods, tree && tree.caps ? tree.caps : null);
    return mods;
  }

  function collectModsContractIssues(mods) {
    var issues = [];
    var safeMods = mods && typeof mods === 'object' ? mods : {};

    for (var i = 0; i < MODS_WHITELIST_KEYS.length; i++) {
      var expectedKey = MODS_WHITELIST_KEYS[i];
      if (!Object.prototype.hasOwnProperty.call(safeMods, expectedKey)) {
        pushIssue(issues, 'error', 'mods.missing_key', '[TalentsV2] mods missing expected key: ' + expectedKey, {
          key: expectedKey,
        });
      }
    }

    var modKeys = Object.keys(safeMods);
    for (var mi = 0; mi < modKeys.length; mi++) {
      var modKey = modKeys[mi];
      if (!MODS_WHITELIST_SET[modKey]) {
        pushIssue(issues, 'warning', 'mods.unexpected_key', '[TalentsV2] mods has unexpected key: ' + modKey, {
          key: modKey,
        });
      }
    }

    return issues;
  }

  function validate(payload) {
    var ctx = payload || {};
    var issues = [];
    var tree = ctx.tree || runtime.tree;
    var ranks = ctx.ranksById || runtime.ranksById;

    if (tree) {
      appendIssues(issues, collectTreeValidationIssues(tree, { requireRequiresTargets: true }));
      appendIssues(issues, collectModsContractIssues(computeModsFromTalents(tree, ranks || {})));
    } else {
      appendIssues(issues, collectModsContractIssues(createBaseMods()));
      pushIssue(issues, 'warning', 'tree.not_loaded', '[TalentsV2] validate(): tree is not loaded yet');
    }

    runtime.lastValidationIssues = issues.slice();
    return issues;
  }

  function loadTree() {
    function doFetch(path) {
      if (typeof runtime.assetLoader === 'function') {
        return Promise.resolve(runtime.assetLoader(path));
      }
      if (runtime.assetLoader && typeof runtime.assetLoader.loadJson === 'function') {
        return Promise.resolve(runtime.assetLoader.loadJson(path));
      }
      return fetch(path, { cache: 'no-store' }).then(function (response) {
        if (!response.ok) throw new Error('[TalentsV2] HTTP ' + response.status + ' for ' + path);
        return response.json();
      });
    }

    return doFetch(TREE_PATH).then(function (payload) {
      var normalized = normalizeTree(payload);
      runtime.tree = normalized;
      runtime.talentsById = normalized.talentsById;
      runtime.talentsByBranch = normalized.talentsByBranch;
      runtime.branches = normalized.branches;
      runtime.tierUnlockSpent = normalized.tierUnlockSpent;
      runtime.caps = normalized.caps;
      runtime.modsDirty = true;
      runtime.modsCache = null;
      runtime.ranksById = sanitizeRanks(runtime.ranksById);
      runtime.lastValidationIssues = validate({ tree: normalized, ranksById: runtime.ranksById });
      if (DEV_MODE && runtime.lastValidationIssues.length > 0) {
        console.warn('[TalentsV2] validate() after loadTree', runtime.lastValidationIssues);
      }
      return normalized;
    });
  }

  function getTreeMeta() {
    if (!runtime.tree) return null;
    return {
      version: runtime.tree.version,
      branches: runtime.branches.map(function (branch) { return cloneObject(branch); }),
      tierUnlockSpent: runtime.tierUnlockSpent.slice(),
      caps: cloneObject(runtime.caps),
    };
  }

  function getRanks() {
    return cloneRanks(runtime.ranksById);
  }

  function getPendingRanks() {
    return cloneRanks(runtime.pendingById);
  }

  function getEffectiveRanks() {
    var out = cloneRanks(runtime.ranksById);
    var ids = Object.keys(runtime.pendingById || {});
    for (var i = 0; i < ids.length; i++) {
      var talentId = ids[i];
      var pending = Math.max(0, toInt(runtime.pendingById[talentId], 0));
      if (pending <= 0) continue;
      out[talentId] = Math.max(0, toInt(out[talentId], 0)) + pending;
    }
    return sanitizeRanks(out);
  }

  function getPendingCost(branchId) {
    var hasBranchFilter = typeof branchId === 'string' && branchId.length > 0;
    var ids = Object.keys(runtime.pendingById || {});
    var sum = 0;
    for (var i = 0; i < ids.length; i++) {
      var talentId = ids[i];
      var pending = Math.max(0, toInt(runtime.pendingById[talentId], 0));
      if (pending <= 0) continue;
      var def = runtime.talentsById[talentId];
      if (!def) continue;
      if (hasBranchFilter && def.branch !== branchId) continue;
      sum += pending * Math.max(1, toInt(def.costPerRank, 1));
    }
    return sum;
  }

  function setRanks(ranksById) {
    runtime.ranksById = sanitizeRanks(ranksById || {});
    runtime.modsDirty = true;
    runtime.modsCache = null;
  }

  function getFreePoints() {
    return runtime.freePoints;
  }

  function getAvailableFreePoints() {
    return Math.max(0, runtime.freePoints - getPendingCost());
  }

  function setFreePoints(value) {
    runtime.freePoints = Math.max(0, toInt(value, 0));
  }

  function syncFromSave(payload) {
    var source = payload && typeof payload === 'object' ? payload : {};
    runtime.ranksById = sanitizeRanks(source.ranksById || {});
    runtime.freePoints = Math.max(0, toInt(source.freePoints, 0));
    runtime.respec = sanitizeRespecState(source.respec);
    runtime.pendingById = {};
    runtime.modsDirty = true;
    runtime.modsCache = null;
  }

  function hasAppliedRanks() {
    var ids = Object.keys(runtime.ranksById || {});
    for (var i = 0; i < ids.length; i++) {
      if (Math.max(0, toInt(runtime.ranksById[ids[i]], 0)) > 0) return true;
    }
    return false;
  }

  function getRespecPriceByCount(resetCount) {
    var safeCount = Math.max(0, toInt(resetCount, 0));
    var price = RESPEC_PRICE_BASE * Math.pow(RESPEC_PRICE_MULTIPLIER, safeCount);
    if (!isFiniteNumber(price)) return RESPEC_PRICE_CAP;
    return Math.min(RESPEC_PRICE_CAP, price);
  }

  function getRespecState(options) {
    var opts = options || {};
    var nowMs = isFiniteNumber(opts.nowMs) ? Math.max(0, opts.nowMs) : runtime.nowMsFn();
    var respec = sanitizeRespecState(runtime.respec);
    var cooldownRemainingMs = Math.max(0, respec.cooldownEndsAtMs - nowMs);
    return {
      resetCount: respec.resetCount,
      price: getRespecPriceByCount(respec.resetCount),
      priceCap: RESPEC_PRICE_CAP,
      cooldownEndsAtMs: respec.cooldownEndsAtMs,
      cooldownDurationMs: RESPEC_COOLDOWN_MS,
      cooldownRemainingMs: cooldownRemainingMs,
      cooldownActive: cooldownRemainingMs > 0,
      hasApplied: hasAppliedRanks(),
    };
  }

  function canRespec(options) {
    var opts = options || {};
    var state = getRespecState(opts);
    if (!state.hasApplied) {
      return {
        ok: false,
        reason: 'no_applied',
        price: state.price,
        cooldownEndsAtMs: state.cooldownEndsAtMs,
        cooldownRemainingMs: state.cooldownRemainingMs,
      };
    }
    if (state.cooldownActive) {
      return {
        ok: false,
        reason: 'cooldown',
        price: state.price,
        cooldownEndsAtMs: state.cooldownEndsAtMs,
        cooldownRemainingMs: state.cooldownRemainingMs,
      };
    }
    var coins = toNumber(opts.coins, NaN);
    if (isFiniteNumber(coins) && coins < state.price) {
      return {
        ok: false,
        reason: 'no_coins',
        price: state.price,
        cooldownEndsAtMs: 0,
        cooldownRemainingMs: 0,
      };
    }
    return {
      ok: true,
      price: state.price,
      cooldownEndsAtMs: state.cooldownEndsAtMs,
      cooldownRemainingMs: state.cooldownRemainingMs,
    };
  }

  function getTalentUi(talentId) {
    var talent = runtime.talentsById[talentId];
    if (!talent || !talent.ui) return null;
    return {
      nameKey: talent.ui.nameKey,
      descKey: talent.ui.descKey,
      icon: talent.ui.icon,
      currentEffectKey: typeof talent.ui.currentEffectKey === 'string' ? talent.ui.currentEffectKey : undefined,
      currentFormat: typeof talent.ui.currentFormat === 'string' ? talent.ui.currentFormat : undefined,
      currentVars: talent.ui.currentVars && typeof talent.ui.currentVars === 'object' ? talent.ui.currentVars : undefined,
    };
  }

  function getTalentsByBranch(branchId) {
    var list = runtime.talentsByBranch && runtime.talentsByBranch[branchId]
      ? runtime.talentsByBranch[branchId]
      : [];
    var localIndexById = {};
    for (var li = 0; li < list.length; li++) {
      if (list[li] && typeof list[li].id === 'string' && list[li].id) {
        localIndexById[list[li].id] = li;
      }
    }
    var rowSlotCounters = {};
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var talent = list[i];
      if (!talent) continue;
      var legacyLayout = LEGACY_BRANCH_LAYOUT[i] && typeof LEGACY_BRANCH_LAYOUT[i] === 'object'
        ? LEGACY_BRANCH_LAYOUT[i]
        : null;
      var row = legacyLayout && Number.isFinite(legacyLayout.row)
        ? Math.max(0, toInt(legacyLayout.row, 0))
        : Math.max(0, toInt(talent.tier, 1) - 1);
      var slot = legacyLayout && Number.isFinite(legacyLayout.slot)
        ? Math.max(0, toInt(legacyLayout.slot, 0))
        : toInt(rowSlotCounters[row], 0);
      if (!(legacyLayout && Number.isFinite(legacyLayout.slot))) {
        rowSlotCounters[row] = slot + 1;
      }
      var parentLocalIndices = [];
      var parentSeen = {};
      if (Array.isArray(talent.requires) && talent.requires.length > 0) {
        for (var ri = 0; ri < talent.requires.length; ri++) {
          var requiredId = talent.requires[ri];
          var parentLocal = toInt(localIndexById[requiredId], -1);
          if (parentLocal < 0 || parentSeen[parentLocal]) continue;
          parentSeen[parentLocal] = true;
          parentLocalIndices.push(parentLocal);
        }
      }
      if (!parentLocalIndices.length && LEGACY_BRANCH_LAYOUT[i] && Array.isArray(LEGACY_BRANCH_LAYOUT[i].parents)) {
        parentLocalIndices = LEGACY_BRANCH_LAYOUT[i].parents.slice();
      }
      out.push({
        id: talent.id,
        branch: talent.branch,
        tier: talent.tier,
        maxRank: talent.maxRank,
        costPerRank: talent.costPerRank,
        requires: Array.isArray(talent.requires) ? talent.requires.slice() : [],
        layout: {
          row: row,
          slot: Math.max(0, slot),
          parents: parentLocalIndices,
        },
        ui: talent.ui ? {
          nameKey: talent.ui.nameKey,
          descKey: talent.ui.descKey,
          icon: talent.ui.icon,
          currentEffectKey: typeof talent.ui.currentEffectKey === 'string' ? talent.ui.currentEffectKey : undefined,
          currentFormat: typeof talent.ui.currentFormat === 'string' ? talent.ui.currentFormat : undefined,
          currentVars: talent.ui.currentVars && typeof talent.ui.currentVars === 'object' ? talent.ui.currentVars : undefined,
        } : null,
        effects: Array.isArray(talent.effects) ? talent.effects.map(function (effect) { return cloneObject(effect); }) : [],
      });
    }
    return out;
  }

  function getBranchSpent(branchId, options) {
    var opts = options || {};
    var includePending = !!opts.includePending;
    var talents = runtime.talentsByBranch && runtime.talentsByBranch[branchId]
      ? runtime.talentsByBranch[branchId]
      : null;
    if (!talents) return 0;

    var sum = 0;
    for (var i = 0; i < talents.length; i++) {
      var rank = toInt(runtime.ranksById[talents[i].id], 0);
      if (includePending) rank += toInt(runtime.pendingById[talents[i].id], 0);
      if (rank > 0) sum += rank;
    }
    return sum;
  }

  function getUnlockedTier(branchId) {
    if (!runtime.talentsByBranch || !runtime.talentsByBranch[branchId]) return 0;
    var spent = getBranchSpent(branchId);
    var unlocked = 1;
    for (var i = 0; i < runtime.tierUnlockSpent.length; i++) {
      if (spent >= runtime.tierUnlockSpent[i]) unlocked = i + 1;
    }
    return clamp(unlocked, 1, 5);
  }

  function getBranchTalentLocalIndex(branchId, talentId) {
    var talents = runtime.talentsByBranch && runtime.talentsByBranch[branchId]
      ? runtime.talentsByBranch[branchId]
      : null;
    if (!talents) return -1;
    for (var i = 0; i < talents.length; i++) {
      if (talents[i] && talents[i].id === talentId) return i;
    }
    return -1;
  }

  function getTalentLayout(branchId, talent) {
    var localIndex = getBranchTalentLocalIndex(branchId, talent.id);
    if (localIndex >= 0 && LEGACY_BRANCH_LAYOUT[localIndex]) {
      return LEGACY_BRANCH_LAYOUT[localIndex];
    }
    return {
      row: Math.max(0, toInt(talent.tier, 1) - 1),
      slot: 0,
      parents: [],
    };
  }

  function collectMissingPreviousRowRequires(branchId, talent, includePending) {
    var layout = getTalentLayout(branchId, talent);
    var row = Math.max(0, toInt(layout && layout.row, 0));
    if (row <= 0) return [];

    var branchTalents = runtime.talentsByBranch && runtime.talentsByBranch[branchId]
      ? runtime.talentsByBranch[branchId]
      : null;
    if (!branchTalents || !branchTalents.length) return [];

    var parentLocalIndices = Array.isArray(layout.parents) ? layout.parents : [];
    var hasParentRank = false;
    var missing = [];
    var missingSet = {};

    for (var i = 0; i < parentLocalIndices.length; i++) {
      var localIndex = toInt(parentLocalIndices[i], -1);
      if (localIndex < 0 || localIndex >= branchTalents.length) continue;
      var parentTalent = branchTalents[localIndex];
      if (!parentTalent || !parentTalent.id) continue;
      var parentRank = toInt(runtime.ranksById[parentTalent.id], 0);
      if (includePending) parentRank += toInt(runtime.pendingById[parentTalent.id], 0);
      if (parentRank > 0) {
        hasParentRank = true;
      } else if (!missingSet[parentTalent.id]) {
        missingSet[parentTalent.id] = true;
        missing.push({ id: parentTalent.id, needRank: 1, currentRank: 0 });
      }
    }

    if (hasParentRank) return [];

    if (missing.length > 0) return missing;

    for (var bi = 0; bi < branchTalents.length; bi++) {
      var candidate = branchTalents[bi];
      if (!candidate || !candidate.id) continue;
      var candidateLayout = getTalentLayout(branchId, candidate);
      var candidateRow = Math.max(0, toInt(candidateLayout && candidateLayout.row, 0));
      if (candidateRow !== row - 1) continue;
      var candidateRank = toInt(runtime.ranksById[candidate.id], 0);
      if (includePending) candidateRank += toInt(runtime.pendingById[candidate.id], 0);
      if (candidateRank > 0) {
        hasParentRank = true;
        break;
      }
      if (!missingSet[candidate.id]) {
        missingSet[candidate.id] = true;
        missing.push({ id: candidate.id, needRank: 1, currentRank: 0 });
      }
    }

    if (hasParentRank) return [];
    return missing;
  }

  function canBuy(talentId, options) {
    var opts = options || {};
    var includePending = !!opts.includePending;
    var talent = runtime.talentsById[talentId];
    if (!talent) return { ok: false, reason: 'unknown' };

    var currentRank = toInt(runtime.ranksById[talentId], 0);
    if (includePending) currentRank += toInt(runtime.pendingById[talentId], 0);
    if (currentRank >= talent.maxRank) return { ok: false, reason: 'max_rank' };

    var layout = getTalentLayout(talent.branch, talent);
    var requiredSpent = Math.max(0, toInt(layout && layout.row, 0)) * 5;
    var branchSpent = getBranchSpent(talent.branch, { includePending: includePending });
    if (branchSpent < requiredSpent) {
      return {
        ok: false,
        reason: 'tier_locked',
        needSpent: requiredSpent,
        currentSpent: branchSpent,
      };
    }

    var missingRequires = [];
    var missingSet = {};

    var previousRowRequires = collectMissingPreviousRowRequires(talent.branch, talent, includePending);
    for (var pri = 0; pri < previousRowRequires.length; pri++) {
      var prevReq = previousRowRequires[pri];
      if (!prevReq || !prevReq.id || missingSet[prevReq.id]) continue;
      missingSet[prevReq.id] = true;
      missingRequires.push(prevReq);
    }

    for (var i = 0; i < talent.requires.length; i++) {
      var requiredId = talent.requires[i];
      var currentRequiredRank = toInt(runtime.ranksById[requiredId], 0);
      if (includePending) currentRequiredRank += toInt(runtime.pendingById[requiredId], 0);
      if (currentRequiredRank <= 0 && !missingSet[requiredId]) {
        missingSet[requiredId] = true;
        missingRequires.push({ id: requiredId, needRank: 1, currentRank: currentRequiredRank });
      }
    }
    if (missingRequires.length > 0) {
      return {
        ok: false,
        reason: 'requires',
        missingRequires: missingRequires,
      };
    }

    var freePoints = includePending ? getAvailableFreePoints() : runtime.freePoints;
    if (freePoints < talent.costPerRank) {
      return { ok: false, reason: 'no_points' };
    }

    return { ok: true };
  }

  function markModsDirty() {
    runtime.modsDirty = true;
    runtime.modsCache = null;
  }

  /* solo-pipeline-yandex-vk batch B2 — talent_path achievements seam.
     Снимаем состояние всех веток (rankSum + maxRankSum + active ability
     талант) сразу после мутации runtime.ranksById, отдаём bridge'у в
     game.js (onTalentRanksPurchased), который вызывает
     AchievementsApi.recordTalentRanksPurchased. Карта активных
     способностей продублирована локально (см. game.js
     TALENTS_V2_ACTIVE_ID_BY_BRANCH) — talentsV2 единственный модуль,
     знающий runtime ranks без bootstrap зависимости от game.js. */
  var TALENT_PATH_BRANCH_IDS = ['offense', 'defense', 'economy'];
  var TALENT_PATH_ACTIVE_TALENT_BY_BRANCH = {
    offense: 'off_active_barrage',
    defense: 'def_dome',
    economy: 'eco_active_golden_hour',
  };

  function getTalentBranchSnapshotForAchievements() {
    var out = [];
    var ids = Object.keys(runtime.talentsById || {});
    for (var i = 0; i < TALENT_PATH_BRANCH_IDS.length; i++) {
      var branchId = TALENT_PATH_BRANCH_IDS[i];
      var rankSum = 0;
      var maxRankSum = 0;
      for (var j = 0; j < ids.length; j++) {
        var def = runtime.talentsById[ids[j]];
        if (!def || def.branch !== branchId) continue;
        rankSum += Math.max(0, toInt(runtime.ranksById[ids[j]], 0));
        maxRankSum += Math.max(1, toInt(def.maxRank, 1));
      }
      var activeId = TALENT_PATH_ACTIVE_TALENT_BY_BRANCH[branchId] || '';
      var activeDef = activeId ? runtime.talentsById[activeId] : null;
      var activeRank = activeId ? Math.max(0, toInt(runtime.ranksById[activeId], 0)) : 0;
      var activeMaxRank = activeDef ? Math.max(1, toInt(activeDef.maxRank, 1)) : 0;
      out.push({
        branchId: branchId,
        rankSum: rankSum,
        maxRankSum: maxRankSum,
        fullyMaxed: maxRankSum > 0 && rankSum >= maxRankSum,
        activeTalentId: activeId,
        activeRank: activeRank,
        activeMaxRank: activeMaxRank,
        activeMaxed: activeMaxRank > 0 && activeRank >= activeMaxRank,
      });
    }
    return out;
  }

  function emitTalentRanksPurchased(ranksDelta) {
    var delta = Math.max(0, toInt(ranksDelta, 0));
    if (delta <= 0) return;
    if (typeof global === 'undefined' || !global.Game) return;
    if (typeof global.Game.onTalentRanksPurchased !== 'function') return;
    try {
      global.Game.onTalentRanksPurchased({
        ranksDelta: delta,
        branches: getTalentBranchSnapshotForAchievements(),
      });
    } catch (_) { /* never break talents flow on achievement side */ }
  }

  function buyRank(talentId) {
    var check = canBuy(talentId);
    if (!check.ok) return check;

    var talent = runtime.talentsById[talentId];
    var currentRank = toInt(runtime.ranksById[talentId], 0);
    runtime.ranksById[talentId] = currentRank + 1;
    runtime.freePoints = Math.max(0, runtime.freePoints - talent.costPerRank);
    markModsDirty();
    persistSave();
    emitTalentRanksPurchased(1);

    return {
      ok: true,
      talentId: talentId,
      rank: runtime.ranksById[talentId],
      freePoints: runtime.freePoints,
    };
  }

  function queueRank(talentId) {
    var check = canBuy(talentId, { includePending: true });
    if (!check.ok) return check;

    var currentPending = toInt(runtime.pendingById[talentId], 0);
    runtime.pendingById[talentId] = Math.max(0, currentPending + 1);

    return {
      ok: true,
      talentId: talentId,
      pendingRank: runtime.pendingById[talentId],
      pendingCost: getPendingCost(),
      availableFreePoints: getAvailableFreePoints(),
    };
  }

  function resetPending(branchId) {
    var hasBranchFilter = typeof branchId === 'string' && branchId.length > 0;
    var ids = Object.keys(runtime.pendingById || {});
    var clearedRanks = 0;
    for (var i = 0; i < ids.length; i++) {
      var talentId = ids[i];
      var pending = Math.max(0, toInt(runtime.pendingById[talentId], 0));
      if (pending <= 0) continue;
      var def = runtime.talentsById[talentId];
      if (hasBranchFilter && (!def || def.branch !== branchId)) continue;
      clearedRanks += pending;
      delete runtime.pendingById[talentId];
    }
    return {
      ok: true,
      clearedRanks: clearedRanks,
      pendingCost: getPendingCost(),
      availableFreePoints: getAvailableFreePoints(),
    };
  }

  function applyPending() {
    var pendingCost = getPendingCost();
    if (pendingCost <= 0) return { ok: false, reason: 'no_pending' };
    if (pendingCost > runtime.freePoints) return { ok: false, reason: 'no_points' };

    var ids = Object.keys(runtime.pendingById || {});
    var appliedRanks = 0;
    for (var i = 0; i < ids.length; i++) {
      var talentId = ids[i];
      var pending = Math.max(0, toInt(runtime.pendingById[talentId], 0));
      if (pending <= 0) continue;
      var def = runtime.talentsById[talentId];
      if (!def) continue;
      var currentRank = Math.max(0, toInt(runtime.ranksById[talentId], 0));
      var nextRank = Math.min(def.maxRank, currentRank + pending);
      if (nextRank > 0) runtime.ranksById[talentId] = nextRank;
      appliedRanks += Math.max(0, nextRank - currentRank);
    }

    runtime.pendingById = {};
    runtime.freePoints = Math.max(0, runtime.freePoints - pendingCost);
    markModsDirty();
    persistSave();
    emitTalentRanksPurchased(appliedRanks);

    return {
      ok: true,
      appliedRanks: appliedRanks,
      spentPoints: pendingCost,
      freePoints: runtime.freePoints,
    };
  }

  function clearRuntimeEffects(payload) {
    var ctx = payload || {};
    var runRt = ensureRunRt();

    runRt.actives.offense.untilMs = 0;
    runRt.actives.offense.charges = 0;
    runRt.actives.offense.nextRechargeAtMs = 0;
    runRt.actives.defense.untilMs = 0;
    runRt.actives.defense.charges = 0;
    runRt.actives.defense.nextRechargeAtMs = 0;
    runRt.actives.economy.untilMs = 0;
    runRt.actives.economy.charges = 0;
    runRt.actives.economy.nextRechargeAtMs = 0;
    runRt._activesInitialized = false;

    runRt.eco.taxReliefUntilMs = 0;
    runRt.eco.repairDiscountReady = false;

    var tanks = Array.isArray(ctx.tanks) ? ctx.tanks : [];
    for (var ti = 0; ti < tanks.length; ti++) {
      if (tanks[ti] && typeof tanks[ti] === 'object') delete tanks[ti]._talentRt;
    }

    var zombies = Array.isArray(ctx.zombies) ? ctx.zombies : [];
    for (var zi = 0; zi < zombies.length; zi++) {
      if (zombies[zi] && typeof zombies[zi] === 'object') delete zombies[zi]._statusRt;
    }

    var fenceSegments = Array.isArray(ctx.fenceSegments) ? ctx.fenceSegments : [];
    for (var fi = 0; fi < fenceSegments.length; fi++) {
      if (fenceSegments[fi] && typeof fenceSegments[fi] === 'object') delete fenceSegments[fi]._defRt;
    }

    return { ok: true };
  }

  function executeRespec(payload) {
    runtime.pendingById = {};
    var ids = Object.keys(runtime.talentsById || {});
    var refundPoints = 0;
    for (var i = 0; i < ids.length; i++) {
      var talentId = ids[i];
      var def = runtime.talentsById[talentId];
      var rank = toInt(runtime.ranksById[talentId], 0);
      if (rank <= 0) continue;
      refundPoints += rank * Math.max(1, toInt(def.costPerRank, 1));
      delete runtime.ranksById[talentId];
    }

    runtime.freePoints += refundPoints;
    markModsDirty();
    clearRuntimeEffects(payload);

    return {
      ok: true,
      refunded: refundPoints,
      freePoints: runtime.freePoints,
    };
  }

  function respec(payload) {
    var result = executeRespec(payload);
    persistSave();

    return result;
  }

  function tryRespec(options) {
    var opts = options || {};
    var check = canRespec({ nowMs: opts.nowMs, coins: opts.coins });
    if (!check.ok) return check;

    if (typeof opts.spendCoins === 'function') {
      if (opts.spendCoins(check.price) !== true) {
        return {
          ok: false,
          reason: 'no_coins',
          price: check.price,
          cooldownEndsAtMs: 0,
          cooldownRemainingMs: 0,
        };
      }
    }

    var nowMs = isFiniteNumber(opts.nowMs) ? Math.max(0, opts.nowMs) : runtime.nowMsFn();
    var result = executeRespec(opts);
    runtime.respec = {
      resetCount: Math.max(0, toInt(runtime.respec && runtime.respec.resetCount, 0)) + 1,
      cooldownEndsAtMs: nowMs + RESPEC_COOLDOWN_MS,
    };
    persistSave();

    return {
      ok: true,
      refunded: result.refunded,
      freePoints: result.freePoints,
      spentCoins: check.price,
      resetCount: runtime.respec.resetCount,
      cooldownEndsAtMs: runtime.respec.cooldownEndsAtMs,
      cooldownDurationMs: RESPEC_COOLDOWN_MS,
      nextPrice: getRespecPriceByCount(runtime.respec.resetCount),
    };
  }

  function refundAll() {
    return respec();
  }

  function getMods() {
    if (!runtime.tree) return createBaseMods();
    if (runtime.modsDirty || !runtime.modsCache) {
      runtime.modsCache = computeModsFromTalents(runtime.tree, runtime.ranksById);
      runtime.modsDirty = false;
      var modsIssues = collectModsContractIssues(runtime.modsCache);
      if (modsIssues.length > 0) {
        runtime.lastValidationIssues = validate({ tree: runtime.tree, ranksById: runtime.ranksById });
        if (DEV_MODE) {
          console.warn('[TalentsV2] mods contract issues', modsIssues);
        }
      }
    }
    syncRunActiveCharges(runtime.modsCache);
    return runtime.modsCache;
  }

  function ensureTankRt(tank) {
    if (!tank || typeof tank !== 'object') return null;

    var rt = tank._talentRt;
    if (!rt || typeof rt !== 'object') {
      rt = {
        buffs: {
          armorPiercing: { untilMs: 0 },
          impulse: { untilMs: 0 },
          killBounty: { untilMs: 0 },
          offenseActive: { untilMs: 0 },
        },
        icdUntil: {
          armorPiercing: 0,
          impulse: 0,
          killBounty: 0,
        },
        counters: { shots: 0 },
        ramp: { stacks: 0, lastShotAtMs: 0, nextTickAtMs: 0 },
      };
      tank._talentRt = rt;
    }

    if (!rt.buffs || typeof rt.buffs !== 'object') rt.buffs = {};
    if (!rt.buffs.armorPiercing || typeof rt.buffs.armorPiercing !== 'object') rt.buffs.armorPiercing = { untilMs: 0 };
    if (!rt.buffs.impulse || typeof rt.buffs.impulse !== 'object') rt.buffs.impulse = { untilMs: 0 };
    if (!rt.buffs.killBounty || typeof rt.buffs.killBounty !== 'object') rt.buffs.killBounty = { untilMs: 0 };
    if (!rt.buffs.offenseActive || typeof rt.buffs.offenseActive !== 'object') rt.buffs.offenseActive = { untilMs: 0 };
    if (!isFiniteNumber(rt.buffs.armorPiercing.untilMs)) rt.buffs.armorPiercing.untilMs = 0;
    if (!isFiniteNumber(rt.buffs.impulse.untilMs)) rt.buffs.impulse.untilMs = 0;
    if (!isFiniteNumber(rt.buffs.killBounty.untilMs)) rt.buffs.killBounty.untilMs = 0;
    if (!isFiniteNumber(rt.buffs.offenseActive.untilMs)) rt.buffs.offenseActive.untilMs = 0;

    if (!rt.icdUntil || typeof rt.icdUntil !== 'object') rt.icdUntil = {};
    if (!isFiniteNumber(rt.icdUntil.armorPiercing)) rt.icdUntil.armorPiercing = 0;
    if (!isFiniteNumber(rt.icdUntil.impulse)) rt.icdUntil.impulse = 0;
    if (!isFiniteNumber(rt.icdUntil.killBounty)) rt.icdUntil.killBounty = 0;

    if (!rt.counters || typeof rt.counters !== 'object') rt.counters = {};
    if (!isFiniteNumber(rt.counters.shots)) rt.counters.shots = 0;

    if (!rt.ramp || typeof rt.ramp !== 'object') rt.ramp = {};
    if (!isFiniteNumber(rt.ramp.stacks)) rt.ramp.stacks = 0;
    if (!isFiniteNumber(rt.ramp.lastShotAtMs)) rt.ramp.lastShotAtMs = 0;
    if (!isFiniteNumber(rt.ramp.nextTickAtMs)) rt.ramp.nextTickAtMs = 0;

    return rt;
  }

  function ensureZombieRt(zombie) {
    if (!zombie || typeof zombie !== 'object') return null;

    var rt = zombie._statusRt;
    if (!rt || typeof rt !== 'object') {
      rt = {
        dots: {
          acid: { untilMs: 0, dps: 0, nextTickMs: 0 },
          converted: { untilMs: 0, dps: 0, nextTickMs: 0 },
        },
        markUntilMs: 0,
        cc: { slowUntilMs: 0, slowPct: 0, stunUntilMs: 0, icdUntilMs: 0 },
      };
      zombie._statusRt = rt;
    }

    if (!rt.dots || typeof rt.dots !== 'object') rt.dots = {};
    if (!rt.dots.acid || typeof rt.dots.acid !== 'object') rt.dots.acid = { untilMs: 0, dps: 0, nextTickMs: 0 };
    if (!rt.dots.converted || typeof rt.dots.converted !== 'object') rt.dots.converted = { untilMs: 0, dps: 0, nextTickMs: 0 };
    if (!isFiniteNumber(rt.dots.acid.untilMs)) rt.dots.acid.untilMs = 0;
    if (!isFiniteNumber(rt.dots.acid.dps)) rt.dots.acid.dps = 0;
    if (!isFiniteNumber(rt.dots.acid.nextTickMs)) rt.dots.acid.nextTickMs = 0;
    if (!isFiniteNumber(rt.dots.converted.untilMs)) rt.dots.converted.untilMs = 0;
    if (!isFiniteNumber(rt.dots.converted.dps)) rt.dots.converted.dps = 0;
    if (!isFiniteNumber(rt.dots.converted.nextTickMs)) rt.dots.converted.nextTickMs = 0;

    if (!isFiniteNumber(rt.markUntilMs)) rt.markUntilMs = 0;
    if (!rt.cc || typeof rt.cc !== 'object') rt.cc = {};
    if (!isFiniteNumber(rt.cc.slowUntilMs)) rt.cc.slowUntilMs = 0;
    if (!isFiniteNumber(rt.cc.slowPct)) rt.cc.slowPct = 0;
    if (!isFiniteNumber(rt.cc.stunUntilMs)) rt.cc.stunUntilMs = 0;
    if (!isFiniteNumber(rt.cc.icdUntilMs)) rt.cc.icdUntilMs = 0;

    return rt;
  }

  function ensureSegRt(seg) {
    if (!seg || typeof seg !== 'object') return null;

    var rt = seg._defRt;
    if (!rt || typeof rt !== 'object') {
      rt = {
        shieldHp: 0,
        barrierUntilMs: 0,
        barrierIcdUntilMs: 0,
        lastDamageAtMs: 0,
        secondWindUsed: false,
        // solo-pipeline-yandex-vk item 2: per-segment secondWind cooldown (serialized).
        secondWindReadyAtMs: 0,
        immunityUntilMs: 0,
        immunityIcdUntilMs: 0,
        stunIcdUntilMs: 0,
        thornsIcdUntilMs: 0,
        nextShieldAtMs: 0,
        nextAutoRepairAtMs: 0,
        nextRegenAtMs: 0,
        // solo-pipeline-yandex-vk item 3: protectAhead phase cycle.
        // Phase semantics: analyzing during [now .. analyzeUntilMs], then buff active during
        // [analyzeUntilMs .. buffUntilMs]; on buff expiry a new analyze window starts. Not
        // serialized — savescum allowed per user decision (phases re-init on load).
        protectAheadAnalyzeUntilMs: 0,
        protectAheadBuffUntilMs: 0,
      };
      seg._defRt = rt;
    }

    if (!isFiniteNumber(rt.shieldHp)) rt.shieldHp = 0;
    if (!isFiniteNumber(rt.barrierUntilMs)) rt.barrierUntilMs = 0;
    if (!isFiniteNumber(rt.barrierIcdUntilMs)) rt.barrierIcdUntilMs = 0;
    if (!isFiniteNumber(rt.lastDamageAtMs)) rt.lastDamageAtMs = 0;
    if (typeof rt.secondWindUsed !== 'boolean') rt.secondWindUsed = false;
    if (!isFiniteNumber(rt.secondWindReadyAtMs)) rt.secondWindReadyAtMs = 0;
    if (!isFiniteNumber(rt.immunityUntilMs)) rt.immunityUntilMs = 0;
    if (!isFiniteNumber(rt.immunityIcdUntilMs)) rt.immunityIcdUntilMs = 0;
    if (!isFiniteNumber(rt.stunIcdUntilMs)) rt.stunIcdUntilMs = 0;
    if (!isFiniteNumber(rt.thornsIcdUntilMs)) rt.thornsIcdUntilMs = 0;
    if (!isFiniteNumber(rt.nextShieldAtMs)) rt.nextShieldAtMs = 0;
    if (!isFiniteNumber(rt.nextAutoRepairAtMs)) rt.nextAutoRepairAtMs = 0;
    if (!isFiniteNumber(rt.nextRegenAtMs)) rt.nextRegenAtMs = 0;
    if (!isFiniteNumber(rt.protectAheadAnalyzeUntilMs)) rt.protectAheadAnalyzeUntilMs = 0;
    if (!isFiniteNumber(rt.protectAheadBuffUntilMs)) rt.protectAheadBuffUntilMs = 0;

    return rt;
  }

  function isActive(untilMs, nowMs) {
    return toNumber(untilMs, 0) > toNumber(nowMs, 0);
  }

  function refreshUntil(nowMs, durationMs) {
    return toNumber(nowMs, 0) + Math.max(0, toNumber(durationMs, 0));
  }

  function canProc(nowMs, icdUntilMs) {
    return toNumber(nowMs, 0) >= toNumber(icdUntilMs, 0);
  }

  function startIcd(nowMs, icdMs) {
    return toNumber(nowMs, 0) + Math.max(0, toNumber(icdMs, 0));
  }

  function getRngFloat01(rng) {
    if (typeof rng === 'function') return toNumber(rng(), Math.random());
    if (rng && typeof rng.nextFloat01 === 'function') return toNumber(rng.nextFloat01(), Math.random());
    if (rng && typeof rng.random === 'function') return toNumber(rng.random(), Math.random());
    return Math.random();
  }

  function rollChance(rng, chance, chanceKey) {
    var normalizedChance = resolveChance(chance, chanceKey);
    if (normalizedChance <= 0) return false;
    if (normalizedChance >= 1) return true;
    return getRngFloat01(rng) < normalizedChance;
  }

  function ensureDebugHotkeysBound() {
    if (!DEV_MODE || !global || typeof global.addEventListener !== 'function') return;
    var dbg = runtime._debug;
    if (dbg.hotkeysBound) return;
    global.addEventListener('keydown', function (evt) {
      var cfg = readDebugConfig(runtime.nowMsFn());
      if (!cfg.dumpEnabled) return;
      var key = evt && typeof evt.key === 'string' ? evt.key : '';
      if (key !== 'F8') return;
      debugDump();
    });
    dbg.hotkeysBound = true;
  }

  function refreshTankBuff(params) {
    var ctx = params || {};
    var rt = ensureTankRt(ctx.tank);
    if (!rt) return 0;

    var buffKey = ctx.buffKey;
    if (typeof buffKey !== 'string' || !buffKey) return 0;
    if (!rt.buffs[buffKey] || typeof rt.buffs[buffKey] !== 'object') rt.buffs[buffKey] = { untilMs: 0 };

    var nowMs = toNumber(ctx.nowMs, runtime.nowMsFn());
    var untilMs = refreshUntil(nowMs, ctx.durationMs);
    rt.buffs[buffKey].untilMs = untilMs;
    return untilMs;
  }

  function getModNumber(mods, key, aliases, fallback) {
    var value = null;
    if (mods && isFiniteNumber(mods[key])) {
      value = mods[key];
    }
    if (!isFiniteNumber(value) && Array.isArray(aliases)) {
      for (var ai = 0; ai < aliases.length; ai++) {
        var aliasKey = aliases[ai];
        if (mods && isFiniteNumber(mods[aliasKey])) {
          value = mods[aliasKey];
          break;
        }
      }
    }
    return isFiniteNumber(value) ? Number(value) : fallback;
  }

  function getDotState(statusRt, dotKey) {
    if (!statusRt || !statusRt.dots) return null;
    if (!statusRt.dots[dotKey] || typeof statusRt.dots[dotKey] !== 'object') {
      statusRt.dots[dotKey] = { untilMs: 0, dps: 0, nextTickMs: 0 };
    }
    var dotState = statusRt.dots[dotKey];
    if (!isFiniteNumber(dotState.untilMs)) dotState.untilMs = 0;
    if (!isFiniteNumber(dotState.dps)) dotState.dps = 0;
    if (!isFiniteNumber(dotState.nextTickMs)) dotState.nextTickMs = 0;
    return dotState;
  }

  function resolveEntityPosition(entity, getZombiePosFn) {
    if (!entity || typeof entity !== 'object') return null;
    if (typeof getZombiePosFn === 'function') {
      var viaFn = getZombiePosFn(entity);
      if (viaFn && isFiniteNumber(viaFn.x) && isFiniteNumber(viaFn.y)) {
        return { x: toNumber(viaFn.x, 0), y: toNumber(viaFn.y, 0) };
      }
    }
    if (isFiniteNumber(entity.x) && isFiniteNumber(entity.y)) {
      return { x: toNumber(entity.x, 0), y: toNumber(entity.y, 0) };
    }
    return null;
  }

  function buildVisitedKey(entity) {
    if (!entity || typeof entity !== 'object') return null;
    if (entity.id !== undefined && entity.id !== null) return 'id:' + String(entity.id);
    return null;
  }

  function isVisitedEntity(visited, entity) {
    if (!visited || !entity || typeof entity !== 'object') return false;
    var key = buildVisitedKey(entity);
    if (key !== null) return visited.has(key);
    return visited.has(entity);
  }

  function markVisitedEntity(visited, entity) {
    if (!visited || !entity || typeof entity !== 'object') return;
    var key = buildVisitedKey(entity);
    if (key !== null) {
      visited.add(key);
      return;
    }
    visited.add(entity);
  }

  function findNearestRicochetTarget(ctx) {
    var from = ctx && ctx.from;
    var zombies = ctx && Array.isArray(ctx.zombies) ? ctx.zombies : [];
    var visited = ctx && ctx.visited;
    var radius = Math.max(0, toNumber(ctx && ctx.radius, 0));
    var getZombiePosFn = ctx ? ctx.getZombiePosFn : null;
    if (!from || !zombies.length || radius <= 0) return null;

    var fromPos = resolveEntityPosition(from, getZombiePosFn);
    if (!fromPos) return null;

    var best = null;
    var bestDistSq = Infinity;
    var radiusSq = radius * radius;

    for (var i = 0; i < zombies.length; i++) {
      var candidate = zombies[i];
      if (!candidate || candidate === from) continue;
      if (candidate.state === 'dying') continue;
      if (isVisitedEntity(visited, candidate)) continue;

      var candidatePos = resolveEntityPosition(candidate, getZombiePosFn);
      if (!candidatePos) continue;

      var dx = candidatePos.x - fromPos.x;
      var dy = candidatePos.y - fromPos.y;
      var distSq = dx * dx + dy * dy;
      if (distSq > radiusSq) continue;
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        best = candidate;
      }
    }
    return best;
  }

  function getRicochetBounces(mods) {
    var direct = toInt(getModNumber(mods, 'ricochetBounces', [], -1), -1);
    if (direct >= 0) return direct;

    var base = Math.max(0, toInt(getModNumber(mods, 'ricochetBouncesBase', [], 0), 0));
    var fromRank = Math.max(0, toInt(getModNumber(mods, 'ricochetBouncesFromRank', [], 0), 0));
    var upgraded = Math.max(0, toInt(getModNumber(mods, 'ricochetBouncesValue', [], base), base));
    var rank = toInt(runtime.ranksById && runtime.ranksById.off_ricochet, 0);
    if (fromRank > 0 && rank >= fromRank) return upgraded;
    return base;
  }

  function _applyDotDamage(payload) {
    var ctx = payload || {};
    var zombie = ctx.zombie;
    if (!zombie || typeof zombie !== 'object' || zombie.state === 'dying') return 0;

    var beforeHp = Math.max(0, toNumber(zombie.hp, 0));
    if (beforeHp <= 0) return 0;

    var incomingDamage = Math.max(0, toNumber(ctx.damage, 0));
    if (incomingDamage <= 0) return 0;

    var nextHp = Math.max(0, beforeHp - incomingDamage);
    zombie.hp = nextHp;
    return beforeHp - nextHp;
  }

  function tickStatuses(payload) {
    var ctx = payload || {};
    var zombies = Array.isArray(ctx.zombies) ? ctx.zombies : [];
    var timing = resolveDebugFrameTime('tickStatuses', toNumber(ctx.timeMs, runtime.nowMsFn()), toNumber(ctx.dtMs, 0));
    var timeMs = timing.timeMs;
    var tickStepMs = DOT_TICK_STEP_MS;
    var maxCatchupSteps = getMaxCatchupSteps();

    for (var zi = 0; zi < zombies.length; zi++) {
      var zombie = zombies[zi];
      if (!zombie || typeof zombie !== 'object') continue;

      var statusRt = ensureZombieRt(zombie);
      if (!statusRt || !statusRt.dots) continue;

      for (var di = 0; di < DOT_KEYS.length; di++) {
        var dotKey = DOT_KEYS[di];
        var dotRt = statusRt.dots[dotKey];
        if (!dotRt || typeof dotRt !== 'object') continue;

        if (!isFiniteNumber(dotRt.untilMs)) dotRt.untilMs = 0;
        if (!isFiniteNumber(dotRt.dps)) dotRt.dps = 0;
        if (!isFiniteNumber(dotRt.nextTickMs)) dotRt.nextTickMs = 0;

        if (timeMs >= dotRt.untilMs || dotRt.dps <= 0) {
          if (timeMs >= dotRt.untilMs) {
            dotRt.dps = 0;
            dotRt.nextTickMs = 0;
          }
          continue;
        }

        if (dotRt.nextTickMs <= 0) {
          dotRt.nextTickMs = timeMs + tickStepMs;
        }

        var dotSteps = 0;
        while (timeMs >= dotRt.nextTickMs) {
          var tickDamage = dotRt.dps * (tickStepMs / 1000);
          if (tickDamage > 0) {
            var dotDamageHook = api && typeof api._applyDotDamage === 'function'
              ? api._applyDotDamage
              : _applyDotDamage;
            dotDamageHook({
              zombie: zombie,
              source: dotKey,
              damage: tickDamage,
              timeMs: dotRt.nextTickMs,
            });
          }
          dotRt.nextTickMs += tickStepMs;
          dotSteps += 1;
          if (dotSteps >= maxCatchupSteps) {
            dotRt.nextTickMs = clampLoopProgressToNearNow(timeMs, tickStepMs);
            warnWithCooldown('dot_catchup_guard', '[TalentsV2] DOT catch-up steps limit reached; clamped to near-now tick.', {
              zombieId: zombie && zombie.id,
              dotKey: dotKey,
              maxSteps: maxCatchupSteps,
            });
            break;
          }
        }
      }
    }
  }

  function _onShotCounterAndRamp(payload) {
    var ctx = payload || {};
    var tank = ctx.tank;
    var rt = ensureTankRt(tank);
    if (!rt) return null;

    var timeMs = toNumber(ctx.timeMs, runtime.nowMsFn());
    var mods = ctx.mods && typeof ctx.mods === 'object' ? ctx.mods : getMods();

    rt.counters.shots = Math.max(0, toInt(rt.counters.shots, 0) + 1);

    var ramp = rt.ramp;
    var graceMs = Math.max(0, toNumber(mods.rampGraceMs, toNumber(mods.rampUpGraceMs, 0)));
    var rampTickMs = Math.max(0, toNumber(mods.rampTickMs, toNumber(mods.rampUpTickMs, 0)));
    var rampStackMax = Math.max(0, toInt(mods.rampStackMax, toInt(mods.rampUpStackMax, 0)));
    var maxCatchupSteps = getMaxCatchupSteps();

    if (ramp.lastShotAtMs > 0 && (timeMs - ramp.lastShotAtMs) > graceMs) {
      ramp.stacks = 0;
      ramp.nextTickAtMs = 0;
    }

    ramp.lastShotAtMs = timeMs;

    if (rampTickMs > 0) {
      if (ramp.nextTickAtMs <= 0) {
        ramp.nextTickAtMs = timeMs + rampTickMs;
      }
      var rampSteps = 0;
      while (timeMs >= ramp.nextTickAtMs) {
        ramp.stacks = Math.min(rampStackMax, Math.max(0, toInt(ramp.stacks, 0) + 1));
        ramp.nextTickAtMs += rampTickMs;
        rampSteps += 1;
        if (rampSteps >= maxCatchupSteps) {
          ramp.nextTickAtMs = clampLoopProgressToNearNow(timeMs, rampTickMs);
          warnWithCooldown('ramp_catchup_guard', '[TalentsV2] ramp catch-up steps limit reached; clamped to near-now tick.', {
            tankId: tank && tank.id,
            maxSteps: maxCatchupSteps,
          });
          break;
        }
      }
    }

    if (ramp.stacks > rampStackMax) ramp.stacks = rampStackMax;
    return {
      shots: rt.counters.shots,
      stacks: ramp.stacks,
      nextTickAtMs: ramp.nextTickAtMs,
      lastShotAtMs: ramp.lastShotAtMs,
    };
  }

  function init(options) {
    var opts = options || {};
    runtime.loadSaveFn = typeof opts.loadSaveFn === 'function' ? opts.loadSaveFn : null;
    runtime.saveFn = typeof opts.saveFn === 'function' ? opts.saveFn : null;
    runtime.assetLoader = opts.assetLoader || null;
    runtime.nowMsFn = typeof opts.nowMsFn === 'function' ? opts.nowMsFn : runtime.nowMsFn;
    runtime.getMaxTankBaseDamageFn = typeof opts.getMaxTankBaseDamageFn === 'function' ? opts.getMaxTankBaseDamageFn : null;
    ensureDebugHotkeysBound();

    return loadTree().then(function () {
      loadFromSave();
      syncRunActiveCharges(getMods());
      return getTreeMeta();
    });
  }

  function onShotFired(payload) {
    var ctx = payload || {};
    var tank = (ctx && ctx.tank) ? ctx.tank : payload;
    var rt = ensureTankRt(tank);
    if (!rt) return null;

    var mods = (ctx && ctx.mods && typeof ctx.mods === 'object') ? ctx.mods : getMods();
    var timeMs = toNumber(ctx.timeMs, runtime.nowMsFn());
    var rng = ctx.rng || ctx.random;
    runtime._debug.counters.shotCalls += 1;
    runtime._debug.lastSeen.tank = tank;

    var rampState = _onShotCounterAndRamp({ tank: tank, timeMs: timeMs, mods: mods });

    var apChance = resolveChance(getModNumber(mods, 'armorPiercingProcChance', [], 0), 'armorpiercing');
    if (apChance > 0 && canProc(timeMs, rt.icdUntil.armorPiercing) && rollChance(rng, apChance, 'armorpiercing')) {
      rt.buffs.armorPiercing.untilMs = refreshUntil(timeMs, getModNumber(mods, 'armorPiercingProcDurationMs', [], 0));
      rt.icdUntil.armorPiercing = startIcd(timeMs, getModNumber(mods, 'armorPiercingProcIcdMs', [], 0));
    }

    var impulseChance = resolveChance(getModNumber(mods, 'impulseProcChance', [], 0), 'impulse');
    if (impulseChance > 0 && canProc(timeMs, rt.icdUntil.impulse) && rollChance(rng, impulseChance, 'impulse')) {
      rt.buffs.impulse.untilMs = refreshUntil(timeMs, getModNumber(mods, 'impulseProcDurationMs', [], 0));
      rt.icdUntil.impulse = startIcd(timeMs, getModNumber(mods, 'impulseProcIcdMs', [], 0));
    }

    var killBountyChance = resolveChance(getModNumber(mods, 'killBountyChance', [], 0), 'killbounty');
    if (killBountyChance > 0 && canProc(timeMs, rt.icdUntil.killBounty) && rollChance(rng, killBountyChance, 'killbounty')) {
      rt.buffs.killBounty.untilMs = refreshUntil(timeMs, getModNumber(mods, 'killBountyDurationMs', [], 0));
      rt.icdUntil.killBounty = startIcd(timeMs, getModNumber(mods, 'killBountyIcdMs', [], 0));
    }

    return rampState;
  }

  // Returns AoE-radius multiplier to apply to the next bullet spawn for the
  // given tank. Mirrors the pulse-damage gating at L2832-2835 (same modulo
  // window: shots > 0 && shots % pulseEveryNShots === 0). Must be called AFTER
  // onShotFired so rt.counters.shots is already incremented for the current shot.
  // Returns 1 when pulseAoe is not unlocked or current shot is not a pulse shot.
  function getPulseShotMultiplier(payload) {
    var ctx = payload || {};
    var tank = (ctx && ctx.tank) ? ctx.tank : payload;
    if (!tank) return 1;
    var rt = ensureTankRt(tank);
    if (!rt) return 1;
    var mods = (ctx && ctx.mods && typeof ctx.mods === 'object') ? ctx.mods : getMods();
    var pulseEveryN = Math.max(0, toInt(getModNumber(mods, 'pulseEveryNShots', ['pulseAoeEveryN'], 0), 0));
    if (pulseEveryN <= 0) return 1;
    var shots = Math.max(0, toInt(rt.counters && rt.counters.shots, 0));
    if (shots <= 0 || (shots % pulseEveryN) !== 0) return 1;
    return Math.max(0, getModNumber(mods, 'pulseRadiusMul', ['pulseAoeMul'], 1));
  }

  // Returns barrage (offense-active) multipliers active for the given tank at
  // timeMs. While the tank's offenseActive buff window is open, returns the
  // configured multipliers for fireRate / orbitSpeed / aoe / damage. Otherwise
  // each multiplier is 1. game.js wires fireRate into stats.fr, orbit into
  // angularSpeed and aoe into the bullet aoe at spawn time. Damage is applied
  // inside onHit (L2835) and is included here for completeness/diagnostics.
  function getBarrageMul(payload) {
    var ctx = payload || {};
    var tank = (ctx && ctx.tank) ? ctx.tank : payload;
    var out = { damage: 1, fireRate: 1, orbit: 1, aoe: 1, active: false };
    if (!tank) return out;
    var rt = ensureTankRt(tank);
    if (!rt) return out;
    var mods = (ctx && ctx.mods && typeof ctx.mods === 'object') ? ctx.mods : getMods();
    var timeMs = toNumber(ctx.timeMs, runtime.nowMsFn());
    var perTankUntil = toNumber(rt.buffs && rt.buffs.offenseActive && rt.buffs.offenseActive.untilMs, 0);
    var runUntil = toNumber(ensureRunRt().actives.offense.untilMs, 0);
    var until = Math.max(perTankUntil, runUntil);
    if (timeMs >= until) return out;
    out.active = true;
    out.damage = Math.max(0, getModNumber(mods, 'offActiveDamageMul', ['offenseActiveDamageMul'], 1));
    out.fireRate = Math.max(0, getModNumber(mods, 'offActiveFireRateMul', ['offenseActiveFireRateMul'], 1));
    out.orbit = Math.max(0, getModNumber(mods, 'offActiveOrbitMul', ['offenseActiveOrbitMul'], 1));
    out.aoe = Math.max(0, getModNumber(mods, 'offActiveAoeMul', ['offenseActiveAoeMul'], 1));
    return out;
  }

  function onHit(payload) {
    var ctx = payload || {};
    var tank = ctx.tank || null;
    var zombie = ctx.zombie || null;
    if (DEV_MODE && !isFiniteNumber(ctx.timeMs)) {
      throw new Error('[TalentsV2] onHit requires finite timeMs in dev mode');
    }
    var timeMs = toNumber(ctx.timeMs, runtime.nowMsFn());
    var mods = (ctx.mods && typeof ctx.mods === 'object') ? ctx.mods : getMods();
    var rng = ctx.rng || ctx.random;
    var source = typeof ctx.source === 'string' ? ctx.source : 'direct';
    var isRicochetSource = source === 'ricochet';
    var isAoe = !!ctx.isAoe;
    var aoeVictimsCount = Math.max(0, toInt(ctx.aoeVictimsCount, 0));

    var tankRt = ensureTankRt(tank);
    var zRt = ensureZombieRt(zombie);
    runtime._debug.counters.hitCalls += 1;
    if (!isAoe && !isRicochetSource) {
      runtime._debug.counters.directHitCalls += 1;
    }
    runtime._debug.lastSeen.tank = tank || runtime._debug.lastSeen.tank;
    runtime._debug.lastSeen.zombie = zombie || runtime._debug.lastSeen.zombie;
    // Compare only direct (non-AoE / non-ricochet) hits against shot count: AoE
    // explosions and ricochets legitimately produce many hit calls per shot
    // (especially during the supercomputer "critical state" mass-procs), and
    // the previous all-hits comparison flooded the console and dragged FPS.
    if (
      DEV_MODE &&
      runtime._debug.counters.shotCalls > 200 &&
      runtime._debug.counters.directHitCalls > runtime._debug.counters.shotCalls * 4 + 50
    ) {
      warnWithCooldown('missing_onShotFired', '[TalentsV2] direct onHit count exceeds onShotFired count. Check integration hooks.', {
        directHits: runtime._debug.counters.directHitCalls,
        totalHits: runtime._debug.counters.hitCalls,
        onShotFired: runtime._debug.counters.shotCalls,
      });
    }
    if (DEV_MODE && tankRt && toInt(tankRt.counters && tankRt.counters.shots, 0) <= 0) {
      warnWithCooldown('tank_shots_not_incremented', '[TalentsV2] onHit called while tank shot counter is not moving; onShotFired may be skipped.', {
        tankId: tank && tank.id,
      });
    }

    var d = Math.max(0, toNumber(ctx.damage, 0));
    if (d <= 0) {
      return { damage: 0 };
    }

    d *= Math.max(0, getModNumber(mods, 'damageMul', [], 1));

    if (tankRt && isActive(tankRt.buffs.armorPiercing.untilMs, timeMs)) {
      d *= Math.max(0, getModNumber(mods, 'armorPiercingProcDamageMul', [], 1));
    }
    if (tankRt && isActive(tankRt.buffs.offenseActive.untilMs, timeMs)) {
      d *= Math.max(0, getModNumber(mods, 'offActiveDamageMul', ['offenseActiveDamageMul'], 1));
    } else if (timeMs < toNumber(ensureRunRt().actives.offense.untilMs, 0)) {
      d *= Math.max(0, getModNumber(mods, 'offActiveDamageMul', ['offenseActiveDamageMul'], 1));
    }

    if (zRt && isActive(zRt.markUntilMs, timeMs)) {
      d *= Math.max(0, getModNumber(mods, 'markDamageTakenMul', [], 1));
    }

    if (zombie) {
      var threshold = clamp(getModNumber(mods, 'executeHpThreshold', [], 0), 0, 1);
      var maxHp = Math.max(0, toNumber(zombie.maxHp, 0));
      var hp = Math.max(0, toNumber(zombie.hp, 0));
      if (maxHp > 0 && threshold > 0 && (hp / maxHp) <= threshold) {
        var executeBonus = Math.max(0, getModNumber(mods, 'executeDamageMul', [], 0));
        d *= (1 + executeBonus);
      }
    }

    var pulseEveryNShots = Math.max(0, toInt(getModNumber(mods, 'pulseEveryNShots', ['pulseAoeEveryN'], 0), 0));
    var shotsCount = tankRt ? Math.max(0, toInt(tankRt.counters.shots, 0)) : 0;
    if (pulseEveryNShots > 0 && shotsCount > 0 && shotsCount % pulseEveryNShots === 0) {
      d *= Math.max(0, getModNumber(mods, 'pulseDamageMul', ['pulseAoeDamageMul'], 1));
    }

    var crowdMinCount = Math.max(0, toInt(getModNumber(mods, 'crowdMinCount', [], 0), 0));
    if (isAoe && crowdMinCount > 0 && aoeVictimsCount >= crowdMinCount) {
      d *= Math.max(0, getModNumber(mods, 'crowdAoeDamageMul', [], 1));
    }

    var finalDamage = Math.max(0, d);
    var directAfterConvert = finalDamage;
    var extraHits = null;

    if (!isRicochetSource && zRt) {
      var acidChance = resolveChance(getModNumber(mods, 'acidDotChance', [], 0), 'acid');
      if (acidChance > 0 && rollChance(rng, acidChance, 'acid')) {
        var acidDurationMs = Math.max(0, getModNumber(mods, 'acidDotDurationMs', [], 0));
        if (acidDurationMs > 0) {
          var acidTotalDamage = finalDamage * Math.max(0, getModNumber(mods, 'acidDotDpsMul', [], 1));
          var acidDurationSec = acidDurationMs / 1000;
          var acidDps = acidDurationSec > 0 ? (acidTotalDamage / acidDurationSec) : 0;
          if (acidDps > 0) {
            var acidDot = getDotState(zRt, 'acid');
            acidDot.untilMs = refreshUntil(timeMs, acidDurationMs);
            acidDot.dps = acidDps;
            acidDot.nextTickMs = 0;
          }
        }
      }

      var markChance = resolveChance(getModNumber(mods, 'markChance', [], 0), 'mark');
      if (markChance > 0 && rollChance(rng, markChance, 'mark')) {
        zRt.markUntilMs = refreshUntil(timeMs, getModNumber(mods, 'markDurationMs', [], 0));
      }

      var ccChance = resolveChance(getModNumber(mods, 'ccChance', ['ccMicroChance'], 0), 'cc');
      var ccIcdMs = Math.max(0, getModNumber(mods, 'ccIcdMs', ['ccMicroIcdMs'], 0));
      if (ccChance > 0 && canProc(timeMs, zRt.cc.icdUntilMs) && rollChance(rng, ccChance, 'cc')) {
        var slowDurationMs = Math.max(0, getModNumber(mods, 'ccSlowDurationMs', ['ccMicroSlowDurationMs'], 0));
        if (slowDurationMs > 0) {
          zRt.cc.slowUntilMs = refreshUntil(timeMs, slowDurationMs);
        }
        zRt.cc.icdUntilMs = startIcd(timeMs, ccIcdMs);
      }

      var ricochetChance = resolveChance(getModNumber(mods, 'ricochetChance', [], 0), 'ricochet');
      if (ricochetChance > 0 && rollChance(rng, ricochetChance, 'ricochet')) {
        var bounces = Math.max(0, getRicochetBounces(mods));
        var radius = Math.max(0, getModNumber(mods, 'ricochetRadius', [], 0));
        var ricochetDamageMul = Math.max(0, getModNumber(mods, 'ricochetDamageMul', [], 1));
        if (bounces > 0 && radius > 0) {
          var visited = new Set();
          markVisitedEntity(visited, zombie);
          var from = zombie;
          var zombies = Array.isArray(ctx.zombies) ? ctx.zombies : [];
          var getZombiePosFn = (typeof ctx.getZombiePos === 'function') ? ctx.getZombiePos : null;

          for (var bounceIndex = 0; bounceIndex < bounces; bounceIndex++) {
            var next = findNearestRicochetTarget({
              from: from,
              zombies: zombies,
              visited: visited,
              radius: radius,
              getZombiePosFn: getZombiePosFn,
            });
            if (!next) break;

            markVisitedEntity(visited, next);
            var extraDamage = Math.max(0, finalDamage * ricochetDamageMul);
            if (extraDamage > 0) {
              if (!extraHits) extraHits = [];
              extraHits.push({
                tank: tank,
                zombie: next,
                damage: extraDamage,
                timeMs: timeMs,
                source: 'ricochet',
                isAoe: false,
              });
            }
            from = next;
          }
        }
      }

      var convertToDotPct = clamp(getModNumber(mods, 'convertToDotPct', [], 0), 0, 1);
      var convertDurationMs = Math.max(0, getModNumber(mods, 'convertDotDurationMs', ['convertToDotDurationMs'], 0));
      if (convertToDotPct > 0 && convertDurationMs > 0 && finalDamage > 0) {
        var convertedDamage = finalDamage * convertToDotPct;
        directAfterConvert = Math.max(0, finalDamage - convertedDamage);
        var convertDurationSec = convertDurationMs / 1000;
        var convertedDps = convertDurationSec > 0 ? convertedDamage / convertDurationSec : 0;
        if (convertedDps > 0) {
          var convertedDot = getDotState(zRt, 'converted');
          convertedDot.untilMs = refreshUntil(timeMs, convertDurationMs);
          convertedDot.dps = convertedDps;
          convertedDot.nextTickMs = 0;
        }
      }
    }

    if (extraHits && extraHits.length > 0) {
      return { damage: directAfterConvert, extraHits: extraHits };
    }
    return { damage: directAfterConvert };
  }
  function resolveDamageTypeResistPct(mods, damageType) {
    if (typeof damageType !== 'string') return 0;
    if (damageType === 'fire') return clamp(getModNumber(mods, 'resistFirePct', ['resistXPct'], 0), 0, 1);
    if (damageType === 'acid') return clamp(getModNumber(mods, 'resistAcidPct', ['resistXPct'], 0), 0, 1);
    if (damageType === 'explosion') return clamp(getModNumber(mods, 'resistExplosionPct', ['resistXPct'], 0), 0, 1);
    return 0;
  }

  function getWallHitCenter(seg, hitPos) {
    if (hitPos && isFiniteNumber(hitPos.x) && isFiniteNumber(hitPos.y)) {
      return { x: toNumber(hitPos.x, 0), y: toNumber(hitPos.y, 0) };
    }
    return resolveEntityPosition(seg, null);
  }

  function applyDamageNoAttribution(ctx) {
    var target = ctx && ctx.target;
    var damage = Math.max(0, toNumber(ctx && ctx.damage, 0));
    if (!target || typeof target !== 'object' || damage <= 0) return 0;
    if (target.state === 'dying') return 0;
    var before = Math.max(0, toNumber(target.hp, 0));
    if (before <= 0) return 0;
    var after = Math.max(0, before - damage);
    target.hp = after;
    return before - after;
  }

  function onZombieNearWall(payload) {
    var ctx = payload || {};
    var zombie = ctx.zombie;
    var zRt = ensureZombieRt(zombie);
    if (!zRt) return { ok: false };
    var mods = (ctx.mods && typeof ctx.mods === 'object') ? ctx.mods : getMods();
    var slowPct = clamp(getModNumber(mods, 'wallSlowFieldPct', ['slowFieldPct'], 0), 0, 1);
    if (slowPct <= 0) return { ok: false };
    var timeMs = toNumber(ctx.timeMs, runtime.nowMsFn());
    zRt.cc.slowUntilMs = Math.max(toNumber(zRt.cc.slowUntilMs, 0), timeMs + 250);
    zRt.cc.slowPct = slowPct;
    return { ok: true, untilMs: zRt.cc.slowUntilMs, slowPct: slowPct };
  }

  function onWallDamage(payload) {
    var ctx = payload || {};
    var seg = ctx.seg;
    var rt = ensureSegRt(seg);
    if (!seg || !rt) return { damageToHp: 0, absorbedByShield: 0, prevented: true };

    var mods = (ctx.mods && typeof ctx.mods === 'object') ? ctx.mods : getMods();
    var runRt = ensureRunRt();
    var timeMs = toNumber(ctx.timeMs, runtime.nowMsFn());
    var rng = ctx.rng || ctx.random;
    var incoming = Math.max(0, toNumber(ctx.damage, 0));
    var prevented = false;

    // solo-pipeline-yandex-vk#1 batch#1 item 1 (Награда за стойкость): runRt.wave.damageToWalls
    // больше НЕ устанавливается eagerly при вызове onWallDamage. Per ТЗ §1: бонус выдаётся,
    // только если зомби не нанесли реального урона фрагментам, а не просто «коснулись» стены.
    // Гейт перенесён в final return path — если итоговый d > 0 (после armor/resist/shield/
    // secondWind), только тогда фиксируем «волне нанесли урон стенам».
    rt.lastDamageAtMs = timeMs;

    if (timeMs < rt.immunityUntilMs) {
      return { damageToHp: 0, absorbedByShield: 0, prevented: true };
    }

    var immunityChance = resolveChance(getModNumber(mods, 'immunityProcChance', [], 0), 'immunity');
    if (incoming > 0 && immunityChance > 0 && timeMs >= rt.immunityIcdUntilMs && rollChance(rng, immunityChance, 'immunity')) {
      rt.immunityUntilMs = timeMs + Math.max(0, getModNumber(mods, 'immunityDurationMs', ['immunityProcDurationMs'], 0));
      rt.immunityIcdUntilMs = timeMs + Math.max(0, getModNumber(mods, 'immunityIcdMs', ['immunityProcIcdMs'], 0));
      return { damageToHp: 0, absorbedByShield: 0, prevented: true };
    }

    var d = incoming;
    d = Math.max(0, d - Math.max(0, getModNumber(mods, 'wallArmorFlat', [], 0)));

    var resistPct = resolveDamageTypeResistPct(mods, ctx.damageType);
    if (resistPct > 0) d *= (1 - resistPct);

    // def_resists v3: tier-band damage reduction by zombie level. Each unlocked
    // tier covers a contiguous level band; only the matching band applies to
    // the current zombie (no per-zombie stacking across bands).
    var zombieForTier = ctx.zombie;
    var tierBands = mods && mods.resistByZombieLevel;
    if (Array.isArray(tierBands) && tierBands.length > 0 && zombieForTier) {
      var zLevel = Math.max(1, toNumber(zombieForTier.level, 1));
      for (var tb = 0; tb < tierBands.length; tb++) {
        var band = tierBands[tb];
        if (!band) continue;
        var minL = toNumber(band.minLevel, 1);
        var maxL = toNumber(band.maxLevel, 9999);
        if (zLevel >= minL && zLevel <= maxL) {
          var bandPct = clamp(toNumber(band.perRankPct, 0), 0, 1);
          if (bandPct > 0) d *= (1 - bandPct);
          break;
        }
      }
    }

    var barrierDrPct = clamp(getModNumber(mods, 'wallBarrierDrPct', [], 0), 0, 1);
    if (barrierDrPct > 0) {
      var hp = Math.max(0, toNumber(seg.hp, 0));
      var maxHp = Math.max(1, toNumber(seg.maxHp, 1));
      var threshold = clamp(getModNumber(mods, 'wallBarrierHpThreshold', [], 0), 0, 1);
      if (timeMs < rt.barrierUntilMs) {
        d *= (1 - barrierDrPct);
      } else if ((hp / maxHp) <= threshold && timeMs >= rt.barrierIcdUntilMs) {
        rt.barrierUntilMs = timeMs + Math.max(0, getModNumber(mods, 'wallBarrierDurationMs', [], 0));
        rt.barrierIcdUntilMs = timeMs + Math.max(0, getModNumber(mods, 'wallBarrierIcdMs', [], 0));
        d *= (1 - barrierDrPct);
      }
    }

    if (timeMs < toNumber(runRt.actives.defense.untilMs, 0)) {
      d *= Math.max(0, getModNumber(mods, 'defActiveDamageTakenMul', ['defenseActiveDamageTakenMul'], 1));
    }

    d *= (1 - clamp(getModNumber(mods, 'wallDrPct', [], 0), 0, 1));

    // solo-pipeline-yandex-vk items 3+4: tiered damageBlessing armor (non-stacking) + protectAhead
    // buff armor (additive between the two talents). Pre-damage HP snapshot is used for tier
    // selection so the talent picks the threshold that matches the segment's CURRENT HP before
    // applying this hit. The two armor sources sum additively per user decision.
    var segHpSnapshotForArmor = Math.max(0, toNumber(seg.hp, 0));
    var segMaxHpForArmor = Math.max(1, toNumber(seg.maxHp, 1));
    var hpRatioForArmor = segHpSnapshotForArmor / segMaxHpForArmor;
    var combinedArmorBonus = 0;
    var damageBlessingTiers = mods && mods.damageBlessingTiers;
    if (Array.isArray(damageBlessingTiers) && damageBlessingTiers.length > 0) {
      var blessingRank = Math.max(0, toInt(runtime.ranksById && runtime.ranksById['def_broken_dr'], 0));
      if (blessingRank > 0) {
        // Iterate from highest tier down: pick the deepest unlocked tier that matches current HP.
        // Tiers are non-stacking — only one bonus is granted at a time.
        var pickedBonus = 0;
        for (var dbI = damageBlessingTiers.length - 1; dbI >= 0; dbI--) {
          var tierEntry = damageBlessingTiers[dbI];
          if (!tierEntry) continue;
          var tierRank = toInt(tierEntry.rank, 0);
          var tierHpMax = toNumber(tierEntry.hpRatioMax, 0);
          var tierArmor = toNumber(tierEntry.armorBonus, 0);
          if (tierRank <= blessingRank && hpRatioForArmor < tierHpMax) {
            pickedBonus = tierArmor;
            break;
          }
        }
        combinedArmorBonus += Math.max(0, pickedBonus);
      }
    }
    // protectAhead buff phase armor (item 3). Phase state is owned by segRt.protectAheadBuffUntilMs,
    // updated in onUpdate. During buff phase the armor adds to combinedArmorBonus.
    if (toNumber(rt.protectAheadBuffUntilMs, 0) > timeMs) {
      combinedArmorBonus += Math.max(0, getModNumber(mods, 'protectAheadArmorPerRank', [], 0));
    }
    if (combinedArmorBonus > 0) {
      d *= (1 - clamp(combinedArmorBonus, 0, 0.95));
    }

    var absorbedByShield = Math.min(Math.max(0, rt.shieldHp), d);
    rt.shieldHp = Math.max(0, rt.shieldHp - absorbedByShield);
    d = Math.max(0, d - absorbedByShield);

    if (d > 0) {
      var segHp = Math.max(0, toNumber(seg.hp, 0));
      var segMaxHp = Math.max(1, toNumber(seg.maxHp, 1));
      var secondWindRestorePct = Math.max(0, getModNumber(mods, 'secondWindRestorePct', [], 0));
      var secondWindCooldownMs = Math.max(0, getModNumber(mods, 'secondWindCooldownMs', [], 0));
      // solo-pipeline-yandex-vk item 2: per-segment cooldown (serialized).
      // Independent processing — each fragment owns its own cooldown timer; repair does NOT reset it.
      // Stored directly on `seg.secondWindReadyAtMs` (NOT inside _defRt) so it survives save/load:
      // docs/talents_v2.md explicitly excludes _defRt from save payload, but seg-level fields persist
      // via the segment serializer (saveSchema.json additionalProperties:true allows the new field).
      var segReadyAt = toNumber(seg.secondWindReadyAtMs, 0);
      if ((segHp - d) <= 0 && secondWindRestorePct > 0 && timeMs >= segReadyAt) {
        seg.hp = Math.max(1, segMaxHp * secondWindRestorePct);
        seg.secondWindReadyAtMs = timeMs + secondWindCooldownMs;
        // Legacy boolean kept in-sync for any read-only fallback consumers; not authoritative anymore.
        rt.secondWindUsed = true;
        prevented = true;
        d = 0;
      }
    }

    var zombie = ctx.zombie;
    var stunProcChance = resolveChance(getModNumber(mods, 'stunOnWallHitChance', [], 0), 'stun');
    if (zombie && stunProcChance > 0 && timeMs >= rt.stunIcdUntilMs) {
      var stunChance = stunProcChance;
      if (rollChance(rng, stunChance, 'stun')) {
        var zRt = ensureZombieRt(zombie);
        if (zRt && zRt.cc) {
          // solo-pipeline-yandex-vk item 1.B: max() stacking — do not shorten an active longer stun.
          var newStunUntil = timeMs + Math.max(0, getModNumber(mods, 'stunOnWallHitDurationMs', [], 0));
          zRt.cc.stunUntilMs = Math.max(toNumber(zRt.cc.stunUntilMs, 0), newStunUntil);
        }
        rt.stunIcdUntilMs = timeMs + Math.max(0, getModNumber(mods, 'stunOnWallHitIcdMs', [], 0));
      }
    }

    var barbedWirePct = Math.max(0, getModNumber(mods, 'barbedWirePctOfMaxTankBaseDamage', [], 0));
    var legacyThornsPct = Math.max(0, getModNumber(mods, 'thornsPct', [], 0));
    var legacyThornsRadius = Math.max(0, getModNumber(mods, 'thornsRadius', [], 0));
    // solo-pipeline-yandex-vk#2.followup-item5 round 2: thorns must fire on ANY wall hit attempt,
    // not only when the wall actually took damage. Low-tier zombies have small attack damage that
    // gets fully absorbed by wallArmorFlat / wall barrier / shield / secondWind, leaving d=0 and
    // silently skipping the thorns proc. TZ wording is "когда зомби бьют стены" (when zombies hit
    // walls), so the guard now uses incoming > 0 instead of d > 0.
    // round 3: thorns must fire on every wall-hit attempt by a zombie, even if the zombie's
    // own damage was fully absorbed (incoming=0 after armor/barrier/shield) or the zombie can't
    // damage wall fragments at all. TZ wording "когда зомби бьют стены" = on hit attempt.
    if (zombie && timeMs >= rt.thornsIcdUntilMs) {
      var applyDamageFn = typeof ctx.applyDamage === 'function' ? ctx.applyDamage : null;
      var barbedDamage = 0;
      if (barbedWirePct > 0) {
        // solo-pipeline-yandex-vk#2.followup-item5 round 2: even if getMaxTankBaseDamageFn is null,
        // not yet wired (init race), or returns 0/NaN (no tanks owned, BAL undefined, or
        // runtimeMaxTankLevelAchieved unset), the talent must still apply VISIBLE damage when
        // unlocked. Without this fallback floor zombies hit walls and take literally zero damage,
        // making the talent appear broken to the player even though all wiring tests pass.
        var tankBaseDmg = 0;
        if (typeof runtime.getMaxTankBaseDamageFn === 'function') {
          try { tankBaseDmg = toNumber(runtime.getMaxTankBaseDamageFn(), 0); } catch (_e) { tankBaseDmg = 0; }
        }
        if (!isFiniteNumber(tankBaseDmg) || tankBaseDmg <= 0) {
          // Fallback baseline: tier-1 tank baseDamage is ~50 in tanks.json. Use that so the
          // talent always procs with a perceptible magnitude when unlocked.
          tankBaseDmg = 50;
        }
        var effectivePct = Math.max(barbedWirePct, 0.05);
        barbedDamage = tankBaseDmg * effectivePct;
      }
      if (barbedDamage > 0) {
        if (applyDamageFn) {
          applyDamageFn({
            zombie: zombie,
            damage: barbedDamage,
            timeMs: timeMs,
            source: 'thorns',
            noAttribution: true,
          });
        } else {
          applyDamageNoAttribution({ target: zombie, damage: barbedDamage });
        }
        rt.thornsIcdUntilMs = timeMs + Math.max(0, getModNumber(mods, 'thornsIcdMs', [], 0));
      } else if (legacyThornsPct > 0 && legacyThornsRadius > 0) {
        var legacyCenter = getWallHitCenter(seg, ctx.hitPos);
        if (legacyCenter) {
          var legacyReflect = d * legacyThornsPct;
          var legacyZombies = Array.isArray(ctx.zombies) ? ctx.zombies : [];
          var legacyRadiusSq = legacyThornsRadius * legacyThornsRadius;
          for (var i = 0; i < legacyZombies.length; i++) {
            var legacyTarget = legacyZombies[i];
            if (!legacyTarget || legacyTarget.state === 'dying') continue;
            var legacyPos = resolveEntityPosition(legacyTarget, ctx.getZombiePos);
            if (!legacyPos) continue;
            var ldx = legacyPos.x - legacyCenter.x;
            var ldy = legacyPos.y - legacyCenter.y;
            if ((ldx * ldx + ldy * ldy) > legacyRadiusSq) continue;
            if (applyDamageFn) {
              applyDamageFn({
                zombie: legacyTarget,
                damage: legacyReflect,
                timeMs: timeMs,
                source: 'thorns',
                noAttribution: true,
              });
            } else {
              applyDamageNoAttribution({ target: legacyTarget, damage: legacyReflect });
            }
          }
          rt.thornsIcdUntilMs = timeMs + Math.max(0, getModNumber(mods, 'thornsIcdMs', [], 0));
        }
      }
    }

    if (zombie) {
      onZombieNearWall({ zombie: zombie, timeMs: timeMs, mods: mods });
    }

    // solo-pipeline-yandex-vk#1 batch#1 item 1: гейт «волне нанесли урон стенам» только
    // если итоговый damageToHp > 0 (после armor/resist/shield/secondWind). Иначе бонус
    // eco_clean_defense (rebranded -> «Награда за стойкость») должен выдаваться, как если
    // бы зомби не наносили урона: касания/полностью поглощённые хиты не считаются.
    if (d > 0) {
      runRt.wave.damageToWalls = true;
    }

    return {
      damageToHp: Math.max(0, d),
      absorbedByShield: Math.max(0, absorbedByShield),
      prevented: prevented,
    };
  }

  function applyRepairDiscountCoupon(runRt, mods, timeMs, baseCost) {
    var cost = Math.max(0, toNumber(baseCost, 0));
    var periodMs = Math.max(0, getModNumber(mods, 'repairDiscountPeriodMs', ['repairDiscountTimerPeriodMs'], 0));
    if (periodMs <= 0) return { cost: cost, used: false };

    if (timeMs >= runRt.eco.nextRepairDiscountAtMs) {
      runRt.eco.repairDiscountReady = true;
    }
    if (!runRt.eco.repairDiscountReady) return { cost: cost, used: false };

    cost *= Math.max(0, getModNumber(mods, 'repairDiscountMul', ['repairDiscountTimerCostMul'], 1));
    runRt.eco.repairDiscountReady = false;
    runRt.eco.nextRepairDiscountAtMs = timeMs + periodMs;
    return { cost: cost, used: true };
  }

  // Public wrapper for game.js runtime: consume repair discount coupon against
  // an externally-computed baseCost (FR.getFenceRepairCostCoins) without
  // overriding the canonical pricing formula in fenceRepair.js.
  // Returns { cost, used } where cost is the post-discount value.
  // Idempotent only when called once per repair commit — coupon state mutates.
  function applyRepairCoupon(baseCost, timeMs) {
    var runRt = ensureRunRt();
    var mods = getMods();
    var nowMs = toNumber(timeMs, runtime.nowMsFn());
    return applyRepairDiscountCoupon(runRt, mods, nowMs, baseCost);
  }

  // solo-pipeline-yandex-vk#1 batch#1 item 2 (Мастер-ремонтник, rebrand eco_double_reward):
  // возвращает текущий шанс (0..1) полного ремонта всех фрагментов забора при manual
  // или drone repair. Прочитывает fullRepairChancePerRank из mods (уже проходит через
  // applyCaps и cap caps.fullRepairChance).
  function getFullRepairChance() {
    var mods = getMods();
    return Math.max(0, Math.min(1, toNumber(mods.fullRepairChancePerRank, 0)));
  }

  // applyFullRepairRoll({ trigger, rng, timeMs }) -> { triggered, chance }
  // Бросает RNG по fullRepairChancePerRank. Не мутирует состояние забора напрямую —
  // caller (game.js / drones.js) обязан выполнить фактическое восстановление всех
  // фрагментов забора бесплатно при triggered=true. trigger фиксирует источник для telemetry
  // и может быть 'manual' | 'drone'.
  function applyFullRepairRoll(payload) {
    var ctx = payload || {};
    var chance = getFullRepairChance();
    if (chance <= 0) return { triggered: false, chance: 0 };
    var rng = ctx.rng || ctx.random;
    var triggered = rollChance(rng, chance, 'fullrepair');
    return { triggered: !!triggered, chance: chance };
  }

  // solo-pipeline-yandex-vk#1 batch#1 item 3 (Толковый кладовщик, rebrand eco_crit_kill_bonus):
  // возвращает множитель (в диапазоне [1-cap, 1]) для killCostForBox в
  // src/mechanics/productionLine.js. При ранге 5 и perRank=0.04 cap 0.4 → mul = 0.6.
  function getBoxReagentMul() {
    var mods = getMods();
    var reduction = Math.max(0, Math.min(1, toNumber(mods.boxReagentReductionPerRank, 0)));
    return Math.max(0, 1 - reduction);
  }

  // solo-pipeline-yandex-vk#1 item 1 (Взрывное основание): pure-logic AoE detonation helper.
  // Invoked by game.js fence-destruction seam when a fragment fully breaks. Reads explosiveBase
  // rank + per-rank damage + radius + per-frame cap from mods, iterates ctx.zombies, applies
  // damage via ctx.applyDamage (canonical death pipeline). Screen-shake / SFX are NOT triggered
  // here; the caller side is expected to dispatch them via window.Game.ScreenEffects and the
  // 'fenceExplosion' SFX channel (assets/sfx/registry.json) after a positive result.
  // Returns { detonated, damageDealt, hits, damagePerHit, radius }.
  function applyExplosiveBaseDetonation(payload) {
    var ctx = payload || {};
    var seg = ctx.seg;
    if (!seg) return { detonated: false, damageDealt: 0, hits: 0, damagePerHit: 0, radius: 0 };
    var mods = (ctx.mods && typeof ctx.mods === 'object') ? ctx.mods : getMods();
    var ranksById = runtime.ranksById || {};
    var rank = Math.max(0, toInt(ranksById['def_explosive_base'], 0));
    var perRank = Math.max(0, getModNumber(mods, 'explosiveBaseDamagePerRank', [], 0));
    var radius = Math.max(0, getModNumber(mods, 'explosiveBaseRadiusPx', [], 0));
    var cap = Math.max(0, getModNumber(mods, 'explosiveBaseDamageCapPerFrame', [], 0));
    if (rank <= 0) return { detonated: false, damageDealt: 0, hits: 0, damagePerHit: 0, radius: 0 };
    if (perRank <= 0 || radius <= 0) return { detonated: false, damageDealt: 0, hits: 0, damagePerHit: 0, radius: radius };
    var damage = perRank * rank;
    if (cap > 0 && damage > cap) damage = cap;
    // solo-pipeline-yandex-vk#1 round 5 fix: zombies в TMZD хранятся в ПОЛЯРНЫХ координатах
    // (z.r — расстояние от центра, z.theta — угол). У них нет полей z.x/z.y, поэтому ранее
    // dist всегда вычислялся от (0,0) и ни один зомби не попадал в радиус (round-4 evidence:
    // zx=undefined, dx=-1244, dist=1456 ≫ 300). Конвертируем zombie polar→world cartesian
    // используя centerX/centerY от вызывающей стороны (в game.js это `center.x`, `center.y` —
    // глобальный центр canvas). Origin (ctx.originX/Y) уже передаётся в world-space
    // (game.js делает `center.x + seg.x`), так что сравниваем оба значения в одном
    // абсолютном пространстве. Также передаём в applyDamage callback worldX/worldY,
    // чтобы каллер мог отрисовать damage number в правильной точке.
    var hasOriginX = Number.isFinite(ctx.originX);
    var hasOriginY = Number.isFinite(ctx.originY);
    var sx = hasOriginX ? toNumber(ctx.originX, 0) : toNumber(seg.x, 0);
    var sy = hasOriginY ? toNumber(ctx.originY, 0) : toNumber(seg.y, 0);
    var centerX = toNumber(ctx.centerX, 0);
    var centerY = toNumber(ctx.centerY, 0);
    var radiusSq = radius * radius;
    var zombies = Array.isArray(ctx.zombies) ? ctx.zombies : [];
    var applyDamageFn = (typeof ctx.applyDamage === 'function') ? ctx.applyDamage : null;
    var timeMs = toNumber(ctx.timeMs, runtime.nowMsFn());
    var hits = 0;
    var totalDealt = 0;
    for (var i = 0; i < zombies.length; i++) {
      var z = zombies[i];
      if (!z || z.state === 'dying') continue;
      var zhp = toNumber(z.hp, 0);
      if (zhp <= 0) continue;
      // Polar→world cartesian. Если каллер уже выставил z.x/z.y (например тесты),
      // используем их напрямую как world coords; иначе считаем из r/theta вокруг центра.
      var wx, wy;
      if (Number.isFinite(z.x) && Number.isFinite(z.y)) {
        wx = toNumber(z.x, 0);
        wy = toNumber(z.y, 0);
      } else {
        var zr = toNumber(z.r, 0);
        var zt = toNumber(z.theta, 0);
        wx = centerX + zr * Math.cos(zt);
        wy = centerY + zr * Math.sin(zt);
      }
      var dx = wx - sx;
      var dy = wy - sy;
      if ((dx * dx + dy * dy) > radiusSq) continue;
      if (applyDamageFn) {
        var dealt = applyDamageFn({
          zombie: z,
          damage: damage,
          timeMs: timeMs,
          source: 'explosiveBase',
          noAttribution: true,
          worldX: wx,
          worldY: wy,
        });
        totalDealt += (Number.isFinite(dealt) ? dealt : 0);
      } else {
        applyDamageNoAttribution({ target: z, damage: damage });
        totalDealt += damage;
      }
      hits++;
    }
    // solo-pipeline-yandex-vk#1 round 3: optional diagnostic gate. Enable in console
    // via `window.__debugExplosiveBase = true` to log per-detonation summary.
    try {
      if (typeof global !== 'undefined' && global && global.__debugExplosiveBase) {
        var dbg = (typeof global.console === 'object' && global.console) ? global.console : null;
        if (dbg && typeof dbg.log === 'function') {
          dbg.log('[ExplosiveBase]', {
            rank: rank, perRank: perRank, radius: radius, cap: cap,
            damagePerHit: damage, hits: hits, totalDealt: totalDealt,
            zombieCount: zombies.length, originX: sx, originY: sy,
            centerX: centerX, centerY: centerY,
            originOverride: hasOriginX || hasOriginY,
          });
        }
      }
    } catch (_e) {}
    return { detonated: true, damageDealt: totalDealt, hits: hits, damagePerHit: damage, radius: radius };
  }

  function onUpdate(payload) {
    var ctx = payload || {};
    var timing = resolveDebugFrameTime('onUpdate', toNumber(ctx.timeMs, runtime.nowMsFn()), Math.max(0, toNumber(ctx.dtMs, 0)));
    var timeMs = timing.timeMs;
    var dtMs = timing.dtMs;
    var mods = (ctx.mods && typeof ctx.mods === 'object') ? ctx.mods : getMods();
    var runRt = ensureRunRt();
    var maxCatchupSteps = getMaxCatchupSteps();
    syncRunActiveCharges(mods);

    var segs = Array.isArray(ctx.segments) ? ctx.segments : (Array.isArray(ctx.segs) ? ctx.segs : []);
    var regenPctPerSec = Math.max(0, getModNumber(mods, 'wallRegenPctPerSec', ['regenPctPerSec'], 0));
    var regenDelayMs = Math.max(0, getModNumber(mods, 'wallRegenDelayMs', ['regenDelayMs'], 0));
    var shieldPct = Math.max(0, getModNumber(mods, 'wallShieldPct', [], 0));
    var shieldCapPct = Math.max(0, getModNumber(mods, 'wallShieldCapPct', [], 0));
    var shieldPeriodMs = Math.max(0, getModNumber(mods, 'wallShieldPeriodMs', [], 0));
    var autoRepairPct = Math.max(0, getModNumber(mods, 'autoRepairPct', [], 0));
    var autoRepairPeriodMs = Math.max(0, getModNumber(mods, 'autoRepairPeriodMs', [], 0));
    var defAutoRepairPctPerSec = Math.max(0, getModNumber(mods, 'defActiveAutoRepairPctPerSec', ['defenseActiveAutoRepairPctPerSec'], 0));
    var defenseActiveOn = timeMs < toNumber(runRt.actives.defense.untilMs, 0);

    for (var si = 0; si < segs.length; si++) {
      var seg = segs[si];
      if (!seg || typeof seg !== 'object') continue;
      var segRt = ensureSegRt(seg);
      var maxHp = Math.max(1, toNumber(seg.maxHp, 1));
      var hp = Math.max(0, toNumber(seg.hp, 0));

      if (regenPctPerSec > 0 && regenDelayMs > 0) {
        // Восстанавливающийся контур (def_regen v3): раз в regenDelayMs восстанавливает regenPctPerSec
        // от maxHp (поле в модах хранит cumulative-per-rank процент за tick, не за секунду).
        if (segRt.nextRegenAtMs <= 0) segRt.nextRegenAtMs = Math.max(timeMs, segRt.lastDamageAtMs) + regenDelayMs;
        var regenSteps = 0;
        while (timeMs >= segRt.nextRegenAtMs) {
          if (hp < maxHp) {
            hp = Math.min(maxHp, hp + maxHp * regenPctPerSec);
          }
          segRt.nextRegenAtMs += regenDelayMs;
          regenSteps += 1;
          if (regenSteps >= maxCatchupSteps) {
            segRt.nextRegenAtMs = clampLoopProgressToNearNow(timeMs, regenDelayMs);
            warnWithCooldown('regen_catchup_guard', '[TalentsV2] wall regen catch-up limit reached; clamped near now.', {
              maxSteps: maxCatchupSteps,
            });
            break;
          }
        }
      }

      if (shieldPct > 0 && shieldCapPct > 0 && shieldPeriodMs > 0) {
        if (segRt.nextShieldAtMs <= 0) segRt.nextShieldAtMs = timeMs + shieldPeriodMs;
        var shieldSteps = 0;
        while (timeMs >= segRt.nextShieldAtMs) {
          var addShield = maxHp * shieldPct;
          var capShield = maxHp * shieldCapPct;
          segRt.shieldHp = Math.min(capShield, Math.max(0, segRt.shieldHp) + Math.max(0, addShield));
          segRt.nextShieldAtMs += shieldPeriodMs;
          shieldSteps += 1;
          if (shieldSteps >= maxCatchupSteps) {
            segRt.nextShieldAtMs = clampLoopProgressToNearNow(timeMs, shieldPeriodMs);
            warnWithCooldown('shield_catchup_guard', '[TalentsV2] wall shield catch-up limit reached; clamped near now.', {
              maxSteps: maxCatchupSteps,
            });
            break;
          }
        }
      }

      if (autoRepairPct > 0 && autoRepairPeriodMs > 0) {
        if (segRt.nextAutoRepairAtMs <= 0) segRt.nextAutoRepairAtMs = timeMs + autoRepairPeriodMs;
        var repairSteps = 0;
        while (timeMs >= segRt.nextAutoRepairAtMs) {
          hp = Math.min(maxHp, hp + maxHp * autoRepairPct);
          segRt.nextAutoRepairAtMs += autoRepairPeriodMs;
          repairSteps += 1;
          if (repairSteps >= maxCatchupSteps) {
            segRt.nextAutoRepairAtMs = clampLoopProgressToNearNow(timeMs, autoRepairPeriodMs);
            warnWithCooldown('repair_catchup_guard', '[TalentsV2] auto-repair catch-up limit reached; clamped near now.', {
              maxSteps: maxCatchupSteps,
            });
            break;
          }
        }
      }

      // solo-pipeline-yandex-vk item 3: protectAhead phase scheduler. Two non-overlapping phases
      // (analyze 8s -> buff 8s -> analyze 8s ...). HP is NOT restored anywhere — this only updates
      // segRt.protectAheadBuffUntilMs which the damage path checks for the armor bonus.
      // Phase timestamps are not serialized: on load both fields are 0 and the cycle restarts here.
      var protectAheadArmorPerRank = Math.max(0, getModNumber(mods, 'protectAheadArmorPerRank', [], 0));
      var protectAheadAnalyzeMs = Math.max(0, getModNumber(mods, 'protectAheadAnalyzeMs', [], 0));
      var protectAheadBuffMs = Math.max(0, getModNumber(mods, 'protectAheadBuffMs', [], 0));
      if (protectAheadArmorPerRank > 0 && protectAheadAnalyzeMs > 0 && protectAheadBuffMs > 0) {
        // Bootstrap on first tick or after load: start with analyze phase.
        if (segRt.protectAheadAnalyzeUntilMs <= 0 && segRt.protectAheadBuffUntilMs <= 0) {
          segRt.protectAheadAnalyzeUntilMs = timeMs + protectAheadAnalyzeMs;
          segRt.protectAheadBuffUntilMs = 0;
        }
        var paSteps = 0;
        // Advance phase boundaries without HP side effects. Catch-up loop respects maxCatchupSteps.
        while (paSteps < maxCatchupSteps) {
          if (segRt.protectAheadBuffUntilMs > 0 && timeMs >= segRt.protectAheadBuffUntilMs) {
            // Buff phase ended -> start new analyze phase.
            segRt.protectAheadBuffUntilMs = 0;
            segRt.protectAheadAnalyzeUntilMs = timeMs + protectAheadAnalyzeMs;
            paSteps += 1;
            continue;
          }
          if (segRt.protectAheadAnalyzeUntilMs > 0 && timeMs >= segRt.protectAheadAnalyzeUntilMs) {
            // Analyze phase ended -> start buff phase.
            segRt.protectAheadAnalyzeUntilMs = 0;
            segRt.protectAheadBuffUntilMs = timeMs + protectAheadBuffMs;
            paSteps += 1;
            continue;
          }
          break;
        }
        if (paSteps >= maxCatchupSteps) {
          warnWithCooldown('protect_ahead_catchup_guard', '[TalentsV2] protectAhead catch-up limit reached; clamped near now.', {
            maxSteps: maxCatchupSteps,
          });
        }
      } else {
        // Talent absent or insufficient params -> clear phase state so old timestamps from a
        // prior session do not linger and accidentally grant armor.
        if (segRt.protectAheadBuffUntilMs !== 0) segRt.protectAheadBuffUntilMs = 0;
        if (segRt.protectAheadAnalyzeUntilMs !== 0) segRt.protectAheadAnalyzeUntilMs = 0;
      }

      if (defenseActiveOn && defAutoRepairPctPerSec > 0 && dtMs > 0) {
        hp = Math.min(maxHp, hp + maxHp * defAutoRepairPctPerSec * (dtMs / 1000));
      }

      seg.hp = hp;

      // Mirror runtime shield onto the segment so that pure render layers
      // (Phaser FenceHpBarsLayer / legacy fence renderer) can read seg.shieldHp
      // and seg.shieldHpMax without coupling to talents internals.
      if (shieldCapPct > 0) {
        seg.shieldHp = Math.max(0, toNumber(segRt.shieldHp, 0));
        seg.shieldHpMax = maxHp * shieldCapPct;
      } else {
        seg.shieldHp = 0;
        seg.shieldHpMax = 0;
      }
    }

    var wallZombies = Array.isArray(ctx.wallZombies) ? ctx.wallZombies : (Array.isArray(ctx.wallAttackers) ? ctx.wallAttackers : []);
    if (wallZombies.length > 0) {
      for (var wi = 0; wi < wallZombies.length; wi++) {
        onZombieNearWall({ zombie: wallZombies[wi], timeMs: timeMs, mods: mods });
      }
    }

    var defMax = Math.max(0, toInt(getModNumber(mods, 'defActiveCharges', ['defenseActiveCharges'], 0), 0));
    var defRechargeMs = Math.max(0, getModNumber(mods, 'defActiveRechargeMs', ['defenseActiveRechargeMs'], 0));
    if (defMax > 0 && defRechargeMs > 0) {
      var defRechargeSteps = 0;
      while (runRt.actives.defense.charges < defMax && runRt.actives.defense.nextRechargeAtMs > 0 && timeMs >= runRt.actives.defense.nextRechargeAtMs) {
        runRt.actives.defense.charges += 1;
        runRt.actives.defense.nextRechargeAtMs += defRechargeMs;
        defRechargeSteps += 1;
        if (defRechargeSteps >= maxCatchupSteps) {
          runRt.actives.defense.nextRechargeAtMs = clampLoopProgressToNearNow(timeMs, defRechargeMs);
          warnWithCooldown('def_recharge_catchup_guard', '[TalentsV2] defense active recharge catch-up limit reached; clamped near now.', {
            maxSteps: maxCatchupSteps,
          });
          break;
        }
      }
      if (runRt.actives.defense.charges >= defMax) {
        runRt.actives.defense.charges = defMax;
        runRt.actives.defense.nextRechargeAtMs = 0;
      }
    }

    var ecoMax = Math.max(0, toInt(getModNumber(mods, 'ecoActiveCharges', ['economyActiveCharges'], 0), 0));
    var ecoRechargeMs = Math.max(0, getModNumber(mods, 'ecoActiveRechargeMs', ['economyActiveRechargeMs'], 0));
    if (ecoMax > 0 && ecoRechargeMs > 0) {
      var ecoRechargeSteps = 0;
      while (runRt.actives.economy.charges < ecoMax && runRt.actives.economy.nextRechargeAtMs > 0 && timeMs >= runRt.actives.economy.nextRechargeAtMs) {
        runRt.actives.economy.charges += 1;
        runRt.actives.economy.nextRechargeAtMs += ecoRechargeMs;
        ecoRechargeSteps += 1;
        if (ecoRechargeSteps >= maxCatchupSteps) {
          runRt.actives.economy.nextRechargeAtMs = clampLoopProgressToNearNow(timeMs, ecoRechargeMs);
          warnWithCooldown('eco_recharge_catchup_guard', '[TalentsV2] economy active recharge catch-up limit reached; clamped near now.', {
            maxSteps: maxCatchupSteps,
          });
          break;
        }
      }
      if (runRt.actives.economy.charges >= ecoMax) {
        runRt.actives.economy.charges = ecoMax;
        runRt.actives.economy.nextRechargeAtMs = 0;
      }
    }

    var offMax = Math.max(0, toInt(getModNumber(mods, 'offActiveCharges', ['offenseActiveCharges'], 0), 0));
    var offRechargeMs = Math.max(0, getModNumber(mods, 'offActiveRechargeMs', ['offenseActiveRechargeMs'], 0));
    if (offMax > 0 && offRechargeMs > 0) {
      var offRechargeSteps = 0;
      while (runRt.actives.offense.charges < offMax && runRt.actives.offense.nextRechargeAtMs > 0 && timeMs >= runRt.actives.offense.nextRechargeAtMs) {
        runRt.actives.offense.charges += 1;
        runRt.actives.offense.nextRechargeAtMs += offRechargeMs;
        offRechargeSteps += 1;
        if (offRechargeSteps >= maxCatchupSteps) {
          runRt.actives.offense.nextRechargeAtMs = clampLoopProgressToNearNow(timeMs, offRechargeMs);
          warnWithCooldown('off_recharge_catchup_guard', '[TalentsV2] offense active recharge catch-up limit reached; clamped near now.', {
            maxSteps: maxCatchupSteps,
          });
          break;
        }
      }
      if (runRt.actives.offense.charges >= offMax) {
        runRt.actives.offense.charges = offMax;
        runRt.actives.offense.nextRechargeAtMs = 0;
      }
    }

    var interestDelta = 0;
    var interestTicks = 0;
    var interestPeriodMs = Math.max(0, getModNumber(mods, 'interestPeriodMs', [], 0));
    var interestPct = Math.max(0, getModNumber(mods, 'interestPct', [], 0));
    if (interestPeriodMs > 0 && interestPct > 0) {
      // Pause-gate: when the game is paused (menu/tab inactive/critical), defer interest accrual.
      // Reset the schedule to "now + period" so re-opening doesn't trigger a catch-up burst.
      var gamePauseApi = (global.Game && global.Game.pauseManager) ? global.Game.pauseManager : null;
      var isPausedNow = false;
      try {
        if (gamePauseApi && typeof gamePauseApi.isPaused === 'function') {
          isPausedNow = !!gamePauseApi.isPaused();
        }
      } catch (_) { isPausedNow = false; }
      if (isPausedNow) {
        runRt.eco.interestNextAtMs = timeMs + interestPeriodMs;
      } else {
      var coins = NaN;
      if (ctx.state && isFiniteNumber(ctx.state.coins)) coins = toNumber(ctx.state.coins, 0);
      else if (isFiniteNumber(ctx.coins)) coins = toNumber(ctx.coins, 0);
      else if (typeof ctx.getCoins === 'function') coins = toNumber(ctx.getCoins(), 0);

      if (isFiniteNumber(coins)) {
        if (runRt.eco.interestNextAtMs <= 0) {
          runRt.eco.interestNextAtMs = timeMs + interestPeriodMs;
        }
        var interestSteps = 0;
        while (timeMs >= runRt.eco.interestNextAtMs) {
          var add = coins * interestPct;
          add = Math.max(0, add);
          coins += add;
          interestDelta += add;
          interestTicks += 1;
          runRt.eco.interestNextAtMs += interestPeriodMs;
          interestSteps += 1;
          if (interestSteps >= maxCatchupSteps) {
            runRt.eco.interestNextAtMs = clampLoopProgressToNearNow(timeMs, interestPeriodMs);
            warnWithCooldown('interest_catchup_guard', '[TalentsV2] interest catch-up limit reached; clamped near now.', {
              maxSteps: maxCatchupSteps,
            });
            break;
          }
        }
        if (interestTicks > 0) {
          if (ctx.state && isFiniteNumber(ctx.state.coins)) ctx.state.coins = coins;
          else if (typeof ctx.setCoins === 'function') ctx.setCoins(coins);
          else ctx.coins = coins;
        }
      }
      }
    }

    return {
      interestDelta: interestDelta,
      interestTicks: interestTicks,
      offenseCharges: runRt.actives.offense.charges,
      defenseCharges: runRt.actives.defense.charges,
      economyCharges: runRt.actives.economy.charges,
    };
  }

  function finalizeRewardValue(value) {
    return Math.max(0, Math.floor(Math.max(0, toNumber(value, 0))));
  }

  function onKill(payload) {
    var ctx = payload || {};
    var mods = (ctx.mods && typeof ctx.mods === 'object') ? ctx.mods : getMods();
    var runRt = ensureRunRt();
    var timeMs = toNumber(ctx.timeMs, runtime.nowMsFn());
    var rng = ctx.rng || ctx.random;

    var coins = Math.max(0, toNumber(ctx.baseCoins, 0)) * Math.max(0, getModNumber(mods, 'coinsKillMul', [], 1));
    var xp = Math.max(0, toNumber(ctx.baseXp, 0)) * Math.max(0, getModNumber(mods, 'xpMul', [], 1));

    var tankRt = ensureTankRt(ctx.tank);
    if (tankRt && timeMs < toNumber(tankRt.buffs.killBounty.untilMs, 0)) {
      coins *= Math.max(0, getModNumber(mods, 'killBountyCoinsMul', [], 1));
    }

    // solo-pipeline-yandex-vk#1 batch#1 item 2 & 3: legacy doubleRewardChanceKill +
    // critKillCoinsBonusFlat apply-paths удалены. eco_double_reward теперь управляет
    // full-repair roll при ремонте стен (applyFullRepairRoll), eco_crit_kill_bonus —
    // сокращением стоимости production-line коробок (getBoxReagentMul).
    if (ctx.isCrit) {
      xp *= Math.max(0, getModNumber(mods, 'critKillXpMul', [], 1));
    }

    if (timeMs < toNumber(runRt.actives.economy.untilMs, 0)) {
      coins *= Math.max(0, getModNumber(mods, 'ecoActiveCoinsMul', ['economyActiveCoinsMul'], 1));
      xp *= Math.max(0, getModNumber(mods, 'ecoActiveXpMul', ['economyActiveXpMul'], 1));
    }

    var voucherNeed = Math.max(0, toInt(getModNumber(mods, 'voucherKillsNeed', [], 0), 0));
    if (voucherNeed > 0) {
      runRt.eco.voucherKills = Math.max(0, runRt.eco.voucherKills + 1);
      var voucherCap = Math.max(0, toInt(getModNumber(mods, 'voucherCap', [], 0), 0));
      while (runRt.eco.voucherKills >= voucherNeed) {
        runRt.eco.voucherKills -= voucherNeed;
        runRt.eco.vouchers = Math.min(voucherCap, Math.max(0, runRt.eco.vouchers + 1));
      }
    }

    // solo-pipeline-yandex-vk#2 item 4 (eco_century_contract rebranded → «Чипо-мания»):
    // при включённом chipMania unlock каждый kill катит ролл chipManiaFragmentChance (базовый
    // 0.0001 = 0.01%). На успехе выдаём случайный tier-1 фрагмент чипа через HangarChipsUI.
    try {
      if (mods && mods.chipMania) {
        var chipManiaChance = Math.max(0, getModNumber(mods, 'chipManiaFragmentChance', [], 0));
        if (chipManiaChance > 0) {
          var chipRoll = (typeof rng === 'function') ? rng() : Math.random();
          if (chipRoll < chipManiaChance) {
            var chipsUi = (global && global.Game && global.Game.HangarChipsUI) ? global.Game.HangarChipsUI : null;
            if (chipsUi && typeof chipsUi.addPlayerFragment === 'function') {
              var fragmentRoll = (typeof rng === 'function') ? rng() : Math.random();
              var fragmentId = Math.floor(fragmentRoll * 14) + 1;
              chipsUi.addPlayerFragment(fragmentId, 1);
            }
          }
        }
      }
    } catch (_) {}

    return {
      coins: finalizeRewardValue(coins),
      xp: finalizeRewardValue(xp),
    };
  }

  function onShotReward(payload) {
    var ctx = payload || {};
    var mods = (ctx.mods && typeof ctx.mods === 'object') ? ctx.mods : getMods();
    var runRt = ensureRunRt();
    var timeMs = toNumber(ctx.timeMs, runtime.nowMsFn());
    var rng = ctx.rng || ctx.random;

    var coins = Math.max(0, toNumber(ctx.baseCoins, 0)) * Math.max(0, getModNumber(mods, 'coinsShotMul', [], 1));
    var xp = Math.max(0, toNumber(ctx.baseXp, 0)) * Math.max(0, getModNumber(mods, 'xpMul', [], 1));

    // solo-pipeline-yandex-vk#1 batch#1 item 2: doubleRewardChanceShot apply-path удалён.
    // eco_double_reward перепрофилирован в Мастер-ремонтника (полный ремонт стен с шансом).

    if (timeMs < toNumber(runRt.actives.economy.untilMs, 0)) {
      coins *= Math.max(0, getModNumber(mods, 'ecoActiveCoinsMul', ['economyActiveCoinsMul'], 1));
      xp *= Math.max(0, getModNumber(mods, 'ecoActiveXpMul', ['economyActiveXpMul'], 1));
    }

    return {
      coins: finalizeRewardValue(coins),
      xp: finalizeRewardValue(xp),
    };
  }

  function onWaveStart() {
    var runRt = ensureRunRt();
    runRt.wave.damageToWalls = false;
    return { ok: true };
  }

  function onWaveEnd(payload) {
    var ctx = payload || {};
    var mods = (ctx.mods && typeof ctx.mods === 'object') ? ctx.mods : getMods();
    var runRt = ensureRunRt();

    var coins = Math.max(0, toNumber(ctx.baseCoins, 0));
    var xp = Math.max(0, toNumber(ctx.baseXp, 0));
    var cleanApplied = false;
    if (runRt.wave.damageToWalls === false) {
      coins *= Math.max(0, getModNumber(mods, 'cleanDefenseCoinsMul', [], 1));
      xp *= Math.max(0, getModNumber(mods, 'cleanDefenseXpMul', [], 1));
      cleanApplied = true;
    }

    var greyDamage = Math.max(0, toNumber(runRt.eco.greyDamage, 0));
    var damagePointsAdd = greyDamage * Math.max(0, getModNumber(mods, 'greyToDamagePointsMul', [], 0));
    runRt.eco.greyDamage = 0;

    var outDamagePoints = Math.max(0, toNumber(ctx.baseDamagePoints, 0)) + damagePointsAdd;
    if (ctx.state && isFiniteNumber(ctx.state.damagePoints)) {
      ctx.state.damagePoints = outDamagePoints;
    }

    return {
      coins: finalizeRewardValue(coins),
      xp: finalizeRewardValue(xp),
      damagePoints: outDamagePoints,
      damagePointsAdd: damagePointsAdd,
      cleanDefenseApplied: cleanApplied,
    };
  }

  function onOverkill(payload) {
    var ctx = payload || {};
    var runRt = ensureRunRt();
    var amount = Math.max(0, toNumber(ctx.amount, 0));
    if (amount <= 0) return { greyDamage: runRt.eco.greyDamage };
    runRt.eco.greyDamage = Math.max(0, toNumber(runRt.eco.greyDamage, 0) + amount);
    return { greyDamage: runRt.eco.greyDamage };
  }

  function onRepair(payload) {
    var ctx = payload || {};
    var mods = (ctx.mods && typeof ctx.mods === 'object') ? ctx.mods : getMods();
    var runRt = ensureRunRt();
    var timeMs = toNumber(ctx.timeMs, runtime.nowMsFn());

    // Новая формула стоимости ремонта с учётом repairCount
    var fenceLvl = 1;
    var repairCount = 0;
    var seg = ctx.segment || null;
    if (seg && typeof seg === 'object') {
      fenceLvl = Number.isFinite(seg.level) ? Math.max(1, Math.floor(seg.level)) : 1;
      repairCount = Number.isFinite(seg.repairCount) ? seg.repairCount : 0;
    }
    // Получаем tankPrices из assets/tanks.json
    var tankPrices = (global.Game && global.Game.TankPrices) ? global.Game.TankPrices : null;
    var baseCost = 1;
    if (tankPrices && tankPrices.length >= fenceLvl) {
      baseCost = tankPrices[fenceLvl - 1];
    }
    var inflation = Math.max(1, Math.floor(baseCost * 0.01));
    var cost = baseCost + inflation * repairCount;
    cost *= Math.max(0, getModNumber(mods, 'repairCostMul', [], 1));
    var heal = Math.max(0, toNumber(ctx.baseHeal, 0));
    // solo-pipeline-yandex-vk item 5: legacy repairEfficiencyMul intentionally removed. The
    // rebranded "Адаптация под дронов" / "Drone-Adapted Walls" talent no longer affects player
    // manual repair heal — it only adjusts drone repair speed (see drones stepRepair consumer).
    // The default registry still holds repairEfficiencyMul:1 for backward compatibility, but no
    // talent writes to it anymore and the heal value passes through unchanged.

    var coupon = applyRepairDiscountCoupon(runRt, mods, timeMs, cost);
    cost = coupon.cost;

    // Инкрементируем repairCount после успешного ремонта
    if ((ctx.confirmed || ctx.success || ctx.committed) && seg && typeof seg === 'object') {
      if (typeof seg.repairCount !== 'number' || !Number.isFinite(seg.repairCount)) seg.repairCount = 0;
      seg.repairCount++;
    }

    return {
      cost: finalizeRewardValue(cost),
      heal: heal,
      discountUsed: coupon.used,
    };
    // Сброс repairCount при partial reset/new game
    // Для этого экспортируем функцию resetFenceRepairCounts
    function resetFenceRepairCounts(fenceSegments) {
      if (!Array.isArray(fenceSegments)) return;
      for (var i = 0; i < fenceSegments.length; i++) {
        if (fenceSegments[i] && typeof fenceSegments[i] === 'object') {
          fenceSegments[i].repairCount = 0;
        }
      }
    }

    // Экспортируем resetFenceRepairCounts в глобальный Game API
    if (global.Game) {
      global.Game.resetFenceRepairCounts = resetFenceRepairCounts;
    }
  }

  function onBuyTank(payload) {
    var ctx = payload || {};
    var mods = (ctx.mods && typeof ctx.mods === 'object') ? ctx.mods : getMods();
    var runRt = ensureRunRt();
    var timeMs = toNumber(ctx.timeMs, runtime.nowMsFn());
    var rng = ctx.rng || ctx.random;
    var commit = !!(ctx.confirmed || ctx.success || ctx.committed);

    // solo-pipeline-yandex-vk#1 followup2-item2 — dry-run overrides for bulk preview.
    // The bulk-buy label has to call the SAME pricing path as the actual purchase
    // loop, otherwise the displayed total and the deducted total diverge (the bug
    // the player reported: button shows 638 gold, deduction is 440 gold). When the
    // caller supplies overrides, we treat them as virtual eco state for this single
    // quote (no mutation), so preview can walk N consecutive iterations and stay
    // identical to the real loop.
    var hasVouchersOverride = isFiniteNumber(ctx.vouchersOverride);
    var availableVouchers = hasVouchersOverride
      ? Math.max(0, toInt(ctx.vouchersOverride, 0))
      : runRt.eco.vouchers;

    // solo-pipeline-yandex-vk#1 item 1 fix (2026-05-27) — DOUBLE-DISCOUNT FIX.
    // All callers (`buyTankCost`, `performTankPurchaseOnce`, `calculateAffordableBuyCount`,
    // HUD `updateUI` quote) pre-compute baseCost with `tankBuyCostMul` already applied
    // (via `buyTankCost(level)` or mirrored formula `base * tankBuyCostMul * expMul`).
    // Re-applying the multiplier here caused a 0.7 × 0.7 = 0.49 double-discount,
    // visible to the player as button=35$/debit=24$ on a 50$ base after rank-5 talent.
    // Voucher discount remains the only purchase-time multiplier inside onBuyTank.
    var cost = Math.max(0, toNumber(ctx.baseCost, 0));

    // Voucher: discount is always reflected in the returned cost so the caller can
    // perform a correct affordability check. The voucher counter is only decremented
    // when the caller commits (commit === true), so failed purchases don't burn a coupon.
    var voucherUsed = false;
    if (availableVouchers > 0) {
      cost *= Math.max(0, getModNumber(mods, 'voucherDiscountMul', [], 1));
      voucherUsed = true;
      if (commit && !hasVouchersOverride) {
        runRt.eco.vouchers = Math.max(0, runRt.eco.vouchers - 1);
      }
    }

    // Lottery: three independent rolls, no ICD, no per-run limit. Rolls only happen
    // on commit so a quote call doesn't waste RNG state and never grants bonuses
    // for a purchase that fails affordability.
    var lotterySameLevel = false;
    var lotteryPlus5 = false;
    var lotteryDroneL1 = false;
    if (commit) {
      var sameLevelChance = resolveChance(getModNumber(mods, 'lotterySameLevelChance', [], 0), 'lottery_same');
      var plus5Chance = resolveChance(getModNumber(mods, 'lotteryPlus5Chance', [], 0), 'lottery_plus5');
      var droneL1Chance = resolveChance(getModNumber(mods, 'lotteryDroneL1Chance', [], 0), 'lottery_drone');
      if (sameLevelChance > 0 && rollChance(rng, sameLevelChance, 'lottery_same')) lotterySameLevel = true;
      if (plus5Chance > 0 && rollChance(rng, plus5Chance, 'lottery_plus5')) lotteryPlus5 = true;
      if (droneL1Chance > 0 && rollChance(rng, droneL1Chance, 'lottery_drone')) lotteryDroneL1 = true;
    }

    return {
      cost: finalizeRewardValue(cost),
      // Back-compat: callers that used `applyFreeDuplicate` get the same-level lottery flag.
      applyFreeDuplicate: lotterySameLevel,
      voucherUsed: voucherUsed,
      vouchersLeft: Math.max(0, toInt(runRt.eco.vouchers, 0)),
      lotterySameLevel: lotterySameLevel,
      lotteryPlus5: lotteryPlus5,
      lotteryDroneL1: lotteryDroneL1,
    };
  }

  function onPurchase(payload) {
    var ctx = payload || {};
    var mods = (ctx.mods && typeof ctx.mods === 'object') ? ctx.mods : getMods();
    var runRt = ensureRunRt();
    var timeMs = toNumber(ctx.timeMs, runtime.nowMsFn());
    var baseCost = Math.max(0, toNumber(ctx.baseCost, 0));
    var cost = baseCost;
    var kind = typeof ctx.kind === 'string' ? ctx.kind : '';

    if (kind === 'upgrade_sc') {
      cost *= Math.max(0, getModNumber(mods, 'upgradeCostMul_sc', [], 1));
    } else if (kind === 'upgrade_wall') {
      cost *= Math.max(0, getModNumber(mods, 'upgradeCostMul_wall', [], 1));
    } else if (kind === 'upgrade_guns') {
      cost *= Math.max(0, getModNumber(mods, 'upgradeCostMul_guns', [], 1));
    } else if (kind === 'upgrade_drone') {
      cost *= Math.max(0, getModNumber(mods, 'upgradeCostMul_drone', [], 1));
    } else if (kind === 'repair') {
      cost *= Math.max(0, getModNumber(mods, 'repairCostMul', [], 1));
      cost = applyRepairDiscountCoupon(runRt, mods, timeMs, cost).cost;
    }

    return { cost: finalizeRewardValue(cost) };
  }

  function resolveBranchId(branchLike) {
    if (typeof branchLike === 'string') return branchLike;
    var idx = toInt(branchLike, -1);
    if (idx === 0) return 'offense';
    if (idx === 1) return 'defense';
    if (idx === 2) return 'economy';
    return '';
  }

  function normalizeEpochMs(timeLike, fallbackNowMs) {
    var baseNow = isFiniteNumber(fallbackNowMs) ? fallbackNowMs : runtime.nowMsFn();
    var value = toNumber(timeLike, baseNow);
    if (!isFiniteNumber(value)) return baseNow;
    if (value > 0 && value < 1e11) return value * 1000;
    return value;
  }

  function getBranchActiveConfig(branchId, mods) {
    if (branchId === 'offense') {
      return {
        unlockKey: 'offenseActive',
        charges: Math.max(0, toInt(getModNumber(mods, 'offActiveCharges', ['offenseActiveCharges'], 0), 0)),
        rechargeMs: Math.max(0, getModNumber(mods, 'offActiveRechargeMs', ['offenseActiveRechargeMs'], 0)),
        durationMs: Math.max(0, getModNumber(mods, 'offActiveDurationMs', ['offenseActiveDurationMs'], 0)),
        runKey: 'offense',
      };
    }
    if (branchId === 'defense') {
      return {
        unlockKey: 'defenseActive',
        charges: Math.max(0, toInt(getModNumber(mods, 'defActiveCharges', ['defenseActiveCharges'], 0), 0)),
        rechargeMs: Math.max(0, getModNumber(mods, 'defActiveRechargeMs', ['defenseActiveRechargeMs'], 0)),
        durationMs: Math.max(0, getModNumber(mods, 'defActiveDurationMs', ['defenseActiveDurationMs'], 0)),
        runKey: 'defense',
      };
    }
    if (branchId === 'economy') {
      return {
        unlockKey: 'economyActive',
        charges: Math.max(0, toInt(getModNumber(mods, 'ecoActiveCharges', ['economyActiveCharges'], 0), 0)),
        rechargeMs: Math.max(0, getModNumber(mods, 'ecoActiveRechargeMs', ['economyActiveRechargeMs'], 0)),
        durationMs: Math.max(0, getModNumber(mods, 'ecoActiveDurationMs', ['economyActiveDurationMs'], 0)),
        runKey: 'economy',
      };
    }
    return null;
  }

  function isDomeActive(nowMs) {
    try {
      var runRt = ensureRunRt();
      var timeNow = normalizeEpochMs(nowMs, runtime.nowMsFn());
      var defenseRt = runRt && runRt.actives && runRt.actives.defense;
      if (!defenseRt) return false;
      return timeNow < toNumber(defenseRt.untilMs, 0);
    } catch (_) { return false; }
  }

  function getActiveDomeDamageMul(nowMs) {
    try {
      if (!isDomeActive(nowMs)) return 1;
      var mods = getMods();
      var mul = getModNumber(mods, 'defActiveDamageTakenMul', ['defenseActiveDamageTakenMul'], 1);
      if (!Number.isFinite(mul) || mul < 0) return 1;
      return mul;
    } catch (_) { return 1; }
  }

  function getActiveState(branchLike, nowMs) {
    var branchId = resolveBranchId(branchLike);
    var timeNow = normalizeEpochMs(nowMs, runtime.nowMsFn());
    var mods = getMods();
    var runRt = ensureRunRt();
    syncRunActiveCharges(mods);
    var cfg = getBranchActiveConfig(branchId, mods);
    if (!cfg) {
      return {
        unlocked: false,
        charges: 0,
        chargesMax: 0,
        nextRechargeAtMs: 0,
        rechargeMs: 0,
        untilMs: 0,
        durationMs: 0,
        isActive: false,
      };
    }
    var activeRt = runRt.actives[cfg.runKey] || { untilMs: 0, charges: 0, nextRechargeAtMs: 0 };
    return {
      unlocked: !!mods[cfg.unlockKey],
      charges: Math.max(0, toInt(activeRt.charges, 0)),
      chargesMax: cfg.charges,
      nextRechargeAtMs: Math.max(0, toNumber(activeRt.nextRechargeAtMs, 0)),
      rechargeMs: cfg.rechargeMs,
      untilMs: Math.max(0, toNumber(activeRt.untilMs, 0)),
      durationMs: cfg.durationMs,
      isActive: timeNow < toNumber(activeRt.untilMs, 0),
    };
  }

  function activateOffenseActive(timeMs, payload) {
    var mods = getMods();
    var runRt = ensureRunRt();
    syncRunActiveCharges(mods);
    var nowMs = normalizeEpochMs(timeMs, runtime.nowMsFn());
    var unlocked = !!mods.offenseActive;
    var maxCharges = Math.max(0, toInt(getModNumber(mods, 'offActiveCharges', ['offenseActiveCharges'], 0), 0));
    var durationMs = Math.max(0, getModNumber(mods, 'offActiveDurationMs', ['offenseActiveDurationMs'], 0));
    var rechargeMs = Math.max(0, getModNumber(mods, 'offActiveRechargeMs', ['offenseActiveRechargeMs'], 0));
    if (!unlocked || maxCharges <= 0) return { ok: false, reason: 'locked' };
    if (runRt.actives.offense.charges <= 0) return { ok: false, reason: 'no_charges' };
    runRt.actives.offense.charges = Math.max(0, runRt.actives.offense.charges - 1);
    runRt.actives.offense.untilMs = nowMs + durationMs;
    if (rechargeMs > 0 && runRt.actives.offense.nextRechargeAtMs <= 0) {
      runRt.actives.offense.nextRechargeAtMs = nowMs + rechargeMs;
    }
    var tank = payload && payload.tank;
    var tankRt = ensureTankRt(tank);
    if (tankRt && tankRt.buffs && tankRt.buffs.offenseActive) {
      tankRt.buffs.offenseActive.untilMs = runRt.actives.offense.untilMs;
    }
    return {
      ok: true,
      untilMs: runRt.actives.offense.untilMs,
      charges: runRt.actives.offense.charges,
    };
  }

  function activateDefenseActive(timeMs) {
    var mods = getMods();
    var runRt = ensureRunRt();
    syncRunActiveCharges(mods);
    var nowMs = normalizeEpochMs(timeMs, runtime.nowMsFn());
    var maxCharges = Math.max(0, toInt(getModNumber(mods, 'defActiveCharges', ['defenseActiveCharges'], 0), 0));
    var durationMs = Math.max(0, getModNumber(mods, 'defActiveDurationMs', ['defenseActiveDurationMs'], 0));
    var rechargeMs = Math.max(0, getModNumber(mods, 'defActiveRechargeMs', ['defenseActiveRechargeMs'], 0));
    if (!mods.defenseActive || maxCharges <= 0) return { ok: false, reason: 'locked' };
    if (runRt.actives.defense.charges <= 0) return { ok: false, reason: 'no_charges' };
    runRt.actives.defense.charges = Math.max(0, runRt.actives.defense.charges - 1);
    runRt.actives.defense.untilMs = nowMs + durationMs;
    if (rechargeMs > 0 && runRt.actives.defense.nextRechargeAtMs <= 0) {
      runRt.actives.defense.nextRechargeAtMs = nowMs + rechargeMs;
    }
    return {
      ok: true,
      untilMs: runRt.actives.defense.untilMs,
      charges: runRt.actives.defense.charges,
    };
  }

  function activateEconomyActive(timeMs) {
    var mods = getMods();
    var runRt = ensureRunRt();
    syncRunActiveCharges(mods);
    var nowMs = normalizeEpochMs(timeMs, runtime.nowMsFn());
    var maxCharges = Math.max(0, toInt(getModNumber(mods, 'ecoActiveCharges', ['economyActiveCharges'], 0), 0));
    var durationMs = Math.max(0, getModNumber(mods, 'ecoActiveDurationMs', ['economyActiveDurationMs'], 0));
    var rechargeMs = Math.max(0, getModNumber(mods, 'ecoActiveRechargeMs', ['economyActiveRechargeMs'], 0));
    if (!mods.economyActive || maxCharges <= 0) return { ok: false, reason: 'locked' };
    if (runRt.actives.economy.charges <= 0) return { ok: false, reason: 'no_charges' };
    runRt.actives.economy.charges = Math.max(0, runRt.actives.economy.charges - 1);
    runRt.actives.economy.untilMs = nowMs + durationMs;
    if (rechargeMs > 0 && runRt.actives.economy.nextRechargeAtMs <= 0) {
      runRt.actives.economy.nextRechargeAtMs = nowMs + rechargeMs;
    }
    return {
      ok: true,
      untilMs: runRt.actives.economy.untilMs,
      charges: runRt.actives.economy.charges,
    };
  }

  var statusIconCache = {};
  var STATUS_ICON_SIZE_PX = 14;
  var STATUS_ICON_STEP_PX = 16;
  var STATUS_ICON_LIMIT = 3;
  var TALENTS_DEBUG_OVERLAY_X = 10;
  var TALENTS_DEBUG_OVERLAY_Y = 10;
  var TALENTS_DEBUG_OVERLAY_LINE_H = 14;
  var STATUS_PRIORITIES = {
    status_stun: 100,
    status_slow: 90,
    status_mark: 80,
    status_acid: 70,
    status_convert: 68,
    status_armorPiercing: 40,
    status_impulse: 38,
    status_killBounty: 36,
    status_activeOff: 35,
    status_ramp: 30,
  };

  function getStatusIcon(iconKey) {
    if (!iconKey) return null;
    var cached = statusIconCache[iconKey];
    if (cached) return cached;
    var img = new Image();
    img.src = 'assets/ui/icons/status/' + iconKey + '.png';
    statusIconCache[iconKey] = img;
    return img;
  }

  function worldToScreen(camera, x, y) {
    if (camera && typeof camera.worldToScreen === 'function') {
      var p = camera.worldToScreen(x, y);
      if (p && isFiniteNumber(p.x) && isFiniteNumber(p.y)) return p;
    }
    if (camera && isFiniteNumber(camera.scale) && isFiniteNumber(camera.offsetX) && isFiniteNumber(camera.offsetY)) {
      return {
        x: (x - camera.offsetX) * camera.scale,
        y: (y - camera.offsetY) * camera.scale,
      };
    }
    return { x: x, y: y };
  }

  function computeExpiryFill(untilMs, durationMs, nowMs) {
    var until = toNumber(untilMs, 0);
    var duration = Math.max(0, toNumber(durationMs, 0));
    if (until <= 0 || duration <= 0) return 0;
    var remaining = Math.max(0, until - toNumber(nowMs, 0));
    return clamp(1 - (remaining / Math.max(1, duration)), 0, 1);
  }

  function drawStatusExpiryOverlay(ctx, centerX, centerY, fill01) {
    if (!ctx) return;
    var fill = clamp(toNumber(fill01, 0), 0, 1);
    if (fill <= 0.0001) return;
    var left = centerX - STATUS_ICON_SIZE_PX * 0.5;
    var top = centerY - STATUS_ICON_SIZE_PX * 0.5;
    var startAngle = -Math.PI * 0.5;
    var endAngle = startAngle + Math.PI * 2 * fill;
    var radius = STATUS_ICON_SIZE_PX;
    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, STATUS_ICON_SIZE_PX, STATUS_ICON_SIZE_PX);
    ctx.clip();
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, endAngle, false);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.58)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(centerX, centerY, 1.4, 0, Math.PI * 2, false);
    ctx.fillStyle = 'rgba(255,255,255,0.78)';
    ctx.fill();
    ctx.restore();
  }

  function pushStatus(candidates, iconKey, priority, labelText, fill01) {
    if (!iconKey) return;
    candidates.push({
      iconKey: iconKey,
      priority: priority || 0,
      labelText: labelText || '',
      fill01: clamp(toNumber(fill01, 0), 0, 1),
    });
  }

  function formatDebugNumber(value) {
    var num = toNumber(value, 0);
    if (!isFiniteNumber(num)) return '0';
    if (Math.abs(num) >= 1000) return String(Math.round(num));
    return String(Math.round(num * 100) / 100);
  }

  function drawDebugOverlay(ctx, nowMs, mods) {
    if (!DEV_MODE || !ctx || typeof ctx.fillRect !== 'function' || typeof ctx.fillText !== 'function') return;
    var runRt = ensureRunRt();
    var stateOff = getActiveState('offense', nowMs);
    var stateDef = getActiveState('defense', nowMs);
    var stateEco = getActiveState('economy', nowMs);
    var migrationFlag = runtime.migratedFromVersion === null
      ? String(runtime.loadedTalentsVersion)
      : String(runtime.migratedFromVersion) + '->' + String(runtime.loadedTalentsVersion);
    var lines = [
      'TalentsV2 dbg',
      'v=' + migrationFlag,
      'ch O/D/E: ' + stateOff.charges + '/' + stateDef.charges + '/' + stateEco.charges,
      'dmg=' + formatDebugNumber(getModNumber(mods, 'damageMul', [], 1)),
      'fr=' + formatDebugNumber(getModNumber(mods, 'fireRateMul', [], 1)),
      'coins=' + formatDebugNumber(getModNumber(mods, 'coinsKillMul', [], 1)),
    ];
    var width = 180;
    var height = 8 + lines.length * TALENTS_DEBUG_OVERLAY_LINE_H;

    ctx.save();
    ctx.fillStyle = 'rgba(20,20,20,0.62)';
    ctx.fillRect(TALENTS_DEBUG_OVERLAY_X, TALENTS_DEBUG_OVERLAY_Y, width, height);
    ctx.fillStyle = 'rgba(230,240,255,0.96)';
    ctx.font = '11px Roboto, Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    for (var i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], TALENTS_DEBUG_OVERLAY_X + 6, TALENTS_DEBUG_OVERLAY_Y + 4 + i * TALENTS_DEBUG_OVERLAY_LINE_H);
    }
    ctx.restore();
  }

  function renderStatusIcons(renderCtx) {
    var ctx = renderCtx && renderCtx.canvasCtx;
    if (!ctx || typeof ctx.drawImage !== 'function') return [];
    var nowMs = toNumber(renderCtx && renderCtx.timeMs, runtime.nowMsFn());
    var camera = renderCtx ? renderCtx.camera : null;
    var mods = getMods();
    var dbgCfg = readDebugConfig(nowMs);
    var showIcons = dbgCfg.showIcons;
    var out = [];

    var tanks = Array.isArray(renderCtx && renderCtx.tanks) ? renderCtx.tanks : [];
    var zombies = Array.isArray(renderCtx && renderCtx.zombies) ? renderCtx.zombies : [];
    var getTankPos = renderCtx && typeof renderCtx.getTankPos === 'function' ? renderCtx.getTankPos : null;
    var getZombiePos = renderCtx && typeof renderCtx.getZombiePos === 'function' ? renderCtx.getZombiePos : null;

    if (showIcons) for (var ti = 0; ti < tanks.length; ti++) {
      var tank = tanks[ti];
      if (!tank || typeof tank !== 'object') continue;
      var tRt = ensureTankRt(tank);
      var candidates = [];
      if (isActive(tRt.buffs.armorPiercing.untilMs, nowMs)) {
        pushStatus(
          candidates,
          'status_armorPiercing',
          STATUS_PRIORITIES.status_armorPiercing,
          '',
          computeExpiryFill(tRt.buffs.armorPiercing.untilMs, getModNumber(mods, 'armorPiercingProcDurationMs', [], 0), nowMs)
        );
      }
      if (isActive(tRt.buffs.impulse.untilMs, nowMs)) {
        pushStatus(
          candidates,
          'status_impulse',
          STATUS_PRIORITIES.status_impulse,
          '',
          computeExpiryFill(tRt.buffs.impulse.untilMs, getModNumber(mods, 'impulseProcDurationMs', [], 0), nowMs)
        );
      }
      if (isActive(tRt.buffs.killBounty.untilMs, nowMs)) {
        pushStatus(
          candidates,
          'status_killBounty',
          STATUS_PRIORITIES.status_killBounty,
          '',
          computeExpiryFill(tRt.buffs.killBounty.untilMs, getModNumber(mods, 'killBountyDurationMs', [], 0), nowMs)
        );
      }
      if (isActive(tRt.buffs.offenseActive.untilMs, nowMs) || nowMs < toNumber(ensureRunRt().actives.offense.untilMs, 0)) {
        pushStatus(
          candidates,
          'status_activeOff',
          STATUS_PRIORITIES.status_activeOff,
          '',
          computeExpiryFill(
            Math.max(toNumber(tRt.buffs.offenseActive.untilMs, 0), toNumber(ensureRunRt().actives.offense.untilMs, 0)),
            getModNumber(mods, 'offenseActiveDurationMs', [], 0),
            nowMs
          )
        );
      }
      var rampGraceMs = Math.max(0, getModNumber(mods, 'rampGraceMs', ['rampUpGraceMs'], 0));
      if (tRt.ramp.stacks > 0 && (nowMs - toNumber(tRt.ramp.lastShotAtMs, 0)) <= rampGraceMs) {
        var rampUntilMs = toNumber(tRt.ramp.lastShotAtMs, 0) + rampGraceMs;
        pushStatus(
          candidates,
          'status_ramp',
          STATUS_PRIORITIES.status_ramp,
          String(Math.max(1, Math.min(5, toInt(tRt.ramp.stacks, 1)))),
          computeExpiryFill(rampUntilMs, rampGraceMs, nowMs)
        );
      }
      if (!candidates.length) continue;

      candidates.sort(function (a, b) { return b.priority - a.priority; });
      if (candidates.length > STATUS_ICON_LIMIT) candidates.length = STATUS_ICON_LIMIT;

      var tankPos = resolveEntityPosition(tank, getTankPos);
      if (!tankPos) continue;
      var tankScreen = worldToScreen(camera, tankPos.x, tankPos.y);
      for (var ci = 0; ci < candidates.length; ci++) {
        var icon = candidates[ci];
        var img = getStatusIcon(icon.iconKey);
        var x = tankScreen.x + (ci - (candidates.length - 1) * 0.5) * STATUS_ICON_STEP_PX;
        var y = tankScreen.y - 28;
        if (img && img.complete) {
          ctx.drawImage(img, x - STATUS_ICON_SIZE_PX * 0.5, y - STATUS_ICON_SIZE_PX * 0.5, STATUS_ICON_SIZE_PX, STATUS_ICON_SIZE_PX);
        }
        drawStatusExpiryOverlay(ctx, x, y, icon.fill01);
        if (icon.iconKey === 'status_ramp' && icon.labelText) {
          ctx.save();
          ctx.fillStyle = 'rgba(255,245,224,0.98)';
          ctx.font = 'bold 10px Roboto, Arial, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(icon.labelText, x, y + 10);
          ctx.restore();
        }
      }
      out.push({ type: 'tank', tank: tank, icons: candidates.length });
    }

    if (showIcons) for (var zi = 0; zi < zombies.length; zi++) {
      var zombie = zombies[zi];
      if (!zombie || zombie.state === 'dying') continue;
      var zRt = ensureZombieRt(zombie);
      var zCandidates = [];
      if (nowMs < toNumber(zRt.cc.stunUntilMs, 0)) {
        pushStatus(
          zCandidates,
          'status_stun',
          STATUS_PRIORITIES.status_stun,
          '',
          computeExpiryFill(zRt.cc.stunUntilMs, getModNumber(mods, 'stunOnWallHitDurationMs', [], 0), nowMs)
        );
      }
      if (nowMs < toNumber(zRt.cc.slowUntilMs, 0)) {
        pushStatus(
          zCandidates,
          'status_slow',
          STATUS_PRIORITIES.status_slow,
          '',
          computeExpiryFill(zRt.cc.slowUntilMs, getModNumber(mods, 'ccMicroSlowDurationMs', [], 0), nowMs)
        );
      }
      if (nowMs < toNumber(zRt.markUntilMs, 0)) {
        pushStatus(
          zCandidates,
          'status_mark',
          STATUS_PRIORITIES.status_mark,
          '',
          computeExpiryFill(zRt.markUntilMs, getModNumber(mods, 'markDurationMs', [], 0), nowMs)
        );
      }
      if (nowMs < toNumber(zRt.dots.acid.untilMs, 0)) {
        pushStatus(
          zCandidates,
          'status_acid',
          STATUS_PRIORITIES.status_acid,
          '',
          computeExpiryFill(zRt.dots.acid.untilMs, getModNumber(mods, 'acidDotDurationMs', [], 0), nowMs)
        );
      }
      if (nowMs < toNumber(zRt.dots.converted.untilMs, 0)) {
        pushStatus(
          zCandidates,
          'status_convert',
          STATUS_PRIORITIES.status_convert,
          '',
          computeExpiryFill(zRt.dots.converted.untilMs, getModNumber(mods, 'convertToDotDurationMs', [], 0), nowMs)
        );
      }
      if (!zCandidates.length) continue;

      zCandidates.sort(function (a, b) { return b.priority - a.priority; });
      if (zCandidates.length > STATUS_ICON_LIMIT) zCandidates.length = STATUS_ICON_LIMIT;

      var zombiePos = resolveEntityPosition(zombie, getZombiePos);
      if (!zombiePos) continue;
      var zombieScreen = worldToScreen(camera, zombiePos.x, zombiePos.y);
      var zIconScale = toNumber(renderCtx.debuffIconScale, 1);
      var zIconOpacity = clamp(toNumber(renderCtx.debuffIconOpacity, 1), 0, 1);
      var zIconSizePx = STATUS_ICON_SIZE_PX * zIconScale;
      var zIconStepPx = STATUS_ICON_STEP_PX * zIconScale;
      if (zIconOpacity < 1) { ctx.save(); ctx.globalAlpha = zIconOpacity; }
      for (var zci = 0; zci < zCandidates.length; zci++) {
        var zIcon = zCandidates[zci];
        var zImg = getStatusIcon(zIcon.iconKey);
        var zx = zombieScreen.x + (zci - (zCandidates.length - 1) * 0.5) * zIconStepPx;
        var zy = zombieScreen.y - 22;
        if (zImg && zImg.complete) {
          ctx.drawImage(zImg, zx - zIconSizePx * 0.5, zy - zIconSizePx * 0.5, zIconSizePx, zIconSizePx);
        }
        drawStatusExpiryOverlay(ctx, zx, zy, zIcon.fill01);
      }
      if (zIconOpacity < 1) { ctx.restore(); }
      out.push({ type: 'zombie', zombie: zombie, icons: zCandidates.length });
    }

    if (DEV_MODE && dbgCfg.dumpEnabled) {
      drawDebugOverlay(ctx, nowMs, mods);
    }

    return out;
  }

  function debugDump(payload) {
    var ctx = payload || {};
    var mods = getMods();
    var runRt = ensureRunRt();
    var tanks = Array.isArray(ctx.tanks) ? ctx.tanks : [];
    var zombies = Array.isArray(ctx.zombies) ? ctx.zombies : [];
    var firstTank = tanks.length > 0 ? tanks[0] : runtime._debug.lastSeen.tank;
    var firstZombie = zombies.length > 0 ? zombies[0] : runtime._debug.lastSeen.zombie;
    var snapshot = {
      ranksById: cloneRanks(runtime.ranksById),
      mods: cloneObject(mods),
      runActives: cloneObject(runRt.actives),
      counters: cloneObject(runtime._debug.counters),
      migration: {
        loadedTalentsVersion: runtime.loadedTalentsVersion,
        migratedFromVersion: runtime.migratedFromVersion,
      },
      firstTankRt: firstTank ? cloneObject(ensureTankRt(firstTank)) : null,
      firstZombieRt: firstZombie ? cloneObject(ensureZombieRt(firstZombie)) : null,
      lastValidationIssues: Array.isArray(runtime.lastValidationIssues)
        ? runtime.lastValidationIssues.slice(0, 12)
        : [],
    };
    console.log('[TalentsV2] debugDump', snapshot);
    return snapshot;
  }

  var api = {
    init: init,
    loadTree: loadTree,
    getTreeMeta: getTreeMeta,
    getRanks: getRanks,
    getPendingRanks: getPendingRanks,
    getEffectiveRanks: getEffectiveRanks,
    setRanks: setRanks,
    getFreePoints: getFreePoints,
    getAvailableFreePoints: getAvailableFreePoints,
    getPendingCost: getPendingCost,
    getRespecState: getRespecState,
    setFreePoints: setFreePoints,
    syncFromSave: syncFromSave,
    getMods: getMods,
    getTalentUi: getTalentUi,
    getTalentsByBranch: getTalentsByBranch,
    getBranchSpent: getBranchSpent,
    getUnlockedTier: getUnlockedTier,
    getActiveState: getActiveState,
    isDomeActive: isDomeActive,
    getActiveDomeDamageMul: getActiveDomeDamageMul,
    canBuy: canBuy,
    canRespec: canRespec,
    queueRank: queueRank,
    resetPending: resetPending,
    applyPending: applyPending,
    buyRank: buyRank,
    refundAll: refundAll,
    respec: respec,
    tryRespec: tryRespec,
    validate: validate,
    computeModsFromTalents: computeModsFromTalents,
    MIGRATE_V1_TO_V2: MIGRATE_V1_TO_V2,
    extractV1Talents: extractV1Talents,
    extractV1Points: extractV1Points,
    migrateTalentsV1toV2: migrateTalentsV1toV2,
    ensureTankRt: ensureTankRt,
    ensureZombieRt: ensureZombieRt,
    ensureSegRt: ensureSegRt,
    isActive: isActive,
    refreshUntil: refreshUntil,
    canProc: canProc,
    startIcd: startIcd,
    rollChance: rollChance,
    refreshTankBuff: refreshTankBuff,
    tickStatuses: tickStatuses,
    _onShotCounterAndRamp: _onShotCounterAndRamp,
    _applyDotDamage: _applyDotDamage,
    onShotFired: onShotFired,
    getPulseShotMultiplier: getPulseShotMultiplier,
    getBarrageMul: getBarrageMul,
    onHit: onHit,
    onWallDamage: onWallDamage,
    onZombieNearWall: onZombieNearWall,
    onUpdate: onUpdate,
    onKill: onKill,
    onShotReward: onShotReward,
    onWaveStart: onWaveStart,
    onWaveEnd: onWaveEnd,
    onOverkill: onOverkill,
    onRepair: onRepair,
    applyRepairCoupon: applyRepairCoupon,
    getFullRepairChance: getFullRepairChance,
    applyFullRepairRoll: applyFullRepairRoll,
    getBoxReagentMul: getBoxReagentMul,
    applyExplosiveBaseDetonation: applyExplosiveBaseDetonation,
    onBuyTank: onBuyTank,
    onPurchase: onPurchase,
    clearRuntimeEffects: clearRuntimeEffects,
    activateOffenseActive: activateOffenseActive,
    activateDefenseActive: activateDefenseActive,
    activateEconomyActive: activateEconomyActive,
    debugDump: debugDump,
    renderStatusIcons: renderStatusIcons,
    _runRt: runtime.runRt || createRunRuntime(),
  };

  runtime.runRt = api._runRt;

  global.Game = global.Game || {};
  global.Game.TalentsV2 = api;
})(typeof window !== 'undefined' ? window : this);
