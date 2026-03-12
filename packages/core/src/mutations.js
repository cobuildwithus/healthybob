import {
  eventRecordSchema,
  experimentFrontmatterSchema,
  journalDayFrontmatterSchema,
  sampleRecordSchema,
} from "../../contracts/src/schemas.js";
import { validateAgainstSchema } from "../../contracts/src/validate.js";
import {
  BASELINE_EVENT_KINDS,
  BASELINE_SAMPLE_STREAMS,
  EVENT_SCHEMA_VERSION,
  EVENT_SOURCES,
  EXPERIMENT_STATUSES,
  FRONTMATTER_SCHEMA_VERSIONS,
  ID_PREFIXES,
  SAMPLE_QUALITIES,
  SAMPLE_SCHEMA_VERSION,
  SAMPLE_SOURCES,
  VAULT_LAYOUT,
} from "./constants.js";
import { emitAuditRecord } from "./audit.js";
import { writeVaultTextFile } from "./fs.js";
import { stringifyFrontmatterDocument } from "./frontmatter.js";
import { appendJsonlRecord, toMonthlyShardRelativePath } from "./jsonl.js";
import { generateRecordId } from "./ids.js";
import { VaultError } from "./errors.js";
import { sanitizePathSegment } from "./path-safety.js";
import { copyRawArtifact } from "./raw.js";
import { loadVault } from "./vault.js";
import { toDateOnly, toIsoTimestamp } from "./time.js";

const EVENT_KIND_SET = new Set(BASELINE_EVENT_KINDS);
const EVENT_SOURCE_SET = new Set(EVENT_SOURCES);
const SAMPLE_STREAM_SET = new Set(BASELINE_SAMPLE_STREAMS);
const SAMPLE_SOURCE_SET = new Set(SAMPLE_SOURCES);
const SAMPLE_QUALITY_SET = new Set(SAMPLE_QUALITIES);
const EXPERIMENT_STATUS_SET = new Set(EXPERIMENT_STATUSES);

function compactRecord(record) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => {
      if (value === undefined || value === null) {
        return false;
      }

      if (Array.isArray(value)) {
        return value.length > 0;
      }

      if (typeof value === "object") {
        return Object.keys(value).length > 0;
      }

      return true;
    }),
  );
}

function assertPlainObject(value, code, message) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new VaultError(code, message);
  }

  return value;
}

function assertContractShape(schema, value, code, message) {
  const errors = validateAgainstSchema(schema, value);

  if (errors.length > 0) {
    throw new VaultError(code, message, { errors });
  }
}

function normalizeSource(value, allowed, fallback) {
  return allowed.has(value) ? value : fallback;
}

function normalizeStringList(value) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const entries = value
    .filter((entry) => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return entries.length > 0 ? entries : undefined;
}

function normalizeNumericUnit(stream, unit) {
  const normalized = String(unit ?? "").trim();

  const aliases = {
    glucose: {
      "mg/dl": "mg_dL",
      "mg_dl": "mg_dL",
      mg_dL: "mg_dL",
    },
    heart_rate: {
      bpm: "bpm",
    },
    hrv: {
      ms: "ms",
    },
    steps: {
      count: "count",
    },
    respiratory_rate: {
      breaths_per_minute: "breaths_per_minute",
      "breaths/minute": "breaths_per_minute",
    },
    temperature: {
      celsius: "celsius",
      c: "celsius",
    },
    sleep_stage: {
      stage: "stage",
    },
  };

  const candidate = aliases[stream]?.[normalized] ?? aliases[stream]?.[normalized.toLowerCase()];

  if (!candidate) {
    throw new VaultError("VAULT_INVALID_SAMPLE_UNIT", `Unsupported unit "${normalized}" for stream "${stream}".`, {
      stream,
      unit,
    });
  }

  return candidate;
}

