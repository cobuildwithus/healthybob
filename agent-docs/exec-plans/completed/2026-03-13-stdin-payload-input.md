Goal (incl. success criteria):
- Support `--input -` anywhere the CLI currently accepts payload-based `--input @file.json`.
- Preserve existing `@file.json` behavior while allowing stdin pipelines to feed JSON objects into upsert/update/checkpoint/add commands.
- Cover the new behavior with built-CLI tests so the command surface stays stable.

Constraints/Assumptions:
- Keep the change scoped to payload input parsing and JSON loading helpers.
- Work on top of the existing dirty tree and preserve overlapping in-flight CLI edits.
- Avoid docs churn unless verification or command-surface tests require it.

Key decisions:
- Reuse a single stdin-aware JSON-object loader instead of adding per-command `-` handling.
- Keep `@file.json` as the scaffold/example default while broadening the parser and help text to mention stdin.
- Verify through the built CLI path by extending the existing CLI test harness to pass stdin payloads.

State:
- completed

Done:
- Read repo/process docs and the active coordination ledger.
- Confirmed `health-command-factory.ts`, `provider.ts`, `event.ts`, `samples.ts`, and `experiment.ts` currently hard-code `@file.json`.
- Confirmed the shared health-service path still reads payloads from disk only.
- Added shared stdin-aware payload loading plus `--input -` schema/help updates.
- Extended the explicit Vitest include list with stdin regression files.
- Added direct loader tests plus built-CLI stdin regression coverage for success and failure paths.
- Ran source-level CLI smoke checks for `goal upsert --input -`, `provider upsert --input -`, `experiment update --input -`, and the empty-stdin failure path.
- Ran `pnpm exec vitest run packages/cli/test/json-input.test.ts --no-coverage --maxWorkers 1` successfully.
- Re-ran `pnpm typecheck`, `pnpm test`, and `pnpm test:coverage`; all still fail for unrelated pre-existing repo issues outside this lane.

Now:
- Close the active plan and remove the coordination-ledger row.

Next:
- None.

Open questions (UNCONFIRMED if needed):
- None.

Working set (files/ids/commands):
- `agent-docs/exec-plans/active/COORDINATION_LEDGER.md`
- `agent-docs/exec-plans/active/2026-03-13-stdin-payload-input.md`
- `packages/cli/src/json-input.ts`
- `vitest.config.ts`
- `packages/cli/src/commands/health-command-factory.ts`
- `packages/cli/src/commands/provider.ts`
- `packages/cli/src/commands/event.ts`
- `packages/cli/src/commands/samples.ts`
- `packages/cli/src/commands/experiment.ts`
- `packages/cli/src/commands/provider-event-read-helpers.ts`
- `packages/cli/src/health-cli-descriptors.ts`
- `packages/cli/src/usecases/shared.ts`
- `packages/cli/test/cli-test-helpers.ts`
- `packages/cli/test/json-input.test.ts`
- `packages/cli/test/stdin-input.test.ts`
- `packages/cli/test/incur-smoke.test.ts`
- Commands: `pnpm typecheck`, `pnpm test`, `pnpm test:coverage`
Status: completed
Updated: 2026-03-13
Completed: 2026-03-13
