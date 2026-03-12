import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import type {
  DocumentImportResult,
  ExperimentCreateResult,
  ExportPackResult,
  JournalEnsureResult,
  ListFilters,
  ListResult,
  MealAddResult,
  ShowResult,
  VaultInitResult,
  VaultValidateResult,
  SamplesImportCsvResult,
} from "./vault-cli-contracts.js"
import { VaultCliError } from "./vault-cli-errors.js"

const RUNTIME_PACKAGES = Object.freeze([
  "@healthybob/core",
  "@healthybob/importers",
  "@healthybob/query",
  "incur",
])

const dynamicImport = new Function(
  "specifier",
  "return import(specifier)",
) as (specifier: string) => Promise<unknown>

export interface CommandContext {
  vault: string
  requestId: string | null
}

export interface CoreWriteServices {
  init(input: CommandContext): Promise<VaultInitResult>
  validate(input: CommandContext): Promise<VaultValidateResult>
  addMeal(
    input: CommandContext & {
      photo: string
      audio?: string
      note?: string
      occurredAt?: string
    },
  ): Promise<MealAddResult>
  createExperiment(
    input: CommandContext & {
      slug: string
    },
  ): Promise<ExperimentCreateResult>
  ensureJournal(
    input: CommandContext & {
      date: string
    },
  ): Promise<JournalEnsureResult>
}

export interface ImporterServices {
  importDocument(
    input: CommandContext & {
      file: string
    },
  ): Promise<DocumentImportResult>
  importSamplesCsv(
    input: CommandContext & {
      file: string
      stream: string
      tsColumn: string
      valueColumn: string
      unit: string
    },
  ): Promise<SamplesImportCsvResult>
}

export interface QueryServices {
  show(
    input: CommandContext & {
      id: string
    },
  ): Promise<ShowResult>
  list(
    input: CommandContext & ListFilters,
  ): Promise<ListResult>
  exportPack(
    input: CommandContext & {
      from: string
      to: string
      experiment?: string
      out?: string
    },
  ): Promise<ExportPackResult>
}

export interface VaultCliServices {
  core: CoreWriteServices
  importers: ImporterServices
  query: QueryServices
}

interface CoreRuntimeModule {
  REQUIRED_DIRECTORIES: readonly string[]
  initializeVault(input: {
    vaultRoot: string
  }): Promise<unknown>
  validateVault(input: {
    vaultRoot: string
  }): Promise<{
    valid: boolean
    issues?: Array<Record<string, unknown>>
  }>
  addMeal(input: {
    vaultRoot: string
    photoPath: string
    audioPath?: string
    note?: string
    occurredAt?: string
  }): Promise<{
    mealId: string
    event: {
      id: string
      occurredAt?: string | null
    }
    photo: {
      relativePath: string
    }
    audio?: {
      relativePath: string
    } | null
  }>
  createExperiment(input: {
    vaultRoot: string
    slug: string
    title?: string
  }): Promise<{
    created?: boolean
    experiment: {
      id: string
      slug: string
      relativePath: string
    }
  }>
  ensureJournalDay(input: {
    vaultRoot: string
    date: string
  }): Promise<{
    relativePath: string
    created: boolean
  }>
}

interface ImportersRuntimeModule {
  createImporters(): {
    importDocument(input: {
      filePath: string
      vaultRoot: string
    }): Promise<{
      raw: {
        relativePath: string
      }
      documentId: string
      event: {
        id: string
      }
    }>
    importCsvSamples(input: {
      filePath: string
      vaultRoot: string
      stream: string
      tsColumn: string
      valueColumn: string
      unit: string
    }): Promise<{
      count: number
      records: Array<{
        id: string
      }>
      transformId: string
      shardPaths: string[]
    }>
  }
}

interface QueryRecord {
  id: string
  recordType: string
  sourcePath?: string | null
  occurredAt?: string | null
  kind?: string | null
  title?: string | null
  body?: string | null
  data: Record<string, unknown>
}

interface QueryRuntimeModule {
  readVault(vaultRoot: string): Promise<unknown>
  lookupRecordById(readModel: unknown, recordId: string): QueryRecord | null
  listRecords(
    readModel: unknown,
    filters?: Record<string, unknown>,
  ): QueryRecord[]
  buildExportPack(
    readModel: unknown,
    options?: Record<string, unknown>,
  ): {
    packId: string
    files: Array<{
      path: string
      contents: string
    }>
  }
}

interface IntegratedRuntime {
  core: CoreRuntimeModule
  importers: ReturnType<ImportersRuntimeModule["createImporters"]>
  query: QueryRuntimeModule
}

let integratedRuntimePromise: Promise<IntegratedRuntime> | null = null

function createUnwiredMethod(name: string) {
  return async () => {
    throw new VaultCliError(
      "not_implemented",
      `CLI integration for ${name} is not wired yet.`,
    )
  }
}

function normalizeIssues(
  issues: Array<Record<string, unknown>> = [],
): VaultValidateResult["issues"] {
  return issues.map((issue) => ({
    code: String(issue.code ?? "validation_issue"),
    path: String(issue.path ?? "vault.json"),
    message: String(issue.message ?? "Validation issue."),
    severity:
      issue.severity === "warning" || issue.severity === "error"
        ? issue.severity
        : "error",
  }))
}

