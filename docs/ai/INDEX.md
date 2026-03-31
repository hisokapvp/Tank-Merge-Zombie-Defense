# Индекс документации для агента

> Обновлено: 2026-03-31.

## Порядок чтения
1. `docs/ai/STYLE.md`
2. `docs/ai/PROJECT_MAP.md`
3. `docs/ai/ARCHITECTURE.md`
4. Для render/UI/runtime/hud/input и TMZD visual/UI/UX/layout/modal/HUD style-sensitive задач сначала `docs/ai/SYSTEMS/phaser.md`, затем целевой файл из `docs/ai/SYSTEMS/*.md`
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
- **Phaser 3 migration**: `docs/ai/SYSTEMS/phaser.md` (runtime, scenes, layers, rollout)
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

## Фокус документации на 2026-03-31
- **Aura sprite treatment + hangar/workshop responsive shell refresh**: `game.js` держит chip-count routing через `getInstalledChipCountForCell()`/`resolveTankAuraVisual()`, но `drawTankAuraSprite()` теперь даёт variant-specific runtime glow/ring treatment для `aura1/aura2/aura3`; `src/ui/hangarChipsUI.js` сразу раскрывает rotate/remove actions через `activateInstalledSlotActions()` после успешной установки чипа; `style.css` убирает локальный `modsHangarScale` clamp, сохраняет `hangarSlotView + right column` side-by-side в narrow/fullscreen hangar, держит recycle mobile в side-by-side режиме для `Разобрать/Перепрограммировать` и sticky bottom bar для `Распылить`, а mobile SC/terminal path больше не опирается на старый title clamp/max-width fork и снимает `min-width` floor с terminal action buttons. `index.html` bump'ает entry token до `20260331-branch3-sc-shell-terminal-mobile-v1`.
- **Bullet atlas overflow fix + drawProjectiles defensive clamp**: `assets/bullet.json` frame h `36→34`; `drawProjectiles()` в `game.js` clampит source rect к atlas bounds и fallbackится на circle при полном overflow.
- **Chip-count aura overhaul**: старые `normalizeAuraChipCount()`/`getInstalledChipCountForTank()` удалены; новый `getInstalledChipCountForCell(cellIndex)` считает занятые red/yellow слоты, `resolveTankAuraVisual()` выбирает `aura1/2/3` по count; `assets/tanks.json` несёт `aura1/aura2/aura3` вместо старого `aura`; `TankSprites.load()` нормализует все 3 варианта, `pickAura(level, variant)` выбирает по variant.
- **Zombie unstick mechanism**: per-zombie `_unstickTimer` / `_unstickCheckR` в `stepZombies()`: 4s таймер, 2px radial threshold, scalar nudge к fence при застревании.
- **Hangar modal responsive**: `@media (max-width:1279px)` в `style.css` включает proportional scaling block с `--modsHangarSlotWidth/Height/LeftColWidth/DropMinHeight` и column layout для hangar modal below 1280px.
- **Touch chip drag fix**: `src/ui/hangarChipsUI.js` `init()` добавляет `setPointerCapture` + cancelable `preventDefault` на `pointermove` + явный `pointercancel` handler для корректного touch drag на mobile.

### Предыдущий фокус (2026-03-30)
- **Responsive terminal + storage confirm shell**: root `--ui-terminal-width` / `--ui-terminal-expand-size` в `style.css` остаются source-of-truth для top-right terminal shell, `<1200px` override ужимает shell и снимает `min-width` с terminal buttons, а `#plConfirmOverlay` держит token-driven width через `--pl-storage-confirm-width-*` с переходом на `width:auto; max-width:100%` при `<=1250px` вместо fixed narrow clamp.
- **Underground hangar header action lane**: `src/ui/undergroundHangarUI.js` теперь вешает help-кнопку в `.ughPanel__headerActions` / `.scModal__headerActions` и вставляет её перед `#undergroundHangarClose`, так что underground modal остаётся в том же `help -> close` header contract, что и SC-family overlays.
- **Aura routing by installed chip count**: `game.js` считает количество реально установленных чипов в ячейке танка и активирует `aura1/aura2/aura3` по count `1..3`; `TankSprites.auraVariantLevels` в `src/render/spriteLoaders.js` остаётся только asset-lookup mapping на `tank_lvl10/20/30`, а не forced high-level visual gate.
- **Projectile near-hit + touch-safe drag**: `src/mechanics/targeting.js` держит near-hit latch через `lastDistToTarget`, когда цель начала удаляться после почти достигнутого попадания, а canvas/storage/chip drags в `game.js`, `src/ui/productionLineUI.js` и `src/ui/hangarChipsUI.js` синхронизированы по touch `preventDefault`, pointer capture и порогу `6px` без обновления drag-state до threshold.
- **Fence seam scaling below 1400px**: `src/render/fenceLayout.js` усиливает overlap угол→сторона через `resolveSeamOverlapPx()` при viewport `< 1400px`, чтобы на узких экранах не открывались визуальные щели; regression закреплён в `Test/pack7/fenceCornerSlots.test.js`.

