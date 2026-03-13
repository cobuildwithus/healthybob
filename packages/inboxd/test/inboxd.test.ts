import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { test } from "vitest";

import { initializeVault, readJsonlRecords } from "@healthybob/core";

import {
  createInboxPipeline,
  createImessageConnector,
  openInboxRuntime,
  rebuildRuntimeFromVault,
  runPollConnector,
} from "../src/index.js";

async function makeTempDirectory(name: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), `${name}-`));
}

async function writeExternalFile(directory: string, fileName: string, content: string): Promise<string> {
  const filePath = path.join(directory, fileName);
  await fs.writeFile(filePath, content, "utf8");
  return filePath;
}

test("processCapture stores redacted raw evidence, note events, and audit records", async () => {
  const vaultRoot = await makeTempDirectory("healthybob-inbox-vault");
  const sourceRoot = await makeTempDirectory("healthybob-inbox-source");
  await initializeVault({ vaultRoot, createdAt: "2026-03-12T12:00:00.000Z" });

  const attachmentPath = await writeExternalFile(sourceRoot, "meal-photo.jpg", "photo");
  const runtime = await openInboxRuntime({ vaultRoot });
  const pipeline = await createInboxPipeline({ vaultRoot, runtime });

  const first = await pipeline.processCapture({
    source: "imessage",
    externalId: "msg-1",
    accountId: "self",
    thread: {
      id: "chat-1",
      title: "Breakfast",
      isDirect: false,
    },
    actor: {
      id: "contact-1",
      displayName: "Friend",
      isSelf: false,
    },
    occurredAt: "2026-03-13T08:00:00.000Z",
    receivedAt: "2026-03-13T08:00:05.000Z",
    text: "Eggs and toast",
    attachments: [
      {
        externalId: "att-1",
        kind: "image",
        mime: "image/jpeg",
        originalPath: attachmentPath,
        fileName: "breakfast.jpg",
      },
    ],
    raw: {
      localPath: "/Users/<REDACTED_USER>/Library/Messages/chat.db",
      nested: {
        attachmentPath: "/home/<REDACTED_USER>/Attachments/foo.jpg",
      },
    },
  });

  const duplicate = await pipeline.processCapture({
    source: "imessage",
    externalId: "msg-1",
    accountId: "self",
    thread: {
      id: "chat-1",
    },
    actor: {
      isSelf: false,
    },
    occurredAt: "2026-03-13T08:00:00.000Z",
    text: "duplicate",
    attachments: [],
    raw: {},
  });

  assert.equal(first.deduped, false);
  assert.equal(duplicate.deduped, true);
  assert.equal(duplicate.captureId, first.captureId);

  const capture = runtime.getCapture(first.captureId);
  assert.ok(capture);
  assert.equal(capture.accountId, "self");
  assert.equal(capture.text, "Eggs and toast");
  assert.equal(capture.attachments.length, 1);
  assert.equal(capture.attachments[0]?.originalPath, null);
  assert.equal(capture.attachments[0]?.storedPath?.startsWith("raw/inbox/imessage/self/"), true);
  assert.equal(capture.raw.localPath, "<REDACTED_PATH>");
  assert.deepEqual(capture.raw.nested, {
    attachmentPath: "<REDACTED_PATH>",
  });

  const envelopePath = path.join(vaultRoot, capture.envelopePath);
  const envelope = JSON.parse(await fs.readFile(envelopePath, "utf8")) as {
    eventId: string;
    input: {
      attachments: Array<{ originalPath: string | null }>;
      raw: Record<string, unknown>;
    };
    stored: {
      eventId: string;
    };
  };
  assert.equal(envelope.eventId, first.eventId);
  assert.equal(envelope.stored.eventId, first.eventId);
  assert.equal(envelope.input.attachments[0]?.originalPath, null);
  assert.equal(envelope.input.raw.localPath, "<REDACTED_PATH>");

  const eventRecords = await readJsonlRecords({
    vaultRoot,
    relativePath: "ledger/events/2026/2026-03.jsonl",
  });
  assert.equal(eventRecords.length, 1);
  assert.equal(eventRecords[0]?.kind, "note");
  assert.equal(
    Array.isArray(eventRecords[0]?.rawRefs) &&
      eventRecords[0]?.rawRefs.includes(capture.envelopePath),
    true,
  );

  const auditRecords = await readJsonlRecords({
    vaultRoot,
    relativePath: "audit/2026/2026-03.jsonl",
  });
  assert.equal(auditRecords.length, 2);
  assert.equal(auditRecords.at(-1)?.action, "intake_import");

  pipeline.close();
});

