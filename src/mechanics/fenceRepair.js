(function (global) {
  'use strict';

  var FENCE_DEFAULT_REPAIR_COST = 100;
  var _fenceConfigProvider = null;
  var _tankPricesPromise = null;

  /**
   * Set up fence config provider from game.js scope.
   * @param {Object} opts
   * @param {Function} opts.getFenceConfig - returns FenceSprites.config or {}
   */
  function init(opts) {
    if (opts && typeof opts.getFenceConfig === 'function') {
      _fenceConfigProvider = opts.getFenceConfig;
    }
  }

  /**
   * Async replacement for the sync XMLHttpRequest IIFE.
   * Loads assets/tanks.json and builds Game.TankPrices array.
   * @returns {Promise}
   */
  function loadTankPrices() {
    if (_tankPricesPromise) return _tankPricesPromise;
    _tankPricesPromise = fetch('assets/tanks.json', { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (tankData) {
        var prices = [];
        for (var lvl = 1; lvl <= 60; lvl++) {
          var key = 'tank_lvl' + lvl;
          if (tankData[key] && typeof tankData[key] === 'object') {
            var cost = 0;
            if (tankData[key].upgradeDamagePointsCosts && typeof tankData[key].upgradeDamagePointsCosts.baseDamage === 'number') {
              cost = tankData[key].upgradeDamagePointsCosts.baseDamage;
            } else if (tankData[key].stats && typeof tankData[key].stats.baseDamage === 'number') {
              cost = tankData[key].stats.baseDamage;
            } else {
              cost = 1;
            }
            prices.push(cost);
          } else {
            prices.push(1);
          }
        }
        global.Game.TankPrices = prices;
      })
      .catch(function () {
        global.Game.TankPrices = global.Game.TankPrices || Array(60).fill(1);
      });
    return _tankPricesPromise;
  }

  /**
   * Returns fence repair config (enabled flag).
   * Cost is now computed dynamically via computeRepairCost.
   */
  function getFenceRepairConfig() {
    var cfg = typeof _fenceConfigProvider === 'function' ? _fenceConfigProvider() : {};
    var repair = cfg.repair || {};
    return {
      enabled: repair.enabled !== false,
    };
  }

  /**
   * Compute fence segment repair cost.
   *
   * Formula: buyTankCost(fenceLevel) + repairCount * max(1, ceil(buyTankCost(fenceLevel) * 0.01))
   *
   * Examples (fenceLevel 1 → base 50$):
   *   1st repair (count=0): 50$
   *   2nd repair (count=1): 51$
   *   3rd repair (count=2): 52$
   *
   * Examples (fenceLevel 4 → base 400$):
   *   1st repair (count=0): 400$
   *   2nd repair (count=1): 404$
   *   3rd repair (count=2): 408$
   *
   * @param {number} fenceLevel - current fence tier (1-based)
   * @param {number} repairCount - cumulative repairs this session
   * @returns {number}
   */
  function computeRepairCost(fenceLevel, repairCount) {
    var getBuyTankCost = global.Game && global.Game.buyTankCost;
    if (typeof getBuyTankCost !== 'function') return FENCE_DEFAULT_REPAIR_COST;
    var level = Number.isFinite(fenceLevel) ? Math.max(1, Math.floor(fenceLevel)) : 1;
    var baseCost = getBuyTankCost(level);
    if (!Number.isFinite(baseCost) || baseCost < 1) baseCost = FENCE_DEFAULT_REPAIR_COST;
    var count = Number.isFinite(repairCount) ? Math.max(0, Math.floor(repairCount)) : 0;
    if (count <= 0) return baseCost;
    var perRepairSurcharge = Math.max(1, Math.ceil(baseCost * 0.01));
    return baseCost + count * perRepairSurcharge;
  }

  /**
   * Public getter — returns fence repair cost in coins.
   * @param {number} fenceLevel
   * @param {number} repairCount
   * @returns {number}
   */
  function getFenceRepairCostCoins(fenceLevel, repairCount) {
    return computeRepairCost(fenceLevel, repairCount);
  }

  global.Game = global.Game || {};
  global.Game.FenceRepair = {
    FENCE_DEFAULT_REPAIR_COST: FENCE_DEFAULT_REPAIR_COST,
    init: init,
    loadTankPrices: loadTankPrices,
    getFenceRepairConfig: getFenceRepairConfig,
    getFenceRepairCostCoins: getFenceRepairCostCoins,
    computeRepairCost: computeRepairCost,
  };
}(typeof window !== 'undefined' ? window : this));
