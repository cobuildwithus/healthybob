import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { z } from 'incur'
import { loadRuntimeModule } from './runtime-import.js'
import { VaultCliError } from './vault-cli-errors.js'
import {
  inboxDaemonStateSchema,
  inboxDoctorCheckSchema,
  inboxPromotionStoreSchema,
  inboxRuntimeConfigSchema,
  type InboxBackfillResult,
  type InboxConnectorConfig,
  type InboxDaemonState,
  type InboxDoctorCheck,
  type InboxDoctorResult,
  type InboxInitResult,
  type InboxListResult,
  type InboxPromotionEntry,
  type InboxPromoteMealResult,
  type InboxRunResult,
  type InboxRuntimeConfig,
  type InboxSearchResult,
  type InboxShowResult,
  type InboxSourceAddResult,
  type InboxSourceListResult,
  type InboxSourceRemoveResult,
} from './inbox-cli-contracts.js'

interface RuntimeAttachmentRecord {
  ordinal: number
  externalId?: string | null
  kind: 'image' | 'audio' | 'video' | 'document' | 'other'
  mime?: string | null
  originalPath?: string | null
  storedPath?: string | null
  fileName?: string | null
  byteSize?: number | null
  sha256?: string | null
}

interface RuntimeCaptureRecord {
  captureId: string
  eventId: string
  source: string
  externalId: string
  accountId?: string | null
  thread: {
    id: string
    title?: string | null
    isDirect?: boolean
  }
  actor: {
    id?: string | null
    displayName?: string | null
    isSelf: boolean
  }
  occurredAt: string
  receivedAt?: string | null
  text: string | null
  attachments: RuntimeAttachmentRecord[]
  raw: Record<string, unknown>
  envelopePath: string
  createdAt: string
}

interface RuntimeSearchHit {
  captureId: string
  source: string
  accountId?: string | null
  threadId: string
  threadTitle?: string | null
  occurredAt: string
  text: string | null
  snippet: string
  score: number
  envelopePath: string
}

interface RuntimeStore {
  close(): void
  getCursor(source: string, accountId?: string | null): Record<string, unknown> | null
  setCursor(
    source: string,
    accountId: string | null | undefined,
    cursor: Record<string, unknown> | null,
  ): void
  listCaptures(filters?: {
    source?: string
    accountId?: string | null
    limit?: number
  }): RuntimeCaptureRecord[]
  searchCaptures(filters: {
    text: string
    source?: string
    accountId?: string | null
    limit?: number
  }): RuntimeSearchHit[]
  getCapture(captureId: string): RuntimeCaptureRecord | null
}

interface PersistedCapture {
  deduped: boolean
}

interface PollConnector {
  source: string
  backfill?(
    cursor: Record<string, unknown> | null,
    emit: (capture: RuntimeCaptureRecordInput) => Promise<PersistedCapture>,
  ): Promise<Record<string, unknown> | null>
  close?(): Promise<void> | void
}

interface RuntimeCaptureRecordInput {
  source: string
  externalId: string
  accountId?: string | null
  occurredAt: string
  receivedAt?: string | null
}

interface InboxPipeline {
  runtime: RuntimeStore
  processCapture(input: RuntimeCaptureRecordInput): Promise<PersistedCapture>
  close(): void
}

interface ImessageDriver {
  getMessages(input: {
    cursor?: Record<string, unknown> | null
    limit?: number
    includeOwnMessages?: boolean
  }): Promise<unknown[]>
  listChats?(): Promise<unknown[]>
}

interface InboxRuntimeModule {
  ensureInboxVault(vaultRoot: string): Promise<void>
  openInboxRuntime(input: { vaultRoot: string }): Promise<RuntimeStore>
  createInboxPipeline(input: {
    vaultRoot: string
    runtime: RuntimeStore
  }): Promise<InboxPipeline>
  createImessageConnector(input: {
    driver: ImessageDriver
    accountId?: string | null
    includeOwnMessages?: boolean
    backfillLimit?: number
  }): PollConnector
  loadImessageKitDriver(): Promise<ImessageDriver>
  rebuildRuntimeFromVault(input: {
    vaultRoot: string
    runtime: RuntimeStore
  }): Promise<void>
  runInboxDaemon(input: {
    pipeline: InboxPipeline
    connectors: PollConnector[]
    signal: AbortSignal
  }): Promise<void>
}

interface CoreRuntimeModule {
  addMeal(input: {
    vaultRoot: string
    occurredAt?: string
    note?: string
    photoPath?: string
    audioPath?: string
    source?: string
  }): Promise<{
    mealId: string
    event: {
      id: string
    }
  }>
}

interface CommandContext {
  vault: string
  requestId: string | null
}

interface InboxPaths {
  absoluteVaultRoot: string
  runtimeRoot: string
  inboxRuntimeRoot: string
  databasePath: string
  configPath: string
  statePath: string
  promotionsPath: string
}

interface InboxServicesDependencies {
  clock?: () => Date
  getPid?: () => number
  getPlatform?: () => NodeJS.Platform
  getHomeDirectory?: () => string
  killProcess?: (pid: number, signal?: NodeJS.Signals | number) => void
  sleep?: (milliseconds: number) => Promise<void>
  loadCoreModule?: () => Promise<CoreRuntimeModule>
  loadInboxModule?: () => Promise<InboxRuntimeModule>
  loadImessageDriver?: (config: InboxConnectorConfig) => Promise<ImessageDriver>
}

interface SourceAddInput extends CommandContext {
  source: InboxConnectorConfig['source']
  id: string
  account?: string | null
  includeOwn?: boolean
  backfillLimit?: number
}

