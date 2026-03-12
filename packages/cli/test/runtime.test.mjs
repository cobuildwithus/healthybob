import { test } from "node:test";
import assert from "node:assert/strict";
import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const packageDir = fileURLToPath(new URL("../", import.meta.url));
const repoRoot = path.resolve(packageDir, "../..");
const binPath = path.join(packageDir, "dist/bin.js");
const sampleDocumentPath = path.join(repoRoot, "fixtures/sample-imports/README.md");

async function runCli(args) {
  const { stdout } = await execFileAsync(process.execPath, [binPath, ...args], {
    cwd: repoRoot,
  });

  return JSON.parse(stdout);
}

async function makeFixtureVault() {
  const vaultRoot = await mkdtemp("/tmp/healthybob-cli-test-");
  const csvPath = path.join(vaultRoot, "samples.csv");
  await writeFile(
    csvPath,
    [
      "timestamp,bpm",
      "2026-03-12T08:00:00Z,61",
      "2026-03-12T08:01:00Z,63",
      "",
    ].join("\n"),
    "utf8",
  );

  await runCli(["init", "--vault", vaultRoot, "--format", "json"]);

  const document = await runCli([
    "document",
    "import",
    sampleDocumentPath,
    "--vault",
    vaultRoot,
    "--format",
    "json",
  ]);
  const meal = await runCli([
    "meal",
    "add",
    "--photo",
    sampleDocumentPath,
    "--vault",
    vaultRoot,
    "--format",
    "json",
  ]);
  const journal = await runCli([
    "journal",
    "ensure",
    "2026-03-12",
    "--vault",
    vaultRoot,
    "--format",
    "json",
  ]);
  const samples = await runCli([
    "samples",
    "import-csv",
    csvPath,
    "--stream",
    "heart_rate",
    "--ts-column",
    "timestamp",
    "--value-column",
    "bpm",
    "--unit",
    "bpm",
    "--vault",
    vaultRoot,
    "--format",
    "json",
  ]);

  return {
    vaultRoot,
    document: document.data,
    meal: meal.data,
    journal: journal.data,
    samples: samples.data,
  };
}

test("show enforces non-queryable related ids and accepts returned lookup ids", async () => {
  const fixture = await makeFixtureVault();

  try {
    const showDocument = await runCli([
      "show",
      fixture.document.lookupId,
      "--vault",
      fixture.vaultRoot,
      "--format",
      "json",
    ]);
    assert.equal(showDocument.ok, true);
    assert.equal(showDocument.data.entity.kind, "document");

    const showJournal = await runCli([
      "show",
      fixture.journal.lookupId,
      "--vault",
      fixture.vaultRoot,
      "--format",
      "json",
    ]);
    assert.equal(showJournal.ok, true);
    assert.equal(showJournal.data.entity.kind, "journal_day");

    const showSample = await runCli([
      "show",
      fixture.samples.lookupIds[0],
      "--vault",
      fixture.vaultRoot,
      "--format",
      "json",
    ]);
    assert.equal(showSample.ok, true);
    assert.equal(showSample.data.entity.kind, "sample");

    for (const invalidId of [
      fixture.meal.mealId,
      fixture.document.documentId,
      fixture.samples.transformId,
      "pack_placeholder",
    ]) {
      const result = await runCli([
        "show",
        invalidId,
        "--vault",
        fixture.vaultRoot,
        "--format",
        "json",
      ]);
      assert.equal(result.ok, false);
      assert.equal(result.error.code, "invalid_lookup_id");
    }
  } finally {
    await rm(fixture.vaultRoot, { recursive: true, force: true });
  }
});

test("export pack materializes the derived five-file pack when --out is set", async () => {
  const fixture = await makeFixtureVault();
  const outDir = await mkdtemp("/tmp/healthybob-cli-export-");

  try {
    const result = await runCli([
      "export",
      "pack",
      "--from",
      "2026-03-12",
      "--to",
      "2026-03-12",
      "--out",
      outDir,
      "--vault",
      fixture.vaultRoot,
      "--format",
      "json",
    ]);

    assert.equal(result.ok, true);
    assert.equal(result.data.files.length, 5);

    for (const relativePath of result.data.files) {
      await access(path.join(outDir, relativePath));
    }
  } finally {
    await rm(outDir, { recursive: true, force: true });
    await rm(fixture.vaultRoot, { recursive: true, force: true });
  }
});
