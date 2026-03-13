import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "vitest";
import { requireData, runCli } from "./cli-test-helpers.js";

test.sequential("intake show and intake list route assessment reads through the noun-specific commands", async () => {
  const vaultRoot = await mkdtemp(path.join(tmpdir(), "healthybob-cli-health-"));

  try {
    await runCli(["init", "--vault", vaultRoot]);
    await mkdir(path.join(vaultRoot, "ledger/assessments/2026"), {
      recursive: true,
    });
    await writeFile(
      path.join(vaultRoot, "ledger/assessments/2026/2026-03.jsonl"),
      `${JSON.stringify({
        schemaVersion: "hb.assessment-response.v1",
        id: "asmt_cli_01",
        assessmentType: "full-intake",
        recordedAt: "2026-03-12T13:00:00Z",
        source: "import",
        rawPath: "raw/assessments/2026/03/asmt_cli_01/source.json",
        title: "CLI intake fixture",
        responses: {
          sleep: {
            averageHours: 6,
          },
        },
      })}\n`,
      "utf8",
    );

    const showResult = await runCli<{
      entity: {
        id: string;
        kind: string;
        data: Record<string, unknown>;
      };
    }>([
      "intake",
      "show",
      "asmt_cli_01",
      "--vault",
      vaultRoot,
    ]);
    const listResult = await runCli<{
      count: number;
      items: Array<{
        id: string;
        kind: string;
        data: Record<string, unknown>;
        links: Array<{ id: string }>;
      }>;
    }>([
      "intake",
      "list",
      "--vault",
      vaultRoot,
    ]);

    assert.equal(showResult.ok, true);
    assert.equal(requireData(showResult).entity.id, "asmt_cli_01");
    assert.equal(requireData(showResult).entity.kind, "assessment");
    assert.equal(requireData(showResult).entity.data.assessmentType, "full-intake");
    assert.equal(listResult.ok, true);
    assert.equal(requireData(listResult).count, 1);
    assert.deepEqual(
      requireData(listResult).items.map((item) => item.id),
      ["asmt_cli_01"],
    );
    assert.deepEqual(
      requireData(listResult).items.map((item) => item.kind),
      ["assessment"],
    );
    assert.equal(requireData(listResult).items[0]?.data.assessmentType, "full-intake");
  } finally {
    await rm(vaultRoot, { recursive: true, force: true });
  }
});

test.sequential("intake list applies date bounds and echoes renamed filter keys", async () => {
  const vaultRoot = await mkdtemp(path.join(tmpdir(), "healthybob-cli-health-"));

  try {
    await runCli(["init", "--vault", vaultRoot]);
    await mkdir(path.join(vaultRoot, "ledger/assessments/2026"), {
      recursive: true,
    });
    await writeFile(
      path.join(vaultRoot, "ledger/assessments/2026/2026-03.jsonl"),
      [
        JSON.stringify({
          schemaVersion: "hb.assessment-response.v1",
          id: "asmt_cli_out_of_range",
          assessmentType: "full-intake",
          recordedAt: "2026-03-10T13:00:00Z",
          source: "import",
          rawPath: "raw/assessments/2026/03/asmt_cli_out_of_range/source.json",
          title: "Outside the requested range",
          responses: {
            sleep: {
              averageHours: 5,
            },
          },
        }),
        JSON.stringify({
          schemaVersion: "hb.assessment-response.v1",
          id: "asmt_cli_in_range",
          assessmentType: "full-intake",
          recordedAt: "2026-03-12T13:00:00Z",
          source: "import",
          rawPath: "raw/assessments/2026/03/asmt_cli_in_range/source.json",
          title: "Inside the requested range",
          responses: {
            sleep: {
              averageHours: 7,
            },
          },
        }),
        "",
      ].join("\n"),
      "utf8",
    );

    const listResult = await runCli<{
      count: number;
      filters: Record<string, unknown>;
      items: Array<{
        id: string;
      }>;
    }>([
      "intake",
      "list",
      "--from",
      "2026-03-12",
      "--to",
      "2026-03-12",
      "--vault",
      vaultRoot,
    ]);

    assert.equal(listResult.ok, true);
    assert.equal(requireData(listResult).filters.from, "2026-03-12");
    assert.equal(requireData(listResult).filters.to, "2026-03-12");
    assert.equal("dateFrom" in requireData(listResult).filters, false);
    assert.equal("dateTo" in requireData(listResult).filters, false);
    assert.equal(requireData(listResult).count, 1);
    assert.deepEqual(
      requireData(listResult).items.map((item) => item.id),
      ["asmt_cli_in_range"],
    );
  } finally {
    await rm(vaultRoot, { recursive: true, force: true });
  }
});

