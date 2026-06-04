'use strict';
/**
 * packaging/capacitor/native-bridge.js
 * solo-pipeline-yandex-vk#2 / Phase 3+4 — mobile native bridge (Android + iOS).
 *
 * Injects the canonical window.__TMZD_NATIVE_BRIDGE__ object that
 * src/platform/platform.js consumes, EXACTLY mirroring the contract that
 * packaging/electron/preload.js establishes for desktop:
 *
 *   window.__TMZD_NATIVE_BRIDGE__ = {
 *     platform: 'android' | 'ios',
 *     capabilities: {...},
 *     payments:  { backend:'revenuecat', isReady, getCatalog, purchase, getPurchases, ... },
 *     cloudSave: { read, write },        // device-local via Capacitor Preferences
 *     lifecycle: { ready, requestExit, onVisibilityChange, ... },
 *   }
 *
 * IAP is unified across Google Play + App Store by RevenueCat
 * (@revenuecat/purchases-capacitor). The Yandex web path is NOT touched: this
 * file is ONLY copied + wired into the synced Capacitor web assets by
 * packaging/scripts/build-android.mjs / build-ios.mjs. On plain web/Yandex this
 * file is never loaded, so platform.js falls back to the Yandex seam as before.
 *
 * No bundler: Capacitor plugins are read defensively from window.Capacitor.Plugins.
 * Anything missing degrades to a benign no-op (safe-by-default, like the Yandex seam).
 *
 * RevenueCat API key is injected at build time from env (never committed):
 *   window.__TMZD_RC_KEY__   (set by build-android.mjs / build-ios.mjs)
 * Product mapping is injected from packaging/capacitor/revenuecat-products.json:
 *   window.__TMZD_RC_PRODUCTS__  ([{ shopBundleId, revenueCatProductId, ... }])
 */
