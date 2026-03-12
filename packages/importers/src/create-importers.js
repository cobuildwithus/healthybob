import * as defaultCorePort from "../../core/src/index.js";
import { importCsvSamples } from "./csv-sample-importer.js";
import { importDocument } from "./document-importer.js";
import { importMeal } from "./meal-importer.js";
import { createSamplePresetRegistry } from "./preset-registry.js";

export function createImporters({ corePort, presetRegistry } = {}) {
  const registry = presetRegistry ?? createSamplePresetRegistry();
  const writer = corePort ?? defaultCorePort;

  return {
    presetRegistry: registry,
    importDocument(input) {
      return importDocument(input, { corePort: writer });
    },
    importMeal(input) {
      return importMeal(input, { corePort: writer });
    },
    importCsvSamples(input) {
      return importCsvSamples(input, {
        corePort: writer,
        presetRegistry: registry,
      });
    },
  };
}
