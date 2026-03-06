(function (global) {
  'use strict';

  let _spriteSource = null;
  let _conveyorAtlas = null;
  let _boxAtlas = null;
  let _storageAtlas = null;
  let _worldScale = 1;

  // ─── Fallback colours ──────────────────────────────────────
  const CLR_CONVEYOR      = '#555';
  const CLR_CONVEYOR_LINE = '#777';
  const CLR_BOX           = '#c47e29';
  const CLR_BOX_BORDER    = '#8b5a1b';
  const CLR_STORAGE       = '#3a6e3a';
  const CLR_STORAGE_FRAME = '#2a4e2a';
  const CLR_STORAGE_GLOW  = 'rgba(120, 255, 120, 0.35)';

  // ─── Layout constants ─────────────────────────────────────
  const CONVEYOR_W = 80;
  const CONVEYOR_H = 22;
  const BOX_SIZE   = 18;
  const STORAGE_SIZE = 28;
  const GAP        = 4;  // between conveyor and supercomputer

  // Conveyor belt line animation speed (pixels per second)
  const BELT_LINE_SPEED = 30;
  const BELT_LINE_GAP   = 12;

  // ─── Computed positions (depend on supercomputer) ──────────
  let _cx = 0;  // conveyor center x
  let _cy = 0;  // conveyor center y
  let _sx = 0;  // storage center x
  let _sy = 0;  // storage center y
  let _layoutReady = false;
  let _conveyorState = 'idle';
  let _conveyorElapsedSec = 0;
  let _conveyorWorkTimerSec = 0;
  let _storageHovered = false;
  let _storageElapsedSec = 0;
  let _lastDisplaySignature = '';
  const _conveyorBounds = { x: 0, y: 0, w: CONVEYOR_W, h: CONVEYOR_H };
  const _storageBounds = { x: 0, y: 0, w: STORAGE_SIZE, h: STORAGE_SIZE };

  function clamp01(value) {
    if (!Number.isFinite(value)) return 0;
    if (value <= 0) return 0;
    if (value >= 1) return 1;
    return value;
  }

  function getSpriteSource() {
    return _spriteSource && typeof _spriteSource.getAnimation === 'function' ? _spriteSource : null;
  }

  function getPartConfig(partName) {
    const source = getSpriteSource();
    if (!source || typeof source.getPartConfig !== 'function') return null;
    return source.getPartConfig(partName);
  }

  function getPartAnimation(partName, stateName) {
    const source = getSpriteSource();
    if (!source) return null;
    return source.getAnimation(stateName, partName);
  }

  function getPartImage(partName) {
    if (partName === 'conveyor' && _conveyorAtlas && _conveyorAtlas.ready && _conveyorAtlas.image) {
      return _conveyorAtlas.image;
    }
    if ((partName === 'storageCell' || partName === 'storage') && _storageAtlas && _storageAtlas.ready && _storageAtlas.image) {
      return _storageAtlas.image;
    }
    const source = getSpriteSource();
    if (!source || typeof source.getAtlasImage !== 'function') return null;
    return source.getAtlasImage(partName);
  }

  function getClipScale(anim) {
    const clipScale = Number.isFinite(anim && anim.scale) ? Math.max(0.05, anim.scale) : 1;
    return clipScale * _worldScale;
  }

  function getClipDuration(anim) {
    if (!anim) return 0;
    const frames = Math.max(1, Number(anim.frames) || 1);
    const fps = Math.max(0.01, Number(anim.frameRateFps) || 1);
    return frames / fps;
  }

  function getFrameIndex(anim, elapsedSec) {
    const frames = Math.max(1, Number(anim && anim.frames) || 1);
    const fps = Math.max(0.01, Number(anim && anim.frameRateFps) || 1);
    const duration = frames / fps;
    if (duration <= 0) return 0;
    if (anim && anim.loop === false) {
      return Math.min(frames - 1, Math.floor(Math.max(0, elapsedSec) * fps));
    }
    return Math.floor((Math.max(0, elapsedSec) % duration) * fps) % frames;
  }

  function fillPartBounds(partName, stateName, centerX, centerY, fallbackW, fallbackH, out) {
    const config = getPartConfig(partName);
    const anim = config && config.defined ? getPartAnimation(partName, stateName) : null;
    const anchor = config && config.anchor ? config.anchor : { x: 0.5, y: 0.5 };
    const scale = getClipScale(anim);
    const width = anim ? anim.w * scale : fallbackW * _worldScale;
    const height = anim ? anim.h * scale : fallbackH * _worldScale;
    out.x = centerX - width * (Number.isFinite(anchor.x) ? anchor.x : 0.5);
    out.y = centerY - height * (Number.isFinite(anchor.y) ? anchor.y : 0.5);
    out.w = width;
    out.h = height;
    return anim;
  }

  function refreshBounds() {
    fillPartBounds('conveyor', _conveyorState, _cx, _cy, CONVEYOR_W, CONVEYOR_H, _conveyorBounds);
    fillPartBounds('storageCell', _storageHovered ? 'hover' : 'idle', _sx, _sy, STORAGE_SIZE, STORAGE_SIZE, _storageBounds);
  }

  function computeDisplaySignature(pl) {
    const progress = clamp01(pl && pl.progress);
    return String(progress > 0 ? 1 : 0) + ':' + String(Math.round(progress * 1000));
  }

  function triggerConveyorWork() {
    const workAnim = getPartAnimation('conveyor', 'work');
    const duration = getClipDuration(workAnim);
    const fps = Math.max(0.01, Number(workAnim && workAnim.frameRateFps) || 1);
    _conveyorState = 'work';
    _conveyorElapsedSec = 0;
    _conveyorWorkTimerSec = Math.max(0.2, duration > 0 && workAnim && workAnim.loop === false ? duration : (2 / fps));
  }

  function updateLayout(scX, scY, scW, scH, worldScale) {
    _worldScale = Number.isFinite(worldScale) && worldScale > 0 ? worldScale : 1;

    const conveyorCfg = getPartConfig('conveyor');
    const storageCfg = getPartConfig('storageCell');
    const useConfiguredConveyor = !!(conveyorCfg && conveyorCfg.defined && conveyorCfg.offset);
    const useConfiguredStorage = !!(storageCfg && storageCfg.defined && storageCfg.offset);

    if (useConfiguredConveyor) {
      _cx = scX + conveyorCfg.offset.x * _worldScale;
      _cy = scY + conveyorCfg.offset.y * _worldScale;
    } else {
      const convRight = scX - scW * 0.5 - GAP * _worldScale;
      _cx = convRight - CONVEYOR_W * _worldScale * 0.5;
      _cy = scY;
    }

    if (useConfiguredStorage) {
      _sx = scX + storageCfg.offset.x * _worldScale;
      _sy = scY + storageCfg.offset.y * _worldScale;
    } else {
      const convRight = scX - scW * 0.5 - GAP * _worldScale;
      _sx = convRight + STORAGE_SIZE * _worldScale * 0.5 + 2 * _worldScale;
      _sy = Number.isFinite(scH) ? scY + Math.max(0, (scH - CONVEYOR_H * _worldScale) * 0.02) : scY;
    }

    _layoutReady = true;
    refreshBounds();
  }

  function setSpriteSource(spriteSource) { _spriteSource = spriteSource || null; }
  function setConveyorAtlas(atlas) { _conveyorAtlas = atlas || null; }
  function setBoxAtlas(atlas) { _boxAtlas = atlas; }
  function setStorageAtlas(atlas) { _storageAtlas = atlas || null; }

  function syncState(state, dt) {
    const dtSafe = Number.isFinite(dt) ? Math.max(0, dt) : 0;
    const pl = state && state.productionLine ? state.productionLine : null;

    _conveyorElapsedSec += dtSafe;
    _storageElapsedSec += dtSafe;

    if (!pl) {
      _conveyorState = 'idle';
      _conveyorElapsedSec = 0;
      _conveyorWorkTimerSec = 0;
      _lastDisplaySignature = '';
      refreshBounds();
      return;
    }

    const displaySignature = computeDisplaySignature(pl);
    if (_lastDisplaySignature) {
      if (displaySignature !== _lastDisplaySignature) triggerConveyorWork();
    }
    _lastDisplaySignature = displaySignature;

    if (_conveyorState === 'work') {
      _conveyorWorkTimerSec = Math.max(0, _conveyorWorkTimerSec - dtSafe);
      if (_conveyorWorkTimerSec <= 0) {
        _conveyorState = 'idle';
        _conveyorElapsedSec = 0;
      }
    }

    refreshBounds();
  }

  function syncHoverAt(px, py) {
    const hovered = hitTestStorage(px, py);
    if (hovered === _storageHovered) return hovered;
    _storageHovered = hovered;
    _storageElapsedSec = 0;
    refreshBounds();
    return hovered;
  }

  function clearHover() {
    if (!_storageHovered) return;
    _storageHovered = false;
    _storageElapsedSec = 0;
    refreshBounds();
  }

  function drawSpriteClip(ctx, partName, stateName, centerX, centerY, elapsedSec) {
    const config = getPartConfig(partName);
    if (!(config && config.defined)) return false;
    const img = getPartImage(partName);
    const anim = getPartAnimation(partName, stateName);
    if (!(img && anim)) return false;

    const anchor = config.anchor ? config.anchor : { x: 0.5, y: 0.5 };
    const scale = getClipScale(anim);
    const frameIndex = getFrameIndex(anim, elapsedSec);
    const width = anim.w * scale;
    const height = anim.h * scale;

    ctx.drawImage(
      img,
      anim.x + frameIndex * anim.w,
      anim.y,
      anim.w,
      anim.h,
      centerX - width * (Number.isFinite(anchor.x) ? anchor.x : 0.5),
      centerY - height * (Number.isFinite(anchor.y) ? anchor.y : 0.5),
      width,
      height
    );
    return true;
  }

  // ─── Draw: conveyor belt ───────────────────────────────────
  function drawConveyor(ctx, animTime) {
    if (!_layoutReady) return;

    const centerX = _conveyorBounds.x + _conveyorBounds.w * 0.5;
    const centerY = _conveyorBounds.y + _conveyorBounds.h * 0.5;
    if (!drawSpriteClip(ctx, 'conveyor', _conveyorState, centerX, centerY, _conveyorElapsedSec)) {
      _drawConveyorFallback(ctx, _conveyorBounds.x, _conveyorBounds.y, _conveyorBounds.w, _conveyorBounds.h, animTime);
    }
  }

  function _drawConveyorFallback(ctx, x, y, width, height, animTime) {
    // Belt body
    ctx.fillStyle = CLR_CONVEYOR;
    ctx.fillRect(x, y, width, height);

    // Animated belt lines moving left-to-right
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();

    ctx.strokeStyle = CLR_CONVEYOR_LINE;
    ctx.lineWidth = 1;
    const beltGap = BELT_LINE_GAP * _worldScale;
    const offset = (animTime * BELT_LINE_SPEED * _worldScale) % beltGap;
    for (let lx = x - beltGap + offset; lx < x + width + beltGap; lx += beltGap) {
      ctx.beginPath();
      ctx.moveTo(lx, y);
      ctx.lineTo(lx, y + height);
      ctx.stroke();
    }
    ctx.restore();

    // Border
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, width - 1), Math.max(0, height - 1));
  }

  // ─── Draw: box on conveyor ─────────────────────────────────
  function drawBoxOnConveyor(ctx, progress) {
    if (!_layoutReady || progress <= 0) return;

    // Box moves from left edge of conveyor to right edge
    const boxSize = Math.max(10 * _worldScale, Math.min(BOX_SIZE * _worldScale, _conveyorBounds.h - 4 * _worldScale, _conveyorBounds.w * 0.36));
    const startX = _conveyorBounds.x + 2 * _worldScale;
    const endX   = _conveyorBounds.x + _conveyorBounds.w - boxSize - 2 * _worldScale;
    const bx     = startX + (endX - startX) * progress;
    const by     = _conveyorBounds.y + (_conveyorBounds.h - boxSize) * 0.5;

    // "Printing" effect: reveal rows top-to-bottom (like tank stamp)
    const revealH = Math.ceil(boxSize * progress);

    ctx.save();
    ctx.beginPath();
    ctx.rect(bx, by, boxSize, revealH);
    ctx.clip();

    if (_boxAtlas && _boxAtlas.ready && _boxAtlas.image) {
      // TODO: draw from atlas
      _drawBoxFallback(ctx, bx, by, boxSize);
    } else {
      _drawBoxFallback(ctx, bx, by, boxSize);
    }

    ctx.restore();
  }

  function _drawBoxFallback(ctx, x, y, size) {
    ctx.fillStyle = CLR_BOX;
    ctx.fillRect(x, y, size, size);
    ctx.strokeStyle = CLR_BOX_BORDER;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);

    // Small "?" in center
    ctx.fillStyle = '#fff';
    ctx.font = 'bold ' + Math.max(8, Math.round(size * 0.56)) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', x + size * 0.5, y + size * 0.5);
  }

  // ─── Draw: storage cell ────────────────────────────────────
  function drawStorageCell(ctx, boxCount, maxSlots) {
    if (!_layoutReady) return;

    const stateName = _storageHovered ? 'hover' : 'idle';
    const centerX = _storageBounds.x + _storageBounds.w * 0.5;
    const centerY = _storageBounds.y + _storageBounds.h * 0.5;

    if (!drawSpriteClip(ctx, 'storageCell', stateName, centerX, centerY, _storageElapsedSec)) {
      _drawStorageFallback(ctx, _storageBounds.x, _storageBounds.y, _storageBounds.w, _storageBounds.h, boxCount, maxSlots);
      return;
    }

    _drawStorageOverlay(ctx, _storageBounds.x, _storageBounds.y, _storageBounds.w, _storageBounds.h, boxCount, maxSlots);
  }

  function _drawStorageOverlay(ctx, x, y, width, height, boxCount, maxSlots) {
    if (boxCount <= 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = Math.max(10, Math.round(height * 0.35)) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('—', x + width * 0.5, y + height * 0.5);
      return;
    }

    const badgeSize = Math.max(14, Math.round(Math.min(width, height) * 0.55));
    const badgeX = x + width - badgeSize * 0.48;
    const badgeY = y + badgeSize * 0.48;
    ctx.fillStyle = 'rgba(8,16,24,0.88)';
    ctx.beginPath();
    ctx.arc(badgeX, badgeY, badgeSize * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold ' + Math.max(10, Math.round(badgeSize * 0.56)) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(boxCount), badgeX, badgeY + 0.5);
  }

  function _drawStorageFallback(ctx, x, y, width, height, boxCount, maxSlots) {
    // Glow if boxes present
    if (boxCount > 0) {
      ctx.fillStyle = CLR_STORAGE_GLOW;
      ctx.fillRect(x - 2 * _worldScale, y - 2 * _worldScale, width + 4 * _worldScale, height + 4 * _worldScale);
    }

    ctx.fillStyle = CLR_STORAGE;
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = CLR_STORAGE_FRAME;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, width - 2, height - 2);
    _drawStorageOverlay(ctx, x, y, width, height, boxCount, maxSlots);
  }

  // ─── Draw all ──────────────────────────────────────────────
  function draw(ctx, state) {
    if (!state || !state.productionLine) return;
    const pl = state.productionLine;

    drawConveyor(ctx, pl.conveyorAnimTime);
    drawBoxOnConveyor(ctx, pl.progress);
    drawStorageCell(ctx, pl.storage.length, pl.storageSlots);
  }

  // ─── Hit-test for storage cell click ───────────────────────
  function hitTestStorage(px, py) {
    if (!_layoutReady) return false;
    refreshBounds();
    return px >= _storageBounds.x && px <= _storageBounds.x + _storageBounds.w
      && py >= _storageBounds.y && py <= _storageBounds.y + _storageBounds.h;
  }

  // ─── Public API ────────────────────────────────────────────
  global.Game = global.Game || {};
  global.Game.ProductionLineRender = {
    updateLayout: updateLayout,
    syncState: syncState,
    syncHoverAt: syncHoverAt,
    clearHover: clearHover,
    draw: draw,
    hitTestStorage: hitTestStorage,
    setSpriteSource: setSpriteSource,
    setConveyorAtlas: setConveyorAtlas,
    setBoxAtlas: setBoxAtlas,
    setStorageAtlas: setStorageAtlas,
    // expose for tests
    CONVEYOR_W: CONVEYOR_W,
    CONVEYOR_H: CONVEYOR_H,
    BOX_SIZE: BOX_SIZE,
    STORAGE_SIZE: STORAGE_SIZE,
  };
})(typeof window !== 'undefined' ? window : this);
