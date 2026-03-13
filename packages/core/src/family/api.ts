import { VaultError } from "../errors.js";
import { parseFrontmatterDocument, stringifyFrontmatterDocument } from "../frontmatter.js";
import { readUtf8File, walkVaultFiles, writeVaultTextFile } from "../fs.js";
import { generateRecordId } from "../ids.js";

import {
  bulletList,
  maybeSection,
  normalizeId,
  normalizeSlug,
  normalizeStringList,
  optionalBoolean,
  optionalString,
  requireString,
} from "../history/shared.js";

import type { FrontmatterObject } from "../types.js";
import type {
  FamilyMemberRecord,
  ReadFamilyMemberInput,
  UpsertFamilyMemberInput,
  UpsertFamilyMemberResult,
} from "./types.js";
import { FAMILY_MEMBER_DOC_TYPE, FAMILY_MEMBER_SCHEMA_VERSION } from "./types.js";

const FAMILY_DIRECTORY = "bank/family";

function buildBody(record: {
  title: string;
  relationship: string;
  conditions?: string[];
  note?: string;
  relatedVariantIds?: string[];
}): string {
  return [
    `# ${record.title}`,
    "",
    `Relationship: ${record.relationship}`,
    "",
    "## Conditions",
    "",
    bulletList(record.conditions),
    "",
    "## Related Variants",
    "",
    bulletList(record.relatedVariantIds),
    "",
    maybeSection("Notes", record.note),
    "",
  ].join("\n");
}

function recordFromParts(
  attributes: FrontmatterObject,
  relativePath: string,
  markdown: string,
): FamilyMemberRecord {
  return {
    schemaVersion: requireString(attributes.schemaVersion, "schemaVersion", 40) as typeof FAMILY_MEMBER_SCHEMA_VERSION,
    docType: requireString(attributes.docType, "docType", 40) as typeof FAMILY_MEMBER_DOC_TYPE,
    familyMemberId: requireString(attributes.familyMemberId, "familyMemberId", 64),
    slug: requireString(attributes.slug, "slug", 160),
    title: requireString(attributes.title, "title", 160),
    relationship: requireString(attributes.relationship, "relationship", 120),
    conditions: normalizeStringList(attributes.conditions, "conditions", "condition", 24, 160),
    deceased: optionalBoolean(attributes.deceased, "deceased"),
    note: optionalString(attributes.note, "note", 4000),
    relatedVariantIds: normalizeStringList(
      attributes.relatedVariantIds,
      "relatedVariantIds",
      "variantId",
      24,
      80,
    ),
    relativePath,
    markdown,
  };
}

async function loadFamilyRecords(vaultRoot: string): Promise<FamilyMemberRecord[]> {
  const relativePaths = await walkVaultFiles(vaultRoot, FAMILY_DIRECTORY, { extension: ".md" });
  const records: FamilyMemberRecord[] = [];

  for (const relativePath of relativePaths) {
    const markdown = await readUtf8File(vaultRoot, relativePath);
    const document = parseFrontmatterDocument(markdown);
    const record = recordFromParts(document.attributes, relativePath, markdown);

    if (record.docType !== FAMILY_MEMBER_DOC_TYPE || record.schemaVersion !== FAMILY_MEMBER_SCHEMA_VERSION) {
      throw new VaultError("VAULT_INVALID_FAMILY_MEMBER", "Family registry document has an unexpected shape.");
    }

    records.push(record);
  }

  records.sort((left, right) => left.title.localeCompare(right.title) || left.familyMemberId.localeCompare(right.familyMemberId));
  return records;
}

function selectExistingRecord(
  records: FamilyMemberRecord[],
  familyMemberId: string | undefined,
  slug: string,
): FamilyMemberRecord | null {
  const byId = familyMemberId ? records.find((record) => record.familyMemberId === familyMemberId) ?? null : null;
  const bySlug = records.find((record) => record.slug === slug) ?? null;

  if (byId && bySlug && byId.familyMemberId !== bySlug.familyMemberId) {
    throw new VaultError("VAULT_FAMILY_MEMBER_CONFLICT", "familyMemberId and slug resolve to different family members.");
  }

  return byId ?? bySlug;
}

