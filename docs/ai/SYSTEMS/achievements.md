# Система: Achievements

> Обновлён: 2026-03-23.

## Где править
- Definitions, family grouping, прогресс и self-managed rewards: [src/mechanics/achievements.js](../../../src/mechanics/achievements.js#L4-L512)
- Immediate reward module для non-self-managed наград: [src/mechanics/achievementRewards.js](../../../src/mechanics/achievementRewards.js#L1-L117)
- Gameplay hooks, lazy reward loader и informational popup render: [game.js](../../../game.js#L3254-L3275), [game.js](../../../game.js#L3336-L3388), [game.js](../../../game.js#L9267-L9357), [game.js](../../../game.js#L9418-L9425)
- Начальная save-shape и mirrored counters: [src/persistence/initialState.js](../../../src/persistence/initialState.js#L123-L137)
- I18n contract: [src/i18n/ru.json](../../../src/i18n/ru.json#L155-L193), [src/i18n/en.json](../../../src/i18n/en.json#L153-L191), [src/i18n/fallbackStrings.js](../../../src/i18n/fallbackStrings.js#L130-L162), [src/i18n/fallbackStrings.js](../../../src/i18n/fallbackStrings.js#L547-L579)
- Regression coverage: [Test/pack4/tutorial_first_run_runtime.test.js](../../../Test/pack4/tutorial_first_run_runtime.test.js#L337-L491)

## Что это
Achievements runtime теперь держит четыре семейства (`creator`, `engineer`, `fence_mechanic`, `new_technology`) в одном state-machine: покупки, merge, успешные ручные ремонты ограды и уникальные исследования технологий модификаторов. `src/mechanics/achievements.js` остаётся canonical источником definitions/progress/dedupe и self-managed tech rewards, а fence-награды вынесены в `src/mechanics/achievementRewards.js` и подхватываются `game.js` до показа informational popup.

## Инварианты
- Успешный ручной ремонт ограды увеличивает прогресс ровно один раз внутри `tryRepairFenceSegmentAt()` и только после фактического восстановления сегмента и списания монет: [game.js](../../../game.js#L6720-L6736)
- Прогресс технологий считается по уникальным `techId` через `achievements.completedModifierTechs`; повторный callback для уже изученной технологии не должен повторно повышать `totalModifierTechUnlocks` или выдавать reward: [src/mechanics/achievements.js](../../../src/mechanics/achievements.js#L496-L512), [game.js](../../../game.js#L9348-L9373)
- One-shot rewards живут в `achievements.rewarded`; `ensureState()`, `restoreFullState()`, `applySavedProgress()` и `recalculateUnlocks()` обязаны сохранять эту карту до backfill-а наград, иначе self-managed rewards задвоятся: [src/mechanics/achievements.js](../../../src/mechanics/achievements.js#L331-L391), [game.js](../../../game.js#L5150-L5200), [game.js](../../../game.js#L5376-L5412)
- `ACHIEVEMENT_FAMILIES` и `flattenAchievementFamilies()` задают canonical порядок семейств и уровней достижений; UI и runtime должны брать определения только из уже flatten'нутого списка `ACHIEVEMENTS`, не собирая family-order заново: [src/mechanics/achievements.js](../../../src/mechanics/achievements.js#L4-L183)
- Fence-награды выдаются immediately: `processAchievementProgress()` сначала вызывает `reconcileAchievementRewards(unlocked)`, и только затем `queueAchievementPopup(...)`, поэтому popup `achievement_unlock` остаётся информационным. Кнопки `claim/dismiss/close` в popup только закрывают модалку: [game.js](../../../game.js#L3254-L3275), [game.js](../../../game.js#L3336-L3358), [game.js](../../../game.js#L10556-L10560)
- `stats.manualFenceRepairsCount` и `stats.modifierTechUnlocksCount` зеркалят achievement totals и становятся canonical read-path, если присутствуют; legacy totals остаются fallback только для старых save payload: [src/mechanics/achievements.js](../../../src/mechanics/achievements.js#L289-L327), [src/mechanics/achievements.js](../../../src/mechanics/achievements.js#L395-L493), [game.js](../../../game.js#L3280-L3284)

## Ключевые блоки

### Compact contract table
`ACHIEVEMENT_FAMILIES` группирует определения по family-id, а `flattenAchievementFamilies()` превращает их в линейный `ACHIEVEMENTS` список для lookup/render/runtime checks: [src/mechanics/achievements.js](../../../src/mechanics/achievements.js#L4-L183)

| Family | Achievement IDs / thresholds | Progress type | Canonical runtime read path | Reward modes | Save fields |
|---|---|---|---|---|---|
| `creator` | `creator_novice/pro/expert` → `200 / 800 / 1600` | `purchases` | `state.stats.tanksBoughtCount` → fallback `achievements.totalPurchased` | `buy2`, `buy5`, `buyMax` | `state.stats.tanksBoughtCount`, legacy mirror `achievements.totalPurchased`, shared `achievements.unlocked/popupQueue/rewarded` |
| `engineer` | `engineer_novice/pro/expert` → `200 / 500 / 1000` | `merges` | `state.stats.tanksMergedCount` → fallback `achievements.totalMerges` | `autoMergeBasic`, `autoMergeAdvanced`, `autoMergeExpert` | `state.stats.tanksMergedCount`, legacy mirror `achievements.totalMerges`, shared `achievements.unlocked/popupQueue/rewarded` |
| `fence_mechanic` | `fence_mechanic_1..5` → `1 / 50 / 200 / 1000 / 10000` | `manualFenceRepairs` | `state.stats.manualFenceRepairsCount` → fallback `achievements.totalManualFenceRepairs` | `fenceMechanicCoins75`, `fenceMechanicDust5`, `fenceMechanicFragment1`, `fenceMechanicRandomChips2`, `fenceMechanicUpgradePoint1` | `state.stats.manualFenceRepairsCount`, legacy mirror `achievements.totalManualFenceRepairs`, shared `achievements.unlocked/popupQueue/rewarded` |
| `new_technology` | `new_technology_1..4` → `1 / 3 / 8 / 16` unique tech unlocks | `modifierTechUnlocks` | `state.stats.modifierTechUnlocksCount` → fallback `achievements.totalModifierTechUnlocks`; unique-set source is `achievements.completedModifierTechs` | `newTechnologyFragments2`, `newTechnologyDust20`, `newTechnologyRandomChips2`, `newTechnologyUpgradePoints3` | `state.stats.modifierTechUnlocksCount`, legacy mirror `achievements.totalModifierTechUnlocks`, dedupe map `achievements.completedModifierTechs`, shared `achievements.unlocked/popupQueue/rewarded` |

Награды `fenceMechanicCoins75/fenceMechanicDust5/fenceMechanicFragment1/fenceMechanicRandomChips2/fenceMechanicUpgradePoint1` выдаются через lazy-loaded модуль [src/mechanics/achievementRewards.js](../../../src/mechanics/achievementRewards.js#L1-L117), а `newTechnologyFragments2/newTechnologyDust20/newTechnologyRandomChips2/newTechnologyUpgradePoints3` остаются self-managed внутри achievements runtime: [src/mechanics/achievements.js](../../../src/mechanics/achievements.js#L136-L325), [game.js](../../../game.js#L9267-L9336)

### Normalization, backfill и recalc
- `ensureState()` нормализует `rewarded`, `completedModifierTechs`, retro-infer'ит завершённые технологии из `Game.HangarChips.getUnlockedTechs()`, синхронизирует mirrored stats и сразу пытается добрать пропущенные self-managed rewards один раз: [src/mechanics/achievements.js](../../../src/mechanics/achievements.js#L331-L391)
- `addProgress()` инкрементит `purchases/merges/manualFenceRepairs/modifierTechUnlocks` через mirrored stats, если они есть, и возвращает только новые unlock ids: [src/mechanics/achievements.js](../../../src/mechanics/achievements.js#L454-L493)
- `recordModifierTechUnlock()` dedupe'ит `techId`, пересчитывает `totalModifierTechUnlocks` из `completedModifierTechs` и затем заново прогоняет unlock checks: [src/mechanics/achievements.js](../../../src/mechanics/achievements.js#L496-L512)

### Интеграция с game.js
- `processAchievementProgress()` — canonical funnel для gameplay-событий; после `AchievementsApi.addProgress()` он синхронизирует rewards и popup queue: [game.js](../../../game.js#L3254-L3273)
- `ensureAchievementRewardsModule()` lazy-load'ит `src/mechanics/achievementRewards.js`, а после успешной загрузки сразу backfill'ит уже unlocked fence-награды через `reconcileAchievementRewardsForUnlocked()` и обновляет UI: [game.js](../../../game.js#L9267-L9299)
- `grantAchievementReward()` в `game.js` обслуживает только non-self-managed fence rewards; технологии II-IV намеренно отсутствуют в этом switch и остаются self-managed: [game.js](../../../game.js#L9301-L9336)
- `openAchievementPopupEvent()` показывает только title/condition/reward copy, а `achievementPopupClaim`, `achievementPopupDismiss` и `achievementPopupClose` все маршрутизируются в `closeAchievementPopup()`: [game.js](../../../game.js#L3336-L3358), [game.js](../../../game.js#L9418-L9425), [game.js](../../../game.js#L10556-L10560)
- `renderAchievementsList()` перед рендером всегда вызывает recalculation и получает прогресс `manualFenceRepairs/modifierTechUnlocks` через `AchievementsApi.getProgressValue()`: [game.js](../../../game.js#L9386-L9406)

## Save и copy contract
- Новый save shape обязан стартовать с `rewarded`, `totalManualFenceRepairs`, `totalModifierTechUnlocks`, `completedModifierTechs` и mirrored stats counters: [src/persistence/initialState.js](../../../src/persistence/initialState.js#L123-L137)
- Все title/desc/reward строки новых achievement ladders обязаны одновременно существовать в RU, EN и fallback словарях: [src/i18n/ru.json](../../../src/i18n/ru.json#L155-L193), [src/i18n/en.json](../../../src/i18n/en.json#L153-L191), [src/i18n/fallbackStrings.js](../../../src/i18n/fallbackStrings.js#L130-L162), [src/i18n/fallbackStrings.js](../../../src/i18n/fallbackStrings.js#L547-L579)
- Regression pack фиксирует thresholds, single-increment repair hook, save restore rewarded-state, retroactive unique-tech recalc и one-shot reward behaviour: [Test/pack4/tutorial_first_run_runtime.test.js](../../../Test/pack4/tutorial_first_run_runtime.test.js#L337-L491)
