import { execFile } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scanRoots = ["packages", "e2e"] as const;
const blockedExtensions = new Set([".js", ".mjs", ".cjs", ".d.ts"]);
const execFileAsync = promisify(execFile);

async function main(): Promise<void> {
  const sourceArtifactOffenders: string[] = [];

  for (const root of scanRoots) {
    await scanPath(root, sourceArtifactOffenders);
  }

  const trackedBuildArtifactOffenders = await findTrackedBuildArtifacts();

  if (sourceArtifactOffenders.length > 0 || trackedBuildArtifactOffenders.length > 0) {
    const message = ["Found blocked package/e2e source or tracked build artifacts:"];

    if (sourceArtifactOffenders.length > 0) {
      message.push(
        "Handwritten source artifacts outside dist/:",
        ...sourceArtifactOffenders.map((filePath) => `- ${filePath}`),
      );
    }

    if (trackedBuildArtifactOffenders.length > 0) {
      message.push(
        "Tracked build artifacts:",
        ...trackedBuildArtifactOffenders.map((filePath) => `- ${filePath}`),
      );
    }

    throw new Error(message.join("\n"));
  }

  console.log(
    "No handwritten .js, .mjs, .cjs, or .d.ts files, and no tracked dist/.test-dist/*.tsbuildinfo artifacts, found under packages/ or e2e/.",
  );
}

async function scanPath(relativePath: string, offenders: string[]): Promise<void> {
  const absolutePath = path.join(repoRoot, relativePath);
  const entries = await readdir(absolutePath, { withFileTypes: true });

  for (const entry of entries) {
    const entryRelativePath = path.posix.join(relativePath, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === "dist" || entry.name === "node_modules") {
        continue;
      }

      await scanPath(entryRelativePath, offenders);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const extension = path.extname(entry.name);
    const hasBlockedDeclarationSuffix = entry.name.endsWith(".d.ts");

    if (blockedExtensions.has(extension) || hasBlockedDeclarationSuffix) {
      offenders.push(entryRelativePath);
    }
  }
}

async function findTrackedBuildArtifacts(): Promise<string[]> {
  const { stdout } = await execFileAsync("git", ["ls-files", "--", ...scanRoots], {
    cwd: repoRoot,
  });
  const trackedFiles = stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return trackedFiles.filter(
    (filePath) =>
      filePath.endsWith(".tsbuildinfo") ||
      filePath.includes("/.test-dist/") ||
      filePath.includes("/dist/"),
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
