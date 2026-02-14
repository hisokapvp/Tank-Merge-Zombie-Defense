(function (global) {
  'use strict';

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
      },
      lightning: {
        enabled: true,
        chancePerSec: 0.14,
        flashDurationSec: 0.12,
      },
      thunder: {
        enabled: true,
        sfxId: 'thunder',
      },
    },
    attackMode: {
      enabled: enabled,
      attackEverySec: 1,
      attackDurationSec: 180,
      weatherLeadInSec: 5,
      weatherLeadOutSec: 3,
      targetAliveMult: 5,
      speedMult: 1.2,
      damageMult: 1.15,
    },
  };

  global.Game = global.Game || {};
  global.Game.Config = global.Game.Config || {};
  global.Game.Config.WorldEvents = cfg;
})(typeof window !== 'undefined' ? window : this);