interface SourceRemoveInput extends CommandContext {
  connectorId: string
}

interface DoctorInput extends CommandContext {
  sourceId?: string | null
}

interface BackfillInput extends CommandContext {
  sourceId: string
  limit?: number
}

interface ListInput extends CommandContext {
  sourceId?: string | null
  limit?: number
}

interface SearchInput extends ListInput {
  text: string
}

interface PromoteInput extends CommandContext {
  captureId: string
}

export interface InboxCliServices {
  init(input: CommandContext & { rebuild?: boolean }): Promise<InboxInitResult>
  sourceAdd(input: SourceAddInput): Promise<InboxSourceAddResult>
  sourceList(input: CommandContext): Promise<InboxSourceListResult>
  sourceRemove(input: SourceRemoveInput): Promise<InboxSourceRemoveResult>
  doctor(input: DoctorInput): Promise<InboxDoctorResult>
  backfill(input: BackfillInput): Promise<InboxBackfillResult>
  run(
    input: CommandContext,
    options?: {
      signal?: AbortSignal
    },
  ): Promise<InboxRunResult>
  status(input: CommandContext): Promise<InboxDaemonState>
  stop(input: CommandContext): Promise<InboxDaemonState>
  list(input: ListInput): Promise<InboxListResult>
  show(input: CommandContext & { captureId: string }): Promise<InboxShowResult>
  search(input: SearchInput): Promise<InboxSearchResult>
  promoteMeal(input: PromoteInput): Promise<InboxPromoteMealResult>
  promoteJournal(input: PromoteInput): Promise<never>
  promoteExperimentNote(input: PromoteInput): Promise<never>
}

const IMESSAGE_MESSAGES_DB_RELATIVE_PATH = path.join(
  'Library',
  'Messages',
  'chat.db',
)
const CONFIG_VERSION = 1
const PROMOTION_STORE_VERSION = 1