test.sequential("goal descriptor wiring keeps noun-specific and generic reads aligned", async () => {
  const vaultRoot = await mkdtemp(path.join(tmpdir(), "healthybob-cli-health-"));
  const payloadPath = path.join(vaultRoot, "goal.json");

  try {
    await runCli(["init", "--vault", vaultRoot]);
    await writeFile(
      payloadPath,
      JSON.stringify({
        title: "Sleep longer",
        status: "active",
        horizon: "long_term",
        domains: ["sleep"],
      }),
      "utf8",
    );

    const upsertResult = await runCli<{
      goalId: string;
    }>([
      "goal",
      "upsert",
      "--input",
      `@${payloadPath}`,
      "--vault",
      vaultRoot,
    ]);
    const goalId = requireData(upsertResult).goalId;

    const nounShow = await runCli<{
      entity: {
        id: string;
        kind: string;
        data: Record<string, unknown>;
        links: Array<{ id: string }>;
      };
    }>([
      "goal",
      "show",
      goalId,
      "--vault",
      vaultRoot,
    ]);
    const nounList = await runCli<{
      count: number;
      items: Array<{
        id: string;
        kind: string;
        data: Record<string, unknown>;
      }>;
    }>([
      "goal",
      "list",
      "--vault",
      vaultRoot,
    ]);
    const genericShow = await runCli<{
      entity: {
        id: string;
        kind: string;
      };
    }>([
      "show",
      goalId,
      "--vault",
      vaultRoot,
    ]);
    const genericList = await runCli<{
      items: Array<{
        id: string;
        kind: string;
      }>;
    }>([
      "list",
      "--kind",
      "goal",
      "--vault",
      vaultRoot,
    ]);
    const genericUnfilteredList = await runCli<{
      items: Array<{
        id: string;
        kind: string;
      }>;
    }>([
      "list",
      "--vault",
      vaultRoot,
    ]);

    assert.equal(upsertResult.ok, true);
    assert.equal(nounShow.ok, true);
    assert.equal(nounList.ok, true);
    assert.equal(genericShow.ok, true);
    assert.equal(genericList.ok, true);
    assert.equal(genericUnfilteredList.ok, true);
    assert.equal(requireData(genericShow).entity.id, goalId);
    assert.equal(requireData(genericShow).entity.kind, "goal");
    assert.equal(requireData(nounShow).entity.id, goalId);
    assert.equal(requireData(nounShow).entity.kind, "goal");
    assert.equal(requireData(nounShow).entity.data.status, "active");
    assert.deepEqual(requireData(nounShow).entity.data.domains, ["sleep"]);
    assert.equal(requireData(nounShow).entity.links.length, 0);
    assert.equal(requireData(nounList).count, 1);
    assert.deepEqual(
      requireData(nounList).items.map((item) => item.id),
      [goalId],
    );
    assert.equal(requireData(nounList).items[0]?.data.status, "active");
    assert.deepEqual(
      requireData(genericList).items.map((item) => item.id),
      [goalId],
    );
    assert.deepEqual(
      requireData(genericList).items.map((item) => item.kind),
      ["goal"],
    );
    assert.deepEqual(
      requireData(genericUnfilteredList).items.map((item) => item.id),
      [goalId],
    );
    assert.deepEqual(
      requireData(genericUnfilteredList).items.map((item) => item.kind),
      ["goal"],
    );
  } finally {
    await rm(vaultRoot, { recursive: true, force: true });
  }
});

