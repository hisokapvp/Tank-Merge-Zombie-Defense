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
      attackEverySec: 30,
      attackDurationSec: 10,
      idleWave: {
        enabled: true,
        attackDamageMul: 0.01,
        betweenWavesSec: 15,
        attackDurationSec: 20,
        wanderDurationSec: 10,
        retreatDistanceMinPx: 30,
        retreatDistanceMaxPx: 50,
      },
      weatherLeadInSec: 5,
      weatherLeadOutSec: 3,
      targetAliveMult: 5,
      targetAliveRampSec: 3,
      speedMult: 1.5,
      damageMult: 1.5,
      fenceBreachAwarenessRadiusPx: 100,
      safeWaves: 1,
      eveningDimAlpha: 0.40,
      eveningTransitionSec: 1,
    },
  };

  global.Game = global.Game || {};
  global.Game.Config = global.Game.Config || {};
  global.Game.Config.WorldEvents = cfg;
})(typeof window !== 'undefined' ? window : this);
