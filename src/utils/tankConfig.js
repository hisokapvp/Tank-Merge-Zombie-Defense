(function (global) {
  'use strict';

  function clampLevel(level) {
    var lvl = Math.floor(level || 1);
    if (!Number.isFinite(lvl)) return 1;
    return Math.max(1, lvl);
  }

  function getTank(level, opts) {
    if (opts && typeof opts.getTank === 'function') return opts.getTank(level);
    if (global.TankSprites && typeof global.TankSprites.getTank === 'function') {
      return global.TankSprites.getTank(level);
    }
    return null;
  }

  function resolveImage(cfg) {
    if (!cfg || !cfg.src) return null;
    var cache = global.TankSprites && global.TankSprites.cache;
    if (!cache || typeof cache.get !== 'function') return null;
    return cache.get('assets/' + cfg.src) || null;
  }

  function getTankVisualSpec(level, opts) {
    var lvl = clampLevel(level);
    var tank = getTank(lvl, opts);
    if (!tank) {
      return {
        level: lvl,
        bulletId: 'bullet_base',
        bulletLevel: 1,
        body: null,
        cannon: null,
        aura: null
      };
    }

    return {
      level: lvl,
      bulletId: typeof tank.bulletId === 'string' && tank.bulletId.length ? tank.bulletId : 'bullet_base',
      bulletLevel: Number.isFinite(tank.bulletLevel) ? Math.max(1, Math.floor(tank.bulletLevel)) : 1,
      body: tank.body ? { cfg: tank.body, img: resolveImage(tank.body) } : null,
      cannon: tank.cannon ? { cfg: tank.cannon, img: resolveImage(tank.cannon) } : null,
      aura: tank.aura ? { cfg: tank.aura, img: resolveImage(tank.aura) } : null
    };
  }

  global.Game = global.Game || {};
  global.Game.TankConfig = {
    getTankVisualSpec: getTankVisualSpec
  };
})(typeof window !== 'undefined' ? window : this);