function buildEventRecord({
  kind,
  occurredAt,
  recordedAt = new Date(),
  source,
  title,
  note,
  tags,
  relatedIds,
  rawRefs,
  fields = {},
}) {
  if (!EVENT_KIND_SET.has(kind)) {
    throw new VaultError("VAULT_UNSUPPORTED_EVENT_KIND", `Unsupported baseline event kind "${kind}".`, {
      kind,
    });
  }

  assertPlainObject(fields, "VAULT_INVALID_EVENT_FIELDS", "Event fields must be a plain object.");

  const occurredTimestamp = toIsoTimestamp(occurredAt, "occurredAt");
  const recordedTimestamp = toIsoTimestamp(recordedAt, "recordedAt");
  const record = compactRecord({
    schemaVersion: EVENT_SCHEMA_VERSION,
    id: generateRecordId(ID_PREFIXES.event),
    kind,
    occurredAt: occurredTimestamp,
    recordedAt: recordedTimestamp,
    dayKey: toDateOnly(occurredTimestamp),
    source: normalizeSource(source, EVENT_SOURCE_SET, "manual"),
    title: String(title ?? kind).trim(),
    note: typeof note === "string" && note.trim() ? note.trim() : undefined,
    tags: normalizeStringList(tags),
    relatedIds: normalizeStringList(relatedIds),
    rawRefs: normalizeStringList(rawRefs),
    ...fields,
  });

  assertContractShape(
    eventRecordSchema,
    record,
    "HB_EVENT_INVALID",
    "Event record failed contract validation before write.",
  );

  return record;
}

async function appendEventRecord({ vaultRoot, ...input }) {
  const record = buildEventRecord(input);
  const relativePath = toMonthlyShardRelativePath(
    VAULT_LAYOUT.eventLedgerDirectory,
    record.occurredAt,
    "occurredAt",
  );

  await appendJsonlRecord({
    vaultRoot,
    relativePath,
    record,
  });

  return {
    relativePath,
    record,
  };
}

function buildSampleRecord({
  stream,
  recordedAt,
  source,
  quality,
  transformId,
  sample,
  unit,
}) {
  const recordedTimestamp = toIsoTimestamp(sample.recordedAt ?? recordedAt, "recordedAt");
  const baseRecord = {
    schemaVersion: SAMPLE_SCHEMA_VERSION,
    id: generateRecordId(ID_PREFIXES.sample),
    stream,
    recordedAt: recordedTimestamp,
    dayKey: toDateOnly(recordedTimestamp),
    source: normalizeSource(source, SAMPLE_SOURCE_SET, "import"),
    quality: SAMPLE_QUALITY_SET.has(quality) ? quality : "raw",
    transformId,
  };

  if (stream === "sleep_stage") {
    const record = compactRecord({
      ...baseRecord,
      stage: String(sample.stage ?? "").trim(),
      startAt: toIsoTimestamp(sample.startAt, "startAt"),
      endAt: toIsoTimestamp(sample.endAt, "endAt"),
      durationMinutes: Number(sample.durationMinutes),
      unit: normalizeNumericUnit(stream, unit),
    });

    assertContractShape(
      sampleRecordSchema,
      record,
      "HB_SAMPLE_INVALID",
      "Sample record failed contract validation before write.",
    );

    return record;
  }

  if (typeof sample.value !== "number" || !Number.isFinite(sample.value)) {
    throw new VaultError("VAULT_INVALID_SAMPLE", "Sample value must be a finite number.", {
      stream,
      sample,
    });
  }

  const record = compactRecord({
    ...baseRecord,
    value: sample.value,
    unit: normalizeNumericUnit(stream, unit),
  });

  assertContractShape(
    sampleRecordSchema,
    record,
    "HB_SAMPLE_INVALID",
    "Sample record failed contract validation before write.",
  );

  return record;
}

export async function ensureJournalDay({
  vaultRoot,
  date,
} = {}) {
  await loadVault({ vaultRoot });
  const day = toDateOnly(date, "date");
  const [year] = day.split("-");
  const relativePath = `${VAULT_LAYOUT.journalDirectory}/${year}/${day}.md`;
  const attributes = {
    schemaVersion: FRONTMATTER_SCHEMA_VERSIONS.journalDay,
    docType: "journal_day",
    dayKey: day,
    eventIds: [],
    sampleStreams: [],
  };

  assertContractShape(
    journalDayFrontmatterSchema,
    attributes,
    "HB_FRONTMATTER_INVALID",
    "Journal frontmatter failed contract validation before write.",
  );

  try {
    await writeVaultTextFile(
      vaultRoot,
      relativePath,
      stringifyFrontmatterDocument({
        attributes,
        body: `# ${day}\n\n## Summary\n\n`,
      }),
      { overwrite: false },
    );
  } catch (error) {
    if (error instanceof VaultError && error.code === "VAULT_FILE_EXISTS") {
      return {
        created: false,
        relativePath,
      };
    }

    throw error;
  }

  const audit = await emitAuditRecord({
    vaultRoot,
    action: "journal_ensure",
    commandName: "core.ensureJournalDay",
    summary: `Ensured journal page for ${day}.`,
    occurredAt: `${day}T00:00:00.000Z`,
    files: [relativePath],
  });

  return {
    created: true,
    relativePath,
    auditPath: audit.relativePath,
  };
}

