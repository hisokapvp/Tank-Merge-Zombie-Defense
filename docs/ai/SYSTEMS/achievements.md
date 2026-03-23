# Система: Achievements

> Обновлён: 2026-03-23.

## Где править
- Definitions, прогресс, self-managed rewards: [src/mechanics/achievements.js](../../../src/mechanics/achievements.js#L4-L522)
- Gameplay hooks, reward dispatcher и modal render: [game.js](../../../game.js#L3254-L3284), [game.js](../../../game.js#L6720-L6736), [game.js](../../../game.js#L9295-L9412)
- Начальная save-shape и mirrored counters: [src/persistence/initialState.js](../../../src/persistence/initialState.js#L123-L137)
- I18n contract: [src/i18n/ru.json](../../../src/i18n/ru.json#L155-L193), [src/i18n/en.json](../../../src/i18n/en.json#L153-L191), [src/i18n/fallbackStrings.js](../../../src/i18n/fallbackStrings.js#L130-L162), [src/i18n/fallbackStrings.js](../../../src/i18n/fallbackStrings.js#L547-L579)
- Regression coverage: [Test/pack4/tutorial_first_run_runtime.test.js](../../../Test/pack4/tutorial_first_run_runtime.test.js#L337-L491)

## Что это
Achievements runtime теперь держит четыре типа прогресса в одном state-machine: покупки, merge, успешные ручные ремонты ограды и уникальные исследования технологий модификаторов. `src/mechanics/achievements.js` отвечает за thresholds, dedupe и self-managed rewards, а `game.js` только прокидывает runtime-события, выдаёт fence-награды из reward switch и рендерит modal/progress view.

## Инварианты
- Успешный ручной ремонт ограды увеличивает прогресс ровно один раз внутри `tryRepairFenceSegmentAt()` и только после фактического восстановления сегмента и списания монет: [game.js](../../../game.js#L6720-L6736)
- Прогресс технологий считается по уникальным `techId` через `achievements.completedModifierTechs`; повторный callback для уже изученной технологии не должен повторно повышать `totalModifierTechUnlocks` или выдавать reward: [src/mechanics/achievements.js](../../../src/mechanics/achievements.js#L496-L512), [game.js](../../../game.js#L9348-L9373)
- One-shot rewards живут в `achievements.rewarded`; `ensureState()`, `restoreFullState()`, `applySavedProgress()` и `recalculateUnlocks()` обязаны сохранять эту карту до backfill-а наград, иначе self-managed rewards задвоятся: [src/mechanics/achievements.js](../../../src/mechanics/achievements.js#L331-L391), [game.js](../../../game.js#L5150-L5200), [game.js](../../../game.js#L5376-L5412)
- `stats.manualFenceRepairsCount` и `stats.modifierTechUnlocksCount` зеркалят achievement totals и становятся canonical read-path, если присутствуют; legacy totals остаются fallback только для старых save payload: [src/mechanics/achievements.js](../../../src/mechanics/achievements.js#L289-L327), [src/mechanics/achievements.js](../../../src/mechanics/achievements.js#L395-L493), [game.js](../../../game.js#L3280-L3284)

## Ключевые блоки

### Definitions и reward modes
- Ветка `fence_mechanic_I-V` задаёт thresholds `1 / 50 / 200 / 1000 / 10000` успешных ручных ремонтов и reward modes `coins / dust / fragment / random chips / upgrade point`: [src/mechanics/achievements.js](../../../src/mechanics/achievements.js#L54-L96)
- Ветка `new_technology_I-IV` задаёт thresholds `1 / 3 / 8 / 16` уникальных исследований технологий модификатора и reward modes `fragments / dust / random chips / upgrade points`: [src/mechanics/achievements.js](../../../src/mechanics/achievements.js#L99-L132)
- Награды `newTechnologyFragments2/newTechnologyDust20/newTechnologyRandomChips2/newTechnologyUpgradePoints3` self-managed и выдаются helpers внутри achievements runtime, а не через `game.js` switch: [src/mechanics/achievements.js](../../../src/mechanics/achievements.js#L136-L284)

### Normalization, backfill и recalc
- `ensureState()` нормализует `rewarded`, `completedModifierTechs`, retro-infer'ит завершённые технологии из `Game.HangarChips.getUnlockedTechs()`, синхронизирует mirrored stats и сразу пытается добрать пропущенные self-managed rewards один раз: [src/mechanics/achievements.js](../../../src/mechanics/achievements.js#L331-L391)
- `addProgress()` инкрементит `purchases/merges/manualFenceRepairs/modifierTechUnlocks` через mirrored stats, если они есть, и возвращает только новые unlock ids: [src/mechanics/achievements.js](../../../src/mechanics/achievements.js#L454-L493)
- `recordModifierTechUnlock()` dedupe'ит `techId`, пересчитывает `totalModifierTechUnlocks` из `completedModifierTechs` и затем заново прогоняет unlock checks: [src/mechanics/achievements.js](../../../src/mechanics/achievements.js#L496-L512)

### Интеграция с game.js
- `processAchievementProgress()` — canonical funnel для gameplay-событий; после `AchievementsApi.addProgress()` он синхронизирует rewards и popup queue: [game.js](../../../game.js#L3254-L3273)
- `grantAchievementReward()` в `game.js` обслуживает только non-self-managed rewards, включая `fenceMechanicCoins75`, `fenceMechanicDust5`, `fenceMechanicFragment1`, `fenceMechanicRandomChips2`, `fenceMechanicUpgradePoint1`; технологии II-IV намеренно отсутствуют в этом switch: [game.js](../../../game.js#L9295-L9336)
- `renderAchievementsList()` перед рендером всегда вызывает recalculation и получает прогресс `manualFenceRepairs/modifierTechUnlocks` через `AchievementsApi.getProgressValue()`: [game.js](../../../game.js#L9386-L9406)

## Save и copy contract
- Новый save shape обязан стартовать с `rewarded`, `totalManualFenceRepairs`, `totalModifierTechUnlocks`, `completedModifierTechs` и mirrored stats counters: [src/persistence/initialState.js](../../../src/persistence/initialState.js#L123-L137)
- Все title/desc/reward строки новых achievement ladders обязаны одновременно существовать в RU, EN и fallback словарях: [src/i18n/ru.json](../../../src/i18n/ru.json#L155-L193), [src/i18n/en.json](../../../src/i18n/en.json#L153-L191), [src/i18n/fallbackStrings.js](../../../src/i18n/fallbackStrings.js#L130-L162), [src/i18n/fallbackStrings.js](../../../src/i18n/fallbackStrings.js#L547-L579)
- Regression pack фиксирует thresholds, single-increment repair hook, save restore rewarded-state, retroactive unique-tech recalc и one-shot reward behaviour: [Test/pack4/tutorial_first_run_runtime.test.js](../../../Test/pack4/tutorial_first_run_runtime.test.js#L337-L491)
