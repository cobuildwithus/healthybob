# 2026-03-13 Health Entity Registry

Goal (incl. success criteria):
- Collapse repeated health-entity metadata into one shared `HealthEntityDefinition` registry that query and CLI layers both consume first.
- Reduce noun-specific CLI command boilerplate so simple health command modules become descriptor-driven shells over the existing shared factory.
- Preserve current CLI/query behavior while avoiding the actively modified service-layer, core-bank, and docs surfaces owned by other lanes.

Constraints/Assumptions:
- Work on top of the current dirty tree without reverting unrelated edits.
- Avoid `packages/cli/src/commands/health-command-factory.ts`, `packages/cli/src/vault-cli-services.ts`, `packages/core/src/bank/**`, and owned docs in this pass.
- Treat the clean contracts/query registry files as safe to refactor for this user-directed lane even though older active ledger rows still mention broader packages.

Key decisions:
- Put the shared entity registry in `packages/contracts` so query and CLI can import the same noun/prefix/lookup/template/registry metadata without cross-package cycles.
- Keep CLI runtime/service-method strings local in the CLI descriptor layer; only shared entity semantics move to contracts.
- Add a descriptor-driven health command-registration helper in a new unowned CLI file instead of editing the currently owned shared factory or service layer.
- Preserve projected-registry compatibility by keeping regimen path-derived grouping and legacy family/genetics aliases in the entity-to-record fallback path.

State:
- completed

Done:
- Read the required repo guidance and completion workflow docs.
- Inspected the current duplicated health wiring across core/query/CLI surfaces.
- Mapped the active ownership conflicts and narrowed this pass to the clean registry/descriptor/command files plus a new helper.
- Added the shared contracts registry, switched query registry definitions to build from it, and moved noun-specific CLI command wiring onto descriptor-driven registration.
- Updated package-local contracts build/typecheck/test wiring so CLI/query source can consume the shared contracts registry through built artifacts.
- Fixed review regressions around projected regimen grouping and legacy family/genetics aliases.
- Added CLI regression coverage for the shared `history-ledger` upsert result branch.
- Ran targeted package verification plus the required top-level checks.

Now:
- None.

Next:
- If a later lane is free to touch the service layer, move the remaining orchestration in `vault-cli-services.ts` into a dedicated app/use-cases package.

Open questions (UNCONFIRMED if needed):
- UNCONFIRMED: whether the canonical query lane should also deduplicate the remaining entity-to-record mappers in `packages/query/src/health/registries.ts` against the shared registry transforms.

Working set (files/ids/commands):
- `agent-docs/exec-plans/active/COORDINATION_LEDGER.md`
- `agent-docs/exec-plans/completed/2026-03-13-health-entity-registry.md`
- `packages/contracts/package.json`
- `packages/contracts/src/index.ts`
- `packages/contracts/src/health-entities.ts`
- `packages/query/package.json`
- `packages/query/src/health/registries.ts`
- `packages/cli/package.json`
- `packages/cli/tsconfig.json`
- `packages/cli/tsconfig.typecheck.json`
- `packages/cli/src/health-cli-descriptors.ts`
- `packages/cli/src/commands/allergy.ts`
- `packages/cli/src/commands/condition.ts`
- `packages/cli/src/commands/family.ts`
- `packages/cli/src/commands/genetics.ts`
- `packages/cli/src/commands/goal.ts`
- `packages/cli/src/commands/history.ts`
- `packages/cli/src/commands/profile.ts`
- `packages/cli/src/commands/regimen.ts`
- `packages/cli/src/commands/health-entity-command-registry.ts`
- `packages/cli/test/health-tail.test.ts`
- Commands: `pnpm --dir packages/contracts test`, `pnpm --dir packages/query typecheck`, `pnpm --dir packages/query test`, `pnpm --dir packages/cli typecheck`, `pnpm exec vitest run packages/cli/test/health-tail.test.ts --no-coverage --maxWorkers 1`, `pnpm typecheck`, `pnpm test`, `pnpm test:coverage`
