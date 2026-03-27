# Phaser 3 Migration — Master Spec

> Создан: 2026-03-26. Обновлять при каждом milestone.

## Цель

Портировать игру с ванильного HTML5 Canvas на Phaser 3, поэтапно, через гибридный режим с feature flag, без npm/build step. Текущая Canvas-версия остается эталоном до финального переключения.

## Архитектурные решения

| Решение | Обоснование |
|---|---|
| Phaser 3 vendored как `vendor/phaser.min.js` | Нет npm/bundler; CDN не подходит для offline |
| Feature flag `usePhaser` (default: off) | Безопасный A/B rollout; legacy path всегда доступен |
| `Game.EngineAdapter` — единый фасад | Все модули работают через `window.Game.*`, не зависят от runtime engine |
| State остаётся plain JS object | Сериализация/save/load не меняются; Phaser objects восстанавливаются из state |
| Simulation logic без Phaser dependencies | `src/mechanics/*`, `src/systems/*` остаются engine-agnostic |
| UI мигрирует последней | DOM UI как bridge пока world/input/save parity не подтверждены |

## Фазы

### Phase 0 — Governance & Baseline
- [x] Migration spec (этот документ)
- [x] Risk register (`docs/migration/RISK_REGISTER.md`)
- [x] Feature flag `usePhaser`
- [x] Baseline invariants зафиксированы
- [x] Baseline test artifacts — capture script: `scripts/capture_baseline_artifacts.js`, browser smoke: `scripts/phaser_browser_smoke.js`

### Phase 1 — Engine Seam & Bootstrap
- [x] `src/core/engineAdapter.js` — runtime selection
- [x] `vendor/phaser.min.js` — Phaser 3.80.1
- [x] `src/phaser/scenes/BootScene.js` — asset preload
- [x] `src/phaser/scenes/GameScene.js` — main scene shell
- [x] `src/phaser/phaserBootstrap.js` — Phaser.Game creation
- [x] `src/phaser/clockAdapter.js` — clock/pause bridge
- [x] index.html wiring

### Phase 2 — World Rendering & Input
- [x] Input adapter (`src/phaser/inputAdapter.js`) — coord transform, drag threshold, hit-testing
- [x] Render registry (`src/phaser/renderRegistry.js`) — per-layer legacy/phaser mode tracking
- [x] game.js `getPointerPos()`/`cellAt()` delegated to InputAdapter
- [x] game.js `draw()` all 18 layer calls gated by RenderRegistry
- [x] **Loop handoff** — Phaser drives RAF when `usePhaser` flag is ON
  - `phaserLoopActive` flag stops legacy `scheduleMainLoop()`
  - Bridge `stepFn` delegates to `loop(time)` — full simulation + draw in one call
  - `clearBeforeRender: false` preserves legacy Canvas 2D output
  - DPR transform restored at top of `draw()` (Phaser renderer resets to identity)
  - `resizeCanvas()` notifies Phaser via `game.scale.resize()`
- [x] A/B input comparison with Phaser on main canvas (`inputComparisonHarness.js`)
- [x] **PhaserLayerManager** — central coordinator for Phaser layer modules
- [x] **Background/ground layer** (`BackgroundLayer.js`) — offscreen caching, groundLayer/backgroundLayer fallback
- [x] **Tank track layer** (`TankTrackLayer.js`) — orbit arc + seeded noise particles
- [x] **Fence HP bars** (`FenceHpBarsLayer.js`) — per-segment health bars, skips full-HP
- [x] **Evening dim overlay** (`EveningDimLayer.js`) — attack mode dimming (alpha = baseAlpha × blend)
- [x] game.js `draw()` integration — Phaser draw calls at correct z-position for all 4 layers
- [x] **Fence base/geometry** (`FenceBaseLayer.js`) — delegation to legacy renderFenceBase()
- [x] **Board cells/tanks** (`BoardLayer.js`) — delegation to legacy drawBoard()
- [x] **Orbiting tanks** (`OrbitingTanksLayer.js`) — delegation to legacy drawOrbitingTanks()
- [x] **Supercomputer** (`SupercomputerLayer.js`) — delegation to legacy drawSupercomputer()
- [x] **Production line** (`ProductionLineLayer.js`) — delegation to legacy ProductionLineRender.draw()
- [x] **Zombies/corpses** (`ZombiesCorpsesLayer.js`) — delegation to legacy renderZombiesAndCorpses()
- [x] **Projectiles/effects** (`ProjectilesEffectsLayer.js`) — delegation to legacy renderProjectilesAndEffects()
- [x] **Drones** (`DronesLayer.js`) — delegation to legacy drawDrones()
- [x] game.js `draw()` all 18 layer calls gated by RenderRegistry + PLM delegation
- [x] Audio migration (`audioAdapter.js`) — pool-based Phaser Web Audio bridge

