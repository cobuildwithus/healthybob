import {
  ADVERSE_EFFECT_SEVERITIES,
  ALLERGY_CRITICALITIES,
  ALLERGY_STATUSES,
  ASSESSMENT_SOURCES,
  AUDIT_ACTIONS,
  AUDIT_ACTORS,
  AUDIT_STATUSES,
  CONDITION_CLINICAL_STATUSES,
  CONDITION_SEVERITIES,
  CONDITION_VERIFICATION_STATUSES,
  CONTRACT_ID_FORMAT,
  CONTRACT_SCHEMA_VERSION,
  ERROR_CODE_VALUES,
  EVENT_KINDS,
  EVENT_SOURCES,
  EXPERIMENT_PHASES,
  EXPERIMENT_STATUSES,
  FILE_CHANGE_OPERATIONS,
  FRONTMATTER_DOC_TYPES,
  GOAL_HORIZONS,
  GOAL_STATUSES,
  ID_PREFIXES,
  PROFILE_SNAPSHOT_SOURCES,
  REGIMEN_KINDS,
  REGIMEN_STATUSES,
  SAMPLE_QUALITIES,
  SAMPLE_SOURCES,
  SAMPLE_STREAMS,
  SLEEP_STAGES,
  TEST_RESULT_STATUSES,
  VARIANT_SIGNIFICANCES,
  VARIANT_ZYGOSITIES,
} from "./constants.js";
import { GENERIC_CONTRACT_ID_PATTERN, idPattern } from "./ids.js";
import type { EventKind, JsonSchema, SampleStream } from "./types.js";

type StringSchemaOptions = {
  const?: string;
  enum?: readonly string[];
  format?: string;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
};

type NumericSchemaOptions = {
  const?: number;
  minimum?: number;
  maximum?: number;
};

type ArraySchemaOptions = {
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
};

export type { JsonSchema } from "./types.js";

const JSON_SCHEMA_DRAFT = "https://json-schema.org/draft/2020-12/schema";
const DAY_KEY_PATTERN = "^\\d{4}-\\d{2}-\\d{2}$";
const RELATIVE_PATH_PATTERN = "^(?!/)(?!.*(?:^|/)\\.\\.(?:/|$))[A-Za-z0-9._/-]+$";
const RAW_PATH_PATTERN = "^raw/[A-Za-z0-9._/-]+$";
const SLUG_PATTERN = "^[a-z0-9]+(?:-[a-z0-9]+)*$";
const UNIT_PATTERN = "^[A-Za-z0-9._/%-]+$";

function stringSchema(options: StringSchemaOptions = {}): JsonSchema {
  return { type: "string", ...options };
}

function nullableStringSchema(options: StringSchemaOptions = {}): JsonSchema {
  return { type: ["string", "null"], ...options };
}

function idSchema(prefix: string): JsonSchema {
  return stringSchema({ pattern: idPattern(prefix) });
}

function integerSchema(options: NumericSchemaOptions = {}): JsonSchema {
  return { type: "integer", ...options };
}

function numberSchema(options: NumericSchemaOptions = {}): JsonSchema {
  return { type: "number", ...options };
}

function nullableIntegerSchema(options: NumericSchemaOptions = {}): JsonSchema {
  return { type: ["integer", "null"], ...options };
}

function nullableNumberSchema(options: NumericSchemaOptions = {}): JsonSchema {
  return { type: ["number", "null"], ...options };
}

function stringArraySchema(itemSchema: JsonSchema = stringSchema(), options: ArraySchemaOptions = {}): JsonSchema {
  return {
    type: "array",
    items: itemSchema,
    ...options,
  };
}

function closedObject(required: readonly string[], properties: Record<string, JsonSchema>): JsonSchema {
  return {
    type: "object",
    additionalProperties: false,
    required,
    properties,
  };
}

function withDraft(id: string, title: string, schema: JsonSchema): JsonSchema {
  return {
    $schema: JSON_SCHEMA_DRAFT,
    $id: id,
    title,
    ...schema,
  };
}

