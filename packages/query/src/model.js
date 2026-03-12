import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { parseMarkdownDocument } from "./markdown.js";

/**
 * @typedef {{
 *   id: string;
 *   lookupIds: string[];
 *   recordType: "audit" | "core" | "event" | "experiment" | "journal" | "sample";
 *   sourcePath: string;
 *   sourceFile: string;
 *   occurredAt: string | null;
 *   date: string | null;
 *   kind: string | null;
 *   stream: string | null;
 *   experimentSlug: string | null;
 *   title: string | null;
 *   tags: string[];
 *   data: Record<string, unknown>;
 *   body: string | null;
 *   frontmatter: Record<string, unknown> | null;
 * }} VaultRecord
 */

/**
 * @typedef {{
 *   format: "healthybob.query.v1";
 *   vaultRoot: string;
 *   metadata: Record<string, unknown> | null;
 *   coreDocument: VaultRecord | null;
 *   experiments: VaultRecord[];
 *   journalEntries: VaultRecord[];
 *   events: VaultRecord[];
 *   samples: VaultRecord[];
 *   audits: VaultRecord[];
 *   records: VaultRecord[];
 * }} VaultReadModel
 */

/**
 * @typedef {{
 *   ids?: string[];
 *   recordTypes?: Array<VaultRecord["recordType"]>;
 *   kinds?: string[];
 *   streams?: string[];
 *   experimentSlug?: string;
 *   date?: string;
 *   from?: string;
 *   to?: string;
 *   tags?: string[];
 *   text?: string;
 * }} RecordFilter
 */

/**
 * @param {string} vaultRoot
 * @returns {Promise<VaultReadModel>}
 */
export async function readVault(vaultRoot) {
  const metadata = await readOptionalJson(path.join(vaultRoot, "vault.json"));
  const coreDocument = await readOptionalCoreDocument(vaultRoot, metadata);
  const experiments = await readExperimentPages(vaultRoot);
  const journalEntries = await readJournalPages(vaultRoot);
  const events = await readJsonlRecordFamily(vaultRoot, "ledger/events", "event");
  const samples = await readSampleRecords(vaultRoot);
  const audits = await readJsonlRecordFamily(vaultRoot, "audit", "audit");

  const records = [
    ...(coreDocument ? [coreDocument] : []),
    ...experiments,
    ...journalEntries,
    ...events,
    ...samples,
    ...audits,
  ].sort(compareRecords);

  return {
    format: "healthybob.query.v1",
    vaultRoot,
    metadata,
    coreDocument,
    experiments,
    journalEntries,
    events,
    samples,
    audits,
    records,
  };
}

/**
 * @param {VaultReadModel} vault
 * @param {string} recordId
 * @returns {VaultRecord | null}
 */
export function lookupRecordById(vault, recordId) {
  if (typeof recordId !== "string" || !recordId.trim()) {
    return null;
  }

  const normalizedId = recordId.trim();

  return (
    vault.records.find((record) => record.id === normalizedId) ??
    vault.records.find((record) => record.lookupIds.includes(normalizedId)) ??
    null
  );
}

/**
 * @param {VaultReadModel} vault
 * @param {RecordFilter} [filters]
 * @returns {VaultRecord[]}
 */
