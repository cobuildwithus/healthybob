# Minimal Vault Fixture

This directory is the smallest human-reviewable vault scaffold used by tests and smoke scenarios.

It intentionally remains lighter than the executable runtime fixtures:

- The runtime packages validate contract-shaped data in their own package tests.
- This directory stays focused on smoke-scenario path coverage and human-reviewable layout expectations.
- It is not the canonical contract-validation corpus for `core`/`importers`/`query`.

Current contents:

- `CORE.md`
- one experiment page
- one journal day
- directory placeholders for `raw/`, `ledger/`, `audit/`, and `exports/`
