# `@healthybob/importers`

Owns ingestion adapters for documents, meals, and sample streams. Importers may parse inputs and prepare metadata, but they must route all canonical writes through `@healthybob/core`.

## Baseline Scope

- `document` import reads file metadata only and forwards a normalized document payload.
- `meal` import inspects photo/audio attachments and forwards a normalized meal payload.
- `samples` CSV import parses tabular sample rows and forwards a normalized batch payload.
- No OCR, transcription, or structured lab parsing is performed in the baseline.

## Core Integration Seam

This package still supports an injected write port for tests and alternate callers, but its default workspace wiring now targets the concrete `packages/core` exports.

The assumed core surface is:

- `importDocument(payload)`
- `addMeal(payload)` or `importMeal(payload)`
- `importSamples(payload)`

Importers never write vault files directly. They validate inputs, inspect source files, normalize payloads, and delegate the final canonical mutation to the injected core port.
