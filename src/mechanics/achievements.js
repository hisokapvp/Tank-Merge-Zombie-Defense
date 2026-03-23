(function (global) {
  'use strict';

  var ACHIEVEMENTS = [
    {
      id: 'creator_novice',
      titleKey: 'achievementCreatorNovice',
      rewardKey: 'achievementRewardCreate2',
      target: 200,
      progressType: 'purchases',
      rewardMode: 'buy2',
    },
    {
      id: 'creator_pro',
      titleKey: 'achievementCreatorPro',
      rewardKey: 'achievementRewardCreate5',
      target: 800,
      progressType: 'purchases',
      rewardMode: 'buy5',
    },
    {
      id: 'creator_expert',
      titleKey: 'achievementCreatorExpert',
      rewardKey: 'achievementRewardCreateMax',
      target: 1600,
      progressType: 'purchases',
      rewardMode: 'buyMax',
    },
    {
      id: 'engineer_novice',
      titleKey: 'achievementEngineerNovice',
      rewardKey: 'achievementRewardAutoMergeBasic',
      target: 200,
      progressType: 'merges',
      rewardMode: 'autoMergeBasic',
    },
    {
      id: 'engineer_pro',
      titleKey: 'achievementEngineerPro',
      rewardKey: 'achievementRewardAutoMergeAdvanced',
      target: 500,
      progressType: 'merges',
      rewardMode: 'autoMergeAdvanced',
    },
    {
      id: 'engineer_expert',
      titleKey: 'achievementEngineerExpert',
      rewardKey: 'achievementRewardAutoMergeExpert',
      target: 1000,
      progressType: 'merges',
      rewardMode: 'autoMergeExpert',
    },
    {
      id: 'fence_mechanic_1',
      titleKey: 'achievementFenceMechanic1',
      descKey: 'achievementFenceMechanic1Desc',
      rewardKey: 'achievementRewardFenceMechanicCoins75',
      target: 1,
      progressType: 'manualFenceRepairs',
      rewardMode: 'fenceMechanicCoins75',
    },
    {
      id: 'fence_mechanic_2',
      titleKey: 'achievementFenceMechanic2',
      descKey: 'achievementFenceMechanic2Desc',
      rewardKey: 'achievementRewardFenceMechanicDust5',
      target: 50,
      progressType: 'manualFenceRepairs',
      rewardMode: 'fenceMechanicDust5',
    },
    {
      id: 'fence_mechanic_3',
      titleKey: 'achievementFenceMechanic3',
      descKey: 'achievementFenceMechanic3Desc',
      rewardKey: 'achievementRewardFenceMechanicFragment1',
      target: 200,
      progressType: 'manualFenceRepairs',
      rewardMode: 'fenceMechanicFragment1',
    },
    {
      id: 'fence_mechanic_4',
      titleKey: 'achievementFenceMechanic4',
      descKey: 'achievementFenceMechanic4Desc',
      rewardKey: 'achievementRewardFenceMechanicChips2',
      target: 1000,
      progressType: 'manualFenceRepairs',
      rewardMode: 'fenceMechanicRandomChips2',
    },
    {
      id: 'fence_mechanic_5',
      titleKey: 'achievementFenceMechanic5',
      descKey: 'achievementFenceMechanic5Desc',
      rewardKey: 'achievementRewardFenceMechanicUpgradePoint1',
      target: 10000,
      progressType: 'manualFenceRepairs',
      rewardMode: 'fenceMechanicUpgradePoint1',
    },
    {
      id: 'new_technology_1',
      titleKey: 'achievementNewTechnology1',
      descKey: 'achievementNewTechnology1Desc',
      rewardKey: 'achievementRewardNewTechnologyFragments2',
      target: 1,
      progressType: 'modifierTechUnlocks',
      rewardMode: 'newTechnologyFragments2',
    },
    {
      id: 'new_technology_2',
      titleKey: 'achievementNewTechnology2',
      descKey: 'achievementNewTechnology2Desc',
      rewardKey: 'achievementRewardNewTechnologyDust20',
      target: 3,
      progressType: 'modifierTechUnlocks',
      rewardMode: 'newTechnologyDust20',
    },
    {
      id: 'new_technology_3',
      titleKey: 'achievementNewTechnology3',
      descKey: 'achievementNewTechnology3Desc',
      rewardKey: 'achievementRewardNewTechnologyChips2',
      target: 8,
      progressType: 'modifierTechUnlocks',
      rewardMode: 'newTechnologyRandomChips2',
    },
    {
      id: 'new_technology_4',
      titleKey: 'achievementNewTechnology4',
      descKey: 'achievementNewTechnology4Desc',
      rewardKey: 'achievementRewardNewTechnologyUpgradePoints3',
      target: 16,
      progressType: 'modifierTechUnlocks',
      rewardMode: 'newTechnologyUpgradePoints3',
    },
  ];

  var SELF_MANAGED_REWARD_MODES = {
    newTechnologyFragments2: true,
    newTechnologyDust20: true,
    newTechnologyRandomChips2: true,
    newTechnologyUpgradePoints3: true,
  };

  function normalizeCounter(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(value)));
  }

  function normalizeModifierTechMap(value) {
    var normalized = {};
    if (!value || typeof value !== 'object') return normalized;
    var keys = Object.keys(value);
    for (var i = 0; i < keys.length; i++) {
      if (!value[keys[i]]) continue;
      var techId = normalizeCounter(Number(keys[i]));
      if (techId <= 0) continue;
      normalized[String(techId)] = true;
    }
    return normalized;
  }

  function countCompletedModifierTechs(map) {
    if (!map || typeof map !== 'object') return 0;
    var total = 0;
    var keys = Object.keys(map);
    for (var i = 0; i < keys.length; i++) {
      if (!map[keys[i]]) continue;
      total += 1;
    }
    return normalizeCounter(total);
  }

  function inferModifierTechUnlocksFromRuntime() {
    var hangarChips = global.Game && global.Game.HangarChips;
    var unlocked = hangarChips && typeof hangarChips.getUnlockedTechs === 'function'
      ? hangarChips.getUnlockedTechs()
      : null;
    var normalized = normalizeModifierTechMap(unlocked);
    return {
      map: normalized,
      count: countCompletedModifierTechs(normalized),
    };
  }

  function inferPurchasedFromBuyCounts(state) {
    var inferred = 0;
    if (!state || !state.buyCounts || typeof state.buyCounts !== 'object') return 0;
    var keys = Object.keys(state.buyCounts);
    for (var i = 0; i < keys.length; i++) {
      var count = Number(state.buyCounts[keys[i]]);
      if (Number.isFinite(count) && count > 0) inferred += Math.floor(count);
    }
    return normalizeCounter(inferred);
  }

  function isSelfManagedRewardMode(rewardMode) {
    return !!SELF_MANAGED_REWARD_MODES[rewardMode];
  }

  function getHangarChipsUi() {
    return global.Game && global.Game.HangarChipsUI ? global.Game.HangarChipsUI : null;
  }

  function getRandomAchievementChipDef() {
    var hangarChips = global.Game && global.Game.HangarChips;
    var pool = hangarChips && Array.isArray(hangarChips.allChips) ? hangarChips.allChips : null;
    if (!pool || pool.length <= 0) return null;
    return pool[Math.floor(Math.random() * pool.length)] || null;
  }

  function grantAchievementFragments(count) {
    var chipsUi = getHangarChipsUi();
    var total = normalizeCounter(count);
    if (!chipsUi || typeof chipsUi.addPlayerFragment !== 'function' || total <= 0) return false;
    for (var i = 0; i < total; i++) {
      chipsUi.addPlayerFragment(Math.floor(Math.random() * 14) + 1, 1);
    }
    return true;
  }

  function grantAchievementSiliconDust(amount) {
    var chipsUi = getHangarChipsUi();
    var total = normalizeCounter(amount);
    if (!chipsUi || typeof chipsUi.getSiliconDust !== 'function' || typeof chipsUi.setSiliconDust !== 'function' || total <= 0) {
      return false;
    }
    var currentDust = normalizeCounter(chipsUi.getSiliconDust());
    chipsUi.setSiliconDust(currentDust + total);
    return true;
  }

  function grantAchievementRandomChips(count) {
    var chipsUi = getHangarChipsUi();
    var total = normalizeCounter(count);
    if (!chipsUi || typeof chipsUi.addPlayerChip !== 'function' || total <= 0) return false;
    for (var i = 0; i < total; i++) {
      var chipDef = getRandomAchievementChipDef();
      if (!chipDef) return false;
      chipsUi.addPlayerChip(chipDef, 1);
    }
    return true;
  }

  function grantAchievementUpgradePoints(state, count) {
    var total = normalizeCounter(count);
    if (!state || total <= 0) return false;
    if (!state.player || typeof state.player !== 'object') state.player = {};
    if (!state.player.talentsV2 || typeof state.player.talentsV2 !== 'object') {
      state.player.talentsV2 = { ranksById: {}, freePoints: 0 };
    }
    state.player.talentsV2.freePoints = normalizeCounter(state.player.talentsV2.freePoints + total);
    state.player.freeTalentPointsV2 = state.player.talentsV2.freePoints;
    return true;
  }

  function grantSelfManagedReward(state, achievementId, def, ach) {
    var achievementState = ach || ensureState(state);
    if (!achievementState || !def || !isSelfManagedRewardMode(def.rewardMode)) return false;
    if (achievementState.rewarded[achievementId]) return false;

    var granted = false;
    if (def.rewardMode === 'newTechnologyFragments2') {
      granted = grantAchievementFragments(2);
    } else if (def.rewardMode === 'newTechnologyDust20') {
      granted = grantAchievementSiliconDust(20);
    } else if (def.rewardMode === 'newTechnologyRandomChips2') {
      granted = grantAchievementRandomChips(2);
    } else if (def.rewardMode === 'newTechnologyUpgradePoints3') {
      granted = grantAchievementUpgradePoints(state, 3);
    }

    if (!granted) return false;
    achievementState.rewarded[achievementId] = true;
    return true;
  }

  function reconcileSelfManagedRewards(state, ach) {
    var achievementState = ach || ensureState(state);
    if (!achievementState) return false;
    var changed = false;
    for (var i = 0; i < ACHIEVEMENTS.length; i++) {
      var def = ACHIEVEMENTS[i];
      if (!achievementState.unlocked[def.id]) continue;
      if (!isSelfManagedRewardMode(def.rewardMode)) continue;
      if (grantSelfManagedReward(state, def.id, def, achievementState)) changed = true;
    }
    return changed;
  }

  function ensureStats(state, ach, options) {
    var opts = options || {};
    var hasStats = !!(state && state.stats && typeof state.stats === 'object');
    if (!hasStats) state.stats = {};

    var stats = state.stats;
    var hasMerged = Number.isFinite(stats.tanksMergedCount);
    var hasBought = Number.isFinite(stats.tanksBoughtCount);
    var hasManualFenceRepairs = Number.isFinite(stats.manualFenceRepairsCount);
    var hasModifierTechUnlocks = Number.isFinite(stats.modifierTechUnlocksCount);

    var legacyMerges = normalizeCounter(ach.totalMerges);
    var legacyPurchased = normalizeCounter(ach.totalPurchased);
    var legacyManualFenceRepairs = normalizeCounter(ach.totalManualFenceRepairs);
    var legacyModifierTechUnlocks = normalizeCounter(ach.totalModifierTechUnlocks);

    if (!hasMerged) stats.tanksMergedCount = legacyMerges;
    else stats.tanksMergedCount = normalizeCounter(stats.tanksMergedCount);

    if (!hasBought) stats.tanksBoughtCount = legacyPurchased;
    else stats.tanksBoughtCount = normalizeCounter(stats.tanksBoughtCount);

    if (!hasManualFenceRepairs) stats.manualFenceRepairsCount = legacyManualFenceRepairs;
    else stats.manualFenceRepairsCount = normalizeCounter(stats.manualFenceRepairsCount);

    if (!hasModifierTechUnlocks) stats.modifierTechUnlocksCount = legacyModifierTechUnlocks;
    else stats.modifierTechUnlocksCount = normalizeCounter(stats.modifierTechUnlocksCount);

    if (hasMerged && opts.hadLegacyMerges && stats.tanksMergedCount !== legacyMerges) {
      stats.tanksMergedCount = legacyMerges;
    }
    if (hasBought && opts.hadLegacyPurchased && stats.tanksBoughtCount !== legacyPurchased) {
      stats.tanksBoughtCount = legacyPurchased;
    }

    ach.totalMerges = stats.tanksMergedCount;
    ach.totalPurchased = stats.tanksBoughtCount;
    ach.totalManualFenceRepairs = stats.manualFenceRepairsCount;
    ach.totalModifierTechUnlocks = stats.modifierTechUnlocksCount;
    return stats;
  }

  function ensureState(state) {
    if (!state) return null;
    if (!state.achievements || typeof state.achievements !== 'object') {
      state.achievements = {};
    }
    if (!state.achievements.unlocked || typeof state.achievements.unlocked !== 'object') {
      state.achievements.unlocked = {};
    }
    if (!Array.isArray(state.achievements.popupQueue)) {
      state.achievements.popupQueue = [];
    }
    if (!state.achievements.rewarded || typeof state.achievements.rewarded !== 'object') {
      state.achievements.rewarded = {};
    }
    state.achievements.completedModifierTechs = normalizeModifierTechMap(state.achievements.completedModifierTechs);

    var hadLegacyPurchased = Number.isFinite(state.achievements.totalPurchased);
    var hadLegacyMerges = Number.isFinite(state.achievements.totalMerges);
    var inferredModifierTechUnlocks = inferModifierTechUnlocksFromRuntime();
    var completedModifierTechCount = countCompletedModifierTechs(state.achievements.completedModifierTechs);

    if (completedModifierTechCount <= 0 && inferredModifierTechUnlocks.count > 0) {
      state.achievements.completedModifierTechs = inferredModifierTechUnlocks.map;
      completedModifierTechCount = inferredModifierTechUnlocks.count;
    }

    if (!Number.isFinite(state.achievements.totalPurchased)) {
      state.achievements.totalPurchased = inferPurchasedFromBuyCounts(state);
    } else {
      state.achievements.totalPurchased = normalizeCounter(state.achievements.totalPurchased);
    }

    if (!Number.isFinite(state.achievements.totalMerges)) {
      state.achievements.totalMerges = 0;
    } else {
      state.achievements.totalMerges = normalizeCounter(state.achievements.totalMerges);
    }

    if (!Number.isFinite(state.achievements.totalManualFenceRepairs)) {
      state.achievements.totalManualFenceRepairs = 0;
    } else {
      state.achievements.totalManualFenceRepairs = normalizeCounter(state.achievements.totalManualFenceRepairs);
    }

    if (!Number.isFinite(state.achievements.totalModifierTechUnlocks)) {
      state.achievements.totalModifierTechUnlocks = completedModifierTechCount > 0
        ? completedModifierTechCount
        : inferredModifierTechUnlocks.count;
    } else {
      state.achievements.totalModifierTechUnlocks = normalizeCounter(state.achievements.totalModifierTechUnlocks);
    }

    if (completedModifierTechCount > state.achievements.totalModifierTechUnlocks) {
      state.achievements.totalModifierTechUnlocks = completedModifierTechCount;
    }

    ensureStats(state, state.achievements, {
      hadLegacyPurchased: hadLegacyPurchased,
      hadLegacyMerges: hadLegacyMerges,
    });
    reconcileSelfManagedRewards(state, state.achievements);
    return state.achievements;
  }

  function getProgressValueFromState(progressType, state, ach) {
    var type = typeof progressType === 'string' ? progressType : 'purchases';
    var stats = state && state.stats && typeof state.stats === 'object' ? state.stats : null;

    if (stats) {
      if (type === 'merges') return normalizeCounter(stats.tanksMergedCount);
      if (type === 'manualFenceRepairs') return normalizeCounter(stats.manualFenceRepairsCount);
      if (type === 'modifierTechUnlocks') return normalizeCounter(stats.modifierTechUnlocksCount);
      return normalizeCounter(stats.tanksBoughtCount);
    }

    if (!ach || typeof ach !== 'object') return 0;
    if (type === 'merges') {
      return normalizeCounter(ach.totalMerges);
    }
    if (type === 'manualFenceRepairs') {
      return normalizeCounter(ach.totalManualFenceRepairs);
    }
    if (type === 'modifierTechUnlocks') {
      return normalizeCounter(ach.totalModifierTechUnlocks);
    }
    return normalizeCounter(ach.totalPurchased);
  }

  function getProgressValue(state, progressType) {
    var ach = ensureState(state);
    return getProgressValueFromState(progressType, state, ach);
  }

  function recalculateUnlocks(state) {
    var ach = ensureState(state);
    if (!ach) return [];
    var unlockedNow = [];
    for (var i = 0; i < ACHIEVEMENTS.length; i++) {
      var def = ACHIEVEMENTS[i];
      if (ach.unlocked[def.id]) continue;
      var progress = getProgressValueFromState(def.progressType, state, ach);
      if (progress >= def.target) {
        ach.unlocked[def.id] = true;
        grantSelfManagedReward(state, def.id, def, ach);
        unlockedNow.push(def.id);
      }
    }
    return unlockedNow;
  }

  function getDefinitions() {
    return ACHIEVEMENTS.slice();
  }

  function getBulkMode(state) {
    var ach = ensureState(state);
    if (!ach) return 'none';
    if (ach.unlocked.creator_expert) return 'buyMax';
    if (ach.unlocked.creator_pro) return 'buy5';
    if (ach.unlocked.creator_novice) return 'buy2';
    return 'none';
  }

  function addProgress(state, progressType, deltaCount) {
    var ach = ensureState(state);
    if (!ach) return [];
    var stats = state && state.stats && typeof state.stats === 'object' ? state.stats : null;
    var type = progressType;
    var deltaRaw = deltaCount;

    if (typeof progressType !== 'string') {
      type = 'purchases';
      deltaRaw = progressType;
    }

    var delta = Math.max(0, Math.floor(Number(deltaRaw) || 0));
    if (delta <= 0) return [];

    if (stats) {
      if (type === 'merges') {
        stats.tanksMergedCount = normalizeCounter(stats.tanksMergedCount + delta);
      } else if (type === 'manualFenceRepairs') {
        stats.manualFenceRepairsCount = normalizeCounter(stats.manualFenceRepairsCount + delta);
      } else if (type === 'modifierTechUnlocks') {
        stats.modifierTechUnlocksCount = normalizeCounter(stats.modifierTechUnlocksCount + delta);
      } else {
        stats.tanksBoughtCount = normalizeCounter(stats.tanksBoughtCount + delta);
      }
      ach.totalMerges = stats.tanksMergedCount;
      ach.totalPurchased = stats.tanksBoughtCount;
      ach.totalManualFenceRepairs = stats.manualFenceRepairsCount;
      ach.totalModifierTechUnlocks = stats.modifierTechUnlocksCount;
    } else if (type === 'modifierTechUnlocks') {
      ach.totalModifierTechUnlocks = normalizeCounter(ach.totalModifierTechUnlocks + delta);
    } else if (type === 'manualFenceRepairs') {
      ach.totalManualFenceRepairs = normalizeCounter(ach.totalManualFenceRepairs + delta);
    } else if (type === 'merges') {
      ach.totalMerges = normalizeCounter(ach.totalMerges + delta);
    } else {
      ach.totalPurchased = normalizeCounter(ach.totalPurchased + delta);
    }

    return recalculateUnlocks(state);
  }

  function recordModifierTechUnlock(state, techId) {
    var ach = ensureState(state);
    if (!ach) return [];
    var normalizedTechId = normalizeCounter(techId);
    if (normalizedTechId <= 0) return [];
    if (!ach.completedModifierTechs || typeof ach.completedModifierTechs !== 'object') {
      ach.completedModifierTechs = {};
    }
    if (ach.completedModifierTechs[String(normalizedTechId)]) return [];
    ach.completedModifierTechs[String(normalizedTechId)] = true;

    var totalCompleted = countCompletedModifierTechs(ach.completedModifierTechs);
    ach.totalModifierTechUnlocks = totalCompleted;
    if (state && state.stats && typeof state.stats === 'object') {
      state.stats.modifierTechUnlocksCount = totalCompleted;
    }
    return recalculateUnlocks(state);
  }

  function hasRewardGranted(state, achievementId) {
    var ach = ensureState(state);
    if (!ach || typeof achievementId !== 'string' || !achievementId) return false;
    return !!ach.rewarded[achievementId];
  }

  function markRewardGranted(state, achievementId) {
    var ach = ensureState(state);
    if (!ach || typeof achievementId !== 'string' || !achievementId) return false;
    ach.rewarded[achievementId] = true;
    return true;
  }

  global.Game = global.Game || {};
  global.Game.Achievements = {
    getDefinitions: getDefinitions,
    ensureState: ensureState,
    addProgress: addProgress,
    getProgressValue: getProgressValue,
    recalculateUnlocks: recalculateUnlocks,
    getBulkMode: getBulkMode,
    hasRewardGranted: hasRewardGranted,
    markRewardGranted: markRewardGranted,
    recordModifierTechUnlock: recordModifierTechUnlock,
  };
})(typeof window !== 'undefined' ? window : this);
