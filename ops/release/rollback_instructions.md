# Rollback Instructions

## When to rollback

- Crash rate increases, save/load failures, or data loss.
- Critical gameplay blockers discovered in live QA.
- Telemetry/logging causes storage or performance regressions.

## Steps

1. Identify the last known good release zip (archive or tag).
2. Redeploy the previous zip to the hosting location.
3. Verify the entry point loads (`index.html`) and basic gameplay works.
4. Clear any cached assets on the hosting layer/CDN if applicable.
5. Run `bash ops/release/post_release_checks.sh` on the rolled-back build.
6. Document the rollback in the release notes.

## Data safety

- Do not delete client `localStorage` data.
- Avoid schema changes without a backward-compat plan.

## Communication

- Notify QA and stakeholders about the rollback and reason.
- Track a follow-up task with root cause and fix plan.
