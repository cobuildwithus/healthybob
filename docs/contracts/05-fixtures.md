# Fixtures

Status: frozen baseline

The fixture lane owns the actual corpus under `fixtures/`, but this doc freezes the minimum contract coverage that corpus must satisfy.

## Required Coverage

- One valid `vault.json` example.
- One valid frontmatter example each for `CORE.md`, a journal day page, and an experiment page.
- One valid event example for every baseline event kind.
- One valid sample example for every baseline sample stream.
- At least one successful audit record and one failed audit record.
- At least one successful `document_import` transform and one successful `samples_import_csv` transform.

## Determinism Rules

- Reuse the frozen schema versions and error codes from `packages/contracts/src/constants.js`.
- Reuse the frozen ID policy from `docs/contracts/02-record-schemas.md`.
- Keep timestamps within the March 2026 baseline so shard paths stay deterministic.
- Keep all stored paths relative and vault-local.

## Reference Set

`packages/contracts/src/examples.js` is the contract reference set the fixture corpus should continue to validate against.
