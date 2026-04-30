(function (global) {
  'use strict';

  var enabled = true;

  var cfg = {
    enabled: enabled,
    weather: {
      enabled: enabled,
      rain: {
        enabled: true,
        density: 0.16,
        speedMin: 520,
        speedMax: 760,
        lengthMin: 10,
        lengthMax: 18,
        alpha: 0.26,
        sfxLoopSources: ['assets/sfx/rain_loop.ogg', 'assets/sfx/rain_loop.wav'],
      },
      lightning: {
        enabled: true,
        chancePerSec: 0.20,
        flashDurationSec: 0.12,
        intervalMinSec: 1,
        intervalMaxSec: 20,
      },
      thunder: {
        enabled: true,
        sfxId: 'thunder',
      },
    },
    attackMode: {
      enabled: enabled,
      attackEverySec: 120,
      attackDurationSec: 60,
      idleWave: {
        enabled: true,
        attackDamageMul: 0.01,
        betweenWavesSec: 15,
        attackDurationSec: 20,
        wanderDurationSec: 10,
        retreatDistanceMinPx: 20,
        retreatDistanceMaxPx: 40,
      },
      weatherLeadInSec: 5,
      weatherLeadOutSec: 3,
      targetAliveMult: 4,
      targetAliveRampSec: 3,
      speedMult: 1.5,
      damageMult: 1.5,
      fenceBreachAwarenessRadiusPx: 100,
      safeWaves: 1,
      eveningDimAlpha: 0.40,
      eveningTransitionSec: 1,
    },
    // solo-pipeline-yandex-vk#2 / item 2: dedicated attackMode for L60 zombies.
    // Runtime selects this block instead of `attackMode` once L60 zombies start
    // spawning (proxied by state.maxTankLevelAchieved >= 60). The two configs
    // are mutually exclusive at runtime — exactly one is active per tick.
    // Timings/multipliers below are intentionally different from `attackMode`
    // to give the L60 endgame its own pacing and pressure profile.
    attackMode60: {
      enabled: enabled,
      attackEverySec: 30,
      attackDurationSec: 15,
      idleWave: {
        enabled: true,
        attackDamageMul: 0.02,
        betweenWavesSec: 10,
        attackDurationSec: 25,
        wanderDurationSec: 8,
        retreatDistanceMinPx: 15,
        retreatDistanceMaxPx: 30,
      },
      weatherLeadInSec: 5,
      weatherLeadOutSec: 3,
      targetAliveMult: 4,
      targetAliveRampSec: 3,
      speedMult: 1.5,
      damageMult: 1.5,
      fenceBreachAwarenessRadiusPx: 100,
      safeWaves: 0,
      eveningDimAlpha: 0.50,
      eveningTransitionSec: 1,
    },
  };

  global.Game = global.Game || {};
  global.Game.Config = global.Game.Config || {};
  global.Game.Config.WorldEvents = cfg;
})(typeof window !== 'undefined' ? window : this);
