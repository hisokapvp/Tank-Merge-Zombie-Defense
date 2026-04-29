(function (global) {
  'use strict';

  /**
   * Выбирает правильную словоформу по числу.
   * Русский: mod10/mod100 логика (один/несколько/много).
   * Для остальных языков: n === 1 ? one : many.
   *
   * @param {number} n — количество (целое >= 0)
   * @param {*} one   — форма для 1 (танк / tank)
   * @param {*} few   — форма для 2-4 (танка / tanks)
   * @param {*} many  — форма для 5+ (танков / tanks)
   * @returns {*} подходящая форма
   */
  function pluralize(n, one, few, many) {
    var lang = '';
    var i18n = global.Game && global.Game.I18n;
    if (i18n && typeof i18n.getLanguage === 'function') {
      lang = i18n.getLanguage() || '';
    }
    if (lang === 'ru') {
      var mod10 = n % 10;
      var mod100 = n % 100;
      if (mod100 >= 11 && mod100 <= 14) return many;
      if (mod10 === 1) return one;
      if (mod10 >= 2 && mod10 <= 4) return few;
      return many;
    }
    return n === 1 ? one : many;
  }

  global.Game = global.Game || {};
  global.Game.I18n = global.Game.I18n || {};
  global.Game.I18n.pluralize = pluralize;
}(typeof window !== 'undefined' ? window : this));
