import {
  coreFrontmatterSchema,
  journalDayFrontmatterSchema,
  experimentFrontmatterSchema,
  vaultMetadataSchema,
  eventRecordSchema,
  sampleRecordSchema,
  auditRecordSchema,
} from "../../contracts/src/schemas.js";
import { validateAgainstSchema } from "../../contracts/src/validate.js";
import {
  DEFAULT_TIMEZONE,
  FRONTMATTER_SCHEMA_VERSIONS,
  ID_PREFIXES,
  REQUIRED_DIRECTORIES,
  VAULT_LAYOUT,
  VAULT_PATHS,
  VAULT_SCHEMA_VERSION,
  VAULT_SHARDS,
} from "./constants.js";
import { emitAuditRecord } from "./audit.js";
import {
  ensureVaultDirectory,
  ensureDirectory,
  pathExists,
  readJsonFile,
  readUtf8File,
  walkVaultFiles,
  writeVaultJsonFile,
  writeVaultTextFile,
} from "./fs.js";
import { parseFrontmatterDocument, stringifyFrontmatterDocument } from "./frontmatter.js";
import { readJsonlRecords } from "./jsonl.js";
import { generateVaultId } from "./ids.js";
import { VaultError } from "./errors.js";
import { normalizeVaultRoot, resolveVaultPath } from "./path-safety.js";
import { toIsoTimestamp } from "./time.js";

function assertContractShape(schema, value, code, message) {
  const errors = validateAgainstSchema(schema, value);

  if (errors.length > 0) {
    throw new VaultError(code, message, { errors });
  }
}

function buildCoreDocument({ vaultId, title, timezone, updatedAt }) {
  return stringifyFrontmatterDocument({
    attributes: {
      schemaVersion: FRONTMATTER_SCHEMA_VERSIONS.core,
      docType: "core",
      vaultId,
      title,
      timezone,
      updatedAt,
    },
    body: `# ${title}\n\n## Notes\n\n`,
  });
}

function buildVaultMetadata({ vaultId, createdAt, title, timezone }) {
  return {
    schemaVersion: VAULT_SCHEMA_VERSION,
    vaultId,
    createdAt,
    title,
    timezone,
    idPolicy: {
      format: "prefix_ulid",
      prefixes: { ...ID_PREFIXES },
    },
    paths: { ...VAULT_PATHS },
    shards: { ...VAULT_SHARDS },
  };
}

function validationIssue(code, message, path = null, severity = "error") {
  return path ? { code, message, path, severity } : { code, message, severity };
}

export async function initializeVault({
  vaultRoot,
  title = "Healthy Bob Vault",
  timezone = DEFAULT_TIMEZONE,
  createdAt = new Date(),
} = {}) {
  const absoluteRoot = normalizeVaultRoot(vaultRoot);
  const metadataPath = resolveVaultPath(absoluteRoot, VAULT_LAYOUT.metadata);

  if (await pathExists(metadataPath.absolutePath)) {
    throw new VaultError("VAULT_ALREADY_EXISTS", "Vault already exists at the requested root.");
  }

  await ensureDirectory(absoluteRoot);

  for (const relativeDirectory of REQUIRED_DIRECTORIES) {
    await ensureVaultDirectory(absoluteRoot, relativeDirectory);
  }

  const createdTimestamp = toIsoTimestamp(createdAt, "createdAt");
  const metadata = buildVaultMetadata({
    vaultId: generateVaultId(),
    createdAt: createdTimestamp,
    title,
    timezone,
  });
  assertContractShape(
    vaultMetadataSchema,
    metadata,
    "VAULT_INVALID_METADATA",
    "Generated vault metadata failed contract validation.",
  );

  await writeVaultJsonFile(absoluteRoot, VAULT_LAYOUT.metadata, metadata, { overwrite: false });
  await writeVaultTextFile(
    absoluteRoot,
    VAULT_LAYOUT.coreDocument,
    buildCoreDocument({
      vaultId: metadata.vaultId,
      title,
      timezone,
      updatedAt: createdTimestamp,
    }),
    { overwrite: false },
  );

  const audit = await emitAuditRecord({
    vaultRoot: absoluteRoot,
    action: "vault_init",
    commandName: "core.initializeVault",
    summary: "Initialized vault metadata and core document.",
    occurredAt: createdTimestamp,
    files: [VAULT_LAYOUT.metadata, VAULT_LAYOUT.coreDocument],
    targetIds: [metadata.vaultId],
  });

  const vault = await loadVault({ vaultRoot: absoluteRoot });

  return {
    ...vault,
    created: true,
    auditPath: audit.relativePath,
  };
}

