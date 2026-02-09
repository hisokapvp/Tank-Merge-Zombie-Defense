/**
 * Единый формат чисел для UI: опыт, цены, урон.
 * Пороги: 1 000 → "к", 1 000 000 → "кк", 1 000 000 000 → "ккк".
 * Округление вниз (floor) по умолчанию; опция precision для десятичных.
 */
(function (global) {
  'use strict';

  /**
   * Округление вниз до заданной точности (precision знаков после запятой).
   * @param {number} value
   * @param {number} precision
   * @returns {number}
   */
  function floorTo(value, precision) {
    if (precision <= 0) return Math.floor(value);
    var factor = Math.pow(10, precision);
    return Math.floor(value * factor) / factor;
  }

  /**
   * Форматирование числа с суффиксами к/кк/ккк.
   * @param {number} value
   * @param {{ precision?: number }} [opts]
   * @returns {string}
   */
  function formatShortNumber(value, opts) {
    var n = Number(value);
    if (n !== n || !Number.isFinite(n)) return '0';
    var precision = (opts && typeof opts.precision === 'number') ? opts.precision : 0;
    var negative = n < 0;
    var v = Math.abs(n);

    if (v < 1000) {
      return (negative ? '-' : '') + String(Math.floor(v));
    }

    var suffix, scaled;
    if (v < 1e6) {
      suffix = 'к';
      scaled = v / 1e3;
    } else if (v < 1e9) {
      suffix = 'кк';
      scaled = v / 1e6;
    } else {
      suffix = 'ккк';
      scaled = v / 1e9;
    }

    var rounded = floorTo(scaled, precision);
    var str;
    if (precision > 0) {
      str = rounded.toFixed(precision);
      // убрать trailing zeros после точки, но оставить precision знаков
    } else {
      str = String(Math.floor(scaled));
    }

    return (negative ? '-' : '') + str + suffix;
  }

  /**
   * Обратная совместимость: formatCompactRu вызывает formatShortNumber.
   * @param {number} value
   * @param {{ precision?: number }} [opts]
   * @returns {string}
   */
  function formatCompactRu(value, opts) {
    return formatShortNumber(value, opts);
  }

  global.Game = global.Game || {};
  global.Game.NumberFormat = {
    formatCompactRu: formatCompactRu,
    formatShortNumber: formatShortNumber,
    floorTo: floorTo,
  };
})(typeof window !== 'undefined' ? window : this);
