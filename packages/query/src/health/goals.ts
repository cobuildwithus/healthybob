import {
  goalRegistryDefinition,
  listRegistryRecords,
  readRegistryRecord,
  showRegistryRecord,
} from "./registries.js";

import type { GoalQueryRecord, RegistryListOptions } from "./registries.js";

export function listGoals(
  vaultRoot: string,
  options: RegistryListOptions = {},
): Promise<GoalQueryRecord[]> {
  return listRegistryRecords(vaultRoot, goalRegistryDefinition, options);
}

export function readGoal(
  vaultRoot: string,
  goalId: string,
): Promise<GoalQueryRecord | null> {
  return readRegistryRecord(vaultRoot, goalRegistryDefinition, goalId);
}

export function showGoal(
  vaultRoot: string,
  lookup: string,
): Promise<GoalQueryRecord | null> {
  return showRegistryRecord(vaultRoot, goalRegistryDefinition, lookup);
}
