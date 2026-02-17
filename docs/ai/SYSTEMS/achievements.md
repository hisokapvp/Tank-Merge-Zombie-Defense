# SYSTEM: Achievements

## Где искать

- Логика достижений: `src/mechanics/achievements.js`
- Auto-merge tiers/label: `src/mechanics/autoMerge.js`
- Интеграция прогресса/наград: `game.js`
- Локализация: `src/i18n/ru.json`, `src/i18n/en.json`
- Сохранение: `src/persistence/storage.js`

## Ветки достижений

Система разделена на 2 ветки:

- `creator_*` (покупки):
  - `creator_novice` target `100`
  - `creator_pro` target `400`
  - `creator_expert` target `1000`
  - `progressType = purchases`
  - reward keys: `achievementRewardBuy2/Buy5/BuyMax`
- `engineer_*` (merge):
  - `engineer_novice` target `200`
  - `engineer_pro` target `500`
  - `engineer_expert` target `1000`
  - `progressType = merges`
  - reward keys: `achievementRewardAutoMergeBasic/Advanced/Expert`

`buyer_*` остаются в i18n только как legacy-строки и не участвуют в unlock логике.

## Source of truth

Источник прогресса:

- `state.stats.tanksMergedCount`
- `state.stats.tanksBoughtCount`

Legacy-совместимость (зеркало для debug/старых мест чтения):

- `state.achievements.totalMerges`
- `state.achievements.totalPurchased`

`Achievements.ensureState(state)` гарантирует структуру:

- `state.achievements.unlocked`
- `state.achievements.popupQueue`
- `state.stats.{tanksMergedCount,tanksBoughtCount}`
- синхронизацию `stats` ↔ legacy counters

## Миграция старых сейвов

Если `state.stats.*` отсутствуют:

- `tanksMergedCount` берётся из `state.achievements.totalMerges`
- `tanksBoughtCount` берётся из `state.achievements.totalPurchased`
- если `totalPurchased` отсутствует — допускается infer из `state.buyCounts`

Сериализация `state.stats` выполняется в `src/persistence/storage.js` с clamp к `0..Number.MAX_SAFE_INTEGER`.

## Unlock semantics

- unlock-only: уже unlocked achievements назад не закрываются.
- прогресс читается через `Achievements.getProgressValue(state, progressType)`.
- `Achievements.addProgress(state, progressType, delta)` обновляет `state.stats.*` и зеркалит legacy-поля.

## Bulk-buy gating (creator_*)

`Achievements.getBulkMode(state)`:

- нет `creator_novice` → `none`
- `creator_novice` → `buy2`
- `creator_pro` → `buy5`
- `creator_expert` → `buyMax`

## Auto-merge gating (engineer_*)

`AutoMerge.getAutoMergeTier(state)`:

- нет `engineer_novice` → `hidden`
- `engineer_novice` → `merge2`
- `engineer_pro` → `mergeX`
- `engineer_expert` → `mergeAll`

`mergeX`:

- лимит: до `5` пар за клик (до 10 танков)
- label: `t('autoMergeDynamicShort', 'Соединить {count}', { count })`, где `count` в диапазоне `2..10`

Инварианты auto-merge остаются:

- `excludeAdBox: true`
- snapshot-подбор пар
- cooldown `300ms`

## Debug panel

`Set totalMerges` в `src/ui/debugPanel.js` продолжает работать корректно из-за синхронизации legacy `totalMerges` с `state.stats.tanksMergedCount` внутри achievements API.
