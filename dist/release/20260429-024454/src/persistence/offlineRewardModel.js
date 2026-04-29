/**
 * Чистая модель офлайн-наград: монеты за выстрел + награды за убийства.
 * Модель использует внешние hooks и не зависит от глобального состояния.
 */
(function (global) {
  'use strict';

  var OFFLINE_CAP_MS = 12 * 60 * 60 * 1000;

  function toNumber(value, fallback) {
    var n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  /**
   * @param {{ elapsedMs: number, tanksOnTrackLevels: number[], effectiveZombieLevel: number }} input
   * @param {{
   *   capMs?: number,
   *   coinsPerShot: function(number): number,
   *   fireRatePerSec: function(number): number,
   *   tankDps: function(number): number,
   *   zombieHp: function(number): number,
   *   coinsPerKill: function(number): number,
   *   xpPerKill: function(number): number,
   * }} hooks
   * @returns {{ coins: number, xp: number, elapsedMsUsed: number }}
   */
  function computeOfflineRewards(input, hooks) {
    input = input || {};
    hooks = hooks || {};

    var elapsedMs = Math.max(0, toNumber(input.elapsedMs, 0));
    var capMs = toNumber(hooks.capMs, OFFLINE_CAP_MS);
    if (!Number.isFinite(capMs) || capMs < 0) capMs = OFFLINE_CAP_MS;
    var elapsedMsUsed = Math.min(elapsedMs, capMs);

    var levels = Array.isArray(input.tanksOnTrackLevels) ? input.tanksOnTrackLevels : [];
    if (!levels.length || elapsedMsUsed <= 0) {
      return { coins: 0, xp: 0, elapsedMsUsed: 0 };
    }

    var effectiveZombieLevel = Math.max(1, Math.round(toNumber(input.effectiveZombieLevel, 1)));
    var sec = elapsedMsUsed / 1000;

    var coinsPerShot = hooks.coinsPerShot || function () { return 0; };
    var fireRatePerSec = hooks.fireRatePerSec || function () { return 0; };
    var tankDps = hooks.tankDps || function () { return 0; };
    var zombieHp = hooks.zombieHp || function () { return 0; };
    var coinsPerKill = hooks.coinsPerKill || function () { return 0; };
    var xpPerKill = hooks.xpPerKill || function () { return 0; };

    var coinsFromShots = 0;
    var totalDps = 0;
    for (var i = 0; i < levels.length; i++) {
      var lvl = Math.max(1, Math.floor(levels[i] || 1));
      var shots = Math.max(0, toNumber(fireRatePerSec(lvl), 0)) * sec;
      var shotCoins = Math.max(0, toNumber(coinsPerShot(lvl), 0));
      coinsFromShots += shotCoins * shots;
      totalDps += Math.max(0, toNumber(tankDps(lvl), 0));
    }

    var zHp = Math.max(0, toNumber(zombieHp(effectiveZombieLevel), 0));
    var kills = zHp > 0 ? (totalDps * sec) / zHp : 0;

    var coinsFromKills = Math.max(0, toNumber(coinsPerKill(effectiveZombieLevel), 0)) * Math.max(0, kills);
    var xpFromKills = Math.max(0, toNumber(xpPerKill(effectiveZombieLevel), 0)) * Math.max(0, kills);

    var coins = Math.floor(coinsFromShots + coinsFromKills);
    var xp = Math.floor(xpFromKills);

    if (!Number.isFinite(coins) || coins < 0) coins = 0;
    if (!Number.isFinite(xp) || xp < 0) xp = 0;

    return { coins: coins, xp: xp, elapsedMsUsed: elapsedMsUsed };
  }

  global.Game = global.Game || {};
  global.Game.OfflineRewardModel = {
    computeOfflineRewards: computeOfflineRewards,
    OFFLINE_CAP_MS: OFFLINE_CAP_MS,
  };
})(typeof window !== 'undefined' ? window : this);
