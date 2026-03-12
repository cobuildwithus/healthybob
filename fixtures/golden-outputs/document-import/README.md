# `vault-cli document import`

Current smoke expectation:

- returns `documentId`, `eventId`, and a queryable `lookupId`
- `lookupId` is the follow-on `show` target, not `documentId`
- copies the source into `raw/documents/...`
