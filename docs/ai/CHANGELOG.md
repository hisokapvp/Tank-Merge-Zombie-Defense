# Журнал изменений (A2DP)

## 2026-06-06
- **Runtime perf hot-path pass** (`game.js`, `src/systems/talents/talentsV2.js`, `src/mechanics/chipEffects.js`, `docs/ai/GAME_JS_MAP.md`)
  - `impactAt()` больше не делает `slice()` и per-victim object construction: grid-candidates копируются в scratch-буфер, точные жертвы собираются отдельным проходом, позиции зомби инлайнятся без `zombiePos()`-аллокаций, а `TalentsV2.onHit()` получает переиспользуемый ctx с уже вычисленным `mods`.
  - `TalentsV2.onHit()` лениво создаёт `extraHits` только при реальном ricochet-hit вместо пустого массива на каждый вызов.
  - `queryZombieIndicesInRadius()` получил optional `sortResults`; `stepDecals()` теперь берёт `pool` / `chipPool` кандидатов через collision grid и повторно использует её же seam для `ChipEffects.stepChipDecal()` и `ChipEffects.stepChipEffects()`.
  - `stepZombies()` кэширует `getZombieBalanceMul()` / `getZombieAttackConfig()` / `getZombieAnimConfig()` по типу на кадр; `ChipEffects` сужает `chain/push/pull/vacuum/calming/electro/decal` до nearby-candidates с сохранением exact-distance checks.
  - Verification: Node parse OK для `game.js`, `src/mechanics/chipEffects.js`, `src/systems/talents/talentsV2.js`; `node Test/tests.js` → 87 passed, 0 failed. `ci/check_style.sh` и `ci/run_tests.sh` падают на pre-existing issues вне scope этой задачи: trailing whitespace в `src/render/canvasRoot.js`, `T5-13`, `P8-1/P8-2`, `BOL-12`, `BCR-3`.

- **perf-capture tool — docs pass** (`docs/ai/PERF_CAPTURE_MAP.md` [new], `docs/ai/SYSTEMS/perf.md`, `docs/ai/PLAYBOOKS/debug-lag.md`, `docs/ai/INDEX.md`, `docs/ai/PROJECT_MAP.md`, `docs/ai/index.yaml`)
  - Создан `docs/ai/PERF_CAPTURE_MAP.md` — функциональная карта `src/perf/perfCapture.js` (`Game.PerfCapture`, 889 строк > порога 500): tunables (`RING_CAP=600`, `JANK_MS=50`), `PHASE_LOCATIONS`, hot-path `onFrame()` (L181–209), `_sampleMemory`/`_sampleEntities`, lifecycle `start/stop/reset`, `buildReport()` (schema `tmzd.perfCapture.report`, L606–698), overlay, `__test` seam.
  - `docs/ai/SYSTEMS/perf.md`: новая секция «Perf-capture tool + Profiler per-frame accumulator» — `Game.PerfCapture` (что собирает, report schema id, zero-overhead контракт), Profiler API `beginFrame`/`endFrame`/`getFrameMs`/`forEachFrameMs` (чистится в `reset()`, L186–187), gate-маркеры теперь через `Profiler.isEnabled()` (default `Game.DEBUG===true`, release zero-overhead) с точными строками `game.js`, расширение `perf.profilerBudgetsMs`.
  - `docs/ai/PLAYBOOKS/debug-lag.md`: end-to-end workflow (`?debug=1` → Perf tab → Start → repro → Stop → Copy AI report / Download JSON; Reset + DevTools-timeline чекбокс + live readout).
  - Реестры: `index.yaml` (PERF_CAPTURE_MAP в maps, `perfCapture.js`/`debugPanel.js` в perf.files, `updated_at`), `INDEX.md` (Главные карты + Performance system line + focus 2026-06-06), `PROJECT_MAP.md` (исправлены устаревшие строки entrypoints `loop()` 18538–18807 и `draw()` 15295–15443, добавлены `Game.PerfCapture` entrypoint + map-table row).
  - Документация only: runtime-код, тесты и config не изменялись.

## 2026-06-04
- **Achievements + critical restart counter — solo-pipeline-yandex-vk batch #1 (indices 1-2)** (`src/mechanics/achievementRewards.js`, `game.js`, `src/persistence/initialState.js`, `Test/tests.js`, `docs/ai/SYSTEMS/achievements.md`, `docs/ai/SYSTEMS/save.md`)
  - `drone_brigadier_1` снова выдаёт награду: root cause был в `AchievementRewards.grantByTable()`, который поддерживал `drones` только как composite sub-item и silently возвращал `false` для top-level `REWARD_TABLE` entry `droneBrigadierDrones2L2`. Fix: top-level `type='drones'` теперь grant'ится напрямую через `grantAchievementDrones(...)`, а `rewarded[id]` ставится в том же one-shot contract.
  - Счётчик `achievements.totalSimulationResets` больше не живёт в `openCriticalModal()`. После user review canonical owner закреплён на critical-entry seam: инкремент происходит сразу при входе в critical state и до `savePreRetryPayloadToAutoSlot()`, поэтому и restart, и save-exit, и последующий restore видят одно и то же значение без ordering gap.
  - Добавлена узкая runtime observability для reset seam: `incrementSimulationResetCounter(..., { logSource })` пишет dev-diagnostic в `Game.Diagnostics.reportSaveUnknownKeys(...)` при наличии diagnostics surface, иначе даёт fail-soft `console.debug`.
  - Добавлены регрессионные проверки в `Test/tests.js`: top-level drone reward grant и guard, что reset counter инкрементится на critical-entry до autosave, а не в modal-open / restart-click path.

## 2026-05-29
- **Fence overlay анимации + баланс урона/стоимости танков — solo-pipeline-yandex-vk batch #1 (items 1–4, round-6 rework)** (`assets/fence.json`, `game.js`, `assets/balance.json`, `assets/tanks.json`, `index.html`, `assets/fence_destruction_overlay_{50,25,10,0}_atlas.png`)
  - **Item 1 — анимация взрыва основания (`explosionOverlay`)**: исправлен баг, из-за которого спрайт-атлас взрыва не проигрывался вообще. Root cause: рассинхрон часов. Триггер детонации (`game.js` detonation seam) пишет `startMs` через `performance.now()` (~тысячи ms), а `drawFenceExplosionOverlays()` вычислял `elapsed` через `Date.now()` (epoch ~1.7e12) → `frameIdx = floor(elapsed/frameMs) >= frames.length` на первом же кадре → overlay-запись мгновенно отбрасывалась compaction-проходом и анимация никогда не рисовалась. Fix: draw-проход переведён на тот же источник времени `performance.now()` (clock parity). Пользователь подставил реальный 13-кадровый атлас (`fence_explosion_overlay_atlas.png`, grid 13×1, frameRate 5, scale 10).
  - **Item 2 — постепенное разрушение (`destructionOverlay`), redesign**: одиночный статический атлас + `thresholds` заменён на массив `stages[]` из 4 отдельных АНИМИРОВАННЫХ атласов (по одному на состояние 50/25/10/0). Каждый stage проигрывается в цикле, пока доля HP сегмента `seg.hp/seg.maxHp` в диапазоне `(minRatio, maxRatio]`: band «50» = (0.25, 0.5], «25» = (0.10, 0.25], «10» = (0.0, 0.10], «0» = ratio ≤ 0 (minRatio −1). При ratio > 0.5 overlay не показывается. Каждый stage: `{band, maxRatio, minRatio, atlas, grid{cols,rows}, frames[], frameRate=12, scale=2.4, anchor}`. Новый game.js loader `makeFenceStageOverlaySprites(configKey)` (по `<img>` на stage + кэш авто-нарезанных по grid кадров, грузятся на boot), `drawFenceDestructionOverlays()` переписан: per-segment выбор stage по band, цикличная анимация `frameIdx = floor(now/frameMs) % frames.length` через `performance.now()`, draw поверх спрайта фрагмента (center-translate + `seg.x/seg.y`, hot-path без аллокаций). 4 placeholder-атласа `fence_destruction_overlay_{50,25,10,0}_atlas.png` (копии шаблона; заменяются дымовыми пользователем).
  - **Item 3 — завышенный урон танков L2/L3**: `assets/balance.json` `tank.attackDamageMul` 2.5 → 1 (раньше множитель маскировал все уровни кроме `level_1`-override). `level_1` override остаётся 1.
  - **Item 4 — пересчёт стоимости улучшений пушки**: для всех 60 уровней `assets/tanks.json` `upgradeDamagePointsCosts.{baseDamage,attackSpeed}` = `floor((shotDamage × attackSpeed×60/10000) × 15/10) × 10`. Контрольные значения: L1 = 230 (совпадает с примером пользователя), L60 = 2230.
  - **Plan-divergence (diagnostics)**: continuity Detailed Plan Step 8 ошибочно указывал `cannonUpgrades.json`; фактический контракт стоимостей — `tanks.json upgradeDamagePointsCosts`.
  - **Verification**: `node Test/tests.js` → 85/85 passed; `node -c game.js` чистый; `get_errors` game.js без ошибок; `fence.json`/`tanks.json`/`balance.json` парсятся; `check_talent_helpers.cjs` OK (17 wired, 3 TODO); 4 stage-атласа на месте; `index.html` cache-token bump v6 → v7. Browser-смоук overlay-анимаций — skip-visible: реальных анимированных дымовых/взрывных ассетов в runtime нет (пользователь подставит сам), корректность подтверждена логикой clock-parity, stage-selection и loop-frame indexing + проверкой config/asset wiring.
  - **Rating-gate rework (round-8) — экранная тряска не работала вообще** (`index.html`, `src/render/screenEffects.js`, `assets/fence.json`): root cause — модуль `src/render/screenEffects.js` существовал и был закоммичен, но **никогда не подключался** `<script>`-тегом в `index.html`. Поэтому `window.Game.ScreenEffects` был `undefined`, и все вызовы тряски в `game.js` (все guarded `if (window.Game.ScreenEffects && typeof ...)`) молча no-op → тряска отсутствовала полностью: на повреждении фрагментов стен, суперкомпьютера и на взрыве «Взрывное основание». Fix: добавлен `<script src="src/render/screenEffects.js?v=...">` перед `game.js` (рядом с `canvasRoot.js`/`hudScratch.js`). Дополнительно тряска приведена к точной спецификации пользователя: фрагменты стен трясут **только** при пересечении порогов HP 50/25/10/0% (убрана базовая тряска на каждый удар), чем ниже порог — тем сильнее (amp 4/6/8/11 px); суперкомпьютер трясёт на **каждые** 5% потери HP с **постоянной** силой (убран lerp, 7 px / 0.28 с); взрыв «Взрывное основание» — самая сильная тряска в игре (`explosionShake` 12 → 16 px, 0.45 с). `index.html` token bump до `...shake-spec-v2`. Verification: `node -c src/render/screenEffects.js` чистый, `fence.json` парсится, `node Test/tests.js` → 85/85 passed.

