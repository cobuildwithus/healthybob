# Testing And CI Map

Last verified: 2026-03-12

## Current Repo Checks

| Command | Purpose | Current coverage |
| --- | --- | --- |
| `pnpm typecheck` | Shell syntax validation, smoke-verifier syntax checks, contract artifact verification, and JS package syntax checks. | `scripts/*.sh`, `e2e/smoke/verify-fixtures.mjs`, `packages/contracts/**`, `packages/core/**`, `packages/importers/**`, `packages/query/**` |
| `pnpm test` | Agent-docs drift checks plus executable package-runtime tests and fixture/scenario integrity validation. | `AGENTS.md`, `ARCHITECTURE.md`, `agent-docs/**`, `packages/contracts/**`, `packages/core/**`, `packages/importers/**`, `packages/query/**`, `fixtures/**`, `e2e/smoke/scenarios/**` |
| `pnpm test:coverage` | Doc inventory/doc-gardening enforcement plus package-runtime tests and command-surface smoke coverage. | `agent-docs/**`, `ARCHITECTURE.md`, `README.md`, `docs/contracts/03-command-surface.md`, `packages/contracts/**`, `packages/core/**`, `packages/importers/**`, `packages/query/**`, `fixtures/**`, `e2e/smoke/**` |
| `pnpm test:packages` | Direct runtime verification for executable packages without the worktree-sensitive doc-drift wrapper. | `packages/contracts/**`, `packages/core/**`, `packages/importers/**`, `packages/query/**` |
| `pnpm test:smoke` | Standalone fixture/scenario integrity verification. | `fixtures/**`, `e2e/smoke/**`, `docs/contracts/03-command-surface.md` |

## Current Gaps

- Repo-level automation does not execute `vault-cli`; the CLI source is wired, but this workspace does not currently provide the `incur` dependency/toolchain needed to run or typecheck the TypeScript CLI package.
- Fixture smoke still validates manifests and command-surface coverage, not end-to-end package orchestration.
- No CI workflow files exist yet.

## Update Rule

When real source code, CI, or deployment automation is added, update this file and `agent-docs/operations/verification-and-runtime.md` in the same change.
