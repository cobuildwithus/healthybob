# `@healthybob/cli`

Owns the `vault-cli` command surface. The CLI may validate inputs and format outputs, but it must delegate all canonical writes to core.

## Status

- Package-local Incur command structure is present under `src/`.
- Command handlers are thin and dependency-injected through `createVaultCli()`.
- Default runtime services now delegate to the workspace `core`, `importers`, and `query` packages.
- Repo-level verification still does not execute `vault-cli` in this workspace because the `incur` dependency/toolchain is not installed locally.
