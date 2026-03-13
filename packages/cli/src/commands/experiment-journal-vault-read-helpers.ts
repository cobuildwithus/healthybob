import { EXPERIMENT_STATUSES } from '@healthybob/contracts'
import {
  inferHealthEntityKind,
  isHealthQueryableRecordId,
} from '../health-cli-descriptors.js'
import { loadQueryRuntime, type QueryRuntimeModule } from '../query-runtime.js'
import { loadRuntimeModule } from '../runtime-import.js'
import { VaultCliError } from '../vault-cli-errors.js'

type JsonObject = Record<string, unknown>

type EntityFamily = 'experiment' | 'journal'
type ExperimentStatus = (typeof EXPERIMENT_STATUSES)[number]

interface QueryCanonicalEntity {
  entityId: string
  primaryLookupId: string
  lookupIds: string[]
  family: string
  kind: string
  status: string | null
  occurredAt: string | null
  date: string | null
  path: string
  title: string | null
  body: string | null
  attributes: JsonObject
  relatedIds: string[]
  experimentSlug: string | null
}

interface QueryVaultRecord {
  sourcePath: string
  title: string | null
  occurredAt: string | null
  date: string | null
}

interface QueryVaultReadModel {
  metadata: JsonObject | null
  coreDocument: QueryVaultRecord | null
  experiments: QueryVaultRecord[]
  journalEntries: QueryVaultRecord[]
  events: QueryVaultRecord[]
  samples: QueryVaultRecord[]
  audits: QueryVaultRecord[]
  assessments: QueryVaultRecord[]
  profileSnapshots: QueryVaultRecord[]
  goals: QueryVaultRecord[]
  conditions: QueryVaultRecord[]
  allergies: QueryVaultRecord[]
  regimens: QueryVaultRecord[]
  history: QueryVaultRecord[]
  familyMembers: QueryVaultRecord[]
  geneticVariants: QueryVaultRecord[]
  records: QueryVaultRecord[]
}

interface ExperimentJournalVaultQueryRuntime extends QueryRuntimeModule {
  readVault(vaultRoot: string): Promise<QueryVaultReadModel>
  lookupEntityById(
    vault: QueryVaultReadModel,
    entityId: string,
  ): QueryCanonicalEntity | null
  listEntities(
    vault: QueryVaultReadModel,
    filters?: {
      families?: string[]
      statuses?: string[]
      from?: string
      to?: string
    },
  ): QueryCanonicalEntity[]
}

interface ExperimentJournalVaultCoreRuntime {
  createExperiment(input: {
    vaultRoot: string
    slug: string
    title?: string
    hypothesis?: string
    startedOn?: string
    status?: string
  }): Promise<{
    created?: boolean
    experiment: {
      id: string
      slug: string
      relativePath: string
    }
  }>
}

const ISO_TIMESTAMP_WITH_OFFSET_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u

export async function createExperimentRecord(input: {
  vault: string
  slug: string
  title?: string
  hypothesis?: string
  startedOn?: string
  status?: ExperimentStatus
}) {
  const core = await loadExperimentJournalVaultCoreRuntime()
  const result = await core.createExperiment({
    vaultRoot: input.vault,
    slug: input.slug,
    title: normalizeOptionalText(input.title) ?? input.slug,
    hypothesis: normalizeOptionalText(input.hypothesis) ?? undefined,
    startedOn: input.startedOn ?? new Date().toISOString().slice(0, 10),
    status: normalizeOptionalText(input.status) ?? 'active',
  })

  return {
    vault: input.vault,
    experimentId: result.experiment.id,
    lookupId: result.experiment.id,
    slug: result.experiment.slug,
    experimentPath: result.experiment.relativePath,
    created: result.created ?? true,
  }
}

export async function showExperimentRecord(vault: string, lookup: string) {
  const entity = await requireEntityFamily(vault, lookup, 'experiment')
  return {
    vault,
    entity: toShowEntity(entity),
  }
}

