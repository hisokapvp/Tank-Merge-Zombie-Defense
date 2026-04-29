/**
 * Единый формат чисел для UI: опыт, цены, урон.
 * Формат: 1..9999 без суффикса, далее K/M/B/T/Q/Qi/Sx/Sp/Oc/No/Dc.
 * Только целые значения; fallback на e-нотацию.
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
   * Форматирование числа с суффиксами K/M/B/T/Q/Qi/Sx/Sp/Oc/No/Dc.
   * @param {number} value
   * @returns {string}
   */
  function formatShortNumber(value) {
    var n = Number(value);
    if (n !== n || !Number.isFinite(n)) return '0';
    var negative = n < 0;
    var v = Math.abs(n);
    var intVal = Math.floor(v);

    if (intVal < 10000) {
      return (negative ? '-' : '') + String(intVal);
    }

    var suffixes = ['K', 'M', 'B', 'T', 'Q', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
    var suffixIndex = 0;
    var divisor = 1000;

    while (suffixIndex < suffixes.length && intVal >= divisor * 1000) {
      divisor *= 1000;
      suffixIndex++;
    }

    if (suffixIndex >= suffixes.length) {
      return (negative ? '-' : '') + intVal.toExponential(0);
    }

    var scaled = Math.floor(intVal / divisor);
    return (negative ? '-' : '') + String(scaled) + suffixes[suffixIndex];
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