const baseEventProperties: Record<string, JsonSchema> = {
  schemaVersion: { const: CONTRACT_SCHEMA_VERSION.event },
  id: idSchema(ID_PREFIXES.event),
  kind: stringSchema({ enum: EVENT_KINDS }),
  occurredAt: stringSchema({ format: "date-time" }),
  recordedAt: stringSchema({ format: "date-time" }),
  dayKey: stringSchema({ pattern: DAY_KEY_PATTERN }),
  source: stringSchema({ enum: EVENT_SOURCES }),
  title: stringSchema({ minLength: 1, maxLength: 160 }),
  note: stringSchema({ minLength: 1, maxLength: 4000 }),
  tags: stringArraySchema(stringSchema({ pattern: SLUG_PATTERN }), { uniqueItems: true }),
  relatedIds: stringArraySchema(stringSchema({ pattern: GENERIC_CONTRACT_ID_PATTERN }), { uniqueItems: true }),
  rawRefs: stringArraySchema(stringSchema({ pattern: RAW_PATH_PATTERN }), { uniqueItems: true }),
};

function eventSchema(
  kind: EventKind,
  extraRequired: readonly string[],
  extraProperties: Record<string, JsonSchema>,
): JsonSchema {
  return closedObject(
    [
      "schemaVersion",
      "id",
      "kind",
      "occurredAt",
      "recordedAt",
      "dayKey",
      "source",
      "title",
      ...extraRequired,
    ],
    {
      ...baseEventProperties,
      kind: { const: kind },
      ...extraProperties,
    },
  );
}

const baseSampleProperties: Record<string, JsonSchema> = {
  schemaVersion: { const: CONTRACT_SCHEMA_VERSION.sample },
  id: idSchema(ID_PREFIXES.sample),
  stream: stringSchema({ enum: SAMPLE_STREAMS }),
  recordedAt: stringSchema({ format: "date-time" }),
  dayKey: stringSchema({ pattern: DAY_KEY_PATTERN }),
  source: stringSchema({ enum: SAMPLE_SOURCES }),
  quality: stringSchema({ enum: SAMPLE_QUALITIES }),
};

function sampleSchema(
  stream: SampleStream,
  extraRequired: readonly string[],
  extraProperties: Record<string, JsonSchema>,
): JsonSchema {
  return closedObject(
    [
      "schemaVersion",
      "id",
      "stream",
      "recordedAt",
      "dayKey",
      "source",
      "quality",
      ...extraRequired,
    ],
    {
      ...baseSampleProperties,
      stream: { const: stream },
      ...extraProperties,
    },
  );
}

