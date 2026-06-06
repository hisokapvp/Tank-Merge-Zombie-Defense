# `src/perf/perfCapture.js` — Структурная карта (`Game.PerfCapture`)

> Агент-ориентировано. Обновлён: 2026-06-06.
> Файл — 889 строк, single IIFE (`(function (global){ 'use strict'; ... })(window)`).
> Проверь актуальность строк, если файл изменялся после этой даты.

## Что это
Real-time perf-diagnostic слой поверх `Game.Profiler`. Включается кнопкой в Perf-вкладке
debug-панели (`?debug=1`). Пока идёт capture — собирает распределение frame-time,
per-phase агрегаты, entity drill-down, memory-сэмплы и env-снимок, затем экспортирует
**один** AI-оптимизированный отчёт (Markdown + fenced ```json`, schema `tmzd.perfCapture.report`)
в буфер обмена + скачиваемый `.json`. Рисует минимальный угловой overlay (FPS / frame ms / top-3 фазы).

## Быстрый старт для агента
- Точка входа в hot path: `onFrame(now, dt, state)` (строки 181–209) — вызывается из `game.js` `loop()` после `draw()`; O(1) early-out когда `capturing === false`.
- Публичный API и `__test` seam — в самом конце: `global.Game.PerfCapture = {...}` (строки 858–888).
- Сборка отчёта (off hot-path): `buildReport()` (606–698).

## Инварианты этого модуля ⚠️
- **Zero-overhead вне capture**: вся сборка только при `isCapturing() === true`; `onFrame()` обязан O(1) выходить, когда не пишем. Ring-буферы и scratch — pre-allocated (`Float32Array`), steady state без аллокаций.
- На `stop()` Profiler возвращается к release-дефолту (`enabled` ⇔ `Game.DEBUG === true`) — не-debug сессия снова zero-overhead.
- Достижим только через debug-панель, которая существует только под `?debug=1`.
- Сериализация отчёта (`buildReport`/`_buildMarkdown`) — только на export, не в кадре.
- Schema id отчёта — строковый контракт `'tmzd.perfCapture.report'` (строка 630); downstream-агенты на него опираются — не переименовывать молча.

## Оглавление файла

### Заголовок, tunables, capture-state (строки 1–122)
| Блок | Строки | Назначение |
|---|---|---|
| Doc-comment (zero-overhead contract) | 1–19 | Контракт назначения и нулевого оверхеда |
| Tunables | 23–29 | `RING_CAP=600` (~10s @60fps), `OVERLAY_THROTTLE_MS=150`, `ENTITY_SAMPLE_MS=200`, `JANK_MS=50`, `LONG_FRAME_MS=1000/30`, `GC_DROP_BYTES=1.5MB` |
| `PHASE_LOCATIONS` | 33–72 | Статическая карта `phase → game.js функция`, встраивается в отчёт (имена стабильны, номера строк намеренно опущены — дрейфуют) |
| `UMBRELLA` | 74 | Top-level фазы `loop.update/ui/draw` (для %-of-frame) |
| Capture-state + ring + агрегаты | 75–122 | `_frameMsRing`/`_intervalMsRing` (`Float32Array`), `_phaseAgg`, `_entityAgg`, memory-поля, overlay-scratch top-3 |

### Helpers + ring/aggregate writers (строки 124–179)
| Функция | Строки | Назначение |
|---|---|---|
| `_nowMs`, `_numAsc`, `_mb`, `_round`, `_keyCount`, `_shortPhase` | 124–144 | Мелкие чистые утилиты (без аллокаций в hot-path вариантах) |
| `_pushFrame(cpuMs, intervalMs)` | 146–158 | Запись кадра в ring; инкремент jank/long-frame счётчиков |
| `_accumPhase(name, ms)` | 159–169 | Аккумулятор per-phase (sum/count/min/max/last); callback для `Profiler.forEachFrameMs` |
| `_recordEntity(metric, val)` | 170–179 | Агрегат entity-метрики (cur/peak/sum/count) |