export function createIntegratedInboxCliServices(
  dependencies: InboxServicesDependencies = {},
): InboxCliServices {
  const clock = dependencies.clock ?? (() => new Date())
  const getPid = dependencies.getPid ?? (() => process.pid)
  const getPlatform = dependencies.getPlatform ?? (() => process.platform)
  const getHomeDirectory = dependencies.getHomeDirectory ?? (() => os.homedir())
  const killProcess =
    dependencies.killProcess ??
    ((pid: number, signal?: NodeJS.Signals | number) => {
      process.kill(pid, signal)
    })
  const sleep =
    dependencies.sleep ??
    ((milliseconds: number) =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, milliseconds)
      }))
  const loadCore =
    dependencies.loadCoreModule ??
    (() => loadRuntimeModule<CoreRuntimeModule>('@healthybob/core'))
  const loadInbox =
    dependencies.loadInboxModule ??
    (() => loadRuntimeModule<InboxRuntimeModule>('@healthybob/inboxd'))

  const loadConfiguredImessageDriver = async (
    config: InboxConnectorConfig,
  ): Promise<ImessageDriver> => {
    if (dependencies.loadImessageDriver) {
      return dependencies.loadImessageDriver(config)
    }

    const inboxd = await loadInbox()
    return inboxd.loadImessageKitDriver()
  }

  return {
    async init(input) {
      const paths = resolveInboxPaths(input.vault)
      const inboxd = await loadInbox()
      await inboxd.ensureInboxVault(paths.absoluteVaultRoot)

      const createdPaths: string[] = []
      await ensureDirectory(paths.runtimeRoot, createdPaths, paths.absoluteVaultRoot)
      await ensureDirectory(
        paths.inboxRuntimeRoot,
        createdPaths,
        paths.absoluteVaultRoot,
      )
      await ensureConfigFile(paths, createdPaths)

      if (!(await fileExists(paths.databasePath))) {
        createdPaths.push(relativeToVault(paths.absoluteVaultRoot, paths.databasePath))
      }

      const runtime = await inboxd.openInboxRuntime({
        vaultRoot: paths.absoluteVaultRoot,
      })
      runtime.close()

      let rebuiltCaptures = 0
      if (input.rebuild) {
        rebuiltCaptures = await rebuildRuntime(paths, inboxd)
      }

      return {
        vault: paths.absoluteVaultRoot,
        runtimeDirectory: relativeToVault(
          paths.absoluteVaultRoot,
          paths.inboxRuntimeRoot,
        ),
        databasePath: relativeToVault(paths.absoluteVaultRoot, paths.databasePath),
        configPath: relativeToVault(paths.absoluteVaultRoot, paths.configPath),
        createdPaths,
        rebuiltCaptures,
      }
    },

    async sourceAdd(input) {
      const paths = await ensureInitialized(loadInbox, input.vault)
      const config = await readConfig(paths)

      if (config.connectors.some((connector) => connector.id === input.id)) {
        throw new VaultCliError(
          'INBOX_SOURCE_EXISTS',
          `Inbox source "${input.id}" is already configured.`,
        )
      }

      const connector: InboxConnectorConfig = {
        id: input.id,
        source: input.source,
        enabled: true,
        accountId: normalizeConnectorAccountId(input.source, input.account),
        options: {
          includeOwnMessages: input.includeOwn ?? undefined,
          backfillLimit: normalizeBackfillLimit(input.backfillLimit),
        },
      }

      config.connectors.push(connector)
      sortConnectors(config)
      await writeConfig(paths, config)

      return {
        vault: paths.absoluteVaultRoot,
        configPath: relativeToVault(paths.absoluteVaultRoot, paths.configPath),
        connector,
        connectorCount: config.connectors.length,
      }
    },

    async sourceList(input) {
      const paths = await ensureInitialized(loadInbox, input.vault)
      const config = await readConfig(paths)

      return {
        vault: paths.absoluteVaultRoot,
        configPath: relativeToVault(paths.absoluteVaultRoot, paths.configPath),
        connectors: config.connectors,
      }
    },

    async sourceRemove(input) {
      const paths = await ensureInitialized(loadInbox, input.vault)
      const config = await readConfig(paths)
      const index = config.connectors.findIndex(
        (connector) => connector.id === input.connectorId,
      )

      if (index === -1) {
        throw new VaultCliError(
          'INBOX_SOURCE_NOT_FOUND',
          `Inbox source "${input.connectorId}" is not configured.`,
        )
      }

      config.connectors.splice(index, 1)
      await writeConfig(paths, config)

      return {
        vault: paths.absoluteVaultRoot,
        configPath: relativeToVault(paths.absoluteVaultRoot, paths.configPath),
        removed: true,
        connectorId: input.connectorId,
        connectorCount: config.connectors.length,
      }
    },

    async doctor(input) {
      const paths = resolveInboxPaths(input.vault)
      const inboxd = await loadInbox()
      const checks: InboxDoctorCheck[] = []
      let config: InboxRuntimeConfig | null = null
      let databaseAvailable = false

      try {
        await inboxd.ensureInboxVault(paths.absoluteVaultRoot)
        checks.push(passCheck('vault', 'Vault metadata is readable.'))
      } catch (error) {
        checks.push(
          failCheck('vault', 'Vault metadata could not be read.', {
            error: errorMessage(error),
          }),
        )
        return {
          vault: paths.absoluteVaultRoot,
          configPath: null,
          databasePath: null,
          target: input.sourceId ?? null,
          ok: false,
          checks,
          connectors: [],
        }
      }

      try {
        config = await readConfig(paths)
        checks.push(passCheck('config', 'Inbox runtime config parsed successfully.'))
      } catch (error) {
        checks.push(
          failCheck('config', 'Inbox runtime config is missing or invalid.', {
            error: errorMessage(error),
          }),
        )
      }

      try {
        const runtime = await inboxd.openInboxRuntime({
          vaultRoot: paths.absoluteVaultRoot,
        })
        runtime.close()
        databaseAvailable = true
        checks.push(passCheck('runtime-db', 'Inbox runtime SQLite opened successfully.'))
      } catch (error) {
        checks.push(
          failCheck('runtime-db', 'Inbox runtime SQLite could not be opened.', {
            error: errorMessage(error),
          }),
        )
      }

      if (!config) {
        return {
          vault: paths.absoluteVaultRoot,
          configPath: (await fileExists(paths.configPath))
            ? relativeToVault(paths.absoluteVaultRoot, paths.configPath)
            : null,
          databasePath: databaseAvailable
            ? relativeToVault(paths.absoluteVaultRoot, paths.databasePath)
            : null,
          target: input.sourceId ?? null,
          ok: checks.every((check) => check.status !== 'fail'),
          checks,
          connectors: [],
        }
      }

      if (!input.sourceId) {
        checks.push(
          config.connectors.length > 0
            ? passCheck(
                'connectors',
                `Configured ${config.connectors.length} inbox source${config.connectors.length === 1 ? '' : 's'}.`,
              )
            : warnCheck(
                'connectors',
                'No inbox sources are configured yet.',
              ),
        )

        return {
          vault: paths.absoluteVaultRoot,
          configPath: relativeToVault(paths.absoluteVaultRoot, paths.configPath),
          databasePath: databaseAvailable
            ? relativeToVault(paths.absoluteVaultRoot, paths.databasePath)
            : null,
          target: null,
          ok: checks.every((check) => check.status !== 'fail'),
          checks,
          connectors: config.connectors,
        }
      }

      const connector = findConnector(config, input.sourceId)
      if (!connector) {
        checks.push(
          failCheck(
            'connector',
            `Inbox source "${input.sourceId}" is not configured.`,
          ),
        )
        return {
          vault: paths.absoluteVaultRoot,
          configPath: relativeToVault(paths.absoluteVaultRoot, paths.configPath),
          databasePath: databaseAvailable
            ? relativeToVault(paths.absoluteVaultRoot, paths.databasePath)
            : null,
          target: input.sourceId,
          ok: false,
          checks,
          connectors: config.connectors,
        }
      }

      checks.push(
        passCheck(
          'connector',
          `Connector "${connector.id}" is configured and ${connector.enabled ? 'enabled' : 'disabled'}.`,
          {
            source: connector.source,
            accountId: connector.accountId ?? null,
          },
        ),
      )

      if (connector.source === 'imessage') {
        if (getPlatform() !== 'darwin') {
          checks.push(
            failCheck(
              'platform',
              'The iMessage connector requires macOS.',
              { platform: getPlatform() },
            ),
          )
        } else {
          checks.push(passCheck('platform', 'Running on macOS.'))
        }

        let driver: ImessageDriver | null = null
        try {
          driver = await loadConfiguredImessageDriver(connector)
          checks.push(passCheck('driver-import', 'The iMessage driver imported successfully.'))
        } catch (error) {
          checks.push(
            failCheck(
              'driver-import',
              'The iMessage driver could not be imported.',
              { error: errorMessage(error) },
            ),
          )
        }

        try {
          await access(path.join(getHomeDirectory(), IMESSAGE_MESSAGES_DB_RELATIVE_PATH))
          checks.push(
            passCheck(
              'messages-db',
              'The local Messages database is readable.',
              {
                path: IMESSAGE_MESSAGES_DB_RELATIVE_PATH.replace(/\\/g, '/'),
              },
            ),
          )
        } catch (error) {
          checks.push(
            failCheck(
              'messages-db',
              'The local Messages database could not be accessed.',
              { error: errorMessage(error) },
            ),
          )
        }

        if (databaseAvailable) {
          try {
            await rebuildRuntime(paths, inboxd)
            checks.push(
              passCheck(
                'rebuild',
                'Runtime rebuild from vault envelopes completed successfully.',
              ),
            )
          } catch (error) {
            checks.push(
              failCheck(
                'rebuild',
                'Runtime rebuild from vault envelopes failed.',
                { error: errorMessage(error) },
              ),
            )
          }
        }

        if (driver) {
          try {
            const chats = (await driver.listChats?.()) ?? []
            const messages = await driver.getMessages({
              limit: 1,
              cursor: null,
              includeOwnMessages:
                connector.options.includeOwnMessages ?? true,
            })

            if (chats.length > 0 || messages.length > 0) {
              checks.push(
                passCheck(
                  'probe',
                  'The connector can list chats or fetch messages.',
                  {
                    chats: chats.length,
                    messages: messages.length,
                  },
                ),
              )
            } else {
              checks.push(
                warnCheck(
                  'probe',
                  'The connector responded but returned no chats or messages.',
                ),
              )
            }
          } catch (error) {
            checks.push(
              failCheck(
                'probe',
                'The connector could not fetch chats or messages.',
                { error: errorMessage(error) },
              ),
            )
          }
        }
      }

      return {
        vault: paths.absoluteVaultRoot,
        configPath: relativeToVault(paths.absoluteVaultRoot, paths.configPath),
        databasePath: databaseAvailable
          ? relativeToVault(paths.absoluteVaultRoot, paths.databasePath)
          : null,
        target: connector.id,
        ok: checks.every((check) => check.status !== 'fail'),
        checks,
        connectors: config.connectors,
      }
    },

    async backfill(input) {
      const paths = await ensureInitialized(loadInbox, input.vault)
      const inboxd = await loadInbox()
      const config = await readConfig(paths)
      const connectorConfig = requireConnector(config, input.sourceId)
      const runtime = await inboxd.openInboxRuntime({
        vaultRoot: paths.absoluteVaultRoot,
      })
      const pipeline = await inboxd.createInboxPipeline({
        vaultRoot: paths.absoluteVaultRoot,
        runtime,
      })

      try {
        const connector = await instantiateConnector({
          connector: connectorConfig,
          inputLimit: input.limit,
          loadImessageDriver: loadConfiguredImessageDriver,
          loadInbox,
        })
        let importedCount = 0
        let dedupedCount = 0
        let cursor = runtime.getCursor(
          connector.source,
          connectorConfig.accountId ?? null,
        )

        const nextCursor = await connector.backfill?.(cursor, async (capture) => {
          const persisted = await pipeline.processCapture(capture)
          if (persisted.deduped) {
            dedupedCount += 1
          } else {
            importedCount += 1
          }
          cursor = buildCaptureCursor(capture)
          runtime.setCursor(
            connector.source,
            connectorConfig.accountId ?? capture.accountId ?? null,
            cursor,
          )
          return persisted
        })

        runtime.setCursor(
          connector.source,
          connectorConfig.accountId ?? null,
          nextCursor ?? cursor ?? null,
        )
        await connector.close?.()

        return {
          vault: paths.absoluteVaultRoot,
          sourceId: connectorConfig.id,
          importedCount,
          dedupedCount,
          cursor:
            runtime.getCursor(connector.source, connectorConfig.accountId ?? null) ??
            null,
        }
      } finally {
        pipeline.close()
      }
    },

    async run(input, options) {
      const paths = await ensureInitialized(loadInbox, input.vault)
      const inboxd = await loadInbox()
      const config = await readConfig(paths)
      const enabledConnectors = config.connectors.filter(
        (connector) => connector.enabled,
      )

      if (enabledConnectors.length === 0) {
        throw new VaultCliError(
          'INBOX_NO_ENABLED_SOURCES',
          'No enabled inbox sources are configured. Add a source first.',
        )
      }

      const existingState = await normalizeDaemonState(
        paths,
        dependencies,
        clock,
        getPid,
      )
      if (existingState.running && existingState.pid !== getPid()) {
        throw new VaultCliError(
          'INBOX_ALREADY_RUNNING',
          'Inbox daemon state already reports a running process.',
          { pid: existingState.pid },
        )
      }

      const runtime = await inboxd.openInboxRuntime({
        vaultRoot: paths.absoluteVaultRoot,
      })
      const pipeline = await inboxd.createInboxPipeline({
        vaultRoot: paths.absoluteVaultRoot,
        runtime,
      })

      const connectors = await Promise.all(
        enabledConnectors.map((connector) =>
          instantiateConnector({
            connector,
            loadImessageDriver: loadConfiguredImessageDriver,
            loadInbox,
          }),
        ),
      )

      const startedAt = clock().toISOString()
      const signalBridge = options?.signal
        ? { cleanup: () => {}, signal: options.signal }
        : createProcessSignalBridge()
      const runSignal = signalBridge.signal
      const shouldReportSignal = runSignal.aborted === false
      await writeDaemonState(paths, {
        running: true,
        stale: false,
        pid: getPid(),
        startedAt,
        stoppedAt: null,
        status: 'running',
        connectorIds: enabledConnectors.map((connector) => connector.id),
        statePath: relativeToVault(paths.absoluteVaultRoot, paths.statePath),
        configPath: relativeToVault(paths.absoluteVaultRoot, paths.configPath),
        databasePath: relativeToVault(paths.absoluteVaultRoot, paths.databasePath),
        message: null,
      })

      let reason: InboxRunResult['reason'] = 'completed'

      try {
        await inboxd.runInboxDaemon({
          pipeline,
          connectors,
          signal: runSignal,
        })
      } catch (error) {
        reason = runSignal.aborted ? 'signal' : 'error'
        await writeDaemonState(paths, {
          running: false,
          stale: false,
          pid: getPid(),
          startedAt,
          stoppedAt: clock().toISOString(),
          status: 'failed',
          connectorIds: enabledConnectors.map((connector) => connector.id),
          statePath: relativeToVault(paths.absoluteVaultRoot, paths.statePath),
          configPath: relativeToVault(paths.absoluteVaultRoot, paths.configPath),
          databasePath: relativeToVault(paths.absoluteVaultRoot, paths.databasePath),
          message: errorMessage(error),
        })
        throw error
      } finally {
        signalBridge.cleanup()
        pipeline.close()
      }

      if (runSignal.aborted) {
        reason = 'signal'
      }

      const stoppedAt = clock().toISOString()
      await writeDaemonState(paths, {
        running: false,
        stale: false,
        pid: getPid(),
        startedAt,
        stoppedAt,
        status: 'stopped',
        connectorIds: enabledConnectors.map((connector) => connector.id),
        statePath: relativeToVault(paths.absoluteVaultRoot, paths.statePath),
        configPath: relativeToVault(paths.absoluteVaultRoot, paths.configPath),
        databasePath: relativeToVault(paths.absoluteVaultRoot, paths.databasePath),
        message:
          reason === 'signal' && shouldReportSignal
            ? 'Inbox daemon stopped by signal.'
            : null,
      })

      return {
        vault: paths.absoluteVaultRoot,
        sourceIds: enabledConnectors.map((connector) => connector.id),
        startedAt,
        stoppedAt,
        reason,
        statePath: relativeToVault(paths.absoluteVaultRoot, paths.statePath),
      }
    },

    async status(input) {
      const paths = await ensureInitialized(loadInbox, input.vault)
      return normalizeDaemonState(paths, dependencies, clock, getPid)
    },

    async stop(input) {
      const paths = await ensureInitialized(loadInbox, input.vault)
      const state = await normalizeDaemonState(paths, dependencies, clock, getPid)

      if (!state.running || !state.pid) {
        throw new VaultCliError(
          'INBOX_NOT_RUNNING',
          'Inbox daemon is not currently running.',
        )
      }

      killProcess(state.pid, 'SIGTERM')

      for (let attempt = 0; attempt < 50; attempt += 1) {
        await sleep(100)
        const nextState = await normalizeDaemonState(
          paths,
          dependencies,
          clock,
          getPid,
        )
        if (!nextState.running) {
          return nextState
        }
      }

      throw new VaultCliError(
        'INBOX_STOP_TIMEOUT',
        'Inbox daemon did not stop within the expected timeout.',
        { pid: state.pid },
      )
    },

    async list(input) {
      const paths = await ensureInitialized(loadInbox, input.vault)
      const inboxd = await loadInbox()
      const config = await readConfig(paths)
      const sourceFilter = resolveSourceFilter(config, input.sourceId ?? null)
      const runtime = await inboxd.openInboxRuntime({
        vaultRoot: paths.absoluteVaultRoot,
      })

      try {
        const items = runtime.listCaptures({
          source: sourceFilter?.source,
          accountId: sourceFilter?.accountId,
          limit: normalizeLimit(input.limit, 50, 200),
        })
        const promotionsByCapture = await readPromotionsByCapture(paths)

        return {
          vault: paths.absoluteVaultRoot,
          filters: {
            sourceId: input.sourceId ?? null,
            limit: normalizeLimit(input.limit, 50, 200),
          },
          items: items.map((capture) =>
            summarizeCapture(capture, promotionsByCapture.get(capture.captureId) ?? []),
          ),
        }
      } finally {
        runtime.close()
      }
    },

    async show(input) {
      const paths = await ensureInitialized(loadInbox, input.vault)
      const inboxd = await loadInbox()
      const runtime = await inboxd.openInboxRuntime({
        vaultRoot: paths.absoluteVaultRoot,
      })

      try {
        const capture = runtime.getCapture(input.captureId)
        if (!capture) {
          throw new VaultCliError(
            'INBOX_CAPTURE_NOT_FOUND',
            `Inbox capture "${input.captureId}" was not found.`,
          )
        }

        const promotionsByCapture = await readPromotionsByCapture(paths)
        return {
          vault: paths.absoluteVaultRoot,
          capture: detailCapture(
            capture,
            promotionsByCapture.get(capture.captureId) ?? [],
          ),
        }
      } finally {
        runtime.close()
      }
    },

    async search(input) {
      const paths = await ensureInitialized(loadInbox, input.vault)
      const inboxd = await loadInbox()
      const config = await readConfig(paths)
      const sourceFilter = resolveSourceFilter(config, input.sourceId ?? null)
      const runtime = await inboxd.openInboxRuntime({
        vaultRoot: paths.absoluteVaultRoot,
      })

      try {
        const hits = runtime.searchCaptures({
          text: input.text,
          source: sourceFilter?.source,
          accountId: sourceFilter?.accountId,
          limit: normalizeLimit(input.limit, 20, 200),
        })
        const promotionsByCapture = await readPromotionsByCapture(paths)

        return {
          vault: paths.absoluteVaultRoot,
          filters: {
            text: input.text,
            sourceId: input.sourceId ?? null,
            limit: normalizeLimit(input.limit, 20, 200),
          },
          hits: hits.map((hit) => ({
            captureId: hit.captureId,
            source: hit.source,
            accountId: hit.accountId ?? null,
            threadId: hit.threadId,
            threadTitle: hit.threadTitle ?? null,
            occurredAt: hit.occurredAt,
            text: hit.text,
            snippet: hit.snippet,
            score: hit.score,
            envelopePath: hit.envelopePath,
            promotions: promotionsByCapture.get(hit.captureId) ?? [],
          })),
        }
      } finally {
        runtime.close()
      }
    },

    async promoteMeal(input) {
      const paths = await ensureInitialized(loadInbox, input.vault)
      const inboxd = await loadInbox()
      const core = await loadCore()
      const runtime = await inboxd.openInboxRuntime({
        vaultRoot: paths.absoluteVaultRoot,
      })

      try {
        const capture = runtime.getCapture(input.captureId)
        if (!capture) {
          throw new VaultCliError(
            'INBOX_CAPTURE_NOT_FOUND',
            `Inbox capture "${input.captureId}" was not found.`,
          )
        }

        const promotionStore = await readPromotionStore(paths)
        const existing = promotionStore.entries.find(
          (entry) =>
            entry.captureId === input.captureId &&
            entry.target === 'meal' &&
            entry.status === 'applied',
        )
        if (existing) {
          if (!existing.lookupId || !existing.relatedId) {
            throw new VaultCliError(
              'INBOX_PROMOTION_STATE_INVALID',
              'Stored meal promotion state is missing canonical ids.',
            )
          }
          return {
            vault: paths.absoluteVaultRoot,
            captureId: input.captureId,
            target: 'meal',
            lookupId: existing.lookupId,
            relatedId: existing.relatedId,
            created: false,
          }
        }

        const photoAttachment = capture.attachments.find(
          (attachment) =>
            attachment.kind === 'image' && typeof attachment.storedPath === 'string',
        )
        if (!photoAttachment?.storedPath) {
          throw new VaultCliError(
            'INBOX_PROMOTION_REQUIRES_PHOTO',
            'Meal promotion requires an image attachment on the inbox capture.',
          )
        }

        const audioAttachment = capture.attachments.find(
          (attachment) =>
            attachment.kind === 'audio' && typeof attachment.storedPath === 'string',
        )
        const result = await core.addMeal({
          vaultRoot: paths.absoluteVaultRoot,
          occurredAt: capture.occurredAt,
          note: capture.text ?? undefined,
          photoPath: path.join(paths.absoluteVaultRoot, photoAttachment.storedPath),
          audioPath:
            typeof audioAttachment?.storedPath === 'string'
              ? path.join(paths.absoluteVaultRoot, audioAttachment.storedPath)
              : undefined,
          source: 'import',
        })

        promotionStore.entries.push({
          captureId: input.captureId,
          target: 'meal',
          status: 'applied',
          promotedAt: clock().toISOString(),
          lookupId: result.event.id,
          relatedId: result.mealId,
          note: capture.text ?? null,
        })
        await writePromotionStore(paths, promotionStore)

        return {
          vault: paths.absoluteVaultRoot,
          captureId: input.captureId,
          target: 'meal',
          lookupId: result.event.id,
          relatedId: result.mealId,
          created: true,
        }
      } finally {
        runtime.close()
      }
    },

    async promoteJournal() {
      throw unsupportedPromotion('journal')
    },

    async promoteExperimentNote() {
      throw unsupportedPromotion('experiment-note')
    },
  }
}

