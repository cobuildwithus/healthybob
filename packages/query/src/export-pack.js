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
 *     questionCount: number;
 *     fileCount: number;
 *   };
 *   records: VaultRecord[];
 *   journalEntries: VaultRecord[];
 *   dailySampleSummaries: DailySampleSummary[];
 *   questionPack: {
 *     format: "healthybob.question-pack.v1";
 *     packId: string;
 *     generatedAt: string;
 *     scope: {
 *       from: string | null;
 *       to: string | null;
 *       experimentSlug: string | null;
 *     };
 *     instructions: {
 *       role: string;
 *       answerStyle: string;
 *       evidencePolicy: string;
 *     };
 *     questions: string[];
 *     context: {
 *       experiment: Record<string, unknown> | null;
 *       journals: Record<string, unknown>[];
 *       timeline: Record<string, unknown>[];
 *       dailySampleSummaries: DailySampleSummary[];
 *     };
 *   };
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
    questionCount: 0,
    fileCount: 0,
  };

  const questionPack = buildQuestionPack({
    packId,
    generatedAt,
    filters,
    records,
    journalEntries,
    dailySampleSummaries,
    experimentRecord,
  });
  manifest.questionCount = questionPack.questions.length;
  manifest.fileCount = 5;

  const files = [
    {
      path: `${basePath}/manifest.json`,
      mediaType: "application/json",
      contents: JSON.stringify(
        {
          format: "healthybob.export-pack.v1",
          packId,
          generatedAt,
          filters,
          manifest,
          files: [
            {
              path: `${basePath}/manifest.json`,
              mediaType: "application/json",
              role: "manifest",
            },
            {
              path: `${basePath}/question-pack.json`,
              mediaType: "application/json",
              role: "question-pack",
            },
            {
              path: `${basePath}/records.json`,
              mediaType: "application/json",
              role: "records",
            },
            {
              path: `${basePath}/daily-samples.json`,
              mediaType: "application/json",
              role: "daily-samples",
            },
            {
              path: `${basePath}/assistant-context.md`,
              mediaType: "text/markdown",
              role: "assistant-context",
            },
          ],
        },
        null,
        2,
      ),
    },
    {
      path: `${basePath}/question-pack.json`,
      mediaType: "application/json",
      contents: JSON.stringify(questionPack, null, 2),
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
      contents: renderAssistantContext(questionPack),
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
    journalEntries,
    dailySampleSummaries,
    questionPack,
    files,
  };
}

/**
 * @param {{
 *   packId: string;
 *   generatedAt: string;
 *   scope: { from: string | null; to: string | null; experimentSlug: string | null };
 *   instructions: { role: string; answerStyle: string; evidencePolicy: string };
 *   questions: string[];
 *   context: {
 *     experiment: Record<string, unknown> | null;
 *     journals: Record<string, unknown>[];
 *     timeline: Record<string, unknown>[];
 *     dailySampleSummaries: DailySampleSummary[];
 *   };
 * }} input
 * @returns {string}
 */
