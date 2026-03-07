# Copilot Instructions — Tank Merge Zombie Defense

## Project Overview

Browser-based 2D HTML5 Canvas game (tower-defense + merge mechanic). No build step,
no npm — pure vanilla JS + HTML + CSS. Entry point: `index.html` → `game.js`.

## Architecture

| Layer | Location |
|---|---|
| Bootstrap / game loop | `game.js` (~9 500 lines), `src/core/bootstrap.js` |
| Runtime tasks / RAF | `src/core/runtimeTasks.js` |
| World reset | `src/core/worldReset.js` |
| Game mechanics | `src/mechanics/*` (combat, economy, zombieSpawn, garage, drones, …) |
| Rendering / input | `src/render/*`, `src/ui/*` |
| Persistence / offline | `src/persistence/*` |
| Talents v2 | `src/systems/talents/talentsV2.js` (`Game.TalentsV2`) |
| Audio | `src/audio/*` |
| i18n | `src/i18n/ru.json` + `src/i18n/en.json` |
| Config | `src/config/layoutTuning.js`, `assets/balance/talentTree_v2.json`, `assets/*.json` |

**Global API:** `window.Game.*` — all modules register here.

**Module pattern:** IIFE + `'use strict'` + `global.Game.*`. See any file in `src/` for canonical example.

**Rule:** new logic goes in `src/*`, **never directly in `game.js`**.
`game.js` contains inline fallbacks for key modules — the `src/` module is always canonical.

## Build & Test

```bash
# Style check (trailing whitespace in .js/.css/.html/.md/.sh)
bash ci/check_style.sh

# Run all tests (plain Node.js, no framework)
bash ci/run_tests.sh

# Pre-release checklist
bash ci/release_checklist.sh
```

Individual test files can be run directly:
```bash
node Test/tests.js
node Test/pack1/fireLogic.test.js
```

There is **no npm, no bundler**. Do not add `package.json` or a build pipeline.

## Code Style

- Only `const`/`let` — no `var`.
- No trailing whitespace (enforced by `ci/check_style.sh`).
- Hot-path functions (`loop`, `draw`, `step*`) — **no heap allocations**.
- `draw()` functions only draw — no state mutations.
- All user-visible strings in `src/i18n/ru.json` **and** `src/i18n/en.json` simultaneously.
- Semantic HTML: `<button>` for interactive elements; dialogs need `role="dialog" aria-modal="true"`.
- See [docs/CODE_STYLE.md](docs/CODE_STYLE.md) and [docs/ai/STYLE.md](docs/ai/STYLE.md).

## Canonical AI Docs (read before touching a system)

| Topic | File |
|---|---|
| Agent index & reading order | [docs/ai/INDEX.md](docs/ai/INDEX.md) |
| Architecture overview | [docs/ai/ARCHITECTURE.md](docs/ai/ARCHITECTURE.md) |
| UI system | [docs/ai/SYSTEMS/ui.md](docs/ai/SYSTEMS/ui.md) |
| Rendering / Canvas | [docs/ai/SYSTEMS/render.md](docs/ai/SYSTEMS/render.md) |
| Combat | [docs/ai/SYSTEMS/combat.md](docs/ai/SYSTEMS/combat.md) |
| Save / Offline | [docs/ai/SYSTEMS/save.md](docs/ai/SYSTEMS/save.md) |
| Fence | [docs/ai/SYSTEMS/fence.md](docs/ai/SYSTEMS/fence.md) |
| Input | [docs/ai/SYSTEMS/input.md](docs/ai/SYSTEMS/input.md) |
| Performance | [docs/ai/SYSTEMS/perf.md](docs/ai/SYSTEMS/perf.md) |
| Talents v2 runtime | [docs/talents_v2.md](docs/talents_v2.md) |
| Talents v2 UI | [docs/ui_talents_v2.md](docs/ui_talents_v2.md) |
| game.js function map | [docs/ai/GAME_JS_MAP.md](docs/ai/GAME_JS_MAP.md) |

## Key Conventions