export function listRecords(vault, filters = {}) {
  const {
    ids,
    recordTypes,
    kinds,
    streams,
    experimentSlug,
    date,
    from,
    to,
    tags,
    text,
  } = filters;

  const idSet = ids ? new Set(ids) : null;
  const typeSet = recordTypes ? new Set(recordTypes) : null;
  const kindSet = kinds ? new Set(kinds) : null;
  const streamSet = streams ? new Set(streams) : null;
  const tagSet = tags ? new Set(tags) : null;
  const normalizedText = text ? text.toLowerCase() : null;

  return vault.records.filter((record) => {
    if (idSet && !record.lookupIds.some((lookupId) => idSet.has(lookupId))) {
      return false;
    }

    if (typeSet && !typeSet.has(record.recordType)) {
      return false;
    }

    if (kindSet && (!record.kind || !kindSet.has(record.kind))) {
      return false;
    }

    if (streamSet && (!record.stream || !streamSet.has(record.stream))) {
      return false;
    }

    if (experimentSlug && record.experimentSlug !== experimentSlug) {
      return false;
    }

    if (date && record.date !== date) {
      return false;
    }

    if (from && compareDateStrings(record.date ?? record.occurredAt, from) < 0) {
      return false;
    }

    if (to && compareDateStrings(record.date ?? record.occurredAt, to) > 0) {
      return false;
    }

    if (tagSet && !record.tags.some((tag) => tagSet.has(tag))) {
      return false;
    }

    if (!normalizedText) {
      return true;
    }

    const haystacks = [
      record.id,
      ...record.lookupIds,
      record.kind,
      record.stream,
      record.experimentSlug,
      record.title,
      record.body,
      JSON.stringify(record.data),
    ]
      .filter(Boolean)
      .join("\n")
      .toLowerCase();

    return haystacks.includes(normalizedText);
  });
}

/**
 * @param {VaultReadModel} vault
 * @param {{ slug?: string; tags?: string[]; text?: string }} [filters]
 * @returns {VaultRecord[]}
 */
export function listExperiments(vault, filters = {}) {
  const { slug, tags, text } = filters;
  const tagSet = tags ? new Set(tags) : null;
  const normalizedText = text ? text.toLowerCase() : null;

  return vault.experiments.filter((record) => {
    if (slug && record.experimentSlug !== slug) {
      return false;
    }

    if (tagSet && !record.tags.some((tag) => tagSet.has(tag))) {
      return false;
    }

    if (!normalizedText) {
      return true;
    }

    const haystack = [record.title, record.body, JSON.stringify(record.frontmatter)]
      .filter(Boolean)
      .join("\n")
      .toLowerCase();

    return haystack.includes(normalizedText);
  });
}

/**
 * @param {VaultReadModel} vault
 * @param {string} slug
 * @returns {VaultRecord | null}
 */
export function getExperiment(vault, slug) {
  return vault.experiments.find((record) => record.experimentSlug === slug) ?? null;
}

/**
 * @param {VaultReadModel} vault
 * @param {{ from?: string; to?: string; experimentSlug?: string; tags?: string[]; text?: string }} [filters]
 * @returns {VaultRecord[]}
 */
export function listJournalEntries(vault, filters = {}) {
  const { from, to, experimentSlug, tags, text } = filters;
  const tagSet = tags ? new Set(tags) : null;
  const normalizedText = text ? text.toLowerCase() : null;

  return vault.journalEntries.filter((record) => {
    if (from && compareDateStrings(record.date, from) < 0) {
      return false;
    }

    if (to && compareDateStrings(record.date, to) > 0) {
      return false;
    }

    if (experimentSlug && record.experimentSlug !== experimentSlug) {
      return false;
    }

    if (tagSet && !record.tags.some((tag) => tagSet.has(tag))) {
      return false;
    }

    if (!normalizedText) {
      return true;
    }

    const haystack = [record.title, record.body, JSON.stringify(record.frontmatter)]
      .filter(Boolean)
      .join("\n")
      .toLowerCase();

    return haystack.includes(normalizedText);
  });
}

/**
 * @param {VaultReadModel} vault
 * @param {string} date
 * @returns {VaultRecord | null}
 */
export function getJournalEntry(vault, date) {
  return vault.journalEntries.find((record) => record.date === date) ?? null;
}

async function readOptionalJson(filePath) {
  try {
    const contents = await readFile(filePath, "utf8");
    return /** @type {Record<string, unknown>} */ (JSON.parse(contents));
  } catch (error) {
    if (isMissingFileError(error)) {
      return null;
    }

    throw error;
  }
}

