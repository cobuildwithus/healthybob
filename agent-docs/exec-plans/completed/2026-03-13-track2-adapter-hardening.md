# 2026-03-13 Track 2 Adapter Hardening

## Goal

Land the parser adapter hardening slice so transcript/OCR adapters only succeed from real output artifacts, never from incidental tool logs.

## Scope

- `packages/parsers/src/adapters/whisper-cpp.ts`
- `packages/parsers/src/adapters/paddleocr.ts`
- `packages/parsers/test/parsers.test.ts`

## Constraints

- Work on top of the current dirty tree without reverting unrelated parser/runtime changes.
- Keep the change behavior-tightening and replay-safe.
- Run required completion workflow audit passes plus repo verification commands before handoff.

## Success Criteria

- `whisper.cpp` adapter requires transcript artifacts and ignores stdout/stderr as transcript text.
- PaddleOCR adapter requires structured output artifacts and ignores stdout as OCR text.
- Tests cover stdout-only failure cases for both adapters.

## Outcome

- Completed on 2026-03-13.
- Repo-level `pnpm typecheck`, `pnpm test`, and `pnpm test:coverage` were blocked by a pre-existing CLI type error in `packages/cli/src/commands/health-command-factory.ts`.
- Parser-local validation passed via `pnpm --dir packages/parsers typecheck`, `pnpm vitest run packages/parsers/test/parsers.test.ts --coverage=false`, and `pnpm test:smoke`.
