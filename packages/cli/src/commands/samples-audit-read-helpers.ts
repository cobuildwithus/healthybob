import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { loadRuntimeModule } from '../runtime-import.js'
import { VaultCliError } from '../vault-cli-errors.js'

type JsonObject = Record<string, unknown>

interface QueryRecord {
  displayId: string
  primaryLookupId: string
  lookupIds: string[]
  recordType: string
  sourcePath: string
  occurredAt: string | null
  date: string | null
  kind: string | null
  status?: string | null
  stream: string | null
  experimentSlug: string | null
  title: string | null
  tags: string[]
  data: JsonObject
  body: string | null
  frontmatter: JsonObject | null
  relatedIds?: string[]
}

interface QueryReadModel {
  records: QueryRecord[]
  samples: QueryRecord[]
  audits: QueryRecord[]
}

interface QueryRuntimeModule {
  readVault(vaultRoot: string): Promise<QueryReadModel>
  lookupRecordById(vault: QueryReadModel, recordId: string): QueryRecord | null
  listRecords(
    vault: QueryReadModel,
    filters?: {
      ids?: string[]
      recordTypes?: string[]
      kinds?: string[]
      streams?: string[]
      experimentSlug?: string
      date?: string
      from?: string
      to?: string
      tags?: string[]
      text?: string
    },
  ): QueryRecord[]
}

interface SamplesImporterRuntimeResult {
  count: number
  records: Array<{
    id: string
  }>
  transformId: string
  manifestPath: string
  shardPaths: string[]
}

interface SamplesImporterPayload {
  stream: string
}

interface ImportersRuntimeModule {
  createImporters(): {
    importCsvSamples(input: unknown): Promise<SamplesImporterRuntimeResult>
  }
  prepareCsvSampleImport(input: unknown): Promise<SamplesImporterPayload>
}

interface SampleBatchManifest {
  importId?: string
  importedAt?: string
  source?: string | null
  rawDirectory?: string
  provenance?: JsonObject
  artifacts?: unknown[]
}

export interface CommandEntityLink {
  id: string
  kind: string
  queryable: boolean
}

export interface CommandShowEntity {
  id: string
  kind: string
  title: string | null
  occurredAt: string | null
  path: string | null
  markdown: string | null
  data: JsonObject
  links: CommandEntityLink[]
}

export interface CommandListItem {
  id: string
  kind: string
  title: string | null
  occurredAt: string | null
  path: string | null
}

export interface SampleCommandListItem extends CommandListItem {
  quality: string | null
  stream: string | null
}

export interface AuditCommandListItem extends CommandListItem {
  action: string | null
  actor: string | null
  status: string | null
  commandName: string | null
  summary: string | null
}

export interface SampleBatchDetails {
  batchId: string
  stream: string | null
  manifestFile: string
  rawDirectory: string | null
  importedAt: string | null
  source: string | null
  importedCount: number | null
  sampleIds: string[]
  importConfig: JsonObject
  artifacts: JsonObject[]
  manifest: JsonObject
}

export interface SampleBatchListOptions {
  from?: string
  to?: string
  limit?: number
  stream?: string
}

export interface SampleListOptions {
  from?: string
  limit?: number
  quality?: string
  stream?: string
  to?: string
}

export interface AuditListOptions {
  action?: string
  actor?: string
  from?: string
  limit?: number
  status?: string
  to?: string
}

export interface ImportCsvSamplesOptions {
  delimiter?: string
  file: string
  metadataColumns?: string[]
  presetId?: string
  requestId?: string | null
  source?: string
  stream?: string
  tsColumn?: string
  unit?: string
  valueColumn?: string
  vault: string
}

let queryRuntimePromise: Promise<QueryRuntimeModule> | null = null
let importersRuntimePromise: Promise<ImportersRuntimeModule> | null = null

