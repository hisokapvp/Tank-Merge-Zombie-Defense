# Phaser 3 Migration — Risk Register

> Создан: 2026-03-26. Обновлять при каждом milestone.

## Severity Scale
- **CRITICAL**: Блокирует release; потеря данных или gameplay-breaking
- **HIGH**: Значительное visual/behavioral regression
- **MEDIUM**: Заметное отличие, обходное решение есть
- **LOW**: Косметическое или edge-case

## Active Risks

| ID | Severity | Risk | Mitigation | Status |
|---|---|---|---|---|
| R-01 | CRITICAL | Save corruption при переключении engine | State остаётся plain JS; Phaser objects вне save payload; A/B validation saves | Open |
| R-02 | CRITICAL | Partial reset теряет прогресс под Phaser | worldReset.js не зависит от engine; тест-покрытие snapshot/restore | Open |
| R-03 | HIGH | Input coordinates расходятся (DPR, viewport transform) | Legacy Input path сохраняется до Phase 2; A/B сравнение hit positions | Open |
| R-04 | HIGH | Render order сломан в Phaser scene | Z-index через Phaser depth; visual comparison test per slice | Open |
| R-05 | HIGH | Performance деградация на mobile | Profiling branch в Wave B; Phaser batching validation | Open |
| R-06 | HIGH | Tutorial first-run state corrupted | Tutorial tests run under both engines before default switch | Open |
| R-07 | MEDIUM | Audio desync при pause/resume через Phaser | Audio manager остаётся вне Phaser scene; bridge only | Open |
| R-08 | MEDIUM | Drag threshold не соблюдается в Phaser Input | Explicit 6px threshold в Phaser input handler | Open |
| R-09 | MEDIUM | AttackMode spawn distribution drift | Distribution test (statistical, N=1000+) under both engines | Open |
| R-10 | MEDIUM | Canvas resize / DPR scaling incorrect | resizeCanvas() adapter; Phaser ScaleManager config | Open |
| R-11 | LOW | Phaser filesize (~1MB) увеличивает initial load | Conditional load (only when flag on); consider custom build later | Open |
| R-12 | LOW | i18n strings not synced after UI migration | Existing parity check in ci/check_style.sh | Open |

## Closed Risks

| ID | Resolution | Date |
|---|---|---|
| — | — | — |
