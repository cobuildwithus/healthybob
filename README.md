# Healthy Bob

Healthy Bob is a file-native health vault with Markdown as the human-reviewable source of truth, append-only JSONL ledgers for machine-readable records, and a thin CLI/operator surface layered on top of a shared core library.

## Current State

- Repository-local agent harness is installed.
- The baseline vault package layout and contract docs are scaffolded under `packages/` and `docs/contracts/`.
- `packages/contracts`, `packages/core`, `packages/importers`, and `packages/query` now agree on the frozen vault metadata, frontmatter, event, sample, and audit shapes.
- `packages/cli` is wired to real package services in source, but the executable `vault-cli` runtime is not exercised by repo-level checks because this workspace does not currently include the `incur` toolchain.
- Deterministic fixtures, sample-import placeholders, golden-output scaffolding, and smoke scenario manifests now live under `fixtures/` and `e2e/`.
- Durable process and architecture docs live under `agent-docs/` plus `ARCHITECTURE.md` and `docs/architecture.md`.
- Runtime verification now covers contracts plus the executable `core`, `importers`, and `query` packages directly.

## Package Layout

- `packages/contracts`: shared schemas, types, and generated JSON Schema artifacts
- `packages/core`: canonical vault file operations and domain mutations
- `packages/cli`: `vault-cli` command surface
- `packages/importers`: ingestion adapters that call core write APIs
- `packages/query`: read model and export-pack generation

## Supporting Layout

- `docs/contracts/`: frozen interface docs used by all worker lanes
- `fixtures/`: minimal vault scaffold, sample-import placeholders, and golden-output directories
- `e2e/`: smoke manifests plus the executable fixture verifier
- `assistant-state/`: out-of-vault assistant/session state

## Verification

- `pnpm typecheck`: validates repo shell wrappers, smoke verifier syntax, contract artifacts/examples, and JS package syntax for `core`, `importers`, and `query`
- `pnpm test`: runs agent-doc drift checks, package runtime tests (`contracts`, `core`, `importers`, `query`), and fixture/scenario integrity verification
- `pnpm test:coverage`: runs doc-gardening checks, package runtime tests, and command-surface smoke coverage verification
- `pnpm test:packages`: runs the executable package-runtime checks without the worktree-sensitive doc-drift wrapper

These checks do not execute the CLI binary yet. They verify the runtime packages that are executable in this workspace and keep the fixture/smoke scaffold honest.

## Near-Term Scope

The first release includes only vault init/validate, document import, meal add, generic CSV sample import, experiment creation, journal ensure, show/list, and export-pack generation.