export async function createExperiment({
  vaultRoot,
  slug,
  title,
  hypothesis,
  startedOn = new Date(),
  status = "active",
} = {}) {
  await loadVault({ vaultRoot });
  const safeSlug = sanitizePathSegment(slug, "experiment");
  const startedTimestamp = toIsoTimestamp(startedOn, "startedOn");
  const startedDay = toDateOnly(startedOn, "startedOn");
  const experimentId = generateRecordId(ID_PREFIXES.experiment);
  const relativePath = `${VAULT_LAYOUT.experimentsDirectory}/${safeSlug}.md`;
  const normalizedTitle = String(title ?? safeSlug).trim();
  const attributes = compactRecord({
    schemaVersion: FRONTMATTER_SCHEMA_VERSIONS.experiment,
    docType: "experiment",
    experimentId,
    slug: safeSlug,
    status: EXPERIMENT_STATUS_SET.has(status) ? status : "active",
    title: normalizedTitle,
    startedOn: startedDay,
    hypothesis: typeof hypothesis === "string" && hypothesis.trim() ? hypothesis.trim() : undefined,
  });

  assertContractShape(
    experimentFrontmatterSchema,
    attributes,
    "HB_FRONTMATTER_INVALID",
    "Experiment frontmatter failed contract validation before write.",
  );

  await writeVaultTextFile(
    vaultRoot,
    relativePath,
    stringifyFrontmatterDocument({
      attributes,
      body: `# ${normalizedTitle}\n\n## Plan\n\n## Notes\n\n`,
    }),
    { overwrite: false },
  );

  const event = await appendEventRecord({
    vaultRoot,
    kind: "experiment_event",
    occurredAt: startedTimestamp,
    source: "manual",
    title: normalizedTitle,
    relatedIds: [experimentId],
    fields: {
      experimentId,
      experimentSlug: safeSlug,
      phase: "start",
    },
  });

  const audit = await emitAuditRecord({
    vaultRoot,
    action: "experiment_create",
    commandName: "core.createExperiment",
    summary: `Created experiment ${safeSlug}.`,
    occurredAt: startedTimestamp,
    files: [relativePath, event.relativePath],
    targetIds: [experimentId, event.record.id],
  });

  return {
    experiment: {
      id: experimentId,
      slug: safeSlug,
      relativePath,
    },
    event: event.record,
    auditPath: audit.relativePath,
  };
}

export async function importDocument({
  vaultRoot,
  sourcePath,
  occurredAt = new Date(),
  title,
  note,
  source = "import",
} = {}) {
  await loadVault({ vaultRoot });
  const documentId = generateRecordId(ID_PREFIXES.document);
  const raw = await copyRawArtifact({
    vaultRoot,
    sourcePath,
    category: "documents",
    occurredAt,
    recordId: documentId,
  });
  const event = await appendEventRecord({
    vaultRoot,
    kind: "document",
    occurredAt,
    source,
    title: String(title ?? raw.originalFileName).trim(),
    note,
    relatedIds: [documentId],
    rawRefs: [raw.relativePath],
    fields: {
      documentId,
      documentPath: raw.relativePath,
      mimeType: raw.mediaType,
    },
  });
  const audit = await emitAuditRecord({
    vaultRoot,
    action: "document_import",
    commandName: "core.importDocument",
    summary: `Imported document ${raw.originalFileName}.`,
    occurredAt,
    files: [raw.relativePath, event.relativePath],
    targetIds: [documentId, event.record.id],
  });

  return {
    documentId,
    raw,
    event: event.record,
    eventPath: event.relativePath,
    auditPath: audit.relativePath,
  };
}

