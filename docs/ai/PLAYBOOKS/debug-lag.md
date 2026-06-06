# Плейбук: Диагностика лагов

## Шаги
1. Определить тип лага: постоянный FPS или спайки.
2. Проверить mobile caps и FX-уровень.
3. Профилировать узкие места через `Game.Profiler.measure`.
4. Снизить churn (pooling, лимиты частиц и декалей).

## Perf инструменты (solo-pipeline-yandex-vk#1)

- `Game.Profiler.setBudgets({stepProjectiles: 2.5, impactAt: 1.5, drawZombies: 3.0, drawTank: 2.0, chipEffectsSpawn: 1.0})` — миллисекунды на фазу. Превышение бюджета эмитит `perf.budget.exceeded` через `Game.Events`.
- `Game.Events.on('perf.budget.exceeded', ({phase, ms, budget, count}) => console.warn(phase, ms, '>', budget))` — подписка на регрессии.
- Markers (`Game.Profiler.start/end`) активны только при `Game.DEBUG === true`. В release/staging/dist всё выключено и оверхед нулевой.
- `Game.Sprites.bumpAtlasVersion(reason)` — вручную инвалидировать spriteRefCache (например, после hot-reload атласа). `worldReset` partial вызывает это автоматически.
- `Game.ChipEffects.shouldSpawnEffect(type, x, y, nowSec)` — visual-only spatial dedup для chip-эффектов; damage/duration активного эффекта остаётся за authoritative tick'ом.
- `assets/balance.json` → `perf.gridBucketWarmup` (default 16, hardcoded cap 32) — warm-up zombie-grid bucket pool на старте, гасит alloc-spike первой большой волны.

## PerfCapture tool — диагностика лага end-to-end (perf-capture-tool / 2026-06-06)

`Game.PerfCapture` (`src/perf/perfCapture.js`, карта [PERF_CAPTURE_MAP.md](../PERF_CAPTURE_MAP.md); контракт — [SYSTEMS/perf.md](../SYSTEMS/perf.md)) собирает один AI-оптимизированный отчёт по окну лага.

Пошагово:
1. Открой `index.html?debug=1` — появится debug-панель, перейди на вкладку **Perf** (`#debugSectionPerf`).
2. Нажми **Start** перед моментом лага. Включается профилирование (`Profiler.isEnabled()` → true) и угловой overlay (FPS / frame ms / top-3 фазы).
3. **Воспроизведи лаг** (массовая волна, AttackMode, плотные chip-эффекты и т.п.). PerfCapture пишет ring-буфер (~10s @60fps) + per-phase/entity/memory агрегаты.
4. Нажми **Stop** — Profiler возвращается к release-дефолту (zero-overhead), данные заморожены.
5. Нажми **Copy AI report** — в буфер кладётся Markdown-резюме + fenced ```json` (schema `tmzd.perfCapture.report`). Передай это AI-агенту: в отчёте есть перцентили кадров, узкая фаза, over-budget флаги, entity drill-down, memory verdict и `PHASE_LOCATIONS` (phase → функция в `game.js`).
6. Альтернативно **Download JSON** — тот же отчёт файлом для прикрепления.

Дополнительно:
- **Reset** — очищает ring/агрегаты, чтобы начать новый замер без перезагрузки страницы.
- **Live `<pre>` readout** (`#debugPerfReadout`) обновляется ~каждые 400ms во время capture — быстрый взгляд без экспорта.
- Чекбокс **«DevTools timeline (performance.measure)»** (default OFF) — эмитит `performance.measure` для 3 top-level фаз (`update`/`ui`/`draw`), чтобы видеть их на таймлайне Chrome DevTools Performance.
- Over-budget определяется по `assets/balance.json` → `perf.profilerBudgetsMs`; правь пороги там, если нужно перекалибровать флаги.

## Проверка
- `node Test/pack4/perf_stress.test.js`
- `node Test/pack5/perf_regression.test.js`
- Ручной бой 35 минут.
