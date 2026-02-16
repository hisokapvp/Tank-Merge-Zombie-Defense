(function (global) {
  'use strict';

  var root = global.Game = global.Game || {};
  var config = root.Config = root.Config || {};

  config.LayoutTuning = {
    trackToHangarGapPx: 0,
    trackToFenceGapPx: 30,
    zombieFenceOffsetPxBySide: {
      top: 20,
      right: 10,
      bottom: 0,
      left: 10,
    },
  };
})(typeof window !== 'undefined' ? window : this);