function buildAttributes(input: {
  familyMemberId: string;
  slug: string;
  title: string;
  relationship: string;
  conditions?: string[];
  deceased?: boolean;
  note?: string;
  relatedVariantIds?: string[];
}): FrontmatterObject {
  return Object.fromEntries(
    Object.entries({
      schemaVersion: FAMILY_MEMBER_SCHEMA_VERSION,
      docType: FAMILY_MEMBER_DOC_TYPE,
      familyMemberId: input.familyMemberId,
      slug: input.slug,
      title: input.title,
      relationship: input.relationship,
      conditions: input.conditions,
      deceased: input.deceased,
      note: input.note,
      relatedVariantIds: input.relatedVariantIds,
    }).filter(([, value]) => value !== undefined),
  ) as FrontmatterObject;
}

export async function upsertFamilyMember(
  input: UpsertFamilyMemberInput,
): Promise<UpsertFamilyMemberResult> {
  const normalizedFamilyMemberId = normalizeId(input.familyMemberId, "familyMemberId", "fam");
  const title = requireString(input.title ?? input.name, "title", 160);
  const relationship = requireString(input.relationship ?? input.relation, "relationship", 120);
  const slug = normalizeSlug(input.slug, "slug", title);
  const existingRecords = await loadFamilyRecords(input.vaultRoot);
  const existingRecord = selectExistingRecord(existingRecords, normalizedFamilyMemberId, slug);
  const familyMemberId = existingRecord?.familyMemberId ?? normalizedFamilyMemberId ?? generateRecordId("fam");
  const relativePath = existingRecord?.relativePath ?? `${FAMILY_DIRECTORY}/${slug}.md`;
  const conditions =
    input.conditions === undefined
      ? existingRecord?.conditions
      : normalizeStringList(input.conditions, "conditions", "condition", 24, 160);
  const note =
    input.note === undefined && input.summary === undefined
      ? existingRecord?.note
      : optionalString(input.note ?? input.summary, "note", 4000);
  const relatedVariantIds =
    input.relatedVariantIds === undefined
      ? existingRecord?.relatedVariantIds
      : normalizeStringList(input.relatedVariantIds, "relatedVariantIds", "variantId", 24, 80);
  const attributes = buildAttributes({
    familyMemberId,
    slug: existingRecord?.slug ?? slug,
    title,
    relationship,
    conditions,
    deceased:
      input.deceased === undefined ? existingRecord?.deceased : optionalBoolean(input.deceased, "deceased"),
    note,
    relatedVariantIds,
  });
  const markdown = stringifyFrontmatterDocument({
    attributes,
    body: buildBody({
      title,
      relationship,
      conditions,
      note,
      relatedVariantIds,
    }),
  });

  await writeVaultTextFile(input.vaultRoot, relativePath, markdown);

  return {
    created: !existingRecord,
    record: recordFromParts(attributes, relativePath, markdown),
  };
}

export async function listFamilyMembers(vaultRoot: string): Promise<FamilyMemberRecord[]> {
  return loadFamilyRecords(vaultRoot);
}

export async function readFamilyMember({
  vaultRoot,
  memberId,
  slug,
}: ReadFamilyMemberInput): Promise<FamilyMemberRecord> {
  const normalizedFamilyMemberId = normalizeId(memberId, "memberId", "fam");
  const normalizedSlug = slug ? normalizeSlug(slug, "slug") : undefined;
  const records = await loadFamilyRecords(vaultRoot);
  const match = records.find((record) => {
    if (normalizedFamilyMemberId && record.familyMemberId === normalizedFamilyMemberId) {
      return true;
    }

    return normalizedSlug ? record.slug === normalizedSlug : false;
  });

  if (!match) {
    throw new VaultError("VAULT_FAMILY_MEMBER_MISSING", "Family member was not found.");
  }

  return match;
}
