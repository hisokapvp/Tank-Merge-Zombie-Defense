(function (global) {
  'use strict';

  var root = global.Game = global.Game || {};
  var config = root.Config = root.Config || {};

  config.CriticalModalTuning = {
    charsPerSec: 20,
    linePauseMs: 200,
    afterFinishPauseMs: 0,
  };
})(typeof window !== 'undefined' ? window : this);
