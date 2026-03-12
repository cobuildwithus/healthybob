# Fix review-found runtime bugs with worker batch

Status: completed
Created: 2026-03-12
Updated: 2026-03-12

## Goal

- Fix the review-found Healthy Bob runtime bugs using local `codex-workers`, then integrate the resulting diffs into one verified change set.

## Success criteria

- Photo-only meals succeed without schema validation failures.
- Experiment creation behavior is explicitly idempotent or the CLI/contract is updated to match shipped behavior.
- `validateVault()` returns structured issues for malformed journal/experiment frontmatter instead of throwing.
- The CLI package is buildable enough for truthful repo verification and uses package boundaries rather than `../../src` imports.
- CLI/query contracts stop surfacing misleading non-queryable IDs, or the read path supports them explicitly.
- Transform-record scope is made coherent: either implemented canonically or removed from the frozen baseline.
- Export packs improve toward the intended GPT question-pack shape without mutating canonical data.

## Scope

- `packages/contracts/**`
- `packages/core/**`
- `packages/importers/**`
- `packages/query/**`
- `packages/cli/**`
- root verification/package wiring docs and scripts as needed
- fixtures/e2e/docs required to keep the baseline truthful

## Constraints

- Follow `AGENTS.md` hard rules and keep `COORDINATION_LEDGER.md` current.
- Use workspace `codex-workers` with `--profile 1`.
- Keep worker write scopes disjoint; parent owns only plan/ledger/orchestration until integration.
- Do not access `.env` files.

## Worker lanes

1. `codex-worker-core-contracts`
   - `packages/core/**`, `packages/contracts/**`
   - fix meal/photo schema mismatch, experiment idempotence, validation issue accumulation, transform baseline coherence
2. `codex-worker-query-export`
   - `packages/query/**`
   - fix query semantics, canonical lookup behavior, export-pack improvements, query tests
3. `codex-worker-cli-build`
   - `packages/cli/**`
   - make CLI build/package wiring coherent and remove source-layout boundary violations
4. `codex-worker-integration`
   - downstream seam reconciliation, root package/docs/verification wiring, fixtures/e2e alignment, final contract/doc normalization

## Tasks

1. Record plan + ledger ownership.
2. Generate one worker prompt per lane.
3. Launch source lanes in parallel through `workspace-docs/bin/codex-workers --profile 1`.
4. Review completed lane outputs and update ledger status.
5. Launch a downstream integration worker once source lanes finish.
6. Run required verification, completion audits, and commit the resulting fixes.

## Verification

- Source lanes: narrow truthful package checks
- Final lane:
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm test:coverage`
Completed: 2026-03-12
