(function (global) {
  'use strict';

  var ACHIEVEMENTS = [
    {
      id: 'creator_novice',
      titleKey: 'achievementCreatorNovice',
      rewardKey: 'achievementRewardAutoMergeBasic',
      target: 100,
      progressType: 'merges',
      rewardMode: 'autoMergeBasic',
    },
    {
      id: 'creator_pro',
      titleKey: 'achievementCreatorPro',
      rewardKey: 'achievementRewardAutoMergeAdvanced',
      target: 400,
      progressType: 'merges',
      rewardMode: 'autoMergeAdvanced',
    },
    {
      id: 'creator_expert',
      titleKey: 'achievementCreatorExpert',
      rewardKey: 'achievementRewardAutoMergeExpert',
      target: 1000,
      progressType: 'merges',
      rewardMode: 'autoMergeExpert',
    },
  ];

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
    if (!Number.isFinite(state.achievements.totalPurchased)) {
      var inferred = 0;
      if (state.buyCounts && typeof state.buyCounts === 'object') {
        var keys = Object.keys(state.buyCounts);
        for (var i = 0; i < keys.length; i++) {
          var v = Number(state.buyCounts[keys[i]]);
          if (Number.isFinite(v) && v > 0) inferred += Math.floor(v);
        }
      }
      state.achievements.totalPurchased = Math.max(0, inferred);
    }
    if (!Number.isFinite(state.achievements.totalMerges)) {
      state.achievements.totalMerges = 0;
    }
    return state.achievements;
  }

  function getProgressValueFromAchievements(progressType, ach) {
    var type = typeof progressType === 'string' ? progressType : 'purchases';
    if (!ach || typeof ach !== 'object') return 0;
    if (type === 'merges') {
      return Number.isFinite(ach.totalMerges) ? Math.max(0, Math.floor(ach.totalMerges)) : 0;
    }
    return Number.isFinite(ach.totalPurchased) ? Math.max(0, Math.floor(ach.totalPurchased)) : 0;
  }

  function getProgressValue(state, progressType) {
    var ach = ensureState(state);
    return getProgressValueFromAchievements(progressType, ach);
  }

  function recalculateUnlocks(state) {
    var ach = ensureState(state);
    if (!ach) return [];
    var unlockedNow = [];
    for (var i = 0; i < ACHIEVEMENTS.length; i++) {
      var def = ACHIEVEMENTS[i];
      if (ach.unlocked[def.id]) continue;
      var progress = getProgressValueFromAchievements(def.progressType, ach);
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
    var type = progressType;
    var deltaRaw = deltaCount;

    if (typeof progressType !== 'string') {
      type = 'purchases';
      deltaRaw = progressType;
    }

    var delta = Math.max(0, Math.floor(Number(deltaRaw) || 0));
    if (delta <= 0) return [];
    if (type === 'merges') {
      ach.totalMerges += delta;
    } else {
      ach.totalPurchased += delta;
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
