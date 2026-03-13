import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

export type FrontmatterScalar = string | number | boolean | null;
export type FrontmatterValue =
  | FrontmatterScalar
  | FrontmatterObject
  | FrontmatterValue[];

export interface FrontmatterObject {
  [key: string]: FrontmatterValue;
}

export interface FrontmatterDocument {
  attributes: FrontmatterObject;
  body: string;
}

export interface MarkdownDocumentRecord {
  relativePath: string;
  markdown: string;
  body: string;
  attributes: FrontmatterObject;
}

interface MeaningfulLine {
  index: number;
  line: string;
  indent: number;
  text: string;
}

interface ParseResult<TValue> {
  value: TValue;
  index: number;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function countIndentation(line: string): number {
  const match = line.match(/^ */u);
  return match ? match[0].length : 0;
}

function parseScalar(value: string): FrontmatterValue {
  if (value === "null") {
    return null;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  if (value === "[]") {
    return [];
  }

  if (value === "{}") {
    return {};
  }

  if (/^-?\d+(\.\d+)?$/u.test(value)) {
    return Number(value);
  }

  if (value.startsWith('"')) {
    return JSON.parse(value) as string;
  }

  return value;
}

function nextMeaningfulLine(
  lines: string[],
  startIndex: number,
): MeaningfulLine | null {
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index];

    if (!line?.trim()) {
      continue;
    }

    return {
      index,
      line,
      indent: countIndentation(line),
      text: line.trimStart(),
    };
  }

  return null;
}

function parseArray(
  lines: string[],
  startIndex: number,
  indent: number,
): ParseResult<FrontmatterValue[]> {
  const value: FrontmatterValue[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index] ?? "";

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const currentIndent = countIndentation(line);
    if (currentIndent < indent) {
      break;
    }

    if (currentIndent !== indent) {
      throw new Error(`Unexpected array indentation at line ${index + 1}.`);
    }

    const trimmed = line.slice(indent);
    if (!trimmed.startsWith("-")) {
      break;
    }

    const remainder = trimmed.slice(1).trimStart();
    if (remainder) {
      value.push(parseScalar(remainder));
      index += 1;
      continue;
    }

    index += 1;

    const nested = nextMeaningfulLine(lines, index);
    if (!nested || nested.indent <= indent) {
      value.push({});
      continue;
    }

    if (nested.indent !== indent + 2) {
      throw new Error(`Unexpected nested array indentation at line ${nested.index + 1}.`);
    }

    if (nested.text.startsWith("-")) {
      const result = parseArray(lines, nested.index, nested.indent);
      value.push(result.value);
      index = result.index;
      continue;
    }

    const result = parseObject(lines, nested.index, nested.indent);
    value.push(result.value);
    index = result.index;
  }

  return { value, index };
}

function parseObject(
  lines: string[],
  startIndex: number,
  indent: number,
): ParseResult<FrontmatterObject> {
  const value: FrontmatterObject = {};
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index] ?? "";

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const currentIndent = countIndentation(line);
    if (currentIndent < indent) {
      break;
    }

    if (currentIndent !== indent) {
      throw new Error(`Unexpected object indentation at line ${index + 1}.`);
    }

    const trimmed = line.slice(indent);
    if (trimmed.startsWith("-")) {
      break;
    }

    const separatorIndex = trimmed.indexOf(":");
    if (separatorIndex <= 0) {
      throw new Error(`Expected "key: value" frontmatter at line ${index + 1}.`);
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const remainder = trimmed.slice(separatorIndex + 1).trim();

    if (remainder) {
      value[key] = parseScalar(remainder);
      index += 1;
      continue;
    }

    index += 1;

    const nested = nextMeaningfulLine(lines, index);
    if (!nested || nested.indent <= indent) {
      value[key] = {};
      continue;
    }

    if (nested.indent !== indent + 2) {
      throw new Error(`Unexpected nested object indentation at line ${nested.index + 1}.`);
    }

    if (nested.text.startsWith("-")) {
      const result = parseArray(lines, nested.index, nested.indent);
      value[key] = result.value;
      index = result.index;
      continue;
    }

    const result = parseObject(lines, nested.index, nested.indent);
    value[key] = result.value;
    index = result.index;
  }

  return { value, index };
}

export function parseFrontmatterDocument(
  documentText: string,
): FrontmatterDocument {
  const normalized = String(documentText ?? "").replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");

  if (lines[0] !== "---") {
    return {
      attributes: {},
      body: normalized.trim(),
    };
  }

  const closingIndex = lines.indexOf("---", 1);
  if (closingIndex === -1) {
    throw new Error("Frontmatter block is missing a closing delimiter.");
  }

  const frontmatterLines = lines.slice(1, closingIndex);
  const body = lines.slice(closingIndex + 1).join("\n").trim();

  if (frontmatterLines.every((line) => !line.trim())) {
    return {
      attributes: {},
      body,
    };
  }

  const parsed = parseObject(frontmatterLines, 0, 0);
  const trailing = nextMeaningfulLine(frontmatterLines, parsed.index);

  if (trailing) {
    throw new Error(`Unexpected trailing frontmatter content at line ${trailing.index + 1}.`);
  }

  return {
    attributes: parsed.value,
    body,
  };
}

