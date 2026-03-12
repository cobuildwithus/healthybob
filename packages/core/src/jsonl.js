import { VaultError } from "./errors.js";
import { appendVaultTextFile, readUtf8File } from "./fs.js";
import { normalizeRelativeVaultPath } from "./path-safety.js";
import { toIsoTimestamp } from "./time.js";

export function toMonthlyShardRelativePath(baseDirectory, value, fieldName = "date") {
  const basePath = normalizeRelativeVaultPath(baseDirectory);
  const timestamp = toIsoTimestamp(value, fieldName);
  const year = timestamp.slice(0, 4);
  const monthShard = timestamp.slice(0, 7);
  return `${basePath}/${year}/${monthShard}.jsonl`;
}

export async function appendJsonlRecord({ vaultRoot, relativePath, record }) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw new VaultError("VAULT_INVALID_RECORD", "JSONL records must be plain objects.", {
      relativePath,
    });
  }

  const normalizedRelativePath = normalizeRelativeVaultPath(relativePath);
  const line = `${JSON.stringify(record)}\n`;
  await appendVaultTextFile(vaultRoot, normalizedRelativePath, line);
  return record;
}

export async function readJsonlRecords({ vaultRoot, relativePath }) {
  const normalizedRelativePath = normalizeRelativeVaultPath(relativePath);
  const content = await readUtf8File(vaultRoot, normalizedRelativePath);
  const lines = content.split("\n").filter(Boolean);

  return lines.map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new VaultError("VAULT_INVALID_JSONL", `Invalid JSON on line ${index + 1}.`, {
        relativePath: normalizedRelativePath,
        lineNumber: index + 1,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  });
}
