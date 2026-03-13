import {
  commandNounCapabilityByNoun,
  healthEntityDefinitions,
  type CommandCapability,
  type CommandCapabilityBundleId,
  type HealthEntityDefinition,
  type HealthEntityKind,
} from "@healthybob/contracts";
import { z } from "incur";
import type {
  HealthCoreRuntimeMethodName,
  HealthCoreScaffoldServiceMethodName,
  HealthCoreUpsertServiceMethodName,
  HealthListFilters,
  HealthQueryListServiceMethodName,
  HealthQueryRuntimeListMethodName,
  HealthQueryRuntimeShowMethodName,
  HealthQueryShowServiceMethodName,
  JsonObject,
} from "./health-cli-method-types.js";
import {
  listItemSchema,
  localDateSchema,
  pathSchema,
  showResultSchema,
} from "./vault-cli-contracts.js";

export type { JsonObject } from "./health-cli-method-types.js";

export type HealthListFilterCapability = "date-range" | "kind" | "status";
export type HealthUpsertInputCapability = "profile-snapshot-envelope";
export type HealthUpsertResultCapability =
  | "path"
  | "ledger-file"
  | "current-profile-path"
  | "profile-payload";

export interface HealthCoreDescriptor {
  inputCapabilities: readonly HealthUpsertInputCapability[];
  payloadTemplate: JsonObject;
  resultIdField: string;
  resultCapabilities: readonly HealthUpsertResultCapability[];
  runtimeMethod: HealthCoreRuntimeMethodName;
  scaffoldNoun: string;
  scaffoldServiceMethod: HealthCoreScaffoldServiceMethodName;
  upsertServiceMethod: HealthCoreUpsertServiceMethodName;
}

export interface HealthQueryDescriptor {
  genericListKinds?: readonly string[];
  genericListFilterCapabilities: readonly HealthListFilterCapability[];
  genericLookupPrefixes?: readonly string[];
  genericLookupValues?: readonly string[];
  listServiceMethod: HealthQueryListServiceMethodName;
  notFoundLabel: string;
  runtimeListMethod: HealthQueryRuntimeListMethodName;
  runtimeShowMethod: HealthQueryRuntimeShowMethodName;
  showServiceMethod: HealthQueryShowServiceMethodName;
}

export interface HealthEntityCommandDescriptor {
  additionalCapabilities?: readonly CommandCapability[];
  capabilityBundles: readonly CommandCapabilityBundleId[];
  commandName: string;
  description: string;
  descriptions: {
    list: string;
    scaffold: string;
    show: string;
    upsert: string;
  };
  examples?: {
    list?: Array<Record<string, unknown>>;
    scaffold?: Array<Record<string, unknown>>;
    show?: Array<Record<string, unknown>>;
    upsert?: Array<Record<string, unknown>>;
  };
  hints?: {
    list?: string;
    scaffold?: string;
    show?: string;
    upsert?: string;
  };
  listStatusDescription?: string;
  noun: string;
  payloadFile: string;
  pluralNoun: string;
  showId: {
    description: string;
    example: string;
  };
}

type HealthEntityCommandDescriptorExtension = Omit<
  HealthEntityCommandDescriptor,
  "additionalCapabilities" | "capabilityBundles"
>;

export interface HealthEntityDescriptor extends HealthEntityDefinition {
  command?: HealthEntityCommandDescriptor;
  core?: HealthCoreDescriptor;
  query?: HealthQueryDescriptor;
}

interface HealthEntityDescriptorExtension {
  command?: HealthEntityCommandDescriptorExtension;
  core?: Omit<HealthCoreDescriptor, "payloadTemplate" | "inputCapabilities"> & {
    inputCapabilities?: readonly HealthUpsertInputCapability[];
  };
  query?: Omit<
    HealthQueryDescriptor,
    "genericListKinds" | "genericLookupPrefixes" | "genericLookupValues"
  >;
}

export const healthPayloadSchema = z.object({}).catchall(z.unknown());

export function createHealthScaffoldResultSchema<TNoun extends string>(noun: TNoun) {
  return z.object({
    vault: pathSchema,
    noun: z.literal(noun),
    payload: healthPayloadSchema,
  });
}

export const healthShowResultSchema = showResultSchema;

export const healthListFiltersSchema = z.object({
  from: localDateSchema.optional(),
  to: localDateSchema.optional(),
  kind: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
  limit: z.number().int().positive().max(200).default(50),
}) satisfies z.ZodType<HealthListFilters>;

