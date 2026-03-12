import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import {
  REQUIRED_DIRECTORIES,
  addMeal,
  createExperiment,
  ensureJournalDay,
  initializeVault,
  validateVault,
} from "../../core/src/index.js"
import { createImporters } from "../../importers/src/index.js"
import {
  buildExportPack,
  listRecords,
  lookupRecordById,
  readVault,
} from "../../query/src/index.js"
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

function createUnwiredMethod(name: string) {
  return async () => {
    throw new VaultCliError(
      "not_implemented",
      `CLI integration for ${name} is not wired yet.`,
    )
  }
}

function normalizeIssues(issues: Array<Record<string, unknown>> = []) {
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

export function createIntegratedVaultCliServices(): VaultCliServices {
  const importers = createImporters()

  return {
    core: {
      async init({ vault }) {
        await initializeVault({ vaultRoot: vault })
        return {
          vault,
          created: true,
          directories: [...REQUIRED_DIRECTORIES],
          files: ["vault.json", "CORE.md"],
        }
      },
      async validate({ vault }) {
        const result = await validateVault({ vaultRoot: vault })
        return {
          vault,
          valid: result.valid,
          issues: normalizeIssues(result.issues),
        }
      },
      async addMeal({ vault, photo, audio, note, occurredAt }) {
        const result = await addMeal({
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
          occurredAt: result.event.occurredAt ?? null,
          photoPath: result.photo.relativePath,
          audioPath: result.audio?.relativePath ?? null,
          note: note ?? null,
        }
      },
      async createExperiment({ vault, slug }) {
        const result = await createExperiment({
          vaultRoot: vault,
          slug,
          title: slug,
        })

        return {
          vault,
          slug: result.experiment.slug,
          experimentPath: result.experiment.relativePath,
          created: true,
        }
      },
      async ensureJournal({ vault, date }) {
        const result = await ensureJournalDay({
          vaultRoot: vault,
          date,
        })

        return {
          vault,
          date,
          journalPath: result.relativePath,
          created: result.created,
        }
      },
    },
    importers: {
      async importDocument({ vault, file }) {
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
          ledgerFiles: result.shardPaths,
        }
      },
    },
    query: {
      async show({ vault, id }) {
        const readModel = await readVault(vault)
        const record = lookupRecordById(readModel, id)

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
        const readModel = await readVault(vault)
        const items = listRecords(readModel, {
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
        const readModel = await readVault(vault)
        const pack = buildExportPack(readModel, {
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
