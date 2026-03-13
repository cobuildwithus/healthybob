# 2026-03-13 Query Health Loader Simplify

## Goal

Remove sync/async parsing duplication in the query-side health loaders and make export-pack's tolerant health-read boundary explicit without changing observable behavior.

## Success Criteria

- `packages/query/src/health/loaders.ts` shares pure helpers for relative-path collection, markdown parsing, and JSONL parsing while keeping the existing sync/async exports and strict reader semantics.
- `packages/query/src/export-pack.ts` no longer hides export-pack tolerance behind `void result.failures;`; the tolerant boundary is named explicitly.
- `packages/query/src/export-pack-health.ts` and the existing tests still preserve tolerant export-pack behavior, parse-failure shapes, relative paths, and line numbers.

## Constraints

- Preserve current exported signatures unless a tiny additive helper is the clearest way to name the tolerant export-pack boundary.
- Do not make strict readers tolerant.
- Do not make export-pack fail on parse errors.
- Work on top of existing dirty changes without reverting unrelated edits.

## Planned Files

- `agent-docs/exec-plans/active/COORDINATION_LEDGER.md`
- `agent-docs/exec-plans/active/2026-03-13-query-health-loader-simplify.md`
- `packages/query/src/health/loaders.ts`
- `packages/query/src/export-pack-health.ts`
- `packages/query/src/export-pack.ts`
- `packages/query/test/health-tail.test.ts`
- `packages/query/test/query.test.ts`

## Notes

- This is a companion lane to the broader query read-model simplification plan and stays limited to currently unowned loader/export-pack surfaces.
- If a clean simplification would require touching query files outside this list, leave it out and report it in handoff.
Status: completed
Updated: 2026-03-13
Completed: 2026-03-13
