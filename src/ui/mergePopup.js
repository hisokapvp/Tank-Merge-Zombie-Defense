/**
 * MergePopup — state-machine merge popup with asset display, stats and manual close.
 * States: IDLE → MERGE_ANIM (3 s, plays once) → SHOWCASE (loop, fire) → IDLE (on close).
 * Assets loaded from TankSprites (tanks.json). Stats computed from BAL constants.
 * Buttons: #btn-fight / #btn-close — the only way to dismiss the popup.
 */
(function (global) {
  'use strict';

  /* ── constants ── */
  var MERGE_ANIM_MS = 3000;
  var SEEN_LEVELS_KEY = 'seenMergeLevels';
  var STATE = { IDLE: 0, MERGE_ANIM: 1, SHOWCASE: 2 };

  /* ── internal state ── */
  var seenLevels = {};
  var currentState = STATE.IDLE;
  var animFrame = null;
  var shootTimer = null;
  var mergeTimeout = null;
  var currentLevel = 1;
  var animStartTime = 0;

  /* ── DOM refs ── */
  var modal, canvas, ctxPopup, titleEl, subtitleEl, statsEl, btnFight, btnClose;

  function getI18n() {
    return global.Game && global.Game.I18n ? global.Game.I18n : null;
  }

  function t(key, vars) {
    var i18n = getI18n();
    if (i18n && typeof i18n.t === 'function') return i18n.t(key, vars || {});
    return key;
  }

  /* ── particles / flashes ── */
  var particles = [];
  var muzzleFlashes = [];

  /* ═══════════════ Persistence ═══════════════ */
  function loadSeenLevels() {
    try {
      var raw = global.localStorage && global.localStorage.getItem(SEEN_LEVELS_KEY);
      if (!raw) return {};
      var data = JSON.parse(raw);
      return typeof data === 'object' && data !== null ? data : {};
    } catch (e) { return {}; }
  }

  function saveSeenLevels() {
    try {
      if (global.localStorage) global.localStorage.setItem(SEEN_LEVELS_KEY, JSON.stringify(seenLevels));
    } catch (e) {}
  }

  function markLevelSeen(level) {
    seenLevels[level] = true;
    saveSeenLevels();
  }

  function hasSeenLevel(level) {
    return !!seenLevels[level];
  }

  /** Clear all seen-level flags (called on New Game). */
  function resetSeenLevels() {
    seenLevels = {};
    try {
      if (global.localStorage) global.localStorage.removeItem(SEEN_LEVELS_KEY);
    } catch (e) {}
  }

  /* ═══════════════ Init ═══════════════ */
  function init() {
    seenLevels = loadSeenLevels();
    modal      = document.getElementById('mergePopupModal');
    canvas     = document.getElementById('mergePopupCanvas');
    titleEl    = document.getElementById('mergePopupTitle');
    subtitleEl = document.getElementById('mergePopupSubtitle');
    statsEl    = document.getElementById('mergePopupStats');
    btnFight   = document.getElementById('btn-fight');
    btnClose   = document.getElementById('btn-close');

    if (canvas) {
      ctxPopup = canvas.getContext('2d');
      ctxPopup.imageSmoothingEnabled = false;
    }

    // Buttons — the only way to close (manual close)
    if (btnFight) {
      btnFight.addEventListener('click', function (e) { e.stopPropagation(); close(); });
      btnFight.addEventListener('touchend', function (e) { e.preventDefault(); e.stopPropagation(); close(); });
    }
    if (btnClose) {
      btnClose.addEventListener('click', function (e) { e.stopPropagation(); close(); });
      btnClose.addEventListener('touchend', function (e) { e.preventDefault(); e.stopPropagation(); close(); });
    }
    // NO global click-to-close — manual close only via buttons
    if (global.Game && global.Game.A11y && modal) {
      global.Game.A11y.registerModal(modal, { onClose: close, initialFocus: btnFight });
    }
  }

  /* ═══════════════ Show / Close ═══════════════ */
  function show(level) {
    if (!modal || !canvas) {
      console.warn('[MergePopup] DOM not initialized');
      return false;
    }
    if (hasSeenLevel(level)) return false;

    markLevelSeen(level);
    currentLevel = level;

    // Pack 2: telemetry logging
    if (global.Game && global.Game.TelemetryLogger) {
      global.Game.TelemetryLogger.log('mergePopupShow', { level: level });
    }
    if (global.Game && global.Game.AnalyticsCollector) {
      global.Game.AnalyticsCollector.track('mergePopupShow', { level: level });
    }

    if (titleEl) titleEl.textContent = t('mergePopupTitle', { level: level });
    if (subtitleEl) subtitleEl.textContent = t('mergePopupSubtitle');

    updateStats(level);

    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    if (global.Game && global.Game.A11y) {
      global.Game.A11y.openModal(modal, { onClose: close, initialFocus: btnFight });
    }

    enterMergeAnim();
    return true;
  }

  function close() {
    if (currentState === STATE.IDLE) return;
    stopAll();
    currentState = STATE.IDLE;
    if (modal) {
      modal.classList.add('hidden');
      modal.setAttribute('aria-hidden', 'true');
      if (global.Game && global.Game.A11y) global.Game.A11y.closeModal(modal);
    }
    // Pack 2: telemetry logging
    if (global.Game && global.Game.TelemetryLogger) {
      global.Game.TelemetryLogger.log('mergePopupClose', { level: currentLevel });
    }
    if (global.Game && global.Game.AnalyticsCollector) {
      global.Game.AnalyticsCollector.track('mergePopupClose', { level: currentLevel });
    }
  }

  /* ═══════════════ State transitions ═══════════════ */
  function enterMergeAnim() {
    currentState = STATE.MERGE_ANIM;
    animStartTime = performance.now();
    particles = [];
    muzzleFlashes = [];
    startRenderLoop();

    if (mergeTimeout) clearTimeout(mergeTimeout);
    mergeTimeout = setTimeout(function () {
      mergeTimeout = null;
      enterShowcase();
    }, MERGE_ANIM_MS);
  }

  function enterShowcase() {
    currentState = STATE.SHOWCASE;
    animStartTime = performance.now();
    startFireLoop();
    // render loop continues from merge phase
  }

  /* ═══════════════ Stats display ═══════════════ */
  function updateStats(level) {
    if (!statsEl) return;
    var BAL = global.BAL || {};
    var dmg = (BAL.dmgBase || 7) * Math.pow(BAL.dmgMultPerLevel || 1.48, level - 1);
    var fr  = (BAL.fireRateBase || 0.85) + (BAL.fireRateAddPerLevel || 0.075) * (level - 1);
    var range = 315;
    var N = level <= 5 ? 1 : level <= 10 ? 2 : 3;
    var fmt = function (n) { return n < 10 ? n.toFixed(1) : Math.round(n).toString(); };

    var rows =
      '<div class="mergePopupModal__stat"><span class="mergePopupModal__statLabel">' + t('mergePopupDamageLabel') + ':</span> ' + fmt(dmg) + (N > 1 ? ' <small>(' + N + '×' + fmt(dmg / N) + ')</small>' : '') + '</div>' +
      '<div class="mergePopupModal__stat"><span class="mergePopupModal__statLabel">' + t('mergePopupFireRateLabel') + ':</span> ' + fr.toFixed(2) + t('mergePopupRateUnit') + '</div>' +
      '<div class="mergePopupModal__stat"><span class="mergePopupModal__statLabel">' + t('mergePopupRangeLabel') + ':</span> ' + range + '</div>';
    if (N > 1) {
      rows += '<div class="mergePopupModal__stat"><span class="mergePopupModal__statLabel">' +
        t('mergePopupBarrelsLabel') + ':</span> ' + N + '</div>';
    }
    statsEl.innerHTML = rows;
  }

  /* ═══════════════ Animation loops ═══════════════ */
  function startRenderLoop() {
    if (animFrame) cancelAnimationFrame(animFrame);
    animFrame = requestAnimationFrame(function loop() {
      if (currentState === STATE.IDLE) return;
      renderFrame();
      animFrame = requestAnimationFrame(loop);
    });
  }

  function startFireLoop() {
    var BAL = global.BAL || {};
    var fireRateBase = BAL.fireRateBase || 0.85;
    var fireRateAdd  = BAL.fireRateAddPerLevel || 0.075;
    var fireRate = fireRateBase + fireRateAdd * (currentLevel - 1);
    var cooldownMs = Math.max(80, 1000 / fireRate);

    fireShotEffect(currentLevel);
    if (shootTimer) clearInterval(shootTimer);
    shootTimer = setInterval(function () {
      if (currentState !== STATE.SHOWCASE) return;
      fireShotEffect(currentLevel);
    }, cooldownMs);
  }

  function stopAll() {
    if (animFrame)    { cancelAnimationFrame(animFrame); animFrame = null; }
    if (shootTimer)   { clearInterval(shootTimer); shootTimer = null; }
    if (mergeTimeout) { clearTimeout(mergeTimeout); mergeTimeout = null; }
  }

  /* ═══════════════ Shot FX ═══════════════ */
  function fireShotEffect(level) {
    if (global.playSfx) {
      var sfxId = level >= 20 ? 'shootHeavy' : 'shootNormal';
      global.playSfx(sfxId);
    }
    muzzleFlashes.push({
      x: canvas.width / 2 + 20,
      y: canvas.height / 2 - 10,
      life: 0.15,
      maxLife: 0.15
    });
    for (var i = 0; i < 6; i++) {
      particles.push({
        x: canvas.width / 2 + 25,
        y: canvas.height / 2 - 10 + (Math.random() - 0.5) * 8,
        vx: 180 + Math.random() * 120,
        vy: (Math.random() - 0.5) * 60,
        r: 2 + Math.random() * 2,
        life: 0.3 + Math.random() * 0.2,
        color: level >= 20 ? '#ff6b35' : '#ffd700'
      });
    }
  }

  /* ═══════════════ Render ═══════════════ */
  function renderFrame() {
    if (!ctxPopup || !canvas) return;
    var w = canvas.width;
    var h = canvas.height;
    var dt = 1 / 60;

    ctxPopup.clearRect(0, 0, w, h);

    if (currentState === STATE.MERGE_ANIM) {
      var elapsed = (performance.now() - animStartTime) / 1000;
      var totalSec = MERGE_ANIM_MS / 1000;
      // Merge phase occupies first 35 % of the 3 s window
      var mergePhase = Math.min(1, elapsed / (totalSec * 0.35));
      drawMergeScene(mergePhase, elapsed);
    } else if (currentState === STATE.SHOWCASE) {
      var showcaseElapsed = (performance.now() - animStartTime) / 1000;
      drawShowcaseScene(showcaseElapsed);
    }

    // Muzzle flashes
    var nextFlashes = [];
    for (var i = 0; i < muzzleFlashes.length; i++) {
      var f = muzzleFlashes[i];
      f.life -= dt;
      if (f.life > 0) {
        var alpha = f.life / f.maxLife;
        ctxPopup.save();
        ctxPopup.globalAlpha = alpha;
        ctxPopup.fillStyle = '#fff';
        ctxPopup.beginPath();
        ctxPopup.arc(f.x, f.y, 8 * alpha + 4, 0, Math.PI * 2);
        ctxPopup.fill();
        ctxPopup.fillStyle = '#ffd700';
        ctxPopup.beginPath();
        ctxPopup.arc(f.x, f.y, 4 * alpha + 2, 0, Math.PI * 2);
        ctxPopup.fill();
        ctxPopup.restore();
        nextFlashes.push(f);
      }
    }
    muzzleFlashes = nextFlashes;

    // Particles
    var nextParticles = [];
    for (var j = 0; j < particles.length; j++) {
      var p = particles[j];
      p.life -= dt;
      if (p.life > 0) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.r *= 0.96;
        var pAlpha = Math.min(1, p.life * 3);
        ctxPopup.save();
        ctxPopup.globalAlpha = pAlpha;
        ctxPopup.fillStyle = p.color;
        ctxPopup.beginPath();
        ctxPopup.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctxPopup.fill();
        ctxPopup.restore();
        nextParticles.push(p);
      }
    }
    particles = nextParticles;
  }

  /* ═══════════════ Scene drawing ═══════════════ */
  function drawMergeScene(phase, elapsed) {
    var w = canvas.width, h = canvas.height;
    var cx = w / 2, cy = h / 2;
    var ease = function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
    var eased = ease(phase);

    if (phase < 1) {
      // Two tanks converging
      var offset = 40 * (1 - eased);
      var alphaVal = 0.7 + 0.3 * (1 - eased);

      ctxPopup.save(); ctxPopup.globalAlpha = alphaVal;
      drawTankSprite(ctxPopup, cx - offset - 15, cy, Math.max(1, currentLevel - 1), 0.7);
      ctxPopup.restore();

      ctxPopup.save(); ctxPopup.globalAlpha = alphaVal;
      drawTankSprite(ctxPopup, cx + offset + 15, cy, Math.max(1, currentLevel - 1), 0.7);
      ctxPopup.restore();

      if (phase > 0.7) {
        var flashAlpha = (phase - 0.7) / 0.3;
        ctxPopup.save();
        ctxPopup.globalAlpha = flashAlpha * 0.8;
        var grad = ctxPopup.createRadialGradient(cx, cy, 0, cx, cy, 50);
        grad.addColorStop(0, '#fff');
        grad.addColorStop(0.5, '#7dffb2');
        grad.addColorStop(1, 'transparent');
        ctxPopup.fillStyle = grad;
        ctxPopup.fillRect(cx - 60, cy - 60, 120, 120);
        ctxPopup.restore();
      }
    } else {
      // Post-merge: reveal new tank with pulse
      var pulse = 1 + 0.05 * Math.sin(elapsed * 8);
      ctxPopup.save();
      ctxPopup.globalAlpha = 0.4;
      var glow = ctxPopup.createRadialGradient(cx, cy, 0, cx, cy, 45);
      glow.addColorStop(0, '#7dffb2');
      glow.addColorStop(1, 'transparent');
      ctxPopup.fillStyle = glow;
      ctxPopup.fillRect(cx - 50, cy - 50, 100, 100);
      ctxPopup.restore();
      drawTankSprite(ctxPopup, cx, cy, currentLevel, pulse);
    }
  }

  function drawShowcaseScene(elapsed) {
    var w = canvas.width, h = canvas.height;
    var cx = w / 2, cy = h / 2;
    var pulse = 1 + 0.03 * Math.sin(elapsed * 4);

    ctxPopup.save();
    ctxPopup.globalAlpha = 0.3;
    var glow = ctxPopup.createRadialGradient(cx, cy, 0, cx, cy, 50);
    glow.addColorStop(0, '#7dffb2');
    glow.addColorStop(1, 'transparent');
    ctxPopup.fillStyle = glow;
    ctxPopup.fillRect(cx - 55, cy - 55, 110, 110);
    ctxPopup.restore();

    drawTankSprite(ctxPopup, cx, cy, currentLevel, pulse);
  }

  /* ═══════════════ Tank sprite ═══════════════ */
  function drawTankSprite(targetCtx, x, y, level, scale) {
    scale = scale || 1;

    // Try TankSprites (tanks.json assets)
    if (global.TankSprites && global.TankSprites.pickBody && global.TankSprites.pickCannon) {
      var body   = global.TankSprites.pickBody(level);
      var cannon = global.TankSprites.pickCannon(level);
      if (body && cannon) {
        var bodyW = (body.cfg.frame && body.cfg.frame.w) || body.img.width;
        var bodyH = (body.cfg.frame && body.cfg.frame.h) || body.img.height;
        var bodyFrameX = (body.cfg.frame && body.cfg.frame.x) || 0;
        var bodyFrameY = (body.cfg.frame && body.cfg.frame.y) || 0;
        var maxW = 60 * scale;
        var maxH = 45 * scale;
        var imgScale = Math.min(maxW / bodyW, maxH / bodyH);

        targetCtx.save();
        targetCtx.translate(x, y);
        var drawW = bodyW * imgScale;
        var drawH = bodyH * imgScale;
        var bodyAnchor = body.cfg.anchor || { x: 0.5, y: 0.6 };
        targetCtx.drawImage(
          body.img,
          bodyFrameX, bodyFrameY, bodyW, bodyH,
          -drawW * bodyAnchor.x, -drawH * bodyAnchor.y, drawW, drawH
        );

        var cannonW = (cannon.cfg.frame && cannon.cfg.frame.w) || cannon.img.width;
        var cannonH = (cannon.cfg.frame && cannon.cfg.frame.h) || cannon.img.height;
        var cannonAnchor = cannon.cfg.anchor || { x: 0.35, y: 0.5 };
        var cannonDrawW = cannonW * imgScale;
        var cannonDrawH = cannonH * imgScale;
        targetCtx.drawImage(
          cannon.img,
          0, 0, cannonW, cannonH,
          -cannonDrawW * cannonAnchor.x, -cannonDrawH * cannonAnchor.y, cannonDrawW, cannonDrawH
        );

        targetCtx.restore();
        return;
      }
    }

    // Fallback: geometric tank
    var tier = Math.floor((level - 1) / 3);
    var colors = ['#b83232', '#c63a3a', '#d14646', '#e05a5a', '#f07171'];
    var hull = colors[Math.min(tier, colors.length - 1)];

    targetCtx.save();
    targetCtx.translate(x, y);
    targetCtx.scale(scale * 0.8, scale * 0.8);

    // Shadow
    targetCtx.fillStyle = 'rgba(0,0,0,.35)';
    roundRect(targetCtx, -22, 8, 44, 10, 5);
    targetCtx.fill();

    // Body
    targetCtx.fillStyle = hull;
    roundRect(targetCtx, -20, -12, 40, 24, 6);
    targetCtx.fill();

    // Turret
    targetCtx.fillStyle = shadeColor(hull, -18);
    targetCtx.beginPath();
    targetCtx.arc(0, -2, 10, 0, Math.PI * 2);
    targetCtx.fill();

    // Cannon
    targetCtx.fillStyle = shadeColor(hull, -30);
    roundRect(targetCtx, 5, -5, 25, 6, 2);
    targetCtx.fill();

    // Level label
    targetCtx.fillStyle = '#eaf1ff';
    targetCtx.font = 'bold 10px sans-serif';
    targetCtx.textAlign = 'center';
    targetCtx.textBaseline = 'top';
    targetCtx.fillText('Lv' + level, 0, 18);

    targetCtx.restore();
  }

  /* ── helpers ── */
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function shadeColor(color, percent) {
    var num = parseInt(color.replace('#', ''), 16);
    var amt = Math.round(2.55 * percent);
    var R = (num >> 16) + amt;
    var G = (num >> 8 & 0x00FF) + amt;
    var B = (num & 0x0000FF) + amt;
    R = Math.max(0, Math.min(255, R));
    G = Math.max(0, Math.min(255, G));
    B = Math.max(0, Math.min(255, B));
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
  }

  /* ═══════════════ Public API ═══════════════ */
  global.Game = global.Game || {};
  global.Game.MergePopup = {
    init: init,
    show: show,
    close: close,
    hasSeenLevel: hasSeenLevel,
    resetSeenLevels: resetSeenLevels,
    getSeenLevels: function () { return Object.assign({}, seenLevels); },
    loadSeenLevels: function (data) {
      if (data && typeof data === 'object') seenLevels = data;
    },
    exportSeenLevels: function () { return Object.assign({}, seenLevels); },
    // Expose for testing
    _getState: function () { return currentState; },
    _STATE: STATE,
    _MERGE_ANIM_MS: MERGE_ANIM_MS,
  };

})(typeof window !== 'undefined' ? window : this);