export async function importCsvSamples(
  options: ImportCsvSamplesOptions,
) {
  const importers = await loadImportersRuntime()
  const normalized = await importers.prepareCsvSampleImport({
    delimiter: options.delimiter,
    filePath: options.file,
    metadataColumns: options.metadataColumns,
    presetId: options.presetId,
    requestId: options.requestId,
    source: options.source,
    stream: options.stream,
    tsColumn: options.tsColumn,
    unit: options.unit,
    valueColumn: options.valueColumn,
    vaultRoot: options.vault,
  })
  const result = await importers.createImporters().importCsvSamples({
    delimiter: options.delimiter,
    filePath: options.file,
    metadataColumns: options.metadataColumns,
    presetId: options.presetId,
    requestId: options.requestId,
    source: options.source,
    stream: options.stream,
    tsColumn: options.tsColumn,
    unit: options.unit,
    valueColumn: options.valueColumn,
    vaultRoot: options.vault,
  })

  return {
    vault: options.vault,
    sourceFile: options.file,
    stream: normalized.stream,
    importedCount: result.count,
    transformId: result.transformId,
    manifestFile: result.manifestPath,
    lookupIds: result.records.map((record) => record.id),
    ledgerFiles: result.shardPaths,
  }
}

export async function showSample(
  vaultRoot: string,
  sampleId: string,
): Promise<CommandShowEntity> {
  const query = await loadQueryRuntime()
  const vault = await query.readVault(vaultRoot)
  const record = query.lookupRecordById(vault, sampleId)

  if (!record || record.recordType !== 'sample') {
    throw new VaultCliError('not_found', `No sample found for "${sampleId}".`)
  }

  return toCommandShowEntity(record)
}

export async function listSamples(
  vaultRoot: string,
  options: SampleListOptions = {},
): Promise<SampleCommandListItem[]> {
  const query = await loadQueryRuntime()
  const vault = await query.readVault(vaultRoot)
  const items = query
    .listRecords(vault, {
      from: options.from,
      recordTypes: ['sample'],
      streams: options.stream ? [options.stream] : undefined,
      to: options.to,
    })
    .filter((record) => (options.quality ? record.status === options.quality : true))
    .sort(compareByLatest)

  return applyLimit(items, options.limit).map(toSampleCommandListItem)
}

export async function showAudit(
  vaultRoot: string,
  auditId: string,
): Promise<CommandShowEntity> {
  const query = await loadQueryRuntime()
  const vault = await query.readVault(vaultRoot)
  const record = query.lookupRecordById(vault, auditId)

  if (!record || record.recordType !== 'audit') {
    throw new VaultCliError('not_found', `No audit record found for "${auditId}".`)
  }

  return toCommandShowEntity(record, ['targetIds'])
}

export async function listAudits(
  vaultRoot: string,
  options: AuditListOptions = {},
): Promise<AuditCommandListItem[]> {
  const query = await loadQueryRuntime()
  const vault = await query.readVault(vaultRoot)
  const audits = [...vault.audits]
    .filter((record) => matchesOptionalString(firstString(record.data, ['action']), options.action))
    .filter((record) => matchesOptionalString(firstString(record.data, ['actor']), options.actor))
    .filter((record) => matchesOptionalString(record.status ?? null, options.status))
    .filter((record) => matchesDateRange(record.occurredAt, options.from, options.to))
    .sort(compareByLatest)

  return applyLimit(audits, options.limit).map(toAuditCommandListItem)
}

export async function tailAudits(
  vaultRoot: string,
  limit = 20,
): Promise<AuditCommandListItem[]> {
  return listAudits(vaultRoot, { limit })
}

export async function showSampleBatch(
  vaultRoot: string,
  batchId: string,
): Promise<SampleBatchDetails> {
  const details = await findSampleBatch(vaultRoot, batchId)

  if (!details) {
    throw new VaultCliError('not_found', `No sample batch found for "${batchId}".`)
  }

  return details
}

