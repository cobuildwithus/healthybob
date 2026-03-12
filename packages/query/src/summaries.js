/**
 * @typedef {import("./model.js").VaultReadModel} VaultReadModel
 * @typedef {import("./model.js").VaultRecord} VaultRecord
 */

/**
 * @typedef {{
 *   date: string;
 *   stream: string;
 *   sampleCount: number;
 *   units: string[];
 *   unit: string | null;
 *   minValue: number | null;
 *   maxValue: number | null;
 *   averageValue: number | null;
 *   sumValue: number | null;
 *   firstSampleAt: string | null;
 *   lastSampleAt: string | null;
 *   sampleIds: string[];
 *   sourcePaths: string[];
 * }} DailySampleSummary
 */

/**
 * @param {VaultReadModel} vault
 * @param {{ from?: string; to?: string; streams?: string[]; experimentSlug?: string }} [filters]
 * @returns {DailySampleSummary[]}
 */
export function summarizeDailySamples(vault, filters = {}) {
  const { from, to, streams, experimentSlug } = filters;
  const streamSet = streams ? new Set(streams) : null;

  /** @type {Map<string, {summary: DailySampleSummary; values: number[]; unitSet: Set<string>}>} */
  const groups = new Map();

  for (const sample of vault.samples) {
    const date = sample.date;
    const stream = sample.stream;

    if (!date || !stream) {
      continue;
    }

    if (from && date < from) {
      continue;
    }

    if (to && date > to) {
      continue;
    }

    if (streamSet && !streamSet.has(stream)) {
      continue;
    }

    if (experimentSlug && sample.experimentSlug !== experimentSlug) {
      continue;
    }

    const key = `${date}:${stream}`;
    const numericValue = getNumericValue(sample);
    const unit = getString(sample.data.unit);

    if (!groups.has(key)) {
      groups.set(key, {
        summary: {
          date,
          stream,
          sampleCount: 0,
          units: [],
          unit: null,
          minValue: null,
          maxValue: null,
          averageValue: null,
          sumValue: null,
          firstSampleAt: null,
          lastSampleAt: null,
          sampleIds: [],
          sourcePaths: [],
        },
        values: [],
        unitSet: new Set(),
      });
    }

    const group = groups.get(key);
    if (!group) {
      continue;
    }

    const { summary, values, unitSet } = group;
    summary.sampleCount += 1;
    summary.sampleIds.push(sample.id);

    if (!summary.sourcePaths.includes(sample.sourcePath)) {
      summary.sourcePaths.push(sample.sourcePath);
    }

    if (sample.occurredAt) {
      if (!summary.firstSampleAt || sample.occurredAt < summary.firstSampleAt) {
        summary.firstSampleAt = sample.occurredAt;
      }

      if (!summary.lastSampleAt || sample.occurredAt > summary.lastSampleAt) {
        summary.lastSampleAt = sample.occurredAt;
      }
    }

    if (unit) {
      unitSet.add(unit);
    }

    if (numericValue !== null) {
      values.push(numericValue);
    }
  }

  return [...groups.values()]
    .map(({ summary, values, unitSet }) => {
      const sortedUnits = [...unitSet].sort();
      summary.units = sortedUnits;
      summary.unit = sortedUnits.length === 1 ? sortedUnits[0] : null;

      if (values.length > 0) {
        summary.minValue = Math.min(...values);
        summary.maxValue = Math.max(...values);
        summary.sumValue = values.reduce((sum, value) => sum + value, 0);
        summary.averageValue = Number((summary.sumValue / values.length).toFixed(4));
      }

      summary.sampleIds.sort();
      summary.sourcePaths.sort();

      return summary;
    })
    .sort((left, right) => {
      if (left.date === right.date) {
        return left.stream.localeCompare(right.stream);
      }

      return left.date.localeCompare(right.date);
    });
}

/**
 * @param {VaultRecord} sample
 * @returns {number | null}
 */
function getNumericValue(sample) {
  const rawValue = sample.data.value;
  return typeof rawValue === "number" && Number.isFinite(rawValue) ? rawValue : null;
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function getString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