function resolveInboxPaths(vaultRoot: string): InboxPaths {
  const absoluteVaultRoot = path.resolve(vaultRoot)
  const runtimeRoot = path.join(absoluteVaultRoot, '.runtime')
  const inboxRuntimeRoot = path.join(runtimeRoot, 'inboxd')

  return {
    absoluteVaultRoot,
    runtimeRoot,
    inboxRuntimeRoot,
    databasePath: path.join(runtimeRoot, 'inboxd.sqlite'),
    configPath: path.join(inboxRuntimeRoot, 'config.json'),
    statePath: path.join(inboxRuntimeRoot, 'state.json'),
    promotionsPath: path.join(inboxRuntimeRoot, 'promotions.json'),
  }
}

async function ensureInitialized(
  loadInbox: () => Promise<InboxRuntimeModule>,
  vaultRoot: string,
): Promise<InboxPaths> {
  const paths = resolveInboxPaths(vaultRoot)
  const inboxd = await loadInbox()
  await inboxd.ensureInboxVault(paths.absoluteVaultRoot)

  if (!(await fileExists(paths.configPath))) {
    throw new VaultCliError(
      'INBOX_NOT_INITIALIZED',
      'Inbox runtime is not initialized. Run `vault-cli inbox init` first.',
    )
  }

  await readConfig(paths)
  return paths
}

