import { createRequire } from "node:module";

const phase = process.argv[2] ?? "build";
const require = createRequire(import.meta.url);
const missing = [];

for (const specifier of ["typescript/bin/tsc", "incur"]) {
  try {
    require.resolve(specifier);
  } catch {
    missing.push(specifier === "typescript/bin/tsc" ? "typescript" : specifier);
  }
}

if (missing.length > 0) {
  console.error(
    `packages/cli ${phase} is blocked: missing ${missing.join(
      ", ",
    )}. Install the CLI toolchain in the integrating workspace before running this package script.`,
  );
  process.exit(1);
}
