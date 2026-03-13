# Subcommand Grammar Regularization

## Goal

Regularize the CLI grammar so export-pack follow-ups live under `export pack` and search-index operations live under `search index`, while removing the current shared-command workaround that forces a dummy `--text` value for index operations.

## Scope

- `packages/cli/src/commands/export.ts`
- `packages/cli/src/commands/search.ts`
- `packages/cli/src/bin.ts`
- `packages/cli/README.md`
- `packages/query/src/search-sqlite.ts`
- Targeted CLI/runtime tests for export and search command metadata
- Command-surface docs and smoke scenarios for the renamed commands
- Search command docs/scenarios that must reflect the current `--from` / `--to` schema

## Constraints

- Preserve existing behavior and payload shapes for export-pack and search-index operations aside from the command path changes.
- Keep the top-level lexical search command as `search --text <query> ...`.
- Do not revert unrelated in-flight edits in shared docs or tests.

## Plan

1. Convert `export pack` into a mounted sub-CLI with `create|show|list|materialize|prune`.
2. Keep `search --text <query>` as the lexical-search surface while accepting `search index status|rebuild` via argv rewrite onto the existing action dispatch so index operations no longer require `--text`.
3. Remove the placeholder `--text` injection that previously masked the shared-command bug.
4. Update runtime tests, query-layer guidance text, command-surface docs, and smoke scenarios to the new grammar.
5. Run required verification and completion-workflow audits, then clean the coordination row.
