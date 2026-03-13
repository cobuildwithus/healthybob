import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import {
  asObject,
  firstObject,
  firstString,
  firstStringArray,
  parseFrontmatterDocument,
} from "./health/shared.js";

import type {
  ExportPackAssessmentRecord,
  ExportPackBankPage,
  ExportPackCurrentProfile,
  ExportPackFilters,
  ExportPackHistoryRecord,
  ExportPackProfileSnapshotRecord,
} from "./export-pack.js";

export function readAssessmentRecords(
  vaultRoot: string,
  filters: ExportPackFilters,
): ExportPackAssessmentRecord[] {
  return readJsonlDirectory(vaultRoot, "ledger/assessments")
    .map(({ relativePath, value }) => {
      const source = asObject(value);
      const id = firstStringOrNull(source, ["id"]);
      if (!source || !id?.startsWith("asmt_")) {
        return null;
      }

      return {
        id,
        title: firstStringOrNull(source, ["title"]),
        assessmentType: firstStringOrNull(source, ["assessmentType"]),
        recordedAt: firstStringOrNull(source, ["recordedAt", "occurredAt", "importedAt"]),
        importedAt: firstStringOrNull(source, ["importedAt"]),
        source: firstStringOrNull(source, ["source"]),
        sourcePath: firstStringOrNull(source, ["rawPath", "sourcePath"]),
        questionnaireSlug: firstStringOrNull(source, ["questionnaireSlug"]),
        relatedIds: firstStringArrayOrEmpty(source, ["relatedIds"]),
        responses: firstObjectOrEmpty(source, ["responses", "response"]),
        relativePath,
      };
    })
    .filter((entry): entry is ExportPackAssessmentRecord => entry !== null)
    .filter((entry) => matchesDateWindow(entry.recordedAt ?? entry.importedAt, filters))
    .sort((left, right) =>
      (right.recordedAt ?? right.importedAt ?? "").localeCompare(left.recordedAt ?? left.importedAt ?? "") ||
      left.id.localeCompare(right.id),
    );
}

export function readProfileSnapshotRecords(
  vaultRoot: string,
  filters: ExportPackFilters,
): ExportPackProfileSnapshotRecord[] {
  return readJsonlDirectory(vaultRoot, "ledger/profile-snapshots")
    .map(({ relativePath, value }) => {
      const source = asObject(value);
      const id = firstStringOrNull(source, ["id"]);
      if (!source || !id?.startsWith("psnap_")) {
        return null;
      }

      const sourceObject = firstObjectOrEmpty(source, ["source"]);
      const fallbackAssessmentId = firstString(sourceObject, ["assessmentId"]);
      const sourceAssessmentIds = firstStringArrayOrEmpty(source, ["sourceAssessmentIds"]);

      return {
        id,
        recordedAt: firstStringOrNull(source, ["recordedAt", "capturedAt"]),
        source:
          firstStringOrNull(source, ["source"]) ??
          firstString(sourceObject, ["kind", "source", "importedFrom"]),
        sourceAssessmentIds:
          sourceAssessmentIds.length > 0
            ? sourceAssessmentIds
            : fallbackAssessmentId
              ? [fallbackAssessmentId]
              : [],
        sourceEventIds: firstStringArrayOrEmpty(source, ["sourceEventIds"]),
        profile: firstObjectOrEmpty(source, ["profile"]),
        relativePath,
      };
    })
    .filter((entry): entry is ExportPackProfileSnapshotRecord => entry !== null)
    .filter((entry) => matchesDateWindow(entry.recordedAt, filters))
    .sort((left, right) =>
      (right.recordedAt ?? "").localeCompare(left.recordedAt ?? "") || left.id.localeCompare(right.id),
    );
}

export function readHistoryRecords(
  vaultRoot: string,
  filters: ExportPackFilters,
): ExportPackHistoryRecord[] {
  const healthKinds = new Set(["encounter", "procedure", "test", "adverse_effect", "exposure"]);

  return readJsonlDirectory(vaultRoot, "ledger/events")
    .map(({ relativePath, value }) => {
      const source = asObject(value);
      const id = firstStringOrNull(source, ["id"]);
      const kind = firstStringOrNull(source, ["kind"]);
      const occurredAt = firstStringOrNull(source, ["occurredAt"]);
      const title = firstStringOrNull(source, ["title"]);

      if (!source || !id?.startsWith("evt_") || !kind || !healthKinds.has(kind) || !occurredAt || !title) {
        return null;
      }

      return {
        id,
        kind,
        occurredAt,
        recordedAt: firstStringOrNull(source, ["recordedAt"]),
        source: firstStringOrNull(source, ["source"]),
        title,
        status: firstStringOrNull(source, ["status"]),
        tags: firstStringArrayOrEmpty(source, ["tags"]),
        relatedIds: firstStringArrayOrEmpty(source, ["relatedIds"]),
        relativePath,
        data: source,
      };
    })
    .filter((entry): entry is ExportPackHistoryRecord => entry !== null)
    .filter((entry) => matchesDateWindow(entry.occurredAt, filters))
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt) || left.id.localeCompare(right.id));
}