export const healthListResultSchema = z.object({
  vault: pathSchema,
  filters: healthListFiltersSchema,
  items: z.array(listItemSchema),
  count: z.number().int().nonnegative(),
  nextCursor: z.string().min(1).nullable(),
});

const checkedHealthEntityDescriptorExtensions = {
  assessment: {
    query: {
      genericListFilterCapabilities: ["date-range", "status"],
      listServiceMethod: "listAssessments",
      notFoundLabel: "assessment",
      runtimeListMethod: "listAssessments",
      runtimeShowMethod: "showAssessment",
      showServiceMethod: "showAssessment",
    },
  },
  profile: {
    command: {
      commandName: "profile",
      description: "Profile snapshot commands for the health extension surface.",
      descriptions: {
        list: "List profile snapshots through the health read model.",
        scaffold: "Emit a payload template for a profile snapshot upsert.",
        show: "Show one profile snapshot or the derived current profile.",
        upsert: "Upsert one profile snapshot from a JSON payload file or stdin.",
      },
      examples: {
        show: [
          {
            args: {
              id: "current",
            },
            description: "Show the derived current profile.",
            options: {
              vault: "./vault",
            },
          },
          {
            args: {
              id: "<snapshot-id>",
            },
            description: "Show one saved profile snapshot.",
            options: {
              vault: "./vault",
            },
          },
        ],
        upsert: [
          {
            description: "Upsert one profile snapshot from a JSON payload file.",
            options: {
              input: "@profile-snapshot.json",
              vault: "./vault",
            },
          },
        ],
      },
      hints: {
        show: "Use `current` to read the derived profile or pass a snapshot id to inspect one saved payload.",
      },
      noun: "profile snapshot",
      payloadFile: "profile-snapshot.json",
      pluralNoun: "profile snapshots",
      showId: {
        description: "Snapshot id or `current`.",
        example: "current",
      },
    },
    core: {
      inputCapabilities: ["profile-snapshot-envelope"],
      resultIdField: "snapshotId",
      resultCapabilities: ["ledger-file", "current-profile-path", "profile-payload"],
      runtimeMethod: "appendProfileSnapshot",
      scaffoldNoun: "profile",
      scaffoldServiceMethod: "scaffoldProfileSnapshot",
      upsertServiceMethod: "upsertProfileSnapshot",
    },
    query: {
      genericListFilterCapabilities: ["date-range", "status"],
      listServiceMethod: "listProfileSnapshots",
      notFoundLabel: "profile",
      runtimeListMethod: "listProfileSnapshots",
      runtimeShowMethod: "showProfile",
      showServiceMethod: "showProfile",
    },
  },
  goal: {
    command: {
      commandName: "goal",
      description: "Goal registry commands for the health extension surface.",
      descriptions: {
        list: "List goals through the health read model.",
        scaffold: "Emit a payload template for goal upserts.",
        show: "Show one goal by canonical id or slug.",
        upsert: "Upsert one goal from a JSON payload file or stdin.",
      },
      listStatusDescription: "Optional goal status to filter by.",
      noun: "goal",
      payloadFile: "goal.json",
      pluralNoun: "goals",
      showId: {
        description: "Goal id or slug to show.",
        example: "<goal-id>",
      },
    },
    core: {
      resultIdField: "goalId",
      resultCapabilities: ["path"],
      runtimeMethod: "upsertGoal",
      scaffoldNoun: "goal",
      scaffoldServiceMethod: "scaffoldGoal",
      upsertServiceMethod: "upsertGoal",
    },
    query: {
      genericListFilterCapabilities: ["status"],
      listServiceMethod: "listGoals",
      notFoundLabel: "goal",
      runtimeListMethod: "listGoals",
      runtimeShowMethod: "showGoal",
      showServiceMethod: "showGoal",
    },
  },
  condition: {
    command: {
      commandName: "condition",
      description: "Condition registry commands for the health extension surface.",
      descriptions: {
        list: "List conditions through the health read model.",
        scaffold: "Emit a payload template for condition upserts.",
        show: "Show one condition by canonical id or slug.",
        upsert: "Upsert one condition from a JSON payload file or stdin.",
      },
      listStatusDescription: "Optional condition status to filter by.",
      noun: "condition",
      payloadFile: "condition.json",
      pluralNoun: "conditions",
      showId: {
        description: "Condition id or slug to show.",
        example: "<condition-id>",
      },
    },
    core: {
      resultIdField: "conditionId",
      resultCapabilities: ["path"],
      runtimeMethod: "upsertCondition",
      scaffoldNoun: "condition",
      scaffoldServiceMethod: "scaffoldCondition",
      upsertServiceMethod: "upsertCondition",
    },
    query: {
      genericListFilterCapabilities: ["status"],
      listServiceMethod: "listConditions",
      notFoundLabel: "condition",
      runtimeListMethod: "listConditions",
      runtimeShowMethod: "showCondition",
      showServiceMethod: "showCondition",
    },
  },
  allergy: {
    command: {
      commandName: "allergy",
      description: "Allergy registry commands for the health extension surface.",
      descriptions: {
        list: "List allergies through the health read model.",
        scaffold: "Emit a payload template for allergy upserts.",
        show: "Show one allergy by canonical id or slug.",
        upsert: "Upsert one allergy from a JSON payload file or stdin.",
      },
      listStatusDescription: "Optional allergy status to filter by.",
      noun: "allergy",
      payloadFile: "allergy.json",
      pluralNoun: "allergies",
      showId: {
        description: "Allergy id or slug to show.",
        example: "<allergy-id>",
      },
    },
    core: {
      resultIdField: "allergyId",
      resultCapabilities: ["path"],
      runtimeMethod: "upsertAllergy",
      scaffoldNoun: "allergy",
      scaffoldServiceMethod: "scaffoldAllergy",
      upsertServiceMethod: "upsertAllergy",
    },
    query: {
      genericListFilterCapabilities: ["status"],
      listServiceMethod: "listAllergies",
      notFoundLabel: "allergy",
      runtimeListMethod: "listAllergies",
      runtimeShowMethod: "showAllergy",
      showServiceMethod: "showAllergy",
    },
  },
  regimen: {
    command: {
      commandName: "regimen",
      description: "Regimen registry commands for the health extension surface.",
      descriptions: {
        list: "List regimens through the health read model.",
        scaffold: "Emit a payload template for regimen upserts.",
        show: "Show one regimen by canonical id or slug.",
        upsert: "Upsert one regimen from a JSON payload file or stdin.",
      },
      listStatusDescription: "Optional regimen status to filter by.",
      noun: "regimen",
      payloadFile: "regimen.json",
      pluralNoun: "regimens",
      showId: {
        description: "Regimen id or slug to show.",
        example: "<regimen-id>",
      },
    },
    core: {
      resultIdField: "regimenId",
      resultCapabilities: ["path"],
      runtimeMethod: "upsertRegimenItem",
      scaffoldNoun: "regimen",
      scaffoldServiceMethod: "scaffoldRegimen",
      upsertServiceMethod: "upsertRegimen",
    },
    query: {
      genericListFilterCapabilities: ["status"],
      listServiceMethod: "listRegimens",
      notFoundLabel: "regimen",
      runtimeListMethod: "listRegimens",
      runtimeShowMethod: "showRegimen",
      showServiceMethod: "showRegimen",
    },
  },
  history: {
    command: {
      commandName: "history",
      description: "Timed health history commands for the extension surface.",
      descriptions: {
        list: "List timed history events through the health read model.",
        scaffold: "Emit a payload template for timed history events.",
        show: "Show one timed history event.",
        upsert: "Append one timed history event from a JSON payload file or stdin.",
      },
      listStatusDescription: "Optional health-event status to filter by.",
      noun: "history event",
      payloadFile: "history.json",
      pluralNoun: "history events",
      showId: {
        description: "Timed history event id to show.",
        example: "<history-event-id>",
      },
    },
    core: {
      resultIdField: "eventId",
      resultCapabilities: ["ledger-file"],
      runtimeMethod: "appendHistoryEvent",
      scaffoldNoun: "history",
      scaffoldServiceMethod: "scaffoldHistoryEvent",
      upsertServiceMethod: "upsertHistoryEvent",
    },
    query: {
      genericListFilterCapabilities: ["kind", "date-range", "status"],
      listServiceMethod: "listHistoryEvents",
      notFoundLabel: "history event",
      runtimeListMethod: "listHistoryEvents",
      runtimeShowMethod: "showHistoryEvent",
      showServiceMethod: "showHistoryEvent",
    },
  },
  family: {
    command: {
      commandName: "family",
      description: "Family registry commands for the health extension surface.",
      descriptions: {
        list: "List family members through the health read model.",
        scaffold: "Emit a payload template for family member upserts.",
        show: "Show one family member by canonical id or slug.",
        upsert: "Upsert one family member from a JSON payload file or stdin.",
      },
      listStatusDescription: "Optional family-member status to filter by.",
      noun: "family member",
      payloadFile: "family.json",
      pluralNoun: "family members",
      showId: {
        description: "Family member id or slug to show.",
        example: "<family-member-id>",
      },
    },
    core: {
      resultIdField: "familyMemberId",
      resultCapabilities: ["path"],
      runtimeMethod: "upsertFamilyMember",
      scaffoldNoun: "family",
      scaffoldServiceMethod: "scaffoldFamilyMember",
      upsertServiceMethod: "upsertFamilyMember",
    },
    query: {
      genericListFilterCapabilities: ["status"],
      listServiceMethod: "listFamilyMembers",
      notFoundLabel: "family member",
      runtimeListMethod: "listFamilyMembers",
      runtimeShowMethod: "showFamilyMember",
      showServiceMethod: "showFamilyMember",
    },
  },
  genetics: {
    command: {
      commandName: "genetics",
      description: "Genetic variant commands for the health extension surface.",
      descriptions: {
        list: "List genetic variants through the health read model.",
        scaffold: "Emit a payload template for genetic variant upserts.",
        show: "Show one genetic variant by canonical id or slug.",
        upsert: "Upsert one genetic variant from a JSON payload file or stdin.",
      },
      listStatusDescription: "Optional genetic-variant status to filter by.",
      noun: "genetic variant",
      payloadFile: "genetics.json",
      pluralNoun: "genetic variants",
      showId: {
        description: "Genetic variant id or slug to show.",
        example: "<genetic-variant-id>",
      },
    },
    core: {
      resultIdField: "variantId",
      resultCapabilities: ["path"],
      runtimeMethod: "upsertGeneticVariant",
      scaffoldNoun: "genetics",
      scaffoldServiceMethod: "scaffoldGeneticVariant",
      upsertServiceMethod: "upsertGeneticVariant",
    },
    query: {
      genericListFilterCapabilities: ["status"],
      listServiceMethod: "listGeneticVariants",
      notFoundLabel: "genetic variant",
      runtimeListMethod: "listGeneticVariants",
      runtimeShowMethod: "showGeneticVariant",
      showServiceMethod: "showGeneticVariant",
    },
  },
} as const satisfies Record<HealthEntityKind, HealthEntityDescriptorExtension>;

