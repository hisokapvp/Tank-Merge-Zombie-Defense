(function (global) {
  'use strict';

  // ─── Underground Hangar Cell (canvas button on cell index 15) ───

  const CELL_INDEX = 15; // bottom-right cell in 4x4 grid

  let _config = null;   // parsed JSON config
  let _atlasImg = null;  // loaded atlas Image
  let _ready = false;

  // Animation state
  let _animState = 'idle'; // idle | hover_start | hover_idle | hover_end | click | close
  let _animFrame = 0;
  let _animTimer = 0;
  let _isHovered = false;
  let _isClosing = false;  // true while close anim plays after modal dismiss
  let _onAnimDone = null;  // callback when one-shot anim finishes
  let _landingActive = false; // true while the crate landing choreography owns the FSM
  let _crateLanding = { openHoldSec: 0.35, closeHoldSec: 0, timeoutSec: 3 };

  // Cached anim defs after config load
  let _anims = {
    idle: null,
    hover_start: null,
    hover_idle: null,
    hover_end: null,
    click: null,
    close: null,
  };

  function t(key, fallback) {
    if (global.Game && global.Game.I18n && typeof global.Game.I18n.t === 'function') {
      return global.Game.I18n.t(key) || fallback;
    }
    return fallback;
  }

  // ─── Config loading ───

  async function load() {
    try {
      const res = await fetch('assets/underground_hangar.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();

      const atlasPath = 'assets/' + (data.atlas || 'slot_warehouse_atlas.png');
      const SL = global.Game && global.Game.SpriteLoaders;
      const loadImage = SL && typeof SL.loadImage === 'function'
        ? SL.loadImage
        : function (url) {
            return new Promise(function (resolve, reject) {
              const img = new Image();
              img.onload = function () { resolve(img); };
              img.onerror = reject;
              img.src = url;
            });
          };

      const img = await loadImage(atlasPath);
      _atlasImg = img;

      const rawAnims = data.animations && typeof data.animations === 'object' ? data.animations : {};
      const scale = Number.isFinite(data.scale) && data.scale > 0 ? data.scale : 1;
      const anchor = data.anchor && typeof data.anchor === 'object'
        ? { x: Number.isFinite(data.anchor.x) ? data.anchor.x : 0.5,
            y: Number.isFinite(data.anchor.y) ? data.anchor.y : 0.5 }
        : { x: 0.5, y: 0.5 };

      function parseAnim(raw) {
        if (!raw || typeof raw !== 'object') return null;
        return {
          x: Number.isFinite(raw.x) ? raw.x : 0,
          y: Number.isFinite(raw.y) ? raw.y : 0,
          w: Number.isFinite(raw.w) && raw.w > 0 ? raw.w : 64,
          h: Number.isFinite(raw.h) && raw.h > 0 ? raw.h : 64,
          frames: Number.isFinite(raw.frames) && raw.frames > 0 ? Math.floor(raw.frames) : 1,
          frameRateFps: Number.isFinite(raw.frameRateFps) && raw.frameRateFps > 0 ? raw.frameRateFps : 8,
          loop: raw.loop !== false,
        };
      }

      _anims.idle = parseAnim(rawAnims.idle);
      _anims.hover_start = parseAnim(rawAnims.hover_start);
      _anims.hover_idle = parseAnim(rawAnims.hover_idle);
      _anims.hover_end = parseAnim(rawAnims.hover_end);
      _anims.click = parseAnim(rawAnims.click);
      _anims.close = parseAnim(rawAnims.close);

      _config = { scale: scale, anchor: anchor };

      const rawLanding = data.crateLanding && typeof data.crateLanding === 'object' ? data.crateLanding : null;
      if (rawLanding) {
        if (Number.isFinite(rawLanding.openHoldSec) && rawLanding.openHoldSec >= 0) {
          _crateLanding.openHoldSec = rawLanding.openHoldSec;
        }
        if (Number.isFinite(rawLanding.closeHoldSec) && rawLanding.closeHoldSec >= 0) {
          _crateLanding.closeHoldSec = rawLanding.closeHoldSec;
        }
        if (Number.isFinite(rawLanding.timeoutSec) && rawLanding.timeoutSec > 0) {
          _crateLanding.timeoutSec = rawLanding.timeoutSec;
        }
      }

      _ready = true;
    } catch (e) {
      _ready = false;
      _config = null;
      _atlasImg = null;
      _landingActive = false;
    }
  }

  // ─── Animation control ───

  function setAnim(name, onDone) {
    if (_animState === name) return;
    _animState = name;
    _animFrame = 0;
    _animTimer = 0;
    _onAnimDone = typeof onDone === 'function' ? onDone : null;
  }

  // Landing choreography needs to re-trigger the same anim name (e.g. two
  // consecutive 'close' passes) and must never be short-circuited by the
  // dedupe guard above.
  function _forceSetAnim(name, onDone) {
    _animState = name;
    _animFrame = 0;
    _animTimer = 0;
    _onAnimDone = typeof onDone === 'function' ? onDone : null;
  }

  function getAnimFrameDurationSec(name) {
    const anim = _anims[name];
    if (!anim) return 0;
    const fps = Math.max(0.01, Number(anim.frameRateFps) || 1);
    const frames = Math.max(1, Number(anim.frames) || 1);
    return frames / fps;
  }

  function getCrateLandingConfig() { return _crateLanding; }

  // How long before touchdown the gates start opening. Only the 'click' clip is
  // consumed as lead time, so the gates finish opening right as the box arrives —
  // the crate still visibly falls, but into an already open hangar. The configured
  // hold then covers the moment the box goes inside, before the 'close' pass.
  function getLandingLeadSec() {
    return getAnimFrameDurationSec('click');
  }

  function stepAnimation(dt) {
    const anim = _anims[_animState];
    if (!anim) return;

    _animTimer += dt;
    const frameDur = 1 / anim.frameRateFps;
    while (_animTimer >= frameDur) {
      _animTimer -= frameDur;
      _animFrame += 1;
      if (_animFrame >= anim.frames) {
        if (anim.loop) {
          _animFrame = 0;
        } else {
          _animFrame = anim.frames - 1;
          if (_onAnimDone) {
            const cb = _onAnimDone;
            _onAnimDone = null;
            cb();
          }
          break;
        }
      }
    }
  }

  // ─── Drawing on canvas ───

  function draw(ctx, cell) {
    if (!cell) return;

    // Fallback drawing when atlas is not loaded
    if (!_ready || !_atlasImg || !_config) {
      drawFallback(ctx, cell);
      drawTankCountBadge(ctx, cell, arguments[2]);
      return;
    }

    const anim = _anims[_animState] || _anims.idle;
    if (!anim) {
      drawFallback(ctx, cell);
      drawTankCountBadge(ctx, cell, arguments[2]);
      return;
    }

    const frame = Math.min(_animFrame, anim.frames - 1);
    const sx = anim.x + frame * anim.w;
    const sy = anim.y;

    const scale = _config.scale;
    const dw = cell.w * scale;
    const dh = cell.h * scale;
    const dx = cell.x + cell.w * _config.anchor.x - dw * _config.anchor.x;
    const dy = cell.y + cell.h * _config.anchor.y - dh * _config.anchor.y;

    // Rounded clip so sprite corners don't poke out of the cell
    const clipR = Math.min(10, cell.w / 2, cell.h / 2);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cell.x + clipR, cell.y);
    ctx.arcTo(cell.x + cell.w, cell.y, cell.x + cell.w, cell.y + cell.h, clipR);
    ctx.arcTo(cell.x + cell.w, cell.y + cell.h, cell.x, cell.y + cell.h, clipR);
    ctx.arcTo(cell.x, cell.y + cell.h, cell.x, cell.y, clipR);
    ctx.arcTo(cell.x, cell.y, cell.x + cell.w, cell.y, clipR);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(_atlasImg, sx, sy, anim.w, anim.h, dx, dy, dw, dh);
    ctx.restore();

    // Black border around the cell (same rounded corners as clip)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cell.x + clipR, cell.y);
    ctx.arcTo(cell.x + cell.w, cell.y, cell.x + cell.w, cell.y + cell.h, clipR);
    ctx.arcTo(cell.x + cell.w, cell.y + cell.h, cell.x, cell.y + cell.h, clipR);
    ctx.arcTo(cell.x, cell.y + cell.h, cell.x, cell.y, clipR);
    ctx.arcTo(cell.x, cell.y, cell.x + cell.w, cell.y, clipR);
    ctx.closePath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#000';
    ctx.stroke();
    ctx.restore();

    // Badge drawn AFTER restore so it is not clipped
    drawTankCountBadge(ctx, cell, arguments[2]);
  }

  function drawTankCountBadge(ctx, cell, tankCount) {
    const count = Math.max(0, Math.floor(Number(tankCount) || 0));
    if (!cell || count <= 0) return;

    const radius = Math.max(10, Math.floor(Math.min(cell.w, cell.h) * 0.18));
    const cx = cell.x + cell.w - radius - 6;
    const cy = cell.y + cell.h - radius - 6;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 140, 90, 0.96)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(41, 18, 8, 0.9)';
    ctx.stroke();

    ctx.fillStyle = '#fdf8ef';
    ctx.font = 'bold ' + Math.max(12, Math.floor(radius * 1.2)) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(count), cx, cy + 1);
    ctx.restore();
  }

  function drawFallback(ctx, cell) {
    ctx.save();
    // Dark cell background
    ctx.fillStyle = 'rgba(20, 30, 50, 0.85)';
    ctx.strokeStyle = 'rgba(74, 180, 246, 0.5)';
    ctx.lineWidth = 2;

    const r = 10;
    const x = cell.x;
    const y = cell.y;
    const w = cell.w;
    const h = cell.h;
    ctx.beginPath();
    const rr = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Down arrow icon (suggesting underground)
    ctx.fillStyle = 'rgba(74, 180, 246, 0.9)';
    ctx.font = 'bold ' + Math.max(12, Math.floor(w * 0.35)) + 'px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⬇', x + w / 2, y + h / 2);

    ctx.restore();
  }

  // ─── Hit testing ───

  function hitTest(px, py, cell) {
    if (!cell) return false;
    return px >= cell.x && px <= cell.x + cell.w && py >= cell.y && py <= cell.y + cell.h;
  }

  // ─── Pointer interaction ───

  function handlePointerEnter() {
    if (_landingActive) return;
    if (_isHovered) return;
    _isHovered = true;
    _isClosing = false;
    setAnim('hover_start', function () {
      // After hover_start finishes, loop hover_idle while cursor stays
      if (_isHovered) setAnim('hover_idle');
    });
  }

  function handlePointerLeave() {
    if (_landingActive) return;
    if (!_isHovered) return;
    _isHovered = false;
    // Skip hover_end when close animation is already playing (modal dismiss)
    if (_isClosing || _animState === 'close') return;
    setAnim('hover_end', function () {
      setAnim('idle');
    });
  }

  function handleClick(openModalFn) {
    setAnim('click', function () {
      setAnim('idle');
    });
    if (typeof openModalFn === 'function') openModalFn();
  }

  function handleModalClose() {
    // The landing choreography owns the close pass; the UI close callback must
    // not restart it.
    if (_landingActive) return;
    _isHovered = false;
    _isClosing = true;
    setAnim('close', function () {
      _isClosing = false;
      setAnim('idle');
    });
  }

  // ─── Crate landing choreography (crate fell into cell 15) ───
  // strictly ordered: open -> (crate disappears) -> close -> idle.
  // While it runs, hover enter/leave are suppressed so the sequence cannot be
  // interrupted by pointer movement across the cell.

  function isLandingActive() {
    return _landingActive;
  }

  function playLandingOpen(onDone) {
    _landingActive = true;
    _isHovered = false;
    _isClosing = false;
    _forceSetAnim('click', function () {
      var holdSec = Number.isFinite(_crateLanding.openHoldSec) ? _crateLanding.openHoldSec : 0;
      if (holdSec > 0 && typeof global.setTimeout === 'function') {
        global.setTimeout(function () {
          if (!_landingActive) return;
          if (typeof onDone === 'function') onDone();
        }, holdSec * 1000);
        return;
      }
      if (typeof onDone === 'function') onDone();
    });
  }

  function playLandingClose(onDone) {
    if (!_landingActive) return;
    var holdSec = Number.isFinite(_crateLanding.closeHoldSec) ? _crateLanding.closeHoldSec : 0;
    var runClose = function () {
      _forceSetAnim('close', function () {
        _landingActive = false;
        _isClosing = false;
        _forceSetAnim('idle');
        if (typeof onDone === 'function') onDone();
      });
    };
    if (holdSec > 0 && typeof global.setTimeout === 'function') {
      global.setTimeout(runClose, holdSec * 1000);
      return;
    }
    runClose();
  }

  function cancelLanding() {
    if (!_landingActive) return;
    _landingActive = false;
    _isClosing = false;
    _isHovered = false;
    _forceSetAnim('idle');
  }

  // ─── State for underground hangar slots ───

  function ensureStateShape(stateRef) {
    if (!stateRef) return;
    if (!stateRef.undergroundHangar || typeof stateRef.undergroundHangar !== 'object') {
      stateRef.undergroundHangar = { cells: [] };
    }
    const ugh = stateRef.undergroundHangar;
    if (!Array.isArray(ugh.cells)) ugh.cells = [];
    const DronesApi = global.Game && global.Game.Drones;
    for (let index = 0; index < 16; index++) {
      const existing = ugh.cells[index];
      if (!existing || typeof existing !== 'object') {
        ugh.cells[index] = { i: index, tank: null, drone: null };
        continue;
      }
      existing.i = index;
      if (!Object.prototype.hasOwnProperty.call(existing, 'tank')) existing.tank = null;
      if (!Object.prototype.hasOwnProperty.call(existing, 'drone')) existing.drone = null;
      if (existing.drone && DronesApi && typeof DronesApi.sanitizeDrone === 'function') {
        existing.drone = DronesApi.sanitizeDrone(stateRef, existing.drone, existing.drone.level || 1);
        existing.drone.mode = DronesApi.MODE_STANDBY || 'standby';
        existing.drone.substate = DronesApi.SUBSTATE_RETURN_TO_BASE || 'repair_patrol';
        existing.drone.targetSegmentId = null;
        existing.drone.reservedSegmentId = null;
        existing.drone.repair = null;
        existing.drone.slotIndex = null;
      }
      if (existing.tank && existing.drone) existing.drone = null;
    }
    while (ugh.cells.length < 16) {
      ugh.cells.push({ i: ugh.cells.length, tank: null, drone: null });
    }
  }

  // ─── Drone storage (overflow target for full main drone slots) ───

  // Returns the index of the first underground cell that holds neither a tank
  // nor a drone, or -1 when the underground hangar is full.
  function findFreeDroneCellIndex(stateRef) {
    ensureStateShape(stateRef);
    const ugh = stateRef && stateRef.undergroundHangar;
    const cells = ugh && Array.isArray(ugh.cells) ? ugh.cells : null;
    if (!cells) return -1;
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      if (cell && !cell.tank && !cell.drone) return i;
    }
    return -1;
  }

  // Park an incoming drone in the underground hangar. Used when every main
  // drone slot is occupied, so the drone is stored instead of being dropped.
  // Returns the stored drone, or null when the underground hangar is full.
  function storeDrone(stateRef, drone) {
    if (!stateRef || !drone || typeof drone !== 'object') return null;
    const index = findFreeDroneCellIndex(stateRef);
    if (index < 0) return null;
    const DronesApi = global.Game && global.Game.Drones;
    const stored = DronesApi && typeof DronesApi.sanitizeDrone === 'function'
      ? DronesApi.sanitizeDrone(stateRef, drone, drone.level || 1)
      : drone;
    stored.mode = DronesApi && DronesApi.MODE_STANDBY ? DronesApi.MODE_STANDBY : 'standby';
    stored.substate = DronesApi && DronesApi.SUBSTATE_RETURN_TO_BASE ? DronesApi.SUBSTATE_RETURN_TO_BASE : 'repair_patrol';
    stored.targetSegmentId = null;
    stored.reservedSegmentId = null;
    stored.repair = null;
    stored.slotIndex = null;
    stateRef.undergroundHangar.cells[index].drone = stored;
    return stored;
  }

  // ─── Public API ───

  global.Game = global.Game || {};
  global.Game.UndergroundHangar = {
    CELL_INDEX: CELL_INDEX,
    findFreeDroneCellIndex: findFreeDroneCellIndex,
    storeDrone: storeDrone,
    load: load,
    draw: draw,
    hitTest: hitTest,
    stepAnimation: stepAnimation,
    handlePointerEnter: handlePointerEnter,
    handlePointerLeave: handlePointerLeave,
    handleClick: handleClick,
    handleModalClose: handleModalClose,
    ensureStateShape: ensureStateShape,
    isReady: function () { return _ready; },
    getAnimState: function () { return _animState; },
    setAnim: setAnim,
    isLandingActive: isLandingActive,
    playLandingOpen: playLandingOpen,
    playLandingClose: playLandingClose,
    cancelLanding: cancelLanding,
    getLandingConfig: getCrateLandingConfig,
    getLandingLeadSec: getLandingLeadSec,
  };

}(window));
