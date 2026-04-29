/**
 * MobileMode — auto detection + overrides for fps/FX.
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'mobile_mode_settings_v1';

  var settings = {
    mode: 'auto',
    fpsCap: 30,
    fxLevel: 1,
    fxScale: 0.65,
  };

  var autoDetected = false;

  function safeParse(raw, fb) {
    try { return raw ? JSON.parse(raw) : fb; }
    catch (_) { return fb; }
  }

  function detectMobile() {
    var ua = String(global.navigator && global.navigator.userAgent || '');
    var touch = ('ontouchstart' in global) || (global.navigator && global.navigator.maxTouchPoints > 0);
    var smallScreen = Math.min(global.innerWidth || 0, global.innerHeight || 0) <= 820;
    return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (touch && smallScreen);
  }

  function load() {
    try {
      var raw = global.localStorage && global.localStorage.getItem(STORAGE_KEY);
      var data = safeParse(raw, null);
      if (data && typeof data === 'object') {
        if (data.mode) settings.mode = data.mode;
        if (Number.isFinite(data.fpsCap)) settings.fpsCap = data.fpsCap;
        if (Number.isFinite(data.fxLevel)) settings.fxLevel = data.fxLevel;
        if (Number.isFinite(data.fxScale)) settings.fxScale = data.fxScale;
      }
    } catch (_) {}
  }

  function save() {
    try {
      if (global.localStorage) global.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (_) {}
  }

  function flagOverride() {
    if (!global.Game || !global.Game.Flags || typeof global.Game.Flags.list !== 'function') return null;
    var list = global.Game.Flags.list();
    var flag = list.find(function (f) { return f.name === 'mobileMode'; });
    if (flag && flag.override != null) return flag.override;
    if (global.Game.Flags.get && global.Game.Flags.get('mobileMode')) return true;
    return null;
  }

  function flagFxLevel() {
    if (!global.Game || !global.Game.Flags || typeof global.Game.Flags.get !== 'function') return null;
    if (global.Game.Flags.get('mobileFxLite')) return 1;
    if (global.Game.Flags.get('mobileFxUltraLite')) return 2;
    return null;
  }

  function init() {
    load();
    autoDetected = detectMobile();
    if (global.addEventListener) {
      global.addEventListener('resize', function () {
        autoDetected = detectMobile();
      });
    }
  }

  function isEnabled() {
    var forced = flagOverride();
    if (forced != null) return !!forced;
    if (settings.mode === 'on') return true;
    if (settings.mode === 'off') return false;
    return !!autoDetected;
  }

  function getFpsCap() {
    if (!isEnabled()) return 0;
    return Math.max(0, Number(settings.fpsCap) || 0);
  }

  function getFxLevel() {
    if (!isEnabled()) return 0;
    var flagLevel = flagFxLevel();
    if (flagLevel != null) return flagLevel;
    return Math.max(0, Math.min(2, Number(settings.fxLevel) || 0));
  }

  function getFxScale() {
    if (!isEnabled()) return 1;
    return Math.max(0.2, Math.min(1, Number(settings.fxScale) || 1));
  }

  function setMode(mode) {
    settings.mode = mode === 'on' || mode === 'off' ? mode : 'auto';
    save();
  }

  function setFpsCap(cap) {
    settings.fpsCap = Math.max(0, Math.round(Number(cap) || 0));
    save();
  }

  function setFxLevel(level) {
    settings.fxLevel = Math.max(0, Math.min(2, Math.round(Number(level) || 0)));
    save();
  }

  function setFxScale(scale) {
    settings.fxScale = Math.max(0.2, Math.min(1, Number(scale) || 1));
    save();
  }

  global.Game = global.Game || {};
  global.Game.MobileMode = {
    init: init,
    isEnabled: isEnabled,
    getFpsCap: getFpsCap,
    getFxLevel: getFxLevel,
    getFxScale: getFxScale,
    setMode: setMode,
    setFpsCap: setFpsCap,
    setFxLevel: setFxLevel,
    setFxScale: setFxScale,
    _STORAGE_KEY: STORAGE_KEY,
  };

})(typeof window !== 'undefined' ? window : this);
