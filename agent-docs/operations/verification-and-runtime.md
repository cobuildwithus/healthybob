# Verification And Runtime

Last verified: 2026-03-12

## Verification Matrix

| Change scope | Required commands | Notes |
| --- | --- | --- |
| Docs/process-only | `pnpm typecheck`, `pnpm test`, `pnpm test:coverage` | Includes package-runtime checks, built CLI verification, and fixture/scenario scaffolding because those are part of repo truth now. |
| Fixture/e2e/package-doc changes | `pnpm typecheck`, `pnpm test`, `pnpm test:coverage` | Verifies fixture corpus integrity, smoke-manifest wiring, package-runtime health, built CLI checks, and command-surface coverage. |
| Changes under `packages/contracts`, `packages/core`, `packages/importers`, or `packages/query` | `pnpm typecheck`, `pnpm test:packages`, `pnpm test:smoke` | `pnpm test` remains required for full repo acceptance, but `pnpm test:packages` is the clean runtime signal when the doc-drift wrapper is blocked by an in-progress dirty worktree. |
| Changes under `packages/cli` | `pnpm typecheck`, `pnpm test`, `pnpm test:coverage` | Repo checks now run `packages/cli` typecheck, build, and package-local verification through `pnpm verify:cli`. |
| User explicitly says to skip checks | Skip checks for that turn only. | User instruction takes precedence. |

## Current Command Meaning

- `pnpm typecheck`: validates shell syntax, smoke-verifier syntax, contract artifacts/examples, JS package syntax for `core`/`importers`/`query`, and `packages/cli` typecheck/build/test.
- `pnpm test`: runs docs drift enforcement, package verification for `contracts`/`cli`/`core`/`importers`/`query`, and fixture/scenario integrity verification through `e2e/smoke/verify-fixtures.mjs`.
- `pnpm test:packages`: runs executable runtime package checks plus the built CLI verification path.
- `pnpm test:coverage`: runs doc-gardening validation, package verification, and verifies every documented baseline command has smoke coverage plus a golden-output scaffold.
- `pnpm test:smoke`: runs only the fixture/scenario integrity verifier.

## Runtime Status

- No deployment target is defined yet.
- Repo-level checks execute canonical write/read paths in `core`, `importers`, and `query`, and they build the CLI package through the same workspace toolchain used for local development.
- The built `vault-cli` binary can be exercised locally with `node packages/cli/dist/bin.js ...` when a change requires an end-to-end runtime check beyond the standard repo scripts.
- Before adding a runtime target, document entrypoints, environment assumptions, and operational guardrails here.
