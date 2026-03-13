# Release Notes

Use this directory for additive, dated release notes that summarize operator-visible changes, contract shifts, and verification outcomes.

## Naming

- File format: `YYYY-MM-DD-short-title.md`
- Keep titles stable and specific to the change set.

## Required Sections

- `Summary`
- `What changed`
- `Verification`
- `Follow-up` if anything remains blocked, deferred, or intentionally placeholder

## Writing Rules

- Call out whether a note is scaffold-only, contract-only, or runtime-visible.
- Reference frozen contract docs when behavior is intentionally constrained.
- Do not describe work as shipped if the owning lane has not landed runtime code yet.
- For in-flight cutovers, keep storage-model notes separate from CLI-surface notes when they can land on different timelines.
- Scaffold-only notes should name the missing contract or runtime seam explicitly so later lanes know what to replace.
- Keep notes factual and concise.