export const vaultMetadataSchema = withDraft(
  "@healthybob/contracts/vault-metadata.schema.json",
  "Healthy Bob Vault Metadata",
  closedObject(
    [
      "schemaVersion",
      "vaultId",
      "createdAt",
      "title",
      "timezone",
      "idPolicy",
      "paths",
      "shards",
    ],
    {
      schemaVersion: { const: CONTRACT_SCHEMA_VERSION.vault },
      vaultId: idSchema(ID_PREFIXES.vault),
      createdAt: stringSchema({ format: "date-time" }),
      title: stringSchema({ minLength: 1, maxLength: 120 }),
      timezone: stringSchema({ minLength: 3, maxLength: 64 }),
      idPolicy: closedObject(["format", "prefixes"], {
        format: { const: CONTRACT_ID_FORMAT },
        prefixes: closedObject(
          [
            "allergy",
            "assessment",
            "audit",
            "condition",
            "document",
            "event",
            "experiment",
            "family",
            "goal",
            "meal",
            "pack",
            "profileSnapshot",
            "provider",
            "regimen",
            "sample",
            "transform",
            "variant",
            "vault",
          ],
          {
            allergy: { const: ID_PREFIXES.allergy },
            assessment: { const: ID_PREFIXES.assessment },
            audit: { const: ID_PREFIXES.audit },
            condition: { const: ID_PREFIXES.condition },
            document: { const: ID_PREFIXES.document },
            event: { const: ID_PREFIXES.event },
            experiment: { const: ID_PREFIXES.experiment },
            family: { const: ID_PREFIXES.family },
            goal: { const: ID_PREFIXES.goal },
            meal: { const: ID_PREFIXES.meal },
            pack: { const: ID_PREFIXES.pack },
            profileSnapshot: { const: ID_PREFIXES.profileSnapshot },
            provider: { const: ID_PREFIXES.provider },
            regimen: { const: ID_PREFIXES.regimen },
            sample: { const: ID_PREFIXES.sample },
            transform: { const: ID_PREFIXES.transform },
            variant: { const: ID_PREFIXES.variant },
            vault: { const: ID_PREFIXES.vault },
          },
        ),
      }),
      paths: closedObject(
        [
          "allergiesRoot",
          "assessmentLedgerRoot",
          "conditionsRoot",
          "coreDocument",
          "familyRoot",
          "geneticsRoot",
          "goalsRoot",
          "journalRoot",
          "experimentsRoot",
          "profileCurrentDocument",
          "profileRoot",
          "profileSnapshotsRoot",
          "providersRoot",
          "rawAssessmentsRoot",
          "rawRoot",
          "eventsRoot",
          "regimensRoot",
          "samplesRoot",
          "auditRoot",
          "exportsRoot",
        ],
        {
          allergiesRoot: { const: "bank/allergies" },
          assessmentLedgerRoot: { const: "ledger/assessments" },
          conditionsRoot: { const: "bank/conditions" },
          coreDocument: { const: "CORE.md" },
          familyRoot: { const: "bank/family" },
          geneticsRoot: { const: "bank/genetics" },
          goalsRoot: { const: "bank/goals" },
          journalRoot: { const: "journal" },
          experimentsRoot: { const: "bank/experiments" },
          profileCurrentDocument: { const: "bank/profile/current.md" },
          profileRoot: { const: "bank/profile" },
          profileSnapshotsRoot: { const: "ledger/profile-snapshots" },
          providersRoot: { const: "bank/providers" },
          rawAssessmentsRoot: { const: "raw/assessments" },
          rawRoot: { const: "raw" },
          eventsRoot: { const: "ledger/events" },
          regimensRoot: { const: "bank/regimens" },
          samplesRoot: { const: "ledger/samples" },
          auditRoot: { const: "audit" },
          exportsRoot: { const: "exports" },
        },
      ),
      shards: closedObject(["assessments", "events", "profileSnapshots", "samples", "audit"], {
        assessments: { const: "ledger/assessments/YYYY/YYYY-MM.jsonl" },
        events: { const: "ledger/events/YYYY/YYYY-MM.jsonl" },
        profileSnapshots: { const: "ledger/profile-snapshots/YYYY/YYYY-MM.jsonl" },
        samples: { const: "ledger/samples/<stream>/YYYY/YYYY-MM.jsonl" },
        audit: { const: "audit/YYYY/YYYY-MM.jsonl" },
      }),
    },
  ),
);