function inferEntityKind(id: string) {
  if (id === "core") {
    return "core"
  }

  if (id.startsWith("evt_")) {
    return "event"
  }

  if (id.startsWith("smp_")) {
    return "sample"
  }

  if (id.startsWith("aud_")) {
    return "audit"
  }

  if (id.startsWith("exp_")) {
    return "experiment"
  }

  if (id.startsWith("meal_")) {
    return "meal"
  }

  if (id.startsWith("doc_")) {
    return "document"
  }

  return "entity"
}

function isQueryableRecordId(id: string) {
  return (
    id === "core" ||
    id.startsWith("aud_") ||
    id.startsWith("evt_") ||
    id.startsWith("exp_") ||
    id.startsWith("smp_") ||
    id.startsWith("audit:") ||
    id.startsWith("event:") ||
    id.startsWith("experiment:") ||
    id.startsWith("journal:") ||
    id.startsWith("sample:")
  )
}

function describeLookupConstraint(id: string) {
  if (id.startsWith("meal_")) {
    return "Meal ids are stable related ids, not query-layer record ids. Use the returned lookupId/eventId with `show` instead."
  }

  if (id.startsWith("doc_")) {
    return "Document ids are stable related ids, not query-layer record ids. Use the returned lookupId/eventId with `show` instead."
  }

  if (id.startsWith("xfm_")) {
    return "Transform ids identify an import batch, not a query-layer record. Use the returned lookupIds or `list --kind sample` instead."
  }

  if (id.startsWith("pack_")) {
    return "Export pack ids identify derived exports, not canonical vault records. Inspect the materialized pack files instead of passing the pack id to `show`."
  }

  return null
}

function buildEntityLinks(record: {
  data: Record<string, unknown>
}) {
  const links = []

  const relatedIds = Array.isArray(record.data.relatedIds)
    ? record.data.relatedIds
    : []
  for (const relatedId of relatedIds) {
    if (typeof relatedId === "string" && relatedId.trim()) {
      links.push({
        id: relatedId,
        kind: inferEntityKind(relatedId),
        queryable: isQueryableRecordId(relatedId),
      })
    }
  }

  const eventIds = Array.isArray(record.data.eventIds)
    ? record.data.eventIds
    : []
  for (const eventId of eventIds) {
    if (typeof eventId === "string" && eventId.trim()) {
      links.push({
        id: eventId,
        kind: "event",
        queryable: true,
      })
    }
  }

  return links
}

async function materializeExportPack(
  outDir: string,
  files: Array<{ path: string; contents: string }>,
) {
  for (const file of files) {
    const targetPath = path.join(outDir, file.path)
    await mkdir(path.dirname(targetPath), { recursive: true })
    await writeFile(targetPath, file.contents, "utf8")
  }
}

function createRuntimeUnavailableError(
  operation: string,
  cause: unknown,
) {
  const details =
    cause instanceof Error
      ? {
          cause: cause.message,
          packages: [...RUNTIME_PACKAGES],
        }
      : {
          packages: [...RUNTIME_PACKAGES],
        }

  return new VaultCliError(
    "runtime_unavailable",
    `packages/cli can describe ${operation}, but local execution is blocked until the integrating workspace installs incur and links @healthybob/core, @healthybob/importers, and @healthybob/query.`,
    details,
  )
}

async function loadIntegratedRuntime() {
  if (!integratedRuntimePromise) {
    integratedRuntimePromise = (async () => {
      try {
        const [coreModule, importersModule, queryModule] = await Promise.all([
          dynamicImport("@healthybob/core"),
          dynamicImport("@healthybob/importers"),
          dynamicImport("@healthybob/query"),
        ])

        return {
          core: coreModule as CoreRuntimeModule,
          importers: (
            importersModule as ImportersRuntimeModule
          ).createImporters(),
          query: queryModule as QueryRuntimeModule,
        }
      } catch (error) {
        integratedRuntimePromise = null
        throw createRuntimeUnavailableError(
          "integrated vault-cli services",
          error,
        )
      }
    })()
  }

  return integratedRuntimePromise
}

function toJournalLookupId(date: string) {
  return `journal:${date}`
}

