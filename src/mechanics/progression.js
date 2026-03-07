(function (global) {
  'use strict';

  var POWER_TIER_THRESHOLDS = [10, 20, 30, 40, 50, 60];

  function computePowerTier(computerLevel) {
    var lvl = Math.max(0, Math.floor(Number.isFinite(computerLevel) ? computerLevel : 0));
    if (lvl < 10) return 0;
    if (lvl < 20) return 1;
    if (lvl < 30) return 2;
    if (lvl < 40) return 3;
    if (lvl < 50) return 4;
    return 5;
  }

  function xpNeededForLevel(level) {
    var lvl = Math.floor(Number.isFinite(level) ? level : 0);
    if (lvl <= 0) return 50;
    var growth = Math.pow(3, level - 1);
    var correction = level >= 4 ? (10 / 9) : 1;
    var decadeBoost = Math.pow(2, Math.floor((level - 1) / 10));
    return Math.round(500 * growth * correction * decadeBoost);
  }

  function levelGoldReward(level, bal) {
    if (!bal) return 0;
    return Math.max(0, Math.round(bal.levelGoldBase + bal.levelGoldPerLevel * Math.max(0, level - 1)));
  }

  global.Game = global.Game || {};
  global.Game.Progression = {
    POWER_TIER_THRESHOLDS: POWER_TIER_THRESHOLDS,
    computePowerTier: computePowerTier,
    xpNeededForLevel: xpNeededForLevel,
    levelGoldReward: levelGoldReward,
  };
})(typeof window !== 'undefined' ? window : this);
