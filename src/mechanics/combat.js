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
   * Number of projectiles per shot based on tank level.
   * Levels 1-5: 1, 6-10: 2, 11+: 3. Damage is split evenly.
   * @param {number} level
   * @returns {number}
   */
  function getProjectileCount(level) {
    var lvl = Math.max(1, Math.floor(level || 1));
    if (lvl <= 5) return 1;
    if (lvl <= 10) return 2;
    return 3;
  }

  /**
   * Детерминированный выбор анимации смерти зомби.
   * 70% personal, 30% common (если оба доступны).
   * common может быть объектом, массивом вариантов или null.
   *
   * @param {object|object[]|null} common - общая death-анимация (ZombieSprites.deathCommon)
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

    /* Resolve common: if array, pick random variant using upper bits of rand01 */
    var resolvedCommon = common;
    if (Array.isArray(common)) {
      if (common.length === 0) {
        resolvedCommon = null;
      } else if (common.length === 1) {
        resolvedCommon = common[0];
      } else {
        /* Use fractional part of r*1000 to pick variant index — decorrelated from 70/30 split */
        var variantIdx = Math.floor((r * 997) % common.length);
        resolvedCommon = common[variantIdx];
      }
    }

    if (personal && resolvedCommon) {
      // Оба доступны: 70% personal, 30% common
      return r < 0.7 ? personal : resolvedCommon;
    } else if (personal) {
      return personal;
    } else if (resolvedCommon) {
      return resolvedCommon;
    }
    return null; // fallback: fade/tilt
  }

  global.Game = global.Game || {};
  global.Game.Combat = {
    FIXED_SHOOT_RANGE,
    getShootRange,
    getFixedShootRange,
    pickDeathAnim,
    getProjectileCount,
  };
})(typeof window !== 'undefined' ? window : this);
