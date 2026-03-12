# `vault-cli export pack`

Current smoke expectation:

- returns a derived `packId` plus the materialized file list
- file set contains `manifest.json`, `question-pack.json`, `records.json`, `daily-samples.json`, and `assistant-context.md`
- export packs are derived outputs, not canonical vault records