- **Balance Editor DPM sync с текущими source files — solo-pipeline-yandex-vk batch #1** (`tools/balance-editor.html`, `tools/balance-shared.js`, `docs/ai/SYSTEMS/balance-editor.md`, `docs/ai/INDEX.md`)
  - Вкладка `Очки урона / мин` больше не использует отдельный manual runtime fallback и не тянет full Balance Lab scenario multipliers для `Shot Damage`/`Выстр./мин`.
  - Новый shared helper `getTankDamagePointMetrics()` читает только `assets/tanks.json` и `assets/bullet.json`, строит provenance для UI и отдаёт явные diagnostics, если какого-то level/field не хватает.
  - Browser shell показывает provenance/diagnostic рядом с таблицей, version-bust для `balance-shared.js` обновлён, а формула info-box приведена к финальному tab-contract: `shotDamage = baseDamage + bullet.addDamage`, `shotsPerMinute = attackSpeed × 60`, `damagePointsPerMinute = rawDamagePerMinute / 10000`.
  - User-directed rework после review исправил две ошибочные промежуточные попытки: сначала в tab случайно попали cannon/talent/manual-scenario multipliers из `getTankStats()`, затем ещё оставались `balance.json` multipliers. Финальный tab-contract жёстко остался source-driven и one-way only: из текущих файлов в editor, не наоборот.
  - Таблица вкладки теперь центрирует заголовки и значения, чтобы сверка L1-L60 шла по ровной сетке без дополнительного visual drift.
  - Контрольные уровни после финального rework: L1 `2600 / 60 / 15.6`, L2 `2650 / 60 / 15.9`, L3 `2700 / 60 / 16.2`.
  - Verification: `node Test/tests.js` → 85/85 passed; Node smoke для `getTankDamagePointMetrics()` дал `rows=60`, `diagnostics=0`; `get_errors` для `tools/balance-editor.html` и `tools/balance-shared.js` чистый; browser smoke не выполнен, потому что в текущем runtime не было доступного browser-tool route.

## 2026-05-26
- **Экономика талантов и переименование (`solo-pipeline-yandex-vk` batch1+batch2, consolidated docs-update)** (`game.js`, `src/persistence/offlineProgress.js`, `src/i18n/ru.json`, `src/i18n/en.json`, `assets/balance/talentTree_v2.json`, `src/systems/talents/talentsV2.js`)
  - **Batch 2 / item 4 — награда за убийство зомби (`coinsForKill`)**: формула изменена с `BAL.coinsPerKillBase + BAL.coinsPerKillLevelMul*(level-1)` на `max(1, floor(coinsPerShot(level)*0.10))`. База берётся из `ProgressionApi.coinsPerShot(level, BAL, LevelRewardConfig)` (то же, что в `coinsForShot`, без `coinsShotMul` и `economyActiveMul`). Min-$1 clamp применён к базе **до** talent-множителей (`coinsKillMul` = Bounty Hunter +6%/rank, Kill Streak +30%) и `activeMul`/`incomeMult`. Детерминированные примеры: L1 → coinsPerShot=1 → floor(0.1)=0 → clamp 1$; L6 → coinsPerShot=32 → floor(3.2)=3$; L11 → coinsPerShot=1024 → floor(102.4)=102$. Округление всегда вниз (`Math.floor`). Call site (`game.js` L9362 `TalentsV2.onKill`) сохранён без изменений — talent-стэк работает поверх новой базы.
  - **Batch 2 / item 4 (offline parity) — `src/persistence/offlineProgress.js#coinsPerKill`**: переведено на ту же формулу `max(1, floor(coinsPerShot(level)*0.10))`. Использует `Economy.coinsForShot` (или fallback `fallbackCoinsForShot`) → `killCoinsMul=0.5` сохранён как множитель партии-на-трассе. `DEFAULTS.COINS_PER_KILL_BASE` / `COINS_PER_KILL_LEVEL_MUL` остаются как legacy-fallback константы (не удалены ради save-compat, но не используются runtime).
  - **Batch 2 / item 5 — talent rebrand `eco_coins_shot_bonus`**: runtime id и effect (`stat_mul coinsShotMul perRank=0.06`) не тронуты. RU: `«Доход за выстрел»` → `«Обратная экономика»`; новый `desc` с `{current}%` placeholder. EN: `«Shot Income»` → `«Reverse Economy»`. UI таланта показывает текущий % через стандартный i18n-механизм.
  - **Batch 2 / item 6 — talent rebrand `eco_xp_bonus`**: runtime id и effect (`stat_mul xpMul perRank=0.06`) не тронуты. RU: `«Опыт»` → `«Быстрая адаптация»`; новый `desc` про XP за убитого зомби с `{current}%` placeholder. EN: `«XP Yield»` → `«Fast Adaptation»`. **Замечание A4-1**: исходный TZ пользователя содержал copy-paste typo `«Текущее увеличение награды за выстрел»` внутри XP-таланта; в реализованной строке корректно используется `«Текущее увеличение опыта за убитого зомби»`, что соответствует семантике `xpMul`. Явно подтверждено пользователем на pre-FailDetector review.
  - **Migration mapping (`MIGRATE_V1_TO_V2` в `src/systems/talents/talentsV2.js` L140-155)**: НЕ тронуто. Legacy v1 имена (`Бонус за выстрел`, `Копилка опыта`, `Инвестор`, `Стимул обучения`, `Ускоренное обучение`, `Золотая лихорадка`) продолжают мапиться на `eco_coins_shot_bonus` / `eco_xp_bonus` корректно — рантайм ids стабильны, save-compat сохранён.
  - **Batch 1 (items 1–3, deferred docs-update consolidated here)**: discount talent rework + `eco_coins_kill_bonus` rebrand в «Охотник за головами» + `killBounty` ICD механика (`killBountyDurationMs=5000`, `killBountyCoinsMul=1.3`, `killBountyIcdMs=5000` с `fromRank=3`). Изменённые файлы: `src/i18n/ru.json`, `src/i18n/en.json`, `assets/balance/talentTree_v2.json`, `src/systems/talents/talentsV2.js`, `game.js`. Подробные diff-ы хранятся в continuity file `chat_tmzd_talents_batch.md` (Batch 1 section, merged 2026-05-26).
  - **Batch 2 / item 4 (post-rating followup fix) — min-$1 clamp survives `BAL.zombieKillCoinsMul=0.5`**: пользователь на rating gate сообщил, что за L1-зомби даётся $0 вместо $1. Root cause: call site `game.js` L9366 применял `Math.floor(coinsForKill(...) * BAL.zombieKillCoinsMul)` → для L1 floor(1*0.5)=0, что схлопывало min-$1 floor из `coinsForKill`. Fix: обёрнут `Math.max(1, Math.floor(coinsForKill(...) * BAL.zombieKillCoinsMul))` в `game.js` L9366. Parity-фикс в `src/persistence/offlineProgress.js#coinsPerKill`: `return Math.max(1, Math.floor(base * killCoinsMul))`. Тесты 85/85 green после фикса; ZBH-4 regex (`Math.floor(... * BAL.zombieKillCoinsMul)`) сохранён как substring внутри `Math.max(1, ...)`. `index.html` cache-bust v8→v9 (UTF-8 safe Python bump, 135 matches).
  - **Verification**: `node Test/tests.js` → 85/85 passed (включая post-rating followup fix). MIGRATE_V1_TO_V2 не модифицирован; runtime talent ids/effects не модифицированы; UI placeholder `{current}%` зарезолвится existing talents UI-кодом.

## 2026-05-24
- **TMZD fence defense-talent rebrand+rework — solo-pipeline-yandex-vk#1 items 1–3 (fence-upgrades-rework, docs-only close-out)** (`docs/talents_v2.md`, `docs/ai/ASSETS/fence.md`, `docs/ai/SYSTEMS/talents_audit.md`)
  - **Item 1 — `def_explosive_base` («Взрывное основание»)**: rebrand `def_repair_discount_timer` → `def_explosive_base`. Новая AoE-механика: радиус 300px, урон 100 000 dmg/rank, helper `applyExplosiveBaseDetonation` в `src/systems/talents/talentsV2.js` L3347+, call sites в `game.js` L3347 / L4484 / L8902-8938 (fragment-destroyed seams). Numeric params: `explosiveBaseDamagePerRank=100000`, `explosiveBaseRadiusPx=300`, `explosiveBaseDamageCapPerFrame=600000`. Polar→cartesian итерация по `state.zombies`. `explosionShake` field под `screenShake` (merge-with-threshold semantics). SFX placeholder pair `fence_explosion.{ogg,mp3}` (0-byte stubs, art-pass pending). Legacy `repairDiscountTimerCostMul` / runtime поля `repairDiscountReady`, `nextRepairDiscountAtMs` сохранены ради save-compat (sub-Orchestrator решил оставить).
  - **Item 2 — `def_immunity_proc` («Случайная неразрушимость»)**: новый display name + `procShields` render overlay. Chance `1%/rank`, duration `2s`, ICD `15s`. Helper wired в `onWallDamage` (`game.js` L3083-3096); per-segment `immunityUntilMs` пишется в L2411 / L2434. Новый root-block `procShields` в `assets/fence.json` (atlas=`proc_shields.png` placeholder = копия `shields.png`, `visibleWhile=\"immunityActive\"`), параллельный `shields` блоку. Render seam в `game.js`: новый `ProcShieldSprites` loader + `drawFenceProcShields()` проход в boot, рисуется только пока `segRt.immunityUntilMs > nowMs`.
  - **Item 3 — `def_dome` («Купол»)**: rebrand `def_active_dome` → `def_dome`. Params: `durationMs=10000`, `rechargeMs=90000`, `damageTakenMul=0.15`, `autoRepairPctPerSec=0.03`, `charges=2`. i18n + tooltip синхронизированы. Render через существующий `shields` overlay.
  - **Docs-only sweep (этот entry)**: 4 файла обновлены — `docs/talents_v2.md` (rename taxonomy, добавлены explosiveBase params, документирован legacy retention), `docs/ai/ASSETS/fence.md` (новые секции `procShields` + `explosionShake`), `docs/ai/SYSTEMS/talents_audit.md` (3 таланта помечены WIRED_OK, finding count `BROKEN_HELPER_NOT_CALLED` снижен 4 → 3, добавлен coord-space contract для AoE-хелперов как lesson learned из round 5 fix), `docs/ai/CHANGELOG.md` (этот entry). User accepted implementation в predшествующем round; Meta-Orchestrator explicit override: skip FailDetector, ratings, session-logger (`META_LOG_SKIPPED_BY_USER`).
