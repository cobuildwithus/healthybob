import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = path.resolve(packageDir, '..', '..')
const packageJson = JSON.parse(
  readFileSync(path.join(packageDir, 'package.json'), 'utf8'),
) as {
  files?: string[]
  scripts?: Record<string, string>
}

describe('packages/cli release flow coverage audit', () => {
  it('exposes package-scoped release metadata and scripts', () => {
    expect(packageJson.files).toContain('CHANGELOG.md')
    expect(packageJson.scripts?.['verify:release-target']).toBe('tsx ./scripts/verify-release-target.ts')
    expect(packageJson.scripts?.['changelog:update']).toBe('bash scripts/update-changelog.sh')
    expect(packageJson.scripts?.['release:notes']).toBe('bash scripts/generate-release-notes.sh')
    expect(packageJson.scripts?.['release:patch']).toBe('bash scripts/release.sh patch')
    expect(packageJson.scripts?.['release:minor']).toBe('bash scripts/release.sh minor')
    expect(packageJson.scripts?.['release:major']).toBe('bash scripts/release.sh major')
  })

  it('keeps release:check ordered around root verification, package readiness, and pack', () => {
    expect(packageJson.scripts?.['release:check']).toBe('bash scripts/release-check.sh')

    const releaseCheck = readFileSync(
      path.join(packageDir, 'scripts', 'release-check.sh'),
      'utf8',
    )

    const expectedOrder = [
      'pnpm --dir "$REPO_ROOT" install --frozen-lockfile',
      'pnpm --dir "$REPO_ROOT" verify:cli',
      'pnpm --dir "$REPO_ROOT" docs:drift',
      'pnpm --dir "$REPO_ROOT" docs:gardening',
      'pnpm run verify:release-target',
      'pnpm build',
      'npm pack --dry-run',
    ]

    let previousIndex = -1
    for (const token of expectedOrder) {
      const nextIndex = releaseCheck.indexOf(token)
      expect(nextIndex, `missing ${token}`).toBeGreaterThan(-1)
      expect(nextIndex, `${token} out of order`).toBeGreaterThan(previousIndex)
      previousIndex = nextIndex
    }
  })

  it('targets package-local release artifacts instead of the workspace root', () => {
    const releaseScript = readFileSync(path.join(packageDir, 'scripts', 'release.sh'), 'utf8')
    const changelogScript = readFileSync(
      path.join(packageDir, 'scripts', 'update-changelog.sh'),
      'utf8',
    )
    const releaseNotesScript = readFileSync(
      path.join(packageDir, 'scripts', 'generate-release-notes.sh'),
      'utf8',
    )
    const rootDocsDrift = readFileSync(
      path.join(repoRoot, 'scripts', 'check-agent-docs-drift.sh'),
      'utf8',
    )

    expect(releaseScript).toContain("PACKAGE_JSON_PATH='packages/cli/package.json'")
    expect(releaseScript).toContain("CHANGELOG_PATH='packages/cli/CHANGELOG.md'")
    expect(releaseScript).toContain("NOTES_DIR='packages/cli/release-notes'")
    expect(releaseScript).toContain("COMMIT_CMD='scripts/committer'")
    expect(releaseScript).toContain(
      'CHECK_CMD="${HEALTHYBOB_CLI_RELEASE_CHECK_CMD:-pnpm --dir packages/cli release:check}"',
    )
    expect(releaseScript).toContain("PACKAGE_NAME='@healthybob/cli'")
    expect(releaseScript).toContain("REPOSITORY_URL='https://github.com/cobuildwithus/healthybob'")

    expect(changelogScript).toContain('packages/cli/CHANGELOG.md')
    expect(releaseNotesScript).toContain('release_tag="v$version"')
    expect(rootDocsDrift).toContain('packages/cli/CHANGELOG.md')
    expect(rootDocsDrift).toContain('packages/cli/release-notes')
  })

  it('keeps the root release wrappers as thin proxies into packages/cli', () => {
    const rootReleaseScript = readFileSync(path.join(repoRoot, 'scripts', 'release.sh'), 'utf8')
    const rootChangelogScript = readFileSync(
      path.join(repoRoot, 'scripts', 'update-changelog.sh'),
      'utf8',
    )
    const rootReleaseNotesScript = readFileSync(
      path.join(repoRoot, 'scripts', 'generate-release-notes.sh'),
      'utf8',
    )

    expect(rootReleaseScript).toContain('packages/cli/scripts/release.sh')
    expect(rootChangelogScript).toContain('packages/cli/scripts/update-changelog.sh')
    expect(rootReleaseNotesScript).toContain('packages/cli/scripts/generate-release-notes.sh')
  })
})
