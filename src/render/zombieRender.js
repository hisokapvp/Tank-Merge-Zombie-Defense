(function (global) {
  'use strict';

  var DISABLE_ZOMBIE_AURAS = true;

  function createController(deps) {
    deps = deps || {};

    function drawZombieEntity(z, x, y) {
      var ZombieSprites = deps.getZombieSprites();
      if (ZombieSprites.ready && ZombieSprites.atlasImg && z.type) {
        drawZombieSprite(x, y, z);
      } else {
        drawZombieFallback(x, y, z);
      }
    }

    function drawZombieSprite(x, y, z) {
      var ctx = deps.getCtx();
      var ZombieSprites = deps.getZombieSprites();
      var BAL = deps.getBalance();
      var img = ZombieSprites.atlasImg;
      var t = z.type;
      var f = t.frame;
      var a = t.anchor;
      var center = deps.getCenter();
      var facing = x >= center.x ? -1 : 1;

      var isDying = z.state === 'dying';
      var hasDeathAnim = isDying && z.deathAnim;
      var hasAttackAnim = !isDying && z.attackState === 'attack' && t.attack;

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

      var scale = (t.scale ?? 1.0) * BAL.zombieScaleMul * deps.zombieLevelScale(z);
      var baseW = hasDeathAnim ? z.deathAnim.w : (hasAttackAnim ? t.attack.w : f.w);
      var baseH = hasDeathAnim ? z.deathAnim.h : (hasAttackAnim ? t.attack.h : f.h);
      var w = baseW * scale;
      var h = baseH * scale;

      var walkPhase = z.walkAnimFrame || z.anim || 0;
      var bobPhase = hasAttackAnim ? (z.attackAnimTimeSec || 0) * Math.max(0.01, z.attackFrameRateFps || deps.getZombieDefaultAttackFps()) : walkPhase;
      var bob = hasDeathAnim ? 0 : Math.sin(bobPhase) * BAL.zombieBobAmp;
      var groundOffset = BAL.zombieGroundOffset * deps.zombieLevelScale(z);
      var face = z.heading ?? (z.theta + (z.omega >= 0 ? Math.PI / 2 : -Math.PI / 2));
      var rot = face + (t.rotation ?? 0);

      var death = isDying ? (z.deathProgress ?? 0) : 0;
      var deathScale = hasDeathAnim ? 1 : (1 - death * 0.22);
      var deathTilt = hasDeathAnim ? 0 : (death * 1.1);
      var deathAlpha = 1;

      var state = deps.getState();
      var qualityLow = deps.isQualityLow();
      if (!DISABLE_ZOMBIE_AURAS && state.endgameVisuals && !isDying) {
        ctx.save();
        ctx.translate(x, y + bob + groundOffset);
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
          x,
          y + BAL.zombieShadowY + groundOffset,
          BAL.zombieShadowW * scale,
          BAL.zombieShadowH * scale,
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
        ctx.arc(x, y + bob + groundOffset, w * 0.36, 0, Math.PI * 2);
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
      var levelBoost = deps.clamp((z.level ?? 1) - 1, 0, 6);
      var isDying = z.state === 'dying';
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
        ctx.ellipse(x, y + BAL.zombieShadowY + groundOffset, BAL.zombieShadowW * s, BAL.zombieShadowH * s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.save();
      ctx.translate(x, y + bob + groundOffset);
      ctx.globalAlpha = 1;
      ctx.rotate(face * facing + deathTilt * facing);
      ctx.scale(s * facing * deathScale, s * deathScale);

      ctx.globalAlpha = 0.95;
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
