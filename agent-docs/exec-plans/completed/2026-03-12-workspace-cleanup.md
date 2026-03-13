# Workspace cleanup

Status: completed
Created: 2026-03-12
Updated: 2026-03-12

## Goal

- Finish the TypeScript-first workspace cleanup by making package-local `typecheck` scripts non-emitting and local-only, splitting the contracts library build from its package scripts build, and tightening verification so committed source/build residue is rejected.

## Success criteria

- `packages/contracts` emits its public library entrypoints to `dist/*.js` and `dist/*.d.ts`, while package scripts emit separately to `dist/scripts`.
- The workspace solution build still orders packages correctly through TypeScript project references.
- `packages/cli` and `packages/importers` `typecheck` scripts stop building sibling packages as a side effect.
- `scripts/check-no-js.ts` fails on tracked `*.tsbuildinfo`, tracked `.test-dist/`, and tracked package/e2e `dist/` residue in addition to handwritten JS-like source artifacts.
- Verification docs describe the stricter artifact guard and the package-script semantics truthfully.

## Scope

- In scope:
- contracts package config/package-shape cleanup
- local package-script cleanup for `cli` and `importers`
- workspace TS reference updates required by the contracts split
- no-source-artifact guard hardening
- verification and package-readme updates tied to the workspace cleanup
- Out of scope:
- runtime behavior changes inside active CLI/core seam files already owned by another in-flight lane
- broader test-runner standardization
- deployment/runtime target changes

## Constraints

- Follow `AGENTS.md` hard rules and keep `COORDINATION_LEDGER.md` current.
- Do not touch root `package.json` while the active CLI cleanup lane owns it.
- Preserve current package APIs and CLI/runtime behavior; this task is build/tooling cleanup, not product behavior work.
- Keep the repo policy scoped to TS-only source under `packages/` and `e2e/`; do not widen the policy to all repo scripts in this pass.

## Tasks

1. Split `packages/contracts` into dedicated typecheck, library-build, and scripts-build TS configs.
2. Update package metadata and script imports so the contracts package exports from `dist/*` cleanly.
3. Repoint workspace and package project references to the contracts build config where required.
4. Remove package-local dependency builds from `packages/cli` and `packages/importers` `typecheck`, and pin `incur`.
5. Harden the no-source-artifact guard and update verification docs to match.
6. Run required checks and completion-workflow audit passes, then commit only this task’s files.

## Risks and mitigations

1. Risk: Contracts script runtime breaks after the dist layout changes.
   Mitigation: Self-import through the package name/subpath exports and extend the contracts verification script to assert the built package shape.
2. Risk: TypeScript references stop ordering builds correctly once `packages/contracts/tsconfig.json` becomes no-emit.
   Mitigation: Point root/core build references at `packages/contracts/tsconfig.build.json` explicitly and verify with `pnpm typecheck`.
3. Risk: The stricter artifact guard fails on normal local build output.
   Mitigation: Only flag tracked `dist/`, `.test-dist/`, and `*.tsbuildinfo` paths while continuing to ignore untracked build output under `dist/`.

## Verification

- `pnpm typecheck`
- `pnpm test`
- `pnpm test:coverage`
- completion workflow audit passes:
  - `agent-docs/prompts/simplify.md`
  - `agent-docs/prompts/test-coverage-audit.md`
  - `agent-docs/prompts/task-finish-review.md`
Completed: 2026-03-12
