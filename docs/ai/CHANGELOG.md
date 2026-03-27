# Журнал изменений (A2DP)

## 2026-03-27
- **Документация: shared post-merge update для master UI scale contract в hybrid Canvas + Phaser runtime (`game.js`, `style.css`, `index.html`, `src/ui/tutorialRuntime.js`, `src/ui/undergroundHangarUI.js`, `src/phaser/hudAdapter.js`, `src/phaser/modalAdapter.js`, `src/phaser/sceneOverlayManager.js`)**
  - Обновлены `docs/ai/PROJECT_MAP.md`, `docs/ai/GAME_JS_MAP.md`, `docs/ai/STYLE_CSS_MAP.md`, `docs/ai/SYSTEMS/ui.md`, `docs/ai/SYSTEMS/phaser.md`, `docs/ai/ARCHITECTURE.md`, `docs/ai/CHANGELOG.md`.
  - Зафиксированы: `resizeCanvas()` теперь документирован как единственный source-of-truth для `--ui-scale = max(0.4, min(displayW/1920, displayH/1080))`; `readMasterUiScale()` и `syncHybridUiScale()` синхронизируют DOM/CSS с `HudAdapter`, `ModalAdapter` и `SceneOverlayManager`.
  - Зафиксированы: охват поверхностей включает static DOM shells, dynamic help/confirm/tooltip/notification families, top-right terminal, HUD, tutorial pointer/bubble, underground hangar canvas previews и Phaser overlay/HUD seam.
  - Зафиксированы: startup path снова вызывает `boot().catch(...)`, поэтому `resizeCanvas()` срабатывает на старте страницы; `index.html` использует split cache-bust `style.css?v=20260327-branch1-master-scale-dom-contract` и `game.js?v=20260327-faildetector-ui-scale-startup`.
  - Зафиксированы инварианты: close/help controls не меньше `44×44`, глобальный font floor остаётся `12px`, drag threshold остаётся `6px`, а hybrid runtime продолжает делить один scale token между legacy Canvas и Phaser overlays.
- **Phaser 3 migration: Phase 4 — Parity & Rollout complete**
  - Созданы 4 новых модуля: `parityHarness.js`, `parityGate.js`, `rolloutController.js`, `legacyCleanupManifest.js` в `src/phaser/`.
  - `ParityHarness`: A/B snapshot/comparison engine (6 check categories, history до 50 записей).
  - `ParityGate`: automated go/no-go gate — 6 categories (structural/render/modal/hud/scene/flags), проверяет 16 scenes, 12 layers, 18 render IDs, 13 modals, 5 HUD elements, 14 overlay scenes.
  - `RolloutController`: 4-phase progression (off→shadow→overlay→phaser); advance to `phaser` blocked unless ParityGate passes; propagates modes to RenderRegistry/ModalAdapter/HudAdapter.
  - `LegacyCleanupManifest`: inventory 17 legacy code paths across 6 categories.
  - Wiring в `game.js initEngineAdapterPhase1()`: ParityHarness (enabled if isPhaser), ParityGate, RolloutController.
  - 4 `<script>` tags добавлены в `index.html`, cache-bust обновлён на `phase4-parity-rollout`.
  - Обновлены `docs/ai/INDEX.md`, `docs/ai/ARCHITECTURE.md`, `docs/ai/PROJECT_MAP.md`, `docs/ai/SYSTEMS/render.md`.
  - Создан `docs/ai/SYSTEMS/phaser.md` — полная документация Phaser 3 migration подсистемы.
  - 55 новых тестов Phase 4 (all pass); regression: 84 tests.js + 467 migration tests pass.
  - **Все фазы 0–4 миграции на Phaser 3 завершены.**

## 2026-03-26
- **Документация: shared post-merge update для achievement popup close contract, debuff overlay scale-path, supercomputer root-tile resize refresh, adaptive hangar modal vars и narrow-screen terminal shell (`game.js`, `index.html`, `style.css`, `src/ui/supercomputerMenu.js`, `src/i18n/ru.json`, `src/i18n/en.json`, `src/i18n/fallbackStrings.js`)**
  - Обновлены `docs/ai/SYSTEMS/ui.md`, `docs/ai/SUPERCOMPUTER_MENU_MAP.md`, `docs/ai/STYLE_CSS_MAP.md`, `docs/ai/CHANGELOG.md`.
  - Зафиксированы: achievement popup использует `scModal__close` как визуальный X-contract, но accessibility focus идёт `Claim -> Dismiss -> X`, а обе action-кнопки popup остаются pure-close path без reward-side effects.
  - Зафиксированы: `debuffIconScale` теперь масштабирует не только status icons, но и белый expiry wedge/dot overlay; канонический read-path по-прежнему идёт из локального `ZombieSprites`, а не через `window.Game.Sprites.ZombieSprites`.
  - Зафиксированы: `refreshRootTilesLayout()` переиспользует layout tuning и `normalizeRootTilesSize()` на `window.resize`, но только пока supercomputer controller открыт в root-view; root docs переименованы из `tank/wall` в более точный vehicle/wall phrasing.
  - Зафиксированы: `.hangarChipsModal` держит scale-aware внутренние размеры через `--modsHangar*` vars, а top-right terminal shell документирован с узким header-contract для `<=420px` и mobile width clamp для правой панели.
- **Документация: shared post-merge update для ui-scale/cache-bust, early_capital achievements и debuff-icon read path (`style.css`, `game.js`, `index.html`, `src/mechanics/achievements.js`, `src/mechanics/achievementRewards.js`, `src/i18n/ru.json`, `src/i18n/en.json`, `src/i18n/fallbackStrings.js`)**
  - Обновлены `docs/ai/INDEX.md`, `docs/ai/SYSTEMS/ui.md`, `docs/ai/SYSTEMS/achievements.md`, `docs/ai/STYLE_CSS_MAP.md`, `docs/ai/CHANGELOG.md`.
  - Зафиксированы: shared cache-bust token `20260326-branch1-ui-scale-early-capital` покрывает `style.css`, `src/ui/adService.js`, `src/i18n/fallbackStrings.js`, `src/ui/modals.js` и `game.js`, а `achievementRewards.js` получает тот же token через lazy loader `ACHIEVEMENT_REWARDS_SCRIPT_SRC`.
  - Зафиксированы: `resizeCanvas()` теперь документирован с floor `--ui-scale = 0.40`, а adaptive CSS map расширен на base + extended blocks для modal shells, HUD и big menu без масштабирования close-controls.
  - Зафиксированы: `early_capital` family добавляет 5 achievement tiers по `currentBalance`; canonical sync-path живёт в `syncCurrentBalanceAchievements()`, отдельно от `stable_income` lifetime-income ladder.
  - Зафиксированы: status/debuff icon scale/opacity в `game.js` читаются из локального `ZombieSprites` singleton напрямую в draw-path; чтение из `window.Game.Sprites.ZombieSprites` в этом репозитории невалидно и silently теряет config.

## 2026-03-25
- **Документация: shared post-merge update для --ui-scale adaptive scaling, draw() z-order reorder, crate timer claim flow, underground hangar border, button.offset normalization и storage confirm Yes→Open (`game.js`, `style.css`, `src/mechanics/undergroundHangar.js`, `src/render/spriteLoaders.js`, `src/mechanics/crateRuntime.js`, `index.html`, `src/i18n/ru.json`, `src/i18n/en.json`, `src/i18n/fallbackStrings.js`, `src/ui/productionLineUI.js`)**
  - Обновлены `docs/ai/GAME_JS_MAP.md`, `docs/ai/STYLE_CSS_MAP.md`, `docs/ai/SPRITE_LOADERS_MAP.md`, `docs/ai/SYSTEMS/render.md`, `docs/ai/SYSTEMS/ui.md`, `docs/ai/INDEX.md`, `docs/ai/CHANGELOG.md`.
  - Зафиксированы: `resizeCanvas()` вычисляет `--ui-scale` как `max(0.55, min(displayW/1920, displayH/1080))` и ставит CSS custom property на `:root`; adaptive CSS block масштабирует 10 modal-селекторов (`levelModal`, `crateModal`, `scModal`, `ughPanel`, `settingsTooltip`, `centerNotification`, `plStorage`, `lessonProgressPanel`).
  - Зафиксированы: `draw()` z-order изменён — `drawBoard()` теперь рисуется раньше `drawSupercomputer()` и production line, а не после них.
  - Зафиксированы: `claimCrateReward()` теперь сбрасывает `state.nextCrateAt` при claim, а не при spawn; `spawnCrate()` в `crateRuntime.js` больше не трогает `nextCrateAt`.
  - Зафиксированы: underground hangar cell `draw()` добавляет black 2px `#000` border вокруг rounded-rect clip после sprite, перед badge.
  - Зафиксированы: `SupercomputerSprites.load()` нормализует `button.offset` (`x`, `y`) из `assets/supercomputer.json` с fallback `{x:10, y:0}`.
  - Зафиксированы: storage confirm `#plConfirmYes` переструктурирован как `talentResetCooldownAdBtn` shell с ad-icon span и `data-i18n="plConfirmYes_label"` label span; `_showConfirm()` обновляет nested label, а не `textContent` кнопки.