export const eventRecordSchema = withDraft(
  "@healthybob/contracts/event-record.schema.json",
  "Healthy Bob Event Record",
  {
    oneOf: [
      eventSchema("document", ["documentId", "documentPath", "mimeType"], {
        documentId: idSchema(ID_PREFIXES.document),
        documentPath: stringSchema({ pattern: "^raw/documents/[A-Za-z0-9._/-]+$" }),
        mimeType: stringSchema({ minLength: 3, maxLength: 120 }),
        providerId: idSchema(ID_PREFIXES.provider),
      }),
      eventSchema("encounter", ["encounterType"], {
        encounterType: stringSchema({ minLength: 1, maxLength: 160 }),
        location: stringSchema({ minLength: 1, maxLength: 160 }),
        providerId: idSchema(ID_PREFIXES.provider),
      }),
      eventSchema("meal", ["mealId", "photoPaths", "audioPaths"], {
        mealId: idSchema(ID_PREFIXES.meal),
        photoPaths: stringArraySchema(stringSchema({ pattern: "^raw/meals/[A-Za-z0-9._/-]+$" }), {
          minItems: 1,
        }),
        audioPaths: stringArraySchema(stringSchema({ pattern: "^raw/meals/[A-Za-z0-9._/-]+$" })),
      }),
      eventSchema("symptom", ["symptom", "intensity"], {
        symptom: stringSchema({ minLength: 1, maxLength: 120 }),
        intensity: integerSchema({ minimum: 0, maximum: 10 }),
        bodySite: stringSchema({ minLength: 1, maxLength: 120 }),
      }),
      eventSchema("note", ["note"], {}),
      eventSchema("observation", ["metric", "value", "unit"], {
        metric: stringSchema({ pattern: SLUG_PATTERN }),
        value: numberSchema(),
        unit: stringSchema({ pattern: UNIT_PATTERN }),
      }),
      eventSchema("experiment_event", ["experimentId", "experimentSlug", "phase"], {
        experimentId: idSchema(ID_PREFIXES.experiment),
        experimentSlug: stringSchema({ pattern: SLUG_PATTERN }),
        phase: stringSchema({ enum: EXPERIMENT_PHASES }),
      }),
      eventSchema("medication_intake", ["medicationName", "dose", "unit"], {
        medicationName: stringSchema({ minLength: 1, maxLength: 160 }),
        dose: numberSchema({ minimum: 0 }),
        unit: stringSchema({ pattern: UNIT_PATTERN }),
      }),
      eventSchema("procedure", ["procedure", "status"], {
        procedure: stringSchema({ minLength: 1, maxLength: 160 }),
        status: stringSchema({ minLength: 1, maxLength: 64 }),
      }),
      eventSchema("supplement_intake", ["supplementName", "dose", "unit"], {
        supplementName: stringSchema({ minLength: 1, maxLength: 160 }),
        dose: numberSchema({ minimum: 0 }),
        unit: stringSchema({ pattern: UNIT_PATTERN }),
      }),
      eventSchema("test", ["testName", "resultStatus"], {
        testName: stringSchema({ minLength: 1, maxLength: 160 }),
        resultStatus: stringSchema({ enum: TEST_RESULT_STATUSES }),
        summary: stringSchema({ minLength: 1, maxLength: 4000 }),
      }),
      eventSchema("activity_session", ["activityType", "durationMinutes"], {
        activityType: stringSchema({ pattern: SLUG_PATTERN }),
        durationMinutes: integerSchema({ minimum: 1 }),
        distanceKm: numberSchema({ minimum: 0 }),
      }),
      eventSchema("sleep_session", ["startAt", "endAt", "durationMinutes"], {
        startAt: stringSchema({ format: "date-time" }),
        endAt: stringSchema({ format: "date-time" }),
        durationMinutes: integerSchema({ minimum: 1 }),
      }),
      eventSchema("adverse_effect", ["substance", "effect", "severity"], {
        substance: stringSchema({ minLength: 1, maxLength: 160 }),
        effect: stringSchema({ minLength: 1, maxLength: 160 }),
        severity: stringSchema({ enum: ADVERSE_EFFECT_SEVERITIES }),
      }),
      eventSchema("exposure", ["exposureType", "substance"], {
        exposureType: stringSchema({ minLength: 1, maxLength: 160 }),
        substance: stringSchema({ minLength: 1, maxLength: 160 }),
        duration: stringSchema({ minLength: 1, maxLength: 120 }),
      }),
    ],
  },
);

export const sampleRecordSchema = withDraft(
  "@healthybob/contracts/sample-record.schema.json",
  "Healthy Bob Sample Record",
  {
    oneOf: [
      sampleSchema("heart_rate", ["value", "unit"], {
        value: integerSchema({ minimum: 0 }),
        unit: { const: "bpm" },
      }),
      sampleSchema("hrv", ["value", "unit"], {
        value: numberSchema({ minimum: 0 }),
        unit: { const: "ms" },
      }),
      sampleSchema("steps", ["value", "unit"], {
        value: integerSchema({ minimum: 0 }),
        unit: { const: "count" },
      }),
      sampleSchema("sleep_stage", ["stage", "startAt", "endAt", "durationMinutes", "unit"], {
        stage: stringSchema({ enum: SLEEP_STAGES }),
        startAt: stringSchema({ format: "date-time" }),
        endAt: stringSchema({ format: "date-time" }),
        durationMinutes: integerSchema({ minimum: 1 }),
        unit: { const: "stage" },
      }),
      sampleSchema("respiratory_rate", ["value", "unit"], {
        value: numberSchema({ minimum: 0 }),
        unit: { const: "breaths_per_minute" },
      }),
      sampleSchema("temperature", ["value", "unit"], {
        value: numberSchema(),
        unit: { const: "celsius" },
      }),
      sampleSchema("glucose", ["value", "unit"], {
        value: numberSchema({ minimum: 0 }),
        unit: { const: "mg_dL" },
      }),
    ],
  },
);