export async function listExperimentRecords(input: {
  vault: string
  status?: ExperimentStatus
  limit: number
}) {
  const query = await loadExperimentJournalVaultQueryRuntime()
  const readModel = await query.readVault(input.vault)
  const items = query
    .listEntities(readModel, {
      families: ['experiment'],
      statuses: input.status ? [input.status] : undefined,
    })
    .slice(0, input.limit)
    .map(toListItem)

  return {
    vault: input.vault,
    filters: {
      status: input.status ?? null,
      limit: input.limit,
    },
    items,
    nextCursor: null,
  }
}

export async function showJournalRecord(vault: string, lookup: string) {
  const entity = await requireEntityFamily(vault, lookup, 'journal')
  return {
    vault,
    entity: toShowEntity(entity),
  }
}

export async function listJournalRecords(input: {
  vault: string
  from?: string
  to?: string
  limit: number
}) {
  const query = await loadExperimentJournalVaultQueryRuntime()
  const readModel = await query.readVault(input.vault)
  const items = query
    .listEntities(readModel, {
      families: ['journal'],
      from: input.from,
      to: input.to,
    })
    .slice(0, input.limit)
    .map(toListItem)

  return {
    vault: input.vault,
    filters: {
      kind: 'journal_day',
      dateFrom: input.from,
      dateTo: input.to,
      limit: input.limit,
    },
    items,
    nextCursor: null,
  }
}

export async function showVaultSummary(vault: string) {
  const query = await loadExperimentJournalVaultQueryRuntime()
  const readModel = await query.readVault(vault)
  const metadata = readModel.metadata

  return {
    vault,
    schemaVersion: stringOrNull(metadata?.schemaVersion),
    vaultId: stringOrNull(metadata?.vaultId),
    title: stringOrNull(metadata?.title),
    timezone: stringOrNull(metadata?.timezone),
    createdAt: normalizeIsoTimestamp(stringOrNull(metadata?.createdAt)),
    corePath: readModel.coreDocument?.sourcePath ?? null,
    coreTitle: readModel.coreDocument?.title ?? null,
    coreUpdatedAt: normalizeIsoTimestamp(readModel.coreDocument?.occurredAt),
  }
}

export async function showVaultPaths(vault: string) {
  const query = await loadExperimentJournalVaultQueryRuntime()
  const readModel = await query.readVault(vault)
  const metadata = readModel.metadata

  return {
    vault,
    paths: objectOrNull(metadata?.paths),
    shards: objectOrNull(metadata?.shards),
  }
}

export async function showVaultStats(vault: string) {
  const query = await loadExperimentJournalVaultQueryRuntime()
  const readModel = await query.readVault(vault)

  return {
    vault,
    counts: {
      totalRecords: readModel.records.length,
      experiments: readModel.experiments.length,
      journalEntries: readModel.journalEntries.length,
      events: readModel.events.length,
      samples: readModel.samples.length,
      audits: readModel.audits.length,
      assessments: readModel.assessments.length,
      profileSnapshots: readModel.profileSnapshots.length,
      goals: readModel.goals.length,
      conditions: readModel.conditions.length,
      allergies: readModel.allergies.length,
      regimens: readModel.regimens.length,
      history: readModel.history.length,
      familyMembers: readModel.familyMembers.length,
      geneticVariants: readModel.geneticVariants.length,
    },
    latest: {
      eventOccurredAt: latestIsoTimestamp(readModel.events),
      sampleOccurredAt: latestIsoTimestamp(readModel.samples),
      journalDate: latestDate(readModel.journalEntries),
      experimentTitle: readModel.experiments.at(-1)?.title ?? null,
    },
  }
}

async function requireEntityFamily(
  vault: string,
  lookup: string,
  family: EntityFamily,
) {
  const query = await loadExperimentJournalVaultQueryRuntime()
  const readModel = await query.readVault(vault)
  const entity = query.lookupEntityById(readModel, lookup)

  if (!entity || entity.family !== family) {
    throw new VaultCliError('not_found', `No ${family} found for "${lookup}".`, {
      family,
      lookup,
    })
  }

  return entity
}

