# Yandex SDK / Build Sanitiser Allowlist

`solo-pipeline-yandex-vk` batch#3 (item 11). Documents the contract between
`src/yandex/yandexSdk.js` and the build-time URL/host sanitiser in
`ci/build_release.mjs`. Read this before touching either file or before adding
any link, dev URL, or local path that ends up in shipped sources.

## Two-layer defense

The release build aims to ship zero dev-host literals, zero loopback addresses,
zero local file paths, and zero source-map references. Defense is layered:

1. **Source-level discipline (primary).** JSDoc and inline comments in the
   real game source must avoid concrete dev/CDN host literals. Use neutral
   phrases such as `[redacted Yandex iframe host]`, `the Yandex Games iframe
   host`, or `the Yandex Games portal host`. See
   `src/yandex/yandexSdk.js` for the canonical example after batch#3 item 10.
2. **Build sanitiser (defense-in-depth).** `ci/build_release.mjs` runs three
   passes over every file in the release zip: full-string-literal split,
   comment scrubbing (`.js` / `.css` / `.html`), and free-text scrubbing
   (`.json` / `.md`). After all passes a final assertion via
   `assertNoDevUrlLiterals` aborts the build if any tracked token still
   appears anywhere in the output tree.

Adding a fresh comment with `app-*.games.s3.yandex.net` and "trusting the
sanitiser" is no longer the supported path. Do the source-level edit first;
treat a sanitiser hit on review as a regression, not a feature.

## Tokens the sanitiser removes (rejected)

The canonical list lives in two places in `ci/build_release.mjs`:

* `COMMENT_REJECT_RE` — matched against `.js` / `.css` / `.html` comments and
  free-text in `.json` / `.md`. Each match is rewritten in place to
  `[redacted]`.
* `YANDEX_REJECT_PATTERNS` — final assertion guard. Any match here is a hard
  build error.

Both regex sets must stay in sync with this list. If you add or change a
pattern, update this section and link the diff in the PR description.

| Category | Tokens | Replacement / behaviour |
| --- | --- | --- |
| Local schemes | `file://`, `capacitor://` | `[redacted]` (comments) / build error (sources) |
| Loopback hosts | `localhost`, `127.0.0.1`, `0.0.0.0`, `::1` | `[redacted]` |
| Yandex CDN hosts | `s3.yandex.net`, `app-*.games.s3.yandex.net`, `games.s3.yandex.net` | `[redacted]` |
| Yandex storage | `yandex-storage`, `storage.yandexcloud*`, `.yandexcloud.*` | `[redacted]` |
| Yandex static CDN | `yastatic*` | `[redacted]` |
| Local user paths | `[A-Z]:\Users\` (Windows user paths) | build error |
| Agent infrastructure | `agent-logs`, `.agents\` | build error |
| Internal dashboard | `:87[6-9][0-9]`, `:88[6-9][0-9]` (port range) | build error |
| Source maps | `//# sourceMappingURL=` (any line) | build error |
| Internal placeholder | `tank-merge-zombie-defense.local` | rewritten to `redacted.invalid` |

`COMMENT_REJECT_RE` is forgiving (rewrites silently, build keeps going).
`YANDEX_REJECT_PATTERNS` is strict (any survivor aborts the release). When in
doubt, run `bash ci/build_release.sh` and read the assertion message — it
prints the offending file and the matched substring.

## Tokens that must remain untouched (allowlist)

Some external URL-shaped strings are legitimate and must not be redacted.
The sanitiser explicitly preserves the following:

* **W3C XML namespaces.** Anything matching `http://www.w3.org/...` (e.g.
  `http://www.w3.org/2000/svg`, `http://www.w3.org/1999/xlink`). These are
  XML namespace identifiers, not URLs to fetch. Stripping them breaks SVG
  rendering across every browser.
* **Relative asset paths.** Strings like `assets/...`, `assets/balance/...`,
  `assets/ui/...` are runtime asset references the game loads via
  `AssetLoader`. They have no scheme and no host; the regex set above does
  not target them.
* **Open-source licence URLs.** MIT / Apache / BSD / similar licence URLs in
  `LICENSE`, vendored library headers, or third-party comment blocks. These
  are documentation, not exfiltration risks.
* **Anything under `vendor/`.** The `vendor/**` directory is treated as a
  pre-vendored, externally-licensed corpus and is **not** scrubbed. Add new
  third-party libraries there if they happen to ship their own dev URLs in
  comments — do not paste them into our own `src/`.
* **Explicit allow markers.** Lines containing the marker
  `// yandex-bundle-allow:` are skipped by the comment scrubber. Use this
  sparingly and only for short-lived diagnostics that must survive into a
  build (e.g. an integration test fixture). Production code should never
  rely on this marker.

If a regex change in the sanitiser would catch any of the above by
accident, the change is wrong; tighten the regex (anchor on `.s3.yandex.net`
boundary, exclude `www.w3.org`, etc.) instead of widening the allowlist.

## Quick checklist before merging changes near these files

* Did you add a new dev/CDN host literal in source? Move it out of
  comments; if it is needed at runtime, expose it as a substring fragment as
  done in `_isYandexEnv()`.
* Did you add a new external URL? Confirm whether it is a W3C namespace, a
  licence URL, or a real fetch target. If the latter, it almost certainly
  does not belong in the shipped game.
* Did you change `COMMENT_REJECT_RE` or `YANDEX_REJECT_PATTERNS`? Update
  the table in this file and reference it in the PR.
* Did you `bash ci/build_release.sh` after your edit? The final assertion
  is the source of truth — never bypass it locally.

## Shop wrapper modules (`solo-pipeline-yandex-vk` batches #2–#3, item 20 batch #7)

