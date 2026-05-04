(function (global) {
  'use strict';

  // ────────────────────────────────────────────────────────────────────────
  // Yandex Games Chip-Bundle Shop — kill-switch & runtime config
  // (solo-pipeline-yandex-vk batch #1 / Phase 1, items 1+3)
  //
  // Runtime selection: shop активен только если `_isYandexEnv()` И
  // `Game.Config.Shop.enabled`. Top-level `enabled` каскадно гасит:
  //   • массив `bundles[]` (шоп считается пустым → модалка скрывает каталог);
  //   • HUD-кнопку «корзина» (Phase 5 batch / hudShopButton.js);
  //   • весь wiring в bootstrap.js (Phase 6 batch): YandexPayments.init,
  //     CloudSave.pullShop, getPurchases→applyBundle→consumePurchase loop.
  //
  // `bundles[]` здесь — пустой плейсхолдер. Боевой каталог приходит из
  // `assets/shop.json` через `boot()` в game.js (см. fetch-блок рядом с
  // `assets/levelreward.json`). Это держит конфигурационный namespace
  // отдельно от data-driven SKU и даёт контрактную точку kill-switch
  // ещё до того, как Yandex SDK / fetch завершились.
  //
  // Hot-path safety: модуль исполняется один раз при загрузке скриптов
  // (IIFE), без аллокаций в loop()/draw(). Никаких сайд-эффектов кроме
  // публикации `Game.Config.Shop`.
  // ────────────────────────────────────────────────────────────────────────

  var enabled = true;

  var cfg = {
    enabled: enabled,
    // Debug-toggle для тестирования вне Yandex iframe (batch #9 rework).
    // По умолчанию false — production safety: реальный Yandex flow всегда
    // приоритетнее. Если игра запущена в Yandex iframe (`_isYandexEnv()`
    // === true), флаг игнорируется — debug fallback не активируется.
    // Включается из консоли:
    //   Game.Config.Shop.debugForceEnable = true;
    //   Game.ChipShop.UI.init(); Game.HudShopButton.refresh();
    // В debug-режиме:
    //   • HUD-кнопка показывается, модалка открывается;
    //   • кнопка «Купить» симулирует покупку через Game.ChipShop.applyBundle
    //     с purchaseToken вида `DEBUG-<bundleId>-<ts>` (идемпотентность
    //     сохраняется);
    //   • payments.getCatalog() возвращает priceHint-значения из bundles[];
    //   • cloudSave.* остаётся silent no-op (debug-режим без облака).
    debugForceEnable: true,
    cloudSave: {
      // Yandex player.setData / player.getData adapter (Phase 3 batch).
      // false → cloud-save выключен, локальный save работает как обычно.
      enabled: true,
    },
    ledgerExport: {
      // Аналитический seam shopLedger.exportEvent (Phase 3 batch).
      // false → события чек-аута только в локальный ledger (без отправки).
      enabled: false,
    },
    // Боевой каталог бандлов. Заполняется из `assets/shop.json` в boot().
    // До успешного fetch массив остаётся пустым, что эквивалентно
    // выключенному магазину для UI-слоя.
    bundles: [],
  };

  global.Game = global.Game || {};
  global.Game.Config = global.Game.Config || {};
  global.Game.Config.Shop = cfg;
})(typeof window !== 'undefined' ? window : this);
