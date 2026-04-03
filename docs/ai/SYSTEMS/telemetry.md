# Система: Telemetry / Analytics / Flags

> Агент-ориентировано. Обновлён: 2026-04-02.
> Читай в порядке: `src/telemetry/telemetry.js` `1-149`, `331-517`, `628-759` -> `src/analytics/collector.js` `1-372` -> `src/analytics/funnel.js` `1-259` -> `src/flags/flags.js` `1-223` -> `src/experiments/experiments.js` `1-343`.

## Scope
- TMZD telemetry остаётся engine-agnostic: legacy Canvas 2D и Phaser 3 dual-mode runtime используют один analytics contract без phaser-specific internals.
- Hot-path draw/loop/step не должен ждать analytics network IO: remote ingest идёт через неблокирующий adapter queue в `src/telemetry/telemetry.js`.
- `.agents` dashboard читает эту foundation только как operator-facing support surface; canonical runtime и source of truth остаются внутри TMZD repo.

## Быстрый старт для агента
- `src/telemetry/telemetry.js` `1-149`, `331-517`, `628-759` — taxonomy `tmzd-analytics-taxonomy.v1`, consent contract, adapter activation, batching, read-back/manual smoke/weekly review и stale health snapshot.
- `src/analytics/collector.js` `1-372` — local aggregate summary и mirror `Game.TelemetryLogger.getHealthSnapshot()` через `setAnalyticsRollout(...)`.
- `src/analytics/funnel.js` `1-259` — analytics adoption milestones, `manual_smoke` / `weekly_review` / `read_back_verified` и 7-day freshness для adoption funnel.
- `src/flags/flags.js` `1-223` — семейство `tmzdAnalytics*` flags и `getAnalyticsSnapshot()`.
- `src/experiments/experiments.js` `1-343` — sticky experiment `tmzd_analytics_rollout` и `getAnalyticsRolloutState()`.

## Канонические файлы
| Файл | Строки | Назначение |
|---|---|---|
| `src/telemetry/telemetry.js` | `1-149`, `331-517`, `628-759` | Canonical taxonomy, consent/privacy gate, adapter batching, rollout resolution и health/read-back contract |
| `src/analytics/collector.js` | `1-372` | Local aggregate analytics summary, mirrored rollout snapshot и stale-reason computation |
| `src/analytics/funnel.js` | `1-259` | Player funnel + analytics adoption milestones и review/manual-smoke freshness |
| `src/flags/flags.js` | `1-223` | Runtime flags для remote analytics, limited-event default, canary и read-back verification |
| `src/experiments/experiments.js` | `1-343` | Sticky canary assignment и analytics rollout state (`control`, `matomo_primary`, `dual_write`) |

## Privacy contract
- First-party local debug storage (`TelemetryLogger` ring buffer + `AnalyticsCollector` summary) всегда доступен для diagnostics.
- Remote adapters consent-gated:
  - `unknown` или `denied` => remote ingest выключен.
  - `limited` => наружу уходят только события с `limitedByDefault=true`.
  - `full` => действуют те же rollout rules, но оператор может расширить набор событий флагами.
- Consent хранится только в telemetry storage и читается через `Game.TelemetryLogger.getConsent()` / `setConsent(...)`.

## Canonical event taxonomy
- Registry живёт в `EVENT_TAXONOMY` и `Game.TelemetryLogger.getTaxonomy()`.
- Limited-by-default events: `session_start`, `session_resume`, `buyTank`, `merge`, `lessonComplete`, `funnelStep`, `conversion`, `retentionReturn`, `experimentAssign`, `analyticsRolloutStep`, `analyticsReadBack`, `analyticsManualSmoke`, `analyticsWeeklyReview`.
- Local-heavy events: `zombieKill`, `shotFired`, `bugReportCreate`.
- Незарегистрированное событие остаётся `local_only`, пока taxonomy не обновлена явно.

