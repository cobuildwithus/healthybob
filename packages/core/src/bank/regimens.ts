import { VaultError } from "../errors.js";
import { stringifyFrontmatterDocument } from "../frontmatter.js";
import { writeVaultTextFile } from "../fs.js";
import { generateRecordId } from "../ids.js";

import {
  REGIMEN_DOC_TYPE,
  REGIMEN_KINDS,
  REGIMENS_DIRECTORY,
  REGIMEN_SCHEMA_VERSION,
  REGIMEN_STATUSES,
} from "./types.js";
import {
  detailList,
  groupFromRegimenPath,
  loadMarkdownRegistry,
  normalizeGroupPath,
  normalizeRecordIdList,
  normalizeSelectorSlug,
  optionalDateOnly,
  optionalEnum,
  optionalFiniteNumber,
  optionalString,
  requireMatchingDocType,
  requireString,
  section,
  stripUndefined,
  normalizeId,
  normalizeSlug,
} from "./shared.js";

import type { FrontmatterObject } from "../types.js";
import type {
  ReadRegimenItemInput,
  RegimenItemRecord,
  StopRegimenItemInput,
  StopRegimenItemResult,
  UpsertRegimenItemInput,
  UpsertRegimenItemResult,
} from "./types.js";

function buildBody(record: RegimenItemRecord): string {
  return [
    `# ${record.title}`,
    "",
    detailList([
      ["Kind", record.kind],
      ["Status", record.status],
      ["Group", record.group],
      ["Started on", record.startedOn],
      ["Stopped on", record.stoppedOn],
      ["Schedule", record.schedule],
    ]),
    "",
    section(
      "Substance",
      detailList([
        ["Name", record.substance],
        ["Dose", record.dose !== undefined ? `${record.dose}${record.unit ? ` ${record.unit}` : ""}` : undefined],
      ]),
    ),
    "",
    section("Related Goals", record.relatedGoalIds ? record.relatedGoalIds.map((value) => `- ${value}`).join("\n") : "- none"),
    "",
    section(
      "Related Conditions",
      record.relatedConditionIds ? record.relatedConditionIds.map((value) => `- ${value}`).join("\n") : "- none",
    ),
    "",
  ].join("\n");
}

function recordFromParts(attributes: FrontmatterObject, relativePath: string, markdown: string): RegimenItemRecord {
  requireMatchingDocType(
    attributes,
    REGIMEN_SCHEMA_VERSION,
    REGIMEN_DOC_TYPE,
    "VAULT_INVALID_REGIMEN",
    "Regimen registry document has an unexpected shape.",
  );
  const startedOn = optionalDateOnly(attributes.startedOn as string | undefined, "startedOn");

  if (!startedOn) {
    throw new VaultError("VAULT_INVALID_REGIMEN", "Regimen registry document is missing startedOn.");
  }

  return stripUndefined({
    schemaVersion: REGIMEN_SCHEMA_VERSION,
    docType: REGIMEN_DOC_TYPE,
    regimenId: requireString(attributes.regimenId, "regimenId", 64),
    slug: requireString(attributes.slug, "slug", 160),
    title: requireString(attributes.title, "title", 160),
    kind: optionalEnum(attributes.kind, REGIMEN_KINDS, "kind") ?? "medication",
    status: optionalEnum(attributes.status, REGIMEN_STATUSES, "status") ?? "active",
    startedOn,
    stoppedOn: optionalDateOnly(attributes.stoppedOn as string | undefined, "stoppedOn"),
    substance: optionalString(attributes.substance, "substance", 160),
    dose: optionalFiniteNumber(attributes.dose, "dose", 0),
    unit: optionalString(attributes.unit, "unit", 40),
    schedule: optionalString(attributes.schedule, "schedule", 160),
    relatedGoalIds: normalizeRecordIdList(attributes.relatedGoalIds, "relatedGoalIds", "goal"),
    relatedConditionIds: normalizeRecordIdList(attributes.relatedConditionIds, "relatedConditionIds", "cond"),
    group: groupFromRegimenPath(relativePath, REGIMENS_DIRECTORY),
    relativePath,
    markdown,
  });
}

function buildAttributes(record: RegimenItemRecord): FrontmatterObject {
  return stripUndefined({
    schemaVersion: REGIMEN_SCHEMA_VERSION,
    docType: REGIMEN_DOC_TYPE,
    regimenId: record.regimenId,
    slug: record.slug,
    title: record.title,
    kind: record.kind,
    status: record.status,
    startedOn: record.startedOn,
    stoppedOn: record.stoppedOn,
    substance: record.substance,
    dose: record.dose,
    unit: record.unit,
    schedule: record.schedule,
    relatedGoalIds: record.relatedGoalIds,
    relatedConditionIds: record.relatedConditionIds,
  }) as FrontmatterObject;
}

function validateRegimenTiming(record: RegimenItemRecord): RegimenItemRecord {
  if (!record.startedOn) {
    throw new VaultError("VAULT_INVALID_INPUT", "startedOn is required.");
  }

  if (record.stoppedOn && record.stoppedOn < record.startedOn) {
    throw new VaultError("VAULT_INVALID_INPUT", "stoppedOn must be on or after startedOn.");
  }

  if (record.stoppedOn && !["stopped", "completed"].includes(record.status)) {
    throw new VaultError("VAULT_INVALID_INPUT", "stoppedOn requires status=stopped or completed.");
  }

  if (record.status === "stopped" && !record.stoppedOn) {
    throw new VaultError("VAULT_INVALID_INPUT", "status=stopped requires stoppedOn.");
  }

  return record;
}

