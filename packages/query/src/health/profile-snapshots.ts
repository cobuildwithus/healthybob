import {
  applyLimit,
  asObject,
  firstObject,
  firstString,
  firstStringArray,
  matchesDateRange,
  matchesLookup,
  matchesText,
  maybeString,
  type MarkdownDocumentRecord,
} from "./shared.js";
import {
  readJsonlRecords,
  readOptionalMarkdownDocument,
} from "./loaders.js";

export interface ProfileSnapshotQueryRecord {
  id: string;
  capturedAt: string | null;
  recordedAt: string | null;
  status: string;
  summary: string | null;
  source: string | null;
  sourceAssessmentIds: string[];
  sourceEventIds: string[];
  profile: Record<string, unknown>;
  relativePath: string;
}

export interface CurrentProfileQueryRecord {
  id: "current";
  snapshotId: string | null;
  updatedAt: string | null;
  sourceAssessmentIds: string[];
  sourceEventIds: string[];
  topGoalIds: string[];
  relativePath: string;
  markdown: string | null;
  body: string | null;
}

export interface ProfileSnapshotListOptions {
  from?: string;
  to?: string;
  text?: string;
  limit?: number;
}

export function buildCurrentProfileRecord(input: {
  snapshotId: string;
  updatedAt: string | null;
  sourceAssessmentIds: string[];
  sourceEventIds: string[];
  topGoalIds: string[];
  markdown: string | null;
  body: string | null;
}): CurrentProfileQueryRecord {
  return {
    id: "current",
    snapshotId: input.snapshotId,
    updatedAt: input.updatedAt,
    sourceAssessmentIds: input.sourceAssessmentIds,
    sourceEventIds: input.sourceEventIds,
    topGoalIds: input.topGoalIds,
    relativePath: "bank/profile/current.md",
    markdown: input.markdown,
    body: input.body,
  };
}

export function toProfileSnapshotRecord(
  value: unknown,
  relativePath: string,
): ProfileSnapshotQueryRecord | null {
  const source = asObject(value);
  if (!source) {
    return null;
  }

  const id = firstString(source, ["id"]);
  if (!id?.startsWith("psnap_")) {
    return null;
  }

  const sourceObject = firstObject(source, ["source"]);
  const sourceDetails = sourceObject ?? {};
  const sourceAssessmentIds = firstStringArray(source, ["sourceAssessmentIds"]);
  const sourceAssessmentId = firstString(sourceDetails, ["assessmentId"]);

  return {
    id,
    capturedAt: firstString(source, ["capturedAt", "recordedAt"]),
    recordedAt: firstString(source, ["recordedAt", "capturedAt"]),
    status: firstString(source, ["status"]) ?? "accepted",
    summary: firstString(source, ["summary"]),
    source:
      firstString(source, ["source"]) ??
      firstString(sourceDetails, ["kind", "source", "importedFrom"]),
    sourceAssessmentIds:
      sourceAssessmentIds.length > 0
        ? sourceAssessmentIds
        : sourceAssessmentId
          ? [sourceAssessmentId]
          : [],
    sourceEventIds: firstStringArray(source, ["sourceEventIds"]),
    profile: firstObject(source, ["profile"]) ?? {},
    relativePath,
  };
}

export function compareSnapshots(
  left: ProfileSnapshotQueryRecord,
  right: ProfileSnapshotQueryRecord,
): number {
  const leftTimestamp = left.recordedAt ?? left.capturedAt ?? "";
  const rightTimestamp = right.recordedAt ?? right.capturedAt ?? "";

  if (leftTimestamp !== rightTimestamp) {
    return rightTimestamp.localeCompare(leftTimestamp);
  }

  return left.id.localeCompare(right.id);
}

function isProfileSnapshotRecord(
  record: ProfileSnapshotQueryRecord | null,
): record is ProfileSnapshotQueryRecord {
  return record !== null;
}

