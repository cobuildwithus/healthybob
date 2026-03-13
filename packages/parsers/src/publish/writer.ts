import path from "node:path";
import { promises as fs } from "node:fs";

import type { ParserOutput } from "../contracts/parse.js";
import {
  normalizeRelativePath,
  resetDirectory,
  resolveVaultRelativePath,
} from "../shared.js";

export interface PublishedParserArtifacts {
  attemptDirectoryPath: string;
  manifestPath: string;
  plainTextPath: string;
  markdownPath: string;
  chunksPath: string;
  tablesPath?: string | null;
}

export async function writeParserArtifacts(input: {
  attempt: number;
  vaultRoot: string;
  output: ParserOutput;
}): Promise<PublishedParserArtifacts> {
  const baseDirectory = normalizeRelativePath(
    path.posix.join(
      "derived",
      "inbox",
      input.output.artifact.captureId,
      "attachments",
      input.output.artifact.attachmentId,
    ),
  );
  const attemptDirectoryPath = normalizeRelativePath(
    path.posix.join(
      baseDirectory,
      "attempts",
      String(input.attempt).padStart(4, "0"),
    ),
  );
  const absoluteAttemptDirectory = resolveVaultRelativePath(
    input.vaultRoot,
    attemptDirectoryPath,
  );
  await resetDirectory(absoluteAttemptDirectory);

  const plainTextPath = normalizeRelativePath(path.posix.join(attemptDirectoryPath, "plain.txt"));
  const markdownPath = normalizeRelativePath(path.posix.join(attemptDirectoryPath, "normalized.md"));
  const chunksPath = normalizeRelativePath(path.posix.join(attemptDirectoryPath, "chunks.jsonl"));
  const manifestPath = normalizeRelativePath(path.posix.join(attemptDirectoryPath, "manifest.json"));
  const tablesPath = input.output.tables.length > 0
    ? normalizeRelativePath(path.posix.join(attemptDirectoryPath, "tables.json"))
    : null;

  try {
    await fs.writeFile(
      resolveVaultRelativePath(input.vaultRoot, plainTextPath),
      `${input.output.text.trim()}\n`,
      "utf8",
    );
    await fs.writeFile(
      resolveVaultRelativePath(input.vaultRoot, markdownPath),
      `${input.output.markdown.trim()}\n`,
      "utf8",
    );
    await fs.writeFile(
      resolveVaultRelativePath(input.vaultRoot, chunksPath),
      input.output.blocks.map((block) => JSON.stringify(block)).join("\n") + (input.output.blocks.length > 0 ? "\n" : ""),
      "utf8",
    );

    if (tablesPath) {
      await fs.writeFile(
        resolveVaultRelativePath(input.vaultRoot, tablesPath),
        `${JSON.stringify(input.output.tables, null, 2)}\n`,
        "utf8",
      );
    }

    await fs.writeFile(
      resolveVaultRelativePath(input.vaultRoot, manifestPath),
      `${JSON.stringify(
        {
          schema: "healthybob.parser-manifest.v1",
          providerId: input.output.providerId,
          createdAt: input.output.createdAt,
          artifact: input.output.artifact,
          metadata: input.output.metadata,
          paths: {
            plainTextPath,
            markdownPath,
            chunksPath,
            tablesPath,
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  } catch (error) {
    await fs.rm(absoluteAttemptDirectory, { recursive: true, force: true });
    throw error;
  }

  return {
    attemptDirectoryPath,
    manifestPath,
    plainTextPath,
    markdownPath,
    chunksPath,
    tablesPath,
  };
}
