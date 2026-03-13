# `@healthybob/query`

Owns read helpers, filters, and export-pack generation over canonical vault state. Query code must not mutate canonical vault data.

The first retrieval milestone now lives here too: lexical `searchVault()` over the read model plus `buildTimeline()` for descending journal/event/sample-summary context.
