# Selector And Filter Normalization

## Goal

Normalize the CLI naming surface so lookup-like positional selectors use `id` everywhere except journal commands that are naturally keyed by `date`, and date-range filters use `from`/`to` consistently across generic and noun read surfaces.

## Scope

- Rename positional selector arg keys in CLI command definitions and matching docs/help snapshots.
- Rename generic `list`, `search`, and `intake list` option keys from `dateFrom`/`dateTo` to `from`/`to`.
- Rename returned list/search filter envelope fields from `dateFrom`/`dateTo` to `from`/`to`.
- Keep behavior, accepted lookup values, and backend query semantics unchanged.

## Constraints

- Preserve in-flight adjacent edits in active CLI lanes.
- Do not broaden into command routing, binding-layer extraction, or unrelated payload/output refactors.
- Journal positional selectors stay `date`.

## Verification

- `pnpm typecheck`
- `pnpm test`
- `pnpm test:coverage`
- Completion workflow audit passes: `simplify` -> `test-coverage-audit` -> `task-finish-review`
Status: completed
Updated: 2026-03-13
Completed: 2026-03-13
