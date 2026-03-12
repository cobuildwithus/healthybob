import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = fileURLToPath(new URL("../", import.meta.url));
const packageJson = JSON.parse(
  await readFile(path.join(packageDir, "package.json"), "utf8"),
);
const tsconfigBuild = JSON.parse(
  await readFile(path.join(packageDir, "tsconfig.build.json"), "utf8"),
);
const sourceFiles = await listFiles(path.join(packageDir, "src"));

assert(
  packageJson.main === "./dist/index.js",
  "package.json must expose ./dist/index.js as main.",
);
assert(
  packageJson.types === "./dist/index.d.ts",
  "package.json must expose ./dist/index.d.ts as types.",
);
assert(
  packageJson.bin?.["vault-cli"] === "dist/bin.js",
  "package.json must expose vault-cli from dist/bin.js.",
);
assert(
  packageJson.exports?.["."]?.default === "./dist/index.js",
  "package.json exports must target dist/index.js.",
);
assert(
  packageJson.exports?.["."]?.types === "./dist/index.d.ts",
  "package.json exports must target dist/index.d.ts for types.",
);
assert(
  packageJson.scripts?.build && packageJson.scripts?.typecheck,
  "package.json must define build and typecheck scripts.",
);
assert(
  tsconfigBuild.compilerOptions?.outDir === "dist",
  "tsconfig.build.json must emit into dist.",
);
assert(
  tsconfigBuild.compilerOptions?.rootDir === "src",
  "tsconfig.build.json must compile from src.",
);
assert(
  tsconfigBuild.compilerOptions?.declaration === true,
  "tsconfig.build.json must emit declarations.",
);

for (const filePath of sourceFiles) {
  const source = await readFile(filePath, "utf8");
  assert(
    !/\.\.\/\.\.\/[^"'`]+\/src\//u.test(source),
    `${path.relative(packageDir, filePath)} still reaches into another package's src tree.`,
  );
}

const libraryEntry = await readFile(path.join(packageDir, "src/index.ts"), "utf8");
assert(
  !/\.serve\(\)/u.test(libraryEntry),
  "src/index.ts must stay import-safe and avoid serving the CLI on package import.",
);

console.log("packages/cli package shape verified.");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function listFiles(directoryPath) {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listFiles(entryPath)));
      continue;
    }

    if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}
