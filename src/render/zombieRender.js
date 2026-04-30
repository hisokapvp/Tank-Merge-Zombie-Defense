(function (global) {
  'use strict';

  var DISABLE_ZOMBIE_AURAS = true;

  // Solo-pipeline-yandex-vk batch 1 / item A2: corpse / blood-decal fade gate.
  // Reads the cached scalar from Game.FxDensity so the hot-path stays no-alloc.
  // density === 0 hides corpses immediately (alpha 0); density between 0..1
  // multiplies the existing fade alpha so corpses persist as long as gameplay
  // says they should but render lighter.
  function _fxDensityScalar() {
    var FX = global.Game && global.Game.FxDensity;
    if (FX && typeof FX.getDensity === 'function') {
      var d = FX.getDensity();
      return Number.isFinite(d) ? d : 1;
    }
    return 1;
  }

  function createController(deps) {
    deps = deps || {};

    function isCommonDeathAnimation(z, ZombieSprites) {
      if (!z || z.state !== 'dying') return false;
      if (z.deathUsesCommonAtlas === true) return true;
      if (!z.deathAnim || !ZombieSprites || !ZombieSprites.deathCommon) return false;
      if (Array.isArray(ZombieSprites.deathCommon)) {
        for (var i = 0; i < ZombieSprites.deathCommon.length; i++) {
          if (z.deathAnim === ZombieSprites.deathCommon[i]) return true;
        }
        return false;
      }
      return z.deathAnim === ZombieSprites.deathCommon;
    }

    function resolveZombieAtlasImage(ZombieSprites, z, preferSharedAtlas) {
      if (!ZombieSprites) return null;
      if (typeof ZombieSprites.getAtlasImage === 'function') {
        return ZombieSprites.getAtlasImage(z && z.type, preferSharedAtlas) || ZombieSprites.atlasImg || null;
      }
      if (preferSharedAtlas) return ZombieSprites.atlasImg || null;
      return (z && z.type && z.type.atlasImg) || ZombieSprites.atlasImg || null;
    }

    function getCorpseFadeAlpha(z, isDying) {
      if (!isDying) return 1;
      var deathTimer = Number.isFinite(z && z.deathTimer) ? z.deathTimer : 0;
      if (deathTimer > 0) return 1;
      var timeToRemove = Number.isFinite(z && z.corpseTimerLeft)
        ? z.corpseTimerLeft
        : (Number.isFinite(z && z.corpseTimer) ? z.corpseTimer : 0);
      if (timeToRemove <= 0) return 0;
      // FxDensity gate: density=0 -> drop corpse render entirely (alpha 0);
      // gameplay-side timer (z.corpseTimerLeft) is left untouched.
      var fxDensity = _fxDensityScalar();
      if (fxDensity <= 0) return 0;
      var fadeSec = typeof deps.getZombieCorpseFadeOutSec === 'function'
        ? deps.getZombieCorpseFadeOutSec()
        : 0;
      var baseAlpha;
      if (!Number.isFinite(fadeSec) || fadeSec <= 0) baseAlpha = 1;
      else if (timeToRemove > fadeSec) baseAlpha = 1;
      else baseAlpha = deps.clamp(timeToRemove / fadeSec, 0, 1);
      return baseAlpha * fxDensity;
    }

    function getZombieDeathScale(z, usesCommonDeathAtlas) {
      var deathAnimScale = Number.isFinite(z && z.deathAnim && z.deathAnim.scale)
        ? z.deathAnim.scale
        : 1;
      var typeScale = Number.isFinite(z && z.type && z.type.scale)
        ? z.type.scale
        : 1;
      var commonDeathScale = Number.isFinite(z && z.type && z.type.commonDeathScale)
        ? z.type.commonDeathScale
        : 1;
      return (usesCommonDeathAtlas ? commonDeathScale : typeScale) * deathAnimScale;
    }

    function getZombieShadowScale(z) {
      return Number.isFinite(z && z.type && z.type.shadowScale)
        ? z.type.shadowScale
        : 1;
    }

    function drawZombieEntity(z, x, y) {
      var ZombieSprites = deps.getZombieSprites();
      var usesCommonDeathAtlas = ZombieSprites.ready && z.type
        ? isCommonDeathAnimation(z, ZombieSprites)
        : false;
      // Solo-pipeline-yandex-vk#2 / item 6 (consumer integration of
      // Game.Sprites.getCachedFrameRef): resolveZombieAtlasImage walks
      // ZombieSprites.getAtlasImage(z.type, preferSharedAtlas) for every
      // zombie every frame. With N zombies × 60 Hz that is 2 namespace
      // hops + a property chain N×60 times per second. We cache the
      // resolved ref directly on the zombie slot, gated by atlasVersion
      // (bumped from worldReset / atlas hot-swap via Game.Sprites.bumpAtlasVersion)
      // and a 1-bit mode flag (type-atlas vs shared death-common atlas).
      // The pattern is inlined instead of calling Game.Sprites.getCachedFrameRef
      // with a closure to keep the hot-path zero-alloc (drawZombieEntity is
      // a render hot-path and TMZD invariant forbids per-frame heap allocs).
      // The cache fields use the same `_atlasFrameRef` / `_atlasFrameVer`
      // naming as the canonical helper so that tooling / postmortems stay
      // consistent across consumers.
      var zombieAtlasImg = null;
      if (ZombieSprites.ready && z.type) {
        var SpritesNs = global.Game && global.Game.Sprites;
        var atlasVer = SpritesNs && typeof SpritesNs.getAtlasVersion === 'function'
          ? SpritesNs.getAtlasVersion()
          : 0;
        var atlasMode = usesCommonDeathAtlas ? 1 : 0;
        if (z._atlasFrameVer === atlasVer && z._atlasFrameMode === atlasMode && z._atlasFrameRef) {
          zombieAtlasImg = z._atlasFrameRef;
        } else {
          zombieAtlasImg = resolveZombieAtlasImage(ZombieSprites, z, usesCommonDeathAtlas);
          if (zombieAtlasImg && typeof zombieAtlasImg === 'object') {
            z._atlasFrameRef = zombieAtlasImg;
            z._atlasFrameVer = atlasVer;
            z._atlasFrameMode = atlasMode;
          }
        }
      }
      if (zombieAtlasImg) {
        drawZombieSprite(x, y, z, zombieAtlasImg, usesCommonDeathAtlas);
      } else {
        drawZombieFallback(x, y, z);
      }
    }

    function drawZombieSprite(x, y, z, img, usesCommonDeathAtlas) {
      var ctx = deps.getCtx();
      var ZombieSprites = deps.getZombieSprites();
      var BAL = deps.getBalance();
      var t = z.type;
      var f = t.frame;
      var a = t.anchor;
      var center = deps.getCenter();
      var facing = x >= center.x ? -1 : 1;

      var isDying = z.state === 'dying';
      var hasDeathAnim = isDying && z.deathAnim;
      var hasAttackAnim = !isDying && z.attackState === 'attack' && t.attack;
      var corpseFadeAlpha = getCorpseFadeAlpha(z, isDying);
      if (corpseFadeAlpha <= 0) return;

      var fx;
      var fy;
      var fw;
      var fh;
      if (hasDeathAnim) {
        var da = z.deathAnim;
        var deathFrameIndex = Math.floor(z.deathFrame || 0);
        fx = da.x + deathFrameIndex * da.w;
        fy = da.y;
        fw = da.w;
        fh = da.h;
      } else if (hasAttackAnim) {
        var aa = t.attack;
        var attackFrames = aa.frames || 1;
        var typeId = t.id || '';
        var balAtkSpd = deps.getZombieBalanceMul(typeId, 'attackSpeedMul');
        var attackFps = Math.max(0.01, (z.attackFrameRateFps || deps.getZombieDefaultAttackFps()) * balAtkSpd);
        var attackFrameIndex = Math.min(attackFrames - 1, Math.floor((z.attackAnimTimeSec || 0) * attackFps));
        fx = aa.x + attackFrameIndex * aa.w;
        fy = aa.y;
        fw = aa.w;
        fh = aa.h;
      } else {
        var frames = t.frames || 1;
        var walkFrameIndex = Math.floor(z.walkAnimFrame || z.anim || 0) % frames;
        fx = f.x + walkFrameIndex * f.w;
        fy = f.y;
        fw = f.w;
        fh = f.h;
      }

      var scale = getZombieDeathScale(z, usesCommonDeathAtlas) * BAL.zombieScaleMul * deps.zombieLevelScale(z);
      var shadowScale = getZombieShadowScale(z);
      var baseW = hasDeathAnim ? z.deathAnim.w : (hasAttackAnim ? t.attack.w : f.w);
      var baseH = hasDeathAnim ? z.deathAnim.h : (hasAttackAnim ? t.attack.h : f.h);
      var w = baseW * scale;
      var h = baseH * scale;

      // Anchor offset from default {0.5, 0.75}: uses walk frame for stable shadow/aura
      var anchorOffsetX = (0.5 - a.x) * f.w * scale;
      var anchorOffsetY = (0.75 - a.y) * f.h * scale;
      // Per-type shadow tuning from anchor_shadow in zombies.json (sprite-pixel units, scaled)
      var as = t.anchorShadow;
      var shadowShiftX = (as ? as.x : 0) * scale;
      var shadowShiftY = (as ? as.y : 0) * scale;

      var walkPhase = z.walkAnimFrame || z.anim || 0;
      var bobPhase = hasAttackAnim ? (z.attackAnimTimeSec || 0) * Math.max(0.01, z.attackFrameRateFps || deps.getZombieDefaultAttackFps()) : walkPhase;
      var bob = hasDeathAnim ? 0 : Math.sin(bobPhase) * BAL.zombieBobAmp;
      var groundOffset = BAL.zombieGroundOffset * deps.zombieLevelScale(z);
      var face = z.heading ?? (z.theta + (z.omega >= 0 ? Math.PI / 2 : -Math.PI / 2));
      var rot = face + (t.rotation ?? 0);

      var death = isDying ? (z.deathProgress ?? 0) : 0;
      var deathScale = hasDeathAnim ? 1 : (1 - death * 0.22);
      var deathTilt = hasDeathAnim ? 0 : (death * 1.1);
      var deathAlpha = corpseFadeAlpha;

      var state = deps.getState();
      var qualityLow = deps.isQualityLow();
      if (!DISABLE_ZOMBIE_AURAS && state.endgameVisuals && !isDying) {
        ctx.save();
        ctx.translate(x + anchorOffsetX + shadowShiftX, y + bob + groundOffset + anchorOffsetY + shadowShiftY);
        ctx.globalAlpha = 0.2 + 0.08 * Math.sin(deps.nowSec() * 3);
        ctx.fillStyle = 'rgba(200,80,80,.35)';
        ctx.beginPath();
        ctx.ellipse(0, 0, w * 0.5, h * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,100,100,.25)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }

      if (!qualityLow && !isDying) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,.20)';
        ctx.beginPath();
        ctx.ellipse(
          x + anchorOffsetX + shadowShiftX,
          y + BAL.zombieShadowY + groundOffset + anchorOffsetY + shadowShiftY,
          BAL.zombieShadowW * scale * shadowScale,
          BAL.zombieShadowH * scale * shadowScale,
          0, 0, Math.PI * 2
        );
        ctx.fill();
        ctx.restore();
      }

      ctx.save();
      ctx.translate(x, y + bob + groundOffset);
      ctx.globalAlpha = deathAlpha;
      ctx.scale(facing * deathScale, deathScale);
      ctx.rotate(rot * facing + deathTilt * facing);
      ctx.drawImage(
        img,
        fx, fy, fw, fh,
        -w * a.x,
        -h * a.y,
        w, h
      );
      ctx.restore();

      if (!DISABLE_ZOMBIE_AURAS && (z.level ?? 1) > 1 && !isDying) {
        var ring = deps.clamp((z.level ?? 1) - 1, 1, 6);
        ctx.save();
        ctx.strokeStyle = 'rgba(185,139,255,' + (0.08 + ring * 0.02) + ')';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x + anchorOffsetX + shadowShiftX, y + bob + groundOffset + anchorOffsetY + shadowShiftY, w * 0.36, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    function drawZombieFallback(x, y, z) {
      var ctx = deps.getCtx();
      var BAL = deps.getBalance();
      var state = deps.getState();
      var qualityLow = deps.isQualityLow();
      var walkPhase = z.walkAnimFrame || z.anim || 0;
      var bob = Math.sin(walkPhase) * BAL.zombieBobAmp;
      var groundOffset = BAL.zombieGroundOffset * deps.zombieLevelScale(z);
      var face = z.heading ?? (z.theta + (z.omega >= 0 ? Math.PI / 2 : -Math.PI / 2));
      var center = deps.getCenter();
      var facing = x >= center.x ? -1 : 1;
      var s = BAL.zombieScaleMul * deps.zombieLevelScale(z);
      var shadowScale = getZombieShadowScale(z);
      var levelBoost = deps.clamp((z.level ?? 1) - 1, 0, 6);
      var isDying = z.state === 'dying';
      var corpseFadeAlpha = getCorpseFadeAlpha(z, isDying);
      if (corpseFadeAlpha <= 0) return;
      var skinTone = state.endgameVisuals && !isDying ? deps.shade('#c85050', levelBoost * 8) : deps.shade('#3cbe78', levelBoost * 10);
      var death = isDying ? (z.deathProgress ?? 0) : 0;
      var deathScale = 1 - death * 0.22;
      var deathTilt = death * 1.1;

      if (!DISABLE_ZOMBIE_AURAS && state.endgameVisuals && z.state !== 'dying') {
        ctx.save();
        ctx.translate(x, y + bob + groundOffset);
        ctx.globalAlpha = 0.22 + 0.06 * Math.sin(deps.nowSec() * 3);
        ctx.fillStyle = 'rgba(200,80,80,.3)';
        ctx.beginPath();
        ctx.ellipse(0, 0, 14 * s, 8 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,100,100,.22)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }

      if (!qualityLow && !isDying) {
        ctx.save();
        ctx.beginPath();
        ctx.fillStyle = 'rgba(0,0,0,.20)';
        ctx.ellipse(x, y + BAL.zombieShadowY + groundOffset, BAL.zombieShadowW * s * shadowScale, BAL.zombieShadowH * s * shadowScale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.save();
      ctx.translate(x, y + bob + groundOffset);
      ctx.globalAlpha = corpseFadeAlpha;
      ctx.rotate(face * facing + deathTilt * facing);
      ctx.scale(s * facing * deathScale, s * deathScale);

      ctx.globalAlpha = 0.95 * corpseFadeAlpha;
      ctx.fillStyle = skinTone;
      ctx.strokeStyle = 'rgba(255,255,255,.10)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-12, -6);
      ctx.quadraticCurveTo(-2, -20, 10, -14);
      ctx.quadraticCurveTo(20, -6, 12, 8);
      ctx.quadraticCurveTo(4, 20, -10, 14);
      ctx.quadraticCurveTo(-22, 8, -12, -6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = 'rgba(0,0,0,.62)';
      ctx.fillRect(-5, -6, 2, 2);
      ctx.fillRect(4, -4, 2, 2);

      ctx.fillStyle = 'rgba(30,90,45,.95)';
      ctx.fillRect(-2, 4, 4, 3);

      ctx.lineWidth = 3;
      ctx.strokeStyle = deps.shade(skinTone, -28);
      ctx.beginPath();
      ctx.moveTo(-8, 15);
      ctx.lineTo(-10, 27 + Math.sin(walkPhase + 1.2) * 3);
      ctx.moveTo(7, 15);
      ctx.lineTo(9, 27 + Math.sin(walkPhase + 0.2) * 3);
      ctx.stroke();

      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-14, 2);
      ctx.lineTo(-24, 10 + Math.sin(walkPhase + 0.6) * 2.5);
      ctx.moveTo(13, 4);
      ctx.lineTo(23, 12 + Math.sin(walkPhase + 1.1) * 2.5);
      ctx.stroke();

      if (!DISABLE_ZOMBIE_AURAS && levelBoost > 0 && !isDying) {
        ctx.strokeStyle = 'rgba(185,139,255,.35)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 2, 16 + levelBoost * 1.5, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }

    return {
      drawZombieEntity: drawZombieEntity,
      drawZombieSprite: drawZombieSprite,
      drawZombieFallback: drawZombieFallback,
    };
  }

  global.Game = global.Game || {};
  global.Game.ZombieRender = {
    createController: createController,
  };
})(typeof window !== 'undefined' ? window : this);
