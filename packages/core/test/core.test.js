import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";

import {
  addMeal,
  appendJsonlRecord,
  copyRawArtifact,
  createExperiment,
  ensureJournalDay,
  importDocument,
  importSamples,
  initializeVault,
  parseFrontmatterDocument,
  readJsonlRecords,
  validateVault,
  VaultError,
} from "../src/index.js";

async function makeTempDirectory(name) {
  return fs.mkdtemp(path.join(os.tmpdir(), `${name}-`));
}

async function writeExternalFile(directory, fileName, content) {
  const filePath = path.join(directory, fileName);
  await fs.writeFile(filePath, content, "utf8");
  return filePath;
}

test("initializeVault bootstraps the baseline contract layout and passes validation", async () => {
  const vaultRoot = await makeTempDirectory("healthybob-vault");
  const initialized = await initializeVault({
    vaultRoot,
    createdAt: "2026-03-12T12:00:00.000Z",
  });

  assert.equal(initialized.metadata.schemaVersion, "hb.vault.v1");
  assert.match(initialized.metadata.vaultId, /^vault_[0-9A-HJKMNP-TV-Z]{26}$/);

  const coreContent = await fs.readFile(path.join(vaultRoot, "CORE.md"), "utf8");
  const coreDocument = parseFrontmatterDocument(coreContent);
  assert.equal(coreDocument.attributes.docType, "core");
  assert.equal(coreDocument.attributes.schemaVersion, "hb.frontmatter.core.v1");

  const validation = await validateVault({ vaultRoot });
  assert.equal(validation.valid, true);
  assert.deepEqual(validation.issues, []);

  const auditRecords = await readJsonlRecords({
    vaultRoot,
    relativePath: initialized.auditPath,
  });

  assert.equal(auditRecords.length, 1);
  assert.equal(auditRecords[0].action, "vault_init");
  assert.deepEqual(
    auditRecords[0].changes.map((change) => change.path),
    ["CORE.md", "vault.json"],
  );
});

