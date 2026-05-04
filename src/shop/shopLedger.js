/**
 * src/shop/shopLedger.js — entitlement ledger for the Yandex chip-bundle
 * shop (item 9 — solo-pipeline-yandex-vk batch#3 / Phase 3).
 *
 * The ledger is the single source of truth for "what was already paid for
 * and credited" on the client. It writes through to `state.shop` so the
 * regular save pipeline (storage.js) and CloudSave (item 8) persist it
 * automatically. Idempotency is keyed by `purchaseToken`: replaying the
 * same purchase from `payments.getPurchases()` is a no-op.
 *
 * Public surface (`Game.ShopLedger`):
 *   - recordPurchase({ productId, purchaseToken, signature, payload })
 *       Writes an entitlement record. Idempotent. Returns the record.
 *   - markDelivered(token)
 *       Marks an entitlement as delivered (applyBundle in item 10 will
 *       call this once chips/drones/dust are credited).
 *   - listUndelivered()
 *       Returns entitlements with deliveredAt == null. Bootstrap (item
 *       16) uses this to replay incomplete deliveries on reload.
 *   - exportEvent(entry)
 *       Analytics seam. When `Game.Config.Shop.ledgerExport.enabled` is
 *       true, logs to console.debug AND appends to
 *       `state.shop.pendingExports[]`. When disabled, the call is a
 *       silent no-op (no console output, no state mutation).
 *
 * Kill-switch:
 *   `Game.Config.Shop.enabled === false` → all writes/reads no-op so
 *   purchases cannot leak into a disabled-shop save.
 *
 * Hot-path safety: this module is invoked from purchase callbacks and
 * boot-time recovery — both off the render loop. Allocations here are
 * intentionally minimal (one entitlement object per recordPurchase).
 */
(function (global) {
  'use strict';

  function _shopCfg() {
    var cfg = global.Game && global.Game.Config && global.Game.Config.Shop;
    return cfg || null;
  }

  function _shopEnabled() {
    var cfg = _shopCfg();
    return !!(cfg && cfg.enabled !== false);
  }

  function _ledgerExportEnabled() {
    var cfg = _shopCfg();
    return !!(cfg && cfg.ledgerExport && cfg.ledgerExport.enabled === true);
  }

  // Resolve the current `state.shop` block. We deliberately do not import
  // a module — game state is mutated through window.Game.state in this
  // codebase (see initialState.js / storage.js). If state is unavailable
  // (very early boot, tests), every operation no-ops.
  function _shop() {
    var st = global.Game && global.Game.state;
    if (!st || typeof st !== 'object') return null;
    if (!st.shop || typeof st.shop !== 'object') return null;
    var shop = st.shop;
    if (!shop.entitlements || typeof shop.entitlements !== 'object') {
      shop.entitlements = {};
    }
    if (!Array.isArray(shop.pendingDeliveries)) {
      shop.pendingDeliveries = [];
    }
    return shop;
  }

  function _now() {
    try { return Date.now(); } catch (_) { return 0; }
  }

  function _validToken(t) {
    return typeof t === 'string' && t.length > 0;
  }

  function recordPurchase(input) {
    if (!_shopEnabled()) return null;
    if (!input || typeof input !== 'object') return null;
    var token = input.purchaseToken;
    if (!_validToken(token)) return null;
    var shop = _shop();
    if (!shop) return null;
    var existing = shop.entitlements[token];
    if (existing && typeof existing === 'object') {
      // Idempotent: same token replayed → return prior record untouched.
      return existing;
    }
    var record = {
      productId: typeof input.productId === 'string' ? input.productId : '',
      grantedAt: _now(),
      deliveredAt: null,
      contentsSnapshot: input.payload && typeof input.payload === 'object'
        ? input.payload
        : null,
      signature: typeof input.signature === 'string' ? input.signature : null,
    };
    shop.entitlements[token] = record;
    // Queue for applyBundle if not already there.
    if (shop.pendingDeliveries.indexOf(token) === -1) {
      shop.pendingDeliveries.push(token);
    }
    return record;
  }

  function markDelivered(token) {
    if (!_shopEnabled()) return false;
    if (!_validToken(token)) return false;
    var shop = _shop();
    if (!shop) return false;
    var rec = shop.entitlements[token];
    if (!rec || typeof rec !== 'object') return false;
    rec.deliveredAt = _now();
    var idx = shop.pendingDeliveries.indexOf(token);
    if (idx !== -1) shop.pendingDeliveries.splice(idx, 1);
    return true;
  }

  function listUndelivered() {
    if (!_shopEnabled()) return [];
    var shop = _shop();
    if (!shop) return [];
    var out = [];
    var ents = shop.entitlements;
    var keys = Object.keys(ents);
    for (var i = 0; i < keys.length; i++) {
      var rec = ents[keys[i]];
      if (rec && typeof rec === 'object' && rec.deliveredAt == null) {
        out.push({
          purchaseToken: keys[i],
          productId: rec.productId || '',
          grantedAt: rec.grantedAt || 0,
          contentsSnapshot: rec.contentsSnapshot || null,
          signature: rec.signature || null,
        });
      }
    }
    return out;
  }

  function exportEvent(entry) {
    if (!_shopEnabled()) return false;
    if (!_ledgerExportEnabled()) return false;
    if (!entry || typeof entry !== 'object') return false;
    try {
      if (typeof console !== 'undefined' && console && typeof console.debug === 'function') {
        console.debug('[ShopLedger.exportEvent]', entry);
      }
    } catch (_) {}
    var shop = _shop();
    if (!shop) return false;
    if (!Array.isArray(shop.pendingExports)) {
      shop.pendingExports = [];
    }
    var rec = {
      type: typeof entry.type === 'string' ? entry.type : 'purchase',
      purchaseToken: typeof entry.purchaseToken === 'string' ? entry.purchaseToken : '',
      productId: typeof entry.productId === 'string' ? entry.productId : '',
      ts: _now(),
    };
    if (entry.payload && typeof entry.payload === 'object') {
      rec.payload = entry.payload;
    }
    shop.pendingExports.push(rec);
    return true;
  }

  global.Game = global.Game || {};
  global.Game.ShopLedger = {
    recordPurchase: recordPurchase,
    markDelivered: markDelivered,
    listUndelivered: listUndelivered,
    exportEvent: exportEvent,
  };
})(typeof window !== 'undefined' ? window : this);
