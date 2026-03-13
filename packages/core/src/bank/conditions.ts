import { emitAuditRecord } from "../audit.js";
import { VaultError } from "../errors.js";
import { stringifyFrontmatterDocument } from "../frontmatter.js";
import { writeVaultTextFile } from "../fs.js";
import { generateRecordId } from "../ids.js";

import {
  CONDITIONS_DIRECTORY,
  CONDITION_CLINICAL_STATUSES,
  CONDITION_DOC_TYPE,
  CONDITION_SCHEMA_VERSION,
  CONDITION_SEVERITIES,
  CONDITION_VERIFICATION_STATUSES,
} from "./types.js";
import {
  detailList,
  loadMarkdownRegistry,
  normalizeRecordIdList,
  normalizeSelectorSlug,
  optionalDateOnly,
  optionalEnum,
  optionalString,
  requireMatchingDocType,
  requireString,
  section,
  selectRecordByIdOrSlug,
  stripUndefined,
  normalizeId,
  normalizeSlug,
  normalizeStringList,
} from "./shared.js";

import type { FrontmatterObject } from "../types.js";
import type {
  ConditionRecord,
  ReadConditionInput,
  UpsertConditionInput,
  UpsertConditionResult,
} from "./types.js";

function buildBody(record: ConditionRecord): string {
  return [
    `# ${record.title}`,
    "",
    detailList([
      ["Clinical status", record.clinicalStatus],
      ["Verification status", record.verificationStatus],
      ["Severity", record.severity],
      ["Asserted on", record.assertedOn],
      ["Resolved on", record.resolvedOn],
    ]),
    "",
    section("Body Sites", record.bodySites ? record.bodySites.map((value) => `- ${value}`).join("\n") : "- none"),
    "",
    section("Related Goals", record.relatedGoalIds ? record.relatedGoalIds.map((value) => `- ${value}`).join("\n") : "- none"),
    "",
    section(
      "Related Regimens",
      record.relatedRegimenIds ? record.relatedRegimenIds.map((value) => `- ${value}`).join("\n") : "- none",
    ),
    "",
    section("Note", record.note ?? "- none"),
    "",
  ].join("\n");
}

function recordFromParts(attributes: FrontmatterObject, relativePath: string, markdown: string): ConditionRecord {
  requireMatchingDocType(
    attributes,
    CONDITION_SCHEMA_VERSION,
    CONDITION_DOC_TYPE,
    "VAULT_INVALID_CONDITION",
    "Condition registry document has an unexpected shape.",
  );

  return stripUndefined({
    schemaVersion: CONDITION_SCHEMA_VERSION,
    docType: CONDITION_DOC_TYPE,
    conditionId: requireString(attributes.conditionId, "conditionId", 64),
    slug: requireString(attributes.slug, "slug", 160),
    title: requireString(attributes.title, "title", 160),
    clinicalStatus:
      optionalEnum(attributes.clinicalStatus, CONDITION_CLINICAL_STATUSES, "clinicalStatus") ?? "active",
    verificationStatus: optionalEnum(
      attributes.verificationStatus,
      CONDITION_VERIFICATION_STATUSES,
      "verificationStatus",
    ),
    assertedOn: optionalDateOnly(attributes.assertedOn as string | undefined, "assertedOn"),
    resolvedOn: optionalDateOnly(attributes.resolvedOn as string | undefined, "resolvedOn"),
    severity: optionalEnum(attributes.severity, CONDITION_SEVERITIES, "severity"),
    bodySites: normalizeStringList(attributes.bodySites, "bodySites", "bodySite", 16, 120),
    relatedGoalIds: normalizeRecordIdList(attributes.relatedGoalIds, "relatedGoalIds", "goal"),
    relatedRegimenIds: normalizeRecordIdList(attributes.relatedRegimenIds, "relatedRegimenIds", "reg"),
    note: optionalString(attributes.note, "note", 4000),
    relativePath,
    markdown,
  });
}

function buildAttributes(record: ConditionRecord): FrontmatterObject {
  return stripUndefined({
    schemaVersion: CONDITION_SCHEMA_VERSION,
    docType: CONDITION_DOC_TYPE,
    conditionId: record.conditionId,
    slug: record.slug,
    title: record.title,
    clinicalStatus: record.clinicalStatus,
    verificationStatus: record.verificationStatus,
    assertedOn: record.assertedOn,
    resolvedOn: record.resolvedOn,
    severity: record.severity,
    bodySites: record.bodySites,
    relatedGoalIds: record.relatedGoalIds,
    relatedRegimenIds: record.relatedRegimenIds,
    note: record.note,
  }) as FrontmatterObject;
}

function validateConditionTimeline(record: ConditionRecord): ConditionRecord {
  if (record.resolvedOn && record.clinicalStatus !== "resolved") {
    throw new VaultError("VAULT_INVALID_INPUT", "resolvedOn requires clinicalStatus=resolved.");
  }

  if (record.assertedOn && record.resolvedOn && record.resolvedOn < record.assertedOn) {
    throw new VaultError("VAULT_INVALID_INPUT", "resolvedOn must be on or after assertedOn.");
  }

  return record;
}