function toShowEntity(entity: QueryCanonicalEntity) {
  return {
    id: entity.entityId,
    kind: entity.kind,
    title: entity.title ?? null,
    occurredAt: normalizeIsoTimestamp(entity.occurredAt),
    path: entity.path ?? null,
    markdown: entity.body ?? null,
    data: buildEntityData(entity),
    links: buildEntityLinks(entity),
  }
}

function toListItem(entity: QueryCanonicalEntity) {
  return {
    id: entity.entityId,
    kind: entity.kind,
    title: entity.title ?? null,
    occurredAt: normalizeIsoTimestamp(entity.occurredAt),
    path: entity.path ?? null,
  }
}

function buildEntityData(entity: QueryCanonicalEntity) {
  return compactObject({
    ...entity.attributes,
    status:
      typeof entity.attributes.status === 'string'
        ? entity.attributes.status
        : entity.status,
    experimentSlug:
      typeof entity.attributes.experimentSlug === 'string' ||
      typeof entity.attributes.experiment_slug === 'string'
        ? undefined
        : entity.experimentSlug,
    relatedIds:
      Array.isArray(entity.attributes.relatedIds) &&
      entity.attributes.relatedIds.length > 0
        ? undefined
        : entity.relatedIds,
  })
}

function buildEntityLinks(entity: QueryCanonicalEntity) {
  const links = uniqueStrings([
    ...entity.relatedIds,
    ...stringArray(entity.attributes.eventIds),
  ])

  return links.map((id) => ({
    id,
    kind: inferLinkKind(id),
    queryable: isQueryableRecordId(id),
  }))
}

function inferLinkKind(id: string) {
  const healthKind = inferHealthEntityKind(id)
  if (healthKind) {
    return healthKind
  }

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

  if (id.startsWith('meal_')) {
    return 'meal'
  }

  if (id.startsWith('doc_')) {
    return 'document'
  }

  return 'entity'
}

function isQueryableRecordId(id: string) {
  return (
    id === 'core' ||
    isHealthQueryableRecordId(id) ||
    id.startsWith('aud_') ||
    id.startsWith('evt_') ||
    id.startsWith('exp_') ||
    id.startsWith('smp_') ||
    id.startsWith('audit:') ||
    id.startsWith('event:') ||
    id.startsWith('experiment:') ||
    id.startsWith('journal:') ||
    id.startsWith('sample:')
  )
}

async function loadExperimentJournalVaultQueryRuntime(): Promise<ExperimentJournalVaultQueryRuntime> {
  return loadQueryRuntime() as Promise<ExperimentJournalVaultQueryRuntime>
}

async function loadExperimentJournalVaultCoreRuntime(): Promise<ExperimentJournalVaultCoreRuntime> {
  return loadRuntimeModule<ExperimentJournalVaultCoreRuntime>('@healthybob/core')
}

function normalizeOptionalText(value: string | undefined) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeIsoTimestamp(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return null
  }

  return ISO_TIMESTAMP_WITH_OFFSET_PATTERN.test(value) ? value : null
}

function latestIsoTimestamp(records: readonly QueryVaultRecord[]) {
  const latest = [...records]
    .map((record) => normalizeIsoTimestamp(record.occurredAt))
    .filter((value): value is string => value !== null)
    .at(-1)

  return latest ?? null
}

function latestDate(records: readonly QueryVaultRecord[]) {
  const latest = [...records]
    .map((record) => record.date)
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .at(-1)

  return latest ?? null
}

function stringOrNull(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function objectOrNull(value: unknown): JsonObject | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : null
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
    : []
}

function uniqueStrings(values: readonly string[]) {
  return [...new Set(values)]
}

function compactObject(record: JsonObject) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined),
  )
}
