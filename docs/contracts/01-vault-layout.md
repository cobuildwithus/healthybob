# Vault Layout

Status: frozen baseline

## Baseline Root

```text
vault/
  vault.json
  CORE.md
  journal/YYYY/YYYY-MM-DD.md
  bank/experiments/<slug>.md
  bank/providers/<provider-slug>.md
  raw/documents/YYYY/MM/<documentId>/<filename>
  raw/meals/YYYY/MM/<mealId>/<slot>-<filename>
  raw/samples/<stream>/YYYY/MM/<transformId>/<filename>.csv
  ledger/events/YYYY/YYYY-MM.jsonl
  ledger/samples/<stream>/YYYY/YYYY-MM.jsonl
  audit/YYYY/YYYY-MM.jsonl
  exports/packs/<packId>/
```

## `vault.json`

`vault.json` is a closed metadata document with these required keys:

- `schemaVersion`
- `vaultId`
- `createdAt`
- `title`
- `timezone`
- `idPolicy`
- `paths`
- `shards`

Source contract: `packages/contracts/src/schemas.js`
Generated artifact: `packages/contracts/generated/vault-metadata.schema.json`

## Path Rules

- All stored paths are relative to the vault root.
- Stored paths may not start with `/` or contain `..`.
- Markdown docs remain human-readable and reviewable in place.
- Raw imports are copied under stable type-specific folders in `raw/` and remain immutable in place.
- `raw/samples/<stream>/YYYY/MM/<transformId>/` uses an import-batch identifier returned from `samples import-csv`; baseline does not write a standalone transform record.
- Event shards use `occurredAt`: `ledger/events/YYYY/YYYY-MM.jsonl`.
- Sample shards use `recordedAt`: `ledger/samples/<stream>/YYYY/YYYY-MM.jsonl`.
- Audit shards use `occurredAt`: `audit/YYYY/YYYY-MM.jsonl`.
- Export-pack directories under `exports/packs/<packId>/` are derived, read-only outputs. Current pack ids are path-safe names derived from scope rather than canonical record ids.

## Attachment Conventions

- Document imports use `raw/documents/YYYY/MM/<documentId>/<filename>`.
- Meal attachments use `raw/meals/YYYY/MM/<mealId>/<slot>-<filename>`.
- Sample CSV imports use `raw/samples/<stream>/YYYY/MM/<transformId>/<filename>.csv`, where `transformId` is the returned import-batch id.
- File names are slug-safe ASCII and preserve the original extension.
