import { ID_PREFIXES, VAULT_LAYOUT } from "../constants.js";
import { emitAuditRecord } from "../audit.js";
import { VaultError } from "../errors.js";
import { appendJsonlRecord, readJsonlRecords, toMonthlyShardRelativePath } from "../jsonl.js";
import { generateRecordId } from "../ids.js";
import { toDateOnly } from "../time.js";
import { walkVaultFiles } from "../fs.js";

import {
  compareIsoTimestamps,
  normalizeId,
  normalizeRelativePathList,
  normalizeStringList,
  normalizeTagList,
  normalizeTimestamp,
  optionalEnum,
  optionalString,
  requireString,
} from "./shared.js";
import {
  ADVERSE_EFFECT_SEVERITIES,
  HEALTH_HISTORY_KINDS,
  HEALTH_HISTORY_SOURCES,
  HISTORY_EVENT_ORDER,
  PROCEDURE_STATUSES,
  TEST_STATUSES,
} from "./types.js";

import type {
  AppendHistoryEventInput,
  AppendHistoryEventResult,
  HistoryEventKind,
  HistoryEventOrder,
  HistoryEventRecord,
  HistoryEventSource,
  ListHistoryEventsInput,
  ReadHistoryEventInput,
  ReadHistoryEventResult,
} from "./types.js";

const HISTORY_KIND_SET = new Set<HistoryEventKind>(HEALTH_HISTORY_KINDS);

function normalizeBaseEvent(input: AppendHistoryEventInput) {
  const occurredAt = normalizeTimestamp(input.occurredAt, "occurredAt");
  const recordedAt = normalizeTimestamp(input.recordedAt ?? occurredAt, "recordedAt");
  const eventId = normalizeId(input.eventId, "eventId", ID_PREFIXES.event) ?? generateRecordId("event");

  return {
    schemaVersion: "hb.event.v1" as const,
    id: eventId,
    kind: input.kind,
    occurredAt,
    recordedAt,
    dayKey: toDateOnly(occurredAt, "occurredAt"),
    source: optionalEnum(input.source ?? "manual", HEALTH_HISTORY_SOURCES, "source") ?? "manual",
    title: requireString(input.title, "title", 160),
    note: optionalString(input.note, "note", 4000),
    tags: normalizeTagList(input.tags, "tags"),
    relatedIds: normalizeStringList(input.relatedIds, "relatedIds", "id", 32, 80),
    rawRefs: normalizeRelativePathList(input.rawRefs, "rawRefs"),
  };
}

function stripUndefined<TRecord>(record: TRecord): TRecord {
  return Object.fromEntries(
    Object.entries(record as Record<string, unknown>).filter(([, value]) => value !== undefined),
  ) as TRecord;
}

