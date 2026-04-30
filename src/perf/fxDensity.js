/**
 * FxDensity — user-configurable visual effect density (0..1).
 *
 * Solo-pipeline-yandex-vk batch 1 / item A3 (TZ A1+A3).
 *
 * Public API (cached scalar reads, hot-path no-alloc):
 *   - Game.FxDensity.getDensity()           -> 0..1 cached scalar
 *   - Game.FxDensity.getRaw()               -> 0..100 int (UI value)
 *   - Game.FxDensity.shouldSpawn(weight=1)  -> boolean stochastic gate
 *   - Game.FxDensity.scaleCount(n)          -> Math.max(0, Math.round(n*density))
 *   - Game.FxDensity.scaleCap(n, floor=0)   -> Math.max(floor, Math.round(n*density))
 *
 * Game.Settings facade (canonical setter+getter for fxDensity):
 *   - Game.Settings.getFxDensity()          -> 0..1 normalized
 *   - Game.Settings.getFxDensityRaw()       -> 0..100 int
 *   - Game.Settings.setFxDensity(value)     -> clamp, persist into 'settings' LS,
 *                                              emit 'settings.fxDensity.changed'
 *   - Game.Settings.isFxDensityInitialized()
 *
 * Persistence: piggy-backs on the existing 'settings' localStorage key owned by
 * game.js (audio + autoPause). We read+merge+write the same JSON blob so legacy
 * loadSettings()/saveSettings() in game.js continue to operate on the same
 * structure. fxDensity / fxDensityInitialized fields survive untouched.
 *
 * First-run init: if fxDensityInitialized !== true, derive default from
 * Game.MobileMode (mobile -> 60, desktop -> 100), persist initialized=true.
 *
 * Phaser parity: helper readers are render-engine agnostic. Both legacy Canvas
 * paths (game.js draw*) and Phaser scenes consume Game.FxDensity through the
 * same Game.RenderRegistry shared-check hook so the value is always in lockstep
 * across renderers.
 *
 * Hot-path invariant: every public reader returns a primitive scalar; no object
 * allocation. shouldSpawn() uses a 32-bit Xorshift PRNG advanced inline.
 */
