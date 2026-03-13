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
  optionalEnum,
  optionalString,
  requireString,
} from "../history/shared.js";

import type { FrontmatterObject } from "../types.js";
import type {
  GeneticVariantRecord,
  ReadGeneticVariantInput,
  UpsertGeneticVariantInput,
  UpsertGeneticVariantResult,
} from "./types.js";
import {
  GENETIC_VARIANT_DOC_TYPE,
  GENETIC_VARIANT_SCHEMA_VERSION,
  VARIANT_INHERITANCES,
  VARIANT_SIGNIFICANCES,
  VARIANT_ZYGOSITIES,
} from "./types.js";

const GENETICS_DIRECTORY = "bank/genetics";

function buildBody(record: {
  gene: string;
  title: string;
  sourceFamilyMemberIds?: string[];
  note?: string;
}): string {
  return [
    `# ${record.title}`,
    "",
    `Gene: ${record.gene}`,
    "",
    "## Source Family Members",
    "",
    bulletList(record.sourceFamilyMemberIds),
    "",
    maybeSection("Notes", record.note),
    "",
  ].join("\n");
}

function recordFromParts(
  attributes: FrontmatterObject,
  relativePath: string,
  markdown: string,
): GeneticVariantRecord {
  return {
    schemaVersion: requireString(attributes.schemaVersion, "schemaVersion", 40) as typeof GENETIC_VARIANT_SCHEMA_VERSION,
    docType: requireString(attributes.docType, "docType", 40) as typeof GENETIC_VARIANT_DOC_TYPE,
    variantId: requireString(attributes.variantId, "variantId", 64),
    slug: requireString(attributes.slug, "slug", 160),
    title: requireString(attributes.title, "title", 240),
    gene: requireString(attributes.gene, "gene", 80),
    zygosity: optionalEnum(attributes.zygosity, VARIANT_ZYGOSITIES, "zygosity"),
    significance: optionalEnum(attributes.significance, VARIANT_SIGNIFICANCES, "significance"),
    inheritance: optionalEnum(attributes.inheritance, VARIANT_INHERITANCES, "inheritance"),
    sourceFamilyMemberIds: normalizeStringList(
      attributes.sourceFamilyMemberIds,
      "sourceFamilyMemberIds",
      "familyMemberId",
      24,
      80,
    ),
    note: optionalString(attributes.note, "note", 4000),
    relativePath,
    markdown,
  };
}

async function loadGeneticVariants(vaultRoot: string): Promise<GeneticVariantRecord[]> {
  const relativePaths = await walkVaultFiles(vaultRoot, GENETICS_DIRECTORY, { extension: ".md" });
  const records: GeneticVariantRecord[] = [];

  for (const relativePath of relativePaths) {
    const markdown = await readUtf8File(vaultRoot, relativePath);
    const document = parseFrontmatterDocument(markdown);
    const record = recordFromParts(document.attributes, relativePath, markdown);

    if (record.docType !== GENETIC_VARIANT_DOC_TYPE || record.schemaVersion !== GENETIC_VARIANT_SCHEMA_VERSION) {
      throw new VaultError("VAULT_INVALID_GENETIC_VARIANT", "Genetics registry document has an unexpected shape.");
    }

    records.push(record);
  }

  records.sort((left, right) => left.gene.localeCompare(right.gene) || left.title.localeCompare(right.title) || left.variantId.localeCompare(right.variantId));
  return records;
}

function selectExistingRecord(
  records: GeneticVariantRecord[],
  variantId: string | undefined,
  slug: string,
): GeneticVariantRecord | null {
  const byId = variantId ? records.find((record) => record.variantId === variantId) ?? null : null;
  const bySlug = records.find((record) => record.slug === slug) ?? null;

  if (byId && bySlug && byId.variantId !== bySlug.variantId) {
    throw new VaultError("VAULT_GENETIC_VARIANT_CONFLICT", "variantId and slug resolve to different variants.");
  }

  return byId ?? bySlug;
}

