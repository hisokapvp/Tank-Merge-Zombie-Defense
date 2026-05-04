/**
 * src/core/shopBootstrap.js — Yandex chip-bundle shop bootstrap wiring
 * (item 16 — solo-pipeline-yandex-vk batch#6 / Phase 6).
 *
 * Responsibilities (per TZ item 16, after assets/shop.json loaded and
 * Game.YandexSDK.onReady fires):
 *   1. Game.YandexPayments.init()   — idempotent (initStarted guard
 *      inside the wrapper makes re-calls safe).
 *   2. Game.CloudSave.pullShop()    — merges cloud entitlements into
 *      state.shop (защита от обнуления куков).
 *   3. Game.YandexPayments.getPurchases() → for each purchase NOT yet
 *      marked `delivered` in state.shop.entitlements, call
 *      Game.ChipShop.applyBundle(...) idempotently → consumePurchase().
 *   4. Modal + HUD-button registration is already auto-init on
 *      DOMContentLoaded inside chipShopModal.js / hudShopButton.js;
 *      this module just calls .refresh() / .init() defensively in case
 *      the DOM was not ready when those scripts ran (idempotent on both
 *      sides).
 *
 * Idempotency contract (per TZ): every call into this module is safe
 * to repeat. `_runStarted` short-circuits accidental double-invocation
 * from boot() retries; underlying modules carry their own guards.
 *
 * Defensive contract (per TZ): network errors, offline mode, missing
 * SDK or rejected promises must NOT block boot. Every failure path is
 * caught and logged via console.warn / console.debug so the rest of
 * the game continues to load.
 *
 * Hot-path safety: this module runs once during boot (off the render
 * loop) and on demand from devtools / tests. No allocations live past
 * the recovery loop.
 *
 * Public surface (`Game.ShopBootstrap`):
 *   run()             — main entry; returns Promise<{ ok, replayed,
 *                       cloudPulled, paymentsReady }>.
 *   isRunStarted()    — diagnostic-only.
 *
 * Kill-switch: Game.Config.Shop.enabled === false → silent no-op.
 */
