import { z } from "zod";

import { assertCanonicalWritePort } from "./core-port.js";
import type { MealImportPayload } from "./core-port.js";
import {
  inspectFileAsset,
  optionalTimestampSchema,
  optionalTrimmedStringSchema,
  parseInputObject,
  requiredTrimmedStringSchema,
  stripUndefined,
} from "./shared.js";

export interface MealImportInput {
  photoPath: string;
  audioPath?: string;
  vaultRoot?: string;
  vault?: string;
  occurredAt?: string | number | Date;
  note?: string;
  source?: string;
}

export interface ImporterExecutionOptions {
  corePort?: unknown;
}

const mealImportInputSchema = z
  .object({
    photoPath: requiredTrimmedStringSchema("photoPath"),
    audioPath: optionalTrimmedStringSchema("audioPath"),
    vaultRoot: optionalTrimmedStringSchema("vaultRoot"),
    vault: optionalTrimmedStringSchema("vault"),
    occurredAt: optionalTimestampSchema("occurredAt"),
    note: optionalTrimmedStringSchema("note"),
    source: optionalTrimmedStringSchema("source"),
  })
  .passthrough();

export async function prepareMealImport(input: unknown): Promise<MealImportPayload> {
  const request = parseInputObject(
    input,
    "meal import input",
    mealImportInputSchema,
  );
  const photo = await inspectFileAsset(request.photoPath, "photo");
  const audio = request.audioPath
    ? await inspectFileAsset(request.audioPath, "audio")
    : undefined;

  return stripUndefined({
    vaultRoot: request.vaultRoot ?? request.vault,
    photoPath: photo.sourcePath,
    audioPath: audio?.sourcePath,
    occurredAt: request.occurredAt,
    note: request.note,
    source: request.source,
  });
}

export async function importMeal<TResult = unknown>(
  input: unknown,
  { corePort }: ImporterExecutionOptions = {},
): Promise<TResult> {
  const writer = assertCanonicalWritePort(corePort, ["importMeal"]);
  const payload = await prepareMealImport(input);
  return (await writer.importMeal(payload)) as TResult;
}
