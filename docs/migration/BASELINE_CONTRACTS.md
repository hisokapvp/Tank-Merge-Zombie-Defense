# Phaser 3 Migration — Baseline Contracts

> Зафиксировано: 2026-03-26. Это acceptance baseline для parity-проверок.
> Любое изменение ниже при миграции = regression.

## 1. State / Save Shape

- State — plain JS object, создаётся `createInitialState()` в `src/persistence/initialState.js`
- Save format: `saveSlot_v1_*` в localStorage, `payload.version = 1`
- Slots: 10 статичных (0-9), slot 9 = auto (pre-retry)
- `serializeState()` / `restoreFullState()` — каноническая сериализация
- Keys: `saveSlotsMeta_v1`, `saveSlot_v1_0..9`, legacy `progress`
- Offline progress accrual через `src/persistence/offlineProgress.js`

## 2. Reset Semantics

### New Game (`reason='new_game'`)
- `player.talentPoints = 0`, `player.damagePoints = 0`
- `talentsV2.freePoints = 0`, `freeTalentPointsV2 = 0`
- `supercomputer.computerLevel = 0`, `xp = 0`, `xpToNext = 50`
- `productionLine.firstNewGameBoxGuaranteedPending = true`
- Guaranteed first chip: red `one_big_chip` L1, `chipId > 0`, 3 unique base `modIds`

### Partial Reset (snapshot restore)
- Preserves: talents (ranksById/freePoints), upgrades, drones, achievements, damagePoints, computerLevel, xp
- Resets: walls to L1, tank prices, runtime attackMode, zombie population
- Post-restore: fence reinit L1, buyCounts/buyPrices cleared, attackMode off, drone positions teleported

## 3. Render Order (z-order in `draw()`)
1. Background (ground layer)
2. Tank track
3. Fence base
4. Board (cells/tanks)
5. Orbiting tanks
6. Supercomputer (root sprite)
7. Production Line (conveyor/storage/boxes)
8. Zombies & corpses (depth-sorted with decors)
9. Fence HP bars
10. Talent status icons
11. Zombie debuff overlays
12. Projectiles & effects
13. Drones
14. Crate
15. Weather overlay
16. Attack mode evening dim
17. Level-up VFX
18. SC boost icons
19. Debug overlays (conditional)
20. SC HP bar overlay (LAST — above everything)

## 4. Input Contracts
- Drag threshold: **6px** on `pointermove` distance before switching tap→drag
- DPR scaling: canvas CSS size ≠ internal resolution; pointer coords transformed
- Hit-testing: board cells, tanks, supercomputer interactive areas
- Touch support: unified pointer events (mouse + touch)

## 5. AttackMode Spawning
- 3 fixed episode directions
- Distribution: 50% / 25% / 25%
- Episodes triggered by runtime conditions

## 6. Audio
- Music loop: continuous, pause-aware
- SFX pool: `src/audio/sfxPoolRuntime.js`
- Pause/resume: audio suspends with game pause
- Volume: settings-driven, user-adjustable

## 7. Tutorial First-Run
- First available incomplete step is always selected (no skip-ahead)
- Completion gates per step type
- `tutorials` state persisted in save
- `firstNewGameBoxGuaranteedPending` ensures first chip reward

## 8. i18n Parity
- `src/i18n/ru.json` and `src/i18n/en.json` always synced
- `src/i18n/fallbackStrings.js` holds critical fallbacks
- All user-visible strings through `t()` or `data-i18n`

## 9. Achievement Reward Timing
- Rewards granted BEFORE popup shown
- `processAchievementProgress()` → `reconcileAchievementRewards()` → queue popup
- Popup buttons only dismiss; they don't gate rewards

## 10. Production Line
- Kill-hook triggers conveyor `work` (not `buildTank`)
- Root `buildTank` animation triggered only by tank purchase
- Duration from `assets/tanks.json → tankPrintDurationSec`
- Box print: bottom-up reveal clip (`printLow` → `printHigh`)

## 11. Supercomputer
- HP bar: separate overlay, drawn last
- Sprite: atlas-driven, state-based animation
- Effects: data-driven transforms from `assets/supercomputer.json`
- Layout: `initBoard()` syncs with production line

## 12. Performance Baseline
- Target: 60 FPS on desktop, adaptive on mobile
- Hot-path functions: no heap allocations in `loop()`, `draw()`, `step*()`
- `draw()` only renders; no state mutation
- Mobile mode: FPS cap, reduced particles/decals
