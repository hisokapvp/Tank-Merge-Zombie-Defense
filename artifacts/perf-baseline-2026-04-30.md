# Perf Baseline — solo-pipeline-yandex-vk#2 / B1

- Дата: 2026-04-30
- Batch: solo-pipeline-yandex-vk#2 (item 8 — B1 Allocation hunt)
- Источник: read-only audit + Test/pack4 + Test/pack5 на текущем HEAD
- Зависимость: appendix к `docs/ai/SYSTEMS/perf.md` (canon zero-alloc), не заменяет его

## 1. Test pack baseline

### Pack 5 — `Test/pack5/perf_regression.test.js`

```
✓ P5-POOL-1: ObjectPool exists
✓ P5-POOL-2: acquire/release reuses objects
✓ P5-POOL-3: pool caps size
✓ P5-POOL-4: stats track totalCreated
4 passed, 0 failed
```

ObjectPool acquire/release/reset контракт стабилен. Регрессий нет.

### Pack 4 — `Test/pack4/perf_stress.test.js`

```
✓ PROF-1: Profiler exists
✗ PROF-2: start/end records stats — Assertion failed: loop stats
✗ PROF-3: measure returns fn result — Cannot read properties of undefined (reading 'count')
✗ PROF-4: stress multiple samples — Cannot read properties of undefined (reading 'count')
1 passed, 3 failed
```

