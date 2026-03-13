import type {
  DocumentImportResult,
  ExperimentCreateResult,
  ExportPackResult,
  JournalEnsureResult,
  ListFilters,
  ListResult,
  MealAddResult,
  SamplesImportCsvResult,
  ShowResult,
  VaultInitResult,
  VaultValidateResult,
} from "../vault-cli-contracts.js"
import type {
  CommandContext,
  HealthCoreRuntimeMethods,
  HealthCoreServiceMethods,
  HealthQueryRuntimeMethods,
  HealthQueryServiceMethods,
  JsonObject,
} from "../health-cli-method-types.js"

export type { CommandContext } from "../health-cli-method-types.js"

export interface ProjectAssessmentInput extends CommandContext {
  assessmentId: string
}

export interface StopRegimenInput extends CommandContext {
  regimenId: string
  stoppedOn?: string
}

export interface AssessmentProjectionResult {
  vault: string
  assessmentId: string
  proposal: JsonObject
}

export interface AssessmentImportResult {
  vault: string
  sourceFile: string
  rawFile: string
  manifestFile: string
  assessmentId: string
  lookupId: string
  ledgerFile?: string
}

export interface RebuildCurrentProfileResult {
  vault: string
  profilePath: string
  snapshotId: string | null
  updated: boolean
}

export interface StopRegimenResult {
  vault: string
  regimenId: string
  lookupId: string
  stoppedOn: string | null
  status: string
}

export interface CoreWriteServices extends HealthCoreServiceMethods {
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
  projectAssessment(
    input: ProjectAssessmentInput,
  ): Promise<AssessmentProjectionResult>
  rebuildCurrentProfile(
    input: CommandContext,
  ): Promise<RebuildCurrentProfileResult>
  stopRegimen(input: StopRegimenInput): Promise<StopRegimenResult>
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
  importAssessmentResponse(
    input: CommandContext & {
      file: string
    },
  ): Promise<AssessmentImportResult>
}

export interface QueryServices extends HealthQueryServiceMethods {
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

export interface CoreRuntimeModule extends HealthCoreRuntimeMethods {
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
      note?: string | null
    }
    manifestPath: string
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
  readAssessmentResponse(input: {
    vaultRoot: string
    assessmentId: string
  }): Promise<JsonObject>
  projectAssessmentResponse(input: {
    assessmentResponse: JsonObject
  }): Promise<JsonObject>
  rebuildCurrentProfile(input: {
    vaultRoot: string
  }): Promise<{
    relativePath: string
    snapshot?: {
      id: string
    } | null
    updated: boolean
  }>
  stopRegimenItem(input: {
    vaultRoot: string
    regimenId: string
    stoppedOn?: string
  }): Promise<{
    record: {
      regimenId: string
      stoppedOn?: string | null
      status: string
    }
  }>
}

export interface ImportersRuntimeModule {
  createImporters(input?: {
    corePort?: CoreRuntimeModule
  }): {
    importDocument(input: {
      filePath: string
      vaultRoot: string
    }): Promise<{
      raw: {
        relativePath: string
      }
      manifestPath: string
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
      manifestPath: string
      shardPaths: string[]
    }>
    importAssessmentResponse(input: {
      filePath: string
      vaultRoot: string
    }): Promise<{
      assessment: {
        id: string
      }
      manifestPath: string
      raw: {
        relativePath: string
      }
      ledgerPath: string
    }>
  }
}

export type ImportersRuntime = ReturnType<ImportersRuntimeModule["createImporters"]>

export interface QueryRecord {
  id: string
  recordType: string
  sourcePath?: string | null
  occurredAt?: string | null
  kind?: string | null
  title?: string | null
  body?: string | null
  data: Record<string, unknown>
}

export interface QueryEntity {
  entityId: string
  family: string
  kind: string
  path: string
  title: string | null
  occurredAt: string | null
  body: string | null
  attributes: Record<string, unknown>
  relatedIds: string[]
}

export interface QueryRuntimeModule extends HealthQueryRuntimeMethods {
  readVault(vaultRoot: string): Promise<unknown>
  readVaultTolerant(vaultRoot: string): Promise<unknown>
  lookupEntityById(readModel: unknown, entityId: string): QueryEntity | null
  listEntities(
    readModel: unknown,
    filters?: Record<string, unknown>,
  ): QueryEntity[]
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

export interface IntegratedRuntime {
  core: CoreRuntimeModule
  query: QueryRuntimeModule
}
