# Runtime-state cutover for inboxd and CLI

Status: completed
Created: 2026-03-13
Updated: 2026-03-13

## Goal

- Finish the shared runtime-state cutover so inboxd, the inbox CLI, and query all use the same `.runtime` path resolver and SQLite open helpers, with the old inbox-search fallback removed.

## Success criteria

- `packages/inboxd` opens its runtime database via `resolveRuntimePaths()` and `openSqliteRuntimeDatabase()`.
- `packages/cli` stops maintaining its own inbox runtime path resolver and reads inbox runtime paths from `@healthybob/runtime-state`.
- `packages/query` no longer falls back to the inbox database for search status/search reads.
- Tests, docs, and package manifests/project references reflect the shared runtime-state ownership.

## Scope

- In scope:
- runtime path/database helper cutover in `packages/inboxd`, `packages/cli`, and `packages/query`
- inbox/query tests that cover the new runtime-state ownership
- package dependency/reference updates and any matching architecture/runtime doc updates
- Out of scope:
- inbox schema redesign
- new migration framework beyond the current inbox-local helper
- changes to canonical vault storage

## Constraints

- Work on top of the current dirty tree and preserve adjacent edits.
- User explicitly approved building on top of overlapping in-flight changes in the inboxd/CLI files.
- Keep inbox-specific schema migration helpers local unless a shared abstraction is clearly justified by the code touched here.

## Tasks

1. Record shared ownership in the coordination ledger and keep it current.
2. Move inboxd runtime DB open/transaction usage onto `@healthybob/runtime-state`.
3. Replace CLI `resolveInboxPaths()` with `resolveRuntimePaths()`.
4. Remove the query legacy inbox-search fallback and update tests/docs.
5. Run simplify, coverage audit, final review, required verification, remove the ledger row, and commit scoped files.
Completed: 2026-03-13

## Outcome

- Done: inboxd now opens `inboxd.sqlite` through `resolveRuntimePaths()` and `openSqliteRuntimeDatabase()`, while keeping inbox-specific schema migration helpers local to inboxd.
- Done: the inbox CLI now uses `RuntimePaths` from `@healthybob/runtime-state` instead of maintaining its own `.runtime` path resolver.
- Done: query search status/search reads no longer fall back to `inboxd.sqlite`; the canonical search runtime database is now the only SQLite search location.
- Done: inboxd/query tests cover the shared runtime path ownership and the removed inbox-search fallback; CLI tests were updated for the new search behavior and runtime path helper names.
- Done: architecture/runtime/package docs now describe shared runtime-state ownership for inboxd, CLI, and query.

## Verification

- Passed: `pnpm --dir packages/query test`
- Passed: `pnpm --dir packages/inboxd test`
- Failed for pre-existing unrelated reasons:
- `pnpm --dir packages/cli typecheck` still fails in unrelated active-lane CLI command files (`packages/cli/src/commands/experiment.ts`, `packages/cli/src/commands/journal.ts`, `packages/cli/src/commands/vault.ts`, `packages/cli/src/commands/samples-audit-read-helpers.ts`).
- `pnpm exec vitest run packages/cli/test/inbox-cli.test.ts packages/cli/test/search-runtime.test.ts --no-coverage --maxWorkers 1` still fails because `packages/core/src/mutations.ts` currently throws `ReferenceError: WriteBatch is not defined` during meal creation and because other active CLI runtime changes leave retrieval setup red.
- `pnpm typecheck`, `pnpm test`, and `pnpm test:coverage` still fail for pre-existing blockers in unrelated active lanes, including `packages/cli/src/commands/{document,experiment,journal,meal,vault}.ts` and `packages/contracts/scripts/{generate-json-schema,verify}.ts`.
