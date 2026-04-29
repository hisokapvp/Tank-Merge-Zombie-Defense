(function (global) {
  'use strict';

  function toPositiveNumber(value, fallback) {
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  function clamp(value, min, max) {
    if (!Number.isFinite(value)) return min;
    if (value < min) return min;
    if (value > max) return max;
    return value;
  }

  function normalizeLevel(level) {
    return Math.max(0, Math.floor(Number.isFinite(level) ? level : 0));
  }

  function resolveStatByFormula(entry, level, fallback) {
    var cfg = entry && typeof entry === 'object' ? entry : {};
    var base = Number.isFinite(cfg.base) ? cfg.base : fallback;
    var perLevel = Number.isFinite(cfg.perLevel) ? cfg.perLevel : 0;
    var result = base + perLevel * Math.max(0, level - 1);
    if (Number.isFinite(cfg.min)) result = Math.max(cfg.min, result);
    if (Number.isFinite(cfg.max)) result = Math.min(cfg.max, result);
    return Math.max(0, Math.round(result));
  }

  function resolveStatsForLevel(config, level) {
    var lvl = normalizeLevel(level);
    var stats = config && config.stats ? config.stats : {};
    return {
      maxHp: resolveStatByFormula(stats.maxHp, lvl, 1000),
      armorFlat: resolveStatByFormula(stats.armorFlat, lvl, 0),
    };
  }

  function getAnimation(config, stateName) {
    var fallback = {
      x: 0,
      y: 0,
      w: 96,
      h: 96,
      frames: 1,
      frameRateFps: 1,
      loop: true,
      scale: 1,
      effects: [],
    };
    if (!config || !config.animations) return fallback;
    var anim = config.animations[stateName] || config.animations.idle || config.animations.work;
    if (!anim || typeof anim !== 'object') return fallback;
    return {
      x: Number.isFinite(anim.x) ? anim.x : fallback.x,
      y: Number.isFinite(anim.y) ? anim.y : fallback.y,
      w: toPositiveNumber(anim.w, fallback.w),
      h: toPositiveNumber(anim.h, fallback.h),
      frames: Math.max(1, Math.floor(toPositiveNumber(anim.frames, fallback.frames))),
      frameRateFps: toPositiveNumber(anim.frameRateFps, fallback.frameRateFps),
      loop: anim.loop !== false,
      scale: toPositiveNumber(anim.scale, fallback.scale),
      effects: Array.isArray(anim.effects) ? anim.effects.slice() : [],
    };
  }

  function computeAnimationDurationSec(config, stateName) {
    var anim = getAnimation(config, stateName);
    return anim.frames / anim.frameRateFps;
  }

  var DEFAULT_HP_BAR_PHASES = [
    {
      minRatio: 0.8,
      fillStart: '#8effbe',
      fillEnd: '#32d38c',
      glow: 'rgba(98,255,172,0.42)',
      frame: 'rgba(168,255,218,0.88)',
      shadow: 'rgba(24,96,68,0.72)',
      pulseAmp: 0.03,
      pulseHz: 1.25,
      scanAlpha: 0.18,
      hazardAlpha: 0.04,
      sparkCount: 1,
      noiseAlpha: 0.04
    },
    {
      minRatio: 0.6,
      fillStart: '#7ff0ff',
      fillEnd: '#2fb6ff',
      glow: 'rgba(76,212,255,0.44)',
      frame: 'rgba(162,236,255,0.9)',
      shadow: 'rgba(18,66,92,0.78)',
      pulseAmp: 0.05,
      pulseHz: 1.8,
      scanAlpha: 0.22,
      hazardAlpha: 0.06,
      sparkCount: 2,
      noiseAlpha: 0.06
    },
    {
      minRatio: 0.4,
      fillStart: '#ffd36f',
      fillEnd: '#ff8f3a',
      glow: 'rgba(255,171,72,0.46)',
      frame: 'rgba(255,224,154,0.92)',
      shadow: 'rgba(98,56,12,0.82)',
      pulseAmp: 0.08,
      pulseHz: 2.4,
      scanAlpha: 0.28,
      hazardAlpha: 0.1,
      sparkCount: 3,
      noiseAlpha: 0.08
    },
    {
      minRatio: 0.2,
      fillStart: '#ff9a62',
      fillEnd: '#ff4d4d',
      glow: 'rgba(255,94,94,0.5)',
      frame: 'rgba(255,194,170,0.94)',
      shadow: 'rgba(116,28,28,0.88)',
      pulseAmp: 0.12,
      pulseHz: 3.1,
      scanAlpha: 0.34,
      hazardAlpha: 0.18,
      sparkCount: 4,
      noiseAlpha: 0.12
    },
    {
      minRatio: 0,
      fillStart: '#ff7d5d',
      fillEnd: '#ff1d1d',
      glow: 'rgba(255,54,54,0.6)',
      frame: 'rgba(255,210,210,0.98)',
      shadow: 'rgba(142,0,0,0.94)',
      pulseAmp: 0.17,
      pulseHz: 4.2,
      scanAlpha: 0.42,
      hazardAlpha: 0.28,
      sparkCount: 5,
      noiseAlpha: 0.18
    }
  ];

  function resolveHpRatio(sc) {
    var maxHp = Math.max(1, Number.isFinite(sc && sc.maxHp) ? sc.maxHp : 1);
    var hp = clamp(Number.isFinite(sc && sc.hp) ? sc.hp : 0, 0, maxHp);
    return hp / maxHp;
  }

  function resolveHpBarPhases(config) {
    var phases = config && config.hpBar && Array.isArray(config.hpBar.phases)
      ? config.hpBar.phases
      : DEFAULT_HP_BAR_PHASES;
    var normalized = [];

    for (var i = 0; i < phases.length; i++) {
      var phase = phases[i] && typeof phases[i] === 'object' ? phases[i] : {};
      normalized.push({
        minRatio: Number.isFinite(phase.minRatio) ? clamp(phase.minRatio, 0, 1) : DEFAULT_HP_BAR_PHASES[Math.min(i, DEFAULT_HP_BAR_PHASES.length - 1)].minRatio,
        fillStart: typeof phase.fillStart === 'string' ? phase.fillStart : DEFAULT_HP_BAR_PHASES[Math.min(i, DEFAULT_HP_BAR_PHASES.length - 1)].fillStart,
        fillEnd: typeof phase.fillEnd === 'string' ? phase.fillEnd : DEFAULT_HP_BAR_PHASES[Math.min(i, DEFAULT_HP_BAR_PHASES.length - 1)].fillEnd,
        glow: typeof phase.glow === 'string' ? phase.glow : DEFAULT_HP_BAR_PHASES[Math.min(i, DEFAULT_HP_BAR_PHASES.length - 1)].glow,
        frame: typeof phase.frame === 'string' ? phase.frame : DEFAULT_HP_BAR_PHASES[Math.min(i, DEFAULT_HP_BAR_PHASES.length - 1)].frame,
        shadow: typeof phase.shadow === 'string' ? phase.shadow : DEFAULT_HP_BAR_PHASES[Math.min(i, DEFAULT_HP_BAR_PHASES.length - 1)].shadow,
        pulseAmp: Number.isFinite(phase.pulseAmp) ? Math.max(0, phase.pulseAmp) : DEFAULT_HP_BAR_PHASES[Math.min(i, DEFAULT_HP_BAR_PHASES.length - 1)].pulseAmp,
        pulseHz: Number.isFinite(phase.pulseHz) ? Math.max(0, phase.pulseHz) : DEFAULT_HP_BAR_PHASES[Math.min(i, DEFAULT_HP_BAR_PHASES.length - 1)].pulseHz,
        scanAlpha: Number.isFinite(phase.scanAlpha) ? clamp(phase.scanAlpha, 0, 1) : DEFAULT_HP_BAR_PHASES[Math.min(i, DEFAULT_HP_BAR_PHASES.length - 1)].scanAlpha,
        hazardAlpha: Number.isFinite(phase.hazardAlpha) ? clamp(phase.hazardAlpha, 0, 1) : DEFAULT_HP_BAR_PHASES[Math.min(i, DEFAULT_HP_BAR_PHASES.length - 1)].hazardAlpha,
        sparkCount: Number.isFinite(phase.sparkCount) ? Math.max(0, Math.floor(phase.sparkCount)) : DEFAULT_HP_BAR_PHASES[Math.min(i, DEFAULT_HP_BAR_PHASES.length - 1)].sparkCount,
        noiseAlpha: Number.isFinite(phase.noiseAlpha) ? clamp(phase.noiseAlpha, 0, 1) : DEFAULT_HP_BAR_PHASES[Math.min(i, DEFAULT_HP_BAR_PHASES.length - 1)].noiseAlpha,
      });
    }

    normalized.sort(function (left, right) { return right.minRatio - left.minRatio; });
    return normalized;
  }

  function resolveHpBarVisual(config, sc, timeSec) {
    var ratio = resolveHpRatio(sc);
    var hasVisibleDamage = Number.isFinite(sc && sc.hp)
      && Number.isFinite(sc && sc.maxHp)
      && sc.maxHp > 0
      && sc.hp < sc.maxHp;
    var phases = resolveHpBarPhases(config);
    var activePhase = phases[phases.length - 1];
    for (var i = 0; i < phases.length; i++) {
      if (ratio >= phases[i].minRatio) {
        activePhase = phases[i];
        break;
      }
    }

    var hpBarCfg = config && config.hpBar ? config.hpBar : {};
    return {
      visible: hasVisibleDamage,
      ratio: ratio,
      width: toPositiveNumber(hpBarCfg.width, 92),
      height: toPositiveNumber(hpBarCfg.height, 8),
      offsetY: Number.isFinite(hpBarCfg.offsetY) ? hpBarCfg.offsetY : -56,
      frameRadius: toPositiveNumber(hpBarCfg.frameRadius, 7),
      pulse: 1 + Math.sin(Math.max(0, Number(timeSec) || 0) * activePhase.pulseHz * Math.PI * 2) * activePhase.pulseAmp,
      phase: activePhase,
    };
  }

  function ensureSupercomputerState(sc, config, maxLevel) {
    if (!sc || typeof sc !== 'object') return null;
    var fallbackLevel = Number.isFinite(maxLevel) ? Math.max(1, Math.floor(maxLevel)) : 60;

    sc.computerLevel = normalizeLevel(sc.computerLevel);
    sc.maxLevel = Number.isFinite(sc.maxLevel) ? Math.max(1, Math.floor(sc.maxLevel)) : fallbackLevel;
    if (sc.computerLevel > sc.maxLevel) sc.computerLevel = sc.maxLevel;

    sc.xp = Number.isFinite(sc.xp) ? Math.max(0, Math.floor(sc.xp)) : 0;
    sc.xpToNext = Number.isFinite(sc.xpToNext)
      ? Math.max(1, Math.floor(sc.xpToNext))
      : (sc.computerLevel <= 0 ? 50 : 500);

    var stats = resolveStatsForLevel(config, sc.computerLevel);
    sc.maxHp = Number.isFinite(sc.maxHp) ? Math.max(1, Math.floor(sc.maxHp)) : stats.maxHp;
    sc.armorFlat = Number.isFinite(sc.armorFlat) ? Math.max(0, Math.floor(sc.armorFlat)) : stats.armorFlat;
    sc.hp = Number.isFinite(sc.hp) ? clamp(Math.round(sc.hp), 0, sc.maxHp) : sc.maxHp;

    sc.state = typeof sc.state === 'string' ? sc.state : 'idle';
    sc.animElapsedSec = Number.isFinite(sc.animElapsedSec) ? Math.max(0, sc.animElapsedSec) : 0;
    sc.glitchLoopsRemaining = Number.isFinite(sc.glitchLoopsRemaining) ? Math.max(0, Math.floor(sc.glitchLoopsRemaining)) : 0;
    sc.glitchCooldownUntil = Number.isFinite(sc.glitchCooldownUntil) ? sc.glitchCooldownUntil : 0;
    sc.wantsBuildTank = !!sc.wantsBuildTank;
    sc.pendingBuildTank = !!sc.pendingBuildTank;
    sc.destroyedAt = Number.isFinite(sc.destroyedAt) ? sc.destroyedAt : 0;

    return sc;
  }

  function applyLevelStats(sc, config, preserveHpPercent) {
    if (!sc) return;
    var prevMax = Math.max(1, Number.isFinite(sc.maxHp) ? sc.maxHp : 1);
    var ratio = clamp(Number.isFinite(preserveHpPercent) ? preserveHpPercent : (sc.hp / prevMax), 0, 1);
    var stats = resolveStatsForLevel(config, sc.computerLevel);
    sc.maxHp = stats.maxHp;
    sc.armorFlat = stats.armorFlat;
    sc.hp = clamp(Math.round(sc.maxHp * ratio), 0, sc.maxHp);
  }

  function finishGlitch(sc) {
    sc.glitchLoopsRemaining = 0;
    sc.animElapsedSec = 0;
    if (sc.pendingBuildTank || sc.wantsBuildTank) {
      sc.pendingBuildTank = false;
      sc.state = 'buildTank';
      return;
    }
    sc.pendingBuildTank = false;
    sc.state = 'idle';
  }

  function maybeStartGlitch(sc, config, randomFn, nowSec, dt) {
    if (!config || !config.glitch || sc.state === 'destroyed' || sc.state === 'destroy') return;
    if (!Number.isFinite(sc.hp) || sc.hp <= 0) return;
    if (sc.state === 'glitch') return;
    if (sc.state === 'buildTank') return;
    if (nowSec < sc.glitchCooldownUntil) return;

    var glitch = config.glitch;
    var chancePerSecond = Number.isFinite(glitch.chancePerSecond) ? Math.max(0, glitch.chancePerSecond) : 0;
    if (chancePerSecond <= 0) return;

    var dtSafe = Number.isFinite(dt) ? Math.max(0, dt) : 0;
    var chanceThisTick = 1 - Math.exp(-chancePerSecond * dtSafe);
    var roll = typeof randomFn === 'function' ? randomFn() : Math.random();
    if (roll >= chanceThisTick) return;

    var minLoops = Number.isFinite(glitch.minLoops) ? Math.max(1, Math.floor(glitch.minLoops)) : 1;
    var maxLoops = Number.isFinite(glitch.maxLoops) ? Math.max(minLoops, Math.floor(glitch.maxLoops)) : minLoops;
    var loops = minLoops;
    if (maxLoops > minLoops) {
      var span = maxLoops - minLoops + 1;
      loops = minLoops + Math.floor((typeof randomFn === 'function' ? randomFn() : Math.random()) * span);
    }

    sc.state = 'glitch';
    sc.animElapsedSec = 0;
    sc.glitchLoopsRemaining = loops;
    sc.glitchCooldownUntil = nowSec + (Number.isFinite(glitch.cooldownSec) ? Math.max(0, glitch.cooldownSec) : 0);
  }

  function stepAnimation(sc, config, dt, nowSec, randomFn) {
    if (!sc || sc.state === 'destroyed') return;

    maybeStartGlitch(sc, config, randomFn, nowSec, dt);

    if (sc.state !== 'glitch' && sc.wantsBuildTank) {
      sc.state = 'buildTank';
      sc.animElapsedSec = 0;
    }

    var animState = sc.state;
    var durationSec = computeAnimationDurationSec(config, animState);
    sc.animElapsedSec += Math.max(0, dt);

    if (animState === 'glitch' && durationSec > 0) {
      while (sc.animElapsedSec >= durationSec && sc.glitchLoopsRemaining > 0) {
        sc.animElapsedSec -= durationSec;
        sc.glitchLoopsRemaining -= 1;
      }
      if (sc.glitchLoopsRemaining <= 0) {
        finishGlitch(sc);
      }
      return;
    }

    if (animState === 'buildTank') {
      if (!sc.wantsBuildTank) {
        sc.state = 'idle';
        sc.animElapsedSec = 0;
      }
      return;
    }

    if (animState === 'destroy' && durationSec > 0) {
      if (sc.animElapsedSec >= durationSec) {
        sc.state = 'destroyed';
        sc.animElapsedSec = durationSec;
      }
    }
  }

  function createController(options) {
    var opts = options || {};
    var nowSec = typeof opts.nowSec === 'function' ? opts.nowSec : function () { return 0; };
    var randomFn = typeof opts.random === 'function' ? opts.random : Math.random;

    function syncLevel(sc, config) {
      ensureSupercomputerState(sc, config, opts.maxLevel);
      applyLevelStats(sc, config);
    }

    function onLevelChanged(sc, config, oldMaxHp) {
      ensureSupercomputerState(sc, config, opts.maxLevel);
      var prevMax = Number.isFinite(oldMaxHp) && oldMaxHp > 0 ? oldMaxHp : sc.maxHp;
      var ratio = clamp(sc.hp / Math.max(1, prevMax), 0, 1);
      applyLevelStats(sc, config, ratio);
    }

    function setWantsBuildTank(sc, wantsBuildTank) {
      if (!sc) return;
      sc.wantsBuildTank = !!wantsBuildTank;
      if (sc.state === 'glitch' && sc.wantsBuildTank) sc.pendingBuildTank = true;
      if (!sc.wantsBuildTank) sc.pendingBuildTank = false;
      if (!sc.wantsBuildTank && sc.state === 'buildTank') {
        sc.state = 'idle';
        sc.animElapsedSec = 0;
      }
    }

    function applyDamage(sc, baseDamage, config) {
      ensureSupercomputerState(sc, config, opts.maxLevel);
      if (!sc || sc.state === 'destroyed' || sc.state === 'destroy') {
        return { finalDamage: 0, hp: sc ? sc.hp : 0, destroyedNow: false };
      }

      var incoming = Number.isFinite(baseDamage) ? Math.max(0, baseDamage) : 0;
      var armorFlat = Number.isFinite(sc.armorFlat) ? Math.max(0, sc.armorFlat) : 0;
      var finalDamage = Math.max(0, incoming - armorFlat);
      var beforeHp = sc.hp;
      sc.hp = Math.max(0, sc.hp - finalDamage);
      var destroyedNow = beforeHp > 0 && sc.hp === 0;

      if (destroyedNow) {
        sc.state = 'destroy';
        sc.animElapsedSec = 0;
        sc.pendingBuildTank = false;
        sc.wantsBuildTank = false;
        sc.glitchLoopsRemaining = 0;
        sc.destroyedAt = nowSec();
      }

      return {
        finalDamage: finalDamage,
        hp: sc.hp,
        destroyedNow: destroyedNow,
      };
    }

    function step(sc, dt, config) {
      ensureSupercomputerState(sc, config, opts.maxLevel);
      stepAnimation(sc, config, dt, nowSec(), randomFn);
    }

    return {
      ensureSupercomputerState: ensureSupercomputerState,
      resolveStatsForLevel: resolveStatsForLevel,
      getAnimation: getAnimation,
      resolveHpBarVisual: resolveHpBarVisual,
      syncLevel: syncLevel,
      onLevelChanged: onLevelChanged,
      setWantsBuildTank: setWantsBuildTank,
      applyDamage: applyDamage,
      step: step,
    };
  }

  global.Game = global.Game || {};
  global.Game.Supercomputer = {
    resolveStatsForLevel: resolveStatsForLevel,
    resolveHpBarVisual: resolveHpBarVisual,
    createController: createController,
  };
})(typeof window !== 'undefined' ? window : this);
