import path from "node:path";
import { constants as fsConstants } from "node:fs";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";

import {
  assertContract,
  auditRecordSchema,
  eventRecordSchema,
  type AuditRecord,
  type EventRecord,
} from "@healthybob/contracts";
import {
  appendJsonlRecord,
  loadVault,
  toMonthlyShardRelativePath,
  VAULT_LAYOUT,
} from "@healthybob/core";

import type { InboundCapture, StoredAttachment, StoredCapture } from "../contracts/capture.js";
import {
  ensureParentDirectory,
  normalizeAccountKey,
  normalizeRelativePath,
  redactSensitivePaths,
  resolveVaultPath,
  sanitizeFileName,
  sanitizeSegment,
  sha256File,
  walkFiles,
} from "../shared.js";
import type { InboxRuntimeStore } from "../kernel/sqlite.js";

export interface PersistRawCaptureInput {
  vaultRoot: string;
  captureId: string;
  eventId: string;
  input: InboundCapture;
  storedAt?: string;
}

interface StoredCaptureEnvelope {
  schema: "healthybob.inbox-envelope.v1";
  captureId: string;
  eventId: string;
  storedAt: string;
  input: InboundCapture;
  stored: StoredCapture;
}

export async function ensureInboxVault(vaultRoot: string): Promise<void> {
  await loadVault({ vaultRoot });
}

