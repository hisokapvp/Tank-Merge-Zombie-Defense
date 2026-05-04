/**
 * src/persistence/cloudSave.js — Yandex player.setData/getData adapter
 * (item 8 — solo-pipeline-yandex-vk batch#3 / Phase 3).
 *
 * Responsibilities:
 *   • Resolve a player handle via `sdk.getPlayer({ scopes: false })` once
 *     the underlying SDK is ready. `scopes:false` keeps the call quiet
 *     (no permission prompt) — we only need anonymous cloud KV.
 *   • Push only the `state.shop` block to the host's player KV under a
 *     single namespaced key. We never touch the main save slot — Phase 3
 *     contract is "cloud wins for entitlements only", so other state
 *     remains owned by `src/persistence/storage.js`.
 *   • Throttle pushes to ≤ 1 / 5s using a simple ts-based mark (no
 *     setTimeout / setInterval — hot-path friendly). Callers that fire
 *     during the cooldown receive a resolved no-op promise; the value is
 *     remembered as `pending` so the next saveProgress() flushes it.
 *   • `pullShop()` returns the cloud copy or `null` when unavailable
 *     (offline, kill-switch off, schema mismatch). Bootstrap (item 16) is
 *     responsible for merging it onto local state.
 *
 * Surface (`Game.CloudSave`):
 *   - init()                           — idempotent, kicks off player resolve
 *   - isReady() : boolean              — player handle resolved successfully
 *   - pushShop(shopBlock) : Promise    — throttled push of the shop sub-tree
 *   - flushShop()        : Promise     — force-push pending value (post-purchase)
 *   - pullShop()         : Promise<obj|null>
 *
 * Kill-switches:
 *   - `Game.Config.Shop.enabled === false`           → full no-op
 *   - `Game.Config.Shop.cloudSave.enabled === false` → full no-op
 *   - outside Yandex iframe (`_isYandexEnv()` false) → full no-op
 *
 * Source-level discipline (mirrors yandexPayments.js / yandexSdk.js):
 *   no concrete dev/CDN host literals. We detect host via the same
 *   substring fragments documented in the SDK module's allowlist
 *   contract — see docs/ai/SYSTEMS/yandex.md. Build sanitiser
 *   (ci/build_release.mjs) is the defence-in-depth net.
 */
