import type { VaultReadModel } from "./model.js";
import {
  materializeSearchDocuments,
  scoreSearchDocuments,
  type SearchCitation,
  type SearchDocument,
  type SearchFilters,
  type SearchHit,
  type SearchResult,
} from "./search-shared.js";

export type {
  SearchCitation,
  SearchDocument,
  SearchFilters,
  SearchHit,
  SearchResult,
} from "./search-shared.js";

export function searchVault(
  vault: VaultReadModel,
  query: string,
  filters: SearchFilters = {},
): SearchResult {
  const documents = materializeSearchDocuments(vault.records);
  return scoreSearchDocuments(documents, query, filters);
}