(function (global) {
  'use strict';

  var cap = global.Capacitor;
  if (!cap || typeof cap.getPlatform !== 'function') {
    // Not running inside Capacitor — leave the Yandex/web seam alone.
    return;
  }

  var platform = String(cap.getPlatform() || '').toLowerCase(); // 'android'|'ios'|'web'
  if (platform !== 'android' && platform !== 'ios') return;

  var plugins = cap.Plugins || {};

  // RevenueCat plugin proxy — resolve across known registration names.
  function rcPlugin() {
    return plugins.Purchases || plugins.PurchasesPlugin || global.Purchases || null;
  }
  function statusBar() { return plugins.StatusBar || null; }
  function splash() { return plugins.SplashScreen || null; }
  function prefs() { return plugins.Preferences || null; }

  var _rcReady = false;
  var _purchaseSuccessCbs = [];
  var _purchaseErrorCbs = [];

  function productMap() {
    var list = global.__TMZD_RC_PRODUCTS__;
    return Array.isArray(list) ? list : [];
  }

  // shop bundle id (== assets/shop.json bundles[].id / yandexProductId) -> RevenueCat product id
  function toRevenueCatId(shopBundleId) {
    var map = productMap();
    for (var i = 0; i < map.length; i++) {
      if (map[i] && map[i].shopBundleId === shopBundleId) {
        return map[i].revenueCatProductId || shopBundleId;
      }
    }
    return shopBundleId; // identity fallback: same id on both stores
  }

  function configureRevenueCat() {
    if (_rcReady) return Promise.resolve(true);
    var rc = rcPlugin();
    var apiKey = global.__TMZD_RC_KEY__;
    if (!rc || typeof rc.configure !== 'function' || !apiKey) {
      // No SDK / no key -> payments degrade to no-op (does not crash the game).
      return Promise.resolve(false);
    }
    try {
      return Promise.resolve(rc.configure({ apiKey: apiKey }))
        .then(function () { _rcReady = true; return true; })
        .catch(function () { return false; });
    } catch (_) {
      return Promise.resolve(false);
    }
  }

  // Best-effort start so isReady()/getCatalog() work once the page is live.
  configureRevenueCat();

  var paymentsFacade = {
    backend: 'revenuecat',

    isReady: function () { return _rcReady; },

    // Returns RevenueCat product info keyed back to shop bundle ids so the
    // in-game shop can show real localized store prices instead of priceHint.
    getCatalog: function () {
      var rc = rcPlugin();
      return configureRevenueCat().then(function (ok) {
        if (!ok || !rc) return [];
        var ids = productMap().map(function (p) { return p.revenueCatProductId; });
        var getter = rc.getProducts || rc.getStoreProducts;
        if (typeof getter !== 'function') return [];
        return Promise.resolve(getter.call(rc, { productIdentifiers: ids }))
          .then(function (res) {
            var products = (res && (res.products || res.storeProducts)) || res || [];
            return (Array.isArray(products) ? products : []).map(function (sp) {
              var rcId = sp.identifier || sp.productIdentifier || sp.id;
              var match = productMap().filter(function (p) { return p.revenueCatProductId === rcId; })[0];
              return {
                id: match ? match.shopBundleId : rcId,
                revenueCatProductId: rcId,
                priceString: sp.priceString || sp.price || '',
                price: sp.price,
                currencyCode: sp.currencyCode,
                title: sp.title,
              };
            });
          })
          .catch(function () { return []; });
      });
    },

    // shopBundleId -> RevenueCat product purchase (Google Play / App Store).
    purchase: function (shopBundleId) {
      var rc = rcPlugin();
      var rcId = toRevenueCatId(shopBundleId);
      return configureRevenueCat().then(function (ok) {
        if (!ok || !rc) {
          var err = new Error('RevenueCat not ready');
          _purchaseErrorCbs.forEach(function (cb) { try { cb(err); } catch (_) {} });
          return Promise.reject(err);
        }
        var buy = rc.purchaseStoreProduct || rc.purchaseProduct;
        var call = (typeof buy === 'function')
          ? buy.call(rc, { productIdentifier: rcId })
          : Promise.reject(new Error('no purchase method'));
        return Promise.resolve(call).then(function (res) {
          var result = { productId: shopBundleId, revenueCatProductId: rcId, raw: res };
          _purchaseSuccessCbs.forEach(function (cb) { try { cb(result); } catch (_) {} });
          return result;
        }).catch(function (e) {
          // RevenueCat reports a userCancelled flag on cancel — not a hard error.
          if (!(e && e.userCancelled)) {
            _purchaseErrorCbs.forEach(function (cb) { try { cb(e); } catch (_) {} });
          }
          return Promise.reject(e);
        });
      });
    },

    // Consumable bundles are granted in-game on success; RevenueCat treats them
    // as consumed by the store. No explicit consume call is required for the
    // mobile backend, so resolve true to satisfy the Platform.Payments contract.
    consumePurchase: function () { return Promise.resolve(true); },

    // Restores non-consumable entitlements (and surfaces past purchases).
    getPurchases: function () {
      var rc = rcPlugin();
      return configureRevenueCat().then(function (ok) {
        if (!ok || !rc || typeof rc.restorePurchases !== 'function') return [];
        return Promise.resolve(rc.restorePurchases())
          .then(function (info) {
            var ent = info && info.customerInfo && info.customerInfo.entitlements;
            var active = (ent && ent.active) || {};
            return Object.keys(active);
          })
          .catch(function () { return []; });
      });
    },

    onPurchaseSuccess: function (cb) { if (typeof cb === 'function') _purchaseSuccessCbs.push(cb); },
    onPurchaseError: function (cb) { if (typeof cb === 'function') _purchaseErrorCbs.push(cb); },
  };

  var cloudSaveFacade = {
    // Device-local persistence via Capacitor Preferences (OS-backed cloud
    // sync — iCloud KVS / Android Auto Backup — handled by the platform).
    isReady: function () { return !!prefs(); },
    read: function (key) {
      var p = prefs();
      if (!p || typeof p.get !== 'function') return Promise.resolve(null);
      return Promise.resolve(p.get({ key: key }))
        .then(function (r) { return r ? r.value : null; })
        .catch(function () { return null; });
    },
    write: function (key, value) {
      var p = prefs();
      if (!p || typeof p.set !== 'function') return Promise.resolve(false);
      return Promise.resolve(p.set({ key: key, value: String(value) }))
        .then(function () { return true; })
        .catch(function () { return false; });
    },
  };

  var lifecycleFacade = {
    ready: function () {
      // Hide the splash once the game signals it is interactive.
      var s = splash();
      if (s && typeof s.hide === 'function') { try { s.hide(); } catch (_) {} }
      var sb = statusBar();
      if (sb && typeof sb.hide === 'function') { try { sb.hide(); } catch (_) {} }
    },
    requestFullscreen: function () {
      var sb = statusBar();
      if (sb && typeof sb.hide === 'function') { try { sb.hide(); } catch (_) {} }
    },
    exitFullscreen: function () {
      var sb = statusBar();
      if (sb && typeof sb.show === 'function') { try { sb.show(); } catch (_) {} }
    },
    // Mobile apps do not programmatically quit (platform store policy);
    // the OS owns app exit. No-op keeps the contract safe.
    requestExit: function () {},
    onVisibilityChange: function (cb) {
      if (typeof cb !== 'function') return;
      var app = plugins.App || null;
      if (app && typeof app.addListener === 'function') {
        try {
          app.addListener('appStateChange', function (state) {
            cb(!!(state && state.isActive));
          });
          return;
        } catch (_) {}
      }
      // Fallback to the DOM visibility API.
      try {
        var doc = global.document;
        if (doc && typeof doc.addEventListener === 'function') {
          doc.addEventListener('visibilitychange', function () {
            cb(doc.visibilityState !== 'hidden');
          });
        }
      } catch (_) {}
    },
  };

  global.__TMZD_NATIVE_BRIDGE__ = {
    platform: platform, // 'android' | 'ios'
    capabilities: {
      payments: true,      // full consumable IAP via RevenueCat
      cloudSave: true,     // Capacitor Preferences (+ OS backup)
      fullscreen: true,
      exit: false,         // store policy: OS owns app exit
      achievements: false, // not wired in this phase
      mobile: true,
    },
    payments: paymentsFacade,
    cloudSave: cloudSaveFacade,
    lifecycle: lifecycleFacade,
  };
})(typeof window !== 'undefined' ? window : this);
