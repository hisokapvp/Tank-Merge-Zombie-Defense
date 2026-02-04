/**
 * Правила боя: фиксированная дальность стрельбы для всех танков (не зависит от уровня/прокачки).
 */
(function (global) {
  'use strict';

  var FIXED_SHOOT_RANGE = 315;

  /**
   * Дальность стрельбы — константа для всех танков. Модификаторы талантов (rangeMul) применяются снаружи.
   * @param {{ level?: number }} tank — не используется, дальность фиксирована
   * @param {object} [state] — не используется
   * @returns {number}
   */
  function getShootRange(tank, state) {
    return FIXED_SHOOT_RANGE;
  }

  function getFixedShootRange() {
    return FIXED_SHOOT_RANGE;
  }

  global.Game = global.Game || {};
  global.Game.Combat = {
    FIXED_SHOOT_RANGE,
    getShootRange,
    getFixedShootRange,
  };
})(typeof window !== 'undefined' ? window : this);
