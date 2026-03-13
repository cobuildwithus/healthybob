# Storage Spine Hardening

## Goal

Harden the storage spine without touching the active contracts/mutations lane by:

- aligning command-surface docs with the direct payload runtime behavior
- adding immutable raw import manifests with checksums/provenance for raw-import flows
- preserving richer sample import provenance in a batch manifest sidecar
- documenting a concrete schema-version policy for the existing storage surface

## Constraints

- Do not edit `packages/contracts/**` or `packages/core/src/mutations.ts`.
- Keep canonical writes inside `packages/core`.
- Preserve current command behavior unless adding backward-compatible import metadata fields.
- Run the completion workflow audit passes because production code and tests are in scope.

## Planned Scope

- Add a new core helper/wrapper module for raw import manifests and wrapped import entrypoints.
- Extend importer payloads so sample imports can carry row/config provenance into the core wrapper.
- Expose manifest-relative paths in CLI import results where safe and useful.
- Update README and contract docs to match the direct payload CLI contract plus storage hardening rules.

## Verification

- `pnpm typecheck`
- `pnpm test`
- `pnpm test:coverage`
- completion workflow passes: `simplify` -> `test-coverage-audit` -> `task-finish-review`
Status: completed
Updated: 2026-03-12
Completed: 2026-03-12