async function ensureDirectory(
  absolutePath: string,
  createdPaths: string[],
  vaultRoot: string,
): Promise<void> {
  if (!(await fileExists(absolutePath))) {
    createdPaths.push(relativeToVault(vaultRoot, absolutePath))
  }
  await mkdir(absolutePath, { recursive: true })
}

async function ensureConfigFile(
  paths: InboxPaths,
  createdPaths: string[],
): Promise<void> {
  if (await fileExists(paths.configPath)) {
    return
  }

  const emptyConfig: InboxRuntimeConfig = {
    version: CONFIG_VERSION,
    connectors: [],
  }
  await writeJsonFile(paths.configPath, emptyConfig)
  createdPaths.push(relativeToVault(paths.absoluteVaultRoot, paths.configPath))
}

async function readConfig(paths: InboxPaths): Promise<InboxRuntimeConfig> {
  return readJsonWithSchema(
    paths.configPath,
    inboxRuntimeConfigSchema,
    'INBOX_CONFIG_INVALID',
    'Inbox runtime config is invalid.',
  )
}

async function writeConfig(
  paths: InboxPaths,
  config: InboxRuntimeConfig,
): Promise<void> {
  await writeJsonFile(paths.configPath, inboxRuntimeConfigSchema.parse(config))
}

