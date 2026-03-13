import { basename } from "node:path";
import { readFile } from "node:fs/promises";

import { emitAuditRecord } from "../audit.js";
import { copyRawArtifact } from "../raw.js";
import { generateRecordId } from "../ids.js";
import { appendJsonlRecord, readJsonlRecords, toMonthlyShardRelativePath } from "../jsonl.js";
import { walkVaultFiles } from "../fs.js";
import { toIsoTimestamp } from "../time.js";
import { VaultError } from "../errors.js";
import { isPlainRecord } from "../types.js";

import type { UnknownRecord } from "../types.js";
import type {
  AssessmentResponseRecord,
  ImportAssessmentResponseInput,
  ImportAssessmentResponseResult,
} from "./types.js";
import {
  ASSESSMENT_LEDGER_DIRECTORY,
  ASSESSMENT_RESPONSE_SCHEMA_VERSION,
  ASSESSMENT_SOURCES,
} from "./types.js";

interface ReadAssessmentResponseInput {
  vaultRoot: string;
  assessmentId: string;
}

interface ListAssessmentResponsesInput {
  vaultRoot: string;
}

function parseAssessmentResponse(content: string): UnknownRecord {
  let parsed: unknown;

  try {
    parsed = JSON.parse(content) as unknown;
  } catch (error) {
    throw new VaultError("ASSESSMENT_INVALID_JSON", "Assessment response must be valid JSON.", {
      cause: error instanceof Error ? error.message : String(error),
    });
  }

  if (!isPlainRecord(parsed)) {
    throw new VaultError("ASSESSMENT_INVALID_JSON", "Assessment response root must be a plain object.");
  }

  return parsed;
}

function toAssessmentResponseRecord(value: unknown): AssessmentResponseRecord {
  if (!isPlainRecord(value)) {
    throw new VaultError("ASSESSMENT_RESPONSE_INVALID", "Assessment response record must be an object.");
  }

  const {
    schemaVersion,
    id,
    assessmentType,
    recordedAt,
    source,
    rawPath,
    title,
    questionnaireSlug,
    responses,
    relatedIds,
  } = value;

  if (schemaVersion !== ASSESSMENT_RESPONSE_SCHEMA_VERSION) {
    throw new VaultError("ASSESSMENT_RESPONSE_INVALID", "Assessment response schemaVersion is invalid.", {
      schemaVersion,
    });
  }

  if (typeof id !== "string" || !id.startsWith("asmt_")) {
    throw new VaultError("ASSESSMENT_RESPONSE_INVALID", "Assessment response id is invalid.", { id });
  }

  if (
    typeof assessmentType !== "string" ||
    typeof recordedAt !== "string" ||
    typeof rawPath !== "string" ||
    !isPlainRecord(responses)
  ) {
    throw new VaultError("ASSESSMENT_RESPONSE_INVALID", "Assessment response record fields are invalid.", {
      id,
    });
  }

  if (title !== undefined && typeof title !== "string") {
    throw new VaultError("ASSESSMENT_RESPONSE_INVALID", "Assessment response title must be a string when provided.", {
      id,
      title,
    });
  }

  if (!ASSESSMENT_SOURCES.includes(source as (typeof ASSESSMENT_SOURCES)[number])) {
    throw new VaultError("ASSESSMENT_RESPONSE_INVALID", "Assessment response source must be a string when provided.", {
      id,
      source,
    });
  }

  if (questionnaireSlug !== undefined && typeof questionnaireSlug !== "string") {
    throw new VaultError(
      "ASSESSMENT_RESPONSE_INVALID",
      "Assessment response questionnaireSlug must be a string when provided.",
      {
        id,
        questionnaireSlug,
      },
    );
  }

  if (
    relatedIds !== undefined &&
    (!Array.isArray(relatedIds) || relatedIds.some((entry) => typeof entry !== "string"))
  ) {
    throw new VaultError("ASSESSMENT_RESPONSE_INVALID", "Assessment response relatedIds must be a string array.", {
      id,
      relatedIds,
    });
  }

  return {
    schemaVersion: ASSESSMENT_RESPONSE_SCHEMA_VERSION,
    id,
    assessmentType,
    recordedAt,
    source: source as AssessmentResponseRecord["source"],
    rawPath,
    title: title as string | undefined,
    questionnaireSlug: questionnaireSlug as string | undefined,
    responses,
    relatedIds: relatedIds as string[] | undefined,
  };
}

