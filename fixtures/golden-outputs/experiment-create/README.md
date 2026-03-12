# `vault-cli experiment create`

Current smoke expectation:

- returns `experimentId`, `lookupId`, `slug`, and `experimentPath`
- may return `created: false` on idempotent retries
- repeated matching creates keep the same experiment identity
