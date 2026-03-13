import {
  familyRegistryDefinition,
  listRegistryRecords,
  readRegistryRecord,
  showRegistryRecord,
} from "./registries.js";

import type { FamilyQueryRecord, RegistryListOptions } from "./registries.js";

export function listFamilyMembers(
  vaultRoot: string,
  options: RegistryListOptions = {},
): Promise<FamilyQueryRecord[]> {
  return listRegistryRecords(vaultRoot, familyRegistryDefinition, options);
}

export function readFamilyMember(
  vaultRoot: string,
  familyMemberId: string,
): Promise<FamilyQueryRecord | null> {
  return readRegistryRecord(vaultRoot, familyRegistryDefinition, familyMemberId);
}

export function showFamilyMember(
  vaultRoot: string,
  lookup: string,
): Promise<FamilyQueryRecord | null> {
  return showRegistryRecord(vaultRoot, familyRegistryDefinition, lookup);
}
