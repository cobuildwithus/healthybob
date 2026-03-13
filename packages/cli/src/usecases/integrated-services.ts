import { VaultCliError } from "../vault-cli-errors.js"

import type {
  ListFilters,
} from "../vault-cli-contracts.js"
import type { CommandContext } from "../health-cli-method-types.js"
import type {
  CoreWriteServices,
  ImporterServices,
  ProjectAssessmentInput,
  QueryServices,
  StopRegimenInput,
  VaultCliServices,
} from "./types.js"
import {
  createHealthCoreServices,
  createHealthQueryServices,
} from "./health-services.js"
import {
  createUnwiredHealthMethodSet,
  createUnwiredMethod,
  healthCoreServiceMethodNames,
  healthQueryServiceMethodNames,
  loadImporterRuntime,
  loadIntegratedRuntime,
} from "./runtime.js"
import {
  describeLookupConstraint,
  materializeExportPack,
  matchesGenericKindFilter,
  normalizeIssues,
  toGenericListItem,
  toGenericShowEntity,
  toJournalLookupId,
} from "./shared.js"

function createIntegratedCoreServices(): CoreWriteServices {
  return {
    async init(input: CommandContext) {
      const { vault } = input
      const { core } = await loadIntegratedRuntime()
      await core.initializeVault({ vaultRoot: vault })
      return {
        vault,
        created: true,
        directories: [...core.REQUIRED_DIRECTORIES],
        files: ["vault.json", "CORE.md"],
      }
    },
    async validate(input: CommandContext) {
      const { vault } = input
      const { core } = await loadIntegratedRuntime()
      const result = await core.validateVault({ vaultRoot: vault })
      return {
        vault,
        valid: result.valid,
        issues: normalizeIssues(result.issues),
      }
    },
    async addMeal(input: CommandContext & {
      photo: string
      audio?: string
      note?: string
      occurredAt?: string
    }) {
      const { vault, photo, audio, note, occurredAt } = input
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
        manifestFile: result.manifestPath,
        note: result.event.note ?? note ?? null,
      }
    },
    async createExperiment(input: CommandContext & {
      slug: string
    }) {
      const { vault, slug } = input
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
    async ensureJournal(input: CommandContext & {
      date: string
    }) {
      const { vault, date } = input
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
    async projectAssessment(input: ProjectAssessmentInput) {
      const { vault, assessmentId } = input
      const { core } = await loadIntegratedRuntime()
      const assessment = await core.readAssessmentResponse({
        vaultRoot: vault,
        assessmentId,
      })
      const proposal = await core.projectAssessmentResponse({
        assessmentResponse: assessment,
      })

      return {
        vault,
        assessmentId,
        proposal,
      }
    },
    ...createHealthCoreServices(async () => {
      const { core } = await loadIntegratedRuntime()
      return { core }
    }),
    async rebuildCurrentProfile(input: CommandContext) {
      const { vault } = input
      const { core } = await loadIntegratedRuntime()
      const result = await core.rebuildCurrentProfile({
        vaultRoot: vault,
      })

      return {
        vault,
        profilePath: result.relativePath,
        snapshotId: result.snapshot?.id ?? null,
        updated: result.updated,
      }
    },
    async stopRegimen(input: StopRegimenInput) {
      const { vault, regimenId, stoppedOn } = input
      const { core } = await loadIntegratedRuntime()
      const result = await core.stopRegimenItem({
        vaultRoot: vault,
        regimenId,
        stoppedOn,
      })

      return {
        vault,
        regimenId: String(result.record.regimenId),
        lookupId: String(result.record.regimenId),
        stoppedOn: result.record.stoppedOn ?? null,
        status: String(result.record.status),
      }
    },
  } satisfies CoreWriteServices
}

function createIntegratedImporterServices(): ImporterServices {
  return {
    async importDocument(input) {
      const { vault, file } = input
      const importers = await loadImporterRuntime()
      const result = await importers.importDocument({
        filePath: file,
        vaultRoot: vault,
      })

      return {
        vault,
        sourceFile: file,
        rawFile: result.raw.relativePath,
        manifestFile: result.manifestPath,
        documentId: result.documentId,
        eventId: result.event.id,
        lookupId: result.event.id,
      }
    },
    async importSamplesCsv(input) {
      const { vault, file, stream, tsColumn, valueColumn, unit } = input
      const importers = await loadImporterRuntime()
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
        manifestFile: result.manifestPath,
        lookupIds: result.records.map((record) => record.id),
        ledgerFiles: result.shardPaths,
      }
    },
    async importAssessmentResponse(input) {
      const { vault, file } = input
      const importers = await loadImporterRuntime()
      const result = await importers.importAssessmentResponse({
        filePath: file,
        vaultRoot: vault,
      })

      return {
        vault,
        sourceFile: file,
        rawFile: result.raw.relativePath,
        manifestFile: result.manifestPath,
        assessmentId: result.assessment.id,
        lookupId: result.assessment.id,
        ledgerFile: result.ledgerPath,
      }
    },
  } satisfies ImporterServices
}

