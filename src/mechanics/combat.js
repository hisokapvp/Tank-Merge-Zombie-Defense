/**
 * Правила боя: фиксированная дальность стрельбы для всех танков (не зависит от уровня/прокачки).
 * + pickDeathAnim — детерминированный выбор death-анимации для тестируемости.
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

  /**
   * Детерминированный выбор анимации смерти зомби.
   * 70% personal, 30% common (если оба доступны).
   * 
   * @param {object|null} common - общая death-анимация (ZombieSprites.deathCommon)
   * @param {object|null} personal - персональная death-анимация (z.type.death)
   * @param {number} rand01 - случайное число [0, 1) для детерминированного тестирования
   * @returns {object|null} - выбранная анимация или null (fallback to fade/tilt)
   */
  function pickDeathAnim(common, personal, rand01) {
    // Нормализуем rand01 к диапазону [0, 1)
    var r;
    if (typeof rand01 !== 'number' || isNaN(rand01)) {
      r = 0;
    } else if (rand01 === Infinity || rand01 >= 1) {
      r = 0.9999999; // clamp to just under 1
    } else if (rand01 === -Infinity || rand01 < 0) {
      r = 0;
    } else {
      r = rand01;
    }
    
    if (personal && common) {
      // Оба доступны: 70% personal, 30% common
      return r < 0.7 ? personal : common;
    } else if (personal) {
      return personal;
    } else if (common) {
      return common;
    }
    return null; // fallback: fade/tilt
  }

  global.Game = global.Game || {};
  global.Game.Combat = {
    FIXED_SHOOT_RANGE,
    getShootRange,
    getFixedShootRange,
    pickDeathAnim,
  };
})(typeof window !== 'undefined' ? window : this);
