(function (global) {
  'use strict';

  function createController(deps) {
    deps = deps || {};

    function getWorldEventsAttackCfg() {
      var WorldEventsCfg = deps.getWorldEventsCfg();
      var state = deps.getState();
      var cfg = WorldEventsCfg && WorldEventsCfg.attackMode ? WorldEventsCfg.attackMode : {};
      var idleWaveCfg = cfg && cfg.idleWave && typeof cfg.idleWave === 'object' ? cfg.idleWave : {};
      var debugForceAttack = !!(state && state.debug && (
        typeof state.debug.forceAttackMode === 'boolean'
          ? state.debug.forceAttackMode
          : (typeof state.debug.forceDisableAttackMode === 'boolean' ? !state.debug.forceDisableAttackMode : false)
      ));
      var autoEnabled = !!(WorldEventsCfg && WorldEventsCfg.enabled && cfg.enabled);
      return {
        enabled: autoEnabled,
        forceEnabled: debugForceAttack,
        attackEverySec: Number.isFinite(cfg.attackEverySec) ? Math.max(1, cfg.attackEverySec) : 75,
        attackDurationSec: Number.isFinite(cfg.attackDurationSec) ? Math.max(1, cfg.attackDurationSec) : 20,
        weatherLeadInSec: Number.isFinite(cfg.weatherLeadInSec) ? Math.max(0, cfg.weatherLeadInSec) : 5,
        weatherLeadOutSec: Number.isFinite(cfg.weatherLeadOutSec) ? Math.max(0, cfg.weatherLeadOutSec) : 3,
        targetAliveMult: Number.isFinite(cfg.targetAliveMult) ? Math.max(0.1, cfg.targetAliveMult) : 1,
        targetAliveRampSec: Number.isFinite(cfg.targetAliveRampSec) ? Math.max(0, cfg.targetAliveRampSec) : 2,
        speedMult: Number.isFinite(cfg.speedMult) ? Math.max(0.1, cfg.speedMult) : 1,
        damageMult: Number.isFinite(cfg.damageMult) ? Math.max(0.1, cfg.damageMult) : 1,
        idleWave: {
          enabled: autoEnabled && idleWaveCfg.enabled !== false,
          attackDamageMul: Number.isFinite(idleWaveCfg.attackDamageMul) ? Math.max(0, idleWaveCfg.attackDamageMul) : 0.01,
          betweenWavesSec: Number.isFinite(idleWaveCfg.betweenWavesSec) ? Math.max(0, idleWaveCfg.betweenWavesSec) : 12,
          attackDurationSec: Number.isFinite(idleWaveCfg.attackDurationSec) ? Math.max(0, idleWaveCfg.attackDurationSec) : 4,
          wanderDurationSec: Number.isFinite(idleWaveCfg.wanderDurationSec) ? Math.max(0, idleWaveCfg.wanderDurationSec) : 8,
          retreatDistanceMinPx: Number.isFinite(idleWaveCfg.retreatDistanceMinPx) ? Math.max(0, idleWaveCfg.retreatDistanceMinPx) : 30,
          retreatDistanceMaxPx: Number.isFinite(idleWaveCfg.retreatDistanceMaxPx)
            ? Math.max(
                Number.isFinite(idleWaveCfg.retreatDistanceMinPx) ? Math.max(0, idleWaveCfg.retreatDistanceMinPx) : 30,
                idleWaveCfg.retreatDistanceMaxPx
              )
            : Math.max(
                Number.isFinite(idleWaveCfg.retreatDistanceMinPx) ? Math.max(0, idleWaveCfg.retreatDistanceMinPx) : 30,
                50
              ),
        },
        safeWaves: Number.isFinite(cfg.safeWaves) ? Math.max(0, Math.floor(cfg.safeWaves)) : 3,
        eveningDimAlpha: Number.isFinite(cfg.eveningDimAlpha) ? deps.clamp(cfg.eveningDimAlpha, 0, 1) : 0.16,
        eveningTransitionSec: Number.isFinite(cfg.eveningTransitionSec) ? deps.clamp(cfg.eveningTransitionSec, 0.1, 30) : 4,
      };
    }

    function getWeatherCfg() {
      var WorldEventsCfg = deps.getWorldEventsCfg();
      var state = deps.getState();
      var cfg = WorldEventsCfg && WorldEventsCfg.weather ? WorldEventsCfg.weather : {};
      var lightning = cfg.lightning || {};
      var rain = cfg.rain || {};
      var debugForceWeather = !!(state && state.debug && (
        typeof state.debug.forceWeather === 'boolean'
          ? state.debug.forceWeather
          : (typeof state.debug.forceDisableWeather === 'boolean' ? !state.debug.forceDisableWeather : false)
      ));
      var hasInterval = Number.isFinite(lightning.intervalMinSec) || Number.isFinite(lightning.intervalMaxSec);
      var minSec = Number.isFinite(lightning.intervalMinSec) ? Math.max(0.1, lightning.intervalMinSec) : 8;
      var maxSec = Number.isFinite(lightning.intervalMaxSec) ? Math.max(minSec, lightning.intervalMaxSec) : Math.max(minSec, 20);
      var rainLoopSources = deps.normalizedSfxSources(
        rain.sfxLoopSources,
        deps.normalizedSfxSources(rain.sfxLoopFile, deps.getDefaultRainLoopSources())
      );
      var autoEnabled = !!(WorldEventsCfg && WorldEventsCfg.enabled && cfg.enabled);
      var forceAttack = !!(state && state.debug && (
        typeof state.debug.forceAttackMode === 'boolean'
          ? state.debug.forceAttackMode
          : (typeof state.debug.forceDisableAttackMode === 'boolean' ? !state.debug.forceDisableAttackMode : false)
      ));
      return {
        enabled: autoEnabled || debugForceWeather || forceAttack,
        forceEnabled: debugForceWeather,
        rain: Object.assign({}, rain, {
          sfxLoopSources: rainLoopSources,
        }),
        lightning: Object.assign({}, lightning, {
          intervalMinSec: minSec,
          intervalMaxSec: maxSec,
          useInterval: hasInterval,
        }),
        thunder: cfg.thunder || {},
      };
    }

    function configureRainLoopSfx(rainCfg) {
      var rain = rainCfg || {};
      var sources = deps.normalizedSfxSources(
        rain.sfxLoopSources,
        deps.normalizedSfxSources(rain.sfxLoopFile, deps.getDefaultRainLoopSources())
      );
      deps.setSfxSources('rainLoop', sources);
    }

    function scheduleNextLightning(now, lightningCfg) {
      var worldEventsState = deps.getWorldEventsState();
      var minSec = Number.isFinite(lightningCfg && lightningCfg.intervalMinSec) ? Math.max(0.1, lightningCfg.intervalMinSec) : 8;
      var maxSec = Number.isFinite(lightningCfg && lightningCfg.intervalMaxSec) ? Math.max(minSec, lightningCfg.intervalMaxSec) : Math.max(minSec, 20);
      var delay = minSec + Math.random() * (maxSec - minSec);
      worldEventsState.nextLightningAt = now + delay;
    }

    function pickAttackEpisodeDirections(worldEventsState) {
      // choose primary dir (0..7) excluding previous if primary streak == 2
      var prev = Number.isFinite(worldEventsState.attackSpawnPrevPrimaryDir) ? worldEventsState.attackSpawnPrevPrimaryDir : null;
      var prevStreak = Number.isFinite(worldEventsState.attackSpawnPrimaryStreak) ? Math.max(0, Math.floor(worldEventsState.attackSpawnPrimaryStreak)) : 0;
      var choices = [];
      for (var d = 0; d < 8; d++) choices.push(d);
      if (prev != null && prevStreak >= 2) {
        choices = choices.filter(function (x) { return x !== prev; });
      }
      var idx = Math.floor(Math.random() * choices.length);
      var dirA = choices[idx];

      // pick B and C different from A
      var rest = [];
      for (var d2 = 0; d2 < 8; d2++) if (d2 !== dirA) rest.push(d2);
      // shuffle rest minimally
      for (var i = rest.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = rest[i]; rest[i] = rest[j]; rest[j] = tmp;
      }
      var dirB = rest[0];
      var dirC = rest[1] || rest[0];

      worldEventsState.attackSpawnDirA = dirA;
      worldEventsState.attackSpawnDirB = dirB;
      worldEventsState.attackSpawnDirC = dirC;
      worldEventsState.attackSpawnEpisodeKey = (worldEventsState.attackSpawnEpisodeKey || 0) + 1;

      if (prev == dirA) {
        worldEventsState.attackSpawnPrimaryStreak = prevStreak + 1;
      } else {
        worldEventsState.attackSpawnPrimaryStreak = 1;
        worldEventsState.attackSpawnPrevPrimaryDir = dirA;
      }
    }

    function resetAttackEpisodeRuntime(worldEventsState) {
      worldEventsState.attackSpawnDirA = null;
      worldEventsState.attackSpawnDirB = null;
      worldEventsState.attackSpawnDirC = null;
      worldEventsState.attackSpawnPrevPrimaryDir = null;
      worldEventsState.attackSpawnPrimaryStreak = 0;
      worldEventsState.attackSpawnEpisodeKey = null;
    }

    function processWeatherLightning(now, dt, weatherCfg) {
      var worldEventsState = deps.getWorldEventsState();
      var lightningCfg = weatherCfg && weatherCfg.lightning ? weatherCfg.lightning : {};
      if (!worldEventsState.weatherEnabled || !lightningCfg.enabled) return;

      var flashDur = Number.isFinite(lightningCfg.flashDurationSec) ? Math.max(0.03, lightningCfg.flashDurationSec) : 0.12;
      var shouldFlash = false;
      if (lightningCfg.useInterval) {
        if (!Number.isFinite(worldEventsState.nextLightningAt) || worldEventsState.nextLightningAt <= 0) {
          scheduleNextLightning(now, lightningCfg);
        }
        if (now >= worldEventsState.nextLightningAt) {
          shouldFlash = true;
          scheduleNextLightning(now, lightningCfg);
        }
      } else {
        var chancePerSec = Number.isFinite(lightningCfg.chancePerSec) ? Math.max(0, lightningCfg.chancePerSec) : 0.14;
        if (now >= (worldEventsState.lightningUntil || 0) && Math.random() < chancePerSec * Math.max(0.001, dt)) {
          shouldFlash = true;
        }
      }

      if (!shouldFlash) return;
      worldEventsState.lightningUntil = now + flashDur;
      if (weatherCfg.thunder && weatherCfg.thunder.enabled) {
        deps.playSfx(weatherCfg.thunder.sfxId || 'thunder');
      }
    }

    function isZombieAttackModeActive() {
      var worldEventsState = deps.getWorldEventsState();
      var attackCfg = getWorldEventsAttackCfg();
      if (attackCfg.forceEnabled) return true;
      return deps.nowSec() < (worldEventsState.attackEndAt || 0);
    }

    function desiredAliveMultTarget(attackCfg) {
      var cfg = attackCfg || getWorldEventsAttackCfg();
      var attackActive = isZombieAttackModeActive();
      var enabled = !!(cfg.enabled || cfg.forceEnabled);
      if (!enabled || !attackActive) return 1;
      return Number.isFinite(cfg.targetAliveMult) ? Math.max(0, cfg.targetAliveMult) : 1;
    }

    function updateDesiredAliveMultCurrent(dt, attackCfg) {
      var worldEventsState = deps.getWorldEventsState();
      var cfg = attackCfg || getWorldEventsAttackCfg();
      var target = desiredAliveMultTarget(cfg);
      var rampSec = Number.isFinite(cfg.targetAliveRampSec) ? Math.max(0, cfg.targetAliveRampSec) : 0;
      var safeDt = Number.isFinite(dt) ? Math.max(0, dt) : 0;
      var currentRaw = Number.isFinite(worldEventsState.aliveMultCurrent) ? worldEventsState.aliveMultCurrent : 1;
      var current = Math.max(0, currentRaw);

      var next = target;
      if (rampSec > 0 && safeDt > 0) {
        var delta = target - current;
        var speed = Math.abs(delta) / rampSec;
        var step = speed * safeDt;
        if (step >= Math.abs(delta)) next = target;
        else next = current + Math.sign(delta) * step;
      }

      if (!Number.isFinite(next)) next = target;
      worldEventsState.aliveMultCurrent = Math.max(0, next);
    }

    function getZombieAttackMultipliers() {
      var worldEventsState = deps.getWorldEventsState();
      var attackCfg = getWorldEventsAttackCfg();
      var attackActive = isZombieAttackModeActive();
      var aliveMultCurrent = Number.isFinite(worldEventsState.aliveMultCurrent)
        ? Math.max(0, worldEventsState.aliveMultCurrent)
        : 1;
      if ((!attackCfg.enabled && !attackCfg.forceEnabled) || !attackActive) {
        return { targetAliveMult: aliveMultCurrent, speedMult: 1, damageMult: 1 };
      }
      return {
        targetAliveMult: aliveMultCurrent,
        speedMult: attackCfg.speedMult,
        damageMult: attackCfg.damageMult,
      };
    }

    function resetIdleWaveRuntime(worldEventsState, nextPhase, nextAt) {
      if (!worldEventsState || typeof worldEventsState !== 'object') return;
      worldEventsState.idleWavePhase = typeof nextPhase === 'string' ? nextPhase : 'inactive';
      worldEventsState.idleWaveNextTransitionAt = Number.isFinite(nextAt) ? nextAt : 0;
    }

    function updateIdleWaveState(now, attackCfg) {
      var worldEventsState = deps.getWorldEventsState();
      var idleCfg = attackCfg && attackCfg.idleWave ? attackCfg.idleWave : null;
      if (!worldEventsState || !idleCfg || !idleCfg.enabled) {
        resetIdleWaveRuntime(worldEventsState, 'inactive', 0);
        return;
      }
      if (isZombieAttackModeActive()) {
        resetIdleWaveRuntime(worldEventsState, 'suppressed', 0);
        return;
      }

      var phase = typeof worldEventsState.idleWavePhase === 'string' ? worldEventsState.idleWavePhase : 'between';
      var nextAt = Number.isFinite(worldEventsState.idleWaveNextTransitionAt) ? worldEventsState.idleWaveNextTransitionAt : 0;
      if (phase === 'inactive' || phase === 'suppressed' || nextAt <= 0) {
        phase = 'between';
        nextAt = now + idleCfg.betweenWavesSec;
      }

      var guard = 0;
      while (now >= nextAt && guard < 6) {
        if (phase === 'between') {
          phase = 'attack';
          nextAt += Math.max(0.05, idleCfg.attackDurationSec);
        } else if (phase === 'attack') {
          phase = 'wander';
          nextAt += Math.max(0.05, idleCfg.wanderDurationSec);
        } else {
          phase = 'between';
          nextAt += Math.max(0.05, idleCfg.betweenWavesSec);
        }
        guard++;
      }

      worldEventsState.idleWavePhase = phase;
      worldEventsState.idleWaveNextTransitionAt = nextAt;
    }

    function getZombieIdleWavePhase() {
      var worldEventsState = deps.getWorldEventsState();
      return worldEventsState && typeof worldEventsState.idleWavePhase === 'string'
        ? worldEventsState.idleWavePhase
        : 'inactive';
    }

    function isZombieIdleWaveAttackActive() {
      var attackCfg = getWorldEventsAttackCfg();
      if (!attackCfg.idleWave || !attackCfg.idleWave.enabled) return false;
      if (isZombieAttackModeActive()) return false;
      return getZombieIdleWavePhase() === 'attack';
    }

    function shouldZombieAttemptAttack() {
      return isZombieAttackModeActive() || isZombieIdleWaveAttackActive();
    }

    function getZombieFenceAttackDamageMul() {
      var attackCfg = getWorldEventsAttackCfg();
      if (isZombieAttackModeActive()) return attackCfg.damageMult;
      if (isZombieIdleWaveAttackActive()) return attackCfg.idleWave.attackDamageMul;
      return 0;
    }

    function getZombieIdleRetreatOffsetPx(zombie) {
      var attackCfg = getWorldEventsAttackCfg();
      var idleCfg = attackCfg && attackCfg.idleWave ? attackCfg.idleWave : null;
      if (!idleCfg || !idleCfg.enabled || isZombieAttackModeActive() || isZombieIdleWaveAttackActive()) return 0;
      if (!zombie || typeof zombie !== 'object') {
        return (idleCfg.retreatDistanceMinPx + idleCfg.retreatDistanceMaxPx) * 0.5;
      }
      if (!Number.isFinite(zombie.idleWaveRetreatPx)) {
        var anchorSeed = Number.isFinite(zombie.anchorTheta) ? Math.abs(Math.sin(zombie.anchorTheta * 13.37)) : Math.random();
        zombie.idleWaveRetreatPx = idleCfg.retreatDistanceMinPx
          + (idleCfg.retreatDistanceMaxPx - idleCfg.retreatDistanceMinPx) * anchorSeed;
      }
      return zombie.idleWaveRetreatPx;
    }

    function updateWorldEvents(dt) {
      var worldEventsState = deps.getWorldEventsState();
      var state = deps.getState();
      var wasAttackActive = isZombieAttackModeActive();
      var attackCfg = getWorldEventsAttackCfg();
      var weatherCfg = getWeatherCfg();
      var rainCfg = weatherCfg.rain || {};
      configureRainLoopSfx(rainCfg);
      var now = deps.nowSec();
      var prevWeatherEnabled = !!worldEventsState.weatherEnabled;

      var attackAutoEnabled = !!attackCfg.enabled;
      var forceAttackEnabled = !!attackCfg.forceEnabled;

      if (forceAttackEnabled) {
        if (!worldEventsState.forceAttackActive) {
          worldEventsState.currentAttackStartAt = now;
        }
        worldEventsState.forceAttackActive = true;
        worldEventsState.attackEndAt = Number.POSITIVE_INFINITY;
      } else if (!attackAutoEnabled) {
        worldEventsState.forceAttackActive = false;
        worldEventsState.currentAttackStartAt = 0;
        worldEventsState.attackEndAt = 0;
        worldEventsState.weatherUntil = 0;
        worldEventsState.weatherEnabled = !!(weatherCfg.enabled || weatherCfg.forceEnabled);
      } else {
        if (worldEventsState.forceAttackActive) {
          worldEventsState.currentAttackStartAt = 0;
          worldEventsState.attackEndAt = 0;
          worldEventsState.attackStartAt = now + attackCfg.attackEverySec;
        }
        worldEventsState.forceAttackActive = false;
        if (!Number.isFinite(worldEventsState.attackStartAt) || worldEventsState.attackStartAt <= 0) {
          worldEventsState.attackStartAt = now + attackCfg.attackEverySec;
        }

        if (now >= worldEventsState.attackStartAt) {
          var startAt = worldEventsState.attackStartAt;
          worldEventsState.currentAttackStartAt = startAt;
          worldEventsState.attackEndAt = startAt + attackCfg.attackDurationSec;
          worldEventsState.attackStartAt = startAt + attackCfg.attackEverySec;
          worldEventsState.waveNumber = Math.max(0, Math.floor(worldEventsState.waveNumber || 0)) + 1;
          if (worldEventsState.waveNumber > attackCfg.safeWaves) {
            state.zombieWaveAtkMult = Math.max(0, Number.isFinite(state.zombieWaveAtkMult) ? state.zombieWaveAtkMult : 1) * 1.05;
          }
        }

        if (worldEventsState.attackEndAt > 0 && now >= worldEventsState.attackEndAt) {
          worldEventsState.currentAttackStartAt = 0;
        }

        var inLeadIn = now >= (worldEventsState.attackStartAt - attackCfg.weatherLeadInSec) && now < worldEventsState.attackStartAt;
        var inAttackWindow = worldEventsState.currentAttackStartAt > 0 && now >= worldEventsState.currentAttackStartAt && now < worldEventsState.attackEndAt;
        var inLeadOut = inAttackWindow && now >= (worldEventsState.attackEndAt - attackCfg.weatherLeadOutSec);
        worldEventsState.weatherEnabled = weatherCfg.enabled && (inLeadIn || (inAttackWindow && !inLeadOut));
      }

      if (forceAttackEnabled) {
        worldEventsState.weatherEnabled = true;
      }
      if (weatherCfg.forceEnabled) {
        worldEventsState.weatherEnabled = true;
      }

      var attackActiveNow = isZombieAttackModeActive();
      if (attackActiveNow && !wasAttackActive) {
        if (!Number.isFinite(worldEventsState.attackSpawnPrimaryStreak)) worldEventsState.attackSpawnPrimaryStreak = 0;
        pickAttackEpisodeDirections(worldEventsState);
      }

      updateIdleWaveState(now, attackCfg);

      updateDesiredAliveMultCurrent(dt, attackCfg);

      if (!worldEventsState.weatherEnabled) {
        worldEventsState.lightningUntil = 0;
        worldEventsState.nextLightningAt = 0;
      }

      var rainActive = !!(worldEventsState.weatherEnabled && rainCfg.enabled !== false);
      if (!prevWeatherEnabled && rainActive) {
        worldEventsState.rainBlend = 0;
        deps.playLoopSfx('rainLoop', 0);
      }
      if (prevWeatherEnabled && !rainActive) {
        worldEventsState.rainBlend = 0;
        deps.stopLoopSfx('rainLoop');
      }

      if (rainActive) {
        var rainTransitionSec = Number.isFinite(attackCfg.eveningTransitionSec) ? Math.max(0.1, attackCfg.eveningTransitionSec) : 4;
        var rainStep = Math.min(1, Math.max(0, dt) / rainTransitionSec);
        worldEventsState.rainBlend = deps.clamp((worldEventsState.rainBlend || 0) + rainStep, 0, 1);
        deps.setLoopSfxVolume('rainLoop', worldEventsState.rainBlend);
      }

      processWeatherLightning(now, dt, weatherCfg);

      var attackActive = isZombieAttackModeActive();
      var eveningTarget = attackActive ? 1 : 0;
      var transitionSec = Number.isFinite(attackCfg.eveningTransitionSec) ? Math.max(0.1, attackCfg.eveningTransitionSec) : 4;
      var blend = Number.isFinite(worldEventsState.eveningDimBlend) ? worldEventsState.eveningDimBlend : 0;
      var step = Math.min(1, Math.max(0, dt) / transitionSec);
      worldEventsState.eveningDimBlend = blend + (eveningTarget - blend) * step;
    }

    function ensureRainCache(requiredCount) {
      var rainCache = deps.getRainCache();
      var count = Math.max(0, Math.floor(requiredCount));
      if (rainCache.maxDrops >= count) return;
      for (var i = rainCache.maxDrops; i < count; i++) {
        rainCache.x[i] = Math.random();
        rainCache.y[i] = Math.random();
        rainCache.speed[i] = 0.65 + Math.random() * 0.7;
        rainCache.len[i] = 0.7 + Math.random() * 0.8;
      }
      rainCache.maxDrops = count;
    }

    function drawWeather() {
      var worldEventsState = deps.getWorldEventsState();
      var weatherCfg = getWeatherCfg();
      if (!weatherCfg.enabled || !worldEventsState.weatherEnabled) return;

      var rainCfg = weatherCfg.rain || {};
      if (rainCfg.enabled !== false) {
        var density = Number.isFinite(rainCfg.density) ? Math.max(0, rainCfg.density) : 0.16;
        var dropCount = Math.floor(deps.getViewSize().w * density);
        ensureRainCache(dropCount);
        var speedMin = Number.isFinite(rainCfg.speedMin) ? rainCfg.speedMin : 520;
        var speedMax = Number.isFinite(rainCfg.speedMax) ? rainCfg.speedMax : 760;
        var lenMin = Number.isFinite(rainCfg.lengthMin) ? rainCfg.lengthMin : 10;
        var lenMax = Number.isFinite(rainCfg.lengthMax) ? rainCfg.lengthMax : 18;
        var alpha = Number.isFinite(rainCfg.alpha) ? deps.clamp(rainCfg.alpha, 0.05, 0.6) : 0.26;
        var rainBlend = deps.clamp(worldEventsState.rainBlend || 0, 0, 1);
        var effectiveAlpha = alpha * rainBlend;
        if (effectiveAlpha >= 0.01) {
          var rainCache = deps.getRainCache();
          var t = deps.nowSec();
          var viewSize = deps.getViewSize();
          var ctx = deps.getCtx();
          ctx.save();
          ctx.strokeStyle = 'rgba(180,205,255,' + effectiveAlpha + ')';
          ctx.lineWidth = 1;
          ctx.lineCap = 'round';
          for (var i = 0; i < dropCount; i++) {
            var sx = rainCache.x[i] * viewSize.w;
            var speed = speedMin + (speedMax - speedMin) * rainCache.speed[i];
            var y = ((rainCache.y[i] * (viewSize.h + 30)) + (t * speed)) % (viewSize.h + 30) - 20;
            var len = lenMin + (lenMax - lenMin) * rainCache.len[i];
            ctx.beginPath();
            ctx.moveTo(sx, y);
            ctx.lineTo(sx - len * 0.22, y + len);
            ctx.stroke();
          }
          ctx.restore();
        }
      }

      if (deps.nowSec() < (worldEventsState.lightningUntil || 0)) {
        var ctx = deps.getCtx();
        var viewSize = deps.getViewSize();
        ctx.save();
        ctx.fillStyle = 'rgba(228,238,255,0.22)';
        ctx.fillRect(0, 0, viewSize.w, viewSize.h);
        ctx.restore();
      }
    }

    function forceDisableAttackModeRuntime(worldEventsStateOverride) {
      var worldEventsState = worldEventsStateOverride || deps.getWorldEventsState();
      if (!worldEventsState || typeof worldEventsState !== 'object') return;
      var state = deps.getState();
      // disable attack windows and weather
      worldEventsState.forceAttackActive = false;
      worldEventsState.attackStartAt = 0;
      worldEventsState.currentAttackStartAt = 0;
      worldEventsState.attackEndAt = 0;
      worldEventsState.weatherEnabled = false;
      worldEventsState.weatherUntil = 0;
      worldEventsState.lightningUntil = 0;
      worldEventsState.nextLightningAt = 0;
      worldEventsState.rainBlend = 0;
      worldEventsState.aliveMultCurrent = 1;
      worldEventsState.eveningDimBlend = 0;
      worldEventsState.waveNumber = 0;
      resetIdleWaveRuntime(worldEventsState, 'inactive', 0);
      resetAttackEpisodeRuntime(worldEventsState);
      if (state && typeof state === 'object') {
        state.zombieWaveAtkMult = 1;
      }
      // stop loop sfx that may run
      if (typeof deps.stopLoopSfx === 'function') {
        try { deps.stopLoopSfx('rainLoop'); } catch (e) {}
        try { deps.stopLoopSfx('attackLoop'); } catch (e) {}
        try { deps.stopLoopSfx('worldEventsLoop'); } catch (e) {}
      }
    }

    return {
      getWorldEventsAttackCfg: getWorldEventsAttackCfg,
      getWeatherCfg: getWeatherCfg,
      configureRainLoopSfx: configureRainLoopSfx,
      scheduleNextLightning: scheduleNextLightning,
      processWeatherLightning: processWeatherLightning,
      isZombieAttackModeActive: isZombieAttackModeActive,
      desiredAliveMultTarget: desiredAliveMultTarget,
      updateDesiredAliveMultCurrent: updateDesiredAliveMultCurrent,
      getZombieAttackMultipliers: getZombieAttackMultipliers,
      getZombieIdleWavePhase: getZombieIdleWavePhase,
      shouldZombieAttemptAttack: shouldZombieAttemptAttack,
      getZombieFenceAttackDamageMul: getZombieFenceAttackDamageMul,
      getZombieIdleRetreatOffsetPx: getZombieIdleRetreatOffsetPx,
      forceDisableAttackModeRuntime: forceDisableAttackModeRuntime,
      updateWorldEvents: updateWorldEvents,
      ensureRainCache: ensureRainCache,
      drawWeather: drawWeather,
    };
  }

  global.Game = global.Game || {};
  global.Game.WorldEventsRuntime = {
    createController: createController,
  };
})(typeof window !== 'undefined' ? window : this);