export const auditRecordSchema = withDraft(
  "@healthybob/contracts/audit-record.schema.json",
  "Healthy Bob Audit Record",
  closedObject(
    ["schemaVersion", "id", "action", "status", "occurredAt", "actor", "commandName", "summary", "changes"],
    {
      schemaVersion: { const: CONTRACT_SCHEMA_VERSION.audit },
      id: idSchema(ID_PREFIXES.audit),
      action: stringSchema({ enum: AUDIT_ACTIONS }),
      status: stringSchema({ enum: AUDIT_STATUSES }),
      occurredAt: stringSchema({ format: "date-time" }),
      actor: stringSchema({ enum: AUDIT_ACTORS }),
      commandName: stringSchema({ minLength: 1, maxLength: 160 }),
      summary: stringSchema({ minLength: 1, maxLength: 4000 }),
      targetIds: stringArraySchema(stringSchema({ pattern: GENERIC_CONTRACT_ID_PATTERN }), { uniqueItems: true }),
      errorCode: stringSchema({ enum: ERROR_CODE_VALUES }),
      changes: {
        type: "array",
        items: closedObject(["path", "op"], {
          path: stringSchema({ pattern: RELATIVE_PATH_PATTERN }),
          op: stringSchema({ enum: FILE_CHANGE_OPERATIONS }),
        }),
      },
    },
  ),
);

export const coreFrontmatterSchema = withDraft(
  "@healthybob/contracts/frontmatter-core.schema.json",
  "Healthy Bob CORE Frontmatter",
  closedObject(
    ["schemaVersion", "docType", "vaultId", "title", "timezone", "updatedAt"],
    {
      schemaVersion: { const: CONTRACT_SCHEMA_VERSION.coreFrontmatter },
      docType: { const: FRONTMATTER_DOC_TYPES.core },
      vaultId: idSchema(ID_PREFIXES.vault),
      title: stringSchema({ minLength: 1, maxLength: 160 }),
      timezone: stringSchema({ minLength: 3, maxLength: 64 }),
      updatedAt: stringSchema({ format: "date-time" }),
      activeExperimentSlugs: stringArraySchema(stringSchema({ pattern: SLUG_PATTERN }), { uniqueItems: true }),
    },
  ),
);

export const journalDayFrontmatterSchema = withDraft(
  "@healthybob/contracts/frontmatter-journal-day.schema.json",
  "Healthy Bob Journal Day Frontmatter",
  closedObject(
    ["schemaVersion", "docType", "dayKey", "eventIds", "sampleStreams"],
    {
      schemaVersion: { const: CONTRACT_SCHEMA_VERSION.journalDayFrontmatter },
      docType: { const: FRONTMATTER_DOC_TYPES.journalDay },
      dayKey: stringSchema({ pattern: DAY_KEY_PATTERN }),
      eventIds: stringArraySchema(idSchema(ID_PREFIXES.event), { uniqueItems: true }),
      sampleStreams: stringArraySchema(stringSchema({ enum: SAMPLE_STREAMS }), { uniqueItems: true }),
    },
  ),
);

export const experimentFrontmatterSchema = withDraft(
  "@healthybob/contracts/frontmatter-experiment.schema.json",
  "Healthy Bob Experiment Frontmatter",
  closedObject(
    ["schemaVersion", "docType", "experimentId", "slug", "status", "title", "startedOn"],
    {
      schemaVersion: { const: CONTRACT_SCHEMA_VERSION.experimentFrontmatter },
      docType: { const: FRONTMATTER_DOC_TYPES.experiment },
      experimentId: idSchema(ID_PREFIXES.experiment),
      slug: stringSchema({ pattern: SLUG_PATTERN }),
      status: stringSchema({ enum: EXPERIMENT_STATUSES }),
      title: stringSchema({ minLength: 1, maxLength: 160 }),
      startedOn: stringSchema({ format: "date" }),
      endedOn: stringSchema({ format: "date" }),
      hypothesis: stringSchema({ minLength: 1, maxLength: 4000 }),
      tags: stringArraySchema(stringSchema({ pattern: SLUG_PATTERN }), { uniqueItems: true }),
    },
  ),
);

