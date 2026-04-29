(function (global) {
  'use strict';

  global.Game = global.Game || {};
  global.Game.Config = global.Game.Config || {};

  global.Game.Config.AudioUi = {
    UI_SFX_VOLUME_MULT: 0.5,
    UI_HOVER_COOLDOWN_MS: 100,
    UI_DISABLED_CLICK_VOLUME_MULT: 1.0,
    TANK_DRIVE_VOLUME_MULT: 3,
  };
})(typeof window !== 'undefined' ? window : this);