function buildHistoryEventRecord(input: AppendHistoryEventInput): HistoryEventRecord {
  const baseRecord = normalizeBaseEvent(input);

  switch (input.kind) {
    case "encounter":
      return stripUndefined({
        ...baseRecord,
        kind: "encounter",
        encounterType: requireString(input.encounterType, "encounterType", 120),
        location:
          optionalString(input.location, "location", 160) ??
          optionalString(input.facility, "facility", 160),
        providerId: optionalString(input.providerId, "providerId", 80),
      });
    case "procedure":
      return stripUndefined({
        ...baseRecord,
        kind: "procedure",
        procedure: requireString(input.procedure ?? input.procedureName, "procedure", 160),
        status: optionalEnum(input.status ?? "completed", PROCEDURE_STATUSES, "status") ?? "completed",
      });
    case "test":
      return stripUndefined({
        ...baseRecord,
        kind: "test",
        testName: requireString(input.testName, "testName", 160),
        resultStatus:
          optionalEnum(input.resultStatus ?? "unknown", TEST_STATUSES, "resultStatus") ?? "unknown",
        summary:
          optionalString(input.summary, "summary", 1000) ??
          optionalString(input.resultSummary, "resultSummary", 1000),
      });
    case "adverse_effect":
      return stripUndefined({
        ...baseRecord,
        kind: "adverse_effect",
        substance: requireString(input.substance, "substance", 160),
        effect: requireString(input.effect, "effect", 240),
        severity: optionalEnum(input.severity ?? "moderate", ADVERSE_EFFECT_SEVERITIES, "severity") ?? "moderate",
      });
    case "exposure":
      return stripUndefined({
        ...baseRecord,
        kind: "exposure",
        exposureType:
          requireString(input.exposureType ?? input.route ?? "unspecified", "exposureType", 120),
        substance: requireString(input.substance ?? input.agent, "substance", 160),
        duration:
          optionalString(input.duration, "duration", 120) ??
          optionalString(input.durationText, "durationText", 120),
      });
    default:
      throw new VaultError("VAULT_INVALID_INPUT", "Unsupported health history kind.");
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseStoredHistoryEvent(value: unknown): HistoryEventRecord | null {
  if (!isPlainRecord(value) || typeof value.kind !== "string") {
    return null;
  }

  if (!HISTORY_KIND_SET.has(value.kind as HistoryEventKind)) {
    return null;
  }

  const baseRecord = {
    schemaVersion: requireString(value.schemaVersion, "schemaVersion", 40) as "hb.event.v1",
    id: requireString(value.id, "id", 64),
    kind: value.kind as HistoryEventKind,
    occurredAt: normalizeTimestamp(value.occurredAt as string, "occurredAt"),
    recordedAt: normalizeTimestamp(value.recordedAt as string, "recordedAt"),
    dayKey: requireString(value.dayKey, "dayKey", 10),
    source: optionalEnum(value.source, HEALTH_HISTORY_SOURCES, "source") ?? "manual",
    title: requireString(value.title, "title", 160),
    note: optionalString(value.note, "note", 4000),
    tags: normalizeTagList(value.tags, "tags"),
    relatedIds: normalizeStringList(value.relatedIds, "relatedIds", "id", 32, 80),
    rawRefs: normalizeRelativePathList(value.rawRefs, "rawRefs"),
  };

  switch (value.kind) {
    case "encounter":
      return stripUndefined({
        ...baseRecord,
        kind: "encounter",
        encounterType: requireString(value.encounterType, "encounterType", 120),
        location:
          optionalString(value.location, "location", 160) ??
          optionalString(value.facility, "facility", 160),
        providerId: optionalString(value.providerId, "providerId", 80),
      });
    case "procedure":
      return stripUndefined({
        ...baseRecord,
        kind: "procedure",
        procedure: requireString(value.procedure ?? value.procedureName, "procedure", 160),
        status: optionalEnum(value.status ?? "completed", PROCEDURE_STATUSES, "status") ?? "completed",
      });
    case "test":
      return stripUndefined({
        ...baseRecord,
        kind: "test",
        testName: requireString(value.testName, "testName", 160),
        resultStatus:
          optionalEnum(value.resultStatus ?? value.status ?? "unknown", TEST_STATUSES, "resultStatus") ?? "unknown",
        summary:
          optionalString(value.summary, "summary", 1000) ??
          optionalString(value.resultSummary, "resultSummary", 1000),
      });
    case "adverse_effect":
      return stripUndefined({
        ...baseRecord,
        kind: "adverse_effect",
        substance: requireString(value.substance, "substance", 160),
        effect: requireString(value.effect, "effect", 240),
        severity: optionalEnum(value.severity ?? "moderate", ADVERSE_EFFECT_SEVERITIES, "severity") ?? "moderate",
      });
    case "exposure":
      return stripUndefined({
        ...baseRecord,
        kind: "exposure",
        exposureType:
          requireString(value.exposureType ?? value.route ?? "unspecified", "exposureType", 120),
        substance: requireString(value.substance ?? value.agent, "substance", 160),
        duration:
          optionalString(value.duration, "duration", 120) ??
          optionalString(value.durationText, "durationText", 120),
      });
    default:
      return null;
  }
}

function normalizeOrder(order: HistoryEventOrder | undefined): HistoryEventOrder {
  return optionalEnum(order ?? "desc", HISTORY_EVENT_ORDER, "order") ?? "desc";
}

function normalizeSourceFilter(source: HistoryEventSource | undefined): HistoryEventSource | undefined {
  if (source === undefined) {
    return undefined;
  }

  return optionalEnum(source, HEALTH_HISTORY_SOURCES, "source");
}

function normalizeKindFilter(kinds: HistoryEventKind[] | undefined): Set<HistoryEventKind> | null {
  if (kinds === undefined) {
    return null;
  }

  if (!Array.isArray(kinds) || kinds.length === 0) {
    return null;
  }

  const normalized = kinds.map((kind, index) => {
    const candidate = String(kind ?? "").trim();

    if (!HISTORY_KIND_SET.has(candidate as HistoryEventKind)) {
      throw new VaultError("VAULT_INVALID_INPUT", `kinds[${index}] is unsupported.`);
    }

    return candidate as HistoryEventKind;
  });

  return new Set(normalized);
}

function normalizeLimit(limit: number | undefined): number | null {
  if (limit === undefined || limit === null) {
    return null;
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw new VaultError("VAULT_INVALID_INPUT", "limit must be an integer between 1 and 500.");
  }

  return limit;
}

export async function appendHistoryEvent(
  input: AppendHistoryEventInput,
): Promise<AppendHistoryEventResult> {
  const record = buildHistoryEventRecord(input);
  const relativePath = toMonthlyShardRelativePath(
    VAULT_LAYOUT.eventLedgerDirectory,
    record.occurredAt,
    "occurredAt",
  );

  await appendJsonlRecord({
    vaultRoot: input.vaultRoot,
    relativePath,
    record,
  });
  const audit = await emitAuditRecord({
    vaultRoot: input.vaultRoot,
    action: "history_add",
    commandName: "core.appendHistoryEvent",
    summary: `Appended ${record.kind} history event ${record.id}.`,
    occurredAt: record.recordedAt,
    targetIds: [record.id],
    changes: [
      {
        path: relativePath,
        op: "append",
      },
    ],
  });

  return {
    auditPath: audit.relativePath,
    relativePath,
    record,
  };
}

export async function listHistoryEvents({
  vaultRoot,
  kinds,
  source,
  from,
  to,
  order = "desc",
  limit,
}: ListHistoryEventsInput): Promise<HistoryEventRecord[]> {
  const kindFilter = normalizeKindFilter(kinds);
  const sourceFilter = normalizeSourceFilter(source);
  const normalizedOrder = normalizeOrder(order);
  const normalizedLimit = normalizeLimit(limit);
  const fromTimestamp = from ? normalizeTimestamp(from, "from") : null;
  const toTimestamp = to ? normalizeTimestamp(to, "to") : null;
  const shardPaths = await walkVaultFiles(vaultRoot, VAULT_LAYOUT.eventLedgerDirectory, {
    extension: ".jsonl",
  });

  const records: HistoryEventRecord[] = [];

  for (const relativePath of shardPaths) {
    const shardRecords = await readJsonlRecords({ vaultRoot, relativePath });

    for (const shardRecord of shardRecords) {
      const parsed = parseStoredHistoryEvent(shardRecord);

      if (!parsed) {
        continue;
      }

      if (kindFilter && !kindFilter.has(parsed.kind)) {
        continue;
      }

      if (sourceFilter && parsed.source !== sourceFilter) {
        continue;
      }

      if (fromTimestamp && parsed.occurredAt < fromTimestamp) {
        continue;
      }

      if (toTimestamp && parsed.occurredAt > toTimestamp) {
        continue;
      }

      records.push(parsed);
    }
  }

  records.sort((left, right) => compareIsoTimestamps(left, right, normalizedOrder));

  return normalizedLimit ? records.slice(0, normalizedLimit) : records;
}

export async function readHistoryEvent({
  vaultRoot,
  eventId,
}: ReadHistoryEventInput): Promise<ReadHistoryEventResult> {
  const normalizedEventId = normalizeId(eventId, "eventId", ID_PREFIXES.event);

  if (!normalizedEventId) {
    throw new VaultError("VAULT_INVALID_INPUT", "eventId is required.");
  }

  const shardPaths = await walkVaultFiles(vaultRoot, VAULT_LAYOUT.eventLedgerDirectory, {
    extension: ".jsonl",
  });

  for (const relativePath of shardPaths) {
    const shardRecords = await readJsonlRecords({ vaultRoot, relativePath });

    for (const shardRecord of shardRecords) {
      if (!isPlainRecord(shardRecord) || shardRecord.id !== normalizedEventId) {
        continue;
      }

      const parsed = parseStoredHistoryEvent(shardRecord);

      if (!parsed) {
        throw new VaultError("VAULT_INVALID_HISTORY_EVENT", "Stored health history event is malformed.");
      }

      return {
        relativePath,
        record: parsed,
      };
    }
  }

  throw new VaultError("VAULT_HISTORY_EVENT_MISSING", "Health history event was not found.");
}
