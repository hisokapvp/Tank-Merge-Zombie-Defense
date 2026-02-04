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

  global.Game = global.Game || {};
  global.Game.Economy = {
    getTankBaseCost,
    canBuyTank,
  };
})(typeof window !== 'undefined' ? window : this);