function requireScaffoldTemplate(definition: HealthEntityDefinition): JsonObject {
  if (!definition.scaffoldTemplate) {
    throw new Error(`Health entity "${definition.kind}" does not define a scaffold template.`);
  }

  return definition.scaffoldTemplate;
}

function buildHealthEntityDescriptor(
  definition: HealthEntityDefinition,
): HealthEntityDescriptor {
  const extension = checkedHealthEntityDescriptorExtensions[
    definition.kind
  ] as HealthEntityDescriptorExtension;
  const commandCapabilityDefinition = commandNounCapabilityByNoun.get(definition.kind);

  return {
    ...definition,
    command: extension.command
      ? {
          ...extension.command,
          additionalCapabilities: commandCapabilityDefinition?.additionalCapabilities,
          capabilityBundles: commandCapabilityDefinition?.bundles ?? [],
        }
      : undefined,
    core: extension.core
      ? {
          ...extension.core,
          inputCapabilities: extension.core.inputCapabilities ?? [],
          payloadTemplate: requireScaffoldTemplate(definition),
        }
      : undefined,
    query: extension.query
      ? {
          ...extension.query,
          genericListKinds: definition.listKinds,
          genericLookupPrefixes: definition.prefixes,
          genericLookupValues: definition.lookupAliases,
        }
      : undefined,
  };
}