export const assessmentResponseSchema = withDraft(
  "@healthybob/contracts/assessment-response.schema.json",
  "Healthy Bob Assessment Response",
  closedObject(
    ["schemaVersion", "id", "assessmentType", "recordedAt", "source", "rawPath", "responses"],
    {
      schemaVersion: { const: CONTRACT_SCHEMA_VERSION.assessmentResponse },
      id: idSchema(ID_PREFIXES.assessment),
      assessmentType: stringSchema({ pattern: SLUG_PATTERN }),
      recordedAt: stringSchema({ format: "date-time" }),
      source: stringSchema({ enum: ASSESSMENT_SOURCES }),
      rawPath: stringSchema({ pattern: "^raw/assessments/[A-Za-z0-9._/-]+/source\\.json$" }),
      title: stringSchema({ minLength: 1, maxLength: 160 }),
      questionnaireSlug: stringSchema({ pattern: SLUG_PATTERN }),
      responses: { type: "object", additionalProperties: true },
      relatedIds: stringArraySchema(stringSchema({ pattern: GENERIC_CONTRACT_ID_PATTERN }), { uniqueItems: true }),
    },
  ),
);

export const profileSnapshotSchema = withDraft(
  "@healthybob/contracts/profile-snapshot.schema.json",
  "Healthy Bob Profile Snapshot",
  closedObject(
    ["schemaVersion", "id", "recordedAt", "source", "profile"],
    {
      schemaVersion: { const: CONTRACT_SCHEMA_VERSION.profileSnapshot },
      id: idSchema(ID_PREFIXES.profileSnapshot),
      recordedAt: stringSchema({ format: "date-time" }),
      source: stringSchema({ enum: PROFILE_SNAPSHOT_SOURCES }),
      sourceAssessmentIds: stringArraySchema(idSchema(ID_PREFIXES.assessment), { uniqueItems: true }),
      sourceEventIds: stringArraySchema(idSchema(ID_PREFIXES.event), { uniqueItems: true }),
      profile: { type: "object", additionalProperties: true },
    },
  ),
);

export const profileCurrentFrontmatterSchema = withDraft(
  "@healthybob/contracts/frontmatter-profile-current.schema.json",
  "Healthy Bob Profile Current Frontmatter",
  closedObject(
    ["schemaVersion", "docType", "snapshotId", "updatedAt"],
    {
      schemaVersion: { const: CONTRACT_SCHEMA_VERSION.profileCurrentFrontmatter },
      docType: { const: FRONTMATTER_DOC_TYPES.profileCurrent },
      snapshotId: idSchema(ID_PREFIXES.profileSnapshot),
      updatedAt: stringSchema({ format: "date-time" }),
      sourceAssessmentIds: stringArraySchema(idSchema(ID_PREFIXES.assessment), { uniqueItems: true }),
      sourceEventIds: stringArraySchema(idSchema(ID_PREFIXES.event), { uniqueItems: true }),
      topGoalIds: stringArraySchema(idSchema(ID_PREFIXES.goal), { uniqueItems: true }),
    },
  ),
);

export const goalFrontmatterSchema = withDraft(
  "@healthybob/contracts/frontmatter-goal.schema.json",
  "Healthy Bob Goal Frontmatter",
  closedObject(
    ["schemaVersion", "docType", "goalId", "slug", "title", "status", "horizon", "priority", "window"],
    {
      schemaVersion: { const: CONTRACT_SCHEMA_VERSION.goalFrontmatter },
      docType: { const: FRONTMATTER_DOC_TYPES.goal },
      goalId: idSchema(ID_PREFIXES.goal),
      slug: stringSchema({ pattern: SLUG_PATTERN }),
      title: stringSchema({ minLength: 1, maxLength: 160 }),
      status: stringSchema({ enum: GOAL_STATUSES }),
      horizon: stringSchema({ enum: GOAL_HORIZONS }),
      priority: integerSchema({ minimum: 1, maximum: 10 }),
      window: closedObject(["startAt"], {
        startAt: stringSchema({ format: "date" }),
        targetAt: stringSchema({ format: "date" }),
      }),
      parentGoalId: { type: ["string", "null"], pattern: idPattern(ID_PREFIXES.goal) },
      relatedGoalIds: stringArraySchema(idSchema(ID_PREFIXES.goal), { uniqueItems: true }),
      relatedExperimentIds: stringArraySchema(idSchema(ID_PREFIXES.experiment), { uniqueItems: true }),
      domains: stringArraySchema(stringSchema({ pattern: SLUG_PATTERN }), { uniqueItems: true }),
    },
  ),
);

