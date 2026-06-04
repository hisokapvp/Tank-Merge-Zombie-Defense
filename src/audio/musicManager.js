/*
 * src/audio/musicManager.js
 *
 * Game.MusicManager — background music layer for TMZD.
 *
 * Responsibilities (TZ items 1 & 2):
 *   - Menu music: when ANY modal/menu opens, fade IN the menu theme over ~1.0s and
 *     fade OUT gameplay battle music + duck other SFX. When the LAST open modal closes,
 *     reverse the fade (menu theme out, battle music + SFX back in).
 *   - Battle music: a calm track (A) plays while no attack wave is active and a wave
 *     track (B) plays during an attack wave; transitions crossfade over ~1.0s and are
 *     triggered exactly when the attack-wave rain starts/stops.
 *
 * Design contract:
 *   - Fully self-contained HTMLAudioElement instances (own bus), independent of the
 *     SFX pool. Cross-format fallback (ogg -> mp3) mirrors the SFX runtime.
 *   - All fades are driven by requestAnimationFrame and are time-based; nothing here
 *     runs inside the canvas draw() hot-path and no per-frame allocations leak into it.
 *   - Sources come from Game.SfxRegistry.getMusic() (assets/sfx/registry.json -> "music")
 *     when available, otherwise from inline fallback constants below.
 *   - Every external entry point is null-safe: missing/unplayable placeholder files
 *     degrade to silence and never throw or block gameplay.
 */
