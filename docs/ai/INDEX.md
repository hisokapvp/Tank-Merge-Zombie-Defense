# INDEX — быстрый роутинг для агента

## Стартовая точка

- `index.html` — порядок подключения модулей.
- `game.js` — `boot`, `loop`, `draw` и orchestration.

## Куда идти по задаче

- Рендер/Canvas/FPS → `docs/ai/SYSTEMS/render.md`
- Combat FX policy (`tank -> zombie`: включены projectile/impact VFX и shoot SFX; weather SFX не затрагивается) → `docs/ai/SYSTEMS/render.md`
- Тюнинг зазоров ангара/трека/забора → `src/config/layoutTuning.js` + `docs/ai/SYSTEMS/render.md`
- Input/drag-drop/hit-test → `docs/ai/SYSTEMS/input.md`
- UI/modals/i18n/a11y → `docs/ai/SYSTEMS/ui.md`
- Main menu gating (big start menu блокирует boot/loop до выбора `Новая игра`/`Загрузить`; `Загрузить` доступна при валидном сохранении) → `docs/ai/SYSTEMS/ui.md` + `docs/main-menu.md`
- Main menu feedback (`#menuFeedback` -> `Game.FeedbackWidget.open()`) + feedback i18n keys (`feedback*`) → `docs/ai/SYSTEMS/ui.md`
- In-session small menu (`#menuOverlay`): removed language switch, `Сохранить` (10 name-only slots in `saveSlotsMeta_v1`), `Выход` (confirm + runtime reset without reload, remove `progress` only) → `docs/ai/SYSTEMS/ui.md` + `docs/ai/SYSTEMS/save.md` + `docs/main-menu.md`
- Crate reward spawn policy (reward всегда в `crateSlotId`, без fallback в другой слот; race-safe skip with log) → `game.js` + `docs/ai/SYSTEMS/ui.md`
- Achievement unlock toast queue/highlight UX (`unlockedNow -> state.achievements.popupQueue -> pause-gated consume`) → `docs/ai/SYSTEMS/ui.md`
- Supercomputer + Boost UI (`#supercomputerBtn` плавающая кнопка справа от спрайта в screen-space, root tiles всегда в 1 ряд без wrap, tabs `Орудия/Базы/Стены` без теней при сохранении фоновой hover/active подсветки, active boost icons rows+group centering по `supercomputer.json.boostIcons`, Esc/back routing, дефолт `Орудия`) → `docs/ai/SYSTEMS/ui.md` + `docs/ai/SYSTEMS/assets.md` + `docs/ai/SYSTEMS/render.md` + `docs/supercomputer-ui.md` + `docs/supercomputer-hud.md`
- Critical mode (5% HP clamp, `criticalFlowActive`, autosave с очисткой `cells[].tank`, critical modal actions `exit/restart`) → `docs/critical-mode.md` + `docs/ai/SYSTEMS/ui.md` + `docs/ai/SYSTEMS/combat.md` + `docs/ai/SYSTEMS/save.md`
- Баланс боя/спавн/экономика/прогресс → `docs/ai/SYSTEMS/combat.md`
- Supercomputer (config/state machine/уровень) → `docs/supercomputer.md` + `docs/ai/SYSTEMS/combat.md` + `docs/ai/SYSTEMS/render.md`
- Achievements/progress (`state.stats` counters, creator_* purchases, engineer_* merges; bulk-buy + auto-merge tiers) → `docs/ai/SYSTEMS/achievements.md` + `docs/achievements.md`
- Achievements modal UI (title-only default, `+` collapse, single-open) → `docs/ai/SYSTEMS/ui.md` + `docs/achievements-ui.md`
- Zombie AI state machine / target selector (`supercomputer` приоритет, `fence` по пути) → `docs/zombie-ai.md` + `docs/ai/SYSTEMS/combat.md`
- Zombie movement collision policy (коллизия только с целым fence и `decor.isWall`; вход через брич своей стороны (side-lock); после брича — прямое движение к supercomputer без внутреннего радиального clamp) → `docs/ai/SYSTEMS/combat.md`
- Save/offline/continue flow (offline modal disabled) → `docs/ai/SYSTEMS/save.md`
- Damage points (`totalDamageDealtRaw`, `damagePoints`) → `docs/ai/SYSTEMS/combat.md` + `docs/ai/SYSTEMS/save.md` + `src/ui/supercomputerMenu.js`
- Fence levels/armor/upgrade (`fenceLevel`, `armorFlat`, `damagePointsSpent`) → `docs/ai/SYSTEMS/fence.md` + `docs/ai/SYSTEMS/combat.md` + `docs/ai/SYSTEMS/save.md` + `docs/ai/SYSTEMS/ui.md`
- Fence breach side-knowledge (`getSideByPosition`, `breachesBySide`, side-limited `holeAabb` pass) → `docs/ai/SYSTEMS/fence.md` + `game.js` + `src/render/fenceLayout.js`
- New Game reset (`menuNew`): сброс world-events runtime (`aliveMultCurrent=1`) до первого спавна + правило стартового `talentPoints` → `docs/ai/SYSTEMS/worldEvents.md` + `docs/ai/SYSTEMS/save.md` + `README.md`
- Save/offline reward-claim resilience (ad fail-safe) → `docs/ai/SYSTEMS/save.md`
- Ассеты/JSON/спрайты → `docs/ai/SYSTEMS/assets.md`
- Tank/Bullet схемы (`tank_lvlN`, `assets/bullet.json`, atlas-only bullet/impact) → `docs/ai/SYSTEMS/assets.md`
- Генерация карты (ground stamps + decor placement) → `docs/map-generation.md` + `docs/ai/SYSTEMS/render.md`
- Seeded placement stamps/decor + `state.mapSeeds` (save/load) → `docs/map-generation.md` + `docs/ai/SYSTEMS/render.md` + `docs/ai/SYSTEMS/save.md`
- Стыковка corner/side у забора и ручная подстройка `cornerInsetPx` → `docs/fence-layout.md` + `docs/ai/SYSTEMS/render.md`
- Удаление щелей на стыках corner↔side (snap + overlap) → `src/render/fenceLayout.js` + `docs/ai/SYSTEMS/render.md`
- Audio/SFX/pause-resume → `docs/ai/SYSTEMS/audio.md`
- Telemetry/analytics/flags/experiments/funnel → `docs/ai/SYSTEMS/telemetry.md`
- World events/weather/attackMode → `docs/ai/SYSTEMS/worldEvents.md`
- Wave anti-exploit (`safeWaves`, `zombieWaveAtkMult`, reset на New Game) → `docs/ai/SYSTEMS/worldEvents.md` + `docs/ai/SYSTEMS/save.md`
- World events (product doc) → `docs/world-events.md`
- Shop bulk-buy UX (product doc) → `docs/ui-shop.md`
- Auto-merge tiers/pairing/snapshot rules → `docs/auto-merge.md` + `docs/ai/SYSTEMS/achievements.md`
- Производительность/mobile/object pool → `docs/ai/SYSTEMS/perf.md`
- Lesson Progress/SRS/Anki/feedback/debug-panels → `docs/ai/SYSTEMS/ui.md`
- Runtime debug overlay (`?debug=1`, hotkeys) → `docs/debug-overlay.md`
- Debug panel dev-инструменты (achievements / totalMerges) → `docs/debug.md` + `docs/ai/SYSTEMS/achievements.md`
- Dron repair system (always-on `🔧`, repair patrol/scan/claim FSM, repair-time coin charge, render layer above gameplay and below rain/lightning) → `docs/dron.md` + `docs/ai/SYSTEMS/combat.md` + `docs/ai/SYSTEMS/render.md` + `docs/ai/SYSTEMS/save.md` + `docs/ai/SYSTEMS/assets.md` + `docs/ai/SYSTEMS/ui.md`
- BonusBox/crate sprite-анимации (`drop/idle/hover/press`, clip-схема `x/y/w/h/frames/frameRateFps`) → `docs/bonusbox.md` + `docs/ai/SYSTEMS/render.md` + `docs/ai/SYSTEMS/assets.md`

