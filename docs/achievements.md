# Achievements: Creator + Engineer

## Ветки достижений

В игре две независимые ветки прогресса:

- **Создатель танков (`creator_*`)** — прогресс от покупок танков.
  - Источник: `state.stats.tanksBoughtCount`.
  - Награды: tier для bulk-buy кнопки (`buy2` → `buy5` → `buyMax`).
- **Инженер (`engineer_*`)** — прогресс от успешных merge.
  - Источник: `state.stats.tanksMergedCount`.
  - Награды: tier для auto-merge (`merge2` → `mergeX` → `mergeAll`).

Разблокировка работает в режиме **unlock-only**: уже открытые достижения обратно не закрываются.

## Пороги

### Creator (purchases)

- `creator_novice` — `100`
- `creator_pro` — `400`
- `creator_expert` — `1000`

### Engineer (merges)

- `engineer_novice` — `200`
- `engineer_pro` — `500`
- `engineer_expert` — `1000`

## Source of truth и совместимость сейвов

Новый источник прогресса:

- `state.stats.tanksMergedCount`
- `state.stats.tanksBoughtCount`

Для обратной совместимости поддерживается зеркало legacy-полей:

- `state.achievements.totalMerges`
- `state.achievements.totalPurchased`

При загрузке старых сейвов выполняется миграция:

- если `state.stats.*` отсутствуют, значения инициализируются из legacy (`state.achievements.totalMerges/totalPurchased`);
- для покупок при отсутствии legacy-счётчика допускается infer из `state.buyCounts`.

Персистентность:

- `state.stats` сериализуется в `src/persistence/storage.js`;
- значения нормализуются до целых `0..Number.MAX_SAFE_INTEGER`.

## Auto-merge gating (через engineer_*)

Tier определяется только по `engineer_*`:

- нет `engineer_novice` → `hidden` (кнопка скрыта)
- есть `engineer_novice`, но нет `engineer_pro` → `merge2`
- есть `engineer_pro`, но нет `engineer_expert` → `mergeX`
- есть `engineer_expert` → `mergeAll`

Дополнительно:

- для `mergeX` за один клик обрабатывается до **5 пар** (до 10 танков);
- label для `mergeX` строится динамически через i18n-ключ `autoMergeDynamicShort` с `{count}` в диапазоне `2..10`;
- сохраняются существующие ограничения: `excludeAdBox: true`, snapshot-подбор пар, cooldown `300ms`.

## Debug tools

Debug-панель (`Set totalMerges`) продолжает работать через синхронизацию legacy-поля и `state.stats.tanksMergedCount`, поэтому dev-flow и unlock-проверки не ломаются.
