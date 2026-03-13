#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOT'
Usage:
  release.sh check
  release.sh <patch|minor|major|prepatch|preminor|premajor|prerelease|x.y.z[-channel.n]> [--preid <alpha|beta|rc>] [--dry-run] [--no-push] [--allow-non-main]
EOT
}

ACTION="${1:-}"
if [ -z "$ACTION" ]; then
  usage >&2
  exit 1
fi
shift || true

PREID=""
DRY_RUN=false
PUSH_TAGS=true
ALLOW_NON_MAIN=false

while [ "$#" -gt 0 ]; do
  case "$1" in
    --preid)
      if [ "$#" -lt 2 ]; then
        echo "Error: missing value for --preid." >&2
        exit 2
      fi
      PREID="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      PUSH_TAGS=false
      shift
      ;;
    --no-push)
      PUSH_TAGS=false
      shift
      ;;
    --allow-non-main)
      ALLOW_NON_MAIN=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Error: unknown argument '$1'." >&2
      usage >&2
      exit 2
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(git -C "$PACKAGE_DIR" rev-parse --show-toplevel 2>/dev/null || cd "${PACKAGE_DIR}/../.." && pwd)"
cd "$REPO_ROOT"
unset npm_config_store_dir NPM_CONFIG_STORE_DIR || true

PACKAGE_NAME='@healthybob/cli'
REPOSITORY_URL='https://github.com/cobuildwithus/healthybob'
PACKAGE_JSON_PATH='packages/cli/package.json'
CHANGELOG_PATH='packages/cli/CHANGELOG.md'
NOTES_DIR='packages/cli/release-notes'
COMMIT_CMD='scripts/committer'
CHECK_CMD="${HEALTHYBOB_CLI_RELEASE_CHECK_CMD:-pnpm --dir packages/cli release:check}"
COMMIT_TEMPLATE='chore(release): v%s'
TAG_MESSAGE_TEMPLATE='chore(release): v%s'

assert_clean_worktree() {
  if [ -n "$(git status --porcelain)" ]; then
    echo "Error: git working tree must be clean before release." >&2
    exit 1
  fi
}

assert_main_branch() {
  if [ "$ALLOW_NON_MAIN" = true ]; then
    return
  fi
  branch="$(git rev-parse --abbrev-ref HEAD)"
  if [ "$branch" != 'main' ]; then
    echo "Error: releases must run from main (current: $branch)." >&2
    exit 1
  fi
}

assert_origin_remote() {
  if ! git remote get-url origin >/dev/null 2>&1; then
    echo "Error: git remote 'origin' is not configured." >&2
    exit 1
  fi
}

assert_package_name() {
  package_name="$(node -e "console.log(JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8')).name)" "$PACKAGE_JSON_PATH")"
  if [ "$package_name" != "$PACKAGE_NAME" ]; then
    echo "Error: unexpected package name '$package_name' (expected $PACKAGE_NAME)." >&2
    exit 1
  fi
}

assert_repository_url() {
  package_repository_url="$({
    node -e '
const pkg = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"));
const repository = pkg.repository;
if (typeof repository === "string") {
  console.log(repository);
} else if (repository && typeof repository.url === "string") {
  console.log(repository.url);
} else {
  console.log("");
}
' "$PACKAGE_JSON_PATH";
  })"

  if [ "$package_repository_url" != "$REPOSITORY_URL" ]; then
    echo "Error: unexpected package repository '$package_repository_url' (expected $REPOSITORY_URL)." >&2
    exit 1
  fi
}

run_release_checks() {
  echo 'Running release checks...'
  sh -lc "$CHECK_CMD"
}

is_exact_version() {
  local value="$1"
  [[ "$value" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-(alpha|beta|rc)\.[0-9]+)?$ ]]
}

resolve_npm_tag() {
  local version="$1"
  if [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo ''
    return 0
  fi
  if [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+-alpha\.[0-9]+$ ]]; then
    echo 'alpha'
    return 0
  fi
  if [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+-beta\.[0-9]+$ ]]; then
    echo 'beta'
    return 0
  fi
  if [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+-rc\.[0-9]+$ ]]; then
    echo 'rc'
    return 0
  fi
  echo "Unsupported release version format: $version" >&2
  exit 1
}

snapshot_file() {
  local target="$1"
  local out_var="$2"
  if [ -f "$target" ]; then
    local snapshot
    snapshot="$(mktemp)"
    cat "$target" > "$snapshot"
    printf -v "$out_var" '%s' "$snapshot"
  else
    printf -v "$out_var" ''
  fi
}

restore_file() {
  local target="$1"
  local snapshot="$2"
  if [ -n "$snapshot" ] && [ -f "$snapshot" ]; then
    cat "$snapshot" > "$target"
  else
    rm -f "$target"
  fi
}

