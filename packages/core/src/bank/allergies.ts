import { VaultError } from "../errors.js";
import { stringifyFrontmatterDocument } from "../frontmatter.js";
import { writeVaultTextFile } from "../fs.js";
import { generateRecordId } from "../ids.js";

import {
  ALLERGIES_DIRECTORY,
  ALLERGY_CRITICALITIES,
  ALLERGY_DOC_TYPE,
  ALLERGY_SCHEMA_VERSION,
  ALLERGY_STATUSES,
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
} from "./shared.js";

import type { FrontmatterObject } from "../types.js";
import type { AllergyRecord, ReadAllergyInput, UpsertAllergyInput, UpsertAllergyResult } from "./types.js";

function buildBody(record: AllergyRecord): string {
  return [
    `# ${record.title}`,
    "",
    detailList([
      ["Substance", record.substance],
      ["Status", record.status],
      ["Criticality", record.criticality],
      ["Reaction", record.reaction],
      ["Recorded on", record.recordedOn],
    ]),
    "",
    section(
      "Related Conditions",
      record.relatedConditionIds ? record.relatedConditionIds.map((value) => `- ${value}`).join("\n") : "- none",
    ),
    "",
    section("Note", record.note ?? "- none"),
    "",
  ].join("\n");
}

function recordFromParts(attributes: FrontmatterObject, relativePath: string, markdown: string): AllergyRecord {
  requireMatchingDocType(
    attributes,
    ALLERGY_SCHEMA_VERSION,
    ALLERGY_DOC_TYPE,
    "VAULT_INVALID_ALLERGY",
    "Allergy registry document has an unexpected shape.",
  );

  return stripUndefined({
    schemaVersion: ALLERGY_SCHEMA_VERSION,
    docType: ALLERGY_DOC_TYPE,
    allergyId: requireString(attributes.allergyId, "allergyId", 64),
    slug: requireString(attributes.slug, "slug", 160),
    title: requireString(attributes.title, "title", 160),
    substance: requireString(attributes.substance, "substance", 160),
    status: optionalEnum(attributes.status, ALLERGY_STATUSES, "status") ?? "active",
    criticality: optionalEnum(attributes.criticality, ALLERGY_CRITICALITIES, "criticality"),
    reaction: optionalString(attributes.reaction, "reaction", 160),
    recordedOn: optionalDateOnly(attributes.recordedOn as string | undefined, "recordedOn"),
    relatedConditionIds: normalizeRecordIdList(attributes.relatedConditionIds, "relatedConditionIds", "cond"),
    note: optionalString(attributes.note, "note", 4000),
    relativePath,
    markdown,
  });
}

function buildAttributes(record: AllergyRecord): FrontmatterObject {
  return stripUndefined({
    schemaVersion: ALLERGY_SCHEMA_VERSION,
    docType: ALLERGY_DOC_TYPE,
    allergyId: record.allergyId,
    slug: record.slug,
    title: record.title,
    substance: record.substance,
    status: record.status,
    criticality: record.criticality,
    reaction: record.reaction,
    recordedOn: record.recordedOn,
    relatedConditionIds: record.relatedConditionIds,
    note: record.note,
  }) as FrontmatterObject;
}

function validateAllergyTimeline(record: AllergyRecord): AllergyRecord {
  if (record.status === "resolved" && !record.recordedOn) {
    return record;
  }

  return record;
}

async function loadAllergies(vaultRoot: string): Promise<AllergyRecord[]> {
  return loadMarkdownRegistry(
    vaultRoot,
    ALLERGIES_DIRECTORY,
    recordFromParts,
    (left, right) => left.title.localeCompare(right.title) || left.allergyId.localeCompare(right.allergyId),
  );
}

export async function upsertAllergy(input: UpsertAllergyInput): Promise<UpsertAllergyResult> {
  const normalizedAllergyId = normalizeId(input.allergyId, "allergyId", "alg");
  const title = requireString(input.title, "title", 160);
  const slug = normalizeSlug(input.slug, "slug", title);
  const existingRecords = await loadAllergies(input.vaultRoot);
  const existingRecord = selectRecordByIdOrSlug(
    existingRecords,
    normalizedAllergyId,
    slug,
    (record) => record.allergyId,
    "Allergy",
    "VAULT_ALLERGY_CONFLICT",
  );
  const allergyId = existingRecord?.allergyId ?? normalizedAllergyId ?? generateRecordId("alg");
  const record = validateAllergyTimeline(
    stripUndefined({
      schemaVersion: ALLERGY_SCHEMA_VERSION,
      docType: ALLERGY_DOC_TYPE,
      allergyId,
      slug: existingRecord?.slug ?? slug,
      title,
      substance: requireString(input.substance, "substance", 160),
      status: optionalEnum(input.status ?? "active", ALLERGY_STATUSES, "status") ?? "active",
      criticality: optionalEnum(input.criticality, ALLERGY_CRITICALITIES, "criticality"),
      reaction: optionalString(input.reaction, "reaction", 160),
      recordedOn: optionalDateOnly(input.recordedOn, "recordedOn"),
      relatedConditionIds: normalizeRecordIdList(input.relatedConditionIds, "relatedConditionIds", "cond"),
      note: optionalString(input.note, "note", 4000),
      relativePath: existingRecord?.relativePath ?? `${ALLERGIES_DIRECTORY}/${slug}.md`,
    }) as AllergyRecord,
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

export async function listAllergies(vaultRoot: string): Promise<AllergyRecord[]> {
  return loadAllergies(vaultRoot);
}

export async function readAllergy({ vaultRoot, allergyId, slug }: ReadAllergyInput): Promise<AllergyRecord> {
  const normalizedAllergyId = normalizeId(allergyId, "allergyId", "alg");
  const normalizedSlug = normalizeSelectorSlug(slug);
  const records = await loadAllergies(vaultRoot);
  const match = records.find((record) => {
    if (normalizedAllergyId && record.allergyId === normalizedAllergyId) {
      return true;
    }

    return normalizedSlug ? record.slug === normalizedSlug : false;
  });

  if (!match) {
    throw new VaultError("VAULT_ALLERGY_MISSING", "Allergy was not found.");
  }

  return match;
}