### Phase 3 — UI Migration
- [x] HUD / core overlay — adapter wired into `updateUI()`/`updateProgressUI()`, HudScene created, SceneOverlayManager coordinates scenes
- [x] Modal shell / pause / settings — `ModalAdapter` created, 5 core modals registered; `notifyOpen`/`notifyClose` wired into game.js + levelFlow.js; 3 Phaser modal scenes built (PauseMenuScene, LevelUpScene, CrateRewardScene)
- [x] Progression / meta screens — BigMenuScene, AchievementsScene, AchievementPopupScene built; `_notifyModal` wired for bigMenu + achievementPopup
- [x] Talents / supercomputer — TalentsScene, SupercomputerRootScene built; `_notifyModal` wired for talents + supercomputerRoot
- [x] Help / tutorial overlay — HelpScene (accordion), TutorialOverlayScene (spotlight/cursor/bubble) built; registered in ModalAdapter + SceneOverlayManager
- [x] Underground hangar / workshop / chips — HangarChipsScene (3-tab chip hangar), WorkshopScene (upgrade/craft/recycle sub-tabs), UndergroundHangarScene (15+16 cell grids, 9 drone slots, transfer/buy/merge); `_notifyModal` wired via `onViewChange` callback; ModalAdapter keys: hangarChips, workshop, undergroundHangar
- ~~[ ] Achievements / tutorial / help~~ (merged into lines above)

### Phase 4 — Parity & Rollout
- [x] A/B harness — `ParityHarness` (snapshot/comparison/history) + `ParityGate` (6-category automated verification: structural/render/modal/hud/scene/flags); wired in `initEngineAdapterPhase1()`
- [x] Parity gate pass — `ParityGate.runGate()` checks all 18 render layers, 13 modals, 5 HUD elements, 14 overlay scenes, 16 Phaser scene constructors, 12 layer modules; `canAdvance()` blocks phaser rollout until gate passes
- [x] Default switch to Phaser — `RolloutController` manages 4-phase progression (off→shadow→overlay→phaser); `switchToPhaser()`/`switchToLegacy()` set `usePhaser` flag override; phase application propagates modes to RenderRegistry/ModalAdapter/HudAdapter
- [x] Legacy cleanup — `LegacyCleanupManifest` inventories 17 legacy code paths across 6 categories (loop/render/input/ui/audio/infra) with prerequisites and progress tracking
- [x] Documentation update — detailed Phase 4 section added to PHASER_MIGRATION.md; file structure and test entries updated

## Контракты, которые НЕ меняются

- `window.Game.*` global API
- Save JSON schema (`saveSlot_v1_*`)
- `assets/*.json` runtime contracts
- Partial reset preserves: talents, upgrades, drones, achievements
- New game baseline: computerLevel=0, xpToNext=50, guaranteed first chip
- Render order: fenceBase → zombies/corpses → fenceHpBars → projectiles/effects
- Drag threshold: 6px on pointermove
- AttackMode 3-direction 50/25/25% spawning
- i18n parity ru/en

## Phase 2c — Layer Module Architecture

Phaser layer modules draw to Canvas 2D ctx from **within** the legacy `draw()` call chain at the correct z-position. This preserves render order during incremental migration without z-order interleaving issues.

**Flow**: `GameScene.update()` → `loop(time)` → `draw()` → for each layer: `if (isPhaser) PLM.drawLayer(id, ctx); if (isLegacy) legacyDraw();`

