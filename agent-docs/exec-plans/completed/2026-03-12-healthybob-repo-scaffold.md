# Bootstrap Healthy Bob repo harness

Status: completed
Created: 2026-03-12
Updated: 2026-03-12

## Goal

- Install the same repo-local harness shape used in the established workspace repos, tailored for an empty bootstrap repo.

## Success criteria

- `healthybob` has repo-local routing docs (`AGENTS.md`, `ARCHITECTURE.md`, `agent-docs/**`).
- `healthybob` has thin shared-tool wrappers under `scripts/`.
- Bootstrap verification commands run successfully.
- Workspace repo map lists `healthybob` so future routing can discover it.

## Scope

- In scope:
  - repo bootstrap docs and workflow rules
  - repo-tools wrappers/config
  - bootstrap `package.json` and `.gitignore`
  - workspace repo-map registration
- Out of scope:
  - product/runtime implementation
  - repo-specific CI workflows
  - release/publish automation

## Constraints

- Technical constraints:
  - repo is empty and not yet product-shaped
  - reuse shared repo-tools patterns where possible
- Product/process constraints:
  - do not guess product behavior from the repo name
  - keep verification rules truthful for the current bootstrap state

## Risks and mitigations

1. Risk:
   Overfitting the scaffold to another repo's domain-specific rules.
   Mitigation:
   Keep only the shared harness pieces and document unknown product details as `UNCONFIRMED`.

2. Risk:
   Bootstrap checks drift from the actual empty-repo state.
   Mitigation:
   Define temporary but truthful bootstrap commands and document when they must be replaced.

## Tasks

1. Inspect full-harness repos and repo-tools for shared scaffolding patterns.
2. Create repo-local docs, plan storage, and prompts for `healthybob`.
3. Add repo-tools wrappers/config and bootstrap package metadata.
4. Register `healthybob` in workspace repo discovery docs.
5. Run bootstrap verification and fix any drift findings.

## Decisions

- Use a bootstrap verification lane based on shell syntax plus docs drift/gardening until real code tooling exists.
- Do not add repo-specific CI or release automation before the repo's runtime role is documented.

## Verification

- Commands to run:
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm test:coverage`
- Expected outcomes:
  - all bootstrap verification commands pass
Completed: 2026-03-12
