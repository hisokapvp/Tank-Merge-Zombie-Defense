(function (global) {
  'use strict';

  // Global SFX duck factor (0..1). Default 1 = no attenuation. Music ducking
  // (Game.MusicManager) lowers this while menu music is active so all SFX whose
  // volume passes through resolveSfxPlaybackVolume fade down together. Shared
  // across controllers; mutating it never touches the draw() hot-path.
  var _sfxDuckFactor = 1;
  function _clampDuck(v) {
    v = Number(v);
    if (!isFinite(v)) return 1;
    return v < 0 ? 0 : (v > 1 ? 1 : v);
  }

  function createController(deps) {
    deps = deps || {};

    var SFX_LAST_PLAYED = deps.sfxLastPlayed || {};
    var SFX_DEDUP_MS = Number.isFinite(deps.sfxDedupMs) ? Math.max(0, deps.sfxDedupMs) : 80;
    var SFX_POOL_SIZE = Number.isFinite(deps.sfxPoolSize) ? Math.max(1, Math.floor(deps.sfxPoolSize)) : 6;
    var SFX_POOLS = deps.sfxPools || {};
    var LOOP_SFX_PLAYERS = deps.loopSfxPlayers || {};
    var SFX_RESOLVED_SOURCE_LISTS = deps.sfxResolvedSourceLists || {};
    var SFX_AUDIO_PROBE = deps.sfxAudioProbe || null;
    var UI_SLIDER_PREVIEW_THROTTLE_MS = Number.isFinite(deps.uiSliderPreviewThrottleMs) ? Math.max(0, deps.uiSliderPreviewThrottleMs) : 160;
    var lastUiSliderPreviewSfxAt = Number.isFinite(deps.lastUiSliderPreviewSfxAt) ? deps.lastUiSliderPreviewSfxAt : -Infinity;

    var SFX_CHANNELS = {
      shootNormal: 'gameplay',
      shootHeavy: 'gameplay',
      shootHeavy1: 'gameplay',
      shootHeavy2: 'gameplay',
      trackLoop: 'gameplay',
      tankToTrack: 'gameplay',
      tankToHangar: 'gameplay',
      activeAbility: 'gameplay',
      thunder: 'gameplay',
      rainLoop: 'gameplay',
      zombieAttackLoop: 'gameplay',
      zombieWanderLoop: 'gameplay',
      uiHover: 'ui',
      uiClickOnEnabled: 'ui',
      uiClickOnDisable: 'ui',
      uiSliderPreview: 'ui',
      levelUp: 'ui',
      mergeNewMaxLevel: 'ui',
      applyTalents: 'ui',
    };

    var SFX_SOURCES = {
      shootNormal: 'assets/sfx/shoot_normal.ogg',
      // shoot_heavy.ogg missing on disk — alias to shoot_heavy1.ogg (rework / console-diag).
      shootHeavy: 'assets/sfx/shoot_heavy1.ogg',
      shootHeavy1: 'assets/sfx/shoot_heavy1.ogg',
      shootHeavy2: 'assets/sfx/shoot_heavy2.ogg',
      uiHover: ['assets/sfx/ui_hover.ogg', 'assets/sfx/ui_hover.mp3'],
      uiClickOnEnabled: ['assets/sfx/ui_click_enabled.ogg', 'assets/sfx/ui_click_enabled.mp3'],
      uiClickOnDisable: ['assets/sfx/ui_click_disabled.ogg', 'assets/sfx/ui_click_disabled.mp3'],
      uiSliderPreview: ['assets/sfx/ui_slider_preview_TEMPLATE.ogg'],
      tankToTrack: ['assets/sfx/tank_to_track.ogg', 'assets/sfx/tank_to_track.mp3'],
      tankToHangar: ['assets/sfx/tank_to_hangar.ogg', 'assets/sfx/tank_to_hangar.mp3'],
      trackLoop: (deps.getDefaultTrackLoopSources ? deps.getDefaultTrackLoopSources() : []).slice(),
      levelUp: 'assets/sfx/level_up.ogg',
      mergeNewMaxLevel: ['assets/sfx/merge_new_max_level.ogg', 'assets/sfx/merge_new_max_level.mp3'],
      applyTalents: 'assets/sfx/apply_talents.ogg',
      activeAbility: ['assets/sfx/active_ability.ogg', 'assets/sfx/active_ability.mp3'],
      thunder: ['assets/sfx/thunder.ogg', 'assets/sfx/thunder.wav'],
      rainLoop: (deps.getDefaultRainLoopSources() || []).slice(),
      zombieAttackLoop: ['assets/music/ataka-zombi.ogg', 'assets/music/ataka-zombi.mp3'],
      zombieWanderLoop: ['assets/music/zombi-bredut.ogg', 'assets/music/zombi-bredut.mp3'],
    };

    function getDefaultSettings() {
      return deps.getDefaultSettings ? deps.getDefaultSettings() : { sfxVolume: 0.75 };
    }

    function sfxChannelOf(id) {
      return SFX_CHANNELS[id] || 'gameplay';
    }

    function playUiSliderPreviewSfxThrottled() {
      var now = (typeof performance !== 'undefined' && performance && typeof performance.now === 'function')
        ? performance.now()
        : Date.now();
      if (now - lastUiSliderPreviewSfxAt < UI_SLIDER_PREVIEW_THROTTLE_MS) return;
      lastUiSliderPreviewSfxAt = now;
      if (typeof deps.setLastUiSliderPreviewSfxAt === 'function') deps.setLastUiSliderPreviewSfxAt(lastUiSliderPreviewSfxAt);
      playSfx('uiSliderPreview', { channel: 'ui' });
    }

    function sfxSourceToMime(source) {
      var normalized = String(source || '').toLowerCase();
      if (normalized.endsWith('.ogg')) return 'audio/ogg';
      if (normalized.endsWith('.wav')) return 'audio/wav';
      if (normalized.endsWith('.mp3')) return 'audio/mpeg';
      return '';
    }

    function canPlaySfxSource(source) {
      if (typeof Audio === 'undefined') return true;
      try {
        if (!SFX_AUDIO_PROBE) {
          SFX_AUDIO_PROBE = new Audio();
          if (typeof deps.setSfxAudioProbe === 'function') deps.setSfxAudioProbe(SFX_AUDIO_PROBE);
        }
        if (!SFX_AUDIO_PROBE || typeof SFX_AUDIO_PROBE.canPlayType !== 'function') return true;
        var mime = sfxSourceToMime(source);
        if (!mime) return true;
        var support = SFX_AUDIO_PROBE.canPlayType(mime);
        return support === 'probably' || support === 'maybe';
      } catch (e) {
        return true;
      }
    }

    function resolveSfxSourceList(id) {
      if (Object.prototype.hasOwnProperty.call(SFX_RESOLVED_SOURCE_LISTS, id)) {
        return SFX_RESOLVED_SOURCE_LISTS[id];
      }
      var source = SFX_SOURCES[id];
      var resolved = [];
      if (Array.isArray(source)) {
        for (var i = 0; i < source.length; i++) {
          var candidate = source[i];
          if (typeof candidate !== 'string' || !candidate) continue;
          if (canPlaySfxSource(candidate)) {
            resolved.push(candidate);
          }
        }
        for (var j = 0; j < source.length; j++) {
          var fallbackCandidate = source[j];
          if (typeof fallbackCandidate !== 'string' || !fallbackCandidate) continue;
          if (resolved.indexOf(fallbackCandidate) === -1) resolved.push(fallbackCandidate);
        }
      } else if (typeof source === 'string' && source) {
        resolved.push(source);
      }
      SFX_RESOLVED_SOURCE_LISTS[id] = resolved;
      return resolved;
    }

    function enableAudioFallback(player, sourceList) {
      if (!player || !Array.isArray(sourceList) || sourceList.length < 2) return;
      player.__sourceIndex = 0;
      player.addEventListener('error', function () {
        var nextIndex = Number.isFinite(player.__sourceIndex) ? player.__sourceIndex + 1 : 1;
        if (nextIndex >= sourceList.length) return;
        player.__sourceIndex = nextIndex;
        player.src = sourceList[nextIndex];
        try { player.load(); } catch (e) {}
      });
    }

    function normalizedSfxSources(value, fallbackList) {
      var fallback = Array.isArray(fallbackList) ? fallbackList.filter(function (s) { return typeof s === 'string' && s.length > 0; }) : [];
      if (Array.isArray(value)) {
        var list = value.filter(function (s) { return typeof s === 'string' && s.length > 0; });
        return list.length ? list : fallback;
      }
      if (typeof value === 'string' && value.length > 0) return [value];
      return fallback;
    }

    function setSfxSources(id, sources) {
      var next = normalizedSfxSources(sources, []);
      if (!next.length) return;
      var prevRaw = SFX_SOURCES[id];
      var prev = Array.isArray(prevRaw)
        ? prevRaw.filter(function (s) { return typeof s === 'string' && s.length > 0; })
        : (typeof prevRaw === 'string' && prevRaw.length > 0 ? [prevRaw] : []);
      if (prev.length === next.length && prev.every(function (s, i) { return s === next[i]; })) return;

      stopLoopSfx(id);
      delete LOOP_SFX_PLAYERS[id];
      delete SFX_POOLS[id];
      delete SFX_RESOLVED_SOURCE_LISTS[id];
      SFX_SOURCES[id] = next.slice();
    }

    function getSfxPool(id) {
      if (!SFX_POOLS[id]) {
        var sources = resolveSfxSourceList(id);
        var src = sources[0];
        if (!src) return null;
        var players = [];
        var settings = deps.getSettings();
        var defaults = getDefaultSettings();
        var vol = deps.clamp(settings.sfxVolume ?? defaults.sfxVolume, 0, 1);
        for (var i = 0; i < SFX_POOL_SIZE; i++) {
          var player = new Audio(src);
          player.preload = 'auto';
          player.volume = vol;
          enableAudioFallback(player, sources);
          players.push(player);
        }
        SFX_POOLS[id] = { players: players, cursor: 0 };
      }
      return SFX_POOLS[id];
    }

    function getLoopSfxPlayer(id) {
      if (!LOOP_SFX_PLAYERS[id]) {
        var sources = resolveSfxSourceList(id);
        var src = sources[0];
        if (!src) return null;
        var player = new Audio(src);
        player.preload = 'auto';
        player.loop = true;
        enableAudioFallback(player, sources);
        LOOP_SFX_PLAYERS[id] = player;
      }
      return LOOP_SFX_PLAYERS[id];
    }

    function resolveSfxPlaybackVolume(id, volumeMul) {
      return deps.resolveSfxPlaybackVolume(id, volumeMul) * _sfxDuckFactor;
    }

    function playLoopSfx(id, volumeMul) {
      if (deps.isCriticalAudioActive() && !deps.isCriticalSfxAllowed(id)) return;
      if (deps.isSimulationPaused() && sfxChannelOf(id) === 'gameplay') return;
      var vol = resolveSfxPlaybackVolume(id, volumeMul);
      try {
        var player = getLoopSfxPlayer(id);
        if (!player) return;
        player.volume = vol;
        if (!player.paused) return;
        player.play().catch(function () {});
      } catch (e) {}
    }

    function setLoopSfxVolume(id, volumeMul) {
      try {
        if (deps.isCriticalAudioActive() && !deps.isCriticalSfxAllowed(id)) return;
        var player = LOOP_SFX_PLAYERS[id];
        if (!player || player.paused) return;
        player.volume = resolveSfxPlaybackVolume(id, volumeMul);
      } catch (e) {}
    }

    function stopLoopSfx(id) {
      try {
        var player = LOOP_SFX_PLAYERS[id];
        if (!player) return;
        player.pause();
        try { player.currentTime = 0; } catch (e) {}
      } catch (e) {}
    }

    function playSfx(id, opts) {
      var channelOverride = opts && typeof opts === 'object' && typeof opts.channel === 'string'
        ? opts.channel
        : '';
      var effectiveChannel = channelOverride || sfxChannelOf(id);
      if (deps.isCriticalAudioActive() && !deps.isCriticalSfxAllowed(id)) return;
      if (deps.isSimulationPaused() && effectiveChannel === 'gameplay') return;
      var volumeMul = opts && typeof opts === 'object' && Number.isFinite(opts.volumeMult)
        ? deps.clamp(opts.volumeMult, 0, 1)
        : 1;
      var vol = resolveSfxPlaybackVolume(id, volumeMul);
      var now = performance.now();
      if (SFX_LAST_PLAYED[id] != null && now - SFX_LAST_PLAYED[id] < SFX_DEDUP_MS) return;
      SFX_LAST_PLAYED[id] = now;
      try {
        var pool = getSfxPool(id);
        if (!pool || !pool.players || !pool.players.length) return;
        var player = null;
        for (var i = 0; i < pool.players.length; i++) {
          var idx = (pool.cursor + i) % pool.players.length;
          var candidate = pool.players[idx];
          if (candidate.ended || candidate.paused) {
            player = candidate;
            pool.cursor = (idx + 1) % pool.players.length;
            break;
          }
        }
        if (!player) {
          player = pool.players[pool.cursor];
          pool.cursor = (pool.cursor + 1) % pool.players.length;
        }
        player.volume = vol;
        try { player.currentTime = 0; } catch (e) {}
        player.play().catch(function () {});
      } catch (e) {}
    }

    function getSfxPools() {
      return SFX_POOLS;
    }

    function getLoopSfxPlayers() {
      return LOOP_SFX_PLAYERS;
    }

    return {
      sfxChannelOf: sfxChannelOf,
      playUiSliderPreviewSfxThrottled: playUiSliderPreviewSfxThrottled,
      normalizedSfxSources: normalizedSfxSources,
      setSfxSources: setSfxSources,
      playLoopSfx: playLoopSfx,
      setLoopSfxVolume: setLoopSfxVolume,
      stopLoopSfx: stopLoopSfx,
      playSfx: playSfx,
      getSfxPool: getSfxPool,
      getLoopSfxPlayer: getLoopSfxPlayer,
      getSfxPools: getSfxPools,
      getLoopSfxPlayers: getLoopSfxPlayers,
      getSfxLastPlayed: function () { return SFX_LAST_PLAYED; },
      getDefaultRainLoopSources: function () {
        return normalizedSfxSources(SFX_SOURCES.rainLoop, deps.getDefaultRainLoopSources()).slice();
      },
    };
  }

  global.Game = global.Game || {};
  global.Game.SfxPoolRuntime = {
    createController: createController,
    setDuckFactor: function (f) { _sfxDuckFactor = _clampDuck(f); },
    getDuckFactor: function () { return _sfxDuckFactor; },
  };
})(typeof window !== 'undefined' ? window : this);