- Each module: `init(config)`, `update(state)`, `draw(ctx)`, `invalidate()`, `destroy()`
- PhaserLayerManager coordinates all modules via `registerLayer()` / `drawLayer()` / `updateAll()`
- Mode `'both'` fires both paths for A/B visual comparison
- Static layers (background, tankTrack) use offscreen canvas caching; dynamic layers (fenceHpBars, eveningDim) recompute each frame
- Delegation layers (fenceBase, board, orbitingTanks, supercomputer, productionLine, zombiesCorpses, projectilesEffects, drones) wrap legacy draw functions via `setDrawFn()` for RenderRegistry gating
- Initialization happens in `initEngineAdapterPhase1()` after RenderRegistry init

## Phase 2c — Delegation Layer Pattern

For layers tightly coupled with closured game state (fence geometry, board grid, orbiting tanks, zombie depth-sort, projectile sprites, drone API), the Phaser module delegates to the legacy draw function via a `setDrawFn(fn)` callback:

```
game.js initEngineAdapterPhase1():
  _PL.FenceBase.setDrawFn(renderFenceBase)    // closured legacy fn
  ...
draw():
  if (_RR.isPhaser('fenceBase'))  PLM.drawLayer('fenceBase', ctx)  → callbacks renderFenceBase()
  if (_RR.isLegacy('fenceBase'))  renderFenceBase()                → direct call
```

This allows:
- RenderRegistry to gate legacy vs phaser vs both (A/B mode)
- Future Phaser GameObjects to replace the drawFn without touching draw() z-order
- All 18 render layers to have uniform PLM lifecycle (init/drawLayer/destroy)

## Файловая структура миграции

```
vendor/
  phaser.min.js              ← Phaser 3.80.1 (vendored)
src/core/
  engineAdapter.js           ← Runtime engine selection facade
src/phaser/
  phaserBootstrap.js         ← Phaser.Game creation & scene registration
  phaserBridge.js            ← step/draw delegation between Phaser and legacy
  clockAdapter.js            ← Clock/pause/runtimeTasks bridge
  inputAdapter.js            ← Phase 2: unified input abstraction + A/B comparison
  renderRegistry.js          ← Phase 2: per-layer legacy/phaser mode registry
  layers/
    PhaserLayerManager.js    ← Phase 2c: central layer coordinator
    BackgroundLayer.js       ← Phase 2c: ground tiles + stamps (offscreen caching)
    TankTrackLayer.js        ← Phase 2c: orbit arc + seeded noise particles
    FenceHpBarsLayer.js      ← Phase 2c: per-segment fence health bars
    EveningDimLayer.js       ← Phase 2c: attack mode dimming overlay
    FenceBaseLayer.js        ← Phase 2c: delegation to legacy renderFenceBase
    BoardLayer.js            ← Phase 2c: delegation to legacy drawBoard
    OrbitingTanksLayer.js    ← Phase 2c: delegation to legacy drawOrbitingTanks
    SupercomputerLayer.js    ← Phase 2c: delegation to legacy drawSupercomputer
    ProductionLineLayer.js   ← Phase 2c: delegation to legacy PLR.draw
    ZombiesCorpsesLayer.js   ← Phase 2c: delegation to legacy renderZombiesAndCorpses
    ProjectilesEffectsLayer.js ← Phase 2c: delegation to legacy renderProjectilesAndEffects
    DronesLayer.js           ← Phase 2c: delegation to legacy drawDrones
  audioAdapter.js              ← Phase 2d: pool-based Phaser Web Audio bridge
  inputComparisonHarness.js    ← Phase 2d: A/B input comparison (legacy vs Phaser)
  hudAdapter.js                ← Phase 3: HUD element dom/phaser/both adapter
  sceneOverlayManager.js       ← Phase 3: overlay scene lifecycle coordinator
  modalAdapter.js              ← Phase 3: modal dom/phaser/both bridge
  scenes/
    BootScene.js             ← Asset preloading for Phaser path
    GameScene.js             ← Main game scene (delegates to legacy initially)
    HudScene.js              ← Phase 3: Phaser HUD overlay scene (Text/Graphics)
    PauseMenuScene.js        ← Phase 3b: Pause/settings menu overlay
    LevelUpScene.js          ← Phase 3b: Level-up reward modal overlay
    CrateRewardScene.js      ← Phase 3b: Military aid crate modal overlay
    BigMenuScene.js          ← Phase 3c: Main progression/meta menu overlay
    AchievementsScene.js     ← Phase 3c: Achievements list modal overlay
    AchievementPopupScene.js ← Phase 3c: Achievement-unlock popup overlay
    TalentsScene.js          ← Phase 3d: Talent tree overlay (3 branches, nodes, edges)
    SupercomputerRootScene.js ← Phase 3d: Supercomputer root navigation tiles
    HelpScene.js             ← Phase 3d: Shared help accordion overlay
    TutorialOverlayScene.js  ← Phase 3d: Tutorial spotlight/cursor/bubble overlay
    HangarChipsScene.js      ← Phase 3e: Chip hangar (3-tab: cells/workshop/techUnlock)
    WorkshopScene.js         ← Phase 3e: Workshop (upgrade/craft/recycle sub-tabs)
    UndergroundHangarScene.js ← Phase 3e: Underground hangar (15+16 cells, 9 drone slots)
  parityHarness.js             ← Phase 4: A/B visual & behavioral comparison
  parityGate.js                ← Phase 4: Automated parity verification (6 categories)
  rolloutController.js         ← Phase 4: 4-phase rollout progression controller
  legacyCleanupManifest.js     ← Phase 4: Legacy code path inventory & tracking
docs/migration/
  PHASER_MIGRATION.md        ← This spec
  RISK_REGISTER.md           ← Risk register
Test/pack10/
  phaser_migration_baseline.test.js  ← 29 tests (Phase 1)
  phaser_migration_phase2.test.js    ← 37 tests (Phase 2a input/render)
  phaser_migration_phase2b.test.js   ← 33 tests (Phase 2b loop handoff)
  phaser_migration_phase2c.test.js   ← 46 tests (Phase 2c layer modules)
  phaser_migration_phase2c_delegation.test.js ← 71 tests (Phase 2c delegation layers)
  phaser_migration_phase2d.test.js             ← 43 tests (Phase 2d audio/input/HUD)
  phaser_migration_phase3a.test.js             ← 51 tests (Phase 3a scene overlay/modal/HUD wiring)
  phaser_migration_phase3b.test.js             ← 33 tests (Phase 3b modal scenes + notifyOpen/notifyClose)
  phaser_migration_phase3c.test.js             ← 23 tests (Phase 3c progression/meta + achievement scenes)
  phaser_migration_phase3d.test.js             ← Phase 3d talents/supercomputer/help/tutorial scenes
  phaser_migration_phase3e.test.js             ← 44 tests (Phase 3e hangar/workshop/underground)
  phaser_migration_phase4.test.js              ← 55 tests (Phase 4 parity/rollout/cleanup)
```