export const healthEntityDescriptors: readonly HealthEntityDescriptor[] =
  healthEntityDefinitions.map(buildHealthEntityDescriptor);

export type HealthCoreDescriptorEntry = HealthEntityDescriptor & {
  core: HealthCoreDescriptor;
};

export type HealthQueryDescriptorEntry = HealthEntityDescriptor & {
  query: HealthQueryDescriptor;
};

export type HealthCommandDescriptorEntry = HealthEntityDescriptor & {
  command: HealthEntityCommandDescriptor;
  core: HealthCoreDescriptor;
  query: HealthQueryDescriptor;
};

export const healthEntityDescriptorByKind = new Map<HealthEntityKind, HealthEntityDescriptor>(
  healthEntityDescriptors.map((descriptor) => [descriptor.kind, descriptor]),
);

export const healthEntityDescriptorByNoun = new Map<string, HealthEntityDescriptor>(
  healthEntityDescriptors.map((descriptor) => [descriptor.noun, descriptor]),
);

export const healthEntityDescriptorByCommandName = new Map<string, HealthEntityDescriptor>(
  healthEntityDescriptors.flatMap((descriptor) =>
    descriptor.command ? [[descriptor.command.commandName, descriptor] as const] : [],
  ),
);

export function hasHealthCoreDescriptor(
  descriptor: HealthEntityDescriptor,
): descriptor is HealthCoreDescriptorEntry {
  return Boolean(descriptor.core);
}

