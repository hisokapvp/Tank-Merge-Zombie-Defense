/**
 * Расчёт офлайн-наград (монеты, опыт) по elapsed и только по танкам на трассе.
 * Модель учитывает монеты за выстрел и награды за убийства (без бафов).
 */
(function (global) {
  'use strict';

  var Game = global.Game || {};
  var isTankOnTrack = Game.TrackQuery ? Game.TrackQuery.isTankOnTrack : function () { return false; };
  var RewardModel = Game.OfflineRewardModel;
  var Economy = Game.Economy;

  var DEFAULTS = {
    OFFLINE_CAP_MS: 12 * 60 * 60 * 1000,
    FIRE_RATE_BASE: 0.85,
    FIRE_RATE_ADD_PER_LEVEL: 0.075,
    DMG_BASE: 7,
    DMG_MULT_PER_LEVEL: 1.48,
    ZOMBIE_HP_BASE: 44,
    ZOMBIE_HP_EXTRA_PER_LEVEL: 0.12,
    COINS_PER_KILL_BASE: 1,
    COINS_PER_KILL_LEVEL_MUL: 0.35,
    ZOMBIE_KILL_COINS_MUL: 0.5,
    ZOMBIE_KILL_XP_MUL: 0.5,
  };

  function getTankConfig(level) {
    return global.TankSprites && typeof global.TankSprites.getTank === 'function'
      ? global.TankSprites.getTank(level)
      : null;
  }

  function getZombieType(level) {
    var zombieSprites = global.ZombieSprites || (global.Game && global.Game.ZombieSprites) || null;
    var types = zombieSprites && Array.isArray(zombieSprites.types) ? zombieSprites.types : null;
    return types && types[level - 1] ? types[level - 1] : null;
  }

  function fallbackCoinsForShot(level) {
    if (level == null || level < 1) return 0;
    var L = Math.max(1, Math.floor(level));
    var max = Math.pow(2, 20);
    return Math.min(Math.pow(2, L - 1), max);
  }

  function collectTanksOnTrackLevels(state) {
    var levels = [];
    if (!state || !Array.isArray(state.cells)) return levels;
    for (var i = 0; i < state.cells.length; i++) {
      var cell = state.cells[i];
      if (!cell || !cell.tank) continue;
      if (!isTankOnTrack(cell.tank, state)) continue;
      var lvl = Math.max(1, Math.floor(cell.tank.level || 1));
      levels.push(lvl);
    }
    return levels;
  }

  function computeEffectiveZombieLevel(levels) {
    if (!levels.length) return 1;
    var sum = 0;
    for (var i = 0; i < levels.length; i++) sum += levels[i];
    return Math.max(1, Math.round(sum / levels.length));
  }

  function buildHooks() {
    var coinsPerShot = Economy && Economy.coinsForShot ? Economy.coinsForShot : fallbackCoinsForShot;
    var fireRateBase = DEFAULTS.FIRE_RATE_BASE;
    var fireRateAdd = DEFAULTS.FIRE_RATE_ADD_PER_LEVEL;
    var dmgBase = DEFAULTS.DMG_BASE;
    var dmgMult = DEFAULTS.DMG_MULT_PER_LEVEL;
    var zombieHpBase = DEFAULTS.ZOMBIE_HP_BASE;
    var zombieHpExtra = DEFAULTS.ZOMBIE_HP_EXTRA_PER_LEVEL;
    var coinsKillBase = DEFAULTS.COINS_PER_KILL_BASE;
    var coinsKillMul = DEFAULTS.COINS_PER_KILL_LEVEL_MUL;
    var killCoinsMul = DEFAULTS.ZOMBIE_KILL_COINS_MUL;
    var killXpMul = DEFAULTS.ZOMBIE_KILL_XP_MUL;

    function fireRatePerSec(level) {
      var lvl = Math.max(1, Math.floor(level || 1));
      var tankCfg = getTankConfig(lvl);
      var attackSpeed = Number(tankCfg && tankCfg.stats && tankCfg.stats.attackSpeed);
      if (Number.isFinite(attackSpeed) && attackSpeed > 0) return attackSpeed;
      return fireRateBase + fireRateAdd * (lvl - 1);
    }

    function tankDps(level) {
      var lvl = Math.max(1, Math.floor(level || 1));
      var tankCfg = getTankConfig(lvl);
      var dmg = Number(tankCfg && tankCfg.stats && tankCfg.stats.baseDamage);
      if (!(Number.isFinite(dmg) && dmg > 0)) {
        dmg = dmgBase * Math.pow(dmgMult, lvl - 1);
      }
      return dmg * fireRatePerSec(lvl);
    }

    function zombieHp(level) {
      var lvl = Math.max(1, Math.floor(level || 1));
      var zombieType = getZombieType(lvl);
      var explicitHealth = Number.isFinite(zombieType && zombieType.health) && zombieType.health > 0
        ? zombieType.health
        : (Number.isFinite(zombieType && zombieType.Health) && zombieType.Health > 0 ? zombieType.Health : NaN);
      if (Number.isFinite(explicitHealth) && explicitHealth > 0) return explicitHealth;
      var dmgScale = Math.pow(dmgMult, lvl - 1);
      var extra = 1 + zombieHpExtra * Math.max(0, lvl - 1);
      return zombieHpBase * dmgScale * extra;
    }

    function coinsPerKill(level) {
      var lvl = Math.max(1, Math.floor(level || 1));
      var base = coinsKillBase + coinsKillMul * Math.max(0, lvl - 1);
      return base * killCoinsMul;
    }

    function xpPerKill(level) {
      var lvl = Math.max(1, Math.floor(level || 1));
      var baseXp = 9 * Math.pow(2, lvl - 1);
      return baseXp * killXpMul;
    }

    return {
      capMs: RewardModel && RewardModel.OFFLINE_CAP_MS ? RewardModel.OFFLINE_CAP_MS : DEFAULTS.OFFLINE_CAP_MS,
      coinsPerShot: coinsPerShot,
      fireRatePerSec: fireRatePerSec,
      tankDps: tankDps,
      zombieHp: zombieHp,
      coinsPerKill: coinsPerKill,
      xpPerKill: xpPerKill,
    };
  }

  /**
   * Вычислить офлайн-награды. Учитываются только танки на трассе (isTankOnTrack).
   * @param {object} state — состояние на момент ухода (должно содержать cells, player)
   * @param {number} elapsedMs — время отсутствия (мс)
   * @returns {{ coins: number, xp: number, elapsedMsUsed: number }}
   */
  function computeOfflineRewards(state, elapsedMs) {
    if (!RewardModel || typeof RewardModel.computeOfflineRewards !== 'function') {
      return { coins: 0, xp: 0, elapsedMsUsed: 0 };
    }

    var tanksOnTrackLevels = collectTanksOnTrackLevels(state);
    if (!tanksOnTrackLevels.length) {
      return { coins: 0, xp: 0, elapsedMsUsed: 0 };
    }

    var effectiveZombieLevel = computeEffectiveZombieLevel(tanksOnTrackLevels);
    var hooks = buildHooks();

    return RewardModel.computeOfflineRewards({
      elapsedMs: elapsedMs,
      tanksOnTrackLevels: tanksOnTrackLevels,
      effectiveZombieLevel: effectiveZombieLevel,
    }, hooks);
  }

  global.Game = global.Game || {};
  global.Game.OfflineProgress = {
    computeOfflineRewards: computeOfflineRewards,
    OFFLINE_CAP_MS: RewardModel && RewardModel.OFFLINE_CAP_MS ? RewardModel.OFFLINE_CAP_MS : DEFAULTS.OFFLINE_CAP_MS,
  };
})(typeof window !== 'undefined' ? window : this);
