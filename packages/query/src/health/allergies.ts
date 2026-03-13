import {
  allergyRegistryDefinition,
  listRegistryRecords,
  readRegistryRecord,
  showRegistryRecord,
} from "./registries.js";

import type { AllergyQueryRecord, RegistryListOptions } from "./registries.js";

export function listAllergies(
  vaultRoot: string,
  options: RegistryListOptions = {},
): Promise<AllergyQueryRecord[]> {
  return listRegistryRecords(vaultRoot, allergyRegistryDefinition, options);
}

export function readAllergy(
  vaultRoot: string,
  allergyId: string,
): Promise<AllergyQueryRecord | null> {
  return readRegistryRecord(vaultRoot, allergyRegistryDefinition, allergyId);
}

export function showAllergy(
  vaultRoot: string,
  lookup: string,
): Promise<AllergyQueryRecord | null> {
  return showRegistryRecord(vaultRoot, allergyRegistryDefinition, lookup);
}
