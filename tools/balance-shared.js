(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.BalanceLab = root.BalanceLab || {};
    root.BalanceLab.Shared = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var LEVEL_BANDS = [
    { id: 'band-1-10', label: '1-10', minLevel: 1, maxLevel: 10 },
    { id: 'band-11-20', label: '11-20', minLevel: 11, maxLevel: 20 },
    { id: 'band-21-30', label: '21-30', minLevel: 21, maxLevel: 30 },
    { id: 'band-31-40', label: '31-40', minLevel: 31, maxLevel: 40 },
    { id: 'band-41-50', label: '41-50', minLevel: 41, maxLevel: 50 },
    { id: 'band-51-60', label: '51-60', minLevel: 51, maxLevel: 60 },
  ];
  var PROFILE_KEYS = ['base', 'average', 'peak', 'manual'];
  var PROFILE_LABELS = {
    base: 'База',
    average: 'Средний',
    peak: 'Пик',
    manual: 'Ручной',
  };
  var GOAL_TUNING_PRESETS = {
    balanced: { desiredTtk: 5, zombiePressure: 50, progressionPressure: 50 },
    longTtk: { desiredTtk: 8.5, zombiePressure: 60, progressionPressure: 50 },
    zombieThreat: { desiredTtk: 6.5, zombiePressure: 85, progressionPressure: 60 },
    softEconomy: { desiredTtk: 5.5, zombiePressure: 45, progressionPressure: 25 },
  };
  var DEFAULT_RUNTIME_CONSTANTS = {
    dmgBase: 7,
    dmgMultPerLevel: 1,
    fireRateBase: 1,
    fireRateAddPerLevel: 1,
    rangeBase: 315,
    rangePerLevel: 10,
    zombieHpBase: 1,
    zombieHpExtraPerLevel: 1,
    zombieLevelOmegaMul: 0.08,
  };
  var CHIP_EFFECTS = {
    1: { dpsMultiplier: 2.0, desc: 'Double Shot' },
    2: { dpsMultiplier: 1.5, desc: 'Double Chain' },
    3: { dpsMultiplier: 2.0, desc: 'Double Matryoshka' },
    4: { dpsMultiplier: 1.5, desc: 'Small Repulse' },
    5: { dpsMultiplier: 1.5, desc: 'Small Vacuum' },
    6: { dpsMultiplier: 1.6875, desc: 'Small Combo' },
    7: { dpsMultiplier: 1.5, desc: 'Arcade Chaos' },
    8: { dpsMultiplier: 1.0, desc: 'Small Nuke' },
    9: { dpsMultiplier: 1.0, desc: 'Small Calming' },
    10: { dpsMultiplier: 1.3, desc: 'Fire Pool' },
    11: { dpsMultiplier: 1.0, desc: 'Ice Zone' },
    12: { dpsMultiplier: 1.35, desc: 'Electro Node' },
    13: { dpsMultiplier: 1.5, desc: 'Laser Mark' },
    14: { dpsMultiplier: 1.15, desc: 'Acid Pool' },
    15: { dpsMultiplier: 3.0, desc: 'Triple Shot' },
    16: { dpsMultiplier: 6.0, desc: 'Hex Shot' },
    17: { dpsMultiplier: 2.0, desc: 'Triple Chain' },
    18: { dpsMultiplier: 3.5, desc: 'Hex Chain' },
    19: { dpsMultiplier: 3.0, desc: 'Triple Matryoshka' },
    20: { dpsMultiplier: 4.0, desc: 'Quad Matryoshka' },
    21: { dpsMultiplier: 1.75, desc: 'Medium Repulse' },
    22: { dpsMultiplier: 2.0, desc: 'Large Repulse' },
    23: { dpsMultiplier: 1.75, desc: 'Medium Vacuum' },
    24: { dpsMultiplier: 2.0, desc: 'Large Vacuum' },
    25: { dpsMultiplier: 1.875, desc: 'Medium Combo' },
    26: { dpsMultiplier: 2.75, desc: 'Large Combo' },
    27: { dpsMultiplier: 1.0, desc: 'Medium Nuke' },
    28: { dpsMultiplier: 1.0, desc: 'Large Nuke' },
    29: { dpsMultiplier: 1.0, desc: 'Medium Calming' },
    30: { dpsMultiplier: 1.0, desc: 'Large Calming' },
  };

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function safeNumber(value, fallback) {
    var num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  }

  function round(value, digits) {
    var factor = Math.pow(10, digits || 4);
    return Math.round(value * factor) / factor;
  }

  function parsePath(path) {
    if (Array.isArray(path)) return path.slice();
    var parts = [];
    var re = /([^.[\]]+)|\[(\d+)\]/g;
    var match;
    while ((match = re.exec(path || '')) !== null) {
      if (match[2] !== undefined) parts.push(parseInt(match[2], 10));
      else parts.push(match[1]);
    }
    return parts;
  }

  function getNestedValue(obj, path) {
    var parts = parsePath(path);
    var cur = obj;
    var i;
    for (i = 0; i < parts.length; i++) {
      if (cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function setNestedValue(obj, path, value) {
    var parts = parsePath(path);
    var cur = obj;
    var i;
    for (i = 0; i < parts.length - 1; i++) {
      if (cur == null) return false;
      cur = cur[parts[i]];
    }
    if (cur == null) return false;
    cur[parts[parts.length - 1]] = value;
    return true;
  }

  function formatNumber(value, digits) {
    return round(value, digits || 4).toString();
  }

  function getBandById(bandId) {
    var index;
    for (index = 0; index < LEVEL_BANDS.length; index++) {
      if (LEVEL_BANDS[index].id === bandId) return LEVEL_BANDS[index];
    }
    return null;
  }

  function getBandForLevel(level) {
    var safeLevel = Math.max(1, Math.floor(safeNumber(level, 1)));
    var index;
    for (index = 0; index < LEVEL_BANDS.length; index++) {
      if (safeLevel >= LEVEL_BANDS[index].minLevel && safeLevel <= LEVEL_BANDS[index].maxLevel) {
        return LEVEL_BANDS[index];
      }
    }
    return LEVEL_BANDS[LEVEL_BANDS.length - 1];
  }

  function forEachBandLevel(bandIds, maxLevel, iteratee) {
    var selected = Array.isArray(bandIds) && bandIds.length ? bandIds : LEVEL_BANDS.map(function (band) { return band.id; });
    var limit = Math.max(1, Math.floor(safeNumber(maxLevel, 60)));
    selected.forEach(function (bandId) {
      var band = getBandById(bandId);
      var level;
      if (!band) return;
      for (level = band.minLevel; level <= band.maxLevel && level <= limit; level++) {
        iteratee(level, band);
      }
    });
  }

  function createEmptyTalentRanks() {
    return { offense: [], defense: [], economy: [] };
  }

  function createIdentityModifiers() {
    return {
      tankDamageMul: 1,
      tankFireRateMul: 1,
      zombieHpMul: 1,
      zombieAttackMul: 1,
      zombieAttackSpeedMul: 1,
      wallHpMul: 1,
      wallArmorFlat: 0,
      wallArmorMul: 1,
      economyMul: 1,
    };
  }

  function clampPercent(value, fallback) {
    return clamp(Math.round(safeNumber(value, fallback)), 0, 100);
  }

  function normalizeDesiredTtk(value, fallback) {
    var safeFallback = safeNumber(fallback, GOAL_TUNING_PRESETS.balanced.desiredTtk);
    var desiredTtk = safeNumber(value, safeFallback);
    return desiredTtk > 0 ? desiredTtk : safeFallback;
  }

  function createDefaultGoalTuning() {
    return deepClone(GOAL_TUNING_PRESETS.balanced);
  }

  function normalizeGoalTuning(goalTuning) {
    var source = goalTuning || {};
    return {
      desiredTtk: normalizeDesiredTtk(source.desiredTtk, GOAL_TUNING_PRESETS.balanced.desiredTtk),
      zombiePressure: clampPercent(source.zombiePressure, GOAL_TUNING_PRESETS.balanced.zombiePressure),
      progressionPressure: clampPercent(source.progressionPressure, GOAL_TUNING_PRESETS.balanced.progressionPressure),
    };
  }

  function getGoalTuningPreset(presetId) {
    return deepClone(GOAL_TUNING_PRESETS[presetId] || GOAL_TUNING_PRESETS.balanced);
  }

  function scaleAroundDefault(percentValue, minScale, maxScale) {
    var safePercent = clampPercent(percentValue, 50);
    if (safePercent === 50) return 1;
    if (safePercent < 50) return minScale + (1 - minScale) * (safePercent / 50);
    return 1 + (maxScale - 1) * ((safePercent - 50) / 50);
  }

  function normalizeTalentRanks(input) {
    return {
      offense: deepClone((input && (input.offense || input.OFF || input.off || input.attack)) || []),
      defense: deepClone((input && (input.defense || input.DEF || input.def)) || []),
      economy: deepClone((input && (input.economy || input.ECO || input.econ)) || []),
    };
  }

  function computeTalentMods(talentTree, talentRanksInput) {
    var talentRanks = normalizeTalentRanks(talentRanksInput);
    var mods = {
      damageMul: 1,
      fireRateMul: 1,
      rangeMul: 1,
      aoeMul: 1,
      orbitSpeedMul: 1,
      doubleShotChance: 0,
      tripleShotChance: 0,
      tankBuyCostMul: 1,
      coinsKillMul: 1,
      coinsShotMul: 1,
      xpMul: 1,
      wallHpMul: 1,
      wallArmorFlat: 0,
      wallArmorMul: 1,
    };
    var branchAliases = {
      offense: 'offense',
      attack: 'offense',
      defense: 'defense',
      defence: 'defense',
      economy: 'economy',
      eco: 'economy',
    };
    var branchTalents = {};
    var caps = talentTree && talentTree.caps ? talentTree.caps : null;

    if (!talentTree || !Array.isArray(talentTree.talents)) return mods;
    talentTree.talents.forEach(function (talent) {
      var branchKey = branchAliases[(talent.branch || '').toLowerCase()] || 'offense';
      if (!branchTalents[branchKey]) branchTalents[branchKey] = [];
      branchTalents[branchKey].push(talent);
    });

    Object.keys(branchTalents).forEach(function (branchKey) {
      var ranks = talentRanks[branchKey] || [];
      branchTalents[branchKey].forEach(function (talent, index) {
        var rank = Math.min(Math.max(0, safeNumber(ranks[index], 0)), Math.max(0, safeNumber(talent.maxRank, 0)));
        if (!rank || !Array.isArray(talent.effects)) return;
        talent.effects.forEach(function (effect) {
          if (effect.type === 'stat_mul' && effect.stat && effect.perRank && mods[effect.stat] !== undefined) {
            mods[effect.stat] += effect.perRank * rank;
            return;
          }
          if (effect.type === 'stat_add' && effect.stat && effect.perRank && mods[effect.stat] !== undefined) {
            mods[effect.stat] += effect.perRank * rank;
            return;
          }
          if (effect.type === 'param' && effect.key && mods[effect.key] !== undefined) {
            if (effect.perRank !== undefined) {
              var fromRank = Math.max(1, safeNumber(effect.fromRank, 1));
              if (rank < fromRank) return;
              var effectiveRank = rank - fromRank + 1;
              var nextValue = safeNumber(effect.base, 0) + safeNumber(effect.perRank, 0) * effectiveRank;
              if (effect.min !== undefined) nextValue = Math.max(nextValue, effect.min);
              if (effect.max !== undefined) nextValue = Math.min(nextValue, effect.max);
              mods[effect.key] = nextValue;
              return;
            }
            if (effect.value !== undefined) mods[effect.key] = effect.value;
          }
        });
      });
    });

    if (caps && caps.doubleShotChance !== undefined) {
      mods.doubleShotChance = Math.min(mods.doubleShotChance, caps.doubleShotChance);
    }
    return mods;
  }

  function computeChipEffect(modId) {
    return CHIP_EFFECTS[modId] || { dpsMultiplier: 1, desc: 'None' };
  }

  function getTankBaseCost(level) {
    var safeLevel = Math.max(1, Math.floor(safeNumber(level, 1)));
    return 50 * Math.pow(2, safeLevel - 1);
  }

  function coinsForShot(level) {
    if (!Number.isFinite(level) || level < 1) return 0;
    return Math.min(Math.pow(2, Math.max(1, Math.floor(level)) - 1), Math.pow(2, 20));
  }

  function getRuntimeConstants(data) {
    return Object.assign({}, DEFAULT_RUNTIME_CONSTANTS, data && data.runtimeConstants ? data.runtimeConstants : {});
  }

  function getTankBalanceMultiplier(balance, level, key) {
    var rootValue = getNestedValue(balance || {}, ['tank', key]);
    var overrideValue = getNestedValue(balance || {}, ['tankOverrides', 'level_' + level, key]);
    return safeNumber(overrideValue, safeNumber(rootValue, 1));
  }

  function getZombieBalanceMultiplier(balance, typeId, key) {
    var rootValue = getNestedValue(balance || {}, ['zombie', key]);
    var overrideValue = getNestedValue(balance || {}, ['zombieOverrides', typeId, key]);
    return safeNumber(overrideValue, safeNumber(rootValue, 1));
  }

  function getBulletConfigForTankLevel(data, level) {
    var tankKey = 'tank_lvl' + level;
    var tankCfg = data && data.tanks ? data.tanks[tankKey] : null;
    var bulletId = tankCfg && tankCfg.bulletId ? tankCfg.bulletId : 'bullet_base';
    var bulletLevel = tankCfg && Number.isFinite(tankCfg.bulletLevel) ? Math.max(1, Math.floor(tankCfg.bulletLevel)) : 1;
    var levels = getNestedValue(data || {}, ['bullet', 'bullets', bulletId, 'levels']) || [];
    return {
      bulletId: bulletId,
      bulletLevel: bulletLevel,
      tankCfg: tankCfg || {},
      bulletCfg: levels[bulletLevel - 1] || levels[0] || null,
    };
  }

  function zombieHpMultiplier(level, runtimeConstants) {
    var runtime = runtimeConstants || DEFAULT_RUNTIME_CONSTANTS;
    var safeLevel = Math.max(1, Math.floor(safeNumber(level, 1)));
    var dmgScale = Math.pow(runtime.dmgMultPerLevel, safeLevel - 1);
    var extra = 1 + runtime.zombieHpExtraPerLevel * Math.max(0, safeLevel - 1);
    return dmgScale * extra;
  }

  function resolveZombieHpValue(zombieType, level, runtimeConstants) {
    if (Number.isFinite(zombieType && zombieType.Health) && zombieType.Health > 0) return zombieType.Health;
    if (Number.isFinite(zombieType && zombieType.health) && zombieType.health > 0) return zombieType.health;
    var runtime = runtimeConstants || DEFAULT_RUNTIME_CONSTANTS;
    var hpMul = Number.isFinite(zombieType && zombieType.hpMul) ? zombieType.hpMul : 1;
    return runtime.zombieHpBase * zombieHpMultiplier(level, runtime) * hpMul;
  }

  function computeRepairCostFromFenceConfig(fenceData, level, repairCount) {
    var safeLevel = Math.max(1, Math.floor(safeNumber(level, 1)));
    var safeRepairCount = Math.max(0, Math.floor(safeNumber(repairCount, 0)));
    var configured = getNestedValue(fenceData || {}, ['repair', 'costCoinsByLevel', String(safeLevel)]);
    var levelConfig = getNestedValue(fenceData || {}, ['levels', safeLevel - 1]);
    var baseCost = safeNumber(configured, NaN);
    if (!Number.isFinite(baseCost)) baseCost = safeNumber(levelConfig && levelConfig.repairCostCoins, NaN);
    if (!Number.isFinite(baseCost)) baseCost = safeNumber(levelConfig && levelConfig.repair && levelConfig.repair.costCoins, NaN);
    if (!Number.isFinite(baseCost)) baseCost = getTankBaseCost(safeLevel);
    if (safeRepairCount <= 0) return Math.max(0, Math.floor(baseCost));
    return Math.max(0, Math.floor(baseCost)) + safeRepairCount * Math.max(1, Math.ceil(baseCost * 0.01));
  }

  function getScenarioId(bandId, profileKey) {
    return bandId + '::' + profileKey;
  }

  function createProfileTalentRanks(profileKey, bandIndex) {
    if (profileKey === 'manual' || profileKey === 'base') return createEmptyTalentRanks();
    var offenseBase = profileKey === 'peak' ? 3 : 1;
    var defenseBase = profileKey === 'peak' ? 2 : 1;
    var economyBase = profileKey === 'peak' ? 2 : 1;
    return {
      offense: [offenseBase + bandIndex, defenseBase + Math.floor(bandIndex * 0.5), profileKey === 'peak' ? 2 : 1],
      defense: [defenseBase + Math.floor(bandIndex * 0.4), defenseBase],
      economy: [economyBase + Math.floor(bandIndex * 0.3), economyBase],
    };
  }

  function createDefaultScenario(data, bandId, profileKey) {
    var band = getBandById(bandId) || LEVEL_BANDS[0];
    var bandIndex = LEVEL_BANDS.indexOf(band);
    var midLevel = Math.round((band.minLevel + band.maxLevel) / 2);
    var anchorLevel = profileKey === 'manual' ? band.maxLevel : midLevel;
    var maxWallLevel = Array.isArray(data && data.fence && data.fence.levels) ? data.fence.levels.length : 1;
    var maxDroneLevel = data && data.dron && data.dron.levels ? Object.keys(data.dron.levels).length : 1;
    var presets = {
      base: { tankOffset: 0, zombieOffset: 0, count: 10 + bandIndex * 2, chipModId: null, modifiers: createIdentityModifiers() },
      average: {
        tankOffset: 1,
        zombieOffset: 1,
        count: 14 + bandIndex * 3,
        chipModId: 10,
        modifiers: Object.assign(createIdentityModifiers(), { tankDamageMul: 1.05, tankFireRateMul: 1.04, zombieHpMul: 1.03, economyMul: 1.05 }),
      },
      peak: {
        tankOffset: 2,
        zombieOffset: 3,
        count: 18 + bandIndex * 4,
        chipModId: 13,
        modifiers: Object.assign(createIdentityModifiers(), { tankDamageMul: 1.12, tankFireRateMul: 1.1, zombieHpMul: 1.08, zombieAttackMul: 1.06, wallHpMul: 1.04, economyMul: 1.08 }),
      },
      manual: { tankOffset: 0, zombieOffset: 0, count: 12 + bandIndex * 2, chipModId: null, modifiers: createIdentityModifiers() },
    };
    var preset = presets[profileKey] || presets.base;
    return {
      id: getScenarioId(band.id, profileKey),
      bandId: band.id,
      profileKey: profileKey,
      tankLevel: clamp(anchorLevel + preset.tankOffset, 1, 60),
      zombieLevel: clamp(anchorLevel + preset.zombieOffset, 1, 60),
      wallLevel: clamp(Math.max(1, Math.round(anchorLevel * 0.7)), 1, maxWallLevel),
      droneLevel: clamp(Math.max(1, Math.round(anchorLevel / 6)), 1, maxDroneLevel),
      zombieCount: preset.count,
      attackWindowSec: 12,
      repairCount: 0,
      chipModId: preset.chipModId,
      waveAttackMul: 1,
      waveHpMul: 1,
      talents: createProfileTalentRanks(profileKey, bandIndex),
      modifiers: preset.modifiers,
    };
  }

  function ensureScenarioShape(data, scenario, bandId, profileKey) {
    var baseScenario = createDefaultScenario(data, bandId, profileKey);
    var normalized = Object.assign({}, baseScenario, scenario || {});
    normalized.bandId = bandId;
    normalized.profileKey = profileKey;
    normalized.id = getScenarioId(bandId, profileKey);
    normalized.talents = normalizeTalentRanks(normalized.talents);
    normalized.modifiers = Object.assign(createIdentityModifiers(), normalized.modifiers || {});
    return normalized;
  }

  function createDefaultProfiles(data) {
    var profiles = {};
    LEVEL_BANDS.forEach(function (band) {
      profiles[band.id] = {};
      PROFILE_KEYS.forEach(function (profileKey) {
        profiles[band.id][profileKey] = createDefaultScenario(data || {}, band.id, profileKey);
      });
    });
    return profiles;
  }

  function buildRuntimeData(data, runtimeConstants) {
    var bundle = Object.assign({}, data || {});
    bundle.runtimeConstants = Object.assign({}, getRuntimeConstants(data), runtimeConstants || {});
    return bundle;
  }

  function getTankStats(data, scenario) {
    var runtime = getRuntimeConstants(data);
    var level = clamp(Math.floor(safeNumber(scenario && scenario.tankLevel, 1)), 1, 60);
    var bulletInfo = getBulletConfigForTankLevel(data, level);
    var tankCfg = bulletInfo.tankCfg || {};
    var bulletCfg = bulletInfo.bulletCfg || {};
    var tankCfgStats = tankCfg && tankCfg.stats ? tankCfg.stats : null;
    var balanceDamageMul = getTankBalanceMultiplier(data && data.balance, level, 'attackDamageMul');
    var balanceFireRateMul = getTankBalanceMultiplier(data && data.balance, level, 'attackSpeedMul');
    var tankBaseDamage = Number.isFinite(getNestedValue(tankCfg, 'stats.baseDamage'))
      ? getNestedValue(tankCfg, 'stats.baseDamage')
      : runtime.dmgBase * Math.pow(runtime.dmgMultPerLevel, level - 1);
    var tankAttackSpeed = Number.isFinite(getNestedValue(tankCfgStats, 'attackSpeed')) && getNestedValue(tankCfgStats, 'attackSpeed') > 0
      ? getNestedValue(tankCfgStats, 'attackSpeed')
      : 1;
    var bulletAddDamage = safeNumber(bulletCfg.addDamage, 0);
    var cannonRow = Array.isArray(data && data.cannon) ? data.cannon[level - 1] : null;
    var cannonApplied = safeNumber(cannonRow && cannonRow[2], 0);
    var cannonDamagePerUpgrade = safeNumber(cannonRow && cannonRow[3], 0);
    var cannonFireRatePerUpgrade = safeNumber(cannonRow && cannonRow[4], 0);
    var modifiers = Object.assign(createIdentityModifiers(), scenario && scenario.modifiers ? scenario.modifiers : {});
    var talentMods = computeTalentMods(data && data.talents, scenario && scenario.talents);
    var chipEffect = computeChipEffect(scenario && scenario.chipModId);
    var avgProjectiles = 1 + safeNumber(talentMods.doubleShotChance, 0) + safeNumber(talentMods.tripleShotChance, 0) * 2;
    var shotDamage = Math.max(0, tankBaseDamage + bulletAddDamage)
      * balanceDamageMul
      * (1 + cannonApplied * cannonDamagePerUpgrade)
      * safeNumber(talentMods.damageMul, 1)
      * safeNumber(modifiers.tankDamageMul, 1);
    var shotsPerSec = tankAttackSpeed
      * balanceFireRateMul
      * (1 + cannonApplied * cannonFireRatePerUpgrade)
      * safeNumber(talentMods.fireRateMul, 1)
      * safeNumber(modifiers.tankFireRateMul, 1);
    var totalDps = shotDamage * shotsPerSec * avgProjectiles * chipEffect.dpsMultiplier;
    return {
      level: level,
      baseDamage: round(tankBaseDamage, 3),
      bulletAddDamage: round(bulletAddDamage, 3),
      shotDamage: round(shotDamage, 3),
      shotsPerSec: round(shotsPerSec, 4),
      shotsPerMinute: round(shotsPerSec * 60, 3),
      avgProjectiles: round(avgProjectiles, 3),
      chipDpsMul: round(chipEffect.dpsMultiplier, 3),
      chipDesc: chipEffect.desc,
      rawDamagePerMinute: round(totalDps * 60, 3),
      damagePointsPerMinute: round((totalDps * 60) / 10000, 4),
      dps: round(totalDps, 3),
      bulletLevel: bulletInfo.bulletLevel,
      bulletId: bulletInfo.bulletId,
    };
  }

  function getZombieStats(data, scenario) {
    var runtime = getRuntimeConstants(data);
    var level = clamp(Math.floor(safeNumber(scenario && scenario.zombieLevel, 1)), 1, 60);
    var zombieType = Array.isArray(data && data.zombies && data.zombies.types) ? data.zombies.types[level - 1] : null;
    var typeId = zombieType && zombieType.id ? zombieType.id : 'lvl-' + level;
    var modifiers = Object.assign(createIdentityModifiers(), scenario && scenario.modifiers ? scenario.modifiers : {});
    var levelHpMul = zombieHpMultiplier(level, runtime);
    var baseHp = resolveZombieHpValue(zombieType, level, runtime);
    var hp = baseHp * safeNumber(modifiers.zombieHpMul, 1) * safeNumber(scenario && scenario.waveHpMul, 1);
    var attackDamage = safeNumber(zombieType && zombieType.attackDamage, 8)
      * getZombieBalanceMultiplier(data && data.balance, typeId, 'attackDamageMul')
      * safeNumber(modifiers.zombieAttackMul, 1)
      * safeNumber(scenario && scenario.waveAttackMul, 1);
    var attackCooldownSec = safeNumber(getNestedValue(zombieType, 'attack.attackCooldownSec'), 0.35)
      / Math.max(0.01, getZombieBalanceMultiplier(data && data.balance, typeId, 'attackSpeedMul'))
      / Math.max(0.01, safeNumber(modifiers.zombieAttackSpeedMul, 1));
    return {
      level: level,
      id: typeId,
      hp: round(hp, 3),
      baseHp: round(baseHp, 3),
      levelHpMul: round(levelHpMul, 4),
      attackDamage: round(attackDamage, 3),
      attackCooldownSec: round(attackCooldownSec, 4),
      dps: round(attackDamage / Math.max(0.01, attackCooldownSec), 3),
      rewardMul: safeNumber(zombieType && zombieType.rewardMul, 1),
      hpMul: safeNumber(zombieType && zombieType.hpMul, 1),
      weight: safeNumber(zombieType && zombieType.weight, 1),
    };
  }

  function getWallStats(data, scenario) {
    var level = clamp(Math.floor(safeNumber(scenario && scenario.wallLevel, 1)), 1, Array.isArray(data && data.fence && data.fence.levels) ? data.fence.levels.length : 1);
    var wallCfg = getNestedValue(data || {}, ['fence', 'levels', level - 1]) || {};
    var modifiers = Object.assign(createIdentityModifiers(), scenario && scenario.modifiers ? scenario.modifiers : {});
    var segmentMaxHp = safeNumber(wallCfg.segmentMaxHp, 1) * safeNumber(modifiers.wallHpMul, 1);
    var armorFlat = (safeNumber(wallCfg.armorFlat, 0) + safeNumber(modifiers.wallArmorFlat, 0)) * safeNumber(modifiers.wallArmorMul, 1);
    return {
      level: level,
      segmentMaxHp: round(segmentMaxHp, 3),
      armorFlat: round(armorFlat, 3),
      upgradeCostDamagePoints: safeNumber(wallCfg.upgradeCostDamagePoints, 0),
      repairCostCoins: computeRepairCostFromFenceConfig(data && data.fence, level, scenario && scenario.repairCount),
    };
  }

  function getDroneStats(data, scenario) {
    var maxLevel = data && data.dron && data.dron.levels ? Object.keys(data.dron.levels).length : 1;
    var level = clamp(Math.floor(safeNumber(scenario && scenario.droneLevel, 1)), 1, maxLevel);
    var droneCfg = getNestedValue(data || {}, ['dron', 'levels', String(level)]) || {};
    return {
      level: level,
      moveSpeedPxSec: safeNumber(droneCfg.moveSpeedPxSec, 0),
      repairSpeedMult: safeNumber(droneCfg.repairSpeedMult, 1),
      costMult: safeNumber(droneCfg.costMult, 1),
    };
  }

  function computeScenarioMetrics(data, scenarioInput) {
    var band = getBandById(scenarioInput && scenarioInput.bandId) || getBandForLevel(scenarioInput && scenarioInput.tankLevel);
    var scenario = ensureScenarioShape(data || {}, scenarioInput || {}, band.id, scenarioInput && scenarioInput.profileKey ? scenarioInput.profileKey : 'base');
    var tank = getTankStats(data, scenario);
    var zombie = getZombieStats(data, scenario);
    var wall = getWallStats(data, scenario);
    var drone = getDroneStats(data, scenario);
    var zombieCount = Math.max(1, Math.floor(safeNumber(scenario.zombieCount, 1)));
    var attackWindowSec = Math.max(1, safeNumber(scenario.attackWindowSec, 12));
    var effectiveDamagePerHit = Math.max(1, zombie.attackDamage - wall.armorFlat);
    var totalZombieDps = (effectiveDamagePerHit / Math.max(0.01, zombie.attackCooldownSec)) * zombieCount;
    var fenceSurvivalSec = wall.segmentMaxHp / Math.max(0.01, totalZombieDps);
    var progressionPressure = getTankBaseCost(tank.level) / Math.max(1, coinsForShot(tank.level) * safeNumber(scenario.modifiers.economyMul, 1));
    return {
      scenarioId: scenario.id,
      bandId: band.id,
      profileKey: scenario.profileKey,
      tankLevel: tank.level,
      zombieLevel: zombie.level,
      wallLevel: wall.level,
      droneLevel: drone.level,
      zombieCount: zombieCount,
      attackWindowSec: attackWindowSec,
      singleZombieTtk: round(zombie.hp / Math.max(0.01, tank.dps), 4),
      packTtk: round((zombie.hp * zombieCount) / Math.max(0.01, tank.dps), 4),
      fenceDamagePerAttackWindow: round(totalZombieDps * attackWindowSec, 3),
      fenceSurvivalSec: round(fenceSurvivalSec, 3),
      progressionPressure: round(progressionPressure, 3),
      tank: tank,
      zombie: zombie,
      wall: wall,
      drone: drone,
      totalZombieDps: round(totalZombieDps, 3),
      effectiveDamagePerHit: round(effectiveDamagePerHit, 3),
    };
  }

  function createGoalFromMetrics(metrics, bandIndex, profileKey, goalTuning) {
    var tuning = normalizeGoalTuning(goalTuning);
    var pressureMul = profileKey === 'peak' ? 1.12 : (profileKey === 'average' ? 1.06 : 1);
    var toleranceMul = profileKey === 'manual' ? 0.25 : 0.18;
    var desiredSingleTtkSec = normalizeDesiredTtk(tuning.desiredTtk, GOAL_TUNING_PRESETS.balanced.desiredTtk) * pressureMul;
    var packRatio = metrics.singleZombieTtk > 0
      ? Math.max(1, metrics.packTtk / metrics.singleZombieTtk)
      : Math.max(1, safeNumber(metrics.zombieCount, 1));
    var zombiePressureScale = scaleAroundDefault(tuning.zombiePressure, 0.7, 1.9);
    var fenceSurvivalScale = scaleAroundDefault(100 - tuning.zombiePressure, 0.6, 1.8);
    var progressionScale = scaleAroundDefault(tuning.progressionPressure, 0.6, 1.8);
    var zombieTtkBase = desiredSingleTtkSec;
    var packTtkBase = desiredSingleTtkSec * packRatio;
    var fenceDamageBase = metrics.fenceDamagePerAttackWindow * pressureMul * zombiePressureScale;
    var fenceSurvivalBase = metrics.fenceSurvivalSec / pressureMul * fenceSurvivalScale;
    var progressionBase = metrics.progressionPressure * progressionScale;
    return {
      zombieTtkMin: round(zombieTtkBase * (1 - toleranceMul), 4),
      zombieTtkMax: round(zombieTtkBase * (1 + toleranceMul), 4),
      packTtkMin: round(packTtkBase * (1 - toleranceMul), 4),
      packTtkMax: round(packTtkBase * (1 + toleranceMul), 4),
      fenceDamageMin: round(fenceDamageBase * (1 - toleranceMul), 4),
      fenceDamageMax: round(fenceDamageBase * (1 + toleranceMul), 4),
      fenceSurvivalMinSec: round(fenceSurvivalBase * (1 - toleranceMul), 4),
      fenceSurvivalMaxSec: round(fenceSurvivalBase * (1 + toleranceMul), 4),
      progressionPressureMin: round(progressionBase * (1 - toleranceMul), 4),
      progressionPressureMax: round(progressionBase * (1 + toleranceMul), 4),
      decadeJumpScore: round(0.08 + bandIndex * 0.01, 4),
    };
  }

  function createBandReferenceMetrics(data, bandProfiles) {
    var referenceKeys = ['base', 'average', 'peak'];
    var metricKeys = ['singleZombieTtk', 'packTtk', 'fenceDamagePerAttackWindow', 'fenceSurvivalSec', 'progressionPressure'];
    var rows = [];
    var summary = {};
    referenceKeys.forEach(function (profileKey) {
      if (!bandProfiles || !bandProfiles[profileKey]) return;
      rows.push(computeScenarioMetrics(data || {}, bandProfiles[profileKey]));
    });
    if (!rows.length) return null;
    metricKeys.forEach(function (metricKey) {
      var total = 0;
      rows.forEach(function (row) {
        total += safeNumber(row[metricKey], 0);
      });
      summary[metricKey] = round(total / rows.length, 4);
    });
    return summary;
  }

  function createDefaultGoals(data, profiles, goalTuning) {
    var goals = {};
    var tuning = normalizeGoalTuning(goalTuning);
    LEVEL_BANDS.forEach(function (band, bandIndex) {
      var bandProfiles = getNestedValue(profiles || {}, [band.id]) || {};
      var bandReferenceMetrics = createBandReferenceMetrics(data || {}, bandProfiles);
      goals[band.id] = {};
      PROFILE_KEYS.forEach(function (profileKey) {
        var scenario = getNestedValue(profiles || {}, [band.id, profileKey]) || createDefaultScenario(data || {}, band.id, profileKey);
        var goalMetrics = profileKey === 'manual' && bandReferenceMetrics
          ? bandReferenceMetrics
          : computeScenarioMetrics(data || {}, scenario);
        goals[band.id][profileKey] = createGoalFromMetrics(goalMetrics, bandIndex, profileKey, tuning);
      });
    });
    return goals;
  }

  function createDefaultLabState(data) {
    var profiles = createDefaultProfiles(data || {});
    var goalTuning = createDefaultGoalTuning();
    return {
      profiles: profiles,
      goalTuning: goalTuning,
      goals: createDefaultGoals(data || {}, profiles, goalTuning),
      optimizerResult: null,
      runtimePending: {},
      lastEvaluation: null,
    };
  }

  function computeRangeGap(actualValue, boundValue) {
    if (!(Number.isFinite(actualValue) && Number.isFinite(boundValue))) return 0;
    if (!(boundValue > 0)) return 0;
    var safeActual = Math.max(0.000001, Math.abs(actualValue));
    var ratio = Math.max(safeActual, boundValue) / Math.min(safeActual, boundValue);
    if (!(ratio > 1)) return 0;
    return Math.min(12, Math.log(ratio) / Math.LN10);
  }

  function evaluateRange(metric, min, max) {
    if (metric < min) {
      return {
        passed: false,
        distance: round(Math.max((min - metric) / Math.max(1, Math.abs(min)), computeRangeGap(metric, min)), 6),
        reason: 'below'
      };
    }
    if (metric > max) {
      return {
        passed: false,
        distance: round(Math.max((metric - max) / Math.max(1, Math.abs(max)), computeRangeGap(metric, max)), 6),
        reason: 'above'
      };
    }
    return { passed: true, distance: 0, reason: 'inside' };
  }

  function evaluateScenarioGoals(metrics, goals, previousMetrics) {
    var checks = [
      { key: 'singleZombieTtk', min: goals.zombieTtkMin, max: goals.zombieTtkMax, value: metrics.singleZombieTtk, weight: 1.3 },
      { key: 'packTtk', min: goals.packTtkMin, max: goals.packTtkMax, value: metrics.packTtk, weight: 1.2 },
      { key: 'fenceDamagePerAttackWindow', min: goals.fenceDamageMin, max: goals.fenceDamageMax, value: metrics.fenceDamagePerAttackWindow, weight: 1.2 },
      { key: 'fenceSurvivalSec', min: goals.fenceSurvivalMinSec, max: goals.fenceSurvivalMaxSec, value: metrics.fenceSurvivalSec, weight: 1.4 },
      { key: 'progressionPressure', min: goals.progressionPressureMin, max: goals.progressionPressureMax, value: metrics.progressionPressure, weight: 1.0 },
    ];
    var failures = [];
    var score = 0;
    var passed = 0;
    checks.forEach(function (check) {
      var result = evaluateRange(check.value, check.min, check.max);
      if (result.passed) {
        passed += 1;
        return;
      }
      failures.push({ key: check.key, reason: result.reason, value: check.value, min: check.min, max: check.max });
      score += result.distance * check.weight;
    });
    if (previousMetrics) {
      var jump = Math.abs(metrics.singleZombieTtk - previousMetrics.singleZombieTtk) / Math.max(0.01, previousMetrics.singleZombieTtk);
      if (jump < goals.decadeJumpScore) {
        failures.push({ key: 'decadeJump', reason: 'flat', value: jump, min: goals.decadeJumpScore, max: null });
        score += (goals.decadeJumpScore - jump) * 4;
      }
      var jumpSpikeCap = Math.max(goals.decadeJumpScore * 6, 0.75);
      if (jump > jumpSpikeCap) {
        failures.push({ key: 'decadeJump', reason: 'spike', value: jump, min: null, max: jumpSpikeCap });
        score += Math.max(jump - jumpSpikeCap, computeRangeGap(jump, jumpSpikeCap)) * 2.5;
      }
    }
    if (metrics.fenceDamagePerAttackWindow <= 0) {
      failures.push({ key: 'fencePressure', reason: 'zombies-do-not-reach-fence', value: metrics.fenceDamagePerAttackWindow, min: 0.01, max: null });
      score += 5;
    }
    return {
      score: round(score, 6),
      passedChecks: passed,
      totalChecks: checks.length + (previousMetrics ? 1 : 0),
      failures: failures,
    };
  }

  function getScenarioList(profiles) {
    var rows = [];
    LEVEL_BANDS.forEach(function (band) {
      PROFILE_KEYS.forEach(function (profileKey) {
        rows.push(getNestedValue(profiles, [band.id, profileKey]));
      });
    });
    return rows.filter(Boolean);
  }

  function evaluateMatrix(data, profiles, goals, options) {
    var selectedScenarioIds = options && Array.isArray(options.selectedScenarioIds) && options.selectedScenarioIds.length
      ? options.selectedScenarioIds
      : null;
    var rows = [];
    var previousByProfile = {};
    LEVEL_BANDS.forEach(function (band) {
      PROFILE_KEYS.forEach(function (profileKey) {
        var scenario = ensureScenarioShape(data || {}, getNestedValue(profiles || {}, [band.id, profileKey]) || {}, band.id, profileKey);
        if (selectedScenarioIds && selectedScenarioIds.indexOf(scenario.id) === -1) return;
        var metrics = computeScenarioMetrics(data || {}, scenario);
        var evaluation = evaluateScenarioGoals(metrics, getNestedValue(goals || {}, [band.id, profileKey]) || createGoalFromMetrics(metrics, LEVEL_BANDS.indexOf(band), profileKey), previousByProfile[profileKey]);
        previousByProfile[profileKey] = metrics;
        rows.push({ scenario: scenario, metrics: metrics, evaluation: evaluation });
      });
    });
    return rows;
  }

  function summarizeCoverage(rows) {
    var score = 0;
    var passedChecks = 0;
    var totalChecks = 0;
    rows.forEach(function (row) {
      score += row.evaluation.score;
      passedChecks += row.evaluation.passedChecks;
      totalChecks += row.evaluation.totalChecks;
    });
    return {
      score: round(score, 6),
      passedChecks: passedChecks,
      totalChecks: totalChecks,
      coverage: totalChecks > 0 ? round(passedChecks / totalChecks, 4) : 1,
    };
  }

  function buildTextDiff(beforeText, afterText) {
    var beforeLines = String(beforeText || '').split('\n');
    var afterLines = String(afterText || '').split('\n');
    var maxLength = Math.max(beforeLines.length, afterLines.length);
    var diff = [];
    var index;
    for (index = 0; index < maxLength; index++) {
      var beforeLine = beforeLines[index] || '';
      var afterLine = afterLines[index] || '';
      if (beforeLine === afterLine) continue;
      if (beforeLine) diff.push('- ' + beforeLine);
      if (afterLine) diff.push('+ ' + afterLine);
    }
    return diff.join('\n');
  }

  return {
    LEVEL_BANDS: LEVEL_BANDS,
    PROFILE_KEYS: PROFILE_KEYS,
    PROFILE_LABELS: PROFILE_LABELS,
    DEFAULT_RUNTIME_CONSTANTS: DEFAULT_RUNTIME_CONSTANTS,
    CHIP_EFFECTS: CHIP_EFFECTS,
    deepClone: deepClone,
    clamp: clamp,
    safeNumber: safeNumber,
    round: round,
    parsePath: parsePath,
    getNestedValue: getNestedValue,
    setNestedValue: setNestedValue,
    formatNumber: formatNumber,
    getBandById: getBandById,
    getBandForLevel: getBandForLevel,
    forEachBandLevel: forEachBandLevel,
    createEmptyTalentRanks: createEmptyTalentRanks,
    createIdentityModifiers: createIdentityModifiers,
    GOAL_TUNING_PRESETS: GOAL_TUNING_PRESETS,
    createDefaultGoalTuning: createDefaultGoalTuning,
    normalizeGoalTuning: normalizeGoalTuning,
    getGoalTuningPreset: getGoalTuningPreset,
    normalizeTalentRanks: normalizeTalentRanks,
    computeTalentMods: computeTalentMods,
    computeChipEffect: computeChipEffect,
    getTankBaseCost: getTankBaseCost,
    coinsForShot: coinsForShot,
    getRuntimeConstants: getRuntimeConstants,
    getTankBalanceMultiplier: getTankBalanceMultiplier,
    getZombieBalanceMultiplier: getZombieBalanceMultiplier,
    getBulletConfigForTankLevel: getBulletConfigForTankLevel,
    zombieHpMultiplier: zombieHpMultiplier,
    resolveZombieHpValue: resolveZombieHpValue,
    computeRepairCostFromFenceConfig: computeRepairCostFromFenceConfig,
    getScenarioId: getScenarioId,
    createDefaultScenario: createDefaultScenario,
    ensureScenarioShape: ensureScenarioShape,
    createDefaultProfiles: createDefaultProfiles,
    createDefaultGoals: createDefaultGoals,
    createDefaultLabState: createDefaultLabState,
    buildRuntimeData: buildRuntimeData,
    getTankStats: getTankStats,
    getZombieStats: getZombieStats,
    getWallStats: getWallStats,
    getDroneStats: getDroneStats,
    computeScenarioMetrics: computeScenarioMetrics,
    evaluateRange: evaluateRange,
    evaluateScenarioGoals: evaluateScenarioGoals,
    getScenarioList: getScenarioList,
    evaluateMatrix: evaluateMatrix,
    summarizeCoverage: summarizeCoverage,
    buildTextDiff: buildTextDiff,
  };
}));