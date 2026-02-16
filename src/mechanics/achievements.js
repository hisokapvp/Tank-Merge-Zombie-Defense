(function (global) {
  'use strict';

  var ACHIEVEMENTS = [
    {
      id: 'buyer_novice',
      titleKey: 'achievementBuyerNovice',
      rewardKey: 'achievementRewardBuy2',
      target: 100,
      rewardMode: 'buy2',
    },
    {
      id: 'buyer_pro',
      titleKey: 'achievementBuyerPro',
      rewardKey: 'achievementRewardBuy5',
      target: 500,
      rewardMode: 'buy5',
    },
    {
      id: 'buyer_expert',
      titleKey: 'achievementBuyerExpert',
      rewardKey: 'achievementRewardBuyMax',
      target: 1000,
      rewardMode: 'buyMax',
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
    return state.achievements;
  }

  function getDefinitions() {
    return ACHIEVEMENTS.slice();
  }

  function getBulkMode(state) {
    var ach = ensureState(state);
    if (!ach) return 'none';
    if (ach.unlocked.buyer_expert) return 'buyMax';
    if (ach.unlocked.buyer_pro) return 'buy5';
    if (ach.unlocked.buyer_novice) return 'buy2';
    return 'none';
  }

  function addProgress(state, purchasedCount) {
    var ach = ensureState(state);
    if (!ach) return [];
    var delta = Math.max(0, Math.floor(Number(purchasedCount) || 0));
    if (delta <= 0) return [];
    ach.totalPurchased += delta;

    var unlockedNow = [];
    for (var i = 0; i < ACHIEVEMENTS.length; i++) {
      var def = ACHIEVEMENTS[i];
      if (ach.unlocked[def.id]) continue;
      if (ach.totalPurchased >= def.target) {
        ach.unlocked[def.id] = true;
        unlockedNow.push(def.id);
      }
    }
    return unlockedNow;
  }

  global.Game = global.Game || {};
  global.Game.Achievements = {
    getDefinitions: getDefinitions,
    ensureState: ensureState,
    addProgress: addProgress,
    getBulkMode: getBulkMode,
  };
})(typeof window !== 'undefined' ? window : this);
