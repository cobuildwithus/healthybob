# Testing And CI Map

Last verified: 2026-03-12

## Current Bootstrap Checks

| Command | Purpose | Current coverage |
| --- | --- | --- |
| `pnpm typecheck` | Shell syntax validation for repo wrappers/config. | `scripts/*.sh` |
| `pnpm test` | Agent-docs drift and required-file integrity. | `AGENTS.md`, `ARCHITECTURE.md`, `agent-docs/**` |
| `pnpm test:coverage` | Doc inventory and doc-gardening enforcement. | `agent-docs/**`, `ARCHITECTURE.md`, `README.md` |

## Current Gaps

- No product/runtime test harness exists yet.
- No CI workflow files exist yet.
- No build or packaging lane exists beyond bootstrap docs/process validation.

## Update Rule

When real source code, CI, or deployment automation is added, update this file and `agent-docs/operations/verification-and-runtime.md` in the same change.
