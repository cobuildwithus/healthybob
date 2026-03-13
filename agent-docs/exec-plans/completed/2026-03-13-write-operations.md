Goal (incl. success criteria):
- Introduce a real write-operation layer in `packages/core` that stages multi-file writes, persists operation metadata under `.runtime/operations/`, and commits or rolls back deterministically.
- Migrate the highest-risk canonical write flows so interrupted writes do not leave silent partial state, and surface unresolved operations through validation/tests.

Constraints/Assumptions:
- User instruction in this turn unblocks overlapping ownership so this lane may touch the core write files needed for the migration.
- Do not revert or discard unrelated in-progress edits already present in the worktree.
- Preserve the file-native architecture and current public API shapes unless a write-operation result must surface new recovery metadata.

Key decisions:
- Implement a `WriteBatch` abstraction that stages raw copies, text writes, and JSONL appends in temp files before a single ordered commit.
- Record operation status in `.runtime/operations/<opId>.json` so validation can detect interrupted or failed operations without relying on process-local state.
- Migrate high-risk imports first, then registry/profile flows within the same abstraction rather than introducing one-off ordering fixes per callsite.

State:
- completed

Done:
- Reviewed repo instructions, reliability docs, current write paths, and validation coverage around manifests.
- Confirmed the canonical write gap spans raw copies, markdown writes, JSONL appends, audit records, and post-write manifests.
- Added `WriteBatch` commit/rollback metadata under `.runtime/operations/`.
- Migrated document, meal, assessment, sample-batch, goal, regimen, and profile rebuild/snapshot flows onto staged writes.
- Simplified `storage-spine` into thin exports once manifest work moved into the write paths.
- Added validation and tests for unresolved write operations and rollback behavior.

Now:
- None.

Next:
- Monitor follow-on lanes for any query/CLI assumptions that need to account for `.runtime/operations/` validation findings.

Open questions (UNCONFIRMED if needed):
- UNCONFIRMED: Whether unresolved operation detection should stay purely advisory in `validateVault()` or fail the vault validity flag immediately.

Working set (files/ids/commands):
- `agent-docs/exec-plans/active/COORDINATION_LEDGER.md`
- `agent-docs/exec-plans/active/2026-03-13-write-operations.md`
- `packages/core/src/fs.ts`
- `packages/core/src/operations/**`
- `packages/core/src/mutations.ts`
- `packages/core/src/storage-spine.ts`
- `packages/core/src/assessment/storage.ts`
- `packages/core/src/bank/goals.ts`
- `packages/core/src/bank/regimens.ts`
- `packages/core/src/profile/storage.ts`
- `packages/core/src/vault.ts`
- `packages/core/test/**`
- Commands: `pnpm typecheck`, `pnpm test`, `pnpm test:coverage`
Status: completed
Updated: 2026-03-13
Completed: 2026-03-13
