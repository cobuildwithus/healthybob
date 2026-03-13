# Bank read cleanup

Status: completed
Created: 2026-03-13
Updated: 2026-03-12

## Goal

- Apply the behavior-preserving parts of the supplied simplification pass that still match the current checkout without conflicting with active ownership in other lanes.

## Success criteria

- Bank registry read paths reuse a shared id-or-slug scan helper without changing current selection semantics.
- The allergy upsert path drops the dead no-op timeline wrapper with no behavior change.
- Shared selector helpers accept the current bank callers and remain compatible with already-owned files left untouched.
- Required verification and completion audit steps run for the scoped change.

## Scope

- In scope:
- `packages/core/src/bank/shared.ts`
- `packages/core/src/bank/allergies.ts`
- `packages/core/src/bank/conditions.ts`
- `packages/core/src/bank/goals.ts`
- completion workflow evidence for this scoped change
- Out of scope:
- `packages/core/src/family/api.ts`
- `packages/core/src/genetics/api.ts`
- `packages/core/test/**`
- any behavior change for conflicting id+slug selectors

## Constraints

- Preserve current externally visible behavior.
- Respect active ownership in `COORDINATION_LEDGER.md`; do not touch files claimed by other lanes.
- Treat the supplied patch as advisory and re-check every hunk against the live repo before applying it.

## Risks and mitigations

1. Risk: extracting a shared read helper could change match precedence.
   Mitigation: keep the current single-pass `find` semantics in the helper instead of tightening conflicts.
2. Risk: broadening the shared selector helper could accidentally change existing conflict messages.
   Mitigation: add only an optional override while preserving the current default message.

## Tasks

1. Compare the supplied cleanup patch with the live bank registry files.
2. Apply only the unowned, behavior-preserving bank helper and read-path changes.
3. Run the required completion workflow audits and repo verification commands.
4. Remove the ownership row after verification and commit the touched files.

## Verification

- `pnpm typecheck`
- `pnpm test:packages`
- `pnpm test:smoke`
- `pnpm test`
- `pnpm test:coverage` `FAILED` on pre-existing coverage thresholds in `packages/query/src/search.ts` and `packages/query/src/timeline.ts`, both owned by another active lane and untouched here
- `pnpm exec vitest run packages/core/test/health-bank.test.ts --no-coverage --maxWorkers 1` `FAILED` because the live root Vitest config excludes that file in this checkout
- one-off health-bank run with a temporary Vitest config plus `-t "conditions and allergies are stored as deterministic markdown registry pages"` `PASSED`

## Outcome

- Applied: shared `findRecordByIdOrSlug` helper, bank read-path dedupe, allergy no-op wrapper removal.
- Intentionally skipped from the supplied patch: `family/api.ts` and `genetics/api.ts` cleanups because those files are owned by another active lane in `COORDINATION_LEDGER.md`.
Completed: 2026-03-12
