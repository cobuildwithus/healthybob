Goal (incl. success criteria):
- Relax repo coordination rules so active ledger rows signal in-flight work rather than acting as default file locks.
- Keep the ledger mandatory, but require explicit notes for exclusive/refactor lanes.

Constraints/Assumptions:
- Process/docs-only change; do not broaden into unrelated cleanup.
- Preserve the existing requirement to register active coding work before editing.

Key decisions:
- Keep file and symbol scope in ledger rows because they are still useful coordination context.
- Change the default from exclusive ownership to mindful overlap.
- Make exclusive lanes opt-in via explicit notes instead of implicit via any overlapping file mention.

State:
- done

Done:
- Reviewed the repo hard rules, completion workflow, prompts, and active ledger wording.
- Confirmed the current process stalls because the docs describe exclusive ownership while several active rows already allow overlap.
- Updated the repo process docs and prompt templates to make overlap the default and exclusivity opt-in.
- Ran `pnpm typecheck`, `pnpm test`, and `pnpm test:coverage`; the docs drift failure was fixed, while the remaining package/build failures were pre-existing and outside this docs-only scope.

Now:
- None.

Next:
- Move this plan to completed storage and commit the scoped docs with the recorded check outcomes.

Open questions (UNCONFIRMED if needed):
- UNCONFIRMED: Whether follow-up cleanup should normalize older active plan docs that still say "owned by" even when overlap would now be acceptable.

Working set (files/ids/commands):
- `AGENTS.md`
- `agent-docs/index.md`
- `agent-docs/operations/completion-workflow.md`
- `agent-docs/prompts/simplify.md`
- `agent-docs/prompts/test-coverage-audit.md`
- `agent-docs/prompts/task-finish-review.md`
- `agent-docs/exec-plans/active/README.md`
- `agent-docs/exec-plans/active/COORDINATION_LEDGER.md`
- `agent-docs/exec-plans/active/2026-03-13-coordination-policy-soften.md`
- Commands: `pnpm typecheck`, `pnpm test`, `pnpm test:coverage`
Status: completed
Updated: 2026-03-13
Completed: 2026-03-13
