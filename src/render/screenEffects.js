/**
 * Система экранных эффектов (Screen Shake) для Tank-Merge-Zombie-Defense.
 */
(function (global) {
  'use strict';

  var shakeAmplitude = 0;
  var shakeDuration = 0;
  var shakeTimer = 0;

  // Per-frame coalescer for fence threshold shakes: несколько одновременных
  // переходов на одном кадре сливаются в одну тряску с максимальной амплитудой/
  // длительностью; flush происходит при следующем вызове triggerFenceThresholdShake
  // (если рамка сменилась) либо при ручном flushFenceThresholdShakeFrame().
  var fenceFrameId = -1;
  var fenceFrameAmp = 0;
  var fenceFrameDur = 0;

  // Дефолтная конфигурация (используется если fence.json не загружен/неполный).
  // Тряска фрагментов стены срабатывает ТОЛЬКО при пересечении порога HP сверху вниз
  // (50/25/10/0%), а НЕ на каждое попадание. Чем ниже порог — тем сильнее тряска.
  var DEFAULT_THRESHOLD_CONFIG = {
    enabled: true,
    thresholds: [
      { at: 0.5,  amplitude: 4,  duration: 0.12 },
      { at: 0.25, amplitude: 6,  duration: 0.16 },
      { at: 0.10, amplitude: 8,  duration: 0.20 },
      { at: 0.0,  amplitude: 11, duration: 0.26 }
    ]
  };

  function getFenceShakeConfig() {
    var fenceCfg = null;
    try {
      // FenceSprites.config зеркалит fence.json (см. game.js getFenceConfig).
      fenceCfg = (global.FenceSprites && global.FenceSprites.config) ? global.FenceSprites.config : null;
      if (!fenceCfg && global.Game && global.Game.FenceConfig && typeof global.Game.FenceConfig.get === 'function') {
        fenceCfg = global.Game.FenceConfig.get();
      }
    } catch (_) { fenceCfg = null; }
    var cfg = fenceCfg && fenceCfg.screenShake && typeof fenceCfg.screenShake === 'object'
      ? fenceCfg.screenShake
      : null;
    if (!cfg || !Array.isArray(cfg.thresholds) || cfg.thresholds.length === 0) {
      return DEFAULT_THRESHOLD_CONFIG;
    }
    return cfg;
  }

  /**
   * Запуск тряски экрана с заданными параметрами.
   * @param {number} amplitude — амплитуда тряски в пикселях.
   * @param {number} duration — длительность в секундах.
   */
  function triggerShake(amplitude, duration) {
    shakeAmplitude = Math.max(shakeAmplitude, amplitude || 6);
    shakeDuration = Math.max(shakeDuration, duration || 0.3);
    shakeTimer = shakeDuration;
  }

  function flushFenceThresholdShakeFrame() {
    if (fenceFrameAmp > 0 && fenceFrameDur > 0) {
      triggerShake(fenceFrameAmp, fenceFrameDur);
    }
    fenceFrameAmp = 0;
    fenceFrameDur = 0;
    fenceFrameId = -1;
  }

  /**
   * Запуск тряски только при пересечении порогов HP fence-сегмента сверху вниз.
   * Если переход одновременно проходит через несколько порогов (например, 60% -> 5%),
   * берётся самый тяжёлый порог; на одном кадре несколько сегментов сливаются в одну тряску.
   * @param {object} seg — сегмент забора. Используется только для запоминания prevRatio.
   * @param {number} prevRatio — отношение hp/maxHp ДО урона (0..1).
   * @param {number} curRatio — отношение hp/maxHp ПОСЛЕ урона (0..1).
   */
  function triggerFenceThresholdShake(seg, prevRatio, curRatio) {
    var cfg = getFenceShakeConfig();
    if (!cfg || cfg.enabled === false) {
      if (seg && typeof seg === 'object') seg.__shakePrevRatio = curRatio;
      return;
    }
    var thresholds = cfg.thresholds;
    if (!Array.isArray(thresholds) || thresholds.length === 0) return;

    var p = Number.isFinite(prevRatio) ? prevRatio : 1;
    var c = Number.isFinite(curRatio) ? curRatio : p;
    if (c >= p) {
      if (seg && typeof seg === 'object') seg.__shakePrevRatio = c;
      return;
    }

    var heaviestAmp = 0;
    var heaviestDur = 0;
    for (var i = 0; i < thresholds.length; i++) {
      var t = thresholds[i];
      if (!t || !Number.isFinite(t.at)) continue;
      var at = t.at;
      // Триггер при down-crossing: prev строго выше порога, cur — на/ниже порога.
      if (p > at && c <= at) {
        var amp = Number.isFinite(t.amplitude) ? t.amplitude : 0;
        var dur = Number.isFinite(t.duration) ? t.duration : 0;
        if (amp > heaviestAmp) heaviestAmp = amp;
        if (dur > heaviestDur) heaviestDur = dur;
      }
    }

    // Никакой базовой тряски на обычные попадания: фрагмент трясёт ТОЛЬКО на пороге.
    // Если ни один порог не пересечён — heaviestAmp остаётся 0 и тряска не запускается.

    // Per-frame coalescer: используем рендер-кадр как ключ если есть, иначе timestamp ms.
    var frameKey = -1;
    if (global.requestAnimationFrame && global.performance && typeof global.performance.now === 'function') {
      frameKey = Math.floor(global.performance.now());
    } else {
      frameKey = Date.now();
    }
    if (frameKey !== fenceFrameId) {
      flushFenceThresholdShakeFrame();
      fenceFrameId = frameKey;
    }
    if (heaviestAmp > fenceFrameAmp) fenceFrameAmp = heaviestAmp;
    if (heaviestDur > fenceFrameDur) fenceFrameDur = heaviestDur;
    // Сразу применяем — это безопасно для последующих переходов в том же кадре,
    // потому что triggerShake берёт максимум по amplitude/duration.
    if (heaviestAmp > 0 && heaviestDur > 0) {
      triggerShake(heaviestAmp, heaviestDur);
    }

    if (seg && typeof seg === 'object') seg.__shakePrevRatio = c;
  }

  /**
   * Сбрасывает запомненный prevRatio сегмента (вызывать при репаре, чтобы при
   * следующем уроне не сработать ложный порог).
   * @param {object} seg
   */
  function resetSegmentPrevRatio(seg) {
    if (seg && typeof seg === 'object') seg.__shakePrevRatio = 1;
  }

  // === Supercomputer threshold shake (every 5% lost HP) ===
  // Тряска суперкомпьютера: срабатывает на КАЖДЫЕ 5% потерянного HP (пороги 0.95, 0.90,
  // ..., 0.05) и ВСЕГДА ОДИНАКОВАЯ по силе (без зависимости от уровня HP). Не имеет
  // per-segment state — у sc только одна HP-полоска.
  var SC_STEP = 0.05;
  var SC_AMP = 7.0;   // постоянная амплитуда на каждый 5%-порог
  var SC_DUR = 0.28;  // постоянная длительность
  var supercomputerPrevRatio = 1;

  /**
   * Тряска при пересечении порогов 95%, 90%, ..., 5% HP суперкомпьютера сверху вниз.
   * Сила тряски ПОСТОЯННАЯ для любого порога. Несколько пересечений на одном вызове
   * сливаются в одно (амплитуда не суммируется — она и так одинаковая).
   * @param {number} prevRatio — отношение hp/maxHp ДО урона (0..1).
   * @param {number} curRatio  — отношение hp/maxHp ПОСЛЕ урона (0..1).
   */
  function triggerSupercomputerThresholdShake(prevRatio, curRatio) {
    var p = Number.isFinite(prevRatio) ? prevRatio : supercomputerPrevRatio;
    var c = Number.isFinite(curRatio) ? curRatio : p;
    if (p < 0) p = 0; else if (p > 1) p = 1;
    if (c < 0) c = 0; else if (c > 1) c = 1;
    if (c >= p) { supercomputerPrevRatio = c; return; }

    var crossed = false;
    // Пороги: 0.95, 0.90, ..., 0.05 (i=1..19).
    for (var i = 1; i <= 19; i++) {
      var at = 1 - i * SC_STEP;
      if (at < 0) at = 0;
      if (p > at && c <= at) { crossed = true; break; }
    }
    supercomputerPrevRatio = c;
    // Тряска одинаковая независимо от того, сколько 5%-порогов пересечено за раз.
    if (crossed) {
      triggerShake(SC_AMP, SC_DUR);
    }
  }

  /**
   * Самая сильная и продолжительная тряска (5 секунд), вызывается при показе
   * модалки "Критическое состояние". Не зависит от порогового механизма.
   */
  function triggerCriticalStateShake() {
    triggerShake(14, 5.0);
  }

  /**
   * Сбрасывает кэш предыдущего ratio суперкомпьютера (например, при retry/restart).
   */
  function resetSupercomputerPrevRatio() {
    supercomputerPrevRatio = 1;
  }

  /**
   * Обновление состояния таймера тряски.
   * @param {number} dt — приращение времени в секундах.
   */
  function update(dt) {
    if (shakeTimer > 0) {
      shakeTimer -= dt;
      if (shakeTimer <= 0) {
        shakeTimer = 0;
        shakeAmplitude = 0;
        shakeDuration = 0;
      }
    }
  }

  /**
   * Применение смещения тряски к контексту рендеринга Canvas.
   * Вызывается непосредственно перед основной отрисовкой объектов на кадре.
   * @param {CanvasRenderingContext2D} ctx — контекст рисования.
   */
  function applyShake(ctx) {
    if (shakeTimer > 0 && ctx) {
      // Интенсивность затухает по мере истечения таймера
      var progress = shakeTimer / shakeDuration;
      var currentAmp = shakeAmplitude * progress;
      var offsetX = (Math.random() * 2 - 1) * currentAmp;
      var offsetY = (Math.random() * 2 - 1) * currentAmp;
      ctx.translate(offsetX, offsetY);
    }
  }

  global.Game = global.Game || {};
  global.Game.ScreenEffects = {
    triggerShake: triggerShake,
    triggerFenceThresholdShake: triggerFenceThresholdShake,
    resetSegmentPrevRatio: resetSegmentPrevRatio,
    flushFenceThresholdShakeFrame: flushFenceThresholdShakeFrame,
    triggerSupercomputerThresholdShake: triggerSupercomputerThresholdShake,
    triggerCriticalStateShake: triggerCriticalStateShake,
    resetSupercomputerPrevRatio: resetSupercomputerPrevRatio,
    update: update,
    applyShake: applyShake
  };
})(typeof window !== 'undefined' ? window : this);
