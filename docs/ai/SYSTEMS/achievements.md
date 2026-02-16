# SYSTEM: Achievements

## Где искать

- Логика достижений: `src/mechanics/achievements.js`
- Интеграция прогресса/наград: `game.js`
- UI кнопок и модалок: `index.html`, `style.css`, `game.js`
- Локализация: `src/i18n/ru.json`, `src/i18n/en.json`
- Сохранение: `src/persistence/storage.js`, `docs/ai/SYSTEMS/save.md`

## Достижения

- `buyer_novice` (`100` покупок танков) → `buy2`
- `buyer_pro` (`500` покупок танков) → `buy5`
- `buyer_expert` (`1000` покупок танков) → `buyMax`
- `creator_novice` (`100` успешных merge) → `autoMergeBasic` (кнопка/режим в PACK2)
- `creator_pro` (`400` успешных merge) → `autoMergeAdvanced` (кнопка/режим в PACK2)
- `creator_expert` (`1000` успешных merge) → `autoMergeExpert` (кнопка/режим в PACK3)

Прогресс считается по типам:

- `purchases` → `state.achievements.totalPurchased` (покупки, включая bulk).
- `merges` → `state.achievements.totalMerges` (только успешные merge).

Неуспешные попытки merge (нет пары/невалидный drop/кап уровня) прогресс `merges` не меняют.
Разблокировка работает в режиме «unlock-only»: уже открытые достижения назад не закрываются.

## Source of truth: merge

- Общая точка входа merge: `game.js` → `performMerge(fromIdx, toIdx, opts)`.
- Manual drag/drop использует `performMerge(..., { placeResult: 'original' })`.
- После успешного merge вызывается `addProgress('merges', 1)` через achievements API.
- Параметр `placeResult` зарезервирован под PACK2/3 (`'hangar'`) без изменения текущего manual placement.

## Награды

- Награда применяется сразу в момент выполнения условия (разблок режима bulk-кнопки).
- Popup носит информативный характер: показывает название достижения и награду.

## UI

- Кнопка `#achievementsBtn` открывает список достижений.
- Модалка списка показывает: название, прогресс, статус, награду.
- Popup `#achievementPopup` показывается очередью (если закрыто несколько достижений подряд).

## Bulk-buy

- Базовая кнопка `#buy` остаётся всегда.
- `#buyBulk` переключается по лучшей награде:
  - `buy2` → «Купить 2 танка»
  - `buy5` → «Купить 5 танков»
  - `buyMax` → «Купить максимум танков»
- Disabled-логика:
  - `buy2`/`buy5`: нужно ровно `N` свободных слотов и монет на все `N` последовательных покупок.
  - `buyMax`: покупает `K = min(freeSlots, maxKByCoins)`; кнопка disabled, если `K == 0`.
