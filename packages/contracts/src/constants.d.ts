export declare const CONTRACT_SCHEMA_VERSION: Readonly<{
  audit: "hb.audit.v1";
  event: "hb.event.v1";
  experimentFrontmatter: "hb.frontmatter.experiment.v1";
  journalDayFrontmatter: "hb.frontmatter.journal-day.v1";
  coreFrontmatter: "hb.frontmatter.core.v1";
  sample: "hb.sample.v1";
  vault: "hb.vault.v1";
}>;

export declare const CONTRACT_ID_FORMAT: "prefix_ulid";

export declare const ID_PREFIXES: Readonly<{
  audit: "aud";
  document: "doc";
  event: "evt";
  experiment: "exp";
  meal: "meal";
  pack: "pack";
  provider: "prov";
  sample: "smp";
  transform: "xfm";
  vault: "vault";
}>;

export declare const EVENT_KINDS: readonly [
  "document",
  "meal",
  "symptom",
  "note",
  "observation",
  "experiment_event",
  "medication_intake",
  "supplement_intake",
  "activity_session",
  "sleep_session"
];

export declare const EVENT_SOURCES: readonly ["manual", "import", "device", "derived"];
export declare const EXPERIMENT_PHASES: readonly ["start", "checkpoint", "stop"];

export declare const SAMPLE_STREAMS: readonly [
  "heart_rate",
  "hrv",
  "steps",
  "sleep_stage",
  "respiratory_rate",
  "temperature",
  "glucose"
];

export declare const SAMPLE_SOURCES: readonly ["device", "import", "manual", "derived"];
export declare const SAMPLE_QUALITIES: readonly ["raw", "normalized", "derived"];
export declare const SLEEP_STAGES: readonly ["awake", "light", "deep", "rem"];

export declare const AUDIT_ACTIONS: readonly [
  "vault_init",
  "document_import",
  "meal_add",
  "samples_import_csv",
  "experiment_create",
  "journal_ensure",
  "validate",
  "show",
  "list",
  "export_pack"
];

export declare const AUDIT_ACTORS: readonly ["cli", "core", "importer", "query"];
export declare const AUDIT_STATUSES: readonly ["success", "failure"];
export declare const FILE_CHANGE_OPERATIONS: readonly ["create", "append", "update", "copy"];

export declare const FRONTMATTER_DOC_TYPES: Readonly<{
  core: "core";
  experiment: "experiment";
  journalDay: "journal_day";
}>;

export declare const EXPERIMENT_STATUSES: readonly [
  "planned",
  "active",
  "paused",
  "completed",
  "abandoned"
];

export interface ErrorCodeEntry {
  code: string;
  retryable: boolean;
  summary: string;
}

export declare const ERROR_CODES: readonly ErrorCodeEntry[];
export declare const ERROR_CODE_VALUES: readonly string[];