export async function listSampleBatches(
  vaultRoot: string,
  options: SampleBatchListOptions = {},
): Promise<SampleBatchDetails[]> {
  const manifestFiles = await walkSampleManifestFiles(vaultRoot)
  const batches = (
    await Promise.all(
      manifestFiles.map((manifestFile) => readSampleBatchManifest(vaultRoot, manifestFile)),
    )
  )
    .filter((batch): batch is SampleBatchDetails => batch !== null)
    .filter((batch) => (options.stream ? batch.stream === options.stream : true))
    .filter((batch) => matchesDateRange(batch.importedAt, options.from, options.to))
    .sort((left, right) => compareNullableDates(right.importedAt, left.importedAt))

  return applyLimit(batches, options.limit)
}

async function findSampleBatch(
  vaultRoot: string,
  batchId: string,
): Promise<SampleBatchDetails | null> {
  const manifestFiles = await walkSampleManifestFiles(vaultRoot)

  for (const manifestFile of manifestFiles) {
    const batch = await readSampleBatchManifest(vaultRoot, manifestFile)
    if (batch?.batchId === batchId) {
      return batch
    }
  }

  return null
}

async function readSampleBatchManifest(
  vaultRoot: string,
  manifestFile: string,
): Promise<SampleBatchDetails | null> {
  const manifest = await readJsonObject(
    path.join(vaultRoot, manifestFile),
    `sample batch manifest "${manifestFile}"`,
  )
  const batchId =
    firstString(manifest, ['importId']) ??
    manifestFile.split('/').at(-2) ??
    null

  if (!batchId) {
    return null
  }

  const provenance = asObject(manifest.provenance)
  const artifacts = Array.isArray(manifest.artifacts)
    ? manifest.artifacts.map((artifact) => asObject(artifact)).filter(isJsonObject)
    : []
  const sampleIds = arrayOfStrings(provenance?.sampleIds)
  const importConfig = asObject(provenance?.importConfig) ?? {}

  return {
    batchId,
    stream: inferSampleStream(manifestFile, manifest),
    manifestFile,
    rawDirectory: firstString(manifest, ['rawDirectory']),
    importedAt: firstString(manifest, ['importedAt']),
    source: nullableString(manifest.source),
    importedCount: numberOrNull(provenance?.importedCount),
    sampleIds,
    importConfig,
    artifacts,
    manifest,
  }
}

async function walkSampleManifestFiles(vaultRoot: string): Promise<string[]> {
  const root = path.join(vaultRoot, 'raw', 'samples')
  return walkRelativeFiles(root, 'raw/samples')
}

async function walkRelativeFiles(
  absoluteDirectory: string,
  relativeDirectory: string,
): Promise<string[]> {
  let entries

  try {
    entries = await readdir(absoluteDirectory, { withFileTypes: true })
  } catch (error) {
    if (isMissingPathError(error)) {
      return []
    }

    throw error
  }

  const files: string[] = []

  for (const entry of entries) {
    const absolutePath = path.join(absoluteDirectory, entry.name)
    const relativePath = path.posix.join(relativeDirectory, entry.name)

    if (entry.isDirectory()) {
      files.push(...(await walkRelativeFiles(absolutePath, relativePath)))
      continue
    }

    if (entry.isFile() && entry.name === 'manifest.json') {
      files.push(relativePath)
    }
  }

  return files.sort()
}

function toCommandShowEntity(
  record: QueryRecord,
  extraLinkKeys: string[] = [],
): CommandShowEntity {
  return {
    id: record.displayId || record.primaryLookupId,
    kind: record.kind ?? record.recordType,
    title: record.title ?? null,
    occurredAt: record.occurredAt ?? null,
    path: record.sourcePath ?? null,
    markdown: record.body ?? null,
    data: record.data,
    links: toCommandEntityLinks(record, extraLinkKeys),
  }
}

