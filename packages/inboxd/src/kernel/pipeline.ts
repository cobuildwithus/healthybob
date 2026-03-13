import type { PersistedCapture } from "../contracts/capture.js";
import type { InboundCapture } from "../contracts/capture.js";
import type { InboxRuntimeStore } from "./sqlite.js";
import {
  appendImportAudit,
  appendInboxCaptureEvent,
  ensureInboxVault,
  persistRawCapture,
} from "../indexing/persist.js";
import { generatePrefixedId } from "../shared.js";

export interface PipelineContext {
  vaultRoot: string;
  runtime: InboxRuntimeStore;
  ids: {
    capture(): string;
    event(): string;
    audit(): string;
  };
}

export interface InboxPipeline {
  readonly runtime: InboxRuntimeStore;
  processCapture(input: InboundCapture): Promise<PersistedCapture>;
  close(): void;
}

export interface CreateInboxPipelineInput {
  vaultRoot: string;
  runtime: InboxRuntimeStore;
  ids?: PipelineContext["ids"];
}

export async function createInboxPipeline({
  vaultRoot,
  runtime,
  ids = defaultIds(),
}: CreateInboxPipelineInput): Promise<InboxPipeline> {
  await ensureInboxVault(vaultRoot);
  const context: PipelineContext = { vaultRoot, runtime, ids };

  return {
    runtime,
    processCapture(input) {
      return processCapture(input, context);
    },
    close() {
      runtime.close();
    },
  };
}

export async function processCapture(
  input: InboundCapture,
  context: PipelineContext,
): Promise<PersistedCapture> {
  const dedupe = context.runtime.findByExternalId(input.source, input.accountId, input.externalId);

  if (dedupe) {
    return dedupe;
  }

  const captureId = context.ids.capture();
  const eventId = context.ids.event();
  const auditId = context.ids.audit();

  const stored = await persistRawCapture({
    vaultRoot: context.vaultRoot,
    captureId,
    eventId,
    input,
  });
  const event = await appendInboxCaptureEvent({
    vaultRoot: context.vaultRoot,
    eventId,
    occurredAt: input.occurredAt,
    inbound: input,
    stored,
  });
  await appendImportAudit({
    vaultRoot: context.vaultRoot,
    auditId,
    eventId,
    inbound: input,
    stored,
    eventPath: event.relativePath,
  });
  context.runtime.upsertCaptureIndex({
    captureId,
    eventId,
    input,
    stored,
  });
  context.runtime.enqueueDerivedJobs({
    captureId,
    stored,
  });

  return {
    captureId,
    eventId,
    auditId,
    envelopePath: stored.envelopePath,
    createdAt: stored.storedAt,
    deduped: false,
  };
}

function defaultIds(): PipelineContext["ids"] {
  return {
    capture: () => generatePrefixedId("cap"),
    event: () => generatePrefixedId("evt"),
    audit: () => generatePrefixedId("aud"),
  };
}
