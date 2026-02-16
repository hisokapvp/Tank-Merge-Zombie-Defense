(function (global) {
  'use strict';

  function hashStringToU32(value) {
    var str = String(value);
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function seedToU32(seed) {
    if (typeof seed === 'number' && Number.isFinite(seed)) return (Math.floor(seed) >>> 0);
    if (typeof seed === 'string') return hashStringToU32(seed);
    if (seed == null) return 0;
    return hashStringToU32(seed);
  }

  function makeRng(seed) {
    var state = seedToU32(seed);
    if (state === 0) state = 0x6d2b79f5;

    function nextU32() {
      state = (state + 0x6D2B79F5) >>> 0;
      var t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return (t ^ (t >>> 14)) >>> 0;
    }

    return {
      nextFloat01: function () {
        return nextU32() / 4294967296;
      },
      nextInt: function (min, max) {
        var lo = Number.isFinite(min) ? Math.floor(min) : 0;
        var hi = Number.isFinite(max) ? Math.floor(max) : lo;
        if (lo > hi) {
          var tmp = lo;
          lo = hi;
          hi = tmp;
        }
        var span = hi - lo + 1;
        if (span <= 1) return lo;
        return lo + Math.floor((nextU32() / 4294967296) * span);
      },
      shuffle: function (array) {
        if (!Array.isArray(array)) return array;
        for (var i = array.length - 1; i > 0; i--) {
          var j = Math.floor((nextU32() / 4294967296) * (i + 1));
          var tmp = array[i];
          array[i] = array[j];
          array[j] = tmp;
        }
        return array;
      },
    };
  }

  global.Game = global.Game || {};
  global.Game.SeededRng = {
    seedToU32: seedToU32,
    makeRng: makeRng,
  };
})(typeof window !== 'undefined' ? window : this);