function sortAssessmentResponses(records: readonly AssessmentResponseRecord[]): AssessmentResponseRecord[] {
  return [...records].sort((left, right) => {
    if (left.recordedAt !== right.recordedAt) {
      return left.recordedAt.localeCompare(right.recordedAt);
    }
    return left.id.localeCompare(right.id);
  });
}

export async function importAssessmentResponse({
  vaultRoot,
  sourcePath,
  assessmentType,
  title,
  recordedAt,
  importedAt,
  source,
  questionnaireSlug,
  relatedIds,
}: ImportAssessmentResponseInput): Promise<ImportAssessmentResponseResult> {
  const recordedTimestamp = toIsoTimestamp(recordedAt ?? importedAt ?? new Date(), "recordedAt");
  const id = generateRecordId("asmt");
  const content = await readFile(sourcePath, "utf8");
  const responses = parseAssessmentResponse(content);
  const raw = await copyRawArtifact({
    vaultRoot,
    sourcePath,
    category: "assessments",
    occurredAt: recordedTimestamp,
    recordId: id,
  });

  const assessment: AssessmentResponseRecord = {
    schemaVersion: ASSESSMENT_RESPONSE_SCHEMA_VERSION,
    id,
    assessmentType:
      typeof assessmentType === "string" && assessmentType.trim() ? assessmentType.trim() : "intake",
    recordedAt: recordedTimestamp,
    source: source ?? "import",
    rawPath: raw.relativePath,
    title: typeof title === "string" && title.trim() ? title.trim() : basename(sourcePath),
    questionnaireSlug:
      typeof questionnaireSlug === "string" && questionnaireSlug.trim()
        ? questionnaireSlug.trim()
        : undefined,
    responses,
    relatedIds:
      relatedIds && relatedIds.length > 0
        ? [...new Set(relatedIds.map((entry) => entry.trim()).filter(Boolean))]
        : undefined,
  };

  const ledgerPath = toMonthlyShardRelativePath(
    ASSESSMENT_LEDGER_DIRECTORY,
    recordedTimestamp,
    "recordedAt",
  );

  await appendJsonlRecord({
    vaultRoot,
    relativePath: ledgerPath,
    record: assessment,
  });

  const audit = await emitAuditRecord({
    vaultRoot,
    action: "intake_import",
    commandName: "core.importAssessmentResponse",
    summary: `Imported assessment ${assessment.id}.`,
    occurredAt: recordedTimestamp,
    targetIds: [assessment.id],
    changes: [
      {
        path: raw.relativePath,
        op: "copy",
      },
      {
        path: ledgerPath,
        op: "append",
      },
    ],
  });

  return {
    assessment,
    raw,
    ledgerPath,
    auditPath: audit.relativePath,
  };
}

export async function listAssessmentResponses({
  vaultRoot,
}: ListAssessmentResponsesInput): Promise<AssessmentResponseRecord[]> {
  const shardPaths = await walkVaultFiles(vaultRoot, ASSESSMENT_LEDGER_DIRECTORY, {
    extension: ".jsonl",
  });
  const records: AssessmentResponseRecord[] = [];

  for (const shardPath of shardPaths) {
    const shardRecords = await readJsonlRecords({
      vaultRoot,
      relativePath: shardPath,
    });

    records.push(...shardRecords.map((record) => toAssessmentResponseRecord(record)));
  }

  return sortAssessmentResponses(records);
}

export async function readAssessmentResponse({
  vaultRoot,
  assessmentId,
}: ReadAssessmentResponseInput): Promise<AssessmentResponseRecord> {
  const records = await listAssessmentResponses({ vaultRoot });
  const match = records.find((record) => record.id === assessmentId);

  if (!match) {
    throw new VaultError("ASSESSMENT_RESPONSE_NOT_FOUND", `Assessment response "${assessmentId}" was not found.`, {
      assessmentId,
    });
  }

  return match;
}