**Pre-existing failure, не введён batch 2.** Корень: `_enabledDefault = !!(Game.DEBUG === true)` (комментарий solo-pipeline-yandex-vk#1 step-1, postmortem item 15). Pack 4 тест-харнес создаёт `globalCtx.Game = {}` без `DEBUG=true` → `enabled=false` → `start/end` early-return → stats никогда не записываются → PROF-2/3/4 падают на чтении `stat.count`.

Source comment явно обещает «Pack 4 perf_stress test continues to call `setEnabled(true)` explicitly at boot so the existing test contract is preserved», но ни PROF-2, ни последующие тесты не вызывают `Profiler.setEnabled(true)`. Это рассогласование source-claim ↔ test-harness.

**Рекомендация для batch 3 (B4 — perf tests + CI):** добавить `Profiler.setEnabled(true)` в тестовый bootstrap Pack 4 после `loadModule('src/perf/profiler.js')`, либо переключить default обратно на `enabled=true` для headless режима через дополнительный env-check. Без этого Pack 4 в `ci/run_tests.sh` стабильно красный, и perf-budget regression скрыты.

## 2. Hot-path read-only audit

Проверены целевые функции из RAW_TZ B1:

| Функция | Файл | Строка | Канон | Статус |
|---|---|---|---|---|
| `stepZombies` | game.js | L8354 | zero-alloc, scratch-vec | ✓ соответствует канону `perf.md §"Канон hot-path"` |
| `stepTanks` | game.js | L8640 | scratch + single-pass best | ✓ batch #3 уже применён |
| `stepProjectiles` | game.js | L9220 | reused Map + spatial grid rebuild | ✓ batch #3/#4 |
| `stepParticles` | game.js | L9747 | write-index compaction | ✓ batch #3 |
| `impactAt` | game.js | L9320 | grid query + squared distance | ✓ batch #4 |
| `_zombieCollisionGrid` | game.js | L8774 (module-scope) | `Map`, reuse через `.clear()` в `rebuildZombieCollisionGrid` L8820 | ✓ 96px cell, integer key `gy*100003+gx`, bucket pool |

### Allocation grep — hot path

Проверка `.filter(`/`.map(`/`.forEach(`/`.reduce(` в окрестности step*/draw*/impactAt L8200..L15500:

- **В step\* / impactAt body**: НЕТ. Все совпадения, попадающие в этот диапазон строк, — это либо комментарии (L8670, L9228), либо инициализация UI/talents/fence (L11414+, L14038), либо `state.particles.filter(p => !p.debugPreview)` L15901-3 (debug-only path, выполняется по toggle, не в loop), либо `state.zombies.filter(... 'dying' ...)` L15941 (uses HUD count fallback path).
- **Кандидаты на B3/follow-up review (вне hot loop, но per-frame UI)**:
  - L15941: `state.zombies.filter(function (z) { return z && z.state !== 'dying'; }).length` — если вызывается в HUD update без `_setHudText` diff-cache, создаёт временный массив каждый кадр. Нужен audit: вызывается ли это в `updateUI` (60Hz) или только при изменении count.

### `forEach`/`map`/`filter`/`reduce` за пределами hot-path (для справки)

- L1500..1817: audio init/save/restore — выполняется единично при boot/save/restore.
- L2082..2195: i18n DOM update — `[data-i18n]` всегда non-hot, выполняется при language switch или boot.
- L4849: `state.cells.filter(c => !c.tank).length` — fallback когда `Garage.countFreeCells` не определён; cells N≤16, win незначительный.
- L5561, L6655-57, L7363/7380, L11414+, L11789+: UI-render (talents tree, supercomputer menu, purchase labels) — событийные, не per-frame.
- L11551-52: `nodeIds.map().filter()` для talents validate — вызывается при unlock / save load.
- L14038: `rawSegments.map(...)` — once при `rebuildFenceSegments`, по событию.

**Вывод:** hot-path step\* и impactAt **уже соответствуют zero-alloc канону** из `docs/ai/SYSTEMS/perf.md`. Дополнительных аллокаций в loop текущим audit-ом не выявлено. GC-spike инвариант (0 spike в loop) — выполнен на уровне исходников; runtime-валидация требует включения `Game.Profiler.setEnabled(true)` в headless и сбора traces (см. блок «Open follow-ups» ниже).

## 3. Profiler enable путь

`src/perf/profiler.js` содержит canonical API:
- `Profiler.setEnabled(true|false)` — toggle runtime, безопасно для no-op.
- `Profiler.setBudgets({phase: ms, ...})` — пороги для `perf.budget.exceeded` event.
- `Profiler.start(name)` / `end(name)` — O(1) early-return когда `enabled=false`.

Default `_enabledDefault = (Game.DEBUG === true)` оставляет profiler off в release-mirror — это intentional для production. Чтобы собрать baseline 60s в headless / mobile UA emulation, требуется:
1. В headless-харнесе явно вызвать `Profiler.setEnabled(true)` после load `src/perf/profiler.js`.
2. Установить budgets по уже задокументированным per-phase порогам (см. comment block в profiler.js item 11 / item 8 throttle).
3. Прогнать loop ≥60s, собрать `getStats()` snapshot, сравнить с canonical budgets.

**Открытый риск:** в текущем `ci/run_tests.sh` headless-trace 60s не собирается автоматически. Это входит в scope batch 3 (B4 — perf tests + CI), не в scope batch 2.

## 4. Open follow-ups (после batch 2)

- [ ] Pack 4 test-harness: вызвать `Profiler.setEnabled(true)` в bootstrap → пометить как regression-blocker для CI (batch 3).
- [ ] Headless 60s loop trace + browser mobile UA emulation trace — отдельная perf-stress сессия (batch 3 / B4).
- [ ] L15941 `state.zombies.filter(...).length` — audit вызывается ли в `updateUI` 60Hz; при подтверждении заменить на счётчик-инкремент в step (zero-alloc).
- [ ] `rebuildZombieCollisionGrid` cell-size 96px остаётся каноном; при росте средних AOE до 200px рассмотреть 128-150px (см. perf.md §"Cell size tuning").

## 5. Заключение

**B1 acceptance:**
- Тест-пакеты Pack 4 и Pack 5 прогнаны; failures Pack 4 — pre-existing, документированы как scope для batch 3.
- Hot-path step\*/impactAt соответствует канону zero-alloc из `docs/ai/SYSTEMS/perf.md` §"Канон" и §"Уже применённые оптимизации". Новых аллокаций в loop не выявлено.
- Spatial hash 96px reuse подтверждён module-scope `Map` + `clear()`.
- Targeted invariant «0 GC-spike в loop» — соблюдается на уровне исходников; runtime-trace отложен до batch 3 (CI bootstrap profiler).

**Изменения в game.js не требуются** в рамках B1 — все hot-path сайты уже оптимизированы предыдущими batch-ами. Текущий B1 — read-only verification + baseline доклад.
