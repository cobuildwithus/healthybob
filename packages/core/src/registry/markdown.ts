import { VaultError } from "../errors.js";
import { parseFrontmatterDocument } from "../frontmatter.js";
import { readUtf8File, walkVaultFiles } from "../fs.js";

import type { FrontmatterObject } from "../types.js";

interface MarkdownRegistryLoadOptions<TRecord> {
  vaultRoot: string;
  directory: string;
  recordFromParts: (attributes: FrontmatterObject, relativePath: string, markdown: string) => TRecord;
  isExpectedRecord: (record: TRecord) => boolean;
  invalidCode: string;
  invalidMessage: string;
}

interface RegistryRecord {
  slug: string;
}

interface RegistrySelectionOptions<TRecord extends RegistryRecord> {
  records: readonly TRecord[];
  recordId?: string;
  slug?: string;
  getRecordId: (record: TRecord) => string;
  readMissingCode: string;
  readMissingMessage: string;
}

interface ExistingRegistrySelectionOptions<TRecord extends RegistryRecord>
  extends Omit<RegistrySelectionOptions<TRecord>, "readMissingCode" | "readMissingMessage"> {
  conflictCode: string;
  conflictMessage: string;
}

export async function loadMarkdownRegistryDocuments<TRecord>({
  vaultRoot,
  directory,
  recordFromParts,
  isExpectedRecord,
  invalidCode,
  invalidMessage,
}: MarkdownRegistryLoadOptions<TRecord>): Promise<TRecord[]> {
  const relativePaths = await walkVaultFiles(vaultRoot, directory, { extension: ".md" });
  const records: TRecord[] = [];

  for (const relativePath of relativePaths) {
    const markdown = await readUtf8File(vaultRoot, relativePath);
    const document = parseFrontmatterDocument(markdown);
    const record = recordFromParts(document.attributes, relativePath, markdown);

    if (!isExpectedRecord(record)) {
      throw new VaultError(invalidCode, invalidMessage);
    }

    records.push(record);
  }

  return records;
}

export function selectExistingRegistryRecord<TRecord extends RegistryRecord>({
  records,
  recordId,
  slug,
  getRecordId,
  conflictCode,
  conflictMessage,
}: ExistingRegistrySelectionOptions<TRecord>): TRecord | null {
  const byId = recordId ? records.find((record) => getRecordId(record) === recordId) ?? null : null;
  const bySlug = slug ? records.find((record) => record.slug === slug) ?? null : null;

  if (byId && bySlug && getRecordId(byId) !== getRecordId(bySlug)) {
    throw new VaultError(conflictCode, conflictMessage);
  }

  return byId ?? bySlug;
}

export function readRegistryRecord<TRecord extends RegistryRecord>({
  records,
  recordId,
  slug,
  getRecordId,
  readMissingCode,
  readMissingMessage,
}: RegistrySelectionOptions<TRecord>): TRecord {
  const match =
    (recordId ? records.find((record) => getRecordId(record) === recordId) : undefined) ??
    (slug ? records.find((record) => record.slug === slug) : undefined);

  if (!match) {
    throw new VaultError(readMissingCode, readMissingMessage);
  }

  return match;
}
