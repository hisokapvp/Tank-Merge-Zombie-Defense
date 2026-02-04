/**
 * Единый формат чисел для UI: опыт, цены, урон.
 * < 10000 — как есть; >= 10000 — к/м/б с 1 десятичным знаком (запятая, без ,0).
 */
(function (global) {
  'use strict';

  function formatWithComma(decimal) {
    const s = String(decimal);
    return s.indexOf('.') >= 0 ? s.replace('.', ',') : s;
  }

  /**
   * @param {number} value
   * @param {{ negative?: boolean }} [opts]
   * @returns {string}
   */
  function formatCompactRu(value, opts) {
    const n = Number(value);
    if (n !== n || !Number.isFinite(n)) return '0';
    const negative = n < 0;
    const v = Math.abs(n);
    if (v < 10000) return (negative ? '-' : '') + String(Math.round(v));
    if (v < 1e6) {
      const k = v / 1e3;
      const oneDec = Math.round(k * 10) / 10;
      const str = oneDec === Math.floor(oneDec) ? String(Math.floor(oneDec)) : formatWithComma(oneDec.toFixed(1));
      return (negative ? '-' : '') + str + 'к';
    }
    if (v < 1e9) {
      const m = v / 1e6;
      const oneDec = Math.round(m * 10) / 10;
      const str = oneDec === Math.floor(oneDec) ? String(Math.floor(oneDec)) : formatWithComma(oneDec.toFixed(1));
      return (negative ? '-' : '') + str + 'м';
    }
    const b = v / 1e9;
    const oneDec = Math.round(b * 10) / 10;
    const str = oneDec === Math.floor(oneDec) ? String(Math.floor(oneDec)) : formatWithComma(oneDec.toFixed(1));
    return (negative ? '-' : '') + str + 'б';
  }

  global.Game = global.Game || {};
  global.Game.NumberFormat = {
    formatCompactRu,
    formatWithComma,
  };
})(typeof window !== 'undefined' ? window : this);
