/**
 * Yandex Games SDK integration (item 7+8 — solo-pipeline-yandex-vk batch A3).
 *
 * Responsibilities:
 *   • Initialise YaGames SDK if available (`window.YaGames.init()`), expose ysdk through
 *     `Game.YandexSDK.onReady(cb)`.
 *   • Read `ysdk.environment.i18n.lang` and forward it to `Game.I18n.setLanguage(...)`
 *     so the Yandex debug panel sees the language env in active use (item 8).
 *   • Hide the inline `#yandexLoadingSplash` overlay and call
 *     `ysdk.features.LoadingAPI.ready()` once the host signals the game is fully loaded
 *     via `Game.YandexSDK.signalLoaded()` (item 7).
 *
 * Safe-by-default: outside of Yandex Games (e.g. local dev, VK build) the module
 * silently degrades — splash still hides on `signalLoaded()`, `getPreferredLang()`
 * returns null, no SDK calls are made.
 */
(function (global) {
  'use strict';

  var ysdk = null;
  var ready = false;
  var readyCallbacks = [];
  var preferredLang = null;
  var splashHidden = false;
  var nonYandexLogged = false;

  function _safeFwdLang(lang) {
    if (!lang) return;
    try {
      var i18n = global.Game && global.Game.I18n;
      if (i18n && typeof i18n.setLanguage === 'function') i18n.setLanguage(lang);
    } catch (_) {}
  }

  function _normalizeLang(raw) {
    if (!raw) return null;
    var s = String(raw).toLowerCase();
    if (s.indexOf('-') !== -1) s = s.split('-')[0];
    return s.slice(0, 2);
  }

  /**
   * solo-pipeline-yandex-vk#A1-9items-rework / console-diag:
   * The Yandex Games SDK assumes the page is embedded in a Yandex Games iframe
   * (app-*.games.s3.yandex.net, parent yandex.ru/games or yandex.com/games).
   * When loaded outside that environment (local dev `file://`, plain
   * localhost, VK build, or the standalone build at e.g. boosty publishing),
   * `YaGames.init()` triggers a flood of "No parent to post message" /
   * "SDK environment: window.YandexGamesSDKEnvironment is undefined" /
   * "Can not get appId from environment" errors because there is no Yandex
   * postMessage parent to talk to. Detect that case and skip init() entirely
   * — the SDK script itself can still load harmlessly. Inside a real Yandex
   * iframe the existing path is used unchanged.
   */
  function _isYandexEnv() {
    try {
      // No parent = not in any iframe → definitely not Yandex Games.
      if (!global.parent || global.parent === global) return false;
      var loc = global.location || {};
      var hostname = String(loc.hostname || '').toLowerCase();
      var doc = global.document || {};
      var referrer = String(doc.referrer || '').toLowerCase();
      // Real Yandex Games iframe hosts: `app-*.games.s3.yandex.net`,
      // `*.games.yandex.net`, `*.yandex.ru`, `*.yandex.com`.
      if (hostname.indexOf('yandex') !== -1) return true;
      if (hostname.indexOf('games.s3') !== -1) return true;
      // Parent doc referrer should be yandex.ru/games or yandex.com/games.
      if (referrer.indexOf('yandex.ru/games') !== -1) return true;
      if (referrer.indexOf('yandex.com/games') !== -1) return true;
      if (referrer.indexOf('yandex.net') !== -1) return true;
      return false;
    } catch (_) {
      return false;
    }
  }

  function _logNonYandexOnce() {
    if (nonYandexLogged) return;
    nonYandexLogged = true;
    try {
      if (global.console && typeof global.console.info === 'function') {
        global.console.info('[YandexSDK] non-yandex env, skipping init');
      }
    } catch (_) {}
  }

  function _finalizeReady(sdk) {
    ready = true;
    ysdk = sdk || null;
    var arr = readyCallbacks;
    readyCallbacks = [];
    for (var i = 0; i < arr.length; i++) {
      try { arr[i](ysdk); } catch (_) {}
    }
  }

  function init() {
    // Skip Yandex SDK initialisation outside a real Yandex Games iframe to
    // suppress the "No parent to post message" / "SDK environment ..." error
    // flood. The splash element and signalLoaded()/_hideSplash() flow stay
    // functional so the loading overlay still hides correctly.
    if (!_isYandexEnv()) {
      _logNonYandexOnce();
      _finalizeReady(null);
      return;
    }
    if (!global.YaGames || typeof global.YaGames.init !== 'function') {
      _finalizeReady(null);
      return;
    }
    var p;
    try { p = global.YaGames.init(); } catch (_) { _finalizeReady(null); return; }
    if (!p || typeof p.then !== 'function') { _finalizeReady(null); return; }
    p.then(function (sdk) {
      try {
        if (sdk && sdk.environment && sdk.environment.i18n && sdk.environment.i18n.lang) {
          var lang = _normalizeLang(sdk.environment.i18n.lang);
          if (lang === 'ru' || lang === 'en') {
            preferredLang = lang;
            // Forward immediately so debug-panel sees env.i18n.lang reflected in I18n.
            _safeFwdLang(preferredLang);
          }
        }
      } catch (_) {}
      _finalizeReady(sdk);
    }).catch(function () { _finalizeReady(null); });
  }

  function onReady(cb) {
    if (typeof cb !== 'function') return;
    if (ready) { try { cb(ysdk); } catch (_) {} return; }
    readyCallbacks.push(cb);
  }

  function getPreferredLang() {
    return preferredLang;
  }

  function _hideSplash() {
    if (splashHidden) return;
    splashHidden = true;
    var doc = global.document;
    if (!doc) return;
    var el = doc.getElementById('yandexLoadingSplash');
    if (!el) return;
    el.classList.add('yandexLoadingSplash--hidden');
    el.setAttribute('aria-hidden', 'true');
    global.setTimeout(function () {
      try { if (el.parentNode) el.parentNode.removeChild(el); } catch (_) {}
    }, 600);
  }

  function signalLoaded() {
    _hideSplash();
    onReady(function (sdk) {
      try {
        if (sdk && sdk.features && sdk.features.LoadingAPI &&
            typeof sdk.features.LoadingAPI.ready === 'function') {
          sdk.features.LoadingAPI.ready();
        }
      } catch (_) {}
    });
  }

  function setSplashStatus(msg) {
    var doc = global.document;
    if (!doc) return;
    var el = doc.getElementById('yandexLoadingSplashStatus');
    if (el) el.textContent = String(msg);
  }

  function setSplashProgress(pct) {
    var doc = global.document;
    if (!doc) return;
    var el = doc.getElementById('yandexLoadingSplashBar');
    if (!el) return;
    var v = Number(pct);
    if (!Number.isFinite(v)) v = 0;
    if (v < 0) v = 0;
    if (v > 100) v = 100;
    el.style.width = v + '%';
  }

  global.Game = global.Game || {};
  global.Game.YandexSDK = {
    init: init,
    onReady: onReady,
    getPreferredLang: getPreferredLang,
    signalLoaded: signalLoaded,
    setSplashStatus: setSplashStatus,
    setSplashProgress: setSplashProgress,
    isReady: function () { return ready; },
    getYsdk: function () { return ysdk; },
  };

  init();
})(typeof window !== 'undefined' ? window : this);