export async function loadVault({ vaultRoot } = {}) {
  const absoluteRoot = normalizeVaultRoot(vaultRoot);
  const metadata = await readJsonFile(absoluteRoot, VAULT_LAYOUT.metadata);
  assertContractShape(
    vaultMetadataSchema,
    metadata,
    "VAULT_INVALID_METADATA",
    "Vault metadata failed contract validation.",
  );

  return {
    vaultRoot: absoluteRoot,
    metadata,
    layout: {
      ...VAULT_LAYOUT,
    },
  };
}

async function validateFrontmatterFile({
  vaultRoot,
  relativePath,
  schema,
  code,
}) {
  try {
    const content = await readUtf8File(vaultRoot, relativePath);
    const parsed = parseFrontmatterDocument(content);
    const errors = validateAgainstSchema(schema, parsed.attributes);

    if (errors.length > 0) {
      return [validationIssue(code, errors.join("; "), relativePath)];
    }
  } catch (error) {
    return [
      validationIssue(
        error instanceof VaultError && error.code === "VAULT_FILE_MISSING" ? error.code : code,
        error instanceof Error ? error.message : String(error),
        relativePath,
      ),
    ];
  }

  return [];
}

async function validateJsonlFamily({
  vaultRoot,
  relativeDirectory,
  schema,
  code,
}) {
  const jsonlFiles = await walkVaultFiles(vaultRoot, relativeDirectory, {
    extension: ".jsonl",
  });
  const issues = [];

  for (const relativePath of jsonlFiles) {
    const records = await readJsonlRecords({
      vaultRoot,
      relativePath,
    });

    records.forEach((record, index) => {
      const errors = validateAgainstSchema(schema, record);
      if (errors.length > 0) {
        issues.push(
          validationIssue(
            code,
            `record ${index + 1}: ${errors.join("; ")}`,
            relativePath,
          ),
        );
      }
    });
  }

  return issues;
}

export async function validateVault({ vaultRoot } = {}) {
  const absoluteRoot = normalizeVaultRoot(vaultRoot);
  const issues = [];
  let metadata = null;

  try {
    metadata = (await loadVault({ vaultRoot: absoluteRoot })).metadata;
  } catch (error) {
    issues.push(
      validationIssue(
        error instanceof VaultError ? error.code : "VAULT_LOAD_FAILED",
        error instanceof Error ? error.message : String(error),
        VAULT_LAYOUT.metadata,
      ),
    );

    return {
      valid: false,
      issues,
      metadata,
    };
  }

  for (const relativeDirectory of REQUIRED_DIRECTORIES) {
    const directoryPath = resolveVaultPath(absoluteRoot, relativeDirectory);

    if (!(await pathExists(directoryPath.absolutePath))) {
      issues.push(
        validationIssue(
          "VAULT_MISSING_DIRECTORY",
          `Missing required directory "${relativeDirectory}".`,
          relativeDirectory,
        ),
      );
    }
  }

  issues.push(
    ...(await validateFrontmatterFile({
      vaultRoot: absoluteRoot,
      relativePath: VAULT_LAYOUT.coreDocument,
      schema: coreFrontmatterSchema,
      code: "HB_FRONTMATTER_INVALID",
    })),
  );

  const experimentFiles = await walkVaultFiles(absoluteRoot, VAULT_LAYOUT.experimentsDirectory, {
    extension: ".md",
  });
  for (const relativePath of experimentFiles) {
    issues.push(
      ...(await validateFrontmatterFile({
        vaultRoot: absoluteRoot,
        relativePath,
        schema: experimentFrontmatterSchema,
        code: "HB_FRONTMATTER_INVALID",
      })),
    );
  }

  const journalFiles = await walkVaultFiles(absoluteRoot, VAULT_LAYOUT.journalDirectory, {
    extension: ".md",
  });
  for (const relativePath of journalFiles) {
    issues.push(
      ...(await validateFrontmatterFile({
        vaultRoot: absoluteRoot,
        relativePath,
        schema: journalDayFrontmatterSchema,
        code: "HB_FRONTMATTER_INVALID",
      })),
    );
  }

  issues.push(
    ...(await validateJsonlFamily({
      vaultRoot: absoluteRoot,
      relativeDirectory: VAULT_LAYOUT.eventLedgerDirectory,
      schema: eventRecordSchema,
      code: "HB_EVENT_INVALID",
    })),
  );
  issues.push(
    ...(await validateJsonlFamily({
      vaultRoot: absoluteRoot,
      relativeDirectory: VAULT_LAYOUT.sampleLedgerDirectory,
      schema: sampleRecordSchema,
      code: "HB_SAMPLE_INVALID",
    })),
  );
  issues.push(
    ...(await validateJsonlFamily({
      vaultRoot: absoluteRoot,
      relativeDirectory: VAULT_LAYOUT.auditDirectory,
      schema: auditRecordSchema,
      code: "HB_AUDIT_INVALID",
    })),
  );

  return {
    valid: issues.length === 0,
    issues,
    metadata,
  };
}
