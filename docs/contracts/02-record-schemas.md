# Record Schemas

Status: frozen baseline

Schema sources live in `packages/contracts/src/`. Generated JSON Schema artifacts live in `packages/contracts/generated/`.

## ID Policy

Canonical record ids and importer batch ids use one format: `<prefix>_<ULID>`.
Derived export-pack directories use a path-safe pack name and are not canonical vault record ids.

| Family | Prefix | Notes |
| --- | --- | --- |
| vault | `vault` | vault metadata id |
| event | `evt` | canonical event record id |
| sample | `smp` | canonical sample record id |
| audit | `aud` | canonical audit record id |
| transform batch | `xfm` | import-batch id returned from sample-import flows and used in raw paths |
| document | `doc` | related id stored on document events |
| meal | `meal` | related id stored on meal events |
| experiment | `exp` | experiment page id and related event id |
| provider | `prov` | provider page id |

## Baseline Record Families

- Vault metadata:
  `schemaVersion`, `vaultId`, `createdAt`, `title`, `timezone`, `idPolicy`, `paths`, `shards`
- Event records:
  `schemaVersion`, `id`, `kind`, `occurredAt`, `recordedAt`, `dayKey`, `source`, `title`, plus kind-specific fields
- Sample records:
  `schemaVersion`, `id`, `stream`, `recordedAt`, `dayKey`, `source`, `quality`, plus stream-specific fields
- Audit records:
  `schemaVersion`, `id`, `action`, `status`, `occurredAt`, `actor`, `commandName`, `summary`, `changes`
- Markdown frontmatter:
  `CORE.md`, journal day pages, and experiment pages each use a closed frontmatter schema

Baseline does not define a standalone transform record family. `xfm_*` ids are batch identifiers surfaced by import flows and raw-path layout only.

## Baseline Event Kinds

| Kind | Required contract fields |
| --- | --- |
| `document` | `documentId`, `documentPath`, `mimeType` |
| `meal` | `mealId`, `photoPaths`, `audioPaths` |
| `symptom` | `symptom`, `intensity` |
| `note` | `note` |
| `observation` | `metric`, `value`, `unit` |
| `experiment_event` | `experimentId`, `experimentSlug`, `phase` |
| `medication_intake` | `medicationName`, `dose`, `unit` |
| `supplement_intake` | `supplementName`, `dose`, `unit` |
| `activity_session` | `activityType`, `durationMinutes` |
| `sleep_session` | `startAt`, `endAt`, `durationMinutes` |

Shared optional event fields are limited to `note`, `tags`, `relatedIds`, and `rawRefs`.

## Baseline Sample Streams

| Stream | Required contract fields |
| --- | --- |
| `heart_rate` | `value`, `unit: "bpm"` |
| `hrv` | `value`, `unit: "ms"` |
| `steps` | `value`, `unit: "count"` |
| `sleep_stage` | `stage`, `startAt`, `endAt`, `durationMinutes`, `unit: "stage"` |
| `respiratory_rate` | `value`, `unit: "breaths_per_minute"` |
| `temperature` | `value`, `unit: "celsius"` |
| `glucose` | `value`, `unit: "mg_dL"` |

## Frontmatter Contracts

- `CORE.md` frontmatter:
  `schemaVersion`, `docType`, `vaultId`, `title`, `timezone`, `updatedAt`
- Journal day frontmatter:
  `schemaVersion`, `docType`, `dayKey`, `eventIds`, `sampleStreams`
- Experiment frontmatter:
  `schemaVersion`, `docType`, `experimentId`, `slug`, `status`, `title`, `startedOn`

## Generated Artifact Set

- `vault-metadata.schema.json`
- `event-record.schema.json`
- `sample-record.schema.json`
- `audit-record.schema.json`
- `frontmatter-core.schema.json`
- `frontmatter-journal-day.schema.json`
- `frontmatter-experiment.schema.json`
