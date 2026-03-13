Goal (incl. success criteria):
- Land a usable `vault-cli inbox ...` setup and operations surface that makes `@healthybob/inboxd` operable for humans without folding machine-local daemon state into the canonical vault.
- Cover the first operational slice end-to-end: runtime init, source add/list/remove, doctor, backfill, run/status/stop, and inbox capture list/show/search, plus the safest promotion path available under current ownership constraints.
- Keep the CLI thin by routing inbox behavior through a dedicated inbox service layer that lazy-loads `@healthybob/inboxd` and other package boundaries.

Constraints/Assumptions:
- Do not edit files or symbols owned by other active rows, especially `packages/cli/src/vault-cli-services.ts`, `packages/cli/test/runtime.test.ts`, `README.md`, `docs/contracts/03-command-surface.md`, and `packages/core/src/mutations.ts`.
- Never read `.env*` files or surface personal identifiers in code, docs, test fixtures, or command output.
- Canonical inbox evidence stays under `raw/inbox/**`, `ledger/events/**`, and `audit/**`; machine-local config/state lives under `.runtime/**`.
- Current repo command-surface smoke coverage is driven by `docs/contracts/03-command-surface.md`, which is currently owned by another active row, so any unavoidable contract-doc follow-up must be called out rather than forced through an ownership conflict.

Key decisions:
- Store inbox runtime config at `<vault>/.runtime/inboxd/config.json`, SQLite state at `<vault>/.runtime/inboxd.sqlite`, daemon state at `<vault>/.runtime/inboxd/state.json`, and promotion history at `<vault>/.runtime/inboxd/promotions.json`.
- Add a new inbox-specific CLI service module instead of extending the currently-owned shared CLI service file.
- Register the inbox command group directly from `vault-cli.ts` and keep its contracts in a separate inbox-specific schema module.
- Support `imessage` as the first connector family with explicit doctor checks and an injected driver boundary for tests.
- Normalize omitted iMessage `accountId` values to `self` so connector ids remain stable runtime identities instead of source-wide wildcards.
- Implement canonical promotion only where an existing safe package boundary exists immediately; do not bypass ownership or write rules to fake unsupported canonical promotion flows.

State:
- completed

Done:
- Read repo routing docs, verification workflow, inboxd package surface, CLI structure, and active ownership rows.
- Implemented `vault-cli inbox` init/source/doctor/backfill/run/status/stop/list/show/search/promote commands through a dedicated inbox service layer and schema module.
- Added focused inbox tests covering happy paths plus daemon-state, corruption, doctor, backfill, promotion, and default-account edge cases.
- Updated allowed architecture/verification/docs/package wiring so `@healthybob/inboxd` participates in the workspace build/test surface.
- Marked deferred `journal` and `experiment-note` promotion commands as explicit placeholders in CLI help instead of presenting them as silently supported.
- Ran focused verification successfully:
- `pnpm --dir packages/contracts build && pnpm --dir packages/core build && pnpm --dir packages/inboxd build`
- focused inbox `tsc` on the new inbox source/test files
- `pnpm exec vitest run packages/cli/test/inbox-cli.test.ts packages/cli/test/inbox-incur-smoke.test.ts --no-coverage --maxWorkers 1`
- Ran required repo checks and confirmed failures are outside this slice:
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:coverage`
- All three currently fail because `packages/query/src/search-sqlite.ts` does not typecheck/build in another active lane.

Now:
- Remove the active coordination row, commit the scoped inbox files, and hand off with verification and audit notes.

Next:
- Follow up later when ownership permits to document the inbox command surface in the frozen contract docs and implement additional canonical promotion targets.

Open questions (UNCONFIRMED if needed):
- UNCONFIRMED: Whether the currently-owned command-surface contract doc will be free soon enough to document the new inbox commands in the frozen surface without conflicting with the active retrieval lane.
- UNCONFIRMED: Whether future canonical `journal` and `experiment-note` promotion boundaries should land in `@healthybob/core` or in a new shared package once ownership opens up.

Working set (files/ids/commands):
- `agent-docs/exec-plans/active/COORDINATION_LEDGER.md`
- `agent-docs/exec-plans/active/2026-03-13-inbox-cli-ops.md`
- `agent-docs/index.md`
- `packages/cli/src/commands/inbox.ts`
- `packages/cli/src/inbox-cli-contracts.ts`
- `packages/cli/src/inbox-services.ts`
- `packages/cli/test/inbox-cli.test.ts`
- `packages/cli/test/inbox-incur-smoke.test.ts`
- `packages/cli/src/vault-cli.ts`
- `packages/cli/src/index.ts`
- `packages/cli/package.json`
- `packages/cli/tsconfig.json`
- `vitest.config.ts`
- `packages/inboxd/package.json`
- `packages/inboxd/README.md`
- `ARCHITECTURE.md`
- `agent-docs/references/testing-ci-map.md`
- `agent-docs/operations/verification-and-runtime.md`
- `package.json`
Status: completed
Updated: 2026-03-13
Completed: 2026-03-13