## Rollout seam
- `Game.Flags.getAnalyticsSnapshot()` собирает effective state для `tmzdAnalyticsEnabled`, `tmzdAnalyticsLimitedEvents`, `tmzdAnalyticsMatomoEnabled`, `tmzdAnalyticsPostHogEnabled`, `tmzdAnalyticsCanary`, `tmzdAnalyticsReadBack`.
- `Game.Experiments.getAnalyticsRolloutState()` резолвит sticky `tmzd_analytics_rollout` и только при включённом `tmzdAnalyticsCanary` переключает rollout в canary mode (`matomo_primary` / `dual_write`).
- `Game.TelemetryLogger.getRolloutState()` композит flags + experiment: без `tmzdAnalyticsEnabled` remote ingest остаётся `off`; default limited-event mode остаётся `on`; Matomo — primary, PostHog — secondary.
- `noteFunnelRolloutState()` синхронизирует adoption milestones `taxonomy_registered`, `matomo_primary_live`, `posthog_secondary_live`, а `syncCollectorSnapshot()` зеркалит `getHealthSnapshot()` в `Game.AnalyticsCollector.setAnalyticsRollout(...)`.

## Adapter layer
- `Game.TelemetryLogger.configureAdapter(name, options)` конфигурирует endpoint / transport / batch size для `matomo` и `posthog`.
- Batching contract:
  - queue cap: `120` envelopes на adapter;
  - batch size: до `24` events;
  - drain interval: `5000ms`;
  - synchronous network calls из gameplay code запрещены.
- Если endpoint/transport не сконфигурирован, adapter delivery остаётся `dry_run`, но health snapshot всё равно держит pending/read-back state для rollout verification.

## Collector / adoption snapshots
- `Game.AnalyticsCollector.setAnalyticsRollout(...)` хранит taxonomy, consent, rollout, adapters, verification и stale snapshot в local summary.
- `Game.AnalyticsCollector.markVerification(...)` обновляет `read_back`, `manual_smoke`, `weekly_review` и пересчитывает stale reasons (`weekly_review_stale`, `manual_smoke_stale`, `read_back_stale`, `*_batch_stale`).
- `Game.Funnel.trackAnalyticsStep(...)` и sugar-хелперы `markManualSmoke()`, `markWeeklyReview()`, `markReadBack()` держат analytics adoption funnel отдельно от gameplay funnel.
- `Game.Funnel.getAnalyticsAdoptionSnapshot()` показывает adoption milestones и 7-day stale status для `weekly_review` / `manual_smoke`; read-back stale считается canonical в `TelemetryLogger`/`AnalyticsCollector`, а не в adoption snapshot.

## Read-back and stale detection
- `Game.TelemetryLogger.markAdapterReadBack(name, payload)` записывает backend acknowledgment или operator read-back и одновременно обновляет Funnel + Collector.
- `Game.TelemetryLogger.markManualSmoke(payload)` и `markWeeklyReview(payload)` записывают operator verification checkpoints и тоже fan-out'ятся в Funnel + Collector.
- `Game.TelemetryLogger.getHealthSnapshot()` возвращает:
  - consent state;
  - effective rollout state;
  - adapter queues/status/read-back timestamps;
  - verification timestamps для read-back/manual smoke/weekly review;
  - stale reasons.
- Stale windows:
  - batch stale: `10m`;
  - read-back stale: `20m`;
  - weekly review/manual smoke stale: `7d`.

## Operator verification path
1. Включи rollout через flags и, если нужен canary path, через `tmzd_analytics_rollout` experiment.
2. Проверь `Game.TelemetryLogger.getHealthSnapshot()`: expected primary/secondary adapters, queue sizes и `readBackEnabled`.
3. Прогони limited taxonomy event вроде `merge` или `buyTank`.
4. После backend confirmation или dry-run verification вызови `markAdapterReadBack(...)`.
5. Запиши `markManualSmoke(...)` для текущего smoke scenario и `markWeeklyReview(...)` для weekly adoption review.
6. В `.agents` services/control-center surface используй `quality_os.tmzd_analytics` / top-level `tmzd_analytics`, чтобы увидеть source checks, stale review windows и recent matched sessions.

## Rules
- Любое новое событие добавляется в taxonomy registry и документируется здесь в том же change.
- Не смешивай debug-only noise с rollout signals, предназначенными для Matomo/PostHog adapters.
- Retention/cleanup должны оставаться согласованными с `ops/monitoring/telemetry_retention.js`.
