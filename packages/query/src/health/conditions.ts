import {
  conditionRegistryDefinition,
  listRegistryRecords,
  readRegistryRecord,
  showRegistryRecord,
} from "./registries.js";

import type { ConditionQueryRecord, RegistryListOptions } from "./registries.js";

export function listConditions(
  vaultRoot: string,
  options: RegistryListOptions = {},
): Promise<ConditionQueryRecord[]> {
  return listRegistryRecords(vaultRoot, conditionRegistryDefinition, options);
}

export function readCondition(
  vaultRoot: string,
  conditionId: string,
): Promise<ConditionQueryRecord | null> {
  return readRegistryRecord(vaultRoot, conditionRegistryDefinition, conditionId);
}

export function showCondition(
  vaultRoot: string,
  lookup: string,
): Promise<ConditionQueryRecord | null> {
  return showRegistryRecord(vaultRoot, conditionRegistryDefinition, lookup);
}
