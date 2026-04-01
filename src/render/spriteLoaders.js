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
      var rawEffects = Array.isArray(src.effects) ? src.effects : [];
      var effects = [];
      for (var e = 0; e < rawEffects.length; e++) {
        var effectEntry = rawEffects[e];
        if (typeof effectEntry === 'string' && effectEntry) {
          effects.push({ preset: effectEntry });
          continue;
        }
        if (effectEntry && typeof effectEntry === 'object') {
          effects.push({
            preset: typeof effectEntry.preset === 'string' ? effectEntry.preset : '',
            type: typeof effectEntry.type === 'string' ? effectEntry.type : '',
            amplitudeX: Number.isFinite(effectEntry.amplitudeX) ? effectEntry.amplitudeX : null,
            amplitudeY: Number.isFinite(effectEntry.amplitudeY) ? effectEntry.amplitudeY : null,
            angleDeg: Number.isFinite(effectEntry.angleDeg) ? effectEntry.angleDeg : null,
            scaleMul: Number.isFinite(effectEntry.scaleMul) ? effectEntry.scaleMul : null,
            frequencyHz: Number.isFinite(effectEntry.frequencyHz) ? effectEntry.frequencyHz : null,
            phase: Number.isFinite(effectEntry.phase) ? effectEntry.phase : null,
            offsetX: Number.isFinite(effectEntry.offsetX) ? effectEntry.offsetX : null,
            offsetY: Number.isFinite(effectEntry.offsetY) ? effectEntry.offsetY : null,
          });
        }
      }
      return {
        x: Number.isFinite(src.x) ? src.x : fallback.x,
        y: Number.isFinite(src.y) ? src.y : fallback.y,
        w: toPositiveNumber(src.w, fallback.w),
        h: toPositiveNumber(src.h, fallback.h),
        frames: Math.max(1, Math.floor(toPositiveNumber(src.frames, fallback.frames))),
        frameRateFps: toPositiveNumber(src.frameRateFps, fallback.frameRateFps),
        loop: src.loop !== false,
        scale: toPositiveNumber(src.scale, Number.isFinite(fallback.scale) ? fallback.scale : 1),
        effects: effects,
      };
    }

    function normalizeSupercomputerPart(raw, fallbackAtlas, fallbackAnimationNames, fallbackClip) {
      var src = raw && typeof raw === 'object' ? raw : {};
      var animationsRaw = src.animations && typeof src.animations === 'object' ? src.animations : {};
      var fallbackNames = Array.isArray(fallbackAnimationNames) && fallbackAnimationNames.length
        ? fallbackAnimationNames
        : ['idle'];
      var animations = {};
      var firstAnim = normalizeAnimationClip(animationsRaw[fallbackNames[0]], fallbackClip);

      for (var i = 0; i < fallbackNames.length; i++) {
        var animName = fallbackNames[i];
        var fallbackName = fallbackNames[0];
        var rawAnim = animationsRaw[animName] || animationsRaw[fallbackName];
        animations[animName] = normalizeAnimationClip(rawAnim, i === 0 ? firstAnim : animations[fallbackName] || firstAnim);
      }

      return {
        defined: !!(raw && typeof raw === 'object'),
        atlas: typeof src.atlas === 'string' && src.atlas ? src.atlas : fallbackAtlas,
        offset: src.offset && typeof src.offset === 'object'
          ? {
              x: Number.isFinite(src.offset.x) ? src.offset.x : 0,
              y: Number.isFinite(src.offset.y) ? src.offset.y : 0,
            }
          : { x: 0, y: 0 },
        anchor: src.anchor && typeof src.anchor === 'object'
          ? {
              x: Number.isFinite(src.anchor.x) ? src.anchor.x : 0.5,
              y: Number.isFinite(src.anchor.y) ? src.anchor.y : 0.5,
            }
          : { x: 0.5, y: 0.5 },
        animations: animations,
      };
    }

    function normalizeSupercomputerBoxPart(raw, fallbackAtlas, fallbackClip) {
      var src = raw && typeof raw === 'object' ? raw : {};
      var animationsRaw = src.animations && typeof src.animations === 'object' ? src.animations : {};
      var lowRaw = animationsRaw.printLow || animationsRaw.buildLow || animationsRaw.lessThanHalf || animationsRaw.under50 || animationsRaw.idle;
      var lowClip = normalizeAnimationClip(lowRaw, fallbackClip);
      var highRaw = animationsRaw.printHigh || animationsRaw.buildHigh || animationsRaw.moreThanHalf || animationsRaw.over50 || animationsRaw.work || lowRaw;
      var highClip = normalizeAnimationClip(highRaw, lowClip);

      return {
        defined: !!(raw && typeof raw === 'object'),
        atlas: typeof src.atlas === 'string' && src.atlas ? src.atlas : fallbackAtlas,
        offset: src.offset && typeof src.offset === 'object'
          ? {
              x: Number.isFinite(src.offset.x) ? src.offset.x : 0,
              y: Number.isFinite(src.offset.y) ? src.offset.y : 0,
            }
          : { x: 0, y: 0 },
        anchor: src.anchor && typeof src.anchor === 'object'
          ? {
              x: Number.isFinite(src.anchor.x) ? src.anchor.x : 0.5,
              y: Number.isFinite(src.anchor.y) ? src.anchor.y : 0.5,
            }
          : { x: 0.5, y: 0.5 },
        animations: {
          printLow: lowClip,
          printHigh: highClip,
        },
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

    function parseTankLevelKey(key) {
      if (typeof key !== 'string') return null;
      var m = /^tank_lvl(\d+)$/.exec(key);
      if (!m) return null;
      var lvl = Number(m[1]);
      if (!Number.isFinite(lvl)) return null;
      return Math.max(1, Math.floor(lvl));
    }

    function normalizeSpriteBlock(raw) {
      if (!raw || typeof raw !== 'object' || !raw.src) return null;
      var frame = raw.frame && typeof raw.frame === 'object' ? raw.frame : {};
      return {
        src: raw.src,
        frame: {
          x: Number.isFinite(frame.x) ? frame.x : 0,
          y: Number.isFinite(frame.y) ? frame.y : 0,
          w: toPositiveNumber(frame.w, 64),
          h: toPositiveNumber(frame.h, 64),
        },
        frames: Math.max(1, Math.floor(toPositiveNumber(raw.frames, 1))),
        animSpeed: toPositiveNumber(raw.animSpeed, toPositiveNumber(raw.frameRateFps, 10)),
        frameRateFps: toPositiveNumber(raw.frameRateFps, toPositiveNumber(raw.animSpeed, 10)),
        anchor: {
          x: clamp01(raw.anchor && raw.anchor.x, 0.5),
          y: clamp01(raw.anchor && raw.anchor.y, 0.5),
        },
        scale: toPositiveNumber(raw.scale, 1),
        rotation: Number.isFinite(raw.rotation) ? raw.rotation : 0,
        // Aura animation params
        rotateSpeed: Number.isFinite(raw.rotateSpeed) ? raw.rotateSpeed : undefined,
        pulseSpeed: Number.isFinite(raw.pulseSpeed) ? raw.pulseSpeed : undefined,
        pulseMin: Number.isFinite(raw.pulseMin) ? raw.pulseMin : undefined,
        pulseMax: Number.isFinite(raw.pulseMax) ? raw.pulseMax : undefined,
        // legacy fields
        muzzle: raw.muzzle && typeof raw.muzzle === 'object'
          ? {
              x: Number.isFinite(raw.muzzle.x) ? raw.muzzle.x : 28,
              y: Number.isFinite(raw.muzzle.y) ? raw.muzzle.y : -2,
            }
          : { x: 28, y: -2 },
        recoil: Number.isFinite(raw.recoil) ? raw.recoil : 0,
        fireFrame: Number.isFinite(raw.fireFrame) ? Math.max(0, Math.floor(raw.fireFrame)) : 0,
      };
    }

    function normalizeAtlasPath(value, fallbackPath) {
      if (typeof value !== 'string' || !value) return fallbackPath;
      return value.indexOf('assets/') === 0 ? value : ('assets/' + value);
    }

    var ZombieSprites = {
      ready: false,
      error: '',
      atlasImg: null,
      atlasImages: null,
      types: [],
      deathCommon: null,
      spawnConfig: null,
      corpseConfig: null,
      debuffIconScale: 1.0,
      debuffIconOpacity: 1.0,
      load: async function () {
        try {
          var res = await fetch('assets/zombies.json', { cache: 'no-store' });
          if (!res.ok) throw new Error('HTTP ' + res.status);
          var data = await res.json();
          var sharedAtlasPath = normalizeAtlasPath(data.atlas, 'assets/zombie_atlas.png');
          var img = await loadImage(sharedAtlasPath);
          var rawTypeAtlasMap = data.atlasesById && typeof data.atlasesById === 'object'
            ? data.atlasesById
            : null;
          var atlasImages = new Map();
          var requestedAtlasPaths = new Set();
          atlasImages.set(sharedAtlasPath, img);

          function resolveTypeAtlasValue(rawType) {
            if (rawType && typeof rawType.atlas === 'string' && rawType.atlas) return rawType.atlas;
            if (!rawTypeAtlasMap || !rawType || typeof rawType.id !== 'string') return '';
            return typeof rawTypeAtlasMap[rawType.id] === 'string' ? rawTypeAtlasMap[rawType.id] : '';
          }

          function queueTypeAtlasLoad(atlasPath) {
            if (!atlasPath || atlasPath === sharedAtlasPath || requestedAtlasPaths.has(atlasPath)) return;
            requestedAtlasPaths.add(atlasPath);
            atlasImages.set(atlasPath, img);
            loadImage(atlasPath)
              .then(function (loadedImg) {
                atlasImages.set(atlasPath, loadedImg || img);
              })
              .catch(function () {
                atlasImages.set(atlasPath, img);
              });
          }

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
            /* Support single object or array of variants */
            var rawDC = Array.isArray(data.deathCommon) ? data.deathCommon : [data.deathCommon];
            var parsedDC = [];
            for (var dci = 0; dci < rawDC.length; dci++) {
              var dc = rawDC[dci];
              parsedDC.push({
                x: dc.x != null ? dc.x : 0,
                y: dc.y != null ? dc.y : 0,
                w: dc.w != null ? dc.w : 96,
                h: dc.h != null ? dc.h : 96,
                frames: dc.frames != null ? dc.frames : 1,
                frameRateFps: toPositiveNumber(dc.frameRateFps, defaultAnimFps.deathCommon),
                scale: toPositiveNumber(dc.scale, 1),
              });
            }
            this.deathCommon = parsedDC;
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

          var corpseHelper = global.Game && global.Game.CorpseDespawn ? global.Game.CorpseDespawn : null;
          if (corpseHelper && typeof corpseHelper.normalizeCorpseTimingConfig === 'function') {
            this.corpseConfig = corpseHelper.normalizeCorpseTimingConfig(data);
          } else {
            var corpseDespawnSec = Number.isFinite(data && data.corpseDespawnSec) ? Math.max(0, Number(data.corpseDespawnSec)) : 3;
            var corpseFadeOutSec = Number.isFinite(data && data.corpseFadeOutSec) ? Math.max(0, Number(data.corpseFadeOutSec)) : 0.8;
            this.corpseConfig = {
              corpseDespawnSec: corpseDespawnSec,
              corpseFadeOutSec: Math.min(corpseFadeOutSec, corpseDespawnSec),
            };
          }

          this.debuffIconScale = Number.isFinite(data.debuffIconScale) ? Math.max(0.1, Math.min(3, data.debuffIconScale)) : 1.0;
          this.debuffIconOpacity = Number.isFinite(data.debuffIconOpacity) ? Math.max(0, Math.min(1, data.debuffIconOpacity)) : 1.0;

          this.types = (data.types || []).map(function (t) {
            var animations = t && typeof t.animations === 'object' ? t.animations : null;
            var attackTuning = t && t.attack && typeof t.attack === 'object' ? t.attack : null;
            var rawHealth = Number.isFinite(t && t.Health) ? t.Health : (Number.isFinite(t && t.health) ? t.health : null);
            var atlasValue = resolveTypeAtlasValue(t);
            var atlasPath = normalizeAtlasPath(atlasValue, sharedAtlasPath);
            queueTypeAtlasLoad(atlasPath);
            return {
              id: t.id || 'zombie',
              atlas: atlasValue || '',
              atlasPath: atlasPath,
              frame: t.frame || { x: 0, y: 0, w: 64, h: 64 },
              frames: t.frames != null ? t.frames : 1,
              animSpeed: t.animSpeed != null ? t.animSpeed : 1.0,
              anchor: t.anchor || { x: 0.5, y: 0.75 },
              scale: t.scale != null ? t.scale : 1.0,
              shadowScale: toPositiveNumber(t.shadowScale, 1),
              rotation: t.rotation != null ? t.rotation : 0,
              health: rawHealth > 0 ? rawHealth : null,
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
          this.atlasImages = atlasImages;
          this.ready = true;
          this.error = '';
        } catch (e) {
          this.ready = false;
          this.atlasImg = null;
          this.atlasImages = null;
          this.types = [];
          this.deathCommon = null;
          this.spawnConfig = null;
          this.corpseConfig = null;
          this.debuffIconScale = 1.0;
          this.debuffIconOpacity = 1.0;
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
      getAtlasImage: function (typeOrId, preferSharedAtlas) {
        if (preferSharedAtlas) return this.atlasImg;
        var type = typeOrId;
        if (typeof typeOrId === 'string') {
          type = this.types.find(function (entry) { return entry.id === typeOrId; }) || null;
        }
        var atlasPath = type && typeof type.atlasPath === 'string' ? type.atlasPath : '';
        if (this.atlasImages && atlasPath && this.atlasImages.has(atlasPath)) {
          return this.atlasImages.get(atlasPath) || this.atlasImg;
        }
        return this.atlasImg;
      },
    };

    var TankSprites = {
      ready: false,
      error: '',
      config: null,
      cache: new Map(),
      warnedMissingLevels: new Set(),
      warnedClampLevels: new Set(),
      maxLevel: 0,
      load: async function () {
        try {
          var res = await fetch('assets/tanks.json', { cache: 'no-store' });
          if (!res.ok) throw new Error('HTTP ' + res.status);
          var rawCfg = await res.json();

          var keys = Object.keys(rawCfg || {});
          var srcs = new Set();
          var normalized = {
            _readme: rawCfg && rawCfg._readme ? rawCfg._readme : '',
            tankScale: Number.isFinite(rawCfg && rawCfg.tankScale) ? rawCfg.tankScale : 1,
            tankPrintDurationSec: toPositiveNumber(Number(rawCfg && rawCfg.tankPrintDurationSec), 1.5),
            ui: {
              onTrackIconOpacity: clamp01(rawCfg && rawCfg.ui && rawCfg.ui.onTrackIconOpacity, 0.45),
            },
            hangarAnimations: rawCfg && rawCfg.hangarAnimations && typeof rawCfg.hangarAnimations === 'object'
              ? rawCfg.hangarAnimations
              : null,
          };
          var maxLevel = 0;
          var levelsFound = 0;
          for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var lvl = parseTankLevelKey(key);
            if (lvl == null) continue;
            var rawTank = rawCfg[key];
            if (!rawTank || typeof rawTank !== 'object') {
              throw new Error('tank_lvl' + lvl + ': expected object');
            }
            if (!rawTank.stats || typeof rawTank.stats !== 'object') {
              throw new Error('tank_lvl' + lvl + ': missing stats');
            }
            if (!rawTank.body || typeof rawTank.body !== 'object') {
              throw new Error('tank_lvl' + lvl + ': missing body');
            }
            if (!rawTank.cannon || typeof rawTank.cannon !== 'object') {
              throw new Error('tank_lvl' + lvl + ': missing cannon');
            }

            var bodyCfg = normalizeSpriteBlock(rawTank.body);
            if (!bodyCfg) throw new Error('tank_lvl' + lvl + ': invalid body.src/frame');
            var cannonCfg = normalizeSpriteBlock(rawTank.cannon);
            if (!cannonCfg) throw new Error('tank_lvl' + lvl + ': invalid cannon.src/frame');
            var auraCfg = rawTank.aura ? normalizeSpriteBlock(rawTank.aura) : null;
            if (rawTank.aura && !auraCfg) throw new Error('tank_lvl' + lvl + ': invalid aura.src/frame');
            var aura1Cfg = rawTank.aura1 ? normalizeSpriteBlock(rawTank.aura1) : null;
            if (rawTank.aura1 && !aura1Cfg) throw new Error('tank_lvl' + lvl + ': invalid aura1.src/frame');
            var aura2Cfg = rawTank.aura2 ? normalizeSpriteBlock(rawTank.aura2) : null;
            if (rawTank.aura2 && !aura2Cfg) throw new Error('tank_lvl' + lvl + ': invalid aura2.src/frame');
            var aura3Cfg = rawTank.aura3 ? normalizeSpriteBlock(rawTank.aura3) : null;
            if (rawTank.aura3 && !aura3Cfg) throw new Error('tank_lvl' + lvl + ': invalid aura3.src/frame');

            var stats = rawTank.stats;
            var moveSpeed = Number(stats.moveSpeed);
            var attackSpeed = Number(stats.attackSpeed);
            var baseDamage = Number(stats.baseDamage);
            if (!Number.isFinite(moveSpeed) || moveSpeed <= 0) throw new Error('tank_lvl' + lvl + ': invalid stats.moveSpeed');
            if (!Number.isFinite(attackSpeed) || attackSpeed <= 0) throw new Error('tank_lvl' + lvl + ': invalid stats.attackSpeed');
            if (!Number.isFinite(baseDamage) || baseDamage < 0) throw new Error('tank_lvl' + lvl + ': invalid stats.baseDamage');

            var tankCfg = {
              stats: {
                moveSpeed: moveSpeed,
                attackSpeed: attackSpeed,
                baseDamage: baseDamage,
              },
              body: bodyCfg,
              cannon: cannonCfg,
              aura: auraCfg,
              aura1: aura1Cfg,
              aura2: aura2Cfg,
              aura3: aura3Cfg,
              bulletId: typeof rawTank.bulletId === 'string' && rawTank.bulletId.length ? rawTank.bulletId : 'bullet_base',
              bulletLevel: Number.isFinite(rawTank.bulletLevel) ? Math.max(1, Math.floor(rawTank.bulletLevel)) : 1,
            };
            normalized[key] = tankCfg;

            srcs.add('assets/' + bodyCfg.src);
            srcs.add('assets/' + cannonCfg.src);
            if (auraCfg && auraCfg.src) srcs.add('assets/' + auraCfg.src);
            if (aura1Cfg && aura1Cfg.src) srcs.add('assets/' + aura1Cfg.src);
            if (aura2Cfg && aura2Cfg.src) srcs.add('assets/' + aura2Cfg.src);
            if (aura3Cfg && aura3Cfg.src) srcs.add('assets/' + aura3Cfg.src);

            maxLevel = Math.max(maxLevel, lvl);
            levelsFound++;
          }

          if (!levelsFound) {
            throw new Error('tanks.json: expected keys tank_lvl1..tank_lvlN');
          }

          this.cache.clear();
          for (var s of srcs) {
            var img = await loadImage(s);
            this.cache.set(s, img);
          }

          this.config = normalized;
          this.maxLevel = maxLevel;
          this.warnedMissingLevels.clear();
          this.warnedClampLevels.clear();
          this.ready = true;
          this.error = '';
        } catch (e) {
          this.ready = false;
          this.error = String(e);
          this.config = null;
          this.maxLevel = 0;
          this.warnedMissingLevels.clear();
          this.warnedClampLevels.clear();
          this.cache.clear();
          if (typeof console !== 'undefined' && console.error) {
            console.error('[TankSprites] load failed:', this.error);
          }
        }
      },
      getTank: function (level) {
        if (!this.ready || !this.config) return null;
        var lvl = Math.max(1, Math.floor(Number(level) || 1));
        var maxLevel = Math.max(1, this.maxLevel || 1);
        if (lvl > maxLevel) {
          if (!this.warnedClampLevels.has(lvl) && typeof console !== 'undefined' && console.warn) {
            this.warnedClampLevels.add(lvl);
            console.warn('[TankSprites] Requested level', lvl, 'is above max available', maxLevel, '- clamping to', maxLevel);
          }
          lvl = maxLevel;
        }
        var key = 'tank_lvl' + lvl;
        var tankCfg = this.config[key] || null;
        if (!tankCfg && !this.warnedMissingLevels.has(lvl) && typeof console !== 'undefined' && console.error) {
          this.warnedMissingLevels.add(lvl);
          console.error('[TankSprites] Missing config for', key);
        }
        return tankCfg;
      },
      pickBody: function (level) {
        var tankCfg = this.getTank(level);
        if (!tankCfg || !tankCfg.body) return null;
        var cfg = tankCfg.body;
        if (!cfg || !cfg.src) return null;
        var full = 'assets/' + cfg.src;
        var img = this.cache.get(full);
        if (!img) return null;
        return { img: img, cfg: cfg };
      },
      pickCannon: function (level) {
        var tankCfg = this.getTank(level);
        if (!tankCfg || !tankCfg.cannon) return null;
        var cfg = tankCfg.cannon;
        if (!cfg.src) return null;
        var full = 'assets/' + cfg.src;
        var img = this.cache.get(full);
        if (!img) return null;
        return { img: img, cfg: cfg };
      },
      pickAura: function (level, variant) {
        var tankCfg = this.getTank(level);
        if (!tankCfg) return null;
        var key = typeof variant === 'number' && variant >= 1 && variant <= 3 ? 'aura' + variant : 'aura';
        var cfg = tankCfg[key];
        if (!cfg || !cfg.src) return null;
        var full = 'assets/' + cfg.src;
        var img = this.cache.get(full);
        if (!img) return null;
        return { img: img, cfg: cfg };
      },
    };

    var BulletSprites = {
      ready: false,
      error: '',
      atlasImg: null,
      config: null,
      _warnedMissing: new Set(),
      load: async function () {
        try {
          var res = await fetch('assets/bullet.json', { cache: 'no-store' });
          if (!res.ok) throw new Error('HTTP ' + res.status);
          var data = await res.json();
          var atlasName = (data && data.atlas) ? data.atlas : 'bullet_atlas.png';
          var atlasPath = 'assets/' + atlasName;
          var img = await loadImage(atlasPath);

          var bulletsRaw = data && data.bullets && typeof data.bullets === 'object' ? data.bullets : {};
          var normalizedBullets = {};
          var ids = Object.keys(bulletsRaw);
          for (var i = 0; i < ids.length; i++) {
            var bulletId = ids[i];
            var bulletEntry = bulletsRaw[bulletId];
            if (!bulletEntry || typeof bulletEntry !== 'object') continue;
            var levels = Array.isArray(bulletEntry.levels) ? bulletEntry.levels : [];
            var normalizedLevels = [];
            for (var li = 0; li < levels.length; li++) {
              var levelCfg = levels[li] || {};
              var bulletSprite = normalizeSpriteBlock(levelCfg.bulletSprite);
              var impactSprite = normalizeSpriteBlock(levelCfg.impactSprite);
              if (!bulletSprite || !impactSprite) continue;
              normalizedLevels.push({
                bulletSprite: bulletSprite,
                impactSprite: impactSprite,
                addDamage: Number.isFinite(levelCfg.addDamage) ? levelCfg.addDamage : 0,
                aoe: Number.isFinite(levelCfg.aoe) ? Math.max(0, levelCfg.aoe) : 1,
                sfx: typeof levelCfg.sfx === 'string' ? levelCfg.sfx : null,
                projectileKind: typeof levelCfg.projectileKind === 'string' ? levelCfg.projectileKind : 'ap',
              });
            }
            normalizedBullets[bulletId] = { levels: normalizedLevels };
          }

          this.config = {
            atlas: atlasName,
            bullets: normalizedBullets,
          };
          this.atlasImg = img;
          this.ready = true;
          this.error = '';
          this._warnedMissing.clear();
          if (!normalizedBullets.bullet_base || !Array.isArray(normalizedBullets.bullet_base.levels) || !normalizedBullets.bullet_base.levels.length) {
            if (typeof console !== 'undefined' && console.warn) {
              console.warn('[BulletSprites] bullet_base is missing or has empty levels. Shots will be no-op.');
            }
          }
        } catch (e) {
          this.ready = false;
          this.error = String(e);
          this.atlasImg = null;
          this.config = null;
          this._warnedMissing.clear();
          if (typeof console !== 'undefined' && console.error) {
            console.error('[BulletSprites] load failed:', this.error);
          }
        }
      },
      getBullet: function (bulletId, bulletLevel) {
        if (!this.ready || !this.config || !this.config.bullets) return null;
        var id = typeof bulletId === 'string' && bulletId.length ? bulletId : 'bullet_base';
        var entry = this.config.bullets[id];
        var levels = entry && Array.isArray(entry.levels) ? entry.levels : null;
        if (!levels || !levels.length) {
          if (!this._warnedMissing.has(id) && typeof console !== 'undefined' && console.warn) {
            this._warnedMissing.add(id);
            console.warn('[BulletSprites] Missing bullet config for', id, '- returning null');
          }
          return null;
        }
        var lvl = Number.isFinite(bulletLevel) ? Math.max(1, Math.floor(bulletLevel)) : 1;
        var idx = Math.min(levels.length - 1, lvl - 1);
        return levels[idx] || null;
      },
    };

    var FenceSprites = {
      ready: false,
      error: '',
      atlasImg: null,
      config: null,
      _currentAtlasName: null,
      _ensureLevelToken: 0,
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
          var state = getState();
          var desiredLevel = state && Number.isFinite(state.fenceLevel) ? Math.max(1, Math.floor(state.fenceLevel)) : 1;
          var perLevels = Array.isArray(data.levels) ? data.levels : null;
          var atlasName = (perLevels && perLevels[desiredLevel - 1] && perLevels[desiredLevel - 1].atlas) ? perLevels[desiredLevel - 1].atlas : data.atlas;
          atlasName = atlasName || 'fence_atlas.png';
          var atlasPath = 'assets/' + atlasName;
          var img = await loadImage(atlasPath).catch(function (e) {
            // fallback to global atlas if per-level missing
            var fallback = 'assets/' + (data.atlas || 'fence_atlas.png');
            return loadImage(fallback);
          });
          this.atlasImg = img;
          this._currentAtlasName = atlasName;
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
      ensureLevel: async function (level) {
        var token = ++this._ensureLevelToken;
        if (!this.config) return;
        var lvl = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;
        var perLevels = Array.isArray(this.config.levels) ? this.config.levels : null;
        var atlasName = (perLevels && perLevels[lvl - 1] && perLevels[lvl - 1].atlas)
          ? perLevels[lvl - 1].atlas
          : this.config.atlas;
        atlasName = atlasName || 'fence_atlas.png';
        if (atlasName === this._currentAtlasName) return;
        try {
          var img = await loadImage('assets/' + atlasName);
          if (token !== this._ensureLevelToken) return;
          this.atlasImg = img;
          this._currentAtlasName = atlasName;
          this.ready = true;
          this.error = '';
          var state = getState();
          if (state && Array.isArray(state.fenceSegments)) {
            state.fenceSegments = [];
          }
        } catch (e) {
          // keep previous atlas on failure
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
            smoke: data.smoke && typeof data.smoke === 'object'
              ? data.smoke
              : { frames: [], fps: 0, offset: { x: 0, y: 0 }, scale: 1 },
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
      atlasImages: null,
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
          var mainAtlasName = data && data.atlas ? data.atlas : 'decor.png';
          var conveyorCfg = normalizeSupercomputerPart(data && data.conveyor, data && data.atlas ? data.atlas : 'decor.png', ['idle', 'work'], {
            x: 0,
            y: 0,
            w: 80,
            h: 22,
            frames: 1,
            frameRateFps: 1,
            loop: true,
            scale: 1,
            effects: [],
          });
          var conveyorBoxCfg = normalizeSupercomputerBoxPart(data && (data.conveyorBox || data.box), 'bonusbox_atlas.png', {
            x: 0,
            y: 0,
            w: 32,
            h: 32,
            frames: 1,
            frameRateFps: 1,
            loop: true,
            scale: 1,
            effects: [],
          });
          var storageCfg = normalizeSupercomputerPart((data && (data.storageCell || data.storage)), data && data.atlas ? data.atlas : 'decor.png', ['idle', 'hover'], {
            x: 0,
            y: 0,
            w: 28,
            h: 28,
            frames: 1,
            frameRateFps: 1,
            loop: true,
            scale: 1,
            effects: [],
          });
          async function loadSharedAtlas(atlasName) {
            var resolved = typeof atlasName === 'string' && atlasName ? atlasName : mainAtlasName;
            if (resolved === mainAtlasName) return img;
            if (!sharedAtlasImages[resolved]) {
              sharedAtlasImages[resolved] = await loadImage('assets/' + resolved);
            }
            return sharedAtlasImages[resolved];
          }
          var sharedAtlasImages = Object.create(null);
          sharedAtlasImages[mainAtlasName] = img;
          var atlasImages = {
            main: img,
            conveyor: await loadSharedAtlas(conveyorCfg.atlas),
            conveyorBox: await loadSharedAtlas(conveyorBoxCfg.atlas),
            storageCell: await loadSharedAtlas(storageCfg.atlas),
          };

          var glitchRaw = data && data.glitch && typeof data.glitch === 'object' ? data.glitch : {};
          var minLoops = Number.isFinite(glitchRaw.minLoops) ? Math.max(1, Math.floor(glitchRaw.minLoops)) : 1;
          var maxLoops = Number.isFinite(glitchRaw.maxLoops) ? Math.max(minLoops, Math.floor(glitchRaw.maxLoops)) : minLoops;
          var boostIconsRaw = data && data.boostIcons && typeof data.boostIcons === 'object' ? data.boostIcons : {};
          var boostIconsAnchor = boostIconsRaw.anchor === 'top' || boostIconsRaw.anchor === 'bottom'
            ? boostIconsRaw.anchor
            : 'top';

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
            boostIcons: {
              anchor: boostIconsAnchor,
              offsetX: Number.isFinite(boostIconsRaw.offsetX) ? boostIconsRaw.offsetX : 0,
              offsetY: Number.isFinite(boostIconsRaw.offsetY) ? boostIconsRaw.offsetY : -10,
              maxPerRow: Number.isFinite(boostIconsRaw.maxPerRow) ? Math.max(1, Math.floor(boostIconsRaw.maxPerRow)) : 4,
              gapX: Number.isFinite(boostIconsRaw.gapX) ? Math.max(0, boostIconsRaw.gapX) : 6,
              gapY: Number.isFinite(boostIconsRaw.gapY) ? Math.max(0, boostIconsRaw.gapY) : 6,
            },
            animations: {
              idle: idleClip,
              work: workClip,
              glitch: normalizeAnimationClip(animationsRaw.glitch, idleClip),
              buildTank: normalizeAnimationClip(animationsRaw.buildTank, idleClip),
              destroy: normalizeAnimationClip(animationsRaw.destroy, idleClip),
            },
            conveyor: conveyorCfg,
            conveyorBox: conveyorBoxCfg,
            storageCell: storageCfg,
            glitch: {
              chancePerSecond: Number.isFinite(glitchRaw.chancePerSecond) ? Math.max(0, glitchRaw.chancePerSecond) : 0,
              minLoops: minLoops,
              maxLoops: maxLoops,
              cooldownSec: Number.isFinite(glitchRaw.cooldownSec) ? Math.max(0, glitchRaw.cooldownSec) : 0,
            },
            button: (function () {
              var raw = data && data.button && typeof data.button === 'object' ? data.button : {};
              var off = raw.offset && typeof raw.offset === 'object' ? raw.offset : {};
              return {
                offset: {
                  x: Number.isFinite(off.x) ? off.x : 10,
                  y: Number.isFinite(off.y) ? off.y : 0,
                },
              };
            }()),
            stats: data && data.stats && typeof data.stats === 'object' ? data.stats : {},
          };

          this.atlasImg = img;
          this.atlasImages = atlasImages;
          this.ready = true;
          this.error = '';
        } catch (e) {
          this.ready = false;
          this.atlasImg = null;
          this.atlasImages = null;
          this.config = null;
          this.error = String(e);
        }
      },
      getAnimation: function (stateName, partName) {
        if (!this.config) return null;
        if (partName === 'conveyor') {
          var conveyorAnimations = this.config.conveyor && this.config.conveyor.animations ? this.config.conveyor.animations : null;
          if (!conveyorAnimations) return null;
          return conveyorAnimations[stateName] || conveyorAnimations.idle || conveyorAnimations.work || null;
        }
        if (partName === 'storageCell' || partName === 'storage') {
          var storageAnimations = this.config.storageCell && this.config.storageCell.animations ? this.config.storageCell.animations : null;
          if (!storageAnimations) return null;
          return storageAnimations[stateName] || storageAnimations.idle || storageAnimations.hover || null;
        }
        if (partName === 'conveyorBox' || partName === 'box') {
          var boxAnimations = this.config.conveyorBox && this.config.conveyorBox.animations ? this.config.conveyorBox.animations : null;
          if (!boxAnimations) return null;
          return boxAnimations[stateName]
            || boxAnimations.printLow
            || boxAnimations.printHigh
            || null;
        }
        if (!this.config.animations) return null;
        return this.config.animations[stateName] || this.config.animations.idle || this.config.animations.work || null;
      },
      getAtlasImage: function (partName) {
        if (!this.atlasImages) return this.atlasImg || null;
        if (partName === 'conveyor') return this.atlasImages.conveyor || this.atlasImg || null;
        if (partName === 'conveyorBox' || partName === 'box') return this.atlasImages.conveyorBox || this.atlasImg || null;
        if (partName === 'storageCell' || partName === 'storage') return this.atlasImages.storageCell || this.atlasImg || null;
        return this.atlasImages.main || this.atlasImg || null;
      },
      getPartConfig: function (partName) {
        if (!this.config) return null;
        if (partName === 'conveyor') return this.config.conveyor || null;
        if (partName === 'conveyorBox' || partName === 'box') return this.config.conveyorBox || null;
        if (partName === 'storageCell' || partName === 'storage') return this.config.storageCell || null;
        return this.config;
      },
    };

    var BoostIconsSprites = {
      ready: false,
      error: '',
      atlasImg: null,
      config: null,
      boosts: null,
      load: async function () {
        try {
          var res = await fetch('assets/boost_icons.json', { cache: 'no-store' });
          if (!res.ok) throw new Error('HTTP ' + res.status);
          var data = await res.json();

          var atlasName = data && data.atlas ? data.atlas : 'boost_icons_atlas.png';
          var atlasPath = 'assets/' + atlasName;
          var img = await loadImage(atlasPath);

          function normalizeFrame(raw) {
            if (!raw || typeof raw !== 'object') return null;
            var w = Number.isFinite(raw.w) ? Math.max(1, Math.floor(raw.w)) : 0;
            var h = Number.isFinite(raw.h) ? Math.max(1, Math.floor(raw.h)) : 0;
            if (w <= 0 || h <= 0) return null;
            return {
              x: Number.isFinite(raw.x) ? Math.floor(raw.x) : 0,
              y: Number.isFinite(raw.y) ? Math.floor(raw.y) : 0,
              w: w,
              h: h,
            };
          }

          function normalizeFrameList(rawList) {
            if (!Array.isArray(rawList)) return [];
            var out = [];
            for (var i = 0; i < rawList.length; i++) {
              var frame = normalizeFrame(rawList[i]);
              if (frame) out.push(frame);
            }
            return out;
          }

          var boosts = {};
          var rawBoosts = data && data.boosts && typeof data.boosts === 'object' ? data.boosts : {};
          var boostIds = Object.keys(rawBoosts);
          for (var b = 0; b < boostIds.length; b++) {
            var boostId = boostIds[b];
            var src = rawBoosts[boostId] && typeof rawBoosts[boostId] === 'object' ? rawBoosts[boostId] : {};
            boosts[boostId] = {
              iconFrames: normalizeFrameList(src.iconFrames),
              cooldownOverlayFrames: normalizeFrameList(src.cooldownOverlayFrames),
            };
          }

          this.config = {
            atlas: atlasName,
          };
          this.boosts = boosts;
          this.atlasImg = img;
          this.ready = true;
          this.error = '';
        } catch (e) {
          this.ready = false;
          this.error = String(e);
          this.atlasImg = null;
          this.config = null;
          this.boosts = null;
        }
      },
      getBoost: function (boostId) {
        if (!this.boosts || !boostId) return null;
        return this.boosts[boostId] || null;
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
          var waitAnimRaw = animationsRaw.wait && typeof animationsRaw.wait === 'object' ? animationsRaw.wait : {};
          var workAnimRaw = animationsRaw.work && typeof animationsRaw.work === 'object' ? animationsRaw.work : {};
          var flyAnimRaw = animationsRaw.fly && typeof animationsRaw.fly === 'object' ? animationsRaw.fly : {};
          var repairAnimRaw = animationsRaw.repair && typeof animationsRaw.repair === 'object' ? animationsRaw.repair : {};

          var idleAnim = normalizeAnim(idleAnimRaw, idleFallback, this.framesById, 'idle');
          var waitAnim = normalizeAnim(waitAnimRaw, idleAnim ? idleAnim.frames : idleFallback, this.framesById, 'wait');
          var workAnim = normalizeAnim(workAnimRaw, waitAnim ? waitAnim.frames : (idleAnim ? idleAnim.frames : idleFallback), this.framesById, 'work');
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
              wait: waitAnim,
              work: workAnim,
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
      BoostIconsSprites: BoostIconsSprites,
      DronSprites: DronSprites,
      BonusBoxSprites: BonusBoxSprites,
      BulletSprites: BulletSprites,
    };
  }

  global.Game = global.Game || {};
  global.Game.SpriteLoaders = {
    createSpriteLoaders: createSpriteLoaders,
    loadImage: loadImage,
  };
})(typeof window !== 'undefined' ? window : this);
