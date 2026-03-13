import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { test } from 'vitest'
import { commandOutputFromError, repoRoot } from './cli-test-helpers.js'

const execFileAsync = promisify(execFile)
const sourceBinPath = path.join(repoRoot, 'packages/cli/src/bin.ts')

interface CliSuccessEnvelope<TData = Record<string, unknown>> {
  ok: true
  data: TData
  meta: {
    command: string
    duration: string
  }
}

type CliEnvelope<TData = Record<string, unknown>> =
  | CliSuccessEnvelope<TData>
  | {
      ok: false
      error: {
        code?: string
        message?: string
      }
      meta: {
        command: string
        duration: string
      }
    }

async function runSourceCli<TData = Record<string, unknown>>(
  args: string[],
): Promise<CliEnvelope<TData>> {
  try {
    const { stdout } = await execFileAsync(
      'pnpm',
      ['exec', 'tsx', sourceBinPath, ...withMachineOutput(args)],
      { cwd: repoRoot },
    )

    return JSON.parse(stdout) as CliEnvelope<TData>
  } catch (error) {
    const output = commandOutputFromError(error)
    if (output !== null) {
      return JSON.parse(output) as CliEnvelope<TData>
    }

    throw error
  }
}

async function runRawSourceCli(args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      'pnpm',
      ['exec', 'tsx', sourceBinPath, ...args],
      { cwd: repoRoot },
    )

    return stdout.trim()
  } catch (error) {
    const output = commandOutputFromError(error)
    if (output !== null) {
      return output
    }

    throw error
  }
}

function requireData<TData>(result: CliEnvelope<TData>): TData {
  if (!result.ok) {
    throw new Error(
      `CLI result failed: ${result.error.message ?? result.error.code ?? 'unknown error'}`,
    )
  }

  return result.data
}

function withMachineOutput(args: string[]): string[] {
  const nextArgs = [...args]

  if (!nextArgs.includes('--verbose')) {
    nextArgs.push('--verbose')
  }

  if (!nextArgs.includes('--json') && !nextArgs.includes('--format')) {
    nextArgs.push('--format', 'json')
  }

  return nextArgs
}

test('list help and schemas no longer expose cursor pagination options', async () => {
  const help = await runRawSourceCli(['goal', 'list', '--help'])
  const profileHelp = await runRawSourceCli(['profile', 'list', '--help'])
  const historyHelp = await runRawSourceCli(['history', 'list', '--help'])
  const readSchema = JSON.parse(
    await runRawSourceCli(['list', '--schema', '--format', 'json']),
  ) as {
    options: {
      properties: Record<string, unknown>
    }
  }
  const intakeSchema = JSON.parse(
    await runRawSourceCli(['intake', 'list', '--schema', '--format', 'json']),
  ) as {
    options: {
      properties: Record<string, unknown>
    }
  }

  assert.doesNotMatch(help, /--cursor/u)
  assert.doesNotMatch(help, /next-page token/u)
  assert.match(profileHelp, /--from/u)
  assert.match(profileHelp, /--to/u)
  assert.match(historyHelp, /--kind/u)
  assert.match(historyHelp, /--from/u)
  assert.match(historyHelp, /--to/u)
  assert.equal('cursor' in readSchema.options.properties, false)
  assert.equal('recordType' in readSchema.options.properties, true)
  assert.equal('status' in readSchema.options.properties, true)
  assert.equal('stream' in readSchema.options.properties, true)
  assert.equal('tag' in readSchema.options.properties, true)
  assert.equal('from' in readSchema.options.properties, true)
  assert.equal('to' in readSchema.options.properties, true)
  assert.equal('dateFrom' in readSchema.options.properties, false)
  assert.equal('dateTo' in readSchema.options.properties, false)
  assert.equal('cursor' in intakeSchema.options.properties, false)
  assert.equal('from' in intakeSchema.options.properties, true)
  assert.equal('to' in intakeSchema.options.properties, true)
  assert.equal('dateFrom' in intakeSchema.options.properties, false)
  assert.equal('dateTo' in intakeSchema.options.properties, false)
})

test.sequential('list commands still run after cursor removal', async () => {
  const vaultRoot = await mkdtemp(path.join(tmpdir(), 'healthybob-cli-list-'))

  try {
    const initResult = await runSourceCli<{ created: boolean }>(['init', '--vault', vaultRoot])
    assert.equal(initResult.ok, true)
    assert.equal(requireData(initResult).created, true)

    const readList = await runSourceCli<{
      count: number
      filters: Record<string, unknown>
      nextCursor: string | null
    }>([
      'list',
      '--limit',
      '5',
      '--vault',
      vaultRoot,
    ])
    assert.equal(readList.ok, true)
    assert.equal(readList.meta?.command, 'list')
    assert.equal(requireData(readList).count, 0)
    assert.equal('cursor' in requireData(readList).filters, false)
    assert.equal(requireData(readList).nextCursor, null)

    const intakeList = await runSourceCli<{
      count: number
      filters: Record<string, unknown>
      nextCursor: string | null
    }>([
      'intake',
      'list',
      '--limit',
      '5',
      '--vault',
      vaultRoot,
    ])
    assert.equal(intakeList.ok, true)
    assert.equal(intakeList.meta?.command, 'intake list')
    assert.equal(requireData(intakeList).count, 0)
    assert.equal('cursor' in requireData(intakeList).filters, false)
    assert.equal(requireData(intakeList).nextCursor, null)

    const goalList = await runSourceCli<{
      count: number
      items: unknown[]
    }>([
      'goal',
      'list',
      '--limit',
      '5',
      '--vault',
      vaultRoot,
    ])
    assert.equal(goalList.ok, true)
    assert.equal(goalList.meta?.command, 'goal list')
    assert.equal(requireData(goalList).count, 0)
    assert.deepEqual(requireData(goalList).items, [])
  } finally {
    await rm(vaultRoot, { recursive: true, force: true })
  }
})