(function (global) {
  'use strict';

  var _runStarted = false;
  var _runResult = null;

  function _shopCfg() {
    return (global.Game && global.Game.Config && global.Game.Config.Shop) || null;
  }

  function _shopEnabled() {
    var cfg = _shopCfg();
    return !!(cfg && cfg.enabled !== false);
  }

  function _payments() {
    return (global.Game && global.Game.YandexPayments) || null;
  }

  function _cloudSave() {
    return (global.Game && global.Game.CloudSave) || null;
  }

  function _ledger() {
    return (global.Game && global.Game.ShopLedger) || null;
  }

  function _applyBundleFn() {
    var ns = global.Game && global.Game.ChipShop;
    return (ns && typeof ns.applyBundle === 'function') ? ns.applyBundle : null;
  }

  function _state() {
    var st = global.Game && global.Game.state;
    return (st && typeof st === 'object') ? st : null;
  }

  function _shopBlock() {
    var st = _state();
    if (!st) return null;
    if (!st.shop || typeof st.shop !== 'object') return null;
    if (!st.shop.entitlements || typeof st.shop.entitlements !== 'object') {
      st.shop.entitlements = {};
    }
    return st.shop;
  }

  // Find the catalog bundle definition matching a purchase's productId.
  // The shop catalog lives in Game.Config.Shop.bundles (populated from
  // assets/shop.json by boot() in game.js).
  function _findBundleByProductId(productId) {
    if (!productId) return null;
    var cfg = _shopCfg();
    if (!cfg || !Array.isArray(cfg.bundles)) return null;
    for (var i = 0; i < cfg.bundles.length; i++) {
      var b = cfg.bundles[i];
      if (!b || typeof b !== 'object') continue;
      if (b.yandexProductId === productId || b.id === productId) return b;
    }
    return null;
  }

  // Merge a cloud-side state.shop block onto the local one. We trust
  // cloud for entitlement keys (server-verified purchases) but never
  // overwrite locally-delivered records — local deliveredAt wins so
  // we don't double-grant chips/drones/dust if the cloud copy is stale.
  function _mergeCloudShop(cloud) {
    if (!cloud || typeof cloud !== 'object') return false;
    var shop = _shopBlock();
    if (!shop) return false;
    var changed = false;
    if (cloud.entitlements && typeof cloud.entitlements === 'object') {
      var keys = Object.keys(cloud.entitlements);
      for (var i = 0; i < keys.length; i++) {
        var token = keys[i];
        var cloudRec = cloud.entitlements[token];
        if (!cloudRec || typeof cloudRec !== 'object') continue;
        var localRec = shop.entitlements[token];
        if (!localRec || typeof localRec !== 'object') {
          // New entitlement from cloud — adopt as-is (defensive copy).
          shop.entitlements[token] = {
            productId: typeof cloudRec.productId === 'string' ? cloudRec.productId : '',
            grantedAt: cloudRec.grantedAt || 0,
            deliveredAt: cloudRec.deliveredAt || null,
            contentsSnapshot: cloudRec.contentsSnapshot || null,
            signature: typeof cloudRec.signature === 'string' ? cloudRec.signature : null,
          };
          if (!cloudRec.deliveredAt) {
            if (!Array.isArray(shop.pendingDeliveries)) shop.pendingDeliveries = [];
            if (shop.pendingDeliveries.indexOf(token) === -1) {
              shop.pendingDeliveries.push(token);
            }
          }
          changed = true;
        } else if (!localRec.deliveredAt && cloudRec.deliveredAt) {
          // Cloud already delivered locally — adopt cloud timestamp so
          // the recovery loop (step 3) doesn't double-grant.
          localRec.deliveredAt = cloudRec.deliveredAt;
          if (Array.isArray(shop.pendingDeliveries)) {
            var idx = shop.pendingDeliveries.indexOf(token);
            if (idx !== -1) shop.pendingDeliveries.splice(idx, 1);
          }
          changed = true;
        }
      }
    }
    if (typeof cloud.lastSync === 'number' && cloud.lastSync > (shop.lastSync || 0)) {
      shop.lastSync = cloud.lastSync;
      changed = true;
    }
    return changed;
  }

  // For each purchase from Yandex.getPurchases() that we haven't yet
  // marked delivered, call applyBundle (idempotent by purchaseToken) and
  // consume the purchase. Errors are swallowed per defensive contract.
  function _replayPurchases(purchases) {
    if (!Array.isArray(purchases) || !purchases.length) {
      return Promise.resolve(0);
    }
    var apply = _applyBundleFn();
    var pay = _payments();
    var ledger = _ledger();
    var shop = _shopBlock();
    if (!apply || !shop) return Promise.resolve(0);

    var replayed = 0;
    var chain = Promise.resolve();
    purchases.forEach(function (pur) {
      if (!pur || typeof pur !== 'object') return;
      var token = pur.purchaseToken || pur.token || '';
      if (typeof token !== 'string' || !token) return;
      var existing = shop.entitlements[token];
      if (existing && existing.deliveredAt) {
        // Already credited locally — nothing to do.
        return;
      }
      var productId = pur.productID || pur.productId || pur.id || '';
      var bundle = _findBundleByProductId(productId);
      if (!bundle) {
        // Purchase exists for an unknown SKU (catalog mismatch / older
        // build). Record it via ledger so it doesn't get lost; manual
        // QA / sandbox smoke (item 24) will surface this.
        if (ledger && typeof ledger.recordPurchase === 'function') {
          try {
            ledger.recordPurchase({
              productId: String(productId || ''),
              purchaseToken: token,
              signature: pur.signature || null,
              payload: pur.payload || null,
            });
          } catch (_) {}
        }
        return;
      }
      // Ensure ledger has the record before applyBundle runs (applyBundle
      // calls markDelivered which expects the entitlement to exist).
      if (ledger && typeof ledger.recordPurchase === 'function') {
        try {
          ledger.recordPurchase({
            productId: String(productId || ''),
            purchaseToken: token,
            signature: pur.signature || null,
            payload: pur.payload || null,
          });
        } catch (_) {}
      }
      chain = chain.then(function () {
        var res;
        try {
          res = apply(bundle, { reason: 'shop_replay_boot', purchaseToken: token });
        } catch (_) {
          res = { ok: false, status: 'apply_threw' };
        }
        if (!res || !res.ok || res.status === 'disabled') {
          return null;
        }
        if (res.status === 'delivered') {
          replayed += 1;
        }
        // Consume regardless of delivered/already_delivered — the host
        // marks the purchase as fulfilled so it stops returning from
        // getPurchases() on subsequent boots.
        if (pay && typeof pay.consumePurchase === 'function') {
          return pay.consumePurchase(token).catch(function () { return false; });
        }
        return null;
      }).catch(function () {
        // Defensive: never let a single bad purchase abort the loop.
        return null;
      });
    });
    return chain.then(function () { return replayed; });
  }

  function _refreshUiSurfaces() {
    try {
      var hud = global.Game && global.Game.HudShopButton;
      if (hud) {
        if (typeof hud.init === 'function') hud.init();
        if (typeof hud.refresh === 'function') hud.refresh();
      }
    } catch (_) {}
    try {
      var ui = global.Game && global.Game.ChipShop && global.Game.ChipShop.UI;
      if (ui && typeof ui.init === 'function') ui.init();
    } catch (_) {}
  }

  function run() {
    if (_runStarted) {
      // Idempotent re-entry: callers (devtools, tests) can re-invoke
      // safely. The first run's result is cached.
      return Promise.resolve(_runResult || { ok: true, replayed: 0, cloudPulled: false, paymentsReady: false });
    }
    _runStarted = true;
    if (!_shopEnabled()) {
      _runResult = { ok: true, replayed: 0, cloudPulled: false, paymentsReady: false, skipped: 'kill_switch' };
      return Promise.resolve(_runResult);
    }

    var pay = _payments();
    var cs = _cloudSave();

    // Step 1: kick payments init. The wrapper auto-inits on script
    // load, but calling init() again is a no-op via initStarted guard.
    try { if (pay && typeof pay.init === 'function') pay.init(); } catch (_) {}
    try { if (cs && typeof cs.init === 'function') cs.init(); } catch (_) {}

    // Step 2: pull cloud shop snapshot, merge into state.shop. Failures
    // resolve to null so we just keep the local copy.
    var pullPromise = (cs && typeof cs.pullShop === 'function')
      ? Promise.resolve().then(function () { return cs.pullShop(); }).catch(function () { return null; })
      : Promise.resolve(null);

    return pullPromise.then(function (cloud) {
      var cloudPulled = !!cloud;
      if (cloud) {
        try { _mergeCloudShop(cloud); } catch (_) {}
      }
      // Step 3: replay any non-delivered purchases. getPurchases() is a
      // no-op (resolves []) when payments are not ready or outside the
      // host iframe.
      var getP = (pay && typeof pay.getPurchases === 'function')
        ? Promise.resolve().then(function () { return pay.getPurchases(); }).catch(function () { return []; })
        : Promise.resolve([]);
      return getP.then(function (purchases) {
        return _replayPurchases(purchases).then(function (replayed) {
          // Step 4: nudge UI surfaces (idempotent).
          _refreshUiSurfaces();
          _runResult = {
            ok: true,
            replayed: replayed | 0,
            cloudPulled: cloudPulled,
            paymentsReady: !!(pay && typeof pay.isReady === 'function' && pay.isReady()),
          };
          try {
            if (typeof console !== 'undefined' && console && typeof console.log === 'function') {
              console.log('[ShopBootstrap] run OK ('
                + 'replayed=' + _runResult.replayed
                + ', cloudPulled=' + _runResult.cloudPulled
                + ', paymentsReady=' + _runResult.paymentsReady
                + ')');
            }
          } catch (_) {}
          return _runResult;
        });
      });
    }).catch(function (err) {
      // Defensive top-level: any unexpected failure must not block boot.
      try {
        if (typeof console !== 'undefined' && console && typeof console.warn === 'function') {
          console.warn('[ShopBootstrap] run failed (continuing):', err);
        }
      } catch (_) {}
      _runResult = { ok: false, replayed: 0, cloudPulled: false, paymentsReady: false, error: 'run_threw' };
      return _runResult;
    });
  }

  function isRunStarted() { return _runStarted; }

  global.Game = global.Game || {};
  global.Game.ShopBootstrap = {
    run: run,
    isRunStarted: isRunStarted,
  };
})(typeof window !== 'undefined' ? window : this);
