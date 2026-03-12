# Fixtures

Status: frozen baseline

The fixture lane owns the actual corpus under `fixtures/`, but this doc freezes the minimum smoke-contract coverage that corpus must satisfy.

## Required Coverage

- One minimal vault scaffold with stable locations for `CORE.md`, journal pages, experiment pages, and the raw/ledger/audit/export directories referenced by smoke scenarios.
- Sample-import inputs for document import, meal add, and CSV sample import flows.
- One golden-output directory per documented baseline command.
- Smoke expectations that describe:
  - document and meal writes returning `lookupId` plus stable related ids
  - sample imports returning `lookupIds` plus an `xfm_*` batch id
  - experiment creation idempotence via `created: false`
  - validation issue accumulation for malformed markdown frontmatter
  - show/list lookup rules for queryable vs non-queryable related ids
  - export packs materializing `manifest.json`, `question-pack.json`, `records.json`, `daily-samples.json`, and `assistant-context.md`

## Determinism Rules

- Reuse the frozen schema versions and error codes from `packages/contracts/src/constants.js`.
- Reuse the frozen ID policy from `docs/contracts/02-record-schemas.md`.
- Keep timestamps within the March 2026 baseline so shard paths stay deterministic.
- Keep all stored paths relative and vault-local.
- Treat `xfm_*` values as import-batch identifiers only; do not require standalone transform records in the fixture corpus.

## Reference Set

`packages/contracts/src/examples.js` is the contract reference set for canonical payload examples. Package tests remain the executable truth for full contract-shaped markdown and JSONL data.
