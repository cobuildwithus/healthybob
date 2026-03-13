import type { BaseConnector, PollConnector, WebhookConnector } from "../connectors/types.js";

export interface ConnectorRegistry {
  add(connector: BaseConnector): void;
  get(source: string): BaseConnector | null;
  requirePoll(source: string): PollConnector;
  requireWebhook(source: string): WebhookConnector;
  list(): BaseConnector[];
}

export function createConnectorRegistry(connectors: Iterable<BaseConnector> = []): ConnectorRegistry {
  const registry = new Map<string, BaseConnector>();

  for (const connector of connectors) {
    registry.set(connector.source, connector);
  }

  return {
    add(connector) {
      registry.set(connector.source, connector);
    },
    get(source) {
      return registry.get(source) ?? null;
    },
    requirePoll(source) {
      const connector = registry.get(source);
      if (!connector || connector.kind !== "poll") {
        throw new TypeError(`Poll connector not registered for source: ${source}`);
      }
      return connector as PollConnector;
    },
    requireWebhook(source) {
      const connector = registry.get(source);
      if (!connector || connector.kind !== "webhook") {
        throw new TypeError(`Webhook connector not registered for source: ${source}`);
      }
      return connector as WebhookConnector;
    },
    list() {
      return [...registry.values()];
    },
  };
}