export const conditionFrontmatterSchema = withDraft(
  "@healthybob/contracts/frontmatter-condition.schema.json",
  "Healthy Bob Condition Frontmatter",
  closedObject(
    ["schemaVersion", "docType", "conditionId", "slug", "title", "clinicalStatus"],
    {
      schemaVersion: { const: CONTRACT_SCHEMA_VERSION.conditionFrontmatter },
      docType: { const: FRONTMATTER_DOC_TYPES.condition },
      conditionId: idSchema(ID_PREFIXES.condition),
      slug: stringSchema({ pattern: SLUG_PATTERN }),
      title: stringSchema({ minLength: 1, maxLength: 160 }),
      clinicalStatus: stringSchema({ enum: CONDITION_CLINICAL_STATUSES }),
      verificationStatus: stringSchema({ enum: CONDITION_VERIFICATION_STATUSES }),
      assertedOn: stringSchema({ format: "date" }),
      resolvedOn: stringSchema({ format: "date" }),
      severity: stringSchema({ enum: CONDITION_SEVERITIES }),
      bodySites: stringArraySchema(stringSchema({ minLength: 1, maxLength: 120 }), { uniqueItems: true }),
      relatedGoalIds: stringArraySchema(idSchema(ID_PREFIXES.goal), { uniqueItems: true }),
      relatedRegimenIds: stringArraySchema(idSchema(ID_PREFIXES.regimen), { uniqueItems: true }),
      note: stringSchema({ minLength: 1, maxLength: 4000 }),
    },
  ),
);

export const allergyFrontmatterSchema = withDraft(
  "@healthybob/contracts/frontmatter-allergy.schema.json",
  "Healthy Bob Allergy Frontmatter",
  closedObject(
    ["schemaVersion", "docType", "allergyId", "slug", "title", "substance", "status"],
    {
      schemaVersion: { const: CONTRACT_SCHEMA_VERSION.allergyFrontmatter },
      docType: { const: FRONTMATTER_DOC_TYPES.allergy },
      allergyId: idSchema(ID_PREFIXES.allergy),
      slug: stringSchema({ pattern: SLUG_PATTERN }),
      title: stringSchema({ minLength: 1, maxLength: 160 }),
      substance: stringSchema({ minLength: 1, maxLength: 160 }),
      status: stringSchema({ enum: ALLERGY_STATUSES }),
      criticality: stringSchema({ enum: ALLERGY_CRITICALITIES }),
      reaction: stringSchema({ minLength: 1, maxLength: 160 }),
      recordedOn: stringSchema({ format: "date" }),
      relatedConditionIds: stringArraySchema(idSchema(ID_PREFIXES.condition), { uniqueItems: true }),
      note: stringSchema({ minLength: 1, maxLength: 4000 }),
    },
  ),
);

