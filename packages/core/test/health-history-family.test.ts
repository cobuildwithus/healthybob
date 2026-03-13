import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { test } from "vitest";

import { initializeVault, readJsonlRecords } from "../src/index.js";
import { appendHistoryEvent, listHistoryEvents, readHistoryEvent } from "../src/history/index.js";
import { listFamilyMembers, readFamilyMember, upsertFamilyMember } from "../src/family/index.js";
import { listGeneticVariants, readGeneticVariant, upsertGeneticVariant } from "../src/genetics/index.js";

async function makeTempDirectory(name: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), `${name}-`));
}

test("health history appends to the shared event ledger and supports list/read flows", async () => {
  const vaultRoot = await makeTempDirectory("healthybob-history");
  await initializeVault({ vaultRoot });

  const encounter = await appendHistoryEvent({
    vaultRoot,
    kind: "encounter",
    occurredAt: "2026-03-01T12:00:00.000Z",
    title: "Endocrinology follow-up",
    encounterType: "specialist_follow_up",
    location: "Endocrinology clinic",
    providerId: "prov_01JNW7YJ7MNE7M9Q2QWQK4Z3F8",
    tags: ["Endocrine", "Quarterly"],
  });
  const adverseEffect = await appendHistoryEvent({
    vaultRoot,
    kind: "adverse_effect",
    occurredAt: "2026-03-02T12:00:00.000Z",
    title: "Rash after antibiotic",
    substance: "amoxicillin",
    effect: "rash",
    severity: "moderate",
  });

  assert.equal(encounter.relativePath, "ledger/events/2026/2026-03.jsonl");
  assert.equal(adverseEffect.relativePath, "ledger/events/2026/2026-03.jsonl");

  const shardRecords = await readJsonlRecords({
    vaultRoot,
    relativePath: encounter.relativePath,
  });

  assert.equal(shardRecords.length, 2);

  const listed = await listHistoryEvents({
    vaultRoot,
    order: "asc",
  });
  const filtered = await listHistoryEvents({
    vaultRoot,
    kinds: ["adverse_effect"],
  });
  const read = await readHistoryEvent({
    vaultRoot,
    eventId: adverseEffect.record.id,
  });

  assert.equal(listed.length, 2);
  assert.equal(listed[0]?.kind, "encounter");
  assert.deepEqual(listed[0]?.tags, ["endocrine", "quarterly"]);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.id, adverseEffect.record.id);
  assert.equal(read.record.kind, "adverse_effect");
  assert.equal(read.record.effect, "rash");
});

test("family members are stored as deterministic markdown registry entries", async () => {
  const vaultRoot = await makeTempDirectory("healthybob-family");
  await initializeVault({ vaultRoot });

  const created = await upsertFamilyMember({
    vaultRoot,
    title: "Maternal Grandmother",
    relationship: "grandmother",
    conditions: ["Type 2 diabetes", "cardiometabolic risk"],
    note: "Type 2 diabetes diagnosed in her 60s.",
    relatedVariantIds: ["var_01JNW7YJ7MNE7M9Q2QWQK4Z3F8"],
  });
  const updated = await upsertFamilyMember({
    vaultRoot,
    familyMemberId: created.record.familyMemberId,
    slug: "changed-slug-that-should-not-rename",
    title: "Maternal Grandmother",
    relationship: "grandmother",
    note: "Updated summary.",
  });

  const listed = await listFamilyMembers(vaultRoot);
  const read = await readFamilyMember({
    vaultRoot,
    slug: created.record.slug,
  });

  assert.equal(created.created, true);
  assert.equal(updated.created, false);
  assert.equal(updated.record.relativePath, created.record.relativePath);
  assert.equal(updated.record.slug, created.record.slug);
  assert.equal(listed.length, 1);
  assert.equal(read.familyMemberId, created.record.familyMemberId);
  assert.match(read.markdown, /## Related Variants/);
  assert.deepEqual(read.relatedVariantIds, ["var_01JNW7YJ7MNE7M9Q2QWQK4Z3F8"]);
});

test("genetic variants are stored in markdown registries and can link to family members", async () => {
  const vaultRoot = await makeTempDirectory("healthybob-genetics");
  await initializeVault({ vaultRoot });

  const familyMember = await upsertFamilyMember({
    vaultRoot,
    title: "Father",
    relationship: "father",
  });
  const created = await upsertGeneticVariant({
    vaultRoot,
    gene: "APOE",
    title: "APOE e4 allele",
    significance: "risk_factor",
    sourceFamilyMemberIds: [familyMember.record.familyMemberId],
    note: "Family history and genotype raise late-life risk.",
  });
  const updated = await upsertGeneticVariant({
    vaultRoot,
    variantId: created.record.variantId,
    gene: "APOE",
    title: "APOE e4 allele",
    significance: "risk_factor",
    note: "Maintain aggressive cardiometabolic prevention.",
    sourceFamilyMemberIds: [familyMember.record.familyMemberId],
  });

  const listed = await listGeneticVariants(vaultRoot);
  const read = await readGeneticVariant({
    vaultRoot,
    variantId: created.record.variantId,
  });

  assert.equal(created.created, true);
  assert.equal(updated.created, false);
  assert.equal(listed.length, 1);
  assert.equal(read.variantId, created.record.variantId);
  assert.equal(read.gene, "APOE");
  assert.deepEqual(read.sourceFamilyMemberIds, [familyMember.record.familyMemberId]);
  assert.match(read.markdown, /## Source Family Members/);
});