test("copyRawArtifact enforces raw immutability and importDocument appends contract-shaped events", async () => {
  const vaultRoot = await makeTempDirectory("healthybob-vault");
  const sourceRoot = await makeTempDirectory("healthybob-source");
  await initializeVault({ vaultRoot });

  const documentPath = await writeExternalFile(sourceRoot, "Lab Result.pdf", "document body");
  await copyRawArtifact({
    vaultRoot,
    sourcePath: documentPath,
    category: "documents",
    targetName: "lab-result.pdf",
    recordId: "fixed-record",
  });

  await assert.rejects(
    () =>
      copyRawArtifact({
        vaultRoot,
        sourcePath: documentPath,
        category: "documents",
        targetName: "lab-result.pdf",
        recordId: "fixed-record",
      }),
    (error) => error instanceof VaultError && error.code === "VAULT_RAW_IMMUTABLE",
  );

  const imported = await importDocument({
    vaultRoot,
    sourcePath: documentPath,
    note: "baseline import",
  });

  assert.match(imported.raw.relativePath, /^raw\/documents\/\d{4}\/\d{2}\/doc_[0-9A-HJKMNP-TV-Z]{26}\//);
  assert.match(imported.documentId, /^doc_[0-9A-HJKMNP-TV-Z]{26}$/);

  const eventRecords = await readJsonlRecords({
    vaultRoot,
    relativePath: imported.eventPath,
  });

  assert.equal(eventRecords.length, 1);
  assert.equal(eventRecords[0].kind, "document");
  assert.equal(eventRecords[0].documentId, imported.documentId);
  assert.equal(eventRecords[0].documentPath, imported.raw.relativePath);
  assert.equal(eventRecords[0].schemaVersion, "hb.event.v1");
  assert.equal("sourcePath" in eventRecords[0], false);

  const auditRecords = await readJsonlRecords({
    vaultRoot,
    relativePath: imported.auditPath,
  });

  assert.equal(auditRecords.at(-1).action, "document_import");
});

test("meal, journal, experiment, and samples mutations write expected contract data", async () => {
  const vaultRoot = await makeTempDirectory("healthybob-vault");
  const sourceRoot = await makeTempDirectory("healthybob-source");
  await initializeVault({ vaultRoot });

  const photoPath = await writeExternalFile(sourceRoot, "meal photo.jpg", "photo");
  const audioPath = await writeExternalFile(sourceRoot, "meal-note.m4a", "audio");
  const csvPath = await writeExternalFile(sourceRoot, "heart-rate.csv", "recordedAt,value\n");

  const meal = await addMeal({
    vaultRoot,
    occurredAt: "2026-03-10T18:30:00.000Z",
    photoPath,
    audioPath,
    note: "dinner",
  });

  const mealEvents = await readJsonlRecords({
    vaultRoot,
    relativePath: meal.eventPath,
  });

  assert.equal(meal.mealId, mealEvents[0].mealId);
  assert.equal(mealEvents[0].kind, "meal");
  assert.equal(mealEvents[0].photoPaths.length, 1);
  assert.equal(mealEvents[0].audioPaths.length, 1);

  const firstJournal = await ensureJournalDay({
    vaultRoot,
    date: "2026-03-10",
  });
  const secondJournal = await ensureJournalDay({
    vaultRoot,
    date: "2026-03-10",
  });

  assert.equal(firstJournal.created, true);
  assert.equal(secondJournal.created, false);

  const journalContent = await fs.readFile(path.join(vaultRoot, firstJournal.relativePath), "utf8");
  const journalDocument = parseFrontmatterDocument(journalContent);
  assert.equal(journalDocument.attributes.docType, "journal_day");
  assert.equal(journalDocument.attributes.dayKey, "2026-03-10");

  const experiment = await createExperiment({
    vaultRoot,
    slug: "Glucose Baseline",
    title: "Glucose Baseline",
    startedOn: "2026-03-11T08:00:00.000Z",
  });

  const experimentContent = await fs.readFile(
    path.join(vaultRoot, experiment.experiment.relativePath),
    "utf8",
  );
  const experimentDocument = parseFrontmatterDocument(experimentContent);
  assert.equal(experimentDocument.attributes.docType, "experiment");
  assert.equal(experimentDocument.attributes.slug, "glucose-baseline");
  assert.match(experimentDocument.attributes.experimentId, /^exp_[0-9A-HJKMNP-TV-Z]{26}$/);

  const samples = await importSamples({
    vaultRoot,
    stream: "heart_rate",
    unit: "bpm",
    sourcePath: csvPath,
    samples: [
      {
        recordedAt: "2026-01-15T10:00:00.000Z",
        value: 62,
      },
      {
        recordedAt: "2026-02-01T10:00:00.000Z",
        value: 64,
      },
    ],
  });

  assert.equal(samples.count, 2);
  assert.match(samples.transformId, /^xfm_[0-9A-HJKMNP-TV-Z]{26}$/);
  assert.equal(samples.shardPaths.length, 2);
  assert.ok(samples.records.every((record) => record.stream === "heart_rate"));
  assert.ok(samples.records.every((record) => record.transformId === samples.transformId));

  const validation = await validateVault({ vaultRoot });
  assert.equal(validation.valid, true);
});

test("append-only helpers block traversal and validateVault reports tampered core documents", async () => {
  const vaultRoot = await makeTempDirectory("healthybob-vault");
  await initializeVault({ vaultRoot });

  await assert.rejects(
    () =>
      appendJsonlRecord({
        vaultRoot,
        relativePath: "../escape.jsonl",
        record: { ok: true },
      }),
    (error) => error instanceof VaultError && error.code === "VAULT_INVALID_PATH",
  );

  await fs.writeFile(path.join(vaultRoot, "CORE.md"), "---\ndocType: note\n---\n", "utf8");
  const validation = await validateVault({ vaultRoot });

  assert.equal(validation.valid, false);
  assert.match(
    validation.issues.map((issue) => issue.code).join(","),
    /HB_FRONTMATTER_INVALID/,
  );
});
