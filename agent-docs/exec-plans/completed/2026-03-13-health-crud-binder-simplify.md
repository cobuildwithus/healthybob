# Health CRUD binder simplify

Status: completed
Created: 2026-03-13
Updated: 2026-03-13

## Goal

- Collapse the duplicated health CRUD service binding in the CLI onto a single implementation while preserving command behavior and output shapes.

## Success criteria

- `packages/cli/src/commands/health-entity-command-registry.ts` no longer carries its own duplicate CRUD binder if the existing shared binder can be reused safely.
- No new widening of trust-boundary casts is introduced; deleting dead code is acceptable if reuse becomes invasive.
- CLI tests covering the health command surface still pass.

## Scope

- In scope:
- `packages/cli/src/commands/health-entity-command-registry.ts`
- `packages/cli/src/commands/health-command-factory.ts` only if a minimal compatibility fix is required to reuse the existing binder
- focused CLI tests and coordination metadata
- Out of scope:
- descriptor-model redesign
- broader CLI command-surface refactors already owned by other active lanes

## Constraints

- Work on top of the current tree and do not revert adjacent edits from active CLI lanes.
- Keep `packages/cli/src/commands/health-command-factory.ts` effectively read-only unless a tiny type-only adjustment is the only safe route.
- Preserve runtime behavior, output shapes, and existing command descriptions/examples.

## Risks and mitigations

1. Risk: the exported shared binder may not line up cleanly with descriptor-driven method-name typing.
   Mitigation: prefer structural typing reuse first; fall back to dead-code removal only if reuse would force broader type churn in owned files.
2. Risk: overlapping work in `health-command-factory.ts` could create merge friction.
   Mitigation: avoid editing that file unless strictly necessary and keep the ledger row explicit about the boundary.

## Tasks

1. Verify the live usage graph and current file state.
2. Reuse the shared binder from the registry if the type surface stays small.
3. Run simplify/coverage/final audit passes plus the required CLI verification commands.
4. Remove the ledger row, archive the plan, and commit only the touched files.

## Decisions

- Prefer eliminating the duplicate unsafe binder in the registry over deleting the existing shared binder, because that keeps changes out of the file already owned by another lane.
- Reusing the existing exported binder only needed registry-local generic annotations; no edits to `health-command-factory.ts` were required.