function renderAssistantContext(input) {
  const { packId, generatedAt, scope, instructions, questions, context } = input;

  const recordLines = context.timeline.slice(0, 50).map((record) => {
    return `- ${record.when} | ${record.kind} | ${record.id} | ${record.summary}`;
  });

  const summaryLines = context.dailySampleSummaries.map((summary) => {
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
    `- From: ${scope.from ?? "unbounded"}`,
    `- To: ${scope.to ?? "unbounded"}`,
    `- Experiment: ${scope.experimentSlug ?? "all"}`,
    "",
  ];

  lines.push("## Prompt Instructions", "");
  lines.push(`- Role: ${instructions.role}`);
  lines.push(`- Answer Style: ${instructions.answerStyle}`);
  lines.push(`- Evidence Policy: ${instructions.evidencePolicy}`, "");

  lines.push("## Questions", "");
  for (const question of questions) {
    lines.push(`- ${question}`);
  }
  lines.push("");

  if (context.experiment) {
    lines.push("## Experiment Focus", "");
    lines.push(`- ${context.experiment.slug}`);
    if (context.experiment.title) {
      lines.push(`- Title: ${context.experiment.title}`);
    }
    if (context.experiment.startedOn) {
      lines.push(`- Started On: ${context.experiment.startedOn}`);
    }
    if (context.experiment.body) {
      lines.push("", context.experiment.body);
    }
    lines.push("");
  }

  if (context.journals.length > 0) {
    lines.push("## Journal Highlights", "");
    for (const journal of context.journals) {
      lines.push(`- ${journal.date} | ${journal.title}`);
      if (journal.summary) {
        lines.push(`  ${journal.summary}`);
      }
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

function buildQuestionPack(input) {
  const { packId, generatedAt, filters, records, journalEntries, dailySampleSummaries, experimentRecord } =
    input;

  return {
    format: "healthybob.question-pack.v1",
    packId,
    generatedAt,
    scope: filters,
    instructions: {
      role: "Answer as a careful health-record analyst using only the supplied export context.",
      answerStyle: "Be concise, explicitly note uncertainty, and prefer dated observations over generalities.",
      evidencePolicy: "Cite the provided journal notes, record timeline, and daily sample summaries instead of guessing.",
    },
    questions: buildPromptQuestions({
      filters,
      records,
      journalEntries,
      dailySampleSummaries,
      experimentRecord,
    }),
    context: {
      experiment: experimentRecord ? summarizeExperiment(experimentRecord) : null,
      journals: journalEntries.map(summarizeJournalEntry),
      timeline: records.map(summarizeTimelineRecord),
      dailySampleSummaries,
    },
  };
}

function buildPromptQuestions(input) {
  const { filters, records, journalEntries, dailySampleSummaries, experimentRecord } = input;
  const questions = [
    `What are the most important changes or events between ${filters.from ?? "the start"} and ${filters.to ?? "the end"}?`,
    "Which records look most actionable for follow-up, and why?",
  ];

  if (dailySampleSummaries.length > 0) {
    questions.push("What trends or outliers appear in the daily sample summaries?");
  }

  if (journalEntries.length > 0) {
    questions.push("What do the journal notes add that is not obvious from the structured records alone?");
  }

  if (experimentRecord) {
    questions.push(
      `What evidence in this pack is relevant to the ${experimentRecord.experimentSlug} experiment?`,
    );
  }

  if (records.some((record) => record.kind === "meal")) {
    questions.push("Do meals or meal-adjacent notes appear to line up with any reported symptoms or measurements?");
  }

  return questions;
}

function summarizeExperiment(record) {
  return {
    id: record.id,
    slug: record.experimentSlug,
    title: record.title,
    startedOn: record.date,
    tags: record.tags,
    body: record.body,
    sourcePath: record.sourcePath,
  };
}

function summarizeJournalEntry(record) {
  return {
    id: record.id,
    date: record.date,
    title: record.title,
    summary: record.body,
    tags: record.tags,
    eventIds: Array.isArray(record.data.eventIds) ? record.data.eventIds : [],
    sampleStreams: Array.isArray(record.data.sampleStreams) ? record.data.sampleStreams : [],
    sourcePath: record.sourcePath,
  };
}

function summarizeTimelineRecord(record) {
  return {
    id: record.id,
    when: record.occurredAt ?? record.date ?? "unknown-date",
    kind: record.kind ?? record.recordType,
    recordType: record.recordType,
    title: record.title,
    summary: summarizeRecord(record),
    tags: record.tags,
    experimentSlug: record.experimentSlug,
    sourcePath: record.sourcePath,
  };
}

function summarizeRecord(record) {
  if (record.title) {
    return record.title;
  }

  if (typeof record.body === "string" && record.body.trim()) {
    return record.body.trim().split("\n")[0];
  }

  return record.kind ?? record.recordType;
}