async function loadConditions(vaultRoot: string): Promise<ConditionRecord[]> {
  return loadMarkdownRegistry(
    vaultRoot,
    CONDITIONS_DIRECTORY,
    recordFromParts,
    (left, right) => left.title.localeCompare(right.title) || left.conditionId.localeCompare(right.conditionId),
  );
}

export async function upsertCondition(
  input: UpsertConditionInput,
): Promise<UpsertConditionResult> {
  const normalizedConditionId = normalizeId(input.conditionId, "conditionId", "cond");
  const existingRecords = await loadConditions(input.vaultRoot);
  const selectorSlug =
    normalizeSelectorSlug(input.slug) ??
    (input.title ? normalizeSlug(undefined, "slug", input.title) : undefined);
  const existingRecord = selectRecordByIdOrSlug(
    existingRecords,
    normalizedConditionId,
    selectorSlug,
    (record) => record.conditionId,
    "Condition",
    "VAULT_CONDITION_CONFLICT",
  );
  const title = requireString(input.title ?? existingRecord?.title, "title", 160);
  const slug = existingRecord?.slug ?? selectorSlug ?? normalizeSlug(undefined, "slug", title);
  const conditionId = existingRecord?.conditionId ?? normalizedConditionId ?? generateRecordId("cond");
  const record = validateConditionTimeline(
    stripUndefined({
      schemaVersion: CONDITION_SCHEMA_VERSION,
      docType: CONDITION_DOC_TYPE,
      conditionId,
      slug: existingRecord?.slug ?? slug,
      title,
      clinicalStatus:
        input.clinicalStatus === undefined
          ? existingRecord?.clinicalStatus ?? "active"
          : optionalEnum(input.clinicalStatus, CONDITION_CLINICAL_STATUSES, "clinicalStatus") ?? "active",
      verificationStatus:
        input.verificationStatus === undefined
          ? existingRecord?.verificationStatus
          : optionalEnum(
              input.verificationStatus,
              CONDITION_VERIFICATION_STATUSES,
              "verificationStatus",
            ),
      assertedOn:
        input.assertedOn === undefined
          ? existingRecord?.assertedOn
          : optionalDateOnly(input.assertedOn, "assertedOn"),
      resolvedOn:
        input.resolvedOn === undefined
          ? existingRecord?.resolvedOn
          : optionalDateOnly(input.resolvedOn, "resolvedOn"),
      severity:
        input.severity === undefined
          ? existingRecord?.severity
          : optionalEnum(input.severity, CONDITION_SEVERITIES, "severity"),
      bodySites:
        input.bodySites === undefined
          ? existingRecord?.bodySites
          : normalizeStringList(input.bodySites, "bodySites", "bodySite", 16, 120),
      relatedGoalIds:
        input.relatedGoalIds === undefined
          ? existingRecord?.relatedGoalIds
          : normalizeRecordIdList(input.relatedGoalIds, "relatedGoalIds", "goal"),
      relatedRegimenIds:
        input.relatedRegimenIds === undefined
          ? existingRecord?.relatedRegimenIds
          : normalizeRecordIdList(input.relatedRegimenIds, "relatedRegimenIds", "reg"),
      note:
        input.note === undefined
          ? existingRecord?.note
          : optionalString(input.note, "note", 4000),
      relativePath: existingRecord?.relativePath ?? `${CONDITIONS_DIRECTORY}/${slug}.md`,
    }) as ConditionRecord,
  );
  const markdown = stringifyFrontmatterDocument({
    attributes: buildAttributes(record),
    body: buildBody(record),
  });

  await writeVaultTextFile(input.vaultRoot, record.relativePath, markdown);
  const audit = await emitAuditRecord({
    vaultRoot: input.vaultRoot,
    action: "condition_upsert",
    commandName: "core.upsertCondition",
    summary: `Upserted condition ${record.conditionId}.`,
    targetIds: [record.conditionId],
    changes: [
      {
        path: record.relativePath,
        op: existingRecord ? "update" : "create",
      },
    ],
  });

  return {
    created: !existingRecord,
    auditPath: audit.relativePath,
    record: {
      ...record,
      markdown,
    },
  };
}

export async function listConditions(vaultRoot: string): Promise<ConditionRecord[]> {
  return loadConditions(vaultRoot);
}

export async function readCondition({
  vaultRoot,
  conditionId,
  slug,
}: ReadConditionInput): Promise<ConditionRecord> {
  const normalizedConditionId = normalizeId(conditionId, "conditionId", "cond");
  const normalizedSlug = normalizeSelectorSlug(slug);
  const records = await loadConditions(vaultRoot);
  const match = records.find((record) => {
    if (normalizedConditionId && record.conditionId === normalizedConditionId) {
      return true;
    }

    return normalizedSlug ? record.slug === normalizedSlug : false;
  });

  if (!match) {
    throw new VaultError("VAULT_CONDITION_MISSING", "Condition was not found.");
  }

  return match;
}
