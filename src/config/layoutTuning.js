(function (global) {
  'use strict';

  var root = global.Game = global.Game || {};
  var config = root.Config = root.Config || {};

  config.LayoutTuning = {
    trackToHangarGapPx: 0,
    trackToFenceGapPx: 25,
  };
})(typeof window !== 'undefined' ? window : this);