function toCommandListItem(record: QueryRecord): CommandListItem {
  return {
    id: record.displayId || record.primaryLookupId,
    kind: record.kind ?? record.recordType,
    title: record.title ?? null,
    occurredAt: record.occurredAt ?? null,
    path: record.sourcePath ?? null,
  }
}

function toSampleCommandListItem(record: QueryRecord): SampleCommandListItem {
  return {
    ...toCommandListItem(record),
    quality: record.status ?? null,
    stream: record.stream ?? null,
  }
}

function toAuditCommandListItem(record: QueryRecord): AuditCommandListItem {
  return {
    ...toCommandListItem(record),
    action: firstString(record.data, ['action']),
    actor: firstString(record.data, ['actor']),
    status: record.status ?? null,
    commandName: firstString(record.data, ['commandName', 'command_name']),
    summary: firstString(record.data, ['summary']),
  }
}

async function loadQueryRuntime(): Promise<QueryRuntimeModule> {
  queryRuntimePromise ??= (async () => {
    try {
      const runtime = await loadRuntimeModule<QueryRuntimeModule>('@healthybob/query')

      if (
        typeof runtime.readVault !== 'function' ||
        typeof runtime.lookupRecordById !== 'function' ||
        typeof runtime.listRecords !== 'function'
      ) {
        throw new TypeError('Query runtime package did not match the expected module shape.')
      }

      return runtime
    } catch (error) {
      queryRuntimePromise = null
      throw createRuntimeUnavailableError('samples/audit query reads', error)
    }
  })()

  return queryRuntimePromise
}

async function loadImportersRuntime(): Promise<ImportersRuntimeModule> {
  importersRuntimePromise ??= (async () => {
    try {
      const runtime = await loadRuntimeModule<ImportersRuntimeModule>('@healthybob/importers')

      if (
        typeof runtime.createImporters !== 'function' ||
        typeof runtime.prepareCsvSampleImport !== 'function'
      ) {
        throw new TypeError('Importer runtime package did not match the expected module shape.')
      }

      return runtime
    } catch (error) {
      importersRuntimePromise = null
      throw createRuntimeUnavailableError('samples import-csv', error)
    }
  })()

  return importersRuntimePromise
}

function toCommandEntityLinks(
  record: QueryRecord,
  extraLinkKeys: string[] = [],
): CommandEntityLink[] {
  const ids = new Set<string>()

  for (const relatedId of record.relatedIds ?? []) {
    if (typeof relatedId === 'string' && relatedId.trim().length > 0) {
      ids.add(relatedId.trim())
    }
  }

  for (const key of extraLinkKeys) {
    for (const extraId of arrayOfStrings(record.data[key])) {
      ids.add(extraId)
    }
  }

  return [...ids]
    .sort((left, right) => left.localeCompare(right))
    .map((id) => ({
      id,
      kind: inferEntityKind(id),
      queryable: isQueryableRecordId(id),
    }))
}

function matchesOptionalString(value: string | null, expected?: string): boolean {
  return !expected || value === expected
}

function matchesDateRange(
  value: string | null | undefined,
  from?: string,
  to?: string,
): boolean {
  if (!value) {
    return !from && !to
  }

  const date = value.slice(0, 10)
  if (from && date < from) {
    return false
  }

  if (to && date > to) {
    return false
  }

  return true
}

function compareByLatest(left: QueryRecord, right: QueryRecord): number {
  const leftDate = left.occurredAt ?? ''
  const rightDate = right.occurredAt ?? ''

  if (leftDate !== rightDate) {
    return rightDate.localeCompare(leftDate)
  }

  return (left.displayId || left.primaryLookupId).localeCompare(
    right.displayId || right.primaryLookupId,
  )
}

function compareNullableDates(left: string | null, right: string | null): number {
  const normalizedLeft = left ?? ''
  const normalizedRight = right ?? ''

  if (normalizedLeft !== normalizedRight) {
    return normalizedLeft.localeCompare(normalizedRight)
  }

  return 0
}

