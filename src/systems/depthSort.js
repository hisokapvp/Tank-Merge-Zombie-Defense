(function (global) {
  'use strict';

  function sortDecorAndZombies(items) {
    var list = Array.isArray(items) ? items.slice() : [];
    list.sort(function (a, b) {
      var ay = Number.isFinite(a && a.y) ? a.y : 0;
      var by = Number.isFinite(b && b.y) ? b.y : 0;
      if (ay !== by) return ay - by;

      var ao = Number.isFinite(a && a.order) ? a.order : 0;
      var bo = Number.isFinite(b && b.order) ? b.order : 0;
      if (ao !== bo) return ao - bo;

      var ak = a && a.kind ? String(a.kind) : '';
      var bk = b && b.kind ? String(b.kind) : '';
      if (ak !== bk) return ak < bk ? -1 : 1;

      var ai = a && a.id ? String(a.id) : '';
      var bi = b && b.id ? String(b.id) : '';
      if (ai !== bi) return ai < bi ? -1 : 1;

      return 0;
    });
    return list;
  }

  global.Game = global.Game || {};
  global.Game.DepthSort = {
    sortDecorAndZombies: sortDecorAndZombies,
  };
})(typeof window !== 'undefined' ? window : this);
