/**
 * Баланс экономики: цены танков по уровню (50 * 2^(L-1)), canBuyTank с учётом места в гараже.
 */
(function (global) {
  'use strict';

  /**
   * Базовая стоимость танка уровня L: 50 * 2^(L-1). lvl1=50, lvl2=100, lvl3=200...
   * @param {number} level
   * @returns {number}
   */
  function getTankBaseCost(level) {
    const L = Math.max(1, Math.floor(level));
    return 50 * Math.pow(2, L - 1);
  }

  /**
   * Можно ли купить танк: достаточно монет и есть свободная ячейка (через Garage.hasFreeCell).
   * @param {{ coins: number }} state
   * @param {number} cost
   * @param {boolean} hasFree
   * @returns {boolean}
   */
  function canBuyTank(state, cost, hasFree) {
    if (!state) return false;
    if (state.coins < cost) return false;
    if (!hasFree) return false;
    return true;
  }

  /**
   * Монеты за выстрел по уровню танка: 2^(level-1), cap = 2^20.
   * @param {number} level — уровень танка (>= 1)
   * @returns {number}
   */
  var MAX_COIN_PER_SHOT = Math.pow(2, 20);
  function coinsForShot(level) {
    if (level == null || level < 1) return 0;
    var L = Math.max(1, Math.floor(level));
    return Math.min(Math.pow(2, L - 1), MAX_COIN_PER_SHOT);
  }

  // Максимальный уровень покупаемого танка
  const MAX_BUY_TANK_LEVEL = 50;

  /**
   * Вычисляет уровень покупаемого танка по формуле: max-5, минимум 1, максимум 50.
   * @param {number} maxLevel — максимальный достигнутый уровень танка
   * @returns {number} — уровень покупаемого танка
   */
  function computeBuyTankLevel(maxLevel) {
    const maxL = Math.max(1, Math.floor(maxLevel || 1));
    const buy = Math.max(1, maxL - 5);
    return Math.min(MAX_BUY_TANK_LEVEL, buy);
  }

  global.Game = global.Game || {};
  global.Game.Economy = {
    getTankBaseCost,
    canBuyTank,
    coinsForShot,
    MAX_COIN_PER_SHOT,
    MAX_BUY_TANK_LEVEL,
    computeBuyTankLevel,
  };
})(typeof window !== 'undefined' ? window : this);
