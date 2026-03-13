#!/usr/bin/env bash
name_prefix="healthybob-chatgpt-audit"
include_tests=0
include_docs=1
preset_dir="scripts/chatgpt-review-presets"
package_script="scripts/package-audit-context.sh"

if type review_gpt_register_preset >/dev/null 2>&1; then
  review_gpt_register_preset \
    "simplify" \
    "agent-docs/prompts/simplify.md" \
    "Post-change simplification pass (behavior-preserving)." \
    "complexity" \
    "complexity-simplification"

  review_gpt_register_preset \
    "test-coverage-audit" \
    "agent-docs/prompts/test-coverage-audit.md" \
    "Post-simplify test-coverage audit that adds the highest-impact missing tests." \
    "coverage" \
    "coverage-audit"

  review_gpt_register_preset \
    "task-finish-review" \
    "agent-docs/prompts/task-finish-review.md" \
    "Final completion audit for regressions, correctness, and security." \
    "finish" \
    "final-review"

  review_gpt_register_preset_group \
    "completion" \
    "Run the full completion workflow audit sequence." \
    "simplify" \
    "test-coverage-audit" \
    "task-finish-review"
fi
