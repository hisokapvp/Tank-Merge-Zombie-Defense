// src/render/cornerTowers.js
// Item 3 (solo-pipeline-yandex-vk#1): угловые вышки внутри забора.
//
// Контракт:
//   • Конфиг читается из fence.json -> root.cornerTowers через FenceSprites.config.
//   • 4 вышки привязаны к угловым сегментам state.fenceSegments (cornerTL/TR/BL/BR).
//   • Когда зомби умирает в радиусе killRadiusPx вокруг центра вышки — играется
//     animations.work один раз, затем возврат в animations.idle (loop).
//   • Если атлас отсутствует или фрейм не разрешается — graceful no-render.
//   • Hot-path (update/draw): без heap allocations.
//
// Public API:
//   Game.CornerTowers.init({ getFenceConfig, getState, getAtlasResolver })
//   Game.CornerTowers.update(dt)
//   Game.CornerTowers.draw(ctx, options)            // опции: translateToCenter (bool)
//   Game.CornerTowers.notifyZombieKill(worldX, worldY)
//   Game.CornerTowers.reset()                       // partial-reset hook
//   Game.CornerTowers.isEnabled()
//
(function (global) {
  'use strict';

  var CORNER_KEYS = ['tl', 'tr', 'bl', 'br'];
  var ANCHOR_DEFAULTS = {
    tl: 'cornerTL',
    tr: 'cornerTR',
    bl: 'cornerBL',
    br: 'cornerBR'
  };

  // Preallocated tower runtime state (no per-frame alloc).
  // animState: 'idle' | 'work'. While 'work' is playing, notifyZombieKill
  // does NOT restart the animation — current cycle plays to completion.
  // pendingKill: when fence.json cornerTowers.queueRetrigger === true, a kill
  // arriving mid-play sets this flag so the tower retriggers exactly once
  // after the current cycle ends. Default (queueRetrigger=false) ignores
  // mid-play kills entirely.
  var _towers = [
    { key: 'tl', x: 0, y: 0, ready: false, animState: 'idle', frameIndex: 0, animTime: 0, killCooldown: 0, pendingKill: false },
    { key: 'tr', x: 0, y: 0, ready: false, animState: 'idle', frameIndex: 0, animTime: 0, killCooldown: 0, pendingKill: false },
    { key: 'bl', x: 0, y: 0, ready: false, animState: 'idle', frameIndex: 0, animTime: 0, killCooldown: 0, pendingKill: false },
    { key: 'br', x: 0, y: 0, ready: false, animState: 'idle', frameIndex: 0, animTime: 0, killCooldown: 0, pendingKill: false }
  ];

  var _deps = null;
  var _atlasImg = null;
  var _atlasUrl = '';
  var _config = null;

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  function loadAtlasIfNeeded(url) {
    if (_atlasUrl === url) return;
    _atlasUrl = url;
    _atlasImg = null;
    if (!url || typeof Image === 'undefined') return;
    var img = new Image();
    img.onload = function () { _atlasImg = img; };
    img.onerror = function () { _atlasImg = null; };
    // Path is relative to the index.html document. fence.json convention уже
    // относительная — атласы лежат в assets/ либо assets/sprites/.
    img.src = 'assets/' + url;
  }

  function readConfig() {
    if (!_deps || typeof _deps.getFenceConfig !== 'function') return null;
    var fenceCfg = _deps.getFenceConfig();
    if (!fenceCfg || typeof fenceCfg !== 'object') return null;
    return fenceCfg.cornerTowers || null;
  }

  function refreshConfig() {
    var cfg = readConfig();
    _config = cfg;
    if (!cfg || cfg.enabled === false) return;
    if (typeof cfg.atlas === 'string' && cfg.atlas) {
      loadAtlasIfNeeded(cfg.atlas);
    }
  }

  function getAnimSpec(animName) {
    if (!_config || !_config.animations) return null;
    var spec = _config.animations[animName];
    if (!spec) return null;
    var frames = Array.isArray(spec.frames) && spec.frames.length ? spec.frames : null;
    var grid = spec.grid && typeof spec.grid === 'object' ? spec.grid : null;
    var fps = Number.isFinite(spec.frameRate) ? Math.max(0, spec.frameRate) : 0;
    var count;
    if (frames) {
      count = frames.length;
    } else if (grid) {
      count = Number.isFinite(grid.count) ? Math.max(1, Math.floor(grid.count)) : Math.max(1, (grid.cols || 1) * (grid.rows || 1));
    } else {
      count = 1;
    }
    return {
      name: animName,
      frames: frames,
      grid: grid,
      fps: fps,
      loop: spec.loop !== false,
      count: count,
      returnTo: typeof spec.returnTo === 'string' ? spec.returnTo : null
    };
  }

  function pickFrameRect(spec, frameIndex, outRect) {
    // outRect = { x, y, w, h } — preallocated, заполняется in-place.
    if (!spec) return false;
    if (spec.frames) {
      var f = spec.frames[clamp(frameIndex, 0, spec.frames.length - 1)] || spec.frames[0];
      if (!f) return false;
      outRect.x = f.x | 0; outRect.y = f.y | 0;
      outRect.w = (f.w | 0) || 128; outRect.h = (f.h | 0) || 128;
      return true;
    }
    if (spec.grid) {
      var g = spec.grid;
      var fw = Number.isFinite(g.frameWidth) ? g.frameWidth : (_config && _config.frame && _config.frame.w) || 128;
      var fh = Number.isFinite(g.frameHeight) ? g.frameHeight : (_config && _config.frame && _config.frame.h) || 128;
      var cols = Math.max(1, g.cols | 0);
      var startIndex = Math.max(0, g.startIndex | 0);
      var globalIdx = startIndex + clamp(frameIndex, 0, spec.count - 1);
      var col = globalIdx % cols;
      var row = (globalIdx / cols) | 0;
      outRect.x = col * fw;
      outRect.y = row * fh;
      outRect.w = fw;
      outRect.h = fh;
      return true;
    }
    return false;
  }

  // Reusable scratch rect — никаких allocations в draw().
  var _scratchRect = { x: 0, y: 0, w: 0, h: 0 };

  function findCornerSegmentXY(fenceSegments, anchorId) {
    if (!Array.isArray(fenceSegments)) return null;
    for (var i = 0; i < fenceSegments.length; i++) {
      var s = fenceSegments[i];
      if (!s) continue;
      if (s.id === anchorId || s.spriteIdIntact === anchorId) {
        if (Number.isFinite(s.x) && Number.isFinite(s.y)) {
          return s; // re-used reference, no alloc
        }
      }
    }
    return null;
  }

  function recomputePositions(state) {
    if (!_config || !state) return;
    var anchors = _config.anchors || ANCHOR_DEFAULTS;
    var offsets = _config.offsets || {};
    for (var i = 0; i < _towers.length; i++) {
      var t = _towers[i];
      var anchorId = anchors[t.key] || ANCHOR_DEFAULTS[t.key];
      var seg = findCornerSegmentXY(state.fenceSegments, anchorId);
      if (!seg) { t.ready = false; continue; }
      var off = offsets[t.key] || { x: 0, y: 0 };
      var ox = Number.isFinite(off.x) ? off.x : 0;
      var oy = Number.isFinite(off.y) ? off.y : 0;
      // seg.x/y это координаты относительно center (см. game.js drawing translates to center).
      t.x = seg.x + ox;
      t.y = seg.y + oy;
      t.ready = true;
    }
  }

  function init(deps) {
    _deps = deps || null;
    refreshConfig();
  }

  function isEnabled() {
    return !!(_config && _config.enabled !== false);
  }

  function update(dt) {
    if (!_deps || typeof _deps.getState !== 'function') return;
    if (!_config) refreshConfig();
    if (!isEnabled()) return;
    var state = _deps.getState();
    if (!state) return;
    recomputePositions(state);

    var workSpec = getAnimSpec('work');
    var idleSpec = getAnimSpec('idle');

    for (var i = 0; i < _towers.length; i++) {
      var t = _towers[i];
      if (t.killCooldown > 0) t.killCooldown -= dt;
      var spec = t.animState === 'work' ? workSpec : idleSpec;
      if (!spec || spec.count <= 1 || spec.fps <= 0) {
        t.frameIndex = 0;
        t.animTime = 0;
        continue;
      }
      t.animTime += dt;
      var advanceFrames = Math.floor(t.animTime * spec.fps);
      if (advanceFrames > 0) {
        t.animTime -= advanceFrames / spec.fps;
        t.frameIndex += advanceFrames;
        if (t.frameIndex >= spec.count) {
          if (spec.loop) {
            t.frameIndex = t.frameIndex % spec.count;
          } else {
            // Non-loop animation (typically 'work') finished its full cycle.
            // If queueRetrigger flag enabled and a kill landed during play,
            // restart 'work' once; otherwise return to idle (or returnTo).
            var queueRetrigger = !!(_config && _config.queueRetrigger);
            if (queueRetrigger && t.pendingKill && t.animState === 'work') {
              t.pendingKill = false;
              t.frameIndex = 0;
              t.animTime = 0;
              // animState stays 'work' — full cycle replays
            } else {
              t.pendingKill = false;
              var nextName = spec.returnTo || 'idle';
              t.animState = nextName;
              t.frameIndex = 0;
              t.animTime = 0;
            }
          }
        }
      }
    }
  }

  function draw(ctx, options) {
    if (!ctx || !isEnabled() || !_config) return;
    if (!_atlasImg) return; // graceful no-render until atlas loads
    var translate = !!(options && options.translateToCenter);
    var center = (_deps && typeof _deps.getCenter === 'function') ? _deps.getCenter() : null;
    var scaleMul = Number.isFinite(_config.scale) && _config.scale > 0 ? _config.scale : 1;
    var anchorX = (_config.anchor && Number.isFinite(_config.anchor.x)) ? _config.anchor.x : 0.5;
    var anchorY = (_config.anchor && Number.isFinite(_config.anchor.y)) ? _config.anchor.y : 0.85;
    var workSpec = getAnimSpec('work');
    var idleSpec = getAnimSpec('idle');
    ctx.save();
    if (translate && center && Number.isFinite(center.x) && Number.isFinite(center.y)) {
      ctx.translate(center.x, center.y);
    }
    for (var i = 0; i < _towers.length; i++) {
      var t = _towers[i];
      if (!t.ready) continue;
      var spec = t.animState === 'work' ? workSpec : idleSpec;
      if (!spec) continue;
      if (!pickFrameRect(spec, t.frameIndex, _scratchRect)) continue;
      var dw = _scratchRect.w * scaleMul;
      var dh = _scratchRect.h * scaleMul;
      var dx = t.x - dw * anchorX;
      var dy = t.y - dh * anchorY;
      try {
        ctx.drawImage(
          _atlasImg,
          _scratchRect.x, _scratchRect.y, _scratchRect.w, _scratchRect.h,
          dx, dy, dw, dh
        );
      } catch (e) { /* ignore single-frame draw errors */ }
    }
    ctx.restore();
  }

  function notifyZombieKill(worldX, worldY) {
    if (!isEnabled() || !_config) return;
    if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) return;
    // Solo-pipeline-yandex-vk batch 1 / item A2: stochastic FxDensity gate on
    // kill-trigger rate. Gameplay damage already happened in game.js; this is
    // a pure cosmetic kill-anim trigger.
    var FX = (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : null));
    var fxd = FX && FX.Game && FX.Game.FxDensity;
    if (fxd && typeof fxd.shouldSpawn === 'function' && !fxd.shouldSpawn(1)) return;
    var radius = Number.isFinite(_config.killRadiusPx) ? _config.killRadiusPx : 0;
    if (radius <= 0) return;
    var radiusSq = radius * radius;
    var cooldown = Number.isFinite(_config.killTriggerCooldownSec) ? Math.max(0, _config.killTriggerCooldownSec) : 0;
    var queueRetrigger = !!_config.queueRetrigger;
    // worldX/worldY должны быть в той же системе, что и t.x/t.y — относительно
    // center. На вызывающей стороне (game.js) делаем перевод заранее.
    for (var i = 0; i < _towers.length; i++) {
      var t = _towers[i];
      if (!t.ready) continue;
      var dx = worldX - t.x;
      var dy = worldY - t.y;
      if (dx * dx + dy * dy > radiusSq) continue;
      // Tower is currently playing 'work' — do NOT interrupt the running cycle.
      // Either ignore the kill (default) or remember a single retrigger when
      // queueRetrigger flag is enabled. No heap allocation either way.
      if (t.animState === 'work') {
        if (queueRetrigger) t.pendingKill = true;
        continue;
      }
      if (t.killCooldown > 0) continue;
      t.animState = 'work';
      t.frameIndex = 0;
      t.animTime = 0;
      t.killCooldown = cooldown;
      t.pendingKill = false;
    }
  }

  function reset() {
    for (var i = 0; i < _towers.length; i++) {
      var t = _towers[i];
      t.animState = 'idle';
      t.frameIndex = 0;
      t.animTime = 0;
      t.killCooldown = 0;
      t.pendingKill = false;
    }
  }

  global.Game = global.Game || {};
  global.Game.CornerTowers = {
    init: init,
    update: update,
    draw: draw,
    notifyZombieKill: notifyZombieKill,
    reset: reset,
    isEnabled: isEnabled,
    refreshConfig: refreshConfig
  };
})(typeof window !== 'undefined' ? window : this);
