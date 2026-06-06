/**
 * Game.PerfCapture — real-time performance capture tool (perf-capture-tool).
 *
 * Layered on top of Game.Profiler. Activated ONLY from the ?debug=1 debug
 * panel (Perf tab). While capturing, it collects deep per-phase / per-entity /
 * memory analytics during a laggy moment and exports an AI-optimized report:
 * a single clipboard payload = Markdown summary + a fenced ```json block
 * (self-describing schema), plus a downloadable .json. A minimal fixed-corner
 * overlay shows FPS / frame ms / top-3 phases, throttled and updated post-draw.
 *
 * Zero-overhead contract:
 *  - All collection happens ONLY while capturing (isCapturing() === true).
 *  - onFrame() early-outs in O(1) when not capturing.
 *  - Ring buffers + scratch objects are pre-allocated; steady state is alloc-free.
 *  - Report serialization happens ONLY on export (off the hot path).
 *  - Reachable only via the debug panel, which only exists under ?debug=1.
 *  - On stop(), Profiler is restored to its release default (enabled iff
 *    Game.DEBUG === true), so a non-debug session is back to zero overhead.
 */
(function (global) {
  'use strict';

  // ── Tunables ───────────────────────────────────────────────────────────────
  var RING_CAP = 600;            // ~10s @ 60fps of frame history
  var OVERLAY_THROTTLE_MS = 150; // overlay refresh cadence (~6-7 Hz)
  var ENTITY_SAMPLE_MS = 200;    // entity-collector cadence (O(N) scan, ~5 Hz)
  var JANK_MS = 50;              // frame interval above this counts as jank
  var LONG_FRAME_MS = 1000 / 30; // frame interval above this = below 30fps
  var GC_DROP_BYTES = 1.5 * 1024 * 1024; // heap drop that looks like a GC

  // Static phase → code-location map embedded in the report so a downstream AI
  // agent can jump straight to the implementation. Function names are stable;
  // line numbers intentionally omitted (they drift).
  var PHASE_LOCATIONS = {
    'loop.update': 'game.js: loop() update block (if (!paused) { ... })',
    'loop.ui': 'game.js: updateUI()',
    'loop.draw': 'game.js: draw()',
    'stepZombies': 'game.js: stepZombies()',
    'cornerTowers.update': 'src/mechanics CornerTowers.update()',
    'talents.update': 'talents v2 onUpdate()/tickStatuses() (loop)',
    'stepTanks': 'game.js: stepTanks()',
    'stepProjectiles': 'game.js: stepProjectiles()',
    'stepProjectiles.gridRebuild': 'game.js: stepProjectiles() zmap fill + rebuildZombieCollisionGrid()',
    'stepProjectiles.bullets': 'game.js: stepProjectiles() bullet loop',
    'impactAt': 'game.js: impactAt()',
    'stepDecals': 'game.js: stepDecals()',
    'chipEffects.step': 'src/mechanics/chipEffects.js stepChipEffects()',
    'stepCrate': 'game.js: stepCrate()',
    'cleanupKills': 'game.js: cleanupKills()',
    'stepImpacts': 'game.js: stepImpacts()',
    'stepParticles': 'game.js: stepParticles()',
    'stepDamageNumbers': 'game.js: stepDamageNumbers()',
    'stepSupercomputer': 'game.js: stepSupercomputer()',
    'productionLine.step': 'src/systems ProductionLine.step()',
    'drones.step': 'src/mechanics Drones.step()',
    'drawZombies': 'game.js: drawDecorZombieLayer()',
    'drawZombies.buildSort': 'game.js: drawDecorZombieLayer() items build + sort',
    'drawZombies.drawEntities': 'game.js: drawDecorZombieLayer() entity draw loop',
    'drawTank': 'game.js: drawOrbitingTanks()/drawTank()',
    'renderFenceBase': 'game.js: renderFenceBase()',
    'renderFenceHpBars': 'game.js: renderFenceHpBars()',
    'drawDecals': 'game.js: drawDecals()',
    'drawProjectiles': 'game.js: drawProjectiles()',
    'drawImpacts': 'game.js: drawImpacts()',
    'drawParticles': 'game.js: drawParticles()',
    'drawDamageNumbers': 'game.js: drawDamageNumbers()'
  };

  var UMBRELLA = { 'loop.update': 1, 'loop.ui': 1, 'loop.draw': 1 };

  // ── Capture state ───────────────────────────────────────────────────────────
  var capturing = false;
  var _userTiming = false;
  var _getEnv = null;

  // Frame ring buffers (pre-allocated, reused for the life of the page).
  var _frameMsRing = new Float32Array(RING_CAP);     // CPU ms per frame
  var _intervalMsRing = new Float32Array(RING_CAP);   // real interval ms per frame
  var _ringHead = 0;
  var _ringFilled = 0;

  var _frameCount = 0;
  var _prevFrameNow = 0;
  var _worstCpuMs = 0;
  var _worstIntervalMs = 0;
  var _jankCount = 0;
  var _longFrameCount = 0;

  var _lastOverlayMs = 0;
  var _lastEntityMs = 0;

  var _startWallMs = 0;
  var _stopWallMs = 0;
  var _startNow = 0;
  var _stopNow = 0;

  // Per-phase running aggregates (name → {sum,count,min,max,last}). Keys are
  // added once per distinct phase (warmup) then the shape is stable.
  var _phaseAgg = Object.create(null);

  // Entity aggregates (metric → {cur,peak,sum,count}) + zombie composition.
  var _entityAgg = Object.create(null);
  var _zCompScratch = Object.create(null); // reused per entity sample
  var _zPeakComp = Object.create(null);    // composition at the busiest sample
  var _zPeakTotal = 0;

  // Memory tracking (Chromium performance.memory only).
  var _memSupported = true;
  var _memSamples = 0;
  var _memStart = 0;
  var _memPeak = 0;
  var _memMin = 0;
  var _memLast = 0;
  var _memLimit = 0;
  var _gcEvents = 0;

  // Overlay top-3 scratch (no per-frame allocation).
  var _t3n0 = '', _t3n1 = '', _t3n2 = '';
  var _t3v0 = 0, _t3v1 = 0, _t3v2 = 0;

  var _overlayEl = null;

  // ── Small helpers ───────────────────────────────────────────────────────────
  function _nowMs() {
    return (global.performance && typeof global.performance.now === 'function')
      ? global.performance.now()
      : Date.now();
  }
  function _numAsc(a, b) { return a - b; }
  function _mb(bytes) { return (bytes || 0) / (1024 * 1024); }
  function _round(n, d) {
    var f = Math.pow(10, d || 0);
    return Math.round((Number(n) || 0) * f) / f;
  }
  function _keyCount(obj) {
    var n = 0;
    for (var k in obj) { if (k) n++; }
    return n;
  }
  function _shortPhase(name) {
    if (!name) return '';
    return name.length > 28 ? name.slice(-28) : name;
  }

  // ── Ring + aggregate writers (shared by onFrame and the test harness) ───────
  function _pushFrame(cpuMs, intervalMs) {
    cpuMs = (typeof cpuMs === 'number' && isFinite(cpuMs)) ? cpuMs : 0;
    intervalMs = (typeof intervalMs === 'number' && isFinite(intervalMs)) ? intervalMs : 0;
    _frameMsRing[_ringHead] = cpuMs;
    _intervalMsRing[_ringHead] = intervalMs;
    _ringHead = (_ringHead + 1) % RING_CAP;
    if (_ringFilled < RING_CAP) _ringFilled++;
    if (cpuMs > _worstCpuMs) _worstCpuMs = cpuMs;
    if (intervalMs > _worstIntervalMs) _worstIntervalMs = intervalMs;
    if (intervalMs >= JANK_MS) _jankCount++;
    if (intervalMs >= LONG_FRAME_MS) _longFrameCount++;
  }

  function _accumPhase(name, ms) {
    if (!(ms > 0)) return; // a phase that did not run this frame reads 0
    var a = _phaseAgg[name];
    if (!a) { a = _phaseAgg[name] = { sum: 0, count: 0, min: Infinity, max: 0, last: 0 }; }
    a.sum += ms;
    a.count++;
    a.last = ms;
    if (ms < a.min) a.min = ms;
    if (ms > a.max) a.max = ms;
  }

  function _recordEntity(metric, val) {
    val = (typeof val === 'number' && isFinite(val)) ? val : 0;
    var e = _entityAgg[metric];
    if (!e) { e = _entityAgg[metric] = { cur: 0, peak: 0, sum: 0, count: 0 }; }
    e.cur = val;
    if (val > e.peak) e.peak = val;
    e.sum += val;
    e.count++;
  }

  // ── Per-frame collector (hot path while capturing) ──────────────────────────
  function onFrame(now, dt, state) {
    if (!capturing) return;
    var Prof = global.Game && global.Game.Profiler;
    if (!Prof || typeof Prof.getFrameMs !== 'function') return;

    var nowMs = (typeof now === 'number' && isFinite(now)) ? now : _nowMs();
    var cpuMs = Prof.getFrameMs('loop.update') + Prof.getFrameMs('loop.ui') + Prof.getFrameMs('loop.draw');

    var intervalMs;
    if (_prevFrameNow > 0) intervalMs = nowMs - _prevFrameNow;
    else intervalMs = (typeof dt === 'number' && dt > 0) ? dt * 1000 : cpuMs;
    if (!(intervalMs > 0)) intervalMs = cpuMs;
    _prevFrameNow = nowMs;
    _frameCount++;

    _pushFrame(cpuMs, intervalMs);
    Prof.forEachFrameMs(_accumPhase);
    _sampleMemory();

    if (nowMs - _lastEntityMs >= ENTITY_SAMPLE_MS) {
      _lastEntityMs = nowMs;
      _sampleEntities(state);
    }
    if (_userTiming) _emitUserTiming(nowMs, Prof);
    if (nowMs - _lastOverlayMs >= OVERLAY_THROTTLE_MS) {
      _lastOverlayMs = nowMs;
      _updateOverlay(cpuMs, intervalMs);
    }
  }

  function _sampleMemory() {
    if (!_memSupported) return;
    var perf = global.performance;
    var mem = perf && perf.memory;
    if (!mem || typeof mem.usedJSHeapSize !== 'number') { _memSupported = false; return; }
    var used = mem.usedJSHeapSize;
    if (_memSamples === 0) { _memStart = used; _memMin = used; _memPeak = used; _memLast = used; }
    if (_memLast > 0 && used < _memLast - GC_DROP_BYTES) _gcEvents++;
    if (used > _memPeak) _memPeak = used;
    if (used < _memMin) _memMin = used;
    _memLast = used;
    _memSamples++;
    if (typeof mem.jsHeapSizeLimit === 'number') _memLimit = mem.jsHeapSizeLimit;
  }

  function _sampleEntities(state) {
    if (!state) return;
    var total = 0, alive = 0, dying = 0;
    var z = state.zombies;
    for (var sk in _zCompScratch) _zCompScratch[sk] = 0;
    if (z && z.length) {
      total = z.length;
      for (var i = 0; i < z.length; i++) {
        var zz = z[i];
        if (!zz) continue;
        if (zz.state === 'dying') dying++; else alive++;
        var tid = (zz.type && zz.type.id != null) ? ('' + zz.type.id) : 'unknown';
        _zCompScratch[tid] = (_zCompScratch[tid] || 0) + 1;
      }
    }
    _recordEntity('zombies', total);
    _recordEntity('zombiesAlive', alive);
    _recordEntity('zombiesDying', dying);
    _recordEntity('projectiles', (state.projectiles && state.projectiles.length) || 0);
    _recordEntity('particles', (state.particles && state.particles.length) || 0);
    _recordEntity('impacts', (state.impacts && state.impacts.length) || 0);
    _recordEntity('decals', (state.decals && state.decals.length) || 0);
    _recordEntity('damageNumbers', (state.damageNumbers && state.damageNumbers.length) || 0);

    var tanks = 0;
    var cells = state.cells;
    if (cells && cells.length) {
      for (var ci = 0; ci < cells.length; ci++) { if (cells[ci] && cells[ci].tank) tanks++; }
    }
    _recordEntity('tanksOnBoard', tanks);
    _recordEntity('drones', (state.drones && state.drones.length) || 0);

    if (total >= _zPeakTotal) {
      _zPeakTotal = total;
      for (var pk in _zPeakComp) _zPeakComp[pk] = 0;
      for (var ck in _zCompScratch) { if (_zCompScratch[ck] > 0) _zPeakComp[ck] = _zCompScratch[ck]; }
    }
  }

  // ── Optional DevTools User Timing (flame chart) ─────────────────────────────
  // Lays the 3 top-level phases sequentially within the just-finished frame.
  // Approximate (ignores interleaving) but produces a readable high-level strip.
  function _emitUserTiming(nowMs, Prof) {
    var perf = global.performance;
    if (!perf || typeof perf.measure !== 'function') { _userTiming = false; return; }
    var u = Prof.getFrameMs('loop.update');
    var i = Prof.getFrameMs('loop.ui');
    var d = Prof.getFrameMs('loop.draw');
    var t = nowMs - (u + i + d);
    try {
      if (u > 0) { perf.measure('PerfCapture:update', { start: t, duration: u }); t += u; }
      if (i > 0) { perf.measure('PerfCapture:ui', { start: t, duration: i }); t += i; }
      if (d > 0) { perf.measure('PerfCapture:draw', { start: t, duration: d }); t += d; }
    } catch (e) { _userTiming = false; }
  }

  // ── Overlay (DOM, post-draw, throttled) ─────────────────────────────────────
  function _ensureOverlay() {
    var doc = global.document;
    if (!doc || typeof doc.createElement !== 'function') return null;
    if (_overlayEl && _overlayEl.parentNode) return _overlayEl;
    var el = doc.createElement('div');
    el.id = 'perfCaptureOverlay';
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = [
      'position:fixed', 'left:8px', 'bottom:8px', 'z-index:99999',
      'font:11px/1.35 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace',
      'color:#9effa6', 'background:rgba(8,12,10,.82)',
      'border:1px solid rgba(120,255,150,.35)', 'border-radius:6px',
      'padding:6px 8px', 'white-space:pre', 'pointer-events:none',
      'text-shadow:0 1px 2px rgba(0,0,0,.6)', 'min-width:140px'
    ].join(';');
    (doc.body || doc.documentElement).appendChild(el);
    _overlayEl = el;
    return el;
  }

  function _top3Reset() { _t3n0 = _t3n1 = _t3n2 = ''; _t3v0 = _t3v1 = _t3v2 = 0; }
  function _top3Cb(name, ms) {
    if (!(ms > 0) || UMBRELLA[name]) return;
    if (ms > _t3v0) {
      _t3v2 = _t3v1; _t3n2 = _t3n1;
      _t3v1 = _t3v0; _t3n1 = _t3n0;
      _t3v0 = ms; _t3n0 = name;
    } else if (ms > _t3v1) {
      _t3v2 = _t3v1; _t3n2 = _t3n1;
      _t3v1 = ms; _t3n1 = name;
    } else if (ms > _t3v2) {
      _t3v2 = ms; _t3n2 = name;
    }
  }
  function _top3Lines() {
    var out = [];
    if (_t3n0) out.push('1 ' + _shortPhase(_t3n0) + ' ' + _t3v0.toFixed(1));
    if (_t3n1) out.push('2 ' + _shortPhase(_t3n1) + ' ' + _t3v1.toFixed(1));
    if (_t3n2) out.push('3 ' + _shortPhase(_t3n2) + ' ' + _t3v2.toFixed(1));
    return out.length ? out.join('\n') : '(no phases yet)';
  }

  function _updateOverlay(cpuMs, intervalMs) {
    var el = _overlayEl;
    if (!el) return;
    var Prof = global.Game && global.Game.Profiler;
    var fps = intervalMs > 0 ? (1000 / intervalMs) : 0;
    _top3Reset();
    if (Prof && typeof Prof.forEachFrameMs === 'function') Prof.forEachFrameMs(_top3Cb);
    el.textContent = 'PERF \u25CF capture\n'
      + 'fps ' + Math.round(fps) + '  frame ' + cpuMs.toFixed(1) + 'ms\n'
      + _top3Lines();
  }

  // ── Activation ──────────────────────────────────────────────────────────────
  function _resetData() {
    _ringHead = 0;
    _ringFilled = 0;
    _frameCount = 0;
    _prevFrameNow = 0;
    _worstCpuMs = 0;
    _worstIntervalMs = 0;
    _jankCount = 0;
    _longFrameCount = 0;
    _lastOverlayMs = 0;
    _lastEntityMs = 0;
    _phaseAgg = Object.create(null);
    _entityAgg = Object.create(null);
    for (var zk in _zPeakComp) delete _zPeakComp[zk];
    for (var zs in _zCompScratch) delete _zCompScratch[zs];
    _zPeakTotal = 0;
    _memSupported = true;
    _memSamples = 0;
    _memStart = 0; _memPeak = 0; _memMin = 0; _memLast = 0; _memLimit = 0; _gcEvents = 0;
    _startWallMs = 0; _stopWallMs = 0; _startNow = 0; _stopNow = 0;
  }

  function start() {
    var Prof = global.Game && global.Game.Profiler;
    if (!Prof) return false;
    _resetData();
    if (typeof Prof.reset === 'function') Prof.reset();
    if (typeof Prof.setEnabled === 'function') Prof.setEnabled(true);
    var perf = global.performance;
    if (perf && typeof perf.clearMeasures === 'function') { try { perf.clearMeasures(); } catch (e) {} }
    capturing = true;
    _startWallMs = Date.now();
    _startNow = _nowMs();
    _ensureOverlay();
    if (_overlayEl) { _overlayEl.style.display = 'block'; _overlayEl.textContent = 'PERF \u25CF capture\n(warming up)'; }
    return true;
  }

  function stop() {
    if (!capturing) return false;
    capturing = false;
    _stopWallMs = Date.now();
    _stopNow = _nowMs();
    var Prof = global.Game && global.Game.Profiler;
    if (Prof && typeof Prof.setEnabled === 'function') {
      // Restore the release-correct default: markers on iff Game.DEBUG === true.
      var dbg = !!(global.Game && global.Game.DEBUG === true);
      Prof.setEnabled(dbg);
    }
    if (_overlayEl) _overlayEl.textContent = 'PERF \u25CB stopped\n' + _miniSummaryLine();
    return true;
  }

  function toggle() { return capturing ? stop() : start(); }

  function reset() {
    var wasCapturing = capturing;
    _resetData();
    var Prof = global.Game && global.Game.Profiler;
    if (Prof && typeof Prof.reset === 'function') Prof.reset();
    if (_overlayEl) _overlayEl.textContent = wasCapturing ? 'PERF \u25CF capture\n(reset)' : 'PERF \u25CB idle';
  }

  function isCapturing() { return capturing; }
  function setEnvProvider(fn) { _getEnv = (typeof fn === 'function') ? fn : null; }
  function setUserTiming(flag) { _userTiming = !!flag; }
  function isUserTiming() { return _userTiming; }

  // ── Summary / report ────────────────────────────────────────────────────────
  function _collectRing(ring) {
    var n = _ringFilled;
    var out = new Array(n);
    for (var i = 0; i < n; i++) out[i] = ring[i];
    return out;
  }

  function _percentileSorted(sorted, p) {
    var n = sorted.length;
    if (n === 0) return 0;
    if (n === 1) return sorted[0];
    var rank = (p / 100) * (n - 1);
    var lo = Math.floor(rank);
    var hi = Math.ceil(rank);
    if (lo === hi) return sorted[lo];
    var frac = rank - lo;
    return sorted[lo] * (1 - frac) + sorted[hi] * frac;
  }

  function _mean(arr) {
    var n = arr.length;
    if (!n) return 0;
    var s = 0;
    for (var i = 0; i < n; i++) s += arr[i];
    return s / n;
  }

  function _summarize() {
    var frames = _collectRing(_frameMsRing);
    var intervals = _collectRing(_intervalMsRing);
    frames.sort(_numAsc);
    intervals.sort(_numAsc);

    var frameCpuAvg = _mean(frames);
    var intervalAvg = _mean(intervals);
    var intervalP99 = _percentileSorted(intervals, 99);

    var sum = {
      frames: _ringFilled,
      durationSec: _startWallMs ? ((_stopWallMs || Date.now()) - _startWallMs) / 1000 : 0,
      frameCpu: {
        avg: frameCpuAvg,
        p50: _percentileSorted(frames, 50),
        p95: _percentileSorted(frames, 95),
        p99: _percentileSorted(frames, 99),
        max: frames.length ? frames[frames.length - 1] : 0,
        min: frames.length ? frames[0] : 0
      },
      interval: {
        avg: intervalAvg,
        p50: _percentileSorted(intervals, 50),
        p95: _percentileSorted(intervals, 95),
        p99: intervalP99,
        max: intervals.length ? intervals[intervals.length - 1] : 0
      },
      fpsAvg: intervalAvg > 0 ? 1000 / intervalAvg : 0,
      fps1Low: intervalP99 > 0 ? 1000 / intervalP99 : 0,
      jankCount: _jankCount,
      longFrameCount: _longFrameCount,
      jankThresholdMs: JANK_MS,
      longFrameThresholdMs: LONG_FRAME_MS,
      frameSplit: { update: 0, ui: 0, draw: 0 },
      phases: [],
      memSupported: _memSupported && _memSamples > 0,
      memStart: _memStart,
      memLast: _memLast,
      memPeak: _memPeak,
      memMin: _memMin,
      memLimit: _memLimit,
      memSamples: _memSamples,
      gcEvents: _gcEvents,
      memGrowthMB: _mb(_memLast - _memStart)
    };

    // Frame split from umbrella phases.
    var us = _phaseAgg['loop.update'];
    var uis = _phaseAgg['loop.ui'];
    var ds = _phaseAgg['loop.draw'];
    if (us && us.count) sum.frameSplit.update = us.sum / us.count;
    if (uis && uis.count) sum.frameSplit.ui = uis.sum / uis.count;
    if (ds && ds.count) sum.frameSplit.draw = ds.sum / ds.count;

    // Leaf phases ranked by total time.
    var budgets = {};
    var Prof = global.Game && global.Game.Profiler;
    if (Prof && typeof Prof.getBudgets === 'function') {
      try { budgets = Prof.getBudgets() || {}; } catch (e) { budgets = {}; }
    }
    var phases = sum.phases;
    for (var name in _phaseAgg) {
      if (UMBRELLA[name]) continue;
      var a = _phaseAgg[name];
      if (!a || !a.count) continue;
      var avg = a.sum / a.count;
      var budget = (budgets[name] != null && isFinite(budgets[name])) ? budgets[name] : null;
      phases.push({
        name: name,
        totalMs: a.sum,
        avgMs: avg,
        maxMs: a.max,
        minMs: a.min === Infinity ? 0 : a.min,
        frames: a.count,
        pctOfFrameAvg: frameCpuAvg > 0 ? (avg / frameCpuAvg) * 100 : 0,
        budgetMs: budget,
        overBudget: budget != null && avg >= budget,
        peakOverBudget: budget != null && a.max >= budget,
        location: PHASE_LOCATIONS[name] || null
      });
    }
    phases.sort(function (a, b) { return b.totalMs - a.totalMs; });
    return sum;
  }

  function _entitiesSnapshot() {
    var out = {};
    for (var m in _entityAgg) {
      var e = _entityAgg[m];
      out[m] = { current: e.cur, peak: e.peak, avg: e.count ? e.sum / e.count : 0 };
    }
    var comp = {};
    for (var t in _zPeakComp) { if (_zPeakComp[t] > 0) comp[t] = _zPeakComp[t]; }
    out.zombiePeakComposition = comp;
    out.zombiePeakTotal = _zPeakTotal;
    return out;
  }

  function _detectRenderEngine() {
    var G = global.Game || {};
    try {
      if (G.usePhaser === true) return 'phaser';
      if (G.RolloutController && typeof G.RolloutController.isPhaserActive === 'function'
          && G.RolloutController.isPhaserActive()) return 'phaser-hybrid';
    } catch (e) {}
    return 'legacy';
  }

  function _envSnapshot() {
    var env = {};
    var p = null;
    try { p = (typeof _getEnv === 'function') ? _getEnv() : null; } catch (e) { p = null; }
    env.qualityLow = p ? !!p.qualityLow : null;
    env.fxLevel = (p && isFinite(p.fxLevel)) ? p.fxLevel : null;
    env.maxParticles = (p && isFinite(p.maxParticles)) ? p.maxParticles : null;
    env.maxDecals = (p && isFinite(p.maxDecals)) ? p.maxDecals : null;
    env.dpr = (p && isFinite(p.dpr)) ? p.dpr : (isFinite(global.devicePixelRatio) ? global.devicePixelRatio : null);
    env.canvas = {
      w: (p && isFinite(p.canvasW)) ? p.canvasW : null,
      h: (p && isFinite(p.canvasH)) ? p.canvasH : null
    };
    var G = global.Game || {};
    try { env.fxDensity = (G.FxDensity && typeof G.FxDensity.getRaw === 'function') ? G.FxDensity.getRaw() : null; }
    catch (e) { env.fxDensity = null; }
    try {
      var mm = G.MobileMode;
      env.fpsCap = (mm && typeof mm.getFpsCap === 'function') ? mm.getFpsCap() : null;
    } catch (e) { env.fpsCap = null; }
    env.renderEngine = _detectRenderEngine();
    var nav = global.navigator;
    env.ua = (nav && nav.userAgent) ? nav.userAgent : null;
    env.hardwareConcurrency = (nav && isFinite(nav.hardwareConcurrency)) ? nav.hardwareConcurrency : null;
    env.deviceMemory = (nav && isFinite(nav.deviceMemory)) ? nav.deviceMemory : null;
    return env;
  }

  function _memVerdict(sum) {
    if (!sum.memSupported) return 'performance.memory unavailable (non-Chromium or flag off) — heap not measured.';
    return 'used ' + _round(_mb(sum.memLast), 1) + 'MB (start ' + _round(_mb(sum.memStart), 1)
      + ', peak ' + _round(_mb(sum.memPeak), 1) + '), growth ' + _round(sum.memGrowthMB, 1)
      + 'MB over ' + sum.memSamples + ' samples, ' + sum.gcEvents + ' GC-like drops.';
  }

  function _heuristic(sum) {
    var top = sum.phases.length ? sum.phases[0] : null;
    if (top && top.pctOfFrameAvg >= 35) {
      return 'Likely bottleneck: ' + top.name + ' (~' + _round(top.pctOfFrameAvg, 0)
        + '% of frame CPU, avg ' + _round(top.avgMs, 2) + 'ms, total ' + _round(top.totalMs, 0)
        + 'ms)' + (top.location ? ' — ' + top.location : '') + '.';
    }
    if (sum.memSupported && sum.memGrowthMB >= 8 && sum.gcEvents >= 3) {
      return 'Likely bottleneck: allocation churn / GC pressure (heap grew '
        + _round(sum.memGrowthMB, 1) + 'MB, ' + sum.gcEvents + ' GC drops) — look for per-frame allocations in hot phases.';
    }
    if (sum.frameCpu.p95 < 8 && sum.jankCount > 0) {
      return 'Frame CPU is low (p95 ' + _round(sum.frameCpu.p95, 1)
        + 'ms) but jank is present — likely GPU/raf/throttling or stalls outside measured phases.';
    }
    if (top) {
      return 'No single dominant phase; top phase ' + top.name + ' ~' + _round(top.pctOfFrameAvg, 0)
        + '% of frame. Inspect the ranked list and frame split.';
    }
    return 'Insufficient phase data — start capture during the laggy moment and replay it.';
  }

  function _miniSummaryLine() {
    var sum = _summarize();
    return 'fps ' + _round(sum.fpsAvg, 0) + ' (low ' + _round(sum.fps1Low, 0)
      + ') frameP95 ' + _round(sum.frameCpu.p95, 1) + 'ms';
  }

  function buildReport() {
    var sum = _summarize();
    var env = _envSnapshot();
    var entities = _entitiesSnapshot();

    var phasesJson = [];
    for (var i = 0; i < sum.phases.length; i++) {
      var ph = sum.phases[i];
      phasesJson.push({
        name: ph.name,
        file: ph.location,
        totalMs: _round(ph.totalMs, 3),
        avgMs: _round(ph.avgMs, 4),
        maxMs: _round(ph.maxMs, 4),
        minMs: _round(ph.minMs, 4),
        frames: ph.frames,
        pctOfFrameAvg: _round(ph.pctOfFrameAvg, 1),
        budgetMs: ph.budgetMs,
        overBudget: ph.overBudget,
        peakOverBudget: ph.peakOverBudget
      });
    }

    var json = {
      schema: 'tmzd.perfCapture.report',
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      legend: {
        purpose: 'Real-time frame profile captured from the TMZD main loop during a laggy moment. Use it to locate the bottleneck phase/entity and propose fixes.',
        frameCpu: 'Per-frame CPU time = loop.update + loop.ui + loop.draw (ms). Excludes raf idle gap.',
        interval: 'Real wall-clock gap between frames (ms). fps derives from this.',
        phases: 'Leaf instrumentation phases, ranked by totalMs. pctOfFrameAvg = avgMs / frameCpu.avg * 100. Phases may nest (e.g. drawZombies.* inside loop.draw); umbrella loop.* phases are reported separately as frameSplit.',
        budgets: 'budgetMs comes from assets/balance.json perf.profilerBudgetsMs. overBudget = avg >= budget; peakOverBudget = max >= budget.',
        entities: 'Entity counts sampled ~5Hz. current/peak/avg over samples. zombiePeakComposition is the per-type breakdown at the busiest sample.',
        memory: 'Chromium performance.memory only. growthMB = last - start. gcDrops = count of large heap-size drops between samples (GC heuristic).'
      },
      units: { time: 'ms', fps: 'frames/second', memory: 'MB', pct: '% of frame CPU' },
      capture: {
        durationSec: _round(sum.durationSec, 2),
        frames: sum.frames,
        ringCapacity: RING_CAP,
        userTimingEmitted: _userTiming,
        note: 'Instrumentation is active only while capturing; release/non-?debug=1 sessions have zero overhead.'
      },
      frame: {
        cpuMs: {
          avg: _round(sum.frameCpu.avg, 3),
          p50: _round(sum.frameCpu.p50, 3),
          p95: _round(sum.frameCpu.p95, 3),
          p99: _round(sum.frameCpu.p99, 3),
          max: _round(sum.frameCpu.max, 3),
          min: _round(sum.frameCpu.min, 3)
        },
        intervalMs: {
          avg: _round(sum.interval.avg, 3),
          p50: _round(sum.interval.p50, 3),
          p95: _round(sum.interval.p95, 3),
          p99: _round(sum.interval.p99, 3),
          max: _round(sum.interval.max, 3)
        },
        fps: { avg: _round(sum.fpsAvg, 1), p1Low: _round(sum.fps1Low, 1) },
        split: {
          updateMs: _round(sum.frameSplit.update, 3),
          uiMs: _round(sum.frameSplit.ui, 3),
          drawMs: _round(sum.frameSplit.draw, 3)
        },
        jankFrames: sum.jankCount,
        longFrames: sum.longFrameCount,
        jankThresholdMs: _round(sum.jankThresholdMs, 2),
        longFrameThresholdMs: _round(sum.longFrameThresholdMs, 2)
      },
      phases: phasesJson,
      entities: entities,
      memory: {
        supported: sum.memSupported,
        startMB: _round(_mb(sum.memStart), 2),
        lastMB: _round(_mb(sum.memLast), 2),
        peakMB: _round(_mb(sum.memPeak), 2),
        minMB: _round(_mb(sum.memMin), 2),
        growthMB: _round(sum.memGrowthMB, 2),
        gcDrops: sum.gcEvents,
        samples: sum.memSamples,
        heapLimitMB: _round(_mb(sum.memLimit), 2)
      },
      environment: env,
      verdict: { likelyBottleneck: _heuristic(sum), memory: _memVerdict(sum) }
    };

    var md = _buildMarkdown(sum, env, entities);
    var payload = md + '\n\n```json\n' + JSON.stringify(json, null, 2) + '\n```\n';
    return { markdown: md, json: json, payload: payload };
  }

  function _buildMarkdown(sum, env, entities) {
    var L = [];
    L.push('# TMZD Perf Capture Report');
    L.push('');
    L.push('**Captured:** ' + _round(sum.durationSec, 1) + 's over ' + sum.frames
      + ' frames • engine: ' + env.renderEngine + ' • ' + new Date().toISOString());
    L.push('');
    L.push('## FPS / Frame');
    L.push('- FPS avg **' + _round(sum.fpsAvg, 0) + '**, 1%-low **' + _round(sum.fps1Low, 0) + '**');
    L.push('- Frame CPU ms — p50 **' + _round(sum.frameCpu.p50, 1) + '**, p95 **'
      + _round(sum.frameCpu.p95, 1) + '**, p99 **' + _round(sum.frameCpu.p99, 1)
      + '**, max **' + _round(sum.frameCpu.max, 1) + '** (avg ' + _round(sum.frameCpu.avg, 1) + ')');
    L.push('- Frame split (avg ms) — update ' + _round(sum.frameSplit.update, 2)
      + ' • ui ' + _round(sum.frameSplit.ui, 2) + ' • draw ' + _round(sum.frameSplit.draw, 2));
    L.push('- Jank frames (>' + _round(sum.jankThresholdMs, 0) + 'ms): ' + sum.jankCount
      + ' • Long frames (>' + _round(sum.longFrameThresholdMs, 0) + 'ms): ' + sum.longFrameCount);
    L.push('');
    L.push('## Top hotspots (ranked by total time)');
    if (!sum.phases.length) {
      L.push('- (no phase data captured)');
    } else {
      var lim = Math.min(10, sum.phases.length);
      for (var i = 0; i < lim; i++) {
        var p = sum.phases[i];
        L.push('' + (i + 1) + '. **' + p.name + '** — avg ' + _round(p.avgMs, 3)
          + 'ms, total ' + _round(p.totalMs, 1) + 'ms, ' + _round(p.pctOfFrameAvg, 1) + '% of frame'
          + (p.overBudget ? ' ⚠️ OVER BUDGET (' + p.budgetMs + 'ms)' : (p.peakOverBudget ? ' ⚠️ peak over budget (' + p.budgetMs + 'ms)' : '')));
      }
    }
    L.push('');
    L.push('## Entities (peak)');
    var z = entities.zombies || { peak: 0 };
    L.push('- zombies peak ' + (z.peak || 0)
      + ' (alive peak ' + ((entities.zombiesAlive && entities.zombiesAlive.peak) || 0)
      + ', dying peak ' + ((entities.zombiesDying && entities.zombiesDying.peak) || 0) + ')');
    L.push('- projectiles ' + ((entities.projectiles && entities.projectiles.peak) || 0)
      + ' • particles ' + ((entities.particles && entities.particles.peak) || 0)
      + ' • impacts ' + ((entities.impacts && entities.impacts.peak) || 0)
      + ' • decals ' + ((entities.decals && entities.decals.peak) || 0)
      + ' • damageNumbers ' + ((entities.damageNumbers && entities.damageNumbers.peak) || 0));
    L.push('- tanks on board ' + ((entities.tanksOnBoard && entities.tanksOnBoard.peak) || 0)
      + ' • drones ' + ((entities.drones && entities.drones.peak) || 0));
    var compKeys = [];
    for (var ck in entities.zombiePeakComposition) compKeys.push(ck + ':' + entities.zombiePeakComposition[ck]);
    if (compKeys.length) L.push('- zombie peak composition — ' + compKeys.join(', '));
    L.push('');
    L.push('## Memory');
    L.push('- ' + _memVerdict(sum));
    L.push('');
    L.push('## Environment');
    L.push('- qualityLow ' + env.qualityLow + ' • fxLevel ' + env.fxLevel + ' • fxDensity ' + env.fxDensity
      + ' • fpsCap ' + env.fpsCap + ' • dpr ' + env.dpr);
    L.push('- canvas ' + (env.canvas.w) + '×' + (env.canvas.h) + ' • maxParticles ' + env.maxParticles
      + ' • maxDecals ' + env.maxDecals);
    L.push('- cores ' + env.hardwareConcurrency + ' • deviceMemory ' + env.deviceMemory + 'GB');
    if (env.ua) L.push('- UA `' + env.ua + '`');
    L.push('');
    L.push('## Likely bottleneck');
    L.push('- ' + _heuristic(sum));
    L.push('');
    L.push('> Full structured data in the JSON block below (self-describing schema + legend).');
    return L.join('\n');
  }

  function getReportPayload() { return buildReport().payload; }

  function getStatusText() {
    if (!_ringFilled && !capturing) {
      return 'Perf Capture idle.\nPress Start, reproduce the lag, then Stop and Copy AI report.';
    }
    var sum = _summarize();
    var lines = [];
    lines.push((capturing ? '● CAPTURING' : '○ stopped') + '  frames=' + sum.frames
      + '  ' + _round(sum.durationSec, 1) + 's');
    lines.push('fps avg ' + _round(sum.fpsAvg, 0) + '  1%-low ' + _round(sum.fps1Low, 0));
    lines.push('frame ms  p50 ' + _round(sum.frameCpu.p50, 1) + '  p95 ' + _round(sum.frameCpu.p95, 1)
      + '  max ' + _round(sum.frameCpu.max, 1));
    lines.push('split  upd ' + _round(sum.frameSplit.update, 1) + '  ui ' + _round(sum.frameSplit.ui, 1)
      + '  draw ' + _round(sum.frameSplit.draw, 1));
    lines.push('jank ' + sum.jankCount + '  long ' + sum.longFrameCount);
    var lim = Math.min(5, sum.phases.length);
    if (lim) {
      lines.push('top phases:');
      for (var i = 0; i < lim; i++) {
        var p = sum.phases[i];
        lines.push('  ' + (i + 1) + '. ' + p.name + ' ' + _round(p.avgMs, 2) + 'ms ('
          + _round(p.pctOfFrameAvg, 0) + '%)' + (p.overBudget ? ' !' : ''));
      }
    }
    if (sum.memSupported) {
      lines.push('heap ' + _round(_mb(sum.memLast), 1) + 'MB (+'
        + _round(sum.memGrowthMB, 1) + ', gc ' + sum.gcEvents + ')');
    }
    return lines.join('\n');
  }

  // ── Export side-effects (clipboard / download) ──────────────────────────────
  function _fallbackCopy(text) {
    var doc = global.document;
    if (!doc || typeof doc.createElement !== 'function') return false;
    try {
      var ta = doc.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      (doc.body || doc.documentElement).appendChild(ta);
      ta.focus();
      ta.select();
      var ok = doc.execCommand ? doc.execCommand('copy') : false;
      if (ta.parentNode) ta.parentNode.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  }

  function copyReport() {
    var payload = getReportPayload();
    var nav = global.navigator;
    if (nav && nav.clipboard && typeof nav.clipboard.writeText === 'function') {
      try {
        var r = nav.clipboard.writeText(payload);
        if (r && typeof r.catch === 'function') r.catch(function () { _fallbackCopy(payload); });
      } catch (e) { _fallbackCopy(payload); }
    } else {
      _fallbackCopy(payload);
    }
    return payload;
  }

  function _tsForFile() {
    var d = new Date();
    function p2(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + '-'
      + p2(d.getHours()) + p2(d.getMinutes()) + p2(d.getSeconds());
  }

  function downloadJson() {
    var rep = buildReport();
    var jsonText = JSON.stringify(rep.json, null, 2);
    var doc = global.document;
    if (!doc || typeof doc.createElement !== 'function'
        || typeof global.Blob !== 'function' || !global.URL || !global.URL.createObjectURL) {
      return jsonText;
    }
    try {
      var blob = new global.Blob([jsonText], { type: 'application/json' });
      var url = global.URL.createObjectURL(blob);
      var a = doc.createElement('a');
      a.href = url;
      a.download = 'tmzd-perf-' + _tsForFile() + '.json';
      (doc.body || doc.documentElement).appendChild(a);
      a.click();
      if (a.parentNode) a.parentNode.removeChild(a);
      global.URL.revokeObjectURL(url);
    } catch (e) {}
    return jsonText;
  }

  // ── Public API ──────────────────────────────────────────────────────────────
  global.Game = global.Game || {};
  global.Game.PerfCapture = {
    start: start,
    stop: stop,
    toggle: toggle,
    reset: reset,
    isCapturing: isCapturing,
    onFrame: onFrame,
    setEnvProvider: setEnvProvider,
    setUserTiming: setUserTiming,
    isUserTiming: isUserTiming,
    buildReport: buildReport,
    getReportPayload: getReportPayload,
    getStatusText: getStatusText,
    copyReport: copyReport,
    downloadJson: downloadJson,
    // Test-only seam (pure-Node ring/percentile/report verification).
    __test: {
      RING_CAP: RING_CAP,
      resetData: _resetData,
      setCapturing: function (b) { capturing = !!b; },
      pushFrame: _pushFrame,
      accumPhase: _accumPhase,
      recordEntity: _recordEntity,
      ringFilled: function () { return _ringFilled; },
      phaseKeyCount: function () { return _keyCount(_phaseAgg); },
      entityKeyCount: function () { return _keyCount(_entityAgg); },
      percentile: function (vals, p) { return _percentileSorted(vals.slice().sort(_numAsc), p); },
      summarize: _summarize,
      buildReport: buildReport
    }
  };
})(typeof window !== 'undefined' ? window : this);
