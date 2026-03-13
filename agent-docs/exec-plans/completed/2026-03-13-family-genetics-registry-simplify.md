# Family Genetics Registry Simplify

## Goal

Reduce duplicated control flow across the family and genetics markdown registry APIs by extracting only the shared document loading and record resolution shells.

## Scope

- Add a small shared helper for loading markdown registry documents from a directory.
- Add shared helpers for selecting an existing record by id/slug and reading a record by id-or-slug from a loaded set.
- Keep domain-specific normalization, sorting, attribute assembly, body rendering, and audit metadata inside `family/api.ts` and `genetics/api.ts`.

## Constraints

- Preserve existing error codes and messages.
- Preserve slug/path stability on updates.
- Preserve sorting differences between the two registries.
- Avoid a cross-cutting generic registry framework.

## Verification

- `packages/core/test/health-history-family.test.ts`
- Required repo checks for package changes after implementation.
Status: completed
Updated: 2026-03-13
Completed: 2026-03-13