## Phase 2d — Audio, Input Comparison & HUD Adapter

### PhaserAudioAdapter (`audioAdapter.js`)
Bridges audio between legacy HTML5 Audio pools and Phaser 3 Web Audio.
- Pool-based playback (default pool size 6, matching legacy `sfxPoolRuntime`)
- Requires `preloadSfx(id, urls)` before `playSfx(id, opts)`
- Inactive without a running Phaser game — all calls no-op safely
- Init deferred via `PhaserBridge.whenSceneReady()` because sound manager needs a live game
- `pauseAll()` / `resumeAll()` delegate to Phaser sound manager

### InputComparisonHarness (`inputComparisonHarness.js`)
Structured A/B comparison for legacy vs Phaser pointer coordinates.
- Default tolerance: 2px; frame window: 16ms
- Logs mismatches to console every 10s (max 200 entries)
- `getReport()` returns `{ totalEvents, matched, mismatched, matchRate, maxDelta, avgDelta }`
- Enabled only when `EngineAdapter.isPhaser()` is true
- Phaser pointer events wired in `PhaserBridge.whenSceneReady()` callback

### HudAdapter (`hudAdapter.js`)
Phase 3 shell for migrating HUD elements from DOM to Phaser GameObjects.
- `registerElement(id, domEl, options)` — types: text, progress, button, container
- `setMode(id, 'dom'|'phaser'|'both')` — auto-hides DOM when mode='phaser'
- `updateText(id, text)` — skips unchanged text (avoids DOM thrashing)
- `updateProgress(id, ratio)` — clamps 0–1
- Core elements registered in `initEngineAdapterPhase1()`: coins, zcount, xpBar, lvlText, xpText

