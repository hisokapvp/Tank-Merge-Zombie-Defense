/**
 * Targeting helpers for multi-shot and projectile aim updates.
 */
(function (global) {
  'use strict';

  function pickBurstTargets(candidates, count) {
    var list = Array.isArray(candidates) ? candidates : [];
    var total = list.length;
    var n = Math.max(0, Math.floor(count || 0));
    var result = [];
    if (!total || !n) return result;
    for (var i = 0; i < n; i++) {
      result.push(list[i % total]);
    }
    return result;
  }

  function pickBurstTargetsBySide(candidates, count, opts) {
    var list = Array.isArray(candidates) ? candidates : [];
    var total = list.length;
    var n = Math.max(0, Math.floor(count || 0));
    if (!total || !n) return [];
    if (n === 1) return [list[0]];

    var heading = opts && Number.isFinite(opts.heading) ? opts.heading : null;
    var getPos = opts && typeof opts.getPos === 'function' ? opts.getPos : null;
    if (!getPos || !Number.isFinite(heading)) return pickBurstTargets(list, n);

    var sx = opts && Number.isFinite(opts.sx) ? opts.sx : 0;
    var sy = opts && Number.isFinite(opts.sy) ? opts.sy : 0;
    var fwdX = Math.cos(heading);
    var fwdY = Math.sin(heading);
    var perpX = -fwdY;
    var perpY = fwdX;

    var scored = [];
    for (var i = 0; i < list.length; i++) {
      var t = list[i];
      var p = getPos(t);
      if (!p) continue;
      var dx = p.x - sx;
      var dy = p.y - sy;
      var forward = dx * fwdX + dy * fwdY;
      var side = dx * perpX + dy * perpY;
      scored.push({ t: t, forward: forward, side: side, absSide: Math.abs(side) });
    }

    if (!scored.length) return pickBurstTargets(list, n);

    function pickBest(filterFn) {
      var best = null;
      for (var j = 0; j < scored.length; j++) {
        var s = scored[j];
        if (!filterFn(s)) continue;
        if (!best) {
          best = s;
          continue;
        }
        if (s.forward > best.forward || (s.forward === best.forward && s.absSide < best.absSide)) {
          best = s;
        }
      }
      return best ? best.t : null;
    }

    function pickCenter() {
      var best = null;
      for (var k = 0; k < scored.length; k++) {
        var s = scored[k];
        if (!best) {
          best = s;
          continue;
        }
        if (s.absSide < best.absSide || (s.absSide === best.absSide && s.forward > best.forward)) {
          best = s;
        }
      }
      return best ? best.t : null;
    }

    var left = pickBest(function (s) { return s.side < 0; });
    var right = pickBest(function (s) { return s.side > 0; });
    var center = pickCenter();

    var ordered = n >= 3 ? [left, center, right] : [left, right];
    var result = [];
    var allowDup = total < n;

    for (var m = 0; m < ordered.length && result.length < n; m++) {
      var cand = ordered[m];
      if (!cand) continue;
      if (!allowDup && result.indexOf(cand) !== -1) continue;
      result.push(cand);
    }

    if (result.length < n) {
      var fill = pickBurstTargets(list, n);
      for (var f = 0; f < fill.length && result.length < n; f++) {
        var tfill = fill[f];
        if (!allowDup && result.indexOf(tfill) !== -1) continue;
        result.push(tfill);
      }
    }

    return result;
  }

  function updateProjectileAim(projectile, target, getPos) {
    if (!projectile) return;
    if (!target || target.state === 'dying') {
      if (target && target.state === 'dying') projectile.toZombieId = null;
      return;
    }
    if (typeof getPos !== 'function') return;
    var p = getPos(target);
    if (!p) return;
    projectile.toX = p.x;
    projectile.toY = p.y;
  }

  global.Game = global.Game || {};
  global.Game.Targeting = {
    pickBurstTargets: pickBurstTargets,
    pickBurstTargetsBySide: pickBurstTargetsBySide,
    updateProjectileAim: updateProjectileAim,
  };
})(typeof window !== 'undefined' ? window : this);