function matchesProfileSnapshotOptions(
  record: ProfileSnapshotQueryRecord,
  options: ProfileSnapshotListOptions,
): boolean {
  return (
    matchesDateRange(record.recordedAt ?? record.capturedAt, options.from, options.to) &&
    matchesText(
      [
        record.id,
        record.summary,
        record.source,
        record.profile,
        record.sourceAssessmentIds,
        record.sourceEventIds,
      ],
      options.text,
    )
  );
}

function fallbackCurrentProfile(
  latestSnapshot: ProfileSnapshotQueryRecord,
): CurrentProfileQueryRecord {
  return buildCurrentProfileRecord({
    snapshotId: latestSnapshot.id,
    updatedAt: latestSnapshot.recordedAt ?? latestSnapshot.capturedAt,
    sourceAssessmentIds: latestSnapshot.sourceAssessmentIds,
    sourceEventIds: latestSnapshot.sourceEventIds,
    topGoalIds: firstStringArray(latestSnapshot.profile, ["topGoalIds"]),
    markdown: null,
    body: null,
  });
}

export function toCurrentProfileRecord(
  document: MarkdownDocumentRecord,
): CurrentProfileQueryRecord {
  const attributes = document.attributes;
  const body = document.body || document.markdown.trim();
  const snapshotId =
    maybeString(attributes.snapshotId) ??
    body.match(/Snapshot ID:\s+`([^`]+)`/u)?.[1] ??
    null;
  const updatedAt =
    maybeString(attributes.updatedAt) ??
    body.match(/Recorded At:\s+([^\n]+)/u)?.[1]?.trim() ??
    null;

  return {
    id: "current",
    snapshotId,
    updatedAt,
    sourceAssessmentIds: firstStringArray(attributes, ["sourceAssessmentIds"]),
    sourceEventIds: firstStringArray(attributes, ["sourceEventIds"]),
    topGoalIds: firstStringArray(attributes, ["topGoalIds"]),
    relativePath: document.relativePath,
    markdown: document.markdown,
    body,
  };
}

export async function listProfileSnapshots(
  vaultRoot: string,
  options: ProfileSnapshotListOptions = {},
): Promise<ProfileSnapshotQueryRecord[]> {
  const entries = await readJsonlRecords(vaultRoot, "ledger/profile-snapshots");
  const records = entries
    .map((entry) => toProfileSnapshotRecord(entry.value, entry.relativePath))
    .filter(isProfileSnapshotRecord)
    .filter((entry) => matchesProfileSnapshotOptions(entry, options))
    .sort(compareSnapshots);

  return applyLimit(records, options.limit);
}

export async function readProfileSnapshot(
  vaultRoot: string,
  snapshotId: string,
): Promise<ProfileSnapshotQueryRecord | null> {
  const snapshots = await listProfileSnapshots(vaultRoot);
  return snapshots.find((snapshot) => snapshot.id === snapshotId) ?? null;
}

export async function readCurrentProfile(
  vaultRoot: string,
): Promise<CurrentProfileQueryRecord | null> {
  const snapshots = await listProfileSnapshots(vaultRoot);
  const latestSnapshot = snapshots[0] ?? null;

  if (!latestSnapshot) {
    return null;
  }

  const document = await readOptionalMarkdownDocument(vaultRoot, "bank/profile/current.md");

  if (!document) {
    return fallbackCurrentProfile(latestSnapshot);
  }

  const parsed = toCurrentProfileRecord(document);
  if (parsed.snapshotId === latestSnapshot.id) {
    return parsed;
  }

  return fallbackCurrentProfile(latestSnapshot);
}

export async function showProfile(
  vaultRoot: string,
  lookup: string,
): Promise<ProfileSnapshotQueryRecord | CurrentProfileQueryRecord | null> {
  if (matchesLookup(lookup, "current")) {
    return readCurrentProfile(vaultRoot);
  }

  const snapshots = await listProfileSnapshots(vaultRoot);
  return snapshots.find((snapshot) => matchesLookup(lookup, snapshot.id, snapshot.summary)) ?? null;
}