export async function addMeal({
  vaultRoot,
  occurredAt = new Date(),
  note,
  photoPath,
  audioPath,
  source = "manual",
} = {}) {
  await loadVault({ vaultRoot });

  if (!photoPath) {
    throw new VaultError("VAULT_MEAL_PHOTO_REQUIRED", "Meal imports require a photoPath.");
  }

  const mealId = generateRecordId(ID_PREFIXES.meal);
  const photo = await copyRawArtifact({
    vaultRoot,
    sourcePath: photoPath,
    category: "meal-photo",
    occurredAt,
    recordId: mealId,
    slot: "photo",
  });
  const audio = audioPath
    ? await copyRawArtifact({
        vaultRoot,
        sourcePath: audioPath,
        category: "meal-audio",
        occurredAt,
        recordId: mealId,
        slot: "audio",
      })
    : null;
  const event = await appendEventRecord({
    vaultRoot,
    kind: "meal",
    occurredAt,
    source,
    title: "Meal",
    note,
    relatedIds: [mealId],
    rawRefs: [photo.relativePath, audio?.relativePath].filter(Boolean),
    fields: {
      mealId,
      photoPaths: [photo.relativePath],
      audioPaths: audio ? [audio.relativePath] : [],
    },
  });
  const touchedFiles = [photo.relativePath, audio?.relativePath, event.relativePath].filter(Boolean);
  const audit = await emitAuditRecord({
    vaultRoot,
    action: "meal_add",
    commandName: "core.addMeal",
    summary: `Added meal ${mealId}.`,
    occurredAt,
    files: touchedFiles,
    targetIds: [mealId, event.record.id],
  });

  return {
    mealId,
    event: event.record,
    eventPath: event.relativePath,
    photo,
    audio,
    auditPath: audit.relativePath,
  };
}

export async function importSamples({
  vaultRoot,
  stream,
  unit,
  samples,
  sourcePath,
  source = "import",
  quality = "raw",
} = {}) {
  await loadVault({ vaultRoot });

  if (!SAMPLE_STREAM_SET.has(stream)) {
    throw new VaultError("VAULT_UNSUPPORTED_SAMPLE_STREAM", `Unsupported baseline sample stream "${stream}".`, {
      stream,
    });
  }

  if (!Array.isArray(samples) || samples.length === 0) {
    throw new VaultError("VAULT_INVALID_SAMPLES", "importSamples requires a non-empty samples array.");
  }

  const transformId = generateRecordId(ID_PREFIXES.transform);
  const raw = sourcePath
    ? await copyRawArtifact({
        vaultRoot,
        sourcePath,
        category: "samples",
        occurredAt: samples[0]?.recordedAt ?? new Date(),
        recordId: transformId,
        stream,
      })
    : null;

  const touchedFiles = raw ? [raw.relativePath] : [];
  const records = [];
  const shardPaths = new Set();

  for (const sample of samples) {
    assertPlainObject(sample, "VAULT_INVALID_SAMPLE", "Each sample must be a plain object.");
    const record = buildSampleRecord({
      stream,
      recordedAt: sample.recordedAt ?? sample.occurredAt,
      source,
      quality,
      transformId,
      sample,
      unit,
    });
    const relativePath = toMonthlyShardRelativePath(
      `${VAULT_LAYOUT.sampleLedgerDirectory}/${stream}`,
      record.recordedAt,
      "recordedAt",
    );

    await appendJsonlRecord({
      vaultRoot,
      relativePath,
      record,
    });

    shardPaths.add(relativePath);
    records.push(record);
  }

  const sortedShardPaths = [...shardPaths].sort();
  touchedFiles.push(...sortedShardPaths);

  const audit = await emitAuditRecord({
    vaultRoot,
    action: "samples_import_csv",
    commandName: "core.importSamples",
    summary: `Imported ${records.length} ${stream} sample record(s).`,
    occurredAt: records[0].recordedAt,
    files: touchedFiles,
    targetIds: records.map((record) => record.id),
    transformId,
  });

  return {
    count: records.length,
    records,
    shardPaths: sortedShardPaths,
    raw,
    transformId,
    auditPath: audit.relativePath,
  };
}
