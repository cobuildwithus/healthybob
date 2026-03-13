# 2026-03-12 Health JSONL Markdown Cutover Scaffold

## Summary

Prepared the downstream release-note scaffold for the health-model storage cutover. This note is scaffold-only until the health contract and runtime lanes land.

## What changed

- Reserved the health cutover around the existing hybrid storage model instead of replacing it:
  - Markdown remains the curated current-state layer for profile and the bank registries.
  - JSONL remains the append-only machine-history layer for assessments, profile snapshots, timed events, samples, and audit.
- Captured the intended health seams from the active cutover plan:
  - `bank/profile/current.md` stays derived from profile snapshots.
  - timed health history extends `ledger/events` rather than creating a parallel history ledger.
  - intake provenance stays split between immutable `raw/assessments` inputs and append-only assessment ledgers.
- Marked the downstream dependencies that still have to land before this note can describe shipped behavior:
  - frozen vault-layout paths
  - health schema names, versions, and generated artifacts
  - operator-visible examples and fixture-backed outcomes

## Verification

- Docs-only reconciliation against the active health cutover plan and the current frozen baseline invariants.

## Follow-up

- Replace this scaffold with concrete storage paths and examples after the contract lane updates `docs/contracts/01-vault-layout.md` and `docs/contracts/02-record-schemas.md`.
- Add runtime verification results after the source lanes land fixtures, smoke scenarios, and package-level checks for the health cutover.