- **Talent gating:** row-gating `3-3-3-3-2-2-1`, rows unlock at spent `[0,5,10,15,20,25,30]` per branch; prereq ≥ rank 1 from previous row. See `assets/balance/talentTree_v2.json`.
- **Render order:** `fenceBase → zombies/corpses → fenceHpBars → projectiles/effects`.
- **Drag threshold:** 6 px on canvas `pointermove` to distinguish tap vs drag.
- **Partial reset** preserves talents/upgrades/drones/achievements; resets walls, tank prices, attackMode runtime.
- **AttackMode spawn:** 3 fixed episode directions, distribution 50/25/25%.
- **Chip modifiers:** 14 types defined in `assets/chips.json`; logic in `src/mechanics/chipEffects.js`.
- **`dist/release/staging/`** — never edit manually.
- **Talent v2 save migration:** triggered when `talentsVersion < 2`; canonical map in `src/systems/talents/talentsV2.js`.

## Playbooks (common tasks)

- Add UI widget: [docs/ai/PLAYBOOKS/add-ui-widget.md](docs/ai/PLAYBOOKS/add-ui-widget.md)
- Change combat balance: [docs/ai/PLAYBOOKS/change-combat-balance.md](docs/ai/PLAYBOOKS/change-combat-balance.md)
- Add asset variant: [docs/ai/PLAYBOOKS/add-asset-variant.md](docs/ai/PLAYBOOKS/add-asset-variant.md)
- Debug lag: [docs/ai/PLAYBOOKS/debug-lag.md](docs/ai/PLAYBOOKS/debug-lag.md)
- Change input control: [docs/ai/PLAYBOOKS/change-input-control.md](docs/ai/PLAYBOOKS/change-input-control.md)

---

## Agent System & AI Workflow

All agents and skills live in **`c:\Users\hisok\.agents\.github\`** — a separate workspace
folder that is **not part of the game repository**.

### Agent entry points

| Agent | File | Purpose |
|---|---|---|
| Programmer | `agents/Programmer.md` | Routes tasks → UX-Designer or Fullstack-Developer skills |
| Log-Writer | `agents/Log-Writer.md` | Delegates to `session-logger` skill after task is done |
| Spec-Refiner | `agents/Spec-Refiner.md` | Improves informal TZ before passing to pipeline |

### Skills

| Skill | Path | Purpose |
|---|---|---|
| session-logger | `skills/session-logger/SKILL.md` | Logs completed sessions to JSONL + DuckDB |
| fullstack-developer | `skills/fullstack-developer/SKILL.md` | Implements code tasks end-to-end |
| ux-designer | `skills/ux-designer/SKILL.md` | Produces UX specs, wireframes, flows |
| spec-refiner | `skills/spec-refiner/SKILL.md` | Converts informal TZ to structured spec |

### Session Logger

Logs are stored in **`D:\agent-logs\`**:

```
D:\agent-logs\
  sessions.jsonl            ← master append-only log
  sessions.duckdb           ← queryable DB (rebuilt from JSONL)
  backups\                  ← daily backups (14-day retention)
  YYYY\MM\DD\<session_id>\  ← per-session JSON files
```

**Dashboard** — local web UI for browsing, filtering and managing logs:

```powershell
# Start the dashboard (port 8777)
& d:\Tank-Merge-Zombie-Defense\.venv\Scripts\python.exe `
  c:\Users\hisok\.agents\.github\skills\session-logger\scripts\dashboard.py --open

# Full rebuild of DuckDB from JSONL
& d:\Tank-Merge-Zombie-Defense\.venv\Scripts\python.exe `
  c:\Users\hisok\.agents\.github\skills\session-logger\scripts\sync_to_duckdb.py `
  --log-root "D:\agent-logs" --full-rebuild
```

Dashboard features:
- Rating trend & duration charts (Chart.js)
- Full-text search across `spec_raw`
- Session comparison (diff view)
- Rating editing from UI
- Manual & auto backups (daily, 14-day retention)
- CSV / Parquet / DuckDB download
- **Session deletion** with 2-step confirmation (type `DELETE` to confirm)

**Write a log** after completing a session — call `session-logger` skill or use the script:

```powershell
& d:\Tank-Merge-Zombie-Defense\.venv\Scripts\python.exe `
  c:\Users\hisok\.agents\.github\skills\session-logger\scripts\write_session_log.py `
  --json-file path\to\payload.json
```

Payload schema: see `skills/session-logger/payload.json` for a full example.

### When to call agents

- **Start of any non-trivial task** → call `Spec-Refiner` to structure the TZ first.
- **Multi-step implementation** → call `TZ-Orchestrator` to decompose, then `Implementer` per step.
- **After completing a task** → call `Log-Writer` / `session-logger` to record the session.
- **Code review before commit** → call `Code-Reviewer` or `Verifier`.
