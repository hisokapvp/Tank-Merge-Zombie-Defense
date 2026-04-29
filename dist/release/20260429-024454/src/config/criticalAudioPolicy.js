(function (global) {
  'use strict';

  var root = global.Game = global.Game || {};
  var config = root.Config = root.Config || {};

  config.CriticalAudioPolicy = {
    muteAllOnCritical: true,
    allowedSfx: [],
    criticalMusic: {
      enabled: false,
      trackId: '',
    },
  };
})(typeof window !== 'undefined' ? window : this);
