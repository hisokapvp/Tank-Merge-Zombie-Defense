(function (global) {
  'use strict';

  // ─── Sprite atlas placeholders ─────────────────────────────
  // Each can be replaced with a real atlas later.
  // Expected format: { image: HTMLImageElement | null, ready: boolean,
  //   frames: [{ x, y, w, h }], frameDurationSec: number }
  let _conveyorAtlas = null;   // conveyor belt animation atlas
  let _boxAtlas      = null;   // box sprite atlas
  let _storageAtlas  = null;   // storage cell sprite atlas

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
  let _cx = 0;  // conveyor left x
  let _cy = 0;  // conveyor center y
  let _sx = 0;  // storage center x
  let _sy = 0;  // storage center y
  let _layoutReady = false;

  function updateLayout(scX, scY, scW) {
    // Conveyor is to the left of supercomputer
    const convRight = scX - scW * 0.5 - GAP;
    _cx = convRight - CONVEYOR_W;
    _cy = scY;
    // Storage cell sits at the end of conveyor (right side = near supercomputer)
    _sx = convRight + STORAGE_SIZE * 0.5 + 2;
    _sy = scY;
    _layoutReady = true;
  }

  // ─── Set atlas ─────────────────────────────────────────────
  function setConveyorAtlas(atlas) { _conveyorAtlas = atlas; }
  function setBoxAtlas(atlas)      { _boxAtlas      = atlas; }
  function setStorageAtlas(atlas)  { _storageAtlas  = atlas; }

  // ─── Draw: conveyor belt ───────────────────────────────────
  function drawConveyor(ctx, animTime) {
    if (!_layoutReady) return;

    const x = _cx;
    const y = _cy - CONVEYOR_H * 0.5;

    if (_conveyorAtlas && _conveyorAtlas.ready && _conveyorAtlas.image) {
      // TODO: draw from atlas frames
      _drawConveyorFallback(ctx, x, y, animTime);
    } else {
      _drawConveyorFallback(ctx, x, y, animTime);
    }
  }

  function _drawConveyorFallback(ctx, x, y, animTime) {
    // Belt body
    ctx.fillStyle = CLR_CONVEYOR;
    ctx.fillRect(x, y, CONVEYOR_W, CONVEYOR_H);

    // Animated belt lines moving left-to-right
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, CONVEYOR_W, CONVEYOR_H);
    ctx.clip();

    ctx.strokeStyle = CLR_CONVEYOR_LINE;
    ctx.lineWidth = 1;
    const offset = (animTime * BELT_LINE_SPEED) % BELT_LINE_GAP;
    for (let lx = x - BELT_LINE_GAP + offset; lx < x + CONVEYOR_W + BELT_LINE_GAP; lx += BELT_LINE_GAP) {
      ctx.beginPath();
      ctx.moveTo(lx, y);
      ctx.lineTo(lx, y + CONVEYOR_H);
      ctx.stroke();
    }
    ctx.restore();

    // Border
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, CONVEYOR_W - 1, CONVEYOR_H - 1);
  }

  // ─── Draw: box on conveyor ─────────────────────────────────
  function drawBoxOnConveyor(ctx, progress) {
    if (!_layoutReady || progress <= 0) return;

    // Box moves from left edge of conveyor to right edge
    const startX = _cx + 2;
    const endX   = _cx + CONVEYOR_W - BOX_SIZE - 2;
    const bx     = startX + (endX - startX) * progress;
    const by     = _cy - BOX_SIZE * 0.5;

    // "Printing" effect: reveal rows top-to-bottom (like tank stamp)
    const revealH = Math.ceil(BOX_SIZE * progress);

    ctx.save();
    ctx.beginPath();
    ctx.rect(bx, by, BOX_SIZE, revealH);
    ctx.clip();

    if (_boxAtlas && _boxAtlas.ready && _boxAtlas.image) {
      // TODO: draw from atlas
      _drawBoxFallback(ctx, bx, by);
    } else {
      _drawBoxFallback(ctx, bx, by);
    }

    ctx.restore();
  }

  function _drawBoxFallback(ctx, x, y) {
    ctx.fillStyle = CLR_BOX;
    ctx.fillRect(x, y, BOX_SIZE, BOX_SIZE);
    ctx.strokeStyle = CLR_BOX_BORDER;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, BOX_SIZE - 1, BOX_SIZE - 1);

    // Small "?" in center
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', x + BOX_SIZE * 0.5, y + BOX_SIZE * 0.5);
  }

  // ─── Draw: storage cell ────────────────────────────────────
  function drawStorageCell(ctx, boxCount, maxSlots) {
    if (!_layoutReady) return;

    const x = _sx - STORAGE_SIZE * 0.5;
    const y = _sy - STORAGE_SIZE * 0.5;

    if (_storageAtlas && _storageAtlas.ready && _storageAtlas.image) {
      // TODO: draw from atlas
      _drawStorageFallback(ctx, x, y, boxCount, maxSlots);
    } else {
      _drawStorageFallback(ctx, x, y, boxCount, maxSlots);
    }
  }

  function _drawStorageFallback(ctx, x, y, boxCount, maxSlots) {
    // Glow if boxes present
    if (boxCount > 0) {
      ctx.fillStyle = CLR_STORAGE_GLOW;
      ctx.fillRect(x - 2, y - 2, STORAGE_SIZE + 4, STORAGE_SIZE + 4);
    }

    ctx.fillStyle = CLR_STORAGE;
    ctx.fillRect(x, y, STORAGE_SIZE, STORAGE_SIZE);
    ctx.strokeStyle = CLR_STORAGE_FRAME;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, STORAGE_SIZE - 2, STORAGE_SIZE - 2);

    // Box count badge
    if (boxCount > 0) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(boxCount), x + STORAGE_SIZE * 0.5, y + STORAGE_SIZE * 0.5);
    } else {
      // Empty indicator
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('—', x + STORAGE_SIZE * 0.5, y + STORAGE_SIZE * 0.5);
    }
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
    const x = _sx - STORAGE_SIZE * 0.5;
    const y = _sy - STORAGE_SIZE * 0.5;
    return px >= x && px <= x + STORAGE_SIZE && py >= y && py <= y + STORAGE_SIZE;
  }

  // ─── Public API ────────────────────────────────────────────
  global.Game = global.Game || {};
  global.Game.ProductionLineRender = {
    updateLayout: updateLayout,
    draw: draw,
    hitTestStorage: hitTestStorage,
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
