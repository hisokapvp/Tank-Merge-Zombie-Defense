/**
 * ObjectPool — minimal pool helper for high-churn objects.
 */
(function (global) {
  'use strict';

  function createPool(options) {
    var opts = options || {};
    var maxSize = Math.max(0, opts.max || 0);
    var create = typeof opts.create === 'function' ? opts.create : function () { return {}; };
    var reset = typeof opts.reset === 'function' ? opts.reset : function () {};
    var items = [];
    var totalCreated = 0;

    function acquire() {
      var item = items.pop();
      if (item) return item;
      totalCreated += 1;
      return create();
    }

    function release(item) {
      if (!item) return;
      reset(item);
      if (items.length < maxSize) items.push(item);
    }

    function stats() {
      return {
        size: items.length,
        maxSize: maxSize,
        totalCreated: totalCreated
      };
    }

    return {
      acquire: acquire,
      release: release,
      stats: stats
    };
  }

  global.Game = global.Game || {};
  global.Game.ObjectPool = {
    create: createPool
  };
})(typeof window !== 'undefined' ? window : this);
