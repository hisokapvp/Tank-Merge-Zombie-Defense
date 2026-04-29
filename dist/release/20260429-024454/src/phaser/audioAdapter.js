/**
 * PhaserAudioAdapter — bridges audio between legacy HTML5 Audio API and Phaser 3 Web Audio.
 *
 * Phase 2: When Phaser is active and Web Audio is supported, this adapter
 * delegates SFX/loop playback to Phaser's sound manager for better
 * performance, reduced latency, and proper lifecycle integration.
 *
 * When Phaser audio is not available or fails, all calls transparently
 * fall back to the legacy sfxPoolRuntime.
 *
 * The adapter does NOT own the SFX source registry or volume logic.
 * It acts as a playback backend that the existing playSfx/playLoopSfx
 * in game.js can optionally delegate to.
 *
 * API:
 *   Game.PhaserAudioAdapter.init(config)
 *   Game.PhaserAudioAdapter.isActive()           → boolean
 *   Game.PhaserAudioAdapter.preloadSfx(id, urls) → void
 *   Game.PhaserAudioAdapter.playSfx(id, opts)    → boolean (true if handled)
 *   Game.PhaserAudioAdapter.playLoop(id, volume)  → boolean
 *   Game.PhaserAudioAdapter.stopLoop(id)          → void
 *   Game.PhaserAudioAdapter.setLoopVolume(id, v)  → void
 *   Game.PhaserAudioAdapter.pauseAll()            → void
 *   Game.PhaserAudioAdapter.resumeAll()           → void
 *   Game.PhaserAudioAdapter.destroy()             → void
 */
