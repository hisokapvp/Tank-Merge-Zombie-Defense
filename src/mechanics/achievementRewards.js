(function (global) {
  'use strict';

  function normalizeCounter(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(value)));
  }

  function getAchievementsApi() {
    return global.Game && global.Game.Achievements ? global.Game.Achievements : null;
  }

  function ensureRewardedState(state) {
    if (!state || typeof state !== 'object') return null;
    if (!state.achievements || typeof state.achievements !== 'object') {
      state.achievements = {};
    }
    if (!state.achievements.rewarded || typeof state.achievements.rewarded !== 'object') {
      state.achievements.rewarded = {};
    }
    return state.achievements.rewarded;
  }

  function hasRewardGranted(state, achievementId) {
    if (!state || typeof achievementId !== 'string' || !achievementId) return false;
    var achievementsApi = getAchievementsApi();
    if (achievementsApi && typeof achievementsApi.hasRewardGranted === 'function') {
      return !!achievementsApi.hasRewardGranted(state, achievementId);
    }
    var rewarded = ensureRewardedState(state);
    return !!(rewarded && rewarded[achievementId]);
  }

  function markRewardGranted(state, achievementId) {
    if (!state || typeof achievementId !== 'string' || !achievementId) return false;
    var achievementsApi = getAchievementsApi();
    if (achievementsApi && typeof achievementsApi.markRewardGranted === 'function') {
      return !!achievementsApi.markRewardGranted(state, achievementId);
    }
    var rewarded = ensureRewardedState(state);
    if (!rewarded) return false;
    rewarded[achievementId] = true;
    return true;
  }

  function getHangarChipsUi() {
    return global.Game && global.Game.HangarChipsUI ? global.Game.HangarChipsUI : null;
  }

  function getRandomAchievementFragmentId(randomFn) {
    var pick = typeof randomFn === 'function' ? randomFn : Math.random;
    return Math.floor(pick() * 14) + 1;
  }

  function getRandomAchievementChipDef(randomFn) {
    var pick = typeof randomFn === 'function' ? randomFn : Math.random;
    var hangarChips = global.Game && global.Game.HangarChips ? global.Game.HangarChips : null;
    var pool = hangarChips && Array.isArray(hangarChips.allChips) ? hangarChips.allChips : null;
    if (!pool || pool.length <= 0) return null;
    return pool[Math.floor(pick() * pool.length)] || null;
  }

  function grantAchievementRandomChips(count, randomFn) {
    var chipsUi = getHangarChipsUi();
    var total = normalizeCounter(count);
    if (!chipsUi || typeof chipsUi.addPlayerChip !== 'function' || total <= 0) return false;
    for (var i = 0; i < total; i++) {
      var chipDef = getRandomAchievementChipDef(randomFn);
      if (!chipDef) return false;
      chipsUi.addPlayerChip(chipDef, 1);
    }
    return true;
  }

  function grantAchievementRandomFragments(count, randomFn) {
    var chipsUi = getHangarChipsUi();
    var total = normalizeCounter(count);
    if (!chipsUi || typeof chipsUi.addPlayerFragment !== 'function' || total <= 0) return false;
    for (var i = 0; i < total; i++) {
      chipsUi.addPlayerFragment(getRandomAchievementFragmentId(randomFn), 1);
    }
    return true;
  }

  function grantAchievementDust(amount) {
    var chipsUi = getHangarChipsUi();
    var total = normalizeCounter(amount);
    if (!chipsUi || typeof chipsUi.getSiliconDust !== 'function' || typeof chipsUi.setSiliconDust !== 'function' || total <= 0) {
      return false;
    }
    var currentDust = normalizeCounter(chipsUi.getSiliconDust());
    chipsUi.setSiliconDust(currentDust + total);
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

  function grant(state, definition, options) {
    var def = definition && typeof definition === 'object' ? definition : null;
    if (!state || !def || typeof def.id !== 'string' || typeof def.rewardMode !== 'string') return false;
    if (hasRewardGranted(state, def.id)) return false;

    var opts = options && typeof options === 'object' ? options : null;
    var randomFn = opts && typeof opts.random === 'function' ? opts.random : Math.random;
    var granted = false;

    if (def.rewardMode === 'fenceMechanicCoins75') {
      state.coins = normalizeCounter(state.coins) + 75;
      granted = true;
    } else if (def.rewardMode === 'fenceMechanicDust5') {
      granted = grantAchievementDust(5);
    } else if (def.rewardMode === 'fenceMechanicFragment1') {
      granted = grantAchievementRandomFragments(1, randomFn);
    } else if (def.rewardMode === 'fenceMechanicRandomChips2') {
      granted = grantAchievementRandomChips(2, randomFn);
    } else if (def.rewardMode === 'fenceMechanicUpgradePoint1') {
      granted = grantAchievementUpgradePoints(state, 1);
    }

    if (!granted) return false;
    return markRewardGranted(state, def.id);
  }

  global.Game = global.Game || {};
  global.Game.AchievementRewards = {
    grant: grant,
  };
})(typeof window !== 'undefined' ? window : this);