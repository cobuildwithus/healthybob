# Minimal Vault Fixture

This directory is the smallest human-reviewable vault scaffold used by tests and smoke scenarios.

It intentionally remains lighter than the executable runtime fixtures:

- The runtime packages validate contract-shaped data in their own package tests.
- This directory stays focused on smoke-scenario path coverage, stable lookup targets, and human-reviewable layout expectations.
- It is not the canonical contract-validation corpus for `core`/`importers`/`query`.

Current contents:

- `CORE.md`
- one experiment page
- one journal day
- directory placeholders for `raw/`, `ledger/`, `audit/`, and `exports/`

Current smoke assumptions:

- `experiment create` is treated as idempotent at the command-contract level.
- `show` should be chained from queryable lookup ids returned by commands, not directly from related ids like `meal_*`, `doc_*`, or batch ids like `xfm_*`.
- `export pack` describes derived output files under `exports/packs/` without mutating this fixture.