async function readOptionalCoreDocument(vaultRoot, metadata) {
  const filePath = path.join(vaultRoot, "CORE.md");

  try {
    const source = await readFile(filePath, "utf8");
    const document = parseMarkdownDocument(source);
    const attributes = normalizeFrontmatterAttributes("core", document.attributes);
    const title = pickString(attributes, ["title"]) ?? extractMarkdownHeading(document.body);
    const id = pickString(attributes, ["vaultId", "vault_id", "id"]) ?? pickString(metadata, ["vaultId", "vault_id"]) ?? "core";

    return {
      id,
      lookupIds: uniqueStrings([id]),
      recordType: "core",
      sourcePath: "CORE.md",
      sourceFile: filePath,
      occurredAt: pickString(attributes, ["updatedAt", "updated_at"]),
      date: null,
      kind: "core_document",
      stream: null,
      experimentSlug: null,
      title,
      tags: normalizeTags(document.attributes.tags),
      data: {
        ...(metadata ?? {}),
        ...attributes,
      },
      body: document.body,
      frontmatter: attributes,
    };
  } catch (error) {
    if (isMissingFileError(error)) {
      return null;
    }

    throw error;
  }
}

async function readExperimentPages(vaultRoot) {
  const experimentDir = path.join(vaultRoot, "bank/experiments");
  const fileEntries = await listDirectoryFiles(experimentDir);

  const pages = await Promise.all(
    fileEntries
      .filter((entry) => entry.endsWith(".md"))
      .map(async (entry) => {
        const filePath = path.join(experimentDir, entry);
        const source = await readFile(filePath, "utf8");
        const document = parseMarkdownDocument(source);
        const attributes = normalizeFrontmatterAttributes("experiment", document.attributes);
        const slug = pickString(attributes, ["slug"]) ?? path.basename(entry, ".md");
        const title = pickString(attributes, ["title"]) ?? extractMarkdownHeading(document.body) ?? slug;
        const startedOn = pickString(attributes, ["startedOn", "started_on"]);
        const id = pickString(attributes, ["experimentId", "id"]) ?? `experiment:${slug}`;

        return {
          id,
          lookupIds: uniqueStrings([id, slug]),
          recordType: "experiment",
          sourcePath: path.posix.join("bank/experiments", entry),
          sourceFile: filePath,
          occurredAt: pickString(attributes, ["updatedAt", "updated_at"]) ?? startedOn,
          date: normalizeDate(startedOn),
          kind: "experiment",
          stream: null,
          experimentSlug: slug,
          title,
          tags: normalizeTags(attributes.tags),
          data: {
            ...attributes,
          },
          body: document.body,
          frontmatter: attributes,
        };
      }),
  );

  return pages.sort(compareRecords);
}

async function readJournalPages(vaultRoot) {
  const journalDir = path.join(vaultRoot, "journal");
  const yearEntries = await listDirectoryFiles(journalDir);
  /** @type {VaultRecord[]} */
  const pages = [];

  for (const yearEntry of yearEntries) {
    const yearDir = path.join(journalDir, yearEntry);
    const dayEntries = await listDirectoryFiles(yearDir);

    for (const dayEntry of dayEntries) {
      if (!dayEntry.endsWith(".md")) {
        continue;
      }

      const filePath = path.join(yearDir, dayEntry);
      const source = await readFile(filePath, "utf8");
      const document = parseMarkdownDocument(source);
      const attributes = normalizeFrontmatterAttributes("journal", document.attributes);
      const date = pickString(attributes, ["dayKey", "date"]) ?? path.basename(dayEntry, ".md");
      const title = pickString(attributes, ["title"]) ?? extractMarkdownHeading(document.body) ?? date;
      const id = pickString(attributes, ["id"]) ?? `journal:${date}`;

      pages.push({
        id,
        lookupIds: uniqueStrings([id, date]),
        recordType: "journal",
        sourcePath: path.posix.join("journal", yearEntry, dayEntry),
        sourceFile: filePath,
        occurredAt: pickString(attributes, ["updatedAt", "updated_at"]),
        date,
        kind: "journal_day",
        stream: null,
        experimentSlug: pickString(attributes, ["experimentSlug", "experiment_slug"]),
        title,
        tags: normalizeTags(attributes.tags),
        data: {
          ...attributes,
        },
        body: document.body,
        frontmatter: attributes,
      });
    }
  }

  return pages.sort(compareRecords);
}

