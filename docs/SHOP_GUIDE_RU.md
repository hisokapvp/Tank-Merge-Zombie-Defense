# Магазин чип-бандлов на Яндекс Играх — мануал для команды

> Документ написан для маркетинга, гейм-дизайна и продюсера.
> Для разработчика-агента есть отдельные доки: [docs/ai/SYSTEMS/shop.md](ai/SYSTEMS/shop.md), [docs/ai/SYSTEMS/yandex.md](ai/SYSTEMS/yandex.md), [docs/ai/SYSTEMS/save.md](ai/SYSTEMS/save.md), [docs/ai/PLAYBOOKS/shop-add-bundle.md](ai/PLAYBOOKS/shop-add-bundle.md).
> Обновлено: 2026-05-04 (passport `solo-pipeline-yandex-vk`, batch #7 / item 21).

## Что вообще такое «магазин чип-бандлов»

Это внутриигровой магазин, который появляется только в среде Яндекс Игр (в обычном веб-билде или в VK-сборке его нет). Игрок может купить набор чипов, дронов и кремниевой пыли за реальные деньги через биллинг Яндекс Игр.

Каждый бандл — это запись в JSON-каталоге игры. Цены и productId синхронизированы с Yandex developer console, выдача контента происходит атомарно после успешной покупки, восстановление после очистки cookies / смены устройства — через cloud-save Яндекса.

## 1. Как полностью включить или выключить магазин

В файле [src/config/shop.js](../src/config/shop.js) есть главный флаг (kill-switch):

```js
Game.Config.Shop.enabled = true;   // включено
Game.Config.Shop.enabled = false;  // полностью выключено
```

Когда `enabled = false`:

- HUD-кнопка корзины не появится в правом верхнем углу.
- Каталог не загружается, бандлы из `assets/shop.json` не отображаются.
- Bootstrap replay (восстановление непридоставленных покупок при старте) не запускается.
- `applyBundle` возвращает `{ ok: false, status: 'disabled' }` — даже если кто-то попытался вызвать её программно, контент не выдаётся.

Дополнительные точечные kill-switch'и в том же файле:

- `Game.Config.Shop.cloudSave.enabled` — выключает синхронизацию с облаком Яндекса (entitlements будут жить только локально в браузере).
- `Game.Config.Shop.ledgerExport.enabled` — выключает сбор аналитических событий покупок (по умолчанию выключен; включается только когда появится backend, см. ниже).

После любых правок в `src/config/shop.js` коммитим и собираем релиз — изменения попадают в next deploy.

## 2. Где править каталог бандлов

Главный файл каталога: [assets/shop.json](../assets/shop.json).

Структура файла:

```json
{
  "_comment": "...",
  "bundles": [
    { ... первый бандл ... },
    { ... второй бандл ... }
  ]
}
```

Поля одной записи бандла:

| Поле | Что значит |
| --- | --- |
| `id` | внутренний идентификатор для кода игры (любая строка без пробелов) |
| `yandexProductId` | productId из Yandex developer console (должен совпадать 1:1 с консолью) |
| `tier` | визуальный тэг карточки (`small`/`medium`/`large` или свой) |
| `priceHint.currency` | валюта для отображения до подгрузки live-цен (`"RUB"`) |
| `priceHint.amount` | цена в копейках (4900 = 49 ₽) — это **только заглушка** до того, как Яндекс пришлёт реальные цены |
| `contents.chips[]` | список «чиповых стопок»: `{ family, tier, count }` |
| `contents.drones[]` | список дронов: `{ type, count }` (сейчас `type: "drones"`) |
| `contents.siliconDust` | сколько кремниевой пыли выдать |
| `sortOrder` | порядок отображения карточек в магазине (меньше — выше) |
| `iconAsset` | путь к иконке бандла относительно корня репозитория |

Минимальный пример валидной записи:

```json
{
  "id": "starter_pack",
  "yandexProductId": "starter_pack",
  "tier": "small",
  "priceHint": { "currency": "RUB", "amount": 2900 },
  "contents": {
    "chips": [{ "family": "any", "tier": 1, "count": 2 }],
    "drones": [],
    "siliconDust": 25
  },
  "sortOrder": 5,
  "iconAsset": "assets/ui/shop/bundle_starter.png"
}
```

## 3. Где менять состав и цены существующих бандлов

### Состав

В [assets/shop.json](../assets/shop.json) внутри нужного бандла поправить `contents`:

- `chips[].count` — сколько чипов выдать.
- `chips[].tier` — уровень чипа (1/2/3).
- `chips[].family` — семейство (`"any"` = случайное; `"red"`, `"yellow"`, `"blue"` или конкретный familyId).
- `drones[].count` — количество дронов.
- `siliconDust` — количество кремниевой пыли.

После правки названия/описания бандла обязательно поправить и i18n:

- [src/i18n/ru.json](../src/i18n/ru.json) — русские строки `shop.bundle<Name>.name` / `shop.bundle<Name>.desc`.
- [src/i18n/en.json](../src/i18n/en.json) — английские.
- [src/i18n/fallbackStrings.js](../src/i18n/fallbackStrings.js) — резервный fallback на случай, если JSON i18n не успел загрузиться.

Правило проекта: **ru / en / fallback правятся одновременно**.

### Цены

Цена в магазине берётся из двух источников:

1. **`priceHint.amount`** в `assets/shop.json` — заглушка, которая показывается на карточке до того, как Яндекс ответит на `getCatalog()`. Полезно как запасной вариант при первой загрузке.
2. **Yandex developer console** — реальная цена биллинга. Это **источник истины**: именно она списывается с игрока.

Чтобы поменять цену, нужно:

1. Зайти в Yandex developer console → Игра → Покупки → нужный товар → выставить новую цену.
2. (Опционально) Обновить `priceHint.amount` в `assets/shop.json`, чтобы карточка не моргала старой ценой при первом показе.
3. Передеплоить билд.

Менять цену **только** в `assets/shop.json` без console — бесполезно: реальный биллинг этого не увидит.

## 4. Где `productId` для синхронизации с Яндекс developer console

В [assets/shop.json](../assets/shop.json) каждый бандл имеет поле `yandexProductId`. Это и есть строковый идентификатор, который нужно один в один создать в консоли:

- В Яндекс консоли: `Игра → Покупки → Создать товар → productId = <значение из yandexProductId>`.
- Тип товара в консоли — **consumable** (расходуемый), потому что игра вызывает `consumePurchase(token)` после выдачи контента.
- Название и описание в консоли могут отличаться от игровых ru/en строк (Yandex использует свой текст для модерации; внутри игры показываются строки из i18n).

Если `yandexProductId` в JSON и `productId` в консоли разойдутся — карточка в магазине будет, но кнопка `Купить` дисейблится, потому что live-каталог из `getCatalog()` не нашёл нужный SKU.

## 5. Как тестировать покупки в sandbox-режиме Яндекса

Полная процедура для разработчика — в [docs/ai/PLAYBOOKS/shop-add-bundle.md](ai/PLAYBOOKS/shop-add-bundle.md#шаг-6-sandbox-smoke-yandex-games). Короткая сводка для команды:

1. Открыть игру в sandbox-режиме (через Yandex developer console, кнопка `Sandbox` или `Тестовый режим`).
2. Убедиться, что HUD-кнопка корзины появилась в правом верхнем углу.
3. Открыть магазин, выбрать бандл, нажать `Купить`. В sandbox реальная карта не списывается, но проходит весь покупочный flow.
4. Проверить, что после покупки в инвентаре появились чипы / дрон / пыль.
5. Очистить cookies браузера для домена Яндекс Игр и перезагрузить игру. Бандл должен **не** выдаться повторно (уже выданное помечено как `delivered`), но восстановиться, если выдача оборвалась посередине.

Если покупка прошла, а контент не пришёл — собрать DevTools `console` лог и тикет к разработчику; runtime-сторона восстановит выдачу при следующем boot благодаря replay-контракту (см. ниже).

## 6. Как смотреть логи покупок

### Локальные логи (в браузере игрока или в DevTools sandbox)

1. Открыть DevTools → вкладка `Application` (Chrome/Edge) или `Storage` (Firefox).
2. Слева → `Local Storage` → выбрать домен Яндекс Игр.
3. Найти ключ `tmzd_shop_v1` — там лежит сериализованный `state.shop` (entitlements + pendingDeliveries + lastSync).

Альтернативно через DevTools console:

```js
JSON.parse(localStorage.getItem('tmzd_shop_v1') || 'null');
```

Каждая успешно оплаченная покупка хранится в `entitlements[purchaseToken]`:

- `productId` — какой бандл купили.
- `grantedAt` — когда подтвердилась покупка.
- `deliveredAt` — когда контент был реально выдан в инвентарь (`null` означает «оплачено, но выдача не завершилась»).
- `signature` / `contentsSnapshot` — подписанные данные для последующей серверной верификации.

### Cloud-логи (на стороне Яндекса)

Тот же `state.shop` зеркалится в облако Яндекса под ключом `tmzd_shop_v1` через `player.setData('tmzd_shop_v1', state.shop)`. Получить можно так (только в Яндекс iframe, через DevTools):

```js
ysdk.getPlayer().then(p => p.getData(['tmzd_shop_v1'])).then(console.log);
```

Это нужно, чтобы проверить, что облачная копия совпадает с локальной (например, после жалобы «купил на телефоне, на десктопе бандл пропал»).

### Ledger / pendingExports

Если в будущем включится backend (см. ниже), все покупки также копятся в `state.shop.pendingExports[]` — это очередь событий для отправки на свой сервер.

## 7. Как подключить будущий backend

Архитектура изначально готова к этому. Внутри [src/shop/shopLedger.js](../src/shop/shopLedger.js) есть метод `exportEvent(eventType, payload)` (seam — точка расширения для будущей интеграции).

Чтобы включить:

1. В [src/config/shop.js](../src/config/shop.js) выставить `Game.Config.Shop.ledgerExport.enabled = true`.
2. Реализовать сетевой sender внутри `Game.ShopLedger.exportEvent` (или подменить его модулем-обёрткой, который дёргает свой эндпоинт).
3. Настроить серверную верификацию подписей: каждая запись в `state.shop.entitlements[token]` содержит `signature` и `payload` от Яндекса (получены через `getPayments({ signed: true })`) — этого достаточно для server-side проверки подлинности покупки на стороне бэкенда (по документации Яндекс Игр).
4. Обработать `pendingExports[]` как очередь at-least-once: после успешного `POST` сервер удаляет соответствующую запись из очереди.

До включения этого флага все покупки идут чисто на стороне клиента + cloud-save Яндекса; backend не требуется. Это allowed by design: первая фаза монетизации не требует своего сервера.

## 8. Compliance чеклист (требования Яндекс Игр)

Этот список нужно пройти перед каждым релизом, в котором был трогнут магазин:

- [ ] **Signed payments**. В коде используется `getPayments({ signed: true })` — каждая покупка приходит с подписью Яндекса. Подтвердить можно тем, что в `state.shop.entitlements[token].signature` лежит непустая строка после реальной покупки в sandbox. Контракт описан в [docs/ai/SYSTEMS/yandex.md#srcyandexyandexpaymentsjs--yandex-payments-wrapper](ai/SYSTEMS/yandex.md).
- [ ] **`consumePurchase` после выдачи**. Каждая successful purchase обязательно идёт через `Game.YandexPayments.consumePurchase(token)` после `applyBundle`. Без этого Яндекс будет считать товар не потреблённым и возвращать его из `getPurchases()` бесконечно. Проверить в sandbox: после покупки → `await Game.YandexPayments.getPurchases()` возвращает пустой массив (или без только что купленного бандла).
- [ ] **Дисклеймер о покупках**. На карточке/в магазине показан текст «Покупки доступны только в Яндекс Играх. Цены и валюта определяются регионом.» Источник: i18n-ключ `shop.legal.disclaimer` в `ru.json`/`en.json`. В режиме вне Яндекс iframe карточка показывает текст-замену `shop.unavailableOutsideYandex`.
- [ ] **Цены берутся из `getCatalog()`**. На карточке отображается live-цена, прилетевшая через `Game.YandexPayments.getCatalog()`, а не локальный `priceHint`. `priceHint` показывается только до завершения первого `getCatalog` (на самой первой загрузке без кеша).
- [ ] **Bootstrap replay включает union(`getPurchases()` ∪ `pendingDeliveries`)**. Это значит: при старте игра проверяет и то, что Яндекс ещё считает не-consumed, и собственную очередь pending-deliveries. Без этого возможен сценарий «оплата прошла, выдачу прервал reload, бандл потерян». Контракт описан в [playbook](ai/PLAYBOOKS/shop-add-bundle.md#union-replay-контракт-getpurchases--stateshoppendingdeliveries).
- [ ] **Восстановление после очистки cookies**. Очистил cookies → перезагрузил → entitlements виден через `cloudSave.pullShop()`, бандл повторно не выдаётся (`deliveredAt` сохранилось в облаке).
- [ ] **Sanitiser pass**. `bash ci/check_style.sh` и `node ci/build_release.mjs --yandex --dry-run` зелёные перед сборкой релиза.

## Куда обращаться, если что-то сломалось

| Симптом | Куда смотреть | К кому обращаться |
| --- | --- | --- |
| Карточка бандла не появилась в Яндекс iframe | productId в консоли ↔ `yandexProductId` в JSON | разработчик |
| Купил, чипы не пришли | DevTools → `tmzd_shop_v1` → `entitlements[token].deliveredAt` | разработчик |
| Перешёл на другое устройство — entitlements пропали | Cloud-save: облачный `tmzd_shop_v1` через `getPlayer().getData()` | разработчик |
| Цена на карточке не совпадает с консолью | `priceHint` в JSON устарел; реальная списывается из `getCatalog()` | маркетинг (поправить JSON) |
| Sandbox покупка прошла, но Яндекс отклонил релиз | compliance чеклист выше | продюсер + разработчик |

Все технические детали и точные пути файлов (включая номера строк) — в агент-доках, на которые ссылается этот документ.

## 9. Debug-режим: тестирование магазина вне Яндекс Игр

Иногда нужно проверить UI/UX магазина локально (открыть `index.html` напрямую, без Yandex iframe). Для этого добавлен флаг **`Game.Config.Shop.debugForceEnable`** в [src/config/shop.js](../src/config/shop.js).

### Как включить

1. Открыть `index.html` локально (двойным кликом или через `file://`).
2. Открыть DevTools (F12) → вкладка Console.
3. Выполнить:

```js
Game.Config.Shop.debugForceEnable = true;
Game.ChipShop.UI.init();
Game.HudShopButton.refresh();
```

После этого:

- HUD-кнопка корзины появится в правом верхнем углу.
- При нажатии откроется модалка магазина с тремя бандлами.
- Кнопка «Купить» **симулирует** покупку: вызывает `Game.ChipShop.applyBundle(...)` напрямую с токеном вида `DEBUG-<bundleId>-<timestamp>`. SDK Яндекса при этом не дёргается.
- `getCatalog()` возвращает значения из `priceHint` каждого бандла.
- `cloudSave` остаётся silent no-op (это нормально — debug-тестирование без облака).

### Production safety

Флаг **не активируется** в реальном Yandex iframe: если игра запущена там, `_isYandexEnv()` вернёт `true`, и `_debugForceEnabled()` всегда вернёт `false`. То есть даже если `debugForceEnable = true` каким-то образом окажется в production-сборке, реальный Yandex flow будет работать как обычно (приоритетнее).

### Проверка идемпотентности

Каждый клик «Купить» в debug-режиме генерирует уникальный токен `DEBUG-<bundleId>-<Date.now()>`, поэтому повторные клики выдают контент столько раз, сколько было нажатий. Это нужно, чтобы воспроизвести реальный Yandex flow в тестах. Если нужно проверить дедупликацию (один и тот же `purchaseToken` дважды), можно вручную дёрнуть `Game.ChipShop.applyBundle(bundleDef, { reason: 'shop_debug', purchaseToken: 'DEBUG-FIXED-TOKEN' })` дважды — второй вызов должен вернуть `{ ok: true, status: 'already_delivered' }` (или эквивалент, см. контракт `applyBundle` в `docs/ai/SYSTEMS/shop.md`).

## 10. Известные ошибки в консоли Yandex sandbox, которые НЕ являются нашими багами

При запуске игры в sandbox-режиме Яндекс Игр в DevTools могут появиться следующие ошибки. Это **не** баги нашего магазина — они приходят со стороны платформы Яндекс или от ещё не настроенного product catalog в developer console. Магазин при этом работает корректно.

| Ошибка в консоли | Источник | Что с этим делать |
| --- | --- | --- |
| `Refused to execute script from 'https://yandex.ru/games/_crpd/...' because its MIME type ('application/octet-stream') is not executable` | Yandex CDN отдаёт скрипт с неправильным `Content-Type` | проблема платформы; ничего не делаем со своей стороны |
| `Failed to load resource: 404 /games/app/size24` | Yandex platform leaderboard avatar API; вызывается изнутри SDK для других фич (achievements/leaderboards) | не относится к магазину; safely ignore |
| `Failed to load resource: 404 /games/app/size36` | то же, что выше | safely ignore |
| `Failed to load resource: 404 games-sdk.yandex.ru/.../products?app-id=...&id=small_chip_pack...` | Yandex billing endpoint не нашёл product ID в developer console | **ожидаемо** до того, как productId-ы зарегистрированы в developer console (см. шаг 4 в [shop-add-bundle playbook](ai/PLAYBOOKS/shop-add-bundle.md#шаг-4-регистрация-productid-в-yandex-developer-console)) |

Если 404 на `bundle_small.png` / `bundle_medium.png` / `bundle_large.png` — это была временная проблема batch #9, исправлена: теперь иконки бандлов рисуются как emoji-fallback по `tier`, и `iconAsset` в `assets/shop.json` стал опциональным (см. контракт записи в шапке файла).

