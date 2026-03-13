import type { PollConnector } from "../connectors/types.js";
import type { InboxPipeline } from "./pipeline.js";
import { createCaptureCheckpoint } from "../shared.js";

export interface RunPollConnectorInput {
  connector: PollConnector;
  pipeline: InboxPipeline;
  accountId?: string | null;
  signal: AbortSignal;
}

export async function runPollConnector({
  connector,
  pipeline,
  accountId = null,
  signal,
}: RunPollConnectorInput): Promise<void> {
  let cursor = pipeline.runtime.getCursor(connector.source, accountId);

  const emit = async (capture: Parameters<InboxPipeline["processCapture"]>[0]) => {
    const result = await pipeline.processCapture(capture);
    pipeline.runtime.setCursor(
      connector.source,
      accountId ?? capture.accountId ?? null,
      createCaptureCheckpoint(capture),
    );
    return result;
  };

  try {
    if (connector.capabilities.backfill) {
      cursor = await connector.backfill(cursor, emit);
      pipeline.runtime.setCursor(connector.source, accountId, cursor);
    }

    if (!signal.aborted && connector.capabilities.watch) {
      await connector.watch(cursor, emit, signal);
    }
  } finally {
    await connector.close?.();
  }
}

export async function runInboxDaemon(input: {
  pipeline: InboxPipeline;
  connectors: PollConnector[];
  signal: AbortSignal;
}): Promise<void> {
  await Promise.all(
    input.connectors.map((connector) =>
      runPollConnector({
        connector,
        pipeline: input.pipeline,
        signal: input.signal,
      }),
    ),
  );
}
