/**
 * Corpse despawn timing helpers.
 */
(function (global) {
  'use strict';

  var DEFAULT_CORPSE_DESPAWN_SEC = 3.0;
  var DEFAULT_CORPSE_FADE_OUT_SEC = 0.8;

  function computeDeathAnimDuration(deathAnim, animSpeed, fallbackDuration) {
    var speed = Number.isFinite(animSpeed) && animSpeed > 0 ? animSpeed : 10;
    var frames = deathAnim && Number.isFinite(deathAnim.frames) ? Math.max(1, deathAnim.frames) : null;
    if (!frames) {
      return Number.isFinite(fallbackDuration) ? Math.max(0, fallbackDuration) : 0;
    }
    return Math.max(0, frames - 1) / speed;
  }

  function normalizeCorpseTimingConfig(rawConfig) {
    var src = rawConfig && typeof rawConfig === 'object' ? rawConfig : {};
    var despawnSec = Number.isFinite(src.corpseDespawnSec)
      ? Math.max(0, Number(src.corpseDespawnSec))
      : DEFAULT_CORPSE_DESPAWN_SEC;
    var fadeOutSec = Number.isFinite(src.corpseFadeOutSec)
      ? Math.max(0, Number(src.corpseFadeOutSec))
      : DEFAULT_CORPSE_FADE_OUT_SEC;
    fadeOutSec = Math.min(fadeOutSec, despawnSec);
    return {
      corpseDespawnSec: despawnSec,
      corpseFadeOutSec: fadeOutSec,
    };
  }

  function computeCorpseTiming(opts) {
    var options = opts && typeof opts === 'object' ? opts : {};
    var animDuration = computeDeathAnimDuration(options.deathAnim, options.deathAnimSpeed, options.deathDuration);
    var timingCfg = normalizeCorpseTimingConfig(options.corpseConfig);
    return {
      deathAnimDuration: animDuration,
      corpseDespawnSec: timingCfg.corpseDespawnSec,
      corpseFadeOutSec: timingCfg.corpseFadeOutSec,
      corpseTimerTotal: animDuration + timingCfg.corpseDespawnSec,
    };
  }

  function computeCorpseDespawnTimer(opts) {
    return computeCorpseTiming(opts).corpseTimerTotal;
  }

  global.Game = global.Game || {};
  global.Game.CorpseDespawn = {
    DEFAULT_CORPSE_DESPAWN_SEC: DEFAULT_CORPSE_DESPAWN_SEC,
    DEFAULT_CORPSE_FADE_OUT_SEC: DEFAULT_CORPSE_FADE_OUT_SEC,
    computeDeathAnimDuration: computeDeathAnimDuration,
    normalizeCorpseTimingConfig: normalizeCorpseTimingConfig,
    computeCorpseTiming: computeCorpseTiming,
    computeCorpseDespawnTimer: computeCorpseDespawnTimer,
  };
})(typeof window !== 'undefined' ? window : this);
