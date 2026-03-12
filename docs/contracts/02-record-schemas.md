# Record Schemas

Status: frozen baseline

Schema sources live in `packages/contracts/src/`. Generated JSON Schema artifacts live in `packages/contracts/generated/`.

## ID Policy

All durable IDs use one format: `<prefix>_<ULID>`.

| Family | Prefix |
| --- | --- |
| vault | `vault` |
| event | `evt` |
| sample | `smp` |
| audit | `aud` |
| transform | `xfm` |
| document | `doc` |
| meal | `meal` |
| experiment | `exp` |
| provider | `prov` |
| export pack | `pack` |

## Baseline Record Families

- Vault metadata:
  `schemaVersion`, `vaultId`, `createdAt`, `title`, `timezone`, `idPolicy`, `paths`, `shards`
- Event records:
  `schemaVersion`, `id`, `kind`, `occurredAt`, `recordedAt`, `dayKey`, `source`, `title`, plus kind-specific fields
- Sample records:
  `schemaVersion`, `id`, `stream`, `recordedAt`, `dayKey`, `source`, `quality`, plus stream-specific fields
- Audit records:
  `schemaVersion`, `id`, `action`, `status`, `occurredAt`, `actor`, `commandName`, `summary`, `changes`
- Transform records:
  `schemaVersion`, `id`, `transformType`, `status`, `appliedAt`, `input`, `output`
- Markdown frontmatter:
  `CORE.md`, journal day pages, and experiment pages each use a closed frontmatter schema

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
- `transform-record.schema.json`
- `frontmatter-core.schema.json`
- `frontmatter-journal-day.schema.json`
- `frontmatter-experiment.schema.json`
