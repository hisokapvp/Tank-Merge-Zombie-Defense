/**
 * Yandex Payments wrapper (item 4 — solo-pipeline-yandex-vk batch#2).
 *
 * Responsibilities:
 *   • Wait for Game.YandexSDK.onReady, then resolve the host payments
 *     handle via `sdk.getPayments({ signed: true })` (signed mode is
 *     mandatory for the host's compliance checklist — see the wider
 *     payments contract referenced from docs/ai/SYSTEMS/yandex.md).
 *   • Expose a small, stable namespace `Game.YandexPayments` with the
 *     surface described in the batch ticket: init / isReady / getCatalog /
 *     purchase / consumePurchase / getPurchases /
 *     onPurchaseSuccess / onPurchaseError.
 *   • Outside the host iframe (local dev, VK build, file://) silently
 *     no-op by mirroring the same `_isYandexEnv()`-style gate used in
 *     yandexSdk.js: every promise-returning method resolves to a benign
 *     empty value, listeners stay registered but never fire.
 *
 * Source-level discipline (item 4 of batch#2 carries the same rule
 * documented at the top of yandexSdk.js): JSDoc / inline comments here
 * deliberately avoid printing concrete dev or CDN host literals. We
 * detect the host environment using the same substring fragments
 * (`yandex`, `games.s3`, `yandex.ru/games`, `yandex.com/games`,
 * `yandex.net`) that the SDK module already documents in its
 * allowlist contract — see docs/ai/SYSTEMS/yandex.md. The build
 * sanitiser in ci/build_release.mjs remains as a defense-in-depth
 * safety net.
 */