run_commit() {
  local message="$1"
  shift
  "$COMMIT_CMD" "$message" "$@"
}

if [ "$ACTION" = 'check' ]; then
  assert_package_name
  assert_repository_url
  run_release_checks
  echo 'Release checks passed.'
  exit 0
fi

case "$ACTION" in
  patch|minor|major|prepatch|preminor|premajor|prerelease)
    ;;
  *)
    if ! is_exact_version "$ACTION"; then
      echo "Error: unsupported release action or version '$ACTION'." >&2
      usage >&2
      exit 2
    fi
    ;;
esac

if [ -n "$PREID" ] && ! [[ "$PREID" =~ ^(alpha|beta|rc)$ ]]; then
  echo 'Error: --preid must be one of alpha|beta|rc.' >&2
  exit 2
fi

case "$ACTION" in
  prepatch|preminor|premajor|prerelease)
    if [ -z "$PREID" ]; then
      echo "Error: --preid is required with $ACTION." >&2
      exit 2
    fi
    ;;
  *)
    if [ -n "$PREID" ]; then
      echo "Error: --preid is only valid with prepatch/preminor/premajor/prerelease." >&2
      exit 2
    fi
    ;;
esac

assert_clean_worktree
assert_main_branch
assert_origin_remote
assert_package_name
assert_repository_url
run_release_checks

current_version="$(node -e "console.log(JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8')).version)" "$PACKAGE_JSON_PATH")"
echo "Current version: $current_version"

package_snapshot=''
changelog_snapshot=''
notes_snapshot=''
notes_rel=''
cleanup_required=true
cleanup() {
  local status=$?
  if [ "$cleanup_required" = true ]; then
    restore_file "$PACKAGE_JSON_PATH" "$package_snapshot"
    restore_file "$CHANGELOG_PATH" "$changelog_snapshot"
    if [ -n "$notes_rel" ]; then
      restore_file "$notes_rel" "$notes_snapshot"
    fi
  fi
  rm -f "$package_snapshot" "$changelog_snapshot" "$notes_snapshot"
  exit $status
}
trap cleanup EXIT
snapshot_file "$PACKAGE_JSON_PATH" package_snapshot
snapshot_file "$CHANGELOG_PATH" changelog_snapshot

version_cmd=(npm --prefix "$PACKAGE_DIR" version "$ACTION" --no-git-tag-version)
if [ -n "$PREID" ]; then
  version_cmd+=(--preid "$PREID")
fi

next_tag="$("${version_cmd[@]}" | tail -n1 | tr -d '\r')"
next_version="${next_tag#v}"
npm_dist_tag="$(resolve_npm_tag "$next_version")"
if [ -n "$npm_dist_tag" ]; then
  echo "Release channel: $npm_dist_tag"
else
  echo 'Release channel: latest'
fi

bash "$SCRIPT_DIR/update-changelog.sh" "$next_version"

files_to_commit=("$PACKAGE_JSON_PATH" "$CHANGELOG_PATH")
previous_tag="$(git describe --tags --abbrev=0 --match 'v*' 2>/dev/null || true)"
notes_rel="$NOTES_DIR/v${next_version}.md"
snapshot_file "$notes_rel" notes_snapshot
echo "Generating release notes at $notes_rel"
if [ -n "$previous_tag" ]; then
  bash "$SCRIPT_DIR/generate-release-notes.sh" "$next_version" "$notes_rel" --from-tag "$previous_tag" --to-ref HEAD
else
  bash "$SCRIPT_DIR/generate-release-notes.sh" "$next_version" "$notes_rel" --to-ref HEAD
fi
files_to_commit+=("$notes_rel")

if [ "$DRY_RUN" = true ]; then
  echo 'Dry run only.'
  echo "Would prepare release: $PACKAGE_NAME@$next_version"
  echo "Would create tag: v$next_version"
  exit 0
fi

commit_message="$(printf "$COMMIT_TEMPLATE" "$next_version")"
tag_message="$(printf "$TAG_MESSAGE_TEMPLATE" "$next_version")"
run_commit "$commit_message" "${files_to_commit[@]}"
git tag -a "v$next_version" -m "$tag_message"

if [ "$PUSH_TAGS" = true ]; then
  branch="$(git rev-parse --abbrev-ref HEAD)"
  echo "Pushing $branch + tags to origin..."
  git push origin "$branch" --follow-tags
else
  echo 'Release prepared locally. Skipping push.'
fi

cleanup_required=false
trap - EXIT
rm -f "$package_snapshot" "$changelog_snapshot" "$notes_snapshot"

echo "Release prepared: $PACKAGE_NAME@$next_version"
echo "GitHub Actions will publish tag v$next_version to npm."