export function readCurrentProfileRecord(
  vaultRoot: string,
  profileSnapshots: ExportPackProfileSnapshotRecord[],
): ExportPackCurrentProfile | null {
  const latestSnapshot = profileSnapshots[0] ?? null;
  if (!latestSnapshot) {
    return null;
  }

  const relativePath = "bank/profile/current.md";
  const absolutePath = path.join(vaultRoot, relativePath);
  const markdown = existsSync(absolutePath) ? readFileSync(absolutePath, "utf8") : null;

  if (markdown) {
    const parsed = tryParseFrontmatterDocument(markdown);
    if (parsed) {
      const snapshotId =
        firstString(parsed.attributes, ["snapshotId"]) ??
        markdown.match(/Snapshot ID:\s+`([^`]+)`/u)?.[1] ??
        null;

      if (snapshotId === latestSnapshot.id) {
        return {
          snapshotId,
          updatedAt:
            firstString(parsed.attributes, ["updatedAt"]) ??
            markdown.match(/Recorded At:\s+([^\n]+)/u)?.[1]?.trim() ??
            latestSnapshot.recordedAt,
          sourceAssessmentIds: firstStringArray(parsed.attributes, ["sourceAssessmentIds"]),
          sourceEventIds: firstStringArray(parsed.attributes, ["sourceEventIds"]),
          topGoalIds: firstStringArray(parsed.attributes, ["topGoalIds"]),
          relativePath,
          markdown,
          body: parsed.body,
        };
      }
    }
  }

  return {
    snapshotId: latestSnapshot.id,
    updatedAt: latestSnapshot.recordedAt,
    sourceAssessmentIds: latestSnapshot.sourceAssessmentIds,
    sourceEventIds: latestSnapshot.sourceEventIds,
    topGoalIds: firstStringArray(latestSnapshot.profile, ["topGoalIds"]),
    relativePath,
    markdown: null,
    body: null,
  };
}

export function readBankPages(
  vaultRoot: string,
  relativeRoot: string,
  idKeys: readonly string[],
): ExportPackBankPage[] {
  return walkRelativeMarkdownFiles(vaultRoot, relativeRoot)
    .map((relativePath) => {
      const markdown = readFileSync(path.join(vaultRoot, relativePath), "utf8");
      const parsed = tryParseFrontmatterDocument(markdown);
      if (!parsed) {
        return null;
      }

      const id = firstString(parsed.attributes, idKeys);
      if (!id) {
        return null;
      }

      return {
        id,
        slug: firstString(parsed.attributes, ["slug"]) ?? path.basename(relativePath, ".md"),
        title: firstString(parsed.attributes, ["title", "name", "label"]),
        status: firstString(parsed.attributes, ["status", "clinicalStatus", "significance"]),
        relativePath,
        markdown,
        body: parsed.body,
        attributes: parsed.attributes,
      };
    })
    .filter((entry): entry is ExportPackBankPage => entry !== null)
    .sort((left, right) => (left.title ?? left.slug).localeCompare(right.title ?? right.slug));
}

function walkRelativeMarkdownFiles(vaultRoot: string, relativeRoot: string): string[] {
  const absoluteRoot = path.join(vaultRoot, relativeRoot);
  if (!existsSync(absoluteRoot)) {
    return [];
  }

  return walkRelativeFilesByExtension(vaultRoot, relativeRoot, ".md");
}

function readJsonlDirectory(
  vaultRoot: string,
  relativeRoot: string,
): Array<{ relativePath: string; value: unknown }> {
  const absoluteRoot = path.join(vaultRoot, relativeRoot);
  if (!existsSync(absoluteRoot)) {
    return [];
  }

  const files = walkRelativeFilesByExtension(vaultRoot, relativeRoot, ".jsonl");
  const results: Array<{ relativePath: string; value: unknown }> = [];

  for (const relativePath of files) {
    const contents = readFileSync(path.join(vaultRoot, relativePath), "utf8");
    for (const line of contents.split(/\r?\n/u)) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      const value = tryParseJson(trimmed);
      if (value === undefined) {
        continue;
      }

      results.push({ relativePath, value });
    }
  }

  return results;
}

function walkRelativeFilesByExtension(
  vaultRoot: string,
  relativeRoot: string,
  extension: string,
): string[] {
  const results: string[] = [];
  const stack = [relativeRoot];

  while (stack.length > 0) {
    const currentRelative = stack.pop() as string;
    const absoluteCurrent = path.join(vaultRoot, currentRelative);
    const entries = readdirSync(absoluteCurrent, { withFileTypes: true });

    for (const entry of entries) {
      const childRelative = path.join(currentRelative, entry.name);
      if (entry.isDirectory()) {
        stack.push(childRelative);
        continue;
      }

      if (entry.isFile() && childRelative.endsWith(extension)) {
        results.push(childRelative);
      }
    }
  }

  return results.sort();
}

function matchesDateWindow(
  value: string | null,
  filters: ExportPackFilters,
): boolean {
  if (!value) {
    return false;
  }

  const comparable = value.slice(0, 10);
  if (filters.from && comparable < filters.from) {
    return false;
  }

  if (filters.to && comparable > filters.to) {
    return false;
  }

  return true;
}

function firstObjectOrEmpty(
  value: Record<string, unknown> | null,
  keys: readonly string[],
): Record<string, unknown> {
  if (!value) {
    return {};
  }

  return firstObject(value, keys) ?? {};
}

function firstStringOrNull(
  value: Record<string, unknown> | null,
  keys: readonly string[],
): string | null {
  if (!value) {
    return null;
  }

  return firstString(value, keys);
}

function firstStringArrayOrEmpty(
  value: Record<string, unknown> | null,
  keys: readonly string[],
): string[] {
  if (!value) {
    return [];
  }

  return firstStringArray(value, keys);
}

function tryParseFrontmatterDocument(markdown: string) {
  try {
    return parseFrontmatterDocument(markdown);
  } catch {
    return null;
  }
}

function tryParseJson(value: string): unknown | undefined {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}