function buildAttributes(input: {
  variantId: string;
  slug: string;
  title: string;
  gene: string;
  zygosity?: string;
  significance?: string;
  inheritance?: string;
  sourceFamilyMemberIds?: string[];
  note?: string;
}): FrontmatterObject {
  return Object.fromEntries(
    Object.entries({
      schemaVersion: GENETIC_VARIANT_SCHEMA_VERSION,
      docType: GENETIC_VARIANT_DOC_TYPE,
      variantId: input.variantId,
      slug: input.slug,
      title: input.title,
      gene: input.gene,
      zygosity: input.zygosity,
      significance: input.significance,
      inheritance: input.inheritance,
      sourceFamilyMemberIds: input.sourceFamilyMemberIds,
      note: input.note,
    }).filter(([, value]) => value !== undefined),
  ) as FrontmatterObject;
}

export async function upsertGeneticVariant(
  input: UpsertGeneticVariantInput,
): Promise<UpsertGeneticVariantResult> {
  const normalizedVariantId = normalizeId(input.variantId, "variantId", "var");
  const title = requireString(input.title ?? input.label, "title", 240);
  const gene = requireString(input.gene, "gene", 80);
  const slug = normalizeSlug(input.slug, "slug", `${gene}-${title}`);
  const existingRecords = await loadGeneticVariants(input.vaultRoot);
  const existingRecord = selectExistingRecord(existingRecords, normalizedVariantId, slug);
  const variantId = existingRecord?.variantId ?? normalizedVariantId ?? generateRecordId("var");
  const relativePath = existingRecord?.relativePath ?? `${GENETICS_DIRECTORY}/${slug}.md`;
  const sourceIdsInput = input.sourceFamilyMemberIds ?? input.familyMemberIds;
  const sourceFamilyMemberIds =
    sourceIdsInput === undefined
      ? existingRecord?.sourceFamilyMemberIds
      : normalizeStringList(sourceIdsInput, "sourceFamilyMemberIds", "familyMemberId", 24, 80);
  const note =
    input.note === undefined && input.summary === undefined
      ? existingRecord?.note
      : optionalString(input.note ?? input.summary, "note", 4000);
  const attributes = buildAttributes({
    variantId,
    slug: existingRecord?.slug ?? slug,
    title,
    gene,
    zygosity:
      input.zygosity === undefined
        ? existingRecord?.zygosity
        : optionalEnum(input.zygosity, VARIANT_ZYGOSITIES, "zygosity"),
    significance:
      input.significance === undefined
        ? existingRecord?.significance
        : optionalEnum(input.significance, VARIANT_SIGNIFICANCES, "significance"),
    inheritance:
      input.inheritance === undefined
        ? existingRecord?.inheritance
        : optionalEnum(input.inheritance, VARIANT_INHERITANCES, "inheritance"),
    sourceFamilyMemberIds,
    note,
  });
  const markdown = stringifyFrontmatterDocument({
    attributes,
    body: buildBody({
      gene,
      title,
      sourceFamilyMemberIds,
      note,
    }),
  });

  await writeVaultTextFile(input.vaultRoot, relativePath, markdown);

  return {
    created: !existingRecord,
    record: recordFromParts(attributes, relativePath, markdown),
  };
}

export async function listGeneticVariants(vaultRoot: string): Promise<GeneticVariantRecord[]> {
  return loadGeneticVariants(vaultRoot);
}

export async function readGeneticVariant({
  vaultRoot,
  variantId,
  slug,
}: ReadGeneticVariantInput): Promise<GeneticVariantRecord> {
  const normalizedVariantId = normalizeId(variantId, "variantId", "var");
  const normalizedSlug = slug ? normalizeSlug(slug, "slug") : undefined;
  const records = await loadGeneticVariants(vaultRoot);
  const match = records.find((record) => {
    if (normalizedVariantId && record.variantId === normalizedVariantId) {
      return true;
    }

    return normalizedSlug ? record.slug === normalizedSlug : false;
  });

  if (!match) {
    throw new VaultError("VAULT_GENETIC_VARIANT_MISSING", "Genetic variant was not found.");
  }

  return match;
}
