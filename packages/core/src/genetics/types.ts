import type { DateInput } from "../types.js";

export const GENETIC_VARIANT_SCHEMA_VERSION = "hb.genetic-variant.v1";
export const GENETIC_VARIANT_DOC_TYPE = "genetic_variant";
export const VARIANT_ZYGOSITIES = ["heterozygous", "homozygous", "hemizygous", "unknown"] as const;
export const VARIANT_SIGNIFICANCES = [
  "pathogenic",
  "likely_pathogenic",
  "vus",
  "benign",
  "risk_factor",
  "unknown",
] as const;
export const VARIANT_INHERITANCES = ["maternal", "paternal", "de_novo", "unknown"] as const;

export type VariantZygosity = (typeof VARIANT_ZYGOSITIES)[number];
export type VariantSignificance = (typeof VARIANT_SIGNIFICANCES)[number];
export type VariantInheritance = (typeof VARIANT_INHERITANCES)[number];

export interface GeneticVariantRecord {
  schemaVersion: typeof GENETIC_VARIANT_SCHEMA_VERSION;
  docType: typeof GENETIC_VARIANT_DOC_TYPE;
  variantId: string;
  slug: string;
  gene: string;
  title: string;
  zygosity?: VariantZygosity;
  significance?: VariantSignificance;
  inheritance?: VariantInheritance;
  sourceFamilyMemberIds?: string[];
  note?: string;
  relativePath: string;
  markdown: string;
}

export interface UpsertGeneticVariantInput {
  vaultRoot: string;
  variantId?: string;
  slug?: string;
  gene: string;
  title?: string;
  label?: string;
  zygosity?: VariantZygosity;
  significance?: VariantSignificance;
  inheritance?: VariantInheritance;
  sourceFamilyMemberIds?: string[];
  familyMemberIds?: string[];
  note?: string;
  summary?: string;
  updatedAt?: DateInput;
}

export interface UpsertGeneticVariantResult {
  created: boolean;
  record: GeneticVariantRecord;
}

export interface ReadGeneticVariantInput {
  vaultRoot: string;
  variantId?: string;
  slug?: string;
}