Поверх базового `src/yandex/yandexSdk.js` shop-семейство добавило два первоклассных wrapper-модуля. Оба подчиняются тем же substring-fragment / sanitiser-allowlist правилам, что и `yandexSdk.js`. Полный контракт магазина — [docs/ai/SYSTEMS/shop.md](./shop.md); как добавить SKU — [docs/ai/PLAYBOOKS/shop-add-bundle.md](../PLAYBOOKS/shop-add-bundle.md); save-side payload — [docs/ai/SYSTEMS/save.md](./save.md).

### `src/yandex/yandexPayments.js` — Yandex Payments wrapper

- Public API: `Game.YandexPayments.{ init, isReady, getCatalog, purchase, consumePurchase, getPurchases }`.
- `init()` идемпотентен (`initStarted` guard) и резолвится после `getPayments({ signed: true })`. Это ключевой контракт: **payments-объект всегда запрашивается с `signed: true`**, чтобы каждая `purchase()` возвращала host-подписанный `signature/payload` для последующей серверной верификации (через `Game.ShopLedger.exportEvent` seam, [src/shop/shopLedger.js](../../../src/shop/shopLedger.js)).
- `getCatalog()` — фильтрует по `productID` из `assets/shop.json.bundles[].yandexProductId`; используется и в UI карточках ([src/ui/chipShopModal.js](../../../src/ui/chipShopModal.js)), и в bootstrap replay для resolve `bundleByProductId(purchase.productID)`.
- `purchase(productId)` — wrapper над host `payments.purchase({ id })`; возвращает `{ purchaseToken, productID, signature, payload, ... }`. Token идёт прямиком в `state.shop.entitlements` как idempotency-ключ ([docs/ai/SYSTEMS/save.md#shop-state-shop-payload-block](./save.md)).
- `getPurchases()` — список не-consumed покупок; источник истины для bootstrap replay вместе с `state.shop.pendingDeliveries` (union-контракт, см. [playbook](../PLAYBOOKS/shop-add-bundle.md#union-replay-контракт-getpurchases--stateshoppendingdeliveries)).
- `consumePurchase(token)` — обязательно вызывается после успешного `applyBundle`; без consume host будет возвращать ту же покупку из `getPurchases()` бесконечно (и replay будет повторно тратить CPU, хотя idempotency `deliveredAt` защитит от дубль-выдачи).
- Outside Yandex (`_isYandexEnv() === false`): все методы возвращают benign empty values (`getCatalog → []`, `getPurchases → []`, `purchase → reject`), `isReady → false`. UI это учитывает: HUD-кнопка скрыта, кнопка `Купить` дисейблится в карточке.

### `src/persistence/cloudSave.js` — Cloud-save adapter

- Public API: `Game.CloudSave.{ init, isReady, pushShop, flushShop, pullShop }`.
- Backing store: Yandex `player.setData/getData` под единственным ключом `tmzd_shop_v1`. Cloud KV пишет **только** `state.shop`, не пересекаясь со slot-based `localStorage` save (slot save остаётся 100% локальным и не уходит в cloud).
- Throttle: `pushShop` debounce ≤ 1 запрос / 5s; `flushShop` форсированно (используется при close/visibility-hidden).
- Pull merge policy — «cloud wins for entitlements only» (см. [docs/ai/SYSTEMS/save.md#cloud-save-policy-cloud-wins-for-entitlements-only](./save.md)). Локальный `deliveredAt` всегда побеждает cloud, чтобы recovery loop не выдал бандл повторно.
- Kill-switch: `Game.Config.Shop.cloudSave.enabled = false` ([src/config/shop.js#L30-L34](../../../src/config/shop.js#L30-L34)) → весь модуль no-op без сетевых вызовов; `state.shop` живёт только локально.
- Outside Yandex (`_isYandexEnv() === false`): `init` ставит `isReady → false`, остальные методы — no-op (фактически зеркалят kill-switch путь).

### Sanitiser substring-fragment контракт для shop-модулей

Оба новых модуля (`yandexPayments.js`, `cloudSave.js`), плюс `hudShopButton.js` / `chipShopModal.js` / `shopBootstrap.js`, подчиняются тому же contract'у, что и `yandexSdk.js`:

- Никаких host-литералов (`s3.yandex.net`, `app-*.games.s3.yandex.net`, `yastatic*` и т.п.) в комментариях или JSDoc — используем нейтральные фразы `[redacted Yandex iframe host]` / `the Yandex Games iframe host`.
- Если host-фрагмент нужен в runtime (например, для `_isYandexEnv()` host-detection), он экспонируется как substring-fragment — три-четыре отдельных подстроки, склеиваемых на runtime, а не один literal. См. `_isYandexEnv()` в [src/yandex/yandexPayments.js](../../../src/yandex/yandexPayments.js) и [src/persistence/cloudSave.js](../../../src/persistence/cloudSave.js) — оба используют тот же шаблон, что и `yandexSdk.js` ещё с batch #1.
- Перед коммитом обязательно `node ci/build_release.mjs --yandex --dry-run` — flag `--dry-run` добавлен в batch #6 / item 17, чистит tmpdir после успеха.

### Sandbox smoke pointer

Полная процедура sandbox smoke для новых SKU и любых изменений в shop wrapper'ах — в [docs/ai/PLAYBOOKS/shop-add-bundle.md#шаг-6-sandbox-smoke-yandex-games](../PLAYBOOKS/shop-add-bundle.md). User-facing сводка для команды релиза/маркетинга — в [docs/SHOP_GUIDE_RU.md](../../SHOP_GUIDE_RU.md).

