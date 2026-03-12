# Verification And Runtime

Last verified: 2026-03-12

## Verification Matrix

| Change scope | Required commands | Notes |
| --- | --- | --- |
| Docs/process-only | `pnpm typecheck`, `pnpm test`, `pnpm test:coverage` | Includes package-runtime checks plus fixture/scenario scaffolding because those are part of repo truth now. |
| Fixture/e2e/package-doc changes | `pnpm typecheck`, `pnpm test`, `pnpm test:coverage` | Verifies fixture corpus integrity, smoke-manifest wiring, package-runtime health, and command-surface coverage. |
| Changes under `packages/contracts`, `packages/core`, `packages/importers`, or `packages/query` | `pnpm typecheck`, `pnpm test:packages`, `pnpm test:smoke` | `pnpm test` remains required for full repo acceptance, but `pnpm test:packages` is the clean runtime signal when the doc-drift wrapper is blocked by an in-progress dirty worktree. |
| Changes under `packages/cli` | Run the narrowest available source-level review plus the repo checks above, then document whether `incur` / TypeScript toolchain execution was actually possible. | The CLI source is wired to real package services, but it is not executable in this workspace until the `incur` dependency/toolchain is installed. |
| User explicitly says to skip checks | Skip checks for that turn only. | User instruction takes precedence. |

## Current Command Meaning

- `pnpm typecheck`: validates shell syntax, smoke-verifier syntax, contract artifacts/examples, and JS package syntax for `core`, `importers`, and `query`.
- `pnpm test`: runs docs drift enforcement, package runtime tests for `contracts`/`core`/`importers`/`query`, and fixture/scenario integrity verification through `e2e/smoke/verify-fixtures.mjs`.
- `pnpm test:packages`: runs only the executable runtime package checks (`contracts`, `core`, `importers`, `query`).
- `pnpm test:coverage`: runs doc-gardening validation, package runtime tests, and verifies every documented baseline command has smoke coverage plus a golden-output scaffold.
- `pnpm test:smoke`: runs only the fixture/scenario integrity verifier.

## Runtime Status

- No deployment target is defined yet.
- Repo-level checks execute canonical write/read paths in `core`, `importers`, and `query`, but they do not execute the `vault-cli` binary yet.
- `packages/cli` is wired to real package functions in source. The remaining blocker is local toolchain availability: this workspace does not currently include `incur` or a TypeScript compiler.
- Before adding a runtime target, document entrypoints, environment assumptions, and operational guardrails here.