(function (global) {
  'use strict';

  var FADE_MS = 1000;            // gradual transition duration (user follow-up: 1.0s, 0.5s faster than the original 1.5s)
  var DEFAULT_MUSIC_VOLUME = 0.6;
  var SFX_DUCK_LEVEL = 0.3;      // SFX bus level while menu music is active

  // Inline fallback sources (used only if the registry music block is unavailable).
  var FALLBACK_SOURCES = {
    menuTheme: ['assets/music/menu_theme_TEMPLATE.ogg', 'assets/music/menu_theme_TEMPLATE.mp3'],
    battleCalm: ['assets/music/battle_calm_TEMPLATE.ogg', 'assets/music/battle_calm_TEMPLATE.mp3'],
    battleWave: ['assets/music/battle_wave_TEMPLATE.ogg', 'assets/music/battle_wave_TEMPLATE.mp3'],
  };

  var _state = {
    initialized: false,
    enabled: true,
    baseVolume: DEFAULT_MUSIC_VOLUME,
    openModalIds: {},
    openModalCount: 0,
    inWave: false,
    menuActive: false,
    rafId: null,
    lastTickAt: 0,
    duck: { cur: 1, target: 1 },
  };

  var _gestureArmed = false;
  var _audioUnlocked = false;

  // id -> { audio, sources, cur, target, ready }
  var _tracks = {};

  function clamp01(v) {
    v = Number(v);
    if (!isFinite(v)) return 0;
    return v < 0 ? 0 : (v > 1 ? 1 : v);
  }

  function now() {
    return (typeof performance !== 'undefined' && performance && typeof performance.now === 'function')
      ? performance.now()
      : Date.now();
  }

  function sourceToMime(source) {
    var s = String(source || '').toLowerCase();
    if (s.endsWith('.ogg')) return 'audio/ogg';
    if (s.endsWith('.mp3')) return 'audio/mpeg';
    if (s.endsWith('.wav')) return 'audio/wav';
    return '';
  }

  function orderSourcesBySupport(list) {
    if (!Array.isArray(list)) return [];
    var supported = [];
    var rest = [];
    var probe = null;
    try { if (typeof Audio !== 'undefined') probe = new Audio(); } catch (e) { probe = null; }
    for (var i = 0; i < list.length; i++) {
      var src = list[i];
      if (typeof src !== 'string' || !src) continue;
      var ok = true;
      if (probe && typeof probe.canPlayType === 'function') {
        var mime = sourceToMime(src);
        if (mime) {
          var support = probe.canPlayType(mime);
          ok = (support === 'probably' || support === 'maybe');
        }
      }
      if (ok) supported.push(src); else rest.push(src);
    }
    // Preferred (canPlay) first, then the rest as last-resort fallback.
    for (var j = 0; j < rest.length; j++) {
      if (supported.indexOf(rest[j]) === -1) supported.push(rest[j]);
    }
    return supported;
  }

  function resolveSourcesFor(id) {
    var registryMusic = null;
    try {
      if (global.Game && global.Game.SfxRegistry && typeof global.Game.SfxRegistry.getMusic === 'function') {
        registryMusic = global.Game.SfxRegistry.getMusic();
      }
    } catch (e) { registryMusic = null; }
    var raw = (registryMusic && registryMusic[id]) ? registryMusic[id] : FALLBACK_SOURCES[id];
    if (typeof raw === 'string') raw = [raw];
    return orderSourcesBySupport(raw || []);
  }

  function attachFormatFallback(audio, sources) {
    if (!audio || !Array.isArray(sources) || sources.length < 2) return;
    audio.__srcIndex = 0;
    audio.addEventListener('error', function () {
      var next = Number.isFinite(audio.__srcIndex) ? audio.__srcIndex + 1 : 1;
      if (next >= sources.length) return;
      audio.__srcIndex = next;
      try {
        audio.src = sources[next];
        audio.load();
      } catch (e) { /* noop */ }
    });
  }

  function ensureTrack(id) {
    if (_tracks[id]) return _tracks[id];
    var sources = resolveSourcesFor(id);
    var track = { audio: null, sources: sources, cur: 0, target: 0, ready: false };
    if (sources.length && typeof Audio !== 'undefined') {
      try {
        var audio = new Audio();
        audio.preload = 'auto';
        audio.loop = true;
        audio.volume = 0;
        attachFormatFallback(audio, sources);
        audio.src = sources[0];
        try { audio.load(); } catch (e) { /* noop */ }
        track.audio = audio;
        track.ready = true;
      } catch (e) { track.audio = null; track.ready = false; }
    }
    _tracks[id] = track;
    return track;
  }

  function effectiveBattleTrackId() {
    return _state.inWave ? 'battleWave' : 'battleCalm';
  }

  function recomputeTargets() {
    var menuTarget = (_state.enabled && _state.menuActive) ? _state.baseVolume : 0;
    setTrackTarget('menuTheme', menuTarget);

    var battleId = effectiveBattleTrackId();
    var battleOn = (_state.enabled && !_state.menuActive);
    setTrackTarget('battleCalm', (battleOn && battleId === 'battleCalm') ? _state.baseVolume : 0);
    setTrackTarget('battleWave', (battleOn && battleId === 'battleWave') ? _state.baseVolume : 0);

    _state.duck.target = _state.menuActive ? SFX_DUCK_LEVEL : 1;

    // If a track wants to play but autoplay is still blocked, make sure a gesture
    // listener is armed so the very next user interaction unlocks audio. This is
    // re-armable (no-op once unlocked) so a track becoming audible after boot
    // (e.g. the startup menu theme) is never left silently waiting.
    if (!_audioUnlocked) armGestureUnlock();

    startRaf();
  }

  function setTrackTarget(id, target) {
    var track = ensureTrack(id);
    track.target = clamp01(target);
    if (track.target > 0 && track.audio && track.audio.paused) {
      try {
        var p = track.audio.play();
        if (p && typeof p.catch === 'function') p.catch(function () {});
      } catch (e) { /* autoplay may be blocked until a user gesture */ }
    }
  }

  function applyDuck() {
    try {
      if (global.Game && global.Game.SfxPoolRuntime && typeof global.Game.SfxPoolRuntime.setDuckFactor === 'function') {
        global.Game.SfxPoolRuntime.setDuckFactor(_state.duck.cur);
      }
    } catch (e) { /* noop */ }
  }

  function startRaf() {
    if (_state.rafId != null) return;
    _state.lastTickAt = now();
    if (typeof requestAnimationFrame === 'function') {
      _state.rafId = requestAnimationFrame(tick);
    } else {
      // Headless / test fallback: settle instantly.
      settleAll();
    }
  }

  function stopRaf() {
    if (_state.rafId != null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(_state.rafId);
    }
    _state.rafId = null;
  }

  function stepToward(cur, target, fullScale, dtMs) {
    if (cur === target) return target;
    var rate = (fullScale > 0 ? fullScale : 1) / FADE_MS; // units per ms (linear, ~1.0s full)
    var delta = rate * dtMs;
    if (cur < target) {
      cur += delta;
      if (cur >= target) cur = target;
    } else {
      cur -= delta;
      if (cur <= target) cur = target;
    }
    return cur;
  }

  function tick() {
    var t = now();
    var dt = Math.max(0, Math.min(250, t - _state.lastTickAt));
    _state.lastTickAt = t;
    var active = false;

    Object.keys(_tracks).forEach(function (id) {
      var track = _tracks[id];
      if (!track) return;
      if (track.cur !== track.target) {
        track.cur = stepToward(track.cur, track.target, _state.baseVolume || 1, dt);
        active = true;
      }
      if (track.audio) {
        try { track.audio.volume = clamp01(track.cur); } catch (e) { /* noop */ }
        if (track.cur <= 0 && track.target <= 0 && !track.audio.paused) {
          try { track.audio.pause(); track.audio.currentTime = 0; } catch (e) { /* noop */ }
        }
      }
    });

    if (_state.duck.cur !== _state.duck.target) {
      _state.duck.cur = stepToward(_state.duck.cur, _state.duck.target, 1, dt);
      active = true;
    }
    applyDuck();

    if (active && _state.rafId != null) {
      if (typeof requestAnimationFrame === 'function') {
        _state.rafId = requestAnimationFrame(tick);
      } else {
        _state.rafId = null;
      }
    } else {
      stopRaf();
    }
  }

  function settleAll() {
    Object.keys(_tracks).forEach(function (id) {
      var track = _tracks[id];
      if (!track) return;
      track.cur = track.target;
      if (track.audio) {
        try {
          track.audio.volume = clamp01(track.cur);
          if (track.cur <= 0 && track.audio && !track.audio.paused) {
            track.audio.pause();
          }
        } catch (e) { /* noop */ }
      }
    });
    _state.duck.cur = _state.duck.target;
    applyDuck();
  }

  // ---- Public API ----

  // Browsers block HTMLAudioElement playback until the first user gesture, so a
  // freshly-loaded page (e.g. the startup main menu) stays silent even though a
  // track target is > 0. Arm a one-shot gesture listener that retries the blocked
  // play() calls the moment the user first interacts, then detaches itself.
  function retryBlockedPlays() {
    var anyPlaying = false;
    Object.keys(_tracks).forEach(function (id) {
      var track = _tracks[id];
      if (!track || !track.audio) return;
      if (track.target > 0) {
        if (track.audio.paused) {
          try {
            var p = track.audio.play();
            if (p && typeof p.catch === 'function') p.catch(function () {});
          } catch (e) { /* noop */ }
        }
        if (!track.audio.paused) anyPlaying = true;
      }
    });
    return anyPlaying;
  }

  function _detachGestureHandler(handler) {
    try {
      global.removeEventListener('pointerdown', handler, true);
      global.removeEventListener('keydown', handler, true);
      global.removeEventListener('touchstart', handler, true);
    } catch (e) { /* noop */ }
  }

  function armGestureUnlock() {
    if (_audioUnlocked || _gestureArmed) return;
    if (typeof global.addEventListener !== 'function') return;
    _gestureArmed = true;
    var handler = function () {
      var ok = false;
      try { ok = retryBlockedPlays(); } catch (e) { ok = false; }
      // Only detach once playback actually started. If the first gesture happened
      // before any track target was > 0 (e.g. clicking before the menu theme is
      // armed), keep listening so the next interaction still unlocks audio.
      if (ok) {
        _audioUnlocked = true;
        _gestureArmed = false;
        _detachGestureHandler(handler);
      }
    };
    try {
      global.addEventListener('pointerdown', handler, true);
      global.addEventListener('keydown', handler, true);
      global.addEventListener('touchstart', handler, true);
    } catch (e) { _gestureArmed = false; }
  }

  function init(opts) {
    if (_state.initialized) return;
    opts = opts || {};
    if (Number.isFinite(opts.musicVolume)) _state.baseVolume = clamp01(opts.musicVolume);
    if (typeof opts.enabled === 'boolean') _state.enabled = opts.enabled;
    _state.initialized = true;
    // Pre-create tracks so first transition is immediate.
    ensureTrack('menuTheme');
    ensureTrack('battleCalm');
    ensureTrack('battleWave');
    recomputeTargets();
    armGestureUnlock();
  }

  // Authoritative menu-state driver. Unlike notifyModalOpen/Close ref-counting,
  // this takes a single boolean sourced from the game's aggregate menu-pause lock
  // (recomputeMenuPauseLock), so overlapping/nested modal ids can never leave the
  // menu theme stuck playing after every window is closed.
  function setMenuActive(on) {
    if (!_state.initialized) init();
    var next = !!on;
    if (_state.menuActive === next) return;
    _state.menuActive = next;
    recomputeTargets();
  }

  function notifyModalOpen(id) {
    if (!_state.initialized) init();
    var key = id != null ? String(id) : ('__anon_' + _state.openModalCount);
    if (!_state.openModalIds[key]) {
      _state.openModalIds[key] = true;
      _state.openModalCount++;
    }
    _state.menuActive = _state.openModalCount > 0;
    recomputeTargets();
  }

  function notifyModalClose(id) {
    if (!_state.initialized) init();
    var key = id != null ? String(id) : null;
    if (key && _state.openModalIds[key]) {
      delete _state.openModalIds[key];
      _state.openModalCount = Math.max(0, _state.openModalCount - 1);
    } else if (!key) {
      _state.openModalCount = Math.max(0, _state.openModalCount - 1);
    }
    _state.menuActive = _state.openModalCount > 0;
    recomputeTargets();
  }

  function onWaveStart() {
    if (!_state.initialized) init();
    if (_state.inWave) return;
    _state.inWave = true;
    recomputeTargets();
  }

  function onWaveEnd() {
    if (!_state.initialized) init();
    if (!_state.inWave) return;
    _state.inWave = false;
    recomputeTargets();
  }

  function setMusicVolume(v) {
    _state.baseVolume = clamp01(v);
    recomputeTargets();
  }

  function setEnabled(on) {
    _state.enabled = !!on;
    recomputeTargets();
  }

  function getState() {
    return {
      initialized: _state.initialized,
      enabled: _state.enabled,
      baseVolume: _state.baseVolume,
      openModalCount: _state.openModalCount,
      menuActive: _state.menuActive,
      inWave: _state.inWave,
      duck: { cur: _state.duck.cur, target: _state.duck.target },
      tracks: Object.keys(_tracks).reduce(function (acc, id) {
        acc[id] = { cur: _tracks[id].cur, target: _tracks[id].target, ready: _tracks[id].ready };
        return acc;
      }, {}),
    };
  }

  global.Game = global.Game || {};
  global.Game.MusicManager = {
    FADE_MS: FADE_MS,
    init: init,
    setMenuActive: setMenuActive,
    notifyModalOpen: notifyModalOpen,
    notifyModalClose: notifyModalClose,
    onWaveStart: onWaveStart,
    onWaveEnd: onWaveEnd,
    setMusicVolume: setMusicVolume,
    setEnabled: setEnabled,
    getState: getState,
    // Test/headless helpers:
    _settleAll: settleAll,
    _resolveSourcesFor: resolveSourcesFor,
  };
})(typeof window !== 'undefined' ? window : this);
