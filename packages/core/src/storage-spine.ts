import { createHash } from "node:crypto";
import path from "node:path";
import { promises as fs } from "node:fs";

import { importAssessmentResponse as importAssessmentResponseStorage } from "./assessment/storage.js";
import { writeImmutableJsonFileIntoVaultRaw } from "./fs.js";
import { addMeal as addMealMutation, importDocument as importDocumentMutation, importSamples as importSamplesMutation } from "./mutations.js";
import { resolveVaultPath } from "./path-safety.js";

import type { RawArtifact } from "./raw.js";

const RAW_IMPORT_MANIFEST_SCHEMA_VERSION = "hb.raw-import-manifest.v1";

type ImportDocumentInput = Parameters<typeof importDocumentMutation>[0];
type ImportDocumentResult = Awaited<ReturnType<typeof importDocumentMutation>>;
type AddMealInput = Parameters<typeof addMealMutation>[0];
type AddMealResult = Awaited<ReturnType<typeof addMealMutation>>;
type BaseImportSamplesInput = Parameters<typeof importSamplesMutation>[0];
type ImportSamplesResult = Awaited<ReturnType<typeof importSamplesMutation>>;
type ImportAssessmentResponseInput = Parameters<typeof importAssessmentResponseStorage>[0];
type ImportAssessmentResponseResult = Awaited<ReturnType<typeof importAssessmentResponseStorage>>;

interface SampleImportRowProvenance {
  rowNumber: number;
  recordedAt: string;
  value: number;
  rawRecordedAt: string;
  rawValue: string;
  metadata?: Record<string, string>;
}

interface SampleImportBatchProvenance {
  sourceFileName?: string;
  importConfig?: {
    presetId?: string;
    delimiter: string;
    tsColumn: string;
    valueColumn: string;
    metadataColumns?: string[];
  };
  rows?: SampleImportRowProvenance[];
}

interface ImportSamplesInput extends BaseImportSamplesInput {
  batchProvenance?: SampleImportBatchProvenance;
}

interface RawManifestArtifact {
  role: string;
  relativePath: string;
  originalFileName: string;
  mediaType: string;
  byteSize: number;
  sha256: string;
}

interface RawImportManifest {
  schemaVersion: typeof RAW_IMPORT_MANIFEST_SCHEMA_VERSION;
  importId: string;
  importKind: "assessment" | "document" | "meal" | "sample_batch";
  importedAt: string;
  source: string | null;
  rawDirectory: string;
  artifacts: RawManifestArtifact[];
  provenance: Record<string, unknown>;
}

interface BuildRawImportManifestInput {
  importId: string;
  importKind: RawImportManifest["importKind"];
  importedAt: string;
  source: string | null;
  artifacts: RawManifestArtifact[];
  rawArtifacts: readonly RawArtifact[];
  provenance: Record<string, unknown>;
}

async function describeRawArtifact(
  vaultRoot: string,
  artifact: RawArtifact,
  role: string,
): Promise<RawManifestArtifact> {
  const resolved = resolveVaultPath(vaultRoot, artifact.relativePath);
  const content = await fs.readFile(resolved.absolutePath);

  return {
    role,
    relativePath: artifact.relativePath,
    originalFileName: artifact.originalFileName,
    mediaType: artifact.mediaType,
    byteSize: content.byteLength,
    sha256: createHash("sha256").update(content).digest("hex"),
  };
}

function resolveRawArtifactDirectory(artifacts: readonly RawArtifact[]): string {
  if (artifacts.length === 0) {
    throw new TypeError("raw import manifest requires at least one raw artifact");
  }

  const [firstDirectory, ...remainingDirectories] = artifacts.map((artifact) =>
    path.posix.dirname(artifact.relativePath),
  );

  if (!firstDirectory) {
    throw new TypeError("raw import manifest requires a stable raw directory");
  }

  for (const directory of remainingDirectories) {
    if (directory !== firstDirectory) {
      throw new TypeError("raw import manifest artifacts must share a single raw directory");
    }
  }

  return firstDirectory;
}

function resolveManifestPath(artifacts: readonly RawArtifact[]): string {
  return path.posix.join(resolveRawArtifactDirectory(artifacts), "manifest.json");
}

function buildRawImportManifest({
  importId,
  importKind,
  importedAt,
  source,
  artifacts,
  rawArtifacts,
  provenance,
}: BuildRawImportManifestInput): RawImportManifest {
  return {
    schemaVersion: RAW_IMPORT_MANIFEST_SCHEMA_VERSION,
    importId,
    importKind,
    importedAt,
    source,
    rawDirectory: resolveRawArtifactDirectory(rawArtifacts),
    artifacts,
    provenance,
  };
}

