# Verification And Runtime

Last verified: 2026-03-12

## Verification Matrix

| Change scope | Required commands | Notes |
| --- | --- | --- |
| Docs/process-only | `pnpm typecheck`, `pnpm test`, `pnpm test:coverage` | Current bootstrap baseline. |
| First introduction of product/runtime code | Update this doc and `package.json` in the same change, then run the narrowest truthful commands for the new tooling plus the bootstrap docs checks. | Do not leave stale bootstrap commands undocumented. |
| User explicitly says to skip checks | Skip checks for that turn only. | User instruction takes precedence. |

## Current Command Meaning

- `pnpm typecheck`: validates shell syntax for repo-local workflow wrappers.
- `pnpm test`: runs docs drift enforcement and required-file checks.
- `pnpm test:coverage`: runs doc-gardening validation and generated-doc inventory checks.

## Runtime Status

- No runtime or deployment target is defined yet.
- Before adding one, document entrypoints, environment assumptions, and operational guardrails here.
