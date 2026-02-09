# Contributing

Thanks for helping improve Tank Merge: Zombie Defense. This repo is a browser game with lightweight tooling and no external build step.

## Quick start

- Open index.html in a browser for a quick smoke test.
- Optional: serve locally with `npx serve .` and open http://localhost:3000.

## Project layout

- game.js: main gameplay loop, rendering, and UI glue.
- src/: modules grouped by feature (mechanics, ui, perf, tools).
- Test/: lightweight Node-based tests for packs.
- assets/: sprites and JSON configs.

## Local checks

Run these before opening a PR:

- Style check: `bash ci/check_style.sh`
- Tests: `bash ci/run_tests.sh`
- Release checklist: `bash ci/release_checklist.sh`

## Localization

- Strings live in src/i18n/ru.json and src/i18n/en.json.
- Keep keys consistent across languages.
- Use data-i18n in HTML and Game.I18n.t() in JS.

## Performance

- Avoid heavy dependencies.
- Prefer pooling for high-churn objects.
- Measure regressions with Test/pack5/perf_regression.test.js.

## Pull request expectations

- Keep changes scoped and documented.
- Add or update tests for behavior changes.
- Update docs when changing UX, APIs, or flows.
