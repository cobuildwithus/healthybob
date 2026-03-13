import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  exampleAssessmentResponses,
  exampleAuditRecords,
  exampleEventRecords,
  exampleFrontmatterMarkdown,
  exampleFrontmatterObjects,
  exampleHealthFrontmatterObjects,
  exampleProfileSnapshots,
  exampleSampleRecords,
  exampleVaultMetadata,
} from "@healthybob/contracts";
import {
  allergyFrontmatterSchema,
  assessmentResponseSchema,
  auditRecordSchema,
  conditionFrontmatterSchema,
  coreFrontmatterSchema,
  eventRecordSchema,
  experimentFrontmatterSchema,
  familyMemberFrontmatterSchema,
  geneticVariantFrontmatterSchema,
  goalFrontmatterSchema,
  journalDayFrontmatterSchema,
  profileCurrentFrontmatterSchema,
  profileSnapshotSchema,
  regimenFrontmatterSchema,
  sampleRecordSchema,
  schemaCatalog,
  vaultMetadataSchema,
} from "@healthybob/contracts/schemas";
import {
  parseFrontmatterMarkdown,
  validateAgainstSchema,
} from "@healthybob/contracts/validate";

interface PackageJsonShape {
  main?: string;
  types?: string;
  exports?: Record<
    string,
    {
      default?: string;
      types?: string;
    } | string
  >;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(__dirname, "../..");
const generatedDir = path.resolve(__dirname, "../../generated");
const distDir = path.join(packageDir, "dist");

function assertNoErrors(label: string, schema: Record<string, unknown>, value: unknown): void {
  const errors = validateAgainstSchema(schema, value);
  if (errors.length > 0) {
    throw new Error(`${label} failed validation:\n${errors.join("\n")}`);
  }
}

const packageJson = JSON.parse(
  await readFile(path.join(packageDir, "package.json"), "utf8"),
) as PackageJsonShape;

assert.equal(packageJson.main, "./dist/index.js");
assert.equal(packageJson.types, "./dist/index.d.ts");
assert.deepEqual(packageJson.exports?.["."], {
  types: "./dist/index.d.ts",
  default: "./dist/index.js",
});
assert.deepEqual(packageJson.exports?.["./schemas"], {
  types: "./dist/schemas.d.ts",
  default: "./dist/schemas.js",
});

await assertPathExists(path.join(distDir, "index.js"));
await assertPathExists(path.join(distDir, "index.d.ts"));
await assertPathExists(path.join(distDir, "schemas.js"));
await assertPathExists(path.join(distDir, "scripts", "generate-json-schema.js"));
await assertPathExists(path.join(distDir, "scripts", "verify.js"));
await assertPathMissing(path.join(distDir, "src"));

for (const [name, sourceSchema] of Object.entries(schemaCatalog)) {
  const artifactPath = path.join(generatedDir, `${name}.schema.json`);
  const artifact = JSON.parse(await readFile(artifactPath, "utf8"));
  assert.deepEqual(
    artifact,
    sourceSchema,
    `Schema artifact ${path.basename(artifactPath)} is stale or mismatched`,
  );
}

assertNoErrors("vault metadata example", vaultMetadataSchema, exampleVaultMetadata);
exampleAssessmentResponses.forEach((record, index) =>
  assertNoErrors(`assessment response example ${index + 1}`, assessmentResponseSchema, record),
);
exampleEventRecords.forEach((record, index) => assertNoErrors(`event example ${index + 1}`, eventRecordSchema, record));
exampleProfileSnapshots.forEach((record, index) =>
  assertNoErrors(`profile snapshot example ${index + 1}`, profileSnapshotSchema, record),
);
exampleSampleRecords.forEach((record, index) => assertNoErrors(`sample example ${index + 1}`, sampleRecordSchema, record));
exampleAuditRecords.forEach((record, index) => assertNoErrors(`audit example ${index + 1}`, auditRecordSchema, record));

assertNoErrors("core frontmatter object", coreFrontmatterSchema, exampleFrontmatterObjects.core);
assertNoErrors("journal day frontmatter object", journalDayFrontmatterSchema, exampleFrontmatterObjects.journalDay);
assertNoErrors("experiment frontmatter object", experimentFrontmatterSchema, exampleFrontmatterObjects.experiment);
assertNoErrors("profile current frontmatter object", profileCurrentFrontmatterSchema, exampleHealthFrontmatterObjects.profileCurrent);
assertNoErrors("goal frontmatter object", goalFrontmatterSchema, exampleHealthFrontmatterObjects.goal);
assertNoErrors("condition frontmatter object", conditionFrontmatterSchema, exampleHealthFrontmatterObjects.condition);
assertNoErrors("allergy frontmatter object", allergyFrontmatterSchema, exampleHealthFrontmatterObjects.allergy);
assertNoErrors("regimen frontmatter object", regimenFrontmatterSchema, exampleHealthFrontmatterObjects.regimen);
assertNoErrors("family-member frontmatter object", familyMemberFrontmatterSchema, exampleHealthFrontmatterObjects.familyMember);
assertNoErrors("genetic-variant frontmatter object", geneticVariantFrontmatterSchema, exampleHealthFrontmatterObjects.geneticVariant);

assert.deepEqual(parseFrontmatterMarkdown(exampleFrontmatterMarkdown.core), exampleFrontmatterObjects.core);
assert.deepEqual(parseFrontmatterMarkdown(exampleFrontmatterMarkdown.journalDay), exampleFrontmatterObjects.journalDay);
assert.deepEqual(parseFrontmatterMarkdown(exampleFrontmatterMarkdown.experiment), exampleFrontmatterObjects.experiment);

console.log(
  [
    "Verified schema artifacts and examples.",
    `assessments=${exampleAssessmentResponses.length}`,
    `events=${exampleEventRecords.length}`,
    `profileSnapshots=${exampleProfileSnapshots.length}`,
    `samples=${exampleSampleRecords.length}`,
    `audits=${exampleAuditRecords.length}`,
  ].join(" "),
);

async function assertPathExists(filePath: string): Promise<void> {
  await access(filePath);
}

async function assertPathMissing(filePath: string): Promise<void> {
  try {
    await access(filePath);
  } catch {
    return;
  }

  throw new Error(`Unexpected build artifact path present: ${path.relative(packageDir, filePath)}`);
}
