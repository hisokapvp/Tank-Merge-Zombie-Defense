(function (global) {
  'use strict';

  function toSeedInt(seed) {
    if (typeof seed === 'number' && Number.isFinite(seed)) return (seed | 0) >>> 0;
    var str = String(seed == null ? '' : seed);
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function hash2(seed, x, y) {
    var h = toSeedInt(seed);
    h ^= Math.imul((x | 0) ^ 0x9e3779b9, 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 16), 0xc2b2ae35) >>> 0;
    h ^= Math.imul((y | 0) ^ 0x7f4a7c15, 0x27d4eb2d);
    h = Math.imul(h ^ (h >>> 16), 0x165667b1) >>> 0;
    h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }

  function sanitizeWeight(v) {
    return Number.isFinite(v) && v > 0 ? v : 0;
  }

  function pickWeighted(weights, r) {
    var list = Array.isArray(weights) ? weights : [];
    var total = 0;
    var i;
    for (i = 0; i < list.length; i++) {
      total += sanitizeWeight(list[i] && list[i].weight);
    }
    if (total <= 0) return null;

    var rr = Number.isFinite(r) ? r : 0;
    if (rr < 0) rr = 0;
    if (rr >= 1) rr = 0.999999999;
    var target = rr * total;

    for (i = 0; i < list.length; i++) {
      target -= sanitizeWeight(list[i] && list[i].weight);
      if (target <= 0) return list[i];
    }
    return list[list.length - 1];
  }

  function normalizeTileEntry(raw) {
    if (!raw || !raw.frame) return null;
    var col = Number(raw.frame.col);
    var row = Number(raw.frame.row);
    if (!Number.isFinite(col) || !Number.isFinite(row)) return null;
    return {
      frame: { col: Math.max(0, Math.floor(col)), row: Math.max(0, Math.floor(row)) },
      rotationDeg: Number.isFinite(raw.rotationDeg) ? raw.rotationDeg : 0,
      scale: Number.isFinite(raw.scale) && raw.scale > 0 ? raw.scale : 1,
    };
  }

  function getTileAt(cfg, tileX, tileY) {
    var mode = cfg && cfg.mode === 'manual' ? 'manual' : 'procedural';
    var tx = tileX | 0;
    var ty = tileY | 0;

    if (mode === 'manual') {
      var manual = (cfg && cfg.manual) || {};
      var grid = Array.isArray(manual.grid) ? manual.grid : [];
      var rows = grid.length;
      if (!rows) return null;
      var cols = Array.isArray(grid[0]) ? grid[0].length : 0;
      if (!cols) return null;

      var gx = tx + Math.floor(cols / 2);
      var gy = ty + Math.floor(rows / 2);
      if (gy < 0 || gy >= rows) return null;
      var row = Array.isArray(grid[gy]) ? grid[gy] : null;
      if (!row || gx < 0 || gx >= row.length) return null;
      return normalizeTileEntry(row[gx]);
    }

    var procedural = (cfg && cfg.procedural) || {};
    var picked = pickWeighted(procedural.weights || [], hash2(procedural.seed, tx, ty));
    return normalizeTileEntry(picked);
  }

  global.Game = global.Game || {};
  global.Game.GroundGen = {
    hash2: hash2,
    pickWeighted: pickWeighted,
    getTileAt: getTileAt,
  };
})(typeof window !== 'undefined' ? window : this);