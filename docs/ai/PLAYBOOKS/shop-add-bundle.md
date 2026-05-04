# Playbook: добавить новый бандл в Yandex Chip-Bundle Shop

> Обновлено: 2026-05-04 (passport `solo-pipeline-yandex-vk`, batch #7 / item 19).
> Целевая аудитория: маркетинг / гейм-дизайн / engineer-on-duty.
> Связанные системные доки: [docs/ai/SYSTEMS/shop.md](../SYSTEMS/shop.md), [docs/ai/SYSTEMS/yandex.md](../SYSTEMS/yandex.md), [docs/ai/SYSTEMS/save.md](../SYSTEMS/save.md).
> User-facing мануал на русском: [docs/SHOP_GUIDE_RU.md](../../SHOP_GUIDE_RU.md).

## Когда использовать

- Появился новый SKU чип-бандла (commercial decision).
- Нужно сменить состав / цену / тип контента уже существующего бандла.
- Нужно вывести бандл из продажи (soft-disable через `priceHint.amount = 0` или удаление записи; soft-disable предпочтительнее, чтобы старые entitlements корректно реплеились).

## Pre-flight

1. Доступ в Yandex Games developer console (https-link выдаётся командой релиза).
2. Pull последней `main`: `git fetch && git checkout main && git pull`.
3. Прогнать baseline до правок: `bash ci/check_style.sh && node ci/build_release.mjs --yandex --dry-run` — должны быть зелёные.

## Шаги (короткий список)

1. Завести `productId` в Yandex developer console.
2. Добавить запись в [assets/shop.json](../../../assets/shop.json) `bundles[]`.
3. Синхронизировать i18n: [src/i18n/ru.json](../../../src/i18n/ru.json), [src/i18n/en.json](../../../src/i18n/en.json), fallback в [src/i18n/fallbackStrings.js](../../../src/i18n/fallbackStrings.js).
4. Обновить in-app каталог-снапшот, если используется (по умолчанию live-цены берутся через `Game.YandexPayments.getCatalog()` — отдельный snapshot не нужен; см. ниже).
5. Прогнать build sanitiser: `bash ci/check_style.sh && node ci/build_release.mjs --yandex --dry-run`.
6. Sandbox smoke на стороне Yandex Games (включая union-replay контракт — см. ниже).

## Шаг 1. Yandex developer console

В консоли Yandex Games → выбранная игра → раздел `Покупки` (Purchases) → `Создать товар`:

| Поле | Значение |
| --- | --- |
| `productId` | строка-идентификатор; должен 1:1 совпадать с `yandexProductId` из `assets/shop.json` |
| Название | можно дублировать `shop.bundle<Name>.name` ru-ключ (для модерации Yandex использует свой текст, runtime в игре читает i18n) |
| Описание | можно дублировать `shop.bundle<Name>.desc` ru-ключ |
| Цена | задаётся в RUB (Yandex автоматически конвертирует для других регионов) |
| Тип | `consumable` (бандл должен потребляться через `consumePurchase`) |

После создания дождаться модерации; в sandbox-режиме покупки доступны сразу.

## Шаг 2. Запись в `assets/shop.json`

Контракт записи (закреплён `_comment` в начале файла, см. также [docs/ai/SYSTEMS/shop.md](../SYSTEMS/shop.md#где-править)):

```json
{
  "id": "<unique_internal_id>",
  "yandexProductId": "<must_match_developer_console>",
  "tier": "small | medium | large | <custom>",
  "priceHint": { "currency": "RUB", "amount": 4900 },
  "contents": {
    "chips": [
      { "family": "any | red | yellow | blue | <familyId>", "tier": 1, "count": 3 }
    ],
    "drones": [
      { "type": "drones", "count": 1 }
    ],
    "siliconDust": 50
  },
  "sortOrder": 10,
  "iconAsset": "assets/ui/shop/bundle_<id>.png"
}
```

### Минимально-валидная запись (только chips + dust, без дронов)

Этот пример — минимальный случай, который пройдёт `applyBundle` и Yandex compliance:

```json
{
  "id": "starter_pack",
  "yandexProductId": "starter_pack",
  "tier": "small",
  "priceHint": { "currency": "RUB", "amount": 2900 },
  "contents": {
    "chips": [
      { "family": "any", "tier": 1, "count": 2 }
    ],
    "drones": [],
    "siliconDust": 25
  },
  "sortOrder": 5,
  "iconAsset": "assets/ui/shop/bundle_starter.png"
}
```

Замечания:

- `priceHint.amount` указан в **копейках** (4900 = 49 ₽). Это только UI hint до того, как `Game.YandexPayments.getCatalog()` вернёт live-цены от хоста; цена в Yandex консоли — источник истины для биллинга.
- `family: "any"` означает, что `applyBundle` выдаст случайный чип нужного `tier` (см. [src/shop/applyBundle.js](../../../src/shop/applyBundle.js)).
- `drones[].type` сейчас всегда `"drones"`; этот шейп проксируется в [`Game.Drones.grantFromShop(state, { type, count })`](../../../src/mechanics/drones.js#L957-L990) (canonical wrapper, добавлен в batch #4 / item 10). Для нестандартных drone-схем расширять не сам бандл, а `Game.Drones.grantFromShop`.
- `iconAsset` — относительный путь от корня проекта; ассет должен реально существовать в `assets/ui/shop/`. Если ассет ещё не готов, временно использовать существующий `bundle_small.png` / `bundle_medium.png` / `bundle_large.png`.

## Шаг 3. Синхронизация i18n

Правило проекта: `ru.json` и `en.json` обновляются **одновременно**, fallback пишется тогда же ([src/i18n/fallbackStrings.js](../../../src/i18n/fallbackStrings.js)).

Канонические ключи на бандл:

- `shop.bundle<Name>.name` — короткое название (видно на карточке).
- `shop.bundle<Name>.desc` — описание состава (1–2 строки).

Где `<Name>` — PascalCase id без подчёркиваний. Например, `id: "starter_pack"` → ключи `shop.bundleStarterPack.name` / `shop.bundleStarterPack.desc`.

Пример минимального патча трёх файлов (psuedo-diff):

```diff
# src/i18n/ru.json
+ ,"shop.bundleStarterPack.name": "Стартовый набор"
+ ,"shop.bundleStarterPack.desc": "2 чипа 1-го уровня + 25 кремниевой пыли"

# src/i18n/en.json
+ ,"shop.bundleStarterPack.name": "Starter Pack"
+ ,"shop.bundleStarterPack.desc": "2 tier-1 chips + 25 silicon dust"

# src/i18n/fallbackStrings.js
+ "shop.bundleStarterPack.name": "Стартовый набор",
+ "shop.bundleStarterPack.desc": "2 чипа 1-го уровня + 25 кремниевой пыли",
```

После правок — `JSON.parse` обоих json-файлов локально (`node -e "JSON.parse(require('fs').readFileSync('src/i18n/ru.json','utf8'))"`), чтобы поймать висячие запятые.

## Шаг 4. In-app shop.json snapshot

В текущем контракте отдельного app-side снапшота **нет**: live-цены тянет [`Game.YandexPayments.getCatalog()`](../../../src/yandex/yandexPayments.js) (signed:true, фильтрует по `productID` из `assets/shop.json`), а fallback на `priceHint` показывается только до завершения первого `getCatalog`. Если сервер хоста потерял `productId`, карточка остаётся в каталоге, но кнопка `Купить` дисейблится в `chipShopModal`.

Если когда-нибудь появится отдельный snapshot (например, копия каталога для оффлайн VK-build), его контракт должен стать частью этого playbook'a отдельным шагом — сейчас не требуется.

## Шаг 5. Build & sanitiser

Перед коммитом обязательно:

```bash
bash ci/check_style.sh
node ci/build_release.mjs --yandex --dry-run
```

Что проверяется:

- `check_style.sh` — линтер.
- `--yandex --dry-run` — полный sanitiser pass с финальной assertion `assertNoDevUrlLiterals` ([docs/ai/SYSTEMS/yandex.md#tokens-the-sanitiser-removes-rejected](../SYSTEMS/yandex.md)). Любой dev-URL литерал в новом коде или комментариях упадёт здесь.
- `--dry-run` чистит tmpdir после успеха; артефактов на диске не остаётся.

`node Test/tests.js` baseline на момент batch #7 — `82 passed / 3 failed` (T4-8, T4-12, T5-3 — pre-existing). Добавление бандла не должно менять эти цифры.

## Шаг 6. Sandbox smoke (Yandex Games)

> Связано: items 24–25 финального batch'a; полный compliance чеклист — в [docs/SHOP_GUIDE_RU.md](../../SHOP_GUIDE_RU.md#compliance-чеклист).

Минимальный sandbox прогон для нового SKU:

1. Открыть игру в sandbox-режиме Yandex Games (через консоль разработчика).
2. Убедиться, что HUD-кнопка корзины появилась и каталог отображает новую карточку.
3. Купить бандл sandbox-картой → дождаться `applyBundle` → проверить, что чипы/дрон/dust пришли в инвентарь.
4. Очистить cookies / localStorage → перезагрузить игру → убедиться, что entitlement восстановился через `cloudSave.pullShop` и не выдал бандл повторно (idempotency).
5. Проверить лог `state.shop.entitlements[<token>].deliveredAt` (через DevTools): `> 0` после успешной выдачи.

### Union-replay контракт `getPurchases() ∪ state.shop.pendingDeliveries`

> Закреплено в batch #6 ретроспективе как «защитный контракт» bootstrap-replay'a.

`Game.ShopBootstrap.run()` ([src/core/shopBootstrap.js](../../../src/core/shopBootstrap.js)) при старте обязан реплеить **объединение** двух множеств:

- `Game.YandexPayments.getPurchases()` — то, что host SDK ещё считает не-consumed.
- `state.shop.pendingDeliveries[]` — token'ы, которые `recordPurchase` положил в очередь, но `markDelivered` ещё не зафиксировал (возможные кейсы: сетевой разрыв между purchase и applyBundle; CPU-throttle мобилки; force-reload вкладки).

Псевдокод replay:

```js
const fromHost = await YandexPayments.getPurchases();          // SDK source of truth
const fromState = state.shop.pendingDeliveries.slice();        // local queue (may include tokens already consumed)
const seen = new Set();
const queue = [];
for (const p of fromHost.concat(fromState.map(t => ({ purchaseToken: t })))) {
  if (!p || !p.purchaseToken || seen.has(p.purchaseToken)) continue;
  seen.add(p.purchaseToken);
  queue.push(p);
}
for (const purchase of queue) {
  const ent = state.shop.entitlements[purchase.purchaseToken];
  if (ent && ent.deliveredAt) continue;            // already delivered, skip
  await applyBundle(bundleByProductId(purchase.productID), { reason:'bootstrap-replay', purchaseToken: purchase.purchaseToken });
  await YandexPayments.consumePurchase(purchase.purchaseToken);
}
```

Что важно для нового бандла:

- `bundleByProductId(productID)` должен находить запись по `yandexProductId` из `assets/shop.json`. Если `productId` в console и `yandexProductId` в JSON разошлись — replay пропустит покупку и игрок не получит контент.
- Локальный `state.shop.entitlements[token].deliveredAt` всегда побеждает cloud-side ([docs/ai/SYSTEMS/save.md#shop-state-shop-payload-block](../SYSTEMS/save.md)) — это защищает от дубликата при смене устройства после уже выданного бандла.
- Если `applyBundle` упал на одном из granters, `deliveredAt` остаётся `null`, и следующий boot повторит попытку — bandl idempotent по `purchaseToken`.

## Failure modes / типичные ошибки

| Симптом | Причина | Где смотреть |
| --- | --- | --- |
| Новый SKU не появился в каталоге в host iframe | productId в Yandex консоли не совпадает с `yandexProductId` в `assets/shop.json` | DevTools → `Game.YandexPayments.getCatalog()` |
| `Game.ChipShop.applyBundle` бросил исключение | `family` указан некорректно или `siliconDust` не Number | [src/shop/applyBundle.js](../../../src/shop/applyBundle.js) |
| После покупки чипы пришли, при reload пришли ещё раз | `state.shop.entitlements[token].deliveredAt` не выставился (kill-switch выключен или save не записался) | [docs/ai/SYSTEMS/shop.md#failure-modes--observability](../SYSTEMS/shop.md), `localStorage['tmzd_shop_v1']` |
| Sanitiser упал на новый бандл | host-литерал в комментарии описания | [docs/ai/SYSTEMS/yandex.md#tokens-the-sanitiser-removes-rejected](../SYSTEMS/yandex.md) |
| HUD-кнопка не появилась после деплоя | `_isYandexEnv()` false (билд не прошёл `--yandex`) или `Config.Shop.enabled = false` | [src/config/shop.js](../../../src/config/shop.js), [src/ui/hudShopButton.js](../../../src/ui/hudShopButton.js) |

## Done-criteria

- [ ] productId создан в Yandex developer console и прошёл модерацию.
- [ ] Запись в `assets/shop.json` валидна (`node -e "JSON.parse(...)"`).
- [ ] i18n ключи добавлены в ru/en/fallback одновременно.
- [ ] `bash ci/check_style.sh` зелёный.
- [ ] `node ci/build_release.mjs --yandex --dry-run` зелёный (`[YANDEX] guard passed`, exit 0).
- [ ] `node Test/tests.js` показывает baseline `82 passed / 3 failed` без новых падений.
- [ ] Sandbox smoke прошёл: покупка → выдача → reload → entitlement виден → повтор-replay не дублирует.
