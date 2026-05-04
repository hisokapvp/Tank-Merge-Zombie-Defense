/**
 * src/shop/applyBundle.js — atomic bundle delivery for the Yandex
 * chip-bundle shop (item 10 — solo-pipeline-yandex-vk batch#4 / Phase 4).
 *
 * Public surface (`Game.ChipShop.applyBundle`):
 *   applyBundle(bundleDef, { reason, purchaseToken }) → { ok, status,
 *     deliveredAt, granted: { chips, drones, siliconDust } }
 *
 * Atomic order (per TZ item 10):
 *   1. Chips   → read getPlayerChips(); push new entries shaped like
 *                conveyor-first-box / Game.HangarChips.allChips records
 *                ({ chipId, modIds, level, color/chipColor, count }); call
 *                setPlayerChips(newArr, { reason }).
 *   2. Drones  → Game.Drones.grantFromShop(droneSpec) (added to drones.js
 *                public API in this same batch).
 *   3. Silicon → setSiliconDust(getSiliconDust() + N) — canonical from
 *                achievementRewards.js#L99-L103.
 *   4. Ledger  → Game.ShopLedger.markDelivered(purchaseToken).
 *   5. Persist → Game.Persistence.saveProgress() (with safe fallbacks to
 *                window.saveProgress / Game.Storage.saveGame) +
 *                Game.CloudSave.pushShop(state.shop).
 *
 * Idempotency: if the entitlement for `purchaseToken` is already marked
 * `delivered` in `state.shop.entitlements`, the function early-returns
 * with status='already_delivered' without mutating chips/drones/dust.
 *
 * Hot-path safety: invoked from purchase callbacks and the bootstrap
 * recovery loop (Phase 6); never from the render loop. Intentionally
 * minimal allocations beyond the new chip records and drone calls.
 *
 * Kill-switch: respects Game.Config.Shop.enabled (no-ops when disabled).
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

  function _hangarChipsUi() {
    return (global.Game && global.Game.HangarChipsUI) || null;
  }

  function _hangarChipsPool() {
    var hc = global.Game && global.Game.HangarChips;
    return (hc && Array.isArray(hc.allChips)) ? hc.allChips : null;
  }

  function _ledger() { return (global.Game && global.Game.ShopLedger) || null; }
  function _drones() { return (global.Game && global.Game.Drones) || null; }
  function _cloudSave() { return (global.Game && global.Game.CloudSave) || null; }

  function _persist() {
    // Preferred: Game.Persistence.saveProgress (per TZ wording). Fallback
    // chain matches actual repo wiring (game.js declares window.saveProgress;
    // Game.Storage.saveGame is the lower-level path used by bootstrap.js).
    var ns = global.Game || {};
    if (ns.Persistence && typeof ns.Persistence.saveProgress === 'function') {
      try { ns.Persistence.saveProgress(); return true; } catch (_) {}
    }
    if (typeof global.saveProgress === 'function') {
      try { global.saveProgress(); return true; } catch (_) {}
    }
    if (ns.Storage && typeof ns.Storage.saveGame === 'function') {
      try { ns.Storage.saveGame(_state(), { source: 'shop_apply_bundle' }); return true; } catch (_) {}
    }
    return false;
  }

  function _resolveChipDef(spec, pool, randomFn) {
    // Spec shape from assets/shop.json: { family: 'any'|<id>, tier: N, count: N }
    // Real chip records use integer chipId + chipColor ('red'|'yellow'). The
    // shop deliberately uses an abstract family/tier vocabulary so the SKU
    // catalog can stay stable while the concrete chip pool evolves.
    if (!pool || !pool.length) return null;
    var pick = typeof randomFn === 'function' ? randomFn : Math.random;
    var family = spec && typeof spec.family === 'string' ? spec.family : 'any';
    if (family !== 'any') {
      // Optional explicit chipId routing (forward-compat). family == chipId
      // string → exact match; otherwise fall through to random pool pick.
      for (var i = 0; i < pool.length; i++) {
        if (pool[i] && String(pool[i].chipId) === family) return pool[i];
      }
    }
    return pool[Math.floor(pick() * pool.length)] || null;
  }

  function _grantChips(chipsList, reason, randomFn) {
    if (!Array.isArray(chipsList) || !chipsList.length) return 0;
    var ui = _hangarChipsUi();
    if (!ui || typeof ui.getPlayerChips !== 'function' || typeof ui.setPlayerChips !== 'function') {
      return 0;
    }
    var pool = _hangarChipsPool();
    if (!pool) return 0;
    var current = ui.getPlayerChips();
    if (!Array.isArray(current)) current = [];
    var next = current.slice();
    var granted = 0;
    for (var i = 0; i < chipsList.length; i++) {
      var spec = chipsList[i] || {};
      var count = (spec.count | 0);
      if (count <= 0) continue;
      var level = Number.isFinite(spec.tier) ? Math.max(1, Math.floor(spec.tier)) : 1;
      for (var j = 0; j < count; j++) {
        var chipDef = _resolveChipDef(spec, pool, randomFn);
        if (!chipDef) continue;
        next.push({
          chipId: chipDef.chipId,
          chipColor: chipDef.chipColor || null,
          modIds: Array.isArray(chipDef.modIds) ? chipDef.modIds.slice() : [],
          sourceComboKey: chipDef.sourceComboKey || '',
          level: level,
          count: 1,
        });
        granted++;
      }
    }
    if (granted > 0) {
      try { ui.setPlayerChips(next, { reason: reason || 'shop_purchase' }); } catch (_) {}
    }
    return granted;
  }

  function _grantDrones(dronesList) {
    if (!Array.isArray(dronesList) || !dronesList.length) return 0;
    var dr = _drones();
    if (!dr || typeof dr.grantFromShop !== 'function') return 0;
    var st = _state();
    if (!st) return 0;
    var granted = 0;
    for (var i = 0; i < dronesList.length; i++) {
      var spec = dronesList[i] || {};
      var count = (spec.count | 0);
      if (count <= 0) continue;
      for (var j = 0; j < count; j++) {
        try {
          var d = dr.grantFromShop(st, spec);
          if (d) granted++;
        } catch (_) {}
      }
    }
    return granted;
  }

  function _grantSiliconDust(amount) {
    var dust = (amount | 0);
    if (dust <= 0) return 0;
    var ui = _hangarChipsUi();
    if (!ui || typeof ui.getSiliconDust !== 'function' || typeof ui.setSiliconDust !== 'function') {
      return 0;
    }
    var current = ui.getSiliconDust();
    if (!Number.isFinite(current)) current = 0;
    try { ui.setSiliconDust(current + dust); } catch (_) { return 0; }
    return dust;
  }

  function applyBundle(bundleDef, opts) {
    if (!_shopEnabled()) return { ok: false, status: 'disabled' };
    if (!bundleDef || typeof bundleDef !== 'object') {
      return { ok: false, status: 'invalid_bundle' };
    }
    var options = opts || {};
    var reason = typeof options.reason === 'string' ? options.reason : 'shop_purchase';
    var token = typeof options.purchaseToken === 'string' ? options.purchaseToken : '';
    if (!token) return { ok: false, status: 'missing_token' };

    var shop = _shopBlock();
    if (!shop) return { ok: false, status: 'no_state' };

    // Idempotency gate (TZ item 10, last bullet): replayed token with
    // deliveredAt set → no-op early return.
    var existing = shop.entitlements[token];
    if (existing && typeof existing === 'object' && existing.deliveredAt) {
      return {
        ok: true,
        status: 'already_delivered',
        deliveredAt: existing.deliveredAt,
        granted: { chips: 0, drones: 0, siliconDust: 0 },
      };
    }

    var contents = bundleDef.contents || {};
    var grantedChips = _grantChips(contents.chips, reason, options.randomFn);
    var grantedDrones = _grantDrones(contents.drones);
    var grantedDust = _grantSiliconDust(contents.siliconDust);

    var ledger = _ledger();
    if (ledger && typeof ledger.markDelivered === 'function') {
      try { ledger.markDelivered(token); } catch (_) {}
    }

    _persist();

    var cs = _cloudSave();
    if (cs && typeof cs.pushShop === 'function') {
      try { cs.pushShop(shop); } catch (_) {}
    }

    var rec = shop.entitlements[token];
    return {
      ok: true,
      status: 'delivered',
      deliveredAt: rec && rec.deliveredAt ? rec.deliveredAt : 0,
      granted: {
        chips: grantedChips,
        drones: grantedDrones,
        siliconDust: grantedDust,
      },
    };
  }

  global.Game = global.Game || {};
  global.Game.ChipShop = global.Game.ChipShop || {};
  global.Game.ChipShop.applyBundle = applyBundle;
})(typeof window !== 'undefined' ? window : this);
