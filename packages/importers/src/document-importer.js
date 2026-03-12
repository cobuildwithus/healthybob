import { assertCanonicalWritePort } from "./core-port.js";
import {
  assertPlainObject,
  inspectFileAsset,
  normalizeOptionalString,
  normalizeTimestamp,
  stripUndefined,
} from "./shared.js";

export async function prepareDocumentImport(input) {
  const request = assertPlainObject(input, "document import input");
  const rawArtifact = await inspectFileAsset(request.filePath);

  return stripUndefined({
    vaultRoot: normalizeOptionalString(request.vaultRoot ?? request.vault, "vaultRoot"),
    sourcePath: rawArtifact.sourcePath,
    title: normalizeOptionalString(request.title, "title") ?? rawArtifact.fileName,
    occurredAt: normalizeTimestamp(request.occurredAt, "occurredAt"),
    note: normalizeOptionalString(request.note, "note"),
    source: normalizeOptionalString(request.source, "source"),
  });
}

export async function importDocument(input, { corePort } = {}) {
  const writer = assertCanonicalWritePort(corePort, ["importDocument"]);
  const payload = await prepareDocumentImport(input);
  return writer.importDocument(payload);
}