(function (global) {
  'use strict';

  // solo-pipeline-yandex-vk rework R1: pre-install a noop-safe namespace
  // BEFORE any potentially-throwing init runs. If the rest of this IIFE
  // crashes mid-execution (e.g. mid-eval syntax-tolerant browser quirk,
  // throwing localStorage proxy in a sandbox), Game.FxDensity is still
  // defined as a 100%-density noop so call sites in game.js / render code
  // never see `undefined.shouldSpawn()` and the game does not freeze.
  global.Game = global.Game || {};
  if (!global.Game.FxDensity) {
    global.Game.FxDensity = {
      getDensity: function () { return 1; },
      getRaw: function () { return 100; },
      shouldSpawn: function () { return true; },
      shouldSpawnFor: function () { return true; },
      scaleCount: function (n) { return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0; },
      scaleCap: function (n, floor) {
        var v = Number.isFinite(n) ? Math.round(n) : 0;
        var f = Number.isFinite(floor) ? floor : 0;
        return v > f ? v : f;
      },
      isInitialized: function () { return false; },
      _attachRenderRegistry: function () {},
      _isShim: true,
    };
  }

  var STORAGE_KEY = 'settings';
  var DEFAULT_RAW = 100;
  var MOBILE_DEFAULT_RAW = 60;

  var rawValue = DEFAULT_RAW;       // 0..100 int
  var density = 1;                   // 0..1 scalar (rawValue / 100)
  var initialized = false;
  var loaded = false;

  // 32-bit Xorshift state — advanced inside shouldSpawn (no allocation)
  var _rngState = 0x9E3779B1 | 0;

  function clampInt(value, min, max) {
    var n = Number(value);
    if (!Number.isFinite(n)) return min;
    n = Math.round(n);
    if (n < min) return min;
    if (n > max) return max;
    return n;
  }

  function readSettingsBlob() {
    try {
      var raw = global.localStorage && global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function writeSettingsBlob(patch) {
    try {
      if (!global.localStorage) return;
      var current = readSettingsBlob();
      // shallow-merge: never delete fields owned by other subsystems
      for (var key in patch) {
        if (Object.prototype.hasOwnProperty.call(patch, key)) {
          current[key] = patch[key];
        }
      }
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch (e) { /* quota/serialization failure is non-fatal */ }
  }

  function detectMobileDefaultRaw() {
    var MM = global.Game && global.Game.MobileMode;
    if (MM && typeof MM.isEnabled === 'function') {
      try {
        if (MM.isEnabled()) return MOBILE_DEFAULT_RAW;
      } catch (e) {}
    }
    return DEFAULT_RAW;
  }

  function ensureLoaded() {
    if (loaded) return;
    loaded = true;
    // solo-pipeline-yandex-vk rework R1: bulletproof bootstrap. Any failure
    // in localStorage parsing, MobileMode probing, or storage write must NOT
    // throw out of this helper. The whole point of FxDensity is to be a
    // best-effort visual scaler — if anything goes wrong we silently fall
    // back to full density (rawValue=100, density=1) so the game keeps
    // rendering instead of freezing on the first hot-path call.
    try {
      var blob = readSettingsBlob();
      var hasRaw = Number.isFinite(blob.fxDensity);
      var wasInitialized = blob.fxDensityInitialized === true;

      if (wasInitialized && hasRaw) {
        rawValue = clampInt(blob.fxDensity, 0, 100);
        initialized = true;
      } else {
        rawValue = detectMobileDefaultRaw();
        initialized = true;
        writeSettingsBlob({
          fxDensity: rawValue,
          fxDensityInitialized: true,
        });
      }
      density = rawValue / 100;
    } catch (e) {
      rawValue = DEFAULT_RAW;
      density = 1;
      initialized = true;
    }
  }

  function emitChange() {
    var ev = global.Game && (global.Game.Events || global.Game.events);
    if (ev && typeof ev.emit === 'function') {
      try { ev.emit('settings.fxDensity.changed', { raw: rawValue, density: density }); }
      catch (e) {}
    }
  }

  function setRaw(value) {
    ensureLoaded();
    var next = clampInt(value, 0, 100);
    if (next === rawValue) return density;
    rawValue = next;
    density = rawValue / 100;
    writeSettingsBlob({
      fxDensity: rawValue,
      fxDensityInitialized: true,
    });
    emitChange();
    return density;
  }

  function getDensity() {
    if (!loaded) ensureLoaded();
    return density;
  }

  function getRaw() {
    if (!loaded) ensureLoaded();
    return rawValue;
  }

  function isInitialized() {
    if (!loaded) ensureLoaded();
    return initialized;
  }

  function _advanceRng() {
    var x = _rngState | 0;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    _rngState = x | 0;
    return ((x >>> 0) % 0x10000) / 0x10000;
  }

  function shouldSpawn(weight) {
    if (!loaded) ensureLoaded();
    var w = Number.isFinite(weight) ? weight : 1;
    if (w <= 0) return false;
    var threshold = density * w;
    if (threshold >= 1) return true;
    if (threshold <= 0) return false;
    return _advanceRng() < threshold;
  }

  // R7 (solo-pipeline-yandex-vk rework3): deterministic per-id gate.
  // Same id always produces the same hash → same gate decision at a given
  // density, so per-zombie debuff icon visibility stays stable across frames
  // (no flicker) and recomputes consistently when density changes.
  // Hash: FNV-1a 32-bit over id stringified — no allocation beyond the
  // String() coercion (UUID strings come pre-stringified from crypto.randomUUID).
  function _hashIdToUnit(id) {
    if (id == null) return 0;
    var s = typeof id === 'string' ? id : String(id);
    if (s.length === 0) return 0;
    var h = 0x811C9DC5 | 0;          // FNV offset basis
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i) & 0xff;
      // FNV prime multiplication via shifts (32-bit safe)
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) | 0;
    }
    return ((h >>> 0) % 0x10000) / 0x10000; // [0, 1)
  }

  function shouldSpawnFor(id, weight) {
    if (!loaded) ensureLoaded();
    var w = Number.isFinite(weight) ? weight : 1;
    if (w <= 0) return false;
    var threshold = density * w;
    if (threshold >= 1) return true;
    if (threshold <= 0) return false;
    return _hashIdToUnit(id) < threshold;
  }

  function scaleCount(n) {
    if (!loaded) ensureLoaded();
    var v = Number(n);
    if (!Number.isFinite(v)) return 0;
    var scaled = Math.round(v * density);
    return scaled > 0 ? scaled : 0;
  }

  function scaleCap(n, floor) {
    if (!loaded) ensureLoaded();
    var v = Number(n);
    if (!Number.isFinite(v)) return 0;
    var f = Number.isFinite(floor) ? floor : 0;
    var scaled = Math.round(v * density);
    return scaled > f ? scaled : f;
  }

  // RenderRegistry parity hook: legacy Canvas path and Phaser scenes both call
  // Game.RenderRegistry.getFxDensity() (when registry is present) so neither
  // renderer reads from a duplicate source.
  function attachRenderRegistry() {
    var RR = global.Game && global.Game.RenderRegistry;
    if (!RR || typeof RR !== 'object') return;
    if (typeof RR.getFxDensity !== 'function') {
      RR.getFxDensity = getDensity;
    }
    if (typeof RR.shouldSpawnFx !== 'function') {
      RR.shouldSpawnFx = shouldSpawn;
    }
    if (typeof RR.shouldSpawnFxFor !== 'function') {
      RR.shouldSpawnFxFor = shouldSpawnFor;
    }
    if (typeof RR.scaleFxCount !== 'function') {
      RR.scaleFxCount = scaleCount;
    }
  }

  global.Game = global.Game || {};
  // solo-pipeline-yandex-vk rework R1: replace the noop shim installed at
  // the top of the IIFE with the real implementation now that init has
  // succeeded. Call sites that captured the shim earlier are fine — the
  // shim returned full density, the real impl returns the user's choice.
  global.Game.FxDensity = {
    getDensity: getDensity,
    getRaw: getRaw,
    shouldSpawn: shouldSpawn,
    shouldSpawnFor: shouldSpawnFor,
    scaleCount: scaleCount,
    scaleCap: scaleCap,
    isInitialized: isInitialized,
    _attachRenderRegistry: attachRenderRegistry,
  };

  global.Game.Settings = global.Game.Settings || {};
  if (typeof global.Game.Settings.getFxDensity !== 'function') {
    global.Game.Settings.getFxDensity = getDensity;
  }
  if (typeof global.Game.Settings.getFxDensityRaw !== 'function') {
    global.Game.Settings.getFxDensityRaw = getRaw;
  }
  if (typeof global.Game.Settings.setFxDensity !== 'function') {
    global.Game.Settings.setFxDensity = setRaw;
  }
  if (typeof global.Game.Settings.isFxDensityInitialized !== 'function') {
    global.Game.Settings.isFxDensityInitialized = isInitialized;
  }

  // eager bootstrap so first hot-path read does not have to lazy-load
  try { ensureLoaded(); } catch (_) {}
  try { attachRenderRegistry(); } catch (_) {}

  // re-attach when other modules finish wiring RenderRegistry later
  try {
    var ev = global.Game && (global.Game.Events || global.Game.events);
    if (ev && typeof ev.on === 'function') {
      ev.on('render.registry.ready', attachRenderRegistry);
    }
  } catch (e) {}
})(typeof window !== 'undefined' ? window : this);