### Bootstrap changes (`phaserBootstrap.js`)
- `audio.noAudio` now configurable via `config.noAudio` (was hardcoded `true`)
- Phaser input (mouse/touch) enabled via `!config.noInput` for A/B comparison

## Phase 3a — HUD Wiring, Scene Overlay & Modal Adapter

### HudAdapter wired into game loop
`updateUI()` and `updateProgressUI()` in game.js now route through `HudAdapter` when initialized:
- `coins`, `zcount` → `HudAdapter.updateText(id, text)` (was direct `el.textContent =`)
- `lvlText`, `xpText` → `HudAdapter.updateText(id, text)`
- `xpBar` → `HudAdapter.updateProgress('xpBar', ratio)` (was manual `style.width`)
- Fallback: if HudAdapter not initialized, direct DOM writes as before

### SceneOverlayManager (`sceneOverlayManager.js`)
Coordinates Phaser overlay scenes (HUD, future modals) running in parallel with GameScene.
- `register(key, options)` — register scene for management, optional `autoLaunch`
- `show(key)` / `hide(key)` — wake/sleep Phaser scenes via scene manager
- `getState(key)` → `'active'` | `'sleeping'` | `'stopped'` | `null`
- Initialized in `whenSceneReady()` callback with the Phaser.Game reference
- HudScene registered (not auto-launched — manual activation for A/B comparison)

### HudScene (`scenes/HudScene.js`)
Phaser 3 overlay scene for native HUD rendering.
- Creates Phaser.GameObjects.Text for coins, kills, level, XP
- Creates Phaser.GameObjects.Graphics for XP bar (background + fill)
- Calls `HudAdapter.setPhaserObject(id, obj)` to wire Phaser objects
- `input.enabled = false` — all input flows through to GameScene
- `show()` / `hide()` methods for SceneOverlayManager control
- `refreshLabels(translate)` for i18n language changes
- Starts hidden; SceneOverlayManager controls visibility

### ModalAdapter (`modalAdapter.js`)
Bridge for modal dialog migration from DOM to Phaser.
- `registerModal(id, domEl, options)` — register with hiddenClass, callbacks
- `open(id, data)` / `close(id)` — routes to DOM and/or SceneOverlayManager
- `setMode(id, 'dom'|'phaser'|'both')` — controls rendering target
- `setPhaserSceneKey(id, key)` — associates modal with a Phaser overlay scene
- Core modals registered: pauseMenu, bigMenu, crateReward, levelUp, achievements
- Currently all mode='dom'; Phaser scene keys attached as scenes are built

### Bootstrap changes (`phaserBootstrap.js`)
- HudScene added to scene list (after GameScene) when available

## Phase 3b — Modal Scenes + notifyOpen/notifyClose Bridge

### notifyOpen / notifyClose (`modalAdapter.js`)
ModalAdapter gained two new methods for non-intrusive integration with existing modal flows:
- `notifyOpen(id, data)` — updates internal state + launches Phaser scene (if mode includes Phaser). Does NOT touch DOM; caller handled that.
- `notifyClose(id)` — updates state + hides Phaser scene. Does NOT touch DOM.
- In `phaser` mode, `notifyOpen` also hides DOM (since the caller showed it, override is needed).
- In `dom` or `both` mode, DOM is left untouched.

### _notifyModal helper (`game.js`)
A lightweight bridge function wired at the end of existing modal open/close entry points:
- `setMenuOpen()` → `_notifyModal('pauseMenu', shouldOpen)`
- `openCrateModal()` / `closeCrateModal()` → `_notifyModal('crateReward', ...)`
- `openAchievementsModal()` / `closeAchievementsModal()` → `_notifyModal('achievements', ...)`
- `openLevelModal()` / `closeLevelModal()` (in `levelFlow.js`) → direct `ModalAdapter.notifyOpen/Close('levelUp', ...)`
- All calls skip gracefully if ModalAdapter is not initialized.