export async function persistRawCapture({
  vaultRoot,
  captureId,
  eventId,
  input,
  storedAt = new Date().toISOString(),
}: PersistRawCaptureInput): Promise<StoredCapture> {
  const accountSegment = sanitizeSegment(normalizeAccountKey(input.accountId) || "default", "default");
  const sourceSegment = sanitizeSegment(input.source, "source");
  const year = input.occurredAt.slice(0, 4);
  const month = input.occurredAt.slice(5, 7);
  const sourceDirectory = normalizeRelativePath(
    path.posix.join(
      VAULT_LAYOUT.rawDirectory,
      "inbox",
      sourceSegment,
      accountSegment,
      year,
      month,
      captureId,
    ),
  );
  const attachmentDirectory = path.posix.join(sourceDirectory, "attachments");
  const storedAttachments: StoredAttachment[] = [];

  for (const [index, attachment] of input.attachments.entries()) {
    const ordinal = index + 1;

    if (!attachment.originalPath) {
      storedAttachments.push({
        ...attachment,
        ordinal,
        storedPath: null,
        sha256: null,
      });
      continue;
    }

    const safeName = sanitizeFileName(attachment.fileName ?? attachment.originalPath, `attachment-${ordinal}`);
    const relativePath = normalizeRelativePath(
      path.posix.join(
        attachmentDirectory,
        `${String(ordinal).padStart(2, "0")}__${safeName}`,
      ),
    );
    const absolutePath = resolveVaultPath(vaultRoot, relativePath);
    await ensureParentDirectory(absolutePath);
    await copyFile(path.resolve(attachment.originalPath), absolutePath, fsConstants.COPYFILE_EXCL);
    const fileStats = await stat(absolutePath);

    storedAttachments.push({
      ...attachment,
      ordinal,
      storedPath: relativePath,
      fileName: attachment.fileName ?? safeName,
      byteSize: attachment.byteSize ?? fileStats.size,
      sha256: await sha256File(absolutePath),
      originalPath: null,
    });
  }

  const envelopePath = normalizeRelativePath(path.posix.join(sourceDirectory, "envelope.json"));
  const absoluteEnvelopePath = resolveVaultPath(vaultRoot, envelopePath);
  await ensureParentDirectory(absoluteEnvelopePath);

  const storedCapture: StoredCapture = {
    captureId,
    eventId,
    storedAt,
    sourceDirectory,
    envelopePath,
    attachments: storedAttachments,
  };

  const sanitizedInput: InboundCapture = {
    ...input,
    accountId: input.accountId ?? null,
    attachments: input.attachments.map((attachment) => ({
      ...attachment,
      originalPath: null,
    })),
    raw: redactSensitivePaths(input.raw) as Record<string, unknown>,
  };

  await writeFile(
    absoluteEnvelopePath,
    `${JSON.stringify(
      {
        schema: "healthybob.inbox-envelope.v1",
        captureId,
        eventId,
        storedAt,
        input: sanitizedInput,
        stored: storedCapture,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  return storedCapture;
}

export async function appendInboxCaptureEvent(input: {
  vaultRoot: string;
  eventId: string;
  occurredAt: string;
  inbound: InboundCapture;
  stored: StoredCapture;
}): Promise<{ relativePath: string; record: EventRecord }> {
  const relativePath = toMonthlyShardRelativePath(
    VAULT_LAYOUT.eventLedgerDirectory,
    input.occurredAt,
    "occurredAt",
  );
  const record = assertContract<EventRecord>(eventRecordSchema, {
    schemaVersion: "hb.event.v1",
    id: input.eventId,
    occurredAt: input.inbound.occurredAt,
    recordedAt: input.stored.storedAt,
    dayKey: input.inbound.occurredAt.slice(0, 10),
    source: "import",
    kind: "note",
    title: `Inbox capture from ${input.inbound.source}`,
    note: buildEventNote(input.inbound),
    tags: ["inbox", `source-${sanitizeSegment(input.inbound.source, "source")}`],
    rawRefs: [
      input.stored.envelopePath,
      ...input.stored.attachments
        .map((attachment) => attachment.storedPath)
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    ],
  }, "inbox capture event");

  await appendJsonlRecord({
    vaultRoot: input.vaultRoot,
    relativePath,
    record,
  });

  return { relativePath, record };
}

export async function appendImportAudit(input: {
  vaultRoot: string;
  auditId: string;
  eventId: string;
  inbound: InboundCapture;
  stored: StoredCapture;
  eventPath: string;
}): Promise<{ relativePath: string; record: AuditRecord }> {
  const relativePath = toMonthlyShardRelativePath(
    VAULT_LAYOUT.auditDirectory,
    input.stored.storedAt,
    "occurredAt",
  );

  const record = assertContract<AuditRecord>(auditRecordSchema, {
    schemaVersion: "hb.audit.v1",
    id: input.auditId,
    action: "intake_import",
    status: "success",
    occurredAt: input.stored.storedAt,
    actor: "importer",
    commandName: `inboxd.processCapture:${sanitizeSegment(input.inbound.source, "source")}`,
    summary: `Imported inbox capture from ${input.inbound.source}.`,
    targetIds: [input.eventId],
    changes: [
      { path: input.stored.envelopePath, op: "create" },
      ...input.stored.attachments
        .map((attachment) => attachment.storedPath)
        .filter((value): value is string => typeof value === "string" && value.length > 0)
        .map((storedPath) => ({ path: storedPath, op: "copy" as const })),
      { path: input.eventPath, op: "append" },
      { path: relativePath, op: "append" },
    ],
  }, "inbox capture audit");

  await appendJsonlRecord({
    vaultRoot: input.vaultRoot,
    relativePath,
    record,
  });

  return { relativePath, record };
}

export async function rebuildRuntimeFromVault(input: {
  vaultRoot: string;
  runtime: InboxRuntimeStore;
}): Promise<void> {
  const inboxRoot = resolveVaultPath(input.vaultRoot, `${VAULT_LAYOUT.rawDirectory}/inbox`);

  try {
    await mkdir(inboxRoot, { recursive: true });
  } catch {
    return;
  }

  const files = await walkFiles(inboxRoot);
  const envelopeFiles = files.filter((filePath) => filePath.endsWith("envelope.json")).sort();

  for (const envelopePath of envelopeFiles) {
    const parsed = JSON.parse(await readFile(envelopePath, "utf8")) as StoredCaptureEnvelope;
    input.runtime.upsertCaptureIndex({
      captureId: parsed.captureId,
      eventId: parsed.eventId,
      input: parsed.input,
      stored: parsed.stored,
    });
    input.runtime.enqueueDerivedJobs({
      captureId: parsed.captureId,
      stored: parsed.stored,
    });
  }
}

function buildEventNote(capture: InboundCapture): string {
  const text = capture.text?.trim();
  if (text) {
    return text.length > 4000 ? `${text.slice(0, 3997)}...` : text;
  }

  const attachmentCount = capture.attachments.length;
  if (attachmentCount > 0) {
    return `Attachment-only inbox capture from ${capture.source} (${attachmentCount} attachment${attachmentCount === 1 ? "" : "s"}).`;
  }

  return `Inbox capture from ${capture.source}.`;
}
