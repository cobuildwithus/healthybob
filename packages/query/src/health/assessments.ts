import {
  applyLimit,
  asObject,
  firstObject,
  firstString,
  firstStringArray,
  matchesDateRange,
  matchesLookup,
  matchesText,
} from "./shared.js";
import { readJsonlRecords } from "./loaders.js";

export interface AssessmentQueryRecord {
  id: string;
  title: string | null;
  assessmentType: string | null;
  recordedAt: string | null;
  importedAt: string | null;
  source: string | null;
  sourcePath: string | null;
  questionnaireSlug: string | null;
  relatedIds: string[];
  responses: Record<string, unknown>;
  relativePath: string;
}

export interface AssessmentListOptions {
  from?: string;
  to?: string;
  text?: string;
  limit?: number;
}

export function toAssessmentRecord(
  value: unknown,
  relativePath: string,
): AssessmentQueryRecord | null {
  const source = asObject(value);
  if (!source) {
    return null;
  }

  const id = firstString(source, ["id"]);
  if (!id?.startsWith("asmt_")) {
    return null;
  }

  return {
    id,
    title: firstString(source, ["title"]),
    assessmentType: firstString(source, ["assessmentType"]),
    recordedAt: firstString(source, ["recordedAt", "occurredAt", "importedAt"]),
    importedAt: firstString(source, ["importedAt"]),
    source: firstString(source, ["source"]),
    sourcePath: firstString(source, ["rawPath", "sourcePath"]),
    questionnaireSlug: firstString(source, ["questionnaireSlug"]),
    relatedIds: firstStringArray(source, ["relatedIds"]),
    responses: firstObject(source, ["responses", "response"]) ?? {},
    relativePath,
  };
}

export function compareAssessments(
  left: AssessmentQueryRecord,
  right: AssessmentQueryRecord,
): number {
  const leftTimestamp = left.recordedAt ?? left.importedAt ?? "";
  const rightTimestamp = right.recordedAt ?? right.importedAt ?? "";

  if (leftTimestamp !== rightTimestamp) {
    return rightTimestamp.localeCompare(leftTimestamp);
  }

  return left.id.localeCompare(right.id);
}

function isAssessmentRecord(
  record: AssessmentQueryRecord | null,
): record is AssessmentQueryRecord {
  return record !== null;
}

function matchesAssessmentOptions(
  record: AssessmentQueryRecord,
  options: AssessmentListOptions,
): boolean {
  return (
    matchesDateRange(record.recordedAt ?? record.importedAt, options.from, options.to) &&
    matchesText(
      [
        record.id,
        record.title,
        record.assessmentType,
        record.source,
        record.responses,
        record.relatedIds,
      ],
      options.text,
    )
  );
}

export async function listAssessments(
  vaultRoot: string,
  options: AssessmentListOptions = {},
): Promise<AssessmentQueryRecord[]> {
  const entries = await readJsonlRecords(vaultRoot, "ledger/assessments");
  const records = entries
    .map((entry) => toAssessmentRecord(entry.value, entry.relativePath))
    .filter(isAssessmentRecord)
    .filter((entry) => matchesAssessmentOptions(entry, options))
    .sort(compareAssessments);

  return applyLimit(records, options.limit);
}

export async function readAssessment(
  vaultRoot: string,
  assessmentId: string,
): Promise<AssessmentQueryRecord | null> {
  const records = await listAssessments(vaultRoot);
  return records.find((record) => record.id === assessmentId) ?? null;
}

export async function showAssessment(
  vaultRoot: string,
  lookup: string,
): Promise<AssessmentQueryRecord | null> {
  const records = await listAssessments(vaultRoot);
  return records.find((record) => matchesLookup(lookup, record.id, record.title)) ?? null;
}