async function rebuildRuntime(
  paths: InboxPaths,
  inboxd: InboxRuntimeModule,
): Promise<number> {
  const runtime = await inboxd.openInboxRuntime({
    vaultRoot: paths.absoluteVaultRoot,
  })

  try {
    await inboxd.rebuildRuntimeFromVault({
      vaultRoot: paths.absoluteVaultRoot,
      runtime,
    })

    return runtime.listCaptures({ limit: 200 }).length
  } finally {
    runtime.close()
  }
}

function sortConnectors(config: InboxRuntimeConfig): void {
  config.connectors.sort((left, right) => left.id.localeCompare(right.id))
}

function findConnector(
  config: InboxRuntimeConfig,
  sourceId: string,
): InboxConnectorConfig | null {
  return config.connectors.find((connector) => connector.id === sourceId) ?? null
}

function requireConnector(
  config: InboxRuntimeConfig,
  sourceId: string,
): InboxConnectorConfig {
  const connector = findConnector(config, sourceId)
  if (!connector) {
    throw new VaultCliError(
      'INBOX_SOURCE_NOT_FOUND',
      `Inbox source "${sourceId}" is not configured.`,
    )
  }

  return connector
}

async function instantiateConnector(input: {
  connector: InboxConnectorConfig
  inputLimit?: number
  loadInbox: () => Promise<InboxRuntimeModule>
  loadImessageDriver: (config: InboxConnectorConfig) => Promise<ImessageDriver>
}) {
  const inboxd = await input.loadInbox()

  switch (input.connector.source) {
    case 'imessage': {
      const driver = await input.loadImessageDriver(input.connector)
      return inboxd.createImessageConnector({
        driver,
        accountId: input.connector.accountId ?? 'self',
        includeOwnMessages:
          input.connector.options.includeOwnMessages ?? true,
        backfillLimit:
          normalizeBackfillLimit(input.inputLimit) ??
          input.connector.options.backfillLimit ??
          500,
      })
    }
  }
}