### PauseMenuScene (`scenes/PauseMenuScene.js`)
Phaser 3 overlay for pause/settings menu:
- Backdrop + panel with border, title, close (×) button
- 5 menu buttons: Continue, New Game, Save, Load, Exit
- Settings section: SFX and Music sliders (draggable zones)
- Confirmation dialog overlay for New Game/Exit actions
- `show(data)` accepts: `canContinue`, callbacks (`onClose`, `onContinue`, `onNewGame`, `onSave`, `onLoad`, `onExit`, `onSfxChange`, `onMusicChange`), volumes, `translate`
- `hide()` — resets to root view, sleeps scene
- Save/Load subviews are NOT implemented yet (deferred to Phase 3c)

### LevelUpScene (`scenes/LevelUpScene.js`)
Phaser 3 overlay for level-up reward modal:
- Panel (360×260): title, 2 reward text lines (points/damage, gold), accept button, close (×) button
- `show(data)` accepts: `level`, `points`, `gold`, `damagePoints`, `onAccept`, `translate`, `formatNumber`
- Supports both `levelModalTalent` (points only) and `levelModalTalentWithDamage` (points + damage) i18n variants
- `hide()` clears text and callbacks

### CrateRewardScene (`scenes/CrateRewardScene.js`)
Phaser 3 overlay for military aid crate modal:
- Panel (340×300): title, tank icon placeholder (colored by level), body text, claim (primary) and dismiss (secondary) buttons
- Backdrop click dismisses; panel blocks propagation
- `show(data)` accepts: `rewardLevel`, `onClaim`, `onDismiss`, `translate`
- Tank level → color mapping for the icon placeholder (7 tiers)
- `hide()` clears callbacks

### Bootstrap changes (`phaserBootstrap.js`)
- PauseMenuScene, LevelUpScene, CrateRewardScene added to scene list after HudScene
- Registered with SceneOverlayManager and ModalAdapter scene keys in `whenSceneReady()` callback

### game.js wiring (`initEngineAdapterPhase1`)
- SceneOverlayManager: registered PauseMenuScene, LevelUpScene, CrateRewardScene
- ModalAdapter: `setPhaserSceneKey('pauseMenu', 'PauseMenuScene')`, likewise for crateReward→CrateRewardScene, levelUp→LevelUpScene

## Phase 3c — Progression/Meta Screens + Achievement Scenes

### BigMenuScene (`scenes/BigMenuScene.js`)
Phaser 3 overlay for the main progression/meta menu (replaces DOM `#bigMenuOverlay`):
- Root view: 5 buttons (New Game, Load, Sound, Language, Credits) + auto-pause toggle
- Load subview: 10 save-slot rows with slot name, delete action
- Sound subview: SFX + Music sliders (draggable zones with 0–1 range)
- Language subview: RU / EN buttons with highlight for current language
- Credits subview: scrollable multi-line text
- Confirm overlay for New Game action (Yes/No)
- `show(data)` accepts: `onNewGame, onLoadSlot, onSfxChange, onMusicChange, onAutoPauseChange, onLanguageChange, onClose, sfxVolume, musicVolume, autoPause, currentLang, slots, credits, translate`
- `hide()` resets to root view; `shutdown()` destroys all GameObjects

### AchievementsScene (`scenes/AchievementsScene.js`)
Phaser 3 overlay for achievements list modal (replaces DOM `#achievementsModal`):
- 10 pre-created card slots with expand/collapse interaction
- Each card: title + progress bar + reward text; expanded shows condition detail
- Deferred claim button (shows count badge)
- Backdrop dismissal, close (×) button
- `show(data)` accepts: `defs, unlocked, getProgress, deferredCount, onClaimDeferred, onClose, translate`
- `hide()` collapses all cards

### AchievementPopupScene (`scenes/AchievementPopupScene.js`)
Phaser 3 overlay for achievement-unlock popup (replaces DOM `#achievementPopup`):
- Name, condition, reward text fields
- Claim (green) and Dismiss (gray) buttons
- Green border panel (0x44cc44)
- `show(data)` accepts: `name, condition, reward, onClaim, onDismiss, translate`
- `hide()` clears text and callbacks

### _notifyModal wiring
- `openAchievementPopupEvent()` → `_notifyModal('achievementPopup', true, { name, condition, reward })`
- `closeAchievementPopup()` → `_notifyModal('achievementPopup', false)`
- `setBigMenuOpen(open)` → `_notifyModal('bigMenu', !!open)`

