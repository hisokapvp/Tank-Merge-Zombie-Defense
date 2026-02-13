(function (global) {
  'use strict';

  function defaultFormatter(value) {
    return value < 10 ? value.toFixed(1) : Math.round(value).toString();
  }

  function compute(level, bal) {
    var cfg = bal || global.BAL || {};
    var dmg = (cfg.dmgBase || 7) * Math.pow(cfg.dmgMultPerLevel || 1.48, level - 1);
    var fireRate = (cfg.fireRateBase || 0.85) + (cfg.fireRateAddPerLevel || 0.075) * (level - 1);
    var range = 315;
    var barrels = level <= 5 ? 1 : level <= 10 ? 2 : 3;
    return {
      damage: dmg,
      fireRate: fireRate,
      range: range,
      barrels: barrels,
    };
  }

  function buildRows(level, t, bal) {
    var translate = typeof t === 'function' ? t : function (key) { return key; };
    var stats = compute(level, bal);
    var fmt = defaultFormatter;

    var rows =
      '<div class="mergePopupModal__stat"><span class="mergePopupModal__statLabel">' + translate('mergePopupDamageLabel') + ':</span> ' + fmt(stats.damage) + (stats.barrels > 1 ? ' <small>(' + stats.barrels + '×' + fmt(stats.damage / stats.barrels) + ')</small>' : '') + '</div>' +
      '<div class="mergePopupModal__stat"><span class="mergePopupModal__statLabel">' + translate('mergePopupFireRateLabel') + ':</span> ' + stats.fireRate.toFixed(2) + translate('mergePopupRateUnit') + '</div>' +
      '<div class="mergePopupModal__stat"><span class="mergePopupModal__statLabel">' + translate('mergePopupRangeLabel') + ':</span> ' + stats.range + '</div>';

    if (stats.barrels > 1) {
      rows += '<div class="mergePopupModal__stat"><span class="mergePopupModal__statLabel">' +
        translate('mergePopupBarrelsLabel') + ':</span> ' + stats.barrels + '</div>';
    }
    return rows;
  }

  global.Game = global.Game || {};
  global.Game.MergePopupStats = {
    compute: compute,
    buildRows: buildRows,
    defaultFormatter: defaultFormatter,
  };
})(typeof window !== 'undefined' ? window : this);
