# Security

Last verified: 2026-03-12

## Non-Negotiable Rules

- Never read or expose `.env` contents, tokens, private keys, or raw credentials.
- Redact sensitive identifiers from logs, fixtures, examples, and screenshots.
- Treat all auth, wallet, payment, and health-related data flows as high-sensitivity until documented otherwise.

## Bootstrap Security Posture

- No runtime trust boundary is implemented yet.
- Before adding external APIs, auth, wallets, storage, or webhooks, document the trust boundary in `ARCHITECTURE.md` and the concrete rules here.
- Prefer least-privilege defaults and explicit validation at system boundaries.
