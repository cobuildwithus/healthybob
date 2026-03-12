import type {
  AuditRecord,
  CoreFrontmatter,
  EventRecord,
  ExperimentFrontmatter,
  JournalDayFrontmatter,
  SampleRecord,
  TransformRecord,
  VaultMetadata,
} from "./types";

export declare const exampleVaultMetadata: Readonly<VaultMetadata>;
export declare const exampleEventRecords: readonly Readonly<EventRecord>[];
export declare const exampleSampleRecords: readonly Readonly<SampleRecord>[];
export declare const exampleAuditRecords: readonly Readonly<AuditRecord>[];
export declare const exampleTransformRecords: readonly Readonly<TransformRecord>[];
export declare const exampleFrontmatterObjects: Readonly<{
  core: CoreFrontmatter;
  journalDay: JournalDayFrontmatter;
  experiment: ExperimentFrontmatter;
}>;
export declare const exampleFrontmatterMarkdown: Readonly<Record<string, string>>;
