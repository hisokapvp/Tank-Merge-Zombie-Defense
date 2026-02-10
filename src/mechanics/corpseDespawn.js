/**
 * Corpse despawn timing helpers.
 */
(function (global) {
  'use strict';

  var CORPSE_DESPAWN_DELAY = 5;

  function computeDeathAnimDuration(deathAnim, animSpeed, fallbackDuration) {
    var speed = Number.isFinite(animSpeed) && animSpeed > 0 ? animSpeed : 10;
    var frames = deathAnim && Number.isFinite(deathAnim.frames) ? Math.max(1, deathAnim.frames) : null;
    if (!frames) {
      return Number.isFinite(fallbackDuration) ? Math.max(0, fallbackDuration) : 0;
    }
    return Math.max(0, frames - 1) / speed;
  }

  function computeCorpseDespawnTimer(opts) {
    var animDuration = computeDeathAnimDuration(opts?.deathAnim, opts?.deathAnimSpeed, opts?.deathDuration);
    return animDuration + CORPSE_DESPAWN_DELAY;
  }

  global.Game = global.Game || {};
  global.Game.CorpseDespawn = {
    CORPSE_DESPAWN_DELAY: CORPSE_DESPAWN_DELAY,
    computeDeathAnimDuration: computeDeathAnimDuration,
    computeCorpseDespawnTimer: computeCorpseDespawnTimer,
  };
})(typeof window !== 'undefined' ? window : this);
