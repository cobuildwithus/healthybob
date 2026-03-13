# Inbox Parser Runtime Fixes

Goal (incl. success criteria):
- Make the main `inbox run` path use parser-aware daemon wiring when parser runtime support is available.
- Make `requeue --state running` behave as advertised and invalidate stale running claims safely.
- Prevent stale parser scratch or published derived artifacts from leaking across reruns.
- Keep package metadata truthful by declaring all imported workspace dependencies.

Constraints/Assumptions:
- Preserve adjacent in-flight edits in `packages/cli/src/inbox-services.ts`.
- Do not read `.env` files or expose local identifiers.
- Prefer additive runtime behavior changes with focused regression coverage.
- Repo-wide required checks may still fail for unrelated active lanes; record causal separation when that happens.

Key decisions:
- Keep the parser-aware daemon on the normal runtime path by routing `inbox run` through `runInboxDaemonWithParsers(...)` when parsers are available.
- Make parse finalization attempt-aware so `requeue --state running` invalidates stale claims instead of only rewinding row state.
- Publish derived parser outputs into attempt-scoped directories and remove stale attempt output when superseded.
- Use unique per-run scratch directories and remove them in `finally` so provider adapters cannot read leftovers from prior runs.

State:
- done

Done:
- Verified the current CLI runtime path already routes the daemon through the parser-aware entrypoint.
- Extended attachment-parse finalize contracts with `attempt` and `applied` so stale running attempts are ignored after requeue.
- Allowed `requeueAttachmentParseJobs()` to reset `running` jobs alongside `failed` and `succeeded`.
- Moved parser publication to attempt-scoped output directories and worker cleanup for stale attempts.
- Switched parser scratch handling to unique run directories with cleanup after each parse.
- Threaded `AbortSignal` through parser startup drain so the parser-aware daemon stops promptly before and between jobs.
- Added regression coverage for stale-attempt requeue invalidation, attempt-scoped publication, startup-drain abort behavior, and attempt-aware CLI test helpers.
- Added the missing `@healthybob/runtime-state` dependency earlier in the tree and confirmed it is present in the current package manifest.

Now:
- Completed and ready for handoff.

Next:
- Follow up separately on unrelated repo-wide build/test blockers in active CLI/contracts lanes if needed.

Open questions (UNCONFIRMED if needed):
- UNCONFIRMED: whether any external caller outside this workspace depends on direct `failAttachmentParseJob()` / `completeAttachmentParseJob()` calls without an explicit attempt token.

Working set (files/ids/commands):
- Files: `packages/inboxd/src/contracts/derived.ts`, `packages/inboxd/src/kernel/sqlite.ts`, `packages/inboxd/test/inboxd.test.ts`, `packages/parsers/src/pipelines/parse-attachment.ts`, `packages/parsers/src/pipelines/worker.ts`, `packages/parsers/src/publish/writer.ts`, `packages/parsers/src/service.ts`, `packages/parsers/src/shared.ts`, `packages/parsers/test/parsers.test.ts`, `packages/cli/test/inbox-cli.test.ts`, `packages/cli/test/cli-expansion-inbox-attachments.test.ts`, `pnpm-lock.yaml`
- Commands:
- `pnpm --dir packages/inboxd test`
- `pnpm exec vitest run packages/parsers/test/parsers.test.ts -t "requeue invalidates stale running claims before finalization|stale running parser attempts do not overwrite a requeued rerun|daemon with parsers skips startup drain when the signal is already aborted|daemon with parsers stops startup drain after abort between jobs|daemon with parsers drains pending jobs before connector watch work begins|daemon with parsers still rejects connector failures after cleanup|parseAttachment uses isolated scratch directories across reruns|writeParserArtifacts removes stale optional files on rerun|attachment parse worker consumes inbox jobs, writes derived artifacts, and updates runtime search|parser service forwards scoped drain and requeue filters to the runtime" --no-coverage`
- `pnpm exec vitest run packages/cli/test/inbox-cli.test.ts --no-coverage --maxWorkers 1`
- `pnpm typecheck` failed in unrelated contracts workspace resolution (`@healthybob/contracts/schemas` missing from other active work)
- `pnpm test` failed in unrelated CLI package-shape validation (`test/canonical-write-lock.test.ts` reaching into another package src tree)
- `pnpm test:coverage` failed for the same unrelated CLI package-shape validation
- `pnpm --dir packages/cli typecheck` failed in unrelated active CLI test/build lanes
- `pnpm --dir packages/inboxd typecheck` passed
- `pnpm --dir packages/parsers typecheck` passed