test.sequential("goal upsert rejects reserved vault-root overrides from JSON payloads", async () => {
  const vaultRoot = await mkdtemp(path.join(tmpdir(), "healthybob-cli-health-"));
  const redirectVaultRoot = await mkdtemp(path.join(tmpdir(), "healthybob-cli-health-"));
  const payloadPath = path.join(vaultRoot, "goal-override.json");

  try {
    await runCli(["init", "--vault", vaultRoot]);
    await runCli(["init", "--vault", redirectVaultRoot]);
    await writeFile(
      payloadPath,
      JSON.stringify({
        vaultRoot: redirectVaultRoot,
        title: "Redirect writes outside the chosen vault",
        status: "active",
        horizon: "long_term",
      }),
      "utf8",
    );

    const upsertResult = await runCli([
      "goal",
      "upsert",
      "--input",
      `@${payloadPath}`,
      "--vault",
      vaultRoot,
    ]);
    const redirectList = await runCli<{
      items: Array<{ id: string }>;
    }>([
      "goal",
      "list",
      "--vault",
      redirectVaultRoot,
    ]);

    assert.equal(upsertResult.ok, false);
    assert.equal(upsertResult.error?.code, "invalid_payload");
    assert.equal(redirectList.ok, true);
    assert.deepEqual(requireData(redirectList).items, []);
  } finally {
    await rm(vaultRoot, { recursive: true, force: true });
    await rm(redirectVaultRoot, { recursive: true, force: true });
  }
});

test.sequential("family descriptor wiring keeps member-specific commands aligned with generic health reads", async () => {
  const vaultRoot = await mkdtemp(path.join(tmpdir(), "healthybob-cli-health-"));
  const payloadPath = path.join(vaultRoot, "family.json");

  try {
    await runCli(["init", "--vault", vaultRoot]);
    await writeFile(
      payloadPath,
      JSON.stringify({
        title: "Mother",
        relationship: "mother",
        conditions: ["hypertension"],
      }),
      "utf8",
    );

    const upsertResult = await runCli<{
      familyMemberId: string;
    }>([
      "family",
      "upsert",
      "--input",
      `@${payloadPath}`,
      "--vault",
      vaultRoot,
    ]);
    const familyMemberId = requireData(upsertResult).familyMemberId;

    const nounShow = await runCli<{
      entity: {
        id: string;
        kind: string;
        data: Record<string, unknown>;
      };
    }>([
      "family",
      "show",
      familyMemberId,
      "--vault",
      vaultRoot,
    ]);
    const nounList = await runCli<{
      count: number;
      items: Array<{
        id: string;
        kind: string;
        data: Record<string, unknown>;
      }>;
    }>([
      "family",
      "list",
      "--vault",
      vaultRoot,
    ]);
    const genericShow = await runCli<{
      entity: {
        id: string;
        kind: string;
      };
    }>([
      "show",
      familyMemberId,
      "--vault",
      vaultRoot,
    ]);
    const genericList = await runCli<{
      items: Array<{
        id: string;
        kind: string;
      }>;
    }>([
      "list",
      "--kind",
      "family",
      "--vault",
      vaultRoot,
    ]);

    assert.equal(upsertResult.ok, true);
    assert.equal(nounShow.ok, true);
    assert.equal(nounList.ok, true);
    assert.equal(genericShow.ok, true);
    assert.equal(genericList.ok, true);
    assert.equal(requireData(genericShow).entity.id, familyMemberId);
    assert.equal(requireData(genericShow).entity.kind, "family");
    assert.equal(requireData(nounShow).entity.id, familyMemberId);
    assert.equal(requireData(nounShow).entity.kind, "family");
    assert.deepEqual(requireData(nounShow).entity.data.conditions, ["hypertension"]);
    assert.equal(requireData(nounList).count, 1);
    assert.deepEqual(
      requireData(nounList).items.map((item) => item.id),
      [familyMemberId],
    );
    assert.deepEqual(requireData(nounList).items[0]?.data.conditions, ["hypertension"]);
    assert.deepEqual(
      requireData(genericList).items.map((item) => item.id),
      [familyMemberId],
    );
    assert.deepEqual(
      requireData(genericList).items.map((item) => item.kind),
      ["family"],
    );
  } finally {
    await rm(vaultRoot, { recursive: true, force: true });
  }
});