export function createIntegratedVaultCliServices(): VaultCliServices {
  return {
    core: {
      async init({ vault }) {
        const { core } = await loadIntegratedRuntime()
        await core.initializeVault({ vaultRoot: vault })
        return {
          vault,
          created: true,
          directories: [...core.REQUIRED_DIRECTORIES],
          files: ["vault.json", "CORE.md"],
        }
      },
      async validate({ vault }) {
        const { core } = await loadIntegratedRuntime()
        const result = await core.validateVault({ vaultRoot: vault })
        return {
          vault,
          valid: result.valid,
          issues: normalizeIssues(result.issues),
        }
      },
      async addMeal({ vault, photo, audio, note, occurredAt }) {
        const { core } = await loadIntegratedRuntime()
        const result = await core.addMeal({
          vaultRoot: vault,
          photoPath: photo,
          audioPath: audio,
          note,
          occurredAt,
        })

        return {
          vault,
          mealId: result.mealId,
          eventId: result.event.id,
          lookupId: result.event.id,
          occurredAt: result.event.occurredAt ?? null,
          photoPath: result.photo.relativePath,
          audioPath: result.audio?.relativePath ?? null,
          note: note ?? null,
        }
      },
      async createExperiment({ vault, slug }) {
        const { core } = await loadIntegratedRuntime()
        const result = await core.createExperiment({
          vaultRoot: vault,
          slug,
          title: slug,
        })

        return {
          vault,
          experimentId: result.experiment.id,
          lookupId: result.experiment.id,
          slug: result.experiment.slug,
          experimentPath: result.experiment.relativePath,
          created: result.created ?? true,
        }
      },
      async ensureJournal({ vault, date }) {
        const { core } = await loadIntegratedRuntime()
        const result = await core.ensureJournalDay({
          vaultRoot: vault,
          date,
        })

        return {
          vault,
          date,
          lookupId: toJournalLookupId(date),
          journalPath: result.relativePath,
          created: result.created,
        }
      },
    },
    importers: {
      async importDocument({ vault, file }) {
        const { importers } = await loadIntegratedRuntime()
        const result = await importers.importDocument({
          filePath: file,
          vaultRoot: vault,
        })

        return {
          vault,
          sourceFile: file,
          rawFile: result.raw.relativePath,
          documentId: result.documentId,
          eventId: result.event.id,
          lookupId: result.event.id,
        }
      },
      async importSamplesCsv({
        vault,
        file,
        stream,
        tsColumn,
        valueColumn,
        unit,
      }) {
        const { importers } = await loadIntegratedRuntime()
        const result = await importers.importCsvSamples({
          filePath: file,
          vaultRoot: vault,
          stream,
          tsColumn,
          valueColumn,
          unit,
        })

        return {
          vault,
          sourceFile: file,
          stream,
          importedCount: result.count,
          transformId: result.transformId,
          lookupIds: result.records.map((record) => record.id),
          ledgerFiles: result.shardPaths,
        }
      },
    },
    query: {
      async show({ vault, id }) {
        const constraint = describeLookupConstraint(id)

        if (constraint) {
          throw new VaultCliError("invalid_lookup_id", constraint, {
            id,
          })
        }

        const { query } = await loadIntegratedRuntime()
        const readModel = await query.readVault(vault)
        const record = query.lookupRecordById(readModel, id)

        if (!record) {
          throw new VaultCliError("not_found", `No record found for "${id}".`)
        }

        return {
          vault,
          entity: {
            id: record.id,
            kind: record.kind ?? record.recordType,
            title: record.title ?? null,
            occurredAt: record.occurredAt ?? null,
            path: record.sourcePath ?? null,
            markdown: record.body ?? null,
            data: record.data,
            links: buildEntityLinks(record),
          },
        }
      },
      async list({
        vault,
        kind,
        experiment,
        dateFrom,
        dateTo,
        cursor,
        limit,
      }) {
        const { query } = await loadIntegratedRuntime()
        const readModel = await query.readVault(vault)
        const items = query
          .listRecords(readModel, {
          kinds: kind ? [kind] : undefined,
          experimentSlug: experiment,
          from: dateFrom,
          to: dateTo,
        })
          .slice(0, limit)
          .map((record) => ({
            id: record.id,
            kind: record.kind ?? record.recordType,
            title: record.title ?? null,
            occurredAt: record.occurredAt ?? null,
            path: record.sourcePath ?? null,
          }))

        return {
          vault,
          filters: {
            kind,
            experiment,
            dateFrom,
            dateTo,
            cursor,
            limit,
          },
          items,
          nextCursor: null,
        }
      },
      async exportPack({ vault, from, to, experiment, out }) {
        const { query } = await loadIntegratedRuntime()
        const readModel = await query.readVault(vault)
        const pack = query.buildExportPack(readModel, {
          from,
          to,
          experimentSlug: experiment,
        })

        if (out) {
          await materializeExportPack(out, pack.files)
        }

        return {
          vault,
          from,
          to,
          experiment: experiment ?? null,
          outDir: out ?? null,
          packId: pack.packId,
          files: pack.files.map((file) => file.path),
        }
      },
    },
  }
}

export function createUnwiredVaultCliServices(): VaultCliServices {
  return {
    core: {
      init: createUnwiredMethod("core.init"),
      validate: createUnwiredMethod("core.validate"),
      addMeal: createUnwiredMethod("core.addMeal"),
      createExperiment: createUnwiredMethod("core.createExperiment"),
      ensureJournal: createUnwiredMethod("core.ensureJournal"),
    },
    importers: {
      importDocument: createUnwiredMethod("importers.importDocument"),
      importSamplesCsv: createUnwiredMethod("importers.importSamplesCsv"),
    },
    query: {
      show: createUnwiredMethod("query.show"),
      list: createUnwiredMethod("query.list"),
      exportPack: createUnwiredMethod("query.exportPack"),
    },
  }
}