function buildCaptureCursor(capture: {
  occurredAt: string
  externalId: string
  receivedAt?: string | null
}): Record<string, unknown> {
  return {
    occurredAt: capture.occurredAt,
    externalId: capture.externalId,
    receivedAt: capture.receivedAt ?? null,
  }
}

function summarizeCapture(capture: RuntimeCaptureRecord, promotions: InboxPromotionEntry[]) {
  return {
    captureId: capture.captureId,
    source: capture.source,
    accountId: capture.accountId ?? null,
    externalId: capture.externalId,
    threadId: capture.thread.id,
    threadTitle: capture.thread.title ?? null,
    actorId: capture.actor.id ?? null,
    actorName: capture.actor.displayName ?? null,
    actorIsSelf: capture.actor.isSelf,
    occurredAt: capture.occurredAt,
    receivedAt: capture.receivedAt ?? null,
    text: capture.text,
    attachmentCount: capture.attachments.length,
    envelopePath: capture.envelopePath,
    eventId: capture.eventId,
    promotions,
  }
}

function detailCapture(capture: RuntimeCaptureRecord, promotions: InboxPromotionEntry[]) {
  return {
    ...summarizeCapture(capture, promotions),
    createdAt: capture.createdAt,
    threadIsDirect: capture.thread.isDirect ?? false,
    attachments: capture.attachments.map((attachment) => ({
      ordinal: attachment.ordinal,
      externalId: attachment.externalId ?? null,
      kind: attachment.kind,
      mime: attachment.mime ?? null,
      originalPath: attachment.originalPath ?? null,
      storedPath: attachment.storedPath ?? null,
      fileName: attachment.fileName ?? null,
      byteSize: attachment.byteSize ?? null,
      sha256: attachment.sha256 ?? null,
    })),
    raw: capture.raw,
  }
}

function resolveSourceFilter(
  config: InboxRuntimeConfig,
  sourceId: string | null,
): { source: string; accountId: string | null } | null {
  if (!sourceId) {
    return null
  }

  const connector = requireConnector(config, sourceId)
  return {
    source: connector.source,
    accountId: connector.accountId ?? null,
  }
}

async function readPromotionsByCapture(
  paths: InboxPaths,
): Promise<Map<string, InboxPromotionEntry[]>> {
  const store = await readPromotionStore(paths)
  const byCapture = new Map<string, InboxPromotionEntry[]>()

  for (const entry of store.entries) {
    const entries = byCapture.get(entry.captureId) ?? []
    entries.push(entry)
    byCapture.set(entry.captureId, entries)
  }

  return byCapture
}

async function readPromotionStore(
  paths: InboxPaths,
): Promise<z.infer<typeof inboxPromotionStoreSchema>> {
  if (!(await fileExists(paths.promotionsPath))) {
    return {
      version: PROMOTION_STORE_VERSION,
      entries: [],
    } satisfies z.infer<typeof inboxPromotionStoreSchema>
  }

  return readJsonWithSchema(
    paths.promotionsPath,
    inboxPromotionStoreSchema,
    'INBOX_PROMOTIONS_INVALID',
    'Inbox promotion state is invalid.',
  )
}

