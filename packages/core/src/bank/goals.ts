import { emitAuditRecord } from "../audit.js";
import { VaultError } from "../errors.js";
import { stringifyFrontmatterDocument } from "../frontmatter.js";
import { writeVaultTextFile } from "../fs.js";
import { generateRecordId } from "../ids.js";

import {
  GOAL_DOC_TYPE,
  GOAL_HORIZONS,
  GOALS_DIRECTORY,
  GOAL_SCHEMA_VERSION,
  GOAL_STATUSES,
} from "./types.js";
import {
  detailList,
  findRecordByIdOrSlug,
  loadMarkdownRegistry,
  normalizeDateOnly,
  normalizeDomainList,
  normalizePriority,
  normalizeRecordIdList,
  normalizeSelectorSlug,
  optionalDateOnly,
  optionalEnum,
  requireMatchingDocType,
  requireObject,
  requireString,
  section,
  selectRecordByIdOrSlug,
  stripUndefined,
  normalizeId,
  normalizeSlug,
} from "./shared.js";

import type { FrontmatterObject } from "../types.js";
import type { GoalRecord, GoalWindow, ReadGoalInput, UpsertGoalInput, UpsertGoalResult } from "./types.js";

function normalizeGoalWindow(value: unknown, fieldName: string): GoalWindow {
  const candidate = requireObject(value, fieldName);
  const startAt = normalizeDateOnly(candidate.startAt as string, `${fieldName}.startAt`);
  const targetAt = optionalDateOnly(candidate.targetAt as string | undefined, `${fieldName}.targetAt`);

  if (targetAt && targetAt < startAt) {
    throw new VaultError("VAULT_INVALID_INPUT", `${fieldName}.targetAt must be on or after startAt.`);
  }

  return stripUndefined({
    startAt,
    targetAt,
  });
}

function buildBody(record: GoalRecord): string {
  return [
    `# ${record.title}`,
    "",
    detailList([
      ["Status", record.status],
      ["Horizon", record.horizon],
      ["Priority", record.priority],
    ]),
    "",
    section(
      "Window",
      detailList([
        ["Start", record.window.startAt],
        ["Target", record.window.targetAt],
      ]),
    ),
    "",
    section(
      "Relationships",
      detailList([
        ["Parent goal", record.parentGoalId],
      ]),
    ),
    "",
    section("Related Goals", record.relatedGoalIds ? record.relatedGoalIds.map((value) => `- ${value}`).join("\n") : "- none"),
    "",
    section(
      "Related Experiments",
      record.relatedExperimentIds ? record.relatedExperimentIds.map((value) => `- ${value}`).join("\n") : "- none",
    ),
    "",
    section("Domains", record.domains ? record.domains.map((value) => `- ${value}`).join("\n") : "- none"),
    "",
  ].join("\n");
}

function recordFromParts(attributes: FrontmatterObject, relativePath: string, markdown: string): GoalRecord {
  requireMatchingDocType(
    attributes,
    GOAL_SCHEMA_VERSION,
    GOAL_DOC_TYPE,
    "VAULT_INVALID_GOAL",
    "Goal registry document has an unexpected shape.",
  );

  return stripUndefined({
    schemaVersion: GOAL_SCHEMA_VERSION,
    docType: GOAL_DOC_TYPE,
    goalId: requireString(attributes.goalId, "goalId", 64),
    slug: requireString(attributes.slug, "slug", 160),
    title: requireString(attributes.title, "title", 160),
    status: optionalEnum(attributes.status, GOAL_STATUSES, "status") ?? "active",
    horizon: optionalEnum(attributes.horizon, GOAL_HORIZONS, "horizon") ?? "ongoing",
    priority: normalizePriority(attributes.priority),
    window: normalizeGoalWindow(attributes.window, "window"),
    parentGoalId:
      attributes.parentGoalId === null
        ? null
        : normalizeId(attributes.parentGoalId, "parentGoalId", "goal"),
    relatedGoalIds: normalizeRecordIdList(attributes.relatedGoalIds, "relatedGoalIds", "goal"),
    relatedExperimentIds: normalizeRecordIdList(attributes.relatedExperimentIds, "relatedExperimentIds", "exp"),
    domains: normalizeDomainList(attributes.domains, "domains"),
    relativePath,
    markdown,
  });
}

function buildAttributes(record: GoalRecord): FrontmatterObject {
  const windowAttributes: FrontmatterObject = {
    startAt: record.window.startAt,
  };

  if (record.window.targetAt !== undefined) {
    windowAttributes.targetAt = record.window.targetAt;
  }

  const attributes: FrontmatterObject = {
    schemaVersion: GOAL_SCHEMA_VERSION,
    docType: GOAL_DOC_TYPE,
    goalId: record.goalId,
    slug: record.slug,
    title: record.title,
    status: record.status,
    horizon: record.horizon,
    priority: record.priority,
    window: windowAttributes,
  };

  if (record.parentGoalId !== undefined) {
    attributes.parentGoalId = record.parentGoalId;
  }

  if (record.relatedGoalIds !== undefined) {
    attributes.relatedGoalIds = record.relatedGoalIds;
  }

  if (record.relatedExperimentIds !== undefined) {
    attributes.relatedExperimentIds = record.relatedExperimentIds;
  }

  if (record.domains !== undefined) {
    attributes.domains = record.domains;
  }

  return attributes;
}