async function readJsonlRecordFamily(vaultRoot, relativeDir, recordType) {
  const targetDir = path.join(vaultRoot, relativeDir);
  const filePaths = await walkFiles(targetDir);
  /** @type {VaultRecord[]} */
  const records = [];

  for (const filePath of filePaths.filter((entry) => entry.endsWith(".jsonl"))) {
    const sourcePath = toPosixRelative(vaultRoot, filePath);
    const contents = await readFile(filePath, "utf8");
    const lines = contents.split("\n");

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index].trim();
      if (!line) {
        continue;
      }

      const payload = normalizeJsonRecordPayload(
        recordType,
        /** @type {Record<string, unknown>} */ (JSON.parse(line)),
      );
      const rawRecordId = pickString(payload, ["id"]) ?? `${recordType}:${sourcePath}:${index + 1}`;
      const occurredAt =
        pickString(payload, ["occurredAt", "recordedAt", "occurred_at", "recorded_at", "timestamp"]);
      const kind =
        pickString(payload, ["kind"]) ??
        (recordType === "audit" ? "audit" : recordType);
      const recordId = deriveQueryableRecordId(recordType, payload, rawRecordId);
      const lookupIds = uniqueStrings([
        recordId,
        rawRecordId,
        ...normalizeStringArray(payload.relatedIds),
        ...normalizeStringArray(payload.eventIds),
      ]);

      records.push({
        id: recordId,
        lookupIds,
        recordType,
        sourcePath,
        sourceFile: filePath,
        occurredAt,
        date: normalizeDate(occurredAt) ?? pickString(payload, ["dayKey", "day_key"]),
        kind,
        stream: null,
        experimentSlug: pickString(payload, ["experimentSlug", "experiment_slug"]),
        title: pickString(payload, ["title", "summary"]),
        tags: normalizeTags(payload.tags),
        data: normalizeRecordData(payload, {
          recordType,
          recordId,
          rawRecordId,
        }),
        body: pickString(payload, ["note", "summary"]),
        frontmatter: null,
      });
    }
  }

  return records.sort(compareRecords);
}

async function readSampleRecords(vaultRoot) {
  const sampleDir = path.join(vaultRoot, "ledger/samples");
  const filePaths = await walkFiles(sampleDir);
  /** @type {VaultRecord[]} */
  const records = [];

  for (const filePath of filePaths.filter((entry) => entry.endsWith(".jsonl"))) {
    const sourcePath = toPosixRelative(vaultRoot, filePath);
    const streamFromPath = inferSampleStreamFromPath(sourcePath);
    const contents = await readFile(filePath, "utf8");
    const lines = contents.split("\n");

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index].trim();
      if (!line) {
        continue;
      }

      const payload = normalizeJsonRecordPayload(
        "sample",
        /** @type {Record<string, unknown>} */ (JSON.parse(line)),
      );
      const rawRecordId = pickString(payload, ["id"]) ?? `sample:${sourcePath}:${index + 1}`;
      const occurredAt =
        pickString(payload, ["recordedAt", "occurredAt", "recorded_at", "occurred_at", "timestamp"]);
      const stream = pickString(payload, ["stream"]) ?? streamFromPath;

      records.push({
        id: rawRecordId,
        lookupIds: uniqueStrings([rawRecordId]),
        recordType: "sample",
        sourcePath,
        sourceFile: filePath,
        occurredAt,
        date: normalizeDate(occurredAt) ?? pickString(payload, ["dayKey", "day_key"]),
        kind: "sample",
        stream,
        experimentSlug: pickString(payload, ["experimentSlug", "experiment_slug"]),
        title: stream ? `${stream} sample` : "sample",
        tags: normalizeTags(payload.tags),
        data: payload,
        body: null,
        frontmatter: null,
      });
    }
  }

  return records.sort(compareRecords);
}

async function listDirectoryFiles(directoryPath) {
  try {
    const entries = await readdir(directoryPath, { withFileTypes: true });
    return entries.map((entry) => entry.name).sort();
  } catch (error) {
    if (isMissingFileError(error)) {
      return [];
    }

    throw error;
  }
}