## 2026-03-24
- **Документация: shared post-merge update для REWARD_TABLE i18nKey, TalentsV2 sync при upgradePoints, inference race fix и chipUpgradeCard layout (`src/mechanics/achievementRewards.js`, `src/mechanics/achievements.js`, `game.js`, `src/i18n/ru.json`, `src/i18n/en.json`, `src/i18n/fallbackStrings.js`, `style.css`)**
  - Обновлены `docs/ai/SYSTEMS/achievements.md`, `docs/ai/SYSTEMS/ui.md`, `docs/ai/INDEX.md`, `docs/talents_v2.md`, `docs/ai/CHANGELOG.md`.
  - Зафиксированы: все 23 записи `REWARD_TABLE` теперь несут `i18nKey` для автоматического i18n-lookup в achievement popup; popup render использует `entry.i18nKey` с fallback на `def.rewardKey`.
  - Зафиксированы: `grantAchievementUpgradePoints()` в `achievementRewards.js` (L103-L116) и `achievements.js` (L386-L398), а также `grantAchievementReward()` в `game.js` (L9497-L9515) синхронизируют `TalentsV2.setFreePoints()` после инкремента `freePoints`.
  - Зафиксированы: `recordModifierTechUnlock()` теперь всегда вызывает `recalculateUnlocks()` даже когда `ensureState` уже infer'ил текущую технологию — фикс inference race.
  - Зафиксированы: `.chipUpgradeCard` height увеличена на 20px (`calc(var(--chipLabelCardHeight, 130px) + 40px)`), `.chipUpgradeCard__name` max-height увеличена до `60px` для вмещения 3-строчных названий модификаторов.
  - Зафиксированы: `talentCantBuy_noPoints` текст обновлён во всех i18n-источниках (ru.json, en.json, fallbackStrings.js).

## 2026-03-23
- **Документация: shared post-merge update для duty_shift / track_cleanup achievements и save-safe counters (`game.js`, `src/mechanics/achievements.js`, `src/mechanics/achievementRewards.js`, `src/persistence/initialState.js`, `src/persistence/storage.js`, `src/i18n/ru.json`, `src/i18n/en.json`, `src/i18n/fallbackStrings.js`, `Test/pack4/tutorial_first_run_runtime.test.js`)**
  - Обновлены `docs/ai/SYSTEMS/achievements.md`, `docs/ai/PROJECT_MAP.md`, `docs/ai/SYSTEMS/save.md`.
  - Зафиксированы: новые achievement families `duty_shift` (`1/4/9` drones) и `track_cleanup` (`1/5/10/25/50` attack waves without repair), canonical gameplay hooks через `addDron(level)` и attack-mode episode tracker, а также reset streak на manual repair и на реальный repair-drone HP delta.
  - Зафиксированы: persistence contract теперь включает `totalDroneAcquisitions`, `totalNoRepairAttackWaveStreak`, mirrored `droneAcquisitionsCount/noRepairAttackWaveStreakCount` и reset transient no-repair runtime перед restore/apply.
  - Зафиксированы: `dutyShiftDamage20000` семантически выдаёт `20000 damage points`, а regression pack `TUT-8R..TUT-8W` покрывает ladders, restore/recalc и reward dedupe.

- **Документация: shared post-merge update для achievement rewards, zombie Health contract, crate military-aid modal и tech accel cap 96% (`assets/zombies.json`, `src/render/spriteLoaders.js`, `game.js`, `src/ui/hangarChipsUI.js`, `index.html`, `style.css`, `src/i18n/ru.json`, `src/i18n/en.json`, `src/i18n/fallbackStrings.js`, `src/mechanics/achievements.js`, `src/mechanics/achievementRewards.js`, `src/ui/modals.js`, `src/ui/adService.js`)**
  - Обновлены `docs/ai/INDEX.md`, `docs/ai/PROJECT_MAP.md`, `docs/ai/SYSTEMS/achievements.md`, `docs/ai/SYSTEMS/assets.md`, `docs/ai/SYSTEMS/ui.md`, `docs/ai/SPRITE_LOADERS_MAP.md`, `docs/ai/HANGAR_CHIPS_UI_MAP.md`, `docs/ai/STYLE_CSS_MAP.md`, `docs/ai/GAME_JS_MAP.md`.
  - Зафиксированы: `ACHIEVEMENT_FAMILIES` и `flattenAchievementFamilies()` остаются canonical contract для achievement order/grouping, fence-награды идут через lazy-loaded `src/mechanics/achievementRewards.js`, а unlock-popup остаётся informational-only, потому что reward reconcile выполняется до `queueAchievementPopup(...)`.
  - Зафиксированы: `assets/zombies.json` теперь рассматривается как explicit HP-contract через `types[].Health`; `ZombieSprites.load()` нормализует `Health/health` в `type.health`, а `makeZombie()` использует это значение раньше балансной HP-формулы.
  - Зафиксированы: accel modal использует hard cap `96%`, модалка ящика оформлена как `Военная помощь` и claim CTA gate-ится rewarded-ad capture-stub'ом в `src/ui/adService.js`, а index-level cache-bust группа `20260323-branch3-achievements-crate-aid` покрывает `style.css`, `src/ui/adService.js`, `src/i18n/fallbackStrings.js` и `src/ui/modals.js`.

- **Документация: shared post-merge update для achievements runtime, tech reward flow и save-safe counters (`src/mechanics/achievements.js`, `game.js`, `src/ui/hangarChipsUI.js`, `src/persistence/initialState.js`, `src/persistence/storage.js`, `src/i18n/ru.json`, `src/i18n/en.json`, `src/i18n/fallbackStrings.js`, `Test/pack4/tutorial_first_run_runtime.test.js`)**
  - Обновлены `docs/ai/PROJECT_MAP.md`, `docs/ai/SYSTEMS/achievements.md`, `docs/ai/SYSTEMS/save.md`, `docs/ai/HANGAR_CHIPS_UI_MAP.md`.
  - Зафиксированы: achievement ladders `manualFenceRepairs` (`1/50/200/1000/10000`) и `modifierTechUnlocks` (`1/3/8/16`), dedupe по `achievements.completedModifierTechs` и one-shot reward contract через `achievements.rewarded`.
  - Зафиксированы: save shape рассматривает `rewarded`, `totalManualFenceRepairs`, `totalModifierTechUnlocks`, `completedModifierTechs` и mirrored `state.stats.*Count` как единый persistence-contract; restore/apply делают only-once backfill для self-managed tech rewards.
  - Зафиксированы: оба tech unlock path в `src/ui/hangarChipsUI.js` routed через `Game.onModifierTechnologyUnlocked(modId)` после успешного unlock, а regression pack `tutorial_first_run_runtime.test.js` покрывает thresholds, single-increment repair hook, i18n sync и save-safe reward restore.

