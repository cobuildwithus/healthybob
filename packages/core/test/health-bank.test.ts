import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { test } from "vitest";

import { initializeVault } from "../src/index.js";
import {
  listAllergies,
  listConditions,
  listGoals,
  listRegimenItems,
  readAllergy,
  readCondition,
  readGoal,
  readRegimenItem,
  stopRegimenItem,
  upsertAllergy,
  upsertCondition,
  upsertGoal,
  upsertRegimenItem,
} from "../src/bank/index.js";

async function makeTempDirectory(name: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), `${name}-`));
}

test("goals support multiple active records and preserve relationships in markdown registries", async () => {
  const vaultRoot = await makeTempDirectory("healthybob-goals");
  await initializeVault({ vaultRoot });

  const primary = await upsertGoal({
    vaultRoot,
    title: "Improve fasting glucose",
    status: "active",
    horizon: "medium_term",
    priority: 8,
    window: {
      startAt: "2026-03-01",
      targetAt: "2026-06-01",
    },
    domains: ["Metabolic Health", "Sleep"],
  });
  const secondary = await upsertGoal({
    vaultRoot,
    title: "Lift three days per week",
    status: "active",
    horizon: "ongoing",
    priority: 6,
    window: {
      startAt: "2026-03-05",
    },
    parentGoalId: primary.record.goalId,
    relatedGoalIds: [primary.record.goalId],
    relatedExperimentIds: ["exp_01JNW7YJ7MNE7M9Q2QWQK4Z3F8"],
  });

  const listed = await listGoals(vaultRoot);
  const read = await readGoal({
    vaultRoot,
    goalId: secondary.record.goalId,
  });

  assert.equal(primary.created, true);
  assert.equal(secondary.created, true);
  assert.equal(listed.length, 2);
  assert.equal(read.parentGoalId, primary.record.goalId);
  assert.deepEqual(primary.record.domains, ["metabolic-health", "sleep"]);
  assert.match(read.markdown, /## Related Experiments/);
});

test("conditions and allergies are stored as deterministic markdown registry pages", async () => {
  const vaultRoot = await makeTempDirectory("healthybob-conditions");
  await initializeVault({ vaultRoot });

  const goal = await upsertGoal({
    vaultRoot,
    title: "Reduce migraine frequency",
    window: {
      startAt: "2026-03-01",
    },
  });
  const regimen = await upsertRegimenItem({
    vaultRoot,
    title: "Magnesium glycinate",
    kind: "supplement",
    status: "active",
    startedOn: "2026-03-03",
    dose: 200,
    unit: "mg",
    schedule: "nightly",
  });
  const condition = await upsertCondition({
    vaultRoot,
    title: "Migraine",
    clinicalStatus: "active",
    verificationStatus: "confirmed",
    assertedOn: "2024-05-01",
    bodySites: ["head"],
    relatedGoalIds: [goal.record.goalId],
    relatedRegimenIds: [regimen.record.regimenId],
    note: "Likely worsened by sleep disruption.",
  });
  const allergy = await upsertAllergy({
    vaultRoot,
    title: "Penicillin allergy",
    substance: "penicillin",
    status: "active",
    criticality: "high",
    reaction: "rash",
    recordedOn: "2018-04-10",
    relatedConditionIds: [condition.record.conditionId],
    note: "Avoid beta-lactam exposure until formally reviewed.",
  });

  const conditions = await listConditions(vaultRoot);
  const allergies = await listAllergies(vaultRoot);
  const readConditionRecord = await readCondition({
    vaultRoot,
    slug: condition.record.slug,
  });
  const readAllergyRecord = await readAllergy({
    vaultRoot,
    allergyId: allergy.record.allergyId,
  });

  assert.equal(conditions.length, 1);
  assert.equal(allergies.length, 1);
  assert.deepEqual(readConditionRecord.relatedGoalIds, [goal.record.goalId]);
  assert.deepEqual(readAllergyRecord.relatedConditionIds, [condition.record.conditionId]);
  assert.match(readConditionRecord.markdown, /## Related Regimens/);
  assert.match(readAllergyRecord.markdown, /## Related Conditions/);
});

test("regimens support medication and supplement groups plus stop handling", async () => {
  const vaultRoot = await makeTempDirectory("healthybob-regimens");
  await initializeVault({ vaultRoot });

  const medication = await upsertRegimenItem({
    vaultRoot,
    title: "Metformin XR",
    kind: "medication",
    status: "active",
    startedOn: "2026-02-01",
    substance: "metformin",
    dose: 500,
    unit: "mg",
    schedule: "with dinner",
  });
  const supplement = await upsertRegimenItem({
    vaultRoot,
    title: "Fish oil",
    kind: "supplement",
    status: "active",
    startedOn: "2026-02-15",
    substance: "omega-3",
    dose: 1000,
    unit: "mg",
    schedule: "with breakfast",
  });
  const stopped = await stopRegimenItem({
    vaultRoot,
    regimenId: medication.record.regimenId,
    stoppedOn: "2026-03-20",
  });

  const listed = await listRegimenItems(vaultRoot);
  const readMedication = await readRegimenItem({
    vaultRoot,
    regimenId: medication.record.regimenId,
  });
  const readSupplement = await readRegimenItem({
    vaultRoot,
    slug: supplement.record.slug,
    group: "supplement",
  });

  assert.equal(listed.length, 2);
  assert.equal(readMedication.group, "medication");
  assert.equal(readSupplement.group, "supplement");
  assert.equal(stopped.record.status, "stopped");
  assert.equal(stopped.record.stoppedOn, "2026-03-20");
  assert.match(stopped.record.relativePath, /^bank\/regimens\/medication\//);
  assert.match(readMedication.markdown, /Stopped on: 2026-03-20/);
});