export function hasHealthQueryDescriptor(
  descriptor: HealthEntityDescriptor,
): descriptor is HealthQueryDescriptorEntry {
  return Boolean(descriptor.query);
}

export function hasHealthCommandDescriptor(
  descriptor: HealthEntityDescriptor,
): descriptor is HealthCommandDescriptorEntry {
  return Boolean(descriptor.command && descriptor.core && descriptor.query);
}

export function healthCoreHasInputCapability(
  descriptor: Pick<HealthCoreDescriptorEntry, "core">,
  capability: HealthUpsertInputCapability,
) {
  return descriptor.core.inputCapabilities.includes(capability);
}

export function healthCoreHasResultCapability(
  descriptor: Pick<HealthCoreDescriptorEntry, "core">,
  capability: HealthUpsertResultCapability,
) {
  return descriptor.core.resultCapabilities.includes(capability);
}

export function healthQueryHasListFilterCapability(
  descriptor: Pick<HealthQueryDescriptorEntry, "query">,
  capability: HealthListFilterCapability,
) {
  return descriptor.query.genericListFilterCapabilities.includes(capability);
}

const queryHealthDescriptors = healthEntityDescriptors.filter(hasHealthQueryDescriptor);

const genericLookupDescriptors = queryHealthDescriptors.filter((descriptor) => {
  const query = descriptor.query;
  return Boolean(
    (query.genericLookupPrefixes?.length ?? 0) > 0 ||
      (query.genericLookupValues?.length ?? 0) > 0,
  );
});

const genericListDescriptors = queryHealthDescriptors.filter(
  (descriptor) => Boolean(descriptor.query.genericListKinds?.length),
);

export function findHealthDescriptorForLookup(id: string): HealthQueryDescriptorEntry | null {
  return (
    genericLookupDescriptors.find((descriptor) => {
      const genericLookupValues = descriptor.query.genericLookupValues ?? [];
      const genericLookupPrefixes = descriptor.query.genericLookupPrefixes ?? [];

      return (
        genericLookupValues.includes(id) ||
        genericLookupPrefixes.some((prefix) => id.startsWith(prefix))
      );
    })
  ) ?? null;
}

export function findHealthDescriptorForListKind(kind?: string): HealthQueryDescriptorEntry | null {
  if (!kind) {
    return null;
  }

  return (
    genericListDescriptors.find((descriptor) =>
      descriptor.query.genericListKinds?.includes(kind),
    )
  ) ?? null;
}

export function inferHealthEntityKind(id: string) {
  return (
    healthEntityDescriptors.find((descriptor) =>
      (descriptor.prefixes ?? []).some((prefix) => id.startsWith(prefix)),
    )?.kind ?? null
  );
}

export function isHealthQueryableRecordId(id: string) {
  return Boolean(findHealthDescriptorForLookup(id));
}

export const healthCoreRuntimeMethodNames: readonly HealthCoreRuntimeMethodName[] = healthEntityDescriptors
  .filter(hasHealthCoreDescriptor)
  .map((descriptor) => descriptor.core.runtimeMethod);

export const healthQueryRuntimeMethodNames: ReadonlyArray<
  HealthQueryRuntimeShowMethodName | HealthQueryRuntimeListMethodName
> = healthEntityDescriptors.flatMap((descriptor) =>
  descriptor.query
    ? [descriptor.query.runtimeShowMethod, descriptor.query.runtimeListMethod]
    : [],
);

export const healthCoreServiceMethodNames: ReadonlyArray<
  HealthCoreScaffoldServiceMethodName | HealthCoreUpsertServiceMethodName
> = healthEntityDescriptors
  .filter(hasHealthCoreDescriptor)
  .flatMap((descriptor) => [
    descriptor.core.scaffoldServiceMethod,
    descriptor.core.upsertServiceMethod,
  ]);

export const healthQueryServiceMethodNames: ReadonlyArray<
  HealthQueryShowServiceMethodName | HealthQueryListServiceMethodName
> = healthEntityDescriptors.flatMap((descriptor) =>
  descriptor.query
    ? [descriptor.query.showServiceMethod, descriptor.query.listServiceMethod]
    : [],
);
