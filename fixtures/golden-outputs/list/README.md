# `vault-cli list`

Current smoke expectation:

- returns filtered `items` plus `nextCursor`
- baseline `nextCursor` is currently `null`
- listed ids may need conversion to a queryable lookup before `show`
