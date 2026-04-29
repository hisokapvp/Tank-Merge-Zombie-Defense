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
  * Можно ли создать танк: достаточно монет и есть свободная ячейка (через Garage.hasFreeCell).
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
   * Монеты за выстрел по уровню танка: 2^(level-1) без cap на уровнях 22-60
   * (см. assets/levelreward.json coinsPerShot._formulaHelp и ci/check_coinspershot.py).
   * batch solo-pipeline-yandex-vk#1 (item 3, P2, P5): cap 2^20 убран, кривая расширена на все 60 уровней.
   * Значения clamp-ятся к Number.MAX_SAFE_INTEGER.
   * @param {number} level — уровень танка (>= 1)
   * @returns {number}
   */
  var MAX_COIN_PER_SHOT = Number.MAX_SAFE_INTEGER;
  function coinsForShot(level) {
    if (level == null || level < 1) return 0;
    var L = Math.max(1, Math.floor(level));
    var v = Math.pow(2, L - 1);
    return v >= MAX_COIN_PER_SHOT ? MAX_COIN_PER_SHOT : v;
  }

  // Максимальный уровень покупаемого танка
  // batch solo-pipeline-yandex-vk#2 (item 4): расширено с 50 до 55 уровня.
  // Ассеты tank_lvl1..tank_lvl60 уже существуют, формула цены 50*2^(L-1) работает на любом L.
  const MAX_BUY_TANK_LEVEL = 55;

  /**
   * Вычисляет уровень покупаемого танка по формуле: max-5, минимум 1, максимум MAX_BUY_TANK_LEVEL (55).
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
