# Add review:gpt wiring for Healthy Bob

Status: completed
Created: 2026-03-12
Updated: 2026-03-12

## Goal

- Add the standard workspace `review:gpt` entrypoint to `healthybob`, verify the repo can package a source audit ZIP, and send a review to the provided ChatGPT thread URL.

## Success criteria

- `package.json` exposes a working `review:gpt` script.
- `scripts/review-gpt.config.sh` exists and follows the workspace convention.
- `pnpm zip:src` and `pnpm review:gpt --chat-url <url> --send` run successfully.
- Final handoff includes the review outcome and any findings surfaced by the review run.

## Scope

- `package.json`
- `pnpm-lock.yaml`
- `scripts/review-gpt.config.sh`
- `scripts/repo-tools.config.sh`
- any doc/index updates required by repo rules

## Constraints

- Follow `AGENTS.md` hard rules and keep the coordination ledger current.
- Do not access `.env` files.
- Reuse the shared workspace `review-gpt` package and existing repo-tools wrappers rather than inventing repo-local review logic.

## Verification

- `pnpm typecheck`
- `pnpm test`
- `pnpm test:coverage`
- `pnpm zip:src`
- `pnpm review:gpt --chat-url "https://chatgpt.com/c/69b31aab-4bd4-832c-8100-95fa98e9ba29" --send`
Completed: 2026-03-12
