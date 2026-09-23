/**
 * Decor collision pulse — периодическое окно, в котором непроходимая зона
 * декора (`assets/decor.json`) временно отключается, давая зомби возможность
 * пройти сквозь заблокировавший их элемент карты.
 *
 * Контракт:
 * - Каждые `periodSec` секунд коллизия выключается на случайную длительность
 *   в диапазоне `[offDurationMinSec, offDurationMaxSec]`.
 * - Таймер продвигается только явным вызовом `step(state, dt)`, поэтому пауза
 *   симуляции (menu/tab/critical) автоматически «замораживает» окно: dt в
 *   `stepZombies()` не тикает во время paused-кадра.
 * - `enabled: false` — полный kill-switch: `isSuppressed()` всегда `false`,
 *   поведение декора возвращается к постоянной коллизии.
 *
 * Модуль чистый (без DOM/глобалов игры): состояние создаётся вызывающим кодом.
 */
(function (global) {
  'use strict';

  var DEFAULTS = {
    enabled: true,
    periodSec: 10,
    offDurationMinSec: 1,
    offDurationMaxSec: 2,
  };

  function clampNumber(value, min, max, fallback) {
    var num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    if (num < min) return min;
    if (num > max) return max;
    return num;
  }

  /**
   * Нормализует authoring-конфиг (decor.json → collisionPulse или BAL override)
   * в безопасный внутренний вид. Любое некорректное поле заменяется дефолтом.
   * @param {object|null|undefined} raw
   * @returns {{enabled:boolean, periodSec:number, offDurationMinSec:number, offDurationMaxSec:number}}
   */
  function normalizeConfig(raw) {
    var src = (raw && typeof raw === 'object') ? raw : {};
    var periodSec = clampNumber(src.periodSec, 0.5, 600, DEFAULTS.periodSec);
    // Окно не должно «съедать» весь период: иначе коллизия фактически выключена.
    // Максимум окна — половина периода, поэтому clamp идёт по maxWindow, а не по 600.
    var maxWindow = periodSec * 0.5;
    var offMin = clampNumber(src.offDurationMinSec, 0.1, maxWindow, Math.min(DEFAULTS.offDurationMinSec, maxWindow));
    var offMax = clampNumber(src.offDurationMaxSec, 0.1, maxWindow, Math.min(DEFAULTS.offDurationMaxSec, maxWindow));
    if (offMax < offMin) offMax = offMin;
    return {
      enabled: src.enabled !== false,
      periodSec: periodSec,
      offDurationMinSec: offMin,
      offDurationMaxSec: offMax,
    };
  }

  /**
   * @param {object|null} cfg — authoring-конфиг
   * @param {function():number} [randomFn] — источник случайности (для тестов)
   */
  function createState(cfg, randomFn) {
    var config = normalizeConfig(cfg);
    return {
      config: config,
      elapsedSec: 0,
      nextOffAtSec: config.enabled ? config.periodSec : Infinity,
      offUntilSec: 0,
      offDurationSec: 0,
      suppressed: false,
      random: (typeof randomFn === 'function') ? randomFn : Math.random,
    };
  }

  /**
   * Сбрасывает таймлайн к началу (new game / пересборка карты / re-normalize cfg).
   * @param {object} state
   * @param {object|null} [cfg] — если передан, конфиг пересчитывается
   */
  function resetState(state, cfg) {
    if (!state || typeof state !== 'object') return null;
    if (cfg !== undefined) state.config = normalizeConfig(cfg);
    var config = state.config;
    state.elapsedSec = 0;
    state.nextOffAtSec = config.enabled ? config.periodSec : Infinity;
    state.offUntilSec = 0;
    state.offDurationSec = 0;
    state.suppressed = false;
    return state;
  }

  /**
   * Продвигает таймлайн на dt секунд и обновляет флаг подавления.
   * Безопасен при невалидном dt и при disabled-конфиге.
   * @returns {boolean} актуальное значение подавления коллизии
   */
  function step(state, dt) {
    if (!state || typeof state !== 'object') return false;
    var config = state.config;
    if (!config || !config.enabled) {
      state.suppressed = false;
      return false;
    }
    var stepDt = Number(dt);
    if (!Number.isFinite(stepDt) || stepDt <= 0) {
      state.suppressed = state.offUntilSec > 0 && state.elapsedSec < state.offUntilSec;
      return state.suppressed;
    }
    state.elapsedSec += stepDt;

    if (state.offUntilSec > 0 && state.elapsedSec >= state.offUntilSec) {
      // Окно закрылось — планируем следующее от начала текущего момента.
      state.offUntilSec = 0;
      state.offDurationSec = 0;
      state.nextOffAtSec = state.elapsedSec + config.periodSec;
    }

    if (state.offUntilSec === 0 && state.elapsedSec >= state.nextOffAtSec) {
      var span = Math.max(0, config.offDurationMaxSec - config.offDurationMinSec);
      var keepRandRaw = Number(state.random());
      var keepRand = Number.isFinite(keepRandRaw) ? Math.min(Math.max(keepRandRaw, 0), 1) : 0;
      var duration = config.offDurationMinSec + span * keepRand;
      state.offDurationSec = duration;
      state.offUntilSec = state.elapsedSec + duration;
    }

    state.suppressed = state.offUntilSec > 0 && state.elapsedSec < state.offUntilSec;
    return state.suppressed;
  }

  /** @returns {boolean} подавлена ли коллизия декора прямо сейчас */
  function isSuppressed(state) {
    return !!(state && state.suppressed === true);
  }

  /** Диагностика для debug-панели/тестов: текущее окно и прогресс. */
  function describe(state) {
    if (!state || !state.config) {
      return { enabled: false, suppressed: false, elapsedSec: 0, secondsToNextOff: 0, secondsLeftInOff: 0 };
    }
    var suppressed = isSuppressed(state);
    return {
      enabled: !!state.config.enabled,
      suppressed: suppressed,
      elapsedSec: state.elapsedSec,
      secondsToNextOff: suppressed ? 0 : Math.max(0, state.nextOffAtSec - state.elapsedSec),
      secondsLeftInOff: suppressed ? Math.max(0, state.offUntilSec - state.elapsedSec) : 0,
    };
  }

  global.Game = global.Game || {};
  global.Game.Mechanics = global.Game.Mechanics || {};
  var api = {
    DEFAULTS: DEFAULTS,
    normalizeConfig: normalizeConfig,
    createState: createState,
    resetState: resetState,
    step: step,
    isSuppressed: isSuppressed,
    describe: describe,
  };
  global.Game.DecorCollisionPulse = api;
  global.Game.Mechanics.DecorCollisionPulse = api;
})(typeof window !== 'undefined' ? window : this);