async function loadGoals(vaultRoot: string): Promise<GoalRecord[]> {
  return loadMarkdownRegistry(
    vaultRoot,
    GOALS_DIRECTORY,
    recordFromParts,
    (left, right) =>
      right.priority - left.priority ||
      left.window.startAt.localeCompare(right.window.startAt) ||
      left.title.localeCompare(right.title) ||
      left.goalId.localeCompare(right.goalId),
  );
}

function ensureGoalLinks(record: GoalRecord): GoalRecord {
  if (record.parentGoalId && record.parentGoalId === record.goalId) {
    throw new VaultError("VAULT_INVALID_INPUT", "parentGoalId may not equal goalId.");
  }

  if (record.relatedGoalIds?.includes(record.goalId)) {
    throw new VaultError("VAULT_INVALID_INPUT", "relatedGoalIds may not include goalId.");
  }

  return record;
}

export async function upsertGoal(input: UpsertGoalInput): Promise<UpsertGoalResult> {
  const normalizedGoalId = normalizeId(input.goalId, "goalId", "goal");
  const existingRecords = await loadGoals(input.vaultRoot);
  const selectorSlug =
    normalizeSelectorSlug(input.slug) ??
    (input.title ? normalizeSlug(undefined, "slug", input.title) : undefined);
  const existingRecord = selectRecordByIdOrSlug(
    existingRecords,
    normalizedGoalId,
    selectorSlug,
    (record) => record.goalId,
    "Goal",
    "VAULT_GOAL_CONFLICT",
  );
  const title = requireString(input.title ?? existingRecord?.title, "title", 160);
  const slug = existingRecord?.slug ?? selectorSlug ?? normalizeSlug(undefined, "slug", title);
  const goalId = existingRecord?.goalId ?? normalizedGoalId ?? generateRecordId("goal");
  const existingWindow = existingRecord?.window;
  const record: GoalRecord = {
    schemaVersion: GOAL_SCHEMA_VERSION,
    docType: GOAL_DOC_TYPE,
    goalId,
    slug: existingRecord?.slug ?? slug,
    title,
    status:
      input.status === undefined
        ? existingRecord?.status ?? "active"
        : optionalEnum(input.status, GOAL_STATUSES, "status") ?? "active",
    horizon:
      input.horizon === undefined
        ? existingRecord?.horizon ?? "ongoing"
        : optionalEnum(input.horizon, GOAL_HORIZONS, "horizon") ?? "ongoing",
    priority: input.priority === undefined ? existingRecord?.priority ?? 5 : normalizePriority(input.priority),
    window: normalizeGoalWindow(
      {
        startAt: input.window?.startAt ?? existingWindow?.startAt ?? new Date(),
        targetAt:
          input.window?.targetAt === undefined ? existingWindow?.targetAt : input.window.targetAt,
      },
      "window",
    ),
    relativePath: existingRecord?.relativePath ?? `${GOALS_DIRECTORY}/${slug}.md`,
    markdown: existingRecord?.markdown ?? "",
  };

  const parentGoalId =
    input.parentGoalId === undefined
      ? existingRecord?.parentGoalId
      : input.parentGoalId === null
        ? null
        : normalizeId(input.parentGoalId, "parentGoalId", "goal");
  if (parentGoalId !== undefined) {
    record.parentGoalId = parentGoalId;
  }

  const relatedGoalIds =
    input.relatedGoalIds === undefined
      ? existingRecord?.relatedGoalIds
      : normalizeRecordIdList(input.relatedGoalIds, "relatedGoalIds", "goal");
  if (relatedGoalIds !== undefined) {
    record.relatedGoalIds = relatedGoalIds;
  }

  const relatedExperimentIds =
    input.relatedExperimentIds === undefined
      ? existingRecord?.relatedExperimentIds
      : normalizeRecordIdList(input.relatedExperimentIds, "relatedExperimentIds", "exp");
  if (relatedExperimentIds !== undefined) {
    record.relatedExperimentIds = relatedExperimentIds;
  }

  const domains =
    input.domains === undefined
      ? existingRecord?.domains
      : normalizeDomainList(input.domains, "domains");
  if (domains !== undefined) {
    record.domains = domains;
  }

  ensureGoalLinks(record);
  const markdown = stringifyFrontmatterDocument({
    attributes: buildAttributes(record),
    body: buildBody(record),
  });

  await writeVaultTextFile(input.vaultRoot, record.relativePath, markdown);
  const audit = await emitAuditRecord({
    vaultRoot: input.vaultRoot,
    action: "goal_upsert",
    commandName: "core.upsertGoal",
    summary: `Upserted goal ${record.goalId}.`,
    targetIds: [record.goalId],
    changes: [
      {
        path: record.relativePath,
        op: existingRecord ? "update" : "create",
      },
    ],
  });

  return {
    created: !existingRecord,
    auditPath: audit.relativePath,
    record: {
      ...record,
      markdown,
    },
  };
}

export async function listGoals(vaultRoot: string): Promise<GoalRecord[]> {
  return loadGoals(vaultRoot);
}

export async function readGoal({ vaultRoot, goalId, slug }: ReadGoalInput): Promise<GoalRecord> {
  const normalizedGoalId = normalizeId(goalId, "goalId", "goal");
  const normalizedSlug = normalizeSelectorSlug(slug);
  const records = await loadGoals(vaultRoot);
  const match = findRecordByIdOrSlug(records, normalizedGoalId, normalizedSlug, (record) => record.goalId);

  if (!match) {
    throw new VaultError("VAULT_GOAL_MISSING", "Goal was not found.");
  }

  return match;
}
