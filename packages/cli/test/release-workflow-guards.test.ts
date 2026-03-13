import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const releaseWorkflowPath = path.join(repoRoot, '.github', 'workflows', 'release.yml')

describe('release workflow guards', () => {
  it('validates package identity from packages/cli/package.json before publish', () => {
    const workflow = readFileSync(releaseWorkflowPath, 'utf8')

    expect(workflow).toContain('PACKAGE_JSON_PATH: packages/cli/package.json')
    expect(workflow).toContain('EXPECTED_PACKAGE_NAME: "@healthybob/cli"')
    expect(workflow).toContain(
      'EXPECTED_REPOSITORY_URL: "https://github.com/cobuildwithus/healthybob"',
    )
    expect(workflow).toContain(
      'Unexpected package name ${package_name}; expected ${EXPECTED_PACKAGE_NAME}.',
    )
    expect(workflow).toContain(
      'Unexpected package repository ${package_repository_url}; expected ${EXPECTED_REPOSITORY_URL}.',
    )
    expect(workflow).toContain(
      'Tag ${tag_version} does not match ${PACKAGE_JSON_PATH} version ${package_version}.',
    )
  })

  it('runs the root release checks and packs only packages/cli', () => {
    const workflow = readFileSync(releaseWorkflowPath, 'utf8')

    expect(workflow).toContain('- name: Run release checks')
    expect(workflow).toContain('run: pnpm release:check')
    expect(workflow).toContain('cd "${PACKAGE_DIR}"')
    expect(workflow).toContain('npm pack --json --pack-destination "${GITHUB_WORKSPACE}/dist/npm"')
    expect(workflow).toContain('name: npm-tarball')
    expect(workflow).not.toContain('npm pack --json --pack-destination dist/npm')
  })

  it('keeps prerelease routing and package-local release notes generation', () => {
    const workflow = readFileSync(releaseWorkflowPath, 'utf8')

    expect(workflow).toContain('alpha')
    expect(workflow).toContain('beta')
    expect(workflow).toContain('rc')
    expect(workflow).toContain('notes_path="${PACKAGE_DIR}/release-notes/v${{ needs.tag-check.outputs.version }}.md"')
    expect(workflow).toContain('bash scripts/generate-release-notes.sh')
    expect(workflow).toContain('publish_cmd=(npm publish "${tarballs[0]}" --access public --provenance)')
    expect(workflow).toContain('Package version already published; skipping.')
  })
})
