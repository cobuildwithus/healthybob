import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

interface PackageJsonShape {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  name?: string
  private?: boolean
  repository?:
    | string
    | {
        type?: string
        url?: string
      }
}

const packageDir = fileURLToPath(new URL('../', import.meta.url))
const packageJsonPath = path.join(packageDir, 'package.json')
const packageJson = JSON.parse(
  await readFile(packageJsonPath, 'utf8'),
) as PackageJsonShape

assert(packageJson.name === '@healthybob/cli', 'release target must stay @healthybob/cli.')
assert(packageJson.private === false, 'release target must not be private.')

const repositoryUrl =
  typeof packageJson.repository === 'string'
    ? packageJson.repository
    : packageJson.repository?.url ?? ''

assert(
  repositoryUrl === 'https://github.com/cobuildwithus/healthybob',
  'release target must declare the canonical repository URL.',
)

const workspaceProtocolDeps = collectWorkspaceProtocolDeps(packageJson.dependencies)
if (workspaceProtocolDeps.length > 0) {
  throw new Error(
    `@healthybob/cli is not publish-ready: workspace protocol dependencies remain (${workspaceProtocolDeps.join(', ')}). Publish the dependent packages or replace workspace:* versions before releasing.`,
  )
}

console.log('packages/cli release target verified.')

function collectWorkspaceProtocolDeps(
  dependencies: Record<string, string> | undefined,
): string[] {
  return Object.entries(dependencies ?? {})
    .filter(([, version]) => version.startsWith('workspace:'))
    .map(([name]) => name)
    .sort()
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}
