# Fixture Corpus

This directory holds deterministic QA scaffolding for the first Healthy Bob implementation wave.

## Contents

- `minimal-vault/`: human-readable vault skeleton without unresolved `vault.json` or JSONL record payloads
- `sample-imports/`: placeholder source files for document, meal, and sample-import scenarios
- `golden-outputs/`: per-command directories reserved for future captured snapshots
- `fixture-corpus.json`: machine-readable inventory consumed by the smoke verifier

## Rules

- Do not add canonical schema fields here until the contracts/core lanes define them.
- Keep fixture inputs small, deterministic, and reviewable in plain text.
- Use golden-output directories as scaffolding only until CLI output envelopes and record shapes are frozen.
