import {
  AUDIT_ACTORS,
  AUDIT_SCHEMA_VERSION,
  AUDIT_STATUSES,
  FILE_CHANGE_OPERATIONS,
  ID_PREFIXES,
  VAULT_LAYOUT,
} from "./constants.js";
import { generateRecordId } from "./ids.js";
import { appendJsonlRecord, toMonthlyShardRelativePath } from "./jsonl.js";
import { normalizeRelativeVaultPath } from "./path-safety.js";
import { toIsoTimestamp } from "./time.js";

function normalizeActor(actor) {
  return AUDIT_ACTORS.includes(actor) ? actor : "core";
}

function normalizeStatus(status) {
  return AUDIT_STATUSES.includes(status) ? status : "success";
}

function normalizeOperation(op) {
  return FILE_CHANGE_OPERATIONS.includes(op) ? op : "update";
}

export async function emitAuditRecord({
  vaultRoot,
  action,
  actor = "core",
  status = "success",
  occurredAt = new Date(),
  commandName,
  summary,
  files = [],
  targetIds = [],
  errorCode,
  transformId,
  changes,
}) {
  const occurredTimestamp = toIsoTimestamp(occurredAt, "occurredAt");
  const normalizedChanges = Array.isArray(changes)
    ? changes
        .map((change) => {
          if (!change || typeof change !== "object") {
            return null;
          }

          if (typeof change.path !== "string" || !change.path.trim()) {
            return null;
          }

          return {
            path: normalizeRelativeVaultPath(change.path),
            op: normalizeOperation(change.op),
          };
        })
        .filter(Boolean)
    : [...new Set(files.map((file) => normalizeRelativeVaultPath(file)))].sort().map((path) => ({
        path,
        op: "update",
      }));

  const record = {
    schemaVersion: AUDIT_SCHEMA_VERSION,
    id: generateRecordId(ID_PREFIXES.audit),
    action,
    status: normalizeStatus(status),
    occurredAt: occurredTimestamp,
    actor: normalizeActor(actor),
    commandName: String(commandName ?? action),
    summary: String(summary ?? action),
    targetIds: Array.isArray(targetIds) && targetIds.length > 0 ? [...targetIds] : undefined,
    errorCode: errorCode || undefined,
    transformId: transformId || undefined,
    changes: normalizedChanges,
  };

  const relativePath = toMonthlyShardRelativePath(
    VAULT_LAYOUT.auditDirectory,
    occurredTimestamp,
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
