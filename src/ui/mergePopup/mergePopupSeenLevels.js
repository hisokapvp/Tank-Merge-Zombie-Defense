(function (global) {
  'use strict';

  function load(storageKey) {
    try {
      var raw = global.localStorage && global.localStorage.getItem(storageKey);
      if (!raw) return {};
      var data = JSON.parse(raw);
      return typeof data === 'object' && data !== null ? data : {};
    } catch (_) {
      return {};
    }
  }

  function save(storageKey, seenLevels) {
    try {
      if (global.localStorage) {
        global.localStorage.setItem(storageKey, JSON.stringify(seenLevels || {}));
      }
    } catch (_) {}
  }

  function reset(storageKey) {
    try {
      if (global.localStorage) {
        global.localStorage.removeItem(storageKey);
      }
    } catch (_) {}
  }

  global.Game = global.Game || {};
  global.Game.MergePopupSeenLevels = {
    load: load,
    save: save,
    reset: reset,
  };
})(typeof window !== 'undefined' ? window : this);
