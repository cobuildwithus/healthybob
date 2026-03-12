# Healthy Bob Architecture

Last verified: 2026-03-12

## Current State

This repository is currently a bootstrap harness only. It has workflow docs, execution-plan storage, and shared repo-tools wrappers, but no product/runtime modules yet.

## Source Of Truth

- Process and routing rules: `AGENTS.md`
- Durable repository docs: `agent-docs/index.md`
- Verification/runtime policy: `agent-docs/operations/verification-and-runtime.md`

## Intended Evolution

When the first production subsystem is added, update this file in the same change with:

1. The top-level module map.
2. Data and control-flow boundaries.
3. External systems and trust boundaries.
4. Runtime entrypoints and verification commands.

## Bootstrap Boundaries

- Do not infer product behavior from the repository name alone.
- Treat all domain assumptions as `UNCONFIRMED` until a product-spec doc says otherwise.
- Keep the first implementation simple enough that docs and ownership boundaries stay current.
