(function (global) {
  'use strict';

  function toSafeInt(value, fallback) {
    if (!Number.isFinite(value)) return fallback;
    var n = Math.floor(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function getZombieSpawnBalanceConfig(spawnConfig, bal, options) {
    var cfg = (spawnConfig && typeof spawnConfig === 'object') ? spawnConfig : null;
    var opts = (options && typeof options === 'object') ? options : null;
    var baseTargetAlive = Math.max(1, toSafeInt(cfg && cfg.targetAlive, bal.zombieCountTarget));
    var desiredAliveMult = Number.isFinite(opts && opts.desiredAliveMult) ? Math.max(0, opts.desiredAliveMult) : 1;
    var targetAlive = Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.round(baseTargetAlive * desiredAliveMult)));
    var sideCount = Math.max(1, toSafeInt(cfg && cfg.sideCount, bal.zombieSideCount || 4));
    var defaultPerSide = Math.max(1, Math.round(baseTargetAlive / sideCount));
    var perSideTarget = Math.max(1, toSafeInt(cfg && cfg.perSideTarget, bal.zombiePerSideTarget || defaultPerSide));
    var perSideTolerance = Math.max(0, toSafeInt(cfg && cfg.perSideTolerance, bal.zombiePerSideTolerance || 5));

    return {
      targetAlive: targetAlive,
      sideCount: sideCount,
      perSideTarget: perSideTarget,
      perSideMin: Math.max(0, perSideTarget - perSideTolerance),
      perSideMax: perSideTarget + perSideTolerance,
    };
  }

  function zombieSideForSlot(slotIndex, slotCount, sideCount) {
    var normalized = ((slotIndex % slotCount) + slotCount) % slotCount;
    var ratio = normalized / Math.max(1, slotCount);
    return Math.max(0, Math.min(sideCount - 1, Math.floor(ratio * sideCount)));
  }

  function pickMissingSlotBySide(missingBySide, aliveBySide, cfg) {
    var sideCount = cfg.sideCount;
    var bestSide = -1;
    var bestScore = -Infinity;

    for (var side = 0; side < sideCount; side++) {
      var slots = missingBySide[side];
      if (!slots || !slots.length) continue;
      var alive = aliveBySide[side] || 0;
      var score = cfg.perSideTarget - alive;
      if (alive < cfg.perSideMin) score += 1000;
      else if (alive > cfg.perSideMax) score -= 1000;
      if (score > bestScore) {
        bestScore = score;
        bestSide = side;
      }
    }

    if (bestSide >= 0) {
      return { slotIndex: missingBySide[bestSide].shift(), side: bestSide };
    }

    for (var i = 0; i < sideCount; i++) {
      var sideSlots = missingBySide[i];
      if (sideSlots && sideSlots.length) return { slotIndex: sideSlots.shift(), side: i };
    }

    return { slotIndex: null, side: null };
  }

  function zombieSlotTheta(slotIndex, slotCount) {
    var step = (Math.PI * 2) / Math.max(1, slotCount);
    var jitter = (Math.random() * 2 - 1) * step * 0.25;
    return slotIndex * step + jitter;
  }

  function assignZombieSlot(z, slotIndex, slotCount, zombieFenceLimit, bal) {
    var theta = zombieSlotTheta(slotIndex, slotCount);
    z.slotIndex = slotIndex;
    z.anchorTheta = theta;
    z.theta = theta;
    var fenceLimit = zombieFenceLimit(z);
    z.targetR = fenceLimit + (Math.random() * 2 - 1) * Math.min(4, bal.zombieTrackWidth * 0.2);
  }

  global.Game = global.Game || {};
  global.Game.ZombieSpawn = {
    toSafeInt: toSafeInt,
    getZombieSpawnBalanceConfig: getZombieSpawnBalanceConfig,
    zombieSideForSlot: zombieSideForSlot,
    pickMissingSlotBySide: pickMissingSlotBySide,
    zombieSlotTheta: zombieSlotTheta,
    assignZombieSlot: assignZombieSlot,
  };
})(typeof window !== 'undefined' ? window : this);
