import { assertCanonicalWritePort } from "./core-port.js";
import { resolveSampleImportConfig } from "./preset-registry.js";
import {
  assertPlainObject,
  inspectFileAsset,
  normalizeNumber,
  normalizeOptionalString,
  normalizeRequiredString,
  normalizeTimestamp,
  readUtf8File,
  stripUndefined,
} from "./shared.js";

export async function prepareCsvSampleImport(input, { presetRegistry } = {}) {
  const request = assertPlainObject(input, "sample import input");
  const config = resolveSampleImportConfig(request, presetRegistry);
  const stream = normalizeRequiredString(config.stream, "stream");
  const tsColumn = normalizeRequiredString(config.tsColumn, "tsColumn");
  const valueColumn = normalizeRequiredString(config.valueColumn, "valueColumn");
  const unit = normalizeRequiredString(config.unit, "unit");
  const delimiter = normalizeRequiredString(config.delimiter, "delimiter");
  const rawArtifact = await inspectFileAsset(request.filePath);
  const csvText = await readUtf8File(rawArtifact.sourcePath);
  const rows = parseDelimitedRows(csvText, delimiter);

  if (rows.length < 2) {
    throw new Error("sample CSV must include a header row and at least one data row");
  }

  const header = rows[0].map((cell) => cell.trim());
  const columnIndex = new Map(header.map((name, index) => [name, index]));
  const metadataColumns = config.metadataColumns ?? [];
  const tsIndex = requireColumn(columnIndex, tsColumn);
  const valueIndex = requireColumn(columnIndex, valueColumn);

  for (const column of metadataColumns) {
    requireColumn(columnIndex, column);
  }

  const samples = [];

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index];

    if (row.every((cell) => cell.trim() === "")) {
      continue;
    }

    const sourceRow = index + 1;
    samples.push({
      recordedAt: normalizeTimestamp(row[tsIndex], `row ${sourceRow} ${tsColumn}`),
      value: normalizeNumber(row[valueIndex], `row ${sourceRow} ${valueColumn}`),
    });
  }

  if (samples.length === 0) {
    throw new Error("sample CSV did not contain any importable sample rows");
  }

  return stripUndefined({
    vaultRoot: normalizeOptionalString(request.vaultRoot ?? request.vault, "vaultRoot"),
    stream,
    unit,
    source: config.source,
    sourcePath: rawArtifact.sourcePath,
    importConfig: {
      presetId: config.presetId,
      delimiter,
      tsColumn,
      valueColumn,
      metadataColumns: metadataColumns.length === 0 ? undefined : metadataColumns,
    },
    samples,
  });
}

export async function importCsvSamples(input, { corePort, presetRegistry } = {}) {
  const writer = assertCanonicalWritePort(corePort, ["importSamples"]);
  const payload = await prepareCsvSampleImport(input, { presetRegistry });
  return writer.importSamples(payload);
}

function requireColumn(columnIndex, columnName) {
  const index = columnIndex.get(columnName);

  if (index === undefined) {
    throw new Error(`sample CSV is missing required column "${columnName}"`);
  }

  return index;
}

export function parseDelimitedRows(text, delimiter = ",") {
  const normalizedDelimiter = normalizeRequiredString(delimiter, "delimiter");

  if (normalizedDelimiter.length !== 1) {
    throw new TypeError("delimiter must be a single character");
  }

  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (inQuotes) {
      if (character === "\"") {
        if (text[index + 1] === "\"") {
          field += "\"";
          index += 1;
          continue;
        }

        inQuotes = false;
        continue;
      }

      field += character;
      continue;
    }

    if (character === "\"") {
      inQuotes = true;
      continue;
    }

    if (character === normalizedDelimiter) {
      row.push(field);
      field = "";
      continue;
    }

    if (character === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    if (character === "\r") {
      continue;
    }

    field += character;
  }

  if (inQuotes) {
    throw new Error("sample CSV contains an unterminated quoted field");
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}
