import { basename } from "node:path";

import {
  assertPlainObject,
  inspectFileAsset,
  normalizeOptionalString,
  normalizeTimestamp,
  stripUndefined,
} from "../shared.js";

import { assertAssessmentImportPort } from "./core-port.js";

import type { AssessmentResponseImportPayload } from "./core-port.js";

export interface AssessmentImporterExecutionOptions {
  corePort?: unknown;
}

export interface AssessmentResponseImportInput {
  filePath: string;
  vaultRoot?: string;
  vault?: string;
  title?: string;
  occurredAt?: string | number | Date;
  importedAt?: string | number | Date;
  source?: string;
}

export async function prepareAssessmentResponseImport(
  input: unknown,
): Promise<AssessmentResponseImportPayload> {
  const request = assertPlainObject(input, "assessment response import input");
  const rawArtifact = await inspectFileAsset(request.filePath, "assessment");

  return stripUndefined({
    vaultRoot: normalizeOptionalString(request.vaultRoot ?? request.vault, "vaultRoot"),
    sourcePath: rawArtifact.sourcePath,
    title: normalizeOptionalString(request.title, "title") ?? basename(rawArtifact.sourcePath),
    occurredAt: normalizeTimestamp(request.occurredAt, "occurredAt"),
    importedAt: normalizeTimestamp(request.importedAt, "importedAt"),
    source: normalizeOptionalString(request.source, "source"),
  });
}

export async function importAssessmentResponse<TResult = unknown>(
  input: unknown,
  { corePort }: AssessmentImporterExecutionOptions = {},
): Promise<TResult> {
  const writer = assertAssessmentImportPort(corePort);
  const payload = await prepareAssessmentResponseImport(input);
  return (await writer.importAssessmentResponse(payload)) as TResult;
}
