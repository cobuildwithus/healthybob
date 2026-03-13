import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import { healthEntityDefinitions } from "@healthybob/contracts"

import { VaultCliError } from "../vault-cli-errors.js"
import {
  inferHealthEntityKind,
  isHealthQueryableRecordId,
} from "../health-cli-descriptors.js"

import type {
  HealthEntityEnvelope,
  HealthListEnvelope,
  JsonObject,
} from "../health-cli-method-types.js"
import type { VaultValidateResult } from "../vault-cli-contracts.js"
import type {
  QueryEntity,
} from "./types.js"

const DEFAULT_GENERIC_LIST_EXCLUDED_FAMILIES = new Set([
  "audit",
  "core",
])

export function normalizeIssues(
  issues: Array<{
    code?: string
    path?: string
    message?: string
    severity?: string
  }> = [],
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

export function inferEntityKind(id: string) {
  const healthKind = inferHealthEntityKind(id)
  if (healthKind) {
    return healthKind
  }

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

export function isQueryableRecordId(id: string) {
  return (
    id === "core" ||
    id === "current" ||
    isHealthQueryableRecordId(id) ||
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

export function describeLookupConstraint(id: string) {
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

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

const RESERVED_PAYLOAD_KEYS = new Set([
  "vault",
  "vaultRoot",
  "absolutePath",
  "relativePath",
  "path",
  "auditPath",
  "manifestPath",
  "ledgerPath",
  "lookupId",
  "created",
  "currentProfilePath",
])

export async function readJsonPayload(filePath: string): Promise<JsonObject> {
  const raw = await readFile(filePath, "utf8")
  const parsed = JSON.parse(raw) as unknown

  if (!isPlainObject(parsed)) {
    throw new VaultCliError("invalid_payload", "Payload file must contain a JSON object.")
  }

  return parsed
}

export function assertNoReservedPayloadKeys(payload: JsonObject) {
  const reservedKeys = Object.keys(payload).filter((key) => RESERVED_PAYLOAD_KEYS.has(key))

  if (reservedKeys.length > 0) {
    throw new VaultCliError(
      "invalid_payload",
      `Payload file may not set reserved field${reservedKeys.length === 1 ? "" : "s"}: ${reservedKeys.join(", ")}.`,
      {
        reservedKeys,
      },
    )
  }
}

export function optionalStringArray(value: unknown, fieldName: string): string[] | undefined {
  if (value === undefined || value === null) {
    return undefined
  }

  if (!Array.isArray(value)) {
    throw new VaultCliError("invalid_payload", `${fieldName} must be an array of non-empty strings.`)
  }

  const items = value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))

  if (items.some((entry) => entry.length === 0)) {
    throw new VaultCliError("invalid_payload", `${fieldName} must be an array of non-empty strings.`)
  }

  return items.length > 0 ? items : undefined
}

export function requirePayloadObjectField(payload: JsonObject, fieldName: string): JsonObject {
  const value = payload[fieldName]

  if (!isPlainObject(value)) {
    throw new VaultCliError(
      "invalid_payload",
      `Payload file must include a plain-object "${fieldName}" field.`,
    )
  }

  return value
}

export function asEntityEnvelope<TEntity extends JsonObject>(
  vault: string,
  entity: TEntity | null,
  notFoundMessage: string,
): HealthEntityEnvelope {
  if (!entity) {
    throw new VaultCliError("not_found", notFoundMessage)
  }

  return {
    vault,
    entity,
  }
}

export function asListEnvelope<TEntity extends JsonObject>(
  vault: string,
  items: TEntity[],
): HealthListEnvelope {
  return {
    vault,
    items,
    count: items.length,
  }
}

export function recordPath(record: JsonObject) {
  const relativePath = record.relativePath
  return typeof relativePath === "string" ? relativePath : undefined
}

export function buildScaffoldPayload(noun: string) {
  const definition = healthEntityDefinitions.find((entry) => entry.noun === noun)
  if (!definition?.scaffoldTemplate) {
    throw new VaultCliError("invalid_payload", `No scaffold template is defined for ${noun}.`)
  }

  return definition.scaffoldTemplate
}

export function buildEntityLinks(record: {
  data: JsonObject
  relatedIds?: string[]
}) {
  const links: Array<{
    id: string
    kind: string
    queryable: boolean
  }> = []

  const relatedIds = Array.isArray(record.relatedIds)
    ? record.relatedIds
    : Array.isArray(record.data.relatedIds)
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

function normalizeGenericEntityKind(entity: QueryEntity) {
  if (entity.family === "current_profile" || entity.family === "profile_snapshot") {
    return "profile"
  }

  const healthDefinition = healthEntityDefinitions.find(
    (definition) => definition.kind === entity.family,
  )
  const canonicalListKind =
    healthDefinition?.listKinds?.length === 1 ? healthDefinition.listKinds[0] : null

  if (canonicalListKind) {
    return canonicalListKind
  }

  return entity.kind || entity.family
}

export function toGenericShowEntity(entity: QueryEntity) {
  return {
    id: entity.entityId,
    kind: normalizeGenericEntityKind(entity),
    title: entity.title ?? null,
    occurredAt: entity.occurredAt ?? null,
    path: entity.path ?? null,
    markdown: entity.body ?? null,
    data: entity.attributes,
    links: buildEntityLinks({
      data: entity.attributes,
      relatedIds: entity.relatedIds,
    }),
  }
}

export function toGenericListItem(entity: QueryEntity) {
  return {
    id: entity.entityId,
    kind: normalizeGenericEntityKind(entity),
    title: entity.title ?? null,
    occurredAt: entity.occurredAt ?? null,
    path: entity.path ?? null,
  }
}

export function matchesGenericKindFilter(entity: QueryEntity, kind?: string) {
  if (!kind) {
    return !DEFAULT_GENERIC_LIST_EXCLUDED_FAMILIES.has(entity.family)
  }

  return entity.kind === kind || entity.family === kind
}

export async function materializeExportPack(
  outDir: string,
  files: Array<{ path: string; contents: string }>,
) {
  const absoluteOutDir = path.resolve(outDir)

  for (const file of files) {
    const relativePath = String(file.path ?? "").trim().replace(/\\/g, "/")

    if (
      relativePath.length === 0 ||
      path.posix.isAbsolute(relativePath) ||
      /^[A-Za-z]:/u.test(relativePath)
    ) {
      throw new VaultCliError("invalid_export_pack", `Export pack emitted an invalid file path "${file.path}".`)
    }

    const targetPath = path.resolve(absoluteOutDir, relativePath)
    const containment = path.relative(absoluteOutDir, targetPath)

    if (
      containment === ".." ||
      containment.startsWith(`..${path.sep}`) ||
      path.isAbsolute(containment)
    ) {
      throw new VaultCliError(
        "invalid_export_pack",
        `Export pack file path escaped the requested output directory: "${file.path}".`,
      )
    }

    await mkdir(path.dirname(targetPath), { recursive: true })
    await writeFile(targetPath, file.contents, "utf8")
  }
}

export function toJournalLookupId(date: string) {
  return `journal:${date}`
}
