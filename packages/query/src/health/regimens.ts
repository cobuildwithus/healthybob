import {
  listRegistryRecords,
  readRegistryRecord,
  regimenRegistryDefinition,
  showRegistryRecord,
} from "./registries.js";

import type { RegimenQueryRecord, RegistryListOptions } from "./registries.js";

export function listRegimens(
  vaultRoot: string,
  options: RegistryListOptions = {},
): Promise<RegimenQueryRecord[]> {
  return listRegistryRecords(vaultRoot, regimenRegistryDefinition, options);
}

export function readRegimen(
  vaultRoot: string,
  regimenId: string,
): Promise<RegimenQueryRecord | null> {
  return readRegistryRecord(vaultRoot, regimenRegistryDefinition, regimenId);
}

export function showRegimen(
  vaultRoot: string,
  lookup: string,
): Promise<RegimenQueryRecord | null> {
  return showRegistryRecord(vaultRoot, regimenRegistryDefinition, lookup);
}
