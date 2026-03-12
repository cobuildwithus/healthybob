# Vault Layout

Status: bootstrap placeholder

## Baseline Root

The vault root will contain:

- `vault.json`
- `CORE.md`
- `journal/`
- `bank/experiments/`
- `bank/providers/`
- `raw/`
- `ledger/events/`
- `ledger/samples/`
- `audit/`
- `exports/`

## Path Rules

- All stored paths are relative to the vault root.
- Raw imports are copied under stable type-specific folders in `raw/`.
- Events and samples are sharded by month in append-only JSONL files.
- Markdown docs remain human-readable and reviewable in place.

## To Be Finalized By Contracts Lane

- exact `vault.json` shape
- canonical relative path map
- attachment path conventions
- monthly shard naming details