## Карта кода

- `src/mechanics/` — игровые правила.
- `src/lessons/`, `src/scheduler/`, `src/tools/anki/` — контур обучения (catalog + SRS + export).
- `src/persistence/` — save/load/offline.
- `state.totalDamageDealtRaw` — сырой урон от танков (applied, без overkill), используется для UI-метрики `damagePoints`.
- `src/render/` — canvas и загрузчики.
- `src/render/fenceLayout.js` — геометрия сегментов квадратного забора (scale-aware шаг/инсеты).
- `game.js` — runtime логика fence HP/урона/ремонта/уровней (`applyFenceSegmentDamage`, `tryRepairFenceSegmentAt`, `tryUpgradeFenceLevel`).
- `src/ui/` — UI-модули, модалки, панели.
- `src/ui/supercomputerMenu.js` — root/child supercomputer overlays (A11y open/close, Esc/back routing).
- `src/ui/criticalModal.js` — critical overlay controller (`open/close/isOpen`, typewriter/skip/final actions).
- `src/config/criticalModalTuning.js` — tuning (`charsPerSec`, `linePauseMs`, `afterFinishPauseMs`).
- `src/feedback/` — in-game feedback widget (programmatic modal `open()`/`showModal()`, без floating button).
- `src/perf/` — профилирование и лимиты.
- `src/i18n/` — RU/EN строки.
- `assets/` — JSON-конфиги и изображения.
- `Test/` — регрессионные пакеты.

## Куда идти за процедурой

- Типовые изменения: `docs/ai/PLAYBOOKS/*`
- Правила и DoD: `docs/ai/STYLE.md`
- Машинный индекс: `docs/ai/index.yaml`
