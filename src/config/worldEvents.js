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
      weatherLeadInSec: 5,
      weatherLeadOutSec: 3,
      targetAliveMult: 5,
      targetAliveRampSec: 2,
      speedMult: 1.2,
      damageMult: 1.15,
      eveningDimAlpha: 0.30,
      eveningTransitionSec: 2.5,
    },
  };

  global.Game = global.Game || {};
  global.Game.Config = global.Game.Config || {};
  global.Game.Config.WorldEvents = cfg;
})(typeof window !== 'undefined' ? window : this);
