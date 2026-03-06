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
  let _boxState = 'printLow';
  let _boxElapsedSec = 0;
  const _conveyorBounds = { x: 0, y: 0, w: CONVEYOR_W, h: CONVEYOR_H };
  const _storageBounds = { x: 0, y: 0, w: STORAGE_SIZE, h: STORAGE_SIZE };

  const PART_EFFECT_PRESETS = {
    float: { kind: 'float', amplitudeY: 0.2, frequencyHz: 1.2 },
    pulse: { kind: 'pulse', scaleMul: 0.03, frequencyHz: 3 },
    sway: { kind: 'sway', angleDeg: 2.5, frequencyHz: 2 },
    wobble: { kind: 'wobble', angleDeg: 2, amplitudeX: 0.15, frequencyHz: 2.2 },
    vibration: { kind: 'vibration', amplitudeX: 0.18, amplitudeY: 0.22, frequencyHz: 9 },
    vibrationStrong: { kind: 'vibrationStrong', amplitudeX: 0.28, amplitudeY: 0.34, frequencyHz: 14 },
  };

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
    const source = getSpriteSource();
    if (source && typeof source.getAtlasImage === 'function') {
      const atlasImage = source.getAtlasImage(partName);
      if (atlasImage) return atlasImage;
    }
    if (partName === 'conveyor' && _conveyorAtlas && _conveyorAtlas.ready && _conveyorAtlas.image) {
      return _conveyorAtlas.image;
    }
    if ((partName === 'conveyorBox' || partName === 'box') && _boxAtlas && _boxAtlas.ready && _boxAtlas.image) {
      return _boxAtlas.image;
    }
    if ((partName === 'storageCell' || partName === 'storage') && _storageAtlas && _storageAtlas.ready && _storageAtlas.image) {
      return _storageAtlas.image;
    }
    return null;
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

  function getBoxStateName(progress) {
    return clamp01(progress) < 0.5 ? 'printLow' : 'printHigh';
  }

  function resolveEffectEntry(rawEffect) {
    if (typeof rawEffect === 'string' && rawEffect) return { preset: rawEffect };
    if (!rawEffect || typeof rawEffect !== 'object') return null;
    return rawEffect;
  }

  function mergeEffectPreset(effect) {
    const presetName = typeof effect.preset === 'string' && effect.preset
      ? effect.preset
      : (typeof effect.type === 'string' ? effect.type : '');
    const preset = presetName && PART_EFFECT_PRESETS[presetName] ? PART_EFFECT_PRESETS[presetName] : null;
    if (!preset) return effect;
    return Object.assign({}, preset, effect, { kind: effect.kind || preset.kind || effect.type || presetName });
  }

  function buildEffectTransform(anim, elapsedSec, baseScale) {
    const effects = Array.isArray(anim && anim.effects) ? anim.effects : [];
    let offsetX = 0;
    let offsetY = 0;
    let rotationRad = 0;
    let scaleX = 1;
    let scaleY = 1;

    for (let i = 0; i < effects.length; i++) {
      const rawEffect = resolveEffectEntry(effects[i]);
      if (!rawEffect) continue;
      const effect = mergeEffectPreset(rawEffect);
      const kind = typeof effect.kind === 'string' && effect.kind
        ? effect.kind
        : (typeof effect.type === 'string' ? effect.type : (typeof effect.preset === 'string' ? effect.preset : ''));
      const frequencyHz = Number.isFinite(effect.frequencyHz) ? effect.frequencyHz : 1;
      const phase = Math.max(0, elapsedSec) * frequencyHz * Math.PI * 2 + (Number.isFinite(effect.phase) ? effect.phase : 0);

      if (Number.isFinite(effect.offsetX)) offsetX += effect.offsetX * baseScale;
      if (Number.isFinite(effect.offsetY)) offsetY += effect.offsetY * baseScale;

      if (kind === 'shake' || kind === 'vibration' || kind === 'vibrationStrong') {
        const amplitudeX = Number.isFinite(effect.amplitudeX) ? effect.amplitudeX : 0;
        const amplitudeY = Number.isFinite(effect.amplitudeY) ? effect.amplitudeY : amplitudeX;
        offsetX += Math.sin(phase) * amplitudeX * baseScale;
        offsetY += Math.cos(phase * 1.37) * amplitudeY * baseScale;
        continue;
      }

      if (kind === 'bob' || kind === 'float' || kind === 'hover') {
        const amplitudeY = Number.isFinite(effect.amplitudeY) ? effect.amplitudeY : 0;
        const amplitudeX = Number.isFinite(effect.amplitudeX) ? effect.amplitudeX : 0;
        offsetY += Math.sin(phase) * amplitudeY * baseScale;
        offsetX += Math.cos(phase * 0.5) * amplitudeX * baseScale;
        continue;
      }

      if (kind === 'sway' || kind === 'wobble') {
        const angleDeg = Number.isFinite(effect.angleDeg) ? effect.angleDeg : 0;
        const amplitudeX = Number.isFinite(effect.amplitudeX) ? effect.amplitudeX : 0;
        rotationRad += Math.sin(phase) * angleDeg * Math.PI / 180;
        offsetX += Math.sin(phase) * amplitudeX * baseScale;
        continue;
      }

      if (kind === 'pulse') {
        const scaleMul = Number.isFinite(effect.scaleMul) ? effect.scaleMul : 0;
        const pulse = 1 + Math.sin(phase) * scaleMul;
        scaleX *= pulse;
        scaleY *= pulse;
      }
    }

    return { offsetX: offsetX, offsetY: offsetY, rotationRad: rotationRad, scaleX: scaleX, scaleY: scaleY };
  }

  function triggerConveyorWork() {
    if (_conveyorState === 'work' && _conveyorWorkTimerSec > 0) return false;
    const workAnim = getPartAnimation('conveyor', 'work');
    const duration = getClipDuration(workAnim);
    _conveyorState = 'work';
    _conveyorElapsedSec = 0;
    _conveyorWorkTimerSec = Math.max(0.2, duration > 0 ? duration : 0.2);
    refreshBounds();
    return true;
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
      _boxState = 'printLow';
      _boxElapsedSec = 0;
      refreshBounds();
      return;
    }

    const displaySignature = computeDisplaySignature(pl);
    if (displaySignature !== _lastDisplaySignature) {
      triggerConveyorWork();
    }
    _lastDisplaySignature = displaySignature;

    if (clamp01(pl.progress) > 0) {
      const nextBoxState = getBoxStateName(pl.progress);
      if (nextBoxState !== _boxState) {
        _boxState = nextBoxState;
        _boxElapsedSec = 0;
      } else {
        _boxElapsedSec += dtSafe;
      }
    } else {
      _boxState = 'printLow';
      _boxElapsedSec = 0;
    }

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
    let revealFromBottom = null;
    if (arguments.length > 6 && Number.isFinite(arguments[6])) {
      revealFromBottom = clamp01(arguments[6]);
    }
    const config = getPartConfig(partName);
    if (!(config && config.defined)) return false;
    const img = getPartImage(partName);
    const anim = getPartAnimation(partName, stateName);
    if (!(img && anim)) return false;

    const anchor = config.anchor ? config.anchor : { x: 0.5, y: 0.5 };
    const scale = getClipScale(anim);
    const frameIndex = getFrameIndex(anim, elapsedSec);
    const fx = buildEffectTransform(anim, elapsedSec, scale);
    const localX = -anim.w * (Number.isFinite(anchor.x) ? anchor.x : 0.5);
    const localY = -anim.h * (Number.isFinite(anchor.y) ? anchor.y : 0.5);

    ctx.save();
    ctx.translate(centerX + fx.offsetX, centerY + fx.offsetY);
    if (fx.rotationRad) ctx.rotate(fx.rotationRad);
    ctx.scale(scale * fx.scaleX, scale * fx.scaleY);
    if (revealFromBottom !== null) {
      const revealHeight = anim.h * revealFromBottom;
      if (revealHeight <= 0) {
        ctx.restore();
        return true;
      }
      ctx.beginPath();
      ctx.rect(localX, localY + anim.h - revealHeight, anim.w, revealHeight);
      ctx.clip();
    }
    ctx.drawImage(
      img,
      anim.x + frameIndex * anim.w,
      anim.y,
      anim.w,
      anim.h,
      localX,
      localY,
      anim.w,
      anim.h
    );
    ctx.restore();
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
    const progress01 = clamp01(progress);
    if (!_layoutReady || progress01 <= 0) return;

    const stateName = getBoxStateName(progress01);
    const anim = getPartAnimation('conveyorBox', stateName);
    const fallbackSize = Math.max(10 * _worldScale, Math.min(BOX_SIZE * _worldScale, _conveyorBounds.h - 4 * _worldScale, _conveyorBounds.w * 0.36));
    const boxWidth = anim ? anim.w * getClipScale(anim) : fallbackSize;
    const boxHeight = anim ? anim.h * getClipScale(anim) : fallbackSize;
    const startX = _conveyorBounds.x + 2 * _worldScale + boxWidth * 0.5;
    const endX = _conveyorBounds.x + _conveyorBounds.w - boxWidth * 0.5 - 2 * _worldScale;
    const centerX = startX + (endX - startX) * progress01;
    const centerY = _conveyorBounds.y + _conveyorBounds.h * 0.5;

    if (drawSpriteClip(ctx, 'conveyorBox', stateName, centerX, centerY, _boxElapsedSec, progress01)) {
      return;
    }

    const bx = centerX - boxWidth * 0.5;
    const by = centerY - boxHeight * 0.5;
    const revealH = Math.ceil(boxHeight * progress01);
    ctx.save();
    ctx.beginPath();
    ctx.rect(bx, by + boxHeight - revealH, boxWidth, revealH);
    ctx.clip();
    _drawBoxFallback(ctx, bx, by, Math.max(boxWidth, boxHeight));
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
    triggerConveyorWork: triggerConveyorWork,
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
