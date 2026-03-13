import type { DateInput } from "../types.js";

export const FAMILY_MEMBER_SCHEMA_VERSION = "hb.family-member.v1";
export const FAMILY_MEMBER_DOC_TYPE = "family_member";

export interface FamilyMemberRecord {
  schemaVersion: typeof FAMILY_MEMBER_SCHEMA_VERSION;
  docType: typeof FAMILY_MEMBER_DOC_TYPE;
  familyMemberId: string;
  slug: string;
  title: string;
  relationship: string;
  conditions?: string[];
  deceased?: boolean;
  note?: string;
  relatedVariantIds?: string[];
  relativePath: string;
  markdown: string;
}

export interface UpsertFamilyMemberInput {
  vaultRoot: string;
  familyMemberId?: string;
  slug?: string;
  title?: string;
  name?: string;
  relationship?: string;
  relation?: string;
  conditions?: string[];
  deceased?: boolean;
  note?: string;
  summary?: string;
  relatedVariantIds?: string[];
  updatedAt?: DateInput;
}

export interface UpsertFamilyMemberResult {
  created: boolean;
  record: FamilyMemberRecord;
}

export interface ReadFamilyMemberInput {
  vaultRoot: string;
  memberId?: string;
  slug?: string;
}
