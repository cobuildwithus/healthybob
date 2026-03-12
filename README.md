# Healthy Bob

Healthy Bob is a file-native health vault with Markdown as the human-reviewable source of truth, append-only JSONL ledgers for machine-readable records, and a thin CLI/operator surface layered on top of a shared core library.

## Current State

- Repository-local agent harness is installed.
- The baseline vault package layout and contract docs are scaffolded under `packages/` and `docs/contracts/`.
- Durable process and architecture docs live under `agent-docs/` plus `ARCHITECTURE.md` and `docs/architecture.md`.
- Runtime implementation is being delivered in parallel lanes behind the frozen bootstrap contracts.

## Package Layout

- `packages/contracts`: shared schemas, types, and generated JSON Schema artifacts
- `packages/core`: canonical vault file operations and domain mutations
- `packages/cli`: `vault-cli` command surface
- `packages/importers`: ingestion adapters that call core write APIs
- `packages/query`: read model and export-pack generation

## Supporting Layout

- `docs/contracts/`: frozen interface docs used by all worker lanes
- `fixtures/`: minimal vault and import samples
- `e2e/`: smoke and scenario coverage
- `assistant-state/`: out-of-vault assistant/session state

## Near-Term Scope

The first release includes only vault init/validate, document import, meal add, generic CSV sample import, experiment creation, journal ensure, show/list, and export-pack generation.
