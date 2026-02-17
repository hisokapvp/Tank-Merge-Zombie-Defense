# SYSTEM: Achievements

## Где искать

- Логика достижений: `src/mechanics/achievements.js`
- Интеграция прогресса/наград: `game.js`
- UI кнопок и модалок: `index.html`, `style.css`, `game.js`
- Локализация: `src/i18n/ru.json`, `src/i18n/en.json`
- Сохранение: `src/persistence/storage.js`, `docs/ai/SYSTEMS/save.md`

## Достижения

- `creator_novice` (`100` успешных merge) → `autoMergeBasic` (кнопка/режим в PACK2)
- `creator_pro` (`400` успешных merge) → `autoMergeAdvanced` (кнопка/режим в PACK2)
- `creator_expert` (`1000` успешных merge) → `autoMergeExpert` (кнопка/режим в PACK3)

`buyer_*` удалены из `ACHIEVEMENTS` и больше не участвуют в unlock/popup пайплайне.

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
- Post-merge FX/звук вызывается в том же entrypoint строго после создания результата merge.
- Для серий merge используется FIFO-очередь FX (краткий gap), чтобы не спамить все эффекты в один кадр.

## Награды

- Награда применяется сразу в момент выполнения условия (разблок режима bulk-кнопки).
- Popup носит информативный характер: показывает название достижения и награду.
- Для `creator_*` награда влияет на tier обеих кнопок: bulk-buy (`none` → `buy2` → `buy5` → `buyMax`) и auto-merge (`hidden` → `merge2` → `mergeX` → `mergeAll`).

## Auto-merge (PACK2/PACK3)

- Кандидаты: только танки из `hangar + track`.
- Строгое исключение: не участвуют танки с `requiresAd || locked || fromAdBox`.
- Детерминированный приоритет пар:
  - сначала `level asc`,
  - внутри уровня сначала hangar (`slotIndex asc`), затем track (`trackIndex asc`),
  - пары только последовательно `(0,1), (2,3), ...`.
- `mergeAll` работает по snapshot-парам: пары считаются ровно один раз на клик, без chain-reaction в этом же запуске.
- Manual и auto используют общий merge entrypoint `performMerge(...)`; auto выставляет `placeResult: 'hangar'`.
- Защита от двойного клика на UI-кнопке: cooldown в диапазоне `200..400ms` (по умолчанию `300ms`).

## UI

- Кнопка `#achievementsBtn` открывает список достижений.
- Модалка списка показывает: название, прогресс, статус, награду.
- Popup `#achievementPopup` показывается очередью (если закрыто несколько достижений подряд).

## Debug panel (dev)

- Расширение в `src/ui/debugPanel.js` (раздел `Achievements (dev)` во вкладке `Logs&Tools`).
- `Unlock + claim reward`:
  - перед мутацией вызывается `Game.Achievements.ensureState(state)`,
  - форсирует `state.achievements.unlocked[id] = true` (через dev-hook из `game.js`),
  - сразу обновляет UI (в т.ч. tier auto-merge кнопки).
- `Set totalMerges`:
  - устанавливает `state.achievements.totalMerges` c clamp `0..Number.MAX_SAFE_INTEGER`,
  - запускает тот же unlock-only пересчёт (`recalculateUnlocks`) и popup queue.
- Политика: уже открытые достижения не закрываются при уменьшении `totalMerges`.

## Bulk-buy

- Базовая кнопка `#buy` остаётся всегда.
- `#buyBulk` определяется только `Achievements.getBulkMode(state)` (пересчёт на каждом `updateUI()`, без кешей):
  - `none` → кнопка скрыта
  - `buy2` → tier cap `2`
  - `buy5` → tier cap `5`
  - `buyMax` → tier cap `freeSlots`
- Запрещён альтернативный гейтинг через `rewardMode`/`claimed`.

Формула плана покупки:

- `maxByTier = 2 | 5 | freeSlots` по текущему mode.
- `maxAffordableByCoins` считается точной симуляцией последовательных цен (с ростом после каждого танка) без мутаций `state`.
- `X = min(maxByTier, freeSlots, maxAffordableByCoins)`.
- `xDisplay = max(2, X)`.
- `X < 2` → кнопка `disabled`, label остаётся «Купить 2 …», клик = no-op.

При `X >= 2` клик покупает ровно `X` танков. Частичная bulk-покупка разрешена в рамках cap тира.

## Таблица tier/label

### Creator → Bulk-buy

| Unlock | Bulk mode | `maxByTier` | Visibility | Label |
|---|---|---:|---|---|
| нет `creator_novice` | `none` | `0` | hidden | — |
| `creator_novice`, без `creator_pro` | `buy2` | `2` | visible | «Купить {xDisplay} …» |
| `creator_pro`, без `creator_expert` | `buy5` | `5` | visible | «Купить {xDisplay} …» |
| `creator_expert` | `buyMax` | `freeSlots` | visible | «Купить {xDisplay} …» |

### Creator

| Unlock | Mode | Visibility | Label |
|---|---|---|---|
| нет `creator_novice` | `hidden` | hidden | — |
| `creator_novice` | `merge2` | visible | «Соединить 2 танка» |
| `creator_pro` | `mergeX` | visible | «Соединить 2» или «Соединить 4» |
| `creator_expert` | `mergeAll` | visible | «Соединить все танки» |
