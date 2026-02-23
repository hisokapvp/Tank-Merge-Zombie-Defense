(function (global) {
  'use strict';

  var root = global.Game = global.Game || {};
  var config = root.Config = root.Config || {};

  config.LayoutTuning = {
    trackToHangarGapPx: 0,
    trackToFenceGapPx: 30,
    supercomputerOffsetY: 64,
    /** Ширина/высота иконки оружия в UI (суперкомпьютер, модалки). */
    weaponIconW: 64,
    weaponIconH: 64,
    zombieFenceOffsetPxBySide: {
      top: 20,
      right: 10,
      bottom: 0,
      left: 10,
    },
  };
})(typeof window !== 'undefined' ? window : this);
