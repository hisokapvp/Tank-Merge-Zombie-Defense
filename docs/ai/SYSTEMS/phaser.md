# Система: Phaser 3 runtime и hybrid seam

> Обновлено: 2026-03-27.
> Master spec: `docs/migration/PHASER_MIGRATION.md`. Risk register: `docs/migration/RISK_REGISTER.md`.

## Статус
Все фазы 0–4 завершены. Phaser runtime готов к rollout через `Game.RolloutController`.

Это не архив завершённой миграции, а текущий runtime-contract для hybrid режима: legacy Canvas 2D, DOM overlays и Phaser scenes/layers живут вместе и разделяют rollout/parity seam.

## Когда читать этот файл
- Всегда перед render/UI/runtime/hud/input правками в TMZD.
- Для TMZD visual/UI/UX/layout/modal/HUD style-sensitive задач этот файл читается вместе с `docs/ai/SYSTEMS/ui.md`.
- TMZD-specific UX route для такой поверхности идёт через `tmzd-ux-ui-designer`; если правка затрагивает runtime, adapters, scenes, layers или rollout, инженерный маршрут остаётся в зоне `tmzd-developer`.

## Архитектура

### Feature flag
- `Game.Flags` → `usePhaser` (rollout: 0 = off по умолчанию): [src/flags/flags.js](../../../src/flags/flags.js)
- localStorage override: `Game.Flags.setOverride('usePhaser', true)` включает Phaser

### Engine seam
- `Game.EngineAdapter` — фасад выбора runtime (legacy/phaser): [src/core/engineAdapter.js](../../../src/core/engineAdapter.js)
- `Game.PhaserBridge` — bridge между Phaser Scene update и legacy `loop(time)`: [src/phaser/phaserBridge.js](../../../src/phaser/phaserBridge.js)
- `Game.ClockAdapter` — now/pause/delta bridge: [src/phaser/clockAdapter.js](../../../src/phaser/clockAdapter.js)

### Bootstrap & scenes
- `Game.PhaserBootstrap` — creates `Phaser.Game`, registers all scenes: [src/phaser/phaserBootstrap.js](../../../src/phaser/phaserBootstrap.js)
- 16 Phaser scenes: BootScene, GameScene, HudScene + 13 overlay/modal scenes в `src/phaser/scenes/`
- `Game.SceneOverlayManager` — lifecycle coordinator для 14 overlay scenes: [src/phaser/sceneOverlayManager.js](../../../src/phaser/sceneOverlayManager.js)

### Per-layer rendering
- `Game.RenderRegistry` — per-layer mode tracking (legacy/phaser/both): [src/phaser/renderRegistry.js](../../../src/phaser/renderRegistry.js)
- `Game.PhaserLayerManager` — central coordinator для Phaser layer modules: [src/phaser/layers/PhaserLayerManager.js](../../../src/phaser/layers/PhaserLayerManager.js)
- 12 layer modules: Background, TankTrack, FenceBase, Board, OrbitingTanks, Supercomputer, ProductionLine, ZombiesCorpses, FenceHpBars, ProjectilesEffects, Drones, EveningDim → `src/phaser/layers/*.js`

### Input
- `Game.InputAdapter` — coord transform, DPR, drag threshold, hit-testing: [src/phaser/inputAdapter.js](../../../src/phaser/inputAdapter.js)
- `Game.InputComparisonHarness` — A/B legacy vs Phaser input comparison: [src/phaser/inputComparisonHarness.js](../../../src/phaser/inputComparisonHarness.js)

### UI bridge
- `Game.ModalAdapter` — per-modal mode (dom/phaser/both), 13 modals: [src/phaser/modalAdapter.js](../../../src/phaser/modalAdapter.js)
- `Game.HudAdapter` — per-element mode (dom/phaser/both), 5 HUD elements: [src/phaser/hudAdapter.js](../../../src/phaser/hudAdapter.js)
- DOM overlays, Phaser overlay scenes и HUD adapters образуют общий visual contract; layout/modal/HUD правки нельзя описывать как Canvas-only cosmetic patch.

