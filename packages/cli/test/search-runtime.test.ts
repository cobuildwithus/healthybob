import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'vitest'
import { repoRoot, requireData, runCli } from './cli-test-helpers.js'

const sampleDocumentPath = path.join(
  repoRoot,
  'fixtures/sample-imports/README.md',
)

interface RetrievalFixture {
  mealId: string
  vaultRoot: string
}

async function makeRetrievalFixture(): Promise<RetrievalFixture> {
  const vaultRoot = await mkdtemp(path.join(tmpdir(), 'healthybob-cli-retrieval-'))
  const csvPath = path.join(vaultRoot, 'heart-rate.csv')

  await writeFile(
    csvPath,
    [
      'timestamp,bpm',
      '2026-03-12T18:00:00Z,61',
      '2026-03-12T20:00:00Z,77',
      '',
    ].join('\n'),
    'utf8',
  )

  const initResult = await runCli<{ created: boolean }>([
    'init',
    '--vault',
    vaultRoot,
  ])
  assert.equal(initResult.ok, true)
  assert.equal(requireData(initResult).created, true)

  const journalResult = await runCli<{ journalPath: string }>([
    'journal',
    'ensure',
    '2026-03-12',
    '--vault',
    vaultRoot,
  ])
  assert.equal(journalResult.ok, true)

  await writeFile(
    path.join(vaultRoot, requireData(journalResult).journalPath),
    `---
dayKey: 2026-03-12
title: March 12
tags:
  - focus
---
# March 12

Steady energy. Afternoon crash after pasta lunch and coffee.
`,
    'utf8',
  )

  const mealResult = await runCli<{ mealId: string }>([
    'meal',
    'add',
    '--photo',
    sampleDocumentPath,
    '--note',
    'Pasta lunch and coffee. Afternoon crash afterward.',
    '--occurred-at',
    '2026-03-12T12:15:00Z',
    '--vault',
    vaultRoot,
  ])
  assert.equal(mealResult.ok, true)

  const samplesResult = await runCli<{ lookupIds: string[] }>([
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
  assert.equal(samplesResult.ok, true)
  assert.equal(requireData(samplesResult).lookupIds.length, 2)

  return {
    mealId: requireData(mealResult).mealId,
    vaultRoot,
  }
}

test.sequential('search returns lexical hits and excludes raw sample rows by default', async () => {
  const fixture = await makeRetrievalFixture()

  try {
    const result = await runCli<{
      hits: Array<{
        recordId: string
        recordType: string
        snippet: string
      }>
      query: string
      total: number
    }>([
      'search',
      '--text',
      'afternoon crash pasta',
      '--limit',
      '10',
      '--vault',
      fixture.vaultRoot,
    ])

    assert.equal(result.ok, true)
    assert.equal(result.meta?.command, 'search')
    assert.equal(requireData(result).query, 'afternoon crash pasta')
    assert.equal(requireData(result).total, 2)
    assert.deepEqual(
      new Set(requireData(result).hits.map((hit) => hit.recordId)),
      new Set(['journal:2026-03-12', fixture.mealId]),
    )
    assert.match(requireData(result).hits[0]?.snippet ?? '', /afternoon crash|pasta/i)
    assert.equal(
      requireData(result).hits.some((hit) => hit.recordType === 'sample'),
      false,
    )
  } finally {
    await rm(fixture.vaultRoot, { recursive: true, force: true })
  }
})

test.sequential('search includes sample rows when the caller scopes by stream', async () => {
  const fixture = await makeRetrievalFixture()

  try {
    const result = await runCli<{
      hits: Array<{
        recordId: string
        recordType: string
        stream: string | null
      }>
    }>([
      'search',
      '--text',
      'heart_rate',
      '--stream',
      'heart_rate',
      '--vault',
      fixture.vaultRoot,
    ])

    assert.equal(result.ok, true)
    assert.equal(
      requireData(result).hits.some(
        (hit) => hit.recordType === 'sample' && hit.stream === 'heart_rate',
      ),
      true,
    )
  } finally {
    await rm(fixture.vaultRoot, { recursive: true, force: true })
  }
})

test.sequential('timeline merges journals, events, and sample summaries into one descending feed', async () => {
  const fixture = await makeRetrievalFixture()

  try {
    const result = await runCli<{
      items: Array<{
        entryType: string
        id: string
        stream: string | null
      }>
    }>([
      'timeline',
      '--from',
      '2026-03-12',
      '--to',
      '2026-03-12',
      '--vault',
      fixture.vaultRoot,
    ])

    assert.equal(result.ok, true)
    assert.equal(result.meta?.command, 'timeline')
    assert.deepEqual(
      requireData(result).items.slice(0, 3).map((item) => [item.entryType, item.id]),
      [
        ['sample_summary', 'sample-summary:2026-03-12:heart_rate'],
        ['event', fixture.mealId],
        ['journal', 'journal:2026-03-12'],
      ],
    )
    assert.equal(requireData(result).items[0]?.stream, 'heart_rate')
  } finally {
    await rm(fixture.vaultRoot, { recursive: true, force: true })
  }
})
