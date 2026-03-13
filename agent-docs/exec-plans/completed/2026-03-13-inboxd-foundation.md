Goal (incl. success criteria):
- Land a clean `@healthybob/inboxd` foundation that treats inbound messages as neutral captures first, persists canonical raw evidence into the vault, and maintains rebuildable local runtime/index state in SQLite.
- Keep the package source-agnostic at the boundary with connector contracts that support both polling and webhooks, with iMessage as the first poll-based connector.
- Cover the initial runtime with focused tests for dedupe, persistence, cursor handling, FTS search, and iMessage normalization.

Constraints/Assumptions:
- Do not edit files owned by the active contracts, CLI, retrieval, storage-spine, or doc-verification lanes.
- Canonical vault writes must remain file-native and reversible; SQLite is runtime state only.
- Avoid inventing new frozen contract enums while `packages/contracts/**` is actively owned; reuse existing event/audit shapes where needed.
- `vault-cli` wiring, package-root script updates, and owned docs may need to remain deferred if the corresponding files stay claimed during this turn.
- Because this touches production code and tests, run completion-workflow audit passes before final verification.

Key decisions:
- Model all ingress sources through `BaseConnector`, `PollConnector`, and `WebhookConnector`.
- Normalize source messages into a single `InboundCapture` + `InboundAttachment` envelope before any storage write.
- Persist `envelope.json` plus copied attachments under `raw/inbox/<source>/...` so SQLite is always rebuildable from vault state.
- Use one runtime DB at `<vault>/.runtime/inboxd.sqlite` with WAL mode, dedupe tables, cursor state, attachment rows, and FTS5.
- Represent canonical vault events as existing contract-compatible `note` events tagged for inbox capture until a dedicated contract lane is free.

State:
- in_progress

Done:
- Reviewed repo instructions, architecture, reliability/security docs, verification workflow, and active ownership rows.
- Reviewed the final inbox plan and identified an ownership-safe implementation boundary centered on a new package plus workspace TS wiring.
- Chose the minimal conflict strategy: implement the package thoroughly now and avoid owned CLI/contracts/docs files.

Now:
- Scaffold `packages/inboxd` package structure, connector contracts, SQLite runtime, vault persistence, and `processCapture()`.
- Add an iMessage connector/normalizer that can backfill and watch through an injected driver boundary.
- Add focused inbox package tests and wire the package into TypeScript project references/paths.

Next:
- Run simplify, coverage audit, required verification, then remove the active ledger row and commit the scoped changes.
- If owned CLI integration files remain locked, hand off the package-ready seams and the exact follow-up needed to register `vault-cli inbox ...`.

Open questions (UNCONFIRMED if needed):
- UNCONFIRMED: Whether the maintained lanes that currently own `packages/cli/**`, `package.json`, and verification docs will clear during this turn, allowing direct CLI registration.
- UNCONFIRMED: Whether the target runtime environment will permit `better-sqlite3`; if not, the package may need a driver swap after the foundational model lands.

Working set (files/ids/commands):
- `agent-docs/exec-plans/active/COORDINATION_LEDGER.md`
- `agent-docs/exec-plans/active/2026-03-13-inboxd-foundation.md`
- `packages/inboxd/**`
- `tsconfig.base.json`
- `tsconfig.json`
- Commands: `pnpm exec vitest run packages/inboxd/test/inboxd.test.ts --no-coverage`, `pnpm typecheck`, `pnpm test`, `pnpm test:coverage`
Status: completed
Updated: 2026-03-12
Completed: 2026-03-12