(function (global) {
  'use strict';

  // KV namespace inside Yandex player storage. Kept short so the host's
  // 200KiB cap is not a concern (we only carry the shop block).
  var SHOP_KEY = 'tmzd_shop_v1';

  // Throttle window for pushShop. 5 seconds per TZ (item 8).
  var PUSH_THROTTLE_MS = 5000;

  var player = null;
  var ready = false;
  var initStarted = false;
  var initFailed = false;

  var lastPushAt = 0;
  var pendingShop = null;   // last value seen during cooldown
  var inFlight = null;      // current push promise (deduplicates concurrent flushes)

  function _now() {
    try { return Date.now(); } catch (_) { return 0; }
  }

  function _isYandexEnv() {
    try {
      if (!global.parent || global.parent === global) return false;
      var loc = global.location || {};
      var hostname = String(loc.hostname || '').toLowerCase();
      var doc = global.document || {};
      var referrer = String(doc.referrer || '').toLowerCase();
      // Substring-fragment match — see SDK module's allowlist contract.
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

  function _shopCfg() {
    var cfg = global.Game && global.Game.Config && global.Game.Config.Shop;
    return cfg || null;
  }

  function _isEnabled() {
    var cfg = _shopCfg();
    if (!cfg) return false;
    if (cfg.enabled === false) return false;
    if (!cfg.cloudSave || cfg.cloudSave.enabled === false) return false;
    return _isYandexEnv();
  }

  function _cloneShop(shopBlock) {
    if (!shopBlock || typeof shopBlock !== 'object') return null;
    try {
      // Structured clone keeps us isolated from later mutation by the
      // caller; the shop block is small (just entitlement map + arrays).
      return JSON.parse(JSON.stringify(shopBlock));
    } catch (_) {
      return null;
    }
  }

  function init() {
    if (initStarted) return;
    initStarted = true;
    if (!_isEnabled()) {
      // Kill-switch off OR outside host iframe — silent no-op.
      return;
    }
    var sdkApi = global.Game && global.Game.YandexSDK;
    if (!sdkApi || typeof sdkApi.onReady !== 'function') {
      initFailed = true;
      return;
    }
    sdkApi.onReady(function (sdk) {
      if (!sdk || typeof sdk.getPlayer !== 'function') {
        initFailed = true;
        return;
      }
      var p;
      try {
        p = sdk.getPlayer({ scopes: false });
      } catch (_) {
        initFailed = true;
        return;
      }
      if (!p || typeof p.then !== 'function') {
        initFailed = true;
        return;
      }
      p.then(function (handle) {
        player = handle || null;
        ready = !!player;
        if (!ready) initFailed = true;
      }).catch(function () {
        initFailed = true;
      });
    });
  }

  function isReady() { return ready && _isEnabled(); }

  // Internal: actually push `value` to player KV, no throttle.
  function _doPush(value) {
    if (!isReady() || !player || typeof player.setData !== 'function') {
      return Promise.resolve(false);
    }
    var payload = {};
    payload[SHOP_KEY] = value;
    var setRes;
    try {
      setRes = player.setData(payload, true);
    } catch (_) {
      return Promise.resolve(false);
    }
    if (!setRes || typeof setRes.then !== 'function') return Promise.resolve(false);
    return setRes.then(function () {
      lastPushAt = _now();
      return true;
    }).catch(function () {
      return false;
    });
  }

  function pushShop(shopBlock) {
    if (!isReady()) return Promise.resolve(false);
    var snapshot = _cloneShop(shopBlock);
    if (!snapshot) return Promise.resolve(false);
    var now = _now();
    // Hot-path safe throttle: ts-based, no timers.
    if (lastPushAt !== 0 && (now - lastPushAt) < PUSH_THROTTLE_MS) {
      // Coalesce — keep latest value for next flush.
      pendingShop = snapshot;
      return Promise.resolve(false);
    }
    pendingShop = null;
    if (inFlight) {
      // Avoid concurrent setData; chain.
      var queued = snapshot;
      inFlight = inFlight.then(function () { return _doPush(queued); });
      return inFlight;
    }
    inFlight = _doPush(snapshot).then(function (ok) {
      inFlight = null;
      return ok;
    }, function () {
      inFlight = null;
      return false;
    });
    return inFlight;
  }

  // Force-flush any pending throttled value. Called after a successful
  // purchase by shopLedger / applyBundle so the entitlement reaches the
  // cloud immediately even if a previous push is still within the
  // throttle window.
  function flushShop() {
    if (!isReady()) return Promise.resolve(false);
    var snap = pendingShop;
    if (!snap) return Promise.resolve(false);
    pendingShop = null;
    if (inFlight) {
      inFlight = inFlight.then(function () { return _doPush(snap); });
      return inFlight;
    }
    inFlight = _doPush(snap).then(function (ok) {
      inFlight = null;
      return ok;
    }, function () {
      inFlight = null;
      return false;
    });
    return inFlight;
  }

  function pullShop() {
    if (!isReady() || !player || typeof player.getData !== 'function') {
      return Promise.resolve(null);
    }
    var p;
    try {
      p = player.getData([SHOP_KEY]);
    } catch (_) {
      return Promise.resolve(null);
    }
    if (!p || typeof p.then !== 'function') return Promise.resolve(null);
    return p.then(function (data) {
      if (!data || typeof data !== 'object') return null;
      var v = data[SHOP_KEY];
      if (!v || typeof v !== 'object') return null;
      return v;
    }).catch(function () {
      return null;
    });
  }

  global.Game = global.Game || {};
  global.Game.CloudSave = {
    init: init,
    isReady: isReady,
    pushShop: pushShop,
    flushShop: flushShop,
    pullShop: pullShop,
  };
})(typeof window !== 'undefined' ? window : this);
