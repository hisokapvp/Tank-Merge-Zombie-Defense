(function (global) {
  'use strict';

  function loadImage(url) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = reject;
      img.src = url;
    });
  }

  function createSpriteLoaders(options) {
    var opts = options || {};
    var BAL = opts.BAL || {};
    var getState = typeof opts.getState === 'function' ? opts.getState : function () { return null; };

    var ZombieSprites = {
      ready: false,
      error: '',
      atlasImg: null,
      types: [],
      deathCommon: null,
      spawnConfig: null,
      load: async function () {
        try {
          var res = await fetch('assets/zombies.json', { cache: 'no-store' });
          if (!res.ok) throw new Error('HTTP ' + res.status);
          var data = await res.json();
          var atlasPath = 'assets/' + (data.atlas || 'zombie_atlas.png');
          var img = await loadImage(atlasPath);

          if (data.deathCommon) {
            this.deathCommon = {
              x: data.deathCommon.x != null ? data.deathCommon.x : 0,
              y: data.deathCommon.y != null ? data.deathCommon.y : 0,
              w: data.deathCommon.w != null ? data.deathCommon.w : 96,
              h: data.deathCommon.h != null ? data.deathCommon.h : 96,
              frames: data.deathCommon.frames != null ? data.deathCommon.frames : 1,
            };
          } else {
            this.deathCommon = null;
          }

          if (data.spawn && typeof data.spawn === 'object') {
            this.spawnConfig = {
              targetAlive: Number(data.spawn.targetAlive),
              sideCount: Number(data.spawn.sideCount),
              perSideTarget: Number(data.spawn.perSideTarget),
              perSideTolerance: Number(data.spawn.perSideTolerance),
            };
          } else {
            this.spawnConfig = null;
          }

          this.types = (data.types || []).map(function (t) {
            return {
              id: t.id || 'zombie',
              frame: t.frame || { x: 0, y: 0, w: 64, h: 64 },
              frames: t.frames != null ? t.frames : 1,
              animSpeed: t.animSpeed != null ? t.animSpeed : 1.0,
              anchor: t.anchor || { x: 0.5, y: 0.75 },
              scale: t.scale != null ? t.scale : 1.0,
              rotation: t.rotation != null ? t.rotation : 0,
              hpMul: t.hpMul != null ? t.hpMul : 1.0,
              omegaMul: t.omegaMul != null ? t.omegaMul : 1.0,
              rewardMul: t.rewardMul != null ? t.rewardMul : 1.0,
              weight: t.weight != null ? t.weight : 1.0,
              hitbox: t.hitbox != null ? t.hitbox : null,
              death: t.death ? {
                x: t.death.x != null ? t.death.x : 0,
                y: t.death.y != null ? t.death.y : 0,
                w: t.death.w != null ? t.death.w : ((t.frame && t.frame.w) != null ? t.frame.w : 96),
                h: t.death.h != null ? t.death.h : ((t.frame && t.frame.h) != null ? t.frame.h : 96),
                frames: t.death.frames != null ? t.death.frames : 1,
              } : null,
              attack: t.attack ? {
                x: t.attack.x != null ? t.attack.x : ((t.frame && t.frame.x) != null ? t.frame.x : 0),
                y: t.attack.y != null ? t.attack.y : ((t.frame && t.frame.y) != null ? t.frame.y : 0),
                w: t.attack.w != null ? t.attack.w : ((t.frame && t.frame.w) != null ? t.frame.w : 96),
                h: t.attack.h != null ? t.attack.h : ((t.frame && t.frame.h) != null ? t.frame.h : 96),
                frames: t.attack.frames != null ? t.attack.frames : (t.frames != null ? t.frames : 1),
              } : null,
            };
          });

          if (!this.types.length) throw new Error('types[] empty');

          this.atlasImg = img;
          this.ready = true;
          this.error = '';
        } catch (e) {
          this.ready = false;
          this.atlasImg = null;
          this.types = [];
          this.deathCommon = null;
          this.spawnConfig = null;
          this.error = String(e);
        }
      },
      pickType: function () {
        if (!this.ready || !this.types.length) return null;
        var sum = 0;
        for (var i = 0; i < this.types.length; i++) sum += this.types[i].weight;
        var r = Math.random() * sum;
        for (var j = 0; j < this.types.length; j++) {
          r -= this.types[j].weight;
          if (r <= 0) return this.types[j];
        }
        return this.types[this.types.length - 1];
      },
      pickTypeByLevel: function (level) {
        if (!this.ready || !this.types.length) return null;
        var lvl = Math.max(1, Math.min(60, Math.floor(level)));
        var id = 'zombie_lvl' + lvl;
        var found = this.types.find(function (t) { return t.id === id; });
        if (found) return found;
        var idx = (lvl - 1) % this.types.length;
        return this.types[idx] || this.types[0];
      },
    };

    var TankSprites = {
      ready: false,
      error: '',
      config: null,
      cache: new Map(),
      load: async function () {
        try {
          var res = await fetch('assets/tanks.json', { cache: 'no-store' });
          if (!res.ok) throw new Error('HTTP ' + res.status);
          var cfg = await res.json();
          this.config = cfg;

          var srcs = new Set();
          if (cfg && cfg.body && cfg.body.src) srcs.add('assets/' + cfg.body.src);
          var bodyKeys = Object.keys((cfg && cfg.bodies) || {});
          for (var i = 0; i < bodyKeys.length; i++) {
            var b = cfg.bodies[bodyKeys[i]];
            if (b && b.src) srcs.add('assets/' + b.src);
          }
          var cannons = (cfg && cfg.cannons) || [];
          for (var j = 0; j < cannons.length; j++) {
            var cannon = cannons[j];
            if (cannon && cannon.src) srcs.add('assets/' + cannon.src);
          }
          var auraKeys = Object.keys((cfg && cfg.auras) || {});
          for (var k = 0; k < auraKeys.length; k++) {
            var a = cfg.auras[auraKeys[k]];
            if (a && typeof a === 'object' && a.src) srcs.add('assets/' + a.src);
          }

          for (var s of srcs) {
            var img = await loadImage(s);
            this.cache.set(s, img);
          }

          this.ready = true;
          this.error = '';
        } catch (e) {
          this.ready = false;
          this.error = String(e);
          this.config = null;
          this.cache.clear();
        }
      },
      resolveVariant: function (level, key) {
        var levels = this.config && this.config.levels;
        if (!levels || !Array.isArray(levels)) return null;
        var lvl = Math.max(1, Math.min(60, Math.floor(level)));
        for (var l = lvl; l >= 1; l--) {
          var entry = levels[l - 1];
          if (entry && entry[key] != null) return entry[key];
        }
        return null;
      },
      pickBody: function (level) {
        if (!this.ready || !(this.config && this.config.body && this.config.body.src)) return null;
        var bodyVariant = level != null ? this.resolveVariant(level, 'bodyVariant') : null;
        var bodies = this.config && this.config.bodies;
        var cfg = (bodies && bodyVariant && bodies[bodyVariant]) ? bodies[bodyVariant] : this.config.body;
        if (!cfg || !cfg.src) return null;
        var full = 'assets/' + cfg.src;
        var img = this.cache.get(full);
        if (!img) return null;
        return { img: img, cfg: cfg };
      },
      pickCannon: function (level) {
        if (!this.ready || !(this.config && this.config.cannons && this.config.cannons.length)) return null;
        var cannonVariant = level != null ? this.resolveVariant(level, 'cannonVariant') : null;
        var cannons = this.config.cannons;
        var chosen = null;
        if (cannonVariant) {
          chosen = cannons.find(function (c) { return c.id === cannonVariant; });
          if (!chosen && typeof console !== 'undefined' && console.warn) console.warn('TankSprites: unknown cannonVariant', cannonVariant);
        }
        if (!chosen) {
          var sorted = cannons.slice().sort(function (a, b) { return a.minLevel - b.minLevel; });
          for (var i = 0; i < sorted.length; i++) {
            if (sorted[i].minLevel <= level) chosen = sorted[i];
          }
        }
        if (!chosen || !chosen.src) return null;
        var full = 'assets/' + chosen.src;
        var img = this.cache.get(full);
        if (!img) return null;
        return { img: img, cfg: chosen };
      },
      pickAura: function (level) {
        if (!this.ready) return null;
        var auraVariant = level != null ? this.resolveVariant(level, 'auraVariant') : null;
        if (auraVariant == null || typeof auraVariant !== 'string') return null;
        var auras = this.config && this.config.auras;
        var cfg = auras ? auras[auraVariant] : null;
        if (!cfg || !cfg.src) return null;
        var full = 'assets/' + cfg.src;
        var img = this.cache.get(full);
        if (!img) return null;
        return { img: img, cfg: cfg };
      },
    };

    var FenceSprites = {
      ready: false,
      error: '',
      atlasImg: null,
      maxFrameScale: 1,
      cornerInsetPx: null,
      framesById: new Map(),
      load: async function () {
        try {
          var res = await fetch('assets/fence.json', { cache: 'no-store' });
          if (!res.ok) throw new Error('HTTP ' + res.status);
          var data = await res.json();
          this.cornerInsetPx = Number.isFinite(data.cornerInsetPx) ? data.cornerInsetPx : null;
          var atlasPath = 'assets/' + (data.atlas || 'fence.png');
          var img = await loadImage(atlasPath);
          this.atlasImg = img;
          this.framesById.clear();
          this.maxFrameScale = 1;
          var autoIds = [];
          var frames = data.frames || [];
          for (var i = 0; i < frames.length; i++) {
            var f = frames[i];
            var id = f.id || String(this.framesById.size);
            var frameScale = Number.isFinite(f.scale) ? f.scale : 1;
            var rotation = Number.isFinite(f.rotation) ? f.rotation : (Number.isFinite(f.rotationDeg) ? f.rotationDeg : 0);
            this.framesById.set(id, {
              x: f.x != null ? f.x : 0,
              y: f.y != null ? f.y : 0,
              w: f.w != null ? f.w : 32,
              h: f.h != null ? f.h : 32,
              scale: frameScale,
              rotationDeg: rotation,
              anchor: f.anchor || { x: 0.5, y: 0.5 },
            });
            if (Number.isFinite(frameScale)) this.maxFrameScale = Math.max(this.maxFrameScale, frameScale);
            autoIds.push(id);
          }

          if ((BAL.fenceSpriteIds || []).length === 0 && autoIds.length > 0) {
            BAL.fenceSpriteIds = autoIds;
            var state = getState();
            if (state && Array.isArray(state.fenceSegments)) {
              state.fenceSegments = [];
            }
          }

          this.ready = true;
          this.error = '';
        } catch (e) {
          this.ready = false;
          this.atlasImg = null;
          this.maxFrameScale = 1;
          this.cornerInsetPx = null;
          this.framesById.clear();
          this.error = String(e);
        }
      },
      pickFrame: function (spriteId) {
        return this.framesById.get(spriteId) || this.framesById.values().next().value;
      },
    };

    var DecorSprites = {
      ready: false,
      error: '',
      atlasImg: null,
      framesById: new Map(),
      config: null,
      load: async function () {
        try {
          var res = await fetch('assets/decor.json', { cache: 'no-store' });
          if (!res.ok) throw new Error('HTTP ' + res.status);
          var data = await res.json();
          var atlasPath = 'assets/' + (data.atlas || 'decor.png');
          var img = await loadImage(atlasPath);
          this.atlasImg = img;
          this.framesById.clear();
          var frames = data.frames || [];
          for (var i = 0; i < frames.length; i++) {
            var f = frames[i];
            var id = f.id || String(this.framesById.size);
            this.framesById.set(id, {
              x: f.x != null ? f.x : 0,
              y: f.y != null ? f.y : 0,
              w: f.w != null ? f.w : 24,
              h: f.h != null ? f.h : 24,
              anchor: f.anchor || { x: 0.5, y: 0.8 },
            });
          }

          var noSpawnZones = Array.isArray(data.noSpawnZones) ? data.noSpawnZones : [];
          var parsedZones = [];
          for (var j = 0; j < noSpawnZones.length; j++) {
            var z = noSpawnZones[j] || {};
            var type = typeof z.type === 'string' ? z.type.toLowerCase() : '';
            if (!type && Number.isFinite(z.r)) type = 'circle';
            if (!type && Number.isFinite(z.w) && Number.isFinite(z.h)) type = 'rect';
            if (type === 'circle') {
              if (!Number.isFinite(z.cx) || !Number.isFinite(z.cy) || !Number.isFinite(z.r) || z.r <= 0) continue;
              parsedZones.push({ type: 'circle', cx: z.cx, cy: z.cy, r: z.r });
              continue;
            }
            if (type === 'rect') {
              if (!Number.isFinite(z.x) || !Number.isFinite(z.y) || !Number.isFinite(z.w) || !Number.isFinite(z.h) || z.w <= 0 || z.h <= 0) continue;
              parsedZones.push({ type: 'rect', x: z.x, y: z.y, w: z.w, h: z.h });
            }
          }

          var idsFromConfig = Array.isArray(data.spriteIds) ? data.spriteIds.filter(function (id) {
            return typeof id === 'string' && id.length > 0;
          }) : [];
          var autoIds = Array.from(this.framesById.keys());
          var spriteIds = idsFromConfig.length ? idsFromConfig : autoIds;
          this.config = {
            count: Number.isFinite(data.count) ? Math.max(0, Math.floor(data.count)) : null,
            spriteIds: spriteIds,
            noSpawnZones: parsedZones,
          };

          this.ready = true;
          this.error = '';
        } catch (e) {
          this.ready = false;
          this.atlasImg = null;
          this.framesById.clear();
          this.config = null;
          this.error = String(e);
        }
      },
      pickFrame: function (spriteId) {
        return this.framesById.get(spriteId) || this.framesById.values().next().value;
      },
    };

    var GroundSprites = {
      ready: false,
      error: '',
      atlasImg: null,
      config: null,
      load: async function () {
        try {
          var res = await fetch('assets/ground.json', { cache: 'no-store' });
          if (!res.ok) throw new Error('HTTP ' + res.status);
          var data = await res.json();
          var atlasPath = 'assets/' + (data.atlas || 'ground_atlas.png');
          var img = await loadImage(atlasPath);

          var tile = data && data.tile ? data.tile : {};
          var tileW = Number.isFinite(tile.w) ? Math.max(1, Math.floor(tile.w)) : 16;
          var tileH = Number.isFinite(tile.h) ? Math.max(1, Math.floor(tile.h)) : 16;
          var mode = data && data.mode === 'manual' ? 'manual' : 'procedural';
          var fillMode = data && data.fillMode === 'stretch' ? 'stretch' : 'repeat';

          this.config = {
            atlas: data && data.atlas ? data.atlas : 'ground_atlas.png',
            tile: { w: tileW, h: tileH },
            mode: mode,
            fillMode: fillMode,
            manual: data && data.manual ? data.manual : { anchor: 'center', grid: [] },
            procedural: data && data.procedural ? data.procedural : { seed: '0', weights: [] },
            stamps: Array.isArray(data && data.stamps) ? data.stamps : [],
            pieces: Array.isArray(data && data.pieces) ? data.pieces : [],
          };

          this.atlasImg = img;
          this.ready = true;
          this.error = '';
        } catch (e) {
          this.ready = false;
          this.atlasImg = null;
          this.config = null;
          this.error = String(e);
        }
      },
    };

    return {
      loadImage: loadImage,
      ZombieSprites: ZombieSprites,
      TankSprites: TankSprites,
      FenceSprites: FenceSprites,
      DecorSprites: DecorSprites,
      GroundSprites: GroundSprites,
    };
  }

  global.Game = global.Game || {};
  global.Game.SpriteLoaders = {
    createSpriteLoaders: createSpriteLoaders,
    loadImage: loadImage,
  };
})(typeof window !== 'undefined' ? window : this);
