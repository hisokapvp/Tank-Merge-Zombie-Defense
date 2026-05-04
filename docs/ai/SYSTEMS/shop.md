# Система: Yandex Chip-Bundle Shop

> Обновлено: 2026-05-04 (passport `solo-pipeline-yandex-vk`, batch #6 / item 18).
> Контракт магазина чипов на Yandex Games: data flow от SDK до runtime-выдачи и cloud-save.

## Где править

| Слой | Файл | Назначение |
| --- | --- | --- |
| Kill-switch / config | [src/config/shop.js](../../../src/config/shop.js#L1-L48) | `Game.Config.Shop` namespace + cascading kill-switch |
| Каталог (data-driven) | [assets/shop.json](../../../assets/shop.json) | 3 SKU bundles → `Game.Config.Shop.bundles` |
| Yandex Payments wrapper | [src/yandex/yandexPayments.js](../../../src/yandex/yandexPayments.js#L1-L220) | `Game.YandexPayments.{init,isReady,getCatalog,purchase,consumePurchase,getPurchases}` (signed:true) |
| Cloud-save adapter | [src/persistence/cloudSave.js](../../../src/persistence/cloudSave.js#L1-L250) | `Game.CloudSave.{init,isReady,pushShop,flushShop,pullShop}` через `player.setData/getData` (key `tmzd_shop_v1`) |
| Ledger | [src/shop/shopLedger.js](../../../src/shop/shopLedger.js#L1-L180) | `Game.ShopLedger.{recordPurchase,markDelivered,listUndelivered,exportEvent}` — write-through в `state.shop` |
| Atomic delivery | [src/shop/applyBundle.js](../../../src/shop/applyBundle.js#L1-L240) | `Game.ChipShop.applyBundle(bundle, {reason, purchaseToken})` — атомарная выдача chips+drones+dust + persist + cloudSave.pushShop |
| Modal UI | [src/ui/chipShopModal.js](../../../src/ui/chipShopModal.js#L1-L380) | `Game.ChipShop.UI.{init,open,close,refreshCatalog,setPurchaseInProgress}` (A11y, ModalAdapter) |
| HUD-кнопка корзины | [src/ui/hudShopButton.js](../../../src/ui/hudShopButton.js#L1-L120) | `Game.HudShopButton.{init,refresh}` — visibility gate `_isYandexEnv() && _shopEnabled() && payments.isReady()` |
| HTML shell | [index.html](../../../index.html) — блок `#chipShopOverlay` + script-tags после `chipShopModal.js`/`hudShopButton.js`/`shopBootstrap.js` |
| CSS | [style.css](../../../style.css#L9068-L9210) — блок `.chipShopModal__*` + `#hudShopButton.hudShopButton` |
| i18n | [src/i18n/ru.json](../../../src/i18n/ru.json#L773-L786) + [src/i18n/en.json](../../../src/i18n/en.json#L773-L786) — ключи `shop.*` |
| State default | [src/persistence/initialState.js](../../../src/persistence/initialState.js#L205-L220) — `state.shop = { entitlements, lastSync, pendingDeliveries }` |
| Save schema | [assets/saveSchema.json](../../../assets/saveSchema.json) — поле `shop` (backwards-compat в [tools/saveSchemaValidator.js](../../../tools/saveSchemaValidator.js)) |
| Bootstrap wiring | [src/core/shopBootstrap.js](../../../src/core/shopBootstrap.js#L1-L260) | `Game.ShopBootstrap.run()` — вызывается из [game.js](../../../game.js) `boot()` после fetch `assets/shop.json` |

## Data flow (purchase happy path)

```
Player click HUD-cart (#hudShopButton)
   → Game.ChipShop.UI.open()                       ; src/ui/chipShopModal.js
   → render каталог из Game.Config.Shop.bundles    ; цена → Game.YandexPayments.getCatalog() (live override)
Player click .chipShopModal__buy
   → Game.YandexPayments.purchase(productId)       ; signed:true
       SDK → Yandex host iframe, host signs purchase
       → resolves { purchaseToken, productID, signature, payload, ... }
   → Game.ShopLedger.recordPurchase({...})         ; idempotent по purchaseToken
   → Game.ChipShop.applyBundle(bundleDef, { reason, purchaseToken })
        ├─ chips:     HangarChipsUI.getPlayerChips() + push → setPlayerChips()
        ├─ drones:    Game.Drones.grantFromShop(state, spec)
        ├─ silicon:   HangarChipsUI.setSiliconDust(getSiliconDust() + N)
        ├─ ledger:    Game.ShopLedger.markDelivered(token) → state.shop.entitlements[token].deliveredAt = ts
        ├─ persist:   Game.Persistence.saveProgress() / window.saveProgress / Game.Storage.saveGame
        └─ cloudSave: Game.CloudSave.pushShop(state.shop) → throttled player.setData()
   → Game.YandexPayments.consumePurchase(purchaseToken)
       SDK → host marks purchase fulfilled, перестаёт возвращаться из getPurchases()
   → UI: thanks toast + refreshCatalog
```

## Boot replay (idempotent recovery)

После загрузки `assets/shop.json` `boot()` вызывает `Game.ShopBootstrap.run()` ([src/core/shopBootstrap.js](../../../src/core/shopBootstrap.js#L210-L290), вызов из [game.js#L17107-L17125](../../../game.js#L17107-L17125)):

1. `Game.YandexPayments.init()` — idempotent (initStarted guard).
2. `Game.CloudSave.init()` + `pullShop()` → merge cloud-side `state.shop` (защита от обнуления куков). Local `deliveredAt` всегда побеждает cloud, чтобы recovery loop не выдал бандл повторно.
3. `Game.YandexPayments.getPurchases()` — для каждой purchase, у которой `state.shop.entitlements[token].deliveredAt == null` (или entitlement отсутствует): `recordPurchase` → `applyBundle` (idempotent по token) → `consumePurchase`.
4. Defensive nudge: `Game.HudShopButton.init()/refresh()` + `Game.ChipShop.UI.init()`.

Все промисы fire-and-forget из `boot()`; ошибки (offline, network reject, SDK timeout) ловятся и логируются через `console.warn`/`console.debug`, ни одна не блокирует продолжение boot.

## state.shop (поля)

| Поле | Тип | Назначение |
| --- | --- | --- |
| `state.shop.entitlements` | `{ [purchaseToken: string]: { productId, grantedAt, deliveredAt|null, contentsSnapshot, signature } }` | Источник истины для «уже оплачено и (опционально) выдано». Idempotency key. |
| `state.shop.pendingDeliveries` | `string[]` | Очередь tokens, которые `recordPurchase` ещё не пометил `markDelivered`. Bootstrap replay вычитывает её. |
| `state.shop.pendingExports` | `Array<{ type, purchaseToken, productId, ts, payload? }>` | Аналитический seam `shopLedger.exportEvent` (только когда `Game.Config.Shop.ledgerExport.enabled === true`). |
| `state.shop.lastSync` | `number` (unix-ms) | Timestamp последнего успешного `CloudSave.pullShop`. |

State serializes через стандартный pipeline (storage.js / saveSchema.json), cloud-сторона — отдельный adapter `cloudSave.js` пишет ТОЛЬКО `state.shop` под ключом `tmzd_shop_v1` (host KV ≤ 200 KiB, throttle 1/5s).

## Kill-switches

| Флаг | Файл | Эффект при `false`/`disabled` |
| --- | --- | --- |
| `Game.Config.Shop.enabled` | [src/config/shop.js#L25](../../../src/config/shop.js#L25) | Каскадное выключение: `bundles[]` игнорируется, HUD-кнопка скрыта, `ShopBootstrap.run()` no-op, `ShopLedger.*` no-op, `applyBundle` возвращает `{ ok:false, status:'disabled' }`. |
| `Game.Config.Shop.cloudSave.enabled` | [src/config/shop.js#L30-L34](../../../src/config/shop.js#L30-L34) | `Game.CloudSave.*` целиком no-op (без сетевых вызовов). Локальный save продолжает работать. |
| `Game.Config.Shop.ledgerExport.enabled` | [src/config/shop.js#L35-L39](../../../src/config/shop.js#L35-L39) | `ShopLedger.exportEvent()` — silent no-op. Без записи в `pendingExports[]` и без `console.debug`. |
| `_isYandexEnv()` (host gate) | [src/yandex/yandexPayments.js#L41-L57](../../../src/yandex/yandexPayments.js#L41-L57), [src/persistence/cloudSave.js#L62-L80](../../../src/persistence/cloudSave.js#L62-L80) | Вне Yandex iframe (local dev, file://, VK build) wrappers возвращают benign empty values; HUD-кнопка скрыта; `ShopBootstrap` skip cloudSave/replay. |

Outside Yandex modal остаётся открываемой (DOM, A11y), но кнопка покупки disabled с подсказкой `shop.unavailableOutsideYandex`.

## Cross-references

- [docs/ai/SYSTEMS/yandex.md](./yandex.md) — SDK wrapper, build sanitiser allowlist, dev-URL discipline. Все пять Yandex-modules (`yandexSdk.js`, `yandexPayments.js`, `cloudSave.js`, `hudShopButton.js`, `shopBootstrap.js`) подчиняются substring-fragment контракту: никаких dev/CDN host literals в shipped first-party source.
- [docs/ai/SYSTEMS/save.md](./save.md) — payload contract map; поле `shop` добавлено в `serializeState()` через `state.shop` namespace и зеркалится в `assets/saveSchema.json`. Cloud-side хранит ТОЛЬКО `state.shop`, не пересекаясь со slot-based `localStorage` save.
- [ci/build_release.mjs](../../../ci/build_release.mjs) — `node ci/build_release.mjs --yandex --dry-run` (флаг добавлен в batch #6 / item 17) гоняет sanitiser → `assertNoDevUrlLiterals` → cleanup tmpdir. Любой новый module shop-семейства должен пройти этот guard перед коммитом.

## Как добавить новый SKU (короткая версия)

> Расширенный playbook → `docs/ai/PLAYBOOKS/shop-add-bundle.md` (item 19, batch #7).

1. Добавить запись в [assets/shop.json](../../../assets/shop.json) `bundles[]` с обязательными полями: `id`, `yandexProductId`, `tier`, `priceHint{currency, amount}`, `contents{ chips[], drones[], siliconDust }`, `sortOrder`, `iconAsset`. Schema контракт — см. `_comment` в начале файла.
2. Добавить i18n ключи `shop.bundle<NewName>.name` / `shop.bundle<NewName>.desc` в `src/i18n/ru.json` и `src/i18n/en.json` одновременно (правило проекта: ru/en sync). Убедиться, что fallback есть в `src/i18n/fallbackStrings.js`, если ключ должен пережить отсутствие i18n.
3. Зарегистрировать `productId` в Yandex Games консоли разработчика (Игра → Покупки → Создать товар; `productId` = `yandexProductId` из шага 1; цена из `priceHint`).
4. Если бандл содержит новый тип контента (например, новые чипы, дроны новой схемы), убедиться, что соответствующий grant-helper уже есть: `HangarChipsUI.{getPlayerChips,setPlayerChips,getSiliconDust,setSiliconDust}` для chips/dust, `Game.Drones.grantFromShop(state, spec)` для дронов. Кастомные типы → расширять `applyBundle._grant*` локально.
5. Прогнать sanitiser: `bash ci/check_style.sh && node ci/build_release.mjs --yandex --dry-run`.
6. Sandbox smoke на стороне Yandex Games (item 24): cookies cleared → cloud restore → entitlement виден → `applyBundle` повторно идемпотентен.

## Failure modes / observability

| Симптом | Вероятная причина | Где смотреть |
| --- | --- | --- |
| HUD-кнопка не появилась в host iframe | `Game.YandexPayments.isReady()` ещё false; refresh-tick 500ms × 20 (~10s) | [src/ui/hudShopButton.js#L100-L120](../../../src/ui/hudShopButton.js#L100-L120) |
| После очистки cookies entitlements пропали | `cloudSave.pullShop()` не сработал (offline/`scopes:false` reject) | [src/persistence/cloudSave.js#L210-L235](../../../src/persistence/cloudSave.js#L210-L235) — `pullShop` resolves `null` молча |
| Бандл выдан дважды | `markDelivered` не пометил entitlement (state.shop пуст / kill-switch выкл) | [src/shop/applyBundle.js#L160-L185](../../../src/shop/applyBundle.js#L160-L185) — idempotency gate `existing.deliveredAt` |
| Покупка ушла в Yandex но чипы не пришли | `applyBundle` упал на одном из granters; entitlement зафиксирован но `deliveredAt == null` | bootstrap replay при следующем boot вычистит через `getPurchases() → applyBundle()` |
| Sanitiser ругается на новый SKU | host-literal попал в комментарий/строку | расширить `YANDEX_REJECT_PATTERNS` или переписать в substring-fragments (см. [docs/ai/SYSTEMS/yandex.md](./yandex.md)) |

## Verification checklist (минимум перед коммитом)

- `bash ci/check_style.sh` → `Style check passed.`
- `node ci/build_release.mjs --yandex --dry-run` → `[YANDEX] guard passed`, exit 0
- `node Test/tests.js` baseline сохранён (3 pre-existing failures: T4-8, T4-12, T5-3)
- `node Test/test_shop_apply_bundle.js` (включён в `ci/run_tests.sh`) → `10 passed, 0 failed` — покрывает идемпотентность `applyBundle`, форматы `state.playerChips` / drone-records и HUD visibility-gate
- Локально вне Yandex iframe: HUD-кнопка скрыта, `Game.ChipShop.UI.open()` показывает modal с `shop.unavailableOutsideYandex` disabled-state
- Canonical i18n key для footer-disclaimer — `shop.legal.disclaimer` (см. [index.html#L507](../../../index.html#L507), [src/i18n/ru.json#L786](../../../src/i18n/ru.json#L786), [src/i18n/en.json#L786](../../../src/i18n/en.json#L786))
