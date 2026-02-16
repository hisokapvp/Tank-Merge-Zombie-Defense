/**
 * ZombieAnimPreview — debug-only превью death-анимаций зомби.
 * Активен только при ?debug=1, toggle по клавише P.
 * Cycle: types (←/→ или A/D), variant (walk/death) — по клавише V.
 *
 * Не влияет на геймплей, не отображается без debug.
 */
(function (global) {
  'use strict';

  // Состояние превью
  var previewState = {
    active: false,
    typeIndex: 0,
    variant: 'walk', // 'walk' | 'death' | 'deathCommon'
    animFrame: 0,
    lastTime: 0,
  };

  // Проверка debug-режима
  function isDebugMode() {
    if (typeof URLSearchParams === 'undefined') return false;
    try {
      var params = new URLSearchParams(global.location?.search || '');
      return params.get('debug') === '1' || params.get('debug') === 'true';
    } catch (e) {
      return false;
    }
  }

  function getZombieSprites() {
    return global.ZombieSprites || null;
  }

  function getTypes() {
    var zs = getZombieSprites();
    return (zs && zs.types) ? zs.types : [];
  }

  function getDeathCommon() {
    var zs = getZombieSprites();
    return (zs && zs.deathCommon) ? zs.deathCommon : null;
  }

  function getCanvasCtx() {
    var canvas = global.document?.getElementById('c');
    return canvas ? canvas.getContext('2d') : null;
  }

  /**
   * Сброс превью-состояния на дефолты.
   */
  function resetPreview() {
    previewState.typeIndex = 0;
    previewState.variant = 'walk';
    previewState.animFrame = 0;
    previewState.lastTime = 0;
  }

  /**
   * Переключение активности превью (toggle on/off).
   */
  function togglePreview() {
    if (!isDebugMode()) return;
    previewState.active = !previewState.active;
    if (previewState.active) {
      resetPreview();
      console.log('[ZombieAnimPreview] ON — P: toggle, A/D or ←/→: cycle types, V: cycle variant');
    } else {
      console.log('[ZombieAnimPreview] OFF');
    }
  }

  /**
   * Следующий тип зомби.
   */
  function nextType() {
    if (!previewState.active) return;
    var types = getTypes();
    if (!types.length) return;
    previewState.typeIndex = (previewState.typeIndex + 1) % types.length;
    previewState.animFrame = 0;
    console.log('[ZombieAnimPreview] Type: ' + getCurrentTypeName());
  }

  /**
   * Предыдущий тип зомби.
   */
  function prevType() {
    if (!previewState.active) return;
    var types = getTypes();
    if (!types.length) return;
    previewState.typeIndex = (previewState.typeIndex - 1 + types.length) % types.length;
    previewState.animFrame = 0;
    console.log('[ZombieAnimPreview] Type: ' + getCurrentTypeName());
  }

  /**
   * Cycle variant: walk → death → deathCommon → walk...
   */
  function cycleVariant() {
    if (!previewState.active) return;
    var variants = ['walk', 'death', 'deathCommon'];
    var idx = variants.indexOf(previewState.variant);
    previewState.variant = variants[(idx + 1) % variants.length];
    previewState.animFrame = 0;
    console.log('[ZombieAnimPreview] Variant: ' + previewState.variant);
  }

  /**
   * Возвращает текущее имя типа.
   */
  function getCurrentTypeName() {
    var types = getTypes();
    if (!types.length) return '(no types)';
    var t = types[previewState.typeIndex];
    return t ? (t.id || 'zombie_' + previewState.typeIndex) : '(unknown)';
  }

  /**
   * Получает текущий frameData для отрисовки.
   * Returns { frame, frames, img } или null.
   */
  function getCurrentFrameData() {
    var zs = getZombieSprites();
    if (!zs || !zs.ready || !zs.atlasImg) return null;

    var types = getTypes();
    var currentType = types[previewState.typeIndex] || null;

    var variant = previewState.variant;
    var frame = null;
    var frames = 1;

    if (variant === 'deathCommon') {
      var dc = getDeathCommon();
      if (!dc) return null;
      frame = dc;
      frames = dc.frames || 1;
    } else if (variant === 'death') {
      if (!currentType || !currentType.death) return null;
      frame = currentType.death;
      frames = currentType.death.frames || 1;
    } else {
      // walk
      if (!currentType) return null;
      frame = currentType.frame;
      frames = currentType.frames || 1;
    }

    return {
      frame: frame,
      frames: frames,
      img: zs.atlasImg,
      scale: currentType ? (currentType.scale || 1.0) : 1.0,
      anchor: currentType ? (currentType.anchor || { x: 0.5, y: 0.75 }) : { x: 0.5, y: 0.75 },
    };
  }

  /**
   * Обработчик клавиатуры для debug preview.
   */
  function handleKeyDown(e) {
    if (!isDebugMode()) return;
    var key = e.key?.toLowerCase() || e.code?.toLowerCase();

    // Toggle preview: P
    if (key === 'p') {
      togglePreview();
      return;
    }

    if (!previewState.active) return;

    // Cycle type: A/D or ArrowLeft/ArrowRight
    if (key === 'd' || key === 'arrowright') {
      nextType();
      e.preventDefault();
      return;
    }
    if (key === 'a' || key === 'arrowleft') {
      prevType();
      e.preventDefault();
      return;
    }

    // Cycle variant: V
    if (key === 'v') {
      cycleVariant();
      e.preventDefault();
      return;
    }
  }

  /**
   * Рендер превью поверх канваса. Вызывать в конце render loop.
   */
  function renderPreview(ctx, canvasW, canvasH, dt) {
    if (!isDebugMode() || !previewState.active) return;

    var data = getCurrentFrameData();

    // Обновляем кадр анимации
    var animSpeed = 8; // fps
    previewState.animFrame += dt * animSpeed;

    // Overlay background
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Info text
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    var title = 'ZOMBIE ANIM PREVIEW (P to close)';
    ctx.fillText(title, canvasW / 2, 20);

    ctx.font = '14px Roboto, sans-serif';
    var typeName = getCurrentTypeName();
    var variantText = previewState.variant;
    var infoText = 'Type: ' + typeName + ' [' + (previewState.typeIndex + 1) + '/' + getTypes().length + ']';
    infoText += '  |  Variant: ' + variantText + '  |  A/D: cycle type, V: cycle variant';
    ctx.fillText(infoText, canvasW / 2, 46);

    if (!data) {
      // Missing data — show warning
      ctx.fillStyle = '#f88';
      ctx.font = 'bold 18px Roboto, sans-serif';
      ctx.fillText('No data for: ' + variantText, canvasW / 2, canvasH / 2);
      ctx.fillStyle = '#aaa';
      ctx.font = '14px Roboto, sans-serif';
      ctx.fillText('(type may not have death animation, or sprites not loaded)', canvasW / 2, canvasH / 2 + 30);
      ctx.restore();
      return;
    }

    // Draw sprite
    var f = data.frame;
    var frames = data.frames;
    var frameIdx = Math.floor(previewState.animFrame) % frames;
    var img = data.img;
    var scale = data.scale * 2.5; // Увеличиваем для превью
    var anchor = data.anchor;

    var sx = f.x + frameIdx * f.w;
    var sy = f.y;
    var sw = f.w;
    var sh = f.h;

    var dw = sw * scale;
    var dh = sh * scale;

    var cx = canvasW / 2;
    var cy = canvasH / 2 + 30;

    var dx = cx - dw * anchor.x;
    var dy = cy - dh * anchor.y;

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);

    // Frame info
    ctx.fillStyle = '#8f8';
    ctx.font = '12px Roboto, sans-serif';
    ctx.fillText('Frame: ' + (frameIdx + 1) + '/' + frames + ' | Size: ' + sw + 'x' + sh, canvasH / 2, canvasH - 40);

    ctx.restore();
  }

  /**
   * Инициализация: регистрация keydown listener.
   * Вызвать один раз при старте игры.
   */
  function init() {
    if (!isDebugMode()) return;
    global.addEventListener('keydown', handleKeyDown);
    console.log('[ZombieAnimPreview] Initialized. Press P to toggle preview.');
  }

  /**
   * Проверка активности превью.
   */
  function isActive() {
    return isDebugMode() && previewState.active;
  }

  // Export
  global.Game = global.Game || {};
  global.Game.ZombieAnimPreview = {
    init: init,
    isActive: isActive,
    renderPreview: renderPreview,
    togglePreview: togglePreview,
    nextType: nextType,
    prevType: prevType,
    cycleVariant: cycleVariant,
    getState: function () { return previewState; },
    isDebugMode: isDebugMode,
  };

})(typeof window !== 'undefined' ? window : this);
