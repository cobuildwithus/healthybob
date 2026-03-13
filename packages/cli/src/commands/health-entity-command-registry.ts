import { Cli, z } from "incur";
import {
  createHealthCrudGroup,
  registerHealthCrudGroup,
} from "./health-command-factory.js";
import {
  createHealthScaffoldResultSchema,
  hasHealthCommandDescriptor,
  healthEntityDescriptorByCommandName,
  healthListResultSchema,
  healthPayloadSchema,
  healthShowResultSchema,
  type HealthCommandDescriptorEntry,
} from "../health-cli-descriptors.js";
import { pathSchema } from "../vault-cli-contracts.js";
import type { VaultCliServices } from "../vault-cli-services.js";

type AsyncMethod = (input: unknown) => Promise<unknown>;

function requireHealthCommandDescriptor(commandName: string): HealthCommandDescriptorEntry {
  const descriptor = healthEntityDescriptorByCommandName.get(commandName);

  if (!descriptor || !hasHealthCommandDescriptor(descriptor)) {
    throw new Error(`No health command descriptor exists for "${commandName}".`);
  }

  return descriptor;
}

function createHealthUpsertResultSchema(descriptor: HealthCommandDescriptorEntry) {
  switch (descriptor.core.resultMode) {
    case "history-ledger":
      return z.object({
        vault: pathSchema,
        [descriptor.core.resultIdField]: z.string().min(1),
        lookupId: z.string().min(1),
        ledgerFile: pathSchema.optional(),
        created: z.boolean(),
      });
    case "profile-snapshot":
      return z.object({
        vault: pathSchema,
        [descriptor.core.resultIdField]: z.string().min(1),
        lookupId: z.string().min(1),
        ledgerFile: pathSchema.optional(),
        currentProfilePath: pathSchema.optional(),
        created: z.boolean(),
        profile: healthPayloadSchema.optional(),
      });
    case "record-path":
      return z.object({
        vault: pathSchema,
        [descriptor.core.resultIdField]: z.string().min(1),
        lookupId: z.string().min(1),
        path: pathSchema.optional(),
        created: z.boolean(),
      });
  }
}

function bindCrudServices(
  services: VaultCliServices,
  descriptor: HealthCommandDescriptorEntry,
) {
  const core = services.core as unknown as Record<string, AsyncMethod>;
  const query = services.query as unknown as Record<string, AsyncMethod>;

  return {
    list(input: unknown) {
      return query[descriptor.query.listServiceMethod](input);
    },
    scaffold(input: unknown) {
      return core[descriptor.core.scaffoldServiceMethod](input);
    },
    show(input: unknown) {
      return query[descriptor.query.showServiceMethod](input);
    },
    async upsert(input: unknown) {
      return (await core[descriptor.core.upsertServiceMethod](input)) as object;
    },
  };
}

function buildCrudGroupConfig(
  services: VaultCliServices,
  descriptor: HealthCommandDescriptorEntry,
) {
  return {
    commandName: descriptor.command.commandName,
    description: descriptor.command.description,
    descriptions: descriptor.command.descriptions,
    examples: descriptor.command.examples,
    hints: descriptor.command.hints,
    listStatusDescription: descriptor.command.listStatusDescription,
    noun: descriptor.command.noun,
    outputs: {
      list: healthListResultSchema,
      scaffold: createHealthScaffoldResultSchema(descriptor.core.scaffoldNoun),
      show: healthShowResultSchema,
      upsert: createHealthUpsertResultSchema(descriptor),
    },
    payloadFile: descriptor.command.payloadFile,
    pluralNoun: descriptor.command.pluralNoun,
    services: bindCrudServices(services, descriptor),
    showId: {
      ...descriptor.command.showId,
      fromUpsert(result: Record<string, unknown>) {
        return String(result[descriptor.core.resultIdField] ?? "");
      },
    },
  };
}

export function registerHealthEntityCrudGroup(
  cli: Cli.Cli,
  services: VaultCliServices,
  commandName: string,
) {
  const descriptor = requireHealthCommandDescriptor(commandName);
  registerHealthCrudGroup(cli, buildCrudGroupConfig(services, descriptor));
}

export function createHealthEntityCrudGroup(
  services: VaultCliServices,
  commandName: string,
) {
  const descriptor = requireHealthCommandDescriptor(commandName);
  return createHealthCrudGroup(buildCrudGroupConfig(services, descriptor));
}