- **Документация: shared post-merge update для talent reset cooldown modal, storage header right-actions и усиленного wobble talent edges (`game.js`, `index.html`, `style.css`, `src/ui/modals.js`, `src/ui/talentOverlayRenderer.js`, `src/i18n/ru.json`, `src/i18n/en.json`, `src/i18n/fallbackStrings.js`)**
  - Обновлены `docs/ai/SYSTEMS/ui.md`, `docs/ai/STYLE_CSS_MAP.md`, `docs/ui_talents_v2.md`.
  - Зафиксированы: footer-кнопка `Сбросить улучшения` больше не меняет label на cooldown; при active cooldown открывается отдельная `#talentResetCooldownModal` с timer-text, dismiss-кнопкой, ad-style refresh-stub CTA и синхронными i18n-ключами в `ru/en/fallback`.
  - Зафиксированы: `#resetTalentsModal` и cooldown modal используют общий symmetric padding contract и green `scModal__close`, а `src/ui/modals.js` остаётся canonical shell-upgrade точкой для `Да/Нет/X` и focus routing.
  - Зафиксированы: header production storage теперь собирает help + close в правый wrapper `.plStorage__headerActions`, title получает больший top padding, а talent-tree `ready/active` edges используют более заметный wobble/shake через per-edge `--talent-edge-wobble-duration`.

## 2026-03-22
- **Документация: shared post-merge update для escape/menu priority, talents overlay и production storage UI (`game.js`, `index.html`, `src/ui/supercomputerMenu.js`, `src/ui/productionLineUI.js`, `src/ui/talentOverlayRenderer.js`, `style.css`, `src/i18n/ru.json`, `src/i18n/en.json`, `src/i18n/fallbackStrings.js`)**
  - Обновлены `docs/ai/SYSTEMS/ui.md`, `docs/ai/SUPERCOMPUTER_MENU_MAP.md`, `docs/ai/STYLE_CSS_MAP.md`.
  - Зафиксированы: глобальный Escape-routing теперь уважает higher-priority menu locks и не togglит small menu поверх `supercomputer/achievements/productionStorage/undergroundHangar/critical/bigMenu`; underground hangar остаётся первым close-target по Escape.
  - Зафиксированы: talents overlay использует straight center-to-center SVG edges, locked nodes читаются через neutral overlay вместо общего dimming, а applied/maxed contract остаётся зелёный shell + orange icon-overlay только для `maxed`.
  - Зафиксированы: production storage header теперь включает left help CTA, help modal переиспользует общий SC accordion shell, drag работает через body-level preview `.plStorage__dragPreview`, empty cells остаются без placeholder glyph, filled cells держат plain-text level badge, а `index.html` использует единый cache-bust `?v=20260322-ui-postmerge` для синхронизированных static assets.

- **Документация: update после post-merge правки reset talents modal fallback-shell (`index.html`)**
  - Обновлён `docs/ai/SYSTEMS/ui.md`.
  - Зафиксированы: fallback DOM `#resetTalentsModal` теперь обязан совпадать с paid confirm contract (`500$`, primary CTA `Да`), canonical upgrade-path живёт в `src/ui/modals.js` и инжектит/синхронизирует `Да/Нет/X`, а `index.html` держит cache-busting query `?v=20260322-reset-talents-modal`, чтобы браузер не оставался на устаревшем runtime.

## 2026-03-21
- **Документация: post-merge update для talents overlay (`src/ui/talentOverlayRenderer.js`, `style.css`)**
  - Обновлены `docs/ui_talents_v2.md`, `docs/ai/SYSTEMS/ui.md`, `docs/ai/STYLE_CSS_MAP.md`.
  - Зафиксированы: базовые связи дерева теперь явно серые и заметны до покупки; зелёный glow/pulse остаётся только на outgoing edges от прокачанных талантов; anchor линий считается от центра `.talentNodeIcon` к центру `.talentNodeIcon`.
  - Зафиксированы: `active` edge больше не использует travelling dash/particle flow и вместо этого анимируется через pulse + jitter как энергия/ток; вертикальные отступы рядов внутри колонок уменьшены; `maxed`-талант получает orange overlay именно на icon-shell, а partial applied state остаётся только зелёным.

## 2026-03-20
- **Документация: update после правок underground hangar transfer CTA и talent overlay visuals (`src/ui/undergroundHangarUI.js`, `style.css`)**
  - Обновлены `docs/ai/SYSTEMS/ui.md`, `docs/ai/STYLE_CSS_MAP.md`.
  - Зафиксированы: `transferAll` больше не сидит в правой колонке underground hangar и рендерится как отдельная centered lane между верхним и подземным блоками; CTA осталась icon-only `44×44`, сохраняет `aria-label/title/data-ui-tooltip` и зелёную стрелку `#4af626`.
  - Зафиксированы: talent overlay держит icon-shell `40×40`, applied-node получает явный внешний border и matching inner highlight `#4af626`, а tree edges используют более тонкий bright-green pulse/dash контракт без добавления лишнего scrollbar.

## 2026-03-12
- **Tutorial runtime: modal-pause, data-driven step config, selective lock overlay (`src/config/tutorialSteps.js`, `src/ui/tutorialRuntime.js`, `src/persistence/initialState.js`, `index.html`, `style.css`, `src/i18n/ru.json`, `src/i18n/en.json`, `src/i18n/fallbackStrings.js`, `Test/pack4/tutorial_first_run_runtime.test.js`)**
  - Первый урок обучения переведён на data-driven config `src/config/tutorialSteps.js`: состояние tutorial теперь использует schema `version: 2`, отдельный `bubbleOpen` per-step и готово к добавлению следующих шагов через конфиг.
  - Tutorial bubble больше не завершает шаг по `×`: `Продолжить` и `×` только закрывают bubble, pointer остаётся до фактического действия шага, а `Выключить обучение` завершает tutorial целиком.
  - Tutorial runtime теперь захватывает existing `PauseManager.createPauseManager()` и включает `criticalPause` на время открытого bubble, а CRT/grain overlay включается через `body.tutorial-modal-open` тем же паттерном, что и для других модалок.
  - Во время активного шага tutorial runtime блокирует нецелевые DOM/canvas interactions: доступен только target starter tank, tutorial controls и permanent exceptions (`Настройки`, `Свернуть`, `Развернуть терминал`), а заблокированные элементы получают lock overlay + tooltip.

## 2026-03-10
- **Workshop: disassemble empty overlay + drag-drop fix + confirm modal + reprogram subtab (`src/ui/hangarChipsUI.js`, `style.css`, `src/i18n/ru.json`, `src/i18n/en.json`, `src/i18n/fallbackStrings.js`)**
  - `Переработка чипов` получила третью nested-подвкладку `Перепрограммировать`: фрагмент выбирается из инвентаря, целевое свойство берётся из dropdown только по текущему tech-progress, обмен стоит `2` ед. кремниевой пыли и меняет один фрагмент на другой без обхода unlock-цепочек.
  - Во вкладке `Разобрать` пустое состояние теперь использует тот же серый overlay-паттерн, что и `Создать чип`: centered `chipCraftPlaceholderSvg` + текст `Перетащите сюда чип`, overlay скрывается сразу после добавления хотя бы одного чипа и возвращается при очистке слотов.
  - Drag-and-drop в `Разобрать` теперь резолвит drop-zone локально в активной recycle-panel, поэтому drop из списка слева больше не попадает в скрытый sibling-panel при совпадающих DOM id.
  - Кнопка `Разобрать` теперь сначала открывает confirm modal в общем `techModal__dialog` shell с `modalClose scModal__close`, а реальное разложение на 3 фрагмента происходит только после явного подтверждения.

- **Workshop: reset transient-state, unit dust fragments, stable drag ghost, normalized disassemble preview, single-glyph modal close (`src/ui/hangarChipsUI.js`, `src/ui/supercomputerMenu.js`, `style.css`, `Test/pack1/newGamePopupReset.test.js`)**
  - `switchHangarTab()` / `switchWorkshopSubTab()` / `switchChipRecycleSubTab()` и закрытие окна ангара теперь вызывают `resetTransientUiState()`, что очищает `_dustSelected`, `_craftSlots` и reagent dust при уходе со вкладки/модалки.
  - Во вкладке `Распылить` фрагменты чипов рендерятся по одной единице с уникальным `data-dust-key`, поэтому можно распылить ровно один фрагмент без распыления всего стека.
  - Drag ghost карточки в `Улучшение чипов` клонирует исходную карточку с её реальными размерами, поэтому текст и ширина не схлопываются во время перетаскивания.
  - Во вкладке `Разобрать` preview area выравнивает карточки от верхнего края и раскладывает их равномерной grid-сеткой одинакового размера, без больших пустых зон.
  - Все modal close-кнопки переведены на единый одинарный glyph `✕` вместо пары pseudo-bars; green SC/talent variant сохранён, hover/active снова дают лёгкое движение без потери hit-area 44×44.

