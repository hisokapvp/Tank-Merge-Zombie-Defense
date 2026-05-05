/**
 * src/ui/chipShopModal.js — DOM/UI shell for the Yandex chip-bundle shop
 * (item 12 — solo-pipeline-yandex-vk batch#4 / Phase 4).
 *
 * Public surface (`Game.ChipShop.UI`):
 *   init()                            — cache DOM, wire close, register
 *                                       with A11y + ModalAdapter.
 *   open()                            — refreshCatalog + reveal modal +
 *                                       A11y.openModal.
 *   close()                           — hide + A11y.closeModal.
 *   refreshCatalog()                  — repaint cards from
 *                                       Game.Config.Shop.bundles, with
 *                                       priceHint fallback if Yandex
 *                                       catalog is unavailable.
 *   setPurchaseInProgress(id, bool)   — toggle disabled/loading state on
 *                                       one product's button.
 *
 * Modal stack: registers via Game.A11y.registerModal/openModal/closeModal
 * (canon `src/accessibility/a11y.js#L77-L117`) and via
 * `Game.ModalAdapter.registerModal('chipShop', el, { hiddenClass:'hidden' })`.
 *
 * Purchase flow:
 *   1. setPurchaseInProgress(id, true)
 *   2. Game.YandexPayments.purchase(productId)
 *   3. on success: Game.ShopLedger.recordPurchase(...)
 *                 → Game.ChipShop.applyBundle(bundleDef, {reason, purchaseToken})
 *                 → toast «Спасибо за покупку»
 *                 → Game.YandexPayments.consumePurchase(token)
 *   4. setPurchaseInProgress(id, false)
 *
 * Outside the Yandex iframe the buy buttons are disabled and carry a
 * tooltip explaining that purchases are only available there.
 *
 * Hot-path safety: DOM build runs only on init / refreshCatalog, never
 * inside the render loop. Catalog Promise is fired-and-forgotten via a
 * tiny stale-token guard so a slow getCatalog() does not overwrite a
 * later open() repaint.
 */
