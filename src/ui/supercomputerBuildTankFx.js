(function (global) {
  'use strict';

  var activeTimeoutId = 0;
  var DEFAULT_DURATION_SEC = 1.5;

  function resolveRuntimeSetter() {
    var game = global.Game || {};
    if (typeof game.setSupercomputerWantsBuildTank === 'function') return game.setSupercomputerWantsBuildTank;
    if (game.SupercomputerRuntime && typeof game.SupercomputerRuntime.setWantsBuildTank === 'function') {
      return game.SupercomputerRuntime.setWantsBuildTank;
    }
    return null;
  }

  function clearActiveTimeout() {
    if (!activeTimeoutId) return;
    global.clearTimeout(activeTimeoutId);
    activeTimeoutId = 0;
  }

  function resolveDurationSec(durationSec) {
    if (Number.isFinite(durationSec) && durationSec > 0) return durationSec;
    var raw = Number(global.TankSprites && global.TankSprites.config ? global.TankSprites.config.tankPrintDurationSec : NaN);
    if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_DURATION_SEC;
    return raw;
  }

  function setActive(nextActive) {
    var setter = resolveRuntimeSetter();
    if (!setter) return false;
    setter(!!nextActive);
    return true;
  }

  function stop() {
    clearActiveTimeout();
    setActive(false);
  }

  function start(durationSec) {
    var durationMs = Math.round(resolveDurationSec(durationSec) * 1000);
    clearActiveTimeout();
    if (!setActive(true)) return false;
    if (durationMs <= 0) {
      setActive(false);
      return true;
    }
    activeTimeoutId = global.setTimeout(function () {
      activeTimeoutId = 0;
      setActive(false);
    }, durationMs);
    return true;
  }

  global.Game = global.Game || {};
  global.Game.SupercomputerBuildTankFx = {
    start: start,
    stop: stop,
  };
})(typeof window !== 'undefined' ? window : this);