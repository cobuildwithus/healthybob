# `vault-cli meal add`

Current smoke expectation:

- `--photo` is required and `--audio` is optional
- photo-only meals remain valid and surface `audioPath: null`
- returns `mealId`, `eventId`, and a queryable `lookupId`