test.sequential('generic list exposes record-type, status, stream, and tag filter parity', async () => {
  const vaultRoot = await mkdtemp(path.join(tmpdir(), 'healthybob-cli-list-'))
  const csvPath = path.join(vaultRoot, 'samples.csv')
  const experimentPath = path.join(
    vaultRoot,
    'bank/experiments/sleep-window.md',
  )
  const experimentId = 'exp_01JNY0B2W4VG5C2A0G9S8M7R6Q'

  try {
    const initResult = await runSourceCli<{ created: boolean }>(['init', '--vault', vaultRoot])
    assert.equal(initResult.ok, true)
    assert.equal(requireData(initResult).created, true)

    await writeFile(
      experimentPath,
      [
        '---',
        'schemaVersion: "1.0"',
        'docType: experiment',
        `experimentId: ${experimentId}`,
        'slug: sleep-window',
        'status: paused',
        'title: Sleep Window',
        'startedOn: 2026-03-12',
        'tags:',
        '  - energy',
        '  - sleep',
        '---',
        '',
        '# Sleep Window',
        '',
        'Notes.',
        '',
      ].join('\n'),
      'utf8',
    )

    await writeFile(
      csvPath,
      [
        'timestamp,bpm',
        '2026-03-12T08:00:00Z,61',
        '2026-03-12T08:01:00Z,63',
        '',
      ].join('\n'),
      'utf8',
    )

    const importResult = await runSourceCli<{ importedCount: number }>([
      'samples',
      'import-csv',
      csvPath,
      '--stream',
      'heart_rate',
      '--ts-column',
      'timestamp',
      '--value-column',
      'bpm',
      '--unit',
      'bpm',
      '--vault',
      vaultRoot,
    ])
    assert.equal(importResult.ok, true)
    assert.equal(requireData(importResult).importedCount, 2)

    const experimentList = await runSourceCli<{
      filters: {
        recordType?: string[]
        status?: string
        tag?: string[]
      }
      items: Array<{
        id: string
        kind: string
      }>
    }>([
      'list',
      '--record-type',
      'experiment',
      '--record-type',
      'goal',
      '--status',
      'paused',
      '--tag',
      'energy',
      '--tag',
      'sleep',
      '--vault',
      vaultRoot,
    ])
    assert.equal(experimentList.ok, true)
    assert.deepEqual(requireData(experimentList).filters.recordType, [
      'experiment',
      'goal',
    ])
    assert.equal(requireData(experimentList).filters.status, 'paused')
    assert.deepEqual(requireData(experimentList).filters.tag, [
      'energy',
      'sleep',
    ])
    assert.equal(requireData(experimentList).items.length, 1)
    assert.equal(requireData(experimentList).items[0]?.id, experimentId)
    assert.equal(requireData(experimentList).items[0]?.kind, 'experiment')

    const sampleList = await runSourceCli<{
      filters: {
        recordType?: string[]
        stream?: string[]
      }
      items: Array<{
        id: string
        kind: string
      }>
    }>([
      'list',
      '--record-type',
      'sample',
      '--record-type',
      'event',
      '--stream',
      'heart_rate',
      '--stream',
      'glucose',
      '--vault',
      vaultRoot,
    ])
    assert.equal(sampleList.ok, true)
    assert.deepEqual(requireData(sampleList).filters.recordType, [
      'sample',
      'event',
    ])
    assert.deepEqual(requireData(sampleList).filters.stream, [
      'heart_rate',
      'glucose',
    ])
    assert.equal(requireData(sampleList).items.length, 2)
    assert.equal(
      requireData(sampleList).items.every((item) => item.kind === 'sample'),
      true,
    )
  } finally {
    await rm(vaultRoot, { recursive: true, force: true })
  }
})

test.sequential('generic list rejects comma-delimited repeatable filter tokens', async () => {
  const result = await runSourceCli([
    'list',
    '--record-type',
    'sample,event',
    '--vault',
    path.join(repoRoot, 'fixtures/minimal-vault'),
  ])

  assert.equal(result.ok, false)
  assert.match(
    result.error.message ?? '',
    /comma-delimited values are not supported.*repeat the flag instead/ui,
  )
})
