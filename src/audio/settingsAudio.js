(function (global) {
  'use strict';

  var DEFAULT_SETTINGS = {
    sfxVolume: 0.75,
    musicVolume: 0.6,
    trackLoopVolumeMul: 1.0,
  };

  var SFX_DEDUP_MS = 80;
  var SFX_POOL_SIZE = 6;
  var SFX_AUDIO_PROBE = null;
  var SFX_SOURCES = {
    shootNormal: 'assets/sfx/shoot_normal.ogg',
    // shoot_heavy.ogg missing on disk — alias to shoot_heavy1.ogg (rework / console-diag).
    shootHeavy: 'assets/sfx/shoot_heavy1.ogg',
    shootHeavy1: 'assets/sfx/shoot_heavy1.ogg',
    shootHeavy2: 'assets/sfx/shoot_heavy2.ogg',
    levelUp: 'assets/sfx/level_up.ogg',
    applyTalents: 'assets/sfx/apply_talents.ogg',
    activeAbility: 'assets/sfx/active_ability.ogg',
    uiHover: ['assets/sfx/ui_hover.ogg', 'assets/sfx/ui_hover.mp3'],
    uiClickOnEnabled: ['assets/sfx/ui_click_enabled.ogg', 'assets/sfx/ui_click_enabled.mp3'],
    uiClickOnDisable: ['assets/sfx/ui_click_disabled.ogg', 'assets/sfx/ui_click_disabled.mp3'],
    uiSliderPreview: ['assets/sfx/ui_slider_preview_TEMPLATE.ogg'],
    mergeNewMaxLevel: ['assets/sfx/merge_new_max_level.ogg', 'assets/sfx/merge_new_max_level.mp3'],
    tankToTrack: ['assets/sfx/tank_to_track.ogg', 'assets/sfx/tank_to_track.mp3'],
    tankToHangar: ['assets/sfx/tank_to_hangar.ogg', 'assets/sfx/tank_to_hangar.mp3'],
    trackLoop: ['assets/sfx/TankDrive.ogg', 'assets/sfx/TankDrive.mp3'],
  };

  function clampTrackLoopVolumeMul(value) {
    var numeric = Number(value);
    if (!Number.isFinite(numeric)) return DEFAULT_SETTINGS.trackLoopVolumeMul;
    return Math.max(0, Math.min(3, numeric));
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
      if (!SFX_AUDIO_PROBE) SFX_AUDIO_PROBE = new Audio();
      if (!SFX_AUDIO_PROBE || typeof SFX_AUDIO_PROBE.canPlayType !== 'function') return true;
      var mime = sfxSourceToMime(source);
      if (!mime) return true;
      var support = SFX_AUDIO_PROBE.canPlayType(mime);
      return support === 'probably' || support === 'maybe';
    } catch (_) {
      return true;
    }
  }

  function pickSupportedSource(src) {
    if (Array.isArray(src)) {
      for (var i = 0; i < src.length; i++) {
        var candidate = src[i];
        if (typeof candidate !== 'string' || !candidate) continue;
        if (canPlaySfxSource(candidate)) return candidate;
      }
      for (var j = 0; j < src.length; j++) {
        if (typeof src[j] === 'string' && src[j]) return src[j];
      }
      return '';
    }
    if (typeof src === 'string' && src) return src;
    return '';
  }

  function clampVolume(value, fallback, clampFn) {
    var safeClamp = typeof clampFn === 'function'
      ? clampFn
      : function (v, a, b) { return Math.max(a, Math.min(b, v)); };
    return safeClamp(value == null ? fallback : value, 0, 1);
  }

  function createAudioSettingsController(options) {
    var opts = options || {};
    var ui = opts.ui || {};
    var clampFn = opts.clamp;
    var storageKey = opts.storageKey || 'settings';

    var settings = Object.assign({}, DEFAULT_SETTINGS, opts.initialSettings || {});
    var sfxPools = {};
    var sfxLastPlayed = {};

    function getSettings() {
      return Object.assign({}, settings);
    }

    function setSettings(nextSettings) {
      settings = Object.assign({}, DEFAULT_SETTINGS, nextSettings || {});
    }

    function applyAudioSettings() {
      var musicVolume = clampVolume(settings.musicVolume, DEFAULT_SETTINGS.musicVolume, clampFn);
      var sfxVolume = clampVolume(settings.sfxVolume, DEFAULT_SETTINGS.sfxVolume, clampFn);
      var trackLoopVolumeMul = clampTrackLoopVolumeMul(settings.trackLoopVolumeMul);
      settings.musicVolume = musicVolume;
      settings.sfxVolume = sfxVolume;
      settings.trackLoopVolumeMul = trackLoopVolumeMul;

      document.querySelectorAll('audio[data-audio="music"]').forEach(function (el) {
        el.volume = musicVolume;
      });
      document.querySelectorAll('audio[data-audio="sfx"]').forEach(function (el) {
        el.volume = sfxVolume;
      });

      Object.keys(sfxPools).forEach(function (id) {
        var pool = sfxPools[id];
        if (!pool || !pool.players) return;
        for (var i = 0; i < pool.players.length; i++) {
          pool.players[i].volume = sfxVolume;
        }
      });
    }

    function updateMenuVolumes() {
      if (ui.menuMusic) {
        ui.menuMusic.value = Math.round((settings.musicVolume || 0) * 100);
      }
      if (ui.menuSfx) {
        ui.menuSfx.value = Math.round((settings.sfxVolume || 0) * 100);
      }
      if (ui.menuMusicValue) {
        ui.menuMusicValue.textContent = String(Math.round((settings.musicVolume || 0) * 100)) + '%';
      }
      if (ui.menuSfxValue) {
        ui.menuSfxValue.textContent = String(Math.round((settings.sfxVolume || 0) * 100)) + '%';
      }
    }

    function loadSettings() {
      try {
        var raw = localStorage.getItem(storageKey);
        if (raw) {
          var parsed = JSON.parse(raw);
          settings = Object.assign({}, DEFAULT_SETTINGS, parsed || {});
        }
      } catch (_) {}
      applyAudioSettings();
      updateMenuVolumes();
      return getSettings();
    }

    function saveSettings() {
      try {
        localStorage.setItem(storageKey, JSON.stringify(settings));
      } catch (_) {}
    }

    function getSfxPool(id) {
      if (!sfxPools[id]) {
        var src = pickSupportedSource(SFX_SOURCES[id]);
        if (!src) return null;
        var players = [];
        var vol = clampVolume(settings.sfxVolume, DEFAULT_SETTINGS.sfxVolume, clampFn);
        for (var i = 0; i < SFX_POOL_SIZE; i++) {
          var player = new Audio(src);
          player.preload = 'auto';
          player.volume = vol;
          players.push(player);
        }
        sfxPools[id] = { players: players, cursor: 0 };
      }
      return sfxPools[id];
    }

    function playSfx(id, opts) {
      var volumeMult = 1;
      if (opts && typeof opts === 'object' && opts.volumeMult != null) {
        volumeMult = Number(opts.volumeMult);
      }
      if (!Number.isFinite(volumeMult)) volumeMult = 1;
      var baseVol = clampVolume(settings.sfxVolume, DEFAULT_SETTINGS.sfxVolume, clampFn);
      var vol = clampVolume(baseVol * volumeMult, baseVol, clampFn);
      var now = performance.now();
      if (sfxLastPlayed[id] != null && now - sfxLastPlayed[id] < SFX_DEDUP_MS) return;
      sfxLastPlayed[id] = now;

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
        try { player.currentTime = 0; } catch (_) {}
        player.play().catch(function () {});
      } catch (_) {}
    }

    return {
      getSettings: getSettings,
      setSettings: setSettings,
      loadSettings: loadSettings,
      saveSettings: saveSettings,
      applyAudioSettings: applyAudioSettings,
      updateMenuVolumes: updateMenuVolumes,
      playSfx: playSfx,
    };
  }

  global.Game = global.Game || {};
  global.Game.AudioSettings = {
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    createAudioSettingsController: createAudioSettingsController,
  };
})(typeof window !== 'undefined' ? window : this);
