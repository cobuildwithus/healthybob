# Healthy Bob vault baseline worker batch

Status: completed
Created: 2026-03-12
Updated: 2026-03-12

## Goal

- Establish the bootstrap contract fence for the Healthy Bob vault baseline, then execute the six implementation tracks from the approved migration plan in parallel with a final integration lane staged behind them.

## Success criteria

- The repo contains the frozen bootstrap scaffold required by the migration plan.
- Active ownership for the parent lane and each worker lane is recorded in `COORDINATION_LEDGER.md` before code edits begin.
- Six implementation worker prompts are launched in parallel through the workspace `codex-workers` helper.
- The integration lane is rerun against the completed worker tree and reconciles package seams without boundary drift.

## Scope

- In scope:
  - bootstrap repo skeleton and contract fence
  - worker-lane planning, prompt generation, and launch orchestration
  - implementation across `packages/contracts`, `packages/core`, `packages/cli`, `packages/importers`, `packages/query`, fixtures/e2e/docs/packaging
  - integration follow-up after worker outputs exist
- Out of scope:
  - product features outside the approved first-release scope
  - OCR, semantic search, vector databases, SQLite canonical storage, or chat-session persistence inside the vault

## Constraints

- Follow `AGENTS.md` hard rules, especially the coordination-ledger gate.
- Do not access `.env` files.
- Only `packages/core` may own canonical write-path mutations.
- Workers must keep file ownership disjoint and update their ledger rows if scope changes.
- The first non-doc code wave must update runtime and verification docs truthfully.

## Worker lanes

1. `codex-parent-bootstrap`
   - bootstrap fence, shared docs, root workspace config, worker orchestration
2. `codex-worker-contracts`
   - contracts docs and `packages/contracts/**`
3. `codex-worker-core`
   - `packages/core/**`
4. `codex-worker-cli`
   - `packages/cli/**` and command-surface contract doc
5. `codex-worker-importers`
   - `packages/importers/**`
6. `codex-worker-query-export`
   - `packages/query/**`
7. `codex-worker-qa-release`
   - `fixtures/**`, `e2e/**`, README, packaging/verification docs, CI scaffolding if needed
8. `codex-worker-integration`
   - final wiring, boundary reconciliation, smoke-flow normalization, safe-extension guide

## Tasks

1. Create the active plan and ledger reservations.
2. Add the bootstrap scaffold and freeze package names, layout, and the `vault-cli` namespace.
3. Verify the bootstrap commit and commit it separately.
4. Generate one prompt file per worker lane with explicit ownership and guardrails.
5. Launch the six implementation lanes in parallel through `workspace-docs/bin/codex-workers`.
6. Stage the integration lane against the frozen contracts and worker outputs without colliding on active ownership.
7. Monitor run artifacts and summarize launch state plus any blockers.
8. Re-run integration after the source lanes finish, then execute final repo-owner verification and commit flow.

## Decisions

- Use workspace-local `codex-workers` because the user explicitly asked for the documented parallel local-worker flow.
- Treat the integration lane as downstream of the six implementation lanes even if the prompt is launched early; it must not edit worker-owned files until scopes are free.
- Freeze the package names as `@healthybob/contracts`, `@healthybob/core`, `@healthybob/cli`, `@healthybob/importers`, and `@healthybob/query`.

## Verification

- Bootstrap phase:
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm test:coverage`
- Implementation phase:
  - workers run the narrowest truthful checks for their owned scope plus any updated repo-wide checks they introduce

## Progress

- Done:
  - bootstrap contract fence committed
  - codex-1 worker prompts generated under `workspace-docs/codex-worker-prompts/2026-03-12-healthybob-vault-baseline/`
  - contracts, core, cli, importers, query/export, qa/release, and first integration pass completed
  - second integration pass completed with cross-package seam reconciliation
- Now:
  - repo-owner verification and final cleanup
- Next:
  - close the active plan and clear the coordination ledger once verification and commit complete
Completed: 2026-03-12
