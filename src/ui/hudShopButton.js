/**
 * src/ui/hudShopButton.js — HUD shortcut to the Yandex chip-bundle shop
 * (item 13 — solo-pipeline-yandex-vk batch#5 / Phase 5).
 *
 * Public surface (`Game.HudShopButton`):
 *   init()    — cache DOM, wire click handler, run first refresh().
 *   refresh() — re-evaluate visibility gate and toggle the `hidden`
 *               class on `#hudShopButton`. Safe to call at any time.
 *
 * Visibility gate (all must be true, per item 13):
 *   • Game.Config.Shop && Game.Config.Shop.enabled !== false
 *   • _isYandexEnv() — mirrors `src/yandex/yandexSdk.js#L68-L86`
 *   • Game.YandexPayments.isReady()
 *
 * Click handler:
 *   click → Game.ChipShop.UI.open() (no-op if UI is not yet wired).
 *
 * Ordering note: the `<script>` tag is loaded after chipShopModal.js so
 * Game.ChipShop.UI is already exported by the time the click handler
 * actually fires (the handler is attached at init() time but never
 * resolves the namespace until the user clicks).
 *
 * Hot-path safety: only init() / refresh() touch the DOM. The render
 * loop never calls into this module.
 */
(function (global) {
  'use strict';

  var doc = global.document || null;

  // Mirrors src/yandex/yandexSdk.js#L68-L86 _isYandexEnv() so the HUD
  // gate stays correct even when only this module is loaded outside the
  // SDK (the helper is module-private inside yandexSdk.js).
  function _isYandexEnv() {
    try {
      if (!global.parent || global.parent === global) return false;
      var loc = global.location || {};
      var hostname = String(loc.hostname || '').toLowerCase();
      var d = global.document || {};
      var referrer = String(d.referrer || '').toLowerCase();
      if (hostname.indexOf('yandex') !== -1) return true;
      if (hostname.indexOf('games.s3') !== -1) return true;
      if (referrer.indexOf('yandex.ru/games') !== -1) return true;
      if (referrer.indexOf('yandex.com/games') !== -1) return true;
      if (referrer.indexOf('yandex.net') !== -1) return true;
      return false;
    } catch (_) {
      return false;
    }
  }

  function _shopEnabled() {
    var cfg = global.Game && global.Game.Config && global.Game.Config.Shop;
    return !!(cfg && cfg.enabled !== false);
  }

  // Debug-toggle (batch #9 rework): позволяет HUD-кнопке появиться вне
  // Yandex iframe для локального тестирования. Не срабатывает в
  // реальном Yandex iframe — реальный flow приоритетнее.
  function _debugForceEnabled() {
    if (_isYandexEnv()) return false;
    var cfg = global.Game && global.Game.Config && global.Game.Config.Shop;
    return !!(cfg && cfg.debugForceEnable === true);
  }

  function _paymentsReady() {
    var pay = global.Game && global.Game.YandexPayments;
    return !!(pay && typeof pay.isReady === 'function' && pay.isReady());
  }

  function _shouldShow() {
    return _shopEnabled() && (_isYandexEnv() || _debugForceEnabled()) && _paymentsReady();
  }

  var _initialized = false;
  var _btn = null;

  function _onClick(ev) {
    if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
    var ui = global.Game && global.Game.ChipShop && global.Game.ChipShop.UI;
    if (ui && typeof ui.open === 'function') {
      try { ui.open(); } catch (_) {}
    }
  }

  function init() {
    if (_initialized || !doc) return;
    _btn = doc.getElementById('hudShopButton');
    if (!_btn) return;
    _btn.addEventListener('click', _onClick);
    _initialized = true;
    refresh();
  }

  function refresh() {
    if (!_btn && doc) _btn = doc.getElementById('hudShopButton');
    if (!_btn) return;
    var show = _shouldShow();
    if (show) {
      _btn.classList.remove('hidden');
      _btn.removeAttribute('aria-hidden');
    } else {
      _btn.classList.add('hidden');
      _btn.setAttribute('aria-hidden', 'true');
    }
  }

  global.Game = global.Game || {};
  global.Game.HudShopButton = {
    init: init,
    refresh: refresh,
  };

  // Auto-init on DOM ready. The gate is re-checked on a short interval
  // for the first ~10s after init so YandexPayments.isReady() flipping
  // true (after async SDK init) flips the button visible without
  // requiring an explicit refresh() call from the SDK layer.
  if (doc) {
    var bootRefresh = function () {
      init();
      var ticks = 0;
      var iv = global.setInterval(function () {
        ticks += 1;
        try { refresh(); } catch (_) {}
        if (ticks >= 20) global.clearInterval(iv); // ~10s @ 500ms
      }, 500);
    };
    if (doc.readyState === 'loading') {
      doc.addEventListener('DOMContentLoaded', bootRefresh);
    } else {
      bootRefresh();
    }
  }
})(typeof window !== 'undefined' ? window : this);
