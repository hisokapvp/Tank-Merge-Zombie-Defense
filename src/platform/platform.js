/**
 * src/platform/platform.js — cross-platform abstraction layer
 * (solo-pipeline-yandex-vk#1 / Phase 0 — native packaging).
 *
 * Responsibilities:
 *   • Detect the host environment (web | yandex | electron | android | ios)
 *     using the same substring-fragment discipline as src/yandex/yandexSdk.js
 *     (no concrete CDN host literals — see docs/ai/SYSTEMS/yandex.md).
 *   • Expose capability flags so callers branch on features, not env names.
 *   • Provide unified facades that sit ON TOP OF the existing single-platform
 *     seams without breaking them:
 *       - Game.Platform.Payments   — facade over Game.YandexPayments + native bridge
 *       - Game.Platform.CloudSave  — router over Game.CloudSave (Yandex) + native bridge
 *       - Game.Platform.Lifecycle  — fullscreen/exit/ready/visibility hooks
 *   • Provide getRenderConfig() — a per-platform Phaser render/fps hint
 *     consumed as a settings point by src/phaser/phaserBootstrap.js. It does
 *     NOT rewrite the renderer; it only supplies recommended overrides.
 *
 * Native wrappers (Electron / Capacitor) inject a bridge object onto
 * `window.__TMZD_NATIVE_BRIDGE__` (see packaging/electron/preload.js). When
 * absent (plain web / Yandex), every native-only path silently degrades to a
 * benign no-op, mirroring the safe-by-default contract of the Yandex seams.
 *
 * Surface (`Game.Platform`):
 *   - getEnv() : 'web'|'yandex'|'electron'|'android'|'ios'
 *   - is(envName) : boolean
 *   - getCapabilities() : { payments, cloudSave, fullscreen, exit, ... }
 *   - hasBridge() : boolean
 *   - getBridge() : object|null
 *   - getRenderConfig() : { antialias, powerPreference, fpsTarget }
 *   - Payments   : { isReady, getCatalog, purchase, consumePurchase,
 *                    getPurchases, onPurchaseSuccess, onPurchaseError, getBackend }
 *   - CloudSave  : { isReady, pushShop, flushShop, pullShop, getBackend }
 *   - Lifecycle  : { ready, requestFullscreen, exitFullscreen, requestExit,
 *                    onVisibilityChange }
 *
 * IIFE + 'use strict' + export through global.Game.* — repo module pattern.
 */
