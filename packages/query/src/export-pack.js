import { getExperiment, listJournalEntries, listRecords } from "./model.js";
import { summarizeDailySamples } from "./summaries.js";

/**
 * @typedef {import("./model.js").VaultReadModel} VaultReadModel
 * @typedef {import("./model.js").VaultRecord} VaultRecord
 * @typedef {import("./summaries.js").DailySampleSummary} DailySampleSummary
 */

/**
 * @typedef {{
 *   path: string;
 *   mediaType: "application/json" | "text/markdown";
 *   contents: string;
 * }} ExportPackFile
 */

/**
 * @typedef {{
 *   format: "healthybob.export-pack.v1";
 *   packId: string;
 *   basePath: string;
 *   generatedAt: string;
 *   filters: {
 *     from: string | null;
 *     to: string | null;
 *     experimentSlug: string | null;
 *   };
 *   manifest: {
 *     recordCount: number;
 *     experimentCount: number;
 *     journalCount: number;
 *     sampleSummaryCount: number;
 *   };
 *   records: VaultRecord[];
 *   dailySampleSummaries: DailySampleSummary[];
 *   files: ExportPackFile[];
 * }} ExportPack
 */

/**
 * @param {VaultReadModel} vault
 * @param {{ from?: string; to?: string; experimentSlug?: string; packId?: string; generatedAt?: string }} [options]
 * @returns {ExportPack}
 */
export function buildExportPack(vault, options = {}) {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const packId =
    options.packId ??
    [
      "pack",
      options.from ?? "start",
      options.to ?? "end",
      options.experimentSlug ?? "all",
    ]
      .join("-")
      .replace(/[^a-zA-Z0-9._-]+/g, "-");
  const basePath = `exports/packs/${packId}`;
  const filters = {
    from: options.from ?? null,
    to: options.to ?? null,
    experimentSlug: options.experimentSlug ?? null,
  };

  const records = listRecords(vault, {
    from: filters.from ?? undefined,
    to: filters.to ?? undefined,
    experimentSlug: filters.experimentSlug ?? undefined,
  });
  const journalEntries = listJournalEntries(vault, {
    from: filters.from ?? undefined,
    to: filters.to ?? undefined,
    experimentSlug: filters.experimentSlug ?? undefined,
  });
  const dailySampleSummaries = summarizeDailySamples(vault, {
    from: filters.from ?? undefined,
    to: filters.to ?? undefined,
    experimentSlug: filters.experimentSlug ?? undefined,
  });
  const experimentRecord = filters.experimentSlug
    ? getExperiment(vault, filters.experimentSlug)
    : null;

  const manifest = {
    recordCount: records.length,
    experimentCount: experimentRecord ? 1 : vault.experiments.length,
    journalCount: journalEntries.length,
    sampleSummaryCount: dailySampleSummaries.length,
  };

  const exportPayload = {
    format: "healthybob.export-pack.v1",
    packId,
    generatedAt,
    filters,
    manifest,
    records,
    dailySampleSummaries,
    experiment: experimentRecord,
  };

  const files = [
    {
      path: `${basePath}/manifest.json`,
      mediaType: "application/json",
      contents: JSON.stringify(exportPayload, null, 2),
    },
    {
      path: `${basePath}/records.json`,
      mediaType: "application/json",
      contents: JSON.stringify(records, null, 2),
    },
    {
      path: `${basePath}/daily-samples.json`,
      mediaType: "application/json",
      contents: JSON.stringify(dailySampleSummaries, null, 2),
    },
    {
      path: `${basePath}/assistant-context.md`,
      mediaType: "text/markdown",
      contents: renderAssistantContext({
        packId,
        generatedAt,
        filters,
        records,
        dailySampleSummaries,
        experimentRecord,
      }),
    },
  ];

  return {
    format: "healthybob.export-pack.v1",
    packId,
    basePath,
    generatedAt,
    filters,
    manifest,
    records,
    dailySampleSummaries,
    files,
  };
}

/**
 * @param {{
 *   packId: string;
 *   generatedAt: string;
 *   filters: { from: string | null; to: string | null; experimentSlug: string | null };
 *   records: VaultRecord[];
 *   dailySampleSummaries: DailySampleSummary[];
 *   experimentRecord: VaultRecord | null;
 * }} input
 * @returns {string}
 */
function renderAssistantContext(input) {
  const { packId, generatedAt, filters, records, dailySampleSummaries, experimentRecord } = input;

  const recordLines = records.slice(0, 50).map((record) => {
    const date = record.occurredAt ?? record.date ?? "unknown-date";
    const label = record.title ?? record.kind ?? record.recordType;
    return `- ${date} | ${record.recordType} | ${record.id} | ${label}`;
  });

  const summaryLines = dailySampleSummaries.map((summary) => {
    const averageValue =
      summary.averageValue === null ? "n/a" : String(summary.averageValue);
    const unitSuffix = summary.unit ? ` ${summary.unit}` : "";
    return `- ${summary.date} | ${summary.stream} | count=${summary.sampleCount} | avg=${averageValue}${unitSuffix}`;
  });

  const lines = [
    "# Healthy Bob Export Pack",
    "",
    `- Pack ID: ${packId}`,
    `- Generated At: ${generatedAt}`,
    `- From: ${filters.from ?? "unbounded"}`,
    `- To: ${filters.to ?? "unbounded"}`,
    `- Experiment: ${filters.experimentSlug ?? "all"}`,
    "",
  ];

  if (experimentRecord) {
    lines.push("## Experiment Focus", "");
    lines.push(`- ${experimentRecord.experimentSlug}`);
    if (experimentRecord.title) {
      lines.push(`- Title: ${experimentRecord.title}`);
    }
    if (experimentRecord.body) {
      lines.push("", experimentRecord.body);
    }
    lines.push("");
  }

  lines.push("## Record Timeline", "", ...recordLines, "", "## Daily Sample Summaries", "");

  if (summaryLines.length > 0) {
    lines.push(...summaryLines);
  } else {
    lines.push("- No sample summaries in scope.");
  }

  lines.push("");
  return lines.join("\n");
}
