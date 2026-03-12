# Error Codes

Status: frozen baseline

These are the shared contract-level validation codes defined in `packages/contracts/src/constants.js`.

| Code | Meaning |
| --- | --- |
| `HB_CONTRACT_INVALID` | A payload failed the frozen contract shape. |
| `HB_ID_INVALID` | An ID missed the frozen prefix plus ULID format. |
| `HB_PATH_INVALID` | A stored path was absolute, escaped the vault root, or missed its path family. |
| `HB_VAULT_INVALID` | `vault.json` failed validation. |
| `HB_EVENT_INVALID` | An event record failed validation. |
| `HB_SAMPLE_INVALID` | A sample record failed validation. |
| `HB_AUDIT_INVALID` | An audit record failed validation. |
| `HB_FRONTMATTER_INVALID` | A Markdown frontmatter block failed validation. |
| `HB_ENUM_UNSUPPORTED` | A value fell outside the frozen baseline enums. |
| `HB_SHARD_KEY_INVALID` | A day key or monthly shard key failed format validation. |
| `HB_SCHEMA_ARTIFACT_STALE` | Generated JSON Schema artifacts are missing or stale. |

## Rules

- Contract validation fails closed.
- Baseline codes are not retryable.
- Higher layers may add context, but they should not change the meaning of these codes.
