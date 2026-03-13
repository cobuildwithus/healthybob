import {
  geneticsRegistryDefinition,
  listRegistryRecords,
  readRegistryRecord,
  showRegistryRecord,
} from "./registries.js";

import type { GeneticsQueryRecord, RegistryListOptions } from "./registries.js";

export function listGeneticVariants(
  vaultRoot: string,
  options: RegistryListOptions = {},
): Promise<GeneticsQueryRecord[]> {
  return listRegistryRecords(vaultRoot, geneticsRegistryDefinition, options);
}

export function readGeneticVariant(
  vaultRoot: string,
  variantId: string,
): Promise<GeneticsQueryRecord | null> {
  return readRegistryRecord(vaultRoot, geneticsRegistryDefinition, variantId);
}

export function showGeneticVariant(
  vaultRoot: string,
  lookup: string,
): Promise<GeneticsQueryRecord | null> {
  return showRegistryRecord(vaultRoot, geneticsRegistryDefinition, lookup);
}
