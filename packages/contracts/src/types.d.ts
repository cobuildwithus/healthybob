export type EventKind =
  | "document"
  | "meal"
  | "symptom"
  | "note"
  | "observation"
  | "experiment_event"
  | "medication_intake"
  | "supplement_intake"
  | "activity_session"
  | "sleep_session";

export type EventSource = "manual" | "import" | "device" | "derived";
export type ExperimentPhase = "start" | "checkpoint" | "stop";

export type SampleStream =
  | "heart_rate"
  | "hrv"
  | "steps"
  | "sleep_stage"
  | "respiratory_rate"
  | "temperature"
  | "glucose";

export type SampleSource = "device" | "import" | "manual" | "derived";
export type SampleQuality = "raw" | "normalized" | "derived";
export type SleepStage = "awake" | "light" | "deep" | "rem";

export type AuditAction =
  | "vault_init"
  | "document_import"
  | "meal_add"
  | "samples_import_csv"
  | "experiment_create"
  | "journal_ensure"
  | "validate"
  | "show"
  | "list"
  | "export_pack";

export type AuditActor = "cli" | "core" | "importer" | "query";
export type AuditStatus = "success" | "failure";
export type FileChangeOperation = "create" | "append" | "update" | "copy";
export type ExperimentStatus = "planned" | "active" | "paused" | "completed" | "abandoned";

export type ErrorCodeValue =
  | "HB_CONTRACT_INVALID"
  | "HB_ID_INVALID"
  | "HB_PATH_INVALID"
  | "HB_VAULT_INVALID"
  | "HB_EVENT_INVALID"
  | "HB_SAMPLE_INVALID"
  | "HB_AUDIT_INVALID"
  | "HB_FRONTMATTER_INVALID"
  | "HB_ENUM_UNSUPPORTED"
  | "HB_SHARD_KEY_INVALID"
  | "HB_SCHEMA_ARTIFACT_STALE";

export interface VaultMetadata {
  schemaVersion: "hb.vault.v1";
  vaultId: string;
  createdAt: string;
  title: string;
  timezone: string;
  idPolicy: {
    format: "prefix_ulid";
    prefixes: {
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
    };
  };
  paths: {
    coreDocument: "CORE.md";
    journalRoot: "journal";
    experimentsRoot: "bank/experiments";
    providersRoot: "bank/providers";
    rawRoot: "raw";
    eventsRoot: "ledger/events";
    samplesRoot: "ledger/samples";
    auditRoot: "audit";
    exportsRoot: "exports";
  };
  shards: {
    events: "ledger/events/YYYY/YYYY-MM.jsonl";
    samples: "ledger/samples/<stream>/YYYY/YYYY-MM.jsonl";
    audit: "audit/YYYY/YYYY-MM.jsonl";
  };
}

export interface EventRecordBase {
  schemaVersion: "hb.event.v1";
  id: string;
  kind: EventKind;
  occurredAt: string;
  recordedAt: string;
  dayKey: string;
  source: EventSource;
  title: string;
  note?: string;
  tags?: string[];
  relatedIds?: string[];
  rawRefs?: string[];
}

export interface DocumentEventRecord extends EventRecordBase {
  kind: "document";
  documentId: string;
  documentPath: string;
  mimeType: string;
  providerId?: string;
}

export interface MealEventRecord extends EventRecordBase {
  kind: "meal";
  mealId: string;
  photoPaths: string[];
  audioPaths: string[];
}

export interface SymptomEventRecord extends EventRecordBase {
  kind: "symptom";
  symptom: string;
  intensity: number;
  bodySite?: string;
}

export interface NoteEventRecord extends EventRecordBase {
  kind: "note";
  note: string;
}

export interface ObservationEventRecord extends EventRecordBase {
  kind: "observation";
  metric: string;
  value: number;
  unit: string;
}

export interface ExperimentEventRecord extends EventRecordBase {
  kind: "experiment_event";
  experimentId: string;
  experimentSlug: string;
  phase: ExperimentPhase;
}

export interface MedicationIntakeEventRecord extends EventRecordBase {
  kind: "medication_intake";
  medicationName: string;
  dose: number;
  unit: string;
}

export interface SupplementIntakeEventRecord extends EventRecordBase {
  kind: "supplement_intake";
  supplementName: string;
  dose: number;
  unit: string;
}

export interface ActivitySessionEventRecord extends EventRecordBase {
  kind: "activity_session";
  activityType: string;
  durationMinutes: number;
  distanceKm?: number;
}

export interface SleepSessionEventRecord extends EventRecordBase {
  kind: "sleep_session";
  startAt: string;
  endAt: string;
  durationMinutes: number;
}

export type EventRecord =
  | DocumentEventRecord
  | MealEventRecord
  | SymptomEventRecord
  | NoteEventRecord
  | ObservationEventRecord
  | ExperimentEventRecord
  | MedicationIntakeEventRecord
  | SupplementIntakeEventRecord
  | ActivitySessionEventRecord
  | SleepSessionEventRecord;

export interface SampleRecordBase {
  schemaVersion: "hb.sample.v1";
  id: string;
  stream: SampleStream;
  recordedAt: string;
  dayKey: string;
  source: SampleSource;
  quality: SampleQuality;
}

export interface HeartRateSampleRecord extends SampleRecordBase {
  stream: "heart_rate";
  value: number;
  unit: "bpm";
}

export interface HrvSampleRecord extends SampleRecordBase {
  stream: "hrv";
  value: number;
  unit: "ms";
}

export interface StepsSampleRecord extends SampleRecordBase {
  stream: "steps";
  value: number;
  unit: "count";
}

export interface SleepStageSampleRecord extends SampleRecordBase {
  stream: "sleep_stage";
  stage: SleepStage;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  unit: "stage";
}

export interface RespiratoryRateSampleRecord extends SampleRecordBase {
  stream: "respiratory_rate";
  value: number;
  unit: "breaths_per_minute";
}

export interface TemperatureSampleRecord extends SampleRecordBase {
  stream: "temperature";
  value: number;
  unit: "celsius";
}

export interface GlucoseSampleRecord extends SampleRecordBase {
  stream: "glucose";
  value: number;
  unit: "mg_dL";
}

export type SampleRecord =
  | HeartRateSampleRecord
  | HrvSampleRecord
  | StepsSampleRecord
  | SleepStageSampleRecord
  | RespiratoryRateSampleRecord
  | TemperatureSampleRecord
  | GlucoseSampleRecord;

export interface AuditRecord {
  schemaVersion: "hb.audit.v1";
  id: string;
  action: AuditAction;
  status: AuditStatus;
  occurredAt: string;
  actor: AuditActor;
  commandName: string;
  summary: string;
  targetIds?: string[];
  errorCode?: ErrorCodeValue;
  changes: Array<{
    path: string;
    op: FileChangeOperation;
  }>;
}

export interface CoreFrontmatter {
  schemaVersion: "hb.frontmatter.core.v1";
  docType: "core";
  vaultId: string;
  title: string;
  timezone: string;
  updatedAt: string;
  activeExperimentSlugs?: string[];
}

export interface JournalDayFrontmatter {
  schemaVersion: "hb.frontmatter.journal-day.v1";
  docType: "journal_day";
  dayKey: string;
  eventIds: string[];
  sampleStreams: SampleStream[];
}

export interface ExperimentFrontmatter {
  schemaVersion: "hb.frontmatter.experiment.v1";
  docType: "experiment";
  experimentId: string;
  slug: string;
  status: ExperimentStatus;
  title: string;
  startedOn: string;
  endedOn?: string;
  hypothesis?: string;
  tags?: string[];
}
