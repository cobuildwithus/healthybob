# Command Surface

Status: bootstrap placeholder

## Baseline Commands

```text
vault-cli init
vault-cli validate
vault-cli document import <file>
vault-cli meal add --photo <path> [--audio <path>] [--note "..."] [--occurred-at <ts>]
vault-cli samples import-csv <file> --stream <stream> --ts-column <name> --value-column <name> --unit <unit>
vault-cli experiment create <slug>
vault-cli journal ensure <date>
vault-cli show <id>
vault-cli list [filters]
vault-cli export pack --from <date> --to <date> [--experiment <slug>] [--out <dir>]
```

## Contract Rules

- Commands return structured output even when formatted for humans.
- CLI commands call core, importer, or query APIs only.
- Errors normalize to shared contract codes.
- `vault-cli` is the only public command namespace in baseline.

## To Be Finalized By CLI Lane

- option-level schemas
- middleware contract
- output envelope shapes
- formatting behavior across `json`, `md`, and other supported formats