### Bootstrap changes (`phaserBootstrap.js`)
- BigMenuScene, AchievementsScene, AchievementPopupScene added to scene list after CrateRewardScene

### game.js wiring (`initEngineAdapterPhase1`)
- SceneOverlayManager: registered BigMenuScene, AchievementsScene, AchievementPopupScene
- ModalAdapter: `setPhaserSceneKey('bigMenu', 'BigMenuScene')`, achievements→AchievementsScene, achievementPopup→AchievementPopupScene
- `achievementPopup` modal registered with `registerModal('achievementPopup', achPopupEl, { hiddenClass: 'hidden' })`

## Phase 4 — Parity & Rollout

### ParityHarness (`parityHarness.js`)
A/B visual & behavioral comparison between legacy and Phaser rendering paths.
- `captureSnapshot()` — captures engine state, render layers, HUD elements, modals, scenes, input report
- `runComparison()` — runs all check categories (engine, render layers, HUD, modals, scenes, input)
- Each check returns `{ id, pass, message }`; aggregate: `{ pass, total, passed, failed, checks }`
- History of up to 50 recent comparisons accessible via `getHistory()`
- Activated when `adapter.isPhaser()` — inert in legacy mode

### ParityGate (`parityGate.js`)
Automated parity verification — go/no-go gate before switching default engine.
- 6 check categories: `structural`, `render`, `modal`, `hud`, `scene`, `flags`
- **Structural**: validates all 14 core modules, 16 Phaser scenes, 12 layer modules exist
- **Render**: verifies 18 render layer IDs in RenderRegistry + 12 PLM registrations
- **Modal**: checks 13 expected modals registered, Phaser scene keys assigned, none stuck open
- **HUD**: confirms 5 HUD elements registered (coins, zcount, xpBar, lvlText, xpText)
- **Scene**: validates 14 overlay scenes registered in SceneOverlayManager
- **Flags**: confirms `usePhaser` flag defined and reports current value
- `runGate()` returns aggregate `{ pass, total, passed, failed, results }` with per-category detail

### RolloutController (`rolloutController.js`)
Manages safe 4-phase progression from legacy to Phaser:
- **off** — legacy only, `usePhaser=false`
- **shadow** — Phaser boots for A/B comparison, no visible Phaser output
- **overlay** — both paths render (`both` mode on layers/modals/HUD)
- **phaser** — Phaser is primary, legacy stripped
- `advance()` checks `canAdvance()` before proceeding; advancing to `phaser` requires passing `ParityGate`
- `rollback()` goes to previous phase
- `switchToPhaser()` / `switchToLegacy()` — convenience: sets `usePhaser` flag override + phase
- `setAllLayerModes(mode)` / `setAllModalModes(mode)` / `setAllHudModes(mode)` — bulk mode propagation
- Phase application automatically sets RenderRegistry (legacy/both/phaser), ModalAdapter (dom/both/phaser), HudAdapter (dom/both/phaser)

### LegacyCleanupManifest (`legacyCleanupManifest.js`)
Inventory of 17 legacy code paths across 6 categories, each with prerequisite condition:
- **loop** (2): legacy RAF loop, `phaserLoopActive` flag
- **render** (4): `isLegacy()` branches in `draw()`, `both` mode support, delegation `setDrawFn()`, DPR transform
- **input** (2): legacy pointer events, InputComparisonHarness
- **ui** (4): DOM modals, DOM HUD, ModalAdapter DOM path, HudAdapter DOM path
- **audio** (1): legacy HTML5 Audio pools
- **infra** (4): EngineAdapter legacy branch, `usePhaser` flag, parity modules, `clearBeforeRender` workaround
- `markDone(id)` tracks cleanup progress; `getSummary()` reports overall progress percentage

### game.js wiring (`initEngineAdapterPhase1`)
- ParityHarness: `init({ enabled: adapter.isPhaser() })` — activated only in Phaser mode
- ParityGate: `init()` — ready for manual/automated gate checks
- RolloutController: `init()` — detects initial phase from flag state
- All Phase 4 modules initialized after ModalAdapter, before PhaserBridge delegates
