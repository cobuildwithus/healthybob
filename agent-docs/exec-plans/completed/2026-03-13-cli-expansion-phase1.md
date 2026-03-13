Goal (incl. success criteria):
- Implement the highest-yield vault-facing CLI expansion ideas that fit the current architecture without colliding with active owned lanes.
- Land new first-class read/follow-up commands for unowned nouns, expose importer/core metadata options that already exist underneath the CLI, and update docs/tests/smoke coverage so the expanded surface is truthful.

Constraints/Assumptions:
- Do not edit files or symbols owned by other active coordination-ledger rows, especially `packages/cli/src/vault-cli-services.ts`, `packages/cli/src/vault-cli-contracts.ts`, `packages/cli/src/commands/read.ts`, `packages/cli/src/commands/intake.ts`, and `packages/cli/src/commands/health-command-factory.ts`.
- Keep changes CLI-local where possible; avoid inventing new canonical storage behavior when the user-requested win is command-surface reach.
- Preserve the existing package boundary rule: command handlers may delegate into core/importers/query or read canonical vault files, but must not write vault files directly.

Key decisions:
- Focus this turn on unowned command groups with strong leverage: `document`, `meal`, `samples`, `experiment`, `journal`, `vault`, and a new `audit` noun.
- Implement follow-up/show/list/manifest behavior via query/runtime helpers in new CLI-local modules instead of modifying the currently owned shared service layer.
- Defer provider/event generic write surfaces and generic-list/filter-parity changes that require edits in currently claimed files.

State:
- done

Done:
- Read repo routing docs, verification docs, completion workflow, and the active coordination ledger.
- Reviewed the contract docs, current CLI command surface, and the underlying core/importer/query capabilities.
- Identified a safe unowned scope that still captures several of the user's highest-value CLI expansion ideas.
- Landed first-class `vault`, `audit`, `document`, `meal`, `samples`, `experiment`, and `journal` follow-up read commands plus richer write/import options where the underlying runtime already supported them.
- Integrated the new command groups into the CLI entrypoint, added runtime coverage tests for each new slice, expanded the command-surface docs/README, and filled the smoke-scenario coverage gap for every documented command in scope.
- Ran scoped verification successfully: CLI typecheck/build, `packages/cli/test/runtime.test.ts`, and `e2e/smoke/verify-fixtures.ts --coverage`.
- Ran required completion-workflow audit passes locally; no additional actionable issues were found within the owned slice.

Now:
- Repo-wide required checks and commit/handoff.

Next:
- None.

Open questions (UNCONFIRMED if needed):
- UNCONFIRMED: Whether the currently active CLI cursor/intake lane will finish during this turn; until then, generic list/intake/service-file expansion stays out of scope.
- UNCONFIRMED: Whether export-pack follow-up commands can be added cleanly without touching the currently owned shared query service layer; revisit only if the unowned slices finish early.

Working set (files/ids/commands):
- `agent-docs/exec-plans/active/COORDINATION_LEDGER.md`
- `agent-docs/exec-plans/active/2026-03-13-cli-expansion-phase1.md`
- `packages/cli/src/vault-cli.ts`
- `packages/cli/src/runtime-import.ts`
- `packages/cli/src/query-runtime.ts`
- `packages/cli/src/commands/document.ts`
- `packages/cli/src/commands/meal.ts`
- `packages/cli/src/commands/samples.ts`
- `packages/cli/src/commands/experiment.ts`
- `packages/cli/src/commands/journal.ts`
- `packages/cli/src/commands/vault.ts`
- `packages/cli/src/commands/audit.ts`
- `packages/cli/src/commands/shared-read-helpers.ts`
- `packages/cli/test/**/*.test.ts`
- `docs/contracts/03-command-surface.md`
- `README.md`
- `e2e/smoke/scenarios/**`
- Commands: `pnpm typecheck`, `pnpm test`, `pnpm test:coverage`
Status: completed
Updated: 2026-03-13
Completed: 2026-03-13