async function writePromotionStore(
  paths: InboxPaths,
  store: z.infer<typeof inboxPromotionStoreSchema>,
): Promise<void> {
  await writeJsonFile(
    paths.promotionsPath,
    inboxPromotionStoreSchema.parse(store),
  )
}

async function normalizeDaemonState(
  paths: InboxPaths,
  dependencies: InboxServicesDependencies,
  clock: () => Date,
  getPid: () => number,
): Promise<InboxDaemonState> {
  if (!(await fileExists(paths.statePath))) {
    return idleState(paths)
  }

  const state = await readJsonWithSchema(
    paths.statePath,
    inboxDaemonStateSchema,
    'INBOX_STATE_INVALID',
    'Inbox daemon state is invalid.',
  )

  if (!state.running || !state.pid) {
    return state
  }

  if (state.pid === getPid()) {
    return state
  }

  if (isProcessAlive(state.pid, dependencies.killProcess)) {
    return state
  }

  const staleState: InboxDaemonState = {
    ...state,
    running: false,
    stale: true,
    status: 'stale',
    stoppedAt: state.stoppedAt ?? clock().toISOString(),
    message: 'Stale daemon state found; recorded PID is no longer running.',
  }
  await writeDaemonState(paths, staleState)
  return staleState
}

function idleState(paths: InboxPaths): InboxDaemonState {
  return {
    running: false,
    stale: false,
    pid: null,
    startedAt: null,
    stoppedAt: null,
    status: 'idle',
    connectorIds: [],
    statePath: relativeToVault(paths.absoluteVaultRoot, paths.statePath),
    configPath: relativeToVault(paths.absoluteVaultRoot, paths.configPath),
    databasePath: relativeToVault(paths.absoluteVaultRoot, paths.databasePath),
    message: null,
  }
}

async function writeDaemonState(
  paths: InboxPaths,
  state: InboxDaemonState,
): Promise<void> {
  await writeJsonFile(paths.statePath, inboxDaemonStateSchema.parse(state))
}

function isProcessAlive(
  pid: number,
  killProcess: InboxServicesDependencies['killProcess'],
): boolean {
  try {
    if (!killProcess) {
      process.kill(pid, 0)
    } else {
      killProcess(pid, 0)
    }
    return true
  } catch (error) {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: string }).code ?? '')
        : ''
    return code !== 'ESRCH'
  }
}

function createProcessSignalBridge(): {
  cleanup(): void
  signal: AbortSignal
} {
  const controller = new AbortController()
  const abort = () => {
    controller.abort()
    cleanup()
  }
  const cleanup = () => {
    process.off('SIGINT', abort)
    process.off('SIGTERM', abort)
  }

  process.on('SIGINT', abort)
  process.on('SIGTERM', abort)
  return {
    cleanup,
    signal: controller.signal,
  }
}

async function readJsonWithSchema<T>(
  absolutePath: string,
  schema: z.ZodType<T>,
  code: string,
  message: string,
): Promise<T> {
  try {
    const raw = await readFile(absolutePath, 'utf8')
    const parsed = JSON.parse(raw) as unknown
    return schema.parse(parsed)
  } catch (error) {
    throw new VaultCliError(code, message, { error: errorMessage(error) })
  }
}

async function writeJsonFile(
  absolutePath: string,
  value: unknown,
): Promise<void> {
  await mkdir(path.dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function fileExists(absolutePath: string): Promise<boolean> {
  try {
    await access(absolutePath)
    return true
  } catch {
    return false
  }
}

function normalizeNullableString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function normalizeConnectorAccountId(
  source: InboxConnectorConfig['source'],
  value: string | null | undefined,
): string | null {
  const normalized = normalizeNullableString(value)

  switch (source) {
    case 'imessage':
      return normalized ?? 'self'
  }
}

function normalizeBackfillLimit(value: number | undefined): number | undefined {
  if (value === undefined) {
    return undefined
  }

  if (!Number.isInteger(value) || value < 1 || value > 5000) {
    throw new VaultCliError(
      'INBOX_INVALID_LIMIT',
      'Backfill limit must be an integer between 1 and 5000.',
    )
  }

  return value
}

function normalizeLimit(
  value: number | undefined,
  fallback: number,
  max: number,
): number {
  if (value === undefined) {
    return fallback
  }

  if (!Number.isInteger(value) || value < 1 || value > max) {
    throw new VaultCliError(
      'INBOX_INVALID_LIMIT',
      `Limit must be an integer between 1 and ${max}.`,
    )
  }

  return value
}

function relativeToVault(vaultRoot: string, absolutePath: string): string {
  const relativePath = path.relative(vaultRoot, absolutePath)
  return relativePath.length > 0 ? relativePath.replace(/\\/g, '/') : '.'
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

function passCheck(
  name: string,
  message: string,
  details?: Record<string, unknown>,
): InboxDoctorCheck {
  return inboxDoctorCheckSchema.parse({
    name,
    status: 'pass',
    message,
    details,
  })
}

function warnCheck(
  name: string,
  message: string,
  details?: Record<string, unknown>,
): InboxDoctorCheck {
  return inboxDoctorCheckSchema.parse({
    name,
    status: 'warn',
    message,
    details,
  })
}

function failCheck(
  name: string,
  message: string,
  details?: Record<string, unknown>,
): InboxDoctorCheck {
  return inboxDoctorCheckSchema.parse({
    name,
    status: 'fail',
    message,
    details,
  })
}

function unsupportedPromotion(target: 'journal' | 'experiment-note'): VaultCliError {
  return new VaultCliError(
    'INBOX_PROMOTION_UNSUPPORTED',
    `Canonical ${target} promotion is not available yet through a safe shared runtime boundary.`,
  )
}
