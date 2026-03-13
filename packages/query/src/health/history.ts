import {
  applyLimit,
  asObject,
  firstString,
  firstStringArray,
  matchesDateRange,
  matchesLookup,
  matchesStatus,
  matchesText,
} from "./shared.js";
import { readJsonlRecords } from "./loaders.js";

export type HealthHistoryKind =
  | "encounter"
  | "procedure"
  | "test"
  | "adverse_effect"
  | "exposure";

export interface HistoryQueryRecord {
  id: string;
  kind: HealthHistoryKind;
  occurredAt: string;
  recordedAt: string | null;
  source: string | null;
  title: string;
  status: string | null;
  tags: string[];
  relatedIds: string[];
  relativePath: string;
  data: Record<string, unknown>;
}

export interface HistoryListOptions {
  kind?: HealthHistoryKind | HealthHistoryKind[];
  status?: string | string[];
  from?: string;
  to?: string;
  text?: string;
  limit?: number;
}

const HEALTH_HISTORY_KINDS = new Set<HealthHistoryKind>([
  "encounter",
  "procedure",
  "test",
  "adverse_effect",
  "exposure",
]);

export function toHistoryRecord(
  value: unknown,
  relativePath: string,
): HistoryQueryRecord | null {
  const source = asObject(value);
  if (!source) {
    return null;
  }

  const id = firstString(source, ["id"]);
  const kind = firstString(source, ["kind"]);
  const occurredAt = firstString(source, ["occurredAt"]);
  const title = firstString(source, ["title"]);

  if (!id?.startsWith("evt_") || !kind || !HEALTH_HISTORY_KINDS.has(kind as HealthHistoryKind) || !occurredAt || !title) {
    return null;
  }

  return {
    id,
    kind: kind as HealthHistoryKind,
    occurredAt,
    recordedAt: firstString(source, ["recordedAt"]),
    source: firstString(source, ["source"]),
    title,
    status: firstString(source, ["status"]),
    tags: firstStringArray(source, ["tags"]),
    relatedIds: firstStringArray(source, ["relatedIds"]),
    relativePath,
    data: source,
  };
}

export function compareHistory(left: HistoryQueryRecord, right: HistoryQueryRecord): number {
  if (left.occurredAt !== right.occurredAt) {
    return right.occurredAt.localeCompare(left.occurredAt);
  }

  return left.id.localeCompare(right.id);
}

function isHistoryRecord(record: HistoryQueryRecord | null): record is HistoryQueryRecord {
  return record !== null;
}

function matchesKindFilter(
  record: HistoryQueryRecord,
  kindFilters: ReadonlySet<HealthHistoryKind> | null,
): boolean {
  return !kindFilters || kindFilters.has(record.kind);
}

function matchesHistoryOptions(
  record: HistoryQueryRecord,
  options: HistoryListOptions,
  kindFilters: ReadonlySet<HealthHistoryKind> | null,
): boolean {
  return (
    matchesKindFilter(record, kindFilters) &&
    matchesDateRange(record.occurredAt, options.from, options.to) &&
    matchesStatus(record.status, options.status) &&
    matchesText(
      [
        record.id,
        record.title,
        record.kind,
        record.source,
        record.tags,
        record.relatedIds,
        record.data,
      ],
      options.text,
    )
  );
}

export async function listHistoryEvents(
  vaultRoot: string,
  options: HistoryListOptions = {},
): Promise<HistoryQueryRecord[]> {
  const kindFilters = Array.isArray(options.kind)
    ? new Set(options.kind)
    : options.kind
      ? new Set([options.kind])
      : null;
  const entries = await readJsonlRecords(vaultRoot, "ledger/events");
  const records = entries
    .map((entry) => toHistoryRecord(entry.value, entry.relativePath))
    .filter(isHistoryRecord)
    .filter((entry) => matchesHistoryOptions(entry, options, kindFilters))
    .sort(compareHistory);

  return applyLimit(records, options.limit);
}

export async function readHistoryEvent(
  vaultRoot: string,
  eventId: string,
): Promise<HistoryQueryRecord | null> {
  const records = await listHistoryEvents(vaultRoot);
  return records.find((record) => record.id === eventId) ?? null;
}

export async function showHistoryEvent(
  vaultRoot: string,
  lookup: string,
): Promise<HistoryQueryRecord | null> {
  const records = await listHistoryEvents(vaultRoot);
  return records.find((record) => matchesLookup(lookup, record.id, record.title)) ?? null;
}
