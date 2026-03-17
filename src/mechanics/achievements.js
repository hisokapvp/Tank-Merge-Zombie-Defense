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
  ];

  function normalizeCounter(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(value)));
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

  function ensureStats(state, ach, options) {
    var opts = options || {};
    var hasStats = !!(state && state.stats && typeof state.stats === 'object');
    if (!hasStats) state.stats = {};

    var stats = state.stats;
    var hasMerged = Number.isFinite(stats.tanksMergedCount);
    var hasBought = Number.isFinite(stats.tanksBoughtCount);

    var legacyMerges = normalizeCounter(ach.totalMerges);
    var legacyPurchased = normalizeCounter(ach.totalPurchased);

    if (!hasMerged) stats.tanksMergedCount = legacyMerges;
    else stats.tanksMergedCount = normalizeCounter(stats.tanksMergedCount);

    if (!hasBought) stats.tanksBoughtCount = legacyPurchased;
    else stats.tanksBoughtCount = normalizeCounter(stats.tanksBoughtCount);

    if (hasMerged && opts.hadLegacyMerges && stats.tanksMergedCount !== legacyMerges) {
      stats.tanksMergedCount = legacyMerges;
    }
    if (hasBought && opts.hadLegacyPurchased && stats.tanksBoughtCount !== legacyPurchased) {
      stats.tanksBoughtCount = legacyPurchased;
    }

    ach.totalMerges = stats.tanksMergedCount;
    ach.totalPurchased = stats.tanksBoughtCount;
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

    var hadLegacyPurchased = Number.isFinite(state.achievements.totalPurchased);
    var hadLegacyMerges = Number.isFinite(state.achievements.totalMerges);

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

    ensureStats(state, state.achievements, {
      hadLegacyPurchased: hadLegacyPurchased,
      hadLegacyMerges: hadLegacyMerges,
    });
    return state.achievements;
  }

  function getProgressValueFromState(progressType, state, ach) {
    var type = typeof progressType === 'string' ? progressType : 'purchases';
    var stats = state && state.stats && typeof state.stats === 'object' ? state.stats : null;

    if (stats) {
      if (type === 'merges') return normalizeCounter(stats.tanksMergedCount);
      return normalizeCounter(stats.tanksBoughtCount);
    }

    if (!ach || typeof ach !== 'object') return 0;
    if (type === 'merges') {
      return normalizeCounter(ach.totalMerges);
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
      } else {
        stats.tanksBoughtCount = normalizeCounter(stats.tanksBoughtCount + delta);
      }
      ach.totalMerges = stats.tanksMergedCount;
      ach.totalPurchased = stats.tanksBoughtCount;
    } else if (type === 'merges') {
      ach.totalMerges = normalizeCounter(ach.totalMerges + delta);
    } else {
      ach.totalPurchased = normalizeCounter(ach.totalPurchased + delta);
    }

    return recalculateUnlocks(state);
  }

  global.Game = global.Game || {};
  global.Game.Achievements = {
    getDefinitions: getDefinitions,
    ensureState: ensureState,
    addProgress: addProgress,
    getProgressValue: getProgressValue,
    recalculateUnlocks: recalculateUnlocks,
    getBulkMode: getBulkMode,
  };
})(typeof window !== 'undefined' ? window : this);