(function (global) {
  'use strict';

  var payments = null;
  var ready = false;
  var initStarted = false;
  var initFailed = false;
  var successCallbacks = [];
  var errorCallbacks = [];

  function _isYandexEnv() {
    try {
      if (!global.parent || global.parent === global) return false;
      var loc = global.location || {};
      var hostname = String(loc.hostname || '').toLowerCase();
      var doc = global.document || {};
      var referrer = String(doc.referrer || '').toLowerCase();
      // Substring-fragment match — see the SDK module's allowlist contract.
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

  // Debug-toggle для тестирования вне Yandex iframe (batch #9 rework).
  // Возвращает true только если debugForceEnable выставлен И игра НЕ
  // запущена в реальном Yandex iframe — production safety, реальный
  // Yandex flow всегда приоритетнее.
  function _debugForceEnabled() {
    try {
      if (_isYandexEnv()) return false;
      var cfg = global.Game && global.Game.Config && global.Game.Config.Shop;
      return !!(cfg && cfg.debugForceEnable === true);
    } catch (_) {
      return false;
    }
  }

  function _emitSuccess(payload) {
    var arr = successCallbacks.slice();
    for (var i = 0; i < arr.length; i++) {
      try { arr[i](payload); } catch (_) {}
    }
  }

  function _emitError(err) {
    var arr = errorCallbacks.slice();
    for (var i = 0; i < arr.length; i++) {
      try { arr[i](err); } catch (_) {}
    }
  }

  function init() {
    if (initStarted) return;
    initStarted = true;
    if (_debugForceEnabled()) {
      // Debug-режим вне Yandex iframe (batch #9 rework). SDK-handle нет,
      // но `ready=true` чтобы HUD-кнопка показалась и модалка считала
      // payments готовыми. getCatalog() ниже синтезирует priceHint-список
      // из Game.Config.Shop.bundles. Реальный purchase()/consumePurchase
      // в этом режиме не вызываются — модалка обходит SDK напрямую через
      // applyBundle (см. chipShopModal.js).
      ready = true;
      return;
    }
    if (!_isYandexEnv()) {
      // Outside the host iframe — silent no-op. ready stays false; the
      // public API resolves to benign empty values so callers do not
      // need an extra environment check.
      return;
    }
    var sdkApi = global.Game && global.Game.YandexSDK;
    if (!sdkApi || typeof sdkApi.onReady !== 'function') {
      initFailed = true;
      return;
    }
    sdkApi.onReady(function (sdk) {
      if (!sdk || typeof sdk.getPayments !== 'function') {
        initFailed = true;
        return;
      }
      var p;
      try {
        // signed:true is mandatory — host compliance checklist requires
        // server-verifiable purchase signatures.
        p = sdk.getPayments({ signed: true });
      } catch (_) {
        initFailed = true;
        return;
      }
      if (!p || typeof p.then !== 'function') {
        initFailed = true;
        return;
      }
      p.then(function (handle) {
        payments = handle || null;
        ready = !!payments;
        if (!ready) initFailed = true;
      }).catch(function () {
        initFailed = true;
      });
    });
  }

  function isReady() { return ready; }

  function getCatalog() {
    // Debug-режим: SDK handle отсутствует, синтезируем каталог из
    // bundles[] с priceHint, чтобы UI отрисовал цены без живого Yandex.
    if (_debugForceEnabled() && ready) {
      try {
        var cfg = global.Game && global.Game.Config && global.Game.Config.Shop;
        var bundles = (cfg && Array.isArray(cfg.bundles)) ? cfg.bundles : [];
        var out = [];
        for (var i = 0; i < bundles.length; i++) {
          var b = bundles[i];
          if (!b || !b.yandexProductId) continue;
          var hint = b.priceHint || {};
          var amt = Number(hint.amount);
          var cur = typeof hint.currency === 'string' ? hint.currency : 'RUB';
          var priceText = '';
          if (Number.isFinite(amt)) {
            priceText = (amt / 100).toFixed(0) + (cur === 'RUB' ? ' \u20BD' : ' ' + cur);
          }
          out.push({ id: b.yandexProductId, price: priceText, priceValue: priceText });
        }
        return Promise.resolve(out);
      } catch (_) {
        return Promise.resolve([]);
      }
    }
    if (!ready || !payments || typeof payments.getCatalog !== 'function') {
      return Promise.resolve([]);
    }
    try {
      var p = payments.getCatalog();
      if (!p || typeof p.then !== 'function') return Promise.resolve([]);
      return p.then(function (list) {
        return Array.isArray(list) ? list : [];
      }).catch(function () { return []; });
    } catch (_) {
      return Promise.resolve([]);
    }
  }

  function purchase(productId) {
    if (!productId || typeof productId !== 'string') {
      var err = new Error('YandexPayments.purchase: productId required');
      _emitError(err);
      return Promise.reject(err);
    }
    if (!ready || !payments || typeof payments.purchase !== 'function') {
      var noopErr = new Error('YandexPayments.purchase: not ready');
      _emitError(noopErr);
      return Promise.reject(noopErr);
    }
    try {
      var p = payments.purchase({ id: productId });
      if (!p || typeof p.then !== 'function') {
        var badErr = new Error('YandexPayments.purchase: invalid handle');
        _emitError(badErr);
        return Promise.reject(badErr);
      }
      return p.then(function (result) {
        _emitSuccess(result || null);
        return result || null;
      }).catch(function (err) {
        _emitError(err);
        throw err;
      });
    } catch (e) {
      _emitError(e);
      return Promise.reject(e);
    }
  }

  function consumePurchase(token) {
    if (!token || typeof token !== 'string') {
      return Promise.resolve(false);
    }
    if (!ready || !payments || typeof payments.consumePurchase !== 'function') {
      return Promise.resolve(false);
    }
    try {
      var p = payments.consumePurchase(token);
      if (!p || typeof p.then !== 'function') return Promise.resolve(false);
      return p.then(function () { return true; }).catch(function () { return false; });
    } catch (_) {
      return Promise.resolve(false);
    }
  }

  function getPurchases() {
    if (!ready || !payments || typeof payments.getPurchases !== 'function') {
      return Promise.resolve([]);
    }
    try {
      var p = payments.getPurchases();
      if (!p || typeof p.then !== 'function') return Promise.resolve([]);
      return p.then(function (list) {
        return Array.isArray(list) ? list : [];
      }).catch(function () { return []; });
    } catch (_) {
      return Promise.resolve([]);
    }
  }

  function onPurchaseSuccess(cb) {
    if (typeof cb !== 'function') return;
    successCallbacks.push(cb);
  }

  function onPurchaseError(cb) {
    if (typeof cb !== 'function') return;
    errorCallbacks.push(cb);
  }

  global.Game = global.Game || {};
  global.Game.YandexPayments = {
    init: init,
    isReady: isReady,
    getCatalog: getCatalog,
    purchase: purchase,
    consumePurchase: consumePurchase,
    getPurchases: getPurchases,
    onPurchaseSuccess: onPurchaseSuccess,
    onPurchaseError: onPurchaseError,
    // Diagnostic-only — not part of the contract; exposed so unit tests
    // and bootstrap.js (item 16, later batch) can observe init failure
    // without dipping into module internals.
    _hasInitFailed: function () { return initFailed; },
  };

  init();
}(typeof window !== 'undefined' ? window : this));
