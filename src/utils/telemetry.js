/**
 * Локальная телеметрия (offline-only).
 * Считает session- и lifetime-метрики, показывает в debug-панели (?debug=1).
 *
 * API:
 *   Game.Telemetry.event(name)        — инкремент счётчика
 *   Game.Telemetry.gauge(name, value) — запись gauge-значения (last-write-wins)
 *   Game.Telemetry.max(name, value)   — запись max-значения
 *   Game.Telemetry.snapshot()         — полный JSON {session, lifetime, meta}
 *   Game.Telemetry.reset()            — сброс session-метрик (lifetime остаётся)
 *   Game.Telemetry.loadLifetime()     — загрузить lifetime из localStorage
 *   Game.Telemetry.saveLifetime()     — сохранить lifetime в localStorage
 *   Game.Telemetry.initUI(container)  — создать debug-виджет внутри container
 *   Game.Telemetry.refreshUI()        — обновить содержимое виджета
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'telemetry_lifetime';

  // ─── Internal counters ───
  var session = {};   // { name: number }
  var lifetime = {};  // { name: number }
  var gauges = {};    // { name: number }  session-only
  var maxes = {};     // { name: number }  session-only
  var sessionStart = Date.now();

  // ─── Helpers ───
  function safeParse(raw, fb) {
    try { return raw ? JSON.parse(raw) : fb; }
    catch (_) { return fb; }
  }

  // ─── Public API ───

  /** Инкремент счётчика (session + lifetime).
   * @param {string} name  — имя счётчика
   * @param {number} [count=1] — шаг инкремента (для batch-убийств передаётся K)
   */
  function event(name, count) {
    if (!name) return;
    var n = (typeof count === 'number' && count > 1) ? Math.floor(count) : 1;
    session[name] = (session[name] || 0) + n;
    lifetime[name] = (lifetime[name] || 0) + n;
  }

  /** Gauge — last-write-wins (session-only). */
  function gauge(name, value) {
    if (!name) return;
    gauges[name] = value;
  }

  /** Max — запись пикового значения (session-only). */
  function max(name, value) {
    if (!name) return;
    if (maxes[name] === undefined || value > maxes[name]) {
      maxes[name] = value;
    }
  }

  /** Полный снимок для экспорта. */
  function snapshot() {
    return {
      meta: {
        sessionStartIso: new Date(sessionStart).toISOString(),
        durationSec: Math.round((Date.now() - sessionStart) / 1000),
        exportedAt: new Date().toISOString(),
      },
      session: shallowCopy(session),
      gauges: shallowCopy(gauges),
      maxes: shallowCopy(maxes),
      lifetime: shallowCopy(lifetime),
    };
  }

  function shallowCopy(obj) {
    var out = {};
    for (var k in obj) {
      if (obj.hasOwnProperty(k)) out[k] = obj[k];
    }
    return out;
  }

  /** Сброс session-метрик. */
  function reset() {
    session = {};
    gauges = {};
    maxes = {};
    sessionStart = Date.now();
  }

  /** Загрузить lifetime из localStorage. */
  function loadLifetime() {
    try {
      var raw = global.localStorage && global.localStorage.getItem(STORAGE_KEY);
      var data = safeParse(raw, null);
      if (data && typeof data === 'object') lifetime = data;
    } catch (_) { /* quota / security */ }
  }

  /** Сохранить lifetime в localStorage. */
  function saveLifetime() {
    try {
      if (global.localStorage) {
        global.localStorage.setItem(STORAGE_KEY, JSON.stringify(lifetime));
      }
    } catch (_) { /* quota */ }
  }

  // ─── Debug UI (вставляется в debug-панель) ───
  var uiRoot = null;
  var uiPre = null;

  /**
   * Создать debug-виджет.
   * @param {HTMLElement} container — контейнер (обычно debugSectionLogs или отдельная вкладка)
   */
  function initUI(container) {
    if (!container) return;
    uiRoot = document.createElement('div');
    uiRoot.className = 'debugTelemetry';
    uiRoot.style.cssText = 'margin-top:8px;font-size:11px;';

    var header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:4px;';
    header.innerHTML = '<strong>Telemetry</strong>';

    var copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'debugBtn';
    copyBtn.textContent = 'Copy JSON';
    copyBtn.style.cssText = 'font-size:10px;padding:2px 6px;';
    copyBtn.addEventListener('click', function () {
      var json = JSON.stringify(snapshot(), null, 2);
      copyToClipboard(json).then(function () {
        copyBtn.textContent = 'Copied!';
        setTimeout(function () { copyBtn.textContent = 'Copy JSON'; }, 1500);
      });
    });
    header.appendChild(copyBtn);

    var resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'debugBtn';
    resetBtn.textContent = 'Reset session';
    resetBtn.style.cssText = 'font-size:10px;padding:2px 6px;';
    resetBtn.addEventListener('click', function () {
      reset();
      refreshUI();
    });
    header.appendChild(resetBtn);

    uiPre = document.createElement('pre');
    uiPre.style.cssText =
      'max-height:220px;overflow:auto;background:rgba(0,0,0,.25);padding:4px 6px;' +
      'border-radius:4px;white-space:pre-wrap;word-break:break-all;font-size:10px;line-height:1.3;margin:0;';

    uiRoot.appendChild(header);
    uiRoot.appendChild(uiPre);
    container.appendChild(uiRoot);
    refreshUI();
  }

  /** Обновить содержимое виджета. */
  function refreshUI() {
    if (!uiPre) return;
    uiPre.textContent = JSON.stringify(snapshot(), null, 2);
  }

  /** Clipboard с fallback для старых браузеров. */
  function copyToClipboard(text) {
    if (global.navigator && global.navigator.clipboard && global.navigator.clipboard.writeText) {
      return global.navigator.clipboard.writeText(text).catch(function () {
        return fallbackCopy(text);
      });
    }
    return fallbackCopy(text);
  }

  function fallbackCopy(text) {
    return new Promise(function (resolve) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      } catch (_) { /* ignore */ }
      resolve();
    });
  }

  // ─── Export ───
  global.Game = global.Game || {};
  global.Game.Telemetry = {
    event: event,
    gauge: gauge,
    max: max,
    snapshot: snapshot,
    reset: reset,
    loadLifetime: loadLifetime,
    saveLifetime: saveLifetime,
    initUI: initUI,
    refreshUI: refreshUI,
    // Для тестов — прямой доступ к внутренностям
    _session: function () { return session; },
    _lifetime: function () { return lifetime; },
    _gauges: function () { return gauges; },
    _maxes: function () { return maxes; },
    STORAGE_KEY: STORAGE_KEY,
  };

})(typeof window !== 'undefined' ? window : this);
