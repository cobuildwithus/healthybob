Goal (incl. success criteria):
- Remove duplicated executable-resolution and missing-tool boilerplate from the parser adapters by extracting tiny shared helpers in `packages/parsers/src/shared.ts`.
- Preserve existing parser provider behavior, including provider priorities, discover reasons, run-time errors, whisper model-path handling, and ffmpeg fallback behavior.

Constraints/Assumptions:
- Keep scope to `packages/parsers/src/shared.ts`, the four parser adapter files, this plan doc, the coordination ledger, and any tests that must change if behavior gaps are found.
- Do not introduce a parser registry or broader adapter framework.
- Work on top of the current dirty tree without reverting unrelated edits.

Key decisions:
- Centralize only command resolution plus the common discover/require plumbing around `string | null` executable paths.
- Keep provider-specific messages local so existing user-facing behavior stays unchanged.

State:
- completed

Done:
- Reviewed repo instructions, parser package scope, and completion workflow requirements.
- Inspected `shared.ts` plus the duplicated command lookup patterns in PaddleOCR, pdftotext, whisper.cpp, and ffmpeg.
- Confirmed no active coordination row currently owns `packages/parsers/**`.
- Extended `resolveConfiguredExecutable` so env lookup can stay lazy without adapter-local boilerplate drift.
- Added shared availability/require helpers and updated the four adapters to use them while keeping provider-specific behavior local.
- Added parser smoke tests for the shared helper boundary plus the `pdftotext`, `whisper.cpp`, and `PaddleOCR` adapters using fake local executables.
- Verified `pnpm --dir packages/parsers typecheck` and `pnpm --dir packages/parsers test`.
- Re-ran required repo checks and recorded unrelated failures outside `packages/parsers`: `pnpm typecheck` failed in `packages/contracts` module resolution for `@healthybob/contracts/schemas`; `pnpm test` and `pnpm test:coverage` failed in `packages/cli/scripts/verify-package-shape.ts` because `test/canonical-write-lock.test.ts` still reaches into another package's `src` tree.

Now:
- Close the execution plan, remove the parser coordination row, and commit the scoped files.

Next:
- None.

Open questions (UNCONFIRMED if needed):
- None.

Working set (files/ids/commands):
- `agent-docs/exec-plans/active/COORDINATION_LEDGER.md`
- `agent-docs/exec-plans/active/2026-03-13-parser-executable-simplify.md`
- `packages/parsers/src/shared.ts`
- `packages/parsers/src/adapters/paddleocr.ts`
- `packages/parsers/src/adapters/pdftotext.ts`
- `packages/parsers/src/adapters/whisper-cpp.ts`
- `packages/parsers/src/adapters/ffmpeg.ts`
- Commands: `pnpm --dir packages/parsers test`, `pnpm typecheck`, `pnpm test`, `pnpm test:coverage`
Status: completed
Updated: 2026-03-13
Completed: 2026-03-13
