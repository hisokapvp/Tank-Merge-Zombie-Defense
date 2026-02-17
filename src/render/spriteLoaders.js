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

    function toPositiveNumber(value, fallback) {
      return Number.isFinite(value) && value > 0 ? value : fallback;
    }

    function clamp01(value, fallback) {
      if (!Number.isFinite(value)) return fallback;
      if (value <= 0) return 0;
      if (value >= 1) return 1;
      return value;
    }

    function normalizeAnimConfig(raw, fallbackFps) {
      var src = raw && typeof raw === 'object' ? raw : {};
      return {
        frameRateFps: toPositiveNumber(src.frameRateFps, fallbackFps),
      };
    }

    function normalizeAttackConfig(raw, fallback) {
      var src = raw && typeof raw === 'object' ? raw : {};
      return {
        attackRangePx: toPositiveNumber(src.attackRangePx, fallback.attackRangePx),
        attackCooldownSec: toPositiveNumber(src.attackCooldownSec, fallback.attackCooldownSec),
        attackHitAt: clamp01(src.attackHitAt, fallback.attackHitAt),
      };
    }

    function normalizeAnimationClip(raw, fallback) {
      var src = raw && typeof raw === 'object' ? raw : {};
      return {
        x: Number.isFinite(src.x) ? src.x : fallback.x,
        y: Number.isFinite(src.y) ? src.y : fallback.y,
        w: toPositiveNumber(src.w, fallback.w),
        h: toPositiveNumber(src.h, fallback.h),
        frames: Math.max(1, Math.floor(toPositiveNumber(src.frames, fallback.frames))),
        frameRateFps: toPositiveNumber(src.frameRateFps, fallback.frameRateFps),
        loop: src.loop !== false,
      };
    }

    function collectAnimationFrameIds(rawAnim, fallbackIds, frameMap, animationName) {
      var src = rawAnim && typeof rawAnim === 'object' ? rawAnim : {};
      var ids = Array.isArray(src.frames)
        ? src.frames.filter(function (frameId) { return typeof frameId === 'string' && frameMap.has(frameId); })
        : [];

      var frameCount = Number.isFinite(src.frames) ? Math.max(1, Math.floor(src.frames)) : 0;
      var hasRect = Number.isFinite(src.x) || Number.isFinite(src.y) || Number.isFinite(src.w) || Number.isFinite(src.h);
      if (!ids.length && frameCount > 0 && hasRect) {
        var fallbackFrame = fallbackIds && fallbackIds.length ? frameMap.get(fallbackIds[0]) : null;
        var frameW = toPositiveNumber(src.w, fallbackFrame ? fallbackFrame.w : 64);
        var frameH = toPositiveNumber(src.h, fallbackFrame ? fallbackFrame.h : 64);
        var baseX = Number.isFinite(src.x) ? src.x : (fallbackFrame ? fallbackFrame.x : 0);
        var baseY = Number.isFinite(src.y) ? src.y : (fallbackFrame ? fallbackFrame.y : 0);
        for (var i = 0; i < frameCount; i++) {
          var generatedId = '__' + animationName + '_' + i;
          frameMap.set(generatedId, {
            id: generatedId,
            x: baseX + i * frameW,
            y: baseY,
            w: frameW,
            h: frameH,
          });
          ids.push(generatedId);
        }
      }

      if (!ids.length && frameCount > 0 && fallbackIds && fallbackIds.length) {
        ids = fallbackIds.slice(0, Math.min(frameCount, fallbackIds.length));
      }
      if (!ids.length && fallbackIds && fallbackIds.length) ids = fallbackIds.slice();
      return ids;
    }

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

          var defaultAnimFps = {
            walk: 10,
            attack: 10,
            death: 10,
            deathCommon: 10,
          };
          var defaultAttackConfig = {
            attackRangePx: Math.max(6, Number.isFinite(BAL.fenceWidth) ? BAL.fenceWidth * 1.2 : 24),
            attackCooldownSec: 0.35,
            attackHitAt: 0.5,
          };

          if (data.deathCommon) {
            this.deathCommon = {
              x: data.deathCommon.x != null ? data.deathCommon.x : 0,
              y: data.deathCommon.y != null ? data.deathCommon.y : 0,
              w: data.deathCommon.w != null ? data.deathCommon.w : 96,
              h: data.deathCommon.h != null ? data.deathCommon.h : 96,
              frames: data.deathCommon.frames != null ? data.deathCommon.frames : 1,
              frameRateFps: toPositiveNumber(data.deathCommon.frameRateFps, defaultAnimFps.deathCommon),
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
            var animations = t && typeof t.animations === 'object' ? t.animations : null;
            var attackTuning = t && t.attack && typeof t.attack === 'object' ? t.attack : null;
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
              attackDamage: Number.isFinite(t.attackDamage) ? t.attackDamage : null,
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
              animations: {
                walk: normalizeAnimConfig(animations && animations.walk, defaultAnimFps.walk),
                attack: normalizeAnimConfig(animations && animations.attack, defaultAnimFps.attack),
                death: normalizeAnimConfig(animations && animations.death, defaultAnimFps.death),
                deathCommon: normalizeAnimConfig(animations && animations.deathCommon, defaultAnimFps.deathCommon),
              },
              attackConfig: normalizeAttackConfig(attackTuning, defaultAttackConfig),
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
      config: null,
      maxFrameScale: 1,
      cornerInsetPx: null,
      framesById: new Map(),
      load: async function () {
        try {
          var res = await fetch('assets/fence.json', { cache: 'no-store' });
          if (!res.ok) throw new Error('HTTP ' + res.status);
          var data = await res.json();
          this.config = data || null;
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
          this.config = null;
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
              scale: Number.isFinite(f.scale) && f.scale > 0 ? f.scale : 1,
              isWall: !!f.isWall,
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
          var wallIds = Array.isArray(data.wallSpriteIds)
            ? data.wallSpriteIds.filter(function (id) { return typeof id === 'string' && id.length > 0; })
            : [];
          if (!wallIds.length) {
            wallIds = autoIds.filter(function (id) {
              var frame = this.framesById.get(id);
              return !!(frame && frame.isWall);
            }, this);
          }
          this.config = {
            seed: (typeof data.seed === 'string' || Number.isFinite(data.seed)) ? data.seed : 'decor-default-seed',
            count: Number.isFinite(data.count) ? Math.max(0, Math.floor(data.count)) : null,
            spriteIds: spriteIds,
            wallSpriteIds: wallIds,
            noSpawnZones: parsedZones,
            placementMaxAttempts: Number.isFinite(data.placementMaxAttempts)
              ? Math.max(1, Math.floor(data.placementMaxAttempts))
              : 40,
            blockRadiusK: Number.isFinite(data.blockRadiusK) ? Math.max(0.1, data.blockRadiusK) : 0.35,
            blockRadiusMin: Number.isFinite(data.blockRadiusMin) ? Math.max(1, data.blockRadiusMin) : 8,
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
            seed: (data && (typeof data.seed === 'string' || Number.isFinite(data.seed))) ? data.seed : 'ground-stamps-seed',
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

    var SupercomputerSprites = {
      ready: false,
      error: '',
      atlasImg: null,
      config: null,
      load: async function () {
        try {
          var res = await fetch('assets/supercomputer.json', { cache: 'no-store' });
          if (!res.ok) throw new Error('HTTP ' + res.status);
          var data = await res.json();

          var atlasPath = 'assets/' + (data.atlas || 'decor.png');
          var img = await loadImage(atlasPath);
          var fallbackClip = {
            x: 0,
            y: 0,
            w: 96,
            h: 96,
            frames: 1,
            frameRateFps: 1,
            loop: true,
          };

          var animationsRaw = data && data.animations && typeof data.animations === 'object' ? data.animations : {};
          var idleClip = normalizeAnimationClip(animationsRaw.idle || animationsRaw.work, fallbackClip);
          var workClip = normalizeAnimationClip(animationsRaw.work || animationsRaw.idle, idleClip);

          var glitchRaw = data && data.glitch && typeof data.glitch === 'object' ? data.glitch : {};
          var minLoops = Number.isFinite(glitchRaw.minLoops) ? Math.max(1, Math.floor(glitchRaw.minLoops)) : 1;
          var maxLoops = Number.isFinite(glitchRaw.maxLoops) ? Math.max(minLoops, Math.floor(glitchRaw.maxLoops)) : minLoops;

          this.config = {
            atlas: data && data.atlas ? data.atlas : 'decor.png',
            offsetY: Number.isFinite(data && data.offsetY) ? data.offsetY : null,
            anchor: (data && data.anchor && typeof data.anchor === 'object')
              ? {
                  x: Number.isFinite(data.anchor.x) ? data.anchor.x : 0.5,
                  y: Number.isFinite(data.anchor.y) ? data.anchor.y : 0.75,
                }
              : { x: 0.5, y: 0.75 },
            renderScale: Number.isFinite(data && data.renderScale) ? Math.max(0.1, data.renderScale) : 1,
            hpBar: (data && data.hpBar && typeof data.hpBar === 'object')
              ? {
                  width: toPositiveNumber(data.hpBar.width, 92),
                  height: toPositiveNumber(data.hpBar.height, 8),
                  offsetY: Number.isFinite(data.hpBar.offsetY) ? data.hpBar.offsetY : -56,
                }
              : { width: 92, height: 8, offsetY: -56 },
            animations: {
              idle: idleClip,
              work: workClip,
              glitch: normalizeAnimationClip(animationsRaw.glitch, idleClip),
              buildTank: normalizeAnimationClip(animationsRaw.buildTank, idleClip),
              destroy: normalizeAnimationClip(animationsRaw.destroy, idleClip),
            },
            glitch: {
              chancePerSecond: Number.isFinite(glitchRaw.chancePerSecond) ? Math.max(0, glitchRaw.chancePerSecond) : 0,
              minLoops: minLoops,
              maxLoops: maxLoops,
              cooldownSec: Number.isFinite(glitchRaw.cooldownSec) ? Math.max(0, glitchRaw.cooldownSec) : 0,
            },
            stats: data && data.stats && typeof data.stats === 'object' ? data.stats : {},
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
      getAnimation: function (stateName) {
        if (!this.config || !this.config.animations) return null;
        return this.config.animations[stateName] || this.config.animations.idle || this.config.animations.work || null;
      },
    };

    var DronSprites = {
      ready: false,
      error: '',
      atlasImg: null,
      config: null,
      framesById: new Map(),
      load: async function () {
        try {
          var res = await fetch('assets/dron.json', { cache: 'no-store' });
          if (!res.ok) throw new Error('HTTP ' + res.status);
          var data = await res.json();

          var atlasName = data.atlas || data.png || 'decor_atlas.png';
          var atlasPath = 'assets/' + atlasName;
          var img = await loadImage(atlasPath);

          this.framesById.clear();
          var rawFrames = Array.isArray(data.frames) ? data.frames : [];
          for (var i = 0; i < rawFrames.length; i++) {
            var frame = rawFrames[i] || {};
            var id = typeof frame.id === 'string' && frame.id.length > 0 ? frame.id : String(i);
            this.framesById.set(id, {
              id: id,
              x: Number.isFinite(frame.x) ? frame.x : 0,
              y: Number.isFinite(frame.y) ? frame.y : 0,
              w: toPositiveNumber(frame.w, 64),
              h: toPositiveNumber(frame.h, 64),
            });
          }

          var idleFallback = Array.from(this.framesById.keys());
          var animationsRaw = data && data.animations && typeof data.animations === 'object' ? data.animations : {};

          function normalizeAnim(rawAnim, fallbackIds, map, animationName) {
            var src = rawAnim && typeof rawAnim === 'object' ? rawAnim : {};
            var ids = collectAnimationFrameIds(rawAnim, fallbackIds, map, 'dron_' + animationName);
            if (!ids.length) ids = fallbackIds.slice();
            if (!ids.length) return null;
            return {
              frames: ids,
              frameRateFps: toPositiveNumber(src.frameRateFps, 6),
              loop: src.loop !== false,
            };
          }

          var idleAnimRaw = animationsRaw.idle && typeof animationsRaw.idle === 'object' ? animationsRaw.idle : {};
          var flyAnimRaw = animationsRaw.fly && typeof animationsRaw.fly === 'object' ? animationsRaw.fly : {};
          var repairAnimRaw = animationsRaw.repair && typeof animationsRaw.repair === 'object' ? animationsRaw.repair : {};

          var idleAnim = normalizeAnim(idleAnimRaw, idleFallback, this.framesById, 'idle');
          var flyAnim = normalizeAnim(flyAnimRaw, idleAnim ? idleAnim.frames : idleFallback, this.framesById, 'fly');
          var repairAnim = normalizeAnim(repairAnimRaw, flyAnim ? flyAnim.frames : (idleAnim ? idleAnim.frames : idleFallback), this.framesById, 'repair');

          var levels = {};
          var maxLevel = 1;
          if (data && data.levels && typeof data.levels === 'object') {
            var levelKeys = Array.isArray(data.levels)
              ? data.levels.map(function (_, idx) { return String(idx + 1); })
              : Object.keys(data.levels);
            for (var lk = 0; lk < levelKeys.length; lk++) {
              var key = levelKeys[lk];
              var lvlNum = Math.max(1, Math.floor(Number(key) || (lk + 1)));
              var source = Array.isArray(data.levels) ? data.levels[lvlNum - 1] : data.levels[key];
              if (!source || typeof source !== 'object') continue;
              levels[lvlNum] = {
                moveSpeedPxSec: toPositiveNumber(source.moveSpeedPxSec, 72),
                repairSpeedMult: toPositiveNumber(source.repairSpeedMult, 1),
                costMult: toPositiveNumber(source.costMult, 1),
              };
              if (lvlNum > maxLevel) maxLevel = lvlNum;
            }
          }
          if (!Object.keys(levels).length) {
            levels[1] = { moveSpeedPxSec: 72, repairSpeedMult: 1, costMult: 1 };
            maxLevel = 1;
          }

          this.config = {
            atlas: atlasName,
            baseRepairSec: toPositiveNumber(data.baseRepairSec, 5),
            iconSize: {
              w: toPositiveNumber(data && data.iconSize && data.iconSize.w, 20),
              h: toPositiveNumber(data && data.iconSize && data.iconSize.h, 20),
            },
            iconsOffsetY: Number.isFinite(data.iconsOffsetY) ? data.iconsOffsetY : -32,
            scale: toPositiveNumber(data.scale, 1),
            anchor: data && data.anchor && typeof data.anchor === 'object'
              ? {
                  x: clamp01(data.anchor.x, 0.5),
                  y: clamp01(data.anchor.y, 0.5),
                }
              : { x: 0.5, y: 0.5 },
            levels: levels,
            maxLevel: maxLevel,
            animations: {
              idle: idleAnim,
              fly: flyAnim,
              repair: repairAnim,
            },
          };

          this.atlasImg = img;
          this.ready = true;
          this.error = '';
        } catch (e) {
          this.ready = false;
          this.error = String(e);
          this.atlasImg = null;
          this.config = null;
          this.framesById.clear();
        }
      },
      getLevel: function (level) {
        var cfg = this.config;
        if (!cfg || !cfg.levels) return null;
        var lvl = Math.max(1, Math.floor(Number(level) || 1));
        for (var n = lvl; n >= 1; n--) {
          if (cfg.levels[n]) return cfg.levels[n];
        }
        return cfg.levels[1] || null;
      },
      getAnimation: function (name) {
        var anims = this.config && this.config.animations ? this.config.animations : null;
        if (!anims) return null;
        return anims[name] || anims.idle || null;
      },
      pickFrame: function (frameId) {
        return this.framesById.get(frameId) || this.framesById.values().next().value || null;
      },
    };

    var BonusBoxSprites = {
      ready: false,
      error: '',
      atlasImg: null,
      config: null,
      framesById: new Map(),
      load: async function () {
        try {
          var res = await fetch('assets/bonusbox.json', { cache: 'no-store' });
          if (!res.ok) throw new Error('HTTP ' + res.status);
          var data = await res.json();

          var atlasPath = 'assets/' + (data.atlas || 'bonusbox_atlas.png');
          var img = await loadImage(atlasPath);

          this.framesById.clear();
          var rawFrames = Array.isArray(data.frames) ? data.frames : [];
          for (var i = 0; i < rawFrames.length; i++) {
            var frame = rawFrames[i] || {};
            var id = typeof frame.id === 'string' && frame.id.length > 0 ? frame.id : String(i);
            this.framesById.set(id, {
              id: id,
              x: Number.isFinite(frame.x) ? frame.x : 0,
              y: Number.isFinite(frame.y) ? frame.y : 0,
              w: toPositiveNumber(frame.w, 64),
              h: toPositiveNumber(frame.h, 64),
            });
          }

          var fallbackFrames = Array.from(this.framesById.keys());
          var animationsRaw = data && data.animations && typeof data.animations === 'object' ? data.animations : {};

          function normalizeAnim(rawAnim, fallbackIds, map, animationName) {
            var src = rawAnim && typeof rawAnim === 'object' ? rawAnim : {};
            var ids = collectAnimationFrameIds(rawAnim, fallbackIds, map, 'bonusbox_' + animationName);
            if (!ids.length) ids = fallbackIds.slice();
            if (!ids.length) return null;
            return {
              frames: ids,
              frameRateFps: toPositiveNumber(src.frameRateFps, 8),
              loop: src.loop !== false,
            };
          }

          var dropAnimRaw = animationsRaw.drop && typeof animationsRaw.drop === 'object' ? animationsRaw.drop : {};
          var idleAnimRaw = animationsRaw.idle && typeof animationsRaw.idle === 'object' ? animationsRaw.idle : {};
          var hoverAnimRaw = animationsRaw.hover && typeof animationsRaw.hover === 'object' ? animationsRaw.hover : {};
          var pressAnimRaw = animationsRaw.press && typeof animationsRaw.press === 'object' ? animationsRaw.press : {};

          var dropAnim = normalizeAnim(dropAnimRaw, fallbackFrames, this.framesById, 'drop');
          var idleAnim = normalizeAnim(idleAnimRaw, dropAnim ? dropAnim.frames : fallbackFrames, this.framesById, 'idle');
          var hoverAnim = normalizeAnim(hoverAnimRaw, idleAnim ? idleAnim.frames : fallbackFrames, this.framesById, 'hover');
          var pressAnim = normalizeAnim(pressAnimRaw, hoverAnim ? hoverAnim.frames : (idleAnim ? idleAnim.frames : fallbackFrames), this.framesById, 'press');

          this.config = {
            atlas: data && data.atlas ? data.atlas : 'bonusbox_atlas.png',
            anchor: data && data.anchor && typeof data.anchor === 'object'
              ? {
                  x: clamp01(data.anchor.x, 0.5),
                  y: clamp01(data.anchor.y, 0.5),
                }
              : { x: 0.5, y: 0.5 },
            scale: toPositiveNumber(data && data.scale, 1),
            animations: {
              drop: dropAnim,
              idle: idleAnim,
              hover: hoverAnim,
              press: pressAnim,
            },
          };

          this.atlasImg = img;
          this.ready = true;
          this.error = '';
        } catch (e) {
          this.ready = false;
          this.error = String(e);
          this.atlasImg = null;
          this.config = null;
          this.framesById.clear();
        }
      },
      getAnimation: function (name) {
        var anims = this.config && this.config.animations ? this.config.animations : null;
        if (!anims) return null;
        return anims[name] || anims.idle || null;
      },
      pickFrame: function (frameId) {
        return this.framesById.get(frameId) || this.framesById.values().next().value || null;
      },
    };

    return {
      loadImage: loadImage,
      ZombieSprites: ZombieSprites,
      TankSprites: TankSprites,
      FenceSprites: FenceSprites,
      DecorSprites: DecorSprites,
      GroundSprites: GroundSprites,
      SupercomputerSprites: SupercomputerSprites,
      DronSprites: DronSprites,
      BonusBoxSprites: BonusBoxSprites,
    };
  }

  global.Game = global.Game || {};
  global.Game.SpriteLoaders = {
    createSpriteLoaders: createSpriteLoaders,
    loadImage: loadImage,
  };
})(typeof window !== 'undefined' ? window : this);
