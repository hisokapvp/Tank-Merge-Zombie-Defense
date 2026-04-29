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

  function levelGoldReward(level, bal, levelRewardCfg) {
    var lvl = Math.max(1, Math.floor(Number.isFinite(level) ? level : 1));
    var cfg = levelRewardCfg && typeof levelRewardCfg === 'object' ? levelRewardCfg : null;

    /* Check for per-level override from JSON config */
    if (cfg && cfg.gold && cfg.gold.perLevel && typeof cfg.gold.perLevel === 'object') {
      var override = cfg.gold.perLevel[String(lvl)];
      if (Number.isFinite(override) && override >= 0) return Math.round(override);
    }

    /* Formula-based: tankCost = 50 * 2^(level-1), or fixed from bal params */
    var formula = cfg && cfg.gold && typeof cfg.gold.formula === 'string' ? cfg.gold.formula : 'tankCost';
    if (formula === 'fixed' && bal) {
      return Math.max(0, Math.round((bal.levelGoldBase || 0) + (bal.levelGoldPerLevel || 0) * Math.max(0, lvl - 1)));
    }
    return Math.max(0, Math.round(50 * Math.pow(2, lvl - 1)));
  }

  var COINS_PER_SHOT_MAX_EXP = 20; /* matches Game.Economy MAX_COIN_PER_SHOT = 2^20 */
  var COINS_PER_SHOT_WARNED = {};

  function coinsPerShotDefault(level) {
    var lvl = Math.max(1, Math.floor(Number.isFinite(level) ? level : 1));
    return Math.min(Math.pow(2, lvl - 1), Math.pow(2, COINS_PER_SHOT_MAX_EXP));
  }

  /**
   * Базовое число монет за выстрел танка (до runtime-множителей).
   * Приоритет: cfg.coinsPerShot.perLevel[level] → formula='default' (runtime) → formula='fixed' (bal params) → default.
   * Safe-integer clamp включён.
   */
  function coinsPerShot(level, bal, levelRewardCfg) {
    var lvl = Math.max(1, Math.floor(Number.isFinite(level) ? level : 1));
    if (lvl <= 0) return 0;
    var cfg = levelRewardCfg && typeof levelRewardCfg === 'object' ? levelRewardCfg : null;
    var block = cfg && cfg.coinsPerShot && typeof cfg.coinsPerShot === 'object' ? cfg.coinsPerShot : null;
    var perLevel = block && block.perLevel && typeof block.perLevel === 'object' ? block.perLevel : null;

    if (perLevel) {
      var override = perLevel[String(lvl)];
      if (Number.isFinite(override) && override >= 0) {
        return Math.min(Math.max(0, override), Number.MAX_SAFE_INTEGER);
      }
    }

    var formula = block && typeof block.formula === 'string' ? block.formula : 'default';
    if (formula === 'fixed') {
      if (!perLevel && !COINS_PER_SHOT_WARNED[lvl] && typeof console !== 'undefined' && console.warn) {
        console.warn('[ProgressionApi.coinsPerShot] formula=fixed but perLevel[' + lvl + '] missing; falling back to bal params');
        COINS_PER_SHOT_WARNED[lvl] = true;
      }
      if (bal) {
        var base = Number(bal.coinsPerShotBase) || 0;
        var mul = Number(bal.coinsPerShotLevelMul) || 0;
        var fixedVal = base + mul * Math.max(0, lvl - 1);
        return Math.min(Math.max(0, fixedVal), Number.MAX_SAFE_INTEGER);
      }
    }
    return Math.min(coinsPerShotDefault(lvl), Number.MAX_SAFE_INTEGER);
  }

  global.Game = global.Game || {};
  global.Game.Progression = {
    POWER_TIER_THRESHOLDS: POWER_TIER_THRESHOLDS,
    computePowerTier: computePowerTier,
    xpNeededForLevel: xpNeededForLevel,
    levelGoldReward: levelGoldReward,
    coinsPerShot: coinsPerShot,
  };
})(typeof window !== 'undefined' ? window : this);