test("runtime search indexes attachment metadata and can rebuild from envelope files", async () => {
  const vaultRoot = await makeTempDirectory("healthybob-inbox-search-vault");
  const sourceRoot = await makeTempDirectory("healthybob-inbox-search-source");
  await initializeVault({ vaultRoot, createdAt: "2026-03-12T12:00:00.000Z" });

  const imagePath = await writeExternalFile(sourceRoot, "toast.jpg", "image");
  const runtime = await openInboxRuntime({ vaultRoot });
  const pipeline = await createInboxPipeline({ vaultRoot, runtime });

  const capture = await pipeline.processCapture({
    source: "imessage",
    externalId: "toast-1",
    thread: {
      id: "chat-breakfast",
    },
    actor: {
      isSelf: true,
    },
    occurredAt: "2026-03-13T09:00:00.000Z",
    text: "Toast with avocado",
    attachments: [
      {
        kind: "image",
        originalPath: imagePath,
        fileName: "toast-photo.jpg",
      },
    ],
    raw: {},
  });

  const hits = runtime.searchCaptures({
    text: "toast",
    limit: 10,
  });
  assert.equal(hits.length, 1);
  assert.equal(hits[0]?.captureId, capture.captureId);
  assert.match(hits[0]?.snippet ?? "", /Toast with avocado/);

  const rebuiltRuntime = await openInboxRuntime({ vaultRoot });
  await rebuildRuntimeFromVault({
    vaultRoot,
    runtime: rebuiltRuntime,
  });
  const rebuilt = rebuiltRuntime.getCapture(capture.captureId);
  assert.ok(rebuilt);
  assert.equal(rebuilt.text, "Toast with avocado");
  assert.equal(rebuilt.attachments[0]?.fileName, "toast-photo.jpg");

  pipeline.close();
  rebuiltRuntime.close();
});

test("runPollConnector backfills and watches iMessage messages while advancing the cursor", async () => {
  const vaultRoot = await makeTempDirectory("healthybob-inbox-daemon-vault");
  await initializeVault({ vaultRoot, createdAt: "2026-03-12T12:00:00.000Z" });

  let watcher: ((message: Record<string, unknown>) => Promise<void> | void) | null = null;
  let closeCount = 0;
  const driver = {
    async getMessages() {
      return [
        {
          guid: "im-1",
          text: "Backfill capture",
          date: "2026-03-13T08:00:00.000Z",
          isFromMe: false,
          chatGuid: "chat-1",
          handleId: "friend",
        },
      ];
    },
    async startWatching(options: {
      onMessage(message: Record<string, unknown>): Promise<void> | void;
    }) {
      watcher = options.onMessage;
      return {
        close() {
          closeCount += 1;
        },
      };
    },
  };

  const runtime = await openInboxRuntime({ vaultRoot });
  const pipeline = await createInboxPipeline({ vaultRoot, runtime });
  const connector = createImessageConnector({
    driver,
    accountId: "self",
  });
  const controller = new AbortController();
  const running = runPollConnector({
    connector,
    pipeline,
    accountId: "self",
    signal: controller.signal,
  });

  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.ok(watcher);
  await watcher?.({
    guid: "im-2",
    text: "Watch capture",
    date: "2026-03-13T08:10:00.000Z",
    isFromMe: true,
    chatGuid: "chat-1",
    handleId: "self",
  });
  controller.abort();
  await running;

  const captures = runtime.listCaptures({ limit: 10 });
  assert.equal(captures.length, 2);
  assert.equal(captures[0]?.externalId, "im-2");
  assert.deepEqual(runtime.getCursor("imessage", "self"), {
    occurredAt: "2026-03-13T08:10:00.000Z",
    externalId: "im-2",
    receivedAt: null,
  });
  assert.equal(closeCount, 1);

  pipeline.close();
});