### Hot-path сборка (строки 181–337)
| Функция | Строки | Назначение |
|---|---|---|
| `onFrame(now, dt, state)` [HOT] | 181–209 | Главный per-frame collector; early-out если не capturing; читает `Profiler.getFrameMs('loop.update'/'loop.ui'/'loop.draw')`, гоняет `Profiler.forEachFrameMs(_accumPhase)`, троттлит entity/overlay/memory |
| `_sampleMemory()` | 211–225 | `performance.memory` сэмпл (Chromium-only, guarded): start/peak/min/last + GC-эвенты по падению heap ≥ `GC_DROP_BYTES` |
| `_sampleEntities(state)` | 226–267 | Drill-down: zombies total/alive/dying + по type-id, projectiles/particles/impacts/decals/damageNumbers, tanks, drones |
| `_emitUserTiming(nowMs, Prof)` | 268–282 | `performance.measure` для `update/ui/draw` (DevTools timeline; включается чекбоксом) |
| Overlay: `_ensureOverlay` 283, `_top3Reset` 303, `_top3Cb` 304, `_top3Lines` 317, `_updateOverlay` 325 | 283–337 | Fixed-corner overlay (FPS / frame ms / top-3 фазы), троттлинг `OVERLAY_THROTTLE_MS` |

### Lifecycle + сводка (строки 338–605)
| Функция | Строки | Назначение |
|---|---|---|
| `_resetData()` | 338–359 | Обнуление ring/агрегатов/memory/overlay-scratch (in-place) |
| `start` 360 / `stop` 376 / `toggle` 391 / `reset` 393 | 360–400 | Capture lifecycle; `start()` включает Profiler, `stop()` восстанавливает release-дефолт |
| `isCapturing` 401 / `setEnvProvider` 402 / `setUserTiming` 403 / `isUserTiming` 404 | 401–406 | Геттеры/сеттеры; `setEnvProvider(fn)` — hook для game-local env-снимка |
| `_collectRing` 407 / `_percentileSorted` 414 / `_mean` 426 / `_summarize` 434 | 407–519 | Перцентили (p50/p95/p99/max), jank-count, frame-сводка |
| `_entitiesSnapshot` 520 / `_detectRenderEngine` 533 / `_envSnapshot` 543 / `_memVerdict` 571 / `_heuristic` 578 / `_miniSummaryLine` 600 | 520–605 | Снимки entity/env, эвристический вердикт (узкое место + memory verdict) |

### Report + export (строки 606–888)
| Функция | Строки | Назначение |
|---|---|---|
| `buildReport()` | 606–698 | Собирает `{markdown, json, payload}`; schema id `'tmzd.perfCapture.report'` (630), `ringCapacity` (646) |
| `_buildMarkdown(sum, env, entities)` | 699–762 | Markdown-резюме отчёта (summary + top-фазы + entity + memory) |
| `getReportPayload` 763 / `getStatusText` 765 / `_fallbackCopy` 796 / `copyReport` 813 / `_tsForFile` 827 / `downloadJson` 834 | 763–857 | Live-readout текст, копирование в буфер (с fallback), скачивание `.json` |
| `global.Game.PerfCapture = {...}` + `__test` seam | 858–888 | Публичный API; `__test` (874) — pure-Node ring/percentile/report seam (`RING_CAP`, `resetData`, `pushFrame`, `accumPhase`, `recordEntity`, `summarize`, `buildReport`) |

## Зависимости
- Использует: `Game.Profiler` (per-frame accumulator API: `getFrameMs`/`forEachFrameMs`, см. [SYSTEMS/perf.md](SYSTEMS/perf.md)), `performance.memory` (опц.), `Game.RenderRegistry`/env через `setEnvProvider`.
- Используется в: `game.js` `loop()` → `onFrame()` (вызов на [game.js](../../game.js#L18799)), `src/ui/debugPanel.js` Perf-вкладка (Start/Stop/Reset/Copy/Download), `game.js` `setEnvProvider(...)` ([game.js](../../game.js#L18857-L18869)).
- Подключение: [index.html](../../index.html#L961) `src/perf/perfCapture.js` сразу после `profiler.js`.
- Тест: `Test/pack5/perfCaptureReport.test.js` (registered в `ci/run_tests.sh`) — ring wraparound, percentile math, report schema, budget flagging, `onFrame` zero-overhead.

## Известные ограничения
- Memory-сэмплы доступны только в Chromium (`performance.memory`); в остальных движках `_memSupported=false`, секция memory помечается как unsupported.
- `PHASE_LOCATIONS` хранит имена функций без номеров строк (намеренно — строки дрейфуют); точные строки маркеров — в [SYSTEMS/perf.md](SYSTEMS/perf.md).