test.sequential("history descriptor wiring preserves the shared history-ledger upsert result shape", async () => {
  const vaultRoot = await mkdtemp(path.join(tmpdir(), "healthybob-cli-health-"));
  const payloadPath = path.join(vaultRoot, "history.json");

  try {
    await runCli(["init", "--vault", vaultRoot]);
    await writeFile(
      payloadPath,
      JSON.stringify({
        kind: "encounter",
        occurredAt: "2026-03-12T13:00:00.000Z",
        title: "Primary care follow-up",
        encounterType: "office_visit",
        location: "Primary care clinic",
      }),
      "utf8",
    );

    const upsertResult = await runCli<{
      eventId: string;
      lookupId: string;
      ledgerFile: string;
      created: boolean;
    }>([
      "history",
      "upsert",
      "--input",
      `@${payloadPath}`,
      "--vault",
      vaultRoot,
    ]);
    const eventId = requireData(upsertResult).eventId;
    const showResult = await runCli<{
      entity: {
        id: string;
        kind: string;
        data: Record<string, unknown>;
      };
    }>([
      "history",
      "show",
      eventId,
      "--vault",
      vaultRoot,
    ]);
    const genericShow = await runCli<{
      entity: {
        id: string;
        kind: string;
        data: Record<string, unknown>;
      };
    }>([
      "show",
      eventId,
      "--vault",
      vaultRoot,
    ]);

    assert.equal(upsertResult.ok, true);
    assert.match(eventId, /^evt_/u);
    assert.equal(requireData(upsertResult).lookupId, eventId);
    assert.equal(requireData(upsertResult).created, true);
    assert.equal(
      requireData(upsertResult).ledgerFile,
      "ledger/events/2026/2026-03.jsonl",
    );
    assert.equal(showResult.ok, true);
    assert.equal(genericShow.ok, true);
    assert.equal(requireData(showResult).entity.id, eventId);
    assert.equal(requireData(showResult).entity.kind, "encounter");
    assert.equal(requireData(showResult).entity.data.encounterType, "office_visit");
    assert.equal(requireData(genericShow).entity.id, eventId);
    assert.equal(requireData(genericShow).entity.kind, "encounter");
    assert.equal(requireData(genericShow).entity.data.encounterType, "office_visit");
  } finally {
    await rm(vaultRoot, { recursive: true, force: true });
  }
});

test.sequential("history list keeps canonical kind/data and echoes shared filters", async () => {
  const vaultRoot = await mkdtemp(path.join(tmpdir(), "healthybob-cli-health-"));
  const encounterPayloadPath = path.join(vaultRoot, "history-encounter.json");

  try {
    await runCli(["init", "--vault", vaultRoot]);
    await writeFile(
      encounterPayloadPath,
      JSON.stringify({
        kind: "encounter",
        occurredAt: "2026-03-12T13:00:00.000Z",
        title: "Primary care follow-up",
        encounterType: "office_visit",
        location: "Primary care clinic",
      }),
      "utf8",
    );

    await runCli([
      "history",
      "upsert",
      "--input",
      `@${encounterPayloadPath}`,
      "--vault",
      vaultRoot,
    ]);
    const listResult = await runCli<{
      count: number;
      filters: Record<string, unknown>;
      nextCursor: string | null;
      items: Array<{
        id: string;
        kind: string;
        data: Record<string, unknown>;
      }>;
    }>([
      "history",
      "list",
      "--kind",
      "encounter",
      "--limit",
      "5",
      "--vault",
      vaultRoot,
    ]);

    assert.equal(listResult.ok, true);
    assert.equal(requireData(listResult).filters.kind, "encounter");
    assert.equal("from" in requireData(listResult).filters, false);
    assert.equal("to" in requireData(listResult).filters, false);
    assert.equal(requireData(listResult).filters.limit, 5);
    assert.equal(requireData(listResult).count, 1);
    assert.equal(requireData(listResult).nextCursor, null);
    assert.equal(requireData(listResult).items[0]?.kind, "encounter");
    assert.equal(requireData(listResult).items[0]?.data.encounterType, "office_visit");
  } finally {
    await rm(vaultRoot, { recursive: true, force: true });
  }
});