async function loadRegimenItems(vaultRoot: string): Promise<RegimenItemRecord[]> {
  return loadMarkdownRegistry(
    vaultRoot,
    REGIMENS_DIRECTORY,
    recordFromParts,
    (left, right) =>
      left.group.localeCompare(right.group) ||
      left.title.localeCompare(right.title) ||
      left.regimenId.localeCompare(right.regimenId),
  );
}

function selectRegimenRecord(
  records: RegimenItemRecord[],
  regimenId: string | undefined,
  slug: string,
  group: string | undefined,
): RegimenItemRecord | null {
  const byId = regimenId ? records.find((record) => record.regimenId === regimenId) ?? null : null;
  const slugMatches = records.filter((record) => record.slug === slug && (!group || record.group === group));
  const bySlug = slugMatches.length > 0 ? slugMatches[0] ?? null : null;

  if (slugMatches.length > 1 && !regimenId) {
    throw new VaultError("VAULT_REGIMEN_CONFLICT", "slug resolves to multiple regimen records; include group or regimenId.");
  }

  if (byId && bySlug && byId.regimenId !== bySlug.regimenId) {
    throw new VaultError("VAULT_REGIMEN_CONFLICT", "regimenId and slug resolve to different regimen records.");
  }

  return byId ?? bySlug;
}

async function resolveRegimenRecord(input: ReadRegimenItemInput): Promise<RegimenItemRecord> {
  const normalizedRegimenId = normalizeId(input.regimenId, "regimenId", "reg");
  const normalizedSlug = normalizeSelectorSlug(input.slug);
  const normalizedGroup = input.group ? normalizeGroupPath(input.group, "regimen") : undefined;
  const records = await loadRegimenItems(input.vaultRoot);
  const match = records.find((record) => {
    if (normalizedRegimenId && record.regimenId === normalizedRegimenId) {
      return true;
    }

    if (!normalizedSlug) {
      return false;
    }

    if (record.slug !== normalizedSlug) {
      return false;
    }

    return normalizedGroup ? record.group === normalizedGroup : true;
  });

  if (!match) {
    throw new VaultError("VAULT_REGIMEN_MISSING", "Regimen item was not found.");
  }

  if (normalizedSlug && !normalizedGroup && !normalizedRegimenId) {
    const collisions = records.filter((record) => record.slug === normalizedSlug);
    if (collisions.length > 1) {
      throw new VaultError("VAULT_REGIMEN_CONFLICT", "slug resolves to multiple regimen records; include group.");
    }
  }

  return match;
}

export async function upsertRegimenItem(
  input: UpsertRegimenItemInput,
): Promise<UpsertRegimenItemResult> {
  const normalizedRegimenId = normalizeId(input.regimenId, "regimenId", "reg");
  const title = requireString(input.title, "title", 160);
  const kind = optionalEnum(input.kind, REGIMEN_KINDS, "kind") ?? "medication";
  const slug = normalizeSlug(input.slug, "slug", title);
  const requestedGroup = normalizeGroupPath(input.group, kind);
  const existingRecords = await loadRegimenItems(input.vaultRoot);
  const existingRecord = selectRegimenRecord(existingRecords, normalizedRegimenId, slug, requestedGroup);
  const regimenId = existingRecord?.regimenId ?? normalizedRegimenId ?? generateRecordId("reg");
  const record = validateRegimenTiming(
    stripUndefined({
      schemaVersion: REGIMEN_SCHEMA_VERSION,
      docType: REGIMEN_DOC_TYPE,
      regimenId,
      slug: existingRecord?.slug ?? slug,
      title,
      kind,
      status: optionalEnum(input.status ?? "active", REGIMEN_STATUSES, "status") ?? "active",
      startedOn: optionalDateOnly(input.startedOn ?? new Date(), "startedOn") ?? "",
      stoppedOn: optionalDateOnly(input.stoppedOn, "stoppedOn"),
      substance: optionalString(input.substance, "substance", 160),
      dose: optionalFiniteNumber(input.dose, "dose", 0),
      unit: optionalString(input.unit, "unit", 40),
      schedule: optionalString(input.schedule, "schedule", 160),
      relatedGoalIds: normalizeRecordIdList(input.relatedGoalIds, "relatedGoalIds", "goal"),
      relatedConditionIds: normalizeRecordIdList(input.relatedConditionIds, "relatedConditionIds", "cond"),
      group: existingRecord?.group ?? requestedGroup,
      relativePath: existingRecord?.relativePath ?? `${REGIMENS_DIRECTORY}/${requestedGroup}/${slug}.md`,
    }) as RegimenItemRecord,
  );
  const markdown = stringifyFrontmatterDocument({
    attributes: buildAttributes(record),
    body: buildBody(record),
  });

  await writeVaultTextFile(input.vaultRoot, record.relativePath, markdown);

  return {
    created: !existingRecord,
    record: {
      ...record,
      markdown,
    },
  };
}

export async function listRegimenItems(vaultRoot: string): Promise<RegimenItemRecord[]> {
  return loadRegimenItems(vaultRoot);
}

export async function readRegimenItem(input: ReadRegimenItemInput): Promise<RegimenItemRecord> {
  return resolveRegimenRecord(input);
}

export async function stopRegimenItem(
  input: StopRegimenItemInput,
): Promise<StopRegimenItemResult> {
  const current = await resolveRegimenRecord(input);
  const stoppedOn = optionalDateOnly(input.stoppedOn ?? new Date(), "stoppedOn") ?? "";
  const updatedRecord = validateRegimenTiming({
    ...current,
    status: "stopped",
    stoppedOn,
  });
  const markdown = stringifyFrontmatterDocument({
    attributes: buildAttributes(updatedRecord),
    body: buildBody(updatedRecord),
  });

  await writeVaultTextFile(input.vaultRoot, updatedRecord.relativePath, markdown);

  return {
    record: {
      ...updatedRecord,
      markdown,
    },
  };
}