async function writeRawImportManifest(
  vaultRoot: string,
  manifest: RawImportManifest,
  artifacts: readonly RawArtifact[],
): Promise<string> {
  return writeImmutableJsonFileIntoVaultRaw(vaultRoot, resolveManifestPath(artifacts), manifest, {
    allowExistingMatch: true,
  });
}

export async function importDocument(
  input: ImportDocumentInput,
): Promise<ImportDocumentResult & { manifestPath: string }> {
  const result = await importDocumentMutation(input);
  const importedAt = result.event.recordedAt ?? result.event.occurredAt;
  const rawArtifacts = [result.raw];
  const artifacts = [await describeRawArtifact(input.vaultRoot, result.raw, "source_document")];
  const manifestPath = await writeRawImportManifest(
    input.vaultRoot,
    buildRawImportManifest({
      importId: result.documentId,
      importKind: "document",
      importedAt,
      source: result.event.source ?? input.source ?? null,
      artifacts,
      rawArtifacts,
      provenance: {
        eventId: result.event.id,
        lookupId: result.event.id,
        occurredAt: result.event.occurredAt,
        title: result.event.title ?? null,
        note: result.event.note ?? null,
      },
    }),
    rawArtifacts,
  );

  return {
    ...result,
    manifestPath,
  };
}

export async function addMeal(
  input: AddMealInput,
): Promise<AddMealResult & { manifestPath: string }> {
  const result = await addMealMutation(input);
  const rawArtifacts = [result.photo, ...(result.audio ? [result.audio] : [])];
  const artifacts = await Promise.all(
    rawArtifacts.map((artifact) =>
      describeRawArtifact(input.vaultRoot, artifact, artifact === result.photo ? "photo" : "audio"),
    ),
  );
  const manifestPath = await writeRawImportManifest(
    input.vaultRoot,
    buildRawImportManifest({
      importId: result.mealId,
      importKind: "meal",
      importedAt: result.event.recordedAt ?? result.event.occurredAt,
      source: result.event.source ?? input.source ?? null,
      artifacts,
      rawArtifacts,
      provenance: {
        eventId: result.event.id,
        lookupId: result.event.id,
        occurredAt: result.event.occurredAt,
        note: result.event.note ?? null,
      },
    }),
    rawArtifacts,
  );

  return {
    ...result,
    manifestPath,
  };
}

export const importMeal = addMeal;

export async function importSamples(
  input: ImportSamplesInput,
): Promise<ImportSamplesResult & { manifestPath: string }> {
  const result = await importSamplesMutation(input);
  const rawArtifacts = result.raw ? [result.raw] : [];
  const artifacts = result.raw
    ? [await describeRawArtifact(input.vaultRoot, result.raw, "source_csv")]
    : [];
  const rowProvenance = input.batchProvenance?.rows ?? [];
  const manifestPath =
    result.raw && artifacts.length > 0
      ? await writeRawImportManifest(
          input.vaultRoot,
          buildRawImportManifest({
            importId: result.transformId,
            importKind: "sample_batch",
            importedAt: result.records[0]?.recordedAt ?? new Date().toISOString(),
            source: input.source ?? null,
            artifacts,
            rawArtifacts,
            provenance: {
              stream: input.stream,
              unit: input.unit,
              importedCount: result.count,
              sampleIds: result.records.map((record) => record.id),
              ledgerFiles: result.shardPaths,
              sourceFileName: input.batchProvenance?.sourceFileName ?? result.raw.originalFileName,
              importConfig: input.batchProvenance?.importConfig ?? null,
              rowCount: rowProvenance.length,
              rows: rowProvenance,
            },
          }),
          rawArtifacts,
        )
      : "";

  return {
    ...result,
    manifestPath,
  };
}

export async function importAssessmentResponse(
  input: ImportAssessmentResponseInput,
): Promise<ImportAssessmentResponseResult & { manifestPath: string }> {
  const result = await importAssessmentResponseStorage(input);
  const rawArtifacts = [result.raw];
  const artifacts = [await describeRawArtifact(input.vaultRoot, result.raw, "source_assessment")];
  const manifestPath = await writeRawImportManifest(
    input.vaultRoot,
    buildRawImportManifest({
      importId: result.assessment.id,
      importKind: "assessment",
      importedAt: result.assessment.recordedAt,
      source: result.assessment.source ?? input.source ?? null,
      artifacts,
      rawArtifacts,
      provenance: {
        assessmentType: result.assessment.assessmentType,
        title: result.assessment.title ?? null,
        questionnaireSlug: result.assessment.questionnaireSlug ?? null,
        relatedIds: result.assessment.relatedIds ?? [],
        lookupId: result.assessment.id,
        ledgerFile: result.ledgerPath,
      },
    }),
    rawArtifacts,
  );

  return {
    ...result,
    manifestPath,
  };
}
