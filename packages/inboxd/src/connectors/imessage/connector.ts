import type { InboundCapture } from "../../contracts/capture.js";
import type { Cursor, EmitCapture, PollConnector } from "../types.js";
import {
  type ImessageKitChatLike,
  type ImessageKitMessageLike,
  normalizeImessageMessage,
} from "./normalize.js";
import { createCaptureCheckpoint } from "../../shared.js";

export interface ImessageGetMessagesInput {
  cursor?: Cursor | null;
  limit?: number;
  includeOwnMessages?: boolean;
}

export interface ImessageWatchOptions {
  includeOwnMessages?: boolean;
  onMessage(message: ImessageKitMessageLike): Promise<void> | void;
}

export interface ImessageWatcherHandle {
  close?(): Promise<void> | void;
  stop?(): Promise<void> | void;
}

export interface ImessagePollDriver {
  getMessages(input: ImessageGetMessagesInput): Promise<ImessageKitMessageLike[]>;
  listChats?(): Promise<ImessageKitChatLike[]>;
  startWatching(options: ImessageWatchOptions): Promise<ImessageWatcherHandle | (() => Promise<void> | void) | void>;
}

export interface ImessageConnectorOptions {
  driver: ImessagePollDriver;
  source?: string;
  accountId?: string | null;
  includeOwnMessages?: boolean;
  backfillLimit?: number;
}

export function createImessageConnector({
  driver,
  source = "imessage",
  accountId = "self",
  includeOwnMessages = true,
  backfillLimit = 500,
}: ImessageConnectorOptions): PollConnector {
  const chatsPromise = driver.listChats?.() ?? Promise.resolve([]);
  let activeWatcher: ImessageWatcherHandle | (() => Promise<void> | void) | void;

  return {
    source,
    kind: "poll",
    capabilities: {
      backfill: true,
      watch: true,
      webhooks: false,
      attachments: true,
      ownMessages: includeOwnMessages,
    },
    async backfill(cursor, emit) {
      const chats = await indexChats(await chatsPromise);
      const messages = await driver.getMessages({
        cursor,
        limit: backfillLimit,
        includeOwnMessages,
      });
      const captures = messages
        .map((message) =>
          normalizeImessageMessage({
            message,
            source,
            accountId,
            chat: resolveChat(chats, message),
          }),
        )
        .sort(compareCaptures);

      let nextCursor = cursor;

      for (const capture of captures) {
        await emit(capture);
        nextCursor = createCaptureCheckpoint(capture);
      }

      return nextCursor;
    },
    async watch(cursor, emit, signal) {
      void cursor;

      const chats = await indexChats(await chatsPromise);
      activeWatcher = await driver.startWatching({
        includeOwnMessages,
        onMessage: async (message) => {
          if (signal.aborted) {
            return;
          }

          const capture = normalizeImessageMessage({
            message,
            source,
            accountId,
            chat: resolveChat(chats, message),
          });

          await emit(capture);
        },
      });

      await waitForAbort(signal);
      await stopWatcher(activeWatcher);
      activeWatcher = undefined;
    },
    async close() {
      await stopWatcher(activeWatcher);
      activeWatcher = undefined;
    },
  };
}

export async function loadImessageKitDriver(): Promise<ImessagePollDriver> {
  const specifier = "@photon-ai/imessage-kit";
  const module = (await import(specifier)) as Record<string, unknown>;
  const getMessages = module.getMessages;
  const listChats = module.listChats;
  const startWatching = module.startWatching;

  if (typeof getMessages !== "function" || typeof startWatching !== "function") {
    throw new TypeError(
      "@photon-ai/imessage-kit did not expose the expected getMessages/startWatching functions.",
    );
  }

  return {
    getMessages(input) {
      return (getMessages as ImessagePollDriver["getMessages"])(input);
    },
    listChats:
      typeof listChats === "function"
        ? () => (listChats as NonNullable<ImessagePollDriver["listChats"]>)()
        : undefined,
    startWatching(options) {
      return (startWatching as ImessagePollDriver["startWatching"])(options);
    },
  };
}

function compareCaptures(left: InboundCapture, right: InboundCapture): number {
  if (left.occurredAt !== right.occurredAt) {
    return left.occurredAt.localeCompare(right.occurredAt);
  }

  return left.externalId.localeCompare(right.externalId);
}

function resolveChat(
  chats: Map<string, ImessageKitChatLike>,
  message: ImessageKitMessageLike,
): ImessageKitChatLike | null {
  const key = message.chatGuid ?? message.chatId ?? null;
  return key ? (chats.get(key) ?? null) : null;
}

async function indexChats(chats: ImessageKitChatLike[]): Promise<Map<string, ImessageKitChatLike>> {
  return new Map(
    chats.flatMap((chat) => {
      const keys = [chat.guid, chat.chatGuid, chat.id].filter(
        (value): value is string => typeof value === "string" && value.length > 0,
      );
      return keys.map((key) => [key, chat] as const);
    }),
  );
}

async function stopWatcher(
  watcher: ImessageWatcherHandle | (() => Promise<void> | void) | void,
): Promise<void> {
  if (!watcher) {
    return;
  }

  if (typeof watcher === "function") {
    await watcher();
    return;
  }

  if (typeof watcher.close === "function") {
    await watcher.close();
    return;
  }

  if (typeof watcher.stop === "function") {
    await watcher.stop();
  }
}

async function waitForAbort(signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return;
  }

  await new Promise<void>((resolve) => {
    signal.addEventListener("abort", () => resolve(), { once: true });
  });
}