export async function walkRelativeFiles(
  vaultRoot: string,
  relativeRoot: string,
  extension: string,
): Promise<string[]> {
  const basePath = path.join(vaultRoot, relativeRoot);
  let entries;

  try {
    entries = await readdir(basePath, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const files: string[] = [];

  for (const entry of entries) {
    const relativePath = path.posix.join(relativeRoot, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walkRelativeFiles(vaultRoot, relativePath, extension)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(extension)) {
      files.push(relativePath);
    }
  }

  files.sort((left, right) => left.localeCompare(right));
  return files;
}

export async function readMarkdownDocument(
  vaultRoot: string,
  relativePath: string,
): Promise<MarkdownDocumentRecord> {
  const markdown = await readFile(path.join(vaultRoot, relativePath), "utf8");
  const parsed = parseFrontmatterDocument(markdown);

  return {
    relativePath,
    markdown,
    body: parsed.body,
    attributes: parsed.attributes,
  };
}

export async function readJsonlRecords(
  vaultRoot: string,
  relativeRoot: string,
): Promise<Array<{ relativePath: string; value: unknown }>> {
  const shardPaths = await walkRelativeFiles(vaultRoot, relativeRoot, ".jsonl");
  const records: Array<{ relativePath: string; value: unknown }> = [];

  for (const relativePath of shardPaths) {
    const raw = await readFile(path.join(vaultRoot, relativePath), "utf8");
    const lines = raw
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean);

    for (const line of lines) {
      records.push({
        relativePath,
        value: JSON.parse(line) as unknown,
      });
    }
  }

  return records;
}

export function asObject(value: unknown): Record<string, unknown> | null {
  return isPlainObject(value) ? value : null;
}

export function firstString(
  source: Record<string, unknown>,
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    const value = source[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

export function firstNumber(
  source: Record<string, unknown>,
  keys: readonly string[],
): number | null {
  for (const key of keys) {
    const value = source[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

export function firstBoolean(
  source: Record<string, unknown>,
  keys: readonly string[],
): boolean | null {
  for (const key of keys) {
    const value = source[key];

    if (typeof value === "boolean") {
      return value;
    }
  }

  return null;
}

export function firstObject(
  source: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> | null {
  for (const key of keys) {
    const value = source[key];

    if (isPlainObject(value)) {
      return value;
    }
  }

  return null;
}

export function firstStringArray(
  source: Record<string, unknown>,
  keys: readonly string[],
): string[] {
  for (const key of keys) {
    const value = source[key];

    if (!Array.isArray(value)) {
      continue;
    }

    return value
      .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      .map((entry) => entry.trim());
  }

  return [];
}

export function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    .map((entry) => entry.trim());
}

export function compareNullableStrings(
  left: string | null | undefined,
  right: string | null | undefined,
): number {
  const normalizedLeft = left ?? "";
  const normalizedRight = right ?? "";
  return normalizedLeft.localeCompare(normalizedRight);
}

export function matchesText(
  values: unknown[],
  text: string | undefined,
): boolean {
  if (!text?.trim()) {
    return true;
  }

  const haystack = values
    .map((value) => (typeof value === "string" ? value : JSON.stringify(value)))
    .filter((value): value is string => Boolean(value))
    .join("\n")
    .toLowerCase();

  return haystack.includes(text.trim().toLowerCase());
}

export function matchesStatus(
  value: string | null | undefined,
  status: string | string[] | undefined,
): boolean {
  if (status === undefined) {
    return true;
  }

  const candidates = Array.isArray(status) ? status : [status];
  const normalized = candidates
    .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    .map((entry) => entry.trim().toLowerCase());

  if (normalized.length === 0) {
    return true;
  }

  return value ? normalized.includes(value.toLowerCase()) : false;
}

export function matchesDateRange(
  value: string | null | undefined,
  from?: string,
  to?: string,
): boolean {
  if (!value) {
    return !from && !to;
  }

  if (from && value < from) {
    return false;
  }

  if (to && value > to) {
    return false;
  }

  return true;
}

export function applyLimit<TValue>(
  values: TValue[],
  limit?: number,
): TValue[] {
  if (!Number.isInteger(limit) || (limit as number) < 1) {
    return values;
  }

  return values.slice(0, limit);
}

export function matchesLookup(
  lookup: string,
  ...candidates: Array<string | null | undefined>
): boolean {
  const normalized = lookup.trim().toLowerCase();

  return candidates.some(
    (candidate) => typeof candidate === "string" && candidate.trim().toLowerCase() === normalized,
  );
}

export function pathSlug(relativePath: string): string {
  return path.posix.basename(relativePath, path.posix.extname(relativePath));
}

export function maybeString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
