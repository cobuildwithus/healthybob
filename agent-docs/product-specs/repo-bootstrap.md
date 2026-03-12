# Repo Bootstrap

Last verified: 2026-03-12

## Current State

- Repository scaffolding exists.
- The durable repo harness is bootstrapped.
- The baseline vault product fence is now defined by `docs/architecture.md` and `docs/contracts/`.
- Production implementations are still pending behind the frozen contract surface.

## Success Criteria For The First Real Feature Wave

1. `ARCHITECTURE.md` and `docs/architecture.md` name the top-level modules and trust boundaries.
2. `agent-docs/references/testing-ci-map.md` documents real verification commands.
3. `package.json` exposes truthful `typecheck`, `test`, and `test:coverage` commands.
4. The contracts under `docs/contracts/` are implemented without boundary drift.
5. User-visible behavior has a concrete product-spec doc beyond bootstrap notes.