function applyLimit<T>(items: T[], limit?: number): T[] {
  return typeof limit === 'number' ? items.slice(0, limit) : items
}

function inferSampleStream(
  manifestFile: string,
  manifest: JsonObject,
): string | null {
  const rawDirectory = firstString(manifest, ['rawDirectory'])
  const sourcePath = rawDirectory ?? manifestFile
  const segments = sourcePath.split('/')
  const samplesIndex = segments.indexOf('samples')
  const streamSegment = samplesIndex >= 0 ? segments[samplesIndex + 1] : null

  return streamSegment ? streamSegment.replace(/-/g, '_') : null
}

function asObject(value: unknown): JsonObject | null {
  return isJsonObject(value) ? value : null
}

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
    : []
}

function firstString(
  value: JsonObject | null | undefined,
  keys: string[],
): string | null {
  if (!value) {
    return null
  }

  for (const key of keys) {
    const candidate = value[key]
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim()
    }
  }

  return null
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function inferEntityKind(id: string): string {
  if (id === 'core') {
    return 'core'
  }

  if (id.startsWith('aud_') || id.startsWith('audit:')) {
    return 'audit'
  }

  if (id.startsWith('evt_') || id.startsWith('event:')) {
    return 'event'
  }

  if (id.startsWith('exp_') || id.startsWith('experiment:')) {
    return 'experiment'
  }

  if (id.startsWith('journal:')) {
    return 'journal'
  }

  if (id.startsWith('smp_') || id.startsWith('sample:')) {
    return 'sample'
  }

  if (id.startsWith('xfm_')) {
    return 'transform'
  }

  if (id.startsWith('meal_')) {
    return 'meal'
  }

  if (id.startsWith('doc_')) {
    return 'document'
  }

  return 'entity'
}

function isQueryableRecordId(id: string): boolean {
  return (
    id === 'core' ||
    id === 'current' ||
    id.startsWith('aud_') ||
    id.startsWith('audit:') ||
    id.startsWith('evt_') ||
    id.startsWith('event:') ||
    id.startsWith('exp_') ||
    id.startsWith('experiment:') ||
    id.startsWith('journal:') ||
    id.startsWith('smp_') ||
    id.startsWith('sample:')
  )
}

function createRuntimeUnavailableError(
  operation: string,
  cause: unknown,
) {
  const details =
    cause instanceof Error
      ? {
          cause: cause.message,
          packages: ['@healthybob/core', '@healthybob/importers', '@healthybob/query', 'incur'],
        }
      : {
          packages: ['@healthybob/core', '@healthybob/importers', '@healthybob/query', 'incur'],
        }

  return new VaultCliError(
    'runtime_unavailable',
    `packages/cli can describe ${operation}, but local execution is blocked until the integrating workspace installs incur and links @healthybob/core, @healthybob/importers, and @healthybob/query.`,
    details,
  )
}

async function readJsonObject(
  absolutePath: string,
  label: string,
): Promise<JsonObject> {
  let contents: string

  try {
    contents = await readFile(absolutePath, 'utf8')
  } catch (error) {
    if (isMissingPathError(error)) {
      throw new VaultCliError('not_found', `${label} is missing.`)
    }

    throw error
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(contents)
  } catch (error) {
    throw new VaultCliError(
      'invalid_json',
      `${label} is not valid JSON.`,
      error instanceof Error ? { cause: error.message } : undefined,
    )
  }

  if (!isJsonObject(parsed)) {
    throw new VaultCliError('invalid_json', `${label} must contain a JSON object.`)
  }

  return parsed
}

function isMissingPathError(error: unknown): error is NodeJS.ErrnoException {
  const candidate = error as NodeJS.ErrnoException | null

  return (
    candidate !== null &&
    typeof candidate === 'object' &&
    'code' in candidate &&
    candidate.code === 'ENOENT'
  )
}