async function walkFiles(directoryPath) {
  try {
    const entries = await readdir(directoryPath, { withFileTypes: true });
    /** @type {string[]} */
    const files = [];

    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const entryPath = path.join(directoryPath, entry.name);

      if (entry.isDirectory()) {
        files.push(...(await walkFiles(entryPath)));
        continue;
      }

      if (entry.isFile()) {
        files.push(entryPath);
      }
    }

    return files;
  } catch (error) {
    if (isMissingFileError(error)) {
      return [];
    }

    throw error;
  }
}

function compareRecords(left, right) {
  const leftSortKey = left.occurredAt ?? left.date ?? left.id;
  const rightSortKey = right.occurredAt ?? right.date ?? right.id;

  if (leftSortKey < rightSortKey) {
    return -1;
  }

  if (leftSortKey > rightSortKey) {
    return 1;
  }

  return left.id.localeCompare(right.id);
}

function compareDateStrings(value, boundary) {
  if (!value) {
    return -1;
  }

  const normalizedValue = value.length > 10 ? value.slice(0, 10) : value;
  const normalizedBoundary = boundary.length > 10 ? boundary.slice(0, 10) : boundary;

  if (normalizedValue < normalizedBoundary) {
    return -1;
  }

  if (normalizedValue > normalizedBoundary) {
    return 1;
  }

  return 0;
}

function isMissingFileError(error) {
  return Boolean(error) && typeof error === "object" && "code" in error && error.code === "ENOENT";
}

function extractMarkdownHeading(body) {
  const match = /^#\s+(.+)$/m.exec(body);
  return match ? match[1].trim() : null;
}

function normalizeDate(value) {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  return value.length >= 10 ? value.slice(0, 10) : value;
}

function normalizeTags(value) {
  return normalizeStringArray(value);
}

