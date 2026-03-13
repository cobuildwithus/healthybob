#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(git -C "$PACKAGE_DIR" rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$PACKAGE_DIR"

pnpm --dir "$REPO_ROOT" install --frozen-lockfile
pnpm --dir "$REPO_ROOT" verify:cli
pnpm --dir "$REPO_ROOT" docs:drift
pnpm --dir "$REPO_ROOT" docs:gardening
pnpm run verify:release-target
pnpm build
bash -n scripts/release-check.sh scripts/release.sh scripts/update-changelog.sh scripts/generate-release-notes.sh
npm pack --dry-run