function createIntegratedQueryServices(): QueryServices {
  return {
    ...createHealthQueryServices(async () => {
      const { query } = await loadIntegratedRuntime()
      return { query }
    }),
    async show(input: CommandContext & {
      id: string
    }) {
      const { vault, id } = input
      const constraint = describeLookupConstraint(id)

      if (constraint) {
        throw new VaultCliError("invalid_lookup_id", constraint, {
          id,
        })
      }

      const { query } = await loadIntegratedRuntime()
      const readModel = await query.readVault(vault)
      const entity = query.lookupEntityById(readModel, id)

      if (!entity) {
        throw new VaultCliError("not_found", `No entity found for "${id}".`)
      }

      return {
        vault,
        entity: toGenericShowEntity(entity),
      }
    },
    async list(input: CommandContext & ListFilters) {
      const {
        vault,
        recordType,
        kind,
        status,
        stream,
        experiment,
        dateFrom,
        dateTo,
        tag,
        limit,
      } = input
      const { query } = await loadIntegratedRuntime()
      const readModel = await query.readVault(vault)
      const recordTypes = parseCsvOption(recordType)
      const streams = parseCsvOption(stream)
      const tags = parseCsvOption(tag)
      const items = query
        .listEntities(readModel, {
          families: recordTypes.length > 0 ? recordTypes : undefined,
          statuses: status ? [status] : undefined,
          streams: streams.length > 0 ? streams : undefined,
          experimentSlug: experiment,
          from: dateFrom,
          tags: tags.length > 0 ? tags : undefined,
          to: dateTo,
        })
        .filter((entity) => matchesGenericKindFilter(entity, kind))
        .slice(0, limit)
        .map(toGenericListItem)

      return {
        vault,
        filters: {
          recordType,
          kind,
          status,
          stream,
          experiment,
          dateFrom,
          dateTo,
          tag,
          limit,
        },
        items,
        nextCursor: null,
      }
    },
    async exportPack(input: CommandContext & {
      from: string
      to: string
      experiment?: string
      out?: string
    }) {
      const { vault, from, to, experiment, out } = input
      const { query } = await loadIntegratedRuntime()
      const readModel = await query.readVaultTolerant(vault)
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
  } satisfies QueryServices
}

function parseCsvOption(value: string | undefined): string[] {
  if (typeof value !== 'string') {
    return []
  }

  return [
    ...new Set(
      value
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
    ),
  ]
}

export function createIntegratedVaultCliServices(): VaultCliServices {
  return {
    core: createIntegratedCoreServices(),
    importers: createIntegratedImporterServices(),
    query: createIntegratedQueryServices(),
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
      projectAssessment: createUnwiredMethod("core.projectAssessment"),
      ...createUnwiredHealthMethodSet(healthCoreServiceMethodNames, "core"),
      rebuildCurrentProfile: createUnwiredMethod("core.rebuildCurrentProfile"),
      stopRegimen: createUnwiredMethod("core.stopRegimen"),
    } satisfies CoreWriteServices,
    importers: {
      importDocument: createUnwiredMethod("importers.importDocument"),
      importSamplesCsv: createUnwiredMethod("importers.importSamplesCsv"),
      importAssessmentResponse: createUnwiredMethod("importers.importAssessmentResponse"),
    } satisfies ImporterServices,
    query: {
      show: createUnwiredMethod("query.show"),
      list: createUnwiredMethod("query.list"),
      exportPack: createUnwiredMethod("query.exportPack"),
      ...createUnwiredHealthMethodSet(healthQueryServiceMethodNames, "query"),
    } satisfies QueryServices,
  }
}