test.sequential("profile current lookup stays wired for both noun-specific and generic show", async () => {
  const vaultRoot = await mkdtemp(path.join(tmpdir(), "healthybob-cli-health-"));
  const payloadPath = path.join(vaultRoot, "profile.json");

  try {
    await runCli(["init", "--vault", vaultRoot]);
    await writeFile(
      payloadPath,
      JSON.stringify({
        source: "manual",
        profile: {
          domains: ["sleep"],
          topGoalIds: [],
        },
      }),
      "utf8",
    );

    const upsertResult = await runCli([
      "profile",
      "upsert",
      "--input",
      `@${payloadPath}`,
      "--vault",
      vaultRoot,
    ]);
    const nounShow = await runCli<{
      entity: {
        id: string;
        kind: string;
        data: Record<string, unknown>;
        links: Array<{ id: string }>;
      };
    }>([
      "profile",
      "show",
      "current",
      "--vault",
      vaultRoot,
    ]);
    const genericShow = await runCli<{
      entity: {
        kind: string;
      };
    }>([
      "show",
      "current",
      "--vault",
      vaultRoot,
    ]);

    assert.equal(upsertResult.ok, true);
    assert.equal(nounShow.ok, true);
    assert.equal(genericShow.ok, true);
    assert.equal(requireData(genericShow).entity.kind, "profile");
    assert.equal(requireData(nounShow).entity.id, "current");
    assert.equal(requireData(nounShow).entity.kind, "profile");
    assert.deepEqual(requireData(nounShow).entity.data.topGoalIds, []);
    assert.equal(requireData(nounShow).entity.links.length >= 1, true);
  } finally {
    await rm(vaultRoot, { recursive: true, force: true });
  }
});