export const regimenFrontmatterSchema = withDraft(
  "@healthybob/contracts/frontmatter-regimen.schema.json",
  "Healthy Bob Regimen Frontmatter",
  closedObject(
    ["schemaVersion", "docType", "regimenId", "slug", "title", "kind", "status", "startedOn"],
    {
      schemaVersion: { const: CONTRACT_SCHEMA_VERSION.regimenFrontmatter },
      docType: { const: FRONTMATTER_DOC_TYPES.regimen },
      regimenId: idSchema(ID_PREFIXES.regimen),
      slug: stringSchema({ pattern: SLUG_PATTERN }),
      title: stringSchema({ minLength: 1, maxLength: 160 }),
      kind: stringSchema({ enum: REGIMEN_KINDS }),
      status: stringSchema({ enum: REGIMEN_STATUSES }),
      startedOn: stringSchema({ format: "date" }),
      stoppedOn: stringSchema({ format: "date" }),
      substance: stringSchema({ minLength: 1, maxLength: 160 }),
      dose: numberSchema({ minimum: 0 }),
      unit: stringSchema({ pattern: UNIT_PATTERN }),
      schedule: stringSchema({ minLength: 1, maxLength: 160 }),
      relatedGoalIds: stringArraySchema(idSchema(ID_PREFIXES.goal), { uniqueItems: true }),
      relatedConditionIds: stringArraySchema(idSchema(ID_PREFIXES.condition), { uniqueItems: true }),
    },
  ),
);

export const familyMemberFrontmatterSchema = withDraft(
  "@healthybob/contracts/frontmatter-family-member.schema.json",
  "Healthy Bob Family Member Frontmatter",
  closedObject(
    ["schemaVersion", "docType", "familyMemberId", "slug", "title", "relationship"],
    {
      schemaVersion: { const: CONTRACT_SCHEMA_VERSION.familyMemberFrontmatter },
      docType: { const: FRONTMATTER_DOC_TYPES.familyMember },
      familyMemberId: idSchema(ID_PREFIXES.family),
      slug: stringSchema({ pattern: SLUG_PATTERN }),
      title: stringSchema({ minLength: 1, maxLength: 160 }),
      relationship: stringSchema({ minLength: 1, maxLength: 120 }),
      conditions: stringArraySchema(stringSchema({ minLength: 1, maxLength: 160 }), { uniqueItems: true }),
      deceased: { type: "boolean" },
      note: stringSchema({ minLength: 1, maxLength: 4000 }),
      relatedVariantIds: stringArraySchema(idSchema(ID_PREFIXES.variant), { uniqueItems: true }),
    },
  ),
);

export const geneticVariantFrontmatterSchema = withDraft(
  "@healthybob/contracts/frontmatter-genetic-variant.schema.json",
  "Healthy Bob Genetic Variant Frontmatter",
  closedObject(
    ["schemaVersion", "docType", "variantId", "slug", "title", "gene"],
    {
      schemaVersion: { const: CONTRACT_SCHEMA_VERSION.geneticVariantFrontmatter },
      docType: { const: FRONTMATTER_DOC_TYPES.geneticVariant },
      variantId: idSchema(ID_PREFIXES.variant),
      slug: stringSchema({ pattern: SLUG_PATTERN }),
      title: stringSchema({ minLength: 1, maxLength: 160 }),
      gene: stringSchema({ minLength: 1, maxLength: 40 }),
      zygosity: stringSchema({ enum: VARIANT_ZYGOSITIES }),
      significance: stringSchema({ enum: VARIANT_SIGNIFICANCES }),
      inheritance: stringSchema({ minLength: 1, maxLength: 120 }),
      sourceFamilyMemberIds: stringArraySchema(idSchema(ID_PREFIXES.family), { uniqueItems: true }),
      note: stringSchema({ minLength: 1, maxLength: 4000 }),
    },
  ),
);

export const schemaCatalog = Object.freeze({
  "assessment-response": assessmentResponseSchema,
  "audit-record": auditRecordSchema,
  "event-record": eventRecordSchema,
  "frontmatter-allergy": allergyFrontmatterSchema,
  "frontmatter-condition": conditionFrontmatterSchema,
  "frontmatter-core": coreFrontmatterSchema,
  "frontmatter-experiment": experimentFrontmatterSchema,
  "frontmatter-family-member": familyMemberFrontmatterSchema,
  "frontmatter-genetic-variant": geneticVariantFrontmatterSchema,
  "frontmatter-goal": goalFrontmatterSchema,
  "frontmatter-journal-day": journalDayFrontmatterSchema,
  "frontmatter-profile-current": profileCurrentFrontmatterSchema,
  "frontmatter-regimen": regimenFrontmatterSchema,
  "profile-snapshot": profileSnapshotSchema,
  "sample-record": sampleRecordSchema,
  "vault-metadata": vaultMetadataSchema,
});
