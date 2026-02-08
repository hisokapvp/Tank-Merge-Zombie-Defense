/**
 * MergePopup — модальное окно при успешном merge с анимацией 2→1,
 * стрельбой по cooldown и persist "увиденных уровней".
 */
(function (global) {
  'use strict';

  var POPUP_DURATION_MS = 1500;
  var SEEN_LEVELS_KEY = 'seenMergeLevels';

  // Internal state
  var seenLevels = {};
  var isOpen = false;
  var animationFrame = null;
  var shootTimer = null;
  var closeTimeout = null;
  var currentLevel = 1;
  var animStartTime = 0;

  // DOM refs (cached on init)
  var modal = null;
  var canvas = null;
  var ctxPopup = null;
  var titleEl = null;
  var subtitleEl = null;

  // Loaded from storage on init
  function loadSeenLevels() {
    try {
      var raw = global.localStorage && global.localStorage.getItem(SEEN_LEVELS_KEY);
      if (!raw) return {};
      var data = JSON.parse(raw);
      return typeof data === 'object' && data !== null ? data : {};
    } catch (e) {
      return {};
    }
  }

  function saveSeenLevels() {
    try {
      if (global.localStorage) {
        global.localStorage.setItem(SEEN_LEVELS_KEY, JSON.stringify(seenLevels));
      }
    } catch (e) {}
  }

  function markLevelSeen(level) {
    seenLevels[level] = true;
    saveSeenLevels();
  }

  function hasSeenLevel(level) {
    return !!seenLevels[level];
  }

  /**
   * Initialize DOM references. Called once on game load.
   */
  function init() {
    seenLevels = loadSeenLevels();
    modal = document.getElementById('mergePopupModal');
    canvas = document.getElementById('mergePopupCanvas');
    titleEl = document.getElementById('mergePopupTitle');
    subtitleEl = document.getElementById('mergePopupSubtitle');
    if (canvas) {
      ctxPopup = canvas.getContext('2d');
      ctxPopup.imageSmoothingEnabled = false;
    }
    // Click/tap to close
    if (modal) {
      modal.addEventListener('click', close);
      modal.addEventListener('touchend', function (e) {
        e.preventDefault();
        close();
      });
    }
  }

  /**
   * Show merge popup for the given level (only if not seen before).
   * @param {number} level - New tank level after merge
   * @returns {boolean} - true if popup was shown
   */
  function show(level) {
    if (!modal || !canvas) {
      console.warn('[MergePopup] DOM not initialized');
      return false;
    }
    if (hasSeenLevel(level)) {
      return false;
    }
    markLevelSeen(level);
    currentLevel = level;
    isOpen = true;
    animStartTime = performance.now();

    // Update text
    var lang = (global.currentLang || 'ru');
    if (titleEl) {
      titleEl.textContent = lang === 'ru'
        ? 'Новый танк Lv' + level
        : 'New tank Lv' + level;
    }
    if (subtitleEl) {
      subtitleEl.textContent = lang === 'ru'
        ? 'Открыт новый уровень!'
        : 'New level unlocked!';
    }

    // Show modal
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');

    // Start animation
    startAnimation(level);

    // Auto-close after duration
    if (closeTimeout) clearTimeout(closeTimeout);
    closeTimeout = setTimeout(function () {
      close();
    }, POPUP_DURATION_MS);

    return true;
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;

    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
    if (shootTimer) {
      clearInterval(shootTimer);
      shootTimer = null;
    }
    if (closeTimeout) {
      clearTimeout(closeTimeout);
      closeTimeout = null;
    }

    if (modal) {
      modal.classList.add('hidden');
      modal.setAttribute('aria-hidden', 'true');
    }
  }

  // Animation state
  var particles = [];
  var muzzleFlashes = [];

  function startAnimation(level) {
    particles = [];
    muzzleFlashes = [];

    // Calculate fire rate (shots per second) based on level
    var BAL = global.BAL || {};
    var fireRateBase = BAL.fireRateBase || 0.85;
    var fireRateAdd = BAL.fireRateAddPerLevel || 0.075;
    var fireRate = fireRateBase + fireRateAdd * (level - 1);
    var cooldownMs = Math.max(80, 1000 / fireRate);

    // Fire immediately, then at cooldown intervals
    fireShotEffect(level);

    if (shootTimer) clearInterval(shootTimer);
    shootTimer = setInterval(function () {
      if (!isOpen) return;
      fireShotEffect(level);
    }, cooldownMs);

    // Start render loop
    animationFrame = requestAnimationFrame(function loop() {
      if (!isOpen) return;
      renderFrame();
      animationFrame = requestAnimationFrame(loop);
    });
  }

  function fireShotEffect(level) {
    // Play sound
    if (global.playSfx) {
      var sfxId = level >= 20 ? 'shootHeavy' : 'shootNormal';
      global.playSfx(sfxId);
    }

    // Add muzzle flash
    muzzleFlashes.push({
      x: canvas.width / 2 + 20,
      y: canvas.height / 2 - 10,
      life: 0.15,
      maxLife: 0.15
    });

    // Add particles (bullet trail effect)
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

  function renderFrame() {
    if (!ctxPopup || !canvas) return;
    var w = canvas.width;
    var h = canvas.height;
    var elapsed = (performance.now() - animStartTime) / 1000;
    var dt = 1 / 60; // Approximate frame time

    // Clear
    ctxPopup.clearRect(0, 0, w, h);

    // Phase 1: Two tanks merging (0 - 0.4s)
    // Phase 2: Combined tank revealed (0.4s+)
    var mergePhase = Math.min(1, elapsed / 0.4);

    drawMergeAnimation(mergePhase, elapsed);

    // Update and draw muzzle flashes
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

    // Update and draw particles
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

  function drawMergeAnimation(phase, elapsed) {
    var w = canvas.width;
    var h = canvas.height;
    var cx = w / 2;
    var cy = h / 2;

    // Ease function
    var ease = function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
    var eased = ease(phase);

    if (phase < 1) {
      // Two tanks moving toward center
      var offset = 40 * (1 - eased);
      var alpha = 0.7 + 0.3 * (1 - eased);

      // Left tank
      ctxPopup.save();
      ctxPopup.globalAlpha = alpha;
      drawSimpleTank(ctxPopup, cx - offset - 15, cy, currentLevel - 1, 0.7);
      ctxPopup.restore();

      // Right tank
      ctxPopup.save();
      ctxPopup.globalAlpha = alpha;
      drawSimpleTank(ctxPopup, cx + offset + 15, cy, currentLevel - 1, 0.7);
      ctxPopup.restore();

      // Merge flash at center when nearing completion
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
      // Single merged tank with pulse effect
      var pulse = 1 + 0.05 * Math.sin(elapsed * 8);

      // Glow behind tank
      ctxPopup.save();
      ctxPopup.globalAlpha = 0.4;
      var glow = ctxPopup.createRadialGradient(cx, cy, 0, cx, cy, 45);
      glow.addColorStop(0, '#7dffb2');
      glow.addColorStop(1, 'transparent');
      ctxPopup.fillStyle = glow;
      ctxPopup.fillRect(cx - 50, cy - 50, 100, 100);
      ctxPopup.restore();

      // Draw merged tank
      drawSimpleTank(ctxPopup, cx, cy, currentLevel, pulse);
    }
  }

  /**
   * Draw a simple tank representation (fallback if TankSprites not available)
   */
  function drawSimpleTank(targetCtx, x, y, level, scale) {
    scale = scale || 1;

    // Try to use TankSprites if available
    if (global.TankSprites && global.TankSprites.pickBody && global.TankSprites.pickCannon) {
      var body = global.TankSprites.pickBody(level);
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

    // Fallback: simple geometric tank
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

  // Expose module
  global.Game = global.Game || {};
  global.Game.MergePopup = {
    init: init,
    show: show,
    close: close,
    hasSeenLevel: hasSeenLevel,
    getSeenLevels: function () { return Object.assign({}, seenLevels); },
    // For storage integration
    loadSeenLevels: function (data) {
      if (data && typeof data === 'object') {
        seenLevels = data;
      }
    },
    exportSeenLevels: function () {
      return Object.assign({}, seenLevels);
    }
  };

})(typeof window !== 'undefined' ? window : this);
