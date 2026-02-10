(function (global) {
  'use strict';

  var cachedCannonList = null;

  function getConfig(opts) {
    if (opts && opts.config) return opts.config;
    return global.TankSprites && global.TankSprites.config ? global.TankSprites.config : null;
  }

  function clampLevel(level) {
    var lvl = Math.floor(level || 1);
    if (!Number.isFinite(lvl)) return 1;
    return Math.max(1, Math.min(60, lvl));
  }

  function hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  function findLevelValue(levels, level, key) {
    if (!Array.isArray(levels)) return null;
    var idx = Math.min(levels.length, level) - 1;
    for (var i = idx; i >= 0; i--) {
      var entry = levels[i];
      if (entry && hasOwn(entry, key)) return entry[key];
    }
    return null;
  }

  function resolveDefaultVariant(variants, rawDefault) {
    if (rawDefault == null) return variants && variants.length ? variants[0] : null;
    if (typeof rawDefault === 'number') {
      return variants && variants[rawDefault] != null ? variants[rawDefault] : (variants ? variants[0] : null);
    }
    return rawDefault;
  }

  function pickVariant(raw) {
    if (raw == null) return null;
    if (Array.isArray(raw)) return raw.length ? raw[0] : null;
    if (typeof raw === 'object') {
      var variants = Array.isArray(raw.variants) ? raw.variants : null;
      var def = resolveDefaultVariant(variants, raw.default);
      if (raw.flag && global.Game && global.Game.Flags && typeof global.Game.Flags.get === 'function') {
        if (global.Game.Flags.get(raw.flag)) {
          if (raw.variantOn != null) return raw.variantOn;
          if (raw.on != null) return raw.on;
          if (variants && variants.length > 1) return variants[1];
        }
      }
      if (raw.defaultIndex != null && variants && variants[raw.defaultIndex] != null) return variants[raw.defaultIndex];
      return def;
    }
    return raw;
  }

  function getSortedCannons(cfg) {
    if (cachedCannonList && cachedCannonList._ref === cfg?.cannons) return cachedCannonList.list;
    var list = (cfg && Array.isArray(cfg.cannons)) ? cfg.cannons.slice() : [];
    list.sort(function (a, b) { return (a?.minLevel ?? 0) - (b?.minLevel ?? 0); });
    cachedCannonList = { list: list, _ref: cfg ? cfg.cannons : null };
    return list;
  }

  function resolveBody(cfg, variant) {
    var bodies = cfg && cfg.bodies ? cfg.bodies : null;
    if (variant && bodies && bodies[variant]) return { variant: variant, cfg: bodies[variant] };
    if (cfg && cfg.body) return { variant: null, cfg: cfg.body };
    return { variant: null, cfg: null };
  }

  function resolveCannon(cfg, variant, level) {
    var cannons = cfg && Array.isArray(cfg.cannons) ? cfg.cannons : [];
    var chosen = null;
    if (variant) {
      for (var i = 0; i < cannons.length; i++) {
        if (cannons[i] && cannons[i].id === variant) {
          chosen = cannons[i];
          break;
        }
      }
    }
    if (!chosen) {
      var sorted = getSortedCannons(cfg);
      for (var j = 0; j < sorted.length; j++) {
        if ((sorted[j].minLevel ?? 0) <= level) chosen = sorted[j];
      }
      if (!chosen && sorted.length) chosen = sorted[0];
    }
    return { variant: chosen ? chosen.id : null, cfg: chosen || null };
  }

  function resolveAura(cfg, variant) {
    if (variant == null) return { variant: null, cfg: null, band: null };
    if (typeof variant === 'number') {
      if (variant >= 1 && variant <= 6) return { variant: variant, cfg: null, band: variant };
      return { variant: null, cfg: null, band: null };
    }
    if (typeof variant === 'string') {
      var auraCfg = cfg && cfg.auras ? cfg.auras[variant] : null;
      if (auraCfg) return { variant: variant, cfg: auraCfg, band: null };
      return { variant: null, cfg: null, band: null };
    }
    return { variant: null, cfg: null, band: null };
  }

  function resolveImage(cfg) {
    if (!cfg || !cfg.src) return null;
    var cache = global.TankSprites && global.TankSprites.cache;
    if (!cache || typeof cache.get !== 'function') return null;
    return cache.get('assets/' + cfg.src) || null;
  }

  function getTankVisualSpec(level, opts) {
    var cfg = getConfig(opts);
    var lvl = clampLevel(level);
    if (!cfg) {
      return {
        level: lvl,
        bodyVariant: null,
        cannonVariant: null,
        auraVariant: null,
        auraBand: null,
        bulletVariant: null,
        impactVfxVariant: null,
        body: null,
        cannon: null,
        aura: null
      };
    }

    var levels = cfg.levels || [];
    var bodyRaw = pickVariant(findLevelValue(levels, lvl, 'bodyVariant'));
    var cannonRaw = pickVariant(findLevelValue(levels, lvl, 'cannonVariant'));
    var auraRaw = pickVariant(findLevelValue(levels, lvl, 'auraVariant'));
    var bulletRaw = pickVariant(findLevelValue(levels, lvl, 'bulletVariant'));
    var impactRaw = pickVariant(findLevelValue(levels, lvl, 'impactVfxVariant'));

    var body = resolveBody(cfg, bodyRaw);
    var cannon = resolveCannon(cfg, cannonRaw, lvl);
    var aura = resolveAura(cfg, auraRaw);

    return {
      level: lvl,
      bodyVariant: body.variant,
      cannonVariant: cannon.variant,
      auraVariant: aura.variant,
      auraBand: aura.band,
      bulletVariant: bulletRaw || null,
      impactVfxVariant: impactRaw || null,
      body: body.cfg ? { cfg: body.cfg, img: resolveImage(body.cfg) } : null,
      cannon: cannon.cfg ? { cfg: cannon.cfg, img: resolveImage(cannon.cfg) } : null,
      aura: aura.cfg ? { cfg: aura.cfg, img: resolveImage(aura.cfg) } : null
    };
  }

  global.Game = global.Game || {};
  global.Game.TankConfig = {
    getTankVisualSpec: getTankVisualSpec,
    _pickVariant: pickVariant
  };
})(typeof window !== 'undefined' ? window : this);