(function (global) {
  'use strict';

  var BRIDGE_KEY = '__TMZD_NATIVE_BRIDGE__';

  var _env = null;            // memoised env string
  var _visibilityWired = false;
  var _visibilityCbs = [];

  // ---- environment detection -------------------------------------------

  function _bridge() {
    try {
      var b = global[BRIDGE_KEY];
      return (b && typeof b === 'object') ? b : null;
    } catch (_) {
      return null;
    }
  }

  // Mirror yandexSdk.js: substring-fragment match, no concrete host literals.
  function _isYandexEnv() {
    try {
      if (!global.parent || global.parent === global) return false;
      var loc = global.location || {};
      var hostname = String(loc.hostname || '').toLowerCase();
      var doc = global.document || {};
      var referrer = String(doc.referrer || '').toLowerCase();
      if (hostname.indexOf('yan' + 'dex') !== -1) return true;
      if (hostname.indexOf('games' + '.s3') !== -1) return true;
      if (referrer.indexOf('yan' + 'dex.ru' + '/games') !== -1) return true;
      if (referrer.indexOf('yan' + 'dex.com' + '/games') !== -1) return true;
      if (referrer.indexOf('yan' + 'dex.net') !== -1) return true;
      return false;
    } catch (_) {
      return false;
    }
  }

  function _isElectronEnv() {
    try {
      // A native wrapper that declares itself wins over UA sniffing.
      var b = _bridge();
      if (b && b.platform === 'electron') return true;
      var nav = global.navigator || {};
      var ua = String(nav.userAgent || '').toLowerCase();
      if (ua.indexOf('electron') !== -1) return true;
      // process.versions.electron when nodeIntegration leaks (defensive only).
      var proc = global.process;
      if (proc && proc.versions && proc.versions.electron) return true;
      return false;
    } catch (_) {
      return false;
    }
  }

  function _mobileOs() {
    try {
      var b = _bridge();
      if (b && (b.platform === 'android' || b.platform === 'ios')) return b.platform;
      var nav = global.navigator || {};
      var ua = String(nav.userAgent || '');
      if (/Android/i.test(ua)) return 'android';
      if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
      // Capacitor exposes Capacitor.getPlatform(); read defensively.
      var cap = global.Capacitor;
      if (cap && typeof cap.getPlatform === 'function') {
        var p = String(cap.getPlatform() || '').toLowerCase();
        if (p === 'android' || p === 'ios') return p;
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  function _detect() {
    if (_isYandexEnv()) return 'yandex';
    if (_isElectronEnv()) return 'electron';
    var mob = _mobileOs();
    if (mob) return mob; // 'android' | 'ios'
    return 'web';
  }

  function getEnv() {
    if (_env == null) _env = _detect();
    return _env;
  }

  function is(envName) { return getEnv() === envName; }

  function hasBridge() { return !!_bridge(); }
  function getBridge() { return _bridge(); }

  // ---- capabilities -----------------------------------------------------

  function getCapabilities() {
    var env = getEnv();
    var b = _bridge();
    var bridgeCaps = (b && b.capabilities && typeof b.capabilities === 'object')
      ? b.capabilities : {};
    return {
      env: env,
      payments: (env === 'yandex') || !!bridgeCaps.payments,
      cloudSave: (env === 'yandex') || !!bridgeCaps.cloudSave,
      // Browser Fullscreen API exists on web/yandex; native handles its own.
      fullscreen: (env === 'web' || env === 'yandex') || !!bridgeCaps.fullscreen,
      // Only native shells can actually quit the app.
      exit: (env === 'electron') || !!bridgeCaps.exit,
      achievements: !!bridgeCaps.achievements,
      // Mobile gets the lighter render path by default.
      mobile: (env === 'android' || env === 'ios'),
      bridge: !!b,
    };
  }

  // ---- per-platform render hint (settings point for phaserBootstrap) ----

  function getRenderConfig() {
    var caps = getCapabilities();
    var mobileMode = global.Game && global.Game.MobileMode;
    var mobileActive = false;
    try {
      mobileActive = caps.mobile ||
        !!(mobileMode && typeof mobileMode.isEnabled === 'function' && mobileMode.isEnabled());
    } catch (_) { mobileActive = caps.mobile; }

    var fpsTarget = 60;
    try {
      if (mobileMode && typeof mobileMode.getFpsCap === 'function') {
        var cap = mobileMode.getFpsCap();
        if (cap && cap > 0) fpsTarget = cap;
      }
    } catch (_) {}

    return {
      // Desktop/native shells benefit from explicit high-performance GPU hint;
      // browsers ignore unknown values gracefully.
      powerPreference: 'high-performance',
      // Antialias off on mobile to save fill-rate; on elsewhere keeps parity.
      antialias: !mobileActive,
      fpsTarget: fpsTarget,
    };
  }

  // ---- Payments facade --------------------------------------------------
  // Sits on top of the existing Game.YandexPayments. yandex backend delegates
  // verbatim; electron/steam + mobile/RevenueCat route through the native
  // bridge. Outside any backend every method resolves to a benign value.

  function _yandexPayments() {
    return (global.Game && global.Game.YandexPayments) || null;
  }

  function _bridgePayments() {
    var b = _bridge();
    return (b && b.payments && typeof b.payments === 'object') ? b.payments : null;
  }

  function _paymentsBackend() {
    if (getEnv() === 'yandex') return 'yandex';
    if (_bridgePayments()) return getEnv() === 'electron' ? 'steam' : 'native';
    return 'none';
  }

  function _callMaybePromise(fn, args, fallback) {
    try {
      var r = fn.apply(null, args || []);
      if (r && typeof r.then === 'function') {
        return r.then(function (v) { return v; }, function () { return fallback; });
      }
      return Promise.resolve(r);
    } catch (_) {
      return Promise.resolve(fallback);
    }
  }

  var Payments = {
    getBackend: _paymentsBackend,
    isReady: function () {
      var backend = _paymentsBackend();
      if (backend === 'yandex') {
        var yp = _yandexPayments();
        return !!(yp && typeof yp.isReady === 'function' && yp.isReady());
      }
      if (backend === 'steam' || backend === 'native') {
        var bp = _bridgePayments();
        if (bp && typeof bp.isReady === 'function') {
          try { return !!bp.isReady(); } catch (_) { return false; }
        }
        return !!bp;
      }
      return false;
    },
    getCatalog: function () {
      var backend = _paymentsBackend();
      if (backend === 'yandex') {
        var yp = _yandexPayments();
        if (yp && typeof yp.getCatalog === 'function') return _callMaybePromise(yp.getCatalog, [], []);
        return Promise.resolve([]);
      }
      var bp = _bridgePayments();
      if (bp && typeof bp.getCatalog === 'function') return _callMaybePromise(bp.getCatalog, [], []);
      return Promise.resolve([]);
    },
    purchase: function (productId) {
      var backend = _paymentsBackend();
      if (backend === 'yandex') {
        var yp = _yandexPayments();
        if (yp && typeof yp.purchase === 'function') return yp.purchase(productId);
        return Promise.reject(new Error('Platform.Payments: no yandex backend'));
      }
      var bp = _bridgePayments();
      if (bp && typeof bp.purchase === 'function') return _callMaybePromise(bp.purchase, [productId], null);
      return Promise.reject(new Error('Platform.Payments: no payments backend'));
    },
    consumePurchase: function (token) {
      var backend = _paymentsBackend();
      if (backend === 'yandex') {
        var yp = _yandexPayments();
        if (yp && typeof yp.consumePurchase === 'function') return _callMaybePromise(yp.consumePurchase, [token], false);
        return Promise.resolve(false);
      }
      var bp = _bridgePayments();
      if (bp && typeof bp.consumePurchase === 'function') return _callMaybePromise(bp.consumePurchase, [token], false);
      return Promise.resolve(false);
    },
    getPurchases: function () {
      var backend = _paymentsBackend();
      if (backend === 'yandex') {
        var yp = _yandexPayments();
        if (yp && typeof yp.getPurchases === 'function') return _callMaybePromise(yp.getPurchases, [], []);
        return Promise.resolve([]);
      }
      var bp = _bridgePayments();
      if (bp && typeof bp.getPurchases === 'function') return _callMaybePromise(bp.getPurchases, [], []);
      return Promise.resolve([]);
    },
    onPurchaseSuccess: function (cb) {
      if (typeof cb !== 'function') return;
      var yp = _yandexPayments();
      if (yp && typeof yp.onPurchaseSuccess === 'function') yp.onPurchaseSuccess(cb);
      var bp = _bridgePayments();
      if (bp && typeof bp.onPurchaseSuccess === 'function') {
        try { bp.onPurchaseSuccess(cb); } catch (_) {}
      }
    },
    onPurchaseError: function (cb) {
      if (typeof cb !== 'function') return;
      var yp = _yandexPayments();
      if (yp && typeof yp.onPurchaseError === 'function') yp.onPurchaseError(cb);
      var bp = _bridgePayments();
      if (bp && typeof bp.onPurchaseError === 'function') {
        try { bp.onPurchaseError(cb); } catch (_) {}
      }
    },
  };

  // ---- CloudSave router --------------------------------------------------
  // Yandex env delegates to the existing Game.CloudSave. Native shells (Steam
  // Cloud via Electron preload, native filesystem) route through the bridge.

  function _yandexCloud() {
    return (global.Game && global.Game.CloudSave) || null;
  }

  function _bridgeCloud() {
    var b = _bridge();
    return (b && b.cloudSave && typeof b.cloudSave === 'object') ? b.cloudSave : null;
  }

  function _cloudBackend() {
    if (getEnv() === 'yandex') return 'yandex';
    if (_bridgeCloud()) return getEnv() === 'electron' ? 'steam' : 'native';
    return 'none';
  }

  var CloudSave = {
    getBackend: _cloudBackend,
    isReady: function () {
      var backend = _cloudBackend();
      if (backend === 'yandex') {
        var yc = _yandexCloud();
        return !!(yc && typeof yc.isReady === 'function' && yc.isReady());
      }
      var bc = _bridgeCloud();
      if (bc && typeof bc.isReady === 'function') {
        try { return !!bc.isReady(); } catch (_) { return false; }
      }
      return !!bc;
    },
    pushShop: function (shopBlock) {
      var backend = _cloudBackend();
      if (backend === 'yandex') {
        var yc = _yandexCloud();
        if (yc && typeof yc.pushShop === 'function') return _callMaybePromise(yc.pushShop, [shopBlock], false);
        return Promise.resolve(false);
      }
      var bc = _bridgeCloud();
      if (bc && typeof bc.pushShop === 'function') return _callMaybePromise(bc.pushShop, [shopBlock], false);
      return Promise.resolve(false);
    },
    flushShop: function () {
      var backend = _cloudBackend();
      if (backend === 'yandex') {
        var yc = _yandexCloud();
        if (yc && typeof yc.flushShop === 'function') return _callMaybePromise(yc.flushShop, [], false);
        return Promise.resolve(false);
      }
      var bc = _bridgeCloud();
      if (bc && typeof bc.flushShop === 'function') return _callMaybePromise(bc.flushShop, [], false);
      return Promise.resolve(false);
    },
    pullShop: function () {
      var backend = _cloudBackend();
      if (backend === 'yandex') {
        var yc = _yandexCloud();
        if (yc && typeof yc.pullShop === 'function') return _callMaybePromise(yc.pullShop, [], null);
        return Promise.resolve(null);
      }
      var bc = _bridgeCloud();
      if (bc && typeof bc.pullShop === 'function') return _callMaybePromise(bc.pullShop, [], null);
      return Promise.resolve(null);
    },
  };

  // ---- Lifecycle --------------------------------------------------------

  function _bridgeLifecycle() {
    var b = _bridge();
    return (b && b.lifecycle && typeof b.lifecycle === 'object') ? b.lifecycle : null;
  }

  var Lifecycle = {
    // Signal the host the game is interactive. On Yandex this is owned by
    // Game.YandexSDK.signalLoaded(); here we only forward to a native bridge.
    ready: function () {
      var lc = _bridgeLifecycle();
      if (lc && typeof lc.ready === 'function') {
        try { lc.ready(); } catch (_) {}
      }
    },
    requestFullscreen: function () {
      var lc = _bridgeLifecycle();
      if (lc && typeof lc.requestFullscreen === 'function') {
        try { lc.requestFullscreen(); return; } catch (_) {}
      }
      try {
        var el = global.document && global.document.documentElement;
        if (el && typeof el.requestFullscreen === 'function') el.requestFullscreen();
      } catch (_) {}
    },
    exitFullscreen: function () {
      var lc = _bridgeLifecycle();
      if (lc && typeof lc.exitFullscreen === 'function') {
        try { lc.exitFullscreen(); return; } catch (_) {}
      }
      try {
        var doc = global.document;
        if (doc && typeof doc.exitFullscreen === 'function') doc.exitFullscreen();
      } catch (_) {}
    },
    // Only native shells can quit. Web/Yandex no-op.
    requestExit: function () {
      var lc = _bridgeLifecycle();
      if (lc && typeof lc.requestExit === 'function') {
        try { lc.requestExit(); } catch (_) {}
      }
    },
    onVisibilityChange: function (cb) {
      if (typeof cb !== 'function') return;
      _visibilityCbs.push(cb);
      if (_visibilityWired) return;
      _visibilityWired = true;
      try {
        var doc = global.document;
        if (doc && typeof doc.addEventListener === 'function') {
          doc.addEventListener('visibilitychange', function () {
            var visible = doc.visibilityState !== 'hidden';
            for (var i = 0; i < _visibilityCbs.length; i++) {
              try { _visibilityCbs[i](visible); } catch (_) {}
            }
          });
        }
      } catch (_) {}
    },
  };

  global.Game = global.Game || {};
  global.Game.Platform = {
    getEnv: getEnv,
    is: is,
    hasBridge: hasBridge,
    getBridge: getBridge,
    getCapabilities: getCapabilities,
    getRenderConfig: getRenderConfig,
    Payments: Payments,
    CloudSave: CloudSave,
    Lifecycle: Lifecycle,
    // Diagnostic-only: let tests reset the memoised env after stubbing globals.
    _resetEnvForTests: function () { _env = null; },
  };
})(typeof window !== 'undefined' ? window : this);