(function (global) {
  'use strict';

  var doc = global.document || null;

  // Fallback i18n strings live here so the modal stays usable even
  // before Phase 5 wires up shop.* keys in ru.json/en.json. When the
  // i18n layer is available it is allowed to override these via
  // data-i18n attributes (already attached to title/footer in the HTML
  // shell).
  var FALLBACK_RU = {
    'shop.title': 'Магазин чипов',
    'shop.disclaimer': 'Покупки доступны только в Яндекс Играх. Цены и валюта определяются регионом.',
    'shop.thanks': 'Спасибо за покупку',
    'shop.error': 'Ошибка покупки',
    'shop.unavailable_hint': 'Доступно только в Яндекс Играх',
    'shop.buy': 'Купить',
    'shop.loading': 'Покупка…',
    'shop.reward.chips': 'Чипы',
    'shop.reward.drones': 'Дроны',
    'shop.reward.siliconDust': 'Кремниевая пыль',
  };

  function _t(key) {
    var i18n = global.Game && global.Game.I18n;
    if (i18n && typeof i18n.t === 'function') {
      var v = i18n.t(key);
      if (v && v !== key) return v;
    }
    return FALLBACK_RU[key] || key;
  }

  function _shopCfg() {
    var cfg = global.Game && global.Game.Config && global.Game.Config.Shop;
    return cfg && cfg.enabled !== false ? cfg : null;
  }

  function _bundles() {
    var cfg = _shopCfg();
    return (cfg && Array.isArray(cfg.bundles)) ? cfg.bundles : [];
  }

  function _payments() { return (global.Game && global.Game.YandexPayments) || null; }
  function _ledger() { return (global.Game && global.Game.ShopLedger) || null; }
  function _apply() { return (global.Game && global.Game.ChipShop && global.Game.ChipShop.applyBundle) || null; }
  function _toast() { return (global.Game && global.Game.Toast) || null; }
  function _a11y() { return (global.Game && global.Game.A11y) || null; }
  function _adapter() { return (global.Game && global.Game.ModalAdapter) || null; }

  // Debug-toggle (batch #9 rework). Обходит Yandex SDK для локального
  // тестирования. Реальный Yandex flow всегда приоритетнее — флаг
  // игнорируется внутри Yandex iframe.
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

  function _debugForceEnabled() {
    if (_isYandexEnv()) return false;
    var cfg = global.Game && global.Game.Config && global.Game.Config.Shop;
    return !!(cfg && cfg.debugForceEnable === true);
  }

  // Emoji-fallback для иконок бандлов, если iconAsset отсутствует или
  // вернул 404 (batch #9 rework, item B).
  var BUNDLE_TIER_EMOJI = { small: '\uD83D\uDED2', medium: '\uD83D\uDC8E', large: '\uD83D\uDC8E', '': '\uD83D\uDED2' };
  function _bundleEmoji(bundle) {
    var t = (bundle && typeof bundle.tier === 'string') ? bundle.tier.toLowerCase() : '';
    return BUNDLE_TIER_EMOJI[t] || BUNDLE_TIER_EMOJI[''];
  }

  // ──────────────────────────────────────────────────────────────────
  // Internal DOM / state
  // ──────────────────────────────────────────────────────────────────

  var _initialized = false;
  var _registered = false;
  var _root = null;
  var _panel = null;
  var _cards = null;
  var _closeBtn = null;
  var _backdrop = null;
  var _refreshToken = 0;

  function _isOpen() {
    return !!(_root && !_root.classList.contains('hidden'));
  }

  function _formatPriceHint(hint) {
    if (!hint || typeof hint !== 'object') return '';
    var amount = Number(hint.amount);
    if (!Number.isFinite(amount)) return '';
    // priceHint.amount is in kopecks (1/100 of a rouble) per the SKU
    // schema used in assets/shop.json. Live catalog prices arrive as
    // pre-formatted strings from Yandex SDK and bypass this helper.
    var rub = (amount / 100).toFixed(0);
    var cur = typeof hint.currency === 'string' ? hint.currency : 'RUB';
    if (cur === 'RUB') return rub + ' ₽';
    return rub + ' ' + cur;
  }

  function _bundleDescription(bundle) {
    var contents = bundle && bundle.contents;
    if (!contents) return '';
    var parts = [];
    if (Array.isArray(contents.chips)) {
      var chipsTotal = 0;
      for (var i = 0; i < contents.chips.length; i++) {
        var c = contents.chips[i] || {};
        chipsTotal += (c.count | 0);
      }
      if (chipsTotal > 0) parts.push(_t('shop.reward.chips') + ' × ' + chipsTotal);
    }
    if (Array.isArray(contents.drones)) {
      var dronesTotal = 0;
      for (var k = 0; k < contents.drones.length; k++) {
        var d = contents.drones[k] || {};
        dronesTotal += (d.count | 0);
      }
      if (dronesTotal > 0) parts.push(_t('shop.reward.drones') + ' × ' + dronesTotal);
    }
    var dust = contents.siliconDust | 0;
    if (dust > 0) parts.push(_t('shop.reward.siliconDust') + ' × ' + dust);
    return parts.join(' · ');
  }

  function _buildCard(bundle, livePriceText, paymentsReady) {
    var card = doc.createElement('div');
    card.className = 'chipShopCard';
    card.setAttribute('role', 'listitem');
    card.dataset.productId = bundle.yandexProductId || '';
    card.dataset.bundleId = bundle.id || '';

    if (bundle.iconAsset) {
      var icon = doc.createElement('img');
      icon.className = 'chipShopCard__icon';
      icon.alt = '';
      icon.src = bundle.iconAsset;
      // 404 / network error → грациозный fallback на emoji-иконку.
      icon.addEventListener('error', function () {
        try {
          var span = doc.createElement('span');
          span.className = 'chipShopCard__icon chipShopCard__icon--emoji';
          span.setAttribute('aria-hidden', 'true');
          span.textContent = _bundleEmoji(bundle);
          if (icon.parentNode) icon.parentNode.replaceChild(span, icon);
        } catch (_) {}
      });
      card.appendChild(icon);
    } else {
      // iconAsset пуст → рисуем emoji-fallback сразу.
      var emojiSpan = doc.createElement('span');
      emojiSpan.className = 'chipShopCard__icon chipShopCard__icon--emoji';
      emojiSpan.setAttribute('aria-hidden', 'true');
      emojiSpan.textContent = _bundleEmoji(bundle);
      card.appendChild(emojiSpan);
    }

    var name = doc.createElement('div');
    name.className = 'chipShopCard__name';
    name.setAttribute('data-i18n', 'shop.bundle.' + (bundle.id || '') + '.name');
    name.textContent = bundle.displayName || bundle.id || '';
    card.appendChild(name);

    var desc = doc.createElement('div');
    desc.className = 'chipShopCard__desc';
    desc.textContent = _bundleDescription(bundle);
    card.appendChild(desc);

    var price = doc.createElement('div');
    price.className = 'chipShopCard__price';
    price.textContent = livePriceText || _formatPriceHint(bundle.priceHint);
    card.appendChild(price);

    var buy = doc.createElement('button');
    buy.type = 'button';
    buy.className = 'btn btnPrimary chipShopCard__buyBtn';
    buy.textContent = _t('shop.buy');
    buy.dataset.productId = bundle.yandexProductId || '';
    buy.dataset.state = 'idle';
    if (!paymentsReady) {
      buy.disabled = true;
      buy.title = _t('shop.unavailable_hint');
    }
    buy.addEventListener('click', _onBuyClick);
    card.appendChild(buy);

    return card;
  }

  function _onBuyClick(ev) {
    var btn = ev && ev.currentTarget;
    if (!btn || btn.disabled) return;
    var productId = btn.dataset && btn.dataset.productId;
    if (!productId) return;
    var bundles = _bundles();
    var bundleDef = null;
    for (var i = 0; i < bundles.length; i++) {
      if (bundles[i] && bundles[i].yandexProductId === productId) { bundleDef = bundles[i]; break; }
    }
    if (!bundleDef) return;

    // Debug-обход SDK (batch #9 rework, item A): кнопка «Купить» вне
    // Yandex iframe вызывает applyBundle напрямую с синтетическим
    // purchaseToken. Идемпотентность сохраняется вынесением ts в токен.
    // cloudSave остаётся silent no-op (флаг cloudSave жестко гейтит
    // по _isYandexEnv() — это ожидаемый invariant реворк-контракта).
    if (_debugForceEnabled()) {
      var debugToken = 'DEBUG-' + (bundleDef.id || productId) + '-' + Date.now();
      setPurchaseInProgress(productId, true);
      try {
        var ledgerD = _ledger();
        if (ledgerD && typeof ledgerD.recordPurchase === 'function') {
          try {
            ledgerD.recordPurchase({
              productId: productId,
              purchaseToken: debugToken,
              signature: '',
              payload: bundleDef.contents || null,
            });
          } catch (_) {}
        }
        var applyD = _apply();
        if (applyD) {
          try {
            applyD(bundleDef, { reason: 'shop_debug', purchaseToken: debugToken });
          } catch (_) {}
        }
        var toastD = _toast();
        if (toastD && typeof toastD.show === 'function') {
          try { toastD.show(_t('shop.thanks'), 2400); } catch (_) {}
        }
      } finally {
        setPurchaseInProgress(productId, false);
      }
      return;
    }

    var pay = _payments();
    if (!pay || typeof pay.purchase !== 'function') return;

    setPurchaseInProgress(productId, true);

    pay.purchase(productId).then(function (result) {
      var token = (result && result.purchaseToken) || '';
      var signature = (result && result.signature) || '';
      if (!token) {
        throw new Error('purchase: missing purchaseToken');
      }
      var ledger = _ledger();
      if (ledger && typeof ledger.recordPurchase === 'function') {
        try {
          ledger.recordPurchase({
            productId: productId,
            purchaseToken: token,
            signature: signature,
            payload: bundleDef.contents || null,
          });
        } catch (_) {}
      }
      var apply = _apply();
      if (apply) {
        try {
          apply(bundleDef, { reason: 'shop_purchase', purchaseToken: token });
        } catch (_) {}
      }
      var toast = _toast();
      if (toast && typeof toast.show === 'function') {
        try { toast.show(_t('shop.thanks'), 2400); } catch (_) {}
      }
      if (typeof pay.consumePurchase === 'function') {
        try { pay.consumePurchase(token); } catch (_) {}
      }
    }).catch(function () {
      var toast = _toast();
      if (toast && typeof toast.show === 'function') {
        try { toast.show(_t('shop.error'), 2400); } catch (_) {}
      }
    }).then(function () {
      setPurchaseInProgress(productId, false);
    });
  }

  // ──────────────────────────────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────────────────────────────

  function init() {
    if (_initialized || !doc) return;
    _root = doc.getElementById('chipShopOverlay');
    if (!_root) return;
    _panel = _root.querySelector('.levelModal__panel');
    _cards = doc.getElementById('chipShopCards');
    _closeBtn = doc.getElementById('chipShopClose');
    _backdrop = _root.querySelector('[data-chip-shop-close="true"]');

    if (_closeBtn) _closeBtn.addEventListener('click', close);
    if (_backdrop) _backdrop.addEventListener('click', close);

    var a11y = _a11y();
    if (a11y && typeof a11y.registerModal === 'function') {
      try { a11y.registerModal(_root, { onClose: close }); } catch (_) {}
    }
    var adapter = _adapter();
    if (adapter && typeof adapter.registerModal === 'function' && !_registered) {
      try {
        adapter.registerModal('chipShop', _root, { hiddenClass: 'hidden' });
        _registered = true;
      } catch (_) {}
    }

    _initialized = true;
  }

  function open() {
    if (!_initialized) init();
    if (!_root) return;
    refreshCatalog();
    _root.classList.remove('hidden');
    _root.setAttribute('aria-hidden', 'false');
    // batch#10-rework items B+C: pause game and enable grain overlay,
    // mirroring the supercomputer-menu open contract.
    try { document.body.classList.add('chipshop-open'); } catch (_) {}
    try {
      if (global.Game && typeof global.Game._setShopPauseLock === 'function') {
        global.Game._setShopPauseLock(true);
      }
    } catch (_) {}
    var a11y = _a11y();
    if (a11y && typeof a11y.openModal === 'function') {
      try { a11y.openModal(_root, { onClose: close }); } catch (_) {}
    }
  }

  function close() {
    if (!_root) return;
    _root.classList.add('hidden');
    _root.setAttribute('aria-hidden', 'true');
    // batch#10-rework items B+C: symmetric release on close.
    try { document.body.classList.remove('chipshop-open'); } catch (_) {}
    try {
      if (global.Game && typeof global.Game._setShopPauseLock === 'function') {
        global.Game._setShopPauseLock(false);
      }
    } catch (_) {}
    var a11y = _a11y();
    if (a11y && typeof a11y.closeModal === 'function') {
      try { a11y.closeModal(_root); } catch (_) {}
    }
  }

  function _renderCards(bundles, livePriceById, paymentsReady) {
    if (!_cards) return;
    while (_cards.firstChild) _cards.removeChild(_cards.firstChild);
    for (var i = 0; i < bundles.length; i++) {
      var b = bundles[i];
      if (!b || typeof b !== 'object') continue;
      var live = livePriceById && b.yandexProductId ? livePriceById[b.yandexProductId] : '';
      _cards.appendChild(_buildCard(b, live, paymentsReady));
    }
  }

  function refreshCatalog() {
    if (!_initialized) init();
    if (!_cards) return;
    var bundles = _bundles();
    var pay = _payments();
    var paymentsReady = !!(pay && typeof pay.isReady === 'function' && pay.isReady());

    // Render synchronously with priceHint so the modal is usable
    // immediately. If a live catalog comes back in time and we're still
    // showing the same generation, repaint with live prices.
    _renderCards(bundles, null, paymentsReady);

    if (!pay || typeof pay.getCatalog !== 'function') return;
    var token = ++_refreshToken;
    try {
      pay.getCatalog().then(function (list) {
        if (token !== _refreshToken) return;       // newer refresh wins
        if (!_isOpen()) return;
        if (!Array.isArray(list) || !list.length) return;
        var byId = {};
        for (var i = 0; i < list.length; i++) {
          var entry = list[i] || {};
          if (entry.id) byId[entry.id] = entry.priceValue || entry.price || '';
        }
        _renderCards(bundles, byId, paymentsReady);
      }).catch(function () {});
    } catch (_) {}
  }

  function setPurchaseInProgress(productId, busy) {
    if (!_cards || !productId) return;
    var btn = _cards.querySelector('button.chipShopCard__buyBtn[data-product-id="' + productId + '"]');
    if (!btn) return;
    if (busy) {
      btn.dataset.state = 'loading';
      btn.disabled = true;
      btn.textContent = _t('shop.loading');
    } else {
      btn.dataset.state = 'idle';
      var pay = _payments();
      var paymentsReady = !!(pay && typeof pay.isReady === 'function' && pay.isReady());
      btn.disabled = !paymentsReady;
      btn.textContent = _t('shop.buy');
      if (!paymentsReady) btn.title = _t('shop.unavailable_hint');
    }
  }

  global.Game = global.Game || {};
  global.Game.ChipShop = global.Game.ChipShop || {};
  global.Game.ChipShop.UI = {
    init: init,
    open: open,
    close: close,
    refreshCatalog: refreshCatalog,
    setPurchaseInProgress: setPurchaseInProgress,
  };

  // Auto-init on DOM ready so external callers can rely on Game.ChipShop.UI
  // being functional after the script tag executes (the modal stays
  // hidden until open() is called).
  if (doc) {
    if (doc.readyState === 'loading') {
      doc.addEventListener('DOMContentLoaded', function () { init(); });
    } else {
      init();
    }
  }
})(typeof window !== 'undefined' ? window : this);
