# Индекс документации для агента

> Обновлено: 2026-03-25.

## Порядок чтения
1. `docs/ai/STYLE.md`
2. `docs/ai/PROJECT_MAP.md`
3. `docs/ai/ARCHITECTURE.md`
4. Целевой файл из `docs/ai/SYSTEMS/*.md`
5. Если целевой файл большой — соответствующий `docs/ai/*_MAP.md`
6. Для типовой задачи — нужный `docs/ai/PLAYBOOKS/*.md`

## Главные карты
- `docs/ai/PROJECT_MAP.md` — главная карта проекта и инварианты.
- `docs/ai/GAME_JS_MAP.md` — актуальная карта монолита `game.js` [HOT].
- `docs/ai/STYLE_CSS_MAP.md` — карта CSS-монолита `style.css` [HOT].
- `docs/ai/HANGAR_CHIPS_UI_MAP.md` — большой UI-runtime ангара [HOT].
- `docs/ai/SUPERCOMPUTER_MENU_MAP.md` — root/tank-wall/hangar overlays суперкомпьютера [HOT].
- `docs/ai/SPRITE_LOADERS_MAP.md` — normalizer'ы и sprite-loader contracts [HOT].
- `docs/ai/PRODUCTION_LINE_RENDER_MAP.md` — atlas-driven conveyor/storage/box render рядом с суперкомпьютером.
- `docs/ai/CHIP_EFFECTS_MAP.md` — боевой runtime чип-модификаторов.
- `docs/ai/TALENTS_V2_MAP.md` — монолит talents v2.

## Карта систем
- UI: `docs/ai/SYSTEMS/ui.md`
- Render/Canvas: `docs/ai/SYSTEMS/render.md`
- Assets/JSON: `docs/ai/SYSTEMS/assets.md`
- Combat: `docs/ai/SYSTEMS/combat.md`
- Save/Offline: `docs/ai/SYSTEMS/save.md`
- Achievements: `docs/ai/SYSTEMS/achievements.md`
- World Events: `docs/ai/SYSTEMS/worldEvents.md`
- Fence: `docs/ai/SYSTEMS/fence.md`
- Audio: `docs/ai/SYSTEMS/audio.md`
- Telemetry/Flags: `docs/ai/SYSTEMS/telemetry.md`
- Input: `docs/ai/SYSTEMS/input.md`
- Performance: `docs/ai/SYSTEMS/perf.md`
- Tutorial runtime: `docs/ai/SYSTEMS/tutorial-runtime.md`
- Talents v2 runtime: `docs/talents_v2.md`
- Talents v2 UI: `docs/ui_talents_v2.md`