- **«Взрывное основание» (`def_explosive_base`) — visible AoE feedback (pass 3 round 4, solo-pipeline-yandex-vk#1 item 1)** (`game.js`)
  - **Симптом**: после round 3 fix (coord-space) пользователь всё ещё сообщает «урон не наносится по области». Тесты 85/85 green, helper вызывается с правильными world-coord origin, но игрок не видит, что AoE срабатывает.
  - **Root cause продолжение**: в AoE-applyDamage callback не вызывался `addDamageNumber`, поэтому даже когда зомби получает 100k–600k урона, на экране не появляется floating combat text. У зомби поздних волн HP может быть в миллионах → 1 хит снимает «незаметную» долю HP, AoE визуально выглядит как «ничего не произошло».
  - **Fix**: в `game.js` L8970+ AoE applyDamage callback теперь вызывает `addDamageNumber(z.x, z.y - 16, dealt, false, 'explosion')` для каждого hit (паттерн идентичен thorns/Колючая проволока). Видимый combat text даёт игроку прямое подтверждение, что детонация прошла и сколько зомби в радиусе её получили.
  - **Тесты**: `node Test/tests.js` → 85/85 passed.
- **«Взрывное основание» (`def_explosive_base`) — fix AoE coord-space mismatch (pass 3 round 3, solo-pipeline-yandex-vk#1 item 1)** (`src/systems/talents/talentsV2.js`, `game.js`)
  - **Симптом**: после Pass 1 (rebrand + helper) и Pass 2 (валидатор + проводка) урон от взрыва либо не наносился вовсе, либо доставался единственному зомби в точке пробоя. Сценарий пользователя: «урон должен наноситься по области и должен наноситься всем зомби в области, а не какому-то одному зомби».
  - **Root cause**: `seg.x`/`seg.y` фрагмента забора хранятся в **центр-относительных** координатах (`src/render/fenceLayout.js` L190: углы в `±halfSide`, рендер через `ctx.translate(center.x, center.y)` затем `ctx.translate(seg.x, seg.y)` — `game.js` `renderFenceBase` L15775+). Зомби (`z.x`, `z.y`) живут в **абсолютных** мировых координатах. Helper `applyExplosiveBaseDetonation` в `talentsV2.js` сравнивал `(zx - seg.x)² + (zy - seg.y)²` с `radius²=300²` напрямую → почти все зомби попадали «вне радиуса», в отдельных случаях кейс ловил только одного зомби, физически стоящего у пробитого фрагмента.
  - **Fix #1 — call site (`game.js` L8969 detonation block)**: перед вызовом `tv2.applyExplosiveBaseDetonation(...)` вычисляются `segWorldX = center.x + seg.x` и `segWorldY = center.y + seg.y` (с защитой `Number.isFinite`), и в payload добавлены поля `originX`/`originY` в мировых координатах.
  - **Fix #2 — helper (`src/systems/talents/talentsV2.js` L3360+)**: helper теперь предпочитает явные `ctx.originX`/`ctx.originY` (если переданы) и откатывается на `seg.x`/`seg.y` как раньше, сохраняя backward-compat. Радиус (`explosiveBaseRadiusPx=300`), per-rank damage (`explosiveBaseDamagePerRank=100000`) и per-frame cap (`explosiveBaseDamageCapPerFrame=600000`) не менялись — bug был чисто координатный.
  - **Diagnostic gate**: добавлен optional `window.__debugExplosiveBase = true` log (`{ rank, perRank, radius, cap, damagePerHit, hits, totalDealt, zombieCount, originX, originY, originOverride }`) — выключен по умолчанию, не входит в hot-path расходов.
  - **Тесты**: `node Test/tests.js` → 85/85 passed; `node --check` для обоих файлов чист.

## 2026-05-20
- **Multishot triple-shot fix + полный аудит талантов V2 — solo-pipeline-yandex-vk batch (TZ items 1–2)** (`game.js`, `assets/balance/talentTree_v2.json`, `src/i18n/{ru,en}.json`, `tools/balance-shared.js`, `docs/talents_v2.md`, `docs/ai/SYSTEMS/talents_audit.md`)
  - **Item 1 — Мультивыстрел (off_multishot)**: исправлен пропущенный `tripleShotChance` от ранга 4. Раньше адаптер `adaptTalentsV2ModsToLegacy` (game.js) пробрасывал только `doubleShotChance`, а в `fireTankProjectile` срабатывала единственная проверка на `mods.doubleShotChance`. Теперь:
    - Адаптер инициализирует `out.tripleShotChance = 0`, явно клампит `tripleShotChance` в `[0, 0.5]` и в конце добавляет generic numeric-passthrough loop по всем `param`-effects (закрывает silent-drop для будущих числовых ключей `*Chance`/`*Pct`/`*Mul`/`*Ms`).
    - V2-not-ready ветка `getMods()` теперь также возвращает `tripleShotChance: 0` (раньше пропадал ключ → undefined в шут-пайплайне).
    - В шут-пайплайне внедрена **взаимоисключающая лестница**: roll `triple` → если miss, roll `double` → fire соответствующее количество дополнительных `spawnBurst()`-ов. Тир запоминается в `_multishotTier ∈ {1,2,3}`.
    - VFX блок `burst()` (только когда `!isTankAttackingZombie`) масштабируется по тиру через `_multishotScale` (1 / 1.4 / 1.8) и красится в `burstColor` (белый → `rgba(255,225,140,*)` → `rgba(255,170,80,*)`). Используется тот же burst-pool с clamp по `MAX_BURST_PARTICLES`.
    - **User-directed rework 2026-05-20**: добавлен inter-shot delay для отложенных залпов multishot (паттерн `setTimeout` тот же, что у chip `comboShots`). Задержки `[80, 160] ms`. Для каждого отложенного `spawnBurst()` дополнительно рисуется burst-VFX (тот же tier-coloured RGBA) и проигрывается тот же shoot-клип — теперь игрок видит и слышит «танк стреляет 2/3 раза подряд», а не один залп-«ёжик». setTimeout-closure создаётся только когда multishot реально срабатывает.
    - `assets/balance/talentTree_v2.json`: добавлен `ui.currentVars: { currentDouble: "doubleShotChance", currentTriple: "tripleShotChance" }` к `off_multishot`. Tooltip-renderer (`TalentsScene._resolveDescTemplate`) уже поддерживал multi-placeholder через `currentVars` — правки не потребовалось.
    - i18n: `talent_off_multishot_desc` переписан в `ru.json` L613 и `en.json` L612 с использованием `{currentDouble}`/`{currentTriple}` и упоминанием rank 4 unlock + пометкой «залпы взаимоисключающие» / «tiers are mutually exclusive».
    - `tools/balance-shared.js` L516: формула `avgProjectiles` обновлена с independent-стека `1 + double + triple*2` на exclusive-ladder `1 + double*(1 - triple) + triple*2` (комментарий ссылается на batch и game.js shoot path).
  - **Item 2 — Аудит остальных талантов** (`docs/ai/SYSTEMS/talents_audit.md`, NEW): эвристический скрипт прошёл по всем 51 таланту V2, сопоставил `effects[].key` с adapter-exposure и runtime-consumer (helper-call или `mods.X`-direct).
    - **OK_DIRECT_MOD = 17**, **OK_HELPER = 4**, **BROKEN_HELPER_NOT_CALLED = 4**, **BROKEN_OR_UNCERTAIN = 26**.
    - **High-confidence findings (тот же паттерн что у multishot)**: `off_acid_dot`, `off_convert_to_dot` (`getDotState` определён, не вызывается), `def_resists` (`getModNumber` для resist-% не вызывается на damage-receive), `def_repair_discount_timer` (`applyRepairDiscountCoupon` определён, не вызывается).
    - **Не self-fix в этом батче** по контракту Orchestrator (`>3 broken → findings, не self-fix`): эти 4 + 26 uncertain переданы parent Meta-Orchestrator-у findings-блоком для решения о follow-up batch. Полная таблица + рекомендации — в `docs/ai/SYSTEMS/talents_audit.md`.
    - Ограничение метода: эвристика не понимает событийную диспетчеризацию через `onShotFired`/`onHit`/`tickStatuses`, поэтому часть `BROKEN_OR_UNCERTAIN` может оказаться рабочей при ручной проверке.

## 2026-05-19
- **Talent V2 offense top-row rework — solo-pipeline-yandex-vk batch (TZ items 1–5)** (`assets/balance/talentTree_v2.json`, `src/systems/talents/talentsV2.js`, `game.js`, `src/i18n/{ru,en}.json`, `docs/talents_v2.md`)
  - **Разгон (item 1)**: новое описание + `{current}%` через `ui.currentMul: 5` (отображает теоретический максимум = rank × stackMax × perRank). Механика (perRank=0.02, stackMax=5) не меняется.
  - **Открытые раны (item 2, rename `Конверсия в DoT` → `Открытые раны`)**: новое имя и описание + `{current}%` через стандартный per-rank-percent path. `convertToDotPct` (perRank=0.04, max=0.2) и runtime не меняются.
  - **Импульсный снаряд (item 3, rename `Импульсный AoE` → `Импульсный снаряд`)**: новое имя + описание с `{currentShots}` (через `ui.currentVars: { currentShots: { key: pulseAoeEveryN, kind: shotCount } }` → `max(min, base + perRank*rank)`). **Runtime fix**: добавлен alias `pulseRadiusMul` в `BASE_MODS_TEMPLATE` + новая api `getPulseShotMultiplier({tank})` в `talentsV2.js`, которая возвращает `pulseAoeMul` только если текущий выстрел — N-й (`shots % pulseEveryN === 0`). В `game.js` `fireTankProjectile` после `onShotFired` вычисляется `pulseAoeMulNow`, `effectiveAoe = chipAoe * pulseAoeMulNow` и пробрасывается во все `spawnProjectile` ветки внутри `spawnBurst`. Теперь радиус действительно увеличивается на pulse-выстреле, а не только урон (PA-3 fix).
  - **Рикошет (item 4)**: новое описание + `{currentChance}%` через `ui.currentVars: { currentChance: ricochetChance }` (с `effect.max=0.30` clamp). `ricochetRadius` 220 → 500 и `ricochetChance.max` 0.25 → 0.30 (также в `caps.ricochetChance`). `perRank=0.06`, `ricochetDamageMul=0.7` и логика bounces (`base=1, fromRank=4, value=2`) не меняются.
  - **Шквал (item 5, rename `Активка: Шквал` → `Шквал`)**: новое описание. `offenseActiveDurationMs` 6000 → 10000 (`talentTree_v2.json` + `docs/talents_v2.md`). **Runtime fix (user-directed rework)**: ранее активка применяла только damage множитель (talentsV2.js L2835); fireRate / orbit / aoe были определены в `BASE_MODS_TEMPLATE`, но нигде не читались. Добавлена api `getBarrageMul({tank, timeMs})` в `talentsV2.js`, возвращающая `{damage, fireRate, orbit, aoe, active}` (все по умолчанию 1) на основе `rt.buffs.offenseActive.untilMs` и `runRt.actives.offense.untilMs`. `game.js` `fireTankProjectile` теперь применяет `barrageMul.fireRate` к `tank.cooldown` (пуля летит быстрее) и `barrageMul.aoe` к `effectiveAoe`; `stepTanks`, `tankOrbitState` и хангарный drag-release умножают `angularSpeed` на `barrageMul.orbit`. Legacy id и mapping (`legacyToId` «Активка: Шквал» / «Активка: Перегрев») сохранены.
  - **Tooltip renderer (game.js `getNodeDescription` L12480-12590)**: расширен поддержкой `ui.currentMul` (умножает default `{current}`), `effect.max` clamp при percent-форме, и нового `currentVars` object-form `{key, kind: "shotCount" | "percent"}` с per-effect `max` clamp.
  - **i18n contract**: все 5 переименований/описаний обновлены параллельно в `ru.json` и `en.json` (строки `talent_off_ramp_up_*`, `talent_off_pulse_aoe_*`, `talent_off_convert_to_dot_*`, `talent_off_ricochet_*`, `talent_off_active_barrage_*`). Runtime `id` всех 5 талантов остался стабильным.

## 2026-05-18
- **Zombie scaling + talent upgrade descriptions — solo-pipeline-yandex-vk batch #1 (TZ items 1–4)** (`game.js`, `assets/balance.json`, `src/i18n/ru.json`, `src/i18n/en.json`, `docs/talents_v2.md`, `docs/migration_talents_v1_to_v2.md`)
  - **Zombie level scaling (TZ item 1)**: новая функция `getZombieLevelMultiplier(level)` (game.js, перед `zombieHpMultiplier`). Precomputed `Float64Array(61)`, O(1) lookup, без аллокаций на hot-path. Piecewise breakpoints: lvl 1–10 → 1.0 (без изменений), 11–20 (+5% per lvl), 21–30 (+10%), 31–40 (+15%), 41–50 (+20%), 51–60 (+30%). Верификация: lvl 20 = +50%, lvl 30 = +150%, lvl 40 = +300%, lvl 50 = +500%, lvl 60 = +800%. Применяется multiplicatively и к HP (`zombieHpMultiplier`), и к финальному `getZombieFinalAttackDamage`. Levels > 60 clamp на lvl 60. **Save migration**: in-flight зомби в существующих сейвах НЕ пересчитываются (минимальный disruption); новые спавны после загрузки применяют новую формулу. Документация контракта добавлена в `assets/balance.json → zombieLevelScaling._readme` + `breakpoints` / `verifiedMultipliers` block.
  - **Upgrade descriptions canonical template (TZ item 2)**: 8 описаний переписаны по канону Калибра с подстановкой `{current}` через существующий renderer `getTalentNodeDescriptionV2` (game.js L12475). Затронуты RU+EN параллельно: `talent_off_fire_rate_desc`, `talent_off_range_desc`, `talent_def_wall_hp_desc`, `talent_def_armor_flat_desc` (refined), `talent_def_repair_cost_desc` (Логистика ремонта), `talent_eco_buy_discount_desc` (Скидка на покупку), `talent_eco_upgrade_discount_desc` (Скидка на апгрейды), `talent_eco_repair_discount_desc` (Скидка на ремонт). Контракт описания: «Постоянно [меняет] [параметр] на X% за ранг. Текущая прибавка [параметра] - {current}%». Renderer вычисляет `{current}` из `node.effects[*].perRank * effectiveRank` либо парсит per-rank из шаблона описания (regex fallback). При rank=0 → `{current}=0` (корректно, отражает «не вложено»).
  - **Rename «Разгон орбиты» → «Реактивное топливо» (TZ item 3)**: `talent_off_orbit_speed_name/_desc` обновлены в `src/i18n/ru.json` + `src/i18n/en.json` (RU: «Реактивное топливо», EN: «Reactive Fuel»). Runtime `id` остался `off_orbit_speed` (stable). Новое описание: «Постоянно увеличивает скорость танков на 6% за ранг. Текущая прибавка скорости - {current}%». MIGRATE_V1_TO_V2 source key «Разгон орбиты» в `talentsV2.js` оставлен без изменений (исторический mapping для legacy save).
  - **«Широкий взрыв» description (TZ item 4)**: `talent_off_aoe_desc` обновлено: «Постоянно увеличивает радиус взрывов на 6% за ранг. Текущая прибавка радиуса - {current}%. Бонус толпы от 6 целей: +6% к AoE-урону за ранг.» Crowd bonus second sentence сохранён (механика не меняется, TZ требует только переделать описание главного эффекта).
  - **i18n parallel contract**: все 11 ключей (10 desc + 1 name rename) изменены одновременно в `ru.json` и `en.json`. `fallbackStrings.js` не содержал `talent_*_desc` ключей — обновления не требовалось.
  - **Docs sync**: `docs/talents_v2.md` дополнен разделом о display rename и canonical {current}-template; `docs/migration_talents_v1_to_v2.md` помечен note about V2 display rename без затирания V1 mapping key. AUDIT: HP/damage piecewise scaling — единый source of truth в game.js, дублирования формулы по if-веткам нет.

## 2026-05-16
- **Achievements: solo-pipeline-yandex-vk batch #1 (zombie_slayer family) — 5 tiers суммарных убийств зомби (`src/mechanics/achievements.js`, `src/mechanics/achievementRewards.js`, `src/persistence/initialState.js`, `game.js`, `src/i18n/{ru,en}.json`, `src/i18n/fallbackStrings.js`, `docs/ai/SYSTEMS/achievements.md`)**
  - Добавлены достижения: `zombie_slayer_1..5` (1 000 / 100 000 / 1 000 000 / 100 000 000 / 1 000 000 000 убитых зомби) с rewards: 25 пыли / 5 случайных чипов / composite(2 UP + 100 000 damage) / composite(10 chips + 2 drones L6) / composite(10 UP + 1 500 000 damage).
  - Новый canonical counter `state.stats.zombieKillsTotal` (lifetime, монотонный, clamp до `MAX_SAFE_INTEGER`) + source breakdown `state.stats.zombieKillsBySource{tank,drone,talent,wall}`; legacy mirror `achievements.totalZombieKills` нормализуется через `ensureStats()` с `Math.max` guard.
  - Recorder `Game.Achievements.recordZombieKilled(state, delta, source)` — единый batch-API. Canonical seam: **batch O(1)** call из `flushZombieDeathFx()` в `game.js` после агрегации K зомби за кадр (per-kill seam запрещён — сломает batch contract).
  - `getProgressValueFromState('zombieKillsTotal', …)` поддерживает stats canonical + legacy fallback.
  - Persistence: `getSerializedAchievementStats` + `applySavedAchievementStats` сохраняют `zombieKillsTotal` и `zombieKillsBySource`; счётчик переживает partial reset.
  - `REWARD_TABLE` пополнен 5 новыми reward-modes; три composite-записи (`zombieSlayer3/4/5`) включены в `ATOMIC_REWARD_MODES` для rollback-safe выдачи.
  - i18n: ru/en/fallback синхронизированы для всех 15 ключей (title × 5 + desc × 5 + reward × 5); единицы крупных чисел рендерятся в RU через i18n keys (`млн` / `млрд`), кастомный formatter не вводился.

## 2026-05-15
- **Achievements: solo-pipeline-yandex-vk batch #2 — новая семья `daily_attendance` (постоянный вход в игру, 4 тира: 2/7/14/30 дней) (`src/mechanics/achievements.js`, `src/mechanics/achievementRewards.js`, `src/persistence/initialState.js`, `src/i18n/{ru,en}.json`, `src/i18n/fallbackStrings.js`, `game.js`). UTC-идемпотентный recorder `recordDailyLoginTick` (post-boot seam в `game.js` после `rebuildGroundLayer()`, до `initEngineAdapterPhase1()`); счётчик `state.stats.totalLoginDays` ↔ legacy `ach.totalLoginDays` (ensureStats parallel pair, без объединения); `ach.lastLoginDate` (ISO yyyy-mm-dd UTC) — single source of truth идемпотентности. Композитные награды tier 3 (10 randomChips + 500 000 damagePoints) и tier 4 (3 upgradePoints + 3 drones lv.9) попадают в `ATOMIC_REWARD_MODES` для rollback parity с `box_hunter`/`repair_crew`. AUDIT: канонический `REWARD_TABLE` суммарно содержит 142 upgradePoints — план рассчитывал на 133 (127 baseline + 3 bonus_hunter_3 + 3 daily_attendance_4), цифра 127 в плане оказалась устаревшей, фактический baseline (без bonus_hunter_3 и daily_attendance_4) = 136 UP.**
- **Achievements: solo-pipeline-yandex-vk batch #1 — новая семья `box_hunter` (открытие боксов военной помощи) (`src/mechanics/achievements.js`, `src/mechanics/achievementRewards.js`, `src/persistence/initialState.js`, `assets/saveSchema.json`, `src/i18n/{ru,en}.json`, `src/i18n/fallbackStrings.js`, `game.js`)**
  - Добавлены достижения: `bonus_hunter_1/2/3` (10/100/500 открытых боксов военной помощи) с rewards 5 фрагментов / 5 чипов + 50 пыли / 3 очка улучшения + 3 дрона ур.3.
  - Новый прогресс-счётчик `stats.bonusBoxesOpenedCount` (canonical path; no legacy ach.totalBonusBoxesOpened mirror — fresh-start, без retroactive grants).
  - Recorder `recordBonusBoxOpened()` инкрементит счётчик из game.js `claimCrateReward` после `grantCrateTank()` через канонический pipeline `record -> reconcileAchievementRewards -> queueAchievementPopup`.
  - `REWARD_TABLE` пополнен 3 новыми reward-modes; `ATOMIC_REWARD_MODES` whitelist расширен композитами (`bonusHunter2RandomChips5Dust50`, `bonusHunter3UpgradePoints3DronesL3x3`) для rollback-safe grants.
  - i18n: ru/en/fallback синхронизированы для title/desc/reward ключей.
  - Critical contract reminder: каждое новое family-описание должно использовать ключ `definitions: [...]`, не `achievements: [...]` (`flattenAchievementFamilies` читает строго `family.definitions`; иначе семья silent-skip из ACHIEVEMENTS и не появляется ни в модалке, ни в debug panel).

## 2026-05-03
- **Achievements: solo-pipeline-yandex-vk batch #1 (indices 1..5) — новые семьи `drone_brigadier` + `optimizer`, idempotent reward claiming (`src/mechanics/achievements.js`, `src/mechanics/achievementRewards.js`, `game.js`, `src/i18n/{ru,en}.json`, `src/i18n/fallbackStrings.js`, `docs/ai/SYSTEMS/achievements.md`)**
  - Добавлены достижения: `drone_brigadier_1/2` (максимальный уровень дрона 5/10) и `optimizer_1/2/3` (все 15 ячеек ангара имеют минимум 1/2/3 установленных чипа).
  - Прогресс считается по runtime state, без новых инкрементальных трекеров: `droneMaxLevel` берётся из main+underground drones, `hangarCellChipTier` — из минимального числа чипов среди первых 15 ячеек `state.hangarCells`.
  - Выдача наград остаётся идемпотентной через `achievements.rewarded`, новые reward-modes добавлены в `REWARD_TABLE` и включены в `ATOMIC_REWARD_MODES` для rollback-safe composite grants.
  - i18n синхронизация выполнена в `ru/en/fallback` для title/desc/reward ключей новых достижений.

## 2026-05-02
- **Документация: one-shot shared post-merge update после join для локализованного underground hangar drone preview scaling (`src/ui/undergroundHangarUI.js`)**
  - Обновлён `docs/ai/SYSTEMS/ui.md`.
  - Зафиксированы: `drawDroneSpriteCanvas()` в `src/ui/undergroundHangarUI.js` применяет `undergroundPreviewScaleBoost` только в preview render seam (rail/storage canvases), компенсируя shared atlas-scale локально и не изменяя глобальный `DronSprites.config.scale` для остального runtime.
  - Зафиксированы: изменение не затрагивает layout-контракт rail cells; размеры ячеек остаются owner'ом CSS-переменных `--ugh-cell-size` и `--ugh-drone-cell-size`, а увеличенный preview рендерится внутри текущих cell bounds без resize rail-сетки.

## 2026-04-28
- **Hot-path perf-deep: solo-pipeline-yandex-vk batch #4 item bonus-1 — off-screen culling, spatial hash для AOE collision, DOM HUD diff (`game.js`, `docs/ai/SYSTEMS/perf.md`)**
  - Цель: продолжение bonus-1 после rework cycle 3 — user feedback «немного, но всё ещё лагает». Применены top-3 highest-impact оптимизации поверх предыдущих 7 zero-alloc правок. Сохранено поведение 1:1, gameplay/balance numerics не тронуты. Тесты: 83/85 (T4-8/T4-12 baseline preserved).
  - **Off-screen culling** в `drawDecorZombieLayer` (`renderZombiesAndCorpses`) и `drawScaledZombieDebuffOverlays` (~12450, ~12790): AABB-проверка `(p.x < -96 || p.x > viewSize.w+96 || p.y < -96 || p.y > viewSize.h+96)` ДО push в items[] / ДО `ctx.save`+`drawImage`. Margin 96px покрывает половину спрайта зомби + ряд debuff-иконок. Live + dying zombies оба — экономит drawImage и cost сортировки `DepthSortApi.sortDecorAndZombies` для невидимых зомби. Decor не cull-ится (фиксированные позиции, обычно в кадре).
  - **Spatial hash uniform grid** для projectile↔zombie collision (~8625): module-scope `_zombieCollisionGrid: Map<int, number[]>` + bucket pool + scratch query array. Cell size 96px, integer key `gy*100003+gx`. `rebuildZombieCollisionGrid()` вызывается раз/кадр в начале `stepProjectiles` (после zmap fill). `queryZombieIndicesInRadius(cx, cy, r)` возвращает sorted ascending массив индексов из ~9 cells (3×3) вместо full scan. `impactAt` (~9180) рефакторен: оба цикла (aoeVictimsCount + damage) теперь итерируют через snapshot `_impactAoeIndices` (защита от re-entrant query из talents/chip onHit callbacks), порядок итерации = ascending index = `state.zombies` array order → behavior 1:1 (включая talents.onHit side effects). Dying zombies в bucket безопасны: consumers фильтруют `z.state === 'dying'`.
  - **DOM HUD diff-update** в `updateUI` / `refreshAutoMergeButton` / `updateDismantleButton` (~10485): новый helper `_setHudText(el, value)` кэширует `el.__lastHudText` и пропускает `textContent` set, если значение не изменилось — устраняет layout thrash на 60Hz для статичных HUD-полей (coins, kills, buyCost, buyTank label, autoMerge label, dismantle label, buyBulk label). Boolean `disabled` тоже обёрнут в diff-check. Behavior 1:1: первый кадр и при изменении значения textContent assign выполняется как раньше.
  - User-confirmed (Step 3.55, vscode_askQuestions): completed=[1,2,3], partial=[], not_completed=[]. Visual contract сохранён.
  - Follow-up из user comment: dedup чип-эффектов в радиусе 5-7px (несколько эффектов плотно друг в друге → визуально неразличимые, но оба render-ятся). Передан Meta-Orchestrator-у как next batch.
- **Hot-path perf: solo-pipeline-yandex-vk batch #3 item bonus-1 — устранение per-frame heap allocations и `Math.hypot` в step*/impactAt/select fence target (`game.js`, `docs/ai/SYSTEMS/perf.md`)**
  - Цель: ТЗ «игра подтормаживает с полным составом танков и хорошей прокачкой; нельзя менять количество zombies, скорость спавна, скорость стрельбы, ttl эффектов». Сохранено поведение 1:1 (визуально и механически). Тесты: 83/85 (тот же baseline; T4-12 MAX_COIN_PER_SHOT — pre-existing failure из прошлых батчей, не связан).
  - `stepTanks` (~8473): убран per-tank `candidates = []` + `.sort()` + `.map()` + `Math.hypot`. Module-scope `_stepTanksTargetPool` reused между кадрами; single-pass best-target tracking (max forwardDist, ties → min sideDist²) с inlined `zombiePos` и squared-distance skip. Tiebreaker идентичен оригиналу.
  - `stepProjectiles` (~8894): `new Map(state.zombies.map(z => [z.id, z]))` каждый кадр заменён на module-scope `_projectileZmap` (clear + refill). Регекс `.replace(/,\s*[\d.]+\)\s*$/, ...)` для trail-color заменён на `lastIndexOf(',') + substring + concat` (тот же выход для `rgba(R,G,B,A)`).
  - `impactAt` (~8964): `state.zombies.reduce(...)` для `aoeVictimsCount` заменён на plain for-loop с inlined `zombiePos` (без `{x,y}` allocation) и squared-distance check. Damage-loop: `Math.hypot` → squared-distance early-skip + `Math.sqrt` только для реальных victims внутри AOE.
  - `stepParticles` (~9347): `const next = []` каждый кадр (до 1600 элементов) заменён на write-index in-place compaction.
  - **Attack-wave focus** (rework после Step 3.55 user comment «всё ещё тормозит во время волны атаки»):
    - `selectZombieFenceTarget` (~7889): убран `const candidate = {seg, index, distance, isCorner}` per segment per zombie. С 200 zombies × ~40 segments в attack mode это экономит ~8000 throwaway objects/кадр. Single-pass best tracking через 4 inline vars + inline `compareFenceTargetTie`. Wrapping в результирующий объект — только один раз при return.
    - `selectZombieAttackTargetForZombie` (~7761): inlined `zombiePos` для устранения `{x,y}` allocation per zombie per frame в attack mode.
    - `pickFenceSegmentByPoint` (~7937): squared-distance comparison вместо `Math.hypot` per segment per breached zombie.
- **Render + production line: solo-pipeline-yandex-vk batch #2 items 3, 6 — corner towers + storage progress bar (`assets/fence.json`, `src/render/cornerTowers.js`, `assets/balance.json`, `src/render/productionLineRender.js`, `game.js`, `index.html`, `src/i18n/{ru,en}.json`)**
  - Item 3 (corner towers): новый модуль `src/render/cornerTowers.js` (`Game.CornerTowers`) — 4 предварительно аллоцированные башни в углах забора, atlas-driven анимации `idle`/`work`, kill-radius detection (squared-distance, hot-path без heap), graceful no-render при отсутствии атласа. Конфиг — секция `cornerTowers` в `assets/fence.json` (atlas `tower_atlas.png`, scale, anchor, killRadiusPx, killTriggerCooldownSec, frame, animations.idle/work с grid+frames+frameRate+loop+returnTo, offsets/anchors per угол tl/tr/bl/br) — все цифры внешние, runtime их только читает. Z-order: между drone slots и `zombiesCorpses`. Wiring в `game.js`: init после FenceRepair, `update(dt)` после `stepZombies`, `draw(ctx,{translateToCenter:true})` в render-цепочке, `notifyZombieKill(p.x-center.x, p.y-center.y)` после `burst()` в zombie-kill handler. Скрипт подключён в `index.html` с cache-bust `v=20260428-solo-pipeline-yandex-vk-b1-v1`.
  - Item 6 (production line): добавлены `production.featureFlags` (`conveyorEnabled:false`, `movingBoxEnabled:false`, `storageProgressBarEnabled:true`) и `production.storageProgressBar` (width/height/offsetY/colors/label) в `assets/balance.json`. `Game.ProductionLineRender.setProductionConfig(production)` гейтит `drawConveyor`/`drawBoxOnConveyor` и `triggerConveyorWork()` по флагам; новый `drawStorageProgressBar(ctx, pl)` рисует track + fill + опциональный процент-label поверх storage cell, читая прогресс из `state.productionLine.progress`. Helper `drawRoundedRect()` без аллокаций. i18n keys `productionStorageProgressLabel`/`productionStorageProgressTooltip` добавлены в обе локали.

## 2026-04-26
- **Runtime + balance: solo-pipeline-yandex-vk batch #1 items 1–4 — chip-aura re-enabled, fence repair perLevel, tank damage × 5, fence HP × 10 (`game.js`, `assets/tanks.json`, `assets/fence.json`, `src/mechanics/fenceRepair.js`)**
  - `game.js` `drawTank()`: chip-based aura sprites (`resolveTankAuraVisual` / `drawTankAuraSprite`) восстановлены — при наличии установленных чипов рендерится aura1/aura2/aura3 спрайт из `assets/tanks.json`. Orb-эффект для высоких уровней (`computeAuraBand` / `drawTankAura`) сохранён параллельно.
  - `assets/fence.json` `repair`: добавлен canonical ключ `perLevel` (60 значений по уровням), совместимый с паттерном `levelreward.json`. Устаревший ключ `costCoinsByLevel` удалён. `src/mechanics/fenceRepair.js` `getConfiguredRepairBaseCost()` теперь читает `repair.perLevel` как primary, `repair.costCoinsByLevel` остался как legacy fallback.
  - `assets/tanks.json`: `stats.baseDamage` всех 60 уровней умножен на 5 (lvl1: 520 → 2600).
  - `assets/fence.json`: `segmentMaxHp` всех 60 уровней умножен на 10 (lvl1: 110 000 → 1 100 000).

## 2026-04-25
- **Документация и runtime: solo-pipeline-yandex-vk batch 1 — Game.Events contract, HUD scratch `acquireArray`, `auraOrbs` freshness (`docs/ai/SYSTEMS/events.md`, `docs/events.md`, `docs/ai/SYSTEMS/hud_scratch.md`, `src/render/spriteLoaders.js`, `game.js`, `index.html`)**
  - Добавлен canonical `docs/ai/SYSTEMS/events.md` и alias `docs/events.md`: зафиксированы payload-by-id contract, async rAF-coalescing semantics, fallback scheduler через `setTimeout`, owner-boundary `EventBus` vs UI subscribers и known overlap `playerChips.changed reason='craft'` + `chips.crafted` с subscriber-side dedup policy.
  - `docs/ai/INDEX.md` и `docs/ai/PROJECT_MAP.md` теперь ведут к event-contract через обычный маршрут чтения; `Game.Events` описан как async in-proc EventBus, а не DOM event surface.
  - Добавлен `docs/ai/SYSTEMS/hud_scratch.md`, а `docs/ai/SYSTEMS/hud.md` синхронизирован с текущим API: `acquireArray(ownerTag, subSlot)` идемпотентен per frame, допускает re-entry без allocation и не является unbounded allocator.
  - `src/render/spriteLoaders.js` нормализует `assets/tanks.json -> auraOrbs` в `TankSprites.config.auraOrbs`, добавляет `TankSprites.refreshConfig()` / `reloadConfig()` с last-good rollback и `getAuraOrbsConfig()` для render read path.
  - `game.js` читает procedural aura params через live cached `TankSprites` accessor; `drawTankAura()` не выполняет fetch/JSON parsing и не мутирует state. `index.html` bump'ает entry token и cache-bust для `spriteLoaders.js`.

## 2026-04-24
- **Документация: solo-pipeline-yandex-vk batch 2 — data-driven coinsPerShot, earnings tab в balance-lab, bulletSizeConstant render flag (`assets/levelreward.json`, `src/mechanics/progression.js`, `game.js`, `tools/balance-lab.js`)**
  - Обновлены `docs/ai/SYSTEMS/assets.md`, `docs/ai/GAME_JS_MAP.md`.
  - Зафиксированы: `assets/levelreward.json` получил блок `coinsPerShot` (structure-parallel `gold`): `formula:"default"` = `min(2^(level-1), 2^20)`, `perLevel` — явный per-level override на все 60 уровней (1, 2, 4, …, 524288 до L20, затем cap `2^20 = 1048576` с L21 по L60). `perLevel` имеет приоритет над formula; отсутствие уровня → dev-warning + fallback к default формуле.
  - Зафиксированы: `src/mechanics/progression.js` экспортирует `coinsPerShotDefault(level)` и `coinsPerShot(level, bal, levelRewardCfg)` через `Game.Progression.coinsPerShot`. Runtime `Game.Economy.coinsForShot` (`game.js#L5100-L5120`) делегирует в `ProgressionApi.coinsPerShot`, сохраняя runtime-множители `coinsShotMul × incomeMult × activeMul`; safety-net cap `2^20` срабатывает только при отсутствии explicit `perLevel` override для уровня.
  - Зафиксированы: `tools/balance-lab.js` поднимает root tab `Заработок` (`data-root-tab="earnings"`) с fetch `../assets/levelreward.json`, таблица на 60 уровней (coinsPerShot / fireRate / `$/мин` на 1 ячейку / `$/мин` на N ячеек), debounce 500 ms cellCount (default `15`, соответствует in-game board), refresh + CSV export. Earnings tab является canonical surface для проверки экономического контракта `coinsPerShot` в dev-окружении.
  - Зафиксированы: `drawProjectiles()` в `game.js#L14532-L14620` получил флаг `bulletSprite.bulletSizeConstant` (default `true`). Визуальный scale снаряда декуплирован от `b.effectIntensity`: при `true` (default) размер = `baseScale`; при явном `false` возвращается legacy `baseScale * effectIntensity`. Damage / trail / impact ring продолжают читать `effectIntensity` независимо — это чисто визуальный knob, не балансный.

- **Документация и runtime: solo-pipeline-yandex-vk batch 1 — payload schema, HUD scratch pool, Game.Events bus, restore-path single emit (`src/persistence/serializedStateTypes.js`, `src/persistence/storage.js`, `src/render/hudScratch.js`, `src/core/events.js`, `src/ui/hangarChipsUI.js`, `game.js`, `index.html`, `docs/ai/SYSTEMS/save.md`, `docs/ai/SYSTEMS/hud.md`, `docs/ai/INDEX.md`)**
  - Добавлен canonical `@typedef SerializedState` модуль `src/persistence/serializedStateTypes.js` со всеми вложенными typedef-ами (Fence/Tank/Cell/Crate/MapSeeds/Stats/DroneRepair/Drone). `serializeState()` помечен `@returns {import('./serializedStateTypes').SerializedState}`; `payload.version` = `SAVE_VERSION = 2`, `preserve-unknown = false`, save payload не содержит PII.
  - `docs/ai/SYSTEMS/save.md`: расширена Payload Contract Map отдельной rubric-секцией (`type / default / restore-reset / reset-scope / last-modified`), добавлены подсекции «Канонический schema typedef», «TUT-8R..TUT-8W — regression pack anchor» (ссылка на `Test/pack4/tutorial_first_run_runtime.test.js`) и «Deprecation policy» с явным fallback-окном; зафиксирована текущая версия payload `SAVE_VERSION = 2`.
  - Добавлен HUD scratch-pool модуль `src/render/hudScratch.js` (`Game.HudScratch.create({ capacityPerOwner })`) с API `beginFrame/acquire/getMetrics/onDevicePixelRatioChanged`, owner-tag tuple `['healthBar','debuffIcon','fenceHp','drone','misc']`, capacity budget `128`, healthBar zero-clamp и overflow-диагностикой. `draw()` в `game.js` лениво создаёт `ctx.__hudScratch` и вызывает `beginFrame()` после `clearRect`; `renderFenceHpBars` адаптирован на `acquire('fenceHp', seg.id||i, null)` без heap-аллокаций. Контракт зафиксирован в новой странице `docs/ai/SYSTEMS/hud.md`.
  - Добавлен in-proc emitter `src/core/events.js` (`Game.Events.{on,off,emit,emitSync,listenerCount}`) с rAF-coalescing (last-write-wins per event-type). Канонический writer `Game.HangarChipsUI.setPlayerChips(chips, meta)` теперь снимает prev-snapshot, делегирует в canonical `Game.State.setPlayerChips` и эмитит `playerChips.changed` с `{reason, changedIds, prevSnapshot}` ровно один раз на успешный setter (P3.2/P3.3).
  - В `game.js` добавлены `__KNOWN_PAYLOAD_KEYS` + helper `reportUnknownPayloadKeys(payload, ctx)` (dev-only diagnostic через `Game.Diagnostics.reportUnknownPayloadKeys`, runtime-safe). Helper вызывается в `restoreFullState` и `applySavedProgress`. Оба restore-path передают `setPlayerChips(saved.playerChips, {reason:'restore'})` для одного canonical emit (P3.8).
  - `src/ui/hangarChipsUI.js` подписывается на `Game.Events.on('playerChips.changed', _scheduleLazyRepaint)` один раз на module-init; visibility guard (`#modsHangarOverlay` not hidden) заменяет per-open attach/detach без риска цикла (render не вызывает setPlayerChips).
  - `index.html`: добавлены `<script>` теги для трёх новых модулей с cache-bust `?v=20260424-solo-yandex-vk-b1-v1`; `storage.js` и `hangarChipsUI.js` обновили cache-bust до того же токена.

## 2026-04-22
- **Документация: one-shot shared post-merge update после remap zombie sprite payload по attachment-таблице (`assets/zombies.json`)**
  - Обновлены `docs/ai/SYSTEMS/assets.md`, `docs/ai/CHANGELOG.md`.
  - Зафиксированы: при перестановке содержимого `zombie_lvlN_atlas.png` без смены id/file-routing remap выполняется только внутри `types[]` по sprite-owned полям (`fenceOffsetPxBySide`, `frame`, `frames`, `anchor`, `scale`, `shadowScale`, `hpMul`, `omegaMul`, `rewardMul`, `weight`, `hitbox`, `attack`, `death`, `animations`, `anchor_shadow`), а `attackDamage` и `Health/health` остаются закреплены за destination level.
  - Зафиксированы: `atlasesById` не меняется при таком visual remap и остаётся частью per-id atlas routing contract, пока не меняется сама схема имён/путей atlas-файлов.

## 2026-04-03
- **Документация: one-shot shared post-merge update после join для Balance Lab auto-balance tooling (`tools/balance-editor.html`, `tools/balance-lab.js`, `tools/balance-shared.js`, `tools/balance-registry.js`, `tools/balance-optimizer.js`, `tools/balance-sim.js`, `Test/pack8/balanceToolParity.test.js`, `Test/pack8/balanceOptimizerLocks.test.js`, `ci/run_tests.sh`)**
  - Обновлены `docs/ai/INDEX.md`, `docs/ai/PROJECT_MAP.md`, `docs/ai/SYSTEMS/balance-editor.md`, `docs/ai/CHANGELOG.md`.
  - Зафиксированы: `tools/balance-editor.html` больше не описывается как analytics-only surface; host экспортирует `window.BalanceEditorApp`, публикует `balance-editor:state-changed`, а `tools/balance-lab.js` поднимает root tabs для profiles/goals/tunables/optimize/diff-write поверх существующего editor shell.
  - Зафиксированы: canonical formulas и surrogate matrix evaluation живут в `tools/balance-shared.js`, поэтому browser analytics, optimizer и CLI `tools/balance-sim.js` используют единый kernel для tank shot damage, zombie HP, fence survival, progression pressure и score/coverage evaluation.
  - Зафиксированы: `tools/balance-registry.js` документирован как allowlisted registry/runtime lock layer; direct write path может менять только JSON-конфиги и ограниченный набор runtime-констант из `game.js`, тогда как `attackMode.idleWave.betweenWavesSec` и safe-wave multipliers из world-events surfaces остаются visible-only locked constraints.
  - Зафиксированы: write-back требует явного выбора корня репозитория через File System Access API и всегда строится через preview diff/manifest; при отсутствии API tool остаётся в export-only fallback path вместо скрытой записи.

- **Документация: one-shot shared post-merge update после join для Arcade Chaos visual routing, reprogram dropdown shell, fixed reprogram card width и SC fullscreen breakpoint (`src/mechanics/chipEffects.js`, `game.js`, `src/ui/hangarChipsUI.js`, `style.css`, `src/ui/supercomputerMenu.js`, `index.html`)**
  - Обновлён `docs/ai/CHANGELOG.md`.
  - Зафиксированы: `Arcade Chaos` больше не берёт projectile/impact visuals из набора установленных модов ячейки; `game.js` и `src/mechanics/chipEffects.js` теперь резолвят bullet/impact overrides по фактическому `shotMods.activeModIds`, поэтому случайно выбранный подмод задаёт и полётный sprite, и sprite взрыва конкретного выстрела.
  - Зафиксированы: nuclear visual fallback стал shot-aware и не форсирует nuke projectile atlas, если конкретный выстрел не перешёл в `isNuke`; normal-shot path остаётся на базовом bullet sprite с normal impact atlas.
  - Зафиксированы: `Перепрограммировать` использует более выраженный TMZD-style select shell с pixel-font, green CRT-like glow, custom caret и hover/focus states вместо нейтрального browser-like поля.
  - Зафиксированы: для mobile coarse-pointer path и desktop `<=980px` reprogram source/result cards больше не наследуют shrink-clamp `--chipLabelCardWidth`, а держат полный `176px` width contract внутри `chipCraftReprogramStage`.
  - Зафиксированы: `shouldUseFullscreenShell()` в `src/ui/supercomputerMenu.js` поднят до desktop breakpoint `<=1501px`, поэтому `Модификации ангара`, `Модификации техники и стен` и embedded `Древо улучшений` открываются full-screen не только на mobile/coarse-pointer, но и на узком desktop path; `index.html` одновременно обновляет cache-bust token для `supercomputerMenu.js`.

## 2026-04-02
- **Документация: one-shot shared post-merge update после join для FontFloor skip export/metrics, workshop dust confirm + energy geometry sync, mobile drag/contextmenu parity и cache-bust token refresh (`src/ui/fontFloor.js`, `src/ui/hangarChipsUI.js`, `style.css`, `src/ui/undergroundHangarUI.js`, `game.js`, `src/phaser/phaserBootstrap.js`, `index.html`, `src/i18n/ru.json`, `src/i18n/en.json`, `src/i18n/fallbackStrings.js`)**
  - Обновлены `docs/ai/INDEX.md`, `docs/ai/PROJECT_MAP.md`, `docs/ai/SYSTEMS/ui.md`, `docs/ai/SYSTEMS/input.md`, `docs/ai/SYSTEMS/phaser.md`, `docs/ai/HANGAR_CHIPS_UI_MAP.md`, `docs/ai/STYLE_CSS_MAP.md`, `docs/ai/GAME_JS_MAP.md`, `docs/ai/CHANGELOG.md`.
  - Зафиксированы: `Game.FontFloor` документирован как explicit observer self-mutation contract с restore-on-skip, canonical `SKIP_SELECTORS` export и `getSchedulerMetrics()` для batched scheduler queue health.
  - Зафиксированы: workshop tooltip mobile-path больше не имеет отдельного close-fork; dust flow использует отдельный confirm modal с `chipCraftDustConfirmTitle/Text` в `ru/en/fallback`, а `chipCraftEnergySvg` теперь документирован как DOM-geometry-synced rail с post-render/resize handoff.
  - Зафиксированы: legacy/hybrid input path подавляет native context menu симметрично через document-level guard в `game.js` и `disableContextMenu:true` в `src/phaser/phaserBootstrap.js`, а `#c` и underground drag hosts сохраняют `touch-action:none` / `-webkit-touch-callout:none` как часть mobile drag parity.
  - Зафиксированы: `index.html` использует локальный cache-bust token `20260402-fd2-fontfloor-workshop-mobile-drag-v1` для `fenceRepair.js`, `fontFloor.js`, `fallbackStrings.js`, `hangarChipsUI.js`, `supercomputerMenu.js`, `undergroundHangarUI.js` и `phaserBootstrap.js` поверх entry helper path для `style.css` / `game.js`.

- **Документация: one-shot shared post-merge update после join для TMZD analytics foundation (`src/telemetry/telemetry.js`, `src/analytics/collector.js`, `src/analytics/funnel.js`, `src/flags/flags.js`, `src/experiments/experiments.js`, `docs/ai/SYSTEMS/telemetry.md`)**
  - Обновлены `docs/ai/PROJECT_MAP.md`, `docs/ai/SYSTEMS/telemetry.md`, `docs/ai/CHANGELOG.md`.
  - Зафиксированы: consent-aware remote analytics contract, Matomo primary / PostHog secondary rollout, collector mirror для rollout/verification snapshot, analytics adoption milestones и canary experiment `tmzd_analytics_rollout`.
  - Зафиксированы: operator verification path опирается на `markAdapterReadBack(...)`, `markManualSmoke(...)`, `markWeeklyReview(...)` и health snapshot со stale reasons без сетевых блокировок gameplay hot path.

- **Документация: one-shot shared post-merge update после join для fence repair runtime contract, mobile hangar/underground parity, focus-safe overlay hide и cache-bust wiring (`src/mechanics/fenceRepair.js`, `assets/fence.json`, `game.js`, `src/ui/hangarChipsUI.js`, `src/ui/undergroundHangarUI.js`, `src/ui/supercomputerMenu.js`, `src/ui/fontFloor.js`, `style.css`, `index.html`)**
  - Обновлены `docs/ai/INDEX.md`, `docs/ai/PROJECT_MAP.md`, `docs/ai/GAME_JS_MAP.md`, `docs/ai/SYSTEMS/fence.md`, `docs/ai/SYSTEMS/assets.md`, `docs/ai/ASSETS/fence.md`, `docs/ai/HANGAR_CHIPS_UI_MAP.md`, `docs/ai/SYSTEMS/ui.md`, `docs/ai/STYLE_CSS_MAP.md`, `docs/ai/SUPERCOMPUTER_MENU_MAP.md`, `docs/ai/CHANGELOG.md`.
  - Зафиксированы: `Game.FenceRepair` теперь документирован как единственный source of truth для repair pricing; `game.js` только инициализирует модуль в boot и делегирует `getFenceRepairCostCoins()` / `tryRepairFenceSegmentAt()`, а config-first resolution order идёт через `assets/fence.json -> repair.costCoinsByLevel[level] -> levels[level-1].repairCostCoins / levels[level-1].repair.costCoins -> buyTankCost(level)`.
  - Зафиксированы: `assets/fence.json` документирует `repair.costCoinsByLevel` как canonical per-level repair contract, тогда как top-level `repair.costCoins` не считается текущим authoritative runtime source.
  - Зафиксированы: `src/ui/fontFloor.js` теперь явно описан с restore-on-skip и self-mutation guard против stale inline `10px`; `src/ui/hangarChipsUI.js` и `style.css` закрепляют mobile long-press tooltip contract (`450ms`, `6px`, interactive close shell, `max-width:min(92vw, 380px)`), а `src/ui/undergroundHangarUI.js` — touch-safe drag/drop parity через pointer capture / `pointercancel` cleanup / threshold-gated updates.
  - Зафиксированы: `src/ui/supercomputerMenu.js` использует focus-safe overlay hide path через `resolveOverlayHideFocusTarget()` и `moveFocusOutsideOverlay()` перед `setOverlayOpen(false)`, а `index.html` держит локальный cache-bust token `20260402-fd1-mobile-hangar-fence-repair-v1` на изменённых HTML-loaded runtime scripts и entry helper path для `style.css`/`game.js`.

- **Документация: one-shot shared post-merge update после join для FontFloor observer guard (`src/ui/fontFloor.js`)**
  - Обновлены `docs/ai/INDEX.md`, `docs/ai/PROJECT_MAP.md`, `docs/ai/SYSTEMS/ui.md`, `docs/ai/CHANGELOG.md`.
  - Зафиксированы: `Game.FontFloor` сохраняет исходный inline `font-size`/priority в `data-font-floor-*`, восстанавливает его при переходе элемента в skip-path и не оставляет stale inline `10px` после выхода из clamp-сценария.
  - Зафиксированы: DOM observer маркирует собственные `style`-мутации через `__fontFloorInternalStyleMutations` и игнорирует их в `MutationObserver`, поэтому runtime больше не пересамопланирует clamp/restore loop на собственных изменениях стиля, сохраняя batched `requestAnimationFrame`/`setTimeout` scheduler.
  - Зафиксированы: глобальный floor `10px`, restore-on-skip поведение и skip-лист для unified close/remove controls остаются частью того же UI контракта.

## 2026-03-31
- **Документация: one-shot shared post-merge update после join для hangar/workshop responsive shell, aura render contract и Balance Editor analytics (`style.css`, `src/ui/hangarChipsUI.js`, `game.js`, `tools/balance-editor.html`)**
  - Обновлены `docs/ai/INDEX.md`, `docs/ai/PROJECT_MAP.md`, `docs/ai/STYLE_CSS_MAP.md`, `docs/ai/HANGAR_CHIPS_UI_MAP.md`, `docs/ai/GAME_JS_MAP.md`, `docs/ai/SYSTEMS/ui.md`, `docs/ai/SYSTEMS/assets.md`, `docs/ai/SYSTEMS/balance-editor.md`, `docs/ai/CHANGELOG.md`.
  - Зафиксированы: responsive hangar cells и workshop recycle shell теперь явно документированы как side-by-side contract для narrow/fullscreen hangar и для mobile `Разобрать/Перепрограммировать`, тогда как dust-only path остаётся single-column со sticky bottom bar.
  - Зафиксированы: mobile recycle/disassemble drag policy не отделяется от layout и остаётся canonical pointer-capture + cancelable touch `preventDefault` + общий threshold `6px` через `src/ui/hangarChipsUI.js`.
  - Зафиксированы: `game.js` документирует variant-specific aura sprite treatment как runtime render contract (`aura1` soft pulse, `aura2` stronger blue hue treatment, `aura3` strongest pulse + hue cycling) поверх `resolveTankAuraVisual(cellIndex, level)`.
  - Добавлен новый agent doc `docs/ai/SYSTEMS/balance-editor.md`: `tools/balance-editor.html` теперь описан как repo-local analytics tool с damage-points tab, selective refresh и zombie HP comparison, где явный `types[].Health` имеет приоритет над fallback-формулой.

- **Документация: shared post-merge update после join для aura sprite treatment, immediate hangar slot actions, responsive hangar/workshop shell и entry cache token (`game.js`, `src/ui/hangarChipsUI.js`, `style.css`, `index.html`)**
  - Обновлены `docs/ai/INDEX.md`, `docs/ai/PROJECT_MAP.md`, `docs/ai/GAME_JS_MAP.md`, `docs/ai/STYLE_CSS_MAP.md`, `docs/ai/HANGAR_CHIPS_UI_MAP.md`, `docs/ai/SYSTEMS/ui.md`, `docs/ai/SYSTEMS/render.md`, `docs/ai/CHANGELOG.md`.
  - Зафиксированы: `game.js` сохраняет chip-count aura routing через `getInstalledChipCountForCell()` / `resolveTankAuraVisual()`, но `drawTankAuraSprite()` теперь добавляет variant-specific runtime glow/ring treatment для `aura1/aura2/aura3`, а `computeAuraBand()` остаётся fallback-path.
  - Зафиксированы: `src/ui/hangarChipsUI.js` сразу вызывает `activateInstalledSlotActions()` после успешной установки чипа, поэтому rotate/remove actions появляются на занятом слоте без дополнительного повторного клика.
  - Зафиксированы: `style.css` убирает локальный `modsHangarScale` clamp, держит narrow/fullscreen hangar side-by-side (`hangarSlotView + right column`), сохраняет recycle mobile side-by-side для `Разобрать/Перепрограммировать`, делает dust bottom bar sticky и в narrow SC/terminal path больше не полагается на старый title clamp/max-width fork, снимая `min-width` floor с terminal action buttons.
  - Зафиксированы: `index.html` bump'ает shared entry cache token до `20260331-branch3-sc-shell-terminal-mobile-v1` для свежего подхвата `style.css` и `game.js` после merge.
- **Документация: shared post-merge update для bullet atlas overflow fix, chip-count aura overhaul, zombie unstick, responsive hangar scaling и touch chip drag capture (`assets/bullet.json`, `game.js`, `assets/tanks.json`, `src/render/spriteLoaders.js`, `style.css`, `src/ui/hangarChipsUI.js`)**
  - Обновлены `docs/ai/INDEX.md`, `docs/ai/PROJECT_MAP.md`, `docs/ai/GAME_JS_MAP.md`, `docs/ai/SYSTEMS/render.md`, `docs/ai/SYSTEMS/assets.md`, `docs/ai/SYSTEMS/combat.md`, `docs/ai/SPRITE_LOADERS_MAP.md`, `docs/ai/STYLE_CSS_MAP.md`, `docs/ai/HANGAR_CHIPS_UI_MAP.md`, `docs/ai/CHANGELOG.md`.
  - Зафиксированы: `assets/bullet.json` frame h `36→34` (atlas overflow fix); `drawProjectiles()` в `game.js` теперь clampит source rect к atlas bounds, fallback на круг при полном выходе за пределы.
  - Зафиксированы: старые `normalizeAuraChipCount()` / `getInstalledChipCountForTank()` заменены на `getInstalledChipCountForCell(cellIndex)` + обновлён `resolveTankAuraVisual(cellIndex, level)`, который теперь посимвольно считает installed chip slots в ячейке.
  - Зафиксированы: `assets/tanks.json` — все 60 `tank_lvlN` теперь несут `aura1/aura2/aura3` вместо старого `aura` (Green_Aura); `TankSprites.load()` нормализует все три варианта, а `pickAura(level, variant)` выбирает aura по variant `1..3`.
  - Зафиксированы: zombie unstick в `stepZombies()` — per-zombie 4s timer, 2px radial threshold, scalar nudge к fence при застревании.
  - Зафиксированы: `@media (max-width: 1279px)` в `style.css` теперь включает responsive hangar scaling block с var-driven `--modsHangarSlotWidth/Height` и column layout.
  - Зафиксированы: `src/ui/hangarChipsUI.js` `init()` теперь использует `setPointerCapture` + cancelable `preventDefault` на `pointermove` + явный `pointercancel` handler для touch drag fix.

## 2026-03-30
- **Документация: shared post-merge update после join для terminal shell, underground hangar header actions, responsive fence seam, chip-count aura, projectile near-hit и touch-safe drag (`style.css`, `index.html`, `src/ui/undergroundHangarUI.js`, `src/render/fenceLayout.js`, `Test/pack7/fenceCornerSlots.test.js`, `game.js`, `src/mechanics/targeting.js`, `src/render/spriteLoaders.js`, `Test/pack6/projectileAimFallback.test.js`, `src/ui/productionLineUI.js`, `src/ui/hangarChipsUI.js`)**
  - Обновлены `docs/ai/INDEX.md`, `docs/ai/PROJECT_MAP.md`, `docs/ai/SYSTEMS/ui.md`, `docs/ai/SYSTEMS/render.md`, `docs/ai/SYSTEMS/combat.md`, `docs/ai/SYSTEMS/input.md`, `docs/ai/SYSTEMS/fence.md`, `docs/ai/STYLE_CSS_MAP.md`, `docs/ai/GAME_JS_MAP.md`, `docs/ai/HANGAR_CHIPS_UI_MAP.md`, `docs/ai/SPRITE_LOADERS_MAP.md`, `docs/ai/CHANGELOG.md`.
  - Зафиксированы: top-right terminal остаётся token-driven через `--ui-terminal-width` / `--ui-terminal-expand-size`, `<1200px` override ужимает shell и снимает `min-width` с terminal buttons, а `plStorage__confirmBox` документирован с token-driven width и fallback `width:auto; max-width:100%` при `<=1250px`.
  - Зафиксированы: `ensureHelpButton()` в `src/ui/undergroundHangarUI.js` документирован как canonical owner underground header-action alignment; help CTA вставляется в `.ughPanel__headerActions` / `.scModal__headerActions` непосредственно перед close и тем самым сохраняет shared SC-family порядок `help -> close`.
  - Зафиксированы: tank aura больше не описывается как high-level-only visual. Runtime считает installed chip count, активирует `aura1/aura2/aura3` по `1..3`, а `TankSprites.auraVariantLevels` оставлен как asset lookup `10/20/30`; `computeAuraBand()` теперь явно задокументирован как fallback-path.
  - Зафиксированы: `src/mechanics/targeting.js` держит near-hit latch через `lastDistToTarget`, а `Test/pack6/projectileAimFallback.test.js` закрепляет позитивный и негативный сценарии fallback impact.
  - Зафиксированы: canvas/storage/workshop drag paths синхронизированы по touch `preventDefault`, pointer capture и порогу `6px` без обновления drag-state до threshold, а `src/render/fenceLayout.js` ниже `1400px` усиливает corner-side overlap для устранения узкоэкранных gap'ов; `Test/pack7/fenceCornerSlots.test.js` закрепляет responsive seam scaling.

## 2026-03-29
- **Документация: shared post-merge update после join для SC-family scroll containment, bounded Production Storage responsive shell, terminal downsizing и zombie death/shadow scale contract (`src/ui/supercomputerMenu.js`, `src/ui/productionLineUI.js`, `style.css`, `index.html`, `assets/zombies.json`, `src/render/spriteLoaders.js`, `src/render/zombieRender.js`)**
  - Обновлены `docs/ai/INDEX.md`, `docs/ai/PROJECT_MAP.md`, `docs/ai/SUPERCOMPUTER_MENU_MAP.md`, `docs/ai/STYLE_CSS_MAP.md`, `docs/ai/SPRITE_LOADERS_MAP.md`, `docs/ai/SYSTEMS/ui.md`, `docs/ai/SYSTEMS/assets.md`, `docs/ai/SYSTEMS/render.md`, `docs/ai/CHANGELOG.md`.
  - Зафиксированы: `Game.SupercomputerMenu` документирован как canonical owner shared help-shell, fullscreen-shell routing и talents header action-row `help -> close`; fullscreen routing теперь явно описан только для talents/hangar/tank-wall, а fullscreen talents path зафиксирован через outer overflow lock + inner scroll containment у `#supercomputerTalentsView` / `.talentTreeBody`.
  - Зафиксированы: responsive storage contract теперь явно разделён на `default / expanded / mobile-fit`, причём `.plStorage--expanded` даёт safe-area wrapper, а `.plStorage__panel--expanded/mobileFit` сохраняют centered bounded panel с capped width/height вместо fullscreen-stretch semantics.
  - Зафиксированы: top-right terminal теперь документирован с dedicated `< 1200px` downsizing contract через root `--ui-terminal-width` vars и media override для shell width, panel padding, header chrome, stage-ability spacing и HUD button sizing.
  - Зафиксированы: `assets/zombies.json` / `ZombieSprites.load()` / `zombieRender` теперь документируют не только shared `atlas` + `atlasesById`, но и `deathCommon[].scale` / `types[].shadowScale`; death scale складывается с `type.scale`, а shadowScale кормит и atlas, и fallback shadow ellipses.

## 2026-03-28
- **Документация: shared post-merge update после join для debuff overlay scale, SC header-actions, shared button behavior mobile guard и narrow-shell modal contracts (`game.js`, `index.html`, `src/ui/buttonBehavior.js`, `src/ui/supercomputerMenu.js`, `style.css`)**
  - Обновлены `docs/ai/SYSTEMS/ui.md`, `docs/ai/STYLE_CSS_MAP.md`, `docs/ai/SUPERCOMPUTER_MENU_MAP.md`, `docs/ai/GAME_JS_MAP.md`, `docs/ai/CHANGELOG.md`.
  - Зафиксированы: `drawScaledDebuffExpiryOverlay()` / `drawScaledZombieDebuffOverlays()` документированы как единый scale-path от `debuffIconScale`; белый expiry wedge/dot больше не рассматривается как fixed-px overlay.
  - Зафиксированы: talents shell теперь документирован через shared right-side header-actions row `supercomputerTalentsHeaderActions` / `scModal__headerActions`, с унифицированным порядком `help -> close` и без отдельного talents-only header layout.
  - Зафиксированы: mobile disappearing-control fix привязан к общему split-contract `src/ui/buttonBehavior.js` + `.uiButtonBehavior` coarse-hover media guard, а не к разрозненным button-specific overrides.
  - Зафиксированы: SC-family fullscreen shells под coarse-pointer / `< 1280px` и expanded/scaled Production Storage shell под narrow/mobile path описаны как deliberate responsive contracts, а не как случайные CSS-побочные эффекты.

- **Документация: shared post-merge update для repo-local context-mode consumer alignment (`.github/hooks/context-mode.json`, `.vscode/mcp.json`)**
  - Обновлены `docs/ai/INDEX.md`, `docs/ai/PROJECT_MAP.md`, `docs/ai/CHANGELOG.md`.
  - Зафиксированы: TMZD `.github/hooks/context-mode.json` и `.vscode/mcp.json` документированы как plain consumer mirror shared `.agents` baseline (`PreToolUse/PostToolUse/PreCompact/SessionStart` + `npx -y context-mode`), а Telegram broker ownership явно остаётся вне game repo.

- **Документация: shared post-merge update для live-layout фиксов Tech Unlock card и responsive action lane в modifiers modal после join (`style.css`)**
  - Обновлены `docs/ai/STYLE_CSS_MAP.md`, `docs/ai/SYSTEMS/ui.md`, `docs/ai/SUPERCOMPUTER_MENU_MAP.md`, `docs/ai/HANGAR_CHIPS_UI_MAP.md`, `docs/ai/CHANGELOG.md`.
  - Зафиксированы: `Tech Unlock` cards документированы как CSS-owned self-sized shell с `min-height` clamp, bottom-anchored `progress/footer` и full-width primary CTA; runtime `renderTechUnlockPanel()` не берёт на себя per-state height hacks.
  - Зафиксированы: в `Supercomputer -> Tank/Drone/Wall Mods` narrow-layout contract для row-level `Upgrade` теперь явно документирован как полноширинная нижняя центрированная action lane при viewports `< 1200px`; header action-cell скрывается, чтобы CTA не клипался, а runtime/apply seam не меняется.

## 2026-03-27
- **Документация: shared post-merge update для modifiers modal per-stat contract после join (`game.js`, `src/ui/supercomputerMenu.js`, `src/config/tutorialSteps.js`, `src/ui/tutorialRuntime.js`, `style.css`, `assets/tanks.json`, `assets/dron.json`, `assets/fence.json`)**
  - Обновлены `docs/ai/INDEX.md`, `docs/ai/PROJECT_MAP.md`, `docs/ai/SUPERCOMPUTER_MENU_MAP.md`, `docs/ai/SYSTEMS/ui.md`, `docs/ai/SYSTEMS/assets.md`, `docs/ai/SYSTEMS/tutorial-runtime.md`, `docs/ai/GAME_JS_MAP.md`, `docs/ai/STYLE_CSS_MAP.md`, `docs/ai/CHANGELOG.md`.
  - Зафиксированы: `Supercomputer -> Tank/Drone/Wall Mods` теперь документирован как shared hybrid seam с expandable summary/detail rows, stat-specific pending state, second-click apply через `applyPendingStats(...)` и scale-aware wrappers `.modsTankWall__panelActions/.modsTankWall__footerActions`.
  - Зафиксированы: canonical cost schema живёт в `upgradeDamagePointsCosts` внутри `assets/tanks.json`, `assets/dron.json`, `assets/fence.json`; `game.js` остаётся единственным apply/cost runtime layer через `get*UpgradeTotalCost()` / `apply*Upgrade()`.
  - Зафиксированы: tutorial damage-step теперь таргетит expand-toggle первой weapon row и завершается по любому applied damage-upgrade в weapons/drones/walls, с preserve-pending completion contract в `tutorialRuntime`.
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