### UI scale seam (hybrid Canvas + Phaser)
- `resizeCanvas()` в `game.js` вычисляет master `--ui-scale` по формуле `max(0.4, min(displayW / 1920, displayH / 1080))`, пишет token в `:root` и сразу вызывает `syncHybridUiScale()`; это единственный source-of-truth для DOM shells, HUD, tutorial и Phaser overlays: [game.js](../../../game.js#L2374-L2430).
- `Game.HudAdapter.refreshUiScale()` и `Game.ModalAdapter.refreshUiScale()` не считают scale локально, а читают его через `Game.getUiScale()`/переданный token и проталкивают дальше в HUD elements и modal overlay path: [src/phaser/hudAdapter.js](../../../src/phaser/hudAdapter.js#L46-L63), [src/phaser/hudAdapter.js](../../../src/phaser/hudAdapter.js#L251-L284), [src/phaser/modalAdapter.js](../../../src/phaser/modalAdapter.js#L51-L55), [src/phaser/modalAdapter.js](../../../src/phaser/modalAdapter.js#L272-L306).
- `Game.SceneOverlayManager` хранит `uiScale` per overlay, а scene side применяет scale через `setUiScale()` или event `ui-scale-changed`; scene modules не должны вводить второй независимый scale contract: [src/phaser/sceneOverlayManager.js](../../../src/phaser/sceneOverlayManager.js#L38-L64), [src/phaser/sceneOverlayManager.js](../../../src/phaser/sceneOverlayManager.js#L107-L140), [src/phaser/sceneOverlayManager.js](../../../src/phaser/sceneOverlayManager.js#L228-L285).
- UI scale seam обязан сохранять общие TMZD invariants: close/help controls остаются минимум `44×44`, font floor остаётся `12px`, pointer drag threshold — `6px`, а render z-order не меняется от того, что Phaser overlay получил новый scale: [src/ui/fontFloor.js](../../../src/ui/fontFloor.js#L22-L133), [src/phaser/inputAdapter.js](../../../src/phaser/inputAdapter.js), [game.js](../../../game.js#L11127-L11200).

### Audio
- `Game.AudioAdapter` — pool-based Phaser Web Audio bridge: [src/phaser/audioAdapter.js](../../../src/phaser/audioAdapter.js)

### Parity & rollout
- `Game.ParityHarness` — A/B snapshot/comparison (6 check categories): [src/phaser/parityHarness.js](../../../src/phaser/parityHarness.js)
- `Game.ParityGate` — automated go/no-go gate (structural/render/modal/hud/scene/flags): [src/phaser/parityGate.js](../../../src/phaser/parityGate.js)
- `Game.RolloutController` — 4-phase progression (off→shadow→overlay→phaser): [src/phaser/rolloutController.js](../../../src/phaser/rolloutController.js)
- `Game.LegacyCleanupManifest` — 17 legacy code paths inventory: [src/phaser/legacyCleanupManifest.js](../../../src/phaser/legacyCleanupManifest.js)

## game.js wiring
Основная инициализация Phaser subsystem: `initEngineAdapterPhase1()` в [game.js](../../../game.js) — в порядке:
1. EngineAdapter → выбор runtime
2. PhaserBootstrap → создание `Phaser.Game` и регистрация scenes
3. RenderRegistry → регистрация 18 layer modes
4. PhaserLayerManager → регистрация 12 layer modules
5. InputAdapter → привязка pointer handling
6. SceneOverlayManager → регистрация 14 overlay scenes
7. ModalAdapter → регистрация 13 modals
8. HudAdapter → регистрация 5 HUD elements
9. ParityHarness → init (active only if `adapter.isPhaser()`)
10. ParityGate / RolloutController → init
11. PhaserBridge → step/draw delegation

## Тесты
| Файл | Тесты | Покрытие |
|---|---|---|
| `Test/pack10/phaser_migration_baseline.test.js` | 29 | Phase 0–1 |
| `Test/pack10/phaser_migration_phase2.test.js` | 37 | Phase 2 input/render |
| `Test/pack10/phaser_migration_phase2c.test.js` | 46 | Phase 2c layer modules |
| `Test/pack10/phaser_migration_phase2c_delegation.test.js` | 71 | Phase 2c+d delegation |
| `Test/pack10/phaser_migration_phase2d.test.js` | 43 | Phase 2d audio |
| `Test/pack10/phaser_migration_phase3a.test.js` | 51 | Phase 3a HUD/overlay |
| `Test/pack10/phaser_migration_phase3b.test.js` | 33 | Phase 3b modals |
| `Test/pack10/phaser_migration_phase3c.test.js` | 23 | Phase 3c progression |
| `Test/pack10/phaser_migration_phase3d.test.js` | 35 | Phase 3d talents/SC |
| `Test/pack10/phaser_migration_phase3e.test.js` | 44 | Phase 3e hangar/workshop |
| `Test/pack10/phaser_migration_phase4.test.js` | 55 | Phase 4 parity/rollout |

## Инварианты ⚠️
- `usePhaser` flag default = off; включение только через `RolloutController` или manual override
- Advancing to `phaser` phase blocked unless `ParityGate.runGate().pass === true`
- Layer z-order в `draw()` сохраняется идентичным legacy pipeline
- `clearBeforeRender: false` — Phaser не очищает Canvas, legacy 2D output сохраняется в hybrid mode
- DPR transform восстанавливается в начале `draw()` (Phaser renderer resets to identity)