function pickString(object, keys) {
  if (!object || typeof object !== "object") {
    return null;
  }

  for (const key of keys) {
    const value = object[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function inferSampleStreamFromPath(sourcePath) {
  const segments = sourcePath.split("/");
  const sampleIndex = segments.indexOf("samples");

  if (sampleIndex === -1) {
    return null;
  }

  return segments[sampleIndex + 1] ?? null;
}

function normalizeFrontmatterAttributes(recordType, attributes) {
  const normalized =
    attributes && typeof attributes === "object" ? { ...attributes } : {};

  switch (recordType) {
    case "core":
      assignCanonicalString(normalized, attributes, "vaultId", ["vaultId", "vault_id", "id"]);
      assignCanonicalString(normalized, attributes, "updatedAt", ["updatedAt", "updated_at"]);
      normalized.tags = normalizeStringArray(normalized.tags);
      return normalized;
    case "experiment":
      assignCanonicalString(normalized, attributes, "experimentId", ["experimentId", "experiment_id", "id"]);
      assignCanonicalString(normalized, attributes, "slug", ["slug", "experimentSlug", "experiment_slug"]);
      assignCanonicalString(normalized, attributes, "startedOn", ["startedOn", "started_on"]);
      assignCanonicalString(normalized, attributes, "updatedAt", ["updatedAt", "updated_at"]);
      normalized.tags = normalizeStringArray(normalized.tags);
      return normalized;
    case "journal":
      assignCanonicalString(normalized, attributes, "dayKey", ["dayKey", "day_key", "date"]);
      assignCanonicalString(
        normalized,
        attributes,
        "experimentSlug",
        ["experimentSlug", "experiment_slug"],
      );
      assignCanonicalString(normalized, attributes, "updatedAt", ["updatedAt", "updated_at"]);
      assignCanonicalArray(normalized, attributes, "eventIds", ["eventIds", "event_ids"]);
      assignCanonicalArray(normalized, attributes, "sampleStreams", ["sampleStreams", "sample_streams"]);
      normalized.tags = normalizeStringArray(normalized.tags);
      return normalized;
    default:
      return normalized;
  }
}

function normalizeJsonRecordPayload(recordType, payload) {
  const normalized =
    payload && typeof payload === "object" ? { ...payload } : {};

  assignCanonicalString(normalized, payload, "id", ["id"]);
  assignCanonicalString(normalized, payload, "kind", ["kind"]);
  assignCanonicalString(normalized, payload, "stream", ["stream"]);
  assignCanonicalString(normalized, payload, "source", ["source"]);
  assignCanonicalString(normalized, payload, "title", ["title"]);
  assignCanonicalString(normalized, payload, "summary", ["summary"]);
  assignCanonicalString(normalized, payload, "note", ["note"]);
  assignCanonicalString(normalized, payload, "occurredAt", ["occurredAt", "occurred_at"]);
  assignCanonicalString(normalized, payload, "recordedAt", ["recordedAt", "recorded_at", "timestamp"]);
  assignCanonicalString(normalized, payload, "dayKey", ["dayKey", "day_key"]);
  assignCanonicalString(normalized, payload, "experimentId", ["experimentId", "experiment_id"]);
  assignCanonicalString(normalized, payload, "experimentSlug", ["experimentSlug", "experiment_slug"]);
  assignCanonicalString(normalized, payload, "documentId", ["documentId", "document_id"]);
  assignCanonicalString(normalized, payload, "documentPath", ["documentPath", "document_path"]);
  assignCanonicalString(normalized, payload, "mimeType", ["mimeType", "mime_type"]);
  assignCanonicalString(normalized, payload, "mealId", ["mealId", "meal_id"]);
  assignCanonicalString(normalized, payload, "transformId", ["transformId", "transform_id"]);
  assignCanonicalArray(normalized, payload, "tags", ["tags"]);
  assignCanonicalArray(normalized, payload, "relatedIds", ["relatedIds", "related_ids"]);
  assignCanonicalArray(normalized, payload, "rawRefs", ["rawRefs", "raw_refs"]);
  assignCanonicalArray(normalized, payload, "eventIds", ["eventIds", "event_ids"]);
  assignCanonicalArray(normalized, payload, "photoPaths", ["photoPaths", "photo_paths"]);
  assignCanonicalArray(normalized, payload, "audioPaths", ["audioPaths", "audio_paths"]);

  if (recordType === "sample") {
    assignCanonicalString(normalized, payload, "quality", ["quality"]);
    assignCanonicalString(normalized, payload, "unit", ["unit"]);
  }

  return normalized;
}

function deriveQueryableRecordId(recordType, payload, fallbackId) {
  if (recordType !== "event") {
    return fallbackId;
  }

  const kind = pickString(payload, ["kind"]);

  if (kind === "document") {
    return pickString(payload, ["documentId", "document_id"]) ?? fallbackId;
  }

  if (kind === "meal") {
    return pickString(payload, ["mealId", "meal_id"]) ?? fallbackId;
  }

  return fallbackId;
}

function normalizeRecordData(payload, { recordType, recordId, rawRecordId }) {
  const data =
    payload && typeof payload === "object" ? { ...payload } : {};

  if (recordType === "event" && recordId !== rawRecordId) {
    data.entityId = recordId;
    data.eventIds = uniqueStrings([...normalizeStringArray(data.eventIds), rawRecordId]);
    data.relatedIds = uniqueStrings(normalizeStringArray(data.relatedIds)).filter(
      (relatedId) => relatedId !== recordId,
    );
  }

  return data;
}

function assignCanonicalString(target, source, key, aliases) {
  const value = pickString(source, aliases);
  if (value) {
    target[key] = value;
  }
}

function assignCanonicalArray(target, source, key, aliases) {
  const value = pickFirstArray(source, aliases);
  if (value) {
    target[key] = normalizeStringArray(value);
  }
}

function pickFirstArray(object, keys) {
  if (!object || typeof object !== "object") {
    return null;
  }

  for (const key of keys) {
    const value = object[key];
    if (Array.isArray(value)) {
      return value;
    }
  }

  return null;
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return uniqueStrings(
    value
      .filter((entry) => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
}

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim()))];
}

function toPosixRelative(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join(path.posix.sep);
}