## Фокус документации на 2026-03-25
- `game.js`: `resizeCanvas()` вычисляет `--ui-scale = max(0.55, min(W/1920, H/1080))` и ставит CSS custom property на `:root`; `draw()` z-order изменён — `drawBoard()` теперь рисуется раньше `drawSupercomputer()` и production line; `claimCrateReward()` сбрасывает `state.nextCrateAt` при claim, а не при spawn.
- `style.css`: adaptive `--ui-scale` CSS block для 10 modal selectors (`levelModal`, `crateModal`, `scModal`, `ughPanel`, `settingsTooltip`, `centerNotification`, `plStorage`, `lessonProgressPanel`); close-buttons не масштабируются (44×44 hit-area).
- `src/mechanics/undergroundHangar.js`: black 2px `#000` border вокруг rounded-rect clip на cell draw.
- `src/render/spriteLoaders.js`: `SupercomputerSprites.load()` нормализует `button.offset {x:10, y:0}` fallback.
- `src/mechanics/crateRuntime.js`: `spawnCrate()` больше не трогает `nextCrateAt`.
- `index.html`: `#plConfirmYes` переструктурирован как `talentResetCooldownAdBtn` shell с ad-icon и `data-i18n="plConfirmYes_label"` label.
- `src/i18n/ru.json`, `src/i18n/en.json`, `src/i18n/fallbackStrings.js`: `plConfirmYes_label` = «Открыть» / «Open» synced.
- `src/ui/productionLineUI.js`: `_showConfirm()` целится в nested `talentResetCooldownAdBtn__label` span.
- `src/i18n/pluralize.js` — новый модуль `Game.I18n.pluralize(n, one, few, many)` для Russian/English mod10/mod100 плюрализации; подключается в `index.html`; используется в `getTankWordKey()` (`game.js`) и `getDismantleTankCountText()` (`src/ui/modals.js`) с inline fallback.
- `game.js`: `getHangarMasterThresholds()` читает achievement defs для config-driven hangar_master thresholds; `computeHangarMasterLevel()` использует их вместо hardcoded порогов; `applyBalScale()` не клампит на `1.35`, полное пропорциональное масштабирование; desktop cellW = `DESKTOP_CELL_BASE(42) * scale` вместо hardcoded `70`.
- Underground hangar FSM: новый лупящий state `hover_idle` между `hover_start` и `hover_end`; `_isClosing` guard предотвращает double-anim при dismiss модалки; `draw()` применяет rounded rect clip перед sprite.
- Tutorial runtime выбирает first available incomplete tutorial step и держит отдельный completion-gate для переходных UI-шагов; основной источник по ordering/activation/completion/pause — `docs/ai/SYSTEMS/tutorial-runtime.md`.
- `index.html` подключает `src/ui/fontFloor.js`: `Game.FontFloor` глобально поднимает floor `12px` для DOM/canvas-текста, но skip-список обязан исключать все close/remove-варианты (`.levelModal__close`, `.crateModal__close`, `.modalClose`, `.chipCraftSlotRemove`, `.lessonProgress__close`, `[data-font-floor-ignore="true"]`).
- `New game` поднимает `productionLine.firstNewGameBoxGuaranteedPending`; первая коробка конвейера гарантированно резолвится в рабочий red `one_big_chip` уровня 1 с валидным `chipId`, отсортированным `sourceComboKey` и 3 уникальными base `modIds` (`1..9`).
- `assets/zombies.json` держит явный числовой `Health` в каждом `types[]`; `ZombieSprites.load()` нормализует `Health/health` в `type.health`, а `makeZombie()` использует это значение раньше формулы из balance.
- Achievements runtime: 10 семейств и 41 reward mode в единой `REWARD_TABLE` внутри `src/mechanics/achievementRewards.js`; новые семейства: `tough_perimeter` (single-tier, `checkPerfectFenceWave()` с `continue` для invalid сегментов), `hangar_master` (5 tiers, первые 15 ячеек, `displayTarget:15` + `hangarMinLevel`), `defense_order` (5 tiers streak, invalidation при merge через `invalidateDefenseOrderEpisode()`); composite reward type (`items[]`) для hangar_master и defense_order; `i18nKey` для popup; `grant()`/`grantByTable()` dispatch; `grantAchievementUpgradePoints()` и `grantAchievementReward()` синхронизируют `TalentsV2.setFreePoints()` в трёх grant-path'ах; `recordModifierTechUnlock()` всегда `recalculateUnlocks()`; debug panel canonical hooks; restore `_unlockedTechs` из `completedModifierTechs`; `ensureState` мержит inferred techs; `reconcileUnlockedTechsFromData()`; stale-episode fallback; CRT/grain overlay; `stable_income` (5 уровней, `moneyEarned`); `resetGameState` `new_game` очищает `_unlockedTechs`; state shape: `totalDefenseOrderStreak` в achievements, `defenseOrderStreakCount` в stats.
- `assets/levelreward.json` — data-driven конфиг наград за повышение уровня суперкомпьютера: gold formula (`tankCost` = `50*2^(L-1)` или `fixed`), per-level overrides, milestone upgrade points и damage points; загружается в `boot()`, передаётся через `LevelRewardConfig` в `progression.js` и `levelFlow.js`; при отсутствии файла fallback полностью backward-compatible.
- Модалка ускорения технологий использует `_getTechAccelRates()`: для 2ч технологий `dust/chip/fragment = 2/20/6`, для 5ч — `1/10/1`; кремниевая пыль встроена в тот же accel-grid и делит общий cap `96%`.
- `techAccelChip--disabled` и fallback i18n для accel UI синхронизированы между `ru.json`, `en.json`, `fallbackStrings.js`, чтобы summary/limit/dust-строки не расходились до загрузки JSON.
- Модалка ящика теперь оформлена как `Военная помощь`: shell открывает `Game.UIModals.openCrateModal(...)`, а rewarded-ad stub в `src/ui/adService.js` capture-слушателем gate-ит `#crateGet` и пропускает реальный `claimCrateReward()` только после успешного ad-result.
- Post-merge cache-bust для этой связки живёт в `index.html`: `style.css`, `src/ui/adService.js`, `src/i18n/fallbackStrings.js` и `src/ui/modals.js` используют общий token `20260323-branch3-achievements-crate-aid`.
- Close-кнопки `crate/level/modal/lesson` и SC/talent-варианты используют общий 44×44 pseudo-element X-pattern; `scModal__close` и `#talentOverlay .modalClose` — зелёная ветка того же контракта.
- Для этих правок читать в порядке: `docs/ai/SYSTEMS/achievements.md` → `docs/ai/SYSTEMS/assets.md` → `docs/ai/SPRITE_LOADERS_MAP.md` → `docs/ai/SYSTEMS/ui.md` → `docs/ai/HANGAR_CHIPS_UI_MAP.md`.

## Hotspot summary
- Кодовые hotspot-файлы: `game.js`, `index.html`, `style.css`, `src/ui/supercomputerMenu.js`, `src/ui/hangarChipsUI.js`, `src/render/spriteLoaders.js`, `src/persistence/storage.js`.
- Документационные hotspot-файлы: `docs/ai/INDEX.md`, `docs/ai/SYSTEMS/ui.md`, `docs/ai/SYSTEMS/render.md`, `docs/ai/SYSTEMS/assets.md`, `docs/ai/CHANGELOG.md`.