test.sequential("profile list and current show preserve canonical links and strip reserved fields", async () => {
  const vaultRoot = await mkdtemp(path.join(tmpdir(), "healthybob-cli-health-"));
  const goalPayloadPath = path.join(vaultRoot, "goal-linked.json");
  const profilePayloadPath = path.join(vaultRoot, "profile-linked.json");
  const assessmentId = "asmt_01JNY0B2W4VG5C2A0G9S8M7R6Q";
  const eventId = "evt_01JNY0B2W4VG5C2A0G9S8M7R6R";

  try {
    await runCli(["init", "--vault", vaultRoot]);
    await writeFile(
      goalPayloadPath,
      JSON.stringify({
        title: "Recover better",
        status: "active",
        horizon: "long_term",
        domains: ["sleep"],
      }),
      "utf8",
    );

    const goalUpsert = await runCli<{
      goalId: string;
    }>([
      "goal",
      "upsert",
      "--input",
      `@${goalPayloadPath}`,
      "--vault",
      vaultRoot,
    ]);
    const goalId = requireData(goalUpsert).goalId;

    await mkdir(path.join(vaultRoot, "ledger/assessments/2026"), {
      recursive: true,
    });
    await writeFile(
      path.join(vaultRoot, "ledger/assessments/2026/2026-03.jsonl"),
      `${JSON.stringify({
        schemaVersion: "hb.assessment-response.v1",
        id: assessmentId,
        assessmentType: "full-intake",
        recordedAt: "2026-03-12T13:00:00Z",
        source: "manual",
        title: "Linked assessment",
        responses: {
          sleep: {
            averageHours: 7,
          },
        },
      })}\n`,
      "utf8",
    );
    await mkdir(path.join(vaultRoot, "ledger/events/2026"), {
      recursive: true,
    });
    await writeFile(
      path.join(vaultRoot, "ledger/events/2026/2026-03.jsonl"),
      `${JSON.stringify({
        schemaVersion: "hb.event.v1",
        id: eventId,
        kind: "encounter",
        occurredAt: "2026-03-12T12:45:00Z",
        recordedAt: "2026-03-12T12:50:00Z",
        source: "manual",
        title: "Linked encounter",
      })}\n`,
      "utf8",
    );
    await writeFile(
      profilePayloadPath,
      JSON.stringify({
        source: "manual",
        sourceAssessmentIds: [assessmentId],
        sourceEventIds: [eventId],
        profile: {
          domains: ["sleep"],
          topGoalIds: [goalId],
        },
      }),
      "utf8",
    );

    const profileUpsert = await runCli<{
      snapshotId: string;
    }>([
      "profile",
      "upsert",
      "--input",
      `@${profilePayloadPath}`,
      "--vault",
      vaultRoot,
    ]);
    const snapshotId = requireData(profileUpsert).snapshotId;

    const profileList = await runCli<{
      count: number;
      nextCursor: string | null;
      items: Array<{
        kind: string;
        title: string | null;
        path: string | null;
        data: Record<string, unknown>;
        links: Array<{ id: string }>;
      }>;
    }>([
      "profile",
      "list",
      "--vault",
      vaultRoot,
    ]);
    const currentProfile = await runCli<{
      entity: {
        kind: string;
        title: string | null;
        markdown: string | null;
        path: string | null;
        data: Record<string, unknown>;
        links: Array<{ id: string }>;
      };
    }>([
      "profile",
      "show",
      "current",
      "--vault",
      vaultRoot,
    ]);
    const genericCurrentProfile = await runCli<{
      entity: {
        kind: string;
        title: string | null;
        markdown: string | null;
        links: Array<{ id: string }>;
      };
    }>([
      "show",
      "current",
      "--vault",
      vaultRoot,
    ]);

    assert.equal(profileUpsert.ok, true);
    assert.equal(profileList.ok, true);
    assert.equal(requireData(profileList).count, 1);
    assert.equal(requireData(profileList).nextCursor, null);
    assert.equal(requireData(profileList).items[0]?.kind, "profile");
    assert.equal(requireData(profileList).items[0]?.title, snapshotId);
    assert.equal(Boolean(requireData(profileList).items[0]?.path), true);
    assert.deepEqual(
      requireData(profileList).items[0]?.links.map((link) => link.id).sort(),
      [assessmentId, eventId].sort(),
    );
    assert.equal("relativePath" in requireData(profileList).items[0]!.data, false);
    assert.equal("body" in requireData(profileList).items[0]!.data, false);

    assert.equal(currentProfile.ok, true);
    assert.equal(genericCurrentProfile.ok, true);
    assert.equal(requireData(currentProfile).entity.kind, "profile");
    assert.equal(requireData(currentProfile).entity.title, "Current profile");
    assert.equal(
      requireData(currentProfile).entity.title,
      requireData(genericCurrentProfile).entity.title,
    );
    assert.equal(
      requireData(currentProfile).entity.markdown,
      requireData(genericCurrentProfile).entity.markdown,
    );
    assert.equal(Boolean(requireData(currentProfile).entity.path), true);
    assert.deepEqual(
      requireData(currentProfile).entity.links.map((link) => link.id).sort(),
      [assessmentId, eventId, goalId, snapshotId].sort(),
    );
    assert.equal("relativePath" in requireData(currentProfile).entity.data, false);
    assert.equal("body" in requireData(currentProfile).entity.data, false);
  } finally {
    await rm(vaultRoot, { recursive: true, force: true });
  }
});

test.sequential("profile upsert rejects malformed profile payloads instead of coercing them to {}", async () => {
  const vaultRoot = await mkdtemp(path.join(tmpdir(), "healthybob-cli-health-"));
  const payloadPath = path.join(vaultRoot, "profile-invalid.json");

  try {
    await runCli(["init", "--vault", vaultRoot]);
    await writeFile(
      payloadPath,
      JSON.stringify({
        source: "manual",
        profile: "oops",
      }),
      "utf8",
    );

    const upsertResult = await runCli([
      "profile",
      "upsert",
      "--input",
      `@${payloadPath}`,
      "--vault",
      vaultRoot,
    ]);
    const profileList = await runCli<{
      items: Array<{ id: string }>;
    }>([
      "profile",
      "list",
      "--vault",
      vaultRoot,
    ]);

    assert.equal(upsertResult.ok, false);
    assert.equal(upsertResult.error?.code, "invalid_payload");
    assert.equal(profileList.ok, true);
    assert.deepEqual(requireData(profileList).items, []);
  } finally {
    await rm(vaultRoot, { recursive: true, force: true });
  }
});
