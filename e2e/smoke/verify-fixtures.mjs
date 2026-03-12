#!/usr/bin/env node

import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");
const coverageMode = process.argv.includes("--coverage");

async function pathExists(relativePath) {
  try {
    await access(path.join(repoRoot, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function readJson(relativePath) {
  const fullPath = path.join(repoRoot, relativePath);
  const raw = await readFile(fullPath, "utf8");
  return JSON.parse(raw);
}

async function readUtf8(relativePath) {
  const fullPath = path.join(repoRoot, relativePath);
  return readFile(fullPath, "utf8");
}

function pushMissing(errors, label, relativePath) {
  errors.push(`Missing ${label}: ${relativePath}`);
}

function extractDocumentedCommands(commandSurface) {
  const match = commandSurface.match(/## (?:Baseline Commands|Command Groups)\s+```text\s*([\s\S]*?)```/);
  if (!match) {
    throw new Error("Could not find the documented command block in docs/contracts/03-command-surface.md");
  }

  return match[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("vault-cli "));
}

function expectString(errors, value, fieldName, scenarioFile) {
  if (typeof value !== "string" || value.length === 0) {
    errors.push(`Invalid ${fieldName} in ${scenarioFile}`);
    return false;
  }

  return true;
}

async function main() {
  const errors = [];
  const corpusPath = "fixtures/fixture-corpus.json";

  if (!(await pathExists(corpusPath))) {
    pushMissing(errors, "fixture corpus manifest", corpusPath);
  }

  if (!(await pathExists("e2e/smoke/scenarios"))) {
    pushMissing(errors, "scenario directory", "e2e/smoke/scenarios");
  }

  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }

  const corpus = await readJson(corpusPath);
  const commandSurface = await readUtf8("docs/contracts/03-command-surface.md");
  const documentedCommands = extractDocumentedCommands(commandSurface);
  const scenarioDir = path.join(repoRoot, "e2e/smoke/scenarios");
  const scenarioFiles = (await readdir(scenarioDir))
    .filter((fileName) => fileName.endsWith(".json"))
    .sort();

  if (scenarioFiles.length === 0) {
    errors.push("No smoke scenario manifests found in e2e/smoke/scenarios");
  }

  const goldenOutputPaths = new Set();
  const sampleImportPaths = new Set();
  const vaultFixturePaths = new Set();

  for (const fixture of corpus.vaultFixtures ?? []) {
    if (!expectString(errors, fixture.id, "vault fixture id", corpusPath)) {
      continue;
    }

    if (!expectString(errors, fixture.path, "vault fixture path", corpusPath)) {
      continue;
    }

    vaultFixturePaths.add(fixture.path);

    if (!(await pathExists(fixture.path))) {
      pushMissing(errors, "vault fixture directory", fixture.path);
      continue;
    }

    for (const relativePath of fixture.requiredPaths ?? []) {
      const joinedPath = path.posix.join(fixture.path, relativePath);
      if (!(await pathExists(joinedPath))) {
        pushMissing(errors, "vault fixture artifact", joinedPath);
      }
    }
  }

  for (const sample of corpus.sampleImports ?? []) {
    if (!expectString(errors, sample.id, "sample import id", corpusPath)) {
      continue;
    }

    if (!expectString(errors, sample.path, "sample import path", corpusPath)) {
      continue;
    }

    sampleImportPaths.add(sample.path);

    if (!(await pathExists(sample.path))) {
      pushMissing(errors, "sample import fixture", sample.path);
    }
  }

  for (const golden of corpus.goldenOutputs ?? []) {
    if (!expectString(errors, golden.id, "golden output id", corpusPath)) {
      continue;
    }

    if (!expectString(errors, golden.path, "golden output path", corpusPath)) {
      continue;
    }

    goldenOutputPaths.add(golden.path);

    if (!(await pathExists(golden.path))) {
      pushMissing(errors, "golden output directory", golden.path);
      continue;
    }

    const readmePath = path.posix.join(golden.path, "README.md");
    if (!(await pathExists(readmePath))) {
      pushMissing(errors, "golden output README", readmePath);
    }
  }

  const seenScenarioIds = new Set();
  const seenScenarioCommands = new Set();
  const referencedSampleImports = new Set();
  const referencedGoldenOutputs = new Set();
  const referencedVaultFixtures = new Set();

  for (const fileName of scenarioFiles) {
    const relativeScenarioPath = path.posix.join("e2e/smoke/scenarios", fileName);
    const scenario = await readJson(relativeScenarioPath);

    if (!expectString(errors, scenario.id, "scenario id", relativeScenarioPath)) {
      continue;
    }

    if (!expectString(errors, scenario.command, "scenario command", relativeScenarioPath)) {
      continue;
    }

    if (!expectString(errors, scenario.vaultFixture, "scenario vault fixture", relativeScenarioPath)) {
      continue;
    }

    if (!expectString(errors, scenario.goldenOutput, "scenario golden output", relativeScenarioPath)) {
      continue;
    }

    if (!Array.isArray(scenario.inputs)) {
      errors.push(`Invalid scenario inputs in ${relativeScenarioPath}`);
      continue;
    }

    const expectedFileName = `${scenario.id}.json`;
    if (fileName !== expectedFileName) {
      errors.push(`Scenario file name mismatch: expected ${expectedFileName}, found ${fileName}`);
    }

    if (seenScenarioIds.has(scenario.id)) {
      errors.push(`Duplicate scenario id: ${scenario.id}`);
    }
    seenScenarioIds.add(scenario.id);

    if (seenScenarioCommands.has(scenario.command)) {
      errors.push(`Duplicate scenario command: ${scenario.command}`);
    }
    seenScenarioCommands.add(scenario.command);

    referencedVaultFixtures.add(scenario.vaultFixture);
    referencedGoldenOutputs.add(scenario.goldenOutput);

    if (!(await pathExists(scenario.vaultFixture))) {
      pushMissing(errors, "scenario vault fixture", scenario.vaultFixture);
    }

    if (!vaultFixturePaths.has(scenario.vaultFixture)) {
      errors.push(`Scenario references unindexed vault fixture: ${scenario.vaultFixture}`);
    }

    if (!(await pathExists(scenario.goldenOutput))) {
      pushMissing(errors, "scenario golden output", scenario.goldenOutput);
    }

    if (!goldenOutputPaths.has(scenario.goldenOutput)) {
      errors.push(`Scenario references unindexed golden output: ${scenario.goldenOutput}`);
    }

    for (const inputPath of scenario.inputs) {
      if (typeof inputPath !== "string" || inputPath.length === 0) {
        errors.push(`Invalid scenario input in ${relativeScenarioPath}`);
        continue;
      }

      if (!(await pathExists(inputPath))) {
        pushMissing(errors, "scenario input", inputPath);
      }

      if (sampleImportPaths.has(inputPath)) {
        referencedSampleImports.add(inputPath);
      }
    }
  }

  if (coverageMode) {
    const documentedCommandSet = new Set(documentedCommands);

    for (const command of documentedCommands) {
      if (!seenScenarioCommands.has(command)) {
        errors.push(`Missing smoke scenario for documented command: ${command}`);
      }
    }

    for (const command of seenScenarioCommands) {
      if (!documentedCommandSet.has(command)) {
        errors.push(`Smoke scenario command is not in the documented baseline surface: ${command}`);
      }
    }

    for (const inputPath of sampleImportPaths) {
      if (!referencedSampleImports.has(inputPath)) {
        errors.push(`Unreferenced sample import fixture: ${inputPath}`);
      }
    }

    for (const outputPath of goldenOutputPaths) {
      if (!referencedGoldenOutputs.has(outputPath)) {
        errors.push(`Unreferenced golden output directory: ${outputPath}`);
      }
    }

    for (const fixturePath of vaultFixturePaths) {
      if (!referencedVaultFixtures.has(fixturePath)) {
        errors.push(`Unreferenced vault fixture: ${fixturePath}`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }

  const modeLabel = coverageMode ? "coverage" : "integrity";
  console.log(
    `Smoke ${modeLabel} verification passed for ${scenarioFiles.length} scenarios, ` +
      `${sampleImportPaths.size} sample inputs, and ${goldenOutputPaths.size} golden-output directories.`,
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