## 2026-03-09 (session 2)
- **UX: 5 UI-правок — close-hover, techModal gap, hscroll, workshop inventory (`style.css`, `src/ui/hangarChipsUI.js`)**
  - Fix 1: Все close-кнопки (`.crateModal__close`, `.levelModal__close`, `.scModal__close`, `.modalClose`, `#talentOverlay .modalClose`, `.modalClose.scModal__close`, `.lessonProgress__close`) получили `transform:none !important` в `:hover`-правиле. Корневая причина: `buttonBehavior.js/decorateTree()` добавляет `uiButtonBehavior` ко ВСЕМ `<button>`, что давало `transform: translateY(-2px) scale(1.01)` на hover; combined с `overflow:hidden` на close-кнопках это обрезало псевдоэлементный X.
  - Fix 2: `.techModal__btns` получил `margin-top:5px`. Кнопки находятся вне `.techModal__footer`, поэтому `gap:12px` footer-а на них не действовал.
  - Fix 3: `.techAccelGridWrap` получил `overflow-x:hidden` — запрет горизонтального скролла в accel grid.
  - Fix 4+5 CSS: `.chipCraftLayout:not(.chipCraftLayout--singleCol) .chipCraftInvGrid { grid-template-columns:1fr }` — один чип в ряду в вкладках `Создание чипов` и `Разобрать` без изменения JS-flow.
  - Fix 4+5 JS: весь `chipCraftBottomBar` (включая `chipCraftDustResource`) перенесён в `if (isDustView)` guard — полностью отсутствует для assemble/disassemble видов: [src/ui/hangarChipsUI.js](../../../src/ui/hangarChipsUI.js#L2514-L2527).

## 2026-03-09
- **Документация: update после workshop recycle, storage header и unified X hover fix**
  - Обновлены `docs/ai/SYSTEMS/ui.md`, `docs/ai/HANGAR_CHIPS_UI_MAP.md`, `docs/ai/STYLE_CSS_MAP.md`.
  - Зафиксированы: третья под-вкладка Мастерской `workshopTabChipRecycle`, nested recycle-tabs `Распылить/Разобрать`, split assemble/recycle в `renderChipCraftPanel()`, single-column dust view, bordered `techAccelGridWrap` со summary под dust-row, новый header `Производственный склад` с правым `scModal__close`, а также отсутствие hover/active transform-сдвигов у unified close-кнопок.

- **Документация: update после fix close-кнопок, guaranteed red chip и tech accel dust planner**
  - Обновлены `docs/ai/INDEX.md`, `docs/ai/PROJECT_MAP.md`, `docs/ai/SYSTEMS/render.md`, `docs/ai/SYSTEMS/save.md`, `docs/ai/SYSTEMS/ui.md`, `docs/ai/HANGAR_CHIPS_UI_MAP.md`, `docs/ai/STYLE_CSS_MAP.md`.
  - Зафиксированы: гарантированная первая `new_game` коробка теперь выдаёт канонический рабочий red chip (`chipId`, `sourceComboKey`, `3` уникальных base `modIds`), accel modal показывает строку пыли как `доступно / выбрано`, live-summary `{pct}/{total}/{left}` и применяет тот же выбранный объём, а `fontFloor` больше не вмешивается в unified close-кнопки (`crate/level/modal/lesson/sc`).
  - Внешний update `c:\Users\hisok\.agents\.github\skills\spec-refiner\SKILL.md` сознательно не документировался как часть game repo.

## 2026-03-07
- **Документация: update после гаранта первого большого чипа, tech accel dust и unified close-кнопок**
  - Обновлены `docs/ai/PROJECT_MAP.md`, `docs/ai/INDEX.md`, `docs/ai/SYSTEMS/render.md`, `docs/ai/SYSTEMS/save.md`, `docs/ai/SYSTEMS/ui.md`, `docs/ai/HANGAR_CHIPS_UI_MAP.md`, `docs/ai/SUPERCOMPUTER_MENU_MAP.md`, `docs/ai/STYLE_CSS_MAP.md`.
  - Зафиксированы: `productionLine.firstNewGameBoxGuaranteedPending` и гарантия `one_big_chip` для первой коробки после true `new_game`; accel modal технологий с кремниевой пылью, ставками `2/20/6` для 2ч tech и `1/10/1` для 5ч tech, общим cap `95%` и badge `Лимит`; единый 44×44 close-pattern `scModal__close` для storage/supercomputer/talent tree.

- **Документация: update после UI-правок font floor, SC modal close и chip label wrapping**
  - Обновлены `docs/ai/PROJECT_MAP.md`, `docs/ai/INDEX.md`, `docs/ai/SYSTEMS/ui.md`, `docs/ai/HANGAR_CHIPS_UI_MAP.md`, `docs/ai/STYLE_CSS_MAP.md`, `docs/ai/GAME_JS_MAP.md`.
  - Зафиксированы: глобальный runtime floor `12px` для DOM/canvas-текста через `src/ui/fontFloor.js` с skip-листом для close/remove-контролов; общий close-скин `scModal__close` для supercomputer/hangar/tank-wall/storage modal; grain overlay склада коробок через `body.pl-storage-open`; branch-driven иконки stage active abilities через `getTalentV2ActiveIconUrlByBranch()` с CSS fallback `activeOff/activeDef/activeEco`; полные названия чипов/фрагментов с переносом только по ` + ` и унифицированным карточным размером.

## 2026-03-06
- **Документация: update после правок New Game baseline, computer level 0 и buildTank timing**
  - Обновлены `docs/ai/PROJECT_MAP.md`, `docs/ai/INDEX.md`, `docs/ai/ARCHITECTURE.md`, `docs/ai/GAME_JS_MAP.md`, `docs/ai/SYSTEMS/save.md`, `docs/ai/SYSTEMS/render.md`, `docs/ai/SYSTEMS/assets.md`, `docs/ai/SYSTEMS/ui.md`, `docs/ai/PRODUCTION_LINE_RENDER_MAP.md`, `docs/ai/HANGAR_CHIPS_UI_MAP.md`, `docs/ai/STYLE_CSS_MAP.md`.
  - Зафиксированы: `New game` как отдельный reset-path (`0` free talent points, `computerLevel=0`, `xpToNext=50`), partial reset snapshot без потери `damagePoints/computerLevel`, purchase-driven root `buildTank` с длительностью из `assets/tanks.json -> tankPrintDurationSec`, data-driven `conveyorBox.offset.x/y`, unclipped craft remove-cross во вкладке `Разобрать`.

- **Документация: update после правок суперкомпьютера, conveyor box и мастерской чипов**
  - Перепроверены реальные диапазоны строк в больших map-файлах `HANGAR_CHIPS_UI_MAP.md`, `STYLE_CSS_MAP.md`, `SPRITE_LOADERS_MAP.md`.
  - Добавлен новый map-файл `docs/ai/PRODUCTION_LINE_RENDER_MAP.md` для `src/render/productionLineRender.js`.
  - Обновлены `docs/ai/PROJECT_MAP.md`, `docs/ai/INDEX.md`, `docs/ai/ARCHITECTURE.md`, `docs/ai/SYSTEMS/render.md`, `docs/ai/SYSTEMS/assets.md`, `docs/ai/SYSTEMS/ui.md`, `docs/configs.md`.
  - Зафиксированы: runtime-активация `buildTank`, отдельный atlas `conveyor_box_atlas.png`, две стадии печати коробки `printLow/printHigh`, bottom-up reveal, craft-slot inventory-card shell и игровые close/remove controls.

- **Документация: полная актуализация agent docs + map-файлы для монолитов**
  - Добавлен `docs/ai/PROJECT_MAP.md` как главная карта проекта.
  - Добавлены map-файлы: `STYLE_CSS_MAP.md`, `HANGAR_CHIPS_UI_MAP.md`, `SUPERCOMPUTER_MENU_MAP.md`, `SPRITE_LOADERS_MAP.md`, `CHIP_EFFECTS_MAP.md`, `TALENTS_V2_MAP.md`.
  - Обновлены `INDEX.md`, `ARCHITECTURE.md`, `GAME_JS_MAP.md`, `SYSTEMS/render.md`, `SYSTEMS/ui.md`, `SYSTEMS/assets.md`, `index.yaml`.
  - Зафиксированы новые инварианты: kill-driven conveyor work cycle, per-state supercomputer `effects[]`, верхний overlay HP bar суперкомпьютера, отдельная dashed-рамка future chip preview.

- **Supercomputer render: расширена схема `assets/supercomputer.json` и production line runtime**
  - `assets/supercomputer.json`: для root-анимаций добавлены per-animation `scale` и `effects`; поддержаны preset-эффекты `vibration`, `vibrationStrong`, `sway`, `wobble`, `float`, `pulse`.
  - Добавлены optional-секции `conveyor` и `storageCell` с собственными `atlas`/`offset`/`animations`; legacy alias `storage` и fallback-поведение сохранены.
  - `src/render/spriteLoaders.js`: `SupercomputerSprites` нормализует part-конфиги, умеет возвращать `getAtlasImage(part)` и `getPartConfig(part)`.
  - `src/render/productionLineRender.js`: layout и hitbox production line теперь зависят от конфигурации частей, conveyor поддерживает состояния `idle/work`, storage cell — `idle/hover`.
  - `game.js`: draw суперкомпьютера применяет animation-level эффекты/scale и синхронизирует hover/state production line через отдельный runtime-контракт.

- **Механика: Авто-апгрейд modIds новых чипов**
  - Новая функция `applyTechUpgradesToModIds(modIds)` в `hangarChips.js`: при получении нового чипа его modIds автоматически обновляются до максимального разблокированного уровня по TECH_TREE.
  - `addPlayerChip()` в `hangarChipsUI.js` вызывает `applyTechUpgradesToModIds` перед добавлением в инвентарь.

- **UI: Объединённый список в модалке ускорения технологий**
  - Чипы и фрагменты теперь отображаются в одном общем гриде вместо двух раздельных секций в `_showTechAccelModal()`.

- **UI: Кнопки действий внутри drop-зоны**
  - Кнопки режимов («Разобрать»/«Создать чип») и кнопка Execute перемещены внутрь `chipCraftDropZone`. Отображаются только при наличии элементов в слотах.

- **UI: Drag-drop из инвентаря в craft-зону**
  - Реализован pointer-based drag-drop: при перетаскивании чипа автоматически переключается режим на «Разобрать», при перетаскивании фрагмента — на «Создать чип».
  - Новая функция `_addItemToSlot(itemEl, srcType)` с авто-определением режима.

- **UI/UX: craft preview приведён к паттерну inventory-карточек**
  - `src/ui/hangarChipsUI.js`: занятые craft-слоты и future-chip preview рендерятся через общий карточный паттерн `chipCraftSlotCard`.
  - `style.css`: remove-кнопка в craft-слоте переведена из simple red circle в game-styled micro-close control; добавлены footer-title/badge состояния для slot/result cards.
  - `docs/ai/SYSTEMS/ui.md`, `docs/ai/HANGAR_CHIPS_UI_MAP.md`: зафиксированы новые UX-инварианты craft-зоны.

- **UI: Кнопка «Распылить» зафиксирована внизу**
  - CSS: `.chipCraftBottomBar` — `margin-top:auto; flex-shrink:0` для привязки к нижней части панели.
  - CSS: `.chipCraftInvGrid` — `flex:1 1 auto` вместо `max-height:350px`.

- **UI: Клик по карточке в dust mode**
  - Нажатие на любую область карточки чипа/фрагмента в режиме «Распылить» теперь переключает чекбокс выбора.
  - Новая вспомогательная функция `_toggleDustCheckbox(cb)`.

- **Баг-фикс: Каскадные снаряды для tech-upgraded модов**
  - `_getCascadeProjectileCount()` в `chipEffects.js` теперь корректно обрабатывает моды 15 (Triple Shot → 3), 16 (Hex Shot → 6), 25 (Medium Combo), 26 (Large Combo) вместо `default: return 1`.

## 2026-03-05
- **UI: Реструктуризация вкладок ангара**
  - Вкладка «Открытие технологий» перенесена из под-вкладок мастерской в основные вкладки ангара (3 основные: Улучшение ячеек / Мастерская / Открытие технологий).
  - Под-вкладки мастерской: «Улучшение чипов» + «Создание чипов» (переименована из `workshopTabChipCraft`).
  - `switchHangarTab()` поддерживает `'cells'`, `'workshop'`, `'techUnlock'`.

- **UI: Composed chip SVG**
  - Новая функция `chipSvgComposed()` рисует чип как 3 вложенных мини-треугольника внутри большого контура.
  - Иконки фрагментов повёрнуты на 180° — теперь вершиной вверх (`_fragmentSvgUp()`).
  - Используется повсюду: инвентарь, грид улучшений, craft panel, tech modal.

- **UI: Зелёная подсветка совпадений**
  - Чипы в инвентаре, создающие match при установке, подсвечиваются зелёным (`hangarChipBtn--canMatch`).
  - `_wouldChipCreateMatch()` проверяет все 3 ротации.

- **UI: Выравнивание жёлтых слотов**
  - Жёлтые слоты притягиваются горизонтально (`ATTRACTION_DIST`) синхронно с соседним красным слотом.

- **UI: Drag-and-drop в слоты бабочки**
  - Чип перетаскивается из инвентаря в SVG-слот. Если слот занят — старый чип возвращается. Проверка совпадения цвета.
  - `_slotDragging` state + pointer events в `init()`.

- **UI: Craft panel — режимы + «Распылить»**
  - Два toggle-кнопки «Разобрать» / «Создать чип» (`chipCraftModeBtn`) вместо одной кнопки-действия.
  - По умолчанию активен режим «Создать чип» (`_craftMode = 'assemble'`).
  - Кнопка «Распылить» (`chipCraftDustBtn`): dust mode с чекбоксами на элементах инвентаря.
  - Большой чип = 10 ед. кремниевой пыли, фрагмент = 3 ед. (`DUST_PER_CHIP`, `DUST_PER_FRAGMENT`).
  - «Подтвердить» / «Отменить» в dust mode. Ресурс `_siliconDust` с геттером/сеттером в public API.
  - CSS: `.chipCraftTopBar`, `.chipCraftModeRow`, `.chipCraftModeBtn`, `.chipCraftDustBtn`, `.chipCraftDustCheck`, `.chipCraftInvItem--dustSelected` и др.
  - i18n: ключи `chipCraftDustBtn`, `chipCraftDustConfirm`, `chipCraftDustCancel`, `chipCraftDustResult`, `chipCraftDustNoneSelected`, `chipCraftDustGained`, `chipCraftSiliconDust`, `chipCraftSwitchToDisassemble`, `chipCraftSwitchToAssemble`.

## 2026-03-04
- **Новая фича: Система фрагментов чипов (Создание чипов)**
  - Вкладка «Создание чипов» в мастерской: игрок может разбирать целые чипы на 3 фрагмента и собирать 3 фрагмента в новый чип.
  - Каждый фрагмент соответствует одному modId (1–30). Разборка чипа даёт 3 фрагмента по modIds чипа.
  - Сборка: 3 фрагмента → целый чип. Валидация аналогична генерации (запрещены all-same, макс. 1 спец-мод 10–14).
  - Инвентарь фрагментов: `addPlayerFragment`, `removePlayerFragment`, `getFragmentCount`, `getPlayerFragments`, `setPlayerFragments`.
  - Визуальная форма фрагмента — ромб/кайт (SVG), цвет зависит от типа мода (красный / жёлтый для спец-модов).
  - `src/mechanics/hangarChips.js`: +`disassembleChip(modIds)`, `assembleChip(fragModIds)`, `getFragmentAccelBonus(modId, techDuration)`, `ALL_FRAGMENT_IDS`.
  - `src/ui/hangarChipsUI.js`: +~350 строк — инвентарь фрагментов, `renderChipCraftPanel`, `_attachCraftPanelEvents`, `_executeCraftAction`, `_fragmentSvg`, `switchWorkshopSubTab` обновлён для 3 вкладок.
  - `index.html`: добавлена кнопка `workshopTabChipCraft` и секция `workshopPanelChipCraft`.
  - `style.css`: +~180 строк CSS для панели создания чипов (`.chipCraftLayout`, `.chipCraftInventory`, `.chipCraftPreview`, `.chipCraftDropZone` и др.).
  - `game.js`: save/restore поддержка `playerFragments`.
  - `src/ui/debugPanel.js`: добавлены контролы для добавления фрагментов — ввод modId/count, кнопка «Add fragment», «Add random frags», статус инвентаря фрагментов.

- **Новая фича: Фрагменты в ускорении обучения технологий**
  - Модалка «Ускорить процесс обучения» теперь отображает фрагменты чипов наряду с целыми чипами.
  - Каждый фрагмент даёт ускорение, равное **половине** от того, что даёт целый чип (2.5% → 1.25% для 2ч технологий, 5% → 2.5% для 5ч технологий).
  - При подтверждении фрагменты сжигаются из инвентаря аналогично целым чипам.
  - Лимит ускорения 95% действует суммарно для чипов + фрагментов.

- **Улучшение: Динамическое расстояние между слотами-треугольниками**
  - Расстояние между слотами-треугольниками увеличено с 5px до 15px по умолчанию.
  - При совпадении красных/жёлтых чипов (match success) расстояние автоматически уменьшается до 3px — слоты визуально «притягиваются» друг к другу.
  - `renderButterfly`: динамический расчёт `redGap`/`yellowGap` на основе `cell.uiState.redMatchSuccess`/`yellowMatchSuccess`.

## 2026-03-01
- **Новая фича: Открытие технологий для чипов**
  - Вкладка «Открытие технологий» в мастерской: теперь можно открывать новые уровни модификаторов (15–30) через скармливание чипов (25 шт. на каждую технологию).
  - После открытия технологии все чипы с предыдущим модификатором автоматически обновляются на новый.
  - UI: реализована панель дерева технологий, прогресс-бар, кнопки скармливания 1/5/всех чипов, статусы открытия.
  - Добавлены новые визуальные конфиги для модификаторов 15–30 в `assets/chips.json` (цвета, tint, scale).
  - Добавлены строки локализации для панели открытия технологий и описаний новых модификаторов (RU/EN) в `src/i18n/fallbackStrings.js`.
  - `src/mechanics/hangarChips.js`: реализовано дерево технологий, функции открытия, массовая замена модификаторов в инвентаре и ангаре.
  - `src/ui/hangarChipsUI.js`: реализован UI панели открытия технологий, обработка событий, прогресс, автозамена модов.
  - `src/ui/debugPanel.js`: добавлена возможность добавлять любые чипы в инвентарь для тестирования.
  - `style.css`: стили для панели открытия технологий.
  - `index.html`: обновлена структура панели мастерской.
  - Тесты: ручная проверка открытия всех технологий, массовой замены чипов, отображения прогресса и локализации.

## Мастерская: улучшение чипов + удаление V1 талантов
- **Новая фича: Вкладки «Мастерская»** — в модалке «Модификации ангара» во вкладке «Мастерская» добавлены две под-вкладки: «Улучшение чипов» и «Открытие технологий» (WIP).
  - `index.html`: заменена заглушка «В разработке» в панели `workshopPanel` на структуру с под-вкладками (`workshopTabChipUpgrade`, `workshopTabTechUnlock`) и панелями (`workshopPanelChipUpgrade` с `#chipUpgradeGrid`, `workshopPanelTechUnlock`).
  - `style.css`: +~150 строк CSS для `.workshopSubTabs`, `.workshopSubTab`, `.chipUpgradeGrid`, `.chipUpgradeCard`, `.chipUpgradeCard__icon/__name/__level/__count`, `.chipUpgradeCard--canMerge`, `.chipUpgradeCard__mergeBtn`, `.chipUpgradeTooltip`, `.chipUpgradeEmptyLabel`.
  - `src/i18n/fallbackStrings.js`: +13 ключей на RU и EN (`workshopTabChipUpgrade`, `workshopTabTechUnlock`, `workshopChipMerge`, `workshopChipLevelLabel`, `workshopChipTooltip*` и др.).
- **Новая фича: Система улучшения чипов** — игрок может объединять одинаковые чипы для повышения уровня; каждый уровень даёт +10% к силе атаки танка.
  - `src/ui/hangarChipsUI.js`: +~300 строк — инвентарь `playerChips` (`{ chipId, chipColor, modIds, sourceComboKey, level, count }`), функции `addPlayerChip`, `removePlayerChipOne`, `mergeChips`, `chipLevelBonus`, `renderChipUpgradeGrid`, tooltip-система при наведении, переключение под-вкладок.
  - `game.js`: добавлена функция `getChipLevelDmgMul(cellIndex)` — суммирует бонусы уровней установленных чипов, возвращает множитель урона; интегрирована в `fireTankProjectile` (`splitDmg *= chipLevelDmgMul`).
  - `src/persistence/initialState.js`: добавлено поле `playerChips: []`.
  - `src/persistence/storage.js`: `serializeState` сохраняет `playerChips`.
  - `game.js`: `restoreFullState` и `applySavedProgress` восстанавливают `playerChips` с синхронизацией `HangarChipsUI.setPlayerChips`.
- **Удаление V1 талантов** — удалён весь код старой системы талантов v1 из game.js (~400 строк) и файл `src/systems/talents/talentDefs.js` (176 строк).
  - `game.js`: удалены функции `pendingCost`, `doApplyTalentSelections`, `canSelectTalent`, `adjustTalentPending`, `activeTalentIndex`, `resetBranchPending`, `drawTalentEdges`; константа `TALENT_BRANCHES`; V1-ветки из `getMods`, `resetAllTalents`, `applyTalentSelections`, `canUseActive`, `useActiveAbility`, `ensureTalentState`, `ensureTalentUI`, `updateTalentUI`, `updateStageAbilitySlots`.
  - `game.js`: удалены `talentsPending` и `activeCooldowns` из save/restore; удалены V1-экспорты из debug-панели.
  - `game.js`: добавлены утилитарные заглушки: `TALENT_LAYOUT = []`, `initTalentDefs()` (no-op), `sanitizeTalentIconBaseName()`, `talentIconPath()` — нужны V2-коду для иконок и fallback layout.
  - `index.html`: удалён `<script src="src/systems/talents/talentDefs.js">`.
  - `src/core/bootstrap.js`: вызов `initTalentDefs` защищён `typeof`-проверкой.
  - Поле `talentsApplied` сохранено в state для совместимости миграции V1→V2 в `talentsV2.js`.

## Рефакторинг game.js — удаление мёртвого кода и извлечение талантов
- **Удалён мёртвый код из game.js** (~70 строк):
  - Первый (затенённый) `normalizeAppliedCannonUpgrade` — дубликат, перезаписывался вторым определением.
  - `drawZombieFence` — никогда не вызывалась.
  - `drawZombieSprite`, `drawZombieFallback` — не вызывались после перехода на ZombieRender runtime.
  - `pad2ForBigMenu`, `formatDateForBigMenu`, `renderBigMenuLoadRows`, `parseBigMenuSlotIndexFromNode` — не вызывались после перехода на BigMenuRuntime.
  - `sanitizeCannonUpgradeRow` — обёртка, которая не использовалась.
  - `setTrackLoopVolumeMul` — функция-заглушка (игнорировала параметры, использовала хардкод) и две ссылки в объектах deps.
  - `const compact = true` / `const muted = false` — удалены, значения заинлайнены (`0.065`/`0.56` вместо тернарных операторов; мёртвые ветки `if (muted)` удалены).
- **Извлечён блок талантов v1** (~170 строк) в `src/systems/talents/talentDefs.js`:
  - `TALENT_DEFS`, `ACTIVE_TALENT_INDEX`, `sanitizeTalentIconBaseName`, `talentIconPath`, `TALENT_LAYOUT`, `TALENT_EDGES`, `TALENT_ROW_POINTS`, `addTalent`, `initTalentDefs`, `baseMods`, `computeModsFromApplied`.
  - В `computeModsFromApplied` вызов `clamp()` заменён на `Math.max(0, Math.min(0.9, ...))` для устранения зависимости от game.js.
  - Скрипт подключён в `index.html` перед `game.js` (после `talentsV2.js`).
- **Итого**: game.js сокращён с ~12 212 до ~11 976 строк (−236 строк, −1.9%).

## 2026-02-28
- **Новая фича: Каскадная система модификаторов чипов**.
  - Модификаторы теперь разделяются по «порядку срабатывания» (order): первый красный мод (order 0) срабатывает при выстреле, второй красный мод (order 1) — при попадании первых снарядов, жёлтый мод (order 2) — при попадании последних каскадных снарядов.
  - `hangarChips.js`: `calculateActiveModifiers` теперь добавляет поле `order` (0, 1, 2) к каждому модификатору.
  - `chipEffects.js`: `applyShotModifiers` разделяет моды по order; order-0 применяются при выстреле, остальные сохраняются в `pendingCascadeMods` / `pendingYellowMods` на объекте `shotMods`.
  - `chipEffects.js`: добавлены каскадные функции — `_buildEmptyResult`, `_applyModToResult`, `_findCascadeTargets`, `_getCascadeProjectileCount`, `_spawnCascadeProjectiles`.
  - `chipEffects.js`: `applyImpactEffects` теперь после обработки текущих эффектов проверяет `pendingCascadeMods` и запускает `_spawnCascadeProjectiles`.
  - `game.js`: добавлен флаг `isCascadeChild` в `resetProjectile` и `spawnProjectile` для каскадных снарядов.
  - Каскадные снаряды летят к целям в 100–250px от точки взрыва, количество зависит от мода (Double Shot = 2, Combo = 3, остальные = 1).
  - Жёлтые моды (10–14) срабатывают ТОЛЬКО на последнем каскаде: если 1 красный + жёлтый → жёлтый на первом попадании; если 2 красных + жёлтый → жёлтый только на попадании каскадных снарядов.
  - Тесты: 79 passed, 3 failed (pre-existing T5 CSS).
- **Фикс: Мод 1 (Двойной снаряд) — снаряды летят в разные далёкие цели**.
  - Минимальная дистанция между основной и вторичной целью увеличена с 30px до 120px (настраиваемая через `Game.ChipEffects.DOUBLE_SHOT_MIN_TARGET_DISTANCE`).
  - Добавлена getter/setter-пара `DOUBLE_SHOT_MIN_TARGET_DISTANCE` в `chipEffects.js` для runtime-настройки дальности выбора второй цели.
  - `game.js`: `fireTankProjectile` использует `ChipFx.DOUBLE_SHOT_MIN_TARGET_DISTANCE` вместо хардкода 30px.
- **Новая фича: Жёлтые чипы — оформление углов как у красных**.
  - В SVG-бабочке жёлтые чипы теперь отображают метки модификаторов во всех 3 вершинах треугольника (`A:`, `B:`, `X:`), аналогично красным (`A:`, `B:`, `C:`).
  - Внутренние вершины (`A`, `B`) отображаются зелёным `#4af626`, внешняя (`X`) — жёлтым `#fdd835` жирным.
- **Фикс: Жёлтый модификатор — активация только при совпадении углов**.
  - Жёлтый чип теперь активирует свой X-модификатор только если оба внутренних угла (innerA, innerB) совпадают с соответствующими вершинами смежного красного чипа.
  - Добавлена карта смежности `YELLOW_ADJACENCY` и функция `checkYellowMatch(yellowPlacement, yellowSlotKey, cellState)` в `hangarChips.js`.
  - `calculateActiveModifiers`: жёлтый X добавляется в `mods` только при `checkYellowMatch === true`.
  - `uiState.yellowMatchSuccess`: новое поле, отображается в UI статусом «Жёлтый: совпадение! X активен» / «Жёлтый: нет совпадения. X не активен».
  - Тесты: 79 passed, 3 failed (pre-existing T5 CSS).
- **Фикс: Мод 6 (Комбо-счётчик дула) — последовательная стрельба**.
  - Комбо-выстрелы (каждый 4-й выстрел → 3 снаряда) теперь выпускаются последовательно с интервалом 0.15 сек через `setTimeout`, а не мгновенно.
- **Фикс: Несовпадение красных чипов — только 1 модификатор**.
  - При `matchSuccess = false` теперь активен только модификатор A первого красного чипа (было: A обоих чипов).
- **Новая фича: Вращение чипов в ангаре**.
  - Добавлена функция `rotateChip(cell, slotType, slotId)` в `Game.HangarChips`: вращает чип по часовой (120° за шаг, 3 позиции), изменяя привязку модификаторов к вершинам.
  - `normalizeRedPlacementRotated` / `normalizeYellowPlacementRotated`: нормализация с учётом поворота.
  - В SVG-бабочке на слоте с чипом при наведении появляется кнопка вращения (↻); клик крутит чип на 120° по часовой, пересчитывает `activeModifiers` и обновляет match.
  - CSS: `.hangarSlotGroup:hover .hangarRotateBtn` — кнопка visible on hover.
  - Документация: `docs/ai/SYSTEMS/combat.md`, `docs/ai/SYSTEMS/ui.md` обновлены.
- **Фикс: Чип-модификаторы 1–5 — поведение снарядов переработано**.
  - Мод 1 (Двойной снаряд): каждый снаряд получает полный базовый урон (делится только по дулам, не по чип-экстрам); второй снаряд летит в ДРУГУЮ цель (≥30px от первой).
  - Мод 2 (Цепной заряд): вместо мгновенного урона по цепи, снаряд при попадании порождает новый снаряд-отскок, летящий к другой цели (≥12px), до 2 отскоков.
  - Мод 3 (Матрёшка): визуальный размер снаряда теперь корректно увеличивается (×1.25 через `effectIntensity`); при попадании child-снаряд летит к другой цели (≥12px от взрыва), а не взрывается мгновенно.
  - Мод 5 (Вакуум): все зомби в радиусе 50px притягиваются К МЕСТУ ВЗРЫВА (Cartesian pull через полярные координаты), а не к центру/танку. Радиус 50px фиксированный.
  - `drawProjectiles` в `game.js`: спрайт снаряда масштабируется по `effectIntensity` (визуально увеличенные снаряды для матрёшки/нуки/powerTier).
  - `spawnProjectile`/`resetProjectile`: добавлено поле `isChainChild` для цепных снарядов.
  - Тесты: 79 passed, 3 failed (pre-existing T5 CSS).
- **Новая фича: Чип-эффекты в бою** — модификаторы ангарных чипов теперь реально влияют на поведение снарядов и боевую систему.
  - Добавлен `src/mechanics/chipEffects.js` (`Game.ChipEffects`): runtime-движок чип-эффектов — `applyShotModifiers`, `applyImpactEffects`, `stepChipEffects`, `stepChipDecal`, `checkLaserMarkBoost`, `reset`.
  - Добавлен `assets/chips.json`: конфиг спрайтов, эффектов и звуков для каждого из 14 модификаторов.
  - `index.html`: подключен `chipEffects.js` перед `hangarChipsUI.js`.
  - `game.js`: интеграция чипов в боевой pipeline — `cellIndex` передаётся в `fireTankProjectile`, снаряды хранят `chipShotMods`, `impactAt` вызывает чип-эффекты, `stepDecals` обрабатывает чип-пулы (огонь/кислота/лёд), `stepChipEffects` тикает электро-ноды и лазерные метки, замедление от чипов на скорость зомби, calming-эффект блокирует атаку зомби.
  - Реализованы все 14 модификаторов: двойной выстрел, цепная молния, матрёшка, толкание/притягивание, комбо, аркадный хаос, ядерный, успокоение, огонь, лёд, электро-нода, лазерная метка, кислота.
  - Документация: `docs/ai/SYSTEMS/combat.md`, `docs/configs.md` обновлены.
- **Новая фича: Треугольные чипы ангара** — система модификации ячеек ангара через треугольные чипы.
  - Добавлен `src/mechanics/hangarChips.js` (`Game.HangarChips`): генерация пула 381 чипа (156 красных + 225 жёлтых), нормализация размещения, расчёт активных модификаторов, match-логика красных чипов.
  - Добавлен `src/ui/hangarChipsUI.js` (`Game.HangarChipsUI`): SVG бабочка-визуализация 6 слотов, сетка ячеек 4×4, каталог чипов с фильтрацией, установка/удаление чипов.
  - `index.html`: заменена заглушка «В разработке» в `#modsHangarOverlay` на полную вкладочную структуру (Улучшение ячеек / Мастерская).
  - `style.css`: +~250 строк стилей для чипового UI в wasteland-палитре.
  - `src/persistence/initialState.js`: добавлено поле `hangarCells: null`.
  - `src/ui/supercomputerMenu.js`: `showHangarMods()` теперь вызывает `Game.HangarChipsUI.init()` / `.show()`.
  - `src/ui/debugPanel.js`: новая вкладка `Chips` для отладочной установки/удаления чипов по ключу.
  - i18n: добавлены ключи `hangarChips*` в `ru.json` и `en.json`.
  - Документация: `docs/ai/SYSTEMS/ui.md` + `docs/ui.md` обновлены.

## 2026-02-27
- **Баг-фикс**: ранняя инициализация `game.js` — `ensureDronUpgradesAppliedState()` переведён в fail-soft режим при раннем вызове (fallback по длине уже сохранённого массива/`MAX_TANK_LEVEL`, если `getDronLevelsCount()` ещё недоступен), что предотвращает падение загрузки скрипта.
- **Баг-фикс**: безопасное чтение конфига дронов — доступ к `DronSprites.config` обёрнут в `try/catch` и дополнен fallback на `spriteLoaders.DronSprites.config`; устранён runtime-crash и восстановлена штатная инициализация обработчиков большого меню.
- **Баг-фикс**: `normalizeAndTeleportDronesAfterRestore()` (~L1968) — при вызове `DronesApi.restoreSavedDrones(state, state.drones)` передавалась та же ссылка на массив; `restoreSavedDrones` обнулял `state.drones.length = 0` до итерации, что уничтожало входные данные. Исправлено клонированием массива перед передачей. Дроны и их прокачка теперь сохраняются при «Перезапустить симуляцию».
- **Баг-фикс**: `serializeState()` (storage.js ~L476) — поле `forceFenceRuntimeResetOnLoad` терялось при сериализации save-слота; при загрузке «Сохранить и выйти»-сейва fence уровень не сбрасывался. Добавлено сохранение флага в `serializeState`.
- **Баг-фикс**: Breached zombie movement (~L6023) — зомби, прошедшие через сломанные нижние углы забора, шли по целым секциям. Добавлена проверка `pickFenceSegmentByPoint` после перемещения breached-зомби: если зомби на целом сегменте, `z.r` уменьшается до внутреннего края забора.
- **Фикс UI**: `drawGunsSpriteCanvas()` (supercomputerMenu.js) — введён атрибут `data-rot-deg` на canvas-элементах. Оружия сохраняют поворот −90°; дроны и стены рисуются без поворота (0°). Дроны корректно воспроизводят repair-анимацию (16 кадров @ 15 fps).
- Тесты: 79 passed, 3 failed (pre-existing T5 settings CSS).

## 2026-02-26
- **Редизайн UI (Wasteland Edition)**: Полное обновление интерфейса в стиле Fallout 1 & 2.
  - Основной шрифт заменён на `Courier New` с эффектом фосфорного свечения (`text-shadow`).
  - Цветовая палитра переведена на тёмно-зелёные и фосфорные тона (`#0a0c0a`, `#1e231e`, `#4af626`).
  - Кнопки стали прямоугольными с металлическим градиентом и рамками «под металл».
  - Модальные окна и панели получили эффект ЭЛТ (сканирующие полосы CRT) и «заклёпки» по углам.
  - Индикатор опыта (`.xpBar`) стал сегментированным (ретро-индикатор).
  - Все игровые иконки и способности окрашены в зелёный через CSS-фильтры для единства стиля.
- **Баг-фикс**: `ensureFenceTierRuntimeState()` (~L2655) — убран `Math.max(maxAchieved, ...)` — `runtimeMaxTankLevelAchieved` больше не перезаписывается значением `maxTankLevelAchieved` при рестарте; fence корректно начинает с уровня 1 после critical restart.
- **Баг-фикс**: `getNearestKnownBreachForZombie()` (~L5381) — заменён `Infinity` на `awarenessRadiusPx` при поиске бреши на той же стороне; зомби используют настроенный радиус осведомлённости вместо бесконечного.
- **Баг-фикс**: `zombieFenceLimit()` (~L5715) — добавлена валидация `z.breached`: если зомби стоит на целом сегменте и не глубоко внутри, флаг `breached` сбрасывается.
- **Баг-фикс**: `buildPreRetryPayload()` (~L7323) — добавлена защитная проверка сохранения дронов после `applyPreRetryRuntimeReset`.
- **Баг-фикс**: `applyCriticalRestartPostLoad()` (~L7506) — добавлена защитная проверка восстановления дронов при critical restart.
- **Баг-фикс**: `pointermove` handler (~L9123) — координаты `state.dragging.x/y` обновляются только после превышения порога перемещения (6 px, `moved=true`).
- Тесты: 82 passed, 0 failed.

## 2026-02-20
- **Рефакторинг game.js**: сокращён с 10749 до 9502 строк (−1247 строк, −12%).
- Извлечён `src/core/runtimeTasks.js` (~100 строк): timer/RAF suspend/resume, экспорт `Game.RuntimeTasks`.
- Извлечён `src/mechanics/cannonUpgrades.js` (~80 строк): pure функции `createFallbackCannonUpgrades`, `sanitizeCannonUpgradeRow`, `normalizeCannonUpgradesConfig`, `normalizeAppliedCannonUpgrade`.
- Обновлён `src/persistence/initialState.js`: добавлены недостающие поля (`damagePointsSpent`, `fenceLevel`, `wallDecors`, `nextZombieRenderOrder`, `supercomputer.eventShown*`, `ui.toast`, `ui.unlockFx`); inline fallback в game.js компактифицирован.
- Удалён мёртвый код (~120 строк): 10 неиспользуемых функций (`getBulkBuyPlan`, `mergeCells`, `resetTalentSelections`, `hasAnyBreach`, `getActiveBreachAtPointAnySide`, `pickNearestBreachAnySide`, `getFenceCollisionPadding`, `maybeShowNextAchievementPopup`, `drawDecors`, `drawZombies`), 1 noop-функция (`drawTrack` + её вызов), 3 мёртвые константы (`FENCE_HIT_INTERVAL_MS`, `APPLY_VFX_FLASH_MS`, `APPLY_VFX_FLOW_MS`, `MAX_ZOMBIE_LEVEL`).
- **Баг-фикс**: Debug-панель «Damage Points» — перенесена проверка API внутрь retry-цикла, добавлена видимая стилизация и диагностика.
- **Баг-фикс**: Кнопка суперкомпьютера 🖥 — `supercomputerHudRuntime.button.lastVisible` инициализировался как `true` вместо `false`, JS пропускал установку visibility.
- **Баг-фикс**: Спрайты орудий в модалке суперкомпьютера — масштабирование через `Game.Config.LayoutTuning.weaponIconW/H` с пропорциональным вписыванием.

## 2026-02-19
- Реализован partial reset симуляции: `src/core/worldReset.js` + wiring в `game.js`.
- `Перезапустить симуляцию` теперь сбрасывает runtime мира (zombies/projectiles/FX/weather/wave runtime), но сохраняет achievements/upgrades/mods/supercomputer progression.
- Добавлен контракт на отсутствие дублирования main loop/таймеров при повторном restart.
- MergePopup SHOWCASE: удалён дополнительный правобоковой shot FX в `src/ui/mergePopup.js`.
- В pop-up нового уровня танка сохранены штатная анимация и shoot SFX.
- Полностью удалён legacy-виджет отзывов: menu entry points, связанная модалка и соответствующие i18n-ключи.
- Achievements modal переведён на single-open accordion с toggler `+`/`−`.
- Исправлен transform-конфликт `#supercomputerBtn` с unified button behavior (нет смещения кнопки при клике).

## 2026-02-13
- Документация для AI-агентов сжата и унифицирована.
- Убраны длинные дубли и избыточные объяснения.
- Добавлен компактный роутинг: `INDEX` -> `SYSTEMS` -> `PLAYBOOKS`.

## Примечание
- История кода и подробные изменения доступны в `git log`.