### Предыдущий фокус (2026-03-28)
- **Repo-local Copilot context-mode consumer baseline**: `.github/hooks/context-mode.json` и `.vscode/mcp.json` в TMZD зеркалят shared `.agents` consumer contract (`PreToolUse/PostToolUse/PreCompact/SessionStart` + `npx -y context-mode`), но не становятся владельцем Telegram broker bridge; для broker ownership читать `.agents/docs/CONTEXT_MODE_TELEGRAM_BASELINE.md`, а внутри TMZD считать эти два файла support-surface, не gameplay runtime.

### Предыдущий фокус (2026-03-27)
- **Phaser 3 migration phases 0–4 complete.** 43 module files in `src/phaser/`, 14 adapters/bridges, 12 render layer modules, 16 scenes, 4 rollout modules. Master spec: `docs/migration/PHASER_MIGRATION.md`. Runtime doc: `docs/ai/SYSTEMS/phaser.md`. 467 dedicated migration tests across 11 test files.
- **TMZD visual/UI/UX/layout/modal/HUD style-sensitive задачи** читают `docs/ai/SYSTEMS/phaser.md` вместе с `docs/ai/SYSTEMS/ui.md`; TMZD-specific UX route идёт через `tmzd-ux-ui-designer`, а runtime-изменения остаются в зоне `tmzd-developer`.
- **Shared hybrid seam для `Supercomputer -> Tank/Drone/Wall Mods`** теперь документирован как per-stat modal contract: `src/ui/supercomputerMenu.js` держит expandable rows и reserved-points state, `game.js` — per-stat total/apply helpers, а `assets/tanks.json`, `assets/dron.json`, `assets/fence.json` — canonical `upgradeDamagePointsCosts` по статам. Tutorial contract для этого же seam живёт в `docs/ai/SYSTEMS/tutorial-runtime.md`.

### Предыдущий фокус (2026-03-26)
- `game.js`: `UI_BRANCH1_ASSET_VERSION = 20260326-branch1-ui-scale-early-capital`; `resizeCanvas()` вычисляет `--ui-scale = max(0.4, min(W/1920, H/1080))` и ставит CSS custom property на `:root`; `syncCurrentBalanceAchievements()` рекалькулирует unlock'и для `currentBalance`/`early_capital` при изменении баланса; `openAchievementPopupEvent()` берёт reward-text через `REWARD_TABLE.i18nKey`; status/debuff render читает `debuffIconScale/debuffIconOpacity` из локального singleton `ZombieSprites`, а не из `window.Game.Sprites.ZombieSprites`.
- `style.css`: adaptive `--ui-scale` разбит на base + extended blocks и теперь масштабирует не только modal shells, но и HUD/big menu/panels/tooltips; close-buttons по-прежнему не масштабируются, чтобы сохранить 44×44 hit-area.
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
- `index.html` подключает `src/ui/fontFloor.js`: `Game.FontFloor` глобально поднимает floor `10px` для DOM/canvas-текста, но skip-список обязан исключать все close/remove-варианты (`.levelModal__close`, `.crateModal__close`, `.modalClose`, `.chipCraftSlotRemove`, `.lessonProgress__close`, `[data-font-floor-ignore="true"]`).
- `New game` поднимает `productionLine.firstNewGameBoxGuaranteedPending`; первая коробка конвейера гарантированно резолвится в рабочий red `one_big_chip` уровня 1 с валидным `chipId`, отсортированным `sourceComboKey` и 3 уникальными base `modIds` (`1..9`).
- `assets/zombies.json` держит явный числовой `Health` в каждом `types[]`; `ZombieSprites.load()` нормализует `Health/health` в `type.health`, а `makeZombie()` использует это значение раньше формулы из balance.
- Achievements runtime: 12 семейств и 52 reward mappings в единой `REWARD_TABLE` внутри `src/mechanics/achievementRewards.js`; `early_capital` добавляет 5 current-balance tiers (`10K / 1M / 100M / 100B / 100T`) с reward ladder fragments/chips/damage/composite drones+upgradePoints; `stable_income` остаётся lifetime-income ladder, то есть `moneyEarned` и `currentBalance` теперь документированы как разные контракты прогресса.
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
