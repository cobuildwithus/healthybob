import {
  type HealthCoreDescriptorEntry,
  type HealthQueryDescriptorEntry,
  hasHealthCoreDescriptor,
  hasHealthQueryDescriptor,
  healthEntityDescriptors,
} from "../health-cli-descriptors.js"

import type {
  CommandContext,
  EntityLookupInput,
  HealthCoreServiceMethods,
  HealthCoreRuntimeInput,
  HealthCoreRuntimeMethods,
  HealthCoreRuntimeResult,
  HealthListInput,
  HealthQueryServiceMethods,
  HealthQueryRuntimeListMethodName,
  HealthQueryRuntimeMethods,
  HealthQueryRuntimeShowMethodName,
  JsonFileInput,
  JsonObject,
  ProfileSnapshotRuntimeResult,
} from "../health-cli-method-types.js"
import type {
  CoreRuntimeModule,
  QueryRuntimeModule,
} from "./types.js"
import {
  asEntityEnvelope,
  asListEnvelope,
  assertNoReservedPayloadKeys,
  buildScaffoldPayload,
  optionalStringArray,
  readJsonPayload,
  recordPath,
  requirePayloadObjectField,
} from "./shared.js"

export function buildHealthCoreRuntimeInput(
  descriptor: HealthCoreDescriptorEntry,
  vault: string,
  payload: JsonObject,
): HealthCoreRuntimeInput {
  assertNoReservedPayloadKeys(payload)

  if (descriptor.core.upsertMode === "profile-snapshot") {
    const recordedAtValue = payload.recordedAt
    const sourceValue = payload.source
    const profileValue = requirePayloadObjectField(payload, "profile")

    return {
      vaultRoot: vault,
      recordedAt:
        typeof recordedAtValue === "string" ||
        typeof recordedAtValue === "number" ||
        recordedAtValue instanceof Date
          ? recordedAtValue
          : undefined,
      source: typeof sourceValue === "string" ? sourceValue : undefined,
      sourceAssessmentIds: optionalStringArray(payload.sourceAssessmentIds, "sourceAssessmentIds"),
      sourceEventIds: optionalStringArray(payload.sourceEventIds, "sourceEventIds"),
      profile: profileValue,
    }
  }

  return {
    ...payload,
    vaultRoot: vault,
  }
}

export function buildHealthCoreUpsertResult(
  descriptor: HealthCoreDescriptorEntry,
  vault: string,
  result: HealthCoreRuntimeResult,
) {
  if (descriptor.core.resultMode === "profile-snapshot") {
    const profileResult = result as ProfileSnapshotRuntimeResult
    return {
      vault,
      snapshotId: String(profileResult.snapshot.id),
      lookupId: String(profileResult.snapshot.id),
      ledgerFile: profileResult.ledgerPath,
      currentProfilePath: profileResult.currentProfile.relativePath,
      created: true,
      profile: profileResult.snapshot.profile,
    }
  }

  if (descriptor.core.resultMode === "history-ledger") {
    const historyResult = result as Awaited<
      ReturnType<HealthCoreRuntimeMethods["appendHistoryEvent"]>
    >
    return {
      vault,
      eventId: String(historyResult.record.id),
      lookupId: String(historyResult.record.id),
      ledgerFile: historyResult.relativePath,
      created: true,
    }
  }

  const recordResult = result as {
    record: JsonObject
    created?: boolean
  }
  const identifier = String(recordResult.record[descriptor.core.resultIdField] ?? "")

  return {
    vault,
    [descriptor.core.resultIdField]: identifier,
    lookupId: identifier,
    path: recordPath(recordResult.record),
    created: Boolean(recordResult.created),
  }
}

function buildHealthServiceListOptions(
  descriptor: HealthQueryDescriptorEntry,
  input: HealthListInput,
) {
  if (descriptor.query.genericListMode === 'history-kind-date-range-limit') {
    return {
      kind: input.kind,
      from: input.from,
      to: input.to,
      limit: input.limit,
      status: input.status,
    }
  }

  if (descriptor.query.genericListMode === 'date-range-limit') {
    return {
      from: input.from,
      to: input.to,
      limit: input.limit,
      status: input.status,
    }
  }

  if (descriptor.query.serviceListMode === "status-limit") {
    return {
      status: input.status,
      limit: input.limit,
    }
  }

  return {
    limit: input.limit,
  }
}

function getCoreRuntimeMethod(
  core: CoreRuntimeModule,
  descriptor: HealthCoreDescriptorEntry,
) {
  return core[descriptor.core.runtimeMethod] as (
    input: HealthCoreRuntimeInput,
  ) => Promise<HealthCoreRuntimeResult>
}

function getQueryShowMethod<TMethodName extends HealthQueryRuntimeShowMethodName>(
  query: QueryRuntimeModule,
  descriptor: HealthQueryDescriptorEntry & {
    query: HealthQueryDescriptorEntry["query"] & { runtimeShowMethod: TMethodName }
  },
): QueryRuntimeModule[TMethodName] {
  return query[descriptor.query.runtimeShowMethod]
}

function getQueryListMethod<TMethodName extends HealthQueryRuntimeListMethodName>(
  query: QueryRuntimeModule,
  descriptor: HealthQueryDescriptorEntry & {
    query: HealthQueryDescriptorEntry["query"] & { runtimeListMethod: TMethodName }
  },
): QueryRuntimeModule[TMethodName] {
  return query[descriptor.query.runtimeListMethod]
}

export function createHealthCoreServices(
  loadRuntime: () => Promise<{ core: CoreRuntimeModule }>,
): HealthCoreServiceMethods {
  const services: Record<string, unknown> = {}

  for (const descriptor of healthEntityDescriptors.filter(hasHealthCoreDescriptor)) {
    services[descriptor.core.scaffoldServiceMethod] = async (input: CommandContext) => ({
      vault: input.vault,
      noun: descriptor.core.scaffoldNoun,
      payload: buildScaffoldPayload(descriptor.noun),
    })

    services[descriptor.core.upsertServiceMethod] = async (args: JsonFileInput) => {
      const payload = await readJsonPayload(args.input)
      const runtimeInput = buildHealthCoreRuntimeInput(descriptor, args.vault, payload)
      const { core } = await loadRuntime()
      const runtimeMethod = getCoreRuntimeMethod(core, descriptor)
      const result = await runtimeMethod(runtimeInput)

      return buildHealthCoreUpsertResult(descriptor, args.vault, result)
    }
  }

  return services as unknown as HealthCoreServiceMethods
}

export function createHealthQueryServices(
  loadRuntime: () => Promise<{ query: QueryRuntimeModule }>,
): HealthQueryServiceMethods {
  const services: Record<string, unknown> = {}

  for (const descriptor of healthEntityDescriptors.filter(hasHealthQueryDescriptor)) {
    services[descriptor.query.showServiceMethod] = async (input: EntityLookupInput) => {
      const { query } = await loadRuntime()
      return asEntityEnvelope(
        input.vault,
        await getQueryShowMethod(query, descriptor)(input.vault, input.id),
        `No ${descriptor.query.notFoundLabel} found for "${input.id}".`,
      )
    }

    services[descriptor.query.listServiceMethod] = async (input: HealthListInput) => {
      const { query } = await loadRuntime()
      return asListEnvelope(
        input.vault,
        await getQueryListMethod(query, descriptor)(
          input.vault,
          buildHealthServiceListOptions(descriptor, input),
        ),
      )
    }
  }

  return services as unknown as HealthQueryServiceMethods
}
