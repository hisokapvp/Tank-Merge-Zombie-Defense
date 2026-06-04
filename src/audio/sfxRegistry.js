/*
 * src/audio/sfxRegistry.js
 *
 * Canonical SFX manifest loader. Reads assets/sfx/registry.json and exposes
 * Game.SfxRegistry with getSources()/getChannels()/validate(currentSources, currentChannels).
 *
 * Design contract:
 *   - The JSON manifest is the source of truth for SFX_SOURCES and SFX_CHANNELS.
 *   - Inline literals in game.js, src/audio/sfxPoolRuntime.js and src/audio/settingsAudio.js
 *     remain as emergency fallback (boot still works if fetch fails or runs offline).
 *   - On boot, game.js calls Game.SfxRegistry.load() then validate() against its in-code
 *     literals. Drift is logged via console.warn and live SFX_SOURCES is synced via the
 *     existing setSfxSources() per-id mutator (no destructive overwrite of the literal).
 *   - validate() returns a structured diff so any future tests / boot smoke can assert no drift.
 */
(function (global) {
  'use strict';

  var REGISTRY_URL = 'assets/sfx/registry.json';

  var _state = {
    loaded: false,
    error: null,
    version: 0,
    channels: null,
    sources: null,
    music: null,
    pendingPromise: null,
  };

  function isStr(v) { return typeof v === 'string' && v.length > 0; }

  function isSourceShape(v) {
    if (isStr(v)) return true;
    if (!Array.isArray(v)) return false;
    for (var i = 0; i < v.length; i++) if (!isStr(v[i])) return false;
    return v.length > 0;
  }

  function normalizeSource(v) {
    if (isStr(v)) return [v];
    if (Array.isArray(v)) {
      var out = [];
      for (var i = 0; i < v.length; i++) if (isStr(v[i])) out.push(v[i]);
      return out;
    }
    return [];
  }

  function sourcesEqual(a, b) {
    var na = normalizeSource(a);
    var nb = normalizeSource(b);
    if (na.length !== nb.length) return false;
    for (var i = 0; i < na.length; i++) if (na[i] !== nb[i]) return false;
    return true;
  }

  function safeWarn(msg, payload) {
    try {
      if (typeof console !== 'undefined' && typeof console.warn === 'function') {
        if (payload !== undefined) console.warn('[SfxRegistry] ' + msg, payload);
        else console.warn('[SfxRegistry] ' + msg);
      }
    } catch (e) { /* noop */ }
  }

  function safeInfo(msg, payload) {
    try {
      if (typeof console !== 'undefined' && typeof console.info === 'function') {
        if (payload !== undefined) console.info('[SfxRegistry] ' + msg, payload);
        else console.info('[SfxRegistry] ' + msg);
      }
    } catch (e) { /* noop */ }
  }

  function parseManifest(json) {
    if (!json || typeof json !== 'object') throw new Error('manifest is not an object');
    var version = Number.isFinite(json.version) ? Math.max(0, Math.floor(json.version)) : 1;
    var rawChannels = json.channels && typeof json.channels === 'object' ? json.channels : null;
    var rawSources = json.sources && typeof json.sources === 'object' ? json.sources : null;
    if (!rawChannels) throw new Error('manifest.channels missing');
    if (!rawSources) throw new Error('manifest.sources missing');

    var channels = {};
    Object.keys(rawChannels).forEach(function (id) {
      var ch = rawChannels[id];
      if (isStr(ch)) channels[id] = ch;
    });

    var sources = {};
    Object.keys(rawSources).forEach(function (id) {
      var src = rawSources[id];
      if (isSourceShape(src)) sources[id] = Array.isArray(src) ? src.slice() : src;
    });

    var music = {};
    var rawMusic = json.music && typeof json.music === 'object' ? json.music : null;
    if (rawMusic) {
      Object.keys(rawMusic).forEach(function (id) {
        var src = rawMusic[id];
        if (isSourceShape(src)) music[id] = Array.isArray(src) ? src.slice() : src;
      });
    }

    return { version: version, channels: channels, sources: sources, music: music };
  }

  function load(opts) {
    var force = !!(opts && opts.force);
    if (_state.loaded && !force) return Promise.resolve(getSnapshot());
    if (_state.pendingPromise && !force) return _state.pendingPromise;

    var url = (opts && isStr(opts.url)) ? opts.url : REGISTRY_URL;

    if (typeof fetch !== 'function') {
      var err = new Error('fetch unavailable');
      _state.error = err;
      return Promise.reject(err);
    }

    var p = fetch(url, { credentials: 'same-origin' })
      .then(function (resp) {
        if (!resp || !resp.ok) throw new Error('HTTP ' + (resp && resp.status));
        return resp.json();
      })
      .then(function (json) {
        var parsed = parseManifest(json);
        _state.loaded = true;
        _state.error = null;
        _state.version = parsed.version;
        _state.channels = parsed.channels;
        _state.sources = parsed.sources;
        _state.music = parsed.music || {};
        _state.pendingPromise = null;
        safeInfo('manifest loaded v' + parsed.version + ': ' +
          Object.keys(parsed.sources).length + ' sources, ' +
          Object.keys(parsed.channels).length + ' channels');
        return getSnapshot();
      })
      .catch(function (err) {
        _state.error = err;
        _state.pendingPromise = null;
        safeWarn('manifest load failed; using inline fallback literals', err && err.message);
        throw err;
      });

    _state.pendingPromise = p;
    return p;
  }

  function getSnapshot() {
    return {
      loaded: _state.loaded,
      version: _state.version,
      channels: _state.channels ? Object.assign({}, _state.channels) : null,
      sources: _state.sources ? Object.assign({}, _state.sources) : null,
      error: _state.error ? String(_state.error.message || _state.error) : null,
    };
  }

  function getSources() {
    return _state.sources ? Object.assign({}, _state.sources) : null;
  }

  function getChannels() {
    return _state.channels ? Object.assign({}, _state.channels) : null;
  }

  function getMusic() {
    return _state.music ? Object.assign({}, _state.music) : null;
  }

  /*
   * validate(currentSources, currentChannels)
   *   currentSources: { id: string|string[] } as held by game.js / sfxPoolRuntime / settingsAudio
   *   currentChannels: { id: 'gameplay'|'ui' }
   * Returns { ok: boolean, missingInRegistry: string[], missingInRuntime: string[],
   *           sourceMismatches: [{ id, runtime, registry }],
   *           channelMismatches: [{ id, runtime, registry }] }.
   */
  function validate(currentSources, currentChannels) {
    var report = {
      ok: true,
      loaded: _state.loaded,
      missingInRegistry: [],
      missingInRuntime: [],
      sourceMismatches: [],
      channelMismatches: [],
    };
    if (!_state.loaded) {
      report.ok = false;
      return report;
    }
    var regSources = _state.sources || {};
    var regChannels = _state.channels || {};
    var runSources = currentSources && typeof currentSources === 'object' ? currentSources : {};
    var runChannels = currentChannels && typeof currentChannels === 'object' ? currentChannels : {};

    Object.keys(runSources).forEach(function (id) {
      if (!Object.prototype.hasOwnProperty.call(regSources, id)) {
        report.missingInRegistry.push(id);
      } else if (!sourcesEqual(runSources[id], regSources[id])) {
        report.sourceMismatches.push({ id: id, runtime: runSources[id], registry: regSources[id] });
      }
    });
    Object.keys(regSources).forEach(function (id) {
      if (!Object.prototype.hasOwnProperty.call(runSources, id)) {
        report.missingInRuntime.push(id);
      }
    });

    Object.keys(runChannels).forEach(function (id) {
      if (!Object.prototype.hasOwnProperty.call(regChannels, id)) return;
      if (runChannels[id] !== regChannels[id]) {
        report.channelMismatches.push({ id: id, runtime: runChannels[id], registry: regChannels[id] });
      }
    });

    if (report.missingInRegistry.length || report.missingInRuntime.length ||
        report.sourceMismatches.length || report.channelMismatches.length) {
      report.ok = false;
    }
    return report;
  }

  function logValidationReport(report) {
    if (!report) return;
    if (report.ok) {
      safeInfo('validate-on-boot: no drift between inline literals and registry');
      return;
    }
    if (!report.loaded) {
      safeWarn('validate-on-boot: registry not loaded; skipping drift check');
      return;
    }
    if (report.missingInRegistry.length) {
      safeWarn('validate-on-boot: ids present in runtime but missing in registry.json', report.missingInRegistry);
    }
    if (report.missingInRuntime.length) {
      safeWarn('validate-on-boot: ids present in registry.json but missing in runtime', report.missingInRuntime);
    }
    if (report.sourceMismatches.length) {
      safeWarn('validate-on-boot: source drift (registry wins)', report.sourceMismatches);
    }
    if (report.channelMismatches.length) {
      safeWarn('validate-on-boot: channel drift', report.channelMismatches);
    }
  }

  global.Game = global.Game || {};
  global.Game.SfxRegistry = {
    REGISTRY_URL: REGISTRY_URL,
    load: load,
    getSources: getSources,
    getChannels: getChannels,
    getMusic: getMusic,
    getSnapshot: getSnapshot,
    validate: validate,
    logValidationReport: logValidationReport,
  };
})(typeof window !== 'undefined' ? window : this);