(function (global) {
  'use strict';

  /** @type {Phaser.Sound.BaseSoundManager|null} */
  var _soundManager = null;
  var _active = false;
  var _preloaded = {};       // id → true when asset loaded into Phaser cache
  var _loopPlayers = {};     // id → Phaser sound instance (for loops)
  var _poolSize = 6;
  var _pools = {};           // id → Phaser sound instance array
  var _poolCursors = {};     // id → number

  /**
   * Initialize the audio adapter.
   * @param {Object} config
   * @param {Phaser.Game} [config.phaserGame] — running Phaser.Game instance
   * @param {number} [config.poolSize] — SFX pool size per id (default 6)
   */
  function init(config) {
    config = config || {};
    _poolSize = (Number.isFinite(config.poolSize) && config.poolSize >= 1)
      ? Math.floor(config.poolSize) : 6;

    var game = config.phaserGame || null;
    if (!game || !game.sound) {
      console.log('[PhaserAudioAdapter] No Phaser sound manager — staying inactive');
      _active = false;
      return;
    }

    // Check if Web Audio context is available (not just NoAudioSoundManager)
    _soundManager = game.sound;
    if (_soundManager.mute === undefined && typeof _soundManager.play !== 'function') {
      console.log('[PhaserAudioAdapter] Phaser sound manager not usable — staying inactive');
      _active = false;
      _soundManager = null;
      return;
    }

    _active = true;
    console.log('[PhaserAudioAdapter] Initialized — Phaser audio active');
  }

  function isActive() {
    return _active && _soundManager !== null;
  }

  /**
   * Preload an SFX asset into Phaser's audio cache.
   * Must be called before playSfx/playLoop for that id.
   * @param {string} id
   * @param {string[]} urls — ordered list of source URLs (ogg, mp3, wav)
   */
  function preloadSfx(id, urls) {
    if (!_active || !_soundManager) return;
    if (_preloaded[id]) return;
    if (!Array.isArray(urls) || urls.length === 0) return;

    // Phaser needs the scene's loader or cache to add sounds.
    // Since we're outside scene lifecycle, use the cache directly if available.
    var scene = _getActiveScene();
    if (!scene || !scene.cache || !scene.cache.audio) return;

    // If already cached, mark as preloaded
    if (scene.cache.audio.exists(id)) {
      _preloaded[id] = true;
      return;
    }

    // Use scene load queue for runtime loading
    if (scene.load && typeof scene.load.audio === 'function') {
      scene.load.audio(id, urls);
      scene.load.once('complete', function () {
        _preloaded[id] = true;
      });
      if (!scene.load.isLoading()) {
        scene.load.start();
      }
    }
  }

  /**
   * Play a one-shot SFX through Phaser.
   * @param {string} id
   * @param {Object} [opts]
   * @param {number} [opts.volume] — final volume (0..1)
   * @returns {boolean} true if Phaser handled the playback
   */
  function playSfx(id, opts) {
    if (!_active || !_soundManager) return false;
    if (!_preloaded[id]) return false;

    opts = opts || {};
    var vol = Number.isFinite(opts.volume) ? Math.max(0, Math.min(1, opts.volume)) : 1;

    try {
      // Pool-based playback for one-shots
      if (!_pools[id]) {
        _pools[id] = [];
        _poolCursors[id] = 0;
        for (var i = 0; i < _poolSize; i++) {
          var s = _soundManager.add(id, { volume: vol });
          _pools[id].push(s);
        }
      }

      var pool = _pools[id];
      var cursor = _poolCursors[id] || 0;

      // Find a non-playing slot
      var player = null;
      for (var j = 0; j < pool.length; j++) {
        var idx = (cursor + j) % pool.length;
        if (!pool[idx].isPlaying) {
          player = pool[idx];
          _poolCursors[id] = (idx + 1) % pool.length;
          break;
        }
      }
      if (!player) {
        player = pool[cursor];
        _poolCursors[id] = (cursor + 1) % pool.length;
        player.stop();
      }

      player.volume = vol;
      player.play();
      return true;
    } catch (e) {
      console.warn('[PhaserAudioAdapter] playSfx error:', id, e);
      return false;
    }
  }

  /**
   * Play a looping SFX through Phaser.
   * @param {string} id
   * @param {number} volume — final volume (0..1)
   * @returns {boolean} true if Phaser handled the playback
   */
  function playLoop(id, volume) {
    if (!_active || !_soundManager) return false;
    if (!_preloaded[id]) return false;

    var vol = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 1;

    try {
      var player = _loopPlayers[id];
      if (!player) {
        player = _soundManager.add(id, { loop: true, volume: vol });
        _loopPlayers[id] = player;
      }

      player.volume = vol;
      if (!player.isPlaying) {
        player.play();
      }
      return true;
    } catch (e) {
      console.warn('[PhaserAudioAdapter] playLoop error:', id, e);
      return false;
    }
  }

  /**
   * Stop a looping SFX.
   * @param {string} id
   */
  function stopLoop(id) {
    if (!_active) return;
    var player = _loopPlayers[id];
    if (player && player.isPlaying) {
      try { player.stop(); } catch (e) {}
    }
  }

  /**
   * Update volume of a running loop.
   * @param {string} id
   * @param {number} volume — final volume (0..1)
   */
  function setLoopVolume(id, volume) {
    if (!_active) return;
    var player = _loopPlayers[id];
    if (!player || !player.isPlaying) return;
    player.volume = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 1;
  }

  /**
   * Pause all Phaser audio (e.g. on game pause / visibility hidden).
   */
  function pauseAll() {
    if (!_active || !_soundManager) return;
    try { _soundManager.pauseAll(); } catch (e) {}
  }

  /**
   * Resume all Phaser audio (e.g. on game resume / visibility visible).
   */
  function resumeAll() {
    if (!_active || !_soundManager) return;
    try { _soundManager.resumeAll(); } catch (e) {}
  }

  /**
   * Get the list of preloaded SFX ids.
   * @returns {string[]}
   */
  function getPreloadedIds() {
    var ids = [];
    for (var id in _preloaded) {
      if (_preloaded.hasOwnProperty(id) && _preloaded[id]) {
        ids.push(id);
      }
    }
    return ids;
  }

  function _getActiveScene() {
    var bridge = global.Game && global.Game.PhaserBridge;
    return bridge && typeof bridge.getScene === 'function' ? bridge.getScene() : null;
  }

  function destroy() {
    // Stop and remove all loop players
    for (var lid in _loopPlayers) {
      if (_loopPlayers.hasOwnProperty(lid)) {
        try {
          if (_loopPlayers[lid] && _loopPlayers[lid].isPlaying) _loopPlayers[lid].stop();
          if (_loopPlayers[lid] && typeof _loopPlayers[lid].destroy === 'function') _loopPlayers[lid].destroy();
        } catch (e) {}
      }
    }

    // Destroy all pool instances
    for (var pid in _pools) {
      if (_pools.hasOwnProperty(pid)) {
        var pool = _pools[pid];
        for (var i = 0; i < pool.length; i++) {
          try {
            if (pool[i] && pool[i].isPlaying) pool[i].stop();
            if (pool[i] && typeof pool[i].destroy === 'function') pool[i].destroy();
          } catch (e) {}
        }
      }
    }

    _soundManager = null;
    _active = false;
    _preloaded = {};
    _loopPlayers = {};
    _pools = {};
    _poolCursors = {};
  }

  global.Game = global.Game || {};
  global.Game.PhaserAudioAdapter = {
    init: init,
    isActive: isActive,
    preloadSfx: preloadSfx,
    playSfx: playSfx,
    playLoop: playLoop,
    stopLoop: stopLoop,
    setLoopVolume: setLoopVolume,
    pauseAll: pauseAll,
    resumeAll: resumeAll,
    getPreloadedIds: getPreloadedIds,
    destroy: destroy,
  };
}(window));
